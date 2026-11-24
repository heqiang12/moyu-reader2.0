# 仓库指引

## 开发与构建

以下命令从仓库根目录执行；Rust 的 Cargo 项目在 `src-tauri/`，根目录没有 Cargo workspace。

- 安装依赖用 `npm ci`；锁文件中的 Vite 要求 Node 满足 `^20.19.0 || >=22.12.0`。
- 桌面开发用 `npm run tauri dev`，会自动启动 Vite。端口固定为 `1420`，被占用时直接失败，不会自动换端口。
- `npm run dev` / `npm run preview` 只启动网页；普通浏览器不能调用 Rust IPC，业务验证必须在 Tauri 桌面窗口中进行。
- `npm run build` 按 `tsc → vite build` 执行，只构建前端，不编译 Rust。
- PowerShell 向 npm 脚本传额外参数时显式用 `npm.cmd`；本机默认 `npm.ps1` 会吞掉裸 `--`，造成 `--outDir` 等选项丢失、路径被误当作 Vite 入口。
- 桌面构建用 `npm run tauri build`，当前打包目标为 Windows NSIS。`启动摸鱼阅读2.0.bat` 只运行根目录已有的 exe，不会编译或更新源码改动。
- Cargo HTTP 的 `check-revoke = false` 同时存在于 `.cargo/config.toml` 和 `src-tauri/.cargo/config.toml`；调整下载配置时核对两处。

## 执行边界

- Rust 从 `src-tauri/src/main.rs` 转入 `src-tauri/src/lib.rs::run()`，在后者初始化 DB/网络/爬虫、注册 `commands.rs` 命令。前端书籍/书源接口由 `src/api/client.ts` 通过 Tauri `invoke` 调用，没有独立 HTTP 后端。
- 新增或更改 IPC 时核对 `src/api/client.ts`、`src-tauri/src/commands.rs`、`src-tauri/src/lib.rs` 的命令注册，以及 `src/api/types.ts` / `src-tauri/src/types.rs` 的手写类型；调用参数和序列化字段使用 camelCase。
- `searchBookSSE` 实际使用 Tauri 的 `search:item` / `search:end` 事件，不是 HTTP SSE；先注册监听，再调用 `start_search`。
- 路由在 `src/App.tsx`，使用 `HashRouter`。主窗由 `src-tauri/tauri.conf.json` 声明；摸鱼窗由 `src-tauri/src/stealth.rs` 惰性创建，加载 `index.html#/stealth`。窗口权限在 `src-tauri/capabilities/default.json`，需覆盖 `main` 和 `stealth`。

## 验证

- 前端类型检查用 `npx --no-install tsc --noEmit`；共享进度与搜索 IPC 回归用 `npm test`（Node 内置测试及已安装 TypeScript，不启动桌面）；没有 lint 或 formatter 脚本。
- 真实 QA 的专用入口是 `qa-real` 子代理，定义见 `.opencode/agents/qa-real.md`；逐轮报告在 `test-reports/round-NN.md`，业务修复由主代理完成。
- 改 `vite.config.ts` 时另跑 `npx --no-install tsc --noEmit --composite false -p tsconfig.node.json`；本次禁用 composite，避免即使 `--noEmit` 仍生成 `tsconfig.node.tsbuildinfo`。
- Rust 单元测试用 `cargo test --manifest-path src-tauri/Cargo.toml --lib`；测试本身不访问外网书源，首次构建仍可能下载依赖。
- 单个测试示例：`cargo test --manifest-path src-tauri/Cargo.toml --lib db::tests::test_bookshelf_crud -- --exact`。
- 不依赖外网或外部夹具的集成检查：`cargo test --manifest-path src-tauri/Cargo.toml --test integration_tests test_full_pipeline_mock -- --exact`，使用内存 SQLite 和内嵌 HTML。
- 全量 `cargo test --manifest-path src-tauri/Cargo.toml` 包含 `src-tauri/tests/integration_tests.rs` 中的两项特殊测试，全绿不能证明它们验证成功：
  - `test_fetch_1335_json` 访问 yckceo.com，网络/JSON 解析错误仅打印。
  - `test_real_world_sources_parsing` 读取 `D:\mywork\moyu-yuedu\storage\data\default\bookSource.json`，文件不存在时无断言通过。

## 持久化与兼容性

- 运行时数据库为 Tauri `app_data_dir()/moyu_reader.db`（目录解析失败时回退当前目录），含书架、书源、章节缓存和章索引进度。表结构与兼容旧库的修改在 `src-tauri/src/db.rs::init_tables()`；测试使用 `Database::new_in_memory()`，不要清空真实用户库来验证。
- 章内位置、最近阅读与外观设置保存在 `src/lib/storage.ts` 的 `moyu:` localStorage 中，与 SQLite 的章索引进度分开；修改阅读定位须兼顾 `src/pages/ReaderPage.tsx` 和 `src/pages/StealthPage.tsx`。
- 书源保留新旧 Legado 的 `ruleSearch` / `searchRule` 等双命名；读取规则用 `src-tauri/src/types.rs` 的 `BookSource::get_rule_*`，保留旧字段及发现规则回退搜索规则的行为。
