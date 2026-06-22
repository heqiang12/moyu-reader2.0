# AGENTS.md

This file provides guidance to OpenCode when working with code in this repository.

## Project

Moyu Reader 2.0 (摸鱼阅读器) - a desktop app for discreet reading at work. Tauri v2 (Rust) + Vite + Vanilla JS (no framework). Targets Windows, <10MB install, <50MB memory.

## Commands

```bash
npm test                    # Run all tests (vitest run)
npm run test:watch          # Tests in watch mode
npx vitest run tests/parser.test.js  # Single test file
npm run dev                 # Vite dev server only (port 5173)
npm run tauri dev           # Full Tauri dev (Vite + Rust compile + window)
npm run build               # Frontend build only
npm run tauri build         # Full production build (.exe installer)
npm run tauri:build         # Same as above (alias)
```

**Windows build requirement**: MSVC toolchain (Visual Studio Build Tools with C++ workload). Rust installed via rustup. If `link.exe` conflicts with Git's, prioritize MSVC in PATH.

**Test environment**: jsdom (configured in `vitest.config.js`), tests in `tests/` directory.

**Build output**: NSIS installer (.exe) at `src-tauri/target/release/bundle/nsis/`. Configured in `tauri.conf.json` with `bundle.targets: ["nsis"]`. Chinese language support enabled.

**Important**: Must use MSVC toolchain (`rustup default stable-x86_64-pc-windows-msvc`), not GNU toolchain. GNU toolchain will fail with `dlltool.exe` error.

## Architecture

**Routing**: State-driven SPA router (`src/core/router.js`). Subscribes to `store.state.page` changes, clears `#app`, calls registered render function. Routes: `bookshelf`, `reader`, `settings`. Use `router.forceRender()` when re-rendering the same page (e.g., mode switch).

**Store** (`src/core/store.js`): Reactive state with per-key subscriptions. `setState()` shallow-merges objects, only notifies subscribers for keys whose values actually changed (`!==` comparison). Important: if a key's value doesn't change, subscribers won't fire.

**Event Bus** (`src/core/event-bus.js`): Pub/sub for cross-module events. Modules clean up listeners via `eventBus.once('routeChange', cleanup)`.

**Storage** (`src/core/storage.js`): Dual persistence - localStorage for config/metadata (sync, `config_` prefix), IndexedDB for book text content (async, DB `moyu-reader`, store `books`).

**Module communication flow**:
- `bookshelf` → sets `store.currentBook` + `store.page='reader'`
- `reader.js` loads content, creates `TextParser`, gets chapter data (`{ text, paragraphs }`), delegates to mode renderer
- `normal-mode.js` renders full chapter as scrollable paragraphs, tracks scroll offset
- `stealth-mode.js` builds visual lines with char offset metadata, tracks line position
- `manager.js` subscribes to `store.readingMode`, calls `router.forceRender()`

**Progress tracking**: Uses character offset within chapter (`{ chapter, charOffset }`) — layout-independent, works across modes and window sizes. `syncCurrentProgress(offset)` saves to localStorage.

## Tauri Commands (Rust ↔ JS)

Three invoke commands defined in `src-tauri/src/lib.rs`:
- `register_boss_key` / `unregister_boss_key` — global hotkey management via `tauri-plugin-global-shortcut`
- `set_stealth_mode` — syncs stealth state to Rust so `toggle_window` knows window geometry on boss-key restore

Permissions are declared in `src-tauri/capabilities/default.json`. If you add a new Tauri plugin API, add its permissions there.

## Boss Key

Global hotkey (default `Ctrl+~`) hides window to system tray. The Rust side handles the actual toggle via tray icon and global shortcut plugin. JS side (`boss-key.js`) registers the shortcut and emits `bossKeyHidden`/`bossKeyShown` events.

`boss-key.js` has HMR self-healing: `import.meta.hot.accept` re-initializes the shortcut on hot replacement.

Shortcut format: frontend stores `CommandOrControl+...` format, `normalizeShortcutForRust()` converts to Rust plugin format at registration time.

## Stealth Mode

The core feature. When activated: body gets `app-stealth` CSS class (makes background transparent, hides titlebar), a fixed-position 32px text bar floats on the desktop. Configurable via settings: bg color, font color, font size, opacity, font family. Supports drag (long-press ≥300ms), wheel line-by-line scroll, double-click to next chapter, Escape to exit.

Key interaction detail: left-click is short-press page-turn, long-press is drag. This distinction is critical for the stealth UX.

## CSS Layout

- Dark theme via CSS custom properties in `src/style/index.css`
- Frameless window (`decorations: false` in `tauri.conf.json`) with custom titlebar using `-webkit-app-region: drag`
- Flex layout: `normal-mode` uses `height: 100vh` + flex column, content area needs `min-height: 0` for proper scrolling
- Do NOT use `-webkit-app-region: drag` on stealth-mode container (swallows all mouse events)
- `#app` height is `calc(100vh - 32px)` normally, overridden to `100vh` in stealth mode

## Design Docs

`docs/` contains fix plans and design docs for past features. Useful for understanding decisions but not required reading for normal work.

## Known Issues

- `store.books` initial state field is declared but unused (storage manages books directly)
