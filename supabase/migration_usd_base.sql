-- =========================================================
-- MIGRACIÓN: BASE EN USD Y CÁLCULOS EN BS
-- Ejecutar en: Supabase Dashboard -> SQL Editor -> New Query
-- =========================================================

-- 1. Agregar la columna monto_usd a la tabla transactions si no existe
ALTER TABLE public.transactions 
ADD COLUMN IF NOT EXISTS monto_usd NUMERIC(18, 4) DEFAULT 0;

-- 2. Actualizar las transacciones existentes que tengan monto_usd en 0 o NULL
-- - Si la moneda es USD o USDT: monto_usd = monto
-- - Si es VES: monto_usd = monto / tasa_cambio (o tasa de respaldo si tasa_cambio era 1.0)
UPDATE public.transactions
SET monto_usd = CASE 
    WHEN moneda IN ('USD', 'USDT') THEN monto
    WHEN moneda = 'VES' AND tasa_cambio > 1.0 THEN ROUND(monto / tasa_cambio, 4)
    WHEN moneda = 'VES' AND (tasa_cambio <= 1.0 OR tasa_cambio IS NULL) THEN ROUND(monto / 450.0, 4)
    ELSE monto
END
WHERE monto_usd IS NULL OR monto_usd = 0;

-- 3. Si tienes presupuestos existentes guardados en Bolívares (> 500), convertirlos a USD
UPDATE public.budgets
SET monto_limite = ROUND(monto_limite / 450.0, 2)
WHERE monto_limite > 500;

-- 4. Notificar que la migración finalizó exitosamente
SELECT 'Migración completada exitosamente. Las tablas ahora guardan en USD como base.' AS resultado;
