import { Budget, Category, Currency, Debt, DebtInstallment, Transaction } from '@/types/finance';
import { parseTransactionDate } from './formatters';

const FIXED_KEYWORDS = [
  'alquiler',
  'renta',
  'arriendo',
  'arrendamiento',
  'vivienda',
  'hipoteca',
  'condominio',
  'mantenimiento hogar',
  'servicio',
  'factura',
  'luz',
  'electricidad',
  'agua',
  'gas directo',
  'gas doméstico',
  'bombona',
  'internet',
  'fibra',
  'cantv',
  'aseo',
  'telefono',
  'telefonía',
  'movistar',
  'digitel',
  'movilnet',
  'colegio',
  'universidad',
  'educacion',
  'escuela',
  'matricula',
  'seguro',
  'poliza',
  'prestamo',
  'cuota',
  'deuda',
  'suscripcion',
  'streaming',
  'netflix',
  'spotify',
];

const STORAGE_KEY = 'finance_fixed_categories_override';

export const getStoredFixedOverrides = (): Record<string, boolean> => {
  if (typeof window === 'undefined') return {};
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch (e) {
    console.error('Error reading fixed category overrides from localStorage:', e);
    return {};
  }
};

export const setStoredFixedOverride = (categoryId: string, isFixed: boolean): void => {
  if (typeof window === 'undefined') return;
  try {
    const current = getStoredFixedOverrides();
    current[categoryId] = isFixed;
    localStorage.setItem(STORAGE_KEY, JSON.stringify(current));
    window.dispatchEvent(new Event('finance_fixed_categories_changed'));
  } catch (e) {
    console.error('Error saving fixed category override to localStorage:', e);
  }
};

/**
 * Determina si una categoría debe tratarse como un Gasto Fijo / Compromiso obligatorio.
 * Considera:
 * 1. Preferencia manual del usuario guardada en localStorage
 * 2. Propiedad opcional `tipo_gasto` en la categoría
 * 3. Detección inteligente por palabras clave (alquiler, renta, servicios, luz, agua, etc.)
 */
export const isCategoryFixed = (
  category?: Category | null,
  overrideMap?: Record<string, boolean>
): boolean => {
  if (!category) return false;
  
  const overrides = overrideMap || getStoredFixedOverrides();
  if (typeof overrides[category.id] === 'boolean') {
    return overrides[category.id];
  }

  if ((category as unknown as { tipo_gasto?: string }).tipo_gasto === 'fijo') {
    return true;
  }
  if ((category as unknown as { tipo_gasto?: string }).tipo_gasto === 'variable') {
    return false;
  }

  const name = category.nombre.toLowerCase();

  // Exclusiones explícitas de gastos variables cotidianos
  if (
    name.includes('gasolina') ||
    name.includes('combustible') ||
    name.includes('transporte') ||
    name.includes('supermercado') ||
    name.includes('mercado') ||
    name.includes('despensa') ||
    name.includes('comida') ||
    name.includes('alimento') ||
    name.includes('salida') ||
    name.includes('restaurante') ||
    name.includes('ocio') ||
    name.includes('entretenimiento') ||
    name.includes('compras') ||
    name.includes('ropa')
  ) {
    return false;
  }

  return FIXED_KEYWORDS.some((kw) => name.includes(kw));
};


export interface FixedCommitmentItem {
  id: string;
  nombre: string;
  tipo: 'presupuesto_fijo' | 'cuota_deuda';
  moneda: Currency;
  montoTotalUsd: number;
  montoPagadoUsd: number;
  montoPendienteUsd: number;
  porcentajePagado: number;
  estado: 'pendiente' | 'parcial' | 'pagado';
  fechaVencimiento?: string;
  diffDays?: number;
  categoryId?: string;
  debtId?: string;
}


export interface VariableItem {
  id: string;
  nombre: string;
  limiteUsd: number;
  gastadoUsd: number;
  restanteUsd: number;
  porcentaje: number;
}

export interface MonthlyCommitmentsSummary {
  // Período
  period?: 'mes' | 'quincena';
  fortnightNumber?: 1 | 2;
  fortnightLabel?: string;
  daysRemainingInPeriod?: number;

  // Presupuesto global
  totalPresupuestoGlobalUsd: number;
  totalGastosGlobalUsd: number;
  presupuestoRestanteGlobalUsd: number;

  // Gastos Fijos (Presupuestos marcados como fijos)
  totalPresupuestoFijoUsd: number;
  totalFijoPagadoUsd: number;
  totalFijoPendienteUsd: number;
  
  // Deudas del mes o quincena
  totalCuotasDeudasMesUsd: number;
  totalCuotasDeudasPagadasUsd: number;
  totalCuotasDeudasPendientesUsd: number;

