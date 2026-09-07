import {
  Controller,
  Post,
  Body,
  Headers,
  UnauthorizedException,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { OrderService } from '../order/order.service';
import { IsString, IsOptional, IsIn } from 'class-validator';

/**
 * 打印机回调 DTO
 * 线下主机/打印机完成打印后调用此接口上报
 */
class PrintCallbackDto {
  @IsString()
  orderNo: string;

  @IsOptional()
  @IsIn(['success', 'failed'])
  result?: 'success' | 'failed';

  @IsOptional()
  @IsString()
  message?: string;

  @IsOptional()
  @IsString()
  printerName?: string;

  @IsOptional()
  @IsString()
  duration?: string;
}

/**
 * 打印回调控制器
 * 供线下打印机/接收主机在打印完成后调用，自动更新订单状态
 * 无需 JWT，通过共享密钥 PRINT_CALLBACK_SECRET 鉴权
 */
@Controller('print')
export class PrintCallbackController {
  private readonly logger = new Logger(PrintCallbackController.name);

  constructor(
    private orderService: OrderService,
    private configService: ConfigService,
  ) {}

  /**
   * 打印完成回调
   * POST /api/print/callback
   * Header: x-callback-secret: <共享密钥>
   * Body: { orderNo, result: 'success'|'failed', message?, printerName?, duration? }
   */
  @Post('callback')
  callback(
    @Body() dto: PrintCallbackDto,
    @Headers('x-callback-secret') secret: string,
  ) {
    const expectedSecret = this.configService.get<string>('printCallbackSecret');
    // 若未配置密钥，开发环境下允许跳过（生产环境必须配置）
    if (expectedSecret && secret !== expectedSecret) {
      throw new UnauthorizedException('回调密钥无效');
    }

    const order = this.orderService.findByOrderNo(dto.orderNo);
    if (!order) {
      throw new BadRequestException(`订单不存在: ${dto.orderNo}`);
    }

    if (order.status !== 'printing') {
      throw new BadRequestException(
        `订单状态非打印中，当前状态: ${order.status}`,
      );
    }

    // 打印成功 → 已完成；打印失败 → 驳回并退款
    if (dto.result === 'failed') {
      this.logger.warn(
        `订单 ${dto.orderNo} 打印失败: ${dto.message || '未知原因'}，将驳回并退款`,
      );
      const reason = `打印失败${dto.message ? `：${dto.message}` : ''}`;
      const updated = this.orderService.reject(order.id, 0, reason);
      this.logger.log(`订单 ${dto.orderNo} 已驳回退款`);
      return { success: true, status: updated.status, message: reason };
    }

    const remark = [
      dto.printerName ? `打印机: ${dto.printerName}` : null,
      dto.duration ? `耗时: ${dto.duration}` : null,
      dto.message || null,
    ]
      .filter(Boolean)
      .join(' | ') || '打印完成';

    const updated = this.orderService.updateStatus(
      order.id,
      'completed',
      0, // 系统操作
      remark,
    );

    this.logger.log(`订单 ${dto.orderNo} 打印完成，状态已更新为 completed`);
    return { success: true, status: updated.status, orderNo: dto.orderNo };
  }

  /**
   * 打印状态查询（可选）
   * 线下主机可查询某订单当前打印状态
   */
  @Post('status')
  status(@Body('orderNo') orderNo: string) {
    const order = this.orderService.findByOrderNo(orderNo);
    if (!order) throw new BadRequestException('订单不存在');
    return { orderNo, status: order.status };
  }
}
