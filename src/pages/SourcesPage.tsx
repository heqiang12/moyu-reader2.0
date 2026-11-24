import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import {
  deleteAllBookSources,
  deleteBookSources,
  getBookSources,
  readRemoteSourceFile,
  saveBookSources,
  saveBookSource,
} from "../api/client";
import type { BookSource } from "../api/types";
import ConfirmModal from "../components/ConfirmModal";

const parseSourcesPayload = (raw: string): unknown[] => {
  try {
    const trimmed = raw.trim().replace(/^\uFEFF/, "");
    let parsed: unknown = JSON.parse(trimmed);
    if (typeof parsed === "string") {
      parsed = JSON.parse(parsed);
    }
    if (parsed && typeof parsed === "object") {
      const container = parsed as Record<string, unknown>;
      parsed = container.bookSource ?? container.bookSources ?? container;
    }
    const list = Array.isArray(parsed) ? parsed : [parsed];
    return list.map((item) => (typeof item === "string" ? JSON.parse(item) : item));
  } catch {
    throw new Error("JSON 解析失败，请检查格式");
  }
};

export default function SourcesPage() {
  const [sources, setSources] = useState<BookSource[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [importUrl, setImportUrl] = useState("");
  const [importText, setImportText] = useState("");
  const [importing, setImporting] = useState(false);
  const [confirmClear, setConfirmClear] = useState(false);
  const [confirmBatchDelete, setConfirmBatchDelete] = useState(false);

  const load = async () => {
    setLoading(true);
    setError("");
    try {
      const list = await getBookSources();
      setSources(list);
      setSelected(new Set());
    } catch (e) {
      setError(e instanceof Error ? e.message : "书源加载失败");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const enabledCount = useMemo(
    () => sources.filter((s) => s.enabled !== false).length,
    [sources]
  );

  const toggleSource = async (source: BookSource) => {
    const next = { ...source, enabled: source.enabled === false };
    setSources((prev) =>
      prev.map((s) => (s.bookSourceUrl === source.bookSourceUrl ? next : s))
    );
    try {
      await saveBookSource(next);
    } catch (e) {
      alert(e instanceof Error ? e.message : "更新失败");
      setSources((prev) =>
        prev.map((s) => (s.bookSourceUrl === source.bookSourceUrl ? source : s))
      );
    }
  };

  const deleteSource = async (source: BookSource) => {
    try {
      await deleteBookSources([source]);
      setSources((prev) => prev.filter((s) => s.bookSourceUrl !== source.bookSourceUrl));
      setSelected((prev) => {
        const next = new Set(prev);
        next.delete(source.bookSourceUrl);
        return next;
      });
    } catch (e) {
      alert(e instanceof Error ? e.message : "删除失败");
    }
  };

  const toggleSelect = (url: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(url)) next.delete(url);
      else next.add(url);
      return next;
    });
  };

  const selectAll = () => {
    setSelected(new Set(sources.map((s) => s.bookSourceUrl)));
  };

  const selectNone = () => setSelected(new Set());

  const handleBatchDelete = async () => {
    if (selected.size === 0) return;
    const targets = sources.filter((s) => selected.has(s.bookSourceUrl));
    try {
      await deleteBookSources(targets);
      setSources((prev) => prev.filter((s) => !selected.has(s.bookSourceUrl)));
      setSelected(new Set());
    } catch (e) {
      alert(e instanceof Error ? e.message : "批量删除失败");
    } finally {
      setConfirmBatchDelete(false);
    }
  };

  const handleClearAll = async () => {
    try {
      await deleteAllBookSources();
      setSources([]);
      setSelected(new Set());
    } catch (e) {
      alert(e instanceof Error ? e.message : "清空失败");
    } finally {
      setConfirmClear(false);
    }
  };

  const importSources = async (raw: string, mode: "url" | "text") => {
    setImporting(true);
    try {
      if (mode === "url") {
        const targetUrl = importUrl.trim();
        if (!targetUrl) {
          alert("请输入书源 URL");
          return;
        }
        const msg = await readRemoteSourceFile(targetUrl);
        await load();
        setImportUrl("");
        alert(msg);
      } else {
        const payload = parseSourcesPayload(raw);
        if (payload.length === 0) {
          alert("没有解析到书源");
          return;
        }
        await saveBookSources(payload);
        await load();
        setImportText("");
        alert(`成功导入 ${payload.length} 条书源`);
      }
    } catch (e: unknown) {
      const errText =
        e instanceof Error
          ? e.message
          : typeof e === "string"
          ? e
          : JSON.stringify(e);
      alert(`导入失败: ${errText}`);
    } finally {
      setImporting(false);
    }
  };

  return (
    <div className="page sources-page">
      <header className="topbar">
        <Link to="/shelf" className="btn secondary small">
          ← 书架
        </Link>
        <div className="brand">书源管理</div>
        <div className="topbar-actions">
          <Link to="/discover" className="btn secondary small">
            发现
          </Link>
          <Link to="/settings" className="btn secondary small">
            设置
          </Link>
        </div>
      </header>

      <main className="page-content">
        <div className="sources-toolbar">
          <div className="sources-stats">
            共 {sources.length} 个书源 · 启用 {enabledCount} 个
          </div>
          <div className="sources-actions">
            <button className="btn secondary small" onClick={selectAll}>
              全选
            </button>
            <button className="btn secondary small" onClick={selectNone}>
              取消
            </button>
            <button
              className="btn danger small"
              onClick={() => setConfirmBatchDelete(true)}
              disabled={selected.size === 0}
            >
              删除选中
            </button>
            <button className="btn danger small" onClick={() => setConfirmClear(true)}>
              清空
            </button>
          </div>
        </div>

        <div className="sources-import">
          <div className="import-row">
            <input
              type="text"
              className="url-input"
              value={importUrl}
              onChange={(e) => setImportUrl(e.target.value)}
              placeholder="书源 JSON 链接…"
            />
            <button
              className="btn primary small"
              onClick={() => importSources(importUrl, "url")}
              disabled={importing || !importUrl.trim()}
            >
              导入 URL
            </button>
          </div>
          <textarea
            className="input-area"
            rows={4}
            value={importText}
            onChange={(e) => setImportText(e.target.value)}
            placeholder="或者把书源 JSON 粘贴到这儿…"
          />
          <button
            className="btn primary small"
            onClick={() => importSources(importText, "text")}
            disabled={importing || !importText.trim()}
          >
            粘贴导入
          </button>
        </div>

        {loading ? (
          <div className="detail-loading">
            <div className="loader" />
            <p>书源加载中…</p>
          </div>
        ) : error ? (
          <div className="empty-state">
            <div className="empty-icon">⚠️</div>
            <h3>加载出错</h3>
            <p>{error}</p>
            <button className="btn primary" onClick={load}>
              再试一次
            </button>
          </div>
        ) : sources.length === 0 ? (
          <div className="empty-state">
            <div className="empty-icon">📡</div>
            <h3>还没有书源</h3>
            <p>导入或粘贴 JSON 书源后就可以搜书了。</p>
          </div>
        ) : (
          <div className="sources-list">
            {sources.map((source) => (
              <div
                key={source.bookSourceUrl}
                className={`source-item ${selected.has(source.bookSourceUrl) ? "selected" : ""}`}
              >
                <input
                  type="checkbox"
                  checked={selected.has(source.bookSourceUrl)}
                  onChange={() => toggleSelect(source.bookSourceUrl)}
                />
                <div className="source-main">
                  <div className="source-name">{source.bookSourceName}</div>
                  <div className="source-url">{source.bookSourceUrl}</div>
                </div>
                <label className="toggle">
                  <input
                    type="checkbox"
                    checked={source.enabled !== false}
                    onChange={() => toggleSource(source)}
                  />
                  <span />
                </label>
                <button
                  className="btn danger small"
                  onClick={() => deleteSource(source)}
                >
                  删除
                </button>
              </div>
            ))}
          </div>
        )}
      </main>

      {confirmBatchDelete && (
        <ConfirmModal
          title="删除选中书源"
          message={`确定删除选中的 ${selected.size} 个书源吗？`}
          onConfirm={handleBatchDelete}
          onCancel={() => setConfirmBatchDelete(false)}
        />
      )}

      {confirmClear && (
        <ConfirmModal
          title="清空书源"
          message="确定清空所有书源吗？此操作不可恢复。"
          onConfirm={handleClearAll}
          onCancel={() => setConfirmClear(false)}
        />
      )}
    </div>
  );
}
