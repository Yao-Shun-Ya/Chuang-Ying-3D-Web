# 创影 3D · 校内 3D 打印自助服务平台

<p align="center">
  <a href="https://github.com/Yao-Shun-Ya/Chuang-Ying-3D-Web"><img src="https://img.shields.io/badge/GitHub-ChuangYing%203D-181717?style=for-the-badge&logo=github&logoColor=white" alt="GitHub"></a>
  <a href="https://vuejs.org/"><img src="https://img.shields.io/badge/Vue.js-3.4-42B883?style=for-the-badge&logo=vuedotjs&logoColor=white" alt="Vue.js"></a>
  <a href="https://vitejs.dev/"><img src="https://img.shields.io/badge/Vite-5.0-646CFF?style=for-the-badge&logo=vite&logoColor=white" alt="Vite"></a>
  <a href="https://www.typescriptlang.org/"><img src="https://img.shields.io/badge/TypeScript-5.3-3178C6?style=for-the-badge&logo=typescript&logoColor=white" alt="TypeScript"></a>
  <a href="https://tailwindcss.com/"><img src="https://img.shields.io/badge/Tailwind%20CSS-4.0-06B6D4?style=for-the-badge&logo=tailwindcss&logoColor=white" alt="Tailwind CSS"></a>
  <a href="https://threejs.org/"><img src="https://img.shields.io/badge/Three.js-0.185-000000?style=for-the-badge&logo=threedotjs&logoColor=white" alt="Three.js"></a>
  <a href="https://nestjs.com/"><img src="https://img.shields.io/badge/NestJS-10-E0234E?style=for-the-badge&logo=nestjs&logoColor=white" alt="NestJS"></a>
  <a href="https://nodejs.org/"><img src="https://img.shields.io/badge/Node.js-20-339933?style=for-the-badge&logo=nodedotjs&logoColor=white" alt="Node.js"></a>
  <a href="https://www.postgresql.org/"><img src="https://img.shields.io/badge/PostgreSQL-16-4169E1?style=for-the-badge&logo=postgresql&logoColor=white" alt="PostgreSQL"></a>
  <img src="https://img.shields.io/badge/License-MIT-yellow.svg?style=for-the-badge" alt="License">
</p>

> 让创意，触手可及。

面向校内在校学生与创意室管理员的 **封闭式 3D 打印 / 激光自助服务 Web 平台**。学生上传模型 → 系统自动解析体积并计价 → 打印配置（设备 / 填充率 / 支撑 / 颜色）→ CDK 充值 → 下单 → 管理员审核 → 打印下发 → 设备完成自动流转 → 取件，全流程线上化；激光/UV 设备按「自助洗衣机」模式预约使用、按分钟计费。采用前后端分离、模块化架构，**一条命令开箱即用**（PostgreSQL 自动初始化），可一键部署在校内常驻主机。

***

## 目录

