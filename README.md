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

**汉化之外新增的文件**

| 路径 | 作用 |
| --- | --- |
| `start.bat` | **Windows 一键启动：双击即可** —— 自动找 Python、挑空闲端口、起服务，就绪后自动开浏览器 |
| `start.ps1` | 上面那个 `.bat` 背后的脚本，也可以直接运行（`-Port` / `-BindHost` / `-NoBrowser` / `-Help`） |
| `start.sh` | Linux / macOS 的启动脚本（`./start.sh [端口] [绑定地址]`） |
| `tools/i18n-zh/` | 可重放的汉化替换脚本 + 英文串盘点脚本 + 设计说明 |
| `README.en.md` | 上游英文 README（原 `README.md` 改名而来，内容未改） |
| `web/step.js`、`web/stepworker.js`、`web/vendor/occt/` | 新增功能：STEP / IGES / BREP 导入（见下一节） |
| `prototype/stress/gen_step.py`、`tools/fetch-step-fixtures.mjs`、`tools/verify-step-import.mjs`、`tests/step.test.js` | 该功能的夹具生成 / 拉取 / 真实引擎验证 / 单元测试 |

## 新增功能：导入 STEP（以及 IGES / BREP）

上游只读网格格式（STL、3MF）。STEP 不是网格格式 —— 它描述 B-rep 曲面（平面、圆柱、NURBS、
带裁剪的边界环），必须由 CAD 内核三角化。浏览器里没有第二个选择：任何真正的 STEP 支持都等于
把 **OpenCascade 编译成 WebAssembly**，所以本版内置了
[occt-import-js](https://github.com/kovacsv/occt-import-js) **0.0.23**（`web/vendor/occt/`）。

| 方面 | 做法 |
| --- | --- |
| 路由 | 按**内容**判断，而不是扩展名：STEP 以 `ISO-10303-21` 开头、IGES 是 80 列定长记录、BREP 以 `DBRep_DrawableShape` 开头、3MF 是 ZIP 魔数；扩展名只作兜底，所以被改名的文件仍进对解析器 |
| 懒加载 | 打开 STL / 3MF **完全不会**碰到这 7.6 MB 引擎；只有真的打开 STEP/IGES/BREP 时才加载并缓存 |
| 不卡界面 | 三角化在 `stepworker.js`（经典 Worker，因为引擎是经典 UMD 脚本、必须用 `importScripts`）里跑；Worker 起不来时自动回落到页面内加载同一份引擎 |
| 单位 | 请求引擎以**毫米**输出，它会按文件自己声明的单位换算（米 / 毫米 / 英寸三种文件的实测结果都是 1000 mm） |
| 三角化精度 | 不使用引擎默认值（默认角偏差 0.5 rad ≈ 一圈 13 边形，实测太粗、会丢圆形轮缘支撑），改用 `bounding_box_ratio 0.0006 + 0.12 rad` |
| 多实体 | 装配体会按节点拆成可选实体，走进已有的对象选择框（实测 18 网格的 CAx-IF 装配体 → 4 个实体，各自带名称与尺寸） |
| 失败提示 | 引擎返回 `success: false` 时给出中文原因，不静默失败；引擎文件缺失时明确说明「STL / 3MF 不受影响」 |

**这不是上游 MIT 代码的一部分**：`web/vendor/occt/` 是第三方组件，LGPL-2.1（OpenCascade 同样
LGPL-2.1 + 例外条款），许可全文随包提供，来源、版本与替换方式写在
[`web/vendor/occt/NOTICE.md`](web/vendor/occt/NOTICE.md)。它通过运行时动态加载使用、不与本项目
代码静态链接，因此不改变本项目自身 MIT 许可的适用范围。**代价是包变大**：静态包从约 0.6 MB
变成约 3 MB（压缩后；解压 7.6 MB）。不需要 STEP 的话，删掉 `web/vendor/occt/` 即可，其余功能
一切照旧，打开 STEP 时会给出明确提示。

## 运行

**要打开的页面是 `web/index.html`，但它必须通过 `http://` 访问 —— 不要双击打开它。**
这个应用是原生 ES 模块 + Web Worker，浏览器出于安全策略会拒绝 `file://` 下的模块加载，
双击 `index.html` 只会得到空白页面（控制台报模块加载 / CORS 错误）。

### 1. 一键启动（Windows，最省事）

**双击 `start.bat`** 就行：它会自动找 Python 3、挑一个空闲端口、起服务，
**等服务真正就绪后再自动打开浏览器**。停止服务：在它开出的那个窗口里按 `Ctrl+C`。

也可以带参数用：`start.bat -Port 8800`、`start.bat -BindHost 0.0.0.0`（局域网可访问）、
`start.bat -NoBrowser`（只起服务）。

### 2. 手动起服务（任选其一）

```bash
python3 dev-server.py                # http://localhost:8731/
python3 dev-server.py 8080           # 换端口
python3 dev-server.py --host 0.0.0.0 # 局域网其它设备也能访问
```

Windows 上也可以直接用（`start.ps1` 就是 `start.bat` 背后那份脚本）：

```powershell
.\start.ps1                 # 默认 http://127.0.0.1:8731/，并自动开浏览器
.\start.ps1 -Port 8800
.\start.ps1 -Help
```

或者用 Docker（镜像就是 nginx 提供 `web/`，URL 与 dev server 一致）：

```bash
docker compose up --build    # http://localhost:8731/
```

### 3. 打开页面

浏览器访问上面命令打印的地址（默认 **<http://127.0.0.1:8731/>**），
它对应的文件就是 `web/index.html` —— 这就是入口，直接把 STL/3MF 拖进页面即可开始使用。

> 只想部署、不想跑 dev server？把 `web/` 目录整体丢到任意静态托管（Netlify、Cloudflare Pages、
> GitHub Pages、nginx…），访问站点根路径，入口同样是 `web/index.html`；不需要后端、不需要构建。

部署到公网：仓库自带 [`wrangler.jsonc`](wrangler.jsonc)（Cloudflare Workers 静态资源，目录 `./web`），
接入 Cloudflare 的 Git 集成即可。
`web/_redirects` 与 [`nginx.conf`](nginx.conf) 分别对应 Cloudflare 与容器两条路径。

## 验证

1. `node --check` 通过全部自有模块（`app.js`、`fins.js`、`prop.js`、`threemf.js`、`zip.js`、
   `step.js` 等）。
2. 引擎几何回归：`deno test --allow-read tests/` —— **120 passed / 0 failed**
   （含 `tests/step.test.js` 的 8 个 STEP 用例；`tests/round_validation.test.js` 的
   21 个圆形/网格密度用例；`tests/round_boundary.test.js` 的 11 个）。
   测试模型先跑 `python prototype/stress/gen.py`（网格）与
   `python prototype/stress/gen_step.py`（STEP）生成。
3. **STEP 导入用真实引擎端到端验证**（不只是纯逻辑单测）：

   ```bash
   python prototype/stress/gen_step.py       # 生成自建 STEP 夹具（含 mm / 英寸两份同一个零件）
   node tools/fetch-step-fixtures.mjs        # 拉取第三方夹具（按 SHA-256 锁定，见 prototype/step-fixtures.json）
   node tools/verify-step-import.mjs         # 34 项检查：真实引擎 + 完整支撑流水线
   ```

   覆盖：10 mm 立方体尺寸、米/毫米/英寸三种单位文件都输出 1000 mm、同一个零件在 mm 与英寸下
   尺寸一致、三角化比引擎默认更细且可复现、IGES 与 BREP 走同一引擎、18 网格装配体拆成 4 个实体、
   垃圾文件给出中文错误而不是崩溃，以及**把转换出来的网格喂给真正的 `analyze` + `buildFins`**：
   斜板得到 5 个支撑鳍、球底得到 2 个支撑鳍 + 6 个卡齿。
4. 浏览器实测（Playwright / Edge，本地静态服务）：
   - 原有 STL 流程不变：48 三角面的 L 形支架 → 「1 个支撑鳍」等读数，控制台 0 错误 0 警告。
   - **STEP 走的是 Worker 路径**（页面里没有 `window.occtimportjs`，说明没有回落到主线程）：
     `plate.step` 548 ms 载入 → 「5 个支撑鳍」；`ball.step`（2208 面）5.6 s → 「2 个支撑鳍 ·
     6 个卡齿」，与同一形状的 STL 结果一致；`assembly-18.stp` → 弹出对象选择框（4 个实体，
     带名称与尺寸）→ 载入后生成 626 个支撑鳍，控制台 0 错误。
   - 这一步曾经抓到一个真 bug：Worker 里没有 `document.currentScript`，引擎按默认路径去找
     wasm 会请求站点根目录下的 `/occt-import-js.wasm`（404 返回 HTML），报错是
     「expected magic word 00 61 73 6d, found 3c 21 44 4f」。现在两个文件都相对 Worker 自身
     URL 解析；当时是主线程回落救了场，否则用户会看到一个莫名其妙的 WebAssembly 报错。
5. 响应式：1440×900 顶栏单行完整；1100×760 顶栏自动换行，控件不再被裁掉。

## 回退 / 重新汉化

- 只回退汉化：`git revert <本汉化提交>`，或按文件 `git checkout <上游提交> -- web/ nginx.conf`。
- 重新应用汉化：见 [`tools/i18n-zh/`](tools/i18n-zh/README.md) —— 替换脚本是**精确匹配**的，
  每条规则要求原句在该文件中恰好出现一次，否则整体中止、不写盘，因此对已汉化的代码重跑会报
  「0 matches」并停下，这是有意的保护。

## 许可

本项目自身代码 MIT，见 [LICENSE](LICENSE)。许可覆盖的是本工具本身，不是你用它做出来的东西 ——
经 Support Fins 处理过的 STL 完全属于你，输出文件不附带任何许可义务。

**例外**：`web/vendor/occt/`（STEP/IGES/BREP 转换引擎，第三方）是 **LGPL-2.1**，不在 MIT 覆盖
范围内；许可全文与来源说明随该目录提供，见 [`web/vendor/occt/NOTICE.md`](web/vendor/occt/NOTICE.md)。
它只在本项目运行时被动态加载，用户可以整目录替换，因此不影响本项目自身代码的许可。

鳍片技术的原创推广者是 Slant3D；本工具只是把它自动化了，`docs/FIN-SPEC.md` 直接引用了他们的数据。
原版由 Matthew Trahan 开发并开源，如果它帮你省下了一次打印，可以在
[Ko-fi](https://ko-fi.com/matthewtrahan) 上请原作者喝杯咖啡 ☕。
