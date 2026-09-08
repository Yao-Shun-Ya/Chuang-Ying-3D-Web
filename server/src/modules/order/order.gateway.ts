import {
  WebSocketGateway,
  WebSocketServer,
  SubscribeMessage,
  OnGatewayConnection,
  OnGatewayDisconnect,
} from '@nestjs/websockets';
import { Logger } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Server, Socket } from 'socket.io';

/**
 * 订单状态 WebSocket 网关
 * - 连接需携带 JWT（auth.token），从 token 解出 userId，禁止客户端自报身份
 * - 前端连接后可监听 order:status_changed 事件
 * - 服务端在订单状态变更时调用 emitOrderStatus 推送
 */
@WebSocketGateway({ cors: { origin: '*' }, namespace: '/orders' })
export class OrderGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server: Server;

  private readonly logger = new Logger(OrderGateway.name);

  constructor(private readonly jwtService: JwtService) {}

  handleConnection(client: Socket) {
    // 从 auth.token 验证 JWT，杜绝伪造他人 userId 监听订单
    const token: string | undefined = client.handshake.auth?.token;
    if (!token) {
      this.logger.warn(`WS 连接被拒绝（缺少 token）: ${client.id}`);
      client.disconnect(true);
      return;
    }
    try {
      const payload = this.jwtService.verify<{ sub: number }>(token);
      const userId = payload.sub;
      client.data.userId = userId;
      client.join(`user:${userId}`);
      this.logger.log(`WS 客户端连接: ${client.id} (user:${userId})`);
    } catch {
      this.logger.warn(`WS 连接被拒绝（token 无效或过期）: ${client.id}`);
      client.disconnect(true);
    }
  }

  handleDisconnect(client: Socket) {
    this.logger.log(`WS 客户端断开: ${client.id}`);
  }

  /** 客户端订阅指定订单的状态（需登录，任意登录用户可订阅订单房间） */
  @SubscribeMessage('subscribe:order')
  subscribeOrder(client: Socket, orderId: number) {
    if (!client.data.userId) {
      return { event: 'error', data: { message: '未认证' } };
    }
    client.join(`order:${orderId}`);
    return { event: 'subscribed', data: { orderId } };
  }

  /**
   * 推送订单状态变更
   * @param orderId 订单 ID
   * @param payload 状态信息
   */
  emitOrderStatus(orderId: number, payload: any) {
    this.server.to(`order:${orderId}`).emit('order:status_changed', { orderId, ...payload });
    // 同时推送给订单所属用户
    if (payload.userId) {
      this.server.to(`user:${payload.userId}`).emit('order:status_changed', { orderId, ...payload });
    }
  }
}
