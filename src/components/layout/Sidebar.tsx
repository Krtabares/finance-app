'use client';

import React from 'react';
import { useFinance } from '@/context/FinanceContext';

interface SidebarProps {
  currentTab: string;
  onSelectTab: (tab: string) => void;
  isOpenMobile?: boolean;
  onCloseMobile?: () => void;
  onOpenAuth?: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({
  currentTab,
  onSelectTab,
  onOpenAuth,
}) => {
  const { rates, liveQuotes, user, isSupabaseMode, logoutUser } = useFinance();

  const navItems = [
    { id: 'dashboard', label: 'Panel Principal', icon: 'grid_view' },
    { id: 'accounts', label: 'Cuentas y Billeteras', icon: 'account_balance_wallet' },
    { id: 'transactions', label: 'Transacciones', icon: 'sync_alt' },
    { id: 'debts', label: 'Deudas y Cuotas', icon: 'credit_card' },
    { id: 'budgets', label: 'Presupuestos', icon: 'pie_chart' },
    { id: 'goals', label: 'Metas de Ahorro', icon: 'savings' },
    { id: 'rates', label: 'Tasas y Conversor', icon: 'currency_exchange' },
  ];

  const rateBcv = liveQuotes?.bcv || rates.find((r) => r.moneda === 'USD')?.tasa_a_ves || 0;
  const rateUsdt = liveQuotes?.usdt_p2p || rates.find((r) => r.moneda === 'USDT')?.tasa_a_ves || 0;

  const formatRate = (val: number) => {
    if (!val || val <= 0) return '---';
    return val.toLocaleString('es-VE', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  };

  const username = user?.email ? user.email.split('@')[0] : 'Usuario Local';
  const initial = (username.charAt(0) || 'U').toUpperCase();

  return (
    <aside className="fixed left-0 top-0 h-screen w-64 bg-[#07080a] border-r border-neutral-800/40 flex flex-col z-50">
      {/* Brand */}
      <div className="h-16 px-6 flex items-center justify-between border-b border-neutral-800/20">
        <div className="flex items-center gap-3">
          <div className="w-7 h-7 rounded-lg bg-neutral-100 text-black flex items-center justify-center font-bold text-sm font-display tracking-tight">
            B
          </div>
          <span className="font-display font-semibold text-sm text-neutral-200 tracking-tight">Bolívar App</span>
        </div>
        <span className="text-[10px] uppercase tracking-wider font-mono px-1.5 py-0.5 rounded bg-neutral-800/60 text-neutral-400">
          v2.4
        </span>
      </div>

      {/* Navigation */}
      <nav className="flex-1 px-3 py-4 space-y-0.5">
        {navItems.map((item) => {
          const isActive = currentTab === item.id;
          return (
            <button
              key={item.id}
              onClick={() => onSelectTab(item.id)}
              className={`w-full flex items-center gap-3 px-3 py-2 rounded-md font-medium text-xs tracking-tight transition-all text-left ${
                isActive
                  ? 'bg-neutral-800/40 text-neutral-100'
                  : 'text-neutral-400 hover:text-neutral-200 hover:bg-neutral-900/60'
              }`}
            >
              <span className={`material-symbols-outlined text-[18px] ${isActive ? 'text-neutral-200' : ''}`}>
                {item.icon}
              </span>
              <span>{item.label}</span>
            </button>
          );
        })}
      </nav>

      {/* Bottom Rates & Profile */}
      <div className="p-4 border-t border-neutral-800/40 space-y-3">
        <div className="px-3 py-2.5 rounded-lg bg-neutral-900/40 border border-neutral-800/30">
          <div className="flex items-center justify-between text-[11px] text-neutral-500 font-mono mb-1.5">
            <span className="flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500/80"></span>
              Mercado
            </span>
            <span>BCV / USDT</span>
          </div>
          <div className="flex justify-between items-baseline text-xs">
            <span className="text-neutral-400">USD BCV</span>
            <span className="font-mono text-neutral-200">{formatRate(rateBcv)}</span>
          </div>
          <div className="flex justify-between items-baseline text-xs mt-0.5">
            <span className="text-neutral-400">USDT P2P</span>
            <span className="font-mono text-neutral-200">{formatRate(rateUsdt)}</span>
          </div>
        </div>

        <div className="flex items-center justify-between px-1">
          <div
            className="flex items-center gap-2.5 min-w-0 cursor-pointer"
            onClick={onOpenAuth}
            title={user ? `Conectado como ${user.email}` : 'Iniciar sesión'}
          >
            <div className="w-6 h-6 rounded-full bg-neutral-800 text-neutral-300 flex items-center justify-center text-[11px] font-medium flex-shrink-0">
              {initial}
            </div>
            <div className="flex flex-col min-w-0">
              <span className="text-xs text-neutral-300 truncate font-medium">{username}</span>
              <span className="text-[10px] text-neutral-500 truncate">
                {isSupabaseMode ? (user ? 'Supabase sync' : 'Nube lista') : 'Local mode'}
              </span>
            </div>
          </div>
          {user && (
            <button
              onClick={() => logoutUser()}
              className="text-neutral-500 hover:text-neutral-300 transition-colors p-1"
              title="Cerrar sesión"
            >
              <span className="material-symbols-outlined text-[16px]">logout</span>
            </button>
          )}
        </div>
      </div>
    </aside>
  );
};

