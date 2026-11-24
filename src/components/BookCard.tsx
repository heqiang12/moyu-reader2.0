import type { Book } from "../api/types";

type Props = {
  book: Book;
  onClick: () => void;
  onDelete: () => void;
};

export default function BookCard({ book, onClick, onDelete }: Props) {
  const cover = book.coverUrl || book.customCoverUrl;
  const firstChar = (book.name || "?").slice(0, 1);
  const progressText =
    book.totalChapterNum > 0
      ? `第 ${book.durChapterIndex + 1} / ${book.totalChapterNum} 章`
      : "尚未开始";

  return (
    <div className="book-card" onClick={onClick}>
      <button
        className="book-delete-btn"
        onClick={(e) => {
          e.stopPropagation();
          onDelete();
        }}
        title="删除"
      >
        ×
      </button>
      <div className="book-cover">
        {cover ? (
          <img src={cover} alt={book.name} loading="lazy" />
        ) : (
          <div className="cover-placeholder">{firstChar}</div>
        )}
      </div>
      <div className="book-info">
        <div className="book-name" title={book.name}>
          {book.name}
        </div>
        <div className="book-author" title={book.author}>
          {book.author}
        </div>
        <div className="book-progress">{progressText}</div>
      </div>
    </div>
  );
}
