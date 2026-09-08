/** 用户表 */
export interface UserEntity {
  id: number;
  username: string;
  password_hash: string;
  role: 'admin' | 'student';
  real_name: string | null;
  student_no: string | null;
  email: string | null;
  avatar: string | null;
  display_name: string | null;
  balance: number;
  created_at: string;
  updated_at: string;
}

/** CDK 兑换码表 */
export interface CdkEntity {
  id: number;
  code: string;
  value: number;
  status: 'unused' | 'used';
  created_at: string;
  redeemed_by: number | null;
  redeemed_at: string | null;
}

/** 资金流水表 */
export interface TransactionEntity {
  id: number;
  user_id: number;
  type: 'recharge' | 'consume' | 'refund' | 'adjust';
  amount: number;
  balance_after: number;
  related_id: number | null;
  remark: string | null;
  created_at: string;
}

/** 模型表 */
export interface ModelEntity {
  id: number;
  user_id: number;
  filename: string;
  original_name: string;
  file_path: string;
  file_size: number;
  format: string;
  volume: number;
  estimated_cost: number;
  created_at: string;
}

/** 订单表 */
export interface OrderEntity {
  id: number;
  order_no: string;
  user_id: number;
  model_id: number;
  volume: number;
  cost: number;
  status: string;
  reject_reason: string | null;
  created_at: string;
  updated_at: string;
}

/** 订单状态日志表 */
export interface OrderLogEntity {
  id: number;
  order_id: number;
  from_status: string | null;
  to_status: string;
  operator_id: number | null;
  remark: string | null;
  created_at: string;
}

/** 邮箱验证码表 */
export interface EmailCodeEntity {
  email: string;
  code: string;
  expires_at: string;
  attempts: number;
  created_at: string;
}

/** 管理员审计日志表 */
export interface AdminAuditLogEntity {
  id: number;
  admin_id: number;
  action: string;
  target_type: string;
  target_id: number | null;
  request_params: string | null;
  ip: string | null;
  created_at: string;
}
