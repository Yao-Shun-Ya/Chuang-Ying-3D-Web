const selfsigned = require('selfsigned');

/** 运行时生成自签名 TLS 证书（Bambu MQTT broker 与 xTool WSS 共用） */
function generateCert() {
  const pems = selfsigned.generate(
    [{ name: 'commonName', value: 'campus-device-simulator' }],
    {
      days: 3650,
      keySize: 2048,
      extensions: [{ name: 'subjectAltName', altNames: [{ type: 2, value: 'localhost' }] }],
    },
  );
  return { key: pems.private, cert: pems.cert };
}

module.exports = { generateCert };
