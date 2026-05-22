# 摸鱼阅读器 2.0 (Moyu Reader 2.0)

> **一款专为办公环境设计的独立桌面"摸鱼"阅读器。**  
> 核心卖点：**极致轻量（<10MB）**、**极低内存（<50MB）**、**无边框自由拖拽**、**窗口伪装变形** 与 **全局老板键**。

---

## 产品理念与核心场景

在办公环境下，传统的电子书阅读器界面特征太明显，容易被同事或领导一眼识破。

**摸鱼阅读器 2.0** 通过将**小说文本内容伪装成正常工作界面**，并结合**高自由度的悬浮窗拖拽与变形能力**，完美解决了这个问题。

### 核心功能

- **智能书架**：支持本地 TXT 导入，自动识别 UTF-8 / GBK 编码，自动提取章节目录，记录阅读进度
- **2 种阅读模式**：
  - **正常模式**：标准极简电子书排版，适合专注阅读
  - **隐蔽模式（核心卖点）**：窗口缩为极窄单行文本条，可自定义背景色、透明度、字体，支持自由拖拽，鼠标滚轮翻行，完美融入桌面环境
- **全局老板键**：系统级热键（默认 `Ctrl + ~`），按下即可瞬时隐藏至系统托盘，任务栏不留痕迹
- **无边框自由拖拽**：去除原生窗口边框，界面各区域可自由移动，双击或快捷键快速调整大小

---

## 技术栈

| 组件 | 技术 | 说明 |
|------|------|------|
| 桌面外壳 | Tauri v2 (Rust) | 系统原生 WebView，<10MB 打包体积 |
| 前端核心 | Vite + Vanilla JS | 零框架运行时，最快启动速度 |
| 数据存储 | localStorage + IndexedDB | 配置/进度同步存储，大文本异步读取 |

---

## 快速开始

### 环境要求

- Node.js 18+
- Rust (rustup)
- Windows: MSVC Build Tools (Visual Studio C++ workload)

### 安装与运行

```bash
# 安装依赖
npm install

# 开发模式（仅前端）
npm run dev

# 开发模式（完整 Tauri）
npm run tauri dev

# 运行测试
npm test

# 生产构建
npm run tauri build
```

---

## 项目结构

```
moyu-reader2.0/
├── index.html                      # 前端入口
├── package.json
├── vite.config.js
├── vitest.config.js
│
├── src/                            # 前端代码
│   ├── main.js                     # 应用初始化、路由启动
│   │
│   ├── style/                      # 样式文件
│   │   ├── index.css               # 全局样式 & CSS 变量
│   │   ├── titlebar.css            # 自定义标题栏样式
│   │   ├── bookshelf.css           # 书架页
│   │   ├── reader.css              # 阅读器基础样式
│   │   ├── settings.css            # 设置页
│   │   ├── resize-handles.css      # 窗口调整手柄
│   │   └── modes/
│   │       ├── normal-mode.css     # 正常阅读
│   │       └── stealth-mode.css    # 隐蔽模式
│   │
│   ├── core/                       # 核心层
│   │   ├── router.js               # 状态驱动 SPA 路由
│   │   ├── store.js                # 轻量级响应式状态管理
│   │   ├── storage.js              # 持久化层 (localStorage + IndexedDB)
│   │   └── event-bus.js            # 全局事件总线
│   │
│   ├── modules/                    # 功能模块
│   │   ├── titlebar/
│   │   │   ├── titlebar.js         # 自定义标题栏
│   │   │   └── resize-handles.js   # 窗口调整手柄
│   │   ├── bookshelf/
│   │   │   ├── bookshelf.js        # 书架逻辑
│   │   │   └── book-card.js        # 书籍卡片组件
│   │   ├── reader/
│   │   │   ├── reader.js           # 阅读器主逻辑
│   │   │   ├── parser.js           # TXT 章节解析器
│   │   │   └── chapter-nav.js      # 章节目录导航
│   │   ├── modes/
│   │   │   ├── manager.js          # 阅读模式管理器
│   │   │   ├── normal-mode.js      # 正常模式渲染器
│   │   │   ├── stealth-mode.js     # 隐蔽模式渲染器
│   │   │   └── stealth-window.js   # 隐蔽模式窗口控制
│   │   ├── settings/
│   │   │   ├── settings.js         # 设置页面
│   │   │   └── key-utils.js        # 快捷键工具
│   │   └── boss-key/
│   │       └── boss-key.js         # 老板键模块
│   │
│   └── utils/
│       ├── text-utils.js           # 文本处理
│       └── dom-utils.js            # DOM 工具
│
├── tests/                          # 测试文件
│   ├── parser.test.js              # 章节解析测试
│   ├── store.test.js               # 状态管理测试
│   ├── modes.test.js               # 阅读模式测试
│   ├── boss-key.test.js            # 老板键测试
│   ├── settings.test.js            # 设置测试
│   ├── key-utils.test.js           # 快捷键测试
│   └── text-utils.test.js          # 文本工具测试
│
├── src-tauri/                      # Tauri 后端 (Rust)
│   ├── Cargo.toml
│   ├── tauri.conf.json
│   ├── capabilities/
│   │   └── default.json            # 权限声明
│   └── src/
│       ├── main.rs                 # Rust 入口
│       └── lib.rs                  # 托盘、快捷键、系统调用
│
└── docs/                           # 设计文档
```

---

## 阅读模式

### 正常模式

- 窗口尺寸：可自由拉伸，默认 800 x 600 px
- 标准极简电子书排版，清晰易读
- 操作：方向键 / 鼠标滚轮 / 点击翻页，支持章节跳转

### 隐蔽模式

- 窗口尺寸：默认 800 x 32 px，宽度可调节
- 无边框，无任何按钮，极简到像一条系统状态提示
- 窗口位置：默认位于桌面最下方，可自由拖拽
- 视觉自定义：
  - 背景色支持任意颜色（含透明度调节）
  - 字体颜色、字号、字体可自定义
  - 整体可设为半透明，完美融入任何桌面壁纸
- 操作：鼠标滚轮翻行，拖拽移动位置，双击或快捷键切换回正常模式

---

## 老板键与防窥机制

1. **系统全局热键**：利用 Tauri 全局热键监听（默认 `Ctrl + ~`）
   - 窗口瞬间隐藏，在任务栏彻底消失
   - 支持自定义快捷键组合
2. **托盘图标低调化**：采用低调图标，右键菜单合理伪装
3. **自动失焦隐藏**：支持配置窗口失去焦点时自动隐藏

---

## 开发命令

```bash
npm test                    # 运行所有测试
npm run test:watch          # 测试监听模式
npx vitest run tests/parser.test.js  # 运行单个测试文件
npm run dev                 # Vite 开发服务器 (端口 5173)
npm run tauri dev           # 完整 Tauri 开发 (前端 + Rust 编译 + 窗口)
npm run build               # 仅前端构建
npm run tauri build         # 完整生产构建
```

---

## License

ISC
