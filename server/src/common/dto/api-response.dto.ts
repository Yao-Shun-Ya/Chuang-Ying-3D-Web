import { ApiProperty } from '@nestjs/swagger';

/**
 * 统一 API 响应格式
 * { code: number, data: T, msg: string, traceId?: string }
 */
export class ApiResponse<T> {
  @ApiProperty({ description: '业务状态码，0 表示成功' })
  code: number;

  @ApiProperty({ description: '响应数据' })
  data: T;

  @ApiProperty({ description: '提示信息' })
  msg: string;

  @ApiProperty({ description: '请求追踪 ID', required: false })
  traceId?: string;

  constructor(code: number, data: T, msg = 'success', traceId?: string) {
    this.code = code;
    this.data = data;
    this.msg = msg;
    this.traceId = traceId;
  }

  static success<T>(data: T, msg = 'success', traceId?: string): ApiResponse<T> {
    return new ApiResponse(0, data, msg, traceId);
  }

  static fail(code: number, msg: string, data: null = null, traceId?: string): ApiResponse<null> {
    return new ApiResponse(code, data, msg, traceId);
  }
}

/** 分页响应数据 */
export interface PaginatedData<T> {
  list: T[];
  total: number;
  page: number;
  pageSize: number;
}

/** 分页响应 */
export type PaginatedResponse<T> = ApiResponse<PaginatedData<T>>;
