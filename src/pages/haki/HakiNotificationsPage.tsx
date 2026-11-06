import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { notifyChanged } from '../../haki/api';
import { NOTIF_TYPE_LABEL } from '../../haki/constants';
import { fmtDateTime } from '../../haki/format';
import type { Notification } from '../../haki/types';
import { supabase } from '../../lib/supabase';

export default function HakiNotificationsPage() {
  const navigate = useNavigate();
  const [items, setItems] = useState<Notification[] | null>(null);
  const [onlyUnread, setOnlyUnread] = useState(false);
  const [reload, setReload] = useState(0);

  useEffect(() => {
    let query = supabase.from('notifications').select('*').order('created_at', { ascending: false }).limit(200);
    if (onlyUnread) query = query.is('dibaca_at', null);
    query.then(({ data }) => setItems((data as Notification[]) ?? []));
  }, [onlyUnread, reload]);

  async function markRead(ids: number[]) {
    if (ids.length === 0) return;
    await supabase.from('notifications').update({ dibaca_at: new Date().toISOString() }).in('id', ids);
    notifyChanged();
    setReload((n) => n + 1);
  }

  async function open(n: Notification) {
    if (!n.dibaca_at) await markRead([n.id]);
    if (n.link) navigate(n.link);
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
          <button className="secondary" onClick={() => markRead(unread)} disabled={unread.length === 0}>
            Tandai semua dibaca
          </button>
        </div>
      </div>
      {!items ? (
        <p>Memuat...</p>
      ) : items.length === 0 ? (
        <p className="muted">Tidak ada notifikasi.</p>
      ) : (
        <ul className="notif-list">
          {items.map((n) => (
            <li key={n.id} className={n.dibaca_at ? '' : 'unread'}>
              <button className="notif-item" onClick={() => open(n)}>
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
