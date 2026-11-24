import { HashRouter, Navigate, Route, Routes } from "react-router-dom";
import "./App.css";
import BookDetailPage from "./pages/BookDetailPage";
import DiscoverPage from "./pages/DiscoverPage";
import ReaderPage from "./pages/ReaderPage";
import SettingsPage from "./pages/SettingsPage";
import ShelfPage from "./pages/ShelfPage";
import SourcesPage from "./pages/SourcesPage";
import StealthPage from "./pages/StealthPage";
import { isTauri } from "./api/client";

export default function App() {
  const inTauri = isTauri();

  return (
    <HashRouter>
      {!inTauri && (
        <div style={{
          backgroundColor: "#ff4d4f",
          color: "#fff",
          padding: "8px 16px",
          textAlign: "center",
          fontSize: "13px",
          fontWeight: 500,
          position: "sticky",
          top: 0,
          zIndex: 99999,
          boxShadow: "0 2px 8px rgba(0,0,0,0.15)"
        }}>
          ⚠️ 提示：您当前是在外部 Web 浏览器中直接打开了网页。摸鱼阅读 2.0 采用原生 Rust 内核（无需笨重 Java 和本地 HTTP 端口），请在启动的【桌面客户端窗口】中操作测试。
        </div>
      )}
      <Routes>
        <Route path="/shelf" element={<ShelfPage />} />
        <Route path="/discover" element={<DiscoverPage />} />
        <Route path="/sources" element={<SourcesPage />} />
        <Route path="/settings" element={<SettingsPage />} />
        <Route path="/book/:bookUrl" element={<BookDetailPage />} />
        <Route path="/read/:bookUrl" element={<ReaderPage />} />
        <Route path="/stealth" element={<StealthPage />} />
        <Route path="/" element={<Navigate to="/shelf" replace />} />
      </Routes>
    </HashRouter>
  );
}
