'use client';

import React, { createContext, useContext, useState, useEffect, useMemo, ReactNode } from 'react';
import {
  Account,
  Category,
  Transaction,
  Budget,
  SavingsGoal,
  ExchangeRate,
  Currency,
  RateSource,
  FinancialSummary,
} from '@/types/finance';
import {
  INITIAL_ACCOUNTS,
  INITIAL_CATEGORIES,
  INITIAL_TRANSACTIONS,
  INITIAL_BUDGETS,
  INITIAL_GOALS,
  INITIAL_RATES,
} from '@/lib/mockData';
import { supabase, isSupabaseConfigured } from '@/lib/supabase';

export interface LiveQuotes {
  bcv: number | null;
  paralelo: number | null;
  usdt_p2p: number | null;
  eur: number | null;
}

interface FinanceContextType {
  accounts: Account[];
  categories: Category[];
  transactions: Transaction[];
  budgets: Budget[];
  goals: SavingsGoal[];
  rates: ExchangeRate[];
  liveQuotes: LiveQuotes | null;
  isSyncingRates: boolean;
  lastRatesSync: string | null;
  activeRateSource: RateSource;
  preferredViewCurrency: 'VES' | 'USD';
  isSupabaseMode: boolean;
  user: { email: string; id: string } | null;
  isLoading: boolean;
  
  // Actions
  setPreferredViewCurrency: (currency: 'VES' | 'USD') => void;
  setActiveRateSource: (source: RateSource) => void;
  updateRate: (moneda: Currency, nuevaTasa: number, fuente: RateSource) => Promise<void>;
  syncLiveRates: (selectedSource?: RateSource) => Promise<{ success: boolean; message?: string }>;
  convert: (amount: number, from: Currency, to: Currency) => number;
  addTransaction: (data: Omit<Transaction, 'id'>) => Promise<void>;
  deleteTransaction: (id: string) => Promise<void>;
  addAccount: (data: Omit<Account, 'id'>) => Promise<void>;
  updateAccount: (id: string, data: Partial<Account>) => Promise<void>;
  deleteAccount: (id: string) => Promise<void>;
  addCategory: (data: Omit<Category, 'id'>) => Promise<void>;
  addBudget: (data: Omit<Budget, 'id'>) => Promise<void>;
  deleteBudget: (id: string) => Promise<void>;
  addGoal: (data: Omit<SavingsGoal, 'id'>) => Promise<void>;
  updateGoalProgress: (id: string, deltaMonto: number) => Promise<void>;
  deleteGoal: (id: string) => Promise<void>;
  transferFunds: (fromAccountId: string, toAccountId: string, amountFrom: number, amountTo: number, nota?: string) => Promise<void>;
  resetToDefaultData: () => Promise<void> | void;
  seedSupabaseDemoData: () => Promise<void>;
  loginUser: (email: string, id?: string) => void;
  logoutUser: () => Promise<void>;
  refreshSupabaseData: () => Promise<void>;
  
  // Computed
  summary: FinancialSummary;
}

const FinanceContext = createContext<FinanceContextType | undefined>(undefined);

const STORAGE_KEYS = {
  ACCOUNTS: 'bolivar_finance_accounts_v1',
  CATEGORIES: 'bolivar_finance_categories_v1',
  TRANSACTIONS: 'bolivar_finance_transactions_v1',
  BUDGETS: 'bolivar_finance_budgets_v1',
  GOALS: 'bolivar_finance_goals_v1',
  RATES: 'bolivar_finance_rates_v1',
  RATE_SOURCE: 'bolivar_finance_rate_source_v1',
  VIEW_CURRENCY: 'bolivar_finance_view_currency_v1',
  USER: 'bolivar_finance_user_v1',
  LIVE_QUOTES: 'bolivar_finance_live_quotes_v1',
  LAST_SYNC: 'bolivar_finance_last_sync_v1',
};

