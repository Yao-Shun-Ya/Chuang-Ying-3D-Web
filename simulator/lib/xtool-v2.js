/**
 * 虚拟 xTool 激光机（WS-V2 协议）：TLS WebSocket 指令通道（默认 28900）
 * - 0xBABE 二进制帧封装（与平台适配器一致）
 * - 首条消息必须 /v1/user/parity 握手；心跳 /v1/user/ping
 * - GET /v1/device/runtime-infos、/v1/processing/progress
 * - PUT /v1/processing/state?action=pause|start|stop
 * - 状态变化主动推送 /work/mode 与 /work/result 事件
 */
const { WebSocketServer } = require('ws');
const https = require('https');
const { generateCert } = require('./certs');

// ============ CRC-16/ARC ============
const CRC16_TABLE = (() => {
  const table = new Array(256);
  for (let i = 0; i < 256; i++) {
    let crc = i;
    for (let j = 0; j < 8; j++) {
      crc = crc & 1 ? (crc >> 1) ^ 0xa001 : crc >> 1;
    }
    table[i] = crc & 0xffff;
  }
  return table;
})();

function crc16(data) {
  let crc = 0;
  for (const b of data) {
    crc = (CRC16_TABLE[(crc ^ b) & 0xff] ^ (crc >> 8)) & 0xffff;
  }
  return crc;
}

function encodeFrame(payload) {
  const header = Buffer.alloc(10);
  header[0] = 0xba;
  header[1] = 0xbe;
  const len = payload.length;
  header[2] = (len >> 16) & 0xff;
  header[3] = (len >> 8) & 0xff;
  header[4] = len & 0xff;
  header[5] = 4;
  const payloadCrc = crc16(payload);
  header[6] = (payloadCrc >> 8) & 0xff;
  header[7] = payloadCrc & 0xff;
  const headerCrc = crc16(header.subarray(0, 8));
  header[8] = (headerCrc >> 8) & 0xff;
  header[9] = headerCrc & 0xff;
  return Buffer.concat([header, payload]);
}

function decodeFrames(buffer) {
  const frames = [];
  let pos = 0;
  const n = buffer.length;
  while (pos + 10 <= n) {
    if (buffer[pos] !== 0xba || buffer[pos + 1] !== 0xbe) {
      pos += 1;
      continue;
    }
    const length = (buffer[pos + 2] << 16) | (buffer[pos + 3] << 8) | buffer[pos + 4];
    const total = 10 + length;
    if (pos + total > n) break;
    const header = buffer.subarray(pos, pos + 8);
    const headerCrc = (buffer[pos + 8] << 8) | buffer[pos + 9];
    if (crc16(header) !== headerCrc) {
      pos += 1;
      continue;
    }
    frames.push(Buffer.from(buffer.subarray(pos + 10, pos + total)));
    pos += total;
  }
  return [frames, buffer.subarray(pos)];
}

// 虚拟状态 → xTool 模式字符串
const MODE_OF = {
  idle: 'P_IDLE',
  working: 'P_WORKING',
  paused: 'P_PAUSE',
  error: 'P_ERROR',
  finishing: 'P_FINISH',
};

