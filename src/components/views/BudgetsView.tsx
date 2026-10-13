'use client';

import React, { useState, useMemo } from 'react';
import { Plus, PieChart, Trash2, AlertTriangle, CheckCircle2 } from 'lucide-react';
import { useFinance } from '@/context/FinanceContext';
import { formatCurrency } from '@/lib/formatters';
import { BudgetModal } from '@/components/modals/BudgetModal';

export const BudgetsView: React.FC = () => {
  const { budgets, categories, transactions, deleteBudget, addCategory } = useFinance();
  const [isModalOpen, setIsModalOpen] = useState(false);

  // New category inline form state
  const [newCatNombre, setNewCatNombre] = useState('');
  const [newCatTipo, setNewCatTipo] = useState<'gasto' | 'ingreso'>('gasto');
  const [newCatColor, setNewCatColor] = useState('#10b981');

  const [mounted, setMounted] = useState(false);

  React.useEffect(() => {
    setMounted(true);
  }, []);

  const computedBudgets = useMemo(() => {
    if (!mounted) {
      return budgets.map((b) => ({
        ...b,
        gastado_ves: 0,
        porcentaje_usado: 0,
        restante_ves: b.monto_limite,
      }));
    }

    const now = new Date();
    const currentMonth = now.getMonth();
    const currentYear = now.getFullYear();

    return budgets.map((b) => {
      let gastadoVes = 0;
      transactions.forEach((tx) => {
        const txDate = new Date(tx.fecha);
        if (
          tx.category_id === b.category_id &&
          tx.tipo === 'gasto' &&
          txDate.getMonth() === currentMonth &&
          txDate.getFullYear() === currentYear
        ) {
          gastadoVes += tx.monto_ves;
        }
      });

      const porcentaje = b.monto_limite > 0 ? (gastadoVes / b.monto_limite) * 100 : 0;
      const restante = Math.max(0, b.monto_limite - gastadoVes);

      return {
        ...b,
        gastado_ves: gastadoVes,
        porcentaje_usado: Math.round(porcentaje),
        restante_ves: restante,
      };
    });
  }, [budgets, transactions, mounted]);

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

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '28px' }}>
      {/* Top Header */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: '12px',
        }}
      >
        <div>
          <h3 style={{ fontSize: '1.25rem', fontWeight: 700 }}>Presupuestos Mensuales (VES)</h3>
          <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
            Establece techos de gasto por categoría para evitar sobrecostos en bolívares.
          </p>
        </div>

        <button className="btn-primary" onClick={() => setIsModalOpen(true)}>
          <Plus size={16} /> Fijar Presupuesto
        </button>
      </div>

      {/* Grid de Presupuestos */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))',
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
                  <h4 style={{ fontSize: '1rem', fontWeight: 700 }}>{cat?.nombre || 'Categoría'}</h4>
                </div>

                <button
                  className="btn-icon"
                  title="Eliminar presupuesto"
                  onClick={() => {
                    if (confirm('¿Eliminar este presupuesto?')) {
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
                    fontSize: '0.82rem',
                    marginBottom: '6px',
                  }}
                >
                  <span style={{ color: 'var(--text-muted)' }}>Gastado: {b.porcentaje_usado}%</span>
                  <span style={{ color: isOver ? 'var(--accent-rose)' : 'var(--text-main)', fontWeight: 600 }}>
                    {formatCurrency(b.gastado_ves, 'VES')} / {formatCurrency(b.monto_limite, 'VES')}
                  </span>
                </div>

                <div
                  style={{
                    height: '8px',
                    background: 'rgba(255, 255, 255, 0.08)',
                    borderRadius: 'var(--radius-full)',
                    overflow: 'hidden',
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
                    <span>Límite excedido por {formatCurrency(b.gastado_ves - b.monto_limite, 'VES')}</span>
                  </>
                ) : (
                  <>
                    <CheckCircle2 size={15} />
                    <span>Te quedan {formatCurrency(b.restante_ves, 'VES')} disponibles</span>
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
