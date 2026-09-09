import { Injectable, OnModuleInit, Logger } from '@nestjs/common';
import { DeviceManagerService } from '../device/device-manager.service';
import { UnifiedDeviceStatus } from '../device/device.interface';
import { OrderService } from './order.service';

/**
 * 订单-设备联动服务
 * - 订阅 Bambu 打印机状态：FINISH（working→idle）自动流转绑定订单 printing → completed
 * - 打印机报错：记录管理端告警（不自动退款，人工处理）
 */
@Injectable()
export class OrderDeviceLinkService implements OnModuleInit {
  private readonly logger = new Logger(OrderDeviceLinkService.name);

  constructor(
    private deviceManager: DeviceManagerService,
    private orderService: OrderService,
  ) {}

  onModuleInit() {
    this.deviceManager.onDeviceStateChange((deviceId, from, to) =>
      this.handleStateChange(deviceId, from, to),
    );
  }

  private async handleStateChange(
    deviceId: string,
    from: UnifiedDeviceStatus,
    to: UnifiedDeviceStatus,
  ) {
    const config = await this.deviceManager.getDeviceConfig(deviceId);
    if (!config || config.category !== 'fdm') return;

    // 打印完成：working → idle（Bambu FINISH 映射）
    if (from.state === 'working' && to.state === 'idle' && to.online) {
      const completed = await this.orderService.completeByDevice(deviceId);
      for (const order of completed) {
        this.logger.log(
          `[订单联动] ${config.name} 打印完成，订单 ${order.order_no} 已自动流转 completed`,
        );
        this.deviceManager.recordEvent(
          deviceId,
          'info',
          'state_change',
          `${config.name} 打印完成，订单 ${order.order_no} 自动流转为已完成`,
        );
      }
      return;
    }

    // 打印失败/报错：仅告警（退款走人工驳回流程）
    if (to.state === 'error' && to.online) {
      const bound = await this.dbHasPrintingOrder(deviceId);
      if (bound) {
        this.deviceManager.recordEvent(
          deviceId,
          'error',
          'state_change',
          `${config.name} 上报错误（存在打印中订单，请人工检查，如需退款走订单驳回）`,
        );
        this.logger.warn(`[订单联动] ${config.name} 上报错误，存在打印中订单`);
      }
    }
  }

  private async dbHasPrintingOrder(deviceId: string): Promise<boolean> {
    // 复用 OrderService 数据访问（避免重复注入 DatabaseService）
    const orders = await this.orderService.listAll('printing');
    return orders.some((o: any) => o.printer_device_id === deviceId);
  }
}
