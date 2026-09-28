# 内置 STEP / IGES / BREP 转换引擎（第三方组件）

这个目录里的文件**不是本项目的代码**，是为了让网页应用能够打开 STEP 文件而内置的第三方
WebAssembly 引擎。它和上游 support-fins 无关，也不在 MIT 许可覆盖范围内。

| 文件 | 是什么 | 大小 |
| --- | --- | --- |
| `occt-import-js.js` | Emscripten 生成的 JS 胶水层（经典脚本，挂 `occtimportjs` 全局） | 96 871 B |
| `occt-import-js.wasm` | OpenCascade 的导入/三角化功能编译成的 WASM | 7 604 031 B |
| `license.occt-import-js.txt` | occt-import-js 自己的 LGPL-2.1 许可全文 | — |
| `license.occt.txt` | OpenCascade（OCCT）的 LGPL-2.1 + 例外条款全文 | — |

## 来源与版本

- 组件：[occt-import-js](https://github.com/kovacsv/occt-import-js) **0.0.23**
  （npm 包 `occt-import-js@0.0.23`，本目录内容取自该包 `dist/`，未做任何修改）
- 许可：**LGPL-2.1**（`license.occt-import-js.txt`），其内部使用的 OpenCascade 同样是
  LGPL-2.1 并附带例外条款（`license.occt.txt`）
- 源码获取：<https://registry.npmjs.org/occt-import-js/-/occt-import-js-0.0.23.tgz>
  （tarball 的 SHA-256 记录在 `prototype/step-fixtures.json`，由 `tools/fetch-step-fixtures.mjs`
  校验；同一条记录也可用于重新下载、复核本目录文件）

## 为什么是 LGPL，会传染吗

不会传染到本项目：这是一个**独立进程内的独立模块**，通过运行时动态加载（Worker 里
`importScripts`，或页面里插入 `<script>`）使用，本项目代码不与它静态链接、不改动它。
LGPL-2.1 §6 允许这样分发，条件是随附许可全文与来源说明（本文件与两份许可即为该义务），
并且接收者能够替换这个组件 —— 直接替换本目录下的两个文件即可（版本、接口在
`web/step.js` 顶部有说明）。本项目的 MIT 许可（仓库根 `LICENSE`）只覆盖本项目自己的代码。

## 为什么要内置，而不是让用户自己装

应用是**纯静态、可离线**的（`start.bat` 起一个静态服务就能用）。STEP 不是网格格式：
它描述的是 B-rep 曲面，必须有一个 CAD 内核（这里是 OpenCascade）来三角化。浏览器里没有
第二个选择 —— 任何真正的 STEP 支持都等于把 OCCT 编译成 WASM。所以要么内置（现在这样），
要么让用户自备 —— 内置才能让"打开 STEP"这件事开箱可用。

代价：整包变大（`web-only` 静态包从约 0.6 MB 变成约 3 MB 压缩 / 7.6 MB 解压），
并且首次打开 STEP 时会加载这 7.6 MB（**只在真的打开 STEP/IGES/BREP 时才加载**，
打开 STL / 3MF 完全不受影响）。若不需要 STEP，删掉本目录即可 —— `web/step.js`
会给出明确的中文提示，其余功能一切照旧。

## 怎么升级

```bash
npm pack occt-import-js@<新版本>            # 或从 registry 直接下 tarball
tar -xzf occt-import-js-<新版本>.tgz
cp package/dist/occt-import-js.js package/dist/occt-import-js.wasm \
   package/dist/license.occt-import-js.txt package/dist/license.occt.txt \
   web/vendor/occt/
node tools/fetch-step-fixtures.mjs --verify  # 顺带核对 tarball 哈希
deno test --allow-read tests/                # 锁定文件哈希的测试会提示更新
node tools/verify-step-import.mjs            # 用真实引擎跑一遍导入验证
```

升级后需要同步更新的地方：本文件的版本号、`prototype/step-fixtures.json` 里的哈希、
以及 `tests/step.test.js` 里锁定的文件大小/哈希。
