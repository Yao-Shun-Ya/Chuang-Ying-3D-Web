import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { copyFileSync, existsSync, mkdirSync, writeFileSync } from 'fs';
import { join } from 'path';
import { Order } from '../order/order.service';
import { ModelService } from '../model/model.service';
import { PrintTask, PrintDeviceInterface } from './print-device.interface';

/**
 * 打印任务下发服务
 * - 将模型文件复制到本地打印任务目录 data/print-tasks/<orderNo>/
 * - 生成 task.json 打印参数清单
 * - 预留 HTTP 回调钩子（PRINT_CALLBACK_URL 非空时 POST 通知线下主机）
 * - 预留硬件对接扩展接口 PrintDeviceInterface
 */
@Injectable()
export class PrintDispatchService {
  private readonly logger = new Logger(PrintDispatchService.name);
  private device: PrintDeviceInterface | null = null;

  constructor(
    private configService: ConfigService,
    private modelService: ModelService,
  ) {}

  /** 注册打印设备实现（扩展点） */
  registerDevice(device: PrintDeviceInterface) {
    this.device = device;
    this.logger.log(`已注册打印设备: ${device.name}`);
  }

  /**
   * 下发打印任务
   */
  async dispatch(order: Order) {
    const model = this.modelService.findById(order.model_id);
    if (!model) throw new Error('模型不存在，无法下发打印任务');

    const taskDir = join(
      process.cwd(),
      this.configService.get('storage.printTaskDir'),
      order.order_no,
    );
    if (!existsSync(taskDir)) mkdirSync(taskDir, { recursive: true });

    // 1. 复制模型文件
    const destModel = join(taskDir, model.original_name);
    copyFileSync(model.file_path, destModel);

    // 2. 生成任务清单 JSON
    const material = this.configService.get('material');
    const task: PrintTask = {
      orderNo: order.order_no,
      modelPath: destModel,
      volume: order.volume,
      material,
      estimatedCost: order.cost,
    };
    writeFileSync(join(taskDir, 'task.json'), JSON.stringify(task, null, 2), 'utf8');

    this.logger.log(`打印任务已下发: ${order.order_no} -> ${taskDir}`);

    // 3. HTTP 回调钩子（通知线下接收电脑）
    const callbackUrl = this.configService.get<string>('printCallbackUrl');
    if (callbackUrl) {
      try {
        await fetch(callbackUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(task),
        });
        this.logger.log(`回调通知已发送: ${callbackUrl}`);
      } catch (e) {
        this.logger.warn(`回调通知失败（不影响本地下发）: ${e.message}`);
      }
    }

    // 4. 硬件对接扩展点（如已注册设备）
    if (this.device) {
      try {
        await this.device.sendTask(task);
      } catch (e) {
        this.logger.warn(`打印设备下发失败: ${e.message}`);
      }
    }

    return { taskDir, task };
  }
}
