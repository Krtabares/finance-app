-- =========================================================
-- MIGRACIÓN: MÓDULO DE DEUDAS, PRÉSTAMOS Y CUOTAS (MULTIDIVISA)
-- Ejecutar en el SQL Editor de tu proyecto Supabase
-- =========================================================

-- 1. TABLA: debts (Deudas y Préstamos contraídos)
CREATE TABLE IF NOT EXISTS public.debts (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    nombre VARCHAR(120) NOT NULL,
    acreedor VARCHAR(120) NOT NULL,
    moneda VARCHAR(10) NOT NULL DEFAULT 'USD', -- 'USD', 'VES', 'USDT', 'EUR'
    monto_total NUMERIC(18, 4) NOT NULL, -- Capital inicial prestado
    saldo_pendiente NUMERIC(18, 4) NOT NULL, -- Capital restante
    num_cuotas INTEGER NOT NULL CHECK (num_cuotas > 0),
    frecuencia VARCHAR(20) NOT NULL CHECK (frecuencia IN ('semanal', 'quincenal', 'mensual')),
    fecha_inicio DATE NOT NULL, -- Fecha de vencimiento de la primera cuota
    tipo_calculo VARCHAR(20) NOT NULL DEFAULT 'simple' CHECK (tipo_calculo IN ('simple', 'amortizado')),
    tasa_interes NUMERIC(8, 4) NOT NULL DEFAULT 0, -- % por período
    monto_cuota NUMERIC(18, 4) NOT NULL, -- Monto regular calculado
    category_id UUID REFERENCES public.categories(id) ON DELETE SET NULL,
    account_id UUID REFERENCES public.accounts(id) ON DELETE SET NULL,
    descripcion TEXT,
    estado VARCHAR(20) NOT NULL DEFAULT 'activa' CHECK (estado IN ('activa', 'pagada')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

-- 2. TABLA: debt_installments (Calendario de Cuotas)
CREATE TABLE IF NOT EXISTS public.debt_installments (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    debt_id UUID NOT NULL REFERENCES public.debts(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    numero INTEGER NOT NULL CHECK (numero > 0),
    fecha_vencimiento DATE NOT NULL,
    monto NUMERIC(18, 4) NOT NULL, -- Monto total de la cuota
    monto_capital NUMERIC(18, 4) NOT NULL DEFAULT 0,
    monto_interes NUMERIC(18, 4) NOT NULL DEFAULT 0,
    monto_pagado NUMERIC(18, 4) NOT NULL DEFAULT 0,
    estado VARCHAR(20) NOT NULL DEFAULT 'pendiente' CHECK (estado IN ('pendiente', 'parcial', 'pagada')),
    fecha_pago TIMESTAMPTZ,
    transaction_id UUID REFERENCES public.transactions(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    CONSTRAINT unique_debt_installment_num UNIQUE (debt_id, numero)
);

-- 3. TABLA: debt_payments (Historial de Pagos y Abonos)
CREATE TABLE IF NOT EXISTS public.debt_payments (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    debt_id UUID NOT NULL REFERENCES public.debts(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    installment_id UUID REFERENCES public.debt_installments(id) ON DELETE SET NULL,
    transaction_id UUID REFERENCES public.transactions(id) ON DELETE SET NULL,
    account_id UUID NOT NULL REFERENCES public.accounts(id) ON DELETE RESTRICT,
    monto NUMERIC(18, 4) NOT NULL,
    moneda VARCHAR(10) NOT NULL DEFAULT 'USD',
    tasa_cambio NUMERIC(18, 4) NOT NULL DEFAULT 1.0,
    fecha TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    nota TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

-- 4. ÍNDICES
CREATE INDEX IF NOT EXISTS idx_debts_user ON public.debts(user_id);
CREATE INDEX IF NOT EXISTS idx_debt_installments_debt ON public.debt_installments(debt_id);
CREATE INDEX IF NOT EXISTS idx_debt_installments_user ON public.debt_installments(user_id);
CREATE INDEX IF NOT EXISTS idx_debt_installments_vencimiento ON public.debt_installments(fecha_vencimiento);
CREATE INDEX IF NOT EXISTS idx_debt_payments_debt ON public.debt_payments(debt_id);
CREATE INDEX IF NOT EXISTS idx_debt_payments_user ON public.debt_payments(user_id);

-- 5. POLÍTICAS RLS (Row Level Security)
ALTER TABLE public.debts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.debt_installments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.debt_payments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage their own debts"
    ON public.debts FOR ALL
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can manage their own debt installments"
    ON public.debt_installments FOR ALL
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can manage their own debt payments"
    ON public.debt_payments FOR ALL
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);

-- 6. Insertar categoría "Deudas y Préstamos" para usuarios existentes que no la tengan
INSERT INTO public.categories (user_id, nombre, tipo, color, icono)
SELECT u.id, 'Deudas y Préstamos', 'gasto', '#ef4444', 'credit-card'
FROM auth.users u
WHERE NOT EXISTS (
    SELECT 1 FROM public.categories c
    WHERE c.user_id = u.id AND c.nombre = 'Deudas y Préstamos'
);
