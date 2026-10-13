'use client';

import React, { useState } from 'react';
import { X, PlusCircle, MinusCircle } from 'lucide-react';
import styles from './TransactionModal.module.css';
import { useFinance } from '@/context/FinanceContext';
import { SavingsGoal } from '@/types/finance';
import { formatCurrency } from '@/lib/formatters';

interface DepositGoalModalProps {
  goal: SavingsGoal | null;
  onClose: () => void;
}

export const DepositGoalModal: React.FC<DepositGoalModalProps> = ({ goal, onClose }) => {
  const { updateGoalProgress } = useFinance();
  const [monto, setMonto] = useState('');
  const [esRetiro, setEsRetiro] = useState(false);

  if (!goal) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const val = parseFloat(monto);
    if (isNaN(val) || val <= 0) {
      alert('Ingresa un monto válido.');
      return;
    }

    const delta = esRetiro ? -val : val;
    await updateGoalProgress(goal.id, delta);
    setMonto('');
    onClose();
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className={styles.modalCard} onClick={(e) => e.stopPropagation()}>
        <div className={styles.modalHeader}>
          <h3 className={styles.modalTitle}>
            {esRetiro ? 'Retirar de' : 'Abonar a'}: {goal.nombre}
          </h3>
          <button className={styles.modalClose} onClick={onClose}>
            <X size={20} />
          </button>
        </div>

        <form onSubmit={handleSubmit}>
          <div className={styles.formContent}>
            <div style={{ display: 'flex', gap: '8px', marginBottom: '8px' }}>
              <button
                type="button"
                className={`btn-secondary ${!esRetiro ? 'badge-emerald' : ''}`}
                style={{ flex: 1, padding: '10px' }}
                onClick={() => setEsRetiro(false)}
              >
                <PlusCircle size={16} /> Sumar Ahorro
              </button>
              <button
                type="button"
                className={`btn-secondary ${esRetiro ? 'badge-rose' : ''}`}
                style={{ flex: 1, padding: '10px' }}
                onClick={() => setEsRetiro(true)}
              >
                <MinusCircle size={16} /> Retirar Fondos
              </button>
            </div>

            <div className={styles.fieldGroup}>
              <label className={styles.label}>
                Monto a {esRetiro ? 'retirar' : 'abonar'} ({goal.moneda})
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
                <span className={styles.currencyTag}>{goal.moneda}</span>
              </div>
            </div>

            <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
              Ahorro actual: <strong>{formatCurrency(goal.monto_actual, goal.moneda)}</strong> de{' '}
              {formatCurrency(goal.monto_objetivo, goal.moneda)}
            </p>
          </div>

          <div className={styles.modalFooter}>
            <button type="button" className="btn-secondary" onClick={onClose}>
              Cancelar
            </button>
            <button type="submit" className="btn-primary">
              Confirmar {esRetiro ? 'Retiro' : 'Abono'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
