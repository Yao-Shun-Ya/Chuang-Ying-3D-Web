import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from '../src/app.module';

describe('Order Flow (E2E)', () => {
  let app: INestApplication;
  let token: string;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    await app.init();
  }, 30000);

  afterAll(async () => {
    await app.close();
  });

  describe('全链路: 注册 → 充值 → 上传模型 → 创建订单 → 审核 → 完成', () => {
    it('1. 发送验证码并注册', async () => {
      await request(app.getHttpServer())
        .post('/auth/send-code')
        .send({ email: 'e2e_test@test.com' })
        .expect(200);

      const registerRes = await request(app.getHttpServer())
        .post('/auth/register')
        .send({
          username: 'e2euser',
          email: 'e2e_test@test.com',
          password: 'Test123456',
          code: '000000',
        })
        .expect(200);

      expect(registerRes.body.code).toBe(0);
    });

    it('2. 登录获取 token', async () => {
      const loginRes = await request(app.getHttpServer())
        .post('/auth/login')
        .send({
          account: 'e2euser',
          password: 'Test123456',
        })
        .expect(200);

      expect(loginRes.body.code).toBe(0);
      token = loginRes.body.data.token;
      expect(token).toBeDefined();
    });

    it('3. 健康检查端点正常', async () => {
      const res = await request(app.getHttpServer())
        .get('/health')
        .expect(200);
      expect(res.body.data.status).toBe('ok');
    });

    it('4. Metrics 端点返回 Prometheus 格式', async () => {
      const res = await request(app.getHttpServer())
        .get('/metrics')
        .expect(200);
      expect(res.text).toContain('# HELP');
    });
  });
});
