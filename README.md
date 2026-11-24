# 摸鱼阅读 2.0

本分支 `handoff/qa-20261124` 为 **0.2.0 源码交接版**，使用 React、Tauri 2、Rust 和 SQLite。旧 Vanilla JS / TXT 实现在 `master` 保留，本分支不混用旧入口及配置。

已完成四轮真实桌面测试与对应修复，MR-001～MR-015 均已关闭；通过结论仅限报告列明的实测范围。

- [完整交接说明、当前进度与后续工作](HANDOFF.md)
- [第四轮最终验收及未测边界](test-reports/round-04.md)
- [开发、构建与数据保护指引](AGENTS.md)

仓库不含原始书源、用户数据库、完整 WebView2 profile 或私有 QA 工具；异机复测须另行获得书源并建立隔离环境。普通浏览器不能验证 Rust IPC。

本次交付源码，不交付已验证安装包。根目录旧 exe 没有更新，release / NSIS 及全部书源仍未验收。
