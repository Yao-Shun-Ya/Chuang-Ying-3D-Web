import { Controller, Get, Post, Param, Body, Query, UseGuards, Req } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { Request } from 'express';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { AuditService } from '../admin/audit.service';
import { LaserService } from './laser.service';
import { IsNotEmpty, IsString } from 'class-validator';

class RejectDto {
  @IsString()
  @IsNotEmpty()
  reason: string;
}

/** 管理端激光工坊接口 */
@Controller('admin/laser')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('admin')
@Throttle({ default: { limit: 60, ttl: 60000 } })
export class LaserAdminController {
  constructor(
    private laserService: LaserService,
    private auditService: AuditService,
  ) {}

  @Get('sessions')
  list(@Query('status') status?: string) {
    return this.laserService.listAll(status);
  }

  @Get('stats')
  stats() {
    return this.laserService.stats();
  }

  @Post('sessions/:id/approve')
  async approve(
    @Param('id') id: number,
    @CurrentUser('sub') adminId: number,
    @CurrentUser('username') adminName: string,
    @Req() req: Request,
  ) {
    const result = await this.laserService.approve(id, adminId);
    this.auditService.log({
      adminId,
      adminName,
      action: 'laser_approve',
      targetType: 'laser_session',
      targetId: id,
      ip: req.ip,
      userAgent: req.headers['user-agent'],
    });
    return result;
  }

  @Post('sessions/:id/reject')
  async reject(
    @Param('id') id: number,
    @Body() dto: RejectDto,
    @CurrentUser('sub') adminId: number,
    @CurrentUser('username') adminName: string,
    @Req() req: Request,
  ) {
    const result = await this.laserService.reject(id, adminId, dto.reason);
    this.auditService.log({
      adminId,
      adminName,
      action: 'laser_reject',
      targetType: 'laser_session',
      targetId: id,
      requestParams: { reason: dto.reason },
      ip: req.ip,
      userAgent: req.headers['user-agent'],
    });
    return result;
  }

  @Post('sessions/:id/end')
  async forceEnd(
    @Param('id') id: number,
    @CurrentUser('sub') adminId: number,
    @CurrentUser('username') adminName: string,
    @Req() req: Request,
  ) {
    const result = await this.laserService.end(id, 'admin');
    this.auditService.log({
      adminId,
      adminName,
      action: 'laser_force_end',
      targetType: 'laser_session',
      targetId: id,
      ip: req.ip,
      userAgent: req.headers['user-agent'],
    });
    return result;
  }
}
