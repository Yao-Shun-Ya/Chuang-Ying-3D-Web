/**
 * 设备注册表：模拟器的"虚拟产线"
 * - 初始为空，通过控制台/API 手动添加设备（可批量）
 * - 每台设备自动分配 id / 协议端口 / 凭据（Bambu serial+accessCode）
 * - 按类型创建对应协议服务（Bambu 共享 MQTT broker，其余独立端口）
 * - 设备清单持久化到 data/devices.json（重启恢复；删除文件即回到空态）
 */
const fs = require('fs');
const path = require('path');
const { createBambuBroker } = require('./bambu-broker');
const { createXtoolV2 } = require('./xtool-v2');
const { createXtoolRest } = require('./xtool-rest');
const { createCrealitySim } = require('./creality');
const { createProbeTarget } = require('./probe-target');

/** 可添加的设备类型目录（与后端 DeviceType 对齐） */
const DEVICE_TYPES = {
  bambu: {
    label: 'Bambu Lab 拓竹（3D 打印机）',
    protocol: 'MQTT/TLS 共享 :8883（serial + accessCode 认证）',
    models: ['X2D', 'H2C', 'P1S', 'P1P', 'A1', 'A1 mini', 'X1 Carbon', 'X1 Pass', 'P1 Handle', 'AMS', 'AMS 2 Pro'],
  },
  creality: {
    label: 'Creality 创想3D（3D 打印机）',
    protocol: 'WebSocket :9999+（JSON-RPC push_status）',
    models: ['K1', 'K1C', 'K1 Max', 'K1 SE', 'Ender-3 V3', 'Ender-3 V3 KE', 'Ender-3 V3 Plus', 'Ender-3 V6', 'Hi', 'Hi Combo', 'K2 Plus'],
  },
  xtool: {
    label: 'xTool（激光设备）',
    protocol: 'WS-V2 :28900+ / REST :8080+',
    models: ['F2 Ultra', 'M2', 'M2 Ultra', 'S1', 'P2', 'P2S', 'F1', 'D1 Pro', 'Laserbox Rotary', 'Faborlize Studio'],
  },
  eufymake: {
    label: 'EufyMake（UV 打印机）',
    protocol: 'TCP 探活 :9900+（无公开 API）',
    models: ['E1'],
  },
};

/** 各类型端口基址（自动向后找空闲） */
const PORT_BASE = { xtoolWs: 28900, xtoolRest: 8080, creality: 9999, probe: 9900, bambuMqtt: 8883 };

class DeviceRegistry {
  constructor(store, dataFile) {
    this.store = store;
    this.dataFile = dataFile;
    this.defs = []; // 唯一事实来源：全部设备定义
    this.servers = new Map(); // id → 协议服务句柄（bambu 除外，走共享 broker）
    this.bambuList = []; // 共享可变数组：broker 实时迭代（动态增删无需重启 broker）
    this.bambuBroker = null;
    this.bambuMqttPort = PORT_BASE.bambuMqtt;
    this.usedPorts = new Set();
  }

  /** 从持久化文件恢复设备 */
  async restore() {
    if (!fs.existsSync(this.dataFile)) {
      console.log('[注册表] 无持久化清单，初始为空（在控制台手动添加设备）');
      return;
    }
    try {
      const list = JSON.parse(fs.readFileSync(this.dataFile, 'utf-8'));
      for (const d of list) {
        await this._spawn(d);
      }
      console.log(`[注册表] 已恢复 ${list.length} 台虚拟设备（${this.dataFile}）`);
    } catch (e) {
      console.warn('[注册表] 持久化清单损坏，从空态启动:', e.message);
    }
  }

  /** 添加设备（支持 count 批量） */
  async add(type, { name, model, count = 1 }) {
    if (!DEVICE_TYPES[type]) throw new Error(`未知设备类型: ${type}（可选: ${Object.keys(DEVICE_TYPES).join('/')}）`);
    if (count < 1 || count > 20) throw new Error('数量需在 1~20 之间');
    const created = [];
    for (let i = 0; i < count; i++) {
      const def = this._createDefinition(type, { name, model });
      await this._spawn(def);
      created.push(def);
    }
    this._save();
    return created;
  }

  /** 删除设备（关闭其协议服务） */
  async remove(id) {
    const idx = this.defs.findIndex((d) => d.id === id);
    if (idx < 0) throw new Error(`未知设备: ${id}`);
    const def = this.defs[idx];

    if (def.type === 'bambu') {
      const li = this.bambuList.findIndex((d) => d.id === id);
      if (li >= 0) this.bambuList.splice(li, 1);
      this.store.devices.delete(id);
      // 最后一台 Bambu 移除 → 关闭共享 broker
      if (this.bambuList.length === 0 && this.bambuBroker) {
        this.bambuBroker.close();
        this.bambuBroker = null;
        this.usedPorts.delete(this.bambuMqttPort);
        console.log('[Bambu模拟] 已无虚拟打印机，MQTT broker 关闭');
      }
    } else {
      const server = this.servers.get(id);
      if (server) {
        await server.close();
        this.servers.delete(id);
      }
      this.store.devices.delete(id);
      for (const p of this._portsOf(def)) this.usedPorts.delete(p);
    }
    this.defs.splice(idx, 1);
    this._save();
    return def;
  }

  /** 全部设备（定义 + 实时状态） */
  list() {
    return this.defs.map((d) => {
      const s = this.store.get(d.id) || {};
      return {
        ...d,
        state: s.state || 'idle',
        online: s.online ?? true,
        progress: s.progress ?? 0,
        ports: this._portsOf(d),
        protocol: this._protocolOf(d),
      };
    });
  }

