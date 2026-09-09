/**
 * 虚拟设备状态中心：所有模拟设备的状态机与周期推进
 * - 状态：idle | working | paused | error | maintenance | finishing
 * - 状态流转受真实设备行为约束（guard）：
 *     idle        → working（启动新任务）
 *     working     → paused（暂停） | idle（停止/完成） | error（故障）
 *     paused      → working（恢复，仅暂停态可恢复） | idle（停止） | error
 *     error       → idle（复位）
 * - 周期推进：每 5s working 的 Bambu/Creality 进度 +2%，到 100% 转 finishing（10s 后回 idle）
 */
const EventEmitter = require('events');

/** 状态机守卫：非法流转直接抛错（与真实设备一致，禁止"恢复立即执行作业"等随意行为） */
const CAN = {
  idle: ['working', 'error', 'maintenance'],
  working: ['paused', 'idle', 'error', 'maintenance'],
  paused: ['working', 'idle', 'error', 'maintenance'],
  error: ['idle', 'maintenance'],
  maintenance: ['idle'],
  finishing: ['idle'],
};

class DeviceStateStore extends EventEmitter {
  constructor() {
    super();
    this.devices = new Map();
    this.timer = null;
  }

  register(info) {
    this.devices.set(info.id, {
      id: info.id,
      type: info.type,
      name: info.name || info.id,
      model: info.model,
      serial: info.serial,
      state: 'idle', // idle|working|paused|error|maintenance|finishing
      progress: 0, // Bambu/Creality 打印进度 %
      workSeconds: 0, // xTool 已作业秒数
      online: true,
      error: null,
      errorCode: null,
      consumeLevel: 100, // 耗材余量 %
      faults: [], // 硬件故障/告警事件数组
      finishedAt: 0,
      ledOn: false, // 灯光开关（可经协议命令远程开/关，随上报回流）
    });
  }

  get(id) {
    return this.devices.get(id);
  }

  list() {
    return [...this.devices.values()];
  }

  /** 带守卫的状态流转（模拟真实设备对指令的响应） */
  applyCommand(id, action, opts = {}) {
    const d = this.devices.get(id);
    if (!d) throw new Error(`未知设备: ${id}`);
    const from = d.state;
    // 作业控制命令需要设备在线
    if (!d.online) throw new Error('设备离线，无法执行指令');
    let to = null;
    switch (action) {
      case 'start': // 启动新任务（仅空闲态）
        to = 'working';
        break;
      case 'pause':
        to = 'paused';
        break;
      case 'resume': // 恢复（仅暂停态）
        to = 'working';
        break;
      case 'stop':
        to = 'idle';
        break;
      case 'finish':
        to = 'finishing';
        break;
      case 'error':
        to = 'error';
        break;
      case 'maintenance':
        to = 'maintenance';
        break;
      case 'reset':
        to = 'idle';
        break;
      default:
        throw new Error(`未知指令: ${action}`);
    }
    // 语义守卫：start/resume 不能由任意态触发，和真实设备一致
    if (action === 'start' && from !== 'idle') {
      throw new Error(`设备当前 ${from}，无法启动新任务（真实设备仅空闲态可启动）`);
    }
    if (action === 'pause' && from !== 'working') {
      throw new Error(`设备当前 ${from}，无法暂停（仅作业中可暂停）`);
    }
    if (action === 'resume' && from !== 'paused') {
      throw new Error(`设备当前 ${from}，无法恢复（仅暂停态可恢复）`);
    }
    if (action === 'stop' && from !== 'working' && from !== 'paused') {
      throw new Error(`设备当前 ${from}，无需停止`);
    }
    if (!CAN[from].includes(to)) {
      throw new Error(`非法状态流转: ${from} → ${to}`);
    }
    return this._transition(d, to, opts);
  }

  /** 直接置态（控制台强制，绕过守卫，便于测试搭建场景） */
  setState(id, state) {
    const d = this.devices.get(id);
    if (!d) throw new Error(`未知设备: ${id}`);
    if (d.state === state) return d;
    return this._transition(d, state, {});
  }

