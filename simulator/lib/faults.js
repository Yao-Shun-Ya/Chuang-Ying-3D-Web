/**
 * 异常场景仿真模型：预置真实设备可能发生的各类异常/事件，
 * 供控制台/API 触发，报文格式对齐各型号事件上报规范。
 *
 * 场景分类：
 * - 任务/作业场景：暂停、恢复、停止、完成
 * - 设备场景：离线、重连
 * - 耗材场景：耗材耗尽、料盘更换
 * - 硬件故障：加热故障、断料检测、堵料、门未关、限位异常
 * - 通信异常：断连、握手失败
 */

/** 预置故障码库（按类型给出常见故障码 + 中文说明） */
const FAULT_CATALOG = {
  // 3D 打印机（Bambu/Creality 通用硬件故障语义）
  printer: [
    { code: 'E_NOZZLE_TEMP', message: '喷嘴温度异常', level: 'error' },
    { code: 'E_BED_TEMP', message: '热床温度异常', level: 'error' },
    { code: 'E_FILAMENT_RUNOUT', message: '耗材耗尽', level: 'error' },
    { code: 'E_JAM', message: '堵料', level: 'error' },
    { code: 'E_DOOR_OPEN', message: '门未关', level: 'warn' },
    { code: 'E_LIMIT', message: '限位异常', level: 'error' },
    { code: 'E_HEAT_FAIL', message: '加热组件故障', level: 'error' },
  ],
  // 激光设备（xTool）
  laser: [
    { code: 'E_LID_OPEN', message: '舱门开启', level: 'warn' },
    { code: 'E_TEMP_HIGH', message: '模组温度过高', level: 'warn' },
    { code: 'E_EMERGENCY', message: '急停触发', level: 'error' },
    { code: 'E_FOCUS', message: '对焦失败', level: 'error' },
    { code: 'E_MOTOR', message: '电机异常', level: 'error' },
  ],
};

/**
 * 返回某类型的预置故障目录（供控制台下拉选择）
 */
function catalogForType(type) {
  if (type === 'bambu' || type === 'creality') return FAULT_CATALOG.printer;
  if (type === 'xtool') return FAULT_CATALOG.laser;
  return FAULT_CATALOG.printer;
}

/**
 * 根据设备类型触发一次硬件故障上报
 * @param {DeviceStateStore} store
 * @param {object} device 设备状态对象
 * @param {string} [scenario] 预置场景码，缺省取第一个
 */
function triggerFault(store, device, scenario) {
  const cat = catalogForType(device.type);
  const preset = cat.find((c) => c.code === scenario) || cat[0];
  const fault = store.reportFault(device.id, {
    code: preset.code,
    message: preset.message,
    level: preset.level,
  });
  // 硬件故障不影响作业状态（由上层决定是否停机），这里仅广播告警
  return fault;
}

/**
 * 触发耗材耗尽（置 0 并在作业中自动置 error）
 */
function triggerMaterialRunout(store, device) {
  if (device.type === 'bambu' || device.type === 'creality') {
    store.setConsumable(device.id, 0);
  }
  return store.get(device.id);
}

/**
 * 触发通信异常：模拟握手失败 → 客户端被断开
 * 直接在协议层实现（返回该设备的协议 server 的 simulateCommError）
 */
function triggerCommError(server) {
  if (server && typeof server.simulateCommError === 'function') {
    return server.simulateCommError();
  }
  throw new Error('该协议服务不支持通信异常仿真');
}

module.exports = { FAULT_CATALOG, catalogForType, triggerFault, triggerMaterialRunout, triggerCommError };