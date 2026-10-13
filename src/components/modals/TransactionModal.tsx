'use client';

import React, { useState, useEffect } from 'react';
import { X, ArrowDownRight, ArrowUpRight, ArrowLeftRight, Calculator } from 'lucide-react';
import styles from './TransactionModal.module.css';
import { useFinance } from '@/context/FinanceContext';
import { formatCurrency } from '@/lib/formatters';

interface TransactionModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const TransactionModal: React.FC<TransactionModalProps> = ({ isOpen, onClose }) => {
  const {
    accounts,
    categories,
    rates,
    addTransaction,
    transferFunds,
    convert,
  } = useFinance();

  const [activeTab, setActiveTab] = useState<'gasto' | 'ingreso' | 'transfer'>('gasto');
  
  // Single transaction form state
  const [accountId, setAccountId] = useState('');
  const [categoryId, setCategoryId] = useState('');
  const [monto, setMonto] = useState('');
  const [tasaPersonalizada, setTasaPersonalizada] = useState('');
  const [fecha, setFecha] = useState('2026-10-13');
  const [nota, setNota] = useState('');

  // Transfer form state
  const [fromAccountId, setFromAccountId] = useState('');
  const [toAccountId, setToAccountId] = useState('');
  const [montoOrigen, setMontoOrigen] = useState('');
  const [montoDestino, setMontoDestino] = useState('');

  // Set default account and current date when mounted
  useEffect(() => {
    try {
      setFecha(new Date().toISOString().substring(0, 10));
    } catch {}
    if (accounts.length > 0 && !accountId) {
      setAccountId(accounts[0].id);
      setFromAccountId(accounts[0].id);
      if (accounts.length > 1) {
        setToAccountId(accounts[1].id);
      }
    }
  }, [accounts, accountId]);

  const selectedAccount = accounts.find((a) => a.id === accountId);
  const selectedMoneda = selectedAccount?.moneda || 'VES';

  // Get active rate for selected account currency
  const currentRate = rates.find((r) => r.moneda === selectedMoneda)?.tasa_a_ves || (selectedMoneda === 'VES' ? 1 : 450);

  // Update default custom rate when currency changes
  useEffect(() => {
    if (selectedMoneda !== 'VES') {
      setTasaPersonalizada(currentRate.toString());
    } else {
      setTasaPersonalizada('1');
    }
  }, [selectedMoneda, currentRate]);

  if (!isOpen) return null;

  // Calculate equivalent in VES
  const numMonto = parseFloat(monto) || 0;
  const rateToUse = selectedMoneda === 'VES' ? 1 : (parseFloat(tasaPersonalizada) || currentRate);
  const equivalenteVes = selectedMoneda === 'VES' ? numMonto : numMonto * rateToUse;

  // Filter categories by selected transaction type
  const filteredCategories = categories.filter((c) =>
    activeTab === 'transfer' ? true : c.tipo === activeTab
  );

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (activeTab === 'transfer') {
      const parsedOrigen = parseFloat(montoOrigen);
      const parsedDestino = parseFloat(montoDestino) || parsedOrigen;
      if (!fromAccountId || !toAccountId || isNaN(parsedOrigen) || parsedOrigen <= 0) {
        alert('Por favor completa todos los campos de la transferencia.');
        return;
      }
      if (fromAccountId === toAccountId) {
        alert('La cuenta de origen y destino deben ser distintas.');
        return;
      }
      await transferFunds(fromAccountId, toAccountId, parsedOrigen, parsedDestino, nota);
      onClose();
      return;
    }

    if (!selectedAccount || isNaN(numMonto) || numMonto <= 0) {
      alert('Por favor ingresa un monto válido y selecciona una cuenta.');
      return;
    }

    await addTransaction({
      account_id: accountId,
      category_id: categoryId || undefined,
      tipo: activeTab,
      monto: numMonto,
      moneda: selectedMoneda,
      monto_ves: equivalenteVes,
      tasa_cambio: rateToUse,
      fecha: new Date(fecha).toISOString(),
      nota: nota.trim() || undefined,
    });

    // Reset & close
    setMonto('');
    setNota('');
    onClose();
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className={styles.modalCard} onClick={(e) => e.stopPropagation()}>
        <div className={styles.modalHeader}>
          <h3 className={styles.modalTitle}>Registrar Movimiento</h3>
          <button className={styles.modalClose} onClick={onClose}>
            <X size={20} />
          </button>
        </div>

        {/* Tab switcher */}
        <div className={styles.tabsContainer}>
          <button
            type="button"
            className={`${styles.tabBtn} ${activeTab === 'gasto' ? styles.tabBtnGastoActive : ''}`}
            onClick={() => setActiveTab('gasto')}
          >
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
              <ArrowDownRight size={16} /> Gasto
            </span>
          </button>
          <button
            type="button"
            className={`${styles.tabBtn} ${activeTab === 'ingreso' ? styles.tabBtnIngresoActive : ''}`}
            onClick={() => setActiveTab('ingreso')}
          >
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
              <ArrowUpRight size={16} /> Ingreso
            </span>
          </button>
          <button
            type="button"
            className={`${styles.tabBtn} ${activeTab === 'transfer' ? styles.tabBtnTransferActive : ''}`}
            onClick={() => setActiveTab('transfer')}
          >
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
              <ArrowLeftRight size={16} /> Transferencia
            </span>
          </button>
        </div>

