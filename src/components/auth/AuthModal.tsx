'use client';

import React, { useState } from 'react';
import { X, Lock, Mail, UserPlus, LogIn, Sparkles } from 'lucide-react';
import styles from './AuthModal.module.css';
import { supabase, isSupabaseConfigured } from '@/lib/supabase';
import { useFinance } from '@/context/FinanceContext';

interface AuthModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const AuthModal: React.FC<AuthModalProps> = ({ isOpen, onClose }) => {
  const { loginUser } = useFinance();
  const [isSignUp, setIsSignUp] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');
    setSuccessMsg('');
    setIsLoading(true);

    try {
      if (!isSupabaseConfigured || !supabase) {
        // En modo local sin Supabase configurado
        loginUser(email);
        setSuccessMsg('Inicio de sesión en modo local exitoso.');
        setTimeout(() => {
          onClose();
        }, 800);
        return;
      }

      if (isSignUp) {
        const { data, error } = await supabase.auth.signUp({
          email,
          password,
        });

        if (error) throw error;

        if (data.user) {
          if (data.session) {
            loginUser(data.user.email || email, data.user.id);
            setSuccessMsg('¡Cuenta creada y sesión iniciada con éxito!');
            setTimeout(() => onClose(), 1000);
          } else {
            setSuccessMsg('Registro exitoso. Revisa tu correo si tienes confirmación de email activada.');
          }
        }
      } else {
        const { data, error } = await supabase.auth.signInWithPassword({
          email,
          password,
        });

        if (error) throw error;

        if (data.user) {
          loginUser(data.user.email || email, data.user.id);
          setSuccessMsg('¡Sesión iniciada con éxito!');
          setTimeout(() => onClose(), 800);
        }
      }
    } catch (err: any) {
      setErrorMsg(err.message || 'Error al conectar con Supabase Auth.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className={styles.authCard} onClick={(e) => e.stopPropagation()}>
        <div className={styles.authHeader}>
          <button className={styles.authClose} onClick={onClose}>
            <X size={20} />
          </button>
          <div className={styles.authIconBox}>
            {isSignUp ? <UserPlus size={24} /> : <LogIn size={24} />}
          </div>
          <h3 style={{ fontSize: '1.2rem', fontWeight: 700, color: 'var(--text-main)' }}>
            {isSignUp ? 'Crear Cuenta en Supabase' : 'Iniciar Sesión en Supabase'}
          </h3>
          <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: '4px' }}>
            {isSupabaseConfigured
              ? 'Tus finanzas se sincronizarán directamente en tu base de datos Postgres.'
              : 'Configura tus variables en .env.local para sincronización en la nube.'}
          </p>
        </div>

        <form onSubmit={handleSubmit} className={styles.authForm}>
          {errorMsg && <div className={styles.errorMessage}>{errorMsg}</div>}
          {successMsg && <div className={styles.successMessage}>{successMsg}</div>}

          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
            <label style={{ fontSize: '0.82rem', fontWeight: 600, color: 'var(--text-muted)' }}>
              Correo Electrónico
            </label>
            <div style={{ position: 'relative' }}>
              <Mail
                size={16}
                style={{ position: 'absolute', left: '12px', top: '12px', color: 'var(--text-dim)' }}
              />
              <input
                type="email"
                className="input-field"
                style={{ paddingLeft: '38px' }}
                placeholder="tu@correo.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                autoFocus
              />
            </div>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
            <label style={{ fontSize: '0.82rem', fontWeight: 600, color: 'var(--text-muted)' }}>
              Contraseña
            </label>
            <div style={{ position: 'relative' }}>
              <Lock
                size={16}
                style={{ position: 'absolute', left: '12px', top: '12px', color: 'var(--text-dim)' }}
              />
              <input
                type="password"
                className="input-field"
                style={{ paddingLeft: '38px' }}
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                minLength={6}
              />
            </div>
          </div>

          <button
            type="submit"
            className="btn-primary"
            style={{ width: '100%', padding: '12px', marginTop: '8px' }}
            disabled={isLoading}
          >
            {isLoading ? 'Conectando...' : isSignUp ? 'Registrarme' : 'Entrar'}
          </button>

          <div className={styles.switchMode}>
            {isSignUp ? '¿Ya tienes una cuenta?' : '¿Aún no tienes cuenta?'}
            <button
              type="button"
              className={styles.switchLink}
              onClick={() => {
                setIsSignUp(!isSignUp);
                setErrorMsg('');
                setSuccessMsg('');
              }}
            >
              {isSignUp ? 'Inicia Sesión' : 'Regístrate aquí'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
