import { fieldLabel } from '../../haki/constants';
import { fmtDateTime } from '../../haki/format';
import type { HistoryItem } from '../../haki/types';

const LABEL: Record<string, string> = {
  'record.upload': 'Sertifikat diunggah',
  'record.create_manual': 'Rekaman manual dibuat',
  'record.extract_start': 'Pembacaan AI dimulai',
  'record.extracted': 'Selesai dibaca AI',
  'record.extract_failed': 'AI gagal membaca',
  'file.upload': 'Berkas ditambahkan',
  'file.delete': 'Lampiran dihapus',
  ajukan: 'Diajukan ke validator',
  approve: 'Disetujui dan diarsipkan',
  request_revision: 'Diminta revisi',
  reject: 'Ditolak',
  minta_koreksi: 'Koreksi arsip diminta',
};

export default function HistoryTimeline({ items }: { items: HistoryItem[] }) {
  return (
    <div className="card">
      <div className="card-head">
        <h2>Riwayat</h2>
      </div>
      <ol className="timeline">
        {items.length === 0 && <li className="muted">Belum ada riwayat.</li>}
        {items.map((h, i) => (
          <li key={i}>
            <div>
              <strong>{LABEL[h.aksi] ?? h.aksi}</strong>
              {h.actor && <span className="muted"> · {h.actor}</span>}
            </div>
            <div className="muted small">{fmtDateTime(h.at)}</div>
            {h.catatan && <div className="timeline-note">{h.catatan}</div>}
            {h.kind === 'review' && h.detail && (
              <ul className="small">
                {Object.entries(h.detail).map(([k, v]) => (
                  <li key={k}>
                    {fieldLabel(k)}: {v}
                  </li>
                ))}
              </ul>
            )}
          </li>
        ))}
      </ol>
    </div>
  );
}
