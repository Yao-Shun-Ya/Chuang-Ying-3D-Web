import { Module } from '@nestjs/common';
import { CdkService } from './cdk.service';
import { CdkController } from './cdk.controller';
import { TransactionModule } from '../transaction/transaction.module';
import { UserModule } from '../user/user.module';

@Module({
  imports: [TransactionModule, UserModule],
  controllers: [CdkController],
  providers: [CdkService],
  exports: [CdkService],
})
export class CdkModule {}
