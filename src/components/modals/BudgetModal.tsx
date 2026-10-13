'use client';

import React, { useState } from 'react';
import { X } from 'lucide-react';
import styles from './TransactionModal.module.css';
import { useFinance } from '@/context/FinanceContext';

interface BudgetModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const BudgetModal: React.FC<BudgetModalProps> = ({ isOpen, onClose }) => {
  const { categories, addBudget, budgets } = useFinance();

  const expenseCategories = categories.filter((c) => c.tipo === 'gasto');
  const existingCategoryIds = budgets.map((b) => b.category_id);
  const availableCategories = expenseCategories.filter((c) => !existingCategoryIds.includes(c.id));

  const [categoryId, setCategoryId] = useState(availableCategories[0]?.id || expenseCategories[0]?.id || '');
  const [montoLimite, setMontoLimite] = useState('');

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const lim = parseFloat(montoLimite);
    if (!categoryId || isNaN(lim) || lim <= 0) {
      alert('Selecciona una categoría e ingresa un límite válido en Bolívares (VES).');
      return;
    }

    const now = new Date();
    const currentMonthStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;

    await addBudget({
      category_id: categoryId,
      mes: currentMonthStr,
      monto_limite: lim,
    });

    setMontoLimite('');
    onClose();
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className={styles.modalCard} onClick={(e) => e.stopPropagation()}>
        <div className={styles.modalHeader}>
          <h3 className={styles.modalTitle}>Nuevo Presupuesto Mensual</h3>
          <button className={styles.modalClose} onClick={onClose}>
            <X size={20} />
          </button>
        </div>

        <form onSubmit={handleSubmit}>
          <div className={styles.formContent}>
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

            <div className={styles.fieldGroup}>
              <label className={styles.label}>Límite Mensual Máximo (VES)</label>
              <div className={styles.amountInputWrapper}>
                <input
                  type="number"
                  step="any"
                  placeholder="0.00"
                  className="input-field"
                  value={montoLimite}
                  onChange={(e) => setMontoLimite(e.target.value)}
                  required
                  autoFocus
                />
                <span className={styles.currencyTag}>VES (Bs.)</span>
              </div>
            </div>

            <p style={{ fontSize: '0.8rem', color: 'var(--text-dim)' }}>
              El presupuesto te alertará cuando tus gastos del mes en esta categoría se acerquen al 80% o superen el 100%.
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