  _transition(d, state) {
    d.state = state;
    if (state === 'idle' || state === 'finishing' || state === 'maintenance') {
      if (state === 'idle' || state === 'maintenance') {
        d.error = null;
        d.errorCode = null;
      }
      if (state === 'idle') {
        d.progress = 0;
        d.workSeconds = 0;
        d.faults = [];
      }
    }
    if (state === 'working' && d.progress >= 100) d.progress = 0;
    this.emit('change', d);
    return d;
  }

  setProgress(id, value) {
    const d = this.devices.get(id);
    if (!d) throw new Error(`未知设备: ${id}`);
    d.progress = Math.max(0, Math.min(100, value));
    if (d.progress >= 100) {
      d.state = 'finishing';
      d.finishedAt = Date.now();
    } else {
      d.state = 'working';
    }
    this.emit('change', d);
    return d;
  }

  finish(id) {
    const d = this.devices.get(id);
    if (!d) throw new Error(`未知设备: ${id}`);
    if (d.state !== 'working') throw new Error(`设备当前 ${d.state}，无法完成作业`);
    d.progress = 100;
    d.state = 'finishing';
    d.finishedAt = Date.now();
    this.emit('change', d);
    this.emit('work-finished', d);
    return d;
  }

  reportError(id, message) {
    const d = this.devices.get(id);
    if (!d) throw new Error(`未知设备: ${id}`);
    d.state = 'error';
    d.error = message || '模拟故障';
    d.errorCode = 'E_SIM_FAULT';
    this.emit('change', d);
    return d;
  }

  /** 上报硬件故障/告警（不影响主状态，追加到 faults） */
  reportFault(id, { code, message, level = 'warn' }) {
    const d = this.devices.get(id);
    if (!d) throw new Error(`未知设备: ${id}`);
    const fault = { code: code || 'E_SIM', message: message || '告警', level, at: Date.now() };
    d.faults.push(fault);
    if (d.faults.length > 20) d.faults.shift();
    this.emit('fault', d, fault);
    this.emit('change', d);
    return fault;
  }

  /** 设置耗材余量 %（耗材耗尽时触发 error） */
  setConsumable(id, level) {
    const d = this.devices.get(id);
    if (!d) throw new Error(`未知设备: ${id}`);
    d.consumeLevel = Math.max(0, Math.min(100, level));
    if (d.consumeLevel === 0 && d.state === 'working') {
      d.state = 'error';
      d.error = '耗材耗尽';
      d.errorCode = 'E_MATERIAL_RUNOUT';
      this.emit('change', d);
      this.emit('work-failed', { device: d, reason: '耗材耗尽' });
    }
    this.emit('change', d);
    return d;
  }

  setOnline(id, online) {
    const d = this.devices.get(id);
    if (!d) throw new Error(`未知设备: ${id}`);
    d.online = online;
    this.emit('change', d);
    return d;
  }

  /** 开关灯光（可经协议命令远程控制，随上报回流） */
  setLed(id, on) {
    const d = this.devices.get(id);
    if (!d) throw new Error(`未知设备: ${id}`);
    d.ledOn = !!on;
    this.emit('change', d);
    return d;
  }

  /** 周期推进虚拟状态机 */
  startTick() {
    if (this.timer) return;
    this.timer = setInterval(() => {
      for (const d of this.devices.values()) {
        if (!d.online) continue;
        if (d.type === 'bambu' || d.type === 'creality') {
          if (d.state === 'working') {
            d.progress += 2;
            if (d.progress >= 100) {
              d.progress = 100;
              d.state = 'finishing';
              d.finishedAt = Date.now();
              this.emit('work-finished', d);
            }
            this.emit('change', d);
          } else if (d.state === 'finishing' && Date.now() - d.finishedAt > 10_000) {
            d.state = 'idle';
            d.progress = 0;
            this.emit('change', d);
          }
        } else if (d.type === 'xtool' && d.state === 'working') {
          d.workSeconds += 5;
          this.emit('change', d);
        }
      }
    }, 5000);
  }

  stopTick() {
    if (this.timer) clearInterval(this.timer);
    this.timer = null;
  }
}

module.exports = { DeviceStateStore };