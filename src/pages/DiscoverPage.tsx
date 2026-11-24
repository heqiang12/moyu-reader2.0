import { useEffect, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { searchBookSSE } from "../api/client";
import type { SearchBook } from "../api/types";

const HOT_WORDS = ["诡秘之主", "三体", "红楼梦", "道诡异仙", "凡人修仙传"];

type AggregatedBook = SearchBook & { sources?: SearchBook[] };

const aggregateBooks = (prev: AggregatedBook[], next: SearchBook[]): AggregatedBook[] => {
  const map = new Map<string, AggregatedBook>();
  prev.forEach((b) => map.set(`${b.name}_${b.author}`, b));
  next.forEach((book) => {
    const key = `${book.name}_${book.author}`;
    const existing = map.get(key);
    if (existing) {
      if (!existing.sources) existing.sources = [existing];
      if (!existing.sources.some((s) => s.origin === book.origin)) {
        existing.sources.push(book);
      }
    } else {
      map.set(key, { ...book, sources: [book] });
    }
  });
  return Array.from(map.values()).sort((a, b) => {
    const aCount = a.sources?.length ?? 1;
    const bCount = b.sources?.length ?? 1;
    if (bCount !== aCount) return bCount - aCount;
    return (a.name || "").localeCompare(b.name || "", "zh-Hans-CN");
  });
};

export default function DiscoverPage() {
  const [keyword, setKeyword] = useState("");
  const [submittedKeyword, setSubmittedKeyword] = useState("");
  const [results, setResults] = useState<AggregatedBook[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [finished, setFinished] = useState(false);
  const closeRef = useRef<(() => void) | null>(null);
  const navigate = useNavigate();

  const resetSearch = () => {
    closeRef.current?.();
    closeRef.current = null;
    setResults([]);
    setError("");
    setFinished(false);
  };

  const handleSearch = (term = keyword) => {
    const key = term.trim();
    if (!key) return;
    resetSearch();
    setSubmittedKeyword(key);
    setLoading(true);

    closeRef.current = searchBookSSE(
      key,
      (batch) => {
        setResults((prev) => aggregateBooks(prev, batch));
      },
      () => {
        setLoading(false);
        setFinished(true);
      },
      (msg) => {
        setLoading(false);
        setError(msg);
      }
    );
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") handleSearch();
  };

  const handleHotWord = (word: string) => {
    setKeyword(word);
    handleSearch(word);
  };

  useEffect(() => {
    return () => {
      closeRef.current?.();
    };
  }, []);

  return (
    <div className="page discover-page">
      <header className="topbar">
        <Link to="/shelf" className="btn secondary small">
          ← 书架
        </Link>
        <div className="brand">发现</div>
        <div className="topbar-actions">
          <Link to="/sources" className="btn secondary small">
            书源
          </Link>
          <Link to="/settings" className="btn secondary small">
            设置
          </Link>
        </div>
      </header>

      <main className="page-content">
        <div className="search-box-wrapper">
          <div className="search-box">
            <input
              type="text"
              value={keyword}
              onChange={(e) => setKeyword(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="搜书名或作者…"
              autoFocus
            />
            <button className="btn primary" onClick={() => handleSearch()} disabled={!keyword.trim()}>
              {loading ? "搜索中…" : "搜索"}
            </button>
          </div>
        </div>

        {results.length === 0 && !loading && !error && (
          <div className="empty-state">
            <div className="empty-icon">🔍</div>
            <h3>{finished ? "没有找到相关书籍" : "想看点什么？"}</h3>
            <p>{finished ? `“${submittedKeyword}” 的搜索已结束，请换个关键词或检查书源。` : "输入关键词，多书源会同时帮你找。"}</p>
            <div className="hot-words">
              {HOT_WORDS.map((word) => (
                <button key={word} className="btn secondary small" onClick={() => handleHotWord(word)}>
                  {word}
                </button>
              ))}
            </div>
          </div>
        )}

        {error && (
          <div className="empty-state">
            <div className="empty-icon">⚠️</div>
            <h3>搜索出问题</h3>
            <p>{error}</p>
            <button className="btn primary" onClick={() => handleSearch()}>
              再试一次
            </button>
          </div>
        )}

        {results.length > 0 && (
          <div className="discover-results">
            <div className="results-meta">
              “{submittedKeyword}” 找到 {results.length} 本相关书籍
              {finished && <span className="results-done">（搜索结束）</span>}
            </div>
            <div className="result-list">
              {results.map((book) => (
                <div
                  key={book.bookUrl}
                  className="result-card"
                  onClick={() => navigate(`/book/${encodeURIComponent(book.bookUrl)}`, { state: { searchBook: book } })}
                >
                  <div className="result-cover">
                    {book.coverUrl ? (
                      <img src={book.coverUrl} alt={book.name} loading="lazy" />
                    ) : (
                      <div className="cover-placeholder small">
                        {(book.name || "?").slice(0, 1)}
                      </div>
                    )}
                  </div>
                  <div className="result-info">
                    <div className="result-title">{book.name}</div>
                    <div className="result-author">{book.author}</div>
                    {book.intro && <div className="result-intro">{book.intro}</div>}
                    <div className="result-source-count">
                      {(book.sources?.length ?? 1)} 个书源
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
