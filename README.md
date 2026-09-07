# 创影 3D · 校内 3D 打印自助服务平台

<p align="center">
  <a href="https://github.com/Yao-Shun-Ya/Chuang-Ying-3D-Web"><img src="https://img.shields.io/badge/GitHub-ChuangYing%203D-181717?style=for-the-badge&logo=github&logoColor=white" alt="GitHub"></a>
  <a href="https://vuejs.org/"><img src="https://img.shields.io/badge/Vue.js-3.4-42B883?style=for-the-badge&logo=vuedotjs&logoColor=white" alt="Vue.js"></a>
  <a href="https://vitejs.dev/"><img src="https://img.shields.io/badge/Vite-5.0-646CFF?style=for-the-badge&logo=vite&logoColor=white" alt="Vite"></a>
  <a href="https://www.typescriptlang.org/"><img src="https://img.shields.io/badge/TypeScript-5.3-3178C6?style=for-the-badge&logo=typescript&logoColor=white" alt="TypeScript"></a>
  <a href="https://tailwindcss.com/"><img src="https://img.shields.io/badge/Tailwind%20CSS-4.0-06B6D4?style=for-the-badge&logo=tailwindcss&logoColor=white" alt="Tailwind CSS"></a>
  <a href="https://threejs.org/"><img src="https://img.shields.io/badge/Three.js-0.185-000000?style=for-the-badge&logo=threedotjs&logoColor=white" alt="Three.js"></a>
  <a href="https://nestjs.com/"><img src="https://img.shields.io/badge/NestJS-10-E0234E?style=for-the-badge&logo=nestjs&logoColor=white" alt="NestJS"></a>
  <a href="https://nodejs.org/"><img src="https://img.shields.io/badge/Node.js-22-339933?style=for-the-badge&logo=nodedotjs&logoColor=white" alt="Node.js"></a>
  <a href="https://www.sqlite.org/"><img src="https://img.shields.io/badge/SQLite-003B57?style=for-the-badge&logo=sqlite&logoColor=white" alt="SQLite"></a>
  <img src="https://img.shields.io/badge/License-MIT-yellow.svg?style=for-the-badge" alt="License">
</p>

> 让创意，触手可及。

面向校内在校学生与创意室管理员的 **封闭式 3D 打印自助服务 Web 平台**。学生上传模型 → 系统自动解析体积并计价 → CDK 充值 → 下单 → 管理员审核 → 打印下发 → 取件，全流程线上化。采用前后端分离、轻量模块化架构，一键部署在校内常驻主机。

***

## 目录