  /** 导出后端 server/config/devices.json 内容（host 可指定） */
  exportBackendConfig(host = '127.0.0.1') {
    return {
      laser: { pricePerMinute: 0.5 },
      devices: this.defs.map((d) => {
        const cfg = { id: d.id, name: d.name, type: d.type, category: this._categoryOf(d.type), model: d.model, host };
        if (d.type === 'bambu') {
          cfg.serial = d.serial;
          cfg.accessCode = d.accessCode;
        } else if (d.type === 'xtool') {
          cfg.wsPort = d.wsPort;
          cfg.restPort = d.restPort;
        } else if (d.type === 'creality') {
          cfg.wsPort = d.wsPort;
        } else if (d.type === 'eufymake') {
          cfg.probePort = d.probePort;
        }
        return cfg;
      }),
    };
  }

  /** 模拟单台设备掉线/上线（只影响目标设备自身的协议服务） */
  async setOnline(id, online) {
    const def = this.defs.find((d) => d.id === id);
    if (!def) throw new Error(`未知设备: ${id}`);
    this.store.setOnline(id, online);
    if (def.type !== 'bambu') {
      const server = this.servers.get(id);
      if (server && server.setOffline) await server.setOffline(!online);
      // xTool 含双通道（WS-V2 + REST V1 回退）：必须一并关闭 REST，
      // 否则后端 WS 掉线重连会回退到仍在监听的 REST 而误判在线
      if (def.type === 'xtool') {
        const rest = this.servers.get(id + ':rest');
        if (rest && rest.setOffline) await rest.setOffline(!online);
      }
    }
    // bambu：单台掉线由 store.online 控制（周期上报/订阅回推均跳过该 serial）
  }

  /** 关闭全部（进程退出） */
  async closeAll() {
    for (const [id, server] of this.servers) {
      try {
        await server.close();
      } catch {
        /* 忽略 */
      }
    }
    this.servers.clear();
    if (this.bambuBroker) {
      this.bambuBroker.close();
      this.bambuBroker = null;
    }
  }

  // ============ 内部 ============

  _createDefinition(type, { name, model }) {
    const n = this._nextSeq(type);
    const brand = DEVICE_TYPES[type].label.split('（')[0];
    const def = {
      id: `${type}-${String(n).padStart(2, '0')}`,
      type,
      name: name || `${brand} ${model || DEVICE_TYPES[type].models[0]} · 虚拟${String(n).padStart(2, '0')}`,
      model: model || DEVICE_TYPES[type].models[0],
    };
    if (type === 'bambu') {
      def.serial = `01S00C${String(100000000 + Math.floor(Math.random() * 899999999))}`;
      def.accessCode = String(Math.floor(10000000 + Math.random() * 89999999));
    } else if (type === 'xtool') {
      def.wsPort = this._allocPort('xtoolWs');
      def.restPort = this._allocPort('xtoolRest');
    } else if (type === 'creality') {
      def.wsPort = this._allocPort('creality');
    } else if (type === 'eufymake') {
      def.probePort = this._allocPort('probe');
    }
    return def;
  }

  async _spawn(def) {
    this.defs.push(def);
    this.store.register(def);
    if (def.type === 'bambu') {
      this.bambuList.push(def);
      if (!this.bambuBroker) {
        this.bambuBroker = await createBambuBroker(this.store, this.bambuList, this.bambuMqttPort);
        this.usedPorts.add(this.bambuMqttPort);
      }
    } else if (def.type === 'xtool') {
      this.servers.set(def.id, await createXtoolV2(this.store, def, def.wsPort));
      this.servers.set(def.id + ':rest', await createXtoolRest(this.store, def, def.restPort));
    } else if (def.type === 'creality') {
      this.servers.set(def.id, await createCrealitySim(this.store, def, def.wsPort));
    } else if (def.type === 'eufymake') {
      this.servers.set(def.id, await createProbeTarget(def, def.probePort));
    }
    for (const p of this._portsOf(def)) this.usedPorts.add(p);
  }

  _nextSeq(type) {
    let n = 1;
    const ids = new Set(this.defs.map((d) => d.id));
    while (ids.has(`${type}-${String(n).padStart(2, '0')}`)) n += 1;
    return n;
  }

  _allocPort(baseKey) {
    let p = PORT_BASE[baseKey];
    while (this.usedPorts.has(p)) p += 1;
    return p;
  }

  _portsOf(d) {
    if (d.type === 'bambu') return [this.bambuMqttPort];
    if (d.type === 'xtool') return [d.wsPort, d.restPort];
    if (d.type === 'creality') return [d.wsPort];
    if (d.type === 'eufymake') return [d.probePort];
    return [];
  }

  _protocolOf(d) {
    if (d.type === 'bambu') return `MQTT/TLS :${this.bambuMqttPort}（serial=${d.serial}）`;
    if (d.type === 'xtool') return `WSS :${d.wsPort} / REST :${d.restPort}`;
    if (d.type === 'creality') return `WS :${d.wsPort}`;
    if (d.type === 'eufymake') return `TCP :${d.probePort}`;
    return '';
  }

  _categoryOf(type) {
    return type === 'bambu' || type === 'creality' ? 'fdm' : type === 'xtool' ? 'laser' : 'uv';
  }

  _save() {
    fs.mkdirSync(path.dirname(this.dataFile), { recursive: true });
    fs.writeFileSync(this.dataFile, JSON.stringify(this.defs, null, 2));
  }
}

module.exports = { DeviceRegistry, DEVICE_TYPES };
