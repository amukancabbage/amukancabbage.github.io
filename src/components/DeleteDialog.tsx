import { Trash2 } from 'lucide-react';
import { useRef, useState } from 'react';
import { IconLabel } from './AppIcon';
import Dialog from './Dialog';

export default function DeleteDialog({ name, remove, onClose }: {
  name: string;
  remove: () => Promise<void>;
  onClose: () => void;
}) {
  const inFlight = useRef(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  async function submit() {
    if (inFlight.current) return;
    inFlight.current = true;
    setBusy(true);
    setError('');
    try {
      await remove();
      onClose();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Data gagal dihapus. Coba lagi.');
    } finally {
      inFlight.current = false;
      setBusy(false);
    }
  }
  return (
    <Dialog title="Konfirmasi penghapusan" onClose={() => { if (!inFlight.current) onClose(); }}>
      <p>Hapus <strong>{name}</strong>?</p>
      {error && <p className="error" role="alert">{error}</p>}
      <div className="form-actions">
        <button type="button" className="secondary" data-initial-focus onClick={onClose} disabled={busy}>Batal</button>
        <button type="button" className="danger" onClick={() => void submit()} disabled={busy}>
          <IconLabel icon={Trash2}>{busy ? 'Menghapus…' : 'Hapus'}</IconLabel>
        </button>
      </div>
    </Dialog>
  );
}
