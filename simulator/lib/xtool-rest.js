/**
 * 虚拟 xTool REST V1 接口（旧固件回退路径，默认 8080）
 * - GET /device/runningStatus | /cnc/status | /processing/progress
 * - GET /processing/pause | resume | stop
 */
const http = require('http');

const MODE_OF = {
  idle: 'P_IDLE',
  working: 'P_WORKING',
  paused: 'P_PAUSE',
  error: 'P_ERROR',
  finishing: 'P_FINISH',
};

function createXtoolRest(store, device, port) {
  let server = null;
  let online = true;

  const check = (req, res) => {
    const virtual = store.get(device.id);
    const json = (data) => {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ code: 0, data, msg: 'ok' }));
    };
    const url = req.url.split('?')[0];

    if (url === '/device/runningStatus') {
      json({
        curMode: {
          mode: MODE_OF[virtual.state] || 'P_IDLE',
          subMode: virtual.state === 'working' ? 'CUT' : '',
          taskId: virtual.workSeconds > 0 ? 'sim-task-1' : '',
        },
      });
    } else if (url === '/cnc/status') {
      json({ mode: MODE_OF[virtual.state] || 'P_IDLE', subMode: '' });
    } else if (url === '/processing/progress') {
      json({ workingTime: virtual.workSeconds });
    } else if (url === '/processing/pause') {
      virtual.state = 'paused';
      json({});
    } else if (url === '/processing/resume') {
      virtual.state = 'working';
      json({});
    } else if (url === '/processing/stop') {
      virtual.state = 'idle';
      virtual.workSeconds = 0;
      json({});
    } else {
      res.writeHead(404);
      res.end(JSON.stringify({ code: 404, msg: 'not found' }));
    }
  };

  const listen = () =>
    new Promise((resolve, reject) => {
      server = http.createServer((req, res) => {
        // 设备离线：REST 一并拒绝（否则后端 WS 掉线回退 REST 会误判在线）
        if (!online) {
          res.writeHead(503);
          res.end(JSON.stringify({ code: 503, msg: 'device offline' }));
          return;
        }
        check(req, res);
      });
      server.once('error', reject);
      server.listen(port, () => {
        console.log(`[xTool模拟] ${device.name} REST V1 已监听 :${port}`);
        resolve();
      });
    });

  return listen().then(() => ({
    type: 'xtool-rest',
    port,
    close: () => server && server.close(),
    setOffline: async (offline) => {
      if (offline && online) {
        online = false;
        if (server) {
          server.close();
          server = null;
        }
        console.log(`[xTool模拟] ${device.name} 已离线（REST 服务关闭）`);
      } else if (!offline && !online) {
        online = true;
        await listen();
        console.log(`[xTool模拟] ${device.name} 已上线`);
      }
    },
  }));
}

module.exports = { createXtoolRest };
