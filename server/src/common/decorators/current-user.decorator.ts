import { createParamDecorator, ExecutionContext } from '@nestjs/common';

/** 从请求中取出当前登录用户（JWT 策略已挂载到 req.user） */
export const CurrentUser = createParamDecorator((data: string, ctx: ExecutionContext) => {
  const request = ctx.switchToHttp().getRequest();
  const user = request.user;
  return data ? user?.[data] : user;
});
