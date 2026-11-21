import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import AsyncState from '../../components/AsyncState';
import { useRemoteData } from '../../lib/useRemoteData';
import { safeNext } from '../../haki/queueContext';
import { notifyChanged, toHakiError } from '../../haki/api';
import { NOTIF_TYPE_LABEL } from '../../haki/constants';
import { fmtDateTime } from '../../haki/format';
import type { Notification } from '../../haki/types';
import { supabase } from '../../lib/supabase';

export default function HakiNotificationsPage() {
  const navigate = useNavigate();
  const [onlyUnread, setOnlyUnread] = useState(false);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const { data: items, loading, error: loadError, retry } = useRemoteData(async () => {
    let query = supabase.from('notifications').select('*').order('created_at', { ascending: false }).limit(200);
    if (onlyUnread) query = query.is('dibaca_at', null);
    const { data, error } = await query;
    if (error) throw toHakiError(error);
    return (data as Notification[]) ?? [];
  }, String(onlyUnread));

  async function markRead(ids: number[]) {
    if (busy || !ids.length) return;
    setBusy(true);
    setError('');
    try {
      const { error } = await supabase.from('notifications').update({ dibaca_at: new Date().toISOString() }).in('id', ids);
      if (error) setError('Status dibaca gagal disimpan. Coba lagi.');
      else { notifyChanged(); retry(); }
    } finally {
      setBusy(false);
    }
  }

  async function open(n: Notification) {
    if (!n.dibaca_at) await markRead([n.id]);
    const next = safeNext(n.link);
    if (next) navigate(next);
  }

  const unread = (items ?? []).filter((n) => !n.dibaca_at).map((n) => n.id);

  return (
    <div className="page">
      <div className="page-header">
        <h1>Notifikasi</h1>
        <div className="actions">
          <label className="check">
            <input type="checkbox" checked={onlyUnread} onChange={(e) => setOnlyUnread(e.target.checked)} />
            Belum dibaca saja
          </label>
          <button className="secondary" onClick={() => markRead(unread)} disabled={busy || unread.length === 0}>
            Tandai semua dibaca
          </button>
        </div>
      </div>
      {error && <p className="error" role="alert">{error}</p>}
      <AsyncState loading={loading} error={loadError} onRetry={retry} empty={items?.length === 0 ? (onlyUnread ? 'Semua notifikasi telah dibaca.' : 'Belum ada notifikasi.') : undefined} />
      {!!items?.length && (
        <ul className="notif-list">
          {items.map((n) => (
            <li key={n.id} className={n.dibaca_at ? '' : 'unread'}>
              <button className="notif-item" disabled={busy} onClick={() => open(n)}>
                <span className="notif-type">{NOTIF_TYPE_LABEL[n.tipe] ?? n.tipe}</span>
                <strong>{n.judul}</strong>
                {n.isi && <span className="muted">{n.isi}</span>}
                <span className="muted small">{fmtDateTime(n.created_at)}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
