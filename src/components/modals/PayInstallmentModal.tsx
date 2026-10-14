'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { X, Wallet } from 'lucide-react';
import styles from './TransactionModal.module.css';
import debtStyles from './DebtModal.module.css';
import { useFinance } from '@/context/FinanceContext';
import { Debt, DebtInstallment } from '@/types/finance';
import { formatCurrency } from '@/lib/formatters';

interface PayInstallmentModalProps {
  isOpen: boolean;
  onClose: () => void;
  debt: Debt | null;
  installment: DebtInstallment | null;
  isExtraPayment?: boolean;
}

export const PayInstallmentModal: React.FC<PayInstallmentModalProps> = ({
  isOpen,
  onClose,
  debt,
  installment,
  isExtraPayment = false,
}) => {
  const { accounts, convert, payDebtInstallment, addDebtExtraPayment } = useFinance();

  const [accountId, setAccountId] = useState('');
  const [monto, setMonto] = useState('');
  const [nota, setNota] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  // Cuota pendiente por pagar en esta entrega
  const pendienteCuota = useMemo(() => {
    if (!installment) return 0;
    return Math.max(0, installment.monto - (installment.monto_pagado || 0));
  }, [installment]);

  useEffect(() => {
    if (isOpen && debt) {
      setErrorMsg('');
      if (isExtraPayment) {
        setMonto('');
      } else if (installment) {
        setMonto(pendienteCuota.toFixed(2));
      }
      // Selección de cuenta por defecto
      if (debt.account_id && accounts.some((a) => a.id === debt.account_id)) {
        setAccountId(debt.account_id);
      } else if (accounts.length > 0) {
        // Preferir cuenta en la misma moneda que la deuda si existe
        const sameCurrencyAcc = accounts.find((a) => a.moneda === debt.moneda);
        setAccountId(sameCurrencyAcc ? sameCurrencyAcc.id : accounts[0].id);
      }
    }
  }, [isOpen, debt, installment, isExtraPayment, accounts, pendienteCuota]);

  const selectedAccount = useMemo(() => {
    return accounts.find((a) => a.id === accountId);
  }, [accounts, accountId]);

  const numMonto = parseFloat(monto) || 0;

  // Conversión y débito en cuenta
  const conversionInfo = useMemo(() => {
    if (!debt || !selectedAccount || numMonto <= 0) return null;

    const debtCurr = debt.moneda;
    const accCurr = selectedAccount.moneda;

    if (debtCurr === accCurr) {
      return {
        montoDebito: numMonto,
        moneda: accCurr,
        requiresConversion: false,
        tasa: 1,
      };
    }

    const montoEnMonedaCuenta = convert(numMonto, debtCurr, accCurr);
    const tasaEfectiva = numMonto > 0 ? montoEnMonedaCuenta / numMonto : 1;

    return {
      montoDebito: montoEnMonedaCuenta,
      moneda: accCurr,
      requiresConversion: true,
      tasa: tasaEfectiva,
    };
  }, [debt, selectedAccount, numMonto, convert]);

  if (!isOpen || !debt) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (numMonto <= 0) {
      setErrorMsg('Por favor ingresa un monto válido mayor a 0');
      return;
    }
    if (!accountId) {
      setErrorMsg('Debes seleccionar una cuenta para debitar los fondos');
      return;
    }

    try {
      setIsSubmitting(true);
      setErrorMsg('');

      if (isExtraPayment) {
        await addDebtExtraPayment(debt.id, numMonto, accountId, nota.trim() || undefined);
      } else if (installment) {
        await payDebtInstallment(installment.id, numMonto, accountId, nota.trim() || undefined);
      }

      onClose();
    } catch (err: any) {
      setErrorMsg(err.message || 'Error al procesar el pago');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className={styles.modalCard} style={{ maxWidth: '500px' }} onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className={styles.modalHeader}>
          <div>
            <h3 className={styles.modalTitle}>
              {isExtraPayment ? 'Abono Extra a Capital' : `Pagar Cuota #${installment?.numero || ''}`}
            </h3>
            <p className={debtStyles.subtitle}>
              {debt.nombre} • Acreedor: {debt.acreedor}
            </p>
          </div>
          <button type="button" className={styles.modalClose} onClick={onClose}>
            <X size={20} />
          </button>
        </div>

        {/* Content Body */}
        <form onSubmit={handleSubmit}>
          <div className={styles.formContent}>
            {errorMsg && <div className={debtStyles.error}>{errorMsg}</div>}

            {/* Información de la Cuota si no es abono extra */}
            {!isExtraPayment && installment && (
              <div className={debtStyles.infoBox}>
                <div>
                  <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                    Cuota programada #{installment.numero}
                  </span>
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-dim)', marginTop: '2px' }}>
                    Vence: <strong style={{ color: 'var(--text-main)' }}>{installment.fecha_vencimiento}</strong>
                  </div>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <div className={debtStyles.infoValue}>
                    {formatCurrency(installment.monto, debt.moneda)}
                  </div>
                  {installment.monto_pagado > 0 && (
                    <div className={debtStyles.infoSub}>
                      Abonado: {formatCurrency(installment.monto_pagado, debt.moneda)}
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Monto a Pagar */}
            <div className={styles.fieldGroup}>
              <div className={debtStyles.labelRow}>
                <label className={styles.label}>
                  {isExtraPayment ? 'Monto a Amortizar a Capital' : 'Monto a Pagar en esta Cuota'}
                </label>
                {!isExtraPayment && pendienteCuota > 0 && (
                  <button
                    type="button"
                    onClick={() => setMonto(pendienteCuota.toFixed(2))}
                    className={debtStyles.linkBtn}
                  >
                    Pagar total ({pendienteCuota.toFixed(2)} {debt.moneda})
                  </button>
                )}
              </div>
              <div className={debtStyles.suffixWrapper}>
                <input
                  type="number"
                  step="0.01"
                  min="0.01"
                  className="input-field"
                  placeholder="0.00"
                  value={monto}
                  onChange={(e) => setMonto(e.target.value)}
                  required
                  autoFocus
                />
                <span className={debtStyles.suffix}>{debt.moneda}</span>
              </div>
              <span className={debtStyles.hint}>
                {isExtraPayment
                  ? 'El abono reducirá directamente el saldo de capital adeudado.'
                  : 'Puedes ingresar el monto exacto o un pago parcial.'}
              </span>
            </div>

            {/* Cuenta de débito */}
            <div className={styles.fieldGroup}>
              <label className={styles.label}>Cuenta desde donde se debitará</label>
              <select
                className="input-field"
                value={accountId}
                onChange={(e) => setAccountId(e.target.value)}
                required
              >
                <option value="">Seleccionar cuenta...</option>
                {accounts.map((acc) => (
                  <option key={acc.id} value={acc.id}>
                    {acc.nombre} ({acc.moneda}) • Saldo: {formatCurrency(acc.saldo_actual || 0, acc.moneda)}
                  </option>
                ))}
              </select>
            </div>

            {/* Preview de Conversión si la moneda difiere */}
            {conversionInfo && conversionInfo.requiresConversion && (
              <div className={debtStyles.infoBox}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <Wallet size={16} color="var(--accent-primary)" />
                  <span style={{ fontSize: '0.78rem' }}>Débito estimado en cuenta:</span>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <div className={debtStyles.infoValue}>
                    {formatCurrency(conversionInfo.montoDebito, conversionInfo.moneda)}
                  </div>
                  <div style={{ fontSize: '0.72rem', color: 'var(--text-dim)' }}>
                    1 {debt.moneda} = {conversionInfo.tasa.toLocaleString('es-VE', { minimumFractionDigits: 2, maximumFractionDigits: 4 })} {conversionInfo.moneda}
                  </div>
                </div>
              </div>
            )}

            {/* Nota */}
            <div className={styles.fieldGroup}>
              <label className={styles.label}>Nota o Referencia (Opcional)</label>
              <input
                type="text"
                className="input-field"
                placeholder="Ej: Pago móvil #492819"
                value={nota}
                onChange={(e) => setNota(e.target.value)}
              />
            </div>
          </div>

          <div className={styles.modalFooter}>
            <button type="button" className="btn-secondary" onClick={onClose} disabled={isSubmitting}>
              Cancelar
            </button>
            <button type="submit" className="btn-primary" disabled={isSubmitting || numMonto <= 0}>
              {isSubmitting ? 'Registrando...' : 'Confirmar y Pagar'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
