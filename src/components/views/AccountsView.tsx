'use client';

import React, { useState, useMemo } from 'react';
import { useFinance } from '@/context/FinanceContext';
import { formatCurrency } from '@/lib/formatters';
import { AccountModal } from '@/components/modals/AccountModal';
import { Account } from '@/types/finance';
import styles from './AccountsView.module.css';

interface AccountsViewProps {
  onOpenTransfer: () => void;
  onNavigateTab?: (tab: string) => void;
}

export const AccountsView: React.FC<AccountsViewProps> = ({
  onOpenTransfer,
  onNavigateTab,
}) => {
  const {
    accounts,
    transactions,
    deleteAccount,
    convert,
    rates,
    liveQuotes,
    activeRateSource,
    syncLiveRates,
    isSyncingRates,
  } = useFinance();

  const [isNewAccountModalOpen, setIsNewAccountModalOpen] = useState(false);
  const [selectedCurrencyFilter, setSelectedCurrencyFilter] = useState<string>('todas');
  const [isFilterOpen, setIsFilterOpen] = useState(false);

  // Icon mapping matching the template Material Symbols Outlined
  const getAccountIcon = (tipo: string) => {
    switch (tipo) {
      case 'banco':
        return 'account_balance';
      case 'efectivo':
        return 'lock';
      case 'cripto':
        return 'currency_bitcoin';
      case 'wallet_digital':
        return 'account_balance_wallet';
      default:
        return 'payments';
    }
  };

  const getAccountSubtitle = (acc: Account) => {
    if (acc.descripcion && acc.descripcion.trim()) {
      return `${acc.descripcion} · ${acc.moneda}`;
    }
    let label = 'Cuenta Bancaria';
    if (acc.tipo === 'banco') label = 'Cuenta Corriente';
    else if (acc.tipo === 'efectivo') label = 'Custodia / Bóveda';
    else if (acc.tipo === 'cripto') label = 'Billetera Cripto';
    else if (acc.tipo === 'wallet_digital') label = 'Billetera Digital';
    return `${label} · ${acc.moneda}`;
  };

  const handleDelete = async (acc: Account) => {
    if (
      confirm(
        `¿Estás seguro de eliminar la cuenta "${acc.nombre}"?\nEsta acción también eliminará sus transacciones asociadas.`
      )
    ) {
      await deleteAccount(acc.id);
    }
  };

  // Helper relative time
  const formatRelativeTime = (isoString?: string) => {
    if (!isoString) return 'Reciente';
    try {
      const d = new Date(isoString);
      if (isNaN(d.getTime())) return 'Reciente';
      const now = new Date();
      const isToday = d.toDateString() === now.toDateString();
      const yesterday = new Date(now);
      yesterday.setDate(now.getDate() - 1);
      const isYesterday = d.toDateString() === yesterday.toDateString();

      const timeStr = d.toLocaleTimeString('es-VE', { hour: '2-digit', minute: '2-digit' });

      if (isToday) return `Hoy, ${timeStr}`;
      if (isYesterday) return `Ayer, ${timeStr}`;
      return d.toLocaleDateString('es-VE', { day: 'numeric', month: 'short' });
    } catch {
      return 'Reciente';
    }
  };

  // Dynamic currency totals
  const totals = useMemo(() => {
    let usdTotal = 0;
    let vesTotal = 0;
    let usdtTotal = 0;
    let cashTotalUsd = 0;
    let eurTotal = 0;

    accounts.forEach((acc) => {
      const bal = acc.saldo_actual || 0;
      if (acc.moneda === 'USD') {
        usdTotal += bal;
      } else if (acc.moneda === 'VES') {
        vesTotal += bal;
      } else if (acc.moneda === 'USDT') {
        usdtTotal += bal;
      } else if (acc.moneda === 'EUR') {
        eurTotal += bal;
      }

      if (acc.tipo === 'efectivo') {
        const balInUsd = acc.saldo_en_usd ?? convert(bal, acc.moneda, 'USD');
        cashTotalUsd += balInUsd;
      }
    });

    const totalUsd = accounts.reduce((sum, acc) => {
      const balInUsd = acc.saldo_en_usd ?? convert(acc.saldo_actual || 0, acc.moneda, 'USD');
      return sum + balInUsd;
    }, 0);

    const totalVes = convert(totalUsd, 'USD', 'VES');

    return {
      usdTotal,
      vesTotal,
      usdtTotal,
      cashTotalUsd,
      eurTotal,
      totalUsd,
      totalVes,
    };
  }, [accounts, convert]);

  // Dynamic portfolio distribution weighting
  const portfolioDistribution = useMemo(() => {
    const total = totals.totalUsd;
    if (total <= 0) {
      return {
        usdPct: 0,
        vesPct: 0,
        usdtPct: 0,
        eurPct: 0,
        hardCurrencyPct: 100,
      };
    }

    const usdVal = totals.usdTotal;
    const vesVal = convert(totals.vesTotal, 'VES', 'USD');
    const usdtVal = convert(totals.usdtTotal, 'USDT', 'USD');
    const eurVal = convert(totals.eurTotal, 'EUR', 'USD');

    const usdPct = Math.round((usdVal / total) * 100);
    const vesPct = Math.round((vesVal / total) * 100);
    const usdtPct = Math.round((usdtVal / total) * 100);
    const eurPct = Math.max(0, 100 - (usdPct + vesPct + usdtPct));

    const hardCurrencyPct = Math.min(100, Math.max(0, 100 - vesPct));

    return {
      usdPct,
      vesPct,
      usdtPct,
      eurPct,
      hardCurrencyPct,
    };
  }, [totals, convert]);

  // Dynamic internal movements stream
  const internalTransfers = useMemo(() => {
    const list: Array<{
      id: string;
      fromName: string;
      toName: string;
      amountFormatted: string;
      note: string;
      time: string;
      amountClass: string;
    }> = [];

    // Filter incoming transfer transactions
    transactions.forEach((tx) => {
      if (tx.nota && tx.nota.includes('Transferencia recibida desde')) {
        const currentAcc = accounts.find((a) => a.id === tx.account_id);
        const match = tx.nota.match(/Transferencia recibida desde ([^(]+)(?:\((.*)\))?/);
        const fromName = match ? match[1].trim() : 'Cuenta Origen';
        const extraNote = match && match[2] ? match[2].trim() : 'Traspaso de fondos';

        let amountClass = styles.transferAmountUsd;
        if (tx.moneda === 'VES') amountClass = styles.transferAmountVes;
        else if (tx.moneda === 'USDT') amountClass = styles.transferAmountUsdt;

        list.push({
          id: tx.id,
          fromName,
          toName: currentAcc ? currentAcc.nombre : 'Cuenta Destino',
          amountFormatted: `+${formatCurrency(tx.monto, tx.moneda)}`,
          note: extraNote,
          time: formatRelativeTime(tx.fecha),
          amountClass,
        });
      }
    });

    return list.slice(0, 5);
  }, [transactions, accounts]);

  // Filter accounts
  const filteredAccounts = useMemo(() => {
    if (selectedCurrencyFilter === 'todas') return accounts;
    return accounts.filter((a) => a.moneda === selectedCurrencyFilter);
  }, [accounts, selectedCurrencyFilter]);

  const activeRateVal = useMemo(() => {
    if (activeRateSource === 'Paralelo' && liveQuotes?.paralelo) return liveQuotes.paralelo;
    if (activeRateSource === 'Binance P2P' && liveQuotes?.usdt_p2p) return liveQuotes.usdt_p2p;
    return liveQuotes?.bcv || rates.find((r) => r.moneda === 'USD')?.tasa_a_ves || 0;
  }, [activeRateSource, liveQuotes, rates]);

  const formatRate = (val: number) => {
    if (!val || val <= 0) return '---';
    return val.toLocaleString('es-VE', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  };

  return (
    <div className={styles.container}>
      {/* Ambient Micro-Gradient subtle background element */}
      <div className={styles.ambientGlow} />

      {/* Header Module: Ultra-sober typography, no heavy containers */}
      <section className={styles.headerSection}>
        <div className={styles.headerInfo}>
          <div>
            <div className={styles.badgeHeader}>
              <span className={styles.dotGreen} />
              <span className={styles.badgeText}>
                Patrimonio Líquido Consolidado
              </span>
            </div>
            <div className={styles.heroBalanceRow}>
              <h1 className={styles.heroBalanceTitle}>
                ${totals.totalUsd.toLocaleString('es-VE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}{' '}
                <span className={styles.heroBalanceUnit}>USD</span>
              </h1>
              <span className={styles.heroBalanceSub}>
                ≈ Bs. {totals.totalVes.toLocaleString('es-VE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </span>
            </div>
          </div>

          <div className={styles.currencyBar}>
            <div className={styles.currencyItem}>
              <span className={styles.currencyLabel}>USD</span>
              <span className={styles.currencyVal}>
                ${totals.usdTotal.toLocaleString('es-VE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </span>
            </div>
            <span className={styles.dotSeparator}>•</span>
            <div className={styles.currencyItem}>
              <span className={styles.currencyLabel}>VES</span>
              <span className={styles.currencyVal}>
                Bs. {totals.vesTotal.toLocaleString('es-VE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </span>
              <span className={styles.currencyEquivalent}>
                (${convert(totals.vesTotal, 'VES', 'USD').toLocaleString('es-VE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })})
              </span>
            </div>
            <span className={styles.dotSeparator}>•</span>
            <div className={styles.currencyItem}>
              <span className={styles.currencyLabel}>USDT</span>
              <span className={styles.currencyVal}>
                {totals.usdtTotal.toLocaleString('es-VE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </span>
              <span className={styles.currencyEquivalent}>
                (${convert(totals.usdtTotal, 'USDT', 'USD').toLocaleString('es-VE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })})
              </span>
            </div>
            <span className={styles.dotSeparator}>•</span>
            <div className={styles.currencyItem}>
              <span className={styles.currencyLabel}>Efectivo</span>
              <span className={styles.currencyVal}>
                ${totals.cashTotalUsd.toLocaleString('es-VE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </span>
            </div>
            {totals.eurTotal > 0 && (
              <>
                <span className={styles.dotSeparator}>•</span>
                <div className={styles.currencyItem}>
                  <span className={styles.currencyLabel}>EUR</span>
                  <span className={styles.currencyVal}>
                    €{totals.eurTotal.toLocaleString('es-VE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </span>
                </div>
              </>
            )}
          </div>
        </div>

        <div className={styles.headerActions}>
          <button onClick={onOpenTransfer} className={styles.btnTransfer}>
            <span className="material-symbols-outlined text-[16px] text-neutral-400">swap_horiz</span>
            <span>Transferir</span>
          </button>
          <button onClick={() => setIsNewAccountModalOpen(true)} className={styles.btnNewAccount}>
            <span className="material-symbols-outlined text-[16px]">add</span>
            <span>Nueva cuenta</span>
          </button>
        </div>
      </section>

      {/* Liquidity Distribution Bar (Fine and high precision) */}
      <section className={styles.distributionSection}>
        <div className={styles.distributionHeader}>
          <span className={styles.distributionTitle}>
            Ponderación de Portafolio{' '}
            <span className={styles.distributionSub}>
              · {portfolioDistribution.hardCurrencyPct}% moneda dura
            </span>
          </span>
          <span className={styles.distributionRight}>
            {accounts.length > 0 ? '100% cubierto' : 'Sin activos'}
          </span>
        </div>

        <div className={styles.progressBar}>
          {portfolioDistribution.usdPct > 0 && (
            <div
              className={styles.progressSegmentUsd}
              style={{ width: `${portfolioDistribution.usdPct}%` }}
              title={`USD ${portfolioDistribution.usdPct}%`}
            />
          )}
          {portfolioDistribution.vesPct > 0 && (
            <div
              className={styles.progressSegmentVes}
              style={{ width: `${portfolioDistribution.vesPct}%` }}
              title={`VES ${portfolioDistribution.vesPct}%`}
            />
          )}
          {portfolioDistribution.usdtPct > 0 && (
            <div
              className={styles.progressSegmentUsdt}
              style={{ width: `${portfolioDistribution.usdtPct}%` }}
              title={`USDT ${portfolioDistribution.usdtPct}%`}
            />
          )}
          {portfolioDistribution.eurPct > 0 && (
            <div
              className={styles.progressSegmentEur}
              style={{ width: `${portfolioDistribution.eurPct}%` }}
              title={`EUR ${portfolioDistribution.eurPct}%`}
            />
          )}
        </div>

        <div className={styles.distributionLegend}>
          <div className={styles.legendItem}>
            <span className="w-1.5 h-1.5 rounded-full bg-neutral-200"></span>
            <span>USD Dólares ({portfolioDistribution.usdPct}%)</span>
          </div>
          <div className={styles.legendItem}>
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500/80"></span>
            <span>VES Bolívares ({portfolioDistribution.vesPct}%)</span>
          </div>
          <div className={styles.legendItem}>
            <span className="w-1.5 h-1.5 rounded-full bg-sky-400/80"></span>
            <span>USDT Cripto ({portfolioDistribution.usdtPct}%)</span>
          </div>
          {portfolioDistribution.eurPct > 0 && (
            <div className={styles.legendItem}>
              <span className="w-1.5 h-1.5 rounded-full bg-amber-400/80"></span>
              <span>EUR ({portfolioDistribution.eurPct}%)</span>
            </div>
          )}
        </div>
      </section>

      {/* Main Grid: Accounts List (8 cols) & Live Transfer Stream (4 cols) */}
      <section className={styles.mainGrid}>
        {/* Active Accounts Column */}
        <div className={styles.leftColumn}>
          <div className={styles.columnHeader}>
            <div className={styles.columnTitleRow}>
              <span className={styles.columnTitle}>Cuentas Activas</span>
              <span className={styles.badgeCount}>
                {filteredAccounts.length} {filteredAccounts.length === 1 ? 'registro' : 'registros'}
              </span>
            </div>

            <div className={styles.columnActions}>
              <button
                onClick={() => setIsFilterOpen((prev) => !prev)}
                className={styles.iconBtn}
                title="Filtrar por moneda"
              >
                <span className="material-symbols-outlined text-[18px]">tune</span>
              </button>
              <button
                onClick={() => syncLiveRates()}
                disabled={isSyncingRates}
                className={styles.iconBtn}
                title="Actualizar tasas y saldos"
              >
                <span className={`material-symbols-outlined text-[18px] ${isSyncingRates ? 'animate-spin' : ''}`}>
                  refresh
                </span>
              </button>
            </div>
          </div>

          {/* Currency Filter Bar */}
          {isFilterOpen && (
            <div className={styles.filterBar}>
              <span style={{ color: '#737373', paddingRight: '4px' }}>Moneda:</span>
              {['todas', 'USD', 'VES', 'USDT', 'EUR'].map((curr) => (
                <button
                  key={curr}
                  onClick={() => setSelectedCurrencyFilter(curr)}
                  className={`${styles.filterPill} ${
                    selectedCurrencyFilter === curr ? styles.filterPillActive : ''
                  }`}
                >
                  {curr}
                </button>
              ))}
            </div>
          )}

          {/* Accounts Card List */}
          {filteredAccounts.length === 0 ? (
            <div style={{ padding: '36px', textAlign: 'center', borderRadius: '12px', border: '1px dashed rgba(255,255,255,0.1)', color: '#878a99' }}>
              <span className="material-symbols-outlined text-[32px] text-neutral-600" style={{ display: 'block', margin: '0 auto 8px' }}>
                account_balance_wallet
              </span>
              <p style={{ fontSize: '13px', marginBottom: '14px' }}>
                {accounts.length === 0
                  ? 'No tienes cuentas creadas todavía.'
                  : 'No se encontraron cuentas con el filtro seleccionado.'}
              </p>
              <button
                onClick={() => setIsNewAccountModalOpen(true)}
                className={styles.btnNewAccount}
                style={{ margin: '0 auto' }}
              >
                <span className="material-symbols-outlined text-[16px]">add</span>
                <span>Crear cuenta</span>
              </button>
            </div>
          ) : (
            <div className={styles.accountsCardList}>
              {filteredAccounts.map((acc) => {
                const bal = acc.saldo_actual || 0;
                let secondaryText = '';

                if (acc.moneda === 'VES') {
                  if (bal === 0) {
                    secondaryText = 'Sin fondos';
                  } else {
                    const inUsd = convert(bal, 'VES', 'USD');
                    secondaryText = `≈ $${inUsd.toLocaleString('es-VE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} USD`;
                  }
                } else if (acc.moneda === 'USD') {
                  const inVes = acc.saldo_en_ves ?? convert(bal, 'USD', 'VES');
                  secondaryText = `≈ Bs. ${inVes.toLocaleString('es-VE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
                } else if (acc.moneda === 'USDT') {
                  const inVes = acc.saldo_en_ves ?? convert(bal, 'USDT', 'VES');
                  secondaryText = `≈ Bs. ${inVes.toLocaleString('es-VE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
                } else if (acc.moneda === 'EUR') {
                  const inUsd = convert(bal, 'EUR', 'USD');
                  secondaryText = `≈ $${inUsd.toLocaleString('es-VE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} USD`;
                }

                return (
                  <div key={acc.id} className={styles.accountRow}>
                    <div className={styles.accountLeft}>
                      <div
                        className={styles.accountIconBox}
                        style={acc.color ? { borderLeft: `3px solid ${acc.color}` } : undefined}
                      >
                        <span className="material-symbols-outlined text-[18px]">
                          {getAccountIcon(acc.tipo)}
                        </span>
                      </div>
                      <div className={styles.accountTextGroup}>
                        <span className={styles.accountName}>
                          {acc.nombre}
                        </span>
                        <span className={styles.accountSubtitle}>
                          {getAccountSubtitle(acc)}
                        </span>
                      </div>
                    </div>

                    <div className={styles.accountRight}>
                      <div className={styles.accountAmountGroup}>
                        <div className={styles.accountAmount}>
                          {formatCurrency(bal, acc.moneda)}
                        </div>
                        <div className={styles.accountEquivalent}>
                          {secondaryText}
                        </div>
                      </div>

                      {/* Botón de eliminar con confirmación */}
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDelete(acc);
                        }}
                        className={styles.btnDeleteAccount}
                        title={`Eliminar cuenta ${acc.nombre}`}
                        aria-label={`Eliminar cuenta ${acc.nombre}`}
                      >
                        <span className="material-symbols-outlined text-[18px]">delete</span>
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* Quick Transfer Action Callout (Embedded Strip) */}
          <div className={styles.calloutStrip}>
            <div className={styles.calloutContent}>
              <span className={`material-symbols-outlined ${styles.calloutIcon}`}>
                info
              </span>
              <span className={styles.calloutText}>
                Los saldos en VES se actualizan automáticamente contra la tasa oficial {activeRateSource} del día
                (Bs. {formatRate(activeRateVal)}).
              </span>
            </div>
            <button
              onClick={() => {
                if (onNavigateTab) {
                  onNavigateTab('rates');
                } else {
                  syncLiveRates();
                }
              }}
              className={styles.calloutLink}
            >
              Ajustar parámetros
            </button>
          </div>
        </div>

        {/* Side Panel: Transferencias Recientes entre Cuentas */}
        <div className={styles.rightColumn}>
          <div className={styles.columnHeader}>
            <span className={styles.columnTitle}>Movimientos Internos</span>
            <button
              onClick={() => onNavigateTab && onNavigateTab('transactions')}
              className={styles.linkHistorial}
            >
              Historial
            </button>
          </div>

          <div className={styles.transfersCard}>
            {internalTransfers.length === 0 ? (
              <div style={{ padding: '24px 0', textAlign: 'center', fontSize: '12px', color: '#737373', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                <span className="material-symbols-outlined text-[24px]" style={{ color: '#525252', margin: '0 auto' }}>
                  sync_alt
                </span>
                <p>No hay traspasos internos registrados recientemente.</p>
                <p style={{ fontSize: '11px', color: '#525252' }}>
                  Usa el botón de abajo para registrar tu primer canje o traspaso entre billeteras.
                </p>
              </div>
            ) : (
              <div className={styles.transfersList}>
                {internalTransfers.map((item) => (
                  <div key={item.id} className={styles.transferItem}>
                    <div className={styles.transferTopRow}>
                      <div className={styles.transferPair}>
                        <span className={styles.transferFrom}>{item.fromName}</span>
                        <span className={`material-symbols-outlined ${styles.transferArrow}`}>
                          arrow_forward
                        </span>
                        <span className={styles.transferTo}>{item.toName}</span>
                      </div>
                      <span className={item.amountClass}>
                        {item.amountFormatted}
                      </span>
                    </div>
                    <div className={styles.transferBottomRow}>
                      <span style={{ textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap', paddingRight: '8px' }}>
                        {item.note}
                      </span>
                      <span style={{ flexShrink: 0 }}>{item.time}</span>
                    </div>
                  </div>
                ))}
              </div>
            )}

            <button onClick={onOpenTransfer} className={styles.btnInternalAction}>
              <span className="material-symbols-outlined text-[16px]">sync_alt</span>
              <span>Registrar canje o traspaso</span>
            </button>
          </div>
        </div>
      </section>

      {/* Modal para Crear Cuenta */}
      <AccountModal
        isOpen={isNewAccountModalOpen}
        onClose={() => setIsNewAccountModalOpen(false)}
      />
    </div>
  );
};
