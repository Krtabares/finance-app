-- =========================================================
-- ESQUEMA DE BASE DE DATOS: APP DE FINANZAS PERSONALES (VES / MULTIDIVISA)
-- Ejecutar este script en el SQL Editor de Supabase
-- =========================================================

-- 1. Habilitar extensiones necesarias
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 2. TABLA: accounts (Cuentas financieras)
CREATE TABLE IF NOT EXISTS public.accounts (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    nombre VARCHAR(100) NOT NULL,
    tipo VARCHAR(30) NOT NULL CHECK (tipo IN ('banco', 'efectivo', 'cripto', 'wallet_digital', 'otro')),
    moneda VARCHAR(10) NOT NULL DEFAULT 'VES', -- 'VES', 'USD', 'USDT', 'EUR', etc.
    saldo_inicial NUMERIC(18, 4) NOT NULL DEFAULT 0,
    color VARCHAR(20) DEFAULT '#3b82f6',
    icono VARCHAR(30) DEFAULT 'wallet',
    descripcion TEXT,
    activo BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

-- 3. TABLA: categories (Categorías de gastos e ingresos)
CREATE TABLE IF NOT EXISTS public.categories (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    nombre VARCHAR(100) NOT NULL,
    tipo VARCHAR(20) NOT NULL CHECK (tipo IN ('ingreso', 'gasto')),
    color VARCHAR(20) DEFAULT '#10b981',
    icono VARCHAR(30) DEFAULT 'tag',
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

-- 4. TABLA: exchange_rates (Tasas de cambio con respecto a VES)
CREATE TABLE IF NOT EXISTS public.exchange_rates (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE, -- Si es null, es tasa global del sistema
    moneda VARCHAR(10) NOT NULL, -- 'USD', 'USDT', 'EUR'
    tasa_a_ves NUMERIC(18, 4) NOT NULL, -- 1 Unidad de Moneda = X Bolívares
    fuente VARCHAR(50) DEFAULT 'BCV', -- 'BCV', 'Paralelo', 'Binance P2P', 'Manual'
    fecha DATE NOT NULL DEFAULT CURRENT_DATE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

-- 5. TABLA: transactions (Transacciones de ingreso y gasto)
CREATE TABLE IF NOT EXISTS public.transactions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    account_id UUID NOT NULL REFERENCES public.accounts(id) ON DELETE CASCADE,
    category_id UUID REFERENCES public.categories(id) ON DELETE SET NULL,
    tipo VARCHAR(20) NOT NULL CHECK (tipo IN ('ingreso', 'gasto')),
    monto NUMERIC(18, 4) NOT NULL,
    moneda VARCHAR(10) NOT NULL DEFAULT 'VES',
    monto_ves NUMERIC(18, 4) NOT NULL, -- Monto equivalente calculado a la tasa del momento
    tasa_cambio NUMERIC(18, 4) DEFAULT 1.0, -- Tasa usada al momento del registro
    fecha TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    nota TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

-- 6. TABLA: transfers (Transferencias entre cuentas del usuario)
CREATE TABLE IF NOT EXISTS public.transfers (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    from_account_id UUID NOT NULL REFERENCES public.accounts(id) ON DELETE RESTRICT,
    to_account_id UUID NOT NULL REFERENCES public.accounts(id) ON DELETE RESTRICT,
    monto_origen NUMERIC(18, 4) NOT NULL,
    monto_destino NUMERIC(18, 4) NOT NULL,
    tasa_cambio NUMERIC(18, 4) DEFAULT 1.0, -- Tasa aplicada si hay conversión de moneda
    fecha TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    nota TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

-- 7. TABLA: budgets (Presupuestos mensuales por categoría)
CREATE TABLE IF NOT EXISTS public.budgets (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    category_id UUID NOT NULL REFERENCES public.categories(id) ON DELETE CASCADE,
    mes VARCHAR(7) NOT NULL, -- Formato 'YYYY-MM'
    monto_limite NUMERIC(18, 4) NOT NULL, -- En VES
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    CONSTRAINT unique_user_category_month UNIQUE(user_id, category_id, mes)
);

-- 8. TABLA: savings_goals (Metas de ahorro)
CREATE TABLE IF NOT EXISTS public.savings_goals (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    nombre VARCHAR(100) NOT NULL,
    monto_objetivo NUMERIC(18, 4) NOT NULL,
    monto_actual NUMERIC(18, 4) NOT NULL DEFAULT 0,
    moneda VARCHAR(10) NOT NULL DEFAULT 'VES',
    fecha_meta DATE,
    account_id UUID REFERENCES public.accounts(id) ON DELETE SET NULL,
    color VARCHAR(20) DEFAULT '#06b6d4',
    icono VARCHAR(30) DEFAULT 'target',
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

-- =========================================================
-- ÍNDICES PARA ALTO RENDIMIENTO
-- =========================================================
CREATE INDEX IF NOT EXISTS idx_accounts_user ON public.accounts(user_id);
CREATE INDEX IF NOT EXISTS idx_categories_user ON public.categories(user_id);
CREATE INDEX IF NOT EXISTS idx_transactions_user ON public.transactions(user_id);
CREATE INDEX IF NOT EXISTS idx_transactions_date ON public.transactions(fecha);
CREATE INDEX IF NOT EXISTS idx_transactions_account ON public.transactions(account_id);
CREATE INDEX IF NOT EXISTS idx_transfers_user ON public.transfers(user_id);
CREATE INDEX IF NOT EXISTS idx_budgets_user_mes ON public.budgets(user_id, mes);
CREATE INDEX IF NOT EXISTS idx_savings_goals_user ON public.savings_goals(user_id);

-- =========================================================
-- ROW LEVEL SECURITY (RLS) POLICIES
-- =========================================================
ALTER TABLE public.accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.exchange_rates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.transfers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.budgets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.savings_goals ENABLE ROW LEVEL SECURITY;

-- Políticas para accounts
CREATE POLICY "Users can manage their own accounts"
    ON public.accounts FOR ALL
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);

-- Políticas para categories
CREATE POLICY "Users can manage their own categories"
    ON public.categories FOR ALL
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);

-- Políticas para exchange_rates
CREATE POLICY "Users can view and manage their rates or global rates"
    ON public.exchange_rates FOR ALL
    USING (user_id IS NULL OR auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);

-- Políticas para transactions
CREATE POLICY "Users can manage their own transactions"
    ON public.transactions FOR ALL
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);

-- Políticas para transfers
CREATE POLICY "Users can manage their own transfers"
    ON public.transfers FOR ALL
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);

-- Políticas para budgets
CREATE POLICY "Users can manage their own budgets"
    ON public.budgets FOR ALL
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);

