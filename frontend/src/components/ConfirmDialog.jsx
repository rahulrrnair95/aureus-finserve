import Modal from './Modal';
import Button from './Button';
import { Alert } from './States';

/** Simple confirm dialog. onConfirm may be async; `error` shown inside. */
export default function ConfirmDialog({ open, title, children, confirmLabel = 'Confirm', cancelLabel = 'Cancel', danger, loading, error, onConfirm, onClose }) {
  return (
    <Modal
      open={open}
      title={title}
      onClose={onClose}
      footer={
        <>
          <Button variant="ghost" onClick={onClose} disabled={loading}>
            {cancelLabel}
          </Button>
          <Button variant={danger ? 'danger' : 'primary'} onClick={onConfirm} loading={loading}>
            {confirmLabel}
          </Button>
        </>
      }
    >
      <div className="stack">
        {children}
        {error && <Alert type="error">{error}</Alert>}
      </div>
    </Modal>
  );
}
