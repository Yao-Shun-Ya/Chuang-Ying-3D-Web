import { Controller, Get, UseInterceptors } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { CacheInterceptor, CacheKey, CacheTTL } from '@nestjs/cache-manager';
import { ApiOperation, ApiTags } from '@nestjs/swagger';

interface MaterialConfig {
  density: number;
  pricePerGram: number;
  infillRate: number;
}

@ApiTags('公开配置')
@Controller('config')
@UseInterceptors(CacheInterceptor)
export class PublicConfigController {
  constructor(private configService: ConfigService) {}

  /** 公开耗材配置（前端展示价格估算用）- 缓存 60 秒 */
  @Get('material')
  @CacheKey('public_material_config')
  @CacheTTL(60)
  @ApiOperation({ summary: '获取公开耗材配置' })
  getMaterialConfig(): MaterialConfig {
    const material = this.configService.get('material');
    return {
      density: material.density,
      pricePerGram: material.pricePerGram,
      infillRate: material.infillRate,
    };
  }
}
