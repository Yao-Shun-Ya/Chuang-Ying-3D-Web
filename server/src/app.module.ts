import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import configuration from './config/configuration';
import { DatabaseModule } from './database/database.module';
import { AuthModule } from './modules/auth/auth.module';
import { UserModule } from './modules/user/user.module';
import { CdkModule } from './modules/cdk/cdk.module';
import { TransactionModule } from './modules/transaction/transaction.module';
import { ModelModule } from './modules/model/model.module';
import { OrderModule } from './modules/order/order.module';
import { PrintModule } from './modules/print/print.module';
import { ServeStaticModule } from '@nestjs/serve-static';
import { join } from 'path';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      load: [configuration],
    }),
    DatabaseModule,
    AuthModule,
    UserModule,
    CdkModule,
    TransactionModule,
    ModelModule,
    OrderModule,
    PrintModule,
  ],
})
export class AppModule {}
