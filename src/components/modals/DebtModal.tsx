'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { X, ChevronDown, ChevronUp } from 'lucide-react';
import styles from './TransactionModal.module.css';
import debtStyles from './DebtModal.module.css';
import { useFinance } from '@/context/FinanceContext';
import { Currency, DebtFrequency, DebtCalcType } from '@/types/finance';
import { calculateRegularQuotaAmount, generateDebtInstallments } from '@/lib/debts';
import { formatCurrency } from '@/lib/formatters';

interface DebtModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const FRECUENCIA_LABEL: Record<DebtFrequency, string> = {
  semanal: 'Cada 7 días',
  quincenal: 'Cada 15 días',
  mensual: 'Mensual',
};

export const DebtModal: React.FC<DebtModalProps> = ({ isOpen, onClose }) => {
  const { accounts, addDebt } = useFinance();

  const [nombre, setNombre] = useState('');
  const [acreedor, setAcreedor] = useState('');
  const [moneda, setMoneda] = useState<Currency>('USD');
  const [montoTotal, setMontoTotal] = useState('');
  const [frecuencia, setFrecuencia] = useState<DebtFrequency>('quincenal');
  const [numCuotas, setNumCuotas] = useState('12');
  const [fechaInicio, setFechaInicio] = useState('');
  const [tipoCalculo, setTipoCalculo] = useState<DebtCalcType>('simple');
  const [tasaInteres, setTasaInteres] = useState('0');
  const [accountId, setAccountId] = useState('');
  const [descripcion, setDescripcion] = useState('');
  const [showSchedulePreview, setShowSchedulePreview] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  useEffect(() => {
    if (isOpen) {
      setFechaInicio(new Date().toISOString().split('T')[0]);
      if (accounts.length > 0 && !accountId) setAccountId(accounts[0].id);
      setErrorMsg('');
    }
  }, [isOpen, accounts, accountId]);

  const numMonto = parseFloat(montoTotal) || 0;
  const numCuotasVal = parseInt(numCuotas, 10) || 0;
  const numTasa = parseFloat(tasaInteres) || 0;

  const quotaCalculada = useMemo(() => {
    if (numMonto <= 0 || numCuotasVal <= 0) return 0;
    return calculateRegularQuotaAmount(numMonto, numCuotasVal, numTasa, tipoCalculo);
  }, [numMonto, numCuotasVal, numTasa, tipoCalculo]);

  const previewInstallments = useMemo(() => {
    if (numMonto <= 0 || numCuotasVal <= 0 || !fechaInicio) return [];
    return generateDebtInstallments('preview', numMonto, numCuotasVal, frecuencia, fechaInicio, tipoCalculo, numTasa);
  }, [numMonto, numCuotasVal, frecuencia, fechaInicio, tipoCalculo, numTasa]);

  const totalEstimado = useMemo(
    () => previewInstallments.reduce((sum, item) => sum + item.monto, 0),
    [previewInstallments]
  );
  const totalIntereses = Math.max(0, totalEstimado - numMonto);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!nombre.trim()) return setErrorMsg('Por favor ingresa un nombre o concepto para la deuda');
    if (!acreedor.trim()) return setErrorMsg('Indica quién es el acreedor o prestamista');
    if (numMonto <= 0) return setErrorMsg('El monto prestado debe ser mayor a 0');
    if (numCuotasVal <= 0) return setErrorMsg('El número de cuotas debe ser al menos 1');
    if (!fechaInicio) return setErrorMsg('Selecciona la fecha de la primera cuota');

    try {
      setIsSubmitting(true);
      setErrorMsg('');
      await addDebt({
        nombre: nombre.trim(),
        acreedor: acreedor.trim(),
        moneda,
        monto_total: numMonto,
        num_cuotas: numCuotasVal,
        frecuencia,
        fecha_inicio: fechaInicio,
        tipo_calculo: tipoCalculo,
        tasa_interes: numTasa,
        account_id: accountId || undefined,
        descripcion: descripcion.trim() || undefined,
      });
      setNombre('');
      setAcreedor('');
      setMontoTotal('');
      setDescripcion('');
      onClose();
    } catch (err: any) {
      setErrorMsg(err.message || 'Error al registrar la deuda');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className={styles.modalCard} style={{ maxWidth: '560px' }} onClick={(e) => e.stopPropagation()}>
        <div className={styles.modalHeader}>
          <div>
            <h3 className={styles.modalTitle}>Nueva Deuda / Préstamo</h3>
            <p className={debtStyles.subtitle}>Planifica tus pagos semanales, quincenales o mensuales</p>
          </div>
          <button type="button" className={styles.modalClose} onClick={onClose}>
            <X size={20} />
          </button>
        </div>

        <form onSubmit={handleSubmit}>
          <div className={styles.formContent}>
            {errorMsg && <div className={debtStyles.error}>{errorMsg}</div>}

            <div className={styles.twoCols}>
              <div className={styles.fieldGroup}>
                <label className={styles.label}>Concepto / Nombre</label>
                <input
                  type="text"
                  className="input-field"
                  placeholder="Ej: Préstamo moto"
                  value={nombre}
                  onChange={(e) => setNombre(e.target.value)}
                  required
                  autoFocus
                />
              </div>
              <div className={styles.fieldGroup}>
                <label className={styles.label}>Acreedor / Prestamista</label>
                <input
                  type="text"
                  className="input-field"
                  placeholder="Ej: Banco, persona, financiera"
                  value={acreedor}
                  onChange={(e) => setAcreedor(e.target.value)}
                  required
                />
              </div>
            </div>

            <div className={styles.twoCols}>
              <div className={styles.fieldGroup}>
                <label className={styles.label}>Monto Prestado</label>
                <div className={debtStyles.suffixWrapper}>
                  <input
                    type="number"
                    step="0.01"
                    min="0.01"
                    className="input-field"
                    placeholder="0.00"
                    value={montoTotal}
                    onChange={(e) => setMontoTotal(e.target.value)}
                    required
                  />
                  <span className={debtStyles.suffix}>{moneda}</span>
                </div>
              </div>
              <div className={styles.fieldGroup}>
                <label className={styles.label}>Moneda</label>
                <select className="input-field" value={moneda} onChange={(e) => setMoneda(e.target.value as Currency)}>
                  <option value="USD">Dólares (USD)</option>
                  <option value="VES">Bolívares (VES)</option>
                  <option value="USDT">Tether (USDT)</option>
                  <option value="EUR">Euros (EUR)</option>
                </select>
              </div>
            </div>

            <div className={styles.twoCols}>
              <div className={styles.fieldGroup}>
                <label className={styles.label}>Frecuencia</label>
                <select
                  className="input-field"
                  value={frecuencia}
                  onChange={(e) => setFrecuencia(e.target.value as DebtFrequency)}
                >
                  <option value="quincenal">Quincenal (cada 15 días)</option>
                  <option value="mensual">Mensual</option>
                  <option value="semanal">Semanal (cada 7 días)</option>
                </select>
              </div>
              <div className={styles.fieldGroup}>
                <label className={styles.label}>Número de Cuotas</label>
                <input
                  type="number"
                  min="1"
                  max="240"
                  className="input-field"
                  placeholder="12"
                  value={numCuotas}
                  onChange={(e) => setNumCuotas(e.target.value)}
                  required
                />
              </div>
            </div>

            <div className={styles.twoCols}>
              <div className={styles.fieldGroup}>
                <label className={styles.label}>Fecha 1ª Cuota</label>
                <input
                  type="date"
                  className="input-field"
                  style={{ colorScheme: 'dark' }}
                  value={fechaInicio}
                  onChange={(e) => setFechaInicio(e.target.value)}
                  required
                />
              </div>
              <div className={styles.fieldGroup}>
                <label className={styles.label}>Cuenta de Débito Habitual</label>
                <select className="input-field" value={accountId} onChange={(e) => setAccountId(e.target.value)}>
                  <option value="">Seleccionar cuenta...</option>
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
                <label className={styles.label}>Esquema de Cálculo</label>
                <select
                  className="input-field"
                  value={tipoCalculo}
                  onChange={(e) => setTipoCalculo(e.target.value as DebtCalcType)}
                >
                  <option value="simple">Cuota simple</option>
                  <option value="amortizado">Amortización (francés)</option>
                </select>
                <span className={debtStyles.hint}>
                  {tipoCalculo === 'simple' ? 'Capital dividido en partes iguales.' : 'Interés sobre saldo remanente.'}
                </span>
              </div>
              <div className={styles.fieldGroup}>
                <label className={styles.label}>Interés por Cuota</label>
                <div className={debtStyles.suffixWrapper}>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    max="100"
                    className="input-field"
                    placeholder="0"
                    value={tasaInteres}
                    onChange={(e) => setTasaInteres(e.target.value)}
                  />
                  <span className={debtStyles.suffix}>%</span>
                </div>
                <span className={debtStyles.hint}>Usa 0% si no cobra intereses.</span>
              </div>
            </div>

            <div className={styles.fieldGroup}>
              <label className={styles.label}>Nota u Observación (Opcional)</label>
              <input
                type="text"
                className="input-field"
                placeholder="Condiciones del préstamo"
                value={descripcion}
                onChange={(e) => setDescripcion(e.target.value)}
              />
            </div>

            {numMonto > 0 && numCuotasVal > 0 && (
              <div className={debtStyles.summary}>
                <div className={debtStyles.summaryHeader}>
                  <span className={debtStyles.summaryTitle}>Resumen estimado</span>
                  <span>{FRECUENCIA_LABEL[frecuencia]}</span>
                </div>
                <div className={debtStyles.summaryGrid}>
                  <div className={debtStyles.summaryItem}>
                    <span className={debtStyles.summaryLabel}>Cuota</span>
                    <span className={`${debtStyles.summaryValue} ${debtStyles.summaryValueAccent}`}>
                      {formatCurrency(quotaCalculada, moneda)}
                    </span>
                  </div>
                  <div className={debtStyles.summaryItem}>
                    <span className={debtStyles.summaryLabel}>Total a pagar</span>
                    <span className={debtStyles.summaryValue}>{formatCurrency(totalEstimado, moneda)}</span>
                  </div>
                  <div className={debtStyles.summaryItem}>
                    <span className={debtStyles.summaryLabel}>Intereses</span>
                    <span className={debtStyles.summaryValue}>{formatCurrency(totalIntereses, moneda)}</span>
                  </div>
                </div>

                <button
                  type="button"
                  className={debtStyles.toggle}
                  onClick={() => setShowSchedulePreview(!showSchedulePreview)}
                >
                  <span>Ver calendario ({previewInstallments.length} cuotas)</span>
                  {showSchedulePreview ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                </button>

                {showSchedulePreview && (
                  <div className={debtStyles.previewTable}>
                    <table>
                      <thead>
                        <tr>
                          <th>#</th>
                          <th>Vence</th>
                          <th className={debtStyles.right}>Cuota</th>
                          <th className={debtStyles.right}>Capital</th>
                          <th className={debtStyles.right}>Interés</th>
                        </tr>
                      </thead>
                      <tbody>
                        {previewInstallments.map((inst) => (
                          <tr key={inst.numero}>
                            <td>{inst.numero}</td>
                            <td>{inst.fecha_vencimiento}</td>
                            <td className={debtStyles.right}>{inst.monto.toFixed(2)}</td>
                            <td className={debtStyles.right}>{inst.monto_capital.toFixed(2)}</td>
                            <td className={debtStyles.right}>{inst.monto_interes.toFixed(2)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            )}
          </div>

          <div className={styles.modalFooter}>
            <button type="button" className="btn-secondary" onClick={onClose} disabled={isSubmitting}>
              Cancelar
            </button>
            <button type="submit" className="btn-primary" disabled={isSubmitting}>
              {isSubmitting ? 'Guardando...' : 'Crear Plan de Deuda'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
