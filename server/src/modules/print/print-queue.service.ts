import { Injectable, Logger } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { Order } from '../order/order.service';
import { PrintDispatchService } from './print-dispatch.service';

export const PRINT_QUEUE_NAME = 'print-dispatch';

/**
 * 打印下发队列生产者
 * - 审核通过后将打印任务入队
 * - 由 PrintQueueProcessor 消费，支持失败重试（3次）+ 延迟
 */
@Injectable()
export class PrintQueueService {
  private readonly logger = new Logger(PrintQueueService.name);

  constructor(
    @InjectQueue(PRINT_QUEUE_NAME) private readonly queue: Queue,
    private readonly printDispatch: PrintDispatchService,
  ) {}

  /**
   * 将打印任务加入 BullMQ 队列
   * @param order 订单
   * @param delayMs 延迟执行（毫秒），默认 0
   */
  async enqueue(order: Order, delayMs = 0): Promise<void> {
    await this.queue.add(
      'dispatch',
      { orderId: order.id, orderNo: order.order_no },
      {
        delay: delayMs,
        attempts: 3,
        backoff: {
          type: 'exponential',
          delay: 5000, // 5s, 10s, 20s
        },
        removeOnComplete: 100,
        removeOnFail: 500,
      },
    );
    this.logger.log(
      `打印任务已入队: order=${order.order_no} delay=${delayMs}ms attempts=3`,
    );
  }

  /** 直接执行（同步调用，用于不经过队列的场景） */
  async dispatchDirect(order: Order) {
    return this.printDispatch.dispatch(order);
  }
}
