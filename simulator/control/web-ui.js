/** 控制台 Web UI（单文件 HTML，无外部依赖） */
function renderUi(types) {
  const typeOptions = Object.entries(types)
    .map(([k, v]) => `<option value="${k}">${v.label}</option>`)
    .join('');
  const modelScripts = Object.entries(types)
    .map(([k, v]) => `MODELS['${k}'] = ${JSON.stringify(v.models)};`)
    .join('');

  return `<!DOCTYPE html>
<html lang="zh-CN">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>创影3D · 设备模拟器控制台</title>
<style>
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body {
    font-family: -apple-system, "Segoe UI", "PingFang SC", "Microsoft YaHei", sans-serif;
    background: linear-gradient(160deg, #f6f7fb 0%, #eef1f8 100%);
    min-height: 100vh; color: #1e293b; padding: 32px 24px;
  }
  .wrap { max-width: 1100px; margin: 0 auto; }
  header { display: flex; align-items: center; gap: 14px; margin-bottom: 28px; }
  .logo { width: 44px; height: 44px; border-radius: 12px; background: linear-gradient(135deg, #6366f1, #8b5cf6);
    display: flex; align-items: center; justify-content: center; color: #fff; font-weight: 700; font-size: 18px; }
  h1 { font-size: 22px; }
  .sub { color: #64748b; font-size: 13px; margin-top: 2px; }
  .card { background: #fff; border-radius: 16px; border: 1px solid #e2e8f0; box-shadow: 0 2px 8px rgba(15,23,42,.04); }
  .pad { padding: 22px; }
  h2 { font-size: 15px; margin-bottom: 14px; display: flex; align-items: center; gap: 8px; }
  h2 .dot { width: 8px; height: 8px; border-radius: 99px; background: linear-gradient(135deg,#6366f1,#8b5cf6); }
  .form-row { display: flex; flex-wrap: wrap; gap: 12px; align-items: flex-end; }
  .field { display: flex; flex-direction: column; gap: 5px; }
  .field label { font-size: 12px; color: #64748b; }
  select, input[type=text], input[type=number] {
    border: 1px solid #d7dde8; border-radius: 9px; padding: 8px 12px; font-size: 13px;
    background: #f8fafc; min-width: 150px; outline: none; transition: border .15s;
  }
  select:focus, input:focus { border-color: #818cf8; background: #fff; }
  .btn { border: none; border-radius: 9px; padding: 9px 18px; font-size: 13px; cursor: pointer; font-weight: 500; transition: all .15s; }
  .btn-primary { background: linear-gradient(135deg, #6366f1, #8b5cf6); color: #fff; }
  .btn-primary:hover { filter: brightness(1.08); }
  .btn-primary:disabled { opacity: .5; cursor: not-allowed; }
  .btn-sm { padding: 5px 11px; font-size: 12px; border-radius: 7px; }
  .btn-ghost { background: #f1f5f9; color: #475569; }
  .btn-ghost:hover { background: #e2e8f0; }
  .btn-danger { background: #fef2f2; color: #dc2626; }
  .btn-danger:hover { background: #fee2e2; }
  .grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(310px, 1fr)); gap: 16px; }
  .dev-head { display: flex; justify-content: space-between; align-items: flex-start; gap: 8px; }
  .dev-name { font-weight: 600; font-size: 14px; }
  .dev-meta { font-size: 12px; color: #64748b; margin-top: 3px; }
  .tag { display: inline-flex; align-items: center; gap: 5px; padding: 3px 10px; border-radius: 99px; font-size: 11px; font-weight: 600; }
  .tag.on { background: #ecfdf5; color: #059669; }
  .tag.off { background: #f1f5f9; color: #94a3b8; }
  .tag .pulse { width: 6px; height: 6px; border-radius: 99px; background: #10b981; animation: pulse 1.6s infinite; }
  .tag.off .pulse { background: #94a3b8; animation: none; }
  @keyframes pulse { 0%,100% { opacity: 1; } 50% { opacity: .35; } }
  .state { display: inline-block; padding: 2px 9px; border-radius: 6px; font-size: 11px; font-weight: 600; margin-top: 8px; }
  .st-idle { background: #eff6ff; color: #2563eb; }
  .st-working, .st-finishing { background: #f0fdf4; color: #16a34a; }
  .st-paused { background: #fffbeb; color: #d97706; }
  .st-error { background: #fef2f2; color: #dc2626; }
  .bar { height: 7px; background: #f1f5f9; border-radius: 99px; overflow: hidden; margin-top: 10px; }
  .bar > div { height: 100%; border-radius: 99px; background: linear-gradient(90deg, #6366f1, #8b5cf6); transition: width .5s; }
  .actions { display: flex; flex-wrap: wrap; gap: 6px; margin-top: 14px; padding-top: 12px; border-top: 1px dashed #eef2f7; }
  .empty { text-align: center; padding: 46px 20px; color: #94a3b8; }
  .empty .icon { font-size: 38px; margin-bottom: 10px; }
  .export-area { width: 100%; min-height: 170px; margin-top: 10px; border: 1px solid #d7dde8; border-radius: 9px;
    padding: 12px; font-family: Consolas, monospace; font-size: 12px; background: #0f172a; color: #a5f3fc; resize: vertical; }
  .hint { font-size: 12px; color: #94a3b8; margin-top: 8px; line-height: 1.6; }
  .sep { height: 1px; background: #eef2f7; margin: 20px 0; }
  .toast { position: fixed; top: 20px; left: 50%; transform: translateX(-50%); background: #0f172a; color: #fff;
    padding: 10px 22px; border-radius: 10px; font-size: 13px; opacity: 0; transition: opacity .3s; pointer-events: none; z-index: 99; }
  .toast.show { opacity: .95; }
  .topbar { display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 10px; }
</style>
</head>
<body>
<div class="wrap">
  <header>
    <div class="logo">C3D</div>
    <div>
      <h1>设备模拟器控制台</h1>
      <div class="sub">独立虚拟设备产线 · 无真实硬件调试后端对接逻辑</div>
    </div>
  </header>

  <!-- 添加设备 -->
  <div class="card pad" style="margin-bottom: 20px;">
    <h2><span class="dot"></span>添加虚拟设备</h2>
    <div class="form-row">
      <div class="field">
        <label>设备类型</label>
        <select id="f-type">${typeOptions}</select>
      </div>
      <div class="field">
        <label>型号</label>
        <select id="f-model"></select>
      </div>
      <div class="field">
        <label>自定义名称（选填）</label>
        <input type="text" id="f-name" placeholder="留空自动命名">
      </div>
      <div class="field">
        <label>数量</label>
        <input type="number" id="f-count" value="1" min="1" max="20" style="min-width: 80px;">
      </div>
      <button class="btn btn-primary" id="btn-add" onclick="addDevice()">＋ 添加</button>
    </div>
    <p class="hint" id="type-hint"></p>
  </div>

  <!-- 设备清单 -->
  <div class="card pad" style="margin-bottom: 20px;">
    <div class="topbar">
      <h2><span class="dot"></span>虚拟设备（<span id="dev-count">0</span> 台）</h2>
      <button class="btn btn-ghost btn-sm" onclick="refresh(true)">↻ 刷新</button>
    </div>
    <div id="dev-list" class="grid"></div>
  </div>

  <!-- 导出配置 -->
  <div class="card pad">
    <div class="topbar">
      <h2><span class="dot"></span>导出后端设备配置</h2>
      <div style="display:flex; gap:8px;">
        <button class="btn btn-ghost btn-sm" onclick="loadExport()">生成 server/config/devices.json</button>
        <button class="btn btn-primary btn-sm" onclick="copyExport()">复制</button>
      </div>
    </div>
    <textarea class="export-area" id="export-json" spellcheck="false" placeholder="点击「生成」导出当前虚拟设备清单对应的后端配置 JSON，粘贴到 server/config/devices.json 后在管理端「设备管理 → 重载配置」即可完成对接。"></textarea>
    <p class="hint">用法：复制上方 JSON → 覆盖 server/config/devices.json → 管理端「设备管理 → 重载配置」→ 测试全部连接</p>
  </div>
</div>
<div class="toast" id="toast"></div>

<script>
const MODELS = {};
${modelScripts}

const $ = (id) => document.getElementById(id);
let devices = [];
let exportText = '';

function toast(msg, ok = true) {
  const t = $('toast');
  t.textContent = msg;
  t.style.background = ok ? '#059669' : '#dc2626';
  t.classList.add('show');
  setTimeout(() => t.classList.remove('show'), 2200);
}

function syncModels() {
  const type = $('f-type').value;
  $('f-model').innerHTML = (MODELS[type] || []).map((m) => '<option>' + m + '</option>').join('');
  $('f-count').value = 1;
  $('f-name').value = '';
  fetch('/api/types')
    .then((r) => r.json())
    .then((all) => {
      const info = all[$('f-type').value];
      $('type-hint').textContent = info ? info.protocol : '';
    });
}
$('f-type').addEventListener('change', syncModels);
syncModels();

async function addDevice() {
  const body = {
    type: $('f-type').value,
    model: $('f-model').value,
    name: $('f-name').value.trim() || undefined,
    count: Number($('f-count').value) || 1,
  };
  $('btn-add').disabled = true;
  try {
    const res = await fetch('/api/devices', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    const r = await res.json();
    if (!res.ok) throw new Error(r.error || '添加失败');
    toast('已添加 ' + r.created.length + ' 台虚拟设备');
    refresh(true);
  } catch (e) {
    toast(e.message, false);
  } finally {
    $('btn-add').disabled = false;
  }
}

async function removeDevice(id) {
  if (!confirm('确定删除虚拟设备 ' + id + '？')) return;
  const res = await fetch('/api/devices/' + id, { method: 'DELETE' });
  if (!res.ok) { toast('删除失败', false); return; }
  toast('已删除 ' + id);
  refresh(true);
}

async function act(id, action, body) {
  const res = await fetch('/api/devices/' + id + '/' + action, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body || {}),
  });
  const r = await res.json();
  if (!res.ok) { toast(r.error || '操作失败', false); return; }
  refresh();
}

const TYPE_COLOR = { bambu: '#3b82f6', creality: '#0ea5e9', xtool: '#f43f5e', eufymake: '#8b5cf6' };
const TYPE_ICON = { bambu: '🖨️', creality: '🖨️', xtool: '⚡', eufymake: '🟣' };
const STATE_LABEL = { idle: '空闲', working: '作业中', paused: '已暂停', error: '错误', finishing: '收尾中' };

function render() {
  $('dev-count').textContent = devices.length;
  if (!devices.length) {
    $('dev-list').innerHTML = '<div class="empty" style="grid-column: 1/-1;"><div class="icon">📡</div><div>暂无虚拟设备<br>使用上方表单添加 Bambu / Creality / xTool / EufyMake 设备开始模拟</div></div>';
    return;
  }
  $('dev-list').innerHTML = devices.map((d) => {
    const onlineTag = d.online
      ? '<span class="tag on"><span class="pulse"></span>在线</span>'
      : '<span class="tag off"><span class="pulse"></span>离线</span>';
    const stateTag = '<span class="state st-' + d.state + '">' + (STATE_LABEL[d.state] || d.state) + '</span>';
    const bar = d.state === 'working' || d.state === 'finishing'
      ? '<div class="bar"><div style="width:' + d.progress + '%"></div></div>'
      : '';
    return '<div class="card pad">' +
      '<div class="dev-head"><div>' +
        '<div class="dev-name">' + TYPE_ICON[d.type] + ' ' + d.name + '</div>' +
        '<div class="dev-meta">' + d.id + ' · ' + d.model + '</div>' +
        '<div class="dev-meta">' + d.protocol + '</div>' +
        stateTag +
      '</div>' + onlineTag + '</div>' + bar +
      '<div class="actions">' +
        (d.state !== 'working' ? '<button class="btn btn-sm btn-ghost" onclick="act(\\'' + d.id + '\\',\\'set-state\\',{state:\\'working\\'})">▶ 开始作业</button>' : '') +
        (d.state === 'working' ? '<button class="btn btn-sm btn-ghost" onclick="act(\\'' + d.id + '\\',\\'set-state\\',{state:\\'paused\\'})">⏸ 暂停</button>' : '') +
        (d.state === 'paused' ? '<button class="btn btn-sm btn-ghost" onclick="act(\\'' + d.id + '\\',\\'set-state\\',{state:\\'working\\'})">▶ 继续</button>' : '') +
        (d.state === 'working' || d.state === 'paused' ? '<button class="btn btn-sm btn-ghost" onclick="act(\\'' + d.id + '\\',\\'finish\\')">✔ 完成作业</button>' : '') +
        '<button class="btn btn-sm btn-ghost" onclick="act(\\'' + d.id + '\\',\\'report-error\\',{message:\\'模拟喷头堵料\\'})">⚠ 模拟故障</button>' +
        (d.online
          ? '<button class="btn btn-sm btn-ghost" onclick="act(\\'' + d.id + '\\',\\'offline\\')">⏻ 掉线</button>'
          : '<button class="btn btn-sm btn-ghost" onclick="act(\\'' + d.id + '\\',\\'online\\')">⏼ 上线</button>') +
        '<button class="btn btn-sm btn-danger" onclick="removeDevice(\\'' + d.id + '\\')">✕ 删除</button>' +
      '</div></div>';
  }).join('');
}

async function refresh(showToast) {
  try {
    const r = await fetch('/api/devices').then((x) => x.json());
    devices = r;
    render();
    if (showToast) toast('已刷新');
  } catch { /* 静默 */ }
}

async function loadExport() {
  exportText = JSON.stringify(await fetch('/api/export-config').then((x) => x.json()), null, 2);
  $('export-json').value = exportText;
  toast('已生成配置，点击「复制」粘贴到后端');
}

function copyExport() {
  if (!exportText) { toast('请先生成配置', false); return; }
  navigator.clipboard.writeText(exportText)
    .then(() => toast('已复制到剪贴板'))
    .catch(() => toast('复制失败，请手动选择', false));
}

refresh();
setInterval(refresh, 3000);
</script>
</body>
</html>`;
}

module.exports = { renderUi };
