export function fmtDate(value: string | null | undefined): string {
  if (!value) return '-';
  const d = new Date(value.length === 10 ? `${value}T00:00:00` : value);
  if (Number.isNaN(d.getTime())) return value;
  return d.toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' });
}

export function fmtDateTime(value: string | null | undefined): string {
  if (!value) return '-';
  const d = new Date(value);
  return d.toLocaleString('id-ID', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}

export function fmtBytes(n: number): string {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(0)} KB`;
  return `${(n / 1024 / 1024).toFixed(1)} MB`;
}

export function daysBetween(from: string, to: Date = new Date()): number {
  return Math.floor((to.getTime() - new Date(from).getTime()) / 86400000);
}

export function daysUntil(date: string): number {
  return Math.ceil((new Date(`${date}T00:00:00`).getTime() - Date.now()) / 86400000);
}
