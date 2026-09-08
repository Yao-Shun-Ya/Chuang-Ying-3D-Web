import {
  Controller,
  Post,
  Get,
  UseGuards,
  UploadedFile,
  UseInterceptors,
  BadRequestException,
  Res,
  Param,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { diskStorage } from 'multer';
import { extname, join } from 'path';
import { existsSync, mkdirSync } from 'fs';
import { ModelService } from './model.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { ConfigService } from '@nestjs/config';
import { Response } from 'express';
import { nanoid } from 'nanoid';

const ALLOWED_EXT = ['.stl', '.obj', '.3mf'];

/**
 * 净化原始文件名：去掉路径部分与控制字符，防止存库后被用于路径拼接（路径穿越）
 */
function sanitizeOriginalName(name: string): string {
  const base = name.replace(/[/\\]/g, '_').split(/[\\/]/).pop() || 'model';
  return base
    // eslint-disable-next-line no-control-regex
    .replace(/[\x00-\x1f\x7f]/g, '')
    .replace(/\.{2,}/g, '.')
    .slice(0, 120)
    .trim() || 'model';
}

@Controller('models')
export class ModelController {
  constructor(
    private modelService: ModelService,
    private configService: ConfigService,
  ) {}

  /** 上传 3D 模型文件 */
  @Post('upload')
  @UseGuards(JwtAuthGuard)
  @UseInterceptors(
    FileInterceptor('file', {
      storage: diskStorage({
        destination: (req, file, cb) => {
          const dir = join(process.cwd(), 'data/uploads');
          if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
          cb(null, dir);
        },
        filename: (req, file, cb) => {
          const ext = extname(file.originalname).toLowerCase();
          const name = `${Date.now()}_${nanoid(8)}${ext}`;
          cb(null, name);
        },
      }),
      fileFilter: (req, file, cb) => {
        const ext = extname(file.originalname).toLowerCase();
        if (!ALLOWED_EXT.includes(ext)) {
          return cb(new BadRequestException('仅支持 STL / OBJ / 3MF 格式文件'), false);
        }
        cb(null, true);
      },
      limits: {
        fileSize: 50 * 1024 * 1024, // 50MB
      },
    }),
  )
  upload(
    @UploadedFile() file: Express.Multer.File,
    @CurrentUser('sub') userId: number,
  ) {
    if (!file) throw new BadRequestException('未收到文件');

    const ext = extname(file.originalname).toLowerCase().replace('.', '');
    return this.modelService.create({
      userId,
      filename: file.filename,
      originalName: sanitizeOriginalName(file.originalname),
      filePath: file.path,
      fileSize: file.size,
      format: ext as any,
    }).then((model) => ({
      id: model.id,
      originalName: model.original_name,
      format: model.format,
      fileSize: model.file_size,
      volume: model.volume,
      volumeUnit: 'cm³',
      estimatedCost: model.estimated_cost,
      costUnit: '元',
      thumbnailPath: model.thumbnail_path,
      createdAt: model.created_at,
    }));
  }

  /** 当前用户的模型列表 */
  @Get()
  @UseGuards(JwtAuthGuard)
  list(@CurrentUser('sub') userId: number) {
    return this.modelService.listByUser(userId).map((m) => ({
      id: m.id,
      originalName: m.original_name,
      format: m.format,
      fileSize: m.file_size,
      volume: m.volume,
      volumeUnit: 'cm³',
      estimatedCost: m.estimated_cost,
      costUnit: '元',
      thumbnailPath: m.thumbnail_path,
      createdAt: m.created_at,
    }));
  }

  /** 下载/预览模型文件（管理员与所有者可访问） */
  @Get(':id/file')
  @UseGuards(JwtAuthGuard)
  download(@Param('id') id: number, @CurrentUser() user: any, @Res() res: Response) {
    const model = this.modelService.findById(id);
    if (!model) throw new BadRequestException('模型不存在');
    // 仅所有者或管理员可下载
    if (model.user_id !== user.sub && user.role !== 'admin') {
      return res.status(403).send('无权限访问');
    }
    res.download(model.file_path, model.original_name);
  }

  /** 获取模型缩略图 */
  @Get(':id/thumbnail')
  thumbnail(@Param('id') id: number, @Res() res: Response) {
    const model = this.modelService.findById(id);
    if (!model) throw new BadRequestException('模型不存在');
    if (model.thumbnail_path) {
      res.sendFile(model.thumbnail_path);
    } else {
      res.status(404).send('缩略图尚未生成');
    }
  }
}
