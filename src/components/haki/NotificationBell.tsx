import { Bell } from 'lucide-react';
import { Link } from 'react-router-dom';
import AppIcon from '../AppIcon';

export default function NotificationBell({ count }: { count: number }) {
  return (
    <Link
      to="/haki/notifikasi"
      className="bell"
      aria-label={count > 0 ? `${count} notifikasi belum dibaca` : 'Notifikasi'}
      title="Notifikasi"
    >
      <AppIcon icon={Bell} size={20} />
      {count > 0 && <span className="bell-count" aria-hidden="true">{count > 99 ? '99+' : count}</span>}
    </Link>
  );
}
