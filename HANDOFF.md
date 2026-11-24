# 项目移交说明

更新日期：2026-11-24。最近真实验收为第六轮；本处测试、修复工作已经停止，接下来交给别处继续。

## 当前进度

已完成第一至第六轮真实 Tauri / WebView2 测试。**MR-001～MR-015 保持第四轮的历史关闭决定；第五轮新增的 MR-016～MR-018 已在第六轮按原复现条件关闭。** 第六轮已测范围内未确认新增应用问题，未分配 MR-019。未重跑、阻塞和未测项不能算通过。

验收对象为当前 **0.2.0 源码构建的 debug 桌面程序**。根目录 `摸鱼阅读2.0.exe` 没有更新，NSIS / release 安装包没有构建验收；`启动摸鱼阅读2.0.bat` 仍运行旧 exe。54 项用例矩阵中包含阻塞和未测项，不能表述为“54 项全部通过”或“整应用无 bug”。

用户明确要求**第六轮之后不再修复，只整理、提交和推送，交给别处继续**。本次交付包含第六轮之前完成的三项业务修复及自动回归、第五/六轮脱敏报告与证据，以及交接文档。第六轮之后只整理文档，不再改业务源码、启动 QA 或开展 release/安装验收。

## 接手后的轻量内部测试约定

用户随后明确：这里是内部测试，后续以效率优先，**不再照搬旧轮的严格审计流程**。以下约定已同步到 `AGENTS.md` 和 `.opencode/agents/qa-real.md`；只调整后续工作方式，不改写已有报告、证据或关闭结论。

- 复用已有明确的QA数据库、profile、identifier和工具；内部测试数据可直接增删、清空、重建。环境缺失时只搭建一次，不要求每轮复制数据库/profile或建立新停止检查点。
- 内部截图和日志原样留本机，**不强制脱敏**。问题按需留1～2张有用截图，通过项不批量取证；不做发布用裁剪、逐像素核验、全量文件哈希、manifest或WAL审计。
- 开始时一次记录分支、HEAD、未提交改动和启动方式即可。报告默认一页左右，只列实际已测范围、问题/阻塞/未测、必要复现步骤及接续入口；保留TC/MR编号，不强制重排54项矩阵。
- 修复复测只覆盖原问题和直接相关项，不反复完整回归。收尾目标5～10分钟：一次停止自有进程、写报告并交付；非关键取证问题记为限制，不为了完美报告持续延迟。
- 主代理复用QA已有结论，不重复读取大日志、复算指纹或重新审计。重新委派/复用旧子会话时明确采用最新轻量约定，不再附加历史长任务的严格要求。纯文档改动不跑npm/Cargo或桌面测试。
- 保留基本正确性：测试必须是真实当前Tauri，未测不能标通过，仅管理自有进程，不误操作正式/未知用户数据。内部材料无需脱敏不代表自动公开，完整库/profile、凭据及私有工具不自动推到公开Git仓库。

## Git 与交接分支

首次交接前目录没有 `.git`，没有可引用的逐轮修复历史。源码快照提交 **`61361031eba17d42fa121cab1a45e5eb255a5c9d`** 包含当时源码、测试和四轮报告/证据；不能用 Git 回退重演此前各轮修复前版本。

用户此前确认目标为 **`heqiang12/moyu-reader2.0`，要求新建分支，不覆盖原有默认分支**。仓库已存在且公开，默认分支实际为 **`master`**，首次交接前 SHA 为 **`cb7dcb69d62cb339d193f7d66600ebee0a70e6d6`**；没有创建仓库或更改可见性。本地交接分支为 **`handoff/qa-20261124`**，`origin` 为 `https://github.com/heqiang12/moyu-reader2.0.git`；初始本地 `main` 保留，首次推送前远端不存在同名交接分支。

旧 `master` 是 Vanilla JS / TXT 阅读实现，使用 `vite.config.js` 和 5173 端口，与当前 React / Rust / SQLite 实现不同。交接分支以合并父提交衔接旧历史，工作树采用**当前 0.2.0 完整验收快照**，不混入旧 JS 入口、旧 Vite / Vitest 配置、旧版代理设置或构建流程。旧代码、文档和文件在 `master` 及原历史中完整保留，不把本分支当作对旧版的几个补丁，也不直接合回默认分支。

