import { Controller, Get } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { DatabaseService } from '../../database/database.service';
import * as fs from 'fs';
import * as os from 'os';

interface HealthInfo {
  status: 'ok' | 'degraded';
  timestamp: string;
  uptime: number;
  database: { connected: boolean };
  disk: {
    freeGB: number;
    totalGB: number;
    usagePercent: number;
  };
  memory: {
    freeMB: number;
    totalMB: number;
    usagePercent: number;
  };
}

@ApiTags('系统')
@Controller('health')
export class HealthController {
  constructor(private db: DatabaseService) {}

  @Get()
  @ApiOperation({ summary: '健康检查' })
  check(): HealthInfo {
    const now = Date.now();
    const uptime = process.uptime();

    // 数据库连接检查
    let dbConnected = false;
    try {
      this.db.prepare('SELECT 1').get();
      dbConnected = true;
    } catch {
      dbConnected = false;
    }

    // 磁盘空间检查（根目录）
    const diskStats = fs.statfsSync(process.cwd());
    const diskFreeGB = (diskStats.bsize * diskStats.bavail) / 1024 / 1024 / 1024;
    const diskTotalGB = (diskStats.bsize * diskStats.blocks) / 1024 / 1024 / 1024;
    const diskUsagePercent = ((diskTotalGB - diskFreeGB) / diskTotalGB) * 100;

    // 内存检查
    const totalMemMB = os.totalmem() / 1024 / 1024;
    const freeMemMB = os.freemem() / 1024 / 1024;
    const memUsagePercent = ((totalMemMB - freeMemMB) / totalMemMB) * 100;

    const status = dbConnected && diskUsagePercent < 90 && memUsagePercent < 95 ? 'ok' : 'degraded';

    return {
      status,
      timestamp: new Date(now).toISOString(),
      uptime: Math.floor(uptime),
      database: { connected: dbConnected },
      disk: {
        freeGB: Number(diskFreeGB.toFixed(2)),
        totalGB: Number(diskTotalGB.toFixed(2)),
        usagePercent: Number(diskUsagePercent.toFixed(1)),
      },
      memory: {
        freeMB: Number(freeMemMB.toFixed(1)),
        totalMB: Number(totalMemMB.toFixed(1)),
        usagePercent: Number(memUsagePercent.toFixed(1)),
      },
    };
  }
}
