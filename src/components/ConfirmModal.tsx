type Props = {
  title: string;
  message: string;
  onConfirm: () => void;
  onCancel: () => void;
};

export default function ConfirmModal({ title, message, onConfirm, onCancel }: Props) {
  return (
    <div className="modal-overlay" onClick={onCancel}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">{title}</div>
        <div className="modal-body">{message}</div>
        <div className="modal-actions">
          <button className="btn secondary small" onClick={onCancel}>
            取消
          </button>
          <button className="btn danger small" onClick={onConfirm}>
            删除
          </button>
        </div>
      </div>
    </div>
  );
}