首次交接曾遇到 GitHub EOF / TLS 网络阻塞和直连时的认证无效误报，网页设备登录没有取得授权码。用户恢复网络后，使用现有 `heqiang12` 登录和本机已有系统代理继续；仅向 Git / GitHub CLI 子进程设置代理环境变量，没有改全局代理或关闭证书校验，不把 token 写进文件或聊天。

此前交接已推送并读回核验：[交接分支](https://github.com/heqiang12/moyu-reader2.0/tree/handoff/qa-20261124)。历史衔接提交为 **`c83deda2f32dce9ab19abdc784cab00d07966c03`**；本次续测基底为 **`cb56b36a7c3a310ffe850a9fa355ac7273d59bb1`**。第六轮测试时三项业务修复及回归文件尚未提交，不能把基底 HEAD 当成已含修复的版本。

本次仍只正常推送 `handoff/qa-20261124`，不强推、不推标签、不改 `master`/远端 `main`、不创建 PR 或合入默认分支。第六轮修复及报告交付提交为 **`8b8c06a6fd129bbfe41e01f7f781aad6aa8f15d5`**，已推送核验；后续轻量流程调整仅改文档，最新提交以此远端分支和 `git log -1` 为准。业务文件保持第六轮实测版本，历史指纹保留供按需排查，不要求接手重新全量核验。

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

1. [第六轮最终验收](test-reports/round-06.md)：MR-016～MR-018 关闭决定、完整54项矩阵、未完成范围、最终停止现场及工具依赖。
2. [第五轮修复](test-reports/fixes-round-05.md) / [第五轮真实测试](test-reports/round-05.md)：三项根因、最小修复、自动回归和原始失败证据。
3. [第四轮验收](test-reports/round-04.md) / [第三轮修复](test-reports/fixes-round-03.md)：MR-001～MR-015 的历史关闭及数据库修复。
4. [第二轮修复](test-reports/fixes-round-02.md) / [第一轮修复](test-reports/fixes-round-01.md)：此前改动与回归映射。
5. [仓库指引](AGENTS.md) / [专职 QA 约束](.opencode/agents/qa-real.md)：构建、IPC、数据保护和真实测试边界。

`fixes-round-*.md` 保留修复时“候选修复、待复测”的历史措辞；最终状态以后续真实报告为准：MR-001～MR-015 看第四轮，MR-016～MR-018 看第六轮。不要覆盖旧报告和证据来改写历史。

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
| MR-016 | 合法书源 JSON 的规则/说明包含防护词，外网 URL 导入被误报 WAF |
| MR-017 | 原样根相对搜索模板未合并书源 origin，内部请求失败却显示零结果 |
| MR-018 | 正文已初显时的真实滚动被固定恢复等待窗口吞掉，续读丢失新位置 |

主窗关闭仍为**退出应用**，没有新增“关闭到托盘”设置。拖动权限只授予 `stealth`，没有授予主窗。

## 代码接续点

- `src/api/client.ts`、`src-tauri/src/commands.rs`、`src-tauri/src/lib.rs` 和两侧 `types` 是 IPC 契约的共同边界，参数及序列化字段使用 camelCase。
- `searchBookSSE` 使用 Tauri 事件，不是 HTTP SSE。`start_search` 接受 `keyword` / `requestId`；`search:item` 为 `{ requestId, books }`，`search:end` 为同一 requestId 字符串。先注册监听再启动；取消会清理前端订阅，旧后台网络任务可能继续执行。
- `src/lib/storage.ts` 的 `moyu:progress:<bookUrl>` 保存 `{ chapterIndex, progress }`，兼容旧数字进度；它只保存该书最新位置，不是每章位置历史。SQLite 另存章索引，不能混成同一种进度。
- `src/lib/segment.ts`、`src/pages/ReaderPage.tsx`、`src/pages/StealthPage.tsx` 共用字符位置。继续修改定位时，须同时验证两窗、跨章、同章恢复和立即返回。
- `src/pages/BookDetailPage.tsx` 隔离过期加载和首次入架状态；`src/pages/DiscoverPage.tsx` 处理搜索替代、热词和结果入口。
- `src-tauri/src/stealth.rs` 负责建窗、重开事件、老板键、穿透和托盘。隐蔽 IPC 为 `open_stealth_window` / `hide_stealth_window` / `get_stealth_state`；显示事件为 `stealth:show`。`src-tauri/capabilities/stealth-drag.json` 仅增加隐蔽窗拖动权限。
- MR-015 的共享修复在 `src-tauri/src/db.rs`：有效非空缓存目录补齐为 0 的总章数，覆盖缓存读取、入架及旧库初始化，保留定位、章名、阅读时间、目录 JSON 和更新时间。没有修改 SQLite 表结构，没有清空用户库。
- MR-016 在 `src-tauri/src/network.rs`：合法 JSON 不按其规则/说明内防护词判为 HTML 质询；真实 HTML 防护与非成功 HTTP 状态仍拒绝。
- MR-017 在 `src-tauri/src/crawler.rs::search_single_source()`：替换并编码关键词后复用 `engine::resolve_url()`，按 `bookSourceUrl` 合并请求 URL，不改原样存储模板。
- MR-018 在 `src/pages/ReaderPage.tsx`：用 `useLayoutEffect` 在正文可见前恢复，记录实际 `scrollTop`（含底部钳制），仅忽略对应程序恢复位置的滚动，不再以120ms计时器吞掉用户滚动。回归见 `tests/regressions.test.mjs`。
- 旧新 Legado 规则双命名及发现规则回退继续由 `src-tauri/src/types.rs::BookSource::get_rule_*` 兼容；本次没有承诺支持全部动态 JS / Legado 规则。

## 验证证据

| 检查 | 最近已执行结果 | 证明范围 |
| --- | --- | --- |
| `npm.cmd test` | 17/17 通过 | 新增三项早期滚动/程序恢复/切章回归；不等于真实 DOM/原生 UI 实测 |
| `npx.cmd --no-install tsc --noEmit` | 通过 | 前端类型检查 |
| Rust `--lib` | 14/14 通过 | 新增合法 JSON 防护词和相对/绝对搜索请求回归；仅回环 HTTP，不访问外部书源 |
| `test_full_pipeline_mock` | 1/1 通过 | 内存 SQLite / 内嵌 HTML；含总章数断言 |
| `npm.cmd run build -- --outDir <批准临时目录>` | 第五轮修复后通过 | 前端生产构建；没有覆盖既有 `dist`，不等于 Rust release/NSIS 构建 |
| 第五轮真实桌面测试 | 新增 MR-016～MR-018 | 原外网导入、相对搜索与初显滚动真实失败；此前报告/证据保留 |
| 第六轮真实桌面复测 | 三项原问题关闭，已测范围未确认新问题 | 原外网 URL 正负控、原模板搜索、早期/立即返回/重启定位、缓存跨章/双窗及原生行为；完整矩阵保留未测 |

第六轮 TC-44 已验证原 XIU2 和 yck 有效外网 URL 导入及独立持久化；原回环条件没有重跑。TC-41 取得往返后旧搜索批次晚492ms到达的自然竞争证据。第五轮 TC-49/51 的真实未缓存加载门控及旧 C 非空正文晚1440ms证据保留，但第六轮未重跑；它们不能代替 TC-50 的外部 HTTP 正文失败/重试。

[第六轮 runtime.json](test-reports/evidence/round-06/runtime.json) 保存67项实测文件及四项候选修改的逐文件指纹；[verification.json](test-reports/evidence/round-06/verification.json) 保存最终15项保护核验。不同运行二进制分别记录，最后 run15 exe SHA256 为 `282ab3f6679c7e22c502491dfbec03e412f5899d624231e67a7132747e27ed79`。第五/六轮指纹范围不同，不直接比较聚合值；最终本文为实测后文档更新，业务源码与回归文件保持实测字节。

上述指纹、裁剪、脱敏、停止点和完整性核验均为历史记录，**不是接手后的默认必做步骤**；按新的轻量内部测试约定执行即可。

两轮新证据 manifest 的文件大小/SHA256 已核对，常见凭据标记扫描未发现匹配；不等于完整安全审计。`.gitattributes` 保留原始换行，避免 clone 后验收哈希失效；现有 `src-tauri/src/engine.rs:154` 和首轮 `test-reports/evidence/round-01/build.txt:16` 两处行尾空白保留原样，没有为格式检查改写实测源码或历史证据。

## 遗留边界与后续工作

| 项目 | 当前状态 | 接续所需前提 |
| --- | --- | --- |
| TC-26 同书换源 | 阻塞，有限10源未建立第二可读内容站，完整换源链未执行 | 同书两个真实可用候选；预览显示源/目录/实际入架一致；已入架换源后立即返架、原生重开及重启的 SQL/章内位置/最近阅读保护 |
| TC-50 外部 HTTP 正文失败/重试 | 未测，F三次正文均成功 | 真实正常源的外部正文失败及重试，失败前后游标/缓存对照；缺源、搜索故障、外围 GET 不替代 |
| TC-30/31 托盘恢复/菜单退出 | 原生投递未确认，不计通过或应用缺陷 | 取得实际自有图标级投递及恢复/菜单证据，不能用聚焦主窗或关闭 main 替代 |
| TC-33 / EXT-01 相对搜索 URL | MR-017 原条件已关闭 | 仅原样根相对模板及所列关键词；其它动态/相对语法未保证 |
| EXT-02 A 历史在线抓取失败 | 第五/六轮没有历史现场；本轮继承缓存受保护 | 重演原失败请求，不能以F新书在线成功推定旧条件恢复或全部章节可用 |
| EXT-03 B 历史一次详情失败 | 本轮历史B现场缺失，未测 | 取得同条件在线请求/响应，不能沿用其它轮次缓存阅读作在线通过 |
| TC-47 文件导入 / TC-48 分类发现 | 未测，现有 UI 未观察到入口 | 先确认是否已有可操作入口，不将未开放功能算作缺陷 |
| 安装包及其它环境 | 未测；第六轮不是标准用户权限验收 | 接手方另行构建验证 release/NSIS、安装升级、Windows产品版本资源、标准用户及目标机器原生行为 |

其它保留范围见第六轮矩阵，包括有效粘贴、热词/同页中途换词、清进度确认、源删除确认/清空恢复、非当前/最后一本删除、旧数字迁移/旧C初始化、无在读空态、全部192源/完整Legado规则、外部应用焦点和多显示器等。当前没有已确认待修应用问题；目录首末重复等仅为观察，未确定应用根因。

本处已停止，不开启第七轮或继续修复。接手方另行决定后续工作；如授权新测试，沿用主代理修业务/专职 `qa-real` 测真实桌面的分工，按轻量约定确认测试版本并优先复用已有QA现场。新报告从 `test-reports/round-07.md` 开始，新问题从 MR-019 起，保留旧 TC/MR 编号，只列本轮相关项。

## 数据与现场移交

- 正式数据库解析为 Tauri `app_data_dir()/moyu_reader.db`，正常 identifier 为 `com.moyu.reader2`。第五/六轮核对的已知正式路径和指定旧QA路径均不存在，不能声称已备份不存在的正式库；未扫描未知用户目录，也未向正式目录恢复QA数据。
- 旧第四轮指定现场及私有脚本未找到，不能继续使用本文历史版本中的旧入口。第五轮重新建立公开源隔离现场，第六轮从其停止库/profile只读一致性复制，不是恢复历史正式164源。
- 本轮 `<QA_TEMP>` 为 `%LOCALAPPDATA%\Temp\opencode\qa-moyu-r06-20261124063430-6de851`；identifier 为 `com.moyu.reader2.qa.r06202611240634306de851`，独立工作库在 `%APPDATA%\<QA identifier>\moyu_reader.db`，profile 在 `<QA_TEMP>\WebView2\EBWebView`。
- 最终不可覆盖检查点为 `checkpoints\run15-stopped.db`，完整性 **ok**，SHA256 **`f052888ae25ae3df8d1169d7b57252872a258d375157f75a0bd3bc66681cf350`**；`run15-stopped-profile` **440文件**，聚合 SHA256 **`07cacf86d515b97b16944875dd63e78b796ee7e17c043a3b9affd1c22db5874d`**。
- 第五轮原停止现场在同一临时根的 `qa-moyu-r05-20261124-122315-6ef8ca`；`checkpoints\run09-stopped.db` 和412文件停止profile保持不变。本轮 run10基线及run11～run15各停止检查点均需保护，不覆盖或批量重跑旧任务。
- 最终QA保留A《不一样的三体》index1/93、章内 `0.23893805309734514`（10/36段）；C《我在三体科技造神！》index1/73、章内 `0.9999`（主动跨章后底部36/36段）。C早期新比例 `0.2765072765072765` 的独立11/36复测已成立，最终底部值不是定位丢失。
- 最近阅读C；192源仅“奇怪小说”启用，正文缓存5、目录缓存3、18px深色、透明度45%。F《凡人修仙传》本轮正常新增测试后已删除，以上全部是QA数据，不是正式用户现场。
- 第六轮最终15项保护核验全通过：自有进程0、QA profile占用0，1420/9325/9326无相关监听。只按PID+创建时间核对自有进程，不管理复用PID；接手启动前仍需重新检查。

同机工具及依赖见[第六轮报告末节](test-reports/round-06.md#临时工具与依赖未执行的新入口)。可直接复用现有QA工作库/profile和工具，确认当前checkout路径、固定1420端口及自有进程即可，不要求重新复制全部现场。保留历史检查点供需要时查阅，但不必为每轮再建检查点或证明其逐字节不变。异机仅在材料缺失时重建环境或另行私密迁移一次。Node工具使用 `node:sqlite`、内置WebSocket及直接TS导入，本机为Node26，不能假设最低前端Node版本即可运行全部私有工具。

**Git 默认移交源码、测试、图标、配置、QA代理约束和简短报告，截图/小日志按需附带。** 内部材料不强制脱敏，也不要求为提交生成完整证据包。完整数据库、书源凭据、profile/完整日志、私有工具和构建产物不自动提交到公开仓库；需要另行获准迁移。异机无法仅靠clone还原本机现场。第五/六轮已有证据目录分别35/39文件（含manifest），保留原样，不再追加审计或重加工。

## 可重复的代码检查

从项目根目录用 PowerShell 7 执行；安装依赖用 `npm.cmd ci`，Node 须满足 `^20.19.0 || >=22.12.0`。Rust 工程位于 `src-tauri/`，根目录没有 Cargo workspace。

以下是按需检查入口，不要求每轮全部执行；只选与改动相关的项目，复用本轮已经通过的结果。纯文档调整只做必要的Git差异检查，不重跑这些测试或构建。

```powershell
npm.cmd test
npx.cmd --no-install tsc --noEmit
cargo test --manifest-path src-tauri/Cargo.toml --lib
cargo test --manifest-path src-tauri/Cargo.toml --test integration_tests test_full_pipeline_mock -- --exact
```

全量 Cargo 测试中的 `test_fetch_1335_json` 和 `test_real_world_sources_parsing` 有外网 / 外部夹具及宽松断言限制，不能用全绿替代真实验证。修改 `vite.config.ts` 时另跑 `npx.cmd --no-install tsc --noEmit --composite false -p tsconfig.node.json`。

本机Cargo不在当前终端PATH，但可用 `& "$env:USERPROFILE\.cargo\bin\cargo.exe"` 代替上述 `cargo`；第五轮修复检查使用了已安装依赖的 `--locked --offline`。异机仍需自行准备Rust/MSVC/WebView2等构建依赖。

`npm.cmd run dev` / `preview` 只启动网页，无法验证 Rust IPC；普通 `npm.cmd run tauri -- dev` 和开发 bat 没有 QA 隔离配置，会使用正式 identifier，不用于破坏性测试。若后续目标是交付安装包，可执行 `npm.cmd run tauri -- build`，再单独做 release / NSIS 验收；此命令不属于本次已执行项。
