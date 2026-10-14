'use client';

import React, { useState, useEffect } from 'react';
import { X, DollarSign, ShieldCheck, Sparkles } from 'lucide-react';
import styles from './TransactionModal.module.css';
import { useFinance } from '@/context/FinanceContext';
import { Currency } from '@/types/finance';
import { isCategoryFixed, setStoredFixedOverride } from '@/lib/commitments';

interface BudgetModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const BudgetModal: React.FC<BudgetModalProps> = ({ isOpen, onClose }) => {
  const { categories, addBudget, budgets, rates, preferredViewCurrency } = useFinance();

  const expenseCategories = categories.filter((c) => c.tipo === 'gasto');
  const existingCategoryIds = budgets.map((b) => b.category_id);
  const availableCategories = expenseCategories.filter((c) => !existingCategoryIds.includes(c.id));

  // Default currency based on preferredViewCurrency
  const [moneda, setMoneda] = useState<Currency>(preferredViewCurrency === 'USD' ? 'USD' : 'USD');
  const [categoryId, setCategoryId] = useState(availableCategories[0]?.id || expenseCategories[0]?.id || '');
  const [montoLimite, setMontoLimite] = useState('');
  const [esFijo, setEsFijo] = useState<boolean>(true);
  
  // Rate handling (usada internamente para registrar la equivalencia en VES)
  const activeUsdRate = rates.find((r) => r.moneda === 'USD')?.tasa_a_ves || 450;

  useEffect(() => {
    if (availableCategories.length > 0 && !existingCategoryIds.includes(categoryId)) {
      setCategoryId(availableCategories[0].id);
    }
  }, [isOpen, availableCategories]);

  // Actualizar si es fijo o variable según la categoría seleccionada
  useEffect(() => {
    if (categoryId) {
      const selected = categories.find((c) => c.id === categoryId);
      setEsFijo(isCategoryFixed(selected));
    }
  }, [categoryId, categories]);

  if (!isOpen) return null;

