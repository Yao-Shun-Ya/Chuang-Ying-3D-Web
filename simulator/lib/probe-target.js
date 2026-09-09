/**
 * 虚拟 EufyMake E1 探活目标：简单 TCP 监听
 * - online：端口开放（平台 TCP 探测成功）
 * - offline：关闭监听
 */
const net = require('net');

function createProbeTarget(device, port) {
  let server = null;
  let online = true;

  const listen = () =>
    new Promise((resolve, reject) => {
      server = net.createServer((socket) => {
        // 接受连接即挂起（模拟设备网络栈）
      });
      server.once('error', reject);
      server.listen(port, () => {
        console.log(`[E1模拟] ${device.name} 探活目标已监听 :${port}`);
        resolve();
      });
    });

  return listen().then(() => ({
    type: 'probe',
    port,
    close: () => server && server.close(),
    setOffline: async (offline) => {
      if (offline && online) {
        online = false;
        if (server) {
          server.close();
          server = null;
        }
        console.log(`[E1模拟] ${device.name} 已离线（探活端口关闭）`);
      } else if (!offline && !online) {
        online = true;
        await listen();
        console.log(`[E1模拟] ${device.name} 已上线`);
      }
    },
  }));
}

module.exports = { createProbeTarget };
