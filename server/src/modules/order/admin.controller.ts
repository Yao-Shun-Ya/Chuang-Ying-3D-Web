import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  UseGuards,
  Query,
  Res,
} from '@nestjs/common';
import { OrderService } from './order.service';
import { PrintDispatchService } from '../print/print-dispatch.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { UserService } from '../user/user.service';
import { TransactionService } from '../transaction/transaction.service';
import { Response } from 'express';
import { IsString, IsNotEmpty } from 'class-validator';

class RejectDto {
  @IsString()
  @IsNotEmpty()
  reason: string;
}

/**
 * 管理员后台控制器：订单审核、用户管理、流水对账
 */
@Controller('admin')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('admin')
export class AdminController {
  constructor(
    private orderService: OrderService,
    private printDispatch: PrintDispatchService,
    private userService: UserService,
    private txService: TransactionService,
  ) {}

  /** 全部订单列表（可按状态筛选） */
  @Get('orders')
  listOrders(@Query('status') status?: string) {
    return this.orderService.listAll(status as any);
  }

  /** 审核通过 → approved + 下发打印任务 */
  @Post('orders/:id/approve')
  async approve(@Param('id') id: number, @CurrentUser('sub') adminId: number) {
    const order = this.orderService.updateStatus(id, 'approved', adminId, '审核通过');
    // 触发打印任务下发
    await this.printDispatch.dispatch(order);
    return order;
  }

  /** 审核驳回 → rejected + 退款 */
  @Post('orders/:id/reject')
  reject(
    @Param('id') id: number,
    @Body() dto: RejectDto,
    @CurrentUser('sub') adminId: number,
  ) {
    return this.orderService.reject(id, adminId, dto.reason);
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
  exportTransactions(@Res() res: Response) {
    const csv = this.txService.exportCsv();
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="transactions_${Date.now()}.csv"`);
    res.send(csv);
  }
}
