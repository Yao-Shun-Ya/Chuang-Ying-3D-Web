import { Injectable } from '@nestjs/common';
import { register, Counter, Gauge, collectDefaultMetrics } from 'prom-client';

/**
 * Prometheus 指标服务
 * 暴露业务指标：每日订单量、CDK 兑换数、模型上传成功率等
 */
@Injectable()
export class MetricsService {
  private readonly orderCreatedCounter: Counter<string>;
  private readonly orderCompletedCounter: Counter<string>;
  private readonly cdkRedeemedCounter: Counter<string>;
  private readonly modelUploadedCounter: Counter<string>;
  private readonly modelParseFailedCounter: Counter<string>;
  private readonly activeOrdersGauge: Gauge<string>;
  private readonly totalUsersGauge: Gauge<string>;

  constructor() {
    collectDefaultMetrics();

    this.orderCreatedCounter = new Counter({
      name: 'orders_created_total',
      help: '总创建订单数',
      labelNames: ['status'],
    });

    this.orderCompletedCounter = new Counter({
      name: 'orders_completed_total',
      help: '总完成订单数',
    });

    this.cdkRedeemedCounter = new Counter({
      name: 'cdk_redeemed_total',
      help: 'CDK 兑换总数',
    });

    this.modelUploadedCounter = new Counter({
      name: 'models_uploaded_total',
      help: '模型上传总数',
    });

    this.modelParseFailedCounter = new Counter({
      name: 'models_parse_failed_total',
      help: '模型解析失败总数',
    });

    this.activeOrdersGauge = new Gauge({
      name: 'orders_active',
      help: '当前活跃订单数（待审核+打印中）',
    });

    this.totalUsersGauge = new Gauge({
      name: 'users_total',
      help: '注册用户总数',
    });
  }

  incOrderCreated(status: string) {
    this.orderCreatedCounter.inc({ status });
  }

  incOrderCompleted() {
    this.orderCompletedCounter.inc();
  }

  incCdkRedeemed() {
    this.cdkRedeemedCounter.inc();
  }

  incModelUploaded() {
    this.modelUploadedCounter.inc();
  }

  incModelParseFailed() {
    this.modelParseFailedCounter.inc();
  }

  setActiveOrders(count: number) {
    this.activeOrdersGauge.set(count);
  }

  setTotalUsers(count: number) {
    this.totalUsersGauge.set(count);
  }

  async getMetrics(): Promise<string> {
    return register.metrics();
  }
}
