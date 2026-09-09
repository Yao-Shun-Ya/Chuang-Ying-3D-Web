import { CallHandler, ExecutionContext, Injectable, NestInterceptor } from '@nestjs/common';
import { Observable, map } from 'rxjs';
import { ApiResponse } from '../dto/api-response.dto';

/**
 * 全局响应拦截器
 * 将所有 Controller 返回值包装为统一格式 { code: 0, data, msg: 'success', traceId }
 */
@Injectable()
export class TransformInterceptor implements NestInterceptor {
  intercept(context: ExecutionContext, next: CallHandler): Observable<ApiResponse<unknown>> {
    const request = context.switchToHttp().getRequest();
    const traceId = request.headers['x-trace-id'] || request.traceId;

    return next.handle().pipe(
      map((data) => {
        // metrics 端点返回纯文本，不包装
        if (request.url === '/metrics') {
          return data;
        }
        // 已手动返回 ApiResponse 的直接透传
        if (data instanceof ApiResponse) {
          return data;
        }
        return ApiResponse.success(data, 'success', traceId);
      }),
    );
  }
}