function createXtoolV2(store, device, port) {
  const { key, cert } = generateCert();
  // ws 库的 port 选项只创建 HTTP 服务；WSS 需自建 HTTPS server
  const httpsServer = https.createServer({ key, cert });
  const wss = new WebSocketServer({
    server: httpsServer,
    path: '/websocket',
  });
  const sockets = new Set();
  let open = true;
  let offline = false; // 设备掉线：拒绝新建连接，使后端重连失败、离线态保持

  const send = (ws, obj) => {
    if (ws.readyState === 1) ws.send(encodeFrame(Buffer.from(JSON.stringify(obj), 'utf-8')));
  };

  const pushEvent = (url, data) => {
    const event = { url, data, timestamp: Date.now() };
    for (const ws of sockets) send(ws, event);
  };

  const respond = (ws, txn, data = {}, msg = 'ok') => {
    send(ws, { type: 'response', transactionId: txn, code: 0, data, msg });
  };

  const currentMode = () => MODE_OF[store.get(device.id).state] || 'P_IDLE';

  const pushMode = () => {
    const virtual = store.get(device.id);
    pushEvent('/work/mode', {
      module: 'STATUS_CONTROLLER',
      type: 'MODE_CHANGE',
      info: { mode: currentMode(), taskId: virtual.workSeconds > 0 ? 'sim-task-1' : '' },
    });
  };

  wss.on('connection', (ws, req) => {
    // 设备掉线：拒绝新指令通道连接（与真实设备不可达一致）
    if (offline) {
      ws.close();
      return;
    }
    const url = new URL(req.url, 'https://localhost');
    if (url.searchParams.get('function') !== 'instruction') {
      ws.close();
      return;
    }
    sockets.add(ws);
    console.log(`[xTool模拟] ${device.name} 指令通道客户端已连接（port ${port}）`);
    let rxBuffer = Buffer.alloc(0);
    let parityDone = false;

    ws.on('message', (data, isBinary) => {
      let frames = [];
      if (isBinary) {
        rxBuffer = Buffer.concat([rxBuffer, data]);
        const [f, rest] = decodeFrames(rxBuffer);
        frames = f;
        rxBuffer = rest;
      } else {
        try {
          frames = [Buffer.from(data.toString())];
        } catch {
          return;
        }
      }
      for (const f of frames) {
        let msg;
        try {
          msg = JSON.parse(f.toString('utf-8'));
        } catch {
          continue;
        }
        if (msg?.type !== 'request') continue;
        const txn = msg.transactionId;
        const urlPath = msg.url || '';

        if (urlPath === '/v1/user/parity') {
          const ok = msg.data?.userKey === 'bWFrZWJsb2NrLXh0b29s';
          if (ok) {
            parityDone = true;
            respond(ws, txn, {});
          } else {
            send(ws, { type: 'response', transactionId: txn, code: 1, data: {}, msg: 'bad userKey' });
            ws.close();
          }
        } else if (urlPath === '/v1/user/ping') {
          respond(ws, txn, {});
        } else if (urlPath === '/v1/device/runtime-infos') {
          const virtual = store.get(device.id);
          respond(ws, txn, {
            curMode: {
              mode: currentMode(),
              subMode: virtual.state === 'working' ? 'CUT' : '',
              taskId: virtual.workSeconds > 0 ? 'sim-task-1' : '',
            },
            cpuTemp: 43200,
          });
        } else if (urlPath === '/v1/processing/progress') {
          respond(ws, txn, { workingTime: store.get(device.id).workSeconds });
        } else if (urlPath === '/v1/processing/state') {
          // 兼容 action 在 params 或 data
          const action = msg.params?.action ?? msg.data?.action;
          const virtual = store.get(device.id);
          // 真实协议语义：pause 仅作业中、resume 仅暂停态、start 仅空闲态启动全新任务、stop 仅作业/暂停
          try {
            if (action === 'resume') {
              store.applyCommand(device.id, 'resume');
            } else if (action === 'start') {
              store.applyCommand(device.id, 'start');
            } else if (action === 'pause') {
              store.applyCommand(device.id, 'pause');
            } else if (action === 'stop') {
              store.applyCommand(device.id, 'stop');
            } else {
              throw new Error(`未知作业动作: ${action}`);
            }
          } catch (e) {
            console.log(`[xTool模拟] ${device.name} 拒绝 ${action}: ${e.message}`);
            // 真实设备对非法指令返回错误码而非静默忽略
            respond(ws, txn, { code: 1, msg: e.message });
            return;
          }
          console.log(`[xTool模拟] ${device.name} 作业控制: ${action} → ${virtual.state}`);
          respond(ws, txn, {});
          pushMode();
        } else if (!parityDone) {
          // 未握手即请求 → 模拟固件断开
          ws.close();
          return;
        } else {
          respond(ws, txn, {}, 'ok');
        }
      }
    });

    ws.on('close', () => {
      sockets.delete(ws);
      console.log(`[xTool模拟] ${device.name} 客户端已断开`);
    });
    ws.on('error', () => sockets.delete(ws));
  });

  // 状态变化时推送模式事件
  const onChange = (virtual) => {
    if (virtual.id !== device.id) return;
    if (!virtual.online) return;
    pushMode();
    if (virtual.state === 'finishing') {
      pushEvent('/work/result', {
        module: 'WORK_RESULT',
        type: 'WORK_FINISHED',
        info: { timeUse: virtual.workSeconds, taskId: 'sim-task-1' },
      });
    }
  };
  store.on('change', onChange);

  return new Promise((resolve, reject) => {
    httpsServer.once('error', reject);
    httpsServer.listen(port, () => {
      console.log(`[xTool模拟] ${device.name} WS-V2(指令通道) 已监听 :${port}`);
      resolve({
        type: 'xtool',
        port,
        close: () => {
          open = false;
          for (const ws of sockets) ws.terminate();
          wss.close();
          httpsServer.close();
        },
        setOffline: (offlineVal) => {
          offline = !!offlineVal;
          for (const ws of [...sockets]) ws.terminate();
        },
      });
    });
  });
}

module.exports = { createXtoolV2 };
