import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';

const POLL_MS = 30000;

// jumlah notifikasi belum dibaca; polling 30 detik + segarkan saat event 'haki:notifications'
export function useUnreadCount(): number {
  const [count, setCount] = useState(0);

  useEffect(() => {
    let alive = true;
    async function load() {
      const { count: n } = await supabase
        .from('notifications')
        .select('id', { count: 'exact', head: true })
        .is('dibaca_at', null);
      if (alive) setCount(n ?? 0);
    }
    load();
    const timer = window.setInterval(load, POLL_MS);
    window.addEventListener('haki:notifications', load);
    return () => {
      alive = false;
      window.clearInterval(timer);
      window.removeEventListener('haki:notifications', load);
    };
  }, []);

  return count;
}
