'use client';

import React, { useState, useMemo } from 'react';
import { Plus, Trash2, AlertTriangle, CheckCircle2, DollarSign, Coins } from 'lucide-react';
import { useFinance } from '@/context/FinanceContext';
import { formatCurrency } from '@/lib/formatters';
import { BudgetModal } from '@/components/modals/BudgetModal';

export const BudgetsView: React.FC = () => {
  const {
    budgets,
    categories,
    transactions,
    deleteBudget,
    addCategory,
    preferredViewCurrency,
    setPreferredViewCurrency,
    convert,
    rates,
  } = useFinance();

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [viewCurrency, setViewCurrency] = useState<'VES' | 'USD'>(preferredViewCurrency || 'USD');

  // New category inline form state
  const [newCatNombre, setNewCatNombre] = useState('');
  const [newCatTipo, setNewCatTipo] = useState<'gasto' | 'ingreso'>('gasto');
  const [newCatColor, setNewCatColor] = useState('#10b981');

  const [mounted, setMounted] = useState(false);

  React.useEffect(() => {
    setMounted(true);
    if (preferredViewCurrency) {
      setViewCurrency(preferredViewCurrency);
    }
  }, [preferredViewCurrency]);

  const activeUsdRate = rates.find((r) => r.moneda === 'USD')?.tasa_a_ves || 450;

  const computedBudgets = useMemo(() => {
    if (!mounted) {
      return budgets.map((b) => {
        const limiteUsd = b.moneda === 'USD'
          ? (b.monto_original || b.monto_limite)
          : (b.monto_limite > 500 ? b.monto_limite / activeUsdRate : b.monto_limite);
        const limiteVes = limiteUsd * activeUsdRate;
        return {
          ...b,
          gastado_ves: 0,
          gastado_usd: 0,
          limite_ves: limiteVes,
          limite_usd: limiteUsd,
          porcentaje_usado: 0,
          restante_ves: limiteVes,
          restante_usd: limiteUsd,
        };
      });
    }

    const now = new Date();
    const currentMonth = now.getMonth();
    const currentYear = now.getFullYear();

    return budgets.map((b) => {
      // Valor base guardado en USD (ancla real de compra)
      const limiteUsd = b.moneda === 'USD'
        ? (b.monto_original || b.monto_limite)
        : (b.monto_limite > 500 ? b.monto_limite / activeUsdRate : b.monto_limite);
      // Límite dinámico calculado en bolívares según la tasa vigente
      const limiteVes = limiteUsd * activeUsdRate;

      let gastadoUsd = 0;
      let gastadoVes = 0;
      transactions.forEach((tx) => {
        const txDate = new Date(tx.fecha);
        if (
          tx.category_id === b.category_id &&
          tx.tipo === 'gasto' &&
          txDate.getMonth() === currentMonth &&
          txDate.getFullYear() === currentYear
        ) {
          const txUsd = Number(tx.monto_usd) || (tx.tasa_cambio && tx.tasa_cambio > 0 ? (Number(tx.monto_ves) || 0) / tx.tasa_cambio : convert(Number(tx.monto) || 0, tx.moneda, 'USD'));
          const txVes = Number(tx.monto_ves) || (txUsd * (tx.tasa_cambio || activeUsdRate));
          gastadoUsd += txUsd;
          gastadoVes += txVes;
        }
      });

      const porcentaje = limiteUsd > 0 ? (gastadoUsd / limiteUsd) * 100 : 0;
      const restanteUsd = Math.max(0, limiteUsd - gastadoUsd);
      const restanteVes = Math.max(0, limiteVes - gastadoVes);

      return {
        ...b,
        gastado_ves: gastadoVes,
        gastado_usd: gastadoUsd,
        limite_ves: limiteVes,
        limite_usd: limiteUsd,
        porcentaje_usado: Math.round(porcentaje),
        restante_ves: restanteVes,
        restante_usd: restanteUsd,
      };
    });
  }, [budgets, transactions, mounted, convert, activeUsdRate]);

  const handleCreateCategory = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCatNombre.trim()) return;
    await addCategory({
      nombre: newCatNombre.trim(),
      tipo: newCatTipo,
      color: newCatColor,
      icono: 'Tag',
    });
    setNewCatNombre('');
  };

  const isUsdView = viewCurrency === 'USD';

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '28px' }}>
      {/* Top Header */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: '14px',
        }}
      >
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <h3 style={{ fontSize: '1.35rem', fontWeight: 800 }}>Presupuestos Mensuales</h3>
            <span
              className="badge"
              style={{
                background: isUsdView ? 'rgba(16, 185, 129, 0.15)' : 'rgba(59, 130, 246, 0.15)',
                color: isUsdView ? 'var(--accent-emerald)' : 'var(--accent-primary)',
                fontWeight: 700,
                fontSize: '0.75rem',
              }}
            >
              Modo {isUsdView ? 'USD ($)' : 'VES (Bs.)'}
            </span>
          </div>
          <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginTop: '4px' }}>
            Establece y monitorea techos de gasto en <strong>dólares (USD)</strong> o <strong>bolívares (VES)</strong> para protegerte de la inflación.
          </p>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
          {/* Toggle de Moneda de Visualización */}
          <div
            style={{
              display: 'flex',
              background: 'rgba(255, 255, 255, 0.05)',
              border: '1px solid var(--border-subtle)',
              borderRadius: 'var(--radius-md)',
              padding: '3px',
              gap: '2px',
            }}
          >
            <button
              type="button"
              onClick={() => {
                setViewCurrency('USD');
                setPreferredViewCurrency('USD');
              }}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '5px',
                padding: '6px 12px',
                borderRadius: 'var(--radius-sm)',
                border: 'none',
                background: isUsdView ? 'var(--accent-emerald)' : 'transparent',
                color: isUsdView ? '#fff' : 'var(--text-muted)',
                fontWeight: 600,
                fontSize: '0.8rem',
                cursor: 'pointer',
                transition: 'all var(--transition-fast)',
              }}
            >
              <DollarSign size={13} /> Dólares (USD)
            </button>
            <button
              type="button"
              onClick={() => {
                setViewCurrency('VES');
                setPreferredViewCurrency('VES');
              }}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '5px',
                padding: '6px 12px',
                borderRadius: 'var(--radius-sm)',
                border: 'none',
                background: !isUsdView ? '#2563eb' : 'transparent',
                color: !isUsdView ? '#ffffff' : 'var(--text-muted)',
                fontWeight: 600,
                fontSize: '0.8rem',
                cursor: 'pointer',
                transition: 'all var(--transition-fast)',
              }}
            >
              <Coins size={13} /> Bolívares (VES)
            </button>
          </div>

          <button className="btn-primary" onClick={() => setIsModalOpen(true)}>
            <Plus size={16} /> Fijar Presupuesto
          </button>
        </div>
      </div>

      {/* Grid de Presupuestos */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(330px, 1fr))',
          gap: '20px',
        }}
      >
        {computedBudgets.map((b) => {
          const cat = categories.find((c) => c.id === b.category_id);
          const isOver = b.porcentaje_usado >= 100;
          const isWarning = b.porcentaje_usado >= 75 && !isOver;

          let barColor = 'var(--accent-emerald)';
          if (isWarning) barColor = 'var(--accent-amber)';
          if (isOver) barColor = 'var(--accent-rose)';

          // Cifras según la moneda activa
          const primaryGastado = isUsdView
            ? formatCurrency(b.gastado_usd, 'USD')
            : formatCurrency(b.gastado_ves, 'VES');
          const primaryLimite = isUsdView
            ? formatCurrency(b.limite_usd, 'USD')
            : formatCurrency(b.limite_ves, 'VES');

          const secondaryGastado = isUsdView
            ? formatCurrency(b.gastado_ves, 'VES')
            : formatCurrency(b.gastado_usd, 'USD');
          const secondaryLimite = isUsdView
            ? formatCurrency(b.limite_ves, 'VES')
            : formatCurrency(b.limite_usd, 'USD');

          const primaryRestante = isUsdView
            ? formatCurrency(b.restante_usd, 'USD')
            : formatCurrency(b.restante_ves, 'VES');
          const secondaryRestante = isUsdView
            ? formatCurrency(b.restante_ves, 'VES')
            : formatCurrency(b.restante_usd, 'USD');

          const primaryExceso = isUsdView
            ? formatCurrency(b.gastado_usd - b.limite_usd, 'USD')
            : formatCurrency(b.gastado_ves - b.limite_ves, 'VES');

          return (
            <div
              key={b.id}
              className="glow-card"
              style={{
                background: 'var(--bg-card)',
                border: isOver ? '1px solid rgba(244, 63, 94, 0.4)' : '1px solid var(--border-subtle)',
                borderRadius: 'var(--radius-lg)',
                padding: '22px',
                display: 'flex',
                flexDirection: 'column',
                gap: '16px',
                position: 'relative',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <div
                    style={{
                      width: '12px',
                      height: '12px',
                      borderRadius: '50%',
                      backgroundColor: cat?.color || '#3b82f6',
                    }}
                  />
                  <div>
                    <h4 style={{ fontSize: '1rem', fontWeight: 700 }}>{cat?.nombre || 'Categoría'}</h4>
                    <div style={{ display: 'flex', gap: '6px', marginTop: '2px' }}>
                      <span
                        style={{
                          fontSize: '0.7rem',
                          color: b.moneda === 'USD' ? 'var(--accent-emerald)' : 'var(--text-dim)',
                          fontWeight: 600,
                        }}
                      >
                        {b.moneda === 'USD' ? '💵 Fijado en USD' : '🇻🇪 Fijado en VES'}
                      </span>
                    </div>
                  </div>
                </div>

                <button
                  className="btn-icon"
                  title="Eliminar presupuesto"
                  onClick={() => {
                    if (confirm(`¿Eliminar el presupuesto de "${cat?.nombre || 'esta categoría'}"?`)) {
                      deleteBudget(b.id);
                    }
                  }}
                >
                  <Trash2 size={15} />
                </button>
              </div>

              {/* Barra de Progreso */}
              <div>
                <div
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'baseline',
                    fontSize: '0.82rem',
                    marginBottom: '4px',
                  }}
                >
                  <span style={{ color: 'var(--text-muted)' }}>Gastado: {b.porcentaje_usado}%</span>
                  <div style={{ textAlign: 'right' }}>
                    <span style={{ color: isOver ? 'var(--accent-rose)' : 'var(--text-main)', fontWeight: 700 }}>
                      {primaryGastado} / {primaryLimite}
                    </span>
                    <div style={{ fontSize: '0.72rem', color: 'var(--text-dim)' }}>
                      ≈ {secondaryGastado} / {secondaryLimite}
                    </div>
                  </div>
                </div>

                <div
                  style={{
                    height: '8px',
                    background: 'rgba(255, 255, 255, 0.08)',
                    borderRadius: 'var(--radius-full)',
                    overflow: 'hidden',
                    marginTop: '6px',
                  }}
                >
                  <div
                    style={{
                      height: '100%',
                      width: `${Math.min(100, b.porcentaje_usado)}%`,
                      backgroundColor: barColor,
                      borderRadius: 'var(--radius-full)',
                      transition: 'width 0.4s ease',
                    }}
                  />
                </div>
              </div>

              {/* Mensaje de estado */}
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  fontSize: '0.8rem',
                  color: isOver ? 'var(--accent-rose)' : isWarning ? 'var(--accent-amber)' : 'var(--accent-emerald)',
                }}
              >
                {isOver ? (
                  <>
                    <AlertTriangle size={15} />
                    <span>Límite excedido por {primaryExceso}</span>
                  </>
                ) : (
                  <>
                    <CheckCircle2 size={15} />
                    <span>
                      Te quedan {primaryRestante} disponibles
                      <span style={{ color: 'var(--text-dim)', marginLeft: '4px' }}>
                        (≈ {secondaryRestante})
                      </span>
                    </span>
                  </>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Sección: Gestor de Categorías */}
      <div
        style={{
          background: 'var(--bg-card)',
          border: '1px solid var(--border-subtle)',
          borderRadius: 'var(--radius-lg)',
          padding: '24px',
          marginTop: '12px',
        }}
      >
        <h4 style={{ fontSize: '1.05rem', fontWeight: 700, marginBottom: '6px' }}>
          Gestión de Categorías
        </h4>
        <p style={{ fontSize: '0.82rem', color: 'var(--text-muted)', marginBottom: '18px' }}>
          Crea nuevas categorías personalizadas para tus ingresos o gastos.
        </p>

        {/* Formulario rápido para añadir categoría */}
        <form
          onSubmit={handleCreateCategory}
          style={{
            display: 'flex',
            gap: '12px',
            flexWrap: 'wrap',
            marginBottom: '20px',
          }}
        >
          <input
            type="text"
            className="input-field"
            style={{ flex: 2, minWidth: '180px' }}
            placeholder="Nombre de la nueva categoría..."
            value={newCatNombre}
            onChange={(e) => setNewCatNombre(e.target.value)}
            required
          />

          <select
            className="input-field"
            style={{ flex: 1, minWidth: '130px' }}
            value={newCatTipo}
            onChange={(e) => setNewCatTipo(e.target.value as any)}
          >
            <option value="gasto">Gasto</option>
            <option value="ingreso">Ingreso</option>
          </select>

          <input
            type="color"
            value={newCatColor}
            onChange={(e) => setNewCatColor(e.target.value)}
            style={{
              width: '45px',
              height: '42px',
              padding: '2px',
              borderRadius: 'var(--radius-md)',
              border: '1px solid var(--border-subtle)',
              background: 'transparent',
              cursor: 'pointer',
            }}
          />

          <button type="submit" className="btn-primary">
            <Plus size={16} /> Añadir Categoría
          </button>
        </form>

        {/* Píldoras de Categorías existentes */}
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
          {categories.map((c) => (
            <span
              key={c.id}
              className="badge"
              style={{
                backgroundColor: `${c.color}20`,
                color: c.color,
                border: `1px solid ${c.color}40`,
                padding: '6px 12px',
                fontSize: '0.82rem',
              }}
            >
              {c.nombre} ({c.tipo})
            </span>
          ))}
        </div>
      </div>

      <BudgetModal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} />
    </div>
  );
};
