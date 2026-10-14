'use client';

import React, { useState } from 'react';
import { X, ArrowRight, ArrowLeft, CheckCircle2, Wallet, RefreshCw, PieChart, CreditCard, Sparkles } from 'lucide-react';
import styles from './GuideModal.module.css';

interface GuideModalProps {
  isOpen: boolean;
  onClose: () => void;
  onNavigateTab: (tab: string) => void;
}

const STEPS = [
  {
    id: 'accounts',
    title: '1. ¿Dónde está tu dinero?',
    subtitle: 'Cuentas y Billeteras Bimonetarias',
    icon: Wallet,
    color: '#10b981',
    description:
      'El primer paso es registrar los lugares donde guardas tu dinero: tu banco en Bolívares (Banesco, Mercantil, Pago Móvil), tus dólares en efectivo en mano, o tus billeteras digitales (Binance USDT, Zelle, Zinli).',
    highlights: [
      'Registra cuentas en VES, USD o USDT según corresponda.',
      'La app suma todos tus fondos automáticamente al valor del día.',
      'Puedes ver tu saldo total en Dólares o Bolívares con un solo clic.',
    ],
    actionText: 'Ir a Cuentas y Billeteras',
    targetTab: 'accounts',
  },
  {
    id: 'rates',
    title: '2. Tasas y Conversión en Vivo',
    subtitle: 'Control total frente a la devaluación',
    icon: RefreshCw,
    color: '#6366f1',
    description:
      'En Venezuela los precios cambian constantemente. BolívarFinance se conecta en vivo a las tasas oficiales del BCV, el Dólar Paralelo y Binance P2P.',
    highlights: [
      'Tus gastos y cuentas se convierten con precisión al tipo de cambio real.',
      'Usa el interruptor VES / USD en la barra superior para ver toda la app en la moneda que prefieras.',
      'Calculadora y conversor rápido disponible en la pestaña de Tasas.',
    ],
    actionText: 'Ver Tasas y Conversor',
    targetTab: 'rates',
  },
  {
    id: 'budgets',
    title: '3. Presupuestos: ¿Cuánto puedo gastar?',
    subtitle: 'Planifica tus quincenas sin quedarte corto',
    icon: PieChart,
    color: '#f59e0b',
    description:
      'Crea límites de gasto por categoría (Alimentación, Servicios, Transporte, Ocio). Puedes configurarlos de forma mensual o quincenal (1 al 15, y 16 a fin de mes).',
    highlights: [
      'Alerta visual cuando estés cerca de alcanzar tu límite.',
      'Sabrás con exactitud cuánto dinero te queda disponible para gastar hoy.',
      'Evita gastar de más antes de cobrar la siguiente quincena.',
    ],
    actionText: 'Configurar Presupuestos',
    targetTab: 'budgets',
  },
  {
    id: 'transactions_debts',
    title: '4. Movimientos y Deudas en Cuotas',
    subtitle: 'Registra tus gastos y nunca olvides un pago',
    icon: CreditCard,
    color: '#ec4899',
    description:
      'Cada vez que hagas una compra o cobres un dinero, anótalo con el botón "+ Transacción". Si compraste a crédito (Cashea, préstamos o cuotas), regístralo en Deudas.',
    highlights: [
      'El panel te avisará qué cuotas vencen en los próximos días.',
      'Tus saldos en cuentas se actualizan al instante con cada movimiento.',
      'Visualiza tus reportes y aprende en qué se va tu dinero cada mes.',
    ],
    actionText: 'Ir al Panel Principal',
    targetTab: 'dashboard',
  },
];

