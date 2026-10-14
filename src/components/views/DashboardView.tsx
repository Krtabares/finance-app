'use client';

import React, { useMemo } from 'react';
import { useFinance } from '@/context/FinanceContext';
import { formatCurrency, parseTransactionDate } from '@/lib/formatters';

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
                className={`text-xs px-2 py-0.5 rounded font-mono font-medium ${
                  monthComparison.isPositive
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

        {/* Clean Restrained Sub-Stats (No loud cards) */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 pt-6 border-t border-neutral-800/40">
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
              Ritmo proyectado: {ritmoProyectado}
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
                      className={`p-3 rounded-lg border transition-all cursor-pointer flex items-center justify-between group ${
                        isOverdue
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
    </div>
  );
};
