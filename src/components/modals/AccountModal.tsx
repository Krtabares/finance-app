'use client';

import React, { useState } from 'react';
import { X } from 'lucide-react';
import styles from './TransactionModal.module.css';
import { useFinance } from '@/context/FinanceContext';
import { AccountType, Currency } from '@/types/finance';

interface AccountModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const COLOR_OPTIONS = [
  '#059669', // Emerald
  '#3b82f6', // Blue
  '#8b5cf6', // Purple
  '#f59e0b', // Amber
  '#ec4899', // Pink
  '#06b6d4', // Cyan
  '#ef4444', // Red
  '#64748b', // Slate
];

export const AccountModal: React.FC<AccountModalProps> = ({ isOpen, onClose }) => {
  const { addAccount } = useFinance();

  const [nombre, setNombre] = useState('');
  const [tipo, setTipo] = useState<AccountType>('banco');
  const [moneda, setMoneda] = useState<Currency>('VES');
  const [saldoInicial, setSaldoInicial] = useState('');
  const [color, setColor] = useState(COLOR_OPTIONS[0]);
  const [descripcion, setDescripcion] = useState('');

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!nombre.trim()) {
      alert('Ingresa el nombre de la cuenta');
      return;
    }

    await addAccount({
      nombre: nombre.trim(),
      tipo,
      moneda,
      saldo_inicial: parseFloat(saldoInicial) || 0,
      color,
      descripcion: descripcion.trim() || undefined,
      activo: true,
    });

    setNombre('');
    setSaldoInicial('');
    setDescripcion('');
    onClose();
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className={styles.modalCard} onClick={(e) => e.stopPropagation()}>
        <div className={styles.modalHeader}>
          <h3 className={styles.modalTitle}>Crear Nueva Cuenta</h3>
          <button className={styles.modalClose} onClick={onClose}>
            <X size={20} />
          </button>
        </div>

        <form onSubmit={handleSubmit}>
          <div className={styles.formContent}>
            <div className={styles.fieldGroup}>
              <label className={styles.label}>Nombre de la Cuenta</label>
              <input
                type="text"
                className="input-field"
                placeholder="Ej: Banco Mercantil, Binance USDT, Billetera USD..."
                value={nombre}
                onChange={(e) => setNombre(e.target.value)}
                required
                autoFocus
              />
            </div>

            <div className={styles.twoCols}>
              <div className={styles.fieldGroup}>
                <label className={styles.label}>Tipo de Cuenta</label>
                <select
                  className="input-field"
                  value={tipo}
                  onChange={(e) => setTipo(e.target.value as AccountType)}
                >
                  <option value="banco">Banco / Pago Móvil</option>
                  <option value="efectivo">Efectivo Físico</option>
                  <option value="cripto">Cripto / Exchange (Binance)</option>
                  <option value="wallet_digital">Wallet Digital (Zinli, etc.)</option>
                  <option value="otro">Otro</option>
                </select>
              </div>

              <div className={styles.fieldGroup}>
                <label className={styles.label}>Moneda Principal</label>
                <select
                  className="input-field"
                  value={moneda}
                  onChange={(e) => setMoneda(e.target.value as Currency)}
                >
                  <option value="VES">Bolívares (VES)</option>
                  <option value="USD">Dólares (USD)</option>
                  <option value="USDT">Tether (USDT)</option>
                  <option value="EUR">Euros (EUR)</option>
                </select>
              </div>
            </div>

            <div className={styles.fieldGroup}>
              <label className={styles.label}>Saldo Inicial</label>
              <input
                type="number"
                step="any"
                className="input-field"
                placeholder="0.00"
                value={saldoInicial}
                onChange={(e) => setSaldoInicial(e.target.value)}
              />
            </div>

            <div className={styles.fieldGroup}>
              <label className={styles.label}>Color Distintivo</label>
              <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', paddingTop: '4px' }}>
                {COLOR_OPTIONS.map((c) => (
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
                      transition: 'all 0.15s ease',
                    }}
                  />
                ))}
              </div>
            </div>

            <div className={styles.fieldGroup}>
              <label className={styles.label}>Nota u Observación (Opcional)</label>
              <input
                type="text"
                className="input-field"
                placeholder="Ej: Tarjeta de débito terminada en 4821"
                value={descripcion}
                onChange={(e) => setDescripcion(e.target.value)}
              />
            </div>
          </div>

          <div className={styles.modalFooter}>
            <button type="button" className="btn-secondary" onClick={onClose}>
              Cancelar
            </button>
            <button type="submit" className="btn-primary">
              Guardar Cuenta
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
