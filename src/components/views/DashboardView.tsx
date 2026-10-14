'use client';

import React, { useState, useMemo, useEffect } from 'react';
import { useFinance } from '@/context/FinanceContext';
import { formatCurrency, parseTransactionDate } from '@/lib/formatters';
import { calculateMonthlyCommitments, getStoredFixedOverrides } from '@/lib/commitments';

interface DashboardViewProps {
  onNavigateTab: (tab: string) => void;
  onOpenNewTransaction: () => void;
}

export const DashboardView: React.FC<DashboardViewProps> = ({
  onNavigateTab,
  onOpenNewTransaction,
}) => {
  const {
    summary,
    accounts,
    transactions,
    categories,
    budgets,
    rates,
    preferredViewCurrency,
    convert,
    isSupabaseMode,
    debts,
    debtInstallments,
  } = useFinance();

  const [isBreakdownOpen, setIsBreakdownOpen] = useState(false);
  const [fixedOverrides, setFixedOverrides] = useState<Record<string, boolean>>({});
  const [spendPeriod, setSpendPeriod] = useState<'quincena' | 'mes'>('quincena');

  useEffect(() => {
    try {
      const saved = localStorage.getItem('finance_dashboard_spend_period');
      if (saved === 'quincena' || saved === 'mes') {
        setSpendPeriod(saved);
      }
    } catch {
      // ignore localStorage error
    }
  }, []);

  useEffect(() => {
    setFixedOverrides(getStoredFixedOverrides());
    const handleOverridesChange = () => {
      setFixedOverrides(getStoredFixedOverrides());
    };
    window.addEventListener('finance_fixed_categories_changed', handleOverridesChange);
    return () => {
      window.removeEventListener('finance_fixed_categories_changed', handleOverridesChange);
    };
  }, []);

  // Helper for formatting number into whole and decimal parts
  const formatAmountParts = (val: number, currency: 'VES' | 'USD') => {
    const isNegative = val < 0;
    const absVal = Math.abs(val);
    const prefix = isNegative ? '-' : '';
    const symbol = currency === 'VES' ? `${prefix}Bs. ` : `${prefix}$`;
    const formatted = absVal.toLocaleString('es-VE', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });
    const [whole, decimal] = formatted.split(',');
    return { symbol, whole, decimal: decimal || '00', isNegative };
  };

  const isVes = preferredViewCurrency === 'VES';
  const dominantNetWorth = isVes ? summary.patrimonio_ves : summary.patrimonio_usd;
  const secondaryNetWorth = isVes ? summary.patrimonio_usd : summary.patrimonio_ves;
  const secondaryIsNegative = secondaryNetWorth < 0;
  const secondaryPrefix = secondaryIsNegative ? '-' : '';
  const secondarySymbol = isVes ? `${secondaryPrefix}$` : `${secondaryPrefix}Bs. `;
  const secondaryFormatted = Math.abs(secondaryNetWorth).toLocaleString('es-VE', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });

  const heroParts = formatAmountParts(dominantNetWorth, preferredViewCurrency);

  // Dynamic Month-over-Month variation calculation en base USD (inmune a distorsión inflacionaria)
  const monthComparison = useMemo(() => {
    const now = new Date();
    const curM = now.getMonth();
    const curY = now.getFullYear();

    const prevDate = new Date(curY, curM - 1, 1);
    const prevM = prevDate.getMonth();
    const prevY = prevDate.getFullYear();

    let curNet = 0;
    let prevNet = 0;

    transactions.forEach((tx) => {
      const d = new Date(tx.fecha);
      const m = d.getMonth();
      const y = d.getFullYear();
      const valUsd = Number(tx.monto_usd) || (tx.tasa_cambio && tx.tasa_cambio > 0 ? (Number(tx.monto_ves) || 0) / tx.tasa_cambio : convert(Number(tx.monto) || 0, tx.moneda, 'USD'));

      if (m === curM && y === curY) {
        if (tx.tipo === 'ingreso') curNet += valUsd;
        if (tx.tipo === 'gasto') curNet -= valUsd;
      } else if (m === prevM && y === prevY) {
        if (tx.tipo === 'ingreso') prevNet += valUsd;
        if (tx.tipo === 'gasto') prevNet -= valUsd;
      }
    });

    if (prevNet === 0) {
      if (curNet > 0) return { text: '+100% este mes', isPositive: true };
      if (curNet < 0) return { text: '-100% este mes', isPositive: false };
      return { text: '0.0% vs mes anterior', isPositive: true };
    }

    const pct = ((curNet - prevNet) / Math.abs(prevNet)) * 100;
    const sign = pct >= 0 ? '+' : '';
    return {
      text: `${sign}${pct.toFixed(1)}% vs mes anterior`,
      isPositive: pct >= 0,
    };
  }, [transactions, convert]);

  // Current month values tomados directamente de summary (base en USD, BS calculado)
  const ingresosMes = isVes ? summary.ingresos_mes_ves : summary.ingresos_mes_usd;
  const gastosMes = isVes ? summary.gastos_mes_ves : summary.gastos_mes_usd;
  const secondaryIngresos = isVes ? summary.ingresos_mes_usd : summary.ingresos_mes_ves;
  const secondaryGastos = isVes ? summary.gastos_mes_usd : summary.gastos_mes_ves;

  const fmtSecondary = (val: number) => {
    const isNeg = val < 0;
    const sym = isVes ? `${isNeg ? '-' : ''}$` : `${isNeg ? '-' : ''}Bs. `;
    return `${sym}${Math.abs(val).toLocaleString('es-VE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  };

  // Fuentes de ingreso dinámicas
  const fuentesIngreso = useMemo(() => {
    const now = new Date();
    const curM = now.getMonth();
    const curY = now.getFullYear();
    const incomeTxs = transactions.filter((t) => {
      const d = parseTransactionDate(t.fecha);
      return t.tipo === 'ingreso' && d.month === curM && d.year === curY;
    });
    return incomeTxs.length;
  }, [transactions]);

  // Límite de presupuesto dinámico en base USD
  const budgetStatus = useMemo(() => {
    const totalPresupuestoUsd = budgets.reduce((sum, b) => {
      const bUsd = b.moneda === 'USD' ? (b.monto_original || b.monto_limite) : (b.monto_limite > 500 ? b.monto_limite / 450 : b.monto_limite);
      return sum + (bUsd || 0);
    }, 0);

    if (totalPresupuestoUsd > 0) {
      const pct = Math.round((summary.gastos_mes_usd / totalPresupuestoUsd) * 100);
      return `${pct}% de límite`;
    }

    const now = new Date();
    const curM = now.getMonth();
    const curY = now.getFullYear();
    const gastosCount = transactions.filter((t) => {
      const d = parseTransactionDate(t.fecha);
      return t.tipo === 'gasto' && d.month === curM && d.year === curY;
    }).length;

    return `${gastosCount} ${gastosCount === 1 ? 'salida' : 'salidas'}`;
  }, [budgets, summary.gastos_mes_usd, transactions]);

  // Ahorro dinámico
  const ahorroMontoDominant = isVes ? summary.balance_mes_ves : summary.balance_mes_usd;
  const ritmoProyectado =
    summary.ahorro_tasa_mes >= 25
      ? 'Saludable'
      : summary.ahorro_tasa_mes > 0
        ? 'Moderado'
        : summary.ingresos_mes_usd === 0 && summary.gastos_mes_usd === 0
          ? 'Sin movimientos'
          : 'Ajustado';

  // Flujo Financiero dinámico (últimos 5 meses) calculado en USD y proyectado en BS si se requiere
  const cashflowData = useMemo(() => {
    const months = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];
    const now = new Date();
    const list = [];
    const activeUsdRate = rates.find((r) => r.moneda === 'USD')?.tasa_a_ves || 450;

    for (let i = 4; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const mIdx = d.getMonth();
      const mYear = d.getFullYear();
      const label = months[mIdx];

      let ingUsd = 0;
      let gasUsd = 0;

      transactions.forEach((tx) => {
        const txDate = new Date(tx.fecha);
        if (txDate.getMonth() === mIdx && txDate.getFullYear() === mYear) {
          const valUsd = Number(tx.monto_usd) || (tx.tasa_cambio && tx.tasa_cambio > 0 ? (Number(tx.monto_ves) || 0) / tx.tasa_cambio : convert(Number(tx.monto) || 0, tx.moneda, 'USD'));
          if (tx.tipo === 'ingreso') ingUsd += valUsd;
          if (tx.tipo === 'gasto') gasUsd += valUsd;
        }
      });

      const ing = isVes ? ingUsd * activeUsdRate : ingUsd;
      const gas = isVes ? gasUsd * activeUsdRate : gasUsd;

      list.push({
        label,
        ing: Math.round(ing),
        gas: Math.round(gas),
        isCurrent: i === 0,
      });
    }

    return list;
  }, [transactions, isVes, convert, rates]);

  // Cálculo de coordenadas SVG para las curvas dinámicas
  const chartSvgPaths = useMemo(() => {
    const xCoords = [20, 145, 270, 395, 520];
    const maxVal = Math.max(
      ...cashflowData.map((d) => Math.max(d.ing, d.gas)),
      1
    );

    const getY = (val: number) => {
      if (maxVal <= 0 || val <= 0) return 135;
      const normalized = Math.min(1, val / maxVal);
      return Math.round(135 - normalized * 110);
    };

    const buildSmoothCurve = (key: 'ing' | 'gas') => {
      const points = cashflowData.map((d, idx) => ({
        x: xCoords[idx],
        y: getY(d[key]),
      }));

      if (points.length < 2) return '';

      let d = `M ${points[0].x} ${points[0].y}`;
      for (let i = 0; i < points.length - 1; i++) {
        const p0 = points[i];
        const p1 = points[i + 1];
        const cpX = (p0.x + p1.x) / 2;
        d += ` C ${cpX} ${p0.y}, ${cpX} ${p1.y}, ${p1.x} ${p1.y}`;
      }
      return d;
    };

    const currentMonthY = getY(cashflowData[4]?.ing || 0);

    return {
      incomePath: buildSmoothCurve('ing'),
      expensePath: buildSmoothCurve('gas'),
      currentMonthY,
      currentMonthX: 520,
    };
  }, [cashflowData]);

  // Transacciones recientes (reales)
  const recentTransactions = transactions.slice(0, 5);

  const getTxIcon = (tipo: string, desc: string = '') => {
    const d = desc.toLowerCase();
    if (d.includes('freelance') || d.includes('ui') || d.includes('diseño') || d.includes('software')) return 'laptop_mac';
    if (d.includes('mercado') || d.includes('plaza') || d.includes('super') || d.includes('comida') || d.includes('alimento')) return 'shopping_cart';
    if (d.includes('starlink') || d.includes('internet') || d.includes('wifi') || d.includes('cantv')) return 'wifi';
    if (d.includes('binance') || d.includes('p2p') || d.includes('transf') || tipo === 'transferencia') return 'sync_alt';
    if (d.includes('salud') || d.includes('farma') || d.includes('med')) return 'medication';
    if (tipo === 'ingreso') return 'arrow_downward';
    return 'receipt_long';
  };

  // Liquidez dinámica por divisa evaluada en base USD
  const liquidity = useMemo(() => {
    let usd = 0;
    let ves = 0;
    let usdt = 0;

    accounts.forEach((acc) => {
      const balance = acc.saldo_actual ?? acc.saldo_inicial ?? 0;
      const usdVal = acc.saldo_en_usd ?? convert(balance, acc.moneda, 'USD');
      if (acc.moneda === 'USD') usd += usdVal;
      else if (acc.moneda === 'VES') ves += usdVal;
      else if (acc.moneda === 'USDT') usdt += usdVal;
      else usd += usdVal;
    });

    const total = usd + ves + usdt;
    if (total <= 0) {
      return { usdPct: 0, vesPct: 0, usdtPct: 0, hasData: false };
    }

    const usdPct = Math.round((usd / total) * 100);
    const vesPct = Math.round((ves / total) * 100);
    const usdtPct = Math.max(0, 100 - usdPct - vesPct);

    return { usdPct, vesPct, usdtPct, hasData: true };
  }, [accounts, convert]);

  // Distribución real de gastos por categoría (base USD, proyectada a la moneda activa)
  const categorySpending = useMemo(() => {
    const catTotals: { [key: string]: number } = {};
    let totalSpent = 0;
    const activeUsdRate = rates.find((r) => r.moneda === 'USD')?.tasa_a_ves || 450;

    transactions.forEach((tx) => {
      if (tx.tipo === 'gasto') {
        const valUsd = Number(tx.monto_usd) || (tx.tasa_cambio && tx.tasa_cambio > 0 ? (Number(tx.monto_ves) || 0) / tx.tasa_cambio : convert(Number(tx.monto) || 0, tx.moneda, 'USD'));
        const val = isVes ? valUsd * activeUsdRate : valUsd;
        totalSpent += val;
        const cat = categories.find((c) => c.id === tx.category_id);
        const name = cat ? cat.nombre : 'Otros Gastos';
        catTotals[name] = (catTotals[name] || 0) + val;
      }
    });

    if (totalSpent <= 0) {
      return [];
    }

    return Object.entries(catTotals)
      .map(([name, amount]) => ({
        name,
        amount: Math.round(amount),
        pct: Math.round((amount / totalSpent) * 100),
      }))
      .sort((a, b) => b.amount - a.amount)
      .slice(0, 4);
  }, [transactions, categories, isVes, convert, rates]);

  // Próximas cuotas de deudas y préstamos
  const upcomingDebtsInstallments = useMemo(() => {
    const today = new Date().toISOString().split('T')[0];
    const list: {
      debt: typeof debts[0];
      installment: typeof debtInstallments[0];
      diffDays: number;
    }[] = [];

    debts
      .filter((d) => d.estado === 'activa')
      .forEach((debt) => {
        const pending = debtInstallments
          .filter((i) => i.debt_id === debt.id && i.estado !== 'pagada')
          .sort((a, b) => a.fecha_vencimiento.localeCompare(b.fecha_vencimiento));

        if (pending.length > 0) {
          const nextInst = pending[0];
          const dueDate = new Date(nextInst.fecha_vencimiento);
          const todayDate = new Date(today);
          const diffDays = Math.ceil((dueDate.getTime() - todayDate.getTime()) / (1000 * 60 * 60 * 24));
          list.push({ debt, installment: nextInst, diffDays });
        }
      });

    list.sort((a, b) => a.installment.fecha_vencimiento.localeCompare(b.installment.fecha_vencimiento));
    return list.slice(0, 3);
  }, [debts, debtInstallments]);

  const now = new Date();
  const currentYear = now.getFullYear();
  const currentMonthIdx = now.getMonth();
  const activeUsdRate = rates.find((r) => r.moneda === 'USD')?.tasa_a_ves || 450;
  const totalAccountsUsd = summary.activos_usd || 0;

  const commitments = useMemo(() => {
    return calculateMonthlyCommitments({
      budgets,
      categories,
      transactions,
      debts,
      debtInstallments,
      activeUsdRate,
      totalAccountsUsd,
      targetYear: currentYear,
      targetMonth: currentMonthIdx,
      overrideMap: fixedOverrides,
      period: spendPeriod,
    });
  }, [
    budgets,
    categories,
    transactions,
    debts,
    debtInstallments,
    activeUsdRate,
    totalAccountsUsd,
    currentYear,
    currentMonthIdx,
    fixedOverrides,
    spendPeriod,
  ]);

  // 1. ¿Cuánto dinero tengo en total? (Dinero Total Disponible)
  // Suma consolidada de todas las cuentas bancarias y efectivo (sin restar deudas)
  const totalCuentas = isVes ? summary.activos_ves : summary.activos_usd;
  const totalCuentasSecondary = isVes ? summary.activos_usd : summary.activos_ves;

  // 2. ¿Cuánto puedo gastar? (Dinero Realmente Libre)
  // Descuenta los compromisos fijos pendientes (Alquiler, Servicios, Cuotas de Préstamos)
  // de la quincena o mes para reflejar con honestidad cuánto dinero tienes disponible.
  const disponibleParaGastar = useMemo(() => {
    const libreUsd = commitments.dineroRealmenteLibreUsd;
    const fijosPendientesUsd = commitments.totalCompromisosPendientesUsd;
    const hasPendingFijos = fijosPendientesUsd > 0.01;
    const pendingCount = commitments.itemsPendientes.length;

    let statusText = '';
    let badgeText = '';
    let isAlert = false;
    let isGood = true;

    const fijosText = isVes
      ? `Bs. ${(fijosPendientesUsd * activeUsdRate).toLocaleString('es-VE', { maximumFractionDigits: 0 })}`
      : `$${fijosPendientesUsd.toFixed(2)}`;

    const isQuincena = spendPeriod === 'quincena';
    const periodShort = isQuincena ? (commitments.fortnightNumber === 1 ? '1ra Q' : '2da Q') : 'Mes';

    if (hasPendingFijos) {
      statusText = `Apartado fijos (${periodShort}): ${fijosText} (${pendingCount} pendientes) • Clic para desglose`;
      badgeText = libreUsd > 0 ? 'Fijos apartados' : 'Margen ajustado';
      isAlert = libreUsd <= 0;
      isGood = libreUsd > 0;
    } else {
      statusText = `${commitments.fortnightLabel || 'Todo al día'} • Sin fijos pendientes`;
      badgeText = 'Totalmente libre';
      isAlert = false;
      isGood = true;
    }

    const disponibleDominant = isVes ? libreUsd * activeUsdRate : libreUsd;
    const disponibleSecondary = isVes ? libreUsd : libreUsd * activeUsdRate;

    return {
      disponibleDominant,
      disponibleSecondary,
      libreUsd,
      fijosPendientesUsd,
      pendingCount,
      hasPendingFijos,
      statusText,
      badgeText,
      isAlert,
      isGood,
      hasBudget: budgets.length > 0,
      period: spendPeriod,
      fortnightLabel: commitments.fortnightLabel,
      daysRemaining: commitments.daysRemainingInPeriod,
    };
  }, [commitments, isVes, activeUsdRate, budgets.length, spendPeriod]);

  // 3. ¿Qué debo pagar pronto? (Próximos Pagos a 15 días)
  // Alerta clara de cuotas de préstamos o compras a crédito próximas a vencer, o aviso verde de "Al día: sin pagos urgentes"
  const proximosPagos15Dias = useMemo(() => {
    const today = new Date().toISOString().split('T')[0];
    const todayDate = new Date(today);
    const activeDebtMap = new Map<string, typeof debts[0]>();
    debts.forEach((d) => {
      if (d.estado === 'activa') activeDebtMap.set(d.id, d);
    });

    const urgentList: {
      debt: typeof debts[0];
      installment: typeof debtInstallments[0];
      diffDays: number;
      pendingAmount: number;
    }[] = [];

    debtInstallments.forEach((inst) => {
      const debt = activeDebtMap.get(inst.debt_id);
      if (debt && inst.estado !== 'pagada') {
        const dueDate = new Date(inst.fecha_vencimiento);
        const diffDays = Math.ceil((dueDate.getTime() - todayDate.getTime()) / (1000 * 60 * 60 * 24));
        if (diffDays <= 15) {
          const pending = Math.max(0, (inst.monto || 0) - (inst.monto_pagado || 0));
          urgentList.push({ debt, installment: inst, diffDays, pendingAmount: pending });
        }
      }
    });

    urgentList.sort((a, b) => a.diffDays - b.diffDays);

    let totalUsd = 0;
    urgentList.forEach((item) => {
      totalUsd += convert(item.pendingAmount, item.debt.moneda, 'USD');
    });

    const activeUsdRate = rates.find((r) => r.moneda === 'USD')?.tasa_a_ves || 450;
    const totalDominant = isVes ? totalUsd * activeUsdRate : totalUsd;
    const totalSecondary = isVes ? totalUsd : totalUsd * activeUsdRate;

    const overdueCount = urgentList.filter((item) => item.diffDays < 0).length;
    const dueTodayCount = urgentList.filter((item) => item.diffDays === 0).length;

    return {
      hasUrgent: urgentList.length > 0,
      urgentList,
      totalDominant,
      totalSecondary,
      overdueCount,
      dueTodayCount,
      nearest: urgentList[0] || null,
    };
  }, [debts, debtInstallments, convert, rates, isVes]);

  const currentMonthName = useMemo(() => {
    const months = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];
    const now = new Date();
    return `${months[now.getMonth()]} ${now.getFullYear()}`;
  }, []);

  return (
    <div className="space-y-12">
      {/* Typography-Forward Hero Balance Area */}
      <section className="space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-baseline justify-between gap-4">
          <div>
            <div className="text-[11px] font-medium uppercase tracking-wider text-neutral-500 mb-1">
              Patrimonio Neto Total
            </div>
            <div className="flex items-baseline gap-4 flex-wrap">
              <h1 className="text-4xl sm:text-5xl font-semibold tracking-tight font-display text-white">
                {heroParts.symbol}{heroParts.whole}
                <span className="text-neutral-500 text-3xl font-light">,{heroParts.decimal}</span>
              </h1>
              <span className="text-lg text-neutral-400 font-mono">
                ≈ {secondarySymbol}{secondaryFormatted} {isVes ? 'USD' : 'VES'}
              </span>
              <span
                className={`text-xs px-2 py-0.5 rounded font-mono font-medium ${monthComparison.isPositive
                    ? 'bg-emerald-500/10 text-emerald-400'
                    : 'bg-rose-500/10 text-rose-400'
                  }`}
              >
                {monthComparison.text}
              </span>
            </div>
          </div>
          <div className="flex items-center gap-2 text-xs text-neutral-400">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
            <span>{isSupabaseMode ? 'Sincronizado Supabase Cloud' : 'Almacenamiento Local'}</span>
            <span className="text-neutral-600">|</span>
            <span className="text-neutral-500">{currentMonthName}</span>
          </div>
        </div>

        {/* 2 Columnas de Métricas Superiores: Resumen del Mes y Panel Simplificado */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 lg:gap-12 pt-6 border-t border-neutral-800/40">
          {/* Columna Izquierda: Resumen del Mes */}
          <div className="space-y-4">
            <div className="text-[11px] font-medium uppercase tracking-wider text-neutral-500">
              Resumen del Mes
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div>
                <div className="text-xs text-neutral-500 mb-1">Ingresos del Mes</div>
                <div className="text-lg font-medium text-neutral-200 font-mono">
                  {formatCurrency(ingresosMes, preferredViewCurrency)}
                </div>
                <div className="text-[11px] text-neutral-500 mt-0.5">
                  ≈ {fmtSecondary(secondaryIngresos)} {isVes ? 'USD' : 'VES'} • {fuentesIngreso}{' '}
                  {fuentesIngreso === 1 ? 'fuente' : 'fuentes'}
                </div>
              </div>
              <div>
                <div className="text-xs text-neutral-500 mb-1">Gastos del Mes</div>
                <div className="text-lg font-medium text-neutral-200 font-mono">
                  {formatCurrency(gastosMes, preferredViewCurrency)}
                </div>
                <div className="text-[11px] text-neutral-500 mt-0.5">
                  ≈ {fmtSecondary(secondaryGastos)} {isVes ? 'USD' : 'VES'} • {budgetStatus}
                </div>
              </div>
              <div>
                <div className="text-xs text-neutral-500 mb-1">Margen de Ahorro</div>
                <div className="text-lg font-medium text-neutral-200 font-mono">
                  {summary.ahorro_tasa_mes}%{' '}
                  <span className="text-xs text-neutral-400 font-sans">
                    ({formatCurrency(ahorroMontoDominant, preferredViewCurrency)})
                  </span>
                </div>
                <div className="text-[11px] text-neutral-500 mt-0.5">
                  Ritmo: {ritmoProyectado}
                </div>
              </div>
            </div>
          </div>

          {/* Columna Derecha: Panel Simplificado (3 Preguntas Esenciales) */}
          <div className="space-y-4 lg:border-l lg:border-neutral-800/40 lg:pl-12">
            <div className="text-[11px] pt-6 font-medium uppercase tracking-wider text-neutral-500">
              Panel Simplificado • 3 Preguntas
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              {/* 1. ¿Cuánto dinero tengo en total? */}
              <div>
                <div className="text-xs text-neutral-500 mb-1">¿Cuánto tengo en total?</div>
                <div className="text-lg font-medium text-neutral-200 font-mono">
                  {formatCurrency(totalCuentas, preferredViewCurrency)}
                </div>
                <div className="text-[11px] text-neutral-500 mt-0.5">
                  ≈ {fmtSecondary(totalCuentasSecondary)} {isVes ? 'USD' : 'VES'} • Cuentas y efectivo
                </div>
              </div>

              {/* 2. ¿Cuánto puedo gastar libre? (Esta Quincena o Mes) */}
              <div
                onClick={() => setIsBreakdownOpen(true)}
                className="cursor-pointer group"
                title="Haz clic para ver el desglose entre dinero total vs compromisos fijos pendientes"
              >
                <div className="text-xs text-neutral-500 mb-1 flex items-center justify-between">
                  <div className="flex items-center gap-1 group-hover:text-neutral-300 transition-colors">
                    <span>
                      {spendPeriod === 'quincena' ? '¿Cuánto puedo gastar libre?' : '¿Cuánto puedo gastar este mes?'}
                    </span>
                    <span className="material-symbols-outlined text-[13px] text-neutral-500 group-hover:text-neutral-300">info</span>
                  </div>
                  {/* Selector Toggle Quincena / Mes */}
                  <div
                    className="flex items-center bg-neutral-900 border border-neutral-800 rounded p-0.5 text-[10px] font-mono"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <button
                      type="button"
                      onClick={() => {
                        setSpendPeriod('quincena');
                        try { localStorage.setItem('finance_dashboard_spend_period', 'quincena'); } catch {}
                      }}
                      className={`px-1.5 py-0.5 rounded transition-all ${
                        spendPeriod === 'quincena'
                          ? 'bg-neutral-700 text-white font-medium shadow-xs'
                          : 'text-neutral-500 hover:text-neutral-300'
                      }`}
                      title="Ver dinero libre disponible para esta quincena (1 al 15 o 16 al fin de mes)"
                    >
                      Quincena
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setSpendPeriod('mes');
                        try { localStorage.setItem('finance_dashboard_spend_period', 'mes'); } catch {}
                      }}
                      className={`px-1.5 py-0.5 rounded transition-all ${
                        spendPeriod === 'mes'
                          ? 'bg-neutral-700 text-white font-medium shadow-xs'
                          : 'text-neutral-500 hover:text-neutral-300'
                      }`}
                      title="Ver dinero libre disponible para todo el mes"
                    >
                      Mes
                    </button>
                  </div>
                </div>
                <div className={`text-lg font-medium font-mono ${disponibleParaGastar.isAlert ? 'text-amber-400' : 'text-neutral-200'}`}>
                  {formatCurrency(disponibleParaGastar.disponibleDominant, preferredViewCurrency)}
                </div>
                <div className="text-[11px] text-neutral-500 mt-0.5 group-hover:text-neutral-400 transition-colors">
                  ≈ {fmtSecondary(disponibleParaGastar.disponibleSecondary)} {isVes ? 'USD' : 'VES'} • {disponibleParaGastar.statusText}
                </div>
              </div>

              {/* 3. ¿Qué debo pagar pronto? */}
              <div onClick={() => onNavigateTab('debts')} className="cursor-pointer group">
                <div className="text-xs text-neutral-500 mb-1 group-hover:text-neutral-400 transition-colors">
                  ¿Qué debo pagar pronto?
                </div>
                {proximosPagos15Dias.hasUrgent ? (
                  <>
                    <div className="text-lg font-medium text-neutral-200 font-mono">
                      {formatCurrency(proximosPagos15Dias.totalDominant, preferredViewCurrency)}{' '}
                      <span className="text-xs text-rose-400 font-sans">
                        ({proximosPagos15Dias.overdueCount > 0 ? `${proximosPagos15Dias.overdueCount} vencida` : `${proximosPagos15Dias.urgentList.length} cuotas`})
                      </span>
                    </div>
                    <div className="text-[11px] text-neutral-500 mt-0.5 group-hover:text-neutral-400 transition-colors">
                      ≈ {fmtSecondary(proximosPagos15Dias.totalSecondary)} {isVes ? 'USD' : 'VES'} • {proximosPagos15Dias.nearest?.debt.nombre} ({proximosPagos15Dias.nearest && proximosPagos15Dias.nearest.diffDays < 0 ? `Vencida ${Math.abs(proximosPagos15Dias.nearest.diffDays)}d` : proximosPagos15Dias.nearest?.diffDays === 0 ? 'Vence hoy' : `en ${proximosPagos15Dias.nearest?.diffDays}d`})
                    </div>
                  </>
                ) : (
                  <>
                    <div className="text-lg font-medium text-emerald-400 font-mono">
                      Al día: sin pagos
                    </div>
                    <div className="text-[11px] text-neutral-500 mt-0.5 group-hover:text-neutral-400 transition-colors">
                      Próximos 15 días • Sin cuotas
                    </div>
                  </>
                )}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* 2-Column Spacious Content Grid */}
      <section className="grid grid-cols-1 lg:grid-cols-12 gap-10">
        {/* Left / Primary Column (7 cols): Analytics & Transactions */}
        <div className="lg:col-span-7 space-y-10">
          {/* Clean Minimalist Chart */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-sm font-medium text-neutral-200">Flujo Financiero</h2>
                <p className="text-xs text-neutral-500">Comparativa 5 meses (Ingresos vs Gastos)</p>
              </div>
              <div className="flex items-center gap-4 text-xs font-mono text-neutral-400">
                <span className="flex items-center gap-1.5">
                  <span className="w-2 h-0.5 bg-neutral-200 inline-block"></span> Ingresos
                </span>
                <span className="flex items-center gap-1.5">
                  <span className="w-2 h-0.5 bg-neutral-600 inline-block"></span> Gastos
                </span>
              </div>
            </div>

            {/* Chart Canvas */}
            <div className="relative w-full h-44 pt-2">
              <svg
                className="w-full h-full overflow-visible"
                fill="none"
                preserveAspectRatio="none"
                viewBox="0 0 540 160"
              >
                {/* Subtle horizontal grid lines */}
                <line stroke="#1c1e26" strokeDasharray="3 3" x1="0" x2="540" y1="30" y2="30"></line>
                <line stroke="#1c1e26" strokeDasharray="3 3" x1="0" x2="540" y1="80" y2="80"></line>
                <line stroke="#1c1e26" strokeDasharray="3 3" x1="0" x2="540" y1="130" y2="130"></line>

                {/* Expenses Line (Subtle) */}
                <path
                  d={chartSvgPaths.expensePath}
                  stroke="#40434f"
                  strokeLinecap="round"
                  strokeWidth="1.5"
                ></path>

                {/* Income Line (Crisp Monochrome) */}
                <path
                  d={chartSvgPaths.incomePath}
                  stroke="#dcdde3"
                  strokeLinecap="round"
                  strokeWidth="2"
                ></path>

                {/* Highlight dot on current month */}
                <circle
                  className="filter drop-shadow-[0_0_4px_rgba(255,255,255,0.4)]"
                  cx={chartSvgPaths.currentMonthX}
                  cy={chartSvgPaths.currentMonthY}
                  fill="#ffffff"
                  r="3.5"
                ></circle>
                <line
                  stroke="#333744"
                  strokeDasharray="2 2"
                  x1={chartSvgPaths.currentMonthX}
                  x2={chartSvgPaths.currentMonthX}
                  y1={chartSvgPaths.currentMonthY}
                  y2={140}
                ></line>
              </svg>

              {/* Muted X-axis labels */}
              <div className="flex justify-between items-center text-[11px] font-mono text-neutral-500 pt-3">
                {cashflowData.map((m) => (
                  <span
                    key={m.label}
                    className={m.isCurrent ? 'text-neutral-300 font-semibold' : 'text-neutral-400'}
                  >
                    {m.label}
                  </span>
                ))}
              </div>
            </div>
          </div>

          {/* Minimalist Transactions Section */}
          <div className="space-y-3 pt-4 border-t border-neutral-800/40">
            <div className="flex items-center justify-between pb-1">
              <h2 className="text-sm font-medium text-neutral-200">Actividad Reciente</h2>
              <button
                onClick={() => onNavigateTab('transactions')}
                className="text-xs text-neutral-400 hover:text-neutral-200 transition-colors"
              >
                Ver todas →
              </button>
            </div>

            {/* Transaction Rows */}
            <div className="divide-y divide-neutral-900">
              {recentTransactions.length > 0 ? (
                recentTransactions.map((tx) => {
                  const isIngreso = tx.tipo === 'ingreso';
                  const account = accounts.find((a) => a.id === tx.account_id);
                  const accountName = account ? account.nombre : 'Cuenta';
                  const primaryAmount = formatCurrency(tx.monto, tx.moneda);
                  const convertedSecondary =
                    tx.moneda === 'VES'
                      ? `$${convert(tx.monto, 'VES', 'USD').toLocaleString('es-VE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
                      : `Bs. ${convert(tx.monto, tx.moneda, 'VES').toLocaleString('es-VE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

                  const txDescription = tx.nota || 'Transacción';
                  const iconName = getTxIcon(tx.tipo, txDescription);

                  return (
                    <div
                      key={tx.id}
                      className="py-3 flex items-center justify-between group hover:bg-neutral-900/30 px-2 rounded -mx-2 transition-colors"
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="w-8 h-8 rounded bg-neutral-900 border border-neutral-800/60 text-neutral-400 flex items-center justify-center flex-shrink-0">
                          <span className="material-symbols-outlined text-[16px]">{iconName}</span>
                        </div>
                        <div className="min-w-0">
                          <div className="text-xs font-medium text-neutral-200 truncate">
                            {txDescription}
                          </div>
                          <div className="text-[11px] text-neutral-500">
                            {accountName} •{' '}
                            {new Date(tx.fecha).toLocaleDateString('es-VE', {
                              month: 'short',
                              day: 'numeric',
                            })}
                          </div>
                        </div>
                      </div>
                      <div className="text-right flex-shrink-0 font-mono text-xs">
                        <div className={isIngreso ? 'text-emerald-400 font-medium' : 'text-neutral-200 font-medium'}>
                          {isIngreso ? `+${primaryAmount}` : `-${primaryAmount}`}
                        </div>
                        <div className="text-[11px] text-neutral-500">
                          {isIngreso ? `+${convertedSecondary}` : `-${convertedSecondary}`}
                        </div>
                      </div>
                    </div>
                  );
                })
              ) : (
                <div className="py-8 text-center text-xs text-neutral-500">
                  No hay transacciones registradas aún. Haz clic en &ldquo;+ Transacción&rdquo; para registrar tu primer movimiento.
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Right / Secondary Column (5 cols): Accounts & Spending Breakdown */}
        <div className="lg:col-span-5 space-y-10">
          {/* Clean Accounts Breakdown */}
          <div className="space-y-3">
            <div className="flex items-center justify-between pb-1">
              <h2 className="text-sm font-medium text-neutral-200">Cuentas y Fondos</h2>
              <span className="text-xs font-mono text-neutral-500">
                {accounts.length} {accounts.length === 1 ? 'activa' : 'activas'}
              </span>
            </div>

            <div className="space-y-1.5">
              {accounts.length > 0 ? (
                accounts.map((acc) => {
                  const accBalance = acc.saldo_actual ?? acc.saldo_inicial ?? 0;
                  const secondaryVal =
                    acc.moneda === 'VES'
                      ? `$${convert(accBalance, 'VES', 'USD').toLocaleString('es-VE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
                      : `Bs. ${convert(accBalance, acc.moneda, 'VES').toLocaleString('es-VE', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;

                  const tagLabel =
                    acc.moneda === 'VES'
                      ? 'VES'
                      : acc.moneda === 'USD'
                        ? 'USD'
                        : acc.moneda === 'USDT'
                          ? 'USDT'
                          : 'CASH';

                  return (
                    <div
                      key={acc.id}
                      className="p-3 rounded-lg border border-neutral-800/40 bg-neutral-900/20 hover:border-neutral-700/50 transition-all flex items-center justify-between"
                    >
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-medium text-neutral-200 truncate">{acc.nombre}</span>
                          <span className="text-[10px] font-mono px-1 py-0.2 rounded bg-neutral-800 text-neutral-400">
                            {tagLabel}
                          </span>
                        </div>
                        <span className="text-[11px] text-neutral-500 capitalize">
                          {acc.tipo === 'banco'
                            ? 'Cuenta Bancaria'
                            : acc.tipo === 'cripto'
                              ? 'Criptoactivos'
                              : acc.tipo === 'efectivo'
                                ? 'Custodia Física'
                                : 'Billetera Digital'}
                        </span>
                      </div>
                      <div className="text-right font-mono text-xs flex-shrink-0">
                        <div className="text-neutral-200 font-medium">
                          {formatCurrency(accBalance, acc.moneda)}
                        </div>
                        <div className="text-[11px] text-neutral-500">{secondaryVal}</div>
                      </div>
                    </div>
                  );
                })
              ) : (
                <div className="py-8 text-center text-xs text-neutral-500">
                  No hay cuentas registradas. Agrega una cuenta en la sección &ldquo;Cuentas y Billeteras&rdquo;.
                </div>
              )}
            </div>

            {/* Subtle liquidity ratio bar */}
            <div className="pt-2">
              <div className="flex justify-between text-[11px] font-mono text-neutral-500 mb-1.5">
                {liquidity.hasData ? (
                  <>
                    <span>Distribución: USD {liquidity.usdPct}%</span>
                    <span>VES {liquidity.vesPct}%</span>
                    <span>USDT {liquidity.usdtPct}%</span>
                  </>
                ) : (
                  <span>Distribución: Sin fondos registrados</span>
                )}
              </div>
              <div className="h-1 w-full bg-neutral-800 rounded-full overflow-hidden flex">
                {liquidity.hasData ? (
                  <>
                    <div
                      className="bg-neutral-300 h-full transition-all duration-500"
                      style={{ width: `${liquidity.usdPct}%` }}
                    ></div>
                    <div
                      className="bg-neutral-500 h-full transition-all duration-500"
                      style={{ width: `${liquidity.vesPct}%` }}
                    ></div>
                    <div
                      className="bg-neutral-700 h-full transition-all duration-500"
                      style={{ width: `${liquidity.usdtPct}%` }}
                    ></div>
                  </>
                ) : (
                  <div className="bg-neutral-800 h-full w-full"></div>
                )}
              </div>
            </div>

          </div>

          {/* Widget de Gastos Fijos y Compromisos del Mes (Alquiler, Servicios, etc.) */}
          <div className="space-y-3 pt-4 border-t border-neutral-800/40" id="gastos-fijos-widget">
            <div className="flex items-center justify-between pb-1">
              <div>
                <div className="flex items-center gap-2">
                  <span className="material-symbols-outlined text-[16px] text-neutral-400">home_work</span>
                  <h2 className="text-sm font-medium text-neutral-200">Gastos Fijos del Mes</h2>
                </div>
                <div className="text-[11px] text-amber-400/90 mt-0.5 font-mono">
                  Por pagar este mes: {formatCurrency(isVes ? commitments.totalCompromisosPendientesUsd * activeUsdRate : commitments.totalCompromisosPendientesUsd, preferredViewCurrency)}
                </div>
              </div>
              <button
                onClick={() => setIsBreakdownOpen(true)}
                className="text-xs font-mono text-neutral-300 hover:text-white transition-colors bg-neutral-900 border border-neutral-800 hover:border-neutral-700 px-2.5 py-1 rounded-md flex items-center gap-1"
                title="Ver lista exacta y auditoría de todos los gastos que componen este monto"
              >
                <span>Ver auditoría ({commitments.itemsPendientes.length})</span>
                <span className="material-symbols-outlined text-[14px]">visibility</span>
              </button>
            </div>

            {commitments.items.length > 0 ? (
              <div className="space-y-2">
                {commitments.items.map((item) => {
                  const isPagado = item.estado === 'pagado';
                  const isParcial = item.estado === 'parcial';
                  const isPendiente = item.estado === 'pendiente';

                  const itemPendienteDominant = isVes
                    ? item.montoPendienteUsd * activeUsdRate
                    : item.montoPendienteUsd;
                  const itemTotalDominant = isVes
                    ? item.montoTotalUsd * activeUsdRate
                    : item.montoTotalUsd;

                  return (
                    <div
                      key={item.id}
                      onClick={() => {
                        if (item.tipo === 'cuota_deuda') {
                          onNavigateTab('debts');
                        } else {
                          onNavigateTab('budgets');
                        }
                      }}
                      className={`p-3 rounded-lg border transition-all cursor-pointer flex items-center justify-between group ${
                        isPendiente
                          ? 'border-amber-900/40 bg-amber-950/10 hover:border-amber-700/60'
                          : isParcial
                            ? 'border-blue-900/40 bg-blue-950/10 hover:border-blue-700/60'
                            : 'border-neutral-800/40 bg-neutral-900/20 hover:border-neutral-700/60'
                      }`}
                    >
                      <div className="min-w-0 pr-3">
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-medium text-neutral-200 truncate group-hover:text-white">
                            {item.nombre}
                          </span>
                          <span
                            className={`text-[10px] font-mono px-1.5 py-0.5 rounded ${
                              isPagado
                                ? 'bg-emerald-950/40 text-emerald-400 border border-emerald-800/40'
                                : isParcial
                                  ? 'bg-blue-950/40 text-blue-400 border border-blue-800/40'
                                  : 'bg-amber-950/40 text-amber-400 border border-amber-800/40'
                            }`}
                          >
                            {isPagado ? '✓ Pagado' : isParcial ? '🟡 Parcial' : '⏳ Falta pagar'}
                          </span>
                        </div>
                        <div className="text-[11px] text-neutral-500 mt-1 flex items-center gap-1.5">
                          <span>
                            {isPagado
                              ? 'Completado este mes'
                              : `Abonado $${item.montoPagadoUsd.toFixed(2)} de $${item.montoTotalUsd.toFixed(2)}`}
                          </span>
                        </div>
                        {/* Micro barra de progreso */}
                        <div className="h-1 w-28 bg-neutral-800 rounded-full overflow-hidden mt-1.5">
                          <div
                            className={`h-full rounded-full transition-all duration-500 ${
                              isPagado ? 'bg-emerald-500' : isParcial ? 'bg-blue-500' : 'bg-amber-500'
                            }`}
                            style={{ width: `${Math.min(100, item.porcentajePagado)}%` }}
                          />
                        </div>
                      </div>

                      <div className="text-right font-mono text-xs flex-shrink-0">
                        <div className={isPagado ? 'text-emerald-400 font-medium' : 'text-amber-400 font-medium'}>
                          {isPagado ? (
                            'Al día'
                          ) : (
                            <span>Falta: {formatCurrency(itemPendienteDominant, preferredViewCurrency)}</span>
                          )}
                        </div>
                        <div className="text-[10px] text-neutral-500 mt-0.5">
                          Total: {formatCurrency(itemTotalDominant, preferredViewCurrency)}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div
                onClick={() => onNavigateTab('budgets')}
                className="p-3.5 rounded-lg border border-dashed border-neutral-800/70 hover:border-neutral-700/80 bg-neutral-900/10 text-center cursor-pointer transition-all"
              >
                <div className="text-xs text-neutral-400">Sin gastos fijos configurados aún</div>
                <div className="text-[11px] text-neutral-600 mt-0.5">
                  Fija presupuestos para Alquiler, Servicios, etc. para verlos aquí
                </div>
              </div>
            )}
          </div>

          {/* Widget de Próximas Cuotas de Préstamos / Deudas */}
          <div className="space-y-3 pt-4 border-t border-neutral-800/40">
            <div className="flex items-center justify-between pb-1">
              <div className="flex items-center gap-2">
                <span className="material-symbols-outlined text-[16px] text-neutral-400">credit_card</span>
                <h2 className="text-sm font-medium text-neutral-200">Próximas Cuotas de Deudas</h2>
              </div>
              <button
                onClick={() => onNavigateTab('debts')}
                className="text-xs font-mono text-neutral-400 hover:text-neutral-200 transition-colors"
              >
                Ver todas →
              </button>
            </div>

            {upcomingDebtsInstallments.length > 0 ? (
              <div className="space-y-2">
                {upcomingDebtsInstallments.map(({ debt, installment, diffDays }) => {
                  const isOverdue = diffDays < 0;
                  const isToday = diffDays === 0;

                  return (
                    <div
                      key={installment.id}
                      onClick={() => onNavigateTab('debts')}
                      className={`p-3 rounded-lg border transition-all cursor-pointer flex items-center justify-between group ${isOverdue
                          ? 'border-rose-900/60 bg-rose-950/15 hover:border-rose-700/60'
                          : 'border-neutral-800/40 bg-neutral-900/20 hover:border-neutral-700/60'
                        }`}
                    >
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-medium text-neutral-200 truncate group-hover:text-white">
                            {debt.nombre}
                          </span>
                          <span className="text-[10px] font-mono px-1 py-0.2 rounded bg-neutral-800 text-neutral-400">
                            Cuota #{installment.numero}
                          </span>
                        </div>
                        <div className="text-[11px] text-neutral-500 flex items-center gap-1.5 mt-0.5">
                          <span
                            className={
                              isOverdue
                                ? 'text-rose-400 font-medium'
                                : isToday
                                  ? 'text-amber-400 font-medium'
                                  : 'text-neutral-400'
                            }
                          >
                            {isOverdue
                              ? `Vencida (${Math.abs(diffDays)}d)`
                              : isToday
                                ? 'Vence hoy'
                                : `En ${diffDays} días`}
                          </span>
                          <span>•</span>
                          <span className="font-mono">{installment.fecha_vencimiento}</span>
                        </div>
                      </div>

                      <div className="text-right font-mono text-xs flex-shrink-0">
                        <div className="text-neutral-100 font-medium">
                          {formatCurrency(
                            installment.monto - (installment.monto_pagado || 0),
                            debt.moneda
                          )}
                        </div>
                        <div className="text-[10px] text-neutral-500">
                          {debt.moneda !== 'USD'
                            ? `$${convert(installment.monto, debt.moneda, 'USD').toFixed(2)}`
                            : `Bs. ${convert(installment.monto, 'USD', 'VES').toLocaleString('es-VE', { maximumFractionDigits: 0 })}`}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div
                onClick={() => onNavigateTab('debts')}
                className="p-3.5 rounded-lg border border-dashed border-neutral-800/70 hover:border-neutral-700/80 bg-neutral-900/10 text-center cursor-pointer transition-all"
              >
                <div className="text-xs text-neutral-400">Sin cuotas pendientes en este momento</div>
                <div className="text-[11px] text-neutral-600 mt-0.5">
                  Haz clic para ver o registrar tus préstamos en cuotas
                </div>
              </div>
            )}
          </div>

          {/* Subtle Spending Distribution Overview */}
          <div className="space-y-3 pt-4 border-t border-neutral-800/40">
            <div className="flex items-center justify-between pb-1">
              <h2 className="text-sm font-medium text-neutral-200">Distribución de Gastos</h2>
              <span className="text-xs font-mono text-neutral-500">
                {formatCurrency(gastosMes, preferredViewCurrency)}
              </span>
            </div>

            <div className="space-y-3 text-xs">
              {categorySpending.length > 0 ? (
                categorySpending.map((item, idx) => {
                  const barColor =
                    idx === 0
                      ? 'bg-neutral-300'
                      : idx === 1
                        ? 'bg-neutral-400'
                        : idx === 2
                          ? 'bg-neutral-500'
                          : 'bg-neutral-600';

                  return (
                    <div key={item.name}>
                      <div className="flex justify-between text-neutral-400 mb-1">
                        <span>{item.name}</span>
                        <span className="font-mono text-neutral-300">
                          {item.pct}% • {formatCurrency(item.amount, preferredViewCurrency)}
                        </span>
                      </div>
                      <div className="h-1 w-full bg-neutral-900 rounded-full overflow-hidden">
                        <div
                          className={`${barColor} h-full rounded-full transition-all duration-500`}
                          style={{ width: `${item.pct}%` }}
                        ></div>
                      </div>
                    </div>
                  );
                })
              ) : (
                <div className="py-6 text-center text-xs text-neutral-500">
                  No hay gastos registrados en este período.
                </div>
              )}
            </div>
          </div>
        </div>
      </section>

      {/* Modal Desglose y Auditoría Real: Dinero Realmente Libre vs Compromisos */}
      {isBreakdownOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fadeIn"
          onClick={() => setIsBreakdownOpen(false)}
        >
          <div
            className="bg-[#12141a] border border-neutral-800 rounded-2xl max-w-xl w-full p-6 shadow-2xl space-y-5 max-h-[90vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="flex items-center justify-between pb-3 border-b border-neutral-800">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-blue-500/15 border border-blue-500/30 flex items-center justify-center text-blue-400">
                  <span className="material-symbols-outlined text-[20px]">account_balance_wallet</span>
                </div>
                <div>
                  <h3 className="text-sm font-semibold text-white">Auditoría Real: Gastos y Compromisos</h3>
                  <p className="text-xs text-neutral-400">
                    {spendPeriod === 'quincena' ? `Cálculo ajustado a la ${commitments.fortnightLabel || 'quincena actual'}` : 'Desglose exacto de compromisos mensuales'}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-3">
                {/* Selector Quincena / Mes en el modal */}
                <div className="flex items-center bg-neutral-900 border border-neutral-800 rounded-lg p-0.5 text-xs font-mono">
                  <button
                    type="button"
                    onClick={() => {
                      setSpendPeriod('quincena');
                      try { localStorage.setItem('finance_dashboard_spend_period', 'quincena'); } catch {}
                    }}
                    className={`px-3 py-1 rounded-md transition-all ${
                      spendPeriod === 'quincena'
                        ? 'bg-neutral-700 text-white font-medium shadow-xs'
                        : 'text-neutral-400 hover:text-neutral-200'
                    }`}
                  >
                    Esta Quincena
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setSpendPeriod('mes');
                      try { localStorage.setItem('finance_dashboard_spend_period', 'mes'); } catch {}
                    }}
                    className={`px-3 py-1 rounded-md transition-all ${
                      spendPeriod === 'mes'
                        ? 'bg-neutral-700 text-white font-medium shadow-xs'
                        : 'text-neutral-400 hover:text-neutral-200'
                    }`}
                  >
                    Mes Completo
                  </button>
                </div>

                <button
                  onClick={() => setIsBreakdownOpen(false)}
                  className="text-neutral-500 hover:text-neutral-300 p-1.5 rounded-lg hover:bg-neutral-800/60 transition-colors"
                >
                  <span className="material-symbols-outlined text-[20px]">close</span>
                </button>
              </div>
            </div>

            {/* Banner de Total Compromisos Pendientes */}
            <div className="p-4 rounded-xl bg-amber-950/20 border border-amber-800/40 flex items-center justify-between">
              <div>
                <div className="text-xs text-amber-300/80 uppercase font-mono tracking-wider flex items-center gap-2">
                  <span>Total Compromisos Fijos Pendientes</span>
                  <span className="text-[10px] px-1.5 py-0.2 rounded bg-amber-500/20 text-amber-300 font-sans">
                    {spendPeriod === 'quincena' ? commitments.fortnightLabel : 'Mes'}
                  </span>
                </div>
                <div className="text-xs text-neutral-400 mt-0.5">
                  {spendPeriod === 'quincena'
                    ? 'Suma de gastos fijos y cuotas que vencen en esta quincena'
                    : 'Suma de gastos fijos y cuotas que faltan por pagar este mes'}
                </div>
              </div>
              <div className="text-right">
                <div className="text-lg font-bold font-mono text-amber-400">
                  {formatCurrency(isVes ? commitments.totalCompromisosPendientesUsd * activeUsdRate : commitments.totalCompromisosPendientesUsd, preferredViewCurrency)}
                </div>
                <div className="text-[11px] font-mono text-neutral-500">
                  {commitments.itemsPendientes.length} concepto{commitments.itemsPendientes.length === 1 ? '' : 's'} pendiente{commitments.itemsPendientes.length === 1 ? '' : 's'}
                </div>
              </div>
            </div>

            {/* Sección 1: Lista Item por Item de Gastos Fijos Pendientes */}
            <div className="space-y-2">
              <div className="flex items-center justify-between text-xs text-neutral-400 px-1">
                <span className="font-medium text-neutral-300">1. ¿De dónde sale este monto? (Lista detallada)</span>
                <span className="font-mono text-[11px]">Falta Pagar</span>
              </div>

              {commitments.items.length > 0 ? (
                <div className="space-y-1.5 font-mono text-xs">
                  {commitments.items.map((item) => {
                    const isPagado = item.estado === 'pagado';
                    const isParcial = item.estado === 'parcial';
                    const isDebt = item.tipo === 'cuota_deuda';

                    const itemTotalDom = isVes ? item.montoTotalUsd * activeUsdRate : item.montoTotalUsd;
                    const itemPagadoDom = isVes ? item.montoPagadoUsd * activeUsdRate : item.montoPagadoUsd;
                    const itemPendienteDom = isVes ? item.montoPendienteUsd * activeUsdRate : item.montoPendienteUsd;

                    return (
                      <div
                        key={item.id}
                        className={`p-3 rounded-lg border flex items-center justify-between ${
                          isPagado
                            ? 'bg-neutral-900/30 border-neutral-800/40 text-neutral-400'
                            : isParcial
                              ? 'bg-blue-950/15 border-blue-900/40 text-neutral-200'
                              : 'bg-neutral-900/60 border-neutral-800 text-neutral-200'
                        }`}
                      >
                        <div className="min-w-0 pr-3">
                          <div className="flex items-center gap-2">
                            <span className="material-symbols-outlined text-[15px] text-neutral-400 flex-shrink-0">
                              {isDebt ? 'credit_card' : 'home_work'}
                            </span>
                            <span className="font-sans font-medium text-xs text-neutral-200 truncate">
                              {item.nombre}
                            </span>
                            <span
                              className={`text-[10px] font-mono px-1.5 py-0.2 rounded ${
                                isDebt
                                  ? 'bg-purple-950/50 text-purple-300 border border-purple-800/40'
                                  : 'bg-blue-950/50 text-blue-300 border border-blue-800/40'
                              }`}
                            >
                              {isDebt ? 'Préstamo' : 'Fijo Mensual'}
                            </span>
                          </div>
                          <div className="text-[11px] text-neutral-500 font-sans mt-0.5 ml-6">
                            Total: {formatCurrency(itemTotalDom, preferredViewCurrency)} • Pagado: {formatCurrency(itemPagadoDom, preferredViewCurrency)}
                          </div>
                        </div>

                        <div className="text-right flex-shrink-0">
                          {isPagado ? (
                            <span className="text-emerald-400 font-sans text-xs font-medium">✓ Pagado</span>
                          ) : (
                            <span className="text-amber-400 font-bold text-xs">
                              {formatCurrency(itemPendienteDom, preferredViewCurrency)}
                            </span>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="py-4 text-center text-xs text-neutral-500 bg-neutral-900/30 rounded-lg border border-neutral-800">
                  No hay gastos fijos ni cuotas de préstamos registradas este mes.
                </div>
              )}
            </div>

            {/* Sección 2: Presupuestos Variables (Gastos Libres Cotidianos) */}
            {commitments.itemsVariables.length > 0 && (
              <div className="space-y-2 pt-2 border-t border-neutral-800/60">
                <div className="flex items-center justify-between text-xs text-neutral-400 px-1">
                  <span className="font-medium text-neutral-300">2. Presupuestos Variables (Comida, Salidas, etc.)</span>
                  <span className="font-mono text-[11px]">Restante Libre</span>
                </div>
                <div className="space-y-1.5 font-mono text-xs">
                  {commitments.itemsVariables.map((v) => {
                    const limDom = isVes ? v.limiteUsd * activeUsdRate : v.limiteUsd;
                    const gastDom = isVes ? v.gastadoUsd * activeUsdRate : v.gastadoUsd;
                    const restDom = isVes ? v.restanteUsd * activeUsdRate : v.restanteUsd;

                    return (
                      <div
                        key={v.id}
                        className="p-2.5 rounded-lg bg-neutral-900/40 border border-neutral-800 flex items-center justify-between"
                      >
                        <div className="min-w-0">
                          <div className="font-sans font-medium text-xs text-neutral-200 truncate">
                            {v.nombre}
                          </div>
                          <div className="text-[11px] text-neutral-500 font-sans mt-0.5">
                            Límite: {formatCurrency(limDom, preferredViewCurrency)} • Gastado: {formatCurrency(gastDom, preferredViewCurrency)}
                          </div>
                        </div>
                        <div className="text-right flex-shrink-0">
                          <span className={v.restanteUsd > 0 ? 'text-emerald-400 font-semibold' : 'text-neutral-500'}>
                            {formatCurrency(restDom, preferredViewCurrency)}
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Sección 3: Fórmula y Resultado Final */}
            <div className="p-3.5 rounded-xl bg-blue-950/20 border border-blue-800/40 space-y-2">
              <div className="flex items-center justify-between text-xs font-sans">
                <span className="text-neutral-400">
                  {spendPeriod === 'quincena' ? 'Presupuesto Variable de la Quincena:' : 'Total Presupuestado en el Mes:'}
                </span>
                <span className="font-mono text-neutral-200">
                  {formatCurrency(
                    isVes
                      ? (spendPeriod === 'quincena' ? commitments.totalPresupuestoVariableUsd : commitments.totalPresupuestoGlobalUsd) * activeUsdRate
                      : (spendPeriod === 'quincena' ? commitments.totalPresupuestoVariableUsd : commitments.totalPresupuestoGlobalUsd),
                    preferredViewCurrency
                  )}
                </span>
              </div>
              <div className="flex items-center justify-between text-xs font-sans">
                <span className="text-neutral-400">
                  {spendPeriod === 'quincena' ? 'Gastos variables hechos en esta quincena:' : 'Gastos ya realizados este mes:'}
                </span>
                <span className="font-mono text-neutral-300">
                  -{formatCurrency(
                    isVes
                      ? (spendPeriod === 'quincena' ? commitments.totalVariableGastadoUsd : commitments.totalGastosGlobalUsd) * activeUsdRate
                      : (spendPeriod === 'quincena' ? commitments.totalVariableGastadoUsd : commitments.totalGastosGlobalUsd),
                    preferredViewCurrency
                  )}
                </span>
              </div>
              <div className="flex items-center justify-between text-xs font-sans">
                <span className="text-amber-400">
                  {spendPeriod === 'quincena' ? 'Compromisos fijos de esta quincena:' : 'Compromisos Fijos que faltan por pagar:'}
                </span>
                <span className="font-mono text-amber-400 font-semibold">
                  -{formatCurrency(isVes ? commitments.totalCompromisosPendientesUsd * activeUsdRate : commitments.totalCompromisosPendientesUsd, preferredViewCurrency)}
                </span>
              </div>
              <div className="pt-2 border-t border-blue-800/40 flex items-center justify-between">
                <div>
                  <div className="text-blue-300 font-sans font-semibold text-xs flex items-center gap-1.5">
                    <span>
                      {spendPeriod === 'quincena' ? 'Dinero Libre para esta Quincena:' : 'Dinero Realmente Libre para gastar:'}
                    </span>
                    {spendPeriod === 'quincena' && commitments.daysRemainingInPeriod && (
                      <span className="text-[10px] px-1.5 py-0.2 rounded bg-blue-500/20 text-blue-300 font-mono">
                        {commitments.daysRemainingInPeriod === 1 ? 'Queda 1 día' : `Quedan ${commitments.daysRemainingInPeriod} días`}
                      </span>
                    )}
                  </div>
                  <div className="text-[11px] text-neutral-400 font-sans">
                    {spendPeriod === 'quincena'
                      ? `Margen libre para los días restantes de la ${commitments.fortnightLabel || 'quincena'}`
                      : 'Margen libre del presupuesto tras apartar tus fijos'}
                  </div>
                </div>
                <div className="text-white font-bold font-mono text-base">
                  {formatCurrency(disponibleParaGastar.disponibleDominant, preferredViewCurrency)}
                </div>
              </div>
            </div>

            {/* Botones de acción */}
            <div className="flex gap-2 pt-2">
              <button
                type="button"
                onClick={() => {
                  setIsBreakdownOpen(false);
                  onNavigateTab('budgets');
                }}
                className="flex-1 py-2 rounded-lg bg-neutral-800 hover:bg-neutral-700 text-xs font-medium text-neutral-200 transition-colors flex items-center justify-center gap-1.5"
              >
                <span className="material-symbols-outlined text-[15px]">edit</span>
                <span>Modificar Presupuestos</span>
              </button>
              <button
                type="button"
                onClick={() => setIsBreakdownOpen(false)}
                className="flex-1 py-2 rounded-lg bg-blue-600 hover:bg-blue-500 text-xs font-medium text-white transition-colors"
              >
                Entendido
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