* [✨ 核心功能](#-核心功能)

* [🎨 UI / 动效亮点](#-ui--动效亮点)

* [🛠 技术栈](#-技术栈)

* [🚀 快速启动](#-快速启动)

* [⚙️ 环境变量配置](#️-环境变量配置)

* [📁 项目结构](#-项目结构)

* [📦 模块职责](#-模块职责)

* [🗄 数据库设计](#-数据库设计)

* [💡 核心业务逻辑](#-核心业务逻辑)

* [🌐 API 接口一览](#-api-接口一览)

* [🔐 安全机制](#-安全机制)

* [🎛 管理员密钥重置](#-管理员密钥重置)

* [📧 邮箱验证](#-邮箱验证)

* [📦 部署说明](#-部署说明)

* [🔧 可扩展点](#-可扩展点)

* [❓ 常见问题](#-常见问题)

***

## ✨ 核心功能

### 学生端

| 功能      | 说明                                              |
| ------- | ----------------------------------------------- |
| 注册 / 登录 | 学号注册，bcrypt 密码哈希，JWT 鉴权                         |
| CDK 充值  | 输入 CDK 兑换码，自动增加虚拟余额，防重复兑换                       |
| 资金流水    | 充值 / 扣费 / 退款全记录，操作后余额可追溯                        |
| 模型上传    | 支持 STL / OBJ / 3MF，自动校验格式与大小                    |
| 体积解析    | 三角网格积分算法，精准计算模型体积                               |
| 费用估算    | 体积 × 填充率 × 耗材密度 × 单价，实时计价                       |
| 3D 预览   | Three.js 渲染，Unity 风格相机控制（WASD 移动 / 中键旋转 / 滚轮缩放） |
| 在线下单    | 余额校验 + 扣费事务，订单状态实时推送                            |
| 订单跟踪    | WebSocket 实时推送状态变更，全程可见                         |

### 管理员端

| 功能     | 说明                                                             |
| ------ | -------------------------------------------------------------- |
| 仪表盘    | 订单 / 收入 / 用户 数据概览                                              |
| CDK 管理 | 批量生成兑换码，指定面值与数量                                                |
| 订单审核   | 查看全部订单、模型预览、审核通过 / 驳回（自动退款）                                    |
| 状态流转   | pending\_review → approved → printing → completed → picked\_up |
| 流水对账   | 全部资金流水，支持 CSV 导出                                               |
| 用户管理   | 查看用户列表与余额                                                      |
| 打印下发   | 审核通过后自动复制模型到打印目录 + 生成 task.json                                |

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
| 数据库   | SQLite（Node.js 内置 `node:sqlite`，单文件零配置）   |
| 文件存储  | 本地磁盘                                      |
| 鉴权    | JWT (Passport) + bcryptjs                 |
| 邮件    | Nodemailer（可选）                            |
| 加密    | bcryptjs / HMAC-SHA256                    |

***

## 🚀 快速启动

> **环境要求**：Node.js >= 22（需支持 `node:sqlite`，使用 `--experimental-sqlite` 标志）

### 1. 克隆仓库

```bash
git clone <your-repo-url>
cd ChuangYingWeb
```

### 2. 启动后端

```bash
cd server
npm install
npm run start:dev        # 开发模式（ts-node + --experimental-sqlite）
```

后端默认监听 `http://localhost:8731/api`，启动时自动：

* 创建 `data/campus-print.db` SQLite 数据库并建表

* 创建默认管理员账号 `admin / admin123`（可通过环境变量修改）

* 创建必要的存储目录（uploads / print-tasks / avatars）

### 3. 启动前端

```bash
cd web
npm install
npm run dev              # 开发模式 http://localhost:8732
```

前端已配置 Vite 代理，`/api` 与 `/socket.io` 自动转发到后端 8731 端口，无需额外配置 CORS。

### 4. 访问

* 首页：<http://localhost:8732>

* 管理员登录：使用 `admin / admin123`

* 学生注册：<http://localhost:8732/register>

***

## ⚙️ 环境变量配置

在 `server/` 目录下创建 `.env` 文件（或直接设置系统环境变量），所有变量均有默认值：

| 变量                           | 默认值                               | 说明                     |
| ---------------------------- | --------------------------------- | ---------------------- |
| `PORT`                       | `8731`                            | 后端端口                   |
| `JWT_SECRET`                 | `campus-3d-print-secret-key-2026` | JWT 签名密钥（**生产环境务必修改**） |
| `UPLOAD_DIR`                 | `data/uploads`                    | 模型上传目录                 |
| `PRINT_TASK_DIR`             | `data/print-tasks`                | 打印任务输出目录               |
| `DB_FILE`                    | `data/campus-print.db`            | SQLite 数据库文件路径         |
| `MATERIAL_DENSITY`           | `1.24`                            | 耗材密度 g/cm³（PLA）        |
| `MATERIAL_PRICE`             | `0.5`                             | 耗材单价 元/g               |
| `INFILL_RATE`                | `0.2`                             | 默认填充率 0\~1             |
| `UPLOAD_MAX_MB`              | `50`                              | 单文件最大体积 MB             |
| `PRINT_CALLBACK_URL`         | _(空)_                             | 线下打印主机 HTTP 回调地址       |
| `ADMIN_USER`                 | `admin`                           | 默认管理员用户名               |
| `ADMIN_PASS`                 | `admin123`                        | 默认管理员密码                |
| `ADMIN_EMAIL`                | `admin@campus.edu`                | 默认管理员邮箱                |
| `ADMIN_KEY_SECRET`           | `chuangying-admin-key-2026`       | 管理员密钥文件签名密钥            |
| `ADMIN_KEY_TTL_HOURS`        | `24`                              | 管理员密钥文件有效期（小时）         |
| `EMAIL_CODE_TTL`             | `5`                               | 邮箱验证码有效期（分钟）           |
| `EMAIL_CODE_RESEND_COOLDOWN` | `60`                              | 验证码重发冷却（秒）             |
| `EMAIL_CODE_MAX_SEND`        | `5`                               | 单邮箱每小时最大发送次数           |
| `EMAIL_CODE_MAX_ATTEMPTS`    | `5`                               | 单验证码最大验证尝试次数           |
| `SMTP_HOST`                  | _(空)_                             | SMTP 服务器地址             |
| `SMTP_PORT`                  | `465`                             | SMTP 端口                |
| `SMTP_SECURE`                | `true`                            | 是否使用 SSL               |
| `SMTP_USER`                  | _(空)_                             | SMTP 用户名               |
| `SMTP_PASS`                  | _(空)_                             | SMTP 密码                |
| `SMTP_FROM`                  | _(空)_                             | 发件人地址                  |

> **提示**：未配置 SMTP 时，邮箱验证码会输出到后端控制台，便于本地测试。

***

## 📁 项目结构

```
ChuangYingWeb/
├── server/                      # 后端 NestJS
│   ├── src/
│   │   ├── main.ts              # 入口，全局管道 / CORS / 前缀 / Swagger
│   │   ├── app.module.ts        # 模块装配
│   │   ├── config/
│   │   │   └── configuration.ts # 全局配置（耗材 / 路径 / JWT / 管理员 / SMTP）
│   │   ├── database/
│   │   │   ├── database.module.ts
│   │   │   └── database.service.ts   # node:sqlite 封装 + 自动建表 + 事务
│   │   ├── common/
│   │   │   ├── decorators/      # @Roles、@CurrentUser
│   │   │   └── guards/          # JwtAuthGuard、RolesGuard
│   │   ├── types/
│   │   │   └── node-sqlite.d.ts # node:sqlite 类型声明
│   │   └── modules/
│   │       ├── auth/            # 注册 / 登录 / JWT / bcrypt / 邮箱验证
│   │       ├── user/            # 用户实体与服务
│   │       ├── cdk/             # CDK 生成 / 兑换 / 余额 / 流水
│   │       ├── transaction/     # 资金流水记录与 CSV 导出
│   │       ├── model/           # 模型上传 / 体积解析 / 费用估算
│   │       ├── order/           # 订单状态机 / 审核 / 日志 / WebSocket
│   │       └── print/           # 打印任务下发 / 硬件对接扩展接口
│   ├── scripts/
│   │   └── gen-admin-key.js     # 管理员密钥文件生成脚本
│   └── data/                    # 运行时生成（db、uploads、print-tasks、avatars）
│
├── web/                         # 前端 Vue3
│   └── src/
│       ├── api/                 # axios 封装与全部接口
│       ├── router/              # 路由与鉴权守卫
│       ├── stores/              # Pinia user store
│       ├── layouts/             # MainLayout / AdminLayout
│       ├── components/
│       │   ├── effects/         # 动效组件（Vortex / Typewriter / TextHoverEffect ...）
│       │   ├── ui/              # 基础 UI（Button / Input / Card / Dialog ...）
│       │   ├── ModelViewer.vue  # Three.js 3D 模型查看器
│       │   └── ThreeScene.vue   # 首页 3D 场景
│       ├── composables/         # useAnimation / useToast
│       ├── directives/          # v-reveal 滚动揭示指令
│       └── views/
│           ├── Home.vue         # 首页（Hero + 流程 + 特点 + CTA）
│           ├── Help / FAQ / Pickup.vue
│           ├── Login / Register.vue
│           ├── student/         # 学生端：Balance / Upload / Orders / Account
│           └── admin/           # 管理员：Dashboard / CdkManage / OrderReview / Transactions / Users
│
├── test-models/                 # 测试用模型文件（cube_10mm.stl）
└── README.md
```

***

## 📦 模块职责

| 模块                 | 职责                                                                           |
| ------------------ | ---------------------------------------------------------------------------- |
| **Auth & User**    | 用户注册 / 登录、bcrypt 密码哈希、JWT 签发与校验、邮箱验证码、个人信息、角色区分 (student / admin)            |
| **CDK**            | 管理员批量生成唯一 CDK（面值 / 状态 / 兑换人 / 时间）；学生兑换 CDK 增加余额；防重复兑换                        |
| **Transaction**    | 统一资金流水（recharge / deduct / refund），记录操作后余额，支持管理员 CSV 导出对账                    |
| **Model**          | STL / OBJ / 3MF 上传（后缀 + 大小安全校验）、STL 三角网格体积解析、耗材费用估算                          |
| **Order**          | 订单创建（余额校验 + 扣费）、状态机流转、订单日志、WebSocket 状态推送                                    |
| **Review (Admin)** | 全部订单查看、模型预览、审核通过（触发打印下发）/ 驳回（退款）、状态流转操作                                      |
| **Print**          | 审核通过后将模型复制到本地打印目录 + 生成 task.json；预留 HTTP 回调钩子与 `PrintDeviceInterface` 硬件对接接口 |
| **WebSocket**      | `OrderGateway` 订单状态实时推送，前端连接 `/orders` 命名空间监听 `order:status_changed`         |
| **Static**         | 首页、使用帮助、FAQ、取件须知静态页面                                                         |

***

## 🗄 数据库设计

### users 用户表

| 字段                        | 类型          | 说明              |
| ------------------------- | ----------- | --------------- |
| id                        | INTEGER PK  | 主键              |
| username                  | TEXT UNIQUE | 用户名             |
| password\_hash            | TEXT        | bcrypt 哈希       |
| role                      | TEXT        | student / admin |
| real\_name / student\_no  | TEXT        | 姓名、学号           |
| email                     | TEXT        | 邮箱              |
| balance                   | REAL        | 虚拟余额            |
| created\_at / updated\_at | TEXT        | 时间戳             |

### cdks CDK 兑换码表

| 字段           | 类型               | 说明            |
| ------------ | ---------------- | ------------- |
| id           | INTEGER PK       | <br />        |
| code         | TEXT UNIQUE      | 12 位唯一兑换码     |
| value        | REAL             | 面值            |
| status       | TEXT             | unused / used |
| created\_at  | TEXT             | 生成时间          |
| redeemed\_by | INTEGER FK→users | 兑换用户          |
| redeemed\_at | TEXT             | 兑换时间          |

### transactions 资金流水表

| 字段             | 类型         | 说明                         |
| -------------- | ---------- | -------------------------- |
| id             | INTEGER PK | <br />                     |
| user\_id       | INTEGER FK | 用户                         |
| type           | TEXT       | recharge / deduct / refund |
| amount         | REAL       | 金额（正数）                     |
| balance\_after | REAL       | 操作后余额                      |
| related\_id    | INTEGER    | 关联订单 / CDK                 |
| remark         | TEXT       | 备注                         |
| created\_at    | TEXT       | 时间                         |

### models 模型文件表

| 字段                        | 类型         | 说明              |
| ------------------------- | ---------- | --------------- |
| id                        | INTEGER PK | <br />          |
| user\_id                  | INTEGER FK | 上传者             |
| filename / original\_name | TEXT       | 存储名 / 原始名       |
| file\_path                | TEXT       | 本地路径            |
| file\_size                | INTEGER    | 字节              |
| format                    | TEXT       | stl / obj / 3mf |
| volume                    | REAL       | 体积 cm³          |
| estimated\_cost           | REAL       | 预估费用 元          |
| created\_at               | TEXT       | <br />          |

### orders 订单表

| 字段                        | 类型          | 说明                                                                        |
| ------------------------- | ----------- | ------------------------------------------------------------------------- |
| id                        | INTEGER PK  | <br />                                                                    |
| order\_no                 | TEXT UNIQUE | 订单号                                                                       |
| user\_id / model\_id      | INTEGER FK  | <br />                                                                    |
| volume / cost             | REAL        | 体积、费用                                                                     |
| status                    | TEXT        | pending\_review / rejected / approved / printing / completed / picked\_up |
| reject\_reason            | TEXT        | 驳回理由                                                                      |
| created\_at / updated\_at | TEXT        | <br />                                                                    |

### order\_logs 订单状态日志表

| 字段                        | 类型         | 说明     |
| ------------------------- | ---------- | ------ |
| id                        | INTEGER PK | <br /> |
| order\_id                 | INTEGER FK | <br /> |
| from\_status / to\_status | TEXT       | 状态迁移   |
| operator\_id              | INTEGER    | 操作人    |
| remark                    | TEXT       | <br /> |
| created\_at               | TEXT       | <br /> |

### email\_codes 邮箱验证码表

| 字段          | 类型         | 说明                            |
| ----------- | ---------- | ----------------------------- |
| id          | INTEGER PK | <br />                        |
| email       | TEXT       | 邮箱                            |
| code        | TEXT       | 验证码                           |
| purpose     | TEXT       | 用途（register / reset / verify） |
| expires\_at | TEXT       | 过期时间                          |
| attempts    | INTEGER    | 已尝试次数                         |
| created\_at | TEXT       | <br />                        |

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

### 2. 费用估算

```
费用(元) = 体积(cm³) × 填充率 × 耗材密度(g/cm³) × 单价(元/g)
默认：填充率 0.2，PLA 密度 1.24 g/cm³，单价 0.5 元/g
```

### 3. CDK 兑换（事务 + 防重复）

```typescript
// server/src/modules/cdk/cdk.service.ts
redeem(code, userId) {
  const cdk = db.get('SELECT * FROM cdks WHERE code = ?', [code]);
  if (!cdk) throw new NotFoundException('CDK 不存在');
  if (cdk.status === 'used') throw new BadRequestException('CDK 已被使用');
  const newBalance = user.balance + cdk.value;
  this.db.transaction(() => {
    db.prepare(`UPDATE cdks SET status='used', redeemed_by=?, redeemed_at=datetime('now','localtime') WHERE id=?`)
      .run(userId, cdk.id);
    userService.updateBalance(userId, newBalance);
    txService.record({ userId, type: 'recharge', amount: cdk.value, balanceAfter: newBalance, relatedId: cdk.id });
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

### 5. 下单扣费（余额校验 + 事务）

```typescript
// server/src/modules/order/order.service.ts
createOrder(userId, modelId) {
  const model = modelService.findById(modelId);
  const user = userService.findById(userId);
  if (user.balance < model.estimated_cost)
    throw new BadRequestException('余额不足');
  const newBalance = +(user.balance - model.estimated_cost).toFixed(2);
  this.db.transaction(() => {
    userService.updateBalance(userId, newBalance);
    const orderId = insertOrder(...);
    txService.record({ type: 'deduct', amount: cost, balanceAfter: newBalance, relatedId: orderId });
    insertOrderLog({ to_status: 'pending_review', operatorId: userId });
  });
}
```

### 6. 打印任务下发

```typescript
// server/src/modules/print/print-dispatch.service.ts
async dispatch(order) {
  // 1. 复制模型到 print-tasks/<orderNo>/
  copyFileSync(model.file_path, join(taskDir, model.original_name));
  // 2. 生成 task.json（订单号、模型路径、体积、耗材参数）
  writeFileSync(join(taskDir, 'task.json'), JSON.stringify(task));
  // 3. HTTP 回调钩子（PRINT_CALLBACK_URL 非空时通知线下主机）
  if (callbackUrl) await fetch(callbackUrl, { method: 'POST', body: JSON.stringify(task) });
  // 4. 硬件对接扩展点
  if (this.device) await this.device.sendTask(task);
}
```

***

## 🌐 API 接口一览

### 认证 Auth

| 方法   | 路径                         | 说明                | 权限 |
| ---- | -------------------------- | ----------------- | -- |
| POST | `/api/auth/register`       | 注册（用户名 + 密码 + 学号） | 公开 |
| POST | `/api/auth/login`          | 登录，返回 JWT         | 公开 |
| GET  | `/api/auth/me`             | 获取当前用户信息          | 登录 |
| POST | `/api/auth/send-code`      | 发送邮箱验证码           | 公开 |
| POST | `/api/auth/verify-code`    | 验证邮箱验证码           | 公开 |
| POST | `/api/auth/reset-password` | 通过密钥文件重置管理员密码     | 公开 |

### CDK

| 方法   | 路径                      | 说明                | 权限    |
| ---- | ----------------------- | ----------------- | ----- |
| POST | `/api/cdk/generate`     | 批量生成 CDK（面值 + 数量） | admin |
| POST | `/api/cdk/redeem`       | 兑换 CDK 充值         | 登录    |
| GET  | `/api/cdk/balance`      | 查询余额              | 登录    |
| GET  | `/api/cdk/transactions` | 我的资金流水            | 登录    |

### 模型 Model

| 方法   | 路径                     | 说明                        | 权限 |
| ---- | ---------------------- | ------------------------- | -- |
| POST | `/api/models/upload`   | 上传模型（multipart/form-data） | 登录 |
| GET  | `/api/models/:id`      | 获取模型信息                    | 登录 |
| GET  | `/api/models/:id/file` | 下载模型文件                    | 登录 |

### 订单 Order

| 方法   | 路径                 | 说明                               | 权限 |
| ---- | ------------------ | -------------------------------- | -- |
| POST | `/api/orders`      | 创建订单（modelId）                    | 登录 |
| GET  | `/api/orders/mine` | 我的订单列表                           | 登录 |
| GET  | `/api/orders/:id`  | 订单详情                             | 登录 |
| WS   | `/orders`          | 订单状态实时推送（`order:status_changed`） | 登录 |

### 管理员 Admin

| 方法   | 路径                               | 说明                                      | 权限    |
| ---- | -------------------------------- | --------------------------------------- | ----- |
| GET  | `/api/admin/orders`              | 全部订单列表                                  | admin |
| POST | `/api/admin/orders/:id/approve`  | 审核通过（触发打印下发）                            | admin |
| POST | `/api/admin/orders/:id/reject`   | 审核驳回（自动退款）                              | admin |
| POST | `/api/orders/:id/status`         | 状态流转（printing / completed / picked\_up） | admin |
| GET  | `/api/admin/transactions`        | 全部资金流水                                  | admin |
| GET  | `/api/admin/transactions/export` | 流水导出 CSV                                | admin |
| GET  | `/api/admin/users`               | 用户列表                                    | admin |
| GET  | `/api/admin/dashboard`           | 仪表盘统计数据                                 | admin |

***

## 🔐 安全机制

| 机制     | 实现                                      |
| ------ | --------------------------------------- |
| 密码存储   | bcryptjs 哈希，cost factor = 10            |
| 鉴权     | JWT (HS256)，有效期 7 天，Passport 策略校验       |
| 角色权限   | `@Roles('admin')` 装饰器 + `RolesGuard` 守卫 |
| 余额操作   | SQLite 事务包裹，扣费 / 退款 / 流水原子性             |
| 文件上传   | 后缀白名单（stl/obj/3mf）+ 大小限制（默认 50MB）       |
| CDK 防重 | 兑换时检查 status，事务内更新                      |
| 订单状态   | 状态机校验，非法迁移直接拒绝                          |
| 邮箱限流   | 单邮箱每小时 5 次发送，单验证码 5 次尝试                 |
| 管理员改密  | HMAC-SHA256 签名的密钥文件，24 小时有效期            |

***

## 🎛 管理员密钥重置

当管理员忘记密码时，可通过密钥文件重置：

### 生成密钥文件

```bash
cd server
node scripts/gen-admin-key.js
# 生成 admin.key 文件（JSON 格式，含 HMAC-SHA256 签名）
```

### 使用密钥文件重置密码

将 `admin.key` 文件放到 `server/` 目录下，调用：

```
POST /api/auth/reset-password
{
  "newPassword": "new-password"
}
```

后端会验证密钥文件的签名与有效期（默认 24 小时），验证通过后重置管理员密码。

***

## 📧 邮箱验证

平台支持邮箱验证码功能，用于注册邮箱验证等场景：

1. 用户提交邮箱 → 后端生成 6 位验证码
2. 若配置了 SMTP，则发送邮件；否则输出到控制台
3. 验证码有效期 5 分钟，重发冷却 60 秒
4. 单邮箱每小时最多发送 5 次，单验证码最多尝试 5 次

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

### 生产部署

将 `server/` 与 `web/` 部署在校内本地主机：

```bash
# 1. 后端
cd server
npm ci
npm run build
node --experimental-sqlite dist/main

# 2. 前端（构建后由 nginx 或 serve 托管 dist）
cd web
npm ci
npm run build
# 将 web/dist 交由 nginx 托管，配置 /api 反向代理到后端
```

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

### 数据目录

* 数据库：`server/data/campus-print.db`（SQLite 单文件，定期备份）

* 上传模型：`server/data/uploads/`

* 打印任务：`server/data/print-tasks/`

* 用户头像：`server/data/avatars/`

***

## 🔧 可扩展点

| 方向          | 说明                                                                                        |
| ----------- | ----------------------------------------------------------------------------------------- |
| **耗材管理**    | 将 `material` 配置迁移至数据库 `materials` 表，支持多耗材选择与切换                                            |
| **预约排期**    | 新增 `reservations` 表与排期模块，支持打印时间段预约                                                        |
| **消息通知**    | 接入站内信 / 邮件 / 企业微信通知订单状态变更                                                                 |
| **硬件对接**    | 实现 `PrintDeviceInterface` 接口，通过 `printDispatch.registerDevice()` 注入，支持 OctoPrint / 厂商 API |
| **3D 预览增强** | 支持模型剖切、测量、多材质预览                                                                           |
| **多文件打包**   | 支持上传 ZIP 批量模型                                                                             |
| **支付对接**    | 接入校园卡 / 微信支付替代虚拟余额                                                                        |

***

## ❓ 常见问题

**Q: 启动后端报错** **`Cannot find module 'node:sqlite'`？**
A: 需要 Node.js >= 22，并使用 `--experimental-sqlite` 标志。`package.json` 的脚本已包含该标志。

**Q: 前端请求后端报 CORS 错误？**
A: 开发模式下 Vite 已配置代理（`/api` → `localhost:8731`）。生产环境请通过 Nginx 反向代理，确保前后端同域。

**Q: 管理员密码忘了怎么办？**
A: 使用 `node scripts/gen-admin-key.js` 生成密钥文件，放到 `server/` 目录后调用 `/api/auth/reset-password` 重置。

**Q: 邮箱验证码没收到？**
A: 未配置 SMTP 时验证码会输出到后端控制台。生产环境请配置 SMTP 环境变量。

**Q: 模型体积计算不准？**
A: 体积解析基于三角网格积分，要求 STL 文件为封闭网格。非封闭或自相交模型可能有误差。

**Q: 如何修改计价参数？**
A: 通过环境变量 `MATERIAL_DENSITY`、`MATERIAL_PRICE`、`INFILL_RATE` 修改，或直接改 `server/src/config/configuration.ts`。

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
本网站及其内容仅供学术展示与软件分发平台。医疗诊断必须由具备执业资质的医师做出。
相关软件及 AI 模型输出结果仅供科研与临床辅助参考，
开发团队对任何基于本系统的直接医疗干预后果不承担法律责任。

***

## 如何引用
如果您在项目中使用了本网站的设计或代码，请遵循以下格式引用：

```bibtex
@misc{huang2026xianeryijianweb,
  author = {Yupu Huang},
  title = {XianErYiJian Web Platform: Medical Imaging AI Visualization and Distribution System},
  year = {2026},
  publisher = {GitHub},
  journal = {GitHub repository},
  howpublished = {\url{https://github.com/Yao-Shun-Ya/Xian-Er-Yi-Jian-Web}}
}
```

***

## 🤝 致谢

* [NestJS](https://nestjs.com/) - 后端框架

* [Vue 3](https://vuejs.org/) - 前端框架

* [Three.js](https://threejs.org/) - 3D 渲染

* [Aceternity UI](https://ui.aceternity.com/) - 动效灵感

* 我自己 - 真的很累也花了很多时间
