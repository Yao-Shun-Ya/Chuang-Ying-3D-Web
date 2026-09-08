import { Controller, Post, Body, Get, Query, UseGuards, NotFoundException } from '@nestjs/common';
import { CdkService } from './cdk.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { IsNumber, IsString, IsOptional } from 'class-validator';
import { TransactionService } from '../transaction/transaction.service';
import { UserService } from '../user/user.service';

class GenerateCdkDto {
  @IsNumber()
  value: number;
  @IsNumber()
  count: number;
}

class RedeemCdkDto {
  @IsString()
  code: string;
}

@Controller('cdk')
@UseGuards(JwtAuthGuard)
export class CdkController {
  constructor(
    private cdkService: CdkService,
    private txService: TransactionService,
    private userService: UserService,
  ) {}

  /** 管理员批量生成 CDK */
  @Post('generate')
  @UseGuards(RolesGuard)
  @Roles('admin')
  generate(@Body() dto: GenerateCdkDto) {
    return this.cdkService.batchGenerate(dto.value, dto.count);
  }

  /** 学生兑换 CDK */
  @Post('redeem')
  redeem(@Body() dto: RedeemCdkDto, @CurrentUser('sub') userId: number) {
    return this.cdkService.redeem(dto.code, userId);
  }

  /** 管理员查看 CDK 列表 */
  @Get()
  @UseGuards(RolesGuard)
  @Roles('admin')
  list(@Query('status') status?: string) {
    return this.cdkService.list(status);
  }

  /** 学生查询当前余额 */
  @Get('balance')
  balance(@CurrentUser('sub') userId: number) {
    const u = this.userService.findById(userId);
    if (!u) throw new NotFoundException('用户不存在');
    return { balance: u.balance };
  }

  /** 学生查询自己的流水 */
  @Get('transactions')
  transactions(@CurrentUser('sub') userId: number) {
    return this.txService.listByUser(userId);
  }
}
