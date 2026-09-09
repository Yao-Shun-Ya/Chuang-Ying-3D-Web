import {
  Controller,
  Post,
  Get,
  Body,
  UseGuards,
  Param,
  BadRequestException,
  Inject,
} from '@nestjs/common';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { Cache } from 'cache-manager';
import { OrderService, OrderStatus } from './order.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { IsNumber, IsString, IsOptional, IsIn } from 'class-validator';
import { Throttle } from '@nestjs/throttler';

class CreateOrderDto {
  @IsNumber()
  modelId: number;
  @IsOptional()
  @IsString()
  remark?: string;
  @IsOptional()
  @IsNumber()
  scale?: number;
  /** 指定执行任务的打印设备（fdm 类） */
  @IsOptional()
  @IsString()
  deviceId?: string;
  /** 填充率 0~1（计价联动） */
  @IsOptional()
  @IsNumber()
  infillRate?: number;
  /** 支撑数量 0~100 */
  @IsOptional()
  @IsNumber()
  supports?: number;
  /** 耗材颜色 */
  @IsOptional()
  @IsString()
  color?: string;
}

class UpdateStatusDto {
  @IsString()
  @IsIn(['approved', 'printing', 'completed', 'picked_up'])
  status: OrderStatus;
  @IsOptional()
  @IsString()
  remark?: string;
  /** 绑定打印机（开始打印时选择，供设备上报完成自动流转） */
  @IsOptional()
  @IsString()
  printerDeviceId?: string;
}

@Controller('orders')
@UseGuards(JwtAuthGuard)
export class OrderController {
  constructor(
    private orderService: OrderService,
    @Inject(CACHE_MANAGER) private cacheManager: Cache,
  ) {}

  /** 学生创建订单 */
  @Post()
  create(@Body() dto: CreateOrderDto, @CurrentUser('sub') userId: number) {
    const order = this.orderService.createOrder(userId, dto.modelId, dto.remark, dto.scale, {
      deviceId: dto.deviceId,
      infillRate: dto.infillRate,
      supports: dto.supports,
      color: dto.color,
    });
    this.cacheManager.del('admin_orders').catch(() => {});
    return order;
  }

  /** 当前用户的订单列表 */
  @Get('mine')
  mine(@CurrentUser('sub') userId: number) {
    return this.orderService.listByUser(userId);
  }

  /** 订单详情 */
  @Get(':id')
  async detail(@Param('id') id: number, @CurrentUser() user: any) {
    const order = await this.orderService.findById(id);
    if (!order) throw new BadRequestException('订单不存在');
    // 仅本人或管理员可查看
    if (order.user_id !== user.sub && user.role !== 'admin') {
      throw new BadRequestException('无权限查看');
    }
    return order;
  }

  /** 订单状态日志 */
  @Get(':id/logs')
  async logs(@Param('id') id: number, @CurrentUser() user: any) {
    const order = await this.orderService.findById(id);
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
  @Throttle({ default: { limit: 60, ttl: 60000 } })
  updateStatus(
    @Param('id') id: number,
    @Body() dto: UpdateStatusDto,
    @CurrentUser('sub') adminId: number,
  ) {
    const order = this.orderService.updateStatus(
      id,
      dto.status,
      adminId,
      dto.remark,
      dto.printerDeviceId,
    );
    this.cacheManager.del('admin_orders').catch(() => {});
    return order;
  }
}
