import {
  Controller,
  Get,
  Post,
  Delete,
  Param,
  Body,
  UseGuards,
  UseInterceptors,
  UploadedFile,
  Query,
  Req,
  BadRequestException,
  NotFoundException,
  Logger,
} from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { FileInterceptor } from '@nestjs/platform-express';
import { Request } from 'express';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { DeviceManagerService } from './device-manager.service';
import { DeviceRegistryService } from './registry/device-registry.service';
import { DeviceCommand, DeviceState, FilePrintAdapter } from './device.interface';
import { AuditService } from '../admin/audit.service';
import {
  IsIn,
  IsOptional,
  IsString,
  IsNumberString,
  Allow,
  Matches,
  MinLength,
} from 'class-validator';

class AddDeviceDto {
  @IsOptional()
  @IsString()
  @Matches(/^[A-Za-z0-9_-]+$/, { message: '设备ID仅可含字母数字下划线中划线' })
  id?: string;

  @IsString()
  @IsIn(['bambu', 'xtool', 'creality', 'eufymake'])
  type: string;

  @IsString()
  @IsIn(['fdm', 'laser', 'uv'])
  category: string;

  @IsOptional()
  @IsString()
  model?: string;

  @IsString()
  @MinLength(1)
  host: string;

  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsString()
  accessCode?: string;

  @IsOptional()
  @IsString()
  serial?: string;

  @IsOptional()
  @IsNumberString()
  mqttPort?: string;

  @IsOptional()
  @IsNumberString()
  wsPort?: string;

  @IsOptional()
  @IsNumberString()
  restPort?: string;

  @IsOptional()
  @IsNumberString()
  probePort?: string;

  @IsOptional()
  @IsNumberString()
  pricePerMinute?: string;

  @IsOptional()
  @IsString()
  description?: string;
}

class CommandDto {
  @IsIn(['pause', 'resume', 'stop', 'led_on', 'led_off', 'pushall'])
  command: DeviceCommand;
}

class ToggleDto {
  @Allow()
  _: unknown;
}

class ManualStateDto {
  @IsIn(['idle', 'working', 'paused', 'error', null])
  @IsOptional()
  state: DeviceState | null;
}

/**
 * 设备接入控制器
 * - 学生端：公开摘要（脱敏，不含 host/凭据/序列号）
 * - 管理端：全量遥测 / 连接测试 / 远程命令 / 启停 / 手动状态 / 事件 / 热重载 / gcode.3mf 远程下发
 */
@Controller()
export class DeviceController {
  private readonly logger = new Logger(DeviceController.name);

  constructor(
    private manager: DeviceManagerService,
    private registry: DeviceRegistryService,
    private auditService: AuditService,
  ) {}

  // ============ 学生/登录用户 ============

  /** 设备公开摘要（激光可用性 / 打印机进度） */
  @Get('devices/public')
  @UseGuards(JwtAuthGuard)
  publicDevices() {
    return this.manager.getPublicDevices();
  }

  // ============ 管理端 ============

  @Get('admin/devices')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin')
  @Throttle({ default: { limit: 60, ttl: 60000 } })
  listDevices() {
    return this.manager.getAdminDevices();
  }

  /** 设备驱动注册表目录（选品牌 → 选型号 → 自动带出参数模板 + 支持指令） */
  @Get('admin/device-registry')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin')
  @Throttle({ default: { limit: 60, ttl: 60000 } })
  deviceRegistry() {
    return this.registry.getBrands();
  }

  /** 可视化新增设备（写 DB + 构建运行实例 + 尝试连接） */
  @Post('admin/devices')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin')
  @Throttle({ default: { limit: 30, ttl: 60000 } })
  async addDevice(
    @Body() dto: AddDeviceDto,
    @CurrentUser('sub') adminId: number,
    @CurrentUser('username') adminName: string,
    @Req() req: Request,
  ) {
    const toNum = (v?: string) => (v ? Number(v) : undefined);
    const result = await this.manager.addDevice({
      id: dto.id,
      name: dto.name,
      type: dto.type as any,
      category: dto.category as any,
      model: dto.model,
      host: dto.host,
      accessCode: dto.accessCode,
      serial: dto.serial,
      mqttPort: toNum(dto.mqttPort),
      wsPort: toNum(dto.wsPort),
      restPort: toNum(dto.restPort),
      probePort: toNum(dto.probePort),
      pricePerMinute: toNum(dto.pricePerMinute),
      description: dto.description,
    });
    this.auditService.log({
      adminId,
      adminName,
      action: 'device_add',
      targetType: 'device',
      requestParams: { deviceId: dto.id, type: dto.type, host: dto.host },
      ip: req.ip,
      userAgent: req.headers['user-agent'],
    });
    return result;
  }

  /** 删除设备（关闭服务 + 删除 DB 行 + 移除运行实例） */
  @Delete('admin/devices/:id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin')
  @Throttle({ default: { limit: 30, ttl: 60000 } })
  async removeDevice(
    @Param('id') id: string,
    @CurrentUser('sub') adminId: number,
    @CurrentUser('username') adminName: string,
    @Req() req: Request,
  ) {
    const result = await this.manager.removeDevice(id);
    this.auditService.log({
      adminId,
      adminName,
      action: 'device_remove',
      targetType: 'device',
      requestParams: { deviceId: id },
      ip: req.ip,
      userAgent: req.headers['user-agent'],
    });
    return result;
  }