        <form onSubmit={handleSubmit}>
          <div className={styles.formContent}>
            {activeTab !== 'transfer' ? (
              <>
                <div className={styles.fieldGroup}>
                  <label className={styles.label}>Cuenta</label>
                  <select
                    className="input-field"
                    value={accountId}
                    onChange={(e) => setAccountId(e.target.value)}
                    required
                  >
                    {accounts.map((acc) => (
                      <option key={acc.id} value={acc.id}>
                        {acc.nombre} ({acc.moneda}) — Saldo: {formatCurrency(acc.saldo_actual || 0, acc.moneda)}
                      </option>
                    ))}
                  </select>
                </div>

                <div className={styles.fieldGroup}>
                  <label className={styles.label}>Monto</label>
                  <div className={styles.amountInputWrapper}>
                    <input
                      type="number"
                      step="any"
                      placeholder="0.00"
                      className="input-field"
                      value={monto}
                      onChange={(e) => setMonto(e.target.value)}
                      required
                      autoFocus
                    />
                    <span className={styles.currencyTag}>{selectedMoneda}</span>
                  </div>
                </div>

                {/* Si la cuenta está en divisa (USD, USDT, etc.), mostrar la tasa utilizada */}
                {selectedMoneda !== 'VES' && (
                  <div className={styles.fieldGroup}>
                    <label className={styles.label}>
                      Tasa de Cambio ({selectedMoneda} a VES)
                    </label>
                    <input
                      type="number"
                      step="any"
                      className="input-field"
                      value={tasaPersonalizada}
                      onChange={(e) => setTasaPersonalizada(e.target.value)}
                      placeholder="Tasa en Bolívares"
                      required
                    />
                    {numMonto > 0 && (
                      <div className={styles.vesPreview}>
                        <Calculator size={14} />
                        <span>
                          Equivalente en Bolívares: <strong>{formatCurrency(equivalenteVes, 'VES')}</strong>
                        </span>
                      </div>
                    )}
                  </div>
                )}

                <div className={styles.twoCols}>
                  <div className={styles.fieldGroup}>
                    <label className={styles.label}>Categoría</label>
                    <select
                      className="input-field"
                      value={categoryId}
                      onChange={(e) => setCategoryId(e.target.value)}
                    >
                      <option value="">Sin categoría</option>
                      {filteredCategories.map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.nombre}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className={styles.fieldGroup}>
                    <label className={styles.label}>Fecha</label>
                    <input
                      type="date"
                      className="input-field"
                      value={fecha}
                      onChange={(e) => setFecha(e.target.value)}
                      required
                    />
                  </div>
                </div>

                <div className={styles.fieldGroup}>
                  <label className={styles.label}>Descripción o Nota</label>
                  <input
                    type="text"
                    className="input-field"
                    placeholder="Ej: Mercado semanal, Pago Móvil cena..."
                    value={nota}
                    onChange={(e) => setNota(e.target.value)}
                  />
                </div>
              </>
            ) : (
              /* Pestaña de Transferencia entre Cuentas */
              <>
                <div className={styles.twoCols}>
                  <div className={styles.fieldGroup}>
                    <label className={styles.label}>Desde Cuenta</label>
                    <select
                      className="input-field"
                      value={fromAccountId}
                      onChange={(e) => setFromAccountId(e.target.value)}
                      required
                    >
                      {accounts.map((acc) => (
                        <option key={acc.id} value={acc.id}>
                          {acc.nombre} ({acc.moneda})
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className={styles.fieldGroup}>
                    <label className={styles.label}>Hacia Cuenta</label>
                    <select
                      className="input-field"
                      value={toAccountId}
                      onChange={(e) => setToAccountId(e.target.value)}
                      required
                    >
                      {accounts.map((acc) => (
                        <option key={acc.id} value={acc.id}>
                          {acc.nombre} ({acc.moneda})
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className={styles.twoCols}>
                  <div className={styles.fieldGroup}>
                    <label className={styles.label}>Monto a Enviar</label>
                    <input
                      type="number"
                      step="any"
                      placeholder="0.00"
                      className="input-field"
                      value={montoOrigen}
                      onChange={(e) => {
                        const val = e.target.value;
                        setMontoOrigen(val);
                        // Auto-calculate destination amount if accounts have different currencies
                        const fromAcc = accounts.find((a) => a.id === fromAccountId);
                        const toAcc = accounts.find((a) => a.id === toAccountId);
                        if (fromAcc && toAcc && parseFloat(val) > 0) {
                          const converted = convert(parseFloat(val), fromAcc.moneda, toAcc.moneda);
                          setMontoDestino(converted.toFixed(2));
                        }
                      }}
                      required
                    />
                  </div>

                  <div className={styles.fieldGroup}>
                    <label className={styles.label}>Monto a Recibir</label>
                    <input
                      type="number"
                      step="any"
                      placeholder="0.00"
                      className="input-field"
                      value={montoDestino}
                      onChange={(e) => setMontoDestino(e.target.value)}
                      required
                    />
                  </div>
                </div>

                <div className={styles.fieldGroup}>
                  <label className={styles.label}>Concepto / Detalle</label>
                  <input
                    type="text"
                    className="input-field"
                    placeholder="Ej: Cambio de USDT a Pago Móvil Banesco"
                    value={nota}
                    onChange={(e) => setNota(e.target.value)}
                  />
                </div>
              </>
            )}
          </div>

          <div className={styles.modalFooter}>
            <button type="button" className="btn-secondary" onClick={onClose}>
              Cancelar
            </button>
            <button type="submit" className="btn-primary">
              Guardar Movimiento
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
