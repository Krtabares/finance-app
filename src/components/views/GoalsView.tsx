'use client';

import React, { useState } from 'react';
import { Plus, Target, Trash2, Calendar, PlusCircle } from 'lucide-react';
import { useFinance } from '@/context/FinanceContext';
import { formatCurrency, formatDate } from '@/lib/formatters';
import { GoalModal } from '@/components/modals/GoalModal';
import { DepositGoalModal } from '@/components/modals/DepositGoalModal';
import { SavingsGoal } from '@/types/finance';

export const GoalsView: React.FC = () => {
  const { goals, deleteGoal, preferredViewCurrency, convert } = useFinance();
  const [isGoalModalOpen, setIsGoalModalOpen] = useState(false);
  const [selectedGoalForDeposit, setSelectedGoalForDeposit] = useState<SavingsGoal | null>(null);

  const handleDelete = async (g: SavingsGoal) => {
    if (confirm(`¿Eliminar la meta "${g.nombre}"?`)) {
      await deleteGoal(g.id);
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
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
          <h3 style={{ fontSize: '1.25rem', fontWeight: 700 }}>Metas y Objetivos de Ahorro</h3>
          <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
            Planifica tus fondos de emergencia, compras mayores o proyectos en divisa y bolívares.
          </p>
        </div>

        <button className="btn-primary" onClick={() => setIsGoalModalOpen(true)}>
          <Plus size={16} /> Nueva Meta
        </button>
      </div>

      {/* Grid de Metas */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))',
          gap: '20px',
        }}
      >
        {goals.map((g) => {
          const target = Number(g.monto_objetivo) || 1;
          const current = Number(g.monto_actual) || 0;
          const percent = Math.min(100, Math.round((current / target) * 100));
          const remaining = Math.max(0, target - current);

          return (
            <div
              key={g.id}
              className="glow-card"
              style={{
                background: 'var(--bg-card)',
                border: '1px solid var(--border-subtle)',
                borderRadius: 'var(--radius-lg)',
                padding: '24px',
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'space-between',
                position: 'relative',
                overflow: 'hidden',
                minHeight: '230px',
              }}
            >
              {/* Barra superior de color */}
              <div
                style={{
                  position: 'absolute',
                  top: 0,
                  left: 0,
                  right: 0,
                  height: '4px',
                  backgroundColor: g.color || 'var(--accent-primary)',
                }}
              />

              <div>
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    marginBottom: '14px',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <div
                      style={{
                        width: '38px',
                        height: '38px',
                        borderRadius: 'var(--radius-md)',
                        backgroundColor: `${g.color || '#6366f1'}20`,
                        color: g.color || '#6366f1',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                      }}
                    >
                      <Target size={20} />
                    </div>
                    <div>
                      <h4 style={{ fontSize: '1.05rem', fontWeight: 700 }}>{g.nombre}</h4>
                      {g.fecha_meta && (
                        <div
                          style={{
                            fontSize: '0.75rem',
                            color: 'var(--text-dim)',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '4px',
                          }}
                        >
                          <Calendar size={12} /> Meta: {formatDate(g.fecha_meta)}
                        </div>
                      )}
                    </div>
                  </div>

                  <button
                    className="btn-icon"
                    title="Eliminar meta"
                    onClick={() => handleDelete(g)}
                  >
                    <Trash2 size={15} />
                  </button>
                </div>

                {/* Montos y Porcentaje */}
                <div style={{ margin: '14px 0' }}>
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'baseline',
                      justifyContent: 'space-between',
                      marginBottom: '8px',
                    }}
                  >
                    <div style={{ fontSize: '1.4rem', fontWeight: 800, color: 'var(--text-main)' }}>
                      {formatCurrency(current, g.moneda)}
                    </div>
                    <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                      de {formatCurrency(target, g.moneda)} ({percent}%)
                    </div>
                  </div>

                  {/* Barra de progreso visual */}
                  <div
                    style={{
                      height: '10px',
                      backgroundColor: 'rgba(255, 255, 255, 0.08)',
                      borderRadius: 'var(--radius-full)',
                      overflow: 'hidden',
                    }}
                  >
                    <div
                      style={{
                        height: '100%',
                        width: `${percent}%`,
                        backgroundColor: g.color || 'var(--accent-primary)',
                        borderRadius: 'var(--radius-full)',
                        transition: 'width 0.4s ease',
                      }}
                    />
                  </div>
                </div>

                <div style={{ fontSize: '0.8rem', color: 'var(--text-dim)' }}>
                  Faltan: <strong>{formatCurrency(remaining, g.moneda)}</strong>
                  {g.moneda !== 'VES' && (
                    <span> (≈ {formatCurrency(convert(remaining, g.moneda, 'VES'), 'VES')})</span>
                  )}
                </div>
              </div>

              {/* Botón de acción rápida: Abonar a la meta */}
              <div style={{ marginTop: '16px' }}>
                <button
                  className="btn-secondary"
                  style={{ width: '100%', padding: '10px' }}
                  onClick={() => setSelectedGoalForDeposit(g)}
                >
                  <PlusCircle size={16} /> Abonar / Retirar Fondos
                </button>
              </div>
            </div>
          );
        })}
      </div>

      <GoalModal
        isOpen={isGoalModalOpen}
        onClose={() => setIsGoalModalOpen(false)}
      />

      <DepositGoalModal
        goal={selectedGoalForDeposit}
        onClose={() => setSelectedGoalForDeposit(null)}
      />
    </div>
  );
};
