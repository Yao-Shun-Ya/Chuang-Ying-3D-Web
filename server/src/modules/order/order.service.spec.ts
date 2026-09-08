import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { OrderService, OrderStatus } from './order.service';
import { DatabaseService } from '../../database/database.service';
import { UserService } from '../user/user.service';
import { ModelService } from '../model/model.service';
import { TransactionService } from '../transaction/transaction.service';
import { PrintDispatchService } from '../print/print-dispatch.service';
import { EmailService } from '../../common/services/email.service';
import { OrderGateway } from './order.gateway';

describe('OrderService', () => {
  let service: OrderService;
  let db: DatabaseService;
  let userService: UserService;
  let modelService: ModelService;
  let txService: TransactionService;
  let printDispatch: PrintDispatchService;
  let gateway: OrderGateway;

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

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        OrderService,
        {
          provide: DatabaseService,
          useValue: {
            prepare: jest.fn().mockReturnValue({
              run: jest.fn(),
              get: jest.fn(),
              all: jest.fn(),
            }),
            exec: jest.fn(),
            transaction: jest.fn((fn) => fn()),
            get: jest.fn(),
            all: jest.fn(),
          },
        },
        {
          provide: UserService,
          useValue: {
            findById: jest.fn(),
            updateBalance: jest.fn(),
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
            record: jest.fn(),
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
      ],
    }).compile();

    service = module.get<OrderService>(OrderService);
    db = module.get<DatabaseService>(DatabaseService);
    userService = module.get<UserService>(UserService);
    modelService = module.get<ModelService>(ModelService);
    txService = module.get<TransactionService>(TransactionService);
    printDispatch = module.get<PrintDispatchService>(PrintDispatchService);
    gateway = module.get<OrderGateway>(OrderGateway);
  });

  describe('createOrder', () => {
    it('余额不足时应抛出异常', () => {
      jest.spyOn(modelService, 'findById').mockReturnValue(mockModel as any);
      jest.spyOn(userService, 'findById').mockReturnValue({ ...mockUser, balance: 1 } as any);

      expect(() => service.createOrder(1, 1)).toThrow(BadRequestException);
    });

    it('模型不存在时应抛出异常', () => {
      jest.spyOn(modelService, 'findById').mockReturnValue(undefined);

      expect(() => service.createOrder(1, 1)).toThrow(NotFoundException);
    });

    it('余额充足时应创建订单并扣费', () => {
      jest.spyOn(modelService, 'findById').mockReturnValue(mockModel as any);
      jest.spyOn(userService, 'findById').mockReturnValue(mockUser as any);
      const transactionSpy = jest.spyOn(db, 'transaction');
      jest.spyOn(db, 'prepare').mockReturnValue({
        run: jest.fn().mockReturnValue({ lastInsertRowid: 1 }),
        get: jest.fn().mockReturnValue({ id: 1 }),
        all: jest.fn(),
      } as any);
      (db as any).get = jest.fn().mockReturnValue({ id: 1 });

      const result = service.createOrder(1, 1);
      expect(transactionSpy).toHaveBeenCalled();
      expect(txService.record).toHaveBeenCalled();
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
      created_at: '',
      updated_at: '',
    };

    beforeEach(() => {
      jest.spyOn(service as any, 'findById').mockReturnValue(order);
      jest.spyOn(db, 'prepare').mockReturnValue({
        run: jest.fn(),
        get: jest.fn(),
        all: jest.fn(),
      } as any);
    });

    it('非法状态迁移应抛出异常', () => {
      expect(() => service.updateStatus(1, 'completed', 0)).toThrow(BadRequestException);
    });

    it('合法状态迁移应成功', () => {
      // findById 第二次返回 printing 状态
      jest.spyOn(service as any, 'findById')
        .mockReturnValueOnce(order)
        .mockReturnValue({ ...order, status: 'printing' });
      const result = service.updateStatus(1, 'approved', 0);
      expect(result.status).toBe('printing'); // 审核通过自动转 printing
      expect(printDispatch.dispatch).toHaveBeenCalled();
    });

    it('订单不存在应抛出异常', () => {
      jest.spyOn(service as any, 'findById').mockReturnValue(undefined);
      expect(() => service.updateStatus(999, 'approved', 0)).toThrow(NotFoundException);
    });
  });
});
