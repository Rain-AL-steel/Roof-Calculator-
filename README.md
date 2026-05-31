# 树脂瓦出货计算工具

这个项目已经从单个 HTML 文件拆成了本地静态前端项目。

## 目录结构

- `index.html`：页面入口，只保留 HTML 结构和资源引用。
- `树脂功能优化.html`：复原后的原始单文件版本。
- `src/styles/main.css`：页面样式。
- `src/scripts/app.js`：应用启动、DOM 事件和主要业务流程。
- `src/scripts/config.js`：固定宽度和预设清单。
- `src/scripts/calc.js`：节数、坡度、角度等计算函数。
- `src/scripts/utils.js`：数字解析和格式化工具。
- `tools/dev-server.cjs`：零依赖本地开发服务器。
- `legacy/树脂功能优化.html`：拆分前的单文件备份。

## 在 VS Code 本地运行

1. 用 VS Code 打开 `E:\Desktop\duplicate`。
2. 打开终端：`Terminal > New Terminal`。
3. 运行：

```bash
npm run dev
```

## 本地 API 地址配置

前端支持通过运行时配置连接本地后端，不需要把 API 地址写死进源码。

1. 复制示例配置：

```powershell
copy runtime-config.example.js runtime-config.js
```

2. 按本地后端地址编辑 `runtime-config.js`：

```js
window.ERP_API_BASE_URL = 'http://127.0.0.1:3001';
```

3. 启动后端和前端：

```powershell
cd E:\Desktop\duplicate\backend
npm run dev
```

```powershell
cd E:\Desktop\duplicate
npm run dev
```

`runtime-config.js` 已加入 `.gitignore`，只用于本机配置，不要提交。没有这个文件时，前端仍会按原有逻辑运行；API 不可用时订单保存和读取会回退到 localStorage。

4. 终端会显示地址，默认是 `http://127.0.0.1:5173`。
5. 按住 `Ctrl` 点击终端里的地址，或复制到浏览器打开。

也可以按 `Ctrl+Shift+P`，选择 `Tasks: Run Task`，再选择 `启动本地服务器`。
