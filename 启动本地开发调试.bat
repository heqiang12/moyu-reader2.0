@echo off
chcp 65001 >nul
title 摸鱼阅读 2.0 - 本地开发调试环境
cd /d "%~dp0"

echo ========================================================
echo    正在启动 摸鱼阅读 2.0 本地开发调试环境 (热重载模式)
echo ========================================================
echo.
echo * 纯开发模式，无需任何安装，关闭终端即可完全退出。
echo * 前端 (Vite) 与 Rust 内核联动热编译。
echo.

set CARGO_HTTP_CHECK_REVOKE=false
npm run tauri dev

pause
