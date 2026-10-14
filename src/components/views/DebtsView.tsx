'use client';

import React, { useState, useMemo } from 'react';
import {
  CreditCard,
  Plus,
  Landmark,
  AlertTriangle,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Trash2,
  Clock,
  Info,
} from 'lucide-react';
import { useFinance } from '@/context/FinanceContext';
import { Debt, DebtInstallment } from '@/types/finance';
import { formatCurrency } from '@/lib/formatters';
import { getDebtSummaryMetrics } from '@/lib/debts';
import { DebtModal } from '@/components/modals/DebtModal';
import { PayInstallmentModal } from '@/components/modals/PayInstallmentModal';
import styles from './DebtsView.module.css';

const MONTHS_LONG = [
  'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
  'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre',
];
const MONTHS_SHORT = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];

const cx = (...classes: (string | false | null | undefined)[]) => classes.filter(Boolean).join(' ');

const daysBetween = (fromStr: string, toStr: string) => {
  const from = new Date(fromStr);
  const to = new Date(toStr);
  return Math.ceil((to.getTime() - from.getTime()) / (1000 * 60 * 60 * 24));
};

const formatDisplayDate = (dateStr: string, withYear = true) => {
  if (!dateStr) return '—';
  const [y, m, d] = dateStr.split('-').map((p) => parseInt(p, 10));
  if (!y || !m || !d) return dateStr;
  return withYear ? `${d} ${MONTHS_SHORT[m - 1]} ${y}` : `${d} ${MONTHS_SHORT[m - 1]}`;
};

