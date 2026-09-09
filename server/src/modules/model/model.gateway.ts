import {
  WebSocketGateway,
  WebSocketServer,
  OnGatewayConnection,
  OnGatewayDisconnect,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { Logger } from '@nestjs/common';

/**
 * 模型解析 WebSocket 网关
 * - 前端连接 /models 命名空间，通过 auth.socketId 关联
 * - 上传模型时服务端推送解析进度 model:parse_progress
 */
@WebSocketGateway({ cors: { origin: '*' }, namespace: '/models' })
export class ModelGateway implements OnGatewayConnection, OnGatewayDisconnect {
  private readonly logger = new Logger(ModelGateway.name);
  @WebSocketServer()
  server: Server;

  handleConnection(client: Socket) {
    const userId = client.handshake.auth?.userId;
    if (userId) {
      client.join(`user:${userId}`);
    }
    this.logger.log(`[WS] 模型客户端连接: ${client.id}${userId ? ` (user:${userId})` : ''}`);
  }

  handleDisconnect(client: Socket) {
    this.logger.log(`[WS] 模型客户端断开: ${client.id}`);
  }

  /**
   * 推送模型解析进度
   * @param userId 用户 ID
   * @param modelId 模型 ID
   * @param progress 进度 0~1
   * @param stage 阶段描述
   */
  emitParseProgress(userId: number, modelId: number, progress: number, stage: string) {
    this.server.to(`user:${userId}`).emit('model:parse_progress', {
      modelId,
      progress: Math.round(progress * 100),
      stage,
      timestamp: Date.now(),
    });
  }

  /** 解析完成推送 */
  emitParseComplete(userId: number, modelId: number, volume: number, cost: number) {
    this.server.to(`user:${userId}`).emit('model:parse_complete', {
      modelId,
      volume,
      cost,
      timestamp: Date.now(),
    });
  }

  /** 解析失败推送 */
  emitParseFailed(userId: number, modelId: number, error: string) {
    this.server.to(`user:${userId}`).emit('model:parse_failed', {
      modelId,
      error,
      timestamp: Date.now(),
    });
  }
}
