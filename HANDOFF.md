# 项目移交说明

更新日期：2026-11-24。最近一轮真实验收及代码检查完成于 2026-11-23。

## 当前进度

已完成四轮真实 Tauri / WebView2 测试、三轮业务修复及对应复测。**MR-001～MR-015 均已按原复现条件关闭，目前没有已确认待修的应用问题。** 第四轮已测范围内未发现新增可复现应用问题，测试闭环已暂停，等待接手。

验收对象为当前 **0.2.0 源码构建的 debug 桌面程序**。根目录 `摸鱼阅读2.0.exe` 没有更新，NSIS / release 安装包没有构建验收；`启动摸鱼阅读2.0.bat` 仍运行旧 exe。54 项用例矩阵中包含阻塞和未测项，不能表述为“54 项全部通过”或“整应用无 bug”。

本次交接只整理文档及 Git 提交规则，不再修改业务源码或启动 QA。交接前目录没有 `.git`，没有可引用的历史提交、分支或远端。已完成源码快照提交 **`61361031eba17d42fa121cab1a45e5eb255a5c9d`**，包含源码、测试、四轮报告 / 证据和本文；未建立逐轮修复的 Git 历史，不能用 Git 回退重演测试前版本。

用户随后确认目标为 **`heqiang12/moyu-reader2.0`，要求新建分支，不覆盖原有默认分支**。网络恢复后确认仓库已存在且公开，默认分支实际为 **`master`**，推送前 SHA 为 **`cb7dcb69d62cb339d193f7d66600ebee0a70e6d6`**；不再创建仓库或更改可见性。本地交接分支为 **`handoff/qa-20261124`**，`origin` 为 `https://github.com/heqiang12/moyu-reader2.0.git`；初始本地 `main` 保留，远端不存在同名交接分支。

旧 `master` 是 Vanilla JS / TXT 阅读实现，使用 `vite.config.js` 和 5173 端口，与当前 React / Rust / SQLite 实现不同。交接分支以合并父提交衔接旧历史，工作树采用**当前 0.2.0 完整验收快照**，不混入旧 JS 入口、旧 Vite / Vitest 配置、旧版代理设置或构建流程。旧代码、文档和文件在 `master` 及原历史中完整保留，不把本分支当作对旧版的几个补丁，也不直接合回默认分支。

本次曾遇到 GitHub EOF / TLS 网络阻塞和直连时的认证无效误报，网页设备登录没有取得授权码。用户恢复网络后，使用现有 `heqiang12` 登录和本机已有系统代理继续；仅向 Git / GitHub CLI 子进程设置代理环境变量，没有改全局代理或关闭证书校验，不把 token 写进文件或聊天。

