export default function AsyncState({ error, onRetry, loading, empty }: {
  error?: string | null;
  onRetry?: () => void;
  loading?: boolean;
  empty?: string;
}) {
  if (error) return (
    <div className="state state-error" role="alert">
      <p>{error}</p>
      {onRetry && <button type="button" className="secondary" onClick={onRetry}>Coba lagi</button>}
    </div>
  );
  if (loading || empty) return (
    <div className={loading ? 'state state-loading' : 'state'} role="status">
      {loading ? 'Memuat…' : empty}
    </div>
  );
  return null;
}
