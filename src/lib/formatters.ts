import { Currency } from '@/types/finance';

export const formatCurrency = (amount: number, currency: Currency = 'VES'): string => {
  const safeAmount = isNaN(amount) ? 0 : amount;
  
  if (currency === 'VES') {
    const formatted = new Intl.NumberFormat('es-VE', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(safeAmount);
    return `Bs. ${formatted}`;
  }

  if (currency === 'USD') {
    const formatted = new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(safeAmount);
    return formatted;
  }

  if (currency === 'USDT') {
    const formatted = new Intl.NumberFormat('en-US', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(safeAmount);
    return `${formatted} USDT`;
  }

  if (currency === 'EUR') {
    const formatted = new Intl.NumberFormat('es-ES', {
      style: 'currency',
      currency: 'EUR',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(safeAmount);
    return formatted;
  }

  return `${safeAmount.toFixed(2)} ${currency}`;
};

export interface DateInfo {
  year: number;
  month: number; // 0-indexed (0 = Jan, 9 = Oct)
  day: number;
  dateString: string; // 'YYYY-MM-DD'
}

/**
 * Extrae año, mes (0-indexed) y día de forma consistente y timezone-agnostic.
 * Evita que fechas como '2026-10-01T00:00:00.000Z' se conviertan en Septiembre en zonas horarias de América (UTC-4, UTC-5).
 */
export const parseTransactionDate = (dateStr: string): DateInfo => {
  if (!dateStr) {
    const now = new Date();
    return {
      year: now.getFullYear(),
      month: now.getMonth(),
      day: now.getDate(),
      dateString: `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`,
    };
  }

  if (typeof dateStr === 'string' && /^\d{4}-\d{2}-\d{2}/.test(dateStr)) {
    const parts = dateStr.slice(0, 10).split('-');
    const year = parseInt(parts[0], 10);
    const month = parseInt(parts[1], 10) - 1;
    const day = parseInt(parts[2], 10);
    return {
      year,
      month,
      day,
      dateString: `${parts[0]}-${parts[1]}-${parts[2]}`,
    };
  }

  const d = new Date(dateStr);
  return {
    year: d.getFullYear(),
    month: d.getMonth(),
    day: d.getDate(),
    dateString: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`,
  };
};

export const formatDate = (dateStr: string): string => {
  try {
    const info = parseTransactionDate(dateStr);
    const d = new Date(info.year, info.month, info.day, 12, 0, 0);
    return new Intl.DateTimeFormat('es-VE', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    }).format(d);
  } catch {
    return dateStr;
  }
};

export const formatDateTime = (dateStr: string): string => {
  try {
    const d = new Date(dateStr);
    return new Intl.DateTimeFormat('es-VE', {
      day: '2-digit',
      month: 'short',
      hour: '2-digit',
      minute: '2-digit',
    }).format(d);
  } catch {
    return dateStr;
  }
};

