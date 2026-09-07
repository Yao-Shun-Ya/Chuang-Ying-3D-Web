import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { AppModule } from './app.module';
import { join } from 'path';
import { NestExpressApplication } from '@nestjs/platform-express';

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule);

  // 全局 CORS：允许前端跨域访问
  app.enableCors({
    origin: true,
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

  // 全局前缀
  app.setGlobalPrefix('api');

  // 静态资源：头像、模型文件
  app.useStaticAssets(join(process.cwd(), 'data', 'avatars'), { prefix: '/uploads/avatars/' });
  app.useStaticAssets(join(process.cwd(), 'data', 'uploads'), { prefix: '/uploads/' });

  const port = process.env.PORT ? Number(process.env.PORT) : 8731;
  await app.listen(port);
  console.log(`[3D-Print Server] 后端已启动: http://localhost:${port}/api`);
}
bootstrap();
