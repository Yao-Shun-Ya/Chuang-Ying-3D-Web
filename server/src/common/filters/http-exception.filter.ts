import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Request, Response } from 'express';
import { ApiResponse } from '../dto/api-response.dto';
import { ErrorCode } from '../constants/error-codes';

/**
 * 全局异常过滤器
 * 捕获所有未处理异常，返回统一错误响应并记录结构化日志
 */
@Catch()
export class GlobalExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(GlobalExceptionFilter.name);

  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    const traceId =
      (request.headers['x-trace-id'] as string) || (request as { traceId?: string }).traceId;

    let status: number;
    let code: number;
    let message: string;

    if (exception instanceof HttpException) {
      status = exception.getStatus();
      const res = exception.getResponse();
      if (typeof res === 'object' && res !== null && 'message' in res) {
        const msg = (res as { message: unknown }).message;
        message = Array.isArray(msg) ? msg.join('; ') : String(msg);
      } else {
        message = String(res);
      }
      // 尝试从 message 中提取业务错误码
      code = this.mapHttpToErrorCode(status, message);
    } else {
      status = HttpStatus.INTERNAL_SERVER_ERROR;
      code = ErrorCode.UNKNOWN_ERROR;
      message = exception instanceof Error ? exception.message : 'Internal server error';
    }

    // 记录结构化日志
    this.logger.error(
      JSON.stringify({
        traceId,
        method: request.method,
        url: request.url,
        ip: request.ip,
        status,
        code,
        message,
        stack: exception instanceof Error ? exception.stack : undefined,
      }),
    );

    response.status(status).json(ApiResponse.fail(code, message, null, traceId));
  }

  /** 将 HTTP 状态码映射到业务错误码 */
  private mapHttpToErrorCode(status: number, message: string): number {
    switch (status) {
      case HttpStatus.BAD_REQUEST:
        return ErrorCode.PARAM_INVALID;
      case HttpStatus.UNAUTHORIZED:
        return message.includes('expired') ? ErrorCode.TOKEN_EXPIRED : ErrorCode.UNAUTHORIZED;
      case HttpStatus.FORBIDDEN:
        return ErrorCode.FORBIDDEN;
      case HttpStatus.NOT_FOUND:
        return ErrorCode.ORDER_NOT_FOUND;
      case HttpStatus.TOO_MANY_REQUESTS:
        return ErrorCode.RATE_LIMITED;
      case HttpStatus.PAYLOAD_TOO_LARGE:
        return ErrorCode.FILE_TOO_LARGE;
      case HttpStatus.UNSUPPORTED_MEDIA_TYPE:
        return ErrorCode.FILE_TYPE_UNSUPPORTED;
      default:
        return ErrorCode.UNKNOWN_ERROR;
    }
  }
}
