import { Module, OnModuleInit } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { ConfigService } from '@nestjs/config';
import { AuthService } from './auth.service';
import { AuthController } from './auth.controller';
import { JwtStrategy } from './jwt.strategy';
import { UserModule } from '../user/user.module';
import { UserService } from '../user/user.service';
import * as bcrypt from 'bcryptjs';

@Module({
  imports: [
    UserModule,
    PassportModule,
    JwtModule.registerAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        secret: config.get('jwt.secret'),
        signOptions: { expiresIn: config.get('jwt.expiresIn') },
      }),
    }),
  ],
  controllers: [AuthController],
  providers: [AuthService, JwtStrategy],
  exports: [AuthService],
})
export class AuthModule implements OnModuleInit {
  constructor(
    private userService: UserService,
    private configService: ConfigService,
  ) {}

  /** 启动时确保默认管理员账号存在 */
  async onModuleInit() {
    const adminUser = this.configService.get('defaultAdmin');
    const exists = await this.userService.findByUsername(adminUser.username);
    if (!exists) {
      const passwordHash = await bcrypt.hash(adminUser.password, 10);
      await this.userService.create({
        username: adminUser.username,
        email: adminUser.email,
        passwordHash,
        role: 'admin',
        realName: '系统管理员',
      });
      console.log(
        `[Auth] 默认管理员已创建: ${adminUser.username} / ${adminUser.password} (${adminUser.email})`,
      );
    } else if (exists.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(exists.email)) {
      // 修正历史数据中管理员邮箱格式不正确的问题
      await this.userService.updateEmail(exists.id, adminUser.email);
      console.log(`[Auth] 管理员邮箱已修正为: ${adminUser.email}`);
    }
  }
}
