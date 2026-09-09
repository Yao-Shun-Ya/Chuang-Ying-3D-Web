# 设备模拟器

独立虚拟设备产线，模拟 Bambu MQTT / Creality WS / xTool WS-V2+REST / EufyMake TCP 探活，供平台在无真机环境下全链路测试（后端真实适配器以真实协议连接本模拟器）。

- 初始为空态，通过 Web 控制台 / API / CLI 手动添加设备（同类型可批量）
- 支持 4 类机型：Bambu 拓竹、Creality 创想、xTool 激光、EufyMake UV
- 完整模拟各设备对外 API 与状态报文，自动分配序列号 / 访问码 / 端口
- 设备清单持久化到 `data/devices.json`（删除即回到空态）
- **掉线模拟**：控制台「掉线」即真实关闭该设备的协议通道（xTool 双通道一并关闭；Bambu 共享 broker 停止上报），后端看门狗在 12s 内判离线并同步管理后台；恢复上线后自动回在线，不影响同类型其他设备

## 启动

```bash
cd simulator
npm install
npm start          # 控制台 http://127.0.0.1:9910
```

## 控制虚拟设备

Web 控制台（推荐，浏览器打开 http://127.0.0.1:9910）：
- 添加设备（选择类型 / 型号 / 数量）
- 实时状态卡片（在线/离线、状态、进度）
- 开始作业 / 暂停 / 继续 / 完成 / 模拟故障 / 掉线 / 删除
- 一键导出后端 `devices.json` 配置

CLI：

```bash
node control/cli.js list                      # 查看全部虚拟设备状态
node control/cli.js add bambu 2               # 添加 2 台 Bambu
node control/cli.js bambu-01 set-state working # 打印机开始打印（进度每 5s +2%）
node control/cli.js bambu-01 progress 90      # 直接跳到指定进度
node control/cli.js bambu-01 finish           # 立即完成（触发 FINISH，10s 后回 idle）
node control/cli.js xtool-01 set-state working # 激光机开始作业
node control/cli.js xtool-01 set-state paused
node control/cli.js xtool-01 report-error 卡纸 # 模拟故障
node control/cli.js eufymake-01 offline       # 模拟掉线（探活端口关闭）
node control/cli.js eufymake-01 online
node control/cli.js export                    # 导出后端 devices.json
```

HTTP API（端口 9910，前缀 `/api`）：

- `GET    /api/types`              可添加的设备类型目录
- `GET    /api/devices`            虚拟设备清单与实时状态
- `POST   /api/devices`            添加设备 `{"type":"bambu","model":"X2D","count":1}`
- `DELETE /api/devices/:id`        删除设备
- `POST   /api/devices/:id/set-state`     `{"state":"idle|working|paused|error"}`
- `POST   /api/devices/:id/progress`      `{"value":50}`
- `POST   /api/devices/:id/finish`        立即完成作业
- `POST   /api/devices/:id/report-error`  `{"message":"..."}`
- `POST   /api/devices/:id/offline` / `online`
- `GET    /api/export-config`      导出后端 `devices.json`（`?host=127.0.0.1`）

## 设备类型与协议

| 类型 | 协议 | 默认端口 |
|---|---|---|
| Bambu 拓竹（X2D/H2C/P1S 等） | MQTT/TLS（按 serial 区分，自动分配 accessCode） | 8883（共享） |
| Creality 创想（K1/K1C/Ender-3 V3 等） | WebSocket JSON-RPC | 9999+ |
| xTool 激光（F2 Ultra/M2/S1 等） | WS-V2（TLS）+ REST V1 | 28900+ / 8080+ |
| EufyMake E1（UV） | TCP 探活 | 9900+ |

## 对接后端

1. 启动模拟器，在 Web 控制台添加所需虚拟设备
2. 点击「生成 server/config/devices.json」并复制内容
3. 粘贴覆盖 `server/config/devices.json`
4. 管理端「设备管理 → 重载配置」或重启后端

说明：Bambu 的 FTPS(990) 文件上传未模拟；模拟器覆盖监控、状态推送与作业控制链路。
