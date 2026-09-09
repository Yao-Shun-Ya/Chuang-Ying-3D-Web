import {
  WebSocketGateway,
  WebSocketServer,
  OnGatewayConnection,
  OnGatewayDisconnect,
} from '@nestjs/websockets';
import { Logger } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Server, Socket } from 'socket.io';
import { AdminDeviceView } from './device-manager.service';
import { PublicDeviceSummary } from './device.interface';

export interface DeviceEventPayload {
  deviceId: string | null;
  level: 'info' | 'warn' | 'error';
  eventType: string;
  message: string;
  at: string;
}

/**
 * 设备状态 WebSocket 网关
 * - 连接需携带 JWT（auth.token），从 token 解出 userId / role
 * - admin 角色 join `admin` 房间：收全量遥测与事件（连接结果/错误/告警）
 * - 所有登录用户 join `public` 房间：收脱敏摘要（不含凭据/host/序列号）
 */
@WebSocketGateway({ cors: { origin: '*' }, namespace: '/devices' })
export class DeviceGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server: Server;

  private readonly logger = new Logger(DeviceGateway.name);

  constructor(private readonly jwtService: JwtService) {}

  handleConnection(client: Socket) {
    const token: string | undefined = client.handshake.auth?.token;
    if (!token) {
      this.logger.warn(`WS 连接被拒绝（缺少 token）: ${client.id}`);
      client.disconnect(true);
      return;
    }
    try {
      const payload = this.jwtService.verify<{ sub: number; role: string }>(token);
      client.data.userId = payload.sub;
      client.data.role = payload.role;
      client.join('public');
      if (payload.role === 'admin') {
        client.join('admin');
        this.logger.log(`WS 设备监控连接(管理): ${client.id} (user:${payload.sub})`);
      } else {
        this.logger.log(`WS 设备监控连接(公共): ${client.id} (user:${payload.sub})`);
      }
    } catch {
      this.logger.warn(`WS 连接被拒绝（token 无效或过期）: ${client.id}`);
      client.disconnect(true);
    }
  }

  handleDisconnect(client: Socket) {
    // socket.io 自动离开房间
  }

  /** 单设备状态广播：admin 全量 + public 摘要 */
  broadcastStatus(adminView: AdminDeviceView, publicView: PublicDeviceSummary) {
    this.server.to('admin').emit('device:status', adminView);
    this.server.to('public').emit('device:public_status', publicView);
  }

  /** 设备事件广播（仅管理端） */
  broadcastEvent(event: DeviceEventPayload) {
    this.server.to('admin').emit('device:event', event);
  }
}
