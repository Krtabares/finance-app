'use client';

import React, { useState, useMemo } from 'react';
import {
  Search,
  Filter,
  Download,
  Trash2,
  ArrowUpRight,
  ArrowDownRight,
  Plus,
} from 'lucide-react';
import { useFinance } from '@/context/FinanceContext';
import { formatCurrency, formatDate } from '@/lib/formatters';
import { Transaction } from '@/types/finance';

interface TransactionsViewProps {
  onOpenNewTransaction: () => void;
}

export const TransactionsView: React.FC<TransactionsViewProps> = ({
  onOpenNewTransaction,
}) => {
  const { transactions, accounts, categories, deleteTransaction } = useFinance();

  const [searchTerm, setSearchTerm] = useState('');
  const [filterType, setFilterType] = useState<'todos' | 'gasto' | 'ingreso'>('todos');
  const [filterAccount, setFilterAccount] = useState('todos');
  const [filterCategory, setFilterCategory] = useState('todos');

  // Filter transactions
  const filteredTransactions = useMemo(() => {
    return transactions.filter((tx) => {
      // Filter by type
      if (filterType !== 'todos' && tx.tipo !== filterType) return false;

      // Filter by account
      if (filterAccount !== 'todos' && tx.account_id !== filterAccount) return false;

      // Filter by category
      if (filterCategory !== 'todos' && tx.category_id !== filterCategory) return false;

      // Filter by text search
      if (searchTerm.trim()) {
        const term = searchTerm.toLowerCase();
        const noteMatch = tx.nota?.toLowerCase().includes(term);
        const cat = categories.find((c) => c.id === tx.category_id);
        const catMatch = cat?.nombre.toLowerCase().includes(term);
        const acc = accounts.find((a) => a.id === tx.account_id);
        const accMatch = acc?.nombre.toLowerCase().includes(term);
        if (!noteMatch && !catMatch && !accMatch) return false;
      }

      return true;
    });
  }, [transactions, filterType, filterAccount, filterCategory, searchTerm, categories, accounts]);

  // Export to CSV function
  const handleExportCSV = () => {
    const headers = ['Fecha', 'Tipo', 'Cuenta', 'Categoria', 'Monto Original', 'Moneda', 'Monto USD (Base)', 'Monto VES (Calculado)', 'Tasa', 'Nota'];
    const rows = filteredTransactions.map((tx) => {
      const acc = accounts.find((a) => a.id === tx.account_id)?.nombre || '';
      const cat = categories.find((c) => c.id === tx.category_id)?.nombre || '';
      const montoUsd = Number(tx.monto_usd) || (tx.tasa_cambio && tx.tasa_cambio > 0 ? (Number(tx.monto_ves) || 0) / tx.tasa_cambio : tx.monto);
      return [
        tx.fecha.substring(0, 10),
        tx.tipo,
        `"${acc}"`,
        `"${cat}"`,
        tx.monto,
        tx.moneda,
        montoUsd,
        tx.monto_ves,
        tx.tasa_cambio,
        `"${tx.nota || ''}"`,
      ].join(',');
    });

    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `transacciones_finanzas_${new Date().toISOString().substring(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleDelete = async (tx: Transaction) => {
    if (confirm('¿Eliminar este movimiento? El saldo de la cuenta se actualizará automáticamente.')) {
      await deleteTransaction(tx.id);
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
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
          <h3 style={{ fontSize: '1.25rem', fontWeight: 700 }}>Historial de Transacciones</h3>
          <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
            Mostrando {filteredTransactions.length} movimiento(s)
          </p>
        </div>

        <div style={{ display: 'flex', gap: '10px' }}>
          <button className="btn-secondary" onClick={handleExportCSV}>
            <Download size={16} /> Exportar CSV
          </button>
          <button className="btn-primary" onClick={onOpenNewTransaction}>
            <Plus size={16} /> Registrar
          </button>
        </div>
      </div>

      {/* Toolbar de Filtros */}
      <div
        style={{
          display: 'flex',
          gap: '12px',
          flexWrap: 'wrap',
          background: 'var(--bg-card)',
          padding: '16px',
          borderRadius: 'var(--radius-lg)',
          border: '1px solid var(--border-subtle)',
        }}
      >
        <div style={{ flex: '2', minWidth: '220px', position: 'relative' }}>
          <Search
            size={18}
            style={{ position: 'absolute', left: '12px', top: '11px', color: 'var(--text-dim)' }}
          />
          <input
            type="text"
            className="input-field"
            style={{ paddingLeft: '38px' }}
            placeholder="Buscar por concepto o comercio..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>

        <select
          className="input-field"
          style={{ flex: '1', minWidth: '140px' }}
          value={filterType}
          onChange={(e) => setFilterType(e.target.value as any)}
        >
          <option value="todos">Todos los Tipos</option>
          <option value="gasto">Solo Gastos</option>
          <option value="ingreso">Solo Ingresos</option>
        </select>

        <select
          className="input-field"
          style={{ flex: '1', minWidth: '150px' }}
          value={filterAccount}
          onChange={(e) => setFilterAccount(e.target.value)}
        >
          <option value="todos">Todas las Cuentas</option>
          {accounts.map((a) => (
            <option key={a.id} value={a.id}>
              {a.nombre}
            </option>
          ))}
        </select>

        <select
          className="input-field"
          style={{ flex: '1', minWidth: '150px' }}
          value={filterCategory}
          onChange={(e) => setFilterCategory(e.target.value)}
        >
          <option value="todos">Todas las Categorías</option>
          {categories.map((c) => (
            <option key={c.id} value={c.id}>
              {c.nombre}
            </option>
          ))}
        </select>
      </div>

      {/* Lista de Transacciones */}
      <div
        style={{
          background: 'var(--bg-card)',
          borderRadius: 'var(--radius-lg)',
          border: '1px solid var(--border-subtle)',
          overflow: 'hidden',
        }}
      >
        {filteredTransactions.length === 0 ? (
          <div style={{ padding: '40px', textAlign: 'center', color: 'var(--text-dim)' }}>
            No se encontraron transacciones con los filtros seleccionados.
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            {filteredTransactions.map((tx) => {
              const cat = categories.find((c) => c.id === tx.category_id);
              const acc = accounts.find((a) => a.id === tx.account_id);
              const isIngreso = tx.tipo === 'ingreso';

              return (
                <div
                  key={tx.id}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '16px 20px',
                    borderBottom: '1px solid var(--border-subtle)',
                    transition: 'background var(--transition-fast)',
                  }}
                  onMouseEnter={(e) => (e.currentTarget.style.background = 'rgba(255,255,255,0.02)')}
                  onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
                    <div
                      style={{
                        width: '38px',
                        height: '38px',
                        borderRadius: 'var(--radius-md)',
                        backgroundColor: isIngreso ? 'var(--accent-emerald-bg)' : 'var(--accent-rose-bg)',
                        color: isIngreso ? 'var(--accent-emerald)' : 'var(--accent-rose)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                      }}
                    >
                      {isIngreso ? <ArrowUpRight size={20} /> : <ArrowDownRight size={20} />}
                    </div>

                    <div>
                      <div style={{ fontSize: '0.95rem', fontWeight: 600, color: 'var(--text-main)' }}>
                        {tx.nota || cat?.nombre || (isIngreso ? 'Ingreso registrado' : 'Gasto registrado')}
                      </div>
                      <div
                        style={{
                          fontSize: '0.78rem',
                          color: 'var(--text-dim)',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '8px',
                          marginTop: '2px',
                        }}
                      >
                        <span>{formatDate(tx.fecha)}</span>
                        <span>•</span>
                        <span>{acc?.nombre}</span>
                        {cat && (
                          <>
                            <span>•</span>
                            <span
                              className="badge"
                              style={{
                                background: `${cat.color}20`,
                                color: cat.color,
                                padding: '1px 6px',
                                fontSize: '0.7rem',
                              }}
                            >
                              {cat.nombre}
                            </span>
                          </>
                        )}
                      </div>
                    </div>
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                    <div style={{ textAlign: 'right' }}>
                      <div
                        style={{
                          fontSize: '1.05rem',
                          fontWeight: 700,
                          color: isIngreso ? 'var(--accent-emerald)' : 'var(--accent-rose)',
                        }}
                      >
                        {isIngreso ? '+' : '-'}{formatCurrency(tx.monto, tx.moneda)}
                      </div>
                      {tx.moneda === 'VES' ? (
                        <div style={{ fontSize: '0.75rem', color: 'var(--text-dim)' }}>
                          ≈ ${((Number(tx.monto_usd) || (tx.tasa_cambio && tx.tasa_cambio > 1 ? tx.monto_ves / tx.tasa_cambio : 0))).toFixed(2)} USD (Tasa: {tx.tasa_cambio})
                        </div>
                      ) : (
                        <div style={{ fontSize: '0.75rem', color: 'var(--text-dim)' }}>
                          ≈ {formatCurrency(tx.monto_ves, 'VES')} (Tasa: {tx.tasa_cambio})
                        </div>
                      )}
                    </div>

                    <button
                      className="btn-icon"
                      title="Eliminar movimiento"
                      onClick={() => handleDelete(tx)}
                    >
                      <Trash2 size={15} />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};
