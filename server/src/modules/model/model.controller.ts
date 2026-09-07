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

@Controller('models')
@UseGuards(JwtAuthGuard)
export class ModelController {
  constructor(
    private modelService: ModelService,
    private configService: ConfigService,
  ) {}

  /** 上传 3D 模型文件 */
  @Post('upload')
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
    const model = this.modelService.create({
      userId,
      filename: file.filename,
      originalName: file.originalname,
      filePath: file.path,
      fileSize: file.size,
      format: ext as any,
    });

    return {
      id: model.id,
      originalName: model.original_name,
      format: model.format,
      fileSize: model.file_size,
      volume: model.volume,
      volumeUnit: 'cm³',
      estimatedCost: model.estimated_cost,
      costUnit: '元',
      createdAt: model.created_at,
    };
  }

  /** 当前用户的模型列表 */
  @Get()
  list(@CurrentUser('sub') userId: number) {
    return this.modelService.listByUser(userId).map((m) => ({
      id: m.id,
      originalName: m.original_name,
      format: m.format,
      fileSize: m.file_size,
      volume: m.volume,
      estimatedCost: m.estimated_cost,
      createdAt: m.created_at,
    }));
  }

  /** 下载/预览模型文件（管理员与所有者可访问） */
  @Get(':id/file')
  download(@Param('id') id: number, @CurrentUser() user: any, @Res() res: Response) {
    const model = this.modelService.findById(id);
    if (!model) throw new BadRequestException('模型不存在');
    // 仅所有者或管理员可下载
    if (model.user_id !== user.sub && user.role !== 'admin') {
      return res.status(403).send('无权限访问');
    }
    res.download(model.file_path, model.original_name);
  }
}
