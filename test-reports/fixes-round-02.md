# 第二轮问题修复记录（主代理）

日期：2026-11-23。依据 `round-02.md` 修复，保留前两轮报告及证据。以下为**候选修复，待第三轮真实复测确认**；代码检查通过不等于关闭问题。

## 修复范围与证据负责人

| 问题 | 根因 / 改动 | 决定性证据负责人 |
| --- | --- | --- |
| MR-010 | Rust 每次显示隐蔽窗向该窗发送 `stealth:show`；首次加载和重新显示均读取当前阅读游标、书籍、章节及绑定进度。加载序号隔离迟到响应，加载中禁止旧正文导航；跨章正文成功后才更新本地游标 | 主代理：重开跨书/同书新位置、迟到正文回归；QA：UI 与原生老板键重开、跨章/跨窗及失败不覆盖进度 |
| MR-011 | 提取页面事件监听的生命周期清理：卸载后迟到的注册也取消，回调不再处理已卸载页面。主阅读与隐蔽页面共用；透明度状态更新不再包含持久化副作用 | 主代理：StrictMode setup→cleanup→setup 时一次事件只步进一次；QA：一次原生 Down/Up 各改变 10 个百分点，边界与重启恢复 |
| MR-012 | 新增独立 `stealth-drag` capability，仅向 `stealth` 授予 `core:window:allow-start-dragging` | 主代理：权限范围回归与 Rust 编译；QA：可交互模式真实拖动顶栏、原生矩形确实移动，穿透模式对照 |
| MR-013 | 主窗原生 `CloseRequested` 始终退出应用，保留原有关闭语义；不让已创建的隐藏隐蔽窗留下无法恢复主界面的后台进程 | QA：隐蔽窗未创建、已隐藏、可见三种前提下原生关闭，确认自有应用/窗口/托盘退出；最小化恢复及托盘退出回归 |
| MR-014 | 详情加载按序号接受结果，页面清理使旧加载失效，旧书架快照不能覆盖后续加书成功状态；保存中阻止重复处理 | 主代理：延迟旧加载在首次保存后返回的状态回归；QA：新结果首次 UI 加书即时显示“已在书架”且禁用，正常阅读与重新挂载一致 |

涉及 `src/api/client.ts`、`src/pages/ReaderPage.tsx`、`src/pages/StealthPage.tsx`、`src/pages/BookDetailPage.tsx`、`src-tauri/src/stealth.rs`、`src-tauri/src/lib.rs`、`src-tauri/capabilities/stealth-drag.json` 与 `tests/regressions.test.mjs`。未新增 IPC 命令，未改正式 identifier、SQLite 结构、用户数据库或书源。只有隐蔽拖动这一项权限增加，没有授予主窗或放宽 Web 安全。

## 已执行的代码层检查

- `npm.cmd test`：14/14 通过。新增四项覆盖单次透明度事件、隐蔽重开与过期正文、加书反馈竞争、拖动权限。修复前新增四项断言失败，修复后通过。
- 组件回归只控制 hook 状态和异步时序，不提供真实 DOM、WebView2 或原生窗口行为证明；复用 Node 内置测试及已安装 React/TypeScript，未增加依赖。
- `npx.cmd --no-install tsc --noEmit`：通过。
- `npm.cmd run build`：通过，构建前端；不是 Rust release 或 NSIS 构建。
- `cargo test --manifest-path src-tauri/Cargo.toml --lib`：8/8 通过。
- `cargo test --manifest-path src-tauri/Cargo.toml --test integration_tests test_full_pipeline_mock -- --exact`：1/1 通过。两项外网/外部夹具测试未执行，不用其宽松断言替代真实业务证据。

## 第三轮证据路径与边界

由同一个 `qa-real` 独占原隔离实例，复用 `run-dev.ps1`、QA SQLite 与独立 WebView2 profile；不重跑 `prepare.py`、覆盖 `original-backup.db` 或向正式库恢复数据。运行源码及权限在测试期间冻结，新的构建指纹须包含新增 capability。

先复测 MR-010/013，再复测 MR-011/012/014，并回归首次 UI/原生建窗、三态/穿透、跨章/跨窗/立即保存、搜索往返及正常新书链路。保留稳定用例编号，继续探索其它已有功能。第三轮报告为 `test-reports/round-03.md`；只有真实候选前提成立才测换源，不伪造来源。

未验证 NSIS/release、根目录旧 exe、全部 164 个书源及未开放入口。EXT-01/02/03 保留，网络失败仍需真实响应才能归因，不视为通过或直接当作应用缺陷。
