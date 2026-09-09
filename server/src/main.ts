import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import helmet from 'helmet';
import { AppModule } from './app.module';
import { join } from 'path';
import { NestExpressApplication } from '@nestjs/platform-express';
import { TransformInterceptor } from './common/interceptors/transform.interceptor';
import { GlobalExceptionFilter } from './common/filters/http-exception.filter';
import { AppLoggerService } from './common/logger/logger.service';

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule, {
    logger: new AppLoggerService(),
  });

  const isProduction = process.env.NODE_ENV === 'production';

  // Helmet 安全头
  app.use(
    helmet({
      contentSecurityPolicy: false, // 前端可能需要加载外部资源
      crossOriginEmbedderPolicy: false,
    }),
  );

  // CORS：优先使用 CORS_ORIGINS 白名单（逗号分隔）；未配置时反射任意来源（仅限开发）
  const corsOrigins = process.env.CORS_ORIGINS?.split(',')
    .map((s) => s.trim())
    .filter(Boolean);
  if (isProduction && !corsOrigins?.length) {
    console.warn(
      '[3D-Print Server] 生产环境未配置 CORS_ORIGINS，将不允许跨域携带凭证（同源部署不受影响）',
    );
  }
  app.enableCors({
    origin: corsOrigins?.length ? corsOrigins : true,
    credentials: true,
  });

  // 全局参数校验管道
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
      forbidNonWhitelisted: false,
    }),
  );

  // 全局响应拦截器（统一响应格式）
  app.useGlobalInterceptors(new TransformInterceptor());

  // 全局异常过滤器
  app.useGlobalFilters(new GlobalExceptionFilter());

  // 全局前缀
  app.setGlobalPrefix('api', {
    exclude: ['health', 'metrics'],
  });

  // 静态资源：仅开放头像目录；上传的模型文件必须走 /api/models/:id/file（含权限校验），禁止直接公开
  app.useStaticAssets(join(process.cwd(), 'data', 'avatars'), { prefix: '/uploads/avatars/' });

  // Swagger API 文档（生产环境关闭，避免接口结构泄露）
  if (!isProduction) {
    const config = new DocumentBuilder()
      .setTitle('创影 3D · 校内 3D 打印自助服务平台 API')
      .setDescription('Campus 3D Printing Self-Service Platform RESTful API')
      .setVersion('1.0.0')
      .addBearerAuth()
      .build();
    const document = SwaggerModule.createDocument(app, config);
    SwaggerModule.setup('api-docs', app, document);
  }

  const port = process.env.PORT ? Number(process.env.PORT) : 8731;
  await app.listen(port);
  console.log(`[3D-Print Server] 后端已启动: http://localhost:${port}/api`);
  if (!isProduction) {
    console.log(`[3D-Print Server] API 文档: http://localhost:${port}/api-docs`);
  }
}
bootstrap();
