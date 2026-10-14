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
  saldo_en_usd?: number;
  saldo_en_ves?: number;
}

export interface Category {
  id: string;
  user_id?: string;
  nombre: string;
  tipo: 'ingreso' | 'gasto';
  tipo_gasto?: 'fijo' | 'variable';
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
  monto_usd: number; // Valor base invariante guardado en USD
  monto_ves: number; // Equivalente calculado en VES a la tasa de la transacción
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
  monto_limite: number; // Monto límite en USD (ancla real contra la devaluación)
  moneda?: Currency; // Moneda original en la que se configuró ('VES' | 'USD')
  monto_original?: number; // Monto original ingresado por el usuario
  tasa_cambio?: number; // Tasa al momento de fijar el presupuesto
  tipo_gasto?: 'fijo' | 'variable';
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
  patrimonio_usd: number;
  patrimonio_ves: number;
  activos_usd: number;
  activos_ves: number;
  deudas_usd: number;
  deudas_ves: number;
  deudas_mes_usd: number;
  deudas_mes_ves: number;
  cuotas_pendientes_mes: number;
  ingresos_mes_usd: number;
  ingresos_mes_ves: number;
  gastos_mes_usd: number;
  gastos_mes_ves: number;
  balance_mes_usd: number;
  balance_mes_ves: number;
  ahorro_tasa_mes: number;
}


// ==========================================
// MÓDULO DE DEUDAS Y PRÉSTAMOS
// ==========================================

export type DebtFrequency = 'semanal' | 'quincenal' | 'mensual';
export type DebtCalcType = 'simple' | 'amortizado';
export type InstallmentStatus = 'pendiente' | 'parcial' | 'pagada';

export interface Debt {
  id: string;
  user_id?: string;
  nombre: string;
  acreedor: string; // Entidad, persona o banco a quien se le debe
  moneda: Currency;
  monto_total: number; // Monto inicial prestado (capital original)
  saldo_pendiente: number; // Capital restante por pagar
  num_cuotas: number;
  frecuencia: DebtFrequency;
  fecha_inicio: string; // Fecha de vencimiento de la primera cuota (YYYY-MM-DD)
  tipo_calculo: DebtCalcType;
  tasa_interes: number; // % por período (0 si es simple sin interés)
  monto_cuota: number; // Monto estimado de cada cuota regular
  category_id?: string;
  account_id?: string; // Cuenta de débito sugerida
  descripcion?: string;
  estado: 'activa' | 'pagada';
  created_at?: string;
  updated_at?: string;
}

export interface DebtInstallment {
  id: string;
  debt_id: string;
  user_id?: string;
  numero: number; // Número de cuota (1, 2, 3...)
  fecha_vencimiento: string; // YYYY-MM-DD
  monto: number; // Monto total de la cuota en la moneda de la deuda
  monto_capital: number; // Porción de capital
  monto_interes: number; // Porción de interés
  monto_pagado: number; // Acumulado pagado hacia esta cuota
  estado: InstallmentStatus;
  fecha_pago?: string;
  transaction_id?: string;
  created_at?: string;
}

export interface DebtPayment {
  id: string;
  debt_id: string;
  user_id?: string;
  installment_id?: string; // Si es null o vacío, fue un abono extraordinario a capital
  transaction_id?: string; // Transacción de gasto vinculada
  account_id: string; // Cuenta desde la que se pagó
  monto: number; // Monto abonado en la moneda de la deuda
  moneda: Currency;
  tasa_cambio: number; // Tasa aplicada al momento del pago
  fecha: string; // ISO string o YYYY-MM-DD
  nota?: string;
  created_at?: string;
}

