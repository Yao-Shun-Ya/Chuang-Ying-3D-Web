import { Module, forwardRef } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { PrintDispatchService } from './print-dispatch.service';
import { PrintCallbackController } from './print-callback.controller';
import { PrintQueueService, PRINT_QUEUE_NAME } from './print-queue.service';
import { PrintQueueProcessor } from './print-queue.processor';
import { ModelModule } from '../model/model.module';
import { OrderModule } from '../order/order.module';

@Module({
  imports: [
    ModelModule,
    forwardRef(() => OrderModule),
    BullModule.registerQueue({
      name: PRINT_QUEUE_NAME,
    }),
  ],
  providers: [PrintDispatchService, PrintQueueService, PrintQueueProcessor],
  controllers: [PrintCallbackController],
  exports: [PrintDispatchService, PrintQueueService],
})
export class PrintModule {}