  // Gran Total de Compromisos que faltan por pagar en el período (Fijos + Deudas)
  totalCompromisosPendientesUsd: number;

  // Gastos Variables
  totalPresupuestoVariableUsd: number;
  totalVariableGastadoUsd: number;
  totalVariableRestanteUsd: number;

  // Margen de Presupuesto Libre (para gastos diarios/variables)
  margenPresupuestoLibreUsd: number;

  // Dinero Realmente Libre
  dineroRealmenteLibreUsd: number;
  dineroLiquidezEnCuentasUsd: number;
  liquidezTrasFijosUsd: number;
  deficitLiquidezUsd: number;
  hasDeficit: boolean;

  // Items de compromisos detallados (fijos pendientes o en progreso)
  items: FixedCommitmentItem[];
  itemsPendientes: FixedCommitmentItem[];
  itemsCompletados: FixedCommitmentItem[];
  itemsVariables: VariableItem[];
}

/**
 * Calcula de manera exhaustiva todos los compromisos del mes o de la quincena actual:
 * - Presupuestos fijos (ej. Alquiler, Servicios, Condominio)
 * - Cuotas de deudas que vencen en el período seleccionado
 * - Dinero realmente libre (descontando compromisos fijos pendientes)
 */
export const calculateMonthlyCommitments = (params: {
  budgets: Budget[];
  categories: Category[];
  transactions: Transaction[];
  debts: Debt[];
  debtInstallments: DebtInstallment[];
  activeUsdRate: number;
  totalAccountsUsd: number;
  targetYear: number;
  targetMonth: number; // 0-indexed (0 = Jan)
  overrideMap?: Record<string, boolean>;
  period?: 'mes' | 'quincena';
  targetFortnight?: 1 | 2;
}): MonthlyCommitmentsSummary => {
  const {
    budgets,
    categories,
    transactions,
    debts,
    debtInstallments,
    activeUsdRate,
    totalAccountsUsd,
    targetYear,
    targetMonth,
    overrideMap,
    period = 'mes',
    targetFortnight,
  } = params;

  const overrides = overrideMap || getStoredFixedOverrides();
  const catMap = new Map(categories.map((c) => [c.id, c]));

  const now = new Date();
  const currentDay = now.getDate();
  const defaultFortnight: 1 | 2 = currentDay <= 15 ? 1 : 2;
  const fortnight: 1 | 2 = targetFortnight || defaultFortnight;
  const isCurrentMonth = targetYear === now.getFullYear() && targetMonth === now.getMonth();
  const totalDaysInMonth = new Date(targetYear, targetMonth + 1, 0).getDate();

  const fortnightLabel = fortnight === 1
    ? '1ra Quincena (1 al 15)'
    : `2da Quincena (16 al ${totalDaysInMonth})`;

  const daysRemainingInPeriod = period === 'quincena'
    ? (isCurrentMonth
        ? (fortnight === 1
            ? Math.max(1, 15 - currentDay + 1)
            : Math.max(1, totalDaysInMonth - currentDay + 1))
        : 15)
    : (isCurrentMonth ? Math.max(1, totalDaysInMonth - currentDay + 1) : totalDaysInMonth);

  let totalPresupuestoFijoUsd = 0;
  let totalFijoPagadoUsd = 0;
  let totalPresupuestoVariableUsd = 0;
  let totalVariableGastadoUsd = 0;

  const items: FixedCommitmentItem[] = [];
  const itemsVariables: VariableItem[] = [];

  // 1. Procesar presupuestos de categorías
  budgets.forEach((b) => {
    const cat = catMap.get(b.category_id);
    const isFixed = isCategoryFixed(cat, overrides);

    const baseMonthlyLimitUsd =
      b.moneda === 'USD'
        ? b.monto_original || b.monto_limite
        : b.monto_limite > 500 && activeUsdRate > 0
          ? b.monto_limite / activeUsdRate
          : b.monto_limite;

    // Límite asignado según el período (en quincena corresponde a la mitad)
    const limiteUsd = period === 'quincena'
      ? Math.round((baseMonthlyLimitUsd / 2) * 100) / 100
      : baseMonthlyLimitUsd;

    // Calcular transacciones en esta categoría en el mes y en la quincena
    let gastadoMesUsd = 0;
    let gastadoPeriodoUsd = 0;

    transactions.forEach((tx) => {
      const txInfo = parseTransactionDate(tx.fecha);
      if (
        tx.category_id === b.category_id &&
        tx.tipo === 'gasto' &&
        txInfo.month === targetMonth &&
        txInfo.year === targetYear
      ) {
        const txUsd =
          Number(tx.monto_usd) ||
          (tx.tasa_cambio && tx.tasa_cambio > 0
            ? (Number(tx.monto_ves) || 0) / tx.tasa_cambio
            : Number(tx.monto) || 0);

        gastadoMesUsd += txUsd;

        const isInFortnight = fortnight === 1 ? txInfo.day <= 15 : txInfo.day > 15;
        if (period === 'quincena') {
          if (isInFortnight) {
            gastadoPeriodoUsd += txUsd;
          }
        } else {
          gastadoPeriodoUsd += txUsd;
        }
      }
    });

    if (isFixed) {
      totalPresupuestoFijoUsd += limiteUsd;

      let pagadoUsd = 0;
      let pendienteUsd = 0;
      let estado: FixedCommitmentItem['estado'] = 'pendiente';

      if (period === 'quincena') {
        // Si ya cubrió el límite mensual completo durante el mes, queda totalmente saldado
        if (gastadoMesUsd >= baseMonthlyLimitUsd) {
          pagadoUsd = limiteUsd;
          pendienteUsd = 0;
          estado = 'pagado';
        } else {
          pagadoUsd = Math.min(limiteUsd, gastadoPeriodoUsd);
          pendienteUsd = Math.max(0, limiteUsd - gastadoPeriodoUsd);
          estado = pendienteUsd <= 0.01 ? 'pagado' : pagadoUsd > 0 ? 'parcial' : 'pendiente';
        }
      } else {
        pagadoUsd = Math.min(limiteUsd, gastadoMesUsd);
        pendienteUsd = Math.max(0, limiteUsd - gastadoMesUsd);
        estado = gastadoMesUsd >= limiteUsd ? 'pagado' : gastadoMesUsd > 0 ? 'parcial' : 'pendiente';
      }

      totalFijoPagadoUsd += pagadoUsd;
      const porcentaje = limiteUsd > 0 ? Math.min(100, Math.round((pagadoUsd / limiteUsd) * 100)) : 100;

      items.push({
        id: `budget-${b.id}`,
        nombre: cat?.nombre || 'Gasto Fijo',
        tipo: 'presupuesto_fijo',
        moneda: b.moneda || 'USD',
        montoTotalUsd: limiteUsd,
        montoPagadoUsd: pagadoUsd,
        montoPendienteUsd: pendienteUsd,
        porcentajePagado: porcentaje,
        estado,
        categoryId: b.category_id,
      });
    } else {
      // Gasto Variable
      totalPresupuestoVariableUsd += limiteUsd;
      totalVariableGastadoUsd += gastadoPeriodoUsd;

      const restanteUsd = Math.max(0, limiteUsd - gastadoPeriodoUsd);
      const porcentaje = limiteUsd > 0 ? Math.min(100, Math.round((gastadoPeriodoUsd / limiteUsd) * 100)) : 0;

      itemsVariables.push({
        id: `budget-var-${b.id}`,
        nombre: cat?.nombre || 'Gasto Variable',
        limiteUsd,
        gastadoUsd: gastadoPeriodoUsd,
        restanteUsd,
        porcentaje,
      });
    }
  });

  const totalFijoPendienteUsd = Math.max(0, totalPresupuestoFijoUsd - totalFijoPagadoUsd);
  const totalVariableRestanteUsd = Math.max(0, totalPresupuestoVariableUsd - totalVariableGastadoUsd);

  // 2. Procesar cuotas de deudas del período (mes o quincena)
  let totalCuotasDeudasMesUsd = 0;
  let totalCuotasDeudasPagadasUsd = 0;
  let totalCuotasDeudasPendientesUsd = 0;

  const debtMap = new Map(debts.map((d) => [d.id, d]));
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  debtInstallments.forEach((inst) => {
    if (!inst.fecha_vencimiento) return;
    const [yStr, mStr, dStr] = inst.fecha_vencimiento.split('-');
    const iYear = parseInt(yStr, 10);
    const iMonth = parseInt(mStr, 10) - 1; // 0-indexed
    const iDay = parseInt(dStr, 10);

    const isThisMonth = iYear === targetYear && iMonth === targetMonth;
    let belongsToPeriod = false;

    if (period === 'quincena') {
      const isInFortnight = fortnight === 1 ? iDay <= 15 : iDay > 15;
      const isPastInCurrentMonth = fortnight === 2 && iDay <= 15 && inst.estado !== 'pagada';
      const isPastMonthPending = inst.estado !== 'pagada' && (iYear < targetYear || (iYear === targetYear && iMonth < targetMonth));

      belongsToPeriod = (isThisMonth && isInFortnight) || isPastInCurrentMonth || isPastMonthPending;
    } else {
      const isPastPending = inst.estado !== 'pagada' && (iYear < targetYear || (iYear === targetYear && iMonth < targetMonth));
      belongsToPeriod = isThisMonth || isPastPending;
    }

    if (belongsToPeriod) {
      const debt = debtMap.get(inst.debt_id);
      if (!debt) return;

      const montoCuotaUsd =
        debt.moneda === 'USD'
          ? inst.monto
          : activeUsdRate > 0
            ? inst.monto / activeUsdRate
            : inst.monto;

      const pagadoCuotaUsd =
        debt.moneda === 'USD'
          ? inst.monto_pagado || 0
          : activeUsdRate > 0
            ? (inst.monto_pagado || 0) / activeUsdRate
            : inst.monto_pagado || 0;

      const pendienteCuotaUsd = Math.max(0, montoCuotaUsd - pagadoCuotaUsd);

      totalCuotasDeudasMesUsd += montoCuotaUsd;
      totalCuotasDeudasPagadasUsd += pagadoCuotaUsd;
      totalCuotasDeudasPendientesUsd += pendienteCuotaUsd;

      const dueDate = new Date(parseInt(yStr, 10), parseInt(mStr, 10) - 1, parseInt(dStr, 10));
      const diffDays = Math.ceil((dueDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));

      items.push({
        id: `debt-inst-${inst.id}`,
        nombre: `${debt.nombre} (Cuota #${inst.numero})`,
        tipo: 'cuota_deuda',
        moneda: debt.moneda,
        montoTotalUsd: montoCuotaUsd,
        montoPagadoUsd: pagadoCuotaUsd,
        montoPendienteUsd: pendienteCuotaUsd,
        porcentajePagado: montoCuotaUsd > 0 ? Math.min(100, Math.round((pagadoCuotaUsd / montoCuotaUsd) * 100)) : 100,
        estado: inst.estado === 'pagada' ? 'pagado' : inst.estado,
        fechaVencimiento: inst.fecha_vencimiento,
        diffDays,
        debtId: debt.id,
      });
    }
  });

  const totalCompromisosPendientesUsd = totalFijoPendienteUsd + totalCuotasDeudasPendientesUsd;

  const totalPresupuestoGlobalUsd = totalPresupuestoFijoUsd + totalPresupuestoVariableUsd;
  const totalGastosGlobalUsd = totalFijoPagadoUsd + totalVariableGastadoUsd;
  const presupuestoRestanteGlobalUsd = Math.max(0, totalPresupuestoGlobalUsd - totalGastosGlobalUsd);

  // Margen libre de presupuesto para el día a día (descontando los compromisos fijos)
  const margenPresupuestoLibreUsd = totalPresupuestoVariableUsd > 0
    ? totalVariableRestanteUsd
    : Math.max(0, presupuestoRestanteGlobalUsd - totalFijoPendienteUsd);

  // Liquidez real en cuentas tras apartar los compromisos fijos pendientes
  const liquidezTrasFijosUsd = Math.max(0, totalAccountsUsd - totalCompromisosPendientesUsd);
  const deficitLiquidezUsd = Math.max(0, totalCompromisosPendientesUsd - totalAccountsUsd);
  const hasDeficit = deficitLiquidezUsd > 0.01;

  // Dinero realmente libre para el día a día:
  // Es el mínimo entre el margen presupuestario asignado y la liquidez real disponible en cuentas tras apartar fijos.
  // Si tus cuentas no cubren tus fijos pendientes, el dinero realmente libre es $0.00 (no puedes gastar lo que no tienes).
  const dineroRealmenteLibreUsd = Math.max(0, Math.min(margenPresupuestoLibreUsd, liquidezTrasFijosUsd));

  const itemsPendientes = items
    .filter((i) => i.montoPendienteUsd > 0.01)
    .sort((a, b) => b.montoPendienteUsd - a.montoPendienteUsd);

  const itemsCompletados = items.filter((i) => i.montoPendienteUsd <= 0.01);

  return {
    period,
    fortnightNumber: fortnight,
    fortnightLabel,
    daysRemainingInPeriod,
    totalPresupuestoGlobalUsd,
    totalGastosGlobalUsd,
    presupuestoRestanteGlobalUsd,
    totalPresupuestoFijoUsd,
    totalFijoPagadoUsd,
    totalFijoPendienteUsd,
    totalCuotasDeudasMesUsd,
    totalCuotasDeudasPagadasUsd,
    totalCuotasDeudasPendientesUsd,
    totalCompromisosPendientesUsd,
    totalPresupuestoVariableUsd,
    totalVariableGastadoUsd,
    totalVariableRestanteUsd,
    margenPresupuestoLibreUsd,
    dineroRealmenteLibreUsd,
    dineroLiquidezEnCuentasUsd: totalAccountsUsd,
    liquidezTrasFijosUsd,
    deficitLiquidezUsd,
    hasDeficit,
    items,
    itemsPendientes,
    itemsCompletados,
    itemsVariables,
  };
};
