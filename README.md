# 树脂瓦出货计算工具

这个项目已经从单个 HTML 文件拆成了本地静态前端项目。

## 目录结构

- `index.html`：页面入口，只保留 HTML 结构和资源引用。
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

4. 终端会显示地址，默认是 `http://127.0.0.1:5173`。
5. 按住 `Ctrl` 点击终端里的地址，或复制到浏览器打开。

也可以按 `Ctrl+Shift+P`，选择 `Tasks: Run Task`，再选择 `启动本地服务器`。
