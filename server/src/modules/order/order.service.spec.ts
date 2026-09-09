import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { OrderService, OrderStatus } from './order.service';
import { DatabaseService } from '../../database/database.service';
import { UserService } from '../user/user.service';
import { ModelService } from '../model/model.service';
import { TransactionService } from '../transaction/transaction.service';
import { PrintDispatchService } from '../print/print-dispatch.service';
import { EmailService } from '../../common/services/email.service';
import { OrderGateway } from './order.gateway';
import { DeviceManagerService } from '../device/device-manager.service';

describe('OrderService', () => {
  let service: OrderService;
  let db: DatabaseService;
  let userService: UserService;
  let modelService: ModelService;
  let txService: TransactionService;
  let printDispatch: PrintDispatchService;
  let deviceManager: DeviceManagerService;

  const mockUser = {
    id: 1,
    username: 'testuser',
    email: 'test@test.com',
    role: 'student',
    balance: 10,
  };

  const mockModel = {
    id: 1,
    user_id: 1,
    volume: 10,
    estimated_cost: 5,
    original_name: 'test.stl',
    file_path: '/tmp/test.stl',
  };

  const mockRunResult = { changes: 1, lastInsertRowid: 1, rows: [{ id: 1 }] };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        OrderService,
        {
          provide: DatabaseService,
          useValue: {
            run: jest.fn().mockResolvedValue(mockRunResult),
            get: jest.fn().mockResolvedValue({ id: 1 }),
            all: jest.fn().mockResolvedValue([]),
            exec: jest.fn(),
            prepare: jest.fn().mockReturnValue({
              run: jest.fn().mockResolvedValue(mockRunResult),
              get: jest.fn().mockResolvedValue({ id: 1 }),
              all: jest.fn().mockResolvedValue([]),
            }),
            transaction: jest.fn(async (fn) =>
              fn({
                run: jest.fn().mockResolvedValue(mockRunResult),
                get: jest.fn(),
                all: jest.fn(),
              }),
            ),
          },
        },
        {
          provide: UserService,
          useValue: {
            findById: jest.fn(),
            updateBalance: jest.fn().mockResolvedValue(undefined),
          },
        },
        {
          provide: ModelService,
          useValue: {
            findById: jest.fn(),
          },
        },
        {
          provide: TransactionService,
          useValue: {
            record: jest.fn().mockResolvedValue(undefined),
          },
        },
        {
          provide: PrintDispatchService,
          useValue: {
            dispatch: jest.fn(),
          },
        },
        {
          provide: OrderGateway,
          useValue: {
            emitOrderStatus: jest.fn(),
          },
        },
        {
          provide: EmailService,
          useValue: {
            send: jest.fn().mockResolvedValue(true),
          },
        },
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn((key: string, def?: unknown) => {
              const map: Record<string, unknown> = {
                'material.density': 1.24,
                'material.pricePerGram': 0.5,
                'material.infillRate': 0.2,
              };
              return map[key] ?? def;
            }),
          },
        },
        {
          provide: DeviceManagerService,
          useValue: {
            getDeviceConfig: jest.fn().mockResolvedValue({ id: 'bambu-01', category: 'fdm' }),
            getDevice: jest.fn().mockReturnValue({ status: { online: true, state: 'idle' } }),
            isDeviceEnabled: jest.fn().mockResolvedValue(true),
          },
        },
      ],
    }).compile();

    service = module.get<OrderService>(OrderService);
    db = module.get<DatabaseService>(DatabaseService);
    userService = module.get<UserService>(UserService);
    modelService = module.get<ModelService>(ModelService);
    txService = module.get<TransactionService>(TransactionService);
    printDispatch = module.get<PrintDispatchService>(PrintDispatchService);
    deviceManager = module.get<DeviceManagerService>(DeviceManagerService);
  });

  describe('createOrder', () => {
    it('模型不存在时应抛出异常', async () => {
      jest.spyOn(modelService, 'findById').mockResolvedValue(undefined as any);

      await expect(service.createOrder(1, 1)).rejects.toThrow(NotFoundException);
    });

    it('余额充足时应创建订单并扣费', async () => {
      jest.spyOn(modelService, 'findById').mockResolvedValue({ ...mockModel, user_id: 1 } as any);
      jest.spyOn(userService, 'findById').mockResolvedValue(mockUser as any);
      const transactionSpy = jest.spyOn(db, 'transaction');

      await service.createOrder(1, 1, undefined, 1, { deviceId: 'bambu-01' });

      expect(transactionSpy).toHaveBeenCalled();
      expect(txService.record).toHaveBeenCalled();
    });

    it('未选择打印设备时应拒绝下单', async () => {
      jest.spyOn(modelService, 'findById').mockResolvedValue({ ...mockModel, user_id: 1 } as any);
      jest.spyOn(userService, 'findById').mockResolvedValue(mockUser as any);

      await expect(service.createOrder(1, 1)).rejects.toThrow('请选择打印设备');
    });

    it('所选设备离线时应拒绝下单', async () => {
      jest.spyOn(modelService, 'findById').mockResolvedValue({ ...mockModel, user_id: 1 } as any);
      jest
        .spyOn(deviceManager, 'getDevice')
        .mockReturnValue({ status: { online: false, state: 'offline' } } as any);

      await expect(
        service.createOrder(1, 1, undefined, 1, { deviceId: 'bambu-01' }),
      ).rejects.toThrow('所选设备当前离线');
    });
  });

  describe('updateStatus', () => {
    const order = {
      id: 1,
      order_no: 'ORD123',
      user_id: 1,
      model_id: 1,
      volume: 10,
      cost: 5,
      status: 'pending_review' as OrderStatus,
      reject_reason: null,
      printer_device_id: null,
      print_params: null,
      created_at: '',
      updated_at: '',
    };

    beforeEach(() => {
      jest.spyOn(service as any, 'findById').mockResolvedValue(order);
    });

    it('非法状态迁移应抛出异常', async () => {
      await expect(service.updateStatus(1, 'completed', 0)).rejects.toThrow(BadRequestException);
    });

    it('合法状态迁移应成功', async () => {
      // findById 第二次返回 printing 状态
      jest
        .spyOn(service as any, 'findById')
        .mockResolvedValueOnce(order)
        .mockResolvedValue({ ...order, status: 'printing' });
      const result = await service.updateStatus(1, 'approved', 0);
      expect(result.status).toBe('printing'); // 审核通过自动转 printing
      expect(printDispatch.dispatch).toHaveBeenCalled();
    });

    it('订单不存在应抛出异常', async () => {
      jest.spyOn(service as any, 'findById').mockResolvedValue(undefined);
      await expect(service.updateStatus(999, 'approved', 0)).rejects.toThrow(NotFoundException);
    });
  });
});
