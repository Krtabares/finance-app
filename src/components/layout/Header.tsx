'use client';

import React from 'react';
import { useFinance } from '@/context/FinanceContext';

interface HeaderProps {
  title?: string;
  onOpenNewTransaction: () => void;
}

export const Header: React.FC<HeaderProps> = ({ onOpenNewTransaction }) => {
  const {
    preferredViewCurrency,
    setPreferredViewCurrency,
    rates,
    liveQuotes,
  } = useFinance();

  const bcvVal = liveQuotes?.bcv || rates.find((r) => r.moneda === 'USD')?.tasa_a_ves || 0;
  const paraleloVal = liveQuotes?.paralelo || 0;
  const usdtVal = liveQuotes?.usdt_p2p || rates.find((r) => r.moneda === 'USDT')?.tasa_a_ves || 0;

  const formatRate = (val: number) => {
    if (!val || val <= 0) return '---';
    return val.toLocaleString('es-VE', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  };

  return (
    <header className="sticky top-0 z-40 h-14 bg-[#090a0d]/90 backdrop-blur-md border-b border-neutral-800/30 px-8 flex items-center justify-between">
      {/* Subtle Currency Bar */}
      <div className="flex items-center gap-6 text-xs text-neutral-400 font-mono">
        <div className="flex items-center gap-2">
          <span className="text-neutral-500 uppercase tracking-wider text-[10px]">BCV</span>
          <span className="text-neutral-200">Bs. {formatRate(bcvVal)}</span>
        </div>
        <span className="text-neutral-800">•</span>
        <div className="flex items-center gap-2">
          <span className="text-neutral-500 uppercase tracking-wider text-[10px]">Paralelo</span>
          <span className="text-neutral-300">Bs. {formatRate(paraleloVal)}</span>
        </div>
        <span className="text-neutral-800">•</span>
        <div className="flex items-center gap-2">
          <span className="text-neutral-500 uppercase tracking-wider text-[10px]">USDT</span>
          <span className="text-neutral-300">Bs. {formatRate(usdtVal)}</span>
        </div>
      </div>

      {/* Actions & Switchers */}
      <div className="flex items-center gap-3">
        {/* Minimal Currency Toggle */}
        <div className="flex items-center p-0.5 rounded-md bg-neutral-900 border border-neutral-800/60 text-xs">
          <button
            onClick={() => setPreferredViewCurrency('VES')}
            className={`px-2.5 py-1 rounded transition-all ${
              preferredViewCurrency === 'VES'
                ? 'bg-neutral-800 text-neutral-100 font-medium'
                : 'text-neutral-400 hover:text-neutral-200'
            }`}
          >
            VES
          </button>
          <button
            onClick={() => setPreferredViewCurrency('USD')}
            className={`px-2.5 py-1 rounded transition-all ${
              preferredViewCurrency === 'USD'
                ? 'bg-neutral-800 text-neutral-100 font-medium'
                : 'text-neutral-400 hover:text-neutral-200'
            }`}
          >
            USD
          </button>
        </div>

        <button
          onClick={onOpenNewTransaction}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-neutral-100 hover:bg-white text-neutral-950 text-xs font-semibold tracking-tight transition-all shadow-sm"
        >
          <span className="material-symbols-outlined text-[16px]">add</span>
          <span>Transacción</span>
        </button>
      </div>
    </header>
  );
};

