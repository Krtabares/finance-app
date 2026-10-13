export type AccountType = 'banco' | 'efectivo' | 'cripto' | 'wallet_digital' | 'otro';

export type Currency = 'VES' | 'USD' | 'USDT' | 'EUR';

export type RateSource = 'BCV' | 'Paralelo' | 'Binance P2P' | 'Manual';

export interface Account {
  id: string;
  user_id?: string;
  nombre: string;
  tipo: AccountType;
  moneda: Currency;
  saldo_inicial: number;
  color: string;
  icono?: string;
  descripcion?: string;
  activo: boolean;
  created_at?: string;
  // Computed fields
  saldo_actual?: number;
  saldo_en_ves?: number;
}

export interface Category {
  id: string;
  user_id?: string;
  nombre: string;
  tipo: 'ingreso' | 'gasto';
  color: string;
  icono: string;
  created_at?: string;
}

export interface Transaction {
  id: string;
  user_id?: string;
  account_id: string;
  category_id?: string;
  tipo: 'ingreso' | 'gasto';
  monto: number;
  moneda: Currency;
  monto_ves: number;
  tasa_cambio: number;
  fecha: string; // ISO string
  nota?: string;
  created_at?: string;
}

export interface Transfer {
  id: string;
  user_id?: string;
  from_account_id: string;
  to_account_id: string;
  monto_origen: number;
  monto_destino: number;
  tasa_cambio: number;
  fecha: string;
  nota?: string;
  created_at?: string;
}

export interface Budget {
  id: string;
  user_id?: string;
  category_id: string;
  mes: string; // 'YYYY-MM'
  monto_limite: number; // Siempre en VES
  created_at?: string;
  // Computed
  gastado_mes?: number;
  porcentaje_usado?: number;
}

export interface SavingsGoal {
  id: string;
  user_id?: string;
  nombre: string;
  monto_objetivo: number;
  monto_actual: number;
  moneda: Currency;
  fecha_meta?: string;
  account_id?: string;
  color: string;
  icono?: string;
  created_at?: string;
}

export interface ExchangeRate {
  id?: string;
  user_id?: string;
  moneda: Currency;
  tasa_a_ves: number;
  fuente: RateSource;
  fecha: string;
  updated_at?: string;
}

export interface FinancialSummary {
  patrimonio_ves: number;
  patrimonio_usd: number;
  ingresos_mes_ves: number;
  gastos_mes_ves: number;
  balance_mes_ves: number;
  ahorro_tasa_mes: number;
}
