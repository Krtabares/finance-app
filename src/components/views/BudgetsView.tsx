'use client';

import React, { useState, useMemo, useEffect } from 'react';
import { useFinance } from '@/context/FinanceContext';
import { formatCurrency, parseTransactionDate } from '@/lib/formatters';
import { BudgetModal } from '@/components/modals/BudgetModal';
import { Category, Budget } from '@/types/finance';
import styles from './BudgetsView.module.css';

export const BudgetsView: React.FC = () => {
  const {
    budgets,
    categories,
    transactions,
    deleteBudget,
    addCategory,
    deleteCategory,
    preferredViewCurrency,
    setPreferredViewCurrency,
    convert,
    rates,
  } = useFinance();

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [viewCurrency, setViewCurrency] = useState<'VES' | 'USD'>(preferredViewCurrency || 'VES');
  const [sortBy, setSortBy] = useState<'percent' | 'spent' | 'name'>('percent');
  const [filterOverOnly, setFilterOverOnly] = useState(false);

  // New category inline form state
  const [newCatNombre, setNewCatNombre] = useState('');
  const [newCatTipo, setNewCatTipo] = useState<'gasto' | 'ingreso'>('gasto');

  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    if (preferredViewCurrency) {
      setViewCurrency(preferredViewCurrency);
    }
  }, [preferredViewCurrency]);

  const activeUsdRate = rates.find((r) => r.moneda === 'USD')?.tasa_a_ves || 450;
  const isUsdView = viewCurrency === 'USD';

  // Current calendar cycle info and Month Selection
  const now = new Date();
  const defaultMonthStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  const [selectedMonthStr, setSelectedMonthStr] = useState<string>(defaultMonthStr);

  const availableMonths = useMemo(() => {
    const monthsMap = new Map<string, string>();
    for (let i = -6; i <= 1; i++) {
      const d = new Date(now.getFullYear(), now.getMonth() + i, 1);
      const val = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      const name = new Intl.DateTimeFormat('es-VE', { month: 'long' }).format(d);
      const label = `${name.charAt(0).toUpperCase() + name.slice(1)} ${d.getFullYear()}`;
      monthsMap.set(val, label);
    }
    transactions.forEach((tx) => {
      if (tx.fecha) {
        const info = parseTransactionDate(tx.fecha);
        const val = `${info.year}-${String(info.month + 1).padStart(2, '0')}`;
        if (!monthsMap.has(val)) {
          const d = new Date(info.year, info.month, 1);
          const name = new Intl.DateTimeFormat('es-VE', { month: 'long' }).format(d);
          const label = `${name.charAt(0).toUpperCase() + name.slice(1)} ${info.year}`;
          monthsMap.set(val, label);
        }
      }
    });
    return Array.from(monthsMap.entries())
      .map(([value, label]) => ({ value, label }))
      .sort((a, b) => b.value.localeCompare(a.value));
  }, [transactions]);

  const [selYear, selMonth] = selectedMonthStr.split('-').map(Number);
  const selectedYear = selYear || now.getFullYear();
  const selectedMonthIdx = (selMonth || (now.getMonth() + 1)) - 1; // 0-indexed

  const selectedDate = new Date(selectedYear, selectedMonthIdx, 1);
  const monthName = new Intl.DateTimeFormat('es-VE', { month: 'long' }).format(selectedDate);
  const formattedCycleMonth = `${monthName.charAt(0).toUpperCase() + monthName.slice(1)} ${selectedYear}`;

  const isCurrentMonth = selectedYear === now.getFullYear() && selectedMonthIdx === now.getMonth();
  const isPastMonth = selectedYear < now.getFullYear() || (selectedYear === now.getFullYear() && selectedMonthIdx < now.getMonth());

  const totalDaysInMonth = new Date(selectedYear, selectedMonthIdx + 1, 0).getDate();
  const currentDay = isCurrentMonth ? now.getDate() : (isPastMonth ? totalDaysInMonth : 1);
  const daysRemaining = isCurrentMonth ? Math.max(1, totalDaysInMonth - currentDay) : 0;

  // Operations count map for categories
  const catOpsCount = useMemo(() => {
    const counts: Record<string, number> = {};
    transactions.forEach((tx) => {
      if (tx.category_id) {
        counts[tx.category_id] = (counts[tx.category_id] || 0) + 1;
      }
    });
    return counts;
  }, [transactions]);

  // Icon mapping matching Material Symbols Outlined
  const getCategoryIcon = (cat?: Category) => {
    if (!cat) return 'category';
    const name = cat.nombre.toLowerCase();
    if (name.includes('aliment') || name.includes('mercado') || name.includes('comida') || name.includes('supermercado')) {
      return 'shopping_basket';
    }
    if (name.includes('servicio') || name.includes('luz') || name.includes('internet') || name.includes('agua') || name.includes('hogar')) {
      return 'bolt';
    }
    if (name.includes('transporte') || name.includes('gasolina') || name.includes('carro') || name.includes('combustible')) {
      return 'directions_car';
    }
    if (name.includes('salud') || name.includes('farmacia') || name.includes('medic')) {
      return 'health_and_safety';
    }
    if (name.includes('ocio') || name.includes('restaurante') || name.includes('salida') || name.includes('juego') || name.includes('diversion')) {
      return 'theater_comedy';
    }
    if (name.includes('educacion') || name.includes('curso') || name.includes('estudio')) {
      return 'school';
    }
    if (name.includes('mantenimiento') || name.includes('reparacion')) {
      return 'home_repair_service';
    }
    if (name.includes('regalo') || name.includes('familia') || name.includes('aporte')) {
      return 'card_giftcard';
    }
    if (name.includes('tarjeta') || name.includes('comision') || name.includes('banco')) {
      return 'credit_card';
    }
    if (name.includes('sueldo') || name.includes('nomina') || name.includes('salario')) {
      return 'payments';
    }
    if (name.includes('cripto') || name.includes('bitcoin') || name.includes('arbitraje') || name.includes('usdt')) {
      return 'currency_bitcoin';
    }
    if (name.includes('consultoria') || name.includes('freelance') || name.includes('trabajo')) {
      return 'work_outline';
    }
    if (name.includes('alquiler') || name.includes('renta')) {
      return 'real_estate_agent';
    }
    return cat.tipo === 'gasto' ? 'label' : 'monetization_on';
  };

  const getCategoryDescription = (cat?: Category) => {
    if (!cat) return 'Asignación mensual';
    const name = cat.nombre.toLowerCase();
    if (name.includes('aliment') || name.includes('mercado') || name.includes('comida')) {
      return 'Supermercados, víveres, proteína';
    }
    if (name.includes('servicio') || name.includes('luz') || name.includes('internet') || name.includes('hogar')) {
      return 'Condominio, fibra óptica, electricidad';
    }
    if (name.includes('transporte') || name.includes('gasolina') || name.includes('combustible')) {
      return 'Gasolina internacional, estacionamiento';
    }
    if (name.includes('salud') || name.includes('farmacia') || name.includes('medic')) {
      return 'Farmatodo, póliza médica, consultas';
    }
    if (name.includes('ocio') || name.includes('restaurante') || name.includes('entretenimiento')) {
      return 'Suscripciones, salidas, delivery';
    }
    if (name.includes('educacion')) {
      return 'Matrículas, libros, certificaciones';
    }
    if (name.includes('mantenimiento')) {
      return 'Reparaciones, repuestos, limpieza';
    }
    if (name.includes('sueldo') || name.includes('nomina')) {
      return 'Ingresos fijos recurrentes';
    }
    if (name.includes('cripto') || name.includes('p2p')) {
      return 'Comercio Binance P2P & exchanges';
    }
    return cat.tipo === 'gasto' ? 'Gasto regular clasificado' : 'Entrada de capital verificada';
  };

  // Computations for budgets
  const computedBudgets = useMemo(() => {
    return budgets.map((b) => {
      const limiteUsd = b.moneda === 'USD'
        ? (b.monto_original || b.monto_limite)
        : (b.monto_limite > 500 && activeUsdRate > 0 ? b.monto_limite / activeUsdRate : b.monto_limite);
      const limiteVes = limiteUsd * activeUsdRate;

      let gastadoUsd = 0;
      let gastadoVes = 0;

      transactions.forEach((tx) => {
        const txInfo = parseTransactionDate(tx.fecha);
        if (
          tx.category_id === b.category_id &&
          tx.tipo === 'gasto' &&
          txInfo.month === selectedMonthIdx &&
          txInfo.year === selectedYear
        ) {
          const txUsd = Number(tx.monto_usd) || (tx.tasa_cambio && tx.tasa_cambio > 0 ? (Number(tx.monto_ves) || 0) / tx.tasa_cambio : convert(Number(tx.monto) || 0, tx.moneda, 'USD'));
          const txVes = Number(tx.monto_ves) || (txUsd * (tx.tasa_cambio || activeUsdRate));
          gastadoUsd += txUsd;
          gastadoVes += txVes;
        }
      });

      const porcentaje = limiteUsd > 0 ? (gastadoUsd / limiteUsd) * 100 : 0;
      const restanteUsd = Math.max(0, limiteUsd - gastadoUsd);
      const restanteVes = Math.max(0, limiteVes - gastadoVes);

      return {
        ...b,
        gastado_ves: gastadoVes,
        gastado_usd: gastadoUsd,
        limite_ves: limiteVes,
        limite_usd: limiteUsd,
        porcentaje_usado: porcentaje,
        restante_ves: restanteVes,
        restante_usd: restanteUsd,
      };
    });
  }, [budgets, transactions, convert, activeUsdRate, selectedMonthIdx, selectedYear]);

  // Overall Totals
  const totals = useMemo(() => {
    const totalLimiteUsd = computedBudgets.reduce((acc, b) => acc + b.limite_usd, 0);
    const totalLimiteVes = computedBudgets.reduce((acc, b) => acc + b.limite_ves, 0);
    const totalGastadoUsd = computedBudgets.reduce((acc, b) => acc + b.gastado_usd, 0);
    const totalGastadoVes = computedBudgets.reduce((acc, b) => acc + b.gastado_ves, 0);

    const totalRestanteUsd = Math.max(0, totalLimiteUsd - totalGastadoUsd);
    const totalRestanteVes = Math.max(0, totalLimiteVes - totalGastadoVes);

    const globalPercent = totalLimiteUsd > 0 ? (totalGastadoUsd / totalLimiteUsd) * 100 : 0;
    const remainingPercent = Math.max(0, 100 - globalPercent);

    // Run rate & prediction
    const dailySpentUsd = currentDay > 0 ? totalGastadoUsd / currentDay : 0;
    const dailySpentVes = currentDay > 0 ? totalGastadoVes / currentDay : 0;

    const projectedTotalUsd = dailySpentUsd * totalDaysInMonth;
    const projectedTotalVes = dailySpentVes * totalDaysInMonth;

    const surplusUsd = totalLimiteUsd - projectedTotalUsd;
    const surplusVes = totalLimiteVes - projectedTotalVes;

    const dailyLimitRemainingUsd = daysRemaining > 0 ? totalRestanteUsd / daysRemaining : 0;
    const dailyLimitRemainingVes = daysRemaining > 0 ? totalRestanteVes / daysRemaining : 0;

    // Highest deviation & healthiest
    let maxDevBudget: (typeof computedBudgets)[0] | null = null;
    let healthiestBudget: (typeof computedBudgets)[0] | null = null;

    if (computedBudgets.length > 0) {
      const sortedByPct = [...computedBudgets].sort((a, b) => b.porcentaje_usado - a.porcentaje_usado);
      maxDevBudget = sortedByPct[0];
      healthiestBudget = sortedByPct[sortedByPct.length - 1];
    }

    return {
      totalLimiteUsd,
      totalLimiteVes,
      totalGastadoUsd,
      totalGastadoVes,
      totalRestanteUsd,
      totalRestanteVes,
      globalPercent,
      remainingPercent,
      dailySpentUsd,
      dailySpentVes,
      surplusUsd,
      surplusVes,
      dailyLimitRemainingUsd,
      dailyLimitRemainingVes,
      maxDevBudget,
      healthiestBudget,
    };
  }, [computedBudgets, currentDay, totalDaysInMonth, daysRemaining]);

  // Sorted list of budgets
  const filteredAndSortedBudgets = useMemo(() => {
    let list = [...computedBudgets];
    if (filterOverOnly) {
      list = list.filter((b) => b.porcentaje_usado >= 75);
    }
    if (sortBy === 'percent') {
      list.sort((a, b) => b.porcentaje_usado - a.porcentaje_usado);
    } else if (sortBy === 'spent') {
      list.sort((a, b) => b.gastado_usd - a.gastado_usd);
    } else if (sortBy === 'name') {
      list.sort((a, b) => {
        const catA = categories.find((c) => c.id === a.category_id)?.nombre || '';
        const catB = categories.find((c) => c.id === b.category_id)?.nombre || '';
        return catA.localeCompare(catB);
      });
    }
    return list;
  }, [computedBudgets, sortBy, filterOverOnly, categories]);

  // Handler for creating a new category
  const handleCreateCategory = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCatNombre.trim()) return;
    await addCategory({
      nombre: newCatNombre.trim(),
      tipo: newCatTipo,
      color: newCatTipo === 'gasto' ? '#878a99' : '#22c55e',
      icono: newCatTipo === 'gasto' ? 'label' : 'payments',
    });
    setNewCatNombre('');
  };

  const handleDeleteCategory = async (cat: Category) => {
    if (confirm(`¿Eliminar la categoría "${cat.nombre}"?`)) {
      await deleteCategory(cat.id);
    }
  };

  // Helper to split numbers into integer and decimals for stylish display
  const splitAmount = (amount: number, currency: 'VES' | 'USD') => {
    if (currency === 'VES') {
      const formatted = new Intl.NumberFormat('es-VE', {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      }).format(amount);
      const parts = formatted.split(',');
      return {
        prefix: 'Bs. ',
        int: parts[0] || '0',
        dec: `,${parts[1] || '00'}`,
      };
    } else {
      const formatted = new Intl.NumberFormat('en-US', {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      }).format(amount);
      const parts = formatted.split('.');
      return {
        prefix: '$',
        int: parts[0] || '0',
        dec: `.${parts[1] || '00'}`,
      };
    }
  };

  // Values for primary macro cards
  const asignadoSplit = splitAmount(
    isUsdView ? totals.totalLimiteUsd : totals.totalLimiteVes,
    isUsdView ? 'USD' : 'VES'
  );
  const gastadoSplit = splitAmount(
    isUsdView ? totals.totalGastadoUsd : totals.totalGastadoVes,
    isUsdView ? 'USD' : 'VES'
  );
  const restanteSplit = splitAmount(
    isUsdView ? totals.totalRestanteUsd : totals.totalRestanteVes,
    isUsdView ? 'USD' : 'VES'
  );

  // Donut chart calculation
  // Circumference of radius 40 is 2 * PI * 40 = 251.327
  const donutCircumference = 251.327;
  const clampedPct = Math.min(100, Math.max(0, totals.globalPercent));
  const donutOffset = donutCircumference - (clampedPct / 100) * donutCircumference;

  const egresosCategories = categories.filter((c) => c.tipo === 'gasto');
  const ingresosCategories = categories.filter((c) => c.tipo === 'ingreso');

  return (
    <div className={styles.container}>
      {/* Subtle ambient glow in background */}
      <div className={styles.ambientGlow} />

      {/* Header Section */}
      <section className={styles.headerSection}>
        <div className={styles.headerLeft}>
          <div className={styles.breadcrumbRow}>
            <span className={styles.breadcrumbTag}>Control Financiero</span>
            <span className={styles.breadcrumbSep}>/</span>
            <span className={styles.breadcrumbBase}>
              {isUsdView ? 'Moneda Base USD' : 'Moneda Base VES'}
            </span>
          </div>

          <div className={styles.titleRow}>
            <h1 className={styles.pageTitle}>Presupuestos Mensuales</h1>

            <div className={styles.monthBadge} title="Haz clic para cambiar de mes">
              <select
                className={styles.monthSelectInput}
                value={selectedMonthStr}
                onChange={(e) => setSelectedMonthStr(e.target.value)}
                aria-label="Seleccionar mes de análisis"
              >
                {availableMonths.map((m) => (
                  <option key={m.value} value={m.value} style={{ background: '#121419', color: '#ededf0' }}>
                    {m.label}
                  </option>
                ))}
              </select>
              <span className="material-symbols-outlined text-[16px] text-neutral-400">calendar_today</span>
              <span>{formattedCycleMonth}</span>
              <span className="material-symbols-outlined text-[14px] text-neutral-500">expand_more</span>
            </div>
          </div>
        </div>

        {/* Header Actions */}
        <div className={styles.headerActions}>
          {/* Currency Toggle */}
          <div className={styles.currencyToggle}>
            <button
              type="button"
              onClick={() => {
                setViewCurrency('VES');
                setPreferredViewCurrency('VES');
              }}
              className={`${styles.currencyToggleBtn} ${!isUsdView ? styles.currencyToggleBtnActive : ''}`}
            >
              VES
            </button>
            <button
              type="button"
              onClick={() => {
                setViewCurrency('USD');
                setPreferredViewCurrency('USD');
              }}
              className={`${styles.currencyToggleBtn} ${isUsdView ? styles.currencyToggleBtnActive : ''}`}
            >
              USD
            </button>
          </div>

          <button
            type="button"
            onClick={() => {
              const el = document.getElementById('categorias-sistema');
              if (el) el.scrollIntoView({ behavior: 'smooth' });
            }}
            className={styles.btnSecondary}
          >
            <span className="material-symbols-outlined text-[16px] text-neutral-400">category</span>
            <span>Gestionar Categorías</span>
          </button>

          <button
            type="button"
            onClick={() => setIsModalOpen(true)}
            className={styles.btnPrimary}
          >
            <span className="material-symbols-outlined text-[16px]">add</span>
            <span>Fijar Presupuesto</span>
          </button>
        </div>
      </section>

      {/* Macro Telemetry Cards (4-column breakdown) */}
      <section className={styles.macroGrid}>
        {/* Card 1: Presupuesto Asignado */}
        <div className={styles.macroCard}>
          <div className={styles.macroHeader}>
            <span className={styles.macroLabel}>Presupuesto Asignado</span>
            <span className="material-symbols-outlined text-[18px] text-neutral-500">account_balance</span>
          </div>
          <div className={styles.macroAmountRow}>
            <span>{asignadoSplit.prefix}</span>
            <span>{asignadoSplit.int}</span>
            <span className={styles.macroDecimals}>{asignadoSplit.dec}</span>
          </div>
          <div className={styles.macroFooterRow}>
            <span>{isUsdView ? 'Equiv. VES' : 'Equiv. USD'}</span>
            <span className={styles.macroTicker}>
              {isUsdView
                ? formatCurrency(totals.totalLimiteVes, 'VES')
                : formatCurrency(totals.totalLimiteUsd, 'USD')}
            </span>
            <span className={styles.macroSubNote}>(Tasa BCV)</span>
          </div>
        </div>

        {/* Card 2: Ejecutado al Momento */}
        <div className={styles.macroCard}>
          <div className={styles.macroHeader}>
            <span className={styles.macroLabel}>Ejecutado al Momento</span>
            <div
              className={`${styles.macroPill} ${
                totals.globalPercent >= 100 ? styles.macroPillAlert : ''
              }`}
            >
              <span className={styles.macroPillDot}></span>
              <span>{totals.globalPercent.toFixed(1).replace('.', ',')}%</span>
            </div>
          </div>
          <div className={styles.macroAmountRow}>
            <span>{gastadoSplit.prefix}</span>
            <span>{gastadoSplit.int}</span>
            <span className={styles.macroDecimals}>{gastadoSplit.dec}</span>
          </div>
          <div className={styles.macroFooterRow}>
            <span>{isUsdView ? 'Equiv. VES' : 'Equiv. USD'}</span>
            <span className={styles.macroTicker}>
              {isUsdView
                ? formatCurrency(totals.totalGastadoVes, 'VES')
                : formatCurrency(totals.totalGastadoUsd, 'USD')}
            </span>
            <span className={styles.macroSubNote}>registrados</span>
          </div>
        </div>

        {/* Card 3: Margen Disponible */}
        <div className={styles.macroCard}>
          <div className={styles.macroHeader}>
            <span className={styles.macroLabel}>Margen Disponible</span>
            <span
              className={`material-symbols-outlined text-[18px] ${
                totals.totalRestanteUsd > 0 ? 'text-secondary' : 'text-red-400'
              }`}
            >
              savings
            </span>
          </div>
          <div
            className={`${styles.macroAmountRow} ${
              totals.totalRestanteUsd > 0 ? styles.macroAmountSecondary : styles.macroAmountAlert
            }`}
          >
            <span>{restanteSplit.prefix}</span>
            <span>{restanteSplit.int}</span>
            <span className={styles.macroDecimals}>{restanteSplit.dec}</span>
          </div>
          <div className={styles.macroFooterRow}>
            <span>Restante</span>
            <span
              className={`${styles.macroTicker} ${
                totals.totalRestanteUsd > 0 ? 'text-secondary' : 'text-red-400'
              }`}
            >
              {totals.remainingPercent.toFixed(1).replace('.', ',')}%
            </span>
            <span className={styles.macroSubNote}>del cupo mensual</span>
          </div>
        </div>

        {/* Card 4: Ventana de Cierre */}
        <div className={styles.macroCard}>
          <div className={styles.macroHeader}>
            <span className={styles.macroLabel}>Ventana de Cierre</span>
            <span className="material-symbols-outlined text-[18px] text-neutral-500">timelapse</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: '8px' }}>
            <span className={styles.macroAmountRow}>
              {isPastMonth ? '0' : daysRemaining}
            </span>
            <span style={{ fontSize: '0.9rem', color: '#878a99', fontWeight: 500 }}>
              {isPastMonth ? 'mes cerrado' : daysRemaining === 1 ? 'día restante' : 'días restantes'}
            </span>
          </div>
          <div className={styles.macroFooterRow}>
            <span>Límite diario:</span>
            <span className={styles.macroTicker}>
              {isUsdView
                ? formatCurrency(totals.dailyLimitRemainingUsd, 'USD')
                : formatCurrency(totals.dailyLimitRemainingVes, 'VES')}
            </span>
            <span className={styles.macroSubNote}>/día</span>
          </div>
        </div>
      </section>

      {/* Global Progress Bar Segment */}
      <section className={styles.globalProgressCard}>
        <div className={styles.globalProgressHeader}>
          <div className={styles.globalProgressTitleGroup}>
            <span className={styles.globalProgressTitle}>Ritmo de Ejecución General</span>
            <span className={styles.globalProgressCycle}>
              {totalDaysInMonth} días en el ciclo
            </span>
          </div>

          <div className={styles.globalProgressLegend}>
            <div>
              <span className={styles.legendDot} style={{ backgroundColor: '#22c55e' }}></span>
              <span>Consumo Real ({totals.globalPercent.toFixed(1).replace('.', ',')}%)</span>
            </div>
            <div>
              <span className={styles.legendDot} style={{ backgroundColor: '#20232b' }}></span>
              <span>Cupo Sin Asignar ({totals.remainingPercent.toFixed(1).replace('.', ',')}%)</span>
            </div>
          </div>
        </div>

        {/* Ultra-thin continuous bar */}
        <div className={styles.globalBarTrack}>
          <div
            className={styles.globalBarFill}
            style={{
              width: `${Math.min(100, totals.globalPercent)}%`,
              backgroundColor: totals.globalPercent > 100 ? '#f87171' : '#22c55e',
            }}
          />
        </div>

        <div className={styles.globalProgressScale}>
          <span>01 {monthName} • {isUsdView ? '$0.00' : 'Bs. 0,00'}</span>
          <span className={styles.globalProgressScaleCenter}>
            {isPastMonth ? 'Ciclo mensual finalizado' : `Día ${currentDay} de ${totalDaysInMonth}`}
          </span>
          <span>
            {totalDaysInMonth} {monthName} •{' '}
            {isUsdView
              ? formatCurrency(totals.totalLimiteUsd, 'USD')
              : formatCurrency(totals.totalLimiteVes, 'VES')}
          </span>
        </div>
      </section>

      {/* Main Grid: Category Breakdown (8 cols) & Predictive Side (4 cols) */}
      <section className={styles.mainGrid}>
        {/* Left Column: Detalle por Categoría */}
        <div className={styles.leftColumn}>
          <div className={styles.columnHeader}>
            <div>
              <h2 className={styles.columnTitle}>Detalle por Categoría</h2>
              <div className={styles.columnSub}>
                Seguimiento de cuotas asignadas para {monthName}
              </div>
            </div>

            <div className={styles.columnTools}>
              <button
                type="button"
                className={styles.toolBtn}
                title={
                  sortBy === 'percent'
                    ? 'Ordenado por % consumido (clic para ordenar por monto)'
                    : sortBy === 'spent'
                    ? 'Ordenado por monto gastado (clic para ordenar por nombre)'
                    : 'Ordenado por nombre'
                }
                onClick={() => {
                  if (sortBy === 'percent') setSortBy('spent');
                  else if (sortBy === 'spent') setSortBy('name');
                  else setSortBy('percent');
                }}
              >
                <span className="material-symbols-outlined text-[18px]">sort</span>
              </button>

              <button
                type="button"
                className={`${styles.toolBtn} ${filterOverOnly ? 'text-secondary' : ''}`}
                title={filterOverOnly ? 'Mostrando presupuestos en alerta (clic para ver todos)' : 'Filtrar en alerta (>75%)'}
                onClick={() => setFilterOverOnly(!filterOverOnly)}
              >
                <span className="material-symbols-outlined text-[18px]">filter_list</span>
              </button>
            </div>
          </div>

          {/* Categories List */}
          {filteredAndSortedBudgets.length === 0 ? (
            <div className={styles.emptyStateBox}>
              <div className={styles.emptyStateIcon}>
                <span className="material-symbols-outlined text-[28px]">pie_chart</span>
              </div>
              <p style={{ color: '#ededf0', fontWeight: 600, fontSize: '0.95rem' }}>
                No hay presupuestos fijados todavía
              </p>
              <p style={{ color: '#878a99', fontSize: '0.82rem', maxWidth: '360px' }}>
                Fija techos mensuales para tus categorías para protegerte contra la devaluación y mantener control de gastos.
              </p>
              <button
                type="button"
                onClick={() => setIsModalOpen(true)}
                className={styles.btnPrimary}
                style={{ marginTop: '8px' }}
              >
                <span className="material-symbols-outlined text-[16px]">add</span>
                <span>Fijar Presupuesto Ahora</span>
              </button>
            </div>
          ) : (
            <div className={styles.categoryList}>
              {filteredAndSortedBudgets.map((b) => {
                const cat = categories.find((c) => c.id === b.category_id);
                const isOver = b.porcentaje_usado >= 100;
                const isWarning = b.porcentaje_usado >= 75 && !isOver;

                let barColor = '#22c55e';
                let pctColor = '#22c55e';
                if (isWarning) {
                  barColor = '#f59e0b';
                  pctColor = '#f59e0b';
                }
                if (isOver) {
                  barColor = '#f87171';
                  pctColor = '#f87171';
                }

                const primaryGastado = isUsdView
                  ? formatCurrency(b.gastado_usd, 'USD')
                  : formatCurrency(b.gastado_ves, 'VES');
                const primaryLimite = isUsdView
                  ? formatCurrency(b.limite_usd, 'USD')
                  : formatCurrency(b.limite_ves, 'VES');
                const primaryRestante = isUsdView
                  ? formatCurrency(b.restante_usd, 'USD')
                  : formatCurrency(b.restante_ves, 'VES');
                const primaryExceso = isUsdView
                  ? formatCurrency(b.gastado_usd - b.limite_usd, 'USD')
                  : formatCurrency(b.gastado_ves - b.limite_ves, 'VES');

                const iconName = getCategoryIcon(cat);
                const description = getCategoryDescription(cat);

                return (
                  <div key={b.id} className={styles.categoryItem}>
                    <div className={styles.categoryItemTop}>
                      <div className={styles.categoryItemLeft}>
                        <div className={styles.categoryIconBox}>
                          <span className="material-symbols-outlined text-[18px]">{iconName}</span>
                        </div>
                        <div className={styles.categoryMeta}>
                          <span className={styles.categoryTitle}>{cat?.nombre || 'Categoría'}</span>
                          <span className={styles.categorySub}>{description}</span>
                        </div>
                      </div>

                      <div className={styles.categoryItemRight}>
                        <div className={styles.categoryNumbersRow}>
                          <span className={styles.categorySpent}>{primaryGastado}</span>
                          <span className={styles.categoryLimit}>/ {primaryLimite}</span>
                          <button
                            type="button"
                            className={styles.categoryDeleteBtn}
                            title="Eliminar este presupuesto"
                            onClick={() => {
                              if (confirm(`¿Eliminar el presupuesto para "${cat?.nombre || 'esta categoría'}"?`)) {
                                deleteBudget(b.id);
                              }
                            }}
                          >
                            <span className="material-symbols-outlined text-[16px]">delete</span>
                          </button>
                        </div>

                        <div className={styles.categoryStatusRow}>
                          <span className={styles.categoryResta}>
                            {isOver
                              ? `Exceso: ${primaryExceso}`
                              : `Resta: ${primaryRestante}`}
                          </span>
                          <span className={styles.categoryPctBadge} style={{ color: pctColor }}>
                            {b.porcentaje_usado.toFixed(1).replace('.', ',')}%
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Linear Micro Bar */}
                    <div className={styles.categoryMicroTrack}>
                      <div
                        className={styles.categoryMicroFill}
                        style={{
                          width: `${Math.min(100, b.porcentaje_usado)}%`,
                          backgroundColor: barColor,
                        }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Right Column: Quick Analysis & Projections Side Column */}
        <div className={styles.rightColumn}>
          {/* Card: Análisis Predictivo */}
          <div className={styles.sideCard}>
            <div className={styles.sideCardHeader}>
              <span className={styles.macroLabel}>Análisis Predictivo</span>
              <span className="material-symbols-outlined text-[18px] text-neutral-400">trending_up</span>
            </div>

            <div className={styles.sideCardTitle}>
              {totals.surplusUsd >= 0 ? 'Superávit Estimado' : 'Riesgo de Déficit'}
            </div>

            <p className={styles.sideCardDesc}>
              Al ritmo actual de{' '}
              <strong style={{ color: '#ededf0' }}>
                {isUsdView
                  ? formatCurrency(totals.dailySpentUsd, 'USD')
                  : formatCurrency(totals.dailySpentVes, 'VES')}
                /día
              </strong>
              , cerrarás el mes con un{' '}
              {totals.surplusUsd >= 0 ? (
                <>
                  excedente de{' '}
                  <span style={{ color: '#22c55e', fontWeight: 600 }}>
                    {isUsdView
                      ? formatCurrency(totals.surplusUsd, 'USD')
                      : formatCurrency(totals.surplusVes, 'VES')}
                  </span>
                  .
                </>
              ) : (
                <>
                  desfase proyectado de{' '}
                  <span style={{ color: '#f87171', fontWeight: 600 }}>
                    {isUsdView
                      ? formatCurrency(Math.abs(totals.surplusUsd), 'USD')
                      : formatCurrency(Math.abs(totals.surplusVes), 'VES')}
                  </span>
                  .
                </>
              )}
            </p>

            {/* Compact SVG Donut Breakdown */}
            <div className={styles.donutWrapper}>
              <svg className={styles.donutSvg} viewBox="0 0 100 100">
                <circle
                  className={styles.donutTrack}
                  cx="50"
                  cy="50"
                  r="40"
                  fill="none"
                  strokeWidth="6"
                />
                <circle
                  className={`${styles.donutFill} ${
                    totals.globalPercent >= 100 ? styles.donutFillOver : ''
                  }`}
                  cx="50"
                  cy="50"
                  r="40"
                  fill="none"
                  strokeWidth="6"
                  strokeDasharray={donutCircumference}
                  strokeDashoffset={donutOffset}
                  strokeLinecap="round"
                />
              </svg>
              <div className={styles.donutCenter}>
                <span className={styles.donutPercent}>
                  {totals.globalPercent.toFixed(1).replace('.', ',')}%
                </span>
                <span className={styles.donutLabel}>Ocupado</span>
              </div>
            </div>

            <div className={styles.insightsList}>
              <div className={styles.insightRow}>
                <span className={styles.insightLabel}>Mayor desviación:</span>
                <span
                  className={
                    totals.maxDevBudget && totals.maxDevBudget.porcentaje_usado >= 100
                      ? styles.insightValRed
                      : styles.insightVal
                  }
                >
                  {totals.maxDevBudget
                    ? `${categories.find((c) => c.id === totals.maxDevBudget?.category_id)?.nombre || 'Categoría'} (${totals.maxDevBudget.porcentaje_usado.toFixed(1)}%)`
                    : 'Sin datos'}
                </span>
              </div>
              <div className={styles.insightRow}>
                <span className={styles.insightLabel}>Presupuesto más sano:</span>
                <span className={styles.insightValGreen}>
                  {totals.healthiestBudget
                    ? `${categories.find((c) => c.id === totals.healthiestBudget?.category_id)?.nombre || 'Categoría'} (${totals.healthiestBudget.porcentaje_usado.toFixed(1)}%)`
                    : 'Sin datos'}
                </span>
              </div>
            </div>
          </div>

          {/* Card: Indexación Dual */}
          <div className={styles.dualIndexWidget}>
            <div className={styles.dualIndexHeader}>
              <span className={styles.macroLabel}>Indexación Dual</span>
              <span style={{ fontSize: '11px', fontFamily: 'monospace', color: '#52525b' }}>
                OFICIAL BCV
              </span>
            </div>

            <div className={styles.dualIndexSplit}>
              <div className={styles.dualIndexCol}>
                <span style={{ fontSize: '12px', color: '#878a99' }}>Presupuesto en USD</span>
                <span className={styles.dualIndexVal}>
                  {formatCurrency(totals.totalLimiteUsd, 'USD')}
                </span>
              </div>

              <div className={styles.dualIndexDivider} />

              <div className={styles.dualIndexCol} style={{ alignItems: 'flex-end' }}>
                <span style={{ fontSize: '12px', color: '#878a99' }}>Consumo en USD</span>
                <span className={styles.dualIndexVal}>
                  {formatCurrency(totals.totalGastadoUsd, 'USD')}
                </span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Sección Inferior: Categorías del Sistema & Gestión Minimalista Monocromática */}
      <section id="categorias-sistema" className={styles.systemCategoriesSection}>
        <div className={styles.systemCategoriesHeader}>
          <div>
            <h2 className={styles.columnTitle}>Categorías del Sistema</h2>
            <div className={styles.columnSub}>
              Clasificadores globales para ingresos y egresos sin colores estridentes
            </div>
          </div>

          {/* Minimal Form Inline to Add Category */}
          <form className={styles.categoryFormInline} onSubmit={handleCreateCategory}>
            <div className={styles.typeSwitcher}>
              <button
                type="button"
                className={`${styles.typeSwitcherBtn} ${
                  newCatTipo === 'gasto' ? styles.typeSwitcherBtnActive : ''
                }`}
                onClick={() => setNewCatTipo('gasto')}
              >
                Gasto
              </button>
              <button
                type="button"
                className={`${styles.typeSwitcherBtn} ${
                  newCatTipo === 'ingreso' ? styles.typeSwitcherBtnActive : ''
                }`}
                onClick={() => setNewCatTipo('ingreso')}
              >
                Ingreso
              </button>
            </div>

            <div className={styles.categoryInputBox}>
              <span className="material-symbols-outlined text-[16px] text-neutral-500">tag</span>
              <input
                type="text"
                className={styles.categoryInput}
                placeholder="Nueva categoría..."
                value={newCatNombre}
                onChange={(e) => setNewCatNombre(e.target.value)}
                required
              />
            </div>

            <button type="submit" className={styles.btnCreateCat}>
              <span className="material-symbols-outlined text-[16px] text-secondary">add_circle</span>
              <span>Crear</span>
            </button>
          </form>
        </div>

        {/* Monochromatic Catalog Pills */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          {/* Egresos */}
          <div className={styles.catalogGroup}>
            <div className={styles.catalogTitle}>
              Egresos Registrados ({egresosCategories.length})
            </div>
            <div className={styles.chipsGrid}>
              {egresosCategories.map((c) => {
                const icon = getCategoryIcon(c);
                const ops = catOpsCount[c.id] || 0;
                return (
                  <div key={c.id} className={styles.catChip}>
                    <span className={`material-symbols-outlined text-[15px] ${styles.catChipIcon}`}>
                      {icon}
                    </span>
                    <span>{c.nombre}</span>
                    <span className={styles.opsCount}>{ops} ops</span>
                    <button
                      type="button"
                      className={styles.deleteChipBtn}
                      title={`Eliminar categoría "${c.nombre}"`}
                      onClick={(e) => {
                        e.stopPropagation();
                        handleDeleteCategory(c);
                      }}
                    >
                      <span className="material-symbols-outlined text-[14px]">close</span>
                    </button>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Ingresos */}
          <div className={styles.catalogGroup}>
            <div className={styles.catalogTitle}>
              Ingresos Registrados ({ingresosCategories.length})
            </div>
            <div className={styles.chipsGrid}>
              {ingresosCategories.map((c) => {
                const icon = getCategoryIcon(c);
                const ops = catOpsCount[c.id] || 0;
                return (
                  <div key={c.id} className={styles.catChip}>
                    <span
                      className={`material-symbols-outlined text-[15px] ${styles.catChipIconGreen}`}
                    >
                      {icon}
                    </span>
                    <span>{c.nombre}</span>
                    <span className={styles.opsCount}>{ops} ops</span>
                    <button
                      type="button"
                      className={styles.deleteChipBtn}
                      title={`Eliminar categoría "${c.nombre}"`}
                      onClick={(e) => {
                        e.stopPropagation();
                        handleDeleteCategory(c);
                      }}
                    >
                      <span className="material-symbols-outlined text-[14px]">close</span>
                    </button>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </section>

      {/* Modal para Fijar Presupuesto */}
      <BudgetModal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} />
    </div>
  );
};
