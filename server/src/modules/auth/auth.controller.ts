import {
  Controller,
  Post,
  Body,
  Get,
  UseGuards,
  Patch,
  UseInterceptors,
  UploadedFile,
  BadRequestException,
  NotFoundException,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { diskStorage } from 'multer';
import { extname, join } from 'path';
import { existsSync, mkdirSync } from 'fs';
import { AuthService } from './auth.service';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import { Throttle } from '@nestjs/throttler';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { UserService } from '../user/user.service';

@Controller('auth')
export class AuthController {
  constructor(
    private authService: AuthService,
    private userService: UserService,
  ) {}

  @Post('send-code')
  @Throttle({ default: { limit: 3, ttl: 60000 } }) // 验证码发送：3 次/分钟（叠加全局限流）
  sendCode(@Body() body: { email: string }) {
    return this.authService.sendCode(body.email);
  }

  @Post('register')
  @Throttle({ default: { limit: 5, ttl: 60000 } }) // 注册：5 次/分钟
  register(@Body() dto: RegisterDto) {
    return this.authService.register(dto);
  }

  @Post('login')
  @Throttle({ default: { limit: 10, ttl: 60000 } }) // 登录：10 次/分钟/IP，防暴力破解同时兼顾正常重试
  login(@Body() dto: LoginDto) {
    return this.authService.login(dto);
  }

  /** 当前登录用户信息 */
  @Get('me')
  @UseGuards(JwtAuthGuard)
  async me(@CurrentUser() user: { sub: number }) {
    const full = await this.userService.findById(user.sub);
    if (!full) throw new NotFoundException('用户不存在');
    return {
      id: full.id,
      username: full.username,
      email: full.email,
      role: full.role,
      realName: full.real_name,
      studentNo: full.student_no,
      displayName: full.display_name,
      avatar: full.avatar,
      balance: full.balance,
      createdAt: full.created_at,
    };
  }

  @Patch('me')
  @UseGuards(JwtAuthGuard)
  async updateProfile(
    @CurrentUser('sub') userId: number,
    @Body() body: { realName?: string; studentNo?: string; displayName?: string; avatar?: string },
  ) {
    const u = await this.userService.updateProfile(userId, body);
    if (!u) throw new NotFoundException('用户不存在');
    return {
      id: u.id,
      username: u.username,
      email: u.email,
      role: u.role,
      realName: u.real_name,
      studentNo: u.student_no,
      displayName: u.display_name,
      avatar: u.avatar,
      balance: u.balance,
    };
  }

  @Post('change-password')
  @UseGuards(JwtAuthGuard)
  changePassword(
    @CurrentUser('sub') userId: number,
    @Body() body: { code: string; newPassword: string },
  ) {
    return this.authService.changePassword(userId, body.code, body.newPassword);
  }

  /** 忘记密码重置（公开接口，无需登录） */
  @Post('reset-password')
  @Throttle({ default: { limit: 5, ttl: 60000 } }) // 重置密码：5 次/分钟
  resetPassword(@Body() body: { email: string; code: string; newPassword: string }) {
    return this.authService.resetPassword(body.email, body.code, body.newPassword);
  }

  /**
   * 管理员通过 Key 文件修改密码
   * 需要已登录管理员身份 + 有效 key 文件内容
   */
  @Post('admin/change-password')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin')
  changeAdminPasswordByKey(
    @CurrentUser('sub') userId: number,
    @Body() body: { keyContent: string; newPassword: string },
  ) {
    return this.authService.changeAdminPasswordByKey(userId, body.keyContent, body.newPassword);
  }

  /** 上传头像（接收裁切后的图片，存本地，返回可访问 URL） */
  @Post('avatar')
  @UseGuards(JwtAuthGuard)
  @UseInterceptors(
    FileInterceptor('file', {
      storage: diskStorage({
        destination: (req, file, cb) => {
          const dir = join(process.cwd(), 'data', 'avatars');
          if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
          cb(null, dir);
        },
        filename: (req, file, cb) => {
          const ext = extname(file.originalname) || '.png';
          cb(null, `avatar_${Date.now()}_${Math.round(Math.random() * 1e6)}${ext}`);
        },
      }),
      limits: { fileSize: 5 * 1024 * 1024 },
      fileFilter: (req, file, cb) => {
        if (!/^image\/(png|jpe?g|webp)$/.test(file.mimetype)) {
          cb(new BadRequestException('仅支持 PNG/JPG/WEBP 图片'), false);
        } else cb(null, true);
      },
    }),
  )
  uploadAvatar(@CurrentUser('sub') userId: number, @UploadedFile() file: Express.Multer.File) {
    if (!file) throw new BadRequestException('请上传图片');
    const url = `/uploads/avatars/${file.filename}`;
    this.userService.updateProfile(userId, { avatar: url });
    return { url };
  }
}
