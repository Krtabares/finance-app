import { Debt, DebtInstallment, DebtFrequency, DebtCalcType } from '@/types/finance';

/**
 * Calcula la fecha de vencimiento sumando períodos según la frecuencia acordada:
 * - 'semanal': +7 días por período
 * - 'quincenal': +15 días exactos por período desde la fecha inicial
 * - 'mensual': +1 mes por período ajustando fin de mes
 */
export function calculateInstallmentDate(startDateStr: string, frequency: DebtFrequency, stepIndex: number): string {
  if (stepIndex === 0) return startDateStr;

  const [year, month, day] = startDateStr.split('-').map(Number);
  const baseDate = new Date(year, month - 1, day);

  if (frequency === 'semanal') {
    const nextDate = new Date(baseDate.getTime() + stepIndex * 7 * 24 * 60 * 60 * 1000);
    return formatDateToIsoString(nextDate);
  }

  if (frequency === 'quincenal') {
    // 15 días exactos acordados con el usuario
    const nextDate = new Date(baseDate.getTime() + stepIndex * 15 * 24 * 60 * 60 * 1000);
    return formatDateToIsoString(nextDate);
  }

  // Frecuencia mensual
  const targetMonth = (month - 1) + stepIndex;
  const targetYear = year + Math.floor(targetMonth / 12);
  const normalizedMonth = ((targetMonth % 12) + 12) % 12;

  // Días en el mes objetivo
  const daysInTargetMonth = new Date(targetYear, normalizedMonth + 1, 0).getDate();
  const adjustedDay = Math.min(day, daysInTargetMonth);

  const nextDate = new Date(targetYear, normalizedMonth, adjustedDay);
  return formatDateToIsoString(nextDate);
}

function formatDateToIsoString(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

/**
 * Calcula la cuota periódica regular:
 * - Simple (tasa 0 o lineal): capital / n + (capital * tasa / 100)
 * - Amortizado (Francés): P * [i / (1 - (1+i)^-n)]
 */
export function calculateRegularQuotaAmount(
  principal: number,
  numQuotas: number,
  interestRatePct: number,
  calcType: DebtCalcType
): number {
  if (numQuotas <= 0 || principal <= 0) return 0;

  const i = (interestRatePct || 0) / 100;

  if (calcType === 'simple' || i === 0) {
    const capitalPerQuota = principal / numQuotas;
    const interestPerQuota = principal * i;
    return Number((capitalPerQuota + interestPerQuota).toFixed(2));
  }

  // Sistema Francés (Amortización con cuota fija)
  const factor = Math.pow(1 + i, numQuotas);
  const quota = principal * ((i * factor) / (factor - 1));
  return Number(quota.toFixed(2));
}

/**
 * Genera el plan o calendario completo de cuotas para una deuda
 */
export function generateDebtInstallments(
  debtId: string,
  principal: number,
  numQuotas: number,
  frequency: DebtFrequency,
  startDateStr: string,
  calcType: DebtCalcType,
  interestRatePct: number,
  userId?: string
): DebtInstallment[] {
  const installments: DebtInstallment[] = [];
  const i = (interestRatePct || 0) / 100;
  const regularQuota = calculateRegularQuotaAmount(principal, numQuotas, interestRatePct, calcType);

  let remainingPrincipal = principal;

  for (let num = 1; num <= numQuotas; num++) {
    const dueDate = calculateInstallmentDate(startDateStr, frequency, num - 1);
    let capital = 0;
    let interes = 0;
    let quotaMonto = regularQuota;

    if (calcType === 'amortizado' && i > 0) {
      interes = Number((remainingPrincipal * i).toFixed(2));
      if (num === numQuotas) {
        // En la última cuota ajustamos el capital remanente para cerrar en 0 exacto
        capital = Number(remainingPrincipal.toFixed(2));
        quotaMonto = Number((capital + interes).toFixed(2));
      } else {
        capital = Number((regularQuota - interes).toFixed(2));
        if (capital > remainingPrincipal) capital = remainingPrincipal;
      }
      remainingPrincipal = Math.max(0, remainingPrincipal - capital);
    } else {
      // Cálculo simple
      const capitalBase = Number((principal / numQuotas).toFixed(2));
      interes = Number((principal * i).toFixed(2));
      
      if (num === numQuotas) {
        // Ajuste de centavos en la última cuota
        const capitalAlreadyScheduled = (numQuotas - 1) * capitalBase;
        capital = Number((principal - capitalAlreadyScheduled).toFixed(2));
      } else {
        capital = capitalBase;
      }
      quotaMonto = Number((capital + interes).toFixed(2));
    }

    installments.push({
      id: `inst-${debtId}-${num}`,
      debt_id: debtId,
      user_id: userId,
      numero: num,
      fecha_vencimiento: dueDate,
      monto: quotaMonto,
      monto_capital: capital,
      monto_interes: interes,
      monto_pagado: 0,
      estado: 'pendiente',
      created_at: new Date().toISOString(),
    });
  }

  return installments;
}

export interface DebtSummaryMetrics {
  debtInstallments: DebtInstallment[];
  totalEsperado: number;
  totalPagado: number;
  saldoPendiente: number;
  cuotasPagadas: number;
  cuotasTotal: number;
  cuotasVencidas: number;
  proximaCuota: DebtInstallment | null;
  porcentajeProgreso: number;
  isCompletamentePagada: boolean;
}

/**
 * Diagnóstico y resumen de una deuda y sus cuotas
 */
export function getDebtSummaryMetrics(debt: Debt, installments: DebtInstallment[]): DebtSummaryMetrics {
  const debtInstallments = installments
    .filter((inst) => inst.debt_id === debt.id)
    .sort((a, b) => a.numero - b.numero);

  const todayStr = new Date().toISOString().split('T')[0];

  let totalPagado = 0;
  let totalEsperado = 0;
  let cuotasPagadas = 0;
  let cuotasVencidas = 0;
  let proximaCuota: DebtInstallment | null = null;

  for (const inst of debtInstallments) {
    totalEsperado += inst.monto;
    totalPagado += inst.monto_pagado || 0;

    if (inst.estado === 'pagada') {
      cuotasPagadas++;
    } else {
      if (!proximaCuota) {
        proximaCuota = inst;
      }
      if (inst.fecha_vencimiento < todayStr) {
        cuotasVencidas++;
      }
    }
  }

  const saldoPendiente = Math.max(0, totalEsperado - totalPagado);
  const porcentajeProgreso = totalEsperado > 0 ? Math.min(100, Math.round((totalPagado / totalEsperado) * 100)) : 0;
  const isCompletamentePagada = cuotasPagadas === debtInstallments.length && debtInstallments.length > 0;

  return {
    debtInstallments,
    totalEsperado,
    totalPagado,
    saldoPendiente,
    cuotasPagadas,
    cuotasTotal: debtInstallments.length,
    cuotasVencidas,
    proximaCuota,
    porcentajeProgreso,
    isCompletamentePagada,
  };
}
