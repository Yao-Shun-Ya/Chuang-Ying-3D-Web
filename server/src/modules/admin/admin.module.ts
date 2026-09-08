import { Module } from '@nestjs/common';
import { AuditService } from './audit.service';
import { CommonModule } from '../../common/common.module';

@Module({
  imports: [CommonModule],
  providers: [AuditService],
  exports: [AuditService],
})
export class AdminModule {}
