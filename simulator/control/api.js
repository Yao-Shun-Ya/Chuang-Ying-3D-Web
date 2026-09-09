/**
 * 模拟器控制台（默认 9910）：动态设备管理 + Web UI
 *
 * 页面:
 * - GET  /                       Web 控制台（添加/删除/控制设备/导出配置）
 * API（前缀 /api，供 Web UI 与外部脚本调用）:
 * - GET    /api/types             可添加的设备类型目录
 * - GET    /api/devices           虚拟设备清单与实时状态
 * - POST   /api/devices           添加设备 {type, model?, name?, count?}
 * - DELETE /api/devices/:id       删除设备
 * - POST   /api/devices/:id/set-state     {"state":"idle|working|paused|error"}
 * - POST   /api/devices/:id/progress      {"value":50}
 * - POST   /api/devices/:id/finish        立即完成作业
 * - POST   /api/devices/:id/report-error  {"message":"..."}
 * - POST   /api/devices/:id/offline       模拟掉线（仅该设备）
 * - POST   /api/devices/:id/online        模拟上线
 * - GET    /api/export-config             导出后端 devices.json 配置
 */
const http = require('http');
const { renderUi } = require('./web-ui');
const { DEVICE_TYPES } = require('../lib/registry');
const { catalogForType } = require('../lib/faults');

function createControlApi(store, registry, port) {
  const server = http.createServer((req, res) => {
    const json = (code, data) => {
      res.writeHead(code, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(data));
    };
    const url = new URL(req.url, 'http://localhost');
    const pathname = url.pathname;

    // Web UI
    if (req.method === 'GET' && (pathname === '/' || pathname === '/index.html')) {
      res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
      res.end(renderUi(DEVICE_TYPES));
      return;
    }

    // ---- API ----
    if (req.method === 'GET' && pathname === '/api/types') {
      json(200, DEVICE_TYPES);
      return;
    }
    if (req.method === 'GET' && pathname === '/api/devices') {
      json(200, registry.list());
      return;
    }
    if (req.method === 'GET' && pathname === '/api/export-config') {
      const host = url.searchParams.get('host') || '127.0.0.1';
      json(200, registry.exportBackendConfig(host));
      return;
    }

    // POST /api/devices（添加）
    if (req.method === 'POST' && pathname === '/api/devices') {
      readBody(req)
        .then((payload) => registry.add(payload.type, payload))
        .then((created) => json(200, { ok: true, created }))
        .catch((e) => json(400, { error: e.message }));
      return;
    }

    // DELETE /api/devices/:id（删除）
    const mDel = /^\/api\/devices\/([^/]+)$/.exec(pathname);
    if (req.method === 'DELETE' && mDel) {
      registry
        .remove(mDel[1])
        .then((def) => json(200, { ok: true, removed: def }))
        .catch((e) => json(400, { error: e.message }));
      return;
    }

    // GET /api/devices/:id/faults（该设备的故障目录与历史）
    const mFaults = /^\/api\/devices\/([^/]+)\/faults$/.exec(pathname);
    if (req.method === 'GET' && mFaults) {
      const f = store.get(mFaults[1]);
      if (!f) {
        json(404, { error: `未知设备: ${mFaults[1]}` });
        return;
      }
      json(200, {
        catalog: catalogForType(f.type),
        history: f.faults || [],
      });
      return;
    }

    // POST /api/devices/:id/:action（状态控制）
    const m = /^\/api\/devices\/([^/]+)\/([a-z-]+)$/.exec(pathname);
    if (req.method === 'POST' && m) {
      const [, id, action] = m;
      const exists = registry.list().find((d) => d.id === id);
      if (!exists) {
        json(404, { error: `未知设备: ${id}` });
        return;
      }
      readBody(req)
        .then((payload) => {
          switch (action) {
            case 'set-state':
              store.setState(id, payload.state);
              break;
            case 'progress':
              store.setProgress(id, payload.value ?? 0);
              break;
            case 'finish':
              store.finish(id);
              break;
            case 'report-error':
              store.reportError(id, payload.message);
              break;
            case 'report-fault':
              // 触发一次硬件故障/告警上报（不影响主状态）
              store.reportFault(id, {
                code: payload.code,
                message: payload.message,
                level: payload.level,
              });
              break;
            case 'report-consumable':
              // 设置耗材余量 %（0 时作业中自动置 error）
              store.setConsumable(id, payload.level ?? 100);
              break;
            case 'offline':
              return registry.setOnline(id, false);
            case 'online':
              return registry.setOnline(id, true);
            default:
              throw new Error(`未知动作: ${action}`);
          }
        })
        .then(() => json(200, { ok: true, device: registry.list().find((d) => d.id === id) }))
        .catch((e) => json(400, { error: e.message }));
      return;
    }

    json(404, { error: 'not found' });
  });

  return new Promise((resolve) => {
    server.listen(port, () => {
      console.log(`[控制台] Web UI 已监听 http://127.0.0.1:${port}/`);
      resolve(server);
    });
  });
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    let body = '';
    req.on('data', (c) => (body += c));
    req.on('end', () => {
      if (!body) return resolve({});
      try {
        resolve(JSON.parse(body));
      } catch {
        reject(new Error('非法 JSON'));
      }
    });
    req.on('error', reject);
  });
}

module.exports = { createControlApi };
