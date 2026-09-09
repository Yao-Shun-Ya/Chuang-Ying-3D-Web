import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtModule } from '@nestjs/jwt';
import { OrderService } from './order.service';
import { OrderController } from './order.controller';
import { OrderGateway } from './order.gateway';
import { OrderDeviceLinkService } from './order-device-link.service';
import { UserModule } from '../user/user.module';
import { ModelModule } from '../model/model.module';
import { TransactionModule } from '../transaction/transaction.module';
import { PrintModule } from '../print/print.module';
import { AdminController } from './admin.controller';
import { AdminModule } from '../admin/admin.module';
import { CommonModule } from '../../common/common.module';
import { DeviceModule } from '../device/device.module';

@Module({
  imports: [
    UserModule,
    ModelModule,
    TransactionModule,
    PrintModule,
    AdminModule,
    CommonModule,
    DeviceModule,
    // WebSocket 网关 JWT 鉴权
    JwtModule.registerAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        secret: config.get('jwt.secret'),
      }),
    }),
  ],
  controllers: [OrderController, AdminController],
  providers: [OrderService, OrderGateway, OrderDeviceLinkService],
  exports: [OrderService, OrderGateway],
})
export class OrderModule {}
