import { Module } from '@nestjs/common';
import { LaserService } from './laser.service';
import { LaserController } from './laser.controller';
import { LaserAdminController } from './laser-admin.controller';
import { DeviceModule } from '../device/device.module';
import { UserModule } from '../user/user.module';
import { TransactionModule } from '../transaction/transaction.module';
import { AdminModule } from '../admin/admin.module';
import { CommonModule } from '../../common/common.module';

/**
 * 激光/UV 自助业务模块
 * 依赖 DeviceModule（设备状态联动/费率），复用 User/Transaction/Email 基础设施
 */
@Module({
  imports: [DeviceModule, UserModule, TransactionModule, AdminModule, CommonModule],
  controllers: [LaserController, LaserAdminController],
  providers: [LaserService],
  exports: [LaserService],
})
export class LaserModule {}
