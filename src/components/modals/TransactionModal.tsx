'use client';

import React, { useState, useEffect } from 'react';
import { X, ArrowDownRight, ArrowUpRight, ArrowLeftRight, Calculator, RefreshCw } from 'lucide-react';
import styles from './TransactionModal.module.css';
import { useFinance } from '@/context/FinanceContext';
import { formatCurrency } from '@/lib/formatters';
import { Currency } from '@/types/finance';

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
    activeRateSource,
  } = useFinance();

  const [activeTab, setActiveTab] = useState<'gasto' | 'ingreso' | 'transfer'>('gasto');
  
  // Single transaction form state
  const [accountId, setAccountId] = useState('');
  const [categoryId, setCategoryId] = useState('');
  const [monedaMonto, setMonedaMonto] = useState<Currency>('VES');
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
      const defaultAcc = accounts[0];
      setAccountId(defaultAcc.id);
      setMonedaMonto(defaultAcc.moneda);
      setFromAccountId(defaultAcc.id);
      if (accounts.length > 1) {
        setToAccountId(accounts[1].id);
      }
    }
  }, [accounts, accountId]);

  const selectedAccount = accounts.find((a) => a.id === accountId);
  const accountMoneda = selectedAccount?.moneda || 'VES';

  // Active USD rate
  const usdRate = rates.find((r) => r.moneda === 'USD')?.tasa_a_ves || 450;

  // Rate to use based on input
  const defaultRate = (monedaMonto === 'EUR' || accountMoneda === 'EUR')
    ? (rates.find((r) => r.moneda === 'EUR')?.tasa_a_ves || usdRate * 1.08)
    : (monedaMonto === 'USDT' || accountMoneda === 'USDT')
    ? (rates.find((r) => r.moneda === 'USDT')?.tasa_a_ves || usdRate)
    : usdRate;

  useEffect(() => {
    setTasaPersonalizada(defaultRate.toString());
  }, [monedaMonto, accountMoneda, defaultRate]);

  if (!isOpen) return null;

  const numMonto = parseFloat(monto) || 0;
  const rateToUse = parseFloat(tasaPersonalizada) || defaultRate;

  // Monto en USD (guardado como ancla base) y en VES (calculado o directo)
  let montoEnUsd = 0;
  let montoEnVes = 0;
  let montoParaCuenta = numMonto;

  if (monedaMonto === 'USD' || monedaMonto === 'USDT') {
    montoEnUsd = numMonto;
    montoEnVes = numMonto * rateToUse;
  } else if (monedaMonto === 'VES') {
    montoEnVes = numMonto;
    montoEnUsd = rateToUse > 0 ? numMonto / rateToUse : 0;
  } else if (monedaMonto === 'EUR') {
    montoEnVes = numMonto * rateToUse;
    montoEnUsd = usdRate > 0 ? montoEnVes / usdRate : numMonto;
  }

  // Impacto sobre el saldo de la cuenta según su moneda nativa
  if (accountMoneda === monedaMonto) {
    montoParaCuenta = numMonto;
  } else if (accountMoneda === 'VES') {
    montoParaCuenta = montoEnVes;
  } else if (accountMoneda === 'USD' || accountMoneda === 'USDT') {
    montoParaCuenta = montoEnUsd;
  } else if (accountMoneda === 'EUR') {
    montoParaCuenta = rateToUse > 0 ? montoEnVes / rateToUse : numMonto;
  }

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

    // Build optional reference in note if currency conversion occurred
    let finalNota = nota.trim();
    if (monedaMonto !== accountMoneda) {
      const refText = `(Ref: ${formatCurrency(numMonto, monedaMonto)} @ Tasa ${rateToUse})`;
      finalNota = finalNota ? `${finalNota} ${refText}` : refText;
    }

    await addTransaction({
      account_id: accountId,
      category_id: categoryId || undefined,
      tipo: activeTab,
      monto: montoParaCuenta,
      moneda: accountMoneda,
      monto_usd: Math.round(montoEnUsd * 100) / 100,
      monto_ves: montoEnVes,
      tasa_cambio: rateToUse,
      fecha: new Date(fecha).toISOString(),
      nota: finalNota || undefined,
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
                  <label className={styles.label}>Cuenta a Afectar</label>
                  <select
                    className="input-field"
                    value={accountId}
                    onChange={(e) => {
                      const newAccId = e.target.value;
                      setAccountId(newAccId);
                      const acc = accounts.find((a) => a.id === newAccId);
                      if (acc) {
                        setMonedaMonto(acc.moneda);
                      }
                    }}
                    required
                  >
                    {accounts.map((acc) => (
                      <option key={acc.id} value={acc.id}>
                        {acc.nombre} ({acc.moneda}) — Saldo: {formatCurrency(acc.saldo_actual || 0, acc.moneda)}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Selector de Moneda de Entrada: USD o VES */}
                <div className={styles.fieldGroup}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <label className={styles.label}>Moneda del Monto a Ingresar</label>
                    <span style={{ fontSize: '0.72rem', color: 'var(--text-dim)' }}>
                      Cuenta en {accountMoneda}
                    </span>
                  </div>
                  <div
                    style={{
                      display: 'grid',
                      gridTemplateColumns: '1fr 1fr',
                      gap: '8px',
                      background: 'rgba(255, 255, 255, 0.04)',
                      padding: '4px',
                      borderRadius: 'var(--radius-md)',
                      border: '1px solid var(--border-subtle)',
                    }}
                  >
                    <button
                      type="button"
                      onClick={() => setMonedaMonto('USD')}
                      style={{
                        padding: '8px 12px',
                        borderRadius: 'var(--radius-sm)',
                        border: 'none',
                        background: monedaMonto === 'USD' ? 'var(--accent-emerald)' : 'transparent',
                        color: monedaMonto === 'USD' ? '#fff' : 'var(--text-muted)',
                        fontWeight: 700,
                        fontSize: '0.85rem',
                        cursor: 'pointer',
                        transition: 'all 0.15s ease',
                      }}
                    >
                      💵 En Dólares (USD)
                    </button>
                    <button
                      type="button"
                      onClick={() => setMonedaMonto('VES')}
                      style={{
                        padding: '8px 12px',
                        borderRadius: 'var(--radius-sm)',
                        border: 'none',
                        background: monedaMonto === 'VES' ? 'var(--accent-primary)' : 'transparent',
                        color: monedaMonto === 'VES' ? '#fff' : 'var(--text-muted)',
                        fontWeight: 700,
                        fontSize: '0.85rem',
                        cursor: 'pointer',
                        transition: 'all 0.15s ease',
                      }}
                    >
                      🇻🇪 En Bolívares (VES)
                    </button>
                  </div>
                </div>

                <div className={styles.fieldGroup}>
                  <label className={styles.label}>
                    Monto a Registrar ({monedaMonto})
                  </label>
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
                    <span className={styles.currencyTag}>{monedaMonto}</span>
                  </div>
                </div>

                {/* Mostrar tasa si hay conversión de moneda o cuenta en divisas */}
                {(monedaMonto !== 'VES' || accountMoneda !== 'VES') && (
                  <div className={styles.fieldGroup}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <label className={styles.label}>
                        Tasa de Cambio ({monedaMonto === 'USD' || accountMoneda === 'USD' ? 'USD a VES' : `${accountMoneda} a VES`})
                      </label>
                      <span style={{ fontSize: '0.72rem', color: 'var(--accent-emerald)', fontWeight: 600 }}>
                        Fuente: {activeRateSource}
                      </span>
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <input
                        type="number"
                        step="any"
                        className="input-field"
                        value={tasaPersonalizada}
                        onChange={(e) => setTasaPersonalizada(e.target.value)}
                        placeholder="Tasa en Bolívares"
                        required
                      />
                      <button
                        type="button"
                        className="btn-icon"
                        title="Restablecer a tasa del sistema"
                        onClick={() => setTasaPersonalizada(defaultRate.toString())}
                        style={{ padding: '8px' }}
                      >
                        <RefreshCw size={14} />
                      </button>
                    </div>

                    {numMonto > 0 && (
                      <div className={styles.vesPreview}>
                        <Calculator size={14} />
                        <div>
                          <div>
                            Se afectará en <strong>{selectedAccount?.nombre}</strong>:{' '}
                            <strong style={{ color: activeTab === 'gasto' ? 'var(--accent-rose)' : 'var(--accent-emerald)' }}>
                              {formatCurrency(montoParaCuenta, accountMoneda)}
                            </strong>
                          </div>
                          {monedaMonto !== 'VES' && accountMoneda === 'VES' && (
                            <div style={{ fontSize: '0.74rem', opacity: 0.85, marginTop: '2px' }}>
                              Equivalente ingresado: ${numMonto.toFixed(2)} USD a Bs. {rateToUse}
                            </div>
                          )}
                        </div>
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
                    placeholder="Ej: Mercado semanal, Pago de servicio, Almuerzo..."
                    value={nota}
                    onChange={(e) => setNota(e.target.value)}
                  />
                </div>
              </>
            ) : (
              /* Pestaña: Transferencia entre cuentas */
              <>
                <div className={styles.fieldGroup}>
                  <label className={styles.label}>Cuenta Origen (De)</label>
                  <select
                    className="input-field"
                    value={fromAccountId}
                    onChange={(e) => setFromAccountId(e.target.value)}
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
                  <label className={styles.label}>Cuenta Destino (Hacia)</label>
                  <select
                    className="input-field"
                    value={toAccountId}
                    onChange={(e) => setToAccountId(e.target.value)}
                    required
                  >
                    {accounts.map((acc) => (
                      <option key={acc.id} value={acc.id}>
                        {acc.nombre} ({acc.moneda}) — Saldo: {formatCurrency(acc.saldo_actual || 0, acc.moneda)}
                      </option>
                    ))}
                  </select>
                </div>

                <div className={styles.twoCols}>
                  <div className={styles.fieldGroup}>
                    <label className={styles.label}>Monto a Extraer</label>
                    <div className={styles.amountInputWrapper}>
                      <input
                        type="number"
                        step="any"
                        placeholder="0.00"
                        className="input-field"
                        value={montoOrigen}
                        onChange={(e) => {
                          setMontoOrigen(e.target.value);
                          const from = accounts.find((a) => a.id === fromAccountId);
                          const to = accounts.find((a) => a.id === toAccountId);
                          if (from && to && from.moneda === to.moneda) {
                            setMontoDestino(e.target.value);
                          } else if (from && to) {
                            const val = parseFloat(e.target.value) || 0;
                            const converted = convert(val, from.moneda, to.moneda);
                            setMontoDestino(converted > 0 ? converted.toFixed(2) : '');
                          }
                        }}
                        required
                      />
                      <span className={styles.currencyTag}>
                        {accounts.find((a) => a.id === fromAccountId)?.moneda || 'VES'}
                      </span>
                    </div>
                  </div>

                  <div className={styles.fieldGroup}>
                    <label className={styles.label}>Monto a Recibir</label>
                    <div className={styles.amountInputWrapper}>
                      <input
                        type="number"
                        step="any"
                        placeholder="0.00"
                        className="input-field"
                        value={montoDestino}
                        onChange={(e) => setMontoDestino(e.target.value)}
                        required
                      />
                      <span className={styles.currencyTag}>
                        {accounts.find((a) => a.id === toAccountId)?.moneda || 'VES'}
                      </span>
                    </div>
                  </div>
                </div>

                <div className={styles.fieldGroup}>
                  <label className={styles.label}>Nota de Transferencia</label>
                  <input
                    type="text"
                    className="input-field"
                    placeholder="Ej: Cambio a efectivo, Venta de USDT..."
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
              {activeTab === 'transfer' ? 'Realizar Transferencia' : 'Guardar Movimiento'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
