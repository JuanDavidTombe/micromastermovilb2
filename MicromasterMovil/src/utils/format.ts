export function toNumber(value: unknown): number {
  if (typeof value === 'number') return Number.isFinite(value) ? value : 0;
  if (typeof value === 'string') {
    const parsed = Number(value.replace(',', '.'));
    return Number.isFinite(parsed) ? parsed : 0;
  }
  return 0;
}

export function formatNumber(value: number | string | null | undefined, decimals = 0): string {
  const amount = toNumber(value ?? 0);
  const fixed = Math.abs(amount).toFixed(decimals);
  const [wholePart, decimalPart] = fixed.split('.');
  const grouped = (wholePart ?? '0').replace(/\B(?=(\d{3})+(?!\d))/g, '.');
  const sign = amount < 0 ? '-' : '';
  return decimalPart ? `${sign}${grouped},${decimalPart}` : `${sign}${grouped}`;
}

export function formatMoney(value: number | string | null | undefined): string {
  const amount = Math.round(toNumber(value ?? 0));
  return `${amount < 0 ? '-' : ''}$${formatNumber(Math.abs(amount))}`;
}

function pad(value: number): string {
  return String(value).padStart(2, '0');
}

export function formatDate(value?: string | null): string {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return `${pad(date.getDate())}/${pad(date.getMonth() + 1)}/${date.getFullYear()}`;
}

export function formatTime(date: Date = new Date()): string {
  return `${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

export function daysText(days?: number | null): string {
  if (typeof days !== 'number' || Number.isNaN(days)) return 'Sin fecha';
  if (days < 0) return `Vencido hace ${Math.abs(days)} d`;
  if (days === 0) return 'Vence hoy';
  if (days === 1) return 'Vence mañana';
  return `Vence en ${days} d`;
}

export function statusTone(status?: string | null): 'success' | 'warning' | 'danger' | 'info' | 'neutral' {
  switch (status) {
    case 'optimal':
    case 'completed':
    case 'delivered':
    case 'RESOLVED':
    case 'confirmed':
      return 'success';
    case 'warning':
    case 'pending':
    case 'assigned':
    case 'OPEN':
      return 'warning';
    case 'critical':
    case 'cancelled':
      return 'danger';
    case 'in_progress':
    case 'in_transit':
      return 'info';
    default:
      return 'neutral';
  }
}