export const FinanceProvider = ({ children }: { children: ReactNode }) => {
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [budgets, setBudgets] = useState<Budget[]>([]);
  const [goals, setGoals] = useState<SavingsGoal[]>([]);
  const [rates, setRates] = useState<ExchangeRate[]>(INITIAL_RATES);
  const [liveQuotes, setLiveQuotes] = useState<LiveQuotes | null>(null);
  const [isSyncingRates, setIsSyncingRates] = useState<boolean>(false);
  const [lastRatesSync, setLastRatesSync] = useState<string | null>(null);
  const [activeRateSource, setActiveRateSource] = useState<RateSource>('BCV');
  const [preferredViewCurrency, setPreferredViewCurrency] = useState<'VES' | 'USD'>('VES');
  const [user, setUser] = useState<{ email: string; id: string } | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [mounted, setMounted] = useState(false);

  // Load data from Supabase
  const loadSupabaseData = async (userId: string) => {
    if (!supabase) return;
    try {
      setIsLoading(true);

      const [accRes, catRes, txRes, bgRes, glRes, rtRes] = await Promise.all([
        supabase.from('accounts').select('*').eq('user_id', userId),
        supabase.from('categories').select('*').eq('user_id', userId),
        supabase.from('transactions').select('*').eq('user_id', userId).order('fecha', { ascending: false }),
        supabase.from('budgets').select('*').eq('user_id', userId),
        supabase.from('savings_goals').select('*').eq('user_id', userId),
        supabase.from('exchange_rates').select('*').or(`user_id.eq.${userId},user_id.is.null`),
      ]);

      if (accRes.data && accRes.data.length > 0) {
        setAccounts(accRes.data);
      } else {
        // Inicializar cuentas esenciales para el usuario en Supabase
        const defaultAccounts = [
          {
            user_id: userId,
            nombre: 'Cuenta Bancaria VES',
            tipo: 'banco' as const,
            moneda: 'VES' as const,
            saldo_inicial: 0,
            color: '#3b82f6',
            descripcion: 'Cuenta corriente / Pago Móvil',
            activo: true,
          },
          {
            user_id: userId,
            nombre: 'Efectivo USD',
            tipo: 'efectivo' as const,
            moneda: 'USD' as const,
            saldo_inicial: 0,
            color: '#10b981',
            descripcion: 'Dólares en efectivo',
            activo: true,
          },
          {
            user_id: userId,
            nombre: 'Binance USDT',
            tipo: 'billetera_digital' as const,
            moneda: 'USDT' as const,
            saldo_inicial: 0,
            color: '#f59e0b',
            descripcion: 'Billetera Cripto / P2P',
            activo: true,
          },
        ];
        try {
          const { data: createdAccs } = await supabase.from('accounts').insert(defaultAccounts).select();
          if (createdAccs && createdAccs.length > 0) {
            setAccounts(createdAccs);
          } else {
            setAccounts([]);
          }
        } catch {
          setAccounts([]);
        }
      }

      if (catRes.data && catRes.data.length > 0) {
        setCategories(catRes.data);
      } else {
        // Sembrar categorías iniciales en la base de datos
        const defaultCats = INITIAL_CATEGORIES.map(({ id, ...rest }) => ({
          ...rest,
          user_id: userId,
        }));
        const { data: insertedCats } = await supabase.from('categories').insert(defaultCats).select();
        if (insertedCats) setCategories(insertedCats);
      }

      if (txRes.data) setTransactions(txRes.data);
      if (bgRes.data) setBudgets(bgRes.data);
      if (glRes.data) setGoals(glRes.data);
      if (rtRes.data && rtRes.data.length > 0) setRates(rtRes.data);
    } catch (err) {
      console.error('Error al sincronizar con Supabase:', err);
    } finally {
      setIsLoading(false);
    }
  };

  // Initialize from LocalStorage or Supabase Auth
  useEffect(() => {
    setMounted(true);

    if (isSupabaseConfigured && supabase) {
      // Supabase Auth listener
      supabase.auth.getSession().then(({ data: { session } }) => {
        if (session?.user) {
          setUser({ email: session.user.email || '', id: session.user.id });
          loadSupabaseData(session.user.id);
        } else {
          setUser(null);
          setIsLoading(false);
        }
      }).catch((e) => {
        console.error('Error fetching Supabase session:', e);
        setUser(null);
        setIsLoading(false);
      });

      const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
        if (session?.user) {
          setUser({ email: session.user.email || '', id: session.user.id });
          loadSupabaseData(session.user.id);
        } else {
          setUser(null);
          setAccounts([]);
          setTransactions([]);
          setBudgets([]);
          setGoals([]);
          setIsLoading(false);
        }
      });

      return () => subscription.unsubscribe();
    } else {
      // Local Storage mode
      try {
        if (typeof window !== 'undefined') {
          const storedUser = localStorage.getItem(STORAGE_KEYS.USER);
          if (storedUser) {
            setUser(JSON.parse(storedUser));
            const storedAccounts = localStorage.getItem(STORAGE_KEYS.ACCOUNTS);
            const storedCategories = localStorage.getItem(STORAGE_KEYS.CATEGORIES);
            const storedTransactions = localStorage.getItem(STORAGE_KEYS.TRANSACTIONS);
            const storedBudgets = localStorage.getItem(STORAGE_KEYS.BUDGETS);
            const storedGoals = localStorage.getItem(STORAGE_KEYS.GOALS);
            const storedRates = localStorage.getItem(STORAGE_KEYS.RATES);
            const storedSource = localStorage.getItem(STORAGE_KEYS.RATE_SOURCE) as RateSource | null;
            const storedView = localStorage.getItem(STORAGE_KEYS.VIEW_CURRENCY) as 'VES' | 'USD' | null;
            const storedQuotes = localStorage.getItem(STORAGE_KEYS.LIVE_QUOTES);
            const storedSync = localStorage.getItem(STORAGE_KEYS.LAST_SYNC);

            setAccounts(storedAccounts ? JSON.parse(storedAccounts) : INITIAL_ACCOUNTS);
            setCategories(storedCategories ? JSON.parse(storedCategories) : INITIAL_CATEGORIES);
            setTransactions(storedTransactions ? JSON.parse(storedTransactions) : INITIAL_TRANSACTIONS);
            setBudgets(storedBudgets ? JSON.parse(storedBudgets) : INITIAL_BUDGETS);
            setGoals(storedGoals ? JSON.parse(storedGoals) : INITIAL_GOALS);
            if (storedRates) setRates(JSON.parse(storedRates));
            if (storedSource) setActiveRateSource(storedSource);
            if (storedView) setPreferredViewCurrency(storedView);
            if (storedQuotes) setLiveQuotes(JSON.parse(storedQuotes));
            if (storedSync) setLastRatesSync(storedSync);
          } else {
            setUser(null);
          }
        }
      } catch (e) {
        console.error('Error loading initial data from storage', e);
        setUser(null);
      } finally {
        setIsLoading(false);
      }
    }
  }, []);

  // Fetch initial live rates silently on mount
  useEffect(() => {
    if (typeof window !== 'undefined') {
      syncLiveRates().catch(() => {});
    }
  }, []);

  // Sync state changes to LocalStorage when not in Supabase mode
  useEffect(() => {
    if (!isSupabaseConfigured && !isLoading && typeof window !== 'undefined') {
      localStorage.setItem(STORAGE_KEYS.ACCOUNTS, JSON.stringify(accounts));
      localStorage.setItem(STORAGE_KEYS.CATEGORIES, JSON.stringify(categories));
      localStorage.setItem(STORAGE_KEYS.TRANSACTIONS, JSON.stringify(transactions));
      localStorage.setItem(STORAGE_KEYS.BUDGETS, JSON.stringify(budgets));
      localStorage.setItem(STORAGE_KEYS.GOALS, JSON.stringify(goals));
      localStorage.setItem(STORAGE_KEYS.RATES, JSON.stringify(rates));
      localStorage.setItem(STORAGE_KEYS.RATE_SOURCE, activeRateSource);
      localStorage.setItem(STORAGE_KEYS.VIEW_CURRENCY, preferredViewCurrency);
      if (liveQuotes) {
        localStorage.setItem(STORAGE_KEYS.LIVE_QUOTES, JSON.stringify(liveQuotes));
      }
      if (lastRatesSync) {
        localStorage.setItem(STORAGE_KEYS.LAST_SYNC, lastRatesSync);
      }
      if (user) {
        localStorage.setItem(STORAGE_KEYS.USER, JSON.stringify(user));
      }
    }
  }, [accounts, categories, transactions, budgets, goals, rates, liveQuotes, lastRatesSync, activeRateSource, preferredViewCurrency, user, isLoading]);

  // Conversion helper
  const convert = (amount: number, from: Currency, to: Currency): number => {
    if (from === to) return amount;
    
    const getRateToVes = (curr: Currency): number => {
      if (curr === 'VES') return 1;
      const found = rates.find((r) => r.moneda === curr);
      return found ? found.tasa_a_ves : 450;
    };

    const amountInVes = amount * getRateToVes(from);
    const targetRate = getRateToVes(to);
    return amountInVes / targetRate;
  };

  const updateRate = async (moneda: Currency, nuevaTasa: number, fuente: RateSource) => {
    const updatedRates = [
      ...rates.filter((r) => r.moneda !== moneda),
      {
        moneda,
        tasa_a_ves: nuevaTasa,
        fuente,
        fecha: new Date().toISOString().split('T')[0],
      },
    ];
    setRates(updatedRates);

    if (isSupabaseConfigured && supabase && user) {
      try {
        await supabase.from('exchange_rates').upsert({
          user_id: user.id,
          moneda,
          tasa_a_ves: nuevaTasa,
          fuente,
          fecha: new Date().toISOString().split('T')[0],
        });
      } catch (err) {
        console.warn('Error al actualizar tasa en Supabase:', err);
      }
    }
  };

  // Sync live rates from /api/rates
  const syncLiveRates = async (selectedSource?: RateSource): Promise<{ success: boolean; message?: string }> => {
    try {
      setIsSyncingRates(true);
      const res = await fetch('/api/rates');
      if (!res.ok) throw new Error('Error al conectar con el servidor de tasas');
      const data = await res.json();
      if (!data.success || !data.sources) throw new Error(data.error || 'Respuesta inválida de tasas');

      const quotes: LiveQuotes = {
        bcv: data.sources.bcv,
        paralelo: data.sources.paralelo,
        usdt_p2p: data.sources.usdt_p2p,
        eur: data.sources.eur,
      };
      setLiveQuotes(quotes);

      const sourceToUse = selectedSource || activeRateSource;
      const today = new Date().toISOString().split('T')[0];

      // Determinar qué tasa USD aplicar según la fuente activa
      let usdVal = quotes.bcv || 876.80;
      let usdFuente: RateSource = 'BCV';
      if (sourceToUse === 'Paralelo' && quotes.paralelo) {
        usdVal = quotes.paralelo;
        usdFuente = 'Paralelo';
      } else if (sourceToUse === 'Binance P2P' && quotes.usdt_p2p) {
        usdVal = quotes.usdt_p2p;
        usdFuente = 'Binance P2P';
      }

      const newRates: ExchangeRate[] = [
        {
          moneda: 'USD',
          tasa_a_ves: usdVal,
          fuente: usdFuente,
          fecha: today,
        },
        {
          moneda: 'USDT',
          tasa_a_ves: quotes.usdt_p2p || 1001.25,
          fuente: 'Binance P2P',
          fecha: today,
        },
        {
          moneda: 'EUR',
          tasa_a_ves: quotes.eur || 1121.01,
          fuente: 'BCV',
          fecha: today,
        },
      ];

      setRates(newRates);

      const timeStr = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
      setLastRatesSync(timeStr);

      if (typeof window !== 'undefined') {
        localStorage.setItem(STORAGE_KEYS.LIVE_QUOTES, JSON.stringify(quotes));
        localStorage.setItem(STORAGE_KEYS.LAST_SYNC, timeStr);
        localStorage.setItem(STORAGE_KEYS.RATES, JSON.stringify(newRates));
      }

      if (isSupabaseConfigured && supabase && user) {
        try {
          for (const item of newRates) {
            await supabase.from('exchange_rates').upsert({
              user_id: user.id,
              moneda: item.moneda,
              tasa_a_ves: item.tasa_a_ves,
              fuente: item.fuente,
              fecha: item.fecha,
            });
          }
        } catch (supabaseErr) {
          console.warn('Error al guardar tasas automáticas en Supabase:', supabaseErr);
        }
      }

      return { success: true };
    } catch (err: any) {
      console.error('Error al sincronizar tasas en vivo:', err);
      return { success: false, message: err.message || 'Error desconocido' };
    } finally {
      setIsSyncingRates(false);
    }
  };

  const handleSetActiveRateSource = (source: RateSource) => {
    setActiveRateSource(source);
    if (liveQuotes) {
      let targetRate: number | null = null;
      if (source === 'BCV') targetRate = liveQuotes.bcv;
      else if (source === 'Paralelo') targetRate = liveQuotes.paralelo;
      else if (source === 'Binance P2P') targetRate = liveQuotes.usdt_p2p;

      if (targetRate) {
        updateRate('USD', targetRate, source);
      }
    }
  };

  // Accounts with computed balance
  const computedAccounts = useMemo(() => {
    return accounts.map((acc) => {
      let balance = Number(acc.saldo_inicial) || 0;
      transactions.forEach((tx) => {
        if (tx.account_id === acc.id) {
          if (tx.tipo === 'ingreso') {
            balance += Number(tx.monto) || 0;
          } else if (tx.tipo === 'gasto') {
            balance -= Number(tx.monto) || 0;
          }
        }
      });
      const saldoEnVes = convert(balance, acc.moneda, 'VES');
      return {
        ...acc,
        saldo_actual: balance,
        saldo_en_ves: saldoEnVes,
      };
    });
  }, [accounts, transactions, rates]);

  // Financial summary computation
  const summary = useMemo(() => {
    let patrimonioVes = 0;
    computedAccounts.forEach((acc) => {
      patrimonioVes += acc.saldo_en_ves || 0;
    });

    if (!mounted) {
      const patrimonioUsd = convert(patrimonioVes, 'VES', 'USD');
      return {
        patrimonio_ves: patrimonioVes,
        patrimonio_usd: patrimonioUsd,
        ingresos_mes_ves: 0,
        gastos_mes_ves: 0,
        balance_mes_ves: 0,
        ahorro_tasa_mes: 0,
      };
    }

    const now = new Date();
    const currentMonth = now.getMonth();
    const currentYear = now.getFullYear();

    let ingresosMesVes = 0;
    let gastosMesVes = 0;

    transactions.forEach((tx) => {
      const txDate = new Date(tx.fecha);
      if (txDate.getMonth() === currentMonth && txDate.getFullYear() === currentYear) {
        if (tx.tipo === 'ingreso') {
          ingresosMesVes += Number(tx.monto_ves) || 0;
        } else if (tx.tipo === 'gasto') {
          gastosMesVes += Number(tx.monto_ves) || 0;
        }
      }
    });

    const balanceMesVes = ingresosMesVes - gastosMesVes;
    const ahorroTasaMes = ingresosMesVes > 0 ? (balanceMesVes / ingresosMesVes) * 100 : 0;
    const patrimonioUsd = convert(patrimonioVes, 'VES', 'USD');

    return {
      patrimonio_ves: patrimonioVes,
      patrimonio_usd: patrimonioUsd,
      ingresos_mes_ves: ingresosMesVes,
      gastos_mes_ves: gastosMesVes,
      balance_mes_ves: balanceMesVes,
      ahorro_tasa_mes: Math.max(0, Math.round(ahorroTasaMes * 10) / 10),
    };
  }, [computedAccounts, transactions, rates, mounted]);

  // CRUD Actions
  const addTransaction = async (data: Omit<Transaction, 'id'>) => {
    if (isSupabaseConfigured && supabase && user) {
      try {
        const { data: inserted, error } = await supabase
          .from('transactions')
          .insert({
            ...data,
            user_id: user.id,
          })
          .select()
          .single();

        if (error) throw error;
        if (inserted) {
          setTransactions((prev) => [inserted, ...prev]);
          return;
        }
      } catch (err) {
        console.warn('Error al guardar transacción en Supabase:', err);
      }
    }

    const newTx: Transaction = {
      ...data,
      id: 'tx-' + Date.now(),
      created_at: new Date().toISOString(),
    };
    setTransactions((prev) => [newTx, ...prev]);
  };

  const deleteTransaction = async (id: string) => {
    setTransactions((prev) => prev.filter((t) => t.id !== id));
    if (isSupabaseConfigured && supabase) {
      try {
        await supabase.from('transactions').delete().eq('id', id);
      } catch (err) {
        console.warn('Error al eliminar en Supabase:', err);
      }
    }
  };

  const addAccount = async (data: Omit<Account, 'id'>) => {
    if (isSupabaseConfigured && supabase && user) {
      try {
        const { data: inserted, error } = await supabase
          .from('accounts')
          .insert({
            ...data,
            user_id: user.id,
          })
          .select()
          .single();

        if (error) throw error;
        if (inserted) {
          setAccounts((prev) => [...prev, inserted]);
          return;
        }
      } catch (err) {
        console.warn('Error al guardar cuenta en Supabase:', err);
      }
    }

    const newAcc: Account = {
      ...data,
      id: 'acc-' + Date.now(),
      created_at: new Date().toISOString(),
    };
    setAccounts((prev) => [...prev, newAcc]);
  };

  const updateAccount = async (id: string, data: Partial<Account>) => {
    setAccounts((prev) => prev.map((a) => (a.id === id ? { ...a, ...data } : a)));
    if (isSupabaseConfigured && supabase) {
      try {
        await supabase.from('accounts').update(data).eq('id', id);
      } catch (err) {
        console.warn('Error al actualizar cuenta en Supabase:', err);
      }
    }
  };

  const deleteAccount = async (id: string) => {
    setAccounts((prev) => prev.filter((a) => a.id !== id));
    setTransactions((prev) => prev.filter((t) => t.account_id !== id));
    if (isSupabaseConfigured && supabase) {
      try {
        await supabase.from('accounts').delete().eq('id', id);
      } catch (err) {
        console.warn('Error al eliminar cuenta en Supabase:', err);
      }
    }
  };

  const addCategory = async (data: Omit<Category, 'id'>) => {
    if (isSupabaseConfigured && supabase && user) {
      try {
        const { data: inserted, error } = await supabase
          .from('categories')
          .insert({
            ...data,
            user_id: user.id,
          })
          .select()
          .single();

        if (error) throw error;
        if (inserted) {
          setCategories((prev) => [...prev, inserted]);
          return;
        }
      } catch (err) {
        console.warn('Error al crear categoría en Supabase:', err);
      }
    }

    const newCat: Category = {
      ...data,
      id: 'cat-' + Date.now(),
    };
    setCategories((prev) => [...prev, newCat]);
  };

  const addBudget = async (data: Omit<Budget, 'id'>) => {
    if (isSupabaseConfigured && supabase && user) {
      try {
        const { data: inserted, error } = await supabase
          .from('budgets')
          .insert({
            ...data,
            user_id: user.id,
          })
          .select()
          .single();

        if (error) throw error;
        if (inserted) {
          setBudgets((prev) => [...prev, inserted]);
          return;
        }
      } catch (err) {
        console.warn('Error al crear presupuesto en Supabase:', err);
      }
    }

    const newBudget: Budget = {
      ...data,
      id: 'bg-' + Date.now(),
    };
    setBudgets((prev) => [...prev, newBudget]);
  };

  const deleteBudget = async (id: string) => {
    setBudgets((prev) => prev.filter((b) => b.id !== id));
    if (isSupabaseConfigured && supabase) {
      try {
        await supabase.from('budgets').delete().eq('id', id);
      } catch (err) {
        console.warn('Error al eliminar presupuesto en Supabase:', err);
      }
    }
  };

  const addGoal = async (data: Omit<SavingsGoal, 'id'>) => {
    if (isSupabaseConfigured && supabase && user) {
      try {
        const { data: inserted, error } = await supabase
          .from('savings_goals')
          .insert({
            ...data,
            user_id: user.id,
          })
          .select()
          .single();

        if (error) throw error;
        if (inserted) {
          setGoals((prev) => [...prev, inserted]);
          return;
        }
      } catch (err) {
        console.warn('Error al crear meta en Supabase:', err);
      }
    }

    const newGoal: SavingsGoal = {
      ...data,
      id: 'goal-' + Date.now(),
      created_at: new Date().toISOString(),
    };
    setGoals((prev) => [...prev, newGoal]);
  };

  const updateGoalProgress = async (id: string, deltaMonto: number) => {
    const currentGoal = goals.find((g) => g.id === id);
    if (!currentGoal) return;
    const nuevoMonto = Math.max(0, (Number(currentGoal.monto_actual) || 0) + deltaMonto);

    setGoals((prev) =>
      prev.map((g) => (g.id === id ? { ...g, monto_actual: nuevoMonto } : g))
    );

    if (isSupabaseConfigured && supabase) {
      try {
        await supabase
          .from('savings_goals')
          .update({ monto_actual: nuevoMonto })
          .eq('id', id);
      } catch (err) {
        console.warn('Error al actualizar meta en Supabase:', err);
      }
    }
  };

  const deleteGoal = async (id: string) => {
    setGoals((prev) => prev.filter((g) => g.id !== id));
    if (isSupabaseConfigured && supabase) {
      try {
        await supabase.from('savings_goals').delete().eq('id', id);
      } catch (err) {
        console.warn('Error al eliminar meta en Supabase:', err);
      }
    }
  };

  const transferFunds = async (
    fromAccountId: string,
    toAccountId: string,
    amountFrom: number,
    amountTo: number,
    nota?: string
  ) => {
    const fromAcc = accounts.find((a) => a.id === fromAccountId);
    const toAcc = accounts.find((a) => a.id === toAccountId);
    if (!fromAcc || !toAcc) return;

    const nowIso = new Date().toISOString();
    const rateUsed = amountTo > 0 ? amountFrom / amountTo : 1;

    await addTransaction({
      account_id: fromAccountId,
      tipo: 'gasto',
      monto: amountFrom,
      moneda: fromAcc.moneda,
      monto_ves: convert(amountFrom, fromAcc.moneda, 'VES'),
      tasa_cambio: rateUsed,
      fecha: nowIso,
      nota: `Transferencia hacia ${toAcc.nombre}${nota ? ` (${nota})` : ''}`,
    });

    await addTransaction({
      account_id: toAccountId,
      tipo: 'ingreso',
      monto: amountTo,
      moneda: toAcc.moneda,
      monto_ves: convert(amountTo, toAcc.moneda, 'VES'),
      tasa_cambio: rateUsed,
      fecha: nowIso,
      nota: `Transferencia recibida desde ${fromAcc.nombre}${nota ? ` (${nota})` : ''}`,
    });
  };

  const seedSupabaseDemoData = async () => {
    if (!isSupabaseConfigured || !supabase || !user) return;
    setIsLoading(true);
    try {
      // 1. Insert accounts
      for (const acc of INITIAL_ACCOUNTS) {
        await supabase.from('accounts').insert({
          user_id: user.id,
          nombre: acc.nombre,
          tipo: acc.tipo,
          moneda: acc.moneda,
          saldo_inicial: acc.saldo_inicial,
          color: acc.color,
          descripcion: acc.descripcion,
          activo: true,
        });
      }

      // 2. Insert goals
      for (const goal of INITIAL_GOALS) {
        await supabase.from('savings_goals').insert({
          user_id: user.id,
          nombre: goal.nombre,
          monto_objetivo: goal.monto_objetivo,
          monto_actual: goal.monto_actual,
          moneda: goal.moneda,
          fecha_meta: goal.fecha_meta,
          color: goal.color,
        });
      }

      await loadSupabaseData(user.id);
    } catch (e) {
      console.error('Error sembrando datos en Supabase:', e);
    } finally {
      setIsLoading(false);
    }
  };

  const resetToDefaultData = async () => {
    if (isSupabaseConfigured && supabase && user) {
      await seedSupabaseDemoData();
      return;
    }
    setAccounts(INITIAL_ACCOUNTS);
    setCategories(INITIAL_CATEGORIES);
    setTransactions(INITIAL_TRANSACTIONS);
    setBudgets(INITIAL_BUDGETS);
    setGoals(INITIAL_GOALS);
    setRates(INITIAL_RATES);
    setActiveRateSource('BCV');
  };

  const loginUser = (email: string, id?: string) => {
    const userId = id || 'demo-user-' + Date.now();
    const newUser = { email, id: userId };
    setUser(newUser);
    if (typeof window !== 'undefined') {
      localStorage.setItem(STORAGE_KEYS.USER, JSON.stringify(newUser));
    }
    if (isSupabaseConfigured && id) {
      loadSupabaseData(id);
    }
  };

  const logoutUser = async () => {
    setIsLoading(true);
    try {
      if (isSupabaseConfigured && supabase) {
        await supabase.auth.signOut();
      }
      if (typeof window !== 'undefined') {
        localStorage.removeItem(STORAGE_KEYS.USER);
      }
    } catch (e) {
      console.warn('Error al cerrar sesión:', e);
    } finally {
      setUser(null);
      setAccounts([]);
      setTransactions([]);
      setBudgets([]);
      setGoals([]);
      setIsLoading(false);
    }
  };

  const refreshSupabaseData = async () => {
    if (user) {
      await loadSupabaseData(user.id);
    }
  };

  return (
    <FinanceContext.Provider
      value={{
        accounts: computedAccounts,
        categories,
        transactions,
        budgets,
        goals,
        rates,
        liveQuotes,
        isSyncingRates,
        lastRatesSync,
        activeRateSource,
        preferredViewCurrency,
        isSupabaseMode: isSupabaseConfigured,
        user,
        isLoading,
        setPreferredViewCurrency,
        setActiveRateSource: handleSetActiveRateSource,
        updateRate,
        syncLiveRates,
        convert,
        addTransaction,
        deleteTransaction,
        addAccount,
        updateAccount,
        deleteAccount,
        addCategory,
        addBudget,
        deleteBudget,
        addGoal,
        updateGoalProgress,
        deleteGoal,
        transferFunds,
        resetToDefaultData,
        seedSupabaseDemoData,
        loginUser,
        logoutUser,
        refreshSupabaseData,
        summary,
      }}
    >
      {children}
    </FinanceContext.Provider>
  );
};

export const useFinance = () => {
  const context = useContext(FinanceContext);
  if (!context) {
    throw new Error('useFinance must be used within a FinanceProvider');
  }
  return context;
};
