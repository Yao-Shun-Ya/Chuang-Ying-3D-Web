import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { JwtModule } from '@nestjs/jwt';
import { DeviceConfigService } from './device-config.service';
import { DeviceManagerService } from './device-manager.service';
import { DeviceRegistryService } from './registry/device-registry.service';
import { DeviceGateway } from './device.gateway';
import { DeviceController } from './device.controller';
import { AdminModule } from '../admin/admin.module';

/**
 * 设备接入模块
 * - 适配器为普通类（由 DeviceManager 按配置实例化），本模块只注册编排/网关/接口
 * - 对外导出 DeviceManagerService 与 DeviceConfigService 供激光业务与订单联动使用
 */
@Module({
  imports: [
    AdminModule,
    ConfigModule,
    JwtModule.registerAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        secret: config.get('jwt.secret'),
      }),
    }),
  ],
  controllers: [DeviceController],
  providers: [DeviceConfigService, DeviceManagerService, DeviceRegistryService, DeviceGateway],
  exports: [DeviceManagerService, DeviceConfigService, DeviceRegistryService],
})
export class DeviceModule {}
