# Support Fins 简体中文版

把零件斜着立起来打印，**Support Fins 会把可掰断的支撑鳍直接烧进 STL** —— 拿到哪台机器、
哪个切片软件里打开都一样，支撑关掉就能打。

本仓库是 [gittrahan/support-fins](https://github.com/gittrahan/support-fins) 的**简体中文汉化版**，
MIT 许可，著作权归原作者 Matthew Trahan（见 [LICENSE](LICENSE)）。上游英文说明保留在
[README.en.md](README.en.md)。原版在线体验：<https://printfins.com>。

> 纯浏览器应用：文件只在你的标签页里解析，不上传、不安装、不需要账号。

## 汉化了什么

只改**用户可见文案**，不改任何几何算法或业务逻辑，共 127 处精确替换：

| 文件 | 内容 |
| --- | --- |
| `web/index.html` | 43 处：标题、顶栏、统计面板、旋转/受力面板、鳍片选项、空状态引导、3MF 多对象选择框，以及 `title` / `aria-label`；`<html lang="en">` → `zh-CN` |
| `web/app.js` | 66 处：全部动态读数（悬垂数、是否装得下、支撑鳍/支撑柱计数、底盘垫、耗时、克数回执）、「为什么没有支撑」的解释、按钮状态、导入提示、报错弹窗 |
| `web/orient.js` | 3 处：受力方向判语（顺层 / 部分穿层 / 垂直穿层） |
| `web/draw.js` | 4 处：手绘支撑墙的失败原因 |
| `web/fins.js` | 2 处：手放支撑鳍被拒绝的原因 |
| `web/zip.js` | 7 处：ZIP（3MF 容器）解析错误 |
| `web/threemf.js` | 2 处：3MF 读取错误 |
| `web/style.css` | 字体栈加入中文优先字体（Microsoft YaHei / PingFang SC / Noto Sans SC 等）；顶栏允许换行、品牌名不折行，避免中文变长后 GitHub / Ko-fi 按钮被挤出屏幕 |
| `nginx.conf` | 显式声明 `charset utf-8;`，生产响应头直接带编码 |

**术语表（全文统一）**

| 英文 | 中文 |
| --- | --- |
| support fin / fin | 支撑鳍 |
| prop（普通可掰断墙） | 支撑柱 |
| drawn wall | 支撑墙（手绘） |
| bed pad | 底盘垫 |
| tines / tine grip | 卡齿 / 卡齿密度 |
| overhang | 悬垂 |
| bed contact | 底面接触 |
| build volume | 成型空间 |
| support gap | 支撑间隙 |
| layer height | 层高 |
| wide-face coverage | 宽面覆盖密度 |
| lay a face flat | 以面贴平 |
| suggest orientation | 推荐摆放方向 |
| strength arrow | 受力箭头 |

**刻意保留英文**：代码注释与 `console.warn` 等开发者日志（便于与上游对比）；品牌与外部链接
（Support Fins、GitHub、Ko-fi）；材料名 PLA / PETG、单位 mm、格式名 STL / 3MF；写进 STL 文件头与
3MF 元数据的标识（那是给切片软件看的，不是界面文案）；`web/vendor/three/` 第三方库原样保留。

## 运行

应用是无构建步骤的纯静态 ES 模块站点（three.js 已内置于 `web/vendor/`），
用官方自带的 dev server（禁用缓存，改完刷新即生效）：

```bash
python3 dev-server.py                # http://localhost:8731/
python3 dev-server.py 8080           # 换端口
python3 dev-server.py --host 0.0.0.0 # 局域网其它设备也能访问
```

Windows 上也可以直接用：

```powershell
.\start.ps1                 # 默认 http://127.0.0.1:8731/
.\start.ps1 -Port 8800
```

或者用 Docker（镜像就是 nginx 提供 `web/`，URL 与 dev server 一致）：

```bash
docker compose up --build    # http://localhost:8731/
```

部署到公网：仓库自带 [`wrangler.jsonc`](wrangler.jsonc)（Cloudflare Workers 静态资源，目录 `./web`），
接入 Cloudflare 的 Git 集成即可；也可以把 `web/` 目录整体丢到任意静态托管。
`web/_redirects` 与 [`nginx.conf`](nginx.conf) 分别对应 Cloudflare 与容器两条路径。

## 验证

1. `node --check` 通过全部 12 个自有模块（`app.js`、`fins.js`、`prop.js`、`threemf.js`、`zip.js` 等）。
2. 浏览器实测（Playwright，自建测试件：48 三角面的 L 形支架，带悬垂与内孔）：
   载入 → 旋转 → 开启支撑鳍自动生成（412 个三角面的鳍片几何）→ 读数「1 个支撑鳍」
   「0.3 g 新增支撑材料」；「推荐摆放方向」输出「最佳 / #2 / #3」候选；
   受力箭头给出「受力方向垂直穿过层线 —— 这正是打印件最容易开裂的方向。」；
   手动模式绘制提示与「撤销 / 全部清除」正常；「自定义…」成型空间正常；
   **浏览器控制台 0 错误 0 警告**。
3. 响应式：1440×900 顶栏单行完整；1100×760 顶栏自动换行，控件不再被裁掉。
4. 未执行上游的 Deno 几何回归测试（`deno test --allow-read tests/`）：汉化只改提示字符串，
   `tests/` 的断言依赖几何量而非文案，不受影响；装有 Deno 时可自行运行。

## 回退 / 重新汉化

- 只回退汉化：`git revert <本汉化提交>`，或按文件 `git checkout <上游提交> -- web/ nginx.conf`。
- 重新应用汉化：见 [`tools/i18n-zh/`](tools/i18n-zh/README.md) —— 替换脚本是**精确匹配**的，
  每条规则要求原句在该文件中恰好出现一次，否则整体中止、不写盘，因此对已汉化的代码重跑会报
  「0 matches」并停下，这是有意的保护。

## 许可

MIT，见 [LICENSE](LICENSE)。许可覆盖的是本工具本身，不是你用它做出来的东西 ——
经 Support Fins 处理过的 STL 完全属于你，输出文件不附带任何许可义务。

鳍片技术的原创推广者是 Slant3D；本工具只是把它自动化了，`docs/FIN-SPEC.md` 直接引用了他们的数据。
原版由 Matthew Trahan 开发并开源，如果它帮你省下了一次打印，可以在
[Ko-fi](https://ko-fi.com/matthewtrahan) 上请原作者喝杯咖啡 ☕。
