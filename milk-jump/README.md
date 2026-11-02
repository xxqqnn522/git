# 奶娃跳一跳

一个使用 HTML、CSS 和 JavaScript 编写的小游戏，无需安装依赖。

## 在 VS Code 中运行

1. 用 VS Code 打开 `C:\Users\lenovo\Desktop\git`。
2. 展开 `milk-jump` 文件夹。
3. 在资源管理器中右键 `index.html`，选择“在文件资源管理器中显示”。
4. 双击 `index.html`，用浏览器打开游戏。
5. 修改代码并保存后，刷新浏览器查看效果。

也可以在已安装 Live Server 扩展时，右键 `index.html` → Open with Live Server。

## 玩法

- 按住画面、蓄力按钮或空格键，松开起跳。
- 蓄力越久跳得越远，最长蓄力 1.1 秒。
- 落在下一块饼干得 1 分，正中央得 2 分。
- 失败后点击“重新开始”；最高分保存在当前浏览器中。

## 文件分工

- `index.html`：文字、按钮和画布结构。
- `style.css`：颜色、布局和手机适配。
- `game.js`：绘制奶娃、蓄力、跳跃、判定与计分。

## 修改练习

1. 修改 `index.html` 中的标题。
2. 修改 `style.css` 的页面背景色。
3. 修改 `game.js` 中 `maxCharge = 1100`，调整蓄力速度（单位毫秒）。
4. 保存并运行确认，再在 VS Code 源代码管理里检查差异、暂存、填写提交说明、提交，最后推送。

上传 GitHub 后会保存源码；仓库页面本身不会自动运行游戏。下载后打开 HTML 即可玩。
