'use client';

import React, { useState } from 'react';
import {
  Plus,
  ArrowLeftRight,
  Trash2,
  Building2,
  Banknote,
  Coins,
  CreditCard,
  Wallet,
} from 'lucide-react';
import { useFinance } from '@/context/FinanceContext';
import { formatCurrency } from '@/lib/formatters';
import { AccountModal } from '@/components/modals/AccountModal';
import { Account } from '@/types/finance';

interface AccountsViewProps {
  onOpenTransfer: () => void;
}

export const AccountsView: React.FC<AccountsViewProps> = ({ onOpenTransfer }) => {
  const { accounts, deleteAccount, preferredViewCurrency } = useFinance();
  const [isNewAccountModalOpen, setIsNewAccountModalOpen] = useState(false);

  const getAccountIcon = (tipo: string) => {
    switch (tipo) {
      case 'banco':
        return <Building2 size={22} />;
      case 'efectivo':
        return <Banknote size={22} />;
      case 'cripto':
        return <Coins size={22} />;
      case 'wallet_digital':
        return <CreditCard size={22} />;
      default:
        return <Wallet size={22} />;
    }
  };

  const handleDelete = async (acc: Account) => {
    if (confirm(`¿Estás seguro de eliminar la cuenta "${acc.nombre}"? Esto también eliminará sus transacciones asociadas.`)) {
      await deleteAccount(acc.id);
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      {/* Barra de Acciones de Cuentas */}
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
          <h3 style={{ fontSize: '1.25rem', fontWeight: 700 }}>Tus Cuentas y Billeteras</h3>
          <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
            Administra tus cuentas bancarias nacionales, efectivo en divisa y billeteras cripto.
          </p>
        </div>

        <div style={{ display: 'flex', gap: '10px' }}>
          <button className="btn-secondary" onClick={onOpenTransfer}>
            <ArrowLeftRight size={16} /> Transferir entre Cuentas
          </button>
          <button className="btn-primary" onClick={() => setIsNewAccountModalOpen(true)}>
            <Plus size={16} /> Nueva Cuenta
          </button>
        </div>
      </div>

      {/* Grid de Tarjetas de Cuentas */}
      {accounts.length === 0 ? (
        <div
          className="glow-card"
          style={{
            background: 'var(--bg-card)',
            border: '1px dashed var(--border-subtle)',
            borderRadius: 'var(--radius-lg)',
            padding: '48px 24px',
            textAlign: 'center',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: '16px',
          }}
        >
          <div
            style={{
              width: '64px',
              height: '64px',
              borderRadius: '50%',
              background: 'rgba(99, 102, 241, 0.1)',
              color: '#818cf8',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Wallet size={32} />
          </div>
          <div>
            <h4 style={{ fontSize: '1.1rem', fontWeight: 700, color: 'var(--text-main)' }}>
              No tienes cuentas creadas todavía
            </h4>
            <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', maxWidth: '420px', margin: '6px auto 0' }}>
              Crea tu primera cuenta (bancaria en VES, efectivo en USD o billetera USDT) para registrar saldos y movimientos.
            </p>
          </div>
          <button className="btn-primary" onClick={() => setIsNewAccountModalOpen(true)}>
            <Plus size={16} /> Crear Primera Cuenta
          </button>
        </div>
      ) : (
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))',
            gap: '20px',
          }}
        >
          {accounts.map((acc) => {
          return (
            <div
              key={acc.id}
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
                minHeight: '190px',
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
                  backgroundColor: acc.color,
                }}
              />

              <div>
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    marginBottom: '16px',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <div
                      style={{
                        width: '42px',
                        height: '42px',
                        borderRadius: 'var(--radius-md)',
                        background: `${acc.color}20`,
                        color: acc.color,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                      }}
                    >
                      {getAccountIcon(acc.tipo)}
                    </div>
                    <div>
                      <h4 style={{ fontSize: '1.05rem', fontWeight: 700 }}>{acc.nombre}</h4>
                      <span
                        className="badge"
                        style={{
                          background: 'rgba(255, 255, 255, 0.05)',
                          color: 'var(--text-muted)',
                          marginTop: '2px',
                        }}
                      >
                        {acc.tipo.toUpperCase()} • {acc.moneda}
                      </span>
                    </div>
                  </div>

                  <button
                    className="btn-icon"
                    title="Eliminar cuenta"
                    onClick={() => handleDelete(acc)}
                  >
                    <Trash2 size={15} />
                  </button>
                </div>

                {acc.descripcion && (
                  <p
                    style={{
                      fontSize: '0.8rem',
                      color: 'var(--text-dim)',
                      marginBottom: '14px',
                    }}
                  >
                    {acc.descripcion}
                  </p>
                )}
              </div>

              {/* Saldo de la cuenta */}
              <div
                style={{
                  background: 'rgba(10, 15, 26, 0.5)',
                  padding: '12px 14px',
                  borderRadius: 'var(--radius-md)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                }}
              >
                <div>
                  <div style={{ fontSize: '0.72rem', color: 'var(--text-dim)', textTransform: 'uppercase' }}>
                    Saldo Disponible
                  </div>
                  <div style={{ fontSize: '1.3rem', fontWeight: 800, color: 'var(--text-main)' }}>
                    {formatCurrency(acc.saldo_actual || 0, acc.moneda)}
                  </div>
                </div>

                {acc.moneda !== 'VES' && (
                  <div style={{ textAlign: 'right' }}>
                    <div style={{ fontSize: '0.72rem', color: 'var(--text-dim)', textTransform: 'uppercase' }}>
                      En Bolívares
                    </div>
                    <div style={{ fontSize: '0.95rem', fontWeight: 700, color: 'var(--accent-cyan)' }}>
                      {formatCurrency(acc.saldo_en_ves || 0, 'VES')}
                    </div>
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    )}

      <AccountModal
        isOpen={isNewAccountModalOpen}
        onClose={() => setIsNewAccountModalOpen(false)}
      />
    </div>
  );
};
