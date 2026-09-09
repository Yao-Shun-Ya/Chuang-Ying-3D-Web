#!/usr/bin/env node
/**
 * 创影3D 设备模拟器（独立软件，不与 Web 后台耦合）
 * - 启动后默认无任何虚拟设备，通过 Web 控制台（或 API/CLI）手动添加
 * - 支持 Bambu / Creality / xTool / EufyMake 四类机型模拟，可批量添加同类型多台
 * - 完整模拟各设备对外 API 与状态报文，用于无真实硬件时调试后端对接逻辑
 * - 设备清单持久化到 data/devices.json（删除该文件即回到空态）
 */
const path = require('path');
const { DeviceStateStore } = require('./lib/state');
const { DeviceRegistry, DEVICE_TYPES } = require('./lib/registry');
const { createControlApi } = require('./control/api');

async function main() {
  const controlPort = Number(process.env.CONTROL_PORT) || 9910;
  const dataFile = path.join(__dirname, 'data', 'devices.json');

  const store = new DeviceStateStore();
  const registry = new DeviceRegistry(store, dataFile);

  store.startTick();
  await registry.restore();
  await createControlApi(store, registry, controlPort);

  console.log('\n========== 创影3D 设备模拟器已启动 ==========');
  console.log(`控制台:     http://127.0.0.1:${controlPort}/`);
  console.log(`虚拟设备数: ${registry.list().length} 台`);
  console.log('支持类型:   ' + Object.values(DEVICE_TYPES).map((t) => t.label).join(' / '));
  console.log(`持久化:     ${dataFile}（删除文件即回到空态）`);
  console.log('CLI 用法:   node control/cli.js list | <设备ID> set-state working | <设备ID> finish');
  console.log('===========================================\n');
}

main().catch((e) => {
  console.error('模拟器启动失败:', e);
  process.exit(1);
});
