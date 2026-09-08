import { Module } from '@nestjs/common';
import { ModelService } from './model.service';
import { ModelController } from './model.controller';
import { ModelGateway } from './model.gateway';
import { ThumbnailService } from './thumbnail.service';

@Module({
  controllers: [ModelController],
  providers: [ModelService, ModelGateway, ThumbnailService],
  exports: [ModelService],
})
export class ModelModule {}
