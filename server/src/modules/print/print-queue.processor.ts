import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { Job } from 'bullmq';
import { PrintDispatchService } from './print-dispatch.service';
import { OrderService } from '../order/order.service';
import { PRINT_QUEUE_NAME } from './print-queue.service';

interface DispatchJobData {
  orderId: number;
  orderNo: string;
}

/**
 * 打印任务队列消费者
 * - 消费 print-dispatch 队列
 * - 失败自动重试 3 次（指数退避 5s/10s/20s）
 */
@Processor(PRINT_QUEUE_NAME)
export class PrintQueueProcessor extends WorkerHost {
  private readonly logger = new Logger(PrintQueueProcessor.name);

  constructor(
    private readonly printDispatch: PrintDispatchService,
    private readonly orderService: OrderService,
  ) {
    super();
  }

  async process(job: Job<DispatchJobData>): Promise<void> {
    const { orderId, orderNo } = job.data;
    this.logger.log(
      `[队列] 开始处理打印任务: order=${orderNo} attempt=${job.attemptsMade + 1}/3`,
    );

    try {
      // 查询最新订单数据
      const order = this.orderService.findById(orderId);
      if (!order) {
        this.logger.warn(`[队列] 订单不存在，跳过: orderId=${orderId}`);
        return;
      }

      // 执行实际下发
      await this.printDispatch.dispatch(order);
      this.logger.log(`[队列] 打印任务下发成功: order=${orderNo}`);
    } catch (err) {
      this.logger.error(
        `[队列] 打印任务下发失败: order=${orderNo} err=${(err as Error).message}`,
      );
      throw err; // 抛出以触发 BullMQ 重试
    }
  }
}
