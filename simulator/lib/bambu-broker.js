/**
 * 虚拟 Bambu 打印机：aedes MQTT broker over TLS（8883）
 * - 按 topic device/<序列号>/report 上报状态（5s 周期 + 订阅即推）
 * - 响应 device/<序列号>/request：pushall / pause / resume / stop / gcode_file_print
 * - 认证：用户名 bblp + 任一已注册设备的访问码
 */
const aedes = require('aedes');
const net = require('net');
const tls = require('tls');
const { generateCert } = require('./certs');

const GCODE_STATE = {
  working: 'RUNNING',
  paused: 'PAUSE',
  idle: 'IDLE',
  error: 'FAILED',
  finishing: 'FINISH',
};

/** 模拟 AMS 2 Pro 料槽（数据天然随打印机上报） */
const AMS_TRAYS = [
  { id: '0', tray_type: 'PLA', tray_color: 'FF5252FF', remain: 87 },
  { id: '1', tray_type: 'PLA', tray_color: 'FFFFFFFF', remain: 62 },
  { id: '2', tray_type: 'PETG', tray_color: '2196F3FF', remain: 45 },
  { id: '3', tray_type: 'PLA', tray_color: '4CAF50FF', remain: 0 },
];

function buildReport(device, tickCount) {
  const isWorking = device.state === 'working' || device.state === 'finishing';
  const wiggle = (base, amp) => +(base + Math.sin(tickCount / 3 + base) * amp).toFixed(1);
  return {
    print: {
      gcode_state: GCODE_STATE[device.state] || 'IDLE',
      mc_percent: device.progress,
      mc_remaining_layers: Math.round((100 - device.progress) * 2.5),
      layer_num: Math.round(device.progress * 2.5),
      total_layer_num: 250,
      mc_remaining_time: Math.max(0, Math.round((100 - device.progress) * 0.6)),
      nozzle_temper: isWorking ? wiggle(219.5, 1.5) : wiggle(27, 0.5),
      nozzle_target_temper: isWorking ? 220 : 0,
      bed_temper: isWorking ? wiggle(54.8, 0.3) : wiggle(24, 0.2),
      bed_target_temper: isWorking ? 55 : 0,
      chamber_temper: isWorking ? wiggle(38.1, 0.4) : wiggle(28, 0.2),
      subtask_name: isWorking ? 'remote_sim_job.gcode.3mf' : '',
      spd_lvl: 3,
    },
    ams: {
      ams: [
        {
          id: '0',
          humidity: '3',
          temp: '22.1',
          tray: AMS_TRAYS,
        },
      ],
      ams_exist_bits: '1',
      tray_exist_bits: 'f',
    },
    hms: device.state === 'error' ? [{ code: 30200 }] : [],
    net: { info: { ssid: 'SIM-WIFI', ip: '127.0.0.1' } },
    // 真实 Bambu 上报：system 节点含灯光状态 leds_on（chamber_light 等 ledctrl 控制结果回流于此）
    system: {
      board_temp: isWorking ? 56 : 28,
      camera_recording: false,
      leds_enable: true,
      leds_on: !!device.ledOn,
      light_type: device.ledOn ? 'chamber_light' : '',
    },
  };
}

