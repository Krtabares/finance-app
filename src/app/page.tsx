'use client';

import React, { useState } from 'react';
import { FinanceProvider, useFinance } from '@/context/FinanceContext';
import { Sidebar } from '@/components/layout/Sidebar';
import { Header } from '@/components/layout/Header';
import { DashboardView } from '@/components/views/DashboardView';
import { AccountsView } from '@/components/views/AccountsView';
import { TransactionsView } from '@/components/views/TransactionsView';
import { BudgetsView } from '@/components/views/BudgetsView';
import { GoalsView } from '@/components/views/GoalsView';
import { RatesView } from '@/components/views/RatesView';
import { TransactionModal } from '@/components/modals/TransactionModal';
import { AuthModal } from '@/components/auth/AuthModal';
import { AuthScreen } from '@/components/auth/AuthScreen';
import { Database, ExternalLink, Sparkles, X, LogIn, TrendingUp, Loader2 } from 'lucide-react';

function FinanceAppContent() {
  const [currentTab, setCurrentTab] = useState('dashboard');
  const [isTransactionModalOpen, setIsTransactionModalOpen] = useState(false);
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);
  const [showSupabaseBanner, setShowSupabaseBanner] = useState(true);
  const { isSupabaseMode, user, isLoading } = useFinance();

  // 1. Pantalla de carga mientras se verifica la sesión en Supabase
  if (isLoading) {
    return (
      <div
        style={{
          minHeight: '100vh',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          background: 'var(--bg-main)',
          gap: '20px',
        }}
      >
        <div
          style={{
            width: '64px',
            height: '64px',
            borderRadius: '20px',
            background: 'linear-gradient(135deg, #6366f1 0%, #4338ca 100%)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: '#fff',
            boxShadow: '0 0 35px rgba(99, 102, 241, 0.45)',
          }}
        >
          <TrendingUp size={32} />
        </div>
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontSize: '1.2rem', fontWeight: 700, color: 'var(--text-main)', letterSpacing: '-0.01em' }}>
            Bolívar<span style={{ color: '#818cf8' }}>Finance</span>
          </div>
          <div style={{ fontSize: '0.84rem', color: 'var(--text-muted)', marginTop: '4px' }}>
            Verificando sesión segura...
          </div>
        </div>
      </div>
    );
  }

  // 2. Si no hay usuario autenticado, exigir inicio de sesión / registro primero
  if (!user) {
    return <AuthScreen />;
  }

  const getPageTitle = () => {
    switch (currentTab) {
      case 'dashboard':
        return 'Panel Principal';
      case 'accounts':
        return 'Cuentas y Billeteras';
      case 'transactions':
        return 'Transacciones y Movimientos';
      case 'budgets':
        return 'Presupuestos y Categorías';
      case 'goals':
        return 'Metas de Ahorro';
      case 'rates':
        return 'Tasas y Conversor de Divisas';
      default:
        return 'BolívarFinance';
    }
  };

  return (
    <div className="bg-[#090a0d] min-h-screen flex selection:bg-neutral-800 selection:text-white">
      {/* Minimalist Clean Sidebar */}
      <Sidebar
        currentTab={currentTab}
        onSelectTab={setCurrentTab}
        onOpenAuth={() => setIsAuthModalOpen(true)}
      />

      {/* Main Content Layout */}
      <div className="pl-64 flex flex-col flex-1 min-h-screen bg-[#090a0d]">
        <Header
          title={getPageTitle()}
          onOpenNewTransaction={() => setIsTransactionModalOpen(true)}
        />

        <main className="flex-1 px-8 py-8 lg:px-10 lg:py-10 max-w-[1360px] w-full mx-auto space-y-12">


          {/* Renderizado de vista seleccionada */}
          {currentTab === 'dashboard' && (
            <DashboardView
              onNavigateTab={setCurrentTab}
              onOpenNewTransaction={() => setIsTransactionModalOpen(true)}
            />
          )}

          {currentTab === 'accounts' && (
            <AccountsView
              onOpenTransfer={() => setIsTransactionModalOpen(true)}
              onNavigateTab={setCurrentTab}
            />
          )}

          {currentTab === 'transactions' && (
            <TransactionsView onOpenNewTransaction={() => setIsTransactionModalOpen(true)} />
          )}

          {currentTab === 'budgets' && <BudgetsView />}

          {currentTab === 'goals' && <GoalsView />}

          {currentTab === 'rates' && <RatesView />}
        </main>
      </div>

      {/* Modal global de Registro de Transacción */}
      <TransactionModal
        isOpen={isTransactionModalOpen}
        onClose={() => setIsTransactionModalOpen(false)}
      />

      {/* Modal de Autenticación Supabase */}
      <AuthModal
        isOpen={isAuthModalOpen}
        onClose={() => setIsAuthModalOpen(false)}
      />
    </div>
  );
}

export default function Home() {
  return (
    <FinanceProvider>
      <FinanceAppContent />
    </FinanceProvider>
  );
}
