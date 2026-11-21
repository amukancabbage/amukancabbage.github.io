import { CircleAlert, Inbox, LoaderCircle, RotateCcw } from 'lucide-react';
import AppIcon, { IconLabel } from './AppIcon';

export default function AsyncState({ error, onRetry, loading, empty }: {
  error?: string | null;
  onRetry?: () => void;
  loading?: boolean;
  empty?: string;
}) {
  if (error) return (
    <div className="state state-error" role="alert">
      <p className="tw:flex tw:items-start tw:gap-2">
        <AppIcon icon={CircleAlert} className="tw:mt-1" />
        <span className="tw:min-w-0 tw:wrap-anywhere">{error}</span>
      </p>
      {onRetry && <button type="button" className="secondary" onClick={onRetry}><IconLabel icon={RotateCcw}>Coba lagi</IconLabel></button>}
    </div>
  );
  if (loading || empty) return (
    <div className={'state tw:flex tw:items-start tw:gap-2' + (loading ? ' state-loading' : '')} role="status">
      <AppIcon icon={loading ? LoaderCircle : Inbox} className={loading ? 'tw:mt-1 tw:motion-safe:animate-spin' : 'tw:mt-1'} />
      <span>{loading ? 'Memuat…' : empty}</span>
    </div>
  );
  return null;
}
