import { Module, forwardRef } from '@nestjs/common';
import { PrintDispatchService } from './print-dispatch.service';
import { PrintCallbackController } from './print-callback.controller';
import { ModelModule } from '../model/model.module';
import { OrderModule } from '../order/order.module';

@Module({
  imports: [ModelModule, forwardRef(() => OrderModule)],
  providers: [PrintDispatchService],
  controllers: [PrintCallbackController],
  exports: [PrintDispatchService],
})
export class PrintModule {}
