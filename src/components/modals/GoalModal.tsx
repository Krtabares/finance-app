'use client';

import React, { useState } from 'react';
import { X } from 'lucide-react';
import styles from './TransactionModal.module.css';
import { useFinance } from '@/context/FinanceContext';
import { Currency } from '@/types/finance';

interface GoalModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const GOAL_COLORS = ['#10b981', '#6366f1', '#f59e0b', '#06b6d4', '#ec4899', '#3b82f6'];

export const GoalModal: React.FC<GoalModalProps> = ({ isOpen, onClose }) => {
  const { addGoal } = useFinance();

  const [nombre, setNombre] = useState('');
  const [montoObjetivo, setMontoObjetivo] = useState('');
  const [montoActual, setMontoActual] = useState('0');
  const [moneda, setMoneda] = useState<Currency>('USD');
  const [fechaMeta, setFechaMeta] = useState('');
  const [color, setColor] = useState(GOAL_COLORS[0]);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const objNum = parseFloat(montoObjetivo);
    if (!nombre.trim() || isNaN(objNum) || objNum <= 0) {
      alert('Ingresa un nombre y un monto objetivo válido.');
      return;
    }

    await addGoal({
      nombre: nombre.trim(),
      monto_objetivo: objNum,
      monto_actual: parseFloat(montoActual) || 0,
      moneda,
      fecha_meta: fechaMeta || undefined,
      color,
      icono: 'Target',
    });

    setNombre('');
    setMontoObjetivo('');
    setMontoActual('0');
    setFechaMeta('');
    onClose();
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className={styles.modalCard} onClick={(e) => e.stopPropagation()}>
        <div className={styles.modalHeader}>
          <h3 className={styles.modalTitle}>Nueva Meta de Ahorro</h3>
          <button className={styles.modalClose} onClick={onClose}>
            <X size={20} />
          </button>
        </div>

        <form onSubmit={handleSubmit}>
          <div className={styles.formContent}>
            <div className={styles.fieldGroup}>
              <label className={styles.label}>Nombre del Objetivo</label>
              <input
                type="text"
                className="input-field"
                placeholder="Ej: Fondo de emergencia, Moto, Vacaciones..."
                value={nombre}
                onChange={(e) => setNombre(e.target.value)}
                required
                autoFocus
              />
            </div>

            <div className={styles.twoCols}>
              <div className={styles.fieldGroup}>
                <label className={styles.label}>Monto Objetivo</label>
                <input
                  type="number"
                  step="any"
                  placeholder="0.00"
                  className="input-field"
                  value={montoObjetivo}
                  onChange={(e) => setMontoObjetivo(e.target.value)}
                  required
                />
              </div>

              <div className={styles.fieldGroup}>
                <label className={styles.label}>Moneda</label>
                <select
                  className="input-field"
                  value={moneda}
                  onChange={(e) => setMoneda(e.target.value as Currency)}
                >
                  <option value="USD">Dólares (USD)</option>
                  <option value="USDT">Tether (USDT)</option>
                  <option value="VES">Bolívares (VES)</option>
                  <option value="EUR">Euros (EUR)</option>
                </select>
              </div>
            </div>

            <div className={styles.twoCols}>
              <div className={styles.fieldGroup}>
                <label className={styles.label}>Ahorro Inicial (Opcional)</label>
                <input
                  type="number"
                  step="any"
                  className="input-field"
                  placeholder="0.00"
                  value={montoActual}
                  onChange={(e) => setMontoActual(e.target.value)}
                />
              </div>

              <div className={styles.fieldGroup}>
                <label className={styles.label}>Fecha Límite Estimada</label>
                <input
                  type="date"
                  className="input-field"
                  value={fechaMeta}
                  onChange={(e) => setFechaMeta(e.target.value)}
                />
              </div>
            </div>

            <div className={styles.fieldGroup}>
              <label className={styles.label}>Color Distintivo</label>
              <div style={{ display: 'flex', gap: '8px', paddingTop: '4px' }}>
                {GOAL_COLORS.map((c) => (
                  <button
                    key={c}
                    type="button"
                    onClick={() => setColor(c)}
                    style={{
                      width: '32px',
                      height: '32px',
                      borderRadius: '50%',
                      backgroundColor: c,
                      border: color === c ? '3px solid #ffffff' : '2px solid transparent',
                      cursor: 'pointer',
                      transform: color === c ? 'scale(1.1)' : 'scale(1)',
                    }}
                  />
                ))}
              </div>
            </div>
          </div>

          <div className={styles.modalFooter}>
            <button type="button" className="btn-secondary" onClick={onClose}>
              Cancelar
            </button>
            <button type="submit" className="btn-primary">
              Crear Meta
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