**已于 2026-11-24 推送并读回核验**：[交接分支](https://github.com/heqiang12/moyu-reader2.0/tree/handoff/qa-20261124)。源码、测试、报告和历史衔接的交接提交为 **`c83deda2f32dce9ab19abdc784cab00d07966c03`**，远端 SHA 与本地一致，`master` 仍为上述原 SHA。仅推送 `handoff/qa-20261124`，未强推、未推送标签、未创建或更新远端 `main`，未创建 PR 或合入默认分支。本次最终文档补充仅更新交付状态；最新交付提交以远端此分支和 `git log -1` 为准。

异机 / 新目录接手请**显式检出交接分支**；不指定分支的 clone 会取得旧 `master`，不能当作当前验收源码：

```powershell
git clone --branch handoff/qa-20261124 https://github.com/heqiang12/moyu-reader2.0.git
```

只读核验入口如下：

```powershell
git remote -v
git ls-remote --symref origin HEAD
git ls-remote --heads origin refs/heads/handoff/qa-20261124
```

## 接手先读

1. [第四轮最终验收](test-reports/round-04.md)：最终关闭决定、TC-01～TC-54、外部限制、证据和现场状态。
2. [第三轮修复](test-reports/fixes-round-03.md)：MR-015 根因、最小数据库修复及最终代码检查。
3. [第二轮修复](test-reports/fixes-round-02.md) / [第一轮修复](test-reports/fixes-round-01.md)：MR-001～MR-014 的改动与回归映射。
4. [仓库指引](AGENTS.md) / [专职 QA 约束](.opencode/agents/qa-real.md)：构建、IPC、数据保护和真实测试边界。

`fixes-round-*.md` 保留了当时“候选修复、待复测”的历史措辞；最终问题状态以后续真实报告，尤其 `round-04.md` 为准。不要覆盖旧报告和证据来改写历史。

## 已关闭的问题

| 编号 | 已修复的原问题 |
| --- | --- |
| MR-001 | 新搜索结果详情错误，未入架书籍无法正常进入详情链路 |
| MR-002 | 隐蔽入口 IPC、首次惰性建窗及透明布局异常 |
| MR-003 | 替代搜索和页面往返时旧搜索批次串入当前结果 |
| MR-004 | 章内进度缺少章节归属、跨章沿用旧位置及跨窗坐标不一致 |
| MR-005 | 空输入点击热词没有真正提交对应搜索 |
| MR-006 | 删除书籍后残留章内进度及失效续读入口 |
| MR-007 | 独立重启首屏没有应用已保存主题 |
| MR-008 | 已完成的零结果搜索缺少明确反馈 |
| MR-009 | 关于页、前端和实际桌面版本不一致 |
| MR-010 | 隐蔽窗隐藏后重开仍显示旧书或旧位置，迟到正文可能覆盖新内容 |
| MR-011 | 页面监听生命周期导致一次透明度按键重复步进 |
| MR-012 | 隐蔽顶栏缺少原生拖动权限 |
| MR-013 | 已创建隐蔽窗后关闭主窗留下无法恢复主界面的后台进程 |
| MR-014 | 首次 UI 入架成功状态被迟到的书架快照覆盖 |
| MR-015 | 预览目录先缓存再入架，总章数持续为 0，书架误显示“尚未开始” |

主窗关闭仍为**退出应用**，没有新增“关闭到托盘”设置。拖动权限只授予 `stealth`，没有授予主窗。

## 代码接续点

- `src/api/client.ts`、`src-tauri/src/commands.rs`、`src-tauri/src/lib.rs` 和两侧 `types` 是 IPC 契约的共同边界，参数及序列化字段使用 camelCase。
- `searchBookSSE` 使用 Tauri 事件，不是 HTTP SSE。`start_search` 接受 `keyword` / `requestId`；`search:item` 为 `{ requestId, books }`，`search:end` 为同一 requestId 字符串。先注册监听再启动；取消会清理前端订阅，旧后台网络任务可能继续执行。
- `src/lib/storage.ts` 的 `moyu:progress:<bookUrl>` 保存 `{ chapterIndex, progress }`，兼容旧数字进度；它只保存该书最新位置，不是每章位置历史。SQLite 另存章索引，不能混成同一种进度。
- `src/lib/segment.ts`、`src/pages/ReaderPage.tsx`、`src/pages/StealthPage.tsx` 共用字符位置。继续修改定位时，须同时验证两窗、跨章、同章恢复和立即返回。
- `src/pages/BookDetailPage.tsx` 隔离过期加载和首次入架状态；`src/pages/DiscoverPage.tsx` 处理搜索替代、热词和结果入口。
- `src-tauri/src/stealth.rs` 负责建窗、重开事件、老板键、穿透和托盘。隐蔽 IPC 为 `open_stealth_window` / `hide_stealth_window` / `get_stealth_state`；显示事件为 `stealth:show`。`src-tauri/capabilities/stealth-drag.json` 仅增加隐蔽窗拖动权限。
- MR-015 的共享修复在 `src-tauri/src/db.rs`：有效非空缓存目录补齐为 0 的总章数，覆盖缓存读取、入架及旧库初始化，保留定位、章名、阅读时间、目录 JSON 和更新时间。没有修改 SQLite 表结构，没有清空用户库。
- 旧新 Legado 规则双命名及发现规则回退继续由 `src-tauri/src/types.rs::BookSource::get_rule_*` 兼容；本次没有承诺支持全部动态 JS / Legado 规则。

## 验证证据

| 检查 | 最近已执行结果 | 证明范围 |
| --- | --- | --- |
| `npm.cmd test` | 14/14 通过 | 共享进度、搜索 IPC、页面异步时序和权限回归；不等于原生 UI 实测 |
| `npx.cmd --no-install tsc --noEmit` | 通过 | 前端类型检查 |
| Rust `--lib` | 11/11 通过 | 含新增三项数据库回归，不访问外部书源 |
| `test_full_pipeline_mock` | 1/1 通过 | 内存 SQLite / 内嵌 HTML；含总章数断言 |
| `npm.cmd run build` | 第二轮修复后通过 | 前端生产构建；第三轮仅改 Rust，未重复此构建 |
| 第四轮真实桌面复测 | 已测范围无新增可复现应用问题 | 六次独立源码启动、真实现有书源、UI / 原生窗口 / SQL 对照 |

第四轮取得 TC-51 一次**自然并发、真实迟到非空正文**隔离证据；TC-50 仅验证 UI 清空书源后的真实缺源跨章失败。TC-44 验证了有效回环 URL 导入，不能外推为有效外网 URL 导入已测。

[runtime.json](test-reports/evidence/round-04/runtime.json) 保存逐文件指纹；[verification.json](test-reports/evidence/round-04/verification.json) 保存报告及证据核验。实测 executable SHA256 为 `2ffe7711ecc4303370f7df08292ed222aa425f937d4becdb13242389ba1a846d`；43 项运行文件聚合 SHA256 为 `53443803e035fdde2cc7a0e7d0806bd2c40001431d3a4e5f8f4a2f8fc2f6b829`，`AGENTS.md` 另行保护。新增交接文档与 Git 规则不属于当时运行文件集合。

Git 暂存文件逐项核对原始字节，检查了常见凭据标记及私有 / 生成文件排除，未做完整安全审计。`.gitattributes` 保留原始换行，避免 clone 后验收哈希失效；现有 `src-tauri/src/engine.rs:154` 和首轮 `test-reports/evidence/round-01/build.txt:16` 两处行尾空白保留原样，没有为格式检查改写实测源码或历史证据。

## 遗留边界与后续工作

| 项目 | 当前状态 | 接续所需前提 |
| --- | --- | --- |
| TC-26 同书换源 | 阻塞，未执行换源 | 用现有真实书源建立同书两个可用候选，再测持久化及定位 |
| TC-33 / EXT-01 相对搜索 URL | 原条件未复测，无可用请求对照 | 记录真实请求 URL、响应和规则，再判断应用或外站原因；零项不能直接定性 |
| EXT-02 A 历史在线抓取失败 | 本次无缓存 93 项目录、前两项及末项在线可读，历史归因未定 | 重演原失败请求，不能推定全部章节和任意网络时段可用 |
| EXT-03 B 历史一次详情失败 | 原在线条件未重演，既有缓存可读 | 保留历史失败，取得同条件在线请求 / 响应再归因 |
| TC-50 外部 HTTP 失败类型 | 未测 | 真实 HTTP 故障前提及正文失败前后游标对照，不伪造响应 |
| TC-47 文件导入 / TC-48 分类发现 | 未测，现有 UI 未观察到入口 | 先确认是否已有可操作入口，不将未开放功能算作缺陷 |
| 安装包及其它环境 | 未测 | 单独构建和验证 release / NSIS、安装升级及目标机器原生行为 |

其它未覆盖范围包括全部 164 个书源的网络可用性、有效外网 URL、动态 JS / Legado 全规则、外部应用焦点、多显示器等。没有已确认应用缺陷可直接继续修；扩大测试范围须先建立真实前提，发现新的可复现问题后再修。

后续沿用“主代理修业务、专职 `qa-real` 测真实桌面和写报告”的分工，测试期间冻结业务源码。下一轮使用 `test-reports/round-05.md`，新增问题从 MR-016 起，保留旧 TC / MR 编号。当前不用重启一轮测试来重复已完成验收。

## 数据与现场移交

- 正式数据在 Tauri `app_data_dir()/moyu_reader.db`，本机为 `%APPDATA%\com.moyu.reader2\moyu_reader.db`。四轮均用一致性副本，正式库只读保护，没有向正式目录恢复 QA 数据。
- 原 QA identifier 为 `com.moyu.reader2.qa.qamoyur0120261123135539`；工作库在 `%APPDATA%\<QA identifier>\moyu_reader.db`，独立 WebView2 profile 在 `<QA_TEMP>\WebView2\EBWebView`。
- `<QA_TEMP>` 为 `%LOCALAPPDATA%\Temp\opencode\qa-moyu-r01-20261123-135539`。最终私有检查点是 `round-04\final-round04.db`，完整性 `ok`，SHA256 为 `e965036ae7aab3da81f540c140599b1ca1d9944a86d353b58942346f0309ffd2`。
- 最终 QA 保留三书：A《不一样的三体》index 1 / total 93，B《暗体》0 / 978，C《我在三体科技造神！》1 / 73；最近阅读 A、164 源且仅“奇怪小说”启用、正文缓存 7、目录缓存 3、深色 24px、透明度 45%。不是正式用户现场。
- 第四轮收尾时 QA 自有进程为 0，1420 / 9315 / 9415 无监听；这是当时核验结果，下一次启动须重新检查，不能照抄历史 PID 管理进程。

同机接手可沿用私有 `run-dev.ps1` 和 `qa-cdp.mjs`，入口见最终报告。`run-dev.ps1` 内项目路径固定为 `D:\mywork\moyu-reader2.0`，换目录须核对私有脚本；先建立新的 QA 一致性检查点和确认端口归属再启动。不要重跑 `prepare.py`、覆盖 `original-backup.db` / 前轮检查点、原样批量重跑旧临时任务或向正式目录恢复 QA 数据。

**Git 只移交源码、测试、图标、配置、QA 代理约束及脱敏报告 / 证据。** 真实数据库、164 源原始 JSON / 凭据、完整 profile / 日志、私有 QA 工具和构建产物不提交。异机接手无法仅靠 clone 还原书源及现场，需另行获准迁移私有材料，或重新导入现有书源并建立独立隔离环境。

## 可重复的代码检查

从项目根目录用 PowerShell 7 执行；安装依赖用 `npm.cmd ci`，Node 须满足 `^20.19.0 || >=22.12.0`。Rust 工程位于 `src-tauri/`，根目录没有 Cargo workspace。

```powershell
npm.cmd test
npx.cmd --no-install tsc --noEmit
cargo test --manifest-path src-tauri/Cargo.toml --lib
cargo test --manifest-path src-tauri/Cargo.toml --test integration_tests test_full_pipeline_mock -- --exact
```

全量 Cargo 测试中的 `test_fetch_1335_json` 和 `test_real_world_sources_parsing` 有外网 / 外部夹具及宽松断言限制，不能用全绿替代真实验证。修改 `vite.config.ts` 时另跑 `npx.cmd --no-install tsc --noEmit --composite false -p tsconfig.node.json`。

`npm.cmd run dev` / `preview` 只启动网页，无法验证 Rust IPC；普通 `npm.cmd run tauri -- dev` 和开发 bat 没有 QA 隔离配置，会使用正式 identifier，不用于破坏性测试。若后续目标是交付安装包，可执行 `npm.cmd run tauri -- build`，再单独做 release / NSIS 验收；此命令不属于本次已执行项。
