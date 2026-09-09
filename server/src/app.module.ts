import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { APP_GUARD } from '@nestjs/core';
import { ThrottlerModule, ThrottlerGuard } from '@nestjs/throttler';
import { CacheModule } from '@nestjs/cache-manager';
import configuration from './config/configuration';
import { DatabaseModule } from './database/database.module';
import { AuthModule } from './modules/auth/auth.module';
import { UserModule } from './modules/user/user.module';
import { CdkModule } from './modules/cdk/cdk.module';
import { TransactionModule } from './modules/transaction/transaction.module';
import { ModelModule } from './modules/model/model.module';
import { OrderModule } from './modules/order/order.module';
import { PrintModule } from './modules/print/print.module';
import { DeviceModule } from './modules/device/device.module';
import { LaserModule } from './modules/laser/laser.module';
import { CommonModule } from './common/common.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      // 显式加载 server/.env（ensure-pg.js 首启自动生成；生产环境用此文件或真实环境变量注入）
      envFilePath: ['.env'],
      load: [configuration],
    }),
    ThrottlerModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        throttlers: [
          {
            ttl: config.get<number>('throttle.ttl', 60) * 1000,
            limit: config.get<number>('throttle.limit', 10),
          },
        ],
      }),
    }),
    // 进程内缓存（管理端订单列表等短时缓存用）。
    // 本系统为单实例校园部署，内存缓存即可满足；避免引入 Redis 等外部中间件，
    // 保证「开封即用」（唯一外部依赖为 PostgreSQL，由 scripts/ensure-pg.js 自动管理）。
    CacheModule.register({
      isGlobal: true,
      ttl: 60 * 1000,
    }),
    DatabaseModule,
    CommonModule,
    AuthModule,
    UserModule,
    CdkModule,
    TransactionModule,
    ModelModule,
    OrderModule,
    PrintModule,
    DeviceModule,
    LaserModule,
  ],
  providers: [
    // 全局限流守卫：所有接口默认 10 次/分钟（按 IP）
    { provide: APP_GUARD, useClass: ThrottlerGuard },
  ],
})
export class AppModule {}