  const numMonto = parseFloat(montoLimite) || 0;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!categoryId || isNaN(numMonto) || numMonto <= 0) {
      alert(`Selecciona una categoría e ingresa un límite mensual válido mayor a 0.`);
      return;
    }

    const now = new Date();
    const currentMonthStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;

    // Guardar preferencia de Fijo vs Variable
    setStoredFixedOverride(categoryId, esFijo);

    // Guardamos siempre en USD como valor base, y se calcula en BS a la tasa activa
    const limiteEnUsd = moneda === 'VES'
      ? (activeUsdRate > 0 ? numMonto / activeUsdRate : numMonto)
      : numMonto;

    await addBudget({
      category_id: categoryId,
      mes: currentMonthStr,
      monto_limite: Math.round(limiteEnUsd * 100) / 100,
      moneda,
      monto_original: numMonto,
      tasa_cambio: activeUsdRate,
      tipo_gasto: esFijo ? 'fijo' : 'variable',
    });

    setMontoLimite('');
    onClose();
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className={styles.modalCard} onClick={(e) => e.stopPropagation()}>
        <div className={styles.modalHeader}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <div
              style={{
                width: '32px',
                height: '32px',
                borderRadius: '8px',
                background: 'rgba(16, 185, 129, 0.15)',
                color: 'var(--accent-emerald)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <DollarSign size={18} />
            </div>
            <h3 className={styles.modalTitle}>Nuevo Presupuesto Mensual</h3>
          </div>
          <button className={styles.modalClose} onClick={onClose}>
            <X size={20} />
          </button>
        </div>

        <form onSubmit={handleSubmit}>
          <div className={styles.formContent}>
            {/* Selector de Moneda */}
            <div className={styles.fieldGroup}>
              <label className={styles.label}>Moneda del Presupuesto</label>
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
                  onClick={() => setMoneda('USD')}
                  style={{
                    padding: '8px 12px',
                    borderRadius: 'var(--radius-sm)',
                    border: 'none',
                    background: moneda === 'USD' ? 'var(--accent-emerald)' : 'transparent',
                    color: moneda === 'USD' ? '#fff' : 'var(--text-muted)',
                    fontWeight: 700,
                    fontSize: '0.85rem',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '6px',
                    transition: 'all 0.15s ease',
                  }}
                >
                  💵 Dólares (USD)
                </button>
                <button
                  type="button"
                  onClick={() => setMoneda('VES')}
                  style={{
                    padding: '8px 12px',
                    borderRadius: 'var(--radius-sm)',
                    border: 'none',
                    background: moneda === 'VES' ? 'var(--accent-primary)' : 'transparent',
                    color: moneda === 'VES' ? '#fff' : 'var(--text-muted)',
                    fontWeight: 700,
                    fontSize: '0.85rem',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '6px',
                    transition: 'all 0.15s ease',
                  }}
                >
                  🇻🇪 Bolívares (VES)
                </button>
              </div>
            </div>

            {/* Categoría */}
            <div className={styles.fieldGroup}>
              <label className={styles.label}>Categoría de Gasto</label>
              <select
                className="input-field"
                value={categoryId}
                onChange={(e) => setCategoryId(e.target.value)}
                required
              >
                {expenseCategories.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.nombre} {existingCategoryIds.includes(c.id) ? '(Ya presupuestada)' : ''}
                  </option>
                ))}
              </select>
            </div>

            {/* Naturaleza del Gasto (Fijo vs Variable) */}
            <div className={styles.fieldGroup}>
              <label className={styles.label}>Naturaleza de este Gasto</label>
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: '1fr 1fr',
                  gap: '8px',
                  background: 'rgba(255, 255, 255, 0.03)',
                  padding: '4px',
                  borderRadius: 'var(--radius-md)',
                  border: '1px solid var(--border-color)',
                }}
              >
                <button
                  type="button"
                  onClick={() => setEsFijo(true)}
                  style={{
                    padding: '8px 10px',
                    borderRadius: 'var(--radius-sm)',
                    border: 'none',
                    background: esFijo ? 'rgba(59, 130, 246, 0.2)' : 'transparent',
                    borderWidth: '1px',
                    borderStyle: 'solid',
                    borderColor: esFijo ? 'rgba(59, 130, 246, 0.5)' : 'transparent',
                    color: esFijo ? '#60a5fa' : 'var(--text-muted)',
                    fontWeight: 600,
                    fontSize: '0.8rem',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '6px',
                    transition: 'all 0.15s ease',
                  }}
                >
                  <ShieldCheck size={14} />
                  Fijo / Obligatorio
                </button>
                <button
                  type="button"
                  onClick={() => setEsFijo(false)}
                  style={{
                    padding: '8px 10px',
                    borderRadius: 'var(--radius-sm)',
                    border: 'none',
                    background: !esFijo ? 'rgba(16, 185, 129, 0.2)' : 'transparent',
                    borderWidth: '1px',
                    borderStyle: 'solid',
                    borderColor: !esFijo ? 'rgba(16, 185, 129, 0.5)' : 'transparent',
                    color: !esFijo ? '#34d399' : 'var(--text-muted)',
                    fontWeight: 600,
                    fontSize: '0.8rem',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '6px',
                    transition: 'all 0.15s ease',
                  }}
                >
                  <Sparkles size={14} />
                  Variable / Flexible
                </button>
              </div>
              <div style={{ fontSize: '0.72rem', color: 'var(--text-dim)', marginTop: '4px' }}>
                {esFijo
                  ? '🔒 Se apartará de tu dinero disponible como un compromiso obligatorio del mes (ej. Alquiler, Servicios, Condominio).'
                  : '🔄 Se considerará dinero libre para tus gastos cotidianos (ej. Comida, Ocio, Compras).'}
              </div>
            </div>

            {/* Monto */}
            <div className={styles.fieldGroup}>
              <label className={styles.label}>
                {moneda === 'USD' ? 'Límite Mensual en Dólares ($)' : 'Límite Mensual en Bolívares (Bs.)'}
              </label>
              <div className={styles.amountInputWrapper}>
                <input
                  type="number"
                  step="any"
                  placeholder={moneda === 'USD' ? 'Ej: 150.00' : 'Ej: 45000.00'}
                  className="input-field"
                  value={montoLimite}
                  onChange={(e) => setMontoLimite(e.target.value)}
                  required
                  autoFocus
                />
                <span className={styles.currencyTag}>
                  {moneda === 'USD' ? 'USD ($)' : 'VES (Bs.)'}
                </span>
              </div>
              {numMonto > 0 && (
                <div style={{ fontSize: '0.78rem', color: 'var(--accent-emerald)', marginTop: '6px' }}>
                  {moneda === 'USD'
                    ? `≈ Bs. ${(numMonto * activeUsdRate).toLocaleString('es-VE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} en Bolívares (Tasa: ${activeUsdRate})`
                    : `≈ $${(activeUsdRate > 0 ? numMonto / activeUsdRate : 0).toFixed(2)} USD valor base (Tasa: ${activeUsdRate})`}
                </div>
              )}
            </div>

            <p style={{ fontSize: '0.78rem', color: 'var(--text-dim)', lineHeight: 1.4 }}>
              💡 Los presupuestos se protegen guardando su valor base en <strong>USD</strong> y calculando su límite en bolívares según la tasa vigente, evitando que la inflación distorsione tus metas de gasto.
            </p>
          </div>

          <div className={styles.modalFooter}>
            <button type="button" className="btn-secondary" onClick={onClose}>
              Cancelar
            </button>
            <button type="submit" className="btn-primary">
              Guardar Presupuesto
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
