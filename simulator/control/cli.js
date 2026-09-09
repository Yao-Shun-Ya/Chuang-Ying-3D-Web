#!/usr/bin/env node
/**
 * 模拟器 CLI：node control/cli.js <命令>
 * 用法：
 *   node control/cli.js list
 *   node control/cli.js add <bambu|creality|xtool|eufymake> [数量]
 *   node control/cli.js <设备ID> set-state <idle|working|paused|error>
 *   node control/cli.js <设备ID> progress <0-100>
 *   node control/cli.js <设备ID> finish
 *   node control/cli.js <设备ID> report-error <信息>
 *   node control/cli.js <设备ID> offline | online
 *   node control/cli.js remove <设备ID>
 *   node control/cli.js export
 */
const CONTROL_PORT = process.env.CONTROL_PORT || 9910;

async function call(method, path, body) {
  const res = await fetch(`http://127.0.0.1:${CONTROL_PORT}${path}`, {
    method,
    headers: { 'Content-Type': 'application/json' },
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    console.error(`错误: ${data.error || res.status}`);
    process.exit(1);
  }
  return data;
}

async function main() {
  const args = process.argv.slice(2);
  if (args.length === 0) {
    console.log('用法: node control/cli.js list | add <类型> [数量] | remove <设备ID> | export');
    console.log('      node control/cli.js <设备ID> <set-state|progress|finish|report-error|offline|online> [参数]');
    process.exit(1);
  }

  if (args[0] === 'list') {
    const devices = await call('GET', '/api/devices');
    if (!devices.length) {
      console.log('（空态：暂无虚拟设备，用 add 命令或 Web 控制台添加）');
      return;
    }
    for (const d of devices) {
      console.log(
        `${d.id.padEnd(14)} ${String(d.state).padEnd(10)} online=${d.online ? '是' : '否'} progress=${d.progress}% ${d.protocol} ${d.name}`,
      );
    }
    return;
  }

  if (args[0] === 'add') {
    const type = args[1];
    const count = parseInt(args[2], 10) || 1;
    const r = await call('POST', '/api/devices', { type, count });
    for (const d of r.created) console.log(`已添加: ${d.id} ${d.name}（${d.type}）`);
    return;
  }

  if (args[0] === 'remove') {
    const r = await call('DELETE', `/api/devices/${args[1]}`);
    console.log(`已删除: ${r.removed.id} ${r.removed.name}`);
    return;
  }

  if (args[0] === 'export') {
    const cfg = await call('GET', '/api/export-config');
    console.log(JSON.stringify(cfg, null, 2));
    return;
  }

  const [id, action, ...rest] = args;
  switch (action) {
    case 'set-state':
      await call('POST', `/api/devices/${id}/set-state`, { state: rest[0] });
      break;
    case 'progress':
      await call('POST', `/api/devices/${id}/progress`, { value: parseInt(rest[0], 10) });
      break;
    case 'finish':
      await call('POST', `/api/devices/${id}/finish`, {});
      break;
    case 'report-error':
      await call('POST', `/api/devices/${id}/report-error`, { message: rest.join(' ') || '模拟故障' });
      break;
    case 'report-fault':
      await call('POST', `/api/devices/${id}/report-fault`, {
        code: rest[0],
        message: rest.slice(1).join(' ') || undefined,
      });
      break;
    case 'report-consumable':
      await call('POST', `/api/devices/${id}/report-consumable`, { level: parseInt(rest[0], 10) });
      break;
    case 'offline':
    case 'online':
      await call('POST', `/api/devices/${id}/${action}`, {});
      break;
    default:
      console.error(`未知动作: ${action}`);
      process.exit(1);
  }
  console.log(`已执行: ${id} ${action} ${rest.join(' ')}`);
}

main().catch((e) => {
  console.error(`请求失败（模拟器是否已启动？）: ${e.message}`);
  process.exit(1);
});
