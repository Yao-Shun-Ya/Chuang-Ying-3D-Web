import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  UseGuards,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { LaserService } from './laser.service';
import { IsInt, IsOptional, IsString, MaxLength, Min, MinLength } from 'class-validator';

class CreateSessionDto {
  @IsString()
  @MinLength(1)
  deviceId: string;

  @IsInt()
  @Min(30)
  plannedMinutes: number;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  purpose?: string;
}

class StartSessionDto {
  @IsOptional()
  @IsString()
  deviceId?: string;

  @IsOptional()
  @IsString()
  @MinLength(4)
  code?: string;
}

/** 学生端激光自助接口 */
@Controller('laser')
@UseGuards(JwtAuthGuard)
export class LaserController {
  constructor(private laserService: LaserService) {}

  /** 可预约设备（激光/UV + 实时状态 + 费率） */
  @Get('devices')
  laserDevices() {
    return this.laserService.availableDevices();
  }

  @Post('sessions')
  create(@CurrentUser('sub') userId: number, @Body() dto: CreateSessionDto) {
    return this.laserService.createSession(userId, dto);
  }

  @Get('sessions/my')
  my(@CurrentUser('sub') userId: number) {
    return this.laserService.listMy(userId);
  }

  /** 到场核销开始（扫设备二维码 / 核销码） */
  @Post('sessions/start')
  start(@CurrentUser('sub') userId: number, @Body() dto: StartSessionDto) {
    return this.laserService.start(userId, dto.deviceId ?? null, dto.code ?? null);
  }

  @Post('sessions/:id/end')
  async end(@CurrentUser('sub') userId: number, @Param('id') id: number) {
    const s = await this.laserService.findById(id);
    if (!s) throw new NotFoundException('会话不存在');
    if (s.user_id !== userId) throw new BadRequestException('无权操作他人会话');
    return this.laserService.end(id, 'student');
  }

  @Post('sessions/:id/cancel')
  cancel(@CurrentUser('sub') userId: number, @Param('id') id: number) {
    return this.laserService.cancel(userId, id);
  }
}
