'use client';

import React, { useState } from 'react';
import {
  ArrowLeftRight,
  TrendingUp,
  RefreshCw,
  Check,
  Calculator,
  ShieldCheck,
  Zap,
  Globe,
  Sparkles,
  Clock,
  Coins,
} from 'lucide-react';
import { useFinance } from '@/context/FinanceContext';
import { Currency, RateSource } from '@/types/finance';
import { formatCurrency } from '@/lib/formatters';

export const RatesView: React.FC = () => {
  const {
    rates,
    liveQuotes,
    isSyncingRates,
    lastRatesSync,
    activeRateSource,
    setActiveRateSource,
    updateRate,
    syncLiveRates,
    convert,
  } = useFinance();

  // Converter state
  const [calcAmount, setCalcAmount] = useState('100');
  const [calcFrom, setCalcFrom] = useState<Currency>('USD');
  const [calcTo, setCalcTo] = useState<Currency>('VES');

  // Rate edit form state
  const [editCurrency, setEditCurrency] = useState<Currency>('USD');
  const [editRateValue, setEditRateValue] = useState('');
  const [editSource, setEditSource] = useState<RateSource>('BCV');
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [syncStatusMsg, setSyncStatusMsg] = useState<string | null>(null);

  // Conversion calculation
  const parsedCalcAmount = parseFloat(calcAmount) || 0;
  const convertedResult = convert(parsedCalcAmount, calcFrom, calcTo);

  const handleSwap = () => {
    setCalcFrom(calcTo);
    setCalcTo(calcFrom);
  };

  const handleSaveRate = async (e: React.FormEvent) => {
    e.preventDefault();
    const val = parseFloat(editRateValue);
    if (isNaN(val) || val <= 0) {
      alert('Ingresa una tasa válida en Bolívares.');
      return;
    }

    await updateRate(editCurrency, val, editSource);
    setEditRateValue('');
    setSaveSuccess(true);
    setTimeout(() => setSaveSuccess(false), 2500);
  };

  const handleSyncClick = async () => {
    const res = await syncLiveRates();
    if (res.success) {
      setSyncStatusMsg('¡Tasas sincronizadas en vivo!');
    } else {
      setSyncStatusMsg(res.message || 'Error al sincronizar');
    }
    setTimeout(() => setSyncStatusMsg(null), 3500);
  };

  const handleApplyQuickRate = (moneda: Currency, valor: number, fuente: RateSource) => {
    updateRate(moneda, valor, fuente);
    if (moneda === 'USD') {
      setActiveRateSource(fuente);
    }
    setSyncStatusMsg(`Tasa ${fuente} (${formatCurrency(valor, 'VES')}) aplicada al sistema`);
    setTimeout(() => setSyncStatusMsg(null), 3000);
  };

  const usdRateCurrent = rates.find((r) => r.moneda === 'USD');

  // Definición de las cotizaciones en vivo disponibles
  const liveCards = [
    {
      id: 'bcv',
      titulo: 'Dólar Oficial BCV',
      subtitulo: 'Banco Central de Venezuela',
      moneda: 'USD' as Currency,
      fuente: 'BCV' as RateSource,
      valor: liveQuotes?.bcv || usdRateCurrent?.tasa_a_ves || 876.80,
      badgeColor: 'badge-emerald',
      icon: ShieldCheck,
      isActive: usdRateCurrent?.fuente === 'BCV',
    },
    {
      id: 'paralelo',
      titulo: 'Dólar Paralelo',
      subtitulo: 'EnParaleloVzla / Monitor',
      moneda: 'USD' as Currency,
      fuente: 'Paralelo' as RateSource,
      valor: liveQuotes?.paralelo || 1004.87,
      badgeColor: 'badge-indigo',
      icon: TrendingUp,
      isActive: usdRateCurrent?.fuente === 'Paralelo',
    },
    {
      id: 'usdt',
      titulo: 'Tether USDT (P2P)',
      subtitulo: 'Binance P2P / Cripto Market',
      moneda: 'USDT' as Currency,
      fuente: 'Binance P2P' as RateSource,
      valor: liveQuotes?.usdt_p2p || rates.find((r) => r.moneda === 'USDT')?.tasa_a_ves || 1001.25,
      badgeColor: 'badge-amber',
      icon: Coins,
      isActive: true,
    },
    {
      id: 'eur',
      titulo: 'Euro Oficial (EUR)',
      subtitulo: 'Cotización Oficial / Yadio',
      moneda: 'EUR' as Currency,
      fuente: 'BCV' as RateSource,
      valor: liveQuotes?.eur || rates.find((r) => r.moneda === 'EUR')?.tasa_a_ves || 1121.01,
      badgeColor: 'badge-indigo',
      icon: Globe,
      isActive: true,
    },
  ];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      {/* Top Header & Live Sync Bar */}
      <div
        className="glass-panel"
        style={{
          padding: '24px',
          display: 'flex',
          flexWrap: 'wrap',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: '16px',
        }}
      >
        <div style={{ maxWidth: '640px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px' }}>
            <span className="badge badge-emerald" style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
              <Zap size={13} /> Integración en Vivo
            </span>
            <span style={{ fontSize: '0.76rem', color: 'var(--text-dim)' }}>
              DolarApi • Yadio.io • BCV
            </span>
          </div>

          <h3 style={{ fontSize: '1.35rem', fontWeight: 800, color: 'var(--text-main)', letterSpacing: '-0.02em' }}>
            Tasas de Cambio en Vivo & Conversor VES
          </h3>
          <p style={{ fontSize: '0.86rem', color: 'var(--text-muted)', marginTop: '4px' }}>
            Cotizaciones oficiales y de mercado en tiempo real para calibrar el valor real de tu patrimonio en Bolívares.
          </p>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '8px' }}>
          <button
            type="button"
            className="btn-primary"
            onClick={handleSyncClick}
            disabled={isSyncingRates}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '8px',
              padding: '10px 18px',
              fontSize: '0.88rem',
              fontWeight: 600,
              boxShadow: 'var(--shadow-glow)',
            }}
          >
            <RefreshCw size={16} className={isSyncingRates ? 'spin' : ''} />
            {isSyncingRates ? 'Sincronizando Tasas...' : 'Sincronizar Tasas en Vivo'}
          </button>

          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.76rem', color: 'var(--text-dim)' }}>
            <Clock size={12} />
            <span>Última sincronización: </span>
            <strong style={{ color: 'var(--text-muted)' }}>
              {lastRatesSync || 'Reciente'}
            </strong>
          </div>
        </div>
      </div>

      {/* Alerta de Estado / Notificación */}
      {syncStatusMsg && (
        <div
          style={{
            padding: '12px 16px',
            background: 'var(--accent-emerald-bg)',
            border: '1px solid var(--accent-emerald-glow)',
            borderRadius: 'var(--radius-md)',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            fontSize: '0.85rem',
            color: 'var(--accent-emerald)',
            animation: 'fadeIn 0.2s ease',
          }}
        >
          <Sparkles size={16} />
          <span>{syncStatusMsg}</span>
        </div>
      )}

      {/* Grid de Cotizaciones en Vivo */}
      <div>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
          <h4 style={{ fontSize: '0.95rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
            Mercado Cambiario en Venezuela
          </h4>
          <span style={{ fontSize: '0.78rem', color: 'var(--text-dim)' }}>
            Haz clic en &quot;Activar&quot; para cambiar la referencia de cálculo
          </span>
        </div>

        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))',
            gap: '16px',
          }}
        >
          {liveCards.map((card) => {
            const Icon = card.icon;
            return (
              <div
                key={card.id}
                className="glow-card"
                style={{
                  background: 'var(--bg-card)',
                  border: card.isActive && card.moneda === 'USD'
                    ? '1.5px solid var(--accent-primary)'
                    : '1px solid var(--border-subtle)',
                  borderRadius: 'var(--radius-lg)',
                  padding: '20px',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '12px',
                  position: 'relative',
                  boxShadow: card.isActive && card.moneda === 'USD' ? '0 0 20px rgba(99, 102, 241, 0.2)' : undefined,
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <div
                      style={{
                        padding: '6px',
                        borderRadius: 'var(--radius-sm)',
                        background: 'rgba(255, 255, 255, 0.05)',
                        color: 'var(--text-main)',
                      }}
                    >
                      <Icon size={18} />
                    </div>
                    <div>
                      <div style={{ fontSize: '0.9rem', fontWeight: 700, color: 'var(--text-main)' }}>
                        {card.titulo}
                      </div>
                      <div style={{ fontSize: '0.72rem', color: 'var(--text-dim)' }}>
                        {card.subtitulo}
                      </div>
                    </div>
                  </div>

                  <span className={`badge ${card.badgeColor}`}>
                    {card.fuente}
                  </span>
                </div>

                <div style={{ margin: '4px 0' }}>
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-dim)', marginBottom: '2px' }}>
                    1 {card.moneda} equivale a
                  </div>
                  <div style={{ fontSize: '1.75rem', fontWeight: 800, color: '#10b981', letterSpacing: '-0.02em' }}>
                    {formatCurrency(card.valor, 'VES')}
                  </div>
                </div>

                {card.moneda === 'USD' ? (
                  <button
                    type="button"
                    onClick={() => handleApplyQuickRate(card.moneda, card.valor, card.fuente)}
                    className={card.isActive ? 'btn-primary' : 'btn-secondary'}
                    style={{
                      marginTop: 'auto',
                      fontSize: '0.78rem',
                      padding: '7px 12px',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: '6px',
                    }}
                  >
                    {card.isActive ? (
                      <>
                        <Check size={14} /> Activa en Conversiones
                      </>
                    ) : (
                      <>Usar como Referencia USD</>
                    )}
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={() => handleApplyQuickRate(card.moneda, card.valor, card.fuente)}
                    className="btn-secondary"
                    style={{
                      marginTop: 'auto',
                      fontSize: '0.78rem',
                      padding: '7px 12px',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: '6px',
                    }}
                  >
                    <Check size={14} /> Tasa Aplicada al Sistema
                  </button>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Grid Inferior: Conversor y Ajuste Manual */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))',
          gap: '24px',
        }}
      >
        {/* Widget de Calculadora y Conversor en Tiempo Real */}
        <div
          className="glow-card"
          style={{
            background: 'var(--bg-card)',
            border: '1px solid var(--border-subtle)',
            borderRadius: 'var(--radius-lg)',
            padding: '24px',
            display: 'flex',
            flexDirection: 'column',
            gap: '18px',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Calculator size={20} color="var(--accent-primary)" />
              <h4 style={{ fontSize: '1.05rem', fontWeight: 700 }}>Calculadora Multidivisa VES</h4>
            </div>
            <span className="badge badge-indigo">
              Ref: {activeRateSource}
            </span>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
                <label style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                  Monto a Convertir
                </label>
                {/* Botones de Presets rápidos */}
                <div style={{ display: 'flex', gap: '4px' }}>
                  {['10', '50', '100', '500'].map((preset) => (
                    <button
                      key={preset}
                      type="button"
                      onClick={() => setCalcAmount(preset)}
                      style={{
                        background: 'rgba(255, 255, 255, 0.05)',
                        border: 'none',
                        color: 'var(--text-muted)',
                        padding: '2px 8px',
                        borderRadius: 'var(--radius-sm)',
                        fontSize: '0.72rem',
                        cursor: 'pointer',
                      }}
                    >
                      +{preset}
                    </button>
                  ))}
                </div>
              </div>

              <input
                type="number"
                step="any"
                className="input-field"
                value={calcAmount}
                onChange={(e) => setCalcAmount(e.target.value)}
                placeholder="0.00"
              />
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <div style={{ flex: 1 }}>
                <label style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '4px', display: 'block' }}>
                  De
                </label>
                <select
                  className="input-field"
                  value={calcFrom}
                  onChange={(e) => setCalcFrom(e.target.value as Currency)}
                >
                  <option value="USD">Dólar Americano (USD)</option>
                  <option value="USDT">Tether (USDT)</option>
                  <option value="VES">Bolívares (VES)</option>
                  <option value="EUR">Euros (EUR)</option>
                </select>
              </div>

              <button
                type="button"
                className="btn-icon"
                style={{ marginTop: '22px' }}
                onClick={handleSwap}
                title="Invertir monedas"
              >
                <ArrowLeftRight size={16} />
              </button>

              <div style={{ flex: 1 }}>
                <label style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '4px', display: 'block' }}>
                  Hacia
                </label>
                <select
                  className="input-field"
                  value={calcTo}
                  onChange={(e) => setCalcTo(e.target.value as Currency)}
                >
                  <option value="VES">Bolívares (VES)</option>
                  <option value="USD">Dólar Americano (USD)</option>
                  <option value="USDT">Tether (USDT)</option>
                  <option value="EUR">Euros (EUR)</option>
                </select>
              </div>
            </div>

            {/* Resultado Convertido */}
            <div
              style={{
                marginTop: '10px',
                background: 'rgba(10, 15, 26, 0.7)',
                padding: '18px',
                borderRadius: 'var(--radius-md)',
                border: '1px solid var(--border-subtle)',
                textAlign: 'center',
              }}
            >
              <div style={{ fontSize: '0.72rem', color: 'var(--text-dim)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                Resultado Estimado
              </div>
              <div style={{ fontSize: '1.8rem', fontWeight: 800, color: 'var(--accent-cyan)', margin: '6px 0' }}>
                {formatCurrency(convertedResult, calcTo)}
              </div>
              <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                {formatCurrency(parsedCalcAmount, calcFrom)} equivalen a {formatCurrency(convertedResult, calcTo)}
              </div>
            </div>
          </div>
        </div>

        {/* Formulario de Ajuste Manual de Tasas */}
        <div
          className="glow-card"
          style={{
            background: 'var(--bg-card)',
            border: '1px solid var(--border-subtle)',
            borderRadius: 'var(--radius-lg)',
            padding: '24px',
            display: 'flex',
            flexDirection: 'column',
            gap: '16px',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <TrendingUp size={20} color="#10b981" />
            <h4 style={{ fontSize: '1.05rem', fontWeight: 700 }}>Ajustar Tasa Manualmente</h4>
          </div>

          <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
            Si negocias a una cotización específica o particular, puedes establecer aquí un valor manual personalizado.
          </p>

          <form onSubmit={handleSaveRate} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
            <div>
              <label style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '4px', display: 'block' }}>
                Moneda
              </label>
              <select
                className="input-field"
                value={editCurrency}
                onChange={(e) => setEditCurrency(e.target.value as Currency)}
              >
                <option value="USD">Dólar Americano (USD)</option>
                <option value="USDT">Tether USDT (P2P)</option>
                <option value="EUR">Euro (EUR)</option>
              </select>
            </div>

            <div>
              <label style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '4px', display: 'block' }}>
                Nueva Tasa en Bolívares (VES por cada 1 {editCurrency})
              </label>
              <input
                type="number"
                step="any"
                className="input-field"
                placeholder="Ej: 880.00"
                value={editRateValue}
                onChange={(e) => setEditRateValue(e.target.value)}
                required
              />
            </div>

            <div>
              <label style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '4px', display: 'block' }}>
                Etiqueta / Fuente
              </label>
              <select
                className="input-field"
                value={editSource}
                onChange={(e) => setEditSource(e.target.value as RateSource)}
              >
                <option value="BCV">Banco Central de Venezuela (BCV)</option>
                <option value="Paralelo">Mercado Paralelo / Monitor</option>
                <option value="Binance P2P">Binance P2P (Mercado Cripto)</option>
                <option value="Manual">Ajuste Personal / Otro</option>
              </select>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginTop: '6px' }}>
              <button type="submit" className="btn-primary" style={{ flex: 1 }}>
                Guardar Tasa Personalizada
              </button>
              {saveSuccess && (
                <span
                  className="badge badge-emerald"
                  style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}
                >
                  <Check size={14} /> Guardada
                </span>
              )}
            </div>
          </form>

          {/* Selector de Fuente Activa */}
          <div
            style={{
              marginTop: '10px',
              paddingTop: '16px',
              borderTop: '1px solid var(--border-subtle)',
            }}
          >
            <div style={{ fontSize: '0.82rem', fontWeight: 600, color: 'var(--text-muted)', marginBottom: '8px' }}>
              Fuente de Referencia Activa para el Sistema:
            </div>
            <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
              {(['BCV', 'Paralelo', 'Binance P2P'] as RateSource[]).map((src) => (
                <button
                  key={src}
                  type="button"
                  className={activeRateSource === src ? 'btn-primary' : 'btn-secondary'}
                  style={{ fontSize: '0.8rem', padding: '6px 12px' }}
                  onClick={() => setActiveRateSource(src)}
                >
                  {src}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
