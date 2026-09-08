import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { APP_GUARD } from '@nestjs/core';
import { ThrottlerModule, ThrottlerGuard } from '@nestjs/throttler';
import { BullModule } from '@nestjs/bullmq';
import { CacheModule } from '@nestjs/cache-manager';
import { redisStore } from 'cache-manager-redis-yet';
import configuration from './config/configuration';
import { DatabaseModule } from './database/database.module';
import { AuthModule } from './modules/auth/auth.module';
import { UserModule } from './modules/user/user.module';
import { CdkModule } from './modules/cdk/cdk.module';
import { TransactionModule } from './modules/transaction/transaction.module';
import { ModelModule } from './modules/model/model.module';
import { OrderModule } from './modules/order/order.module';
import { PrintModule } from './modules/print/print.module';
import { CommonModule } from './common/common.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
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
    BullModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        connection: {
          host: config.get<string>('redis.host', 'localhost'),
          port: config.get<number>('redis.port', 6379),
          password: config.get<string>('redis.password') || undefined,
        },
      }),
    }),
    CacheModule.registerAsync({
      isGlobal: true,
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: async (config: ConfigService) => {
        const redisHost = config.get<string>('redis.host', 'localhost');
        const redisPort = config.get<number>('redis.port', 6379);
        const redisPassword = config.get<string>('redis.password') || undefined;

        try {
          // 尝试连接 Redis，失败则回退到内存缓存
          const store = await redisStore({
            socket: { host: redisHost, port: redisPort, connectTimeout: 2000 },
            password: redisPassword,
          });
          return { store, ttl: 60 * 1000 };
        } catch {
          // 回退到内存缓存（开发环境 / Redis 不可用时）
          return { ttl: 60 * 1000 };
        }
      },
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
  ],
  providers: [
    // 全局限流守卫：所有接口默认 10 次/分钟（按 IP）
    { provide: APP_GUARD, useClass: ThrottlerGuard },
  ],
})
export class AppModule {}