function createBambuBroker(store, devices, port) {
  const broker = aedes();
  const { key, cert } = generateCert();
  const server = tls.createServer({ key, cert }, broker.handle);
  const bambuDevices = devices; // type=bambu 的虚拟设备清单
  let tick = 0;
  let publishing = true;

  broker.authenticate = (client, username, password, done) => {
    const ok = username === 'bblp' && bambuDevices.some((d) => d.accessCode === String(password || ''));
    if (!ok) {
      console.log(`[Bambu模拟] 拒绝连接（账号或访问码错误）`);
    }
    done(null, ok);
  };

  // 客户端订阅 → 立即推送该设备全量状态
  broker.on('client', (client) => {
    console.log(`[Bambu模拟] 客户端已连接: ${client.id}`);
  });
  broker.on('clientDisconnect', (client) => {
    console.log(`[Bambu模拟] 客户端已断开: ${client.id}`);
  });
  broker.on('subscribe', (subscriptions, client) => {
    for (const sub of subscriptions) {
      const m = /^device\/([^/]+)\/report$/.exec(sub.topic);
      if (!m) continue;
      const dev = bambuDevices.find((d) => d.serial === m[1]);
      if (!dev) continue;
      // 设备离线（共享 broker 下单台掉线仅"停止上报"）：订阅也不再回推全量，
      // 否则后端重连即拿到快照→误判在线，与周期上报的跳过逻辑保持一致
      const virtual = store.get(dev.id);
      if (!virtual || !virtual.online) continue;
      broker.publish(
        { topic: sub.topic, payload: JSON.stringify(buildReport(virtual, tick)) },
        () => {},
      );
    }
  });

  // 处理下发请求
  broker.on('publish', (packet, client) => {
    if (!client) return; // broker 自身发布的忽略
    const m = /^device\/([^/]+)\/request$/.exec(packet.topic);
    if (!m) return;
    const dev = bambuDevices.find((d) => d.serial === m[1]);
    if (!dev) return;
    let req;
    try {
      req = JSON.parse(packet.payload.toString());
    } catch {
      return;
    }
    const virtual = store.get(dev.id);
    // 设备离线：真实打印机不可达，忽略一切请求（不再回推状态，避免后端重连被"复活"）
    if (!virtual || !virtual.online) return;
    let changed = false;
    if (req?.pushing?.command === 'pushall') changed = true;
    try {
      if (req?.print?.command === 'pause') {
        store.applyCommand(dev.id, 'pause');
        changed = true;
      } else if (req?.print?.command === 'resume') {
        // 真实语义：仅暂停态可恢复（不能由空闲态直接启动作业）
        store.applyCommand(dev.id, 'resume');
        changed = true;
      } else if (req?.print?.command === 'stop') {
        store.applyCommand(dev.id, 'stop');
        changed = true;
      } else if (req?.print?.command === 'gcode_file_print') {
        store.applyCommand(dev.id, 'start');
        virtual.workSeconds = 0;
        changed = true;
        console.log(`[Bambu模拟] ${dev.name} 收到远程启动: ${req.print.param}`);
      } else if (req?.system?.command === 'ledctrl') {
        // 真实 Bambu ledctrl：led_node + led_on 控制灯光，结果经 system.leds_on 上报回流
        const on = req.system.led_on === true || req.system.led_on === 1;
        store.setLed(dev.id, on);
        changed = true;
        console.log(`[Bambu模拟] ${dev.name} 灯光 → ${on ? '开' : '关'}`);
      }
    } catch (e) {
      console.log(`[Bambu模拟] ${dev.name} 拒绝指令: ${e.message}`);
    }
    if (changed) {
      broker.publish(
        { topic: `device/${dev.serial}/report`, payload: JSON.stringify(buildReport(virtual, tick)) },
        () => {},
      );
    }
  });

  // 周期上报
  const pubTimer = setInterval(() => {
    if (!publishing) return;
    tick += 1;
    for (const dev of bambuDevices) {
      const virtual = store.get(dev.id);
      if (!virtual || !virtual.online) continue;
      broker.publish(
        { topic: `device/${dev.serial}/report`, payload: JSON.stringify(buildReport(virtual, tick)) },
        () => {},
      );
    }
  }, 5000);

  return new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(port, () => {
      console.log(`[Bambu模拟] MQTT/TLS broker 已监听 :${port}（${bambuDevices.length} 台虚拟打印机）`);
      resolve({
        type: 'bambu',
        port,
        close: () => {
          publishing = false;
          clearInterval(pubTimer);
          broker.close();
          server.close();
        },
        setOffline: (offline) => {
          publishing = !offline;
          if (offline) {
            // 断开所有客户端，模拟设备掉线
            for (const client of [...broker.clients.values()]) {
              client.close();
            }
          }
        },
      });
    });
  });
}

module.exports = { createBambuBroker };
