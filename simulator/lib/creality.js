/**
 * 虚拟 Creality 打印机（K1/K1C/K1 Max/K1 SE/Hi/Ender-3 V3 家族）
 * 协议：WebSocket 明文 ws://host:port（默认 9999），JSON-RPC 风格报文
 * - 客户端发 {"jsonrpc":"2.0","method":"push_status","params":{...},"id":N} 订阅
 * - 周期推送 {"jsonrpc":"2.0","method":"push_status","params":{状态对象}}
 * - 命令：pause_print / resume_print / stop_print / set_led / get_push_status
 */
const http = require('http');
const { WebSocketServer } = require('ws');

const PRINT_STATE = {
  idle: 'IDLE',
  working: 'PRINTING',
  paused: 'PAUSED',
  error: 'ERROR',
  finishing: 'FINISH',
};

function buildStatus(device, tick) {
  const isWorking = device.state === 'working' || device.state === 'finishing';
  const wiggle = (base, amp) => +(base + Math.sin(tick / 3 + base) * amp).toFixed(1);
  return {
    print_state: PRINT_STATE[device.state] || 'IDLE',
    print_progress: device.progress,
    print_remain_time: Math.max(0, Math.round((100 - device.progress) * 0.6)),
    nozzle_temp: isWorking ? wiggle(219.5, 1.5) : wiggle(26, 0.5),
    nozzle_target_temp: isWorking ? 220 : 0,
    bed_temp: isWorking ? wiggle(59.8, 0.3) : wiggle(24, 0.2),
    bed_target_temp: isWorking ? 60 : 0,
    layer_num: Math.round(device.progress * 2.5),
    total_layer_num: 250,
    gcode_file: isWorking ? 'sim_job.gcode' : '',
    fan_speed: isWorking ? 80 : 0,
    // 真实 Creality set_led 以亮度控制灯光，状态经 led_brightness 上报回流
    led_brightness: device.ledOn ? 100 : 0,
  };
}

function createCrealitySim(store, device, port) {
  const httpServer = http.createServer((req, res) => {
    // 基础 HTTP 探活
    if (req.url === '/' || req.url === '/status') {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(buildStatus(store.get(device.id), tick)));
      return;
    }
    res.writeHead(404);
    res.end();
  });

  const wss = new WebSocketServer({ server: httpServer });
  let tick = 0;
  let publishing = true;
  let offline = false; // 设备掉线：拒绝新建连接，使后端重连失败、离线态保持
  const virtual = () => store.get(device.id);

  // 心跳/状态推送定时器：有客户端订阅时每 5s 推送
  let subscribers = new Set();
  const pushTimer = setInterval(() => {
    if (!publishing || subscribers.size === 0) return;
    tick += 1;
    const payload = JSON.stringify({
      jsonrpc: '2.0',
      method: 'push_status',
      params: buildStatus(virtual(), tick),
    });
    for (const ws of subscribers) {
      if (ws.readyState === ws.OPEN) ws.send(payload);
    }
  }, 5000);

  wss.on('connection', (ws) => {
    // 设备掉线：直接断开新连接（与真实设备不可达一致），保证后端保持离线
    if (offline) {
      ws.terminate();
      return;
    }
    console.log(`[Creality模拟] ${device.name} WS 客户端已连接 :${port}`);
    // 连接即推送一帧全量状态
    ws.send(
      JSON.stringify({
        jsonrpc: '2.0',
        method: 'push_status',
        params: buildStatus(virtual(), tick),
      }),
    );

    ws.on('message', (raw) => {
      let msg;
      try {
        msg = JSON.parse(raw.toString());
      } catch {
        return;
      }
      const method = msg.method || '';
      const id = msg.id;

      const reply = (result) => {
        if (id === undefined) return;
        ws.send(JSON.stringify({ jsonrpc: '2.0', id, result }));
      };

      switch (method) {
        case 'push_status':
        case 'get_push_status':
          subscribers.add(ws);
          reply(buildStatus(virtual(), tick));
          break;
        case 'pause_print':
          try {
            store.applyCommand(device.id, 'pause');
            reply({ ok: true });
          } catch (e) {
            reply({ ok: false, error: e.message });
          }
          break;
        case 'resume_print':
          // 真实语义：仅暂停态可恢复（不能由空闲态直接启动作业）
          try {
            store.applyCommand(device.id, 'resume');
            reply({ ok: true });
          } catch (e) {
            reply({ ok: false, error: e.message });
          }
          break;
        case 'stop_print':
          try {
            store.applyCommand(device.id, 'stop');
            reply({ ok: true });
          } catch (e) {
            reply({ ok: false, error: e.message });
          }
          break;
        case 'set_led':
          // 真实 Creality：parms.brightness 控制灯光，结果在 result 回流并重推状态
          try {
            const brightness = Number(msg?.params?.brightness ?? msg?.params?.led_brightness);
            store.setLed(device.id, brightness > 0);
            reply({ ok: true, brightness: brightness > 0 ? 100 : 0 });
            // 立即可订阅者重推一帧最新状态（含 led_brightness）
            const fresh = JSON.stringify({
              jsonrpc: '2.0',
              method: 'push_status',
              params: buildStatus(virtual(), tick),
            });
            for (const ws of subscribers) {
              if (ws.readyState === ws.OPEN && ws !== this) ws.send(fresh);
            }
            console.log(`[Creality模拟] ${device.name} 灯光 → ${brightness > 0 ? '开' : '关'}`);
          } catch (e) {
            reply({ ok: false, error: e.message });
          }
          break;
        case 'get_printer_info':
          reply({ name: device.name, model: device.model || 'K1', firmware: 'sim-1.0.0' });
          break;
        default:
          if (id !== undefined) {
            ws.send(
              JSON.stringify({
                jsonrpc: '2.0',
                id,
                error: { code: -32601, message: `method not found: ${method}` },
              }),
            );
          }
      }
    });

    ws.on('close', () => subscribers.delete(ws));
    ws.on('error', () => subscribers.delete(ws));
  });

  return new Promise((resolve, reject) => {
    httpServer.once('error', reject);
    httpServer.listen(port, () => {
      console.log(`[Creality模拟] ${device.name} WS/HTTP 已监听 :${port}`);
      resolve({
        type: 'creality',
        port,
        close: () => {
          publishing = false;
          clearInterval(pushTimer);
          for (const ws of subscribers) ws.terminate();
          subscribers.clear();
          wss.close();
          httpServer.close();
        },
        setOffline: (offlineVal) => {
          offline = !!offlineVal;
          publishing = !offlineVal;
          if (offlineVal) {
            for (const ws of subscribers) ws.terminate();
            subscribers.clear();
          }
        },
      });
    });
  });
}

module.exports = { createCrealitySim };