export const DebtsView: React.FC = () => {
  const { debts, debtInstallments, deleteDebt, convert, summary, isSupabaseMode } = useFinance();

  const [activeFilter, setActiveFilter] = useState<'all' | 'active' | 'completed'>('active');
  const [expandedDebtId, setExpandedDebtId] = useState<string | null>(null);
  const [isDebtModalOpen, setIsDebtModalOpen] = useState(false);
  const [payModalState, setPayModalState] = useState<{
    isOpen: boolean;
    debt: Debt | null;
    installment: DebtInstallment | null;
    isExtraPayment: boolean;
  }>({ isOpen: false, debt: null, installment: null, isExtraPayment: false });

  const todayStr = useMemo(() => new Date().toISOString().split('T')[0], []);

  const currentMonthYear = useMemo(() => {
    const d = new Date();
    return `${MONTHS_LONG[d.getMonth()]} ${d.getFullYear()}`;
  }, []);

  const relativeInfo = (dateStr: string) => {
    const diff = daysBetween(todayStr, dateStr);
    if (diff < 0) return { text: `${Math.abs(diff)}d atraso`, isOverdue: true, isUrgent: true };
    if (diff === 0) return { text: 'Hoy', isOverdue: false, isUrgent: true };
    if (diff === 1) return { text: 'Mañana', isOverdue: false, isUrgent: true };
    return { text: `${diff} días`, isOverdue: false, isUrgent: diff <= 3 };
  };

  // Resumen de cada deuda (se calcula una sola vez)
  const debtMetrics = useMemo(() => {
    const map = new Map<string, ReturnType<typeof getDebtSummaryMetrics>>();
    debts.forEach((d) => map.set(d.id, getDebtSummaryMetrics(d, debtInstallments)));
    return map;
  }, [debts, debtInstallments]);

  // Cuotas pendientes de deudas activas ordenadas por vencimiento
  const pendingInstallments = useMemo(() => {
    const list: { debt: Debt; installment: DebtInstallment }[] = [];
    debts.forEach((debt) => {
      if (debt.estado !== 'activa') return;
      debtMetrics.get(debt.id)?.debtInstallments.forEach((inst) => {
        if (inst.estado !== 'pagada') list.push({ debt, installment: inst });
      });
    });
    return list.sort((a, b) => a.installment.fecha_vencimiento.localeCompare(b.installment.fecha_vencimiento));
  }, [debts, debtMetrics]);

  // KPIs globales
  const kpis = useMemo(() => {
    let pendienteUsd = 0;
    let capitalUsd = 0;
    let vencidas = 0;
    let cuotasTotal = 0;
    let quincenalUsd = 0;

    debts.forEach((debt) => {
      if (debt.estado !== 'activa') return;
      const m = debtMetrics.get(debt.id)!;
      pendienteUsd += convert(m.saldoPendiente, debt.moneda, 'USD');
      capitalUsd += convert(debt.monto_total, debt.moneda, 'USD');
      vencidas += m.cuotasVencidas;
      cuotasTotal += m.cuotasTotal;

      if (!m.isCompletamentePagada) {
        const rawCuota =
          debt.monto_cuota > 0
            ? debt.monto_cuota
            : (m.debtInstallments[0]?.monto || (debt.num_cuotas > 0 ? debt.monto_total / debt.num_cuotas : 0));
        const cuotaUsd = convert(rawCuota, debt.moneda, 'USD');

        if (debt.frecuencia === 'quincenal') {
          quincenalUsd += cuotaUsd;
        } else if (debt.frecuencia === 'mensual') {
          quincenalUsd += cuotaUsd / 2;
        } else if (debt.frecuencia === 'semanal') {
          quincenalUsd += cuotaUsd * 2;
        }
      }
    });

    const quincenalVes = convert(quincenalUsd, 'USD', 'VES');

    // Cuotas pendientes de la quincena actual (días 1-15 o 16-fin del mes)
    const now = new Date();
    const currentDay = now.getDate();
    const currentYm = todayStr.slice(0, 7);
    const isFirstFortnight = currentDay <= 15;

    let estaQuincenaUsd = 0;
    pendingInstallments.forEach((p) => {
      const dStr = p.installment.fecha_vencimiento;
      if (!dStr.startsWith(currentYm)) return;
      const day = parseInt(dStr.slice(8, 10), 10);
      const inCurrentFortnight = isFirstFortnight ? day <= 15 : day > 15;
      if (inCurrentFortnight) {
        estaQuincenaUsd += convert(p.installment.monto - (p.installment.monto_pagado || 0), p.debt.moneda, 'USD');
      }
    });

    return {
      pendienteUsd,
      pendienteVes: convert(pendienteUsd, 'USD', 'VES'),
      capitalUsd,
      vencidas,
      cuotasTotal,
      cuotasPendientes: pendingInstallments.length,
      proxima: pendingInstallments[0] || null,
      activas: debts.filter((d) => d.estado === 'activa').length,
      pagadas: debts.filter((d) => d.estado === 'pagada').length,
      quincenalUsd,
      quincenalVes,
      estaQuincenaUsd,
    };
  }, [debts, debtMetrics, pendingInstallments, convert, todayStr]);

  // Impacto en flujo: cuotas pendientes que vencen este mes vs ingresos del mes
  const flow = useMemo(() => {
    const ym = todayStr.slice(0, 7);
    const cuotasMesUsd = pendingInstallments
      .filter((p) => p.installment.fecha_vencimiento.startsWith(ym))
      .reduce(
        (sum, p) => sum + convert(p.installment.monto - (p.installment.monto_pagado || 0), p.debt.moneda, 'USD'),
        0
      );
    const ingresos = summary?.ingresos_mes_usd || 0;
    const pct = ingresos > 0 ? Math.min(100, (cuotasMesUsd / ingresos) * 100) : cuotasMesUsd > 0 ? 100 : 0;
    return {
      cuotasMesUsd,
      cuotasMesVes: convert(cuotasMesUsd, 'USD', 'VES'),
      pct,
      libre: Math.max(0, 100 - pct),
      hasIngresos: ingresos > 0,
    };
  }, [pendingInstallments, summary, convert, todayStr]);

  // Distribución por divisa del saldo pendiente
  const distribution = useMemo(() => {
    let usdOriginal = 0;
    let vesOriginal = 0;
    let usdEnUsd = 0;
    let vesEnUsd = 0;
    debts.forEach((debt) => {
      if (debt.estado !== 'activa') return;
      const saldo = debtMetrics.get(debt.id)!.saldoPendiente;
      if (debt.moneda === 'VES') {
        vesOriginal += saldo;
        vesEnUsd += convert(saldo, 'VES', 'USD');
      } else {
        const enUsd = convert(saldo, debt.moneda, 'USD');
        usdOriginal += enUsd;
        usdEnUsd += enUsd;
      }
    });
    const total = usdEnUsd + vesEnUsd;
    const pctUsd = total > 0 ? Math.round((usdEnUsd / total) * 100) : 0;
    return { usdOriginal, vesOriginal, pctUsd, pctVes: total > 0 ? 100 - pctUsd : 0 };
  }, [debts, debtMetrics, convert]);

  const upcoming = pendingInstallments.slice(0, 4);

  const filteredDebts = useMemo(
    () =>
      debts.filter((d) => {
        if (activeFilter === 'active') return d.estado === 'activa';
        if (activeFilter === 'completed') return d.estado === 'pagada';
        return true;
      }),
    [debts, activeFilter]
  );

  const openPay = (debt: Debt, installment: DebtInstallment) =>
    setPayModalState({ isOpen: true, debt, installment, isExtraPayment: false });

  const openExtra = (debt: Debt) =>
    setPayModalState({ isOpen: true, debt, installment: null, isExtraPayment: true });

  const handleDelete = async (debt: Debt) => {
    if (window.confirm(`¿Estás seguro de eliminar la deuda "${debt.nombre}" y todo su calendario de cuotas?`)) {
      await deleteDebt(debt.id);
    }
  };

  const pctPendiente = kpis.capitalUsd > 0 ? Math.round((kpis.pendienteUsd / kpis.capitalUsd) * 100) : 0;

  const filterTabs: { key: typeof activeFilter; label: string; count: number }[] = [
    { key: 'active', label: 'Activas', count: kpis.activas },
    { key: 'completed', label: 'Pagadas', count: kpis.pagadas },
    { key: 'all', label: 'Todas', count: debts.length },
  ];

  return (
    <div className={styles.container}>
      {/* Header */}
      <section className={styles.header}>
        <div>
          <h1 className={styles.title}>Deudas y Préstamos en Cuotas</h1>
          <p className={styles.subtitle}>
            Control de préstamos quincenales y mensuales con amortización y pagos en cuotas
          </p>
        </div>

        <div className={styles.headerRight}>
          <div className={cx(styles.syncBadge, styles.mono)}>
            <div className={styles.syncStatus}>
              <span className={cx(styles.syncDot, !isSupabaseMode && styles.syncDotLocal)} />
              <span>{isSupabaseMode ? 'Sincronizado Supabase Cloud' : 'Almacenamiento local'}</span>
            </div>
            <span className={styles.syncDivider}>|</span>
            <span className={styles.syncMonth}>{currentMonthYear}</span>
          </div>
          <button className={styles.btnNew} onClick={() => setIsDebtModalOpen(true)}>
            <Plus size={14} strokeWidth={2.5} />
            <span>Nueva Deuda / Préstamo</span>
          </button>
        </div>
      </section>

      {/* KPIs */}
      <section className={styles.kpiSection}>
        <div>
          <div className={styles.kpiLabel}>
            <span className={styles.dotEmerald} />
            <span>Deuda Total Pendiente</span>
          </div>
          <div className={styles.heroRow}>
            <span className={cx(styles.heroAmount, styles.mono)}>{formatCurrency(kpis.pendienteUsd, 'USD')}</span>
            <span className={cx(styles.heroSub, styles.mono)}>≈ {formatCurrency(kpis.pendienteVes, 'VES')}</span>
            <span className={cx(styles.tag, styles.tagEmerald, styles.mono)}>
              {kpis.activas} {kpis.activas === 1 ? 'Activo' : 'Activos'}
            </span>
          </div>
        </div>

        <div className={styles.kpiGrid}>
          <div className={styles.kpiItem}>
            <span className={styles.kpiItemLabel}>Próxima Cuota</span>
            <p className={cx(styles.kpiItemValue, styles.mono)}>
              {kpis.proxima
                ? formatCurrency(
                    kpis.proxima.installment.monto - (kpis.proxima.installment.monto_pagado || 0),
                    kpis.proxima.debt.moneda
                  )
                : '—'}
            </p>
            <p className={cx(styles.kpiItemSub, styles.mono)}>
              {kpis.proxima ? formatDisplayDate(kpis.proxima.installment.fecha_vencimiento) : 'Sin cuotas pendientes'}
            </p>
          </div>

          <div className={styles.kpiItem}>
            <span className={styles.kpiItemLabel}>Monto por Quincena</span>
            <p className={cx(styles.kpiItemValue, styles.mono)}>
              {formatCurrency(kpis.quincenalUsd, 'USD')}
            </p>
            <p
              className={cx(styles.kpiItemSub, styles.mono)}
              title={
                kpis.estaQuincenaUsd > 0
                  ? `Compromiso regular: ${formatCurrency(kpis.quincenalUsd, 'USD')} • Vence esta quincena: ${formatCurrency(kpis.estaQuincenaUsd, 'USD')}`
                  : undefined
              }
            >
              ≈ {formatCurrency(kpis.quincenalVes, 'VES')}
            </p>
          </div>

          <div className={styles.kpiItem}>
            <span className={styles.kpiItemLabel}>Cuotas Vencidas</span>
            <p className={cx(styles.kpiItemValue, styles.mono, kpis.vencidas > 0 ? styles.textRose : styles.textEmerald)}>
              {kpis.vencidas}
            </p>
            <p className={cx(styles.kpiItemSub, kpis.vencidas > 0 && styles.textRose)}>
              {kpis.vencidas > 0 ? 'Requieren pago inmediato' : 'Al día'}
            </p>
          </div>

          <div className={styles.kpiItem}>
            <span className={styles.kpiItemLabel}>Cuotas Restantes</span>
            <p className={cx(styles.kpiItemValue, styles.mono)}>
              {kpis.cuotasPendientes} <span className={styles.kpiItemTotal}>/ {kpis.cuotasTotal}</span>
            </p>
            <p className={cx(styles.kpiItemSub, styles.mono)}>
              {kpis.activas > 0
                ? `${kpis.activas} ${kpis.activas === 1 ? 'deuda activa' : 'deudas activas'}`
                : 'Sin compromisos'}
            </p>
          </div>

          <div className={styles.kpiItem}>
            <span className={styles.kpiItemLabel}>Capital Original</span>
            <p className={cx(styles.kpiItemValue, styles.kpiItemValueMuted, styles.mono)}>
              {formatCurrency(kpis.capitalUsd, 'USD')}
            </p>
            <p className={styles.kpiItemSub}>{pctPendiente}% pendiente</p>
          </div>
        </div>
      </section>

      {/* Filtros */}
      <div className={styles.filterBar}>
        <div className={styles.filterTabs}>
          {filterTabs.map((tab) => (
            <button
              key={tab.key}
              onClick={() => setActiveFilter(tab.key)}
              className={cx(styles.filterTab, activeFilter === tab.key && styles.filterTabActive)}
            >
              {activeFilter === tab.key && <span className={styles.filterDot} />}
              {tab.label} <span className={cx(styles.filterCount, styles.mono)}>({tab.count})</span>
            </button>
          ))}
        </div>
        <span className={cx(styles.filterMeta, styles.mono)}>
          {filteredDebts.length} {filteredDebts.length === 1 ? 'compromiso' : 'compromisos'}
        </span>
      </div>

      {/* Contenido */}
      <div className={styles.mainGrid}>
        {/* Columna izquierda */}
        <div className={styles.leftCol}>
          {filteredDebts.length === 0 && (
            <div className={styles.emptyState}>
              <div className={styles.cardIcon}>
                <CreditCard size={18} />
              </div>
              <h3 className={styles.emptyTitle}>
                {activeFilter === 'active' ? 'No tienes préstamos o deudas activas' : 'No hay deudas en esta categoría'}
              </h3>
              <p className={styles.emptyText}>
                Registra un préstamo o crédito con pagos en cuotas para llevar su amortización automática.
              </p>
              <button className={styles.btnNew} onClick={() => setIsDebtModalOpen(true)}>
                <Plus size={14} strokeWidth={2.5} />
                <span>Registrar Deuda</span>
              </button>
            </div>
          )}

          {filteredDebts.map((debt) => {
            const m = debtMetrics.get(debt.id)!;
            const isExpanded = expandedDebtId === debt.id;
            const isActive = debt.estado === 'activa';
            const equivalente =
              debt.moneda === 'VES'
                ? formatCurrency(convert(m.saldoPendiente, 'VES', 'USD'), 'USD')
                : formatCurrency(convert(m.saldoPendiente, debt.moneda, 'VES'), 'VES');
            const frecuencia = debt.frecuencia.charAt(0).toUpperCase() + debt.frecuencia.slice(1);

            return (
              <div key={debt.id} className={styles.card}>
                <div className={styles.cardTop}>
                  <div className={styles.cardIdentity}>
                    <div className={styles.cardIcon}>
                      <Landmark size={20} strokeWidth={1.8} />
                    </div>
                    <div>
                      <div className={styles.cardTitleRow}>
                        <h3 className={styles.cardTitle}>{debt.nombre}</h3>
                        <span className={cx(styles.tag, styles.tagSmall, styles.mono)}>{debt.moneda}</span>
                        {!isActive ? (
                          <span className={cx(styles.tag, styles.tagSmall, styles.tagEmerald, styles.mono)}>Saldada</span>
                        ) : m.cuotasVencidas > 0 ? (
                          <span className={cx(styles.tag, styles.tagSmall, styles.tagRose, styles.mono)}>
                            {m.cuotasVencidas} vencida{m.cuotasVencidas > 1 ? 's' : ''}
                          </span>
                        ) : null}
                      </div>
                      <p className={styles.cardMeta}>
                        {debt.acreedor} • {frecuencia} • {m.cuotasTotal} cuotas
                        {debt.tasa_interes > 0 ? ` • ${debt.tasa_interes}% ${debt.tipo_calculo}` : ' fijas'}
                      </p>
                    </div>
                  </div>
                  <div className={styles.cardAmountGroup}>
                    <div className={cx(styles.cardAmount, styles.mono)}>{formatCurrency(m.saldoPendiente, debt.moneda)}</div>
                    <div className={cx(styles.cardEquivalent, styles.mono)}>≈ {equivalente}</div>
                  </div>
                </div>

                <div className={styles.progressBlock}>
                  <div className={styles.progressRow}>
                    <span>
                      {m.cuotasPagadas} de {m.cuotasTotal} cuotas pagadas ({m.porcentajeProgreso}%)
                    </span>
                    <span className={cx(styles.progressRowValue, styles.mono)}>
                      {formatCurrency(m.totalPagado, debt.moneda)} de {formatCurrency(m.totalEsperado, debt.moneda)}
                    </span>
                  </div>
                  <div className={styles.track}>
                    <div className={styles.fill} style={{ width: `${Math.max(m.porcentajeProgreso, 2)}%` }} />
                  </div>
                </div>

                <div className={styles.cardFooter}>
                  <div className={cx(styles.footerInfo, styles.mono)}>
                    {m.proximaCuota && isActive ? (
                      <>
                        <span>
                          Próx:{' '}
                          <strong className={styles.footerStrong}>
                            {formatCurrency(m.proximaCuota.monto - (m.proximaCuota.monto_pagado || 0), debt.moneda)}
                          </strong>
                        </span>
                        <span className={styles.footerSep}>•</span>
                        <span>{formatDisplayDate(m.proximaCuota.fecha_vencimiento)}</span>
                      </>
                    ) : (
                      <span className={styles.textEmerald}>✓ Préstamo saldado</span>
                    )}
                  </div>
                  <div className={styles.footerActions}>
                    {m.proximaCuota && isActive && (
                      <button className={styles.btnPay} onClick={() => openPay(debt, m.proximaCuota!)}>
                        Pagar Cuota #{m.proximaCuota.numero}
                      </button>
                    )}
                    {isActive && (
                      <button className={styles.btnGhost} onClick={() => openExtra(debt)}>
                        Abonar
                      </button>
                    )}
                    <button className={styles.btnGhost} onClick={() => setExpandedDebtId(isExpanded ? null : debt.id)}>
                      Detalles {isExpanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                    </button>
                    <button className={styles.btnIcon} onClick={() => handleDelete(debt)} title="Eliminar deuda">
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>

                {isExpanded && (
                  <div className={styles.schedule}>
                    <div className={styles.scheduleHeader}>
                      <span className={styles.scheduleTitle}>Calendario de cuotas</span>
                      <span className={styles.mono}>{frecuencia}</span>
                    </div>
                    <div className={styles.tableWrap}>
                      <table className={styles.table}>
                        <thead>
                          <tr>
                            <th>#</th>
                            <th>Vencimiento</th>
                            <th className={styles.alignRight}>Cuota</th>
                            <th className={styles.alignRight}>Capital</th>
                            <th className={styles.alignRight}>Interés</th>
                            <th className={styles.alignCenter}>Estado</th>
                            <th className={styles.alignRight}></th>
                          </tr>
                        </thead>
                        <tbody>
                          {m.debtInstallments.map((inst) => {
                            const rel = relativeInfo(inst.fecha_vencimiento);
                            const isPending = inst.estado !== 'pagada';
                            return (
                              <tr key={inst.id} className={rel.isOverdue && isPending ? styles.rowOverdue : undefined}>
                                <td className={styles.cellMuted}>#{inst.numero}</td>
                                <td>
                                  <div>{formatDisplayDate(inst.fecha_vencimiento)}</div>
                                  {isPending && (
                                    <div
                                      className={cx(
                                        styles.cellSub,
                                        rel.isOverdue ? styles.textRose : rel.isUrgent && styles.textAmber
                                      )}
                                    >
                                      {rel.text}
                                    </div>
                                  )}
                                </td>
                                <td className={cx(styles.alignRight, styles.cellStrong)}>
                                  {formatCurrency(inst.monto, debt.moneda)}
                                  {inst.estado === 'parcial' && (
                                    <div className={cx(styles.cellSub, styles.textAmber)}>
                                      Resta {formatCurrency(inst.monto - inst.monto_pagado, debt.moneda)}
                                    </div>
                                  )}
                                </td>
                                <td className={styles.alignRight}>{formatCurrency(inst.monto_capital, debt.moneda)}</td>
                                <td className={styles.alignRight}>{formatCurrency(inst.monto_interes, debt.moneda)}</td>
                                <td className={styles.alignCenter}>
                                  {inst.estado === 'pagada' ? (
                                    <span className={cx(styles.status, styles.statusPaid)}>
                                      <CheckCircle2 size={11} /> Pagada
                                    </span>
                                  ) : inst.estado === 'parcial' ? (
                                    <span className={cx(styles.status, styles.statusPartial)}>
                                      <Clock size={11} /> Parcial
                                    </span>
                                  ) : rel.isOverdue ? (
                                    <span className={cx(styles.status, styles.statusOverdue)}>
                                      <AlertTriangle size={11} /> Vencida
                                    </span>
                                  ) : (
                                    <span className={styles.status}>Pendiente</span>
                                  )}
                                </td>
                                <td className={styles.alignRight}>
                                  {isPending && isActive ? (
                                    <button className={styles.btnPaySmall} onClick={() => openPay(debt, inst)}>
                                      Pagar
                                    </button>
                                  ) : (
                                    <span className={styles.cellMuted}>—</span>
                                  )}
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}
              </div>
            );
          })}

          <div className={styles.helper}>
            <Info size={16} />
            <span>Los intereses de cada cuota se calculan automáticamente con base en el saldo remanente.</span>
          </div>
        </div>

        {/* Columna derecha */}
        <div className={styles.rightCol}>
          {/* Impacto en flujo */}
          <div className={styles.sideCard}>
            <div className={styles.sideHeader}>
              <h3 className={styles.sideTitle}>Impacto en Flujo</h3>
              <span
                className={cx(
                  styles.sideMeta,
                  flow.pct > 50 ? styles.textRose : flow.pct > 30 ? styles.textAmber : styles.textEmerald
                )}
              >
                {flow.hasIngresos ? `${flow.pct.toFixed(1)}% ingresos` : 'Sin ingresos del mes'}
              </span>
            </div>
            <div className={styles.track}>
              <div
                className={cx(
                  styles.fill,
                  flow.pct > 50 ? styles.fillRose : flow.pct > 30 ? styles.fillAmber : styles.fillEmeraldLight
                )}
                style={{ width: `${flow.pct}%` }}
              />
            </div>
            <div className={cx(styles.sideRows, styles.mono)}>
              <div className={styles.sideRow}>
                <span>Cuotas del mes</span>
                <span className={styles.sideRowValue}>{formatCurrency(flow.cuotasMesUsd, 'USD')}</span>
              </div>
              <div className={styles.sideRow}>
                <span>Por quincena</span>
                <span className={styles.sideRowValue}>{formatCurrency(kpis.quincenalUsd, 'USD')}</span>
              </div>
              <div className={styles.sideRow}>
                <span>En Bolívares (mes)</span>
                <span className={styles.sideRowValueMuted}>{formatCurrency(flow.cuotasMesVes, 'VES')}</span>
              </div>
              <div className={styles.sideRow}>
                <span>Margen libre</span>
                <span className={cx(styles.sideRowValue, styles.textEmerald)}>{flow.libre.toFixed(1)}%</span>
              </div>
            </div>
          </div>

          {/* Distribución por divisa */}
          <div className={styles.sideCard}>
            <div className={styles.sideHeader}>
              <h3 className={styles.sideTitle}>Distribución por Divisa</h3>
              <span className={cx(styles.sideMeta, styles.mono)}>{formatCurrency(kpis.pendienteUsd, 'USD')}</span>
            </div>
            <div className={styles.track}>
              <div className={cx(styles.fill, styles.fillFlat)} style={{ width: `${distribution.pctUsd}%` }} />
              <div className={cx(styles.fill, styles.fillIndigo)} style={{ width: `${distribution.pctVes}%` }} />
            </div>
            <div className={styles.sideRows}>
              <div className={styles.sideRow}>
                <span className={styles.sideRowLabel}>
                  <span className={cx(styles.dot, styles.dotBgEmerald)} /> Dólares (USD)
                </span>
                <span className={cx(styles.sideRowValue, styles.mono)}>
                  {distribution.pctUsd}%{' '}
                  <span className={styles.sideRowExtra}>({formatCurrency(distribution.usdOriginal, 'USD')})</span>
                </span>
              </div>
              <div className={styles.sideRow}>
                <span className={styles.sideRowLabel}>
                  <span className={cx(styles.dot, styles.dotBgIndigo)} /> Bolívares (VES)
                </span>
                <span className={cx(styles.sideRowValue, styles.mono)}>
                  {distribution.pctVes}%{' '}
                  <span className={styles.sideRowExtra}>({formatCurrency(distribution.vesOriginal, 'VES')})</span>
                </span>
              </div>
            </div>
          </div>

          {/* Próximos vencimientos */}
          <div className={styles.sideCard}>
            <div className={styles.sideHeader}>
              <h3 className={styles.sideTitle}>Próximos Vencimientos</h3>
              <span className={cx(styles.sideMeta, styles.mono)}>
                {upcoming[0] ? formatDisplayDate(upcoming[0].installment.fecha_vencimiento, false) : 'Al día'}
              </span>
            </div>
            {upcoming.length === 0 ? (
              <div className={styles.sideEmpty}>No hay vencimientos pendientes</div>
            ) : (
              <div className={styles.upcomingList}>
                {upcoming.map((item, idx) => {
                  const rel = relativeInfo(item.installment.fecha_vencimiento);
                  return (
                    <div key={item.installment.id} className={cx(styles.upcomingItem, idx > 0 && styles.upcomingFaded)}>
                      <div className={styles.upcomingLeft}>
                        <span
                          className={cx(
                            styles.dot,
                            rel.isOverdue
                              ? styles.dotBgRose
                              : rel.isUrgent
                              ? styles.dotBgAmber
                              : idx === 0
                              ? styles.dotBgEmerald
                              : styles.dotBgMuted
                          )}
                        />
                        <span className={styles.upcomingName}>
                          Cuota #{item.installment.numero} • {item.debt.nombre}
                        </span>
                      </div>
                      <div className={cx(styles.upcomingRight, styles.mono)}>
                        <span className={styles.upcomingAmount}>
                          {formatCurrency(
                            item.installment.monto - (item.installment.monto_pagado || 0),
                            item.debt.moneda
                          )}
                        </span>
                        <span className={cx(styles.upcomingDays, rel.isOverdue && styles.textRose)}>{rel.text}</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>

      <DebtModal isOpen={isDebtModalOpen} onClose={() => setIsDebtModalOpen(false)} />

      <PayInstallmentModal
        isOpen={payModalState.isOpen}
        onClose={() => setPayModalState({ isOpen: false, debt: null, installment: null, isExtraPayment: false })}
        debt={payModalState.debt}
        installment={payModalState.installment}
        isExtraPayment={payModalState.isExtraPayment}
      />
    </div>
  );
};
