import { Link } from 'react-router-dom';

export default function NotificationBell({ count }: { count: number }) {
  return (
    <Link
      to="/haki/notifikasi"
      className="bell"
      aria-label={count > 0 ? `${count} notifikasi belum dibaca` : 'Notifikasi'}
      title="Notifikasi"
    >
      <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true">
        <path
          fill="currentColor"
          d="M12 22a2.5 2.5 0 0 0 2.45-2h-4.9A2.5 2.5 0 0 0 12 22Zm7-6V11a7 7 0 0 0-5.5-6.84V3.5a1.5 1.5 0 0 0-3 0v.66A7 7 0 0 0 5 11v5l-2 2v1h18v-1l-2-2Z"
        />
      </svg>
      {count > 0 && <span className="bell-count">{count > 99 ? '99+' : count}</span>}
    </Link>
  );
}
