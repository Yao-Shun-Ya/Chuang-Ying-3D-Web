import {
  WebSocketGateway,
  WebSocketServer,
  SubscribeMessage,
  OnGatewayConnection,
  OnGatewayDisconnect,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';

/**
 * 订单状态 WebSocket 网关
 * - 前端连接后可监听 order:status_changed 事件
 * - 服务端在订单状态变更时调用 emitOrderStatus 推送
 */
@WebSocketGateway({ cors: { origin: '*' }, namespace: '/orders' })
export class OrderGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server: Server;

  private userRooms = new Map<string, string>(); // socketId -> userId

  handleConnection(client: Socket) {
    // 前端可通过 auth 传递 userId 加入个人房间
    const userId = client.handshake.auth?.userId;
    if (userId) {
      client.join(`user:${userId}`);
      this.userRooms.set(client.id, userId);
    }
    console.log(`[WS] 客户端连接: ${client.id}${userId ? ` (user:${userId})` : ''}`);
  }

  handleDisconnect(client: Socket) {
    this.userRooms.delete(client.id);
    console.log(`[WS] 客户端断开: ${client.id}`);
  }

  /** 客户端订阅指定订单的状态 */
  @SubscribeMessage('subscribe:order')
  subscribeOrder(client: Socket, orderId: number) {
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
