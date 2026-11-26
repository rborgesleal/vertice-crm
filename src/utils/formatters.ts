import { FIELD_LIMITS, MONTH_REGEX, type MonthlyReportRow } from '../types/crm';

export function clampString(value: string, maxLength: number): string {
  return value.trim().slice(0, maxLength);
}

export function sanitizeNumber(value: number, min = 0, max: number = FIELD_LIMITS.maxValue): number {
  if (!Number.isFinite(value)) return min;
  return Math.min(max, Math.max(min, Math.round(value * 100) / 100));
}

export function formatCurrency(value: number): string {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
    maximumFractionDigits: 0,
  }).format(value || 0);
}

export function formatCurrencyExact(value: number): string {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value || 0);
}

export function formatCompactCurrency(value: number): string {
  if (value >= 1_000_000) {
    return `R$ ${(value / 1_000_000).toFixed(1).replace('.', ',')}M`;
  }
  if (value >= 1_000) {
    return `R$ ${(value / 1_000).toFixed(1).replace('.', ',')}k`;
  }
  return formatCurrency(value);
}

export function getCurrentMonthKey(date: Date = new Date()): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  return `${year}-${month}`;
}

export function getMonthKeyOffset(monthsBack: number, baseDate: Date = new Date()): string {
  const d = new Date(baseDate.getFullYear(), baseDate.getMonth() - monthsBack, 1);
  return getCurrentMonthKey(d);
}

export function getLastNMonths(count = 6, baseDate: Date = new Date()): string[] {
  const result: string[] = [];
  for (let i = count - 1; i >= 0; i--) {
    result.push(getMonthKeyOffset(i, baseDate));
  }
  return result;
}

const MONTH_NAMES_PT = [
  'Janeiro',
  'Fevereiro',
  'Março',
  'Abril',
  'Maio',
  'Junho',
  'Julho',
  'Agosto',
  'Setembro',
  'Outubro',
  'Novembro',
  'Dezembro',
];

const MONTH_SHORT_PT = [
  'Jan',
  'Fev',
  'Mar',
  'Abr',
  'Mai',
  'Jun',
  'Jul',
  'Ago',
  'Set',
  'Out',
  'Nov',
  'Dez',
];

export function formatMonthLabel(monthKey: string): string {
  if (!MONTH_REGEX.test(monthKey)) return monthKey;
  const [yearStr, monthStr] = monthKey.split('-');
  const idx = Number(monthStr) - 1;
  return `${MONTH_NAMES_PT[idx] ?? monthStr} ${yearStr}`;
}

export function formatMonthShort(monthKey: string): string {
  if (!MONTH_REGEX.test(monthKey)) return monthKey;
  const [yearStr, monthStr] = monthKey.split('-');
  const idx = Number(monthStr) - 1;
  return `${MONTH_SHORT_PT[idx] ?? monthStr}/${yearStr.slice(-2)}`;
}

export function toLocalDatetimeInputValue(date: Date = new Date()): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

export function addHoursToLocalDatetime(isoLocal: string, hours: number): string {
  const parsed = new Date(isoLocal);
  const base = Number.isNaN(parsed.getTime()) ? new Date() : parsed;
  const next = new Date(Math.max(base.getTime(), Date.now()) + hours * 60 * 60 * 1000);
  return toLocalDatetimeInputValue(next);
}

export function formatDateTime(isoString: string): string {
  if (!isoString) return '—';
  const date = new Date(isoString);
  if (Number.isNaN(date.getTime())) return isoString;
  return new Intl.DateTimeFormat('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(date);
}

export function formatRelativeDue(dueDateStr: string): {
  label: string;
  state: 'overdue' | 'today' | 'upcoming';
} {
  const due = new Date(dueDateStr);
  if (Number.isNaN(due.getTime())) {
    return { label: dueDateStr, state: 'upcoming' };
  }
  const now = new Date();
  const diffMs = due.getTime() - now.getTime();

  if (diffMs < 0) {
    const hoursLate = Math.floor(Math.abs(diffMs) / (1000 * 60 * 60));
    if (hoursLate < 1) {
      const minsLate = Math.max(1, Math.floor(Math.abs(diffMs) / (1000 * 60)));
      return { label: `Atrasada há ${minsLate} min`, state: 'overdue' };
    }
    if (hoursLate < 24) {
      return { label: `Atrasada há ${hoursLate}h`, state: 'overdue' };
    }
    const daysLate = Math.floor(hoursLate / 24);
    return {
      label: `Atrasada há ${daysLate} ${daysLate === 1 ? 'dia' : 'dias'}`,
      state: 'overdue',
    };
  }

  const sameDay =
    due.getFullYear() === now.getFullYear() &&
    due.getMonth() === now.getMonth() &&
    due.getDate() === now.getDate();

  const timeStr = new Intl.DateTimeFormat('pt-BR', {
    hour: '2-digit',
    minute: '2-digit',
  }).format(due);

  if (sameDay) {
    return { label: `Hoje às ${timeStr}`, state: 'today' };
  }

  const tomorrow = new Date(now);
  tomorrow.setDate(tomorrow.getDate() + 1);
  const isTomorrow =
    due.getFullYear() === tomorrow.getFullYear() &&
    due.getMonth() === tomorrow.getMonth() &&
    due.getDate() === tomorrow.getDate();

  if (isTomorrow) {
    return { label: `Amanhã às ${timeStr}`, state: 'upcoming' };
  }

  const dateStr = new Intl.DateTimeFormat('pt-BR', {
    day: '2-digit',
    month: '2-digit',
  }).format(due);
  return { label: `${dateStr} às ${timeStr}`, state: 'upcoming' };
}

export function isTaskOverdue(dueDateStr: string, status: string, nowMs = Date.now()): boolean {
  if (status !== 'pendente') return false;
  const parsed = new Date(dueDateStr).getTime();
  return !Number.isNaN(parsed) && parsed <= nowMs;
}

export function isTaskDueToday(dueDateStr: string, status: string): boolean {
  if (status !== 'pendente') return false;
  const due = new Date(dueDateStr);
  if (Number.isNaN(due.getTime())) return false;
  const now = new Date();
  return (
    due.getFullYear() === now.getFullYear() &&
    due.getMonth() === now.getMonth() &&
    due.getDate() === now.getDate()
  );
}

export function exportMonthlyReportCsv(rows: MonthlyReportRow[], fileName: string): void {
  const headers = [
    'Mês',
    'Novos Leads',
    'Negócios Fechados',
    'Taxa de Conversão (%)',
    'Ticket Médio (BRL)',
    'Receita Fechada (BRL)',
    'Meta Mensal (BRL)',
  ];
  const lines = [
    headers.join(';'),
    ...rows.map((r) =>
      [
        r.monthLabel,
        r.newLeadsCount,
        r.closedDealsCount,
        r.conversionRate.toFixed(1).replace('.', ','),
        r.avgTicket.toFixed(2).replace('.', ','),
        r.closedRevenue.toFixed(2).replace('.', ','),
        r.goal.toFixed(2).replace('.', ','),
      ].join(';'),
    ),
  ];

  const csvContent = '\uFEFF' + lines.join('\n');
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.setAttribute('download', fileName);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