* [✨ 核心功能](#-核心功能)

* [🎨 UI / 动效亮点](#-ui--动效亮点)

* [🛠 技术栈](#-技术栈)

* [🚀 快速启动](#-快速启动)

* [⚙️ 环境变量配置](#️-环境变量配置)

* [📁 项目结构](#-项目结构)

* [📦 模块职责](#-模块职责)

* [🖨 设备接入](#-设备接入)

* [🧪 设备模拟器（无硬件全链路测试）](#-设备模拟器无硬件全链路测试)

* [⚡ 激光工坊（自助使用）](#-激光工坊自助使用)

* [🗄 数据库设计](#-数据库设计)

* [💡 核心业务逻辑](#-核心业务逻辑)

* [🌐 API 接口一览](#-api-接口一览)

* [🔐 安全机制](#-安全机制)

* [🎛 管理员密钥重置](#-管理员密钥重置)

* [📧 邮箱验证](#-邮箱验证)

* [📦 部署说明](#-部署说明)

* [🔧 可扩展点](#-可扩展点)

* [❓ 常见问题](#-常见问题)

* [👨‍💻 关于作者](#-关于作者)

* [📄 开源协议 (License)](#-开源协议-license)

* [免责声明](#免责声明)

* [如何引用](#如何引用)

* [🤝 致谢](#-致谢)

***

## ✨ 核心功能

### 学生端

| 功能      | 说明                                              |
| ------- | ----------------------------------------------- |
| 注册 / 登录 | 学号注册，bcrypt 密码哈希，JWT 鉴权                         |
| CDK 充值  | 输入 CDK 兑换码，自动增加虚拟余额，条件更新防重复兑换                   |
| 资金流水    | 充值 / 扣费 / 退款全记录，操作后余额可追溯                        |
| 模型上传    | 支持 STL / OBJ / 3MF，自动校验格式与大小，原始文件名净化              |
| 体积解析    | 三角网格积分算法，精准计算模型体积                               |
| 3D 预览   | Three.js 渲染，Unity 风格相机控制（WASD 移动 / 中键旋转 / 滚轮缩放） |
| 打印配置    | 下单前选择打印设备 + 填充密度滑杆 + 支撑结构 + 耗材颜色，实时计价联动         |
| 在线下单    | 设备核验（存在/类别/启用/在线）+ 余额校验 + 扣费事务                    |
| 订单跟踪    | WebSocket 实时推送状态变更，绑定打印机后展示实时打印进度                |
| 设备状态    | 全部打印机 / 激光设备实时在线状态、作业进度（WS 推送）                  |
| 激光工坊    | 自助预约 → 管理员审核 → 核销码到场核销 → 按分钟计费结算               |

### 管理员端

| 功能     | 说明                                                               |
| ------ | ---------------------------------------------------------------- |
| 仪表盘    | 订单 / 收入 / 用户 数据概览 + 系统健康卡片                                       |
| CDK 管理 | 批量生成兑换码，指定面值与数量                                                  |
| 订单审核   | 查看全部订单、模型预览、打印配置展示；审核通过（自动下发打印并绑定打印机）/ 驳回（自动退款）                 |
| 状态流转   | 审核通过自动转 printing → 设备完成自动转 completed → 手动确认取件 picked\_up   |
| 设备管理   | 可视化增删设备（按品牌/型号目录选型）、全设备实时监控、连接测试（成功/失败 + 错误信息）、远程命令（暂停/恢复/停止/灯光）、维护停用、事件日志 |
| 激光审核   | 预约审批（生成核销码）/ 驳回（含爽约释放）/ 强制结束结算、收入统计、欠费追踪                                |
| 流水对账   | 全部资金流水，支持 CSV 导出                                                 |
| 用户管理   | 查看用户列表与余额                                                        |
| 打印下发   | 审核通过后自动复制模型到打印目录 + 生成 task.json + Bambu FTPS 远程下发 / HTTP 回调线下主机 + 设备状态自动回写 |

***

## 🎨 UI / 动效亮点

平台采用现代感设计，融合金属质感与低饱和蓝紫色调，内置大量自研动效组件：

| 组件                   | 位置       | 效果                                                   |
| -------------------- | -------- | ---------------------------------------------------- |
| `WavyBackground`     | 首页 Hero  | 波浪流动背景                                               |
| `ThreeScene`         | 首页 Hero  | 3D 场景与粒子                                             |
| `TextHoverEffect`    | 首页 + 页脚  | 鼠标跟随的圆形彩色发光文字（SVG 径向渐变 + mask）                       |
| `Typewriter`         | 首页 stats | 打字机效果循环展示支持格式（STL / OBJ / 3MF / PLY / AMF），带渐变发光拖影光标 |
| `Vortex`             | 首页 CTA   | simplex-noise 驱动的漩涡粒子背景                              |
| `Sparkles`           | 平台特点区    | 闪烁粒子背景                                               |
| `RevealCard`         | 功能卡片     | Canvas 粒子揭示动画 + 悬浮抬升                                 |
| `WobbleCard`         | 通用卡片     | 鼠标跟随 3D 倾斜 + 噪声纹理                                    |
| `CanvasRevealEffect` | 通用       | 粒子网格揭示动画                                             |

**页脚设计**：浅色渐变背景 + "CHUANGYING 3D" 大文字轮廓，鼠标悬停时显示柔和蓝紫色径向发光，跟随鼠标移动。

**3D 模型查看器**（`ModelViewer.vue`）：

* Orbit：中键拖拽旋转相机

* Pan：左键拖拽平移

* WASD：相对视角方向移动

* 缩放：鼠标滚轮

* 支持自定义缩放因子调整模型体积显示

***

## 🛠 技术栈

| 层     | 技术                                        |
| ----- | ----------------------------------------- |
| 前端框架  | Vue 3.4 + Vite 5 + TypeScript             |
| 状态管理  | Pinia                                     |
| 路由    | Vue Router 4                              |
| UI 样式 | Tailwind CSS 4 + Radix Vue + Lucide Icons |
| 3D 渲染 | Three.js                                  |
| 动效    | GSAP + Canvas 2D + simplex-noise          |
| 实时通信  | Socket.IO Client                          |
| HTTP  | Axios                                     |
| 后端框架  | NestJS 10 (Node.js)                       |
| API   | RESTful + WebSocket (Socket.IO)           |
| 数据库   | PostgreSQL 16（`pg` 连接池，事务隔离）                  |
| 缓存    | 进程内缓存（cache-manager，短时缓存订单列表/耗材配置）             |
| 设备协议  | MQTT / WebSocket / REST / TCP 探活（适配器模式）         |
| 文件存储  | 本地磁盘（模型/打印任务/头像/缩略图）                         |
| 鉴权    | JWT (Passport) + bcryptjs                 |
| 邮件    | Nodemailer（可选）                            |
| 监控    | Prometheus 指标 `/metrics` + `/health` 健康检查       |

***

## 🚀 快速启动

> **环境要求**：Node.js >= 20（推荐 20 LTS）。**无需手工安装/配置数据库**——启动脚本 `scripts/ensure-pg.js` 会自动处理一切（详见下文）。

### 1. 克隆仓库

```bash
git clone https://github.com/Yao-Shun-Ya/Chuang-Ying-3D-Web.git
cd Chuang-Ying-3D-Web
```

### 2. 启动后端（开箱即用）

```bash
cd server
npm install
npm run start:dev        # 开发模式；生产模式用 npm run start:prod
```

后端默认监听 `http://localhost:8731/api`。启动时 `scripts/ensure-pg.js` 自动完成：

* **连接探测**：优先直连 `server/.env` 中的 PostgreSQL（默认 `127.0.0.1:5432`，账号 `campusapp` / 库 `campusprint`），连通即放行；
* **首次初始化**：本机没有可用 PostgreSQL 时，自动使用本机 PG 二进制 `initdb` 初始化内嵌实例（数据目录 `server/.pgdata`），创建角色与数据库，随机生成安全密码并回写 `server/.env`；
* **自动拉起**：内嵌实例已初始化但未运行时，自动 `pg_ctl start` 拉起；
* **远程实例**：`PG_HOST` 指向外部数据库时仅做连通校验，失败给出明确配置指引（不做任何本地干预）。

随后应用自动建表（幂等）、创建默认管理员账号 `admin / admin123`（可通过环境变量修改）、创建存储目录。**换句话说：新克隆的仓库 `npm install + npm run start` 即可完整运行。**

### 3. 启动前端

```bash
cd web
npm install
npm run dev              # 开发模式 http://localhost:8732
```

前端已配置 Vite 代理，`/api`、`/api-docs`、`/health`、`/metrics` 与 `/socket.io` 自动转发到后端 8731 端口，无需额外配置 CORS。

### 4. （可选）启动设备模拟器

无真实硬件时，可启动设备模拟器做全链路联调（详见「设备模拟器」章节）：

```bash
cd simulator
npm install
npm start                # 控制台 http://127.0.0.1:9910
```

### 5. 访问

* 首页：<http://localhost:8732>

* 管理员登录：使用 `admin / admin123`

* 学生注册：<http://localhost:8732/register>

* API 文档（Swagger）：<http://localhost:8732/api-docs>（直连后端则为 <http://localhost:8731/api-docs>，生产环境自动关闭）

* 健康检查：<http://localhost:8732/health>

***

## ⚙️ 环境变量配置

在 `server/` 目录下创建 `.env` 文件（或直接设置系统环境变量），模板见 `server/.env.example`。所有变量均有默认值（带 ⚠️ 的生产环境必须配置）：

| 变量                                | 默认值                               | 说明                                                      |
| --------------------------------- | --------------------------------- | ------------------------------------------------------- |
| `NODE_ENV`                        | `development`                     | 运行环境（production 时强制校验安全项）                               |
| `PORT`                            | `8731`                            | 后端端口                                                    |
| `PG_HOST` / `PG_PORT`             | `127.0.0.1` / `5432`              | PostgreSQL 连接地址与端口                                       |
| `PG_USER` / `PG_PASSWORD`         | `campusapp` / _(自动生成)_            | PostgreSQL 账号（首次初始化自动生成随机密码写回 `.env`）                    |
| `PG_DATABASE`                     | `campusprint`                     | 数据库名                                                    |
| `PG_SSL`                          | `false`                           | TLS 连接（远程云库通常需要 `true`）                                 |
| `PG_POOL_MAX`                     | `20`                              | 连接池上限                                                   |
| `PG_TZ`                           | `Asia/Shanghai`                   | 应用本地时区（时间写库格式 `YYYY-MM-DD HH:MM:SS`）                    |
| `JWT_SECRET`                      | `campus-3d-print-secret-key-2026` | ⚠️ JWT 签名密钥（**生产环境必须显式配置，否则启动失败**）                      |
| `JWT_EXPIRES_IN`                  | `7d`                              | Token 有效期                                               |
| `CORS_ORIGINS`                    | _(空)_                             | ⚠️ CORS 白名单（逗号分隔，生产环境建议配置，如 `https://print.campus.edu`） |
| `UPLOAD_DIR`                      | `data/uploads`                    | 模型上传目录                                                  |
| `PRINT_TASK_DIR`                  | `data/print-tasks`                | 打印任务输出目录                                                |
| `AVATAR_DIR`                      | `data/avatars`                    | 头像目录                                                    |
| `MATERIAL_DENSITY`                | `1.24`                            | 耗材密度 g/cm³（PLA）                                         |
| `MATERIAL_PRICE`                  | `0.5`                             | 耗材单价 元/g                                                |
| `INFILL_RATE`                     | `0.2`                             | 默认填充率 0\~1                                              |
| `UPLOAD_MAX_MB`                   | `50`                              | 单文件最大体积 MB                                              |
| `PRINT_CALLBACK_URL`              | _(空)_                             | 线下打印主机 HTTP 回调地址                                        |
| `PRINT_CALLBACK_SECRET`           | _(空)_                             | ⚠️ 打印机回调共享密钥（**生产环境未配置则拒绝所有回调**）                        |
| `DEVICES_CONFIG_PATH`             | `config/devices.json`             | 设备清单种子配置文件（导入后管理端可视化增删，运行态存数据库）                        |
| `ADMIN_USER`                      | `admin`                           | 默认管理员用户名                                                |
| `ADMIN_PASS`                      | `admin123`                        | 默认管理员密码（生产使用会告警提示）                                      |
| `ADMIN_EMAIL`                     | `admin@campus.edu`                | 默认管理员邮箱                                                 |
| `ADMIN_KEY_SECRET`                | `chuangying-admin-key-2026`       | 管理员密钥文件签名密钥                                             |
| `ADMIN_KEY_TTL_HOURS`             | `24`                              | 管理员密钥文件有效期（小时）                                          |
| `EMAIL_CODE_TTL`                  | `5`                               | 邮箱验证码有效期（分钟）                                            |
| `EMAIL_CODE_RESEND_COOLDOWN`      | `60`                              | 验证码重发冷却（秒）                                              |
| `EMAIL_CODE_MAX_SEND`             | `5`                               | 单邮箱每小时最大发送次数                                            |
| `EMAIL_CODE_MAX_ATTEMPTS`         | `5`                               | 单验证码最大验证尝试次数                                            |
| `SMTP_HOST`                       | _(空)_                             | SMTP 服务器地址                                              |
| `SMTP_PORT`                       | `465`                             | SMTP 端口                                                 |
| `SMTP_SECURE`                     | `true`                            | 是否使用 SSL                                                |
| `SMTP_USER`                       | _(空)_                             | SMTP 用户名                                                |
| `SMTP_PASS`                       | _(空)_                             | SMTP 密码                                                 |
| `SMTP_FROM`                       | _(空)_                             | 发件人地址                                                   |
| `THROTTLE_TTL` / `THROTTLE_LIMIT` | `60` / `10`                       | 全局接口限流（秒 / 次数，按 IP）                                     |
| `LASER_PRICE_PER_MINUTE`         | `0.5`                             | 激光工坊默认费率（元/分钟，设备级可覆盖）                                   |
| `LASER_EXPIRE_MINUTES`           | `60`                              | 核销码有效期（分钟）                                              |
| `LASER_AUTO_END_GRACE_MINUTES`   | `5`                               | 设备空闲后自动结算宽限（分钟）                                        |
| `LASER_HARD_CAP_GRACE_MINUTES`   | `30`                              | 超计划时长强制结算宽限（分钟，防跑单）                                     |
| `LOG_LEVEL`                       | `info`                            | 日志级别（error/warn/info/debug）                             |

> **提示**：未配置 SMTP 时，邮箱验证码会输出到后端控制台，便于本地测试。

***

## 📁 项目结构

```
ChuangYingWeb/
├── server/                      # 后端 NestJS
│   ├── src/
│   │   ├── main.ts              # 入口，全局管道 / CORS / 前缀 / Swagger / 静态资源
│   │   ├── app.module.ts        # 模块装配 + ThrottlerGuard(全局) + 进程内缓存
│   │   ├── config/
│   │   │   ├── configuration.ts # 全局配置工厂（耗材 / 路径 / JWT / 管理员 / SMTP / 限流）
│   │   │   └── env.validation.ts# Zod 环境变量校验（生产强制安全项）
│   │   ├── database/
│   │   │   ├── database.module.ts
│   │   │   └── database.service.ts   # pg 连接池 + 事务(AsyncLocalStorage) + PL/pgSQL datetime shim + 自动建表
│   │   ├── common/
│   │   │   ├── decorators/      # @Roles、@CurrentUser
│   │   │   ├── guards/          # JwtAuthGuard、RolesGuard
│   │   │   ├── controllers/     # /health、/metrics、/config/material
│   │   │   └── interceptors/    # 统一响应包装 { code, data, msg }
│   │   └── modules/
│   │       ├── auth/            # 注册 / 登录 / JWT / bcrypt / 邮箱验证 / 管理员Key改密
│   │       ├── user/            # 用户实体与服务
│   │       ├── cdk/             # CDK 生成 / 兑换 / 余额 / 流水
│   │       ├── transaction/     # 资金流水记录与 CSV 导出
│   │       ├── model/           # 模型上传 / 体积解析 / 费用估算 / 缩略图
│   │       ├── order/           # 订单状态机 / 审核 / 日志 / WebSocket / 设备联动自动完成
│   │       ├── print/           # 打印任务下发 / 回调 API / 硬件对接扩展接口
│   │       ├── device/          # 设备接入：适配器模式 + 连接编排 + WS 网关 + 管理端可视化 CRUD
│   │       │   ├── adapters/    # bambu(MQTT) / xtool(WS-V2+REST) / creality(WS JSON-RPC) / probe(探活)
│   │       │   └── registry/    # 品牌-型号驱动目录（自动带出参数模板与支持指令）
│   │       └── laser/           # 激光自助业务：预约 / 审核 / 核销 / 计费结算 / 自动化规则
│   ├── config/
│   │   └── devices.example.json # 设备清单种子示例（真实 devices.json 已 gitignore）
│   ├── scripts/
│   │   ├── ensure-pg.js         # 开封即用引导：PG 连通校验 / 自动初始化 / 自动拉起
│   │   └── gen-admin-key.js     # 管理员密钥文件生成脚本
│   └── data/                    # 运行时生成（uploads/print-tasks/avatars/thumbnails/logs）
│
├── simulator/                   # 设备模拟器（独立软件，与 Web 后端零耦合）
│   ├── index.js                 # 启动入口：虚拟设备产线 + HTTP 控制台(9910)
│   ├── control/                 # cli.js / api.js / web-ui.js（三种控制方式）
│   └── lib/                     # bambu-broker / xtool-v2+rest / creality / probe 协议实现
│
├── web/                         # 前端 Vue3
│   └── src/
│       ├── api/                 # axios 封装与全部接口
│       ├── router/              # 路由与鉴权守卫
│       ├── stores/              # Pinia user store
│       ├── layouts/             # MainLayout / AdminLayout
│       ├── components/
│       │   ├── effects/         # 动效组件（Vortex / Typewriter / TextHoverEffect ...）
│       │   ├── ui/              # 基础 UI（Button / Input / Card / Dialog / Tooltip ...）
│       │   ├── ModelViewer.vue  # Three.js 3D 模型查看器
│       │   └── ThreeScene.vue   # 首页 3D 场景
│       ├── composables/         # useAnimation / useToast
│       ├── directives/          # v-reveal 滚动揭示指令
│       └── views/
│           ├── Home.vue         # 首页（Hero + 流程 + 特点 + CTA）
│           ├── Help / FAQ / Pickup.vue
│           ├── Login / Register.vue
│           ├── student/         # 学生端：Balance / Upload / PrintConfig / Orders / DeviceStatus / Laser / Account
│           └── admin/           # 管理员：Dashboard / CdkManage / OrderReview / Transactions / Users / Devices / LaserManage
│
├── nginx/                       # Nginx 反向代理配置
├── prometheus/                  # Prometheus / Alertmanager 监控配置
├── test-models/                 # 测试用模型文件（cube_10mm.stl）
├── Dockerfile / docker-compose.yml            # 生产容器化部署（postgres + server + nginx）
├── docker-compose.monitoring.yml              # 监控栈（node-exporter + Prometheus + Grafana）
├── ecosystem.config.js          # PM2 进程管理配置（单实例部署）
└── .github/workflows/ci.yml     # CI：两端 lint/build/单测 + 镜像构建
```

***

## 📦 模块职责

| 模块                 | 职责                                                                           |
| ------------------ | ---------------------------------------------------------------------------- |
| **Auth & User**    | 用户注册 / 登录、bcrypt 密码哈希、JWT 签发与校验、邮箱验证码、个人信息、角色区分 (student / admin)            |
| **CDK**            | 管理员批量生成唯一 CDK（面值 / 状态 / 兑换人 / 时间）；学生兑换 CDK 增加余额；条件更新防重复兑换                        |
| **Transaction**    | 统一资金流水（recharge / deduct / refund），记录操作后余额，支持管理员 CSV 导出对账                    |
| **Model**          | STL / OBJ / 3MF 上传（后缀 + 大小安全校验）、STL 三角网格体积解析、耗材费用估算、线框缩略图                          |
| **Order**          | 订单创建（设备核验 + 余额校验 + 扣费）、状态机流转、订单日志、WebSocket 状态推送；打印配置（设备/填充/支撑/颜色）存储与计价联动 |
| **Review (Admin)** | 全部订单查看、模型预览、打印配置展示、审核通过（触发打印下发并绑定打印机）/ 驳回（退款）、状态流转操作                      |
| **Print**          | 审核通过后复制模型到打印目录 + 生成 task.json；HTTP 回调钩子（线下主机）与 `PrintDeviceInterface` 硬件对接接口；Bambu FTPS 远程下发 |
| **Device**        | 设备接入层：适配器模式统一 Bambu（MQTT/TLS 8883）/ xTool（WS-V2 + REST）/ Creality（WS JSON-RPC :9999）/ EufyMake（探活）协议；连接编排与指数退避重连；状态聚合落库；`DeviceGateway` WS 双房间广播（admin 全量 / public 脱敏）；远程命令；可视化增删；维护停用；事件日志 |
| **Laser**          | 激光/UV 自助业务：预约（余额预检）→ 管理员审核（核销码邮件）→ 到场核销 → 按实际分钟结算（事务原子扣款）；空闲自动结算 / 超时失效 / 硬顶防跑单 / 未授权使用检测 / 爽约释放 |
| **OrderDeviceLink** | 订单与设备联动：管理员开始打印时绑定 `printer_device_id`，设备 FINISH 事件自动将 printing 订单流转为 completed |
| **WebSocket**      | `OrderGateway` 订单状态推送（`/orders`）+ `DeviceGateway` 设备状态/事件推送（`/devices`）         |
| **Static**         | 首页、使用帮助、FAQ、取件须知静态页面                                                         |

***

## 🖨 设备接入

设备接入层将多品牌打印机 / 激光设备 / UV 设备统一为一套适配器协议，实现一站式管理。所有设备通过交换机与服务器组网（推荐有线，稳定性优先）。

### 支持的设备与协议

| 设备              | 协议                      | 能力                                                |
| ----------------- | ----------------------- | ------------------------------------------------- |
| Bambu Lab X2D/H2C | MQTT over TLS（8883）      | 实时状态（进度/温度/耗材）、暂停/恢复/停止、灯光、gcode.3mf 远程下发打印（FTPS）  |
| Creality 创想3D（K1 等） | WebSocket JSON-RPC（9999） | 实时状态（push_status 订阅 + 心跳）、暂停/恢复/停止、灯光、断线看门狗检测         |
| xTool F2 Ultra/M2 | WS-V2（新固件 28900）+ REST V1（8080） | 实时状态、暂停/恢复/停止                                     |
| EufyMake E1       | 网络探活（无公开 API）           | 在线/离线监控、手动状态管理（配合激光业务核销自动置位）                      |
| Bambu AMS 2 Pro   | 6pin 线缆直连打印机           | 耗材数据由所属打印机 MQTT 上报，无需独立接入                          |

> xTool 机型按固件版本自动协商：优先 WS-V2 指令通道（`websocket` 端口 28900），失败回退 REST（8080）。

### 设备管理（可视化 CRUD + 配置种子）

设备运行态数据存于 PostgreSQL `devices` 表，管理端「设备管理」页面可视化增删：

* **选型目录**（`GET /api/admin/device-registry`）：按品牌 → 型号选择，自动带出默认端口 / 参数模板 / 支持指令；
* **新增设备**（`POST /api/admin/devices`）：写入数据库并立即构建运行实例、尝试连接；
* **删除设备**（`DELETE /api/admin/devices/:id`）：关闭协议服务 + 删除记录；
* **配置种子**：`server/config/devices.json`（**已 gitignore，真实 IP/序列号/访问码不会提交**）作为首批导入/批量初始化入口，模板见 `devices.example.json`：

```json
{
  "laser": { "pricePerMinute": 0.5 },
  "devices": [
    { "id": "bambu-01", "name": "拓竹 X2D · 01", "type": "bambu", "category": "fdm",
      "model": "X2D", "host": "192.168.1.50", "serial": "01S00C000000001", "accessCode": "12345678" },
    { "id": "creality-01", "name": "创想3D K1 · 01", "type": "creality", "category": "fdm",
      "model": "K1", "host": "192.168.1.55", "wsPort": 9999 },
    { "id": "xtool-01", "name": "xTool F2 Ultra · 01", "type": "xtool", "category": "laser",
      "model": "F2 Ultra", "host": "192.168.1.60" },
    { "id": "eufy-01", "name": "EufyMake E1", "type": "eufymake", "category": "uv",
      "model": "E1", "host": "192.168.1.70", "probePort": 9900 }
  ]
}
```

* `type` 决定协议适配器：`bambu` / `xtool` / `creality` / `eufymake`
* `category` 决定业务归属：`fdm`（打印订单）/ `laser`（激光预约）/ `uv`（激光预约）
* `pricePerMinute` 可选，设备级费率覆盖全局 `LASER_PRICE_PER_MINUTE`
* 新增/删除后立即生效，无需重启

### 连接编排与稳定性

* **启动并发连接**：所有设备并发握手（单台 15s 超时），逐台输出成功/失败与错误信息（管理页「测试全部连接」可视化）
* **指数退避重连**：失败后 5s → 10s → 20s → 40s → 60s 封顶自动重连；30s 周期兜底扫描孤儿设备
* **断线看门狗**：依赖周期上报的设备（Bambu/Creality）超时未收到报文自动判离线并落库广播
* **状态节流落库**：状态变化即广播，遥测 10s 节流写库，避免高频写
* **WS 双房间广播**：admin 房间收全量遥测与事件流；public 房间收脱敏摘要（不含 host / 凭据 / 序列号）

***

## 🧪 设备模拟器（无硬件全链路测试）

`simulator/` 是**独立于 Web 后端的虚拟设备产线软件**（端口 9910），以真实协议模拟 Bambu / Creality / xTool / EufyMake 四类设备。后端适配器按真实协议连接模拟器，即可在没有一台真机的情况下完成全部业务联调：

```bash
cd simulator
npm install
npm start          # 启动后打开 http://127.0.0.1:9910 控制台
```

* **初始为空态**：不预置任何设备，通过 Web 控制台手动添加（同类型可批量 1-20 台），自动分配序列号 / 访问码 / 端口；
* **持久化**：设备清单存入 `simulator/data/devices.json`（已 gitignore），重启自动恢复，删除文件即回到空态；
* **三种控制方式**：Web 控制台（推荐）、REST API（`POST /api/devices/:id/finish` 等）、CLI；
* **能力覆盖**：开始作业（进度周期推进）→ 暂停/恢复/停止 → 完成（触发 FINISH 自动流转订单）→ 模拟故障 → **掉线/恢复**（后端看门狗 12s 内判离线并同步管理后台）→ 灯光开关 → 一键导出后端 `devices.json` 配置。

CLI 示例：

```bash
node control/cli.js list                           # 查看全部虚拟设备状态
node control/cli.js add bambu 2                    # 添加 2 台 Bambu
node control/cli.js bambu-01 set-state working     # 打印机开始打印（进度每 5s +2%）
node control/cli.js bambu-01 progress 90           # 直接跳到指定进度
node control/cli.js bambu-01 finish                # 立即完成（触发订单自动流转）
node control/cli.js creality-01 offline            # 模拟掉线（管理后台 12s 内判离线）
node control/cli.js xtool-01 report-error 卡纸     # 模拟故障
node control/cli.js export                         # 导出后端 devices.json
```

**对接后端**：模拟器控制台「生成 server/config/devices.json」→ 复制内容覆盖 `server/config/devices.json` → 管理端重启后端或「设备管理」页面操作，即可全部连通。说明：Bambu 的 FTPS(990) 文件上传未模拟；模拟器覆盖监控、状态推送与作业控制链路。详见 [simulator/README.md](simulator/README.md)。

***

## ⚡ 激光工坊（自助使用）

激光 / UV 设备采用「自助洗衣机」模式运营，兼顾开放自助与安全管控：

```
学生预约（选设备/时长，余额预检）
        │
        ▼
管理员审核 ──驳回──▶ 邮件通知（结束）
        │通过
        ▼
核销码邮件（60 分钟有效）
        │
        ▼
学生到场核销（扫设备二维码 / 输入核销码）──▶ 会话 in_use，开始计时
        │
        ▼
学生结束 / 设备空闲自动结算 / 超时硬顶结算
        │
        ▼
按实际分钟 × 费率结算（事务原子扣款，余额不足扣至零并标记欠费）
```

### 计费与安全规则

* **实际分钟计费**：结算时 `ceil(使用分钟) × 单价`，事务内原子扣款（`WHERE balance >= ?` 防并发）
* **余额不足**：扣至零 + 欠费标记（`underpaid`），管理端欠费追踪，下次充值前不可再预约
* **核销码安全**：仅管理员审核通过后生成，一次性使用（原子流转 approved → in_use），60 分钟未核销自动失效
* **爽约释放**：已批准但学生未到场核销的预约，管理员可直接驳回释放设备（否则核销码失效前设备一直占用）
* **未授权使用检测**：设备进入作业状态但无进行中会话 → 记录告警事件推送管理端
* **防跑单硬顶**：使用超过 `计划时长 + 30 分钟` 强制结算
* **空闲自动结算**：设备离开作业状态超过 5 分钟宽限，自动结束会话结算
* **设备互斥**：同一设备同时只允许一个未完结会话（pending_review / approved / in_use）；学生同时只允许一个未完结预约

***

## 🗄 数据库设计

数据库：**PostgreSQL 16**（`pg` 连接池，全部写操作事务化；应用层统一使用 `datetime('now','localtime'[, '+/-N unit'])` PL/pgSQL 兼容函数，时间以 `'YYYY-MM-DD HH:MM:SS'` 文本存储，与业务校验格式对齐）。

### users 用户表

| 字段                        | 类型          | 说明              |
| ------------------------- | ----------- | --------------- |
| id                        | SERIAL PK  | 主键（自增）          |
| username                  | TEXT UNIQUE | 用户名（登录账号）       |
| password\_hash            | TEXT        | bcrypt 哈希       |
| role                      | TEXT        | student / admin |
| real\_name / student\_no  | TEXT        | 姓名、学号           |
| email                     | TEXT        | 邮箱              |
| display\_name             | TEXT        | 展示名称（默认取邮箱前缀）   |
| avatar                    | TEXT        | 头像路径            |
| balance                   | DOUBLE PRECISION | 虚拟余额          |
| created\_at / updated\_at | TEXT        | 时间戳             |

### cdks CDK 兑换码表

| 字段           | 类型               | 说明            |
| ------------ | ---------------- | ------------- |
| id           | SERIAL PK        | 主键            |
| code         | TEXT UNIQUE      | 12 位唯一兑换码     |
| value        | DOUBLE PRECISION | 面值            |
| status       | TEXT             | unused / used |
| created\_at  | TEXT             | 生成时间          |
| redeemed\_by | INTEGER FK→users | 兑换用户          |
| redeemed\_at | TEXT             | 兑换时间          |

### transactions 资金流水表

| 字段             | 类型               | 说明                         |
| -------------- | ---------------- | -------------------------- |
| id             | SERIAL PK        | 主键                         |
| user\_id       | INTEGER FK→users | 用户                         |
| type           | TEXT             | recharge / deduct / refund |
| amount         | DOUBLE PRECISION | 金额（正数）                     |
| balance\_after | DOUBLE PRECISION | 操作后余额                      |
| related\_id    | INTEGER          | 关联订单 / CDK                 |
| remark         | TEXT             | 备注                         |
| created\_at    | TEXT             | 时间                         |

### models 模型文件表

| 字段                        | 类型         | 说明              |
| ------------------------- | ---------- | --------------- |
| id                        | SERIAL PK  | 主键              |
| user\_id                  | INTEGER FK | 上传者             |
| filename / original\_name | TEXT       | 存储名 / 原始名       |
| file\_path                | TEXT       | 本地路径（磁盘存储，库里只存路径） |
| file\_size                | INTEGER    | 字节              |
| format                    | TEXT       | stl / obj / 3mf |
| volume                    | DOUBLE PRECISION | 体积 cm³   |
| estimated\_cost           | DOUBLE PRECISION | 预估费用 元  |
| thumbnail\_path           | TEXT       | 线框缩略图路径          |
| created\_at               | TEXT       | 上传时间            |

### orders 订单表

| 字段                        | 类型          | 说明                                                                        |
| ------------------------- | ----------- | ------------------------------------------------------------------------- |
| id                        | SERIAL PK   | 主键                                                                        |
| order\_no                 | TEXT UNIQUE | 订单号                                                                       |
| user\_id / model\_id      | INTEGER FK  | 下单人 / 模型                                                                   |
| volume / cost             | DOUBLE PRECISION | 体积、费用                                                                |
| status                    | TEXT        | pending\_review / rejected / approved / printing / completed / picked\_up |
| reject\_reason            | TEXT        | 驳回理由                                                                      |
| printer\_device\_id       | TEXT        | 绑定打印机（开始打印时选择，设备完成后自动流转）                                             |
| print\_params             | TEXT(JSON)  | 打印配置：deviceId / infillRate / supports / color                            |
| created\_at / updated\_at | TEXT        | 时间戳                                                                       |

### order\_logs 订单状态日志表

| 字段                        | 类型          | 说明     |
| ------------------------- | ----------- | ------ |
| id                        | SERIAL PK   | 主键     |
| order\_id                 | INTEGER FK  | 订单     |
| from\_status / to\_status | TEXT        | 状态迁移   |
| operator\_id              | INTEGER     | 操作人    |
| remark                    | TEXT        | 备注     |
| created\_at               | TEXT        | 时间     |

### email\_codes 邮箱验证码表

| 字段          | 类型         | 说明                            |
| ----------- | ---------- | ----------------------------- |
| email       | TEXT PK    | 邮箱（一个邮箱同时只保留一个验证码）            |
| code        | TEXT       | 验证码                           |
| expires\_at | TEXT       | 过期时间                          |
| attempts    | INTEGER    | 已尝试次数                         |
| created\_at | TEXT       | 时间                            |

### devices 设备表

| 字段                          | 类型     | 说明                                                  |
| --------------------------- | ------ | --------------------------------------------------- |
| id                          | TEXT PK | 设备 ID（全局唯一）                                          |
| name / type / category / model | TEXT | 名称 / 协议类型（bambu/xtool/creality/eufymake）/ 业务分类（fdm/laser/uv）/ 型号 |
| enabled                     | SMALLINT | 启用开关（0 = 维护停用，禁止预约/下单）                                |
| manual\_state               | TEXT    | 手动状态覆盖（无遥测设备用）                                      |
| state / online              | TEXT / SMALLINT | 聚合状态 / 在线标记（后端心跳驱动）                       |
| detail\_json                | TEXT(JSON) | 原始遥测 JSON（进度/温度/耗材等）                               |
| last\_seen\_at              | TEXT    | 最后在线时间                                              |

### device\_events 设备事件表

| 字段            | 类型         | 说明                                    |
| ------------- | ---------- | ------------------------------------- |
| id            | SERIAL PK  | 主键                                    |
| device\_id    | TEXT       | 设备（可为空 = 全局事件）                         |
| level         | TEXT       | info / warn / error                    |
| event\_type   | TEXT       | connect\_ok / connect\_fail / state\_change / command / unauthorized\_use |
| message       | TEXT       | 事件描述                                   |
| payload\_json | TEXT(JSON) | 附加数据                                   |
| created\_at   | TEXT       | 时间                                    |

### laser\_sessions 激光预约会话表

| 字段                                                | 类型          | 说明                                     |
| ------------------------------------------------- | ----------- | -------------------------------------- |
| id                                                | SERIAL PK   | 主键                                     |
| device\_id / user\_id                             | TEXT / FK   | 设备 / 学生                                 |
| status                                            | TEXT        | pending\_review / approved / in\_use / completed / rejected / cancelled / expired |
| planned\_minutes / purpose                        | INTEGER / TEXT | 计划时长 / 用途说明                           |
| verify\_code / expires\_at                        | TEXT        | 核销码（一次性）/ 核销截止时间                       |
| started\_at / ended\_at / actual\_minutes          | TEXT / INTEGER | 开始 / 结束 / 实际使用分钟                     |
| fee / fee\_charged / underpaid                    | DOUBLE PRECISION / SMALLINT | 应收 / 实扣 / 欠费标记        |
| review\_note / reviewed\_by                      | TEXT / FK   | 审核备注 / 审核管理员                            |

### admin\_audit\_logs 管理操作审计表

| 字段             | 类型          | 说明                 |
| -------------- | ----------- | ------------------ |
| id             | SERIAL PK   | 主键                 |
| admin\_id / admin\_name | INTEGER / TEXT | 操作管理员 / 账号     |
| action         | TEXT        | 操作类型（订单审核/设备命令/导出等） |
| target\_type / target\_id | TEXT / INTEGER | 操作对象           |
| request\_params | TEXT(JSON)  | 关键请求参数             |
| ip / user\_agent | TEXT       | 来源                 |
| created\_at    | TEXT        | 时间                 |

***

## 💡 核心业务逻辑

### 1. STL 体积解析（三角网格体积积分）

```typescript
// server/src/modules/model/model-parser.util.ts
function signedVolumeOfTriangle(p1, p2, p3) {
  return (1.0 / 6.0) * (
    -p3.x * p2.y * p1.z + p2.x * p3.y * p1.z + p3.x * p1.y * p2.z
    - p1.x * p3.y * p2.z - p2.x * p1.y * p3.z + p1.x * p2.y * p3.z
  );
}

// 二进制 STL：跳过 80 字节头 + 4 字节面数，每面 12 法线 + 36 顶点 + 2 属性
function parseBinaryStl(buf) {
  const numTriangles = buf.readUInt32LE(80);
  let offset = 84, volume = 0;
  for (let i = 0; i < numTriangles; i++) {
    offset += 12; // 跳过法线
    const p1 = readVec3(buf, offset); offset += 12;
    const p2 = readVec3(buf, offset); offset += 12;
    const p3 = readVec3(buf, offset); offset += 14; // 顶点 + 属性
    volume += signedVolumeOfTriangle(p1, p2, p3);
  }
  return Math.abs(volume) / 1000; // mm³ → cm³
}
```

### 2. 费用估算与打印配置计价

```
费用(元) = 体积(cm³) × 填充率 × 耗材密度(g/cm³) × 单价(元/g)
默认：填充率 0.2，PLA 密度 1.24 g/cm³，单价 0.5 元/g
```

下单流程（前端 `Upload.vue → PrintConfig.vue`）：

```
上传模型 → 尺寸调整确认 →【下一步：打印配置】
      ① 选择打印设备（校验：存在 / FDM 类别 / 已启用 / 在线）
      ② 填充密度滑杆 5-100%（实时联动计价）
      ③ 支撑结构 4 档（无/少量/中量/大量）
      ④ 耗材颜色（10 色）
      → 确认下单（print_params JSON 落库，审核端/订单详情均展示）
```

### 3. CDK 兑换（事务 + 原子条件更新防双花）

```typescript
// server/src/modules/cdk/cdk.service.ts（PG 化异步 API）
async redeem(code, userId) {
  const cdk = await db.get('SELECT * FROM cdks WHERE code = ?', [code]);
  if (!cdk) throw new NotFoundException('CDK 不存在');
  if (cdk.status === 'used') throw new BadRequestException('CDK 已被使用');
  await db.transaction(async (tx) => {
    // 条件更新：WHERE status='unused'，并发下只有一个请求能成功（rowCount>0）
    const res = await tx.run(
      `UPDATE cdks SET status='used', redeemed_by=?, redeemed_at=datetime('now','localtime')
       WHERE id=? AND status='unused'`,
      [userId, cdk.id],
    );
    if (res.rowCount === 0) throw new BadRequestException('CDK 已被使用');
    // 原子加余额（ROUND + ::numeric 显式 cast 保持两位小数，防浮点尾差）
    await tx.run('UPDATE users SET balance = ROUND((balance + ?)::numeric, 2) WHERE id = ?', [cdk.value, userId]);
    await txService.record({ userId, type: 'recharge', amount: cdk.value, relatedId: cdk.id });
  });
}
```

### 4. 订单状态机

```typescript
const VALID_TRANSITIONS = {
  pending_review: ['rejected', 'approved'],
  rejected: [],
  approved: ['printing'],
  printing: ['completed'],
  completed: ['picked_up'],
  picked_up: [],
};

if (!VALID_TRANSITIONS[order.status].includes(toStatus)) {
  throw new BadRequestException(`非法状态迁移：${order.status} → ${toStatus}`);
}
```

### 5. 下单扣费（设备核验 + 原子条件扣减，防并发超扣）

```typescript
// server/src/modules/order/order.service.ts
async createOrder(userId, modelId, remark, scale, print) {
  const model = await modelService.findById(modelId);
  const user = await userService.findById(userId);
  // 设备核验：存在 / FDM 类别 / 已启用 / 在线（学生自选设备）
  const device = deviceManager.getDevice(print.deviceId); // ...
  if (user.balance < cost) throw new BadRequestException('余额不足');
  await db.transaction(async (tx) => {
    // 原子条件扣减：WHERE balance >= ?，余额不足则 rowCount=0 抛错回滚（并发下不会超扣）
    const res = await tx.run(
      'UPDATE users SET balance = ROUND((balance - ?)::numeric, 2) WHERE id = ? AND balance >= ?',
      [cost, userId, cost],
    );
    if (res.rowCount === 0) throw new BadRequestException('余额不足');
    const orderId = await insertOrder(...);
    await txService.record({ type: 'deduct', amount: cost, relatedId: orderId });
    await insertOrderLog({ to_status: 'pending_review', operatorId: userId });
  });
}
```

### 6. 打印任务下发与设备自动流转

```typescript
// server/src/modules/print/print-dispatch.service.ts
async dispatch(order) {
  // 1. 复制模型到 print-tasks/<orderNo>/
  copyFileSync(model.file_path, join(taskDir, model.original_name));
  // 2. 生成 task.json（订单号、模型路径、体积、打印配置）
  writeFileSync(join(taskDir, 'task.json'), JSON.stringify(task));
  // 3. HTTP 回调钩子（PRINT_CALLBACK_URL 非空时通知线下主机）
  if (callbackUrl) await fetch(callbackUrl, { method: 'POST', body: JSON.stringify(task) });
  // 4. 硬件对接扩展点（Bambu 走 FTPS 上传 gcode.3mf + 远程启动）
  if (this.device) await this.device.sendTask(task);
}
```

**订单状态自动流转：**

```
pending_review ──管理员审核通过──▶ approved
                                       │
                          系统自动：下发打印任务 + 绑定打印机
                                       ▼
                                  printing
                                 │        │
             设备上报 FINISH（打印完成）   打印失败 / 管理员驳回
                                 ▼        ▼
                             completed   rejected（自动退款）
                                 │
                              管理员确认取件
                                 ▼
                              picked_up
```

* **审核通过** → 系统自动调用 `dispatch()` 下发打印任务并绑定 `printer_device_id`，状态自动流转为 `printing`

* **打印完成** → 设备适配器上报 FINISH 事件（或线下主机/打印机调用回调 API result=success），系统自动流转为 `completed`

* **打印失败** → 回调 `result: 'failed'`（或驳回），系统自动驳回订单并退款（`printing` 状态下驳回同样触发退款）

* **管理员手动驳回** → `pending_review` 或 `printing` 状态下均可驳回并自动退款（条件更新防重复退款）

* **取件确认** → 需管理员手动确认（`picked_up`）

### 7. 设备断线看门狗（离线同步管理后台）

后端适配器对依赖周期上报的设备（Bambu MQTT / Creality WS）内置 12s 看门狗：超时未收到报文即判定离线，状态落库并即时 WS 广播，管理后台实时显示 offline；设备恢复上报后自动转回在线。共享 broker 场景（多台 Bambu 共用一台模拟器/网关）下，单台掉线的判定与隔离不影响同类型其他设备。

### 8. 打印机回调 API（线下主机对接）

线下打印主机在打印完成（或失败）后调用此接口上报，系统自动更新订单状态。

**接口：** `POST /api/print/callback`

**鉴权：** 请求头携带 `x-callback-secret`，值需与服务端 `PRINT_CALLBACK_SECRET` 环境变量一致。

* 已配置密钥：密钥不匹配返回 401

* 未配置密钥：**开发环境**跳过校验（控制台告警）；**生产环境直接拒绝所有回调**（401，需配置密钥后重启）

**请求体：**

```json
{
  "orderNo": "ORD1700000000ABCD",
  "result": "success",
  "printerName": "Ender-3 #1",
  "duration": "2h 35m",
  "message": "打印完成，表面质量良好"
}
```

| 字段            | 类型                      | 必填 | 说明                |
| ------------- | ----------------------- | -- | ----------------- |
| `orderNo`     | string                  | ✅  | 订单号               |
| `result`      | `'success' \| 'failed'` | 否  | 打印结果，默认 `success` |
| `printerName` | string                  | 否  | 打印机名称             |
| `duration`    | string                  | 否  | 打印耗时              |
| `message`     | string                  | 否  | 备注信息              |

**响应：**

```json
{ "success": true, "status": "completed", "orderNo": "ORD1700000000ABCD" }
```

**状态查询接口：** `POST /api/print/status`，请求体 `{ "orderNo": "..." }`，需携带同样的 `x-callback-secret` 请求头（防止订单状态枚举），返回订单当前打印状态。

***

## 🌐 API 接口一览

统一响应格式：`{ code, data, msg, traceId }`，`code=0` 成功；前端 axios 拦截器已提取 `data`。

### 认证 Auth

| 方法    | 路径                                | 说明                    | 权限          |
| ----- | --------------------------------- | --------------------- | ----------- |
| POST  | `/api/auth/send-code`             | 发送邮箱验证码               | 公开          |
| POST  | `/api/auth/register`              | 注册（邮箱 + 验证码 + 密码）     | 公开          |
| POST  | `/api/auth/login`                 | 登录，返回 JWT             | 公开          |
| GET   | `/api/auth/me`                    | 获取当前用户信息              | 登录          |
| PATCH | `/api/auth/me`                    | 更新个人信息（姓名/学号/展示名称/头像） | 登录          |
| POST  | `/api/auth/change-password`       | 已登录用户改密（邮箱验证码）        | 登录          |
| POST  | `/api/auth/reset-password`        | 忘记密码重置（邮箱 + 验证码）      | 公开          |
| POST  | `/api/auth/avatar`                | 上传头像（裁切后图片）           | 登录          |
| POST  | `/api/auth/admin/change-password` | 管理员通过密钥文件改密           | admin + Key |

### CDK

| 方法   | 路径                      | 说明                | 权限    |
| ---- | ----------------------- | ----------------- | ----- |
| POST | `/api/cdk/generate`     | 批量生成 CDK（面值 + 数量） | admin |
| POST | `/api/cdk/redeem`       | 兑换 CDK 充值         | 登录    |
| GET  | `/api/cdk/balance`      | 查询余额              | 登录    |
| GET  | `/api/cdk/transactions` | 我的资金流水            | 登录    |

### 模型 Model

| 方法   | 路径                          | 说明                        | 权限     |
| ---- | --------------------------- | ------------------------- | ------ |
| POST | `/api/models/upload`        | 上传模型（multipart/form-data） | 登录     |
| GET  | `/api/models`               | 我的模型列表（含体积/费用/缩略图路径）      | 登录     |
| GET  | `/api/models/:id/file`      | 下载模型文件（仅所有者/管理员）          | 登录+所有权 |
| GET  | `/api/models/:id/thumbnail` | 模型线框缩略图 PNG               | 公开     |

### 订单 Order

| 方法   | 路径                 | 说明                                                        | 权限 |
| ---- | ------------------ | --------------------------------------------------------- | -- |
| POST | `/api/orders`      | 创建订单（modelId + 打印配置 deviceId/infillRate/supports/color） | 登录 |
| GET  | `/api/orders/mine` | 我的订单列表                                                    | 登录 |
| GET  | `/api/orders/:id`  | 订单详情                                                      | 登录 |
| GET  | `/api/orders/:id/logs` | 订单状态日志                                                | 登录 |
| WS   | `/orders`          | 订单状态实时推送（`order:status_changed`）                            | 登录 |

### 管理员 Admin

| 方法   | 路径                               | 说明                                      | 权限    |
| ---- | -------------------------------- | --------------------------------------- | ----- |
| GET  | `/api/admin/orders`              | 全部订单列表（60s 缓存，变更自动清缓存）                    | admin |
| POST | `/api/admin/orders/:id/approve`  | 审核通过（触发打印下发 + 可选绑定 printerDeviceId）       | admin |
| POST | `/api/admin/orders/:id/reject`   | 审核驳回（自动退款）                              | admin |
| POST | `/api/orders/:id/status`         | 状态流转（printing / completed / picked\_up） | admin |
| GET  | `/api/admin/transactions`        | 全部资金流水                                  | admin |
| GET  | `/api/admin/transactions/export` | 流水导出 CSV                                | admin |
| GET  | `/api/admin/users`               | 用户列表                                    | admin |
| GET  | `/api/admin/audit-logs`          | 管理操作审计日志（分页）                             | admin |

### 打印 Print（线下主机对接）

| 方法   | 路径                    | 说明               | 权限   |
| ---- | --------------------- | ---------------- | ---- |
| POST | `/api/print/callback` | 打印完成回调（自动更新订单状态） | 回调密钥 |
| POST | `/api/print/status`   | 查询订单打印状态         | 回调密钥 |

### 设备 Device

| 方法     | 路径                                   | 说明                                  | 权限    |
| ------ | ------------------------------------ | ----------------------------------- | ----- |
| GET    | `/api/devices/public`                | 设备公开摘要（脱敏，含实时状态/进度）                | 登录    |
| GET    | `/api/admin/devices`                 | 全量设备视图（含遥测详情/支持命令）                  | admin |
| GET    | `/api/admin/device-registry`         | 品牌-型号驱动目录（选型自动带出参数模板）              | admin |
| POST   | `/api/admin/devices`                 | 可视化新增设备（写库 + 构建实例 + 尝试连接）          | admin |
| DELETE | `/api/admin/devices/:id`             | 删除设备（关闭协议服务 + 删记录）                 | admin |
| POST   | `/api/admin/devices/test`            | 全量连接测试（每台输出成功/失败 + 错误信息）           | admin |
| POST   | `/api/admin/devices/:id/test`        | 单台连接测试                              | admin |
| POST   | `/api/admin/devices/:id/command`     | 远程命令（pause/resume/stop/led\_on/led\_off/pushall） | admin |
| POST   | `/api/admin/devices/:id/toggle`      | 启用/停用（维护锁）                          | admin |
| POST   | `/api/admin/devices/:id/manual-state` | 手动状态覆盖（E1 等无遥测设备）                | admin |
| GET    | `/api/admin/devices/:id/events`      | 设备事件日志                              | admin |
| POST   | `/api/admin/devices/:id/print-file`  | 上传 gcode.3mf 远程下发打印（Bambu）         | admin |
| WS     | `/devices`                           | 实时推送：`device:status`（admin）/ `device:public_status`（脱敏）/ `device:event` | 登录    |

### 激光工坊 Laser

| 方法   | 路径                                | 说明                        | 权限    |
| ---- | --------------------------------- | ------------------------- | ----- |
| GET  | `/api/laser/devices`              | 可预约设备（激光/UV + 实时状态 + 费率） | 登录    |
| POST | `/api/laser/sessions`             | 创建预约（余额预检 + 设备互斥校验）       | 登录    |
| GET  | `/api/laser/sessions/my`          | 我的预约记录                   | 登录    |
| POST | `/api/laser/sessions/start`       | 到场核销开始（设备二维码 / 核销码）      | 登录    |
| POST | `/api/laser/sessions/:id/end`     | 结束使用并结算（实际分钟计费）          | 登录    |
| POST | `/api/laser/sessions/:id/cancel`  | 取消预约（核销前，pending/approved） | 登录    |
| GET  | `/api/admin/laser/sessions`       | 全部预约列表（按状态筛选）            | admin |
| GET  | `/api/admin/laser/stats`          | 今日统计 / 欠费 / 使用中           | admin |
| POST | `/api/admin/laser/sessions/:id/approve` | 审核通过（生成核销码邮件通知）    | admin |
| POST | `/api/admin/laser/sessions/:id/reject`  | 审核驳回（含爽约释放，邮件通知）    | admin |
| POST | `/api/admin/laser/sessions/:id/end`     | 强制结束并结算             | admin |

### 公开配置 / 系统观测

| 方法  | 路径                     | 说明                       | 权限 |
| --- | ---------------------- | ------------------------ | -- |
| GET | `/api/config/material` | 公开耗材配置（计价参数：密度/单价/默认填充率） | 公开 |
| GET | `/health`              | 健康检查（数据库/磁盘/内存）          | 公开 |
| GET | `/metrics`             | Prometheus 指标端点          | 公开 |
| GET | `/api-docs`            | Swagger API 文档（生产环境自动关闭） | 公开 |

***

## 🔐 安全机制

| 机制        | 实现                                                                                                 |
| --------- | -------------------------------------------------------------------------------------------------- |
| 密码存储      | bcryptjs 哈希，cost factor = 10                                                                       |
| 鉴权        | JWT (HS256)，有效期 7 天，Passport 策略校验                                                                  |
| JWT 密钥    | 生产环境（`NODE_ENV=production`）未显式配置 `JWT_SECRET` 或使用默认值 → **启动失败**                                    |
| 角色权限      | `@Roles('admin')` 装饰器 + `RolesGuard` 守卫                                                            |
| 接口限流      | ThrottlerGuard 全局守卫（10 次/分钟/IP）；登录/注册 5 次/分钟，验证码发送 3 次/分钟；**管理员专属接口（订单审核/状态流转/用户/流水/设备管理等）放宽至 60 次/分钟** |
| 余额操作      | PostgreSQL 事务 + 原子条件更新（`WHERE balance >= ?` 防超扣、`WHERE status='unused'` 防双花），金额 `ROUND((x)::numeric,2)` 防浮点尾差     |
| 事务隔离      | 连接池 + `AsyncLocalStorage` 绑定事务连接：并发请求各自独立连接，事务互不串扰；嵌套事务显式拒绝                             |
| CDK 防重    | 事务内条件更新 `WHERE status='unused'`，并发双花被拒绝                                                            |
| 退款防重      | 驳回退款为条件更新（状态不满足则 `rowCount=0` 回滚），并发下不会重复退款                                                         |
| 文件上传      | 后缀白名单（stl/obj/3mf）+ 大小限制（默认 50MB）+ 原始文件名净化（防路径穿越）                                                  |
| 文件访问      | 模型文件仅可通过 `/api/models/:id/file` 下载（所有者/管理员），`/uploads/` 静态目录已关闭（仅头像目录例外）                              |
| 打印回调      | `x-callback-secret` 共享密钥；生产环境未配置密钥一律拒绝                                                             |
| WebSocket | 连接需携带 JWT（`auth.token`），从 token 解出身份，禁止客户端自报 userId                                                |
| 设备网关     | `DeviceGateway` 双房间隔离：admin 房间收全量遥测，public 房间仅收脱敏摘要（不含 host / 凭据 / 序列号）                              |
| 设备配置     | 真实设备接入信息存 PostgreSQL（仅管理员可见）；`config/devices.json`（含 IP/序列号/访问码）已 gitignore，仓库仅提交 `devices.example.json` 模板 |
| 激光结算     | 事务内原子扣款 + 状态条件更新（`WHERE status='in_use'` 防重复结算），核销码一次性使用（`WHERE status='approved'` 防并发重复核销）          |
| CORS      | `CORS_ORIGINS` 白名单（逗号分隔）；未配置时反射任意来源（仅开发）                                                           |
| Swagger   | 生产环境自动关闭 `/api-docs`                                                                               |
| 订单状态      | 状态机校验，非法迁移直接拒绝                                                                                     |
| 邮箱验证码    | 单邮箱每小时 5 次发送，单验证码 5 次尝试；验证码入库存 PostgreSQL（5 分钟有效 / 60 秒冷却 / 一次性使用），响应永不回传明文                          |
| 管理员改密     | HMAC-SHA256 签名的密钥文件（含时间戳 t + 签名 s），24 小时有效期                                                     |
| 操作审计      | 订单审核/设备命令/导出等管理操作全量记审计日志（含 IP/UA/参数）                                                          |
| 数据库凭据    | `server/.env` 已 gitignore；内嵌实例初始化使用随机密码；远程实例走环境变量注入                                          |

***

## 🎛 管理员密钥重置

当管理员忘记密码时，可通过密钥文件重置：

### 生成密钥文件

```bash
cd server
node scripts/gen-admin-key.js
# 生成 admin.key 文件（JSON 格式，含 Unix 时间戳 t 与 HMAC-SHA256 签名 s）
```

### 使用密钥文件重置密码

密钥文件生成后，调用（需先以任意管理员身份登录获取 JWT）：

```
POST /api/auth/admin/change-password
Authorization: Bearer <管理员token>
{
  "keyContent": "<admin.key 文件内容>",
  "newPassword": "new-password"
}
```

后端会同时校验：当前登录用户是管理员 + 密钥文件的签名与有效期（默认 24 小时），验证通过后重置密码。

> 普通用户的找回密码走 `POST /api/auth/reset-password`（邮箱 + 验证码方式，无需登录）。

***

## 📧 邮箱验证

平台支持邮箱验证码功能，用于注册邮箱验证 / 改密 / 找回密码等场景：

1. 用户提交邮箱 → 后端生成 6 位验证码（存入 PostgreSQL，5 分钟有效、60 秒重发冷却、一次性使用）
2. 若配置了 SMTP，则发送邮件；否则输出到控制台（演示模式）
3. 单邮箱每小时最多发送 5 次，单验证码最多尝试 5 次
4. 接口响应只返回 `{ sent: true }`，验证码永不回传明文

配置 SMTP 示例：

```env
SMTP_HOST=smtp.qq.com
SMTP_PORT=465
SMTP_SECURE=true
SMTP_USER=your-email@qq.com
SMTP_PASS=your-smtp-authorization-code
SMTP_FROM=创影3D <your-email@qq.com>
```

***

## 📦 部署说明

### 方式一：本地/裸机部署（开封即用）

后端与前端部署在校内本地主机（Windows / Linux 均可）。数据库由 `scripts/ensure-pg.js` 自动管理：本机无 PostgreSQL 时自动初始化内嵌实例（`server/.pgdata`），有则复用，也可指向外部实例。

```bash
# 1. 后端（首次启动自动完成数据库初始化 + 建表 + 默认管理员）
cd server
npm ci
npm run build
npm run start:prod     # NODE_ENV=production 需显式配置 JWT_SECRET 等（见下）

# 2. 前端（构建后由 nginx 或 serve 托管 dist）
cd web
npm ci
npm run build
```

> **生产环境前置检查**（`NODE_ENV=production` 时启动强制校验）：
>
> * 必须显式配置 `JWT_SECRET`（≥16 位随机串，否则启动失败）
>
> * 必须配置 `PRINT_CALLBACK_SECRET`（否则打印回调全部被拒绝）
>
> * 建议配置 `CORS_ORIGINS` 白名单（如 `https://print.campus.edu`）
>
> * 生产环境会自动关闭 Swagger（`/api-docs` 返回 404）

### 方式二：Docker Compose（PostgreSQL + 应用 + Nginx）

```bash
docker compose up -d --build         # postgres + server + nginx
docker compose -f docker-compose.monitoring.yml up -d   # 可选监控栈
```

### 方式三：PM2（单实例）

```bash
cd server && node scripts/ensure-pg.js && npm run build
pm2 start ../ecosystem.config.js
```

> **架构约定：平台按单实例设计**（进程内缓存 / 设备长连接 / WebSocket 广播均绑定单一 Node 进程），PM2 配置固定 fork 单实例，禁止 cluster 多实例——多实例会导致设备适配器重复连接与 WS 广播错乱；如需横向扩展需引入外部缓存/消息总线重构。

### Nginx 配置示例

```nginx
server {
    listen 80;
    server_name your-domain;

    root /path/to/web/dist;
    index index.html;

    location / {
        try_files $uri $uri/ /index.html;
    }

    location /api/ {
        proxy_pass http://127.0.0.1:8731;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
    }

    location /socket.io/ {
        proxy_pass http://127.0.0.1:8731;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
    }
}
```

### 数据目录与备份

* 数据库：PostgreSQL（内嵌实例数据目录 `server/.pgdata/`，或外部实例），建议用 `pg_dump` 定期备份：

```bash
# 内嵌实例自动读取 server/.env 凭据
node scripts/backup-db.js
# 输出: server/data/backups/campus-print-YYYYMMDD-*.sql.gz（保留最近 30 天）
```

* 上传模型：`server/data/uploads/`

* 打印任务：`server/data/print-tasks/`

* 用户头像：`server/data/avatars/`

* 模型缩略图：`server/data/thumbnails/`

* 应用日志：`server/data/logs/`

***

## 🔧 可扩展点

| 方向          | 说明                                                                                        |
| ----------- | ----------------------------------------------------------------------------------------- |
| **耗材管理**    | 将 `material` 配置迁移至数据库 `materials` 表，支持多耗材选择与切换                                            |
| **打印排期**    | 打印业务可复用激光预约模式，扩展时间段预约                                                                      |
| **消息通知**    | 接入站内信 / 企业微信通知订单状态变更                                                                       |
| **更多设备协议**   | 实现 `DeviceAdapter` 接口即可接入新品牌（参考 `bambu/creality.adapter.ts`）；EufyMake 若官方开放 API 可无痛升级探活适配器         |
| **Bambu 摄像头** | 摄像头帧流转发到管理端（局域网 RTSP/HTTP 流）                                                             |
| **3D 预览增强** | 支持模型剖切、测量、多材质预览                                                                           |
| **多文件打包**   | 支持上传 ZIP 批量模型                                                                             |
| **支付对接**    | 接入校园卡 / 微信支付替代虚拟余额                                                                        |

***

## ❓ 常见问题

**Q: 首次启动需要装数据库吗？**
A: 不需要。`scripts/ensure-pg.js` 会在 `npm start` 时自动探测：本机无可用 PostgreSQL 时自动初始化内嵌实例（`server/.pgdata`）并创建账号库表；配置文件 `server/.env` 自动生成（已 gitignore）。生产环境建议显式提供 PostgreSQL 实例（本机安装或云数据库，配置 `PG_*` 环境变量）。

**Q: 提示连接 PostgreSQL 失败 / 端口 5432 被占用？**
A: 检查 `server/.env` 的 `PG_*` 配置；若本机 5432 有其他 PostgreSQL 实例占用，可在 `.env` 中改 `PG_PORT` 并删除 `server/.pgdata` 重新初始化，或直接指向已有实例（修改 `PG_HOST/PG_PORT/PG_USER/PG_PASSWORD/PG_DATABASE`）。

**Q: 前端请求后端报 CORS 错误？**
A: 开发模式下 Vite 已配置代理（`/api` → `localhost:8731`）。生产环境请通过 Nginx 反向代理，确保前后端同域；若需跨域部署，配置 `CORS_ORIGINS` 白名单（逗号分隔多个来源）。

**Q: 生产环境启动报"JWT\_SECRET 必须显式配置"？**
A: 安全设计——生产环境（`NODE_ENV=production`）禁止使用默认密钥。用 `openssl rand -hex 32` 生成随机密钥配置到环境变量即可。

**Q: 生产环境打印机回调一直返回 401？**
A: 生产环境必须配置 `PRINT_CALLBACK_SECRET` 并在回调请求头携带 `x-callback-secret: <相同的值>`。

**Q: 生产环境 /api-docs 打不开（404）？**
A: 正常现象，生产环境自动关闭 Swagger 防止接口结构泄露。开发环境（`NODE_ENV=development`）正常访问 <http://localhost:8731/api-docs>。

**Q: 管理后台设备显示离线，但设备其实开着？**
A: 设备断线看门狗（12s 无报文判离线）驱动。检查设备网络连通性与交换机、确认设备协议端口（Bambu 8883 / Creality 9999 / xTool 28900 或 8080 / EufyMake 9900）未被防火墙拦截。

**Q: 管理员密码忘了怎么办？**
A: 使用 `node scripts/gen-admin-key.js` 生成密钥文件，以任意管理员身份登录后调用 `/api/auth/admin/change-password`（携带 keyContent + newPassword）重置。

**Q: 邮箱验证码没收到？**
A: 未配置 SMTP 时验证码会输出到后端控制台。生产环境请配置 SMTP 环境变量。

**Q: 模型体积计算不准？**
A: 体积解析基于三角网格积分，要求 STL 文件为封闭网格。非封闭或自相交模型可能有误差。

**Q: 如何修改计价参数？**
A: 通过环境变量 `MATERIAL_DENSITY`、`MATERIAL_PRICE`、`INFILL_RATE` 修改（前端耗材配置实时拉取 `/api/config/material`）。

**Q: 激光预约设备被无主会话占用怎么释放？**
A: 管理端「激光工坊」对 pending_review / approved（未核销）会话可直接“驳回”释放设备，in_use 会话可“强制结束”；核实无人使用后操作即可。

***

## 👨‍💻 关于作者

**黄宇普** · 川北医学院

本项目为校内创意室 3D 打印自助服务平台，从需求分析、架构设计到前后端开发、UI 动效均由本人独立完成。

* 学校：川北医学院

* 方向：全栈开发 / 3D 打印 / 创意造物

* 项目定位：面向校内学生与管理员的封闭式 3D 打印自助服务平台

***

## 📄 开源协议 (License)

本项目代码基于 **MIT License** 开源。

***

## 免责声明

本网站及其内容仅供展示。真正商业必须由个人实践。
相关代码仅供参考，
我不对任何基于本系统的后果承担法律责任。

***

## 如何引用

如果您在项目中使用了本网站的设计或代码，请遵循以下格式引用：

```bibtex
@misc{huang2026chuangyingweb,
  author = {Yupu Huang},
  title = {ChuangYing 3D Web Platform: 3D Printing Smart Ordering System},
  year = {2026},
  publisher = {GitHub},
  journal = {GitHub repository},
  howpublished = {\url{https://github.com/Yao-Shun-Ya/Chuang-Ying-3D-Web}}
}
```

***

## 🤝 致谢

* [NestJS](https://nestjs.com/) - 后端框架

* [Vue 3](https://vuejs.org/) - 前端框架

* [Three.js](https://threejs.org/) - 3D 渲染

* [PostgreSQL](https://www.postgresql.org/) - 数据库

* [Aceternity UI](https://ui.aceternity.com/) - 动效灵感

* 我自己 - 真的很累也花了很多时间