  /** 全量连接测试（含每台成功/失败与错误信息） */
  @Post('admin/devices/test')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin')
  @Throttle({ default: { limit: 6, ttl: 60000 } })
  async testAll(@CurrentUser('sub') adminId: number, @Req() req: Request) {
    const result = await this.manager.testAll();
    this.auditService.log({
      adminId,
      adminName: (req.user as any)?.username ?? '',
      action: 'device_test_all',
      ip: req.ip,
      userAgent: req.headers['user-agent'],
    });
    return result;
  }

  /** 单台连接测试 */
  @Post('admin/devices/:id/test')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin')
  @Throttle({ default: { limit: 30, ttl: 60000 } })
  testDevice(@Param('id') id: string) {
    return this.manager.testDevice(id);
  }

  @Post('admin/devices/:id/command')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin')
  @Throttle({ default: { limit: 60, ttl: 60000 } })
  async command(
    @Param('id') id: string,
    @Body() dto: CommandDto,
    @CurrentUser('sub') adminId: number,
    @CurrentUser('username') adminName: string,
    @Req() req: Request,
  ) {
    await this.manager.sendCommand(id, dto.command);
    this.auditService.log({
      adminId,
      adminName,
      action: 'device_command',
      targetType: 'device',
      requestParams: { deviceId: id, command: dto.command },
      ip: req.ip,
      userAgent: req.headers['user-agent'],
    });
    return { success: true };
  }

  /** 启用/停用（维护锁） */
  @Post('admin/devices/:id/toggle')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin')
  @Throttle({ default: { limit: 60, ttl: 60000 } })
  async toggle(
    @Param('id') id: string,
    @Body() _dto: ToggleDto,
    @CurrentUser('sub') adminId: number,
    @CurrentUser('username') adminName: string,
    @Req() req: Request,
  ) {
    const enabled = !(await this.manager.isDeviceEnabled(id));
    await this.manager.setEnabled(id, enabled);
    this.auditService.log({
      adminId,
      adminName,
      action: 'device_toggle',
      targetType: 'device',
      requestParams: { deviceId: id, enabled },
      ip: req.ip,
      userAgent: req.headers['user-agent'],
    });
    return { id, enabled };
  }

  /** 手动状态覆盖（E1 等无遥测设备） */
  @Post('admin/devices/:id/manual-state')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin')
  @Throttle({ default: { limit: 60, ttl: 60000 } })
  async manualState(
    @Param('id') id: string,
    @Body() dto: ManualStateDto,
    @CurrentUser('sub') adminId: number,
    @CurrentUser('username') adminName: string,
    @Req() req: Request,
  ) {
    if ((await this.manager.getDeviceConfig(id))?.type !== 'eufymake') {
      throw new BadRequestException('该设备不支持手动状态（有实时遥测）');
    }
    this.manager.setManualState(id, dto.state ?? null);
    this.auditService.log({
      adminId,
      adminName,
      action: 'device_manual_state',
      targetType: 'device',
      requestParams: { deviceId: id, state: dto.state },
      ip: req.ip,
      userAgent: req.headers['user-agent'],
    });
    return { success: true };
  }

  /** 设备事件日志 */
  @Get('admin/devices/:id/events')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin')
  @Throttle({ default: { limit: 60, ttl: 60000 } })
  deviceEvents(@Param('id') id: string, @Query('limit') limit?: string) {
    return this.manager.listEvents(id, limit ? Math.min(parseInt(limit, 10) || 50, 200) : 50);
  }

  /** 热重载设备配置 */
  @Post('admin/devices/reload')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin')
  @Throttle({ default: { limit: 6, ttl: 60000 } })
  async reloadConfig(@CurrentUser('sub') adminId: number, @Req() req: Request) {
    const result = await this.manager.reloadConfig();
    this.auditService.log({
      adminId,
      adminName: (req.user as any)?.username ?? '',
      action: 'device_reload_config',
      ip: req.ip,
      userAgent: req.headers['user-agent'],
    });
    return result;
  }

  /** 上传 gcode.3mf 并远程启动打印（仅 bambu） */
  @Post('admin/devices/:id/print-file')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin')
  @Throttle({ default: { limit: 10, ttl: 60000 } })
  @UseInterceptors(FileInterceptor('file'))
  async uploadPrintFile(
    @Param('id') id: string,
    @UploadedFile() file: Express.Multer.File,
    @CurrentUser('sub') adminId: number,
    @CurrentUser('username') adminName: string,
    @Req() req: Request,
  ) {
    if (!file) throw new BadRequestException('未收到文件');
    const m = this.manager.getDevice(id);
    if (!m) throw new NotFoundException('设备不存在');
    const adapter = m.adapter as FilePrintAdapter;
    if (typeof adapter.uploadAndPrint !== 'function') {
      throw new BadRequestException('该设备不支持远程下发打印文件');
    }
    const filename = `remote_${Date.now()}.gcode.3mf`;
    await adapter.uploadAndPrint(file.buffer, filename);
    this.auditService.log({
      adminId,
      adminName,
      action: 'device_print_file',
      targetType: 'device',
      requestParams: { deviceId: id, filename, size: file.size },
      ip: req.ip,
      userAgent: req.headers['user-agent'],
    });
    return { success: true, filename };
  }
}
