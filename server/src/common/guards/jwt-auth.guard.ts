import { Injectable } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';

/** JWT 鉴权守卫：校验请求头 Authorization Bearer token */
@Injectable()
export class JwtAuthGuard extends AuthGuard('jwt') {}
