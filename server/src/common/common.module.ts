import { Module } from '@nestjs/common';
import { HealthController } from './controllers/health.controller';
import { MetricsController } from './controllers/metrics.controller';
import { PublicConfigController } from './controllers/config.controller';
import { MetricsService } from './services/metrics.service';
import { AppLoggerService } from './logger/logger.service';
import { EmailService } from './services/email.service';

@Module({
  controllers: [HealthController, MetricsController, PublicConfigController],
  providers: [MetricsService, AppLoggerService, EmailService],
  exports: [MetricsService, AppLoggerService, EmailService],
})
export class CommonModule {}
