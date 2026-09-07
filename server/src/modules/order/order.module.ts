import { Module } from '@nestjs/common';
import { OrderService } from './order.service';
import { OrderController } from './order.controller';
import { OrderGateway } from './order.gateway';
import { UserModule } from '../user/user.module';
import { ModelModule } from '../model/model.module';
import { TransactionModule } from '../transaction/transaction.module';
import { PrintModule } from '../print/print.module';
import { AdminController } from './admin.controller';

@Module({
  imports: [UserModule, ModelModule, TransactionModule, PrintModule],
  controllers: [OrderController, AdminController],
  providers: [OrderService, OrderGateway],
  exports: [OrderService, OrderGateway],
})
export class OrderModule {}