export const GuideModal: React.FC<GuideModalProps> = ({
  isOpen,
  onClose,
  onNavigateTab,
}) => {
  const [currentStepIndex, setCurrentStepIndex] = useState(0);

  if (!isOpen) return null;

  const step = STEPS[currentStepIndex];
  const StepIcon = step.icon;
  const isFirst = currentStepIndex === 0;
  const isLast = currentStepIndex === STEPS.length - 1;

  const handleActionClick = () => {
    onNavigateTab(step.targetTab);
    onClose();
  };

  return (
    <div className={styles.overlay} onClick={onClose}>
      <div className={styles.modalCard} onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className={styles.modalHeader}>
          <div className={styles.modalHeaderLeft}>
            <div className={styles.modalHeaderIcon}>
              <Sparkles size={18} />
            </div>
            <div>
              <h2 className={styles.modalTitle}>
                Guía de Inicio: ¿Cómo funciona BolívarFinance?
              </h2>
              <p className={styles.modalSubtitle}>
                Paso {currentStepIndex + 1} de {STEPS.length} • Entiende tu dinero en 4 pasos
              </p>
            </div>
          </div>
          <button onClick={onClose} className={styles.modalClose} title="Cerrar guía">
            <X size={18} />
          </button>
        </div>

        {/* Stepper Progress Bar */}
        <div className={styles.stepperBar}>
          {STEPS.map((s, idx) => {
            const isActive = idx === currentStepIndex;
            const isCompleted = idx < currentStepIndex;
            return (
              <button
                key={s.id}
                onClick={() => setCurrentStepIndex(idx)}
                className={`${styles.stepTab} ${isActive ? styles.stepTabActive : ''}`}
              >
                <div
                  className={`${styles.stepTabDot} ${
                    isActive ? styles.stepTabDotActive : isCompleted ? styles.stepTabDotCompleted : ''
                  }`}
                />
                <span>{idx + 1}. {s.title.split('. ')[1] || s.title}</span>
              </button>
            );
          })}
        </div>

        {/* Step Body */}
        <div className={styles.body}>
          <div className={styles.heroRow}>
            <div
              className={styles.heroIconBox}
              style={{
                backgroundColor: `${step.color}15`,
                border: `1px solid ${step.color}35`,
                color: step.color,
              }}
            >
              <StepIcon size={26} />
            </div>
            <div>
              <span className={styles.heroCategory}>{step.subtitle}</span>
              <h3 className={styles.heroTitle}>{step.title}</h3>
              <p className={styles.heroDesc}>{step.description}</p>
            </div>
          </div>

          {/* Key highlights checklist */}
          <div className={styles.highlightsBox}>
            <div className={styles.highlightsTitle}>Puntos clave a tener en cuenta:</div>
            {step.highlights.map((point, i) => (
              <div key={i} className={styles.highlightItem}>
                <CheckCircle2 size={16} color="var(--accent-emerald)" style={{ flexShrink: 0, marginTop: 2 }} />
                <span>{point}</span>
              </div>
            ))}
          </div>

          {/* Direct Section Action Button */}
          <div className={styles.actionBanner}>
            <div className={styles.actionBannerText}>
              <div className={styles.actionBannerTitle}>¿Quieres probar esta sección ahora mismo?</div>
              <div className={styles.actionBannerDesc}>Te llevaremos directamente a la pantalla correspondiente.</div>
            </div>
            <button onClick={handleActionClick} className={styles.btnActionSection}>
              <span>{step.actionText}</span>
              <ArrowRight size={14} />
            </button>
          </div>
        </div>

        {/* Footer Navigation */}
        <div className={styles.footer}>
          <button
            onClick={() => setCurrentStepIndex((prev) => Math.max(0, prev - 1))}
            disabled={isFirst}
            className={styles.btnSecondary}
          >
            <ArrowLeft size={14} />
            <span>Anterior</span>
          </button>

          {!isLast ? (
            <button
              onClick={() => setCurrentStepIndex((prev) => Math.min(STEPS.length - 1, prev + 1))}
              className={styles.btnPrimary}
            >
              <span>Siguiente paso</span>
              <ArrowRight size={14} />
            </button>
          ) : (
            <button onClick={onClose} className={`${styles.btnPrimary} ${styles.btnFinish}`}>
              <CheckCircle2 size={16} />
              <span>¡Entendido! Comenzar</span>
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
