import {
  Controller,
  Post,
  Get,
  Body,
  UseGuards,
  Param,
  BadRequestException,
} from '@nestjs/common';
import { OrderService, OrderStatus } from './order.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { IsNumber, IsString, IsOptional, IsIn } from 'class-validator';

class CreateOrderDto {
  @IsNumber()
  modelId: number;
  @IsOptional()
  @IsString()
  remark?: string;
  @IsOptional()
  @IsNumber()
  scale?: number;
}

class UpdateStatusDto {
  @IsString()
  @IsIn(['approved', 'printing', 'completed', 'picked_up'])
  status: OrderStatus;
  @IsOptional()
  @IsString()
  remark?: string;
}

@Controller('orders')
@UseGuards(JwtAuthGuard)
export class OrderController {
  constructor(private orderService: OrderService) {}

  /** 学生创建订单 */
  @Post()
  create(@Body() dto: CreateOrderDto, @CurrentUser('sub') userId: number) {
    return this.orderService.createOrder(userId, dto.modelId, dto.remark, dto.scale);
  }

  /** 当前用户的订单列表 */
  @Get('mine')
  mine(@CurrentUser('sub') userId: number) {
    return this.orderService.listByUser(userId);
  }

  /** 订单详情 */
  @Get(':id')
  detail(@Param('id') id: number, @CurrentUser() user: any) {
    const order = this.orderService.findById(id);
    if (!order) throw new BadRequestException('订单不存在');
    // 仅本人或管理员可查看
    if (order.user_id !== user.sub && user.role !== 'admin') {
      throw new BadRequestException('无权限查看');
    }
    return order;
  }

  /** 订单状态日志 */
  @Get(':id/logs')
  logs(@Param('id') id: number, @CurrentUser() user: any) {
    const order = this.orderService.findById(id);
    if (!order) throw new BadRequestException('订单不存在');
    if (order.user_id !== user.sub && user.role !== 'admin') {
      throw new BadRequestException('无权限查看');
    }
    return this.orderService.getLogs(id);
  }

  /**
   * 管理员更新订单状态（审核通过 / 打印中 / 已完成 / 已取件）
   * 驳回走专用 /reject 接口
   */
  @Post(':id/status')
  @UseGuards(RolesGuard)
  @Roles('admin')
  updateStatus(
    @Param('id') id: number,
    @Body() dto: UpdateStatusDto,
    @CurrentUser('sub') adminId: number,
  ) {
    return this.orderService.updateStatus(id, dto.status, adminId, dto.remark);
  }
}
