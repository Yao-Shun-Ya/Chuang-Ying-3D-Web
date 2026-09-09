import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  UseGuards,
  UseInterceptors,
  Query,
  Res,
  Req,
  Inject,
} from '@nestjs/common';
import { CacheInterceptor, CacheKey, CacheTTL, CACHE_MANAGER } from '@nestjs/cache-manager';
import { Cache } from 'cache-manager';
import { Throttle } from '@nestjs/throttler';
import { OrderService } from './order.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { UserService } from '../user/user.service';
import { TransactionService } from '../transaction/transaction.service';
import { AuditService } from '../admin/audit.service';
import { Response, Request } from 'express';
import { IsString, IsNotEmpty, IsOptional } from 'class-validator';

class RejectDto {
  @IsString()
  @IsNotEmpty()
  reason: string;
}

class ApproveDto {
  /** 可选：审核通过时直接绑定打印机（开始打印后设备上报完成自动流转） */
  @IsOptional()
  @IsString()
  printerDeviceId?: string;
}

/**
 * 管理员后台控制器：订单审核、用户管理、流水对账
 */
@Controller('admin')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('admin')
@UseInterceptors(CacheInterceptor)
@Throttle({ default: { limit: 60, ttl: 60000 } })
export class AdminController {
  constructor(
    private orderService: OrderService,
    private userService: UserService,
    private txService: TransactionService,
    private auditService: AuditService,
    @Inject(CACHE_MANAGER) private cacheManager: Cache,
  ) {}

  /** 清除订单列表缓存 */
  private clearOrdersCache() {
    this.cacheManager.del('admin_orders').catch(() => {});
  }

  /** 全部订单列表（可按状态筛选）- 缓存 60 秒 */
  @Get('orders')
  @CacheKey('admin_orders')
  @CacheTTL(60)
  listOrders(@Query('status') status?: string) {
    return this.orderService.listAll(status as any);
  }

  /** 审核通过 → approved + 自动下发打印任务 → printing（可同时绑定打印机） */
  @Post('orders/:id/approve')
  async approve(
    @Param('id') id: number,
    @Body() dto: ApproveDto,
    @CurrentUser('sub') adminId: number,
    @CurrentUser('username') adminName: string,
    @Req() req: Request,
  ) {
    const order = await this.orderService.updateStatus(
      id,
      'approved',
      adminId,
      '审核通过',
      dto.printerDeviceId,
    );
    this.clearOrdersCache();
    this.auditService.log({
      adminId,
      adminName,
      action: 'order_approve',
      targetType: 'order',
      targetId: id,
      ip: req.ip,
      userAgent: req.headers['user-agent'],
    });
    return order;
  }

  /** 审核驳回 → rejected + 退款 */
  @Post('orders/:id/reject')
  async reject(
    @Param('id') id: number,
    @Body() dto: RejectDto,
    @CurrentUser('sub') adminId: number,
    @CurrentUser('username') adminName: string,
    @Req() req: Request,
  ) {
    const order = await this.orderService.reject(id, adminId, dto.reason);
    this.clearOrdersCache();
    this.auditService.log({
      adminId,
      adminName,
      action: 'order_reject',
      targetType: 'order',
      targetId: id,
      requestParams: { reason: dto.reason },
      ip: req.ip,
      userAgent: req.headers['user-agent'],
    });
    return order;
  }

  /** 用户列表 */
  @Get('users')
  listUsers() {
    return this.userService.listAll();
  }

  /** 全部流水 */
  @Get('transactions')
  listTransactions() {
    return this.txService.listAll();
  }

  /** 导出流水 CSV */
  @Get('transactions/export')
  async exportTransactions(
    @Res() res: Response,
    @CurrentUser('sub') adminId: number,
    @CurrentUser('username') adminName: string,
    @Req() req: Request,
  ) {
    const csv = await this.txService.exportCsv();
    this.auditService.log({
      adminId,
      adminName,
      action: 'export_transactions',
      ip: req.ip,
      userAgent: req.headers['user-agent'],
    });
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="transactions_${Date.now()}.csv"`);
    res.send(csv);
  }

  /** 审计日志列表 */
  @Get('audit-logs')
  listAuditLogs(@Query('page') page: string, @Query('pageSize') pageSize: string) {
    return this.auditService.findAll(
      page ? parseInt(page, 10) : 1,
      pageSize ? parseInt(pageSize, 10) : 20,
    );
  }
}
