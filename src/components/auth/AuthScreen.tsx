'use client';

import React, { useState } from 'react';
import {
  TrendingUp,
  ShieldCheck,
  Zap,
  DollarSign,
  Mail,
  Lock,
  Eye,
  EyeOff,
  UserPlus,
  LogIn,
  AlertCircle,
  CheckCircle2,
  Sparkles,
  ArrowRight,
  Database,
  User,
} from 'lucide-react';
import styles from './AuthScreen.module.css';
import { supabase, isSupabaseConfigured } from '@/lib/supabase';
import { useFinance } from '@/context/FinanceContext';

export const AuthScreen: React.FC = () => {
  const { loginUser, isSupabaseMode } = useFinance();
  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');
    setSuccessMsg('');

    if (mode === 'register') {
      if (password.length < 6) {
        setErrorMsg('La contraseña debe tener un mínimo de 6 caracteres.');
        return;
      }
      if (password !== confirmPassword) {
        setErrorMsg('Las contraseñas no coinciden.');
        return;
      }
    }

    setIsLoading(true);

    try {
      if (!isSupabaseConfigured || !supabase) {
        // Modo local sin Supabase configurado
        loginUser(email.trim());
        setSuccessMsg('Acceso local concedido. ¡Bienvenido!');
        return;
      }

      if (mode === 'register') {
        const { data, error } = await supabase.auth.signUp({
          email: email.trim(),
          password,
        });

        if (error) {
          if (error.message.includes('User already registered')) {
            throw new Error('Este correo ya está registrado. Por favor selecciona Iniciar Sesión.');
          }
          throw error;
        }

        if (data.user) {
          if (data.session) {
            setSuccessMsg('¡Cuenta creada con éxito! Ingresando a tu panel...');
            loginUser(data.user.email || email.trim(), data.user.id);
          } else {
            setSuccessMsg(
              'Registro completado. Si tu proyecto Supabase tiene confirmación de email activada, por favor revisa tu bandeja de entrada.'
            );
          }
        }
      } else {
        // Iniciar Sesión
        const { data, error } = await supabase.auth.signInWithPassword({
          email: email.trim(),
          password,
        });

        if (error) {
          if (error.message.includes('Invalid login credentials')) {
            throw new Error('Correo o contraseña incorrectos. Verifica tus credenciales o crea una cuenta.');
          }
          throw error;
        }

        if (data.user) {
          setSuccessMsg('¡Sesión iniciada con éxito! Sincronizando tus finanzas...');
          loginUser(data.user.email || email.trim(), data.user.id);
        }
      }
    } catch (err: any) {
      setErrorMsg(err.message || 'Ocurrió un error al procesar la solicitud.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleDemoAccess = () => {
    setIsLoading(true);
    setErrorMsg('');
    setSuccessMsg('Iniciando en modo Demo Local...');
    setTimeout(() => {
      loginUser('demo@bolivarfinance.ve', 'local-demo-user');
    }, 400);
  };

  return (
    <div className={styles.authWrapper}>
      <div className={styles.glowBlob1} />
      <div className={styles.glowBlob2} />

      <div className={styles.authContainer}>
        {/* Columna Izquierda: Presentación y Beneficios */}
        <div className={styles.heroSection}>
          <div className={styles.brandGroup}>
            <div className={styles.brandBadgeHeader}>
              <TrendingUp size={14} />
              <span>BolívarFinance • Finanzas Inteligentes</span>
            </div>

            <h1 className={styles.brandTitle}>
              Toma el control de tu dinero <span className={styles.brandHighlight}>multidivisa</span>.
            </h1>

            <p className={styles.brandTagline}>
              Gestiona Bolívares (VES), Dólares (USD) y Cripto (USDT) en tiempo real con tasas oficiales BCV y mercado paralelo.
            </p>

            <div className={styles.featureList}>
              <div className={styles.featureItem}>
                <div className={styles.featureIconBox}>
                  <DollarSign size={20} />
                </div>
                <div className={styles.featureText}>
                  <h4>Multidivisa Total</h4>
                  <p>Cuentas en VES, USD, EUR y USDT con conversión instantánea y unificada.</p>
                </div>
              </div>

              <div className={styles.featureItem}>
                <div className={styles.featureIconBox}>
                  <Zap size={20} />
                </div>
                <div className={styles.featureText}>
                  <h4>Tasas de Cambio en Vivo</h4>
                  <p>Monitoreo diario de la tasa oficial BCV y P2P para que nunca pierdas valor.</p>
                </div>
              </div>

              <div className={styles.featureItem}>
                <div className={styles.featureIconBox}>
                  <ShieldCheck size={20} />
                </div>
                <div className={styles.featureText}>
                  <h4>Base de Datos en la Nube</h4>
                  <p>Tus cuentas, presupuestos y metas protegidos y sincronizados en PostgreSQL Supabase.</p>
                </div>
              </div>
            </div>
          </div>

          <div className={styles.heroFooter}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Database size={15} style={{ color: isSupabaseMode ? '#10b981' : '#818cf8' }} />
              <span>
                {isSupabaseMode ? 'Supabase Cloud Conectado' : 'Almacenamiento Local Activo'}
              </span>
            </div>
            <span>v1.0.0</span>
          </div>
        </div>

        {/* Columna Derecha: Formulario de Autenticación */}
        <div className={styles.formSection}>
          <div className={styles.formHeader}>
            <h2>{mode === 'login' ? 'Iniciar Sesión' : 'Crear Cuenta'}</h2>
            <p>
              {mode === 'login'
                ? 'Ingresa tus credenciales para acceder a todas las funciones financieras.'
                : 'Regístrate para guardar y sincronizar tus finanzas de forma segura.'}
            </p>
          </div>

          {/* Selector de Pestañas */}
          <div className={styles.tabsContainer}>
            <button
              type="button"
              className={`${styles.tabBtn} ${mode === 'login' ? styles.tabBtnActive : ''}`}
              onClick={() => {
                setMode('login');
                setErrorMsg('');
                setSuccessMsg('');
              }}
            >
              <LogIn size={16} />
              Iniciar Sesión
            </button>
            <button
              type="button"
              className={`${styles.tabBtn} ${mode === 'register' ? styles.tabBtnActive : ''}`}
              onClick={() => {
                setMode('register');
                setErrorMsg('');
                setSuccessMsg('');
              }}
            >
              <UserPlus size={16} />
              Crear Cuenta
            </button>
          </div>

          {/* Alertas */}
          {errorMsg && (
            <div className={styles.errorAlert}>
              <AlertCircle size={18} style={{ flexShrink: 0 }} />
              <span>{errorMsg}</span>
            </div>
          )}

          {successMsg && (
            <div className={styles.successAlert}>
              <CheckCircle2 size={18} style={{ flexShrink: 0 }} />
              <span>{successMsg}</span>
            </div>
          )}

          {/* Formulario */}
          <form onSubmit={handleSubmit} className={styles.formBody}>
            <div className={styles.inputGroup}>
              <label className={styles.inputLabel}>Correo Electrónico</label>
              <div className={styles.inputWrapper}>
                <Mail size={16} className={styles.inputIcon} />
                <input
                  type="email"
                  className={styles.inputField}
                  placeholder="ejemplo@correo.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  autoFocus
                />
              </div>
            </div>

            <div className={styles.inputGroup}>
              <label className={styles.inputLabel}>Contraseña</label>
              <div className={styles.inputWrapper}>
                <Lock size={16} className={styles.inputIcon} />
                <input
                  type={showPassword ? 'text' : 'password'}
                  className={styles.inputField}
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  minLength={6}
                />
                <button
                  type="button"
                  className={styles.inputTogglePass}
                  onClick={() => setShowPassword(!showPassword)}
                  title={showPassword ? 'Ocultar contraseña' : 'Ver contraseña'}
                >
                  {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>

            {mode === 'register' && (
              <div className={styles.inputGroup}>
                <label className={styles.inputLabel}>Confirmar Contraseña</label>
                <div className={styles.inputWrapper}>
                  <Lock size={16} className={styles.inputIcon} />
                  <input
                    type={showPassword ? 'text' : 'password'}
                    className={styles.inputField}
                    placeholder="••••••••"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    required
                    minLength={6}
                  />
                </div>
              </div>
            )}

            <button
              type="submit"
              className={`btn-primary ${styles.submitBtn}`}
              disabled={isLoading}
            >
              {isLoading ? (
                <span>Cargando...</span>
              ) : mode === 'login' ? (
                <>
                  <LogIn size={18} />
                  <span>Ingresar a BolívarFinance</span>
                  <ArrowRight size={16} />
                </>
              ) : (
                <>
                  <UserPlus size={18} />
                  <span>Completar Registro</span>
                  <ArrowRight size={16} />
                </>
              )}
            </button>
          </form>

          <div className={styles.secondaryOptions}>
            <button
              type="button"
              className={styles.demoBtn}
              onClick={handleDemoAccess}
              disabled={isLoading}
            >
              <User size={15} />
              <span>Acceder con Cuenta Demo Invitado (Sin Registro)</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
