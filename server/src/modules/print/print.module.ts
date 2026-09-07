import { Module } from '@nestjs/common';
import { PrintDispatchService } from './print-dispatch.service';
import { ModelModule } from '../model/model.module';

@Module({
  imports: [ModelModule],
  providers: [PrintDispatchService],
  exports: [PrintDispatchService],
})
export class PrintModule {}