-- Políticas para savings_goals
CREATE POLICY "Users can manage their own savings goals"
    ON public.savings_goals FOR ALL
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);

-- =========================================================
-- TRIGGER PARA CREAR CATEGORÍAS POR DEFECTO PARA NUEVOS USUARIOS
-- =========================================================
CREATE OR REPLACE FUNCTION public.handle_new_user_categories()
RETURNS trigger AS $$
BEGIN
    -- Categorías de Gasto por defecto
    INSERT INTO public.categories (user_id, nombre, tipo, color, icono) VALUES
    (NEW.id, 'Alimentación y Supermercado', 'gasto', '#f97316', 'shopping-cart'),
    (NEW.id, 'Servicios y Facturas', 'gasto', '#06b6d4', 'zap'),
    (NEW.id, 'Transporte y Gasolina', 'gasto', '#eab308', 'car'),
    (NEW.id, 'Salud y Farmacia', 'gasto', '#ef4444', 'activity'),
    (NEW.id, 'Entretenimiento y Ocio', 'gasto', '#8b5cf6', 'tv'),
    (NEW.id, 'Educación', 'gasto', '#3b82f6', 'book'),
    (NEW.id, 'Otros Gastos', 'gasto', '#64748b', 'more-horizontal');

    -- Categorías de Ingreso por defecto
    INSERT INTO public.categories (user_id, nombre, tipo, color, icono) VALUES
    (NEW.id, 'Sueldo / Nómina', 'ingreso', '#10b981', 'briefcase'),
    (NEW.id, 'Freelance / Ventas', 'ingreso', '#14b8a6', 'trending-up'),
    (NEW.id, 'Remesas', 'ingreso', '#6366f1', 'send'),
    (NEW.id, 'Inversiones y Cripto', 'ingreso', '#f59e0b', 'bitcoin'),
    (NEW.id, 'Otros Ingresos', 'ingreso', '#84cc16', 'plus-circle');

    -- Tasas iniciales por defecto para el usuario
    INSERT INTO public.exchange_rates (user_id, moneda, tasa_a_ves, fuente, fecha) VALUES
    (NEW.id, 'USD', 450.00, 'BCV', CURRENT_DATE),
    (NEW.id, 'USDT', 495.00, 'Binance P2P', CURRENT_DATE),
    (NEW.id, 'EUR', 490.00, 'BCV', CURRENT_DATE);

    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Disparador después de crear un usuario en auth.users
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW EXECUTE FUNCTION public.handle_new_user_categories();
