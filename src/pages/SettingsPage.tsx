import { useEffect, useState } from "react";
import { getVersion } from "@tauri-apps/api/app";
import { Link } from "react-router-dom";
import { KEYS, storage } from "../lib/storage";

type Theme = "light" | "dark";

const clearProgressCache = () => {
  try {
    const keys: string[] = [];
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key?.startsWith("moyu:progress:")) keys.push(key);
    }
    keys.forEach((k) => localStorage.removeItem(k));
    return keys.length;
  } catch {
    return 0;
  }
};

export default function SettingsPage() {
  const [theme, setTheme] = useState<Theme>(() => storage.get(KEYS.theme, "light"));
  const [fontSize, setFontSize] = useState(() => storage.get(KEYS.fontSize, 18));
  const [cleared, setCleared] = useState(0);
  const [version, setVersion] = useState("");

  useEffect(() => {
    getVersion().then(setVersion).catch((e) => console.error("读取应用版本失败:", e));
  }, []);

  useEffect(() => {
    document.documentElement.setAttribute("data-theme", theme);
    storage.set(KEYS.theme, theme);
  }, [theme]);

  useEffect(() => {
    storage.set(KEYS.fontSize, fontSize);
  }, [fontSize]);

  const handleClearCache = () => {
    if (!window.confirm("确定清除所有本地阅读进度缓存吗？清除后再次打开章节会从开头开始。")) {
      return;
    }
    const count = clearProgressCache();
    setCleared(count);
    window.setTimeout(() => setCleared(0), 3000);
  };

  return (
    <div className="page settings-page">
      <header className="topbar">
        <Link to="/shelf" className="btn secondary small">
          ← 书架
        </Link>
        <div className="brand">设置</div>
        <div className="topbar-actions">
          <Link to="/discover" className="btn secondary small">
            发现
          </Link>
          <Link to="/sources" className="btn secondary small">
            书源
          </Link>
        </div>
      </header>

      <main className="page-content">
        <div className="settings-panel">
          <section className="setting-section">
            <h4>外观</h4>
            <div className="setting-options">
              <div className="setting-row">
                <span>主题</span>
                <div className="theme-switcher">
                  <button
                    className={`btn small ${theme === "light" ? "primary" : "secondary"}`}
                    onClick={() => setTheme("light")}
                  >
                    浅色
                  </button>
                  <button
                    className={`btn small ${theme === "dark" ? "primary" : "secondary"}`}
                    onClick={() => setTheme("dark")}
                  >
                    深色
                  </button>
                </div>
              </div>
              <div className="setting-row">
                <span>正文字号 ({fontSize}px)</span>
                <input
                  type="range"
                  min={12}
                  max={32}
                  value={fontSize}
                  onChange={(e) => setFontSize(Number(e.target.value))}
                />
              </div>
            </div>
          </section>

          <section className="setting-section">
            <h4>阅读</h4>
            <div className="setting-options">
              <div className="setting-row">
                <span>本地进度缓存</span>
                <button className="btn secondary small" onClick={handleClearCache}>
                  清除缓存
                </button>
              </div>
              {cleared > 0 && (
                <div className="setting-hint">已清除 {cleared} 条进度缓存</div>
              )}
            </div>
          </section>

          <section className="setting-section">
            <h4>快捷键与关闭行为</h4>
            <div className="setting-options">
              <div className="setting-row disabled">
                <span>全局老板键 / 关闭行为 / 隐蔽窗口设置</span>
                <button className="btn secondary small" disabled>
                  即将到来
                </button>
              </div>
              <p className="setting-hint">这些设置需要和 Rust 主进程配合，下一阶段开放。</p>
            </div>
          </section>

          <section className="setting-section">
            <h4>关于</h4>
            <div className="setting-options">
              <div className="about-card">
                <div className="about-name">摸鱼阅读 V2</div>
                <div className="about-version">版本 {version || "未知"}</div>
              </div>
            </div>
          </section>
        </div>
      </main>
    </div>
  );
}
