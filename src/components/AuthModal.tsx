'use client';

import React, { useState } from 'react';
import { createClient, isSupabaseConfigured } from '@/lib/supabase/client';
import { WatchBrand } from '@/types/fitness';
import { LogIn, Mail, ShieldCheck, Watch, X } from 'lucide-react';

interface AuthModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccessDemoLogin: (profile: {
    name: string;
    email: string;
    watchBrand: WatchBrand;
  }) => void;
}

export function AuthModal({
  isOpen,
  onClose,
  onSuccessDemoLogin,
}: AuthModalProps) {
  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [watchBrand, setWatchBrand] = useState<WatchBrand>('apple');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const supabaseReady = isSupabaseConfigured();

  async function handleGoogleLogin() {
    setError(null);
    setLoading(true);
    try {
      if (!supabaseReady) {
        onSuccessDemoLogin({
          name: fullName || 'Atleta Google',
          email: email || 'atleta@gmail.com',
          watchBrand,
        });
        onClose();
        return;
      }

      const supabase = createClient();
      const { error: oauthErr } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: `${window.location.origin}/auth/callback`,
        },
      });
      if (oauthErr) throw oauthErr;
    } catch (err) {
      setError(
        err instanceof Error ? err.message : 'Error al conectar con Google'
      );
    } finally {
      setLoading(false);
    }
  }

  async function handleEmailSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setMessage(null);
    setLoading(true);

    try {
      if (!supabaseReady) {
        onSuccessDemoLogin({
          name: fullName || email.split('@')[0] || 'Atleta Familiar',
          email,
          watchBrand,
        });
        onClose();
        return;
      }

      const supabase = createClient();

      if (mode === 'register') {
        const { data, error: signUpErr } = await supabase.auth.signUp({
          email,
          password,
          options: {
            data: {
              full_name: fullName || email.split('@')[0],
              watch_brand: watchBrand,
            },
            emailRedirectTo: `${window.location.origin}/auth/callback`,
          },
        });
        if (signUpErr) throw signUpErr;

        if (data.user) {
          await supabase.from('profiles').upsert({
            id: data.user.id,
            email,
            full_name: fullName || email.split('@')[0],
            watch_brand: watchBrand,
          });
        }

        setMessage(
          '¡Cuenta creada! Revisa tu correo si tienes confirmación activa o inicia sesión.'
        );
        if (data.session) {
          onClose();
        }
      } else {
        const { error: signInErr } = await supabase.auth.signInWithPassword({
          email,
          password,
        });
        if (signInErr) throw signInErr;
        onClose();
      }
    } catch (err) {
      setError(
        err instanceof Error ? err.message : 'No se pudo autenticar el usuario'
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
      <div className="relative w-full max-w-md rounded-2xl border border-zinc-800 bg-zinc-950 p-6 text-zinc-100 shadow-2xl">
        <button
          onClick={onClose}
          className="absolute right-4 top-4 rounded-lg p-1.5 text-zinc-400 hover:bg-zinc-800 hover:text-white"
          aria-label="Cerrar"
        >
          <X className="h-5 w-5" />
        </button>

        <div className="mb-5 flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-emerald-500/15 text-emerald-400 border border-emerald-500/30">
            <ShieldCheck className="h-6 w-6" />
          </div>
          <div>
            <h2 className="text-lg font-bold text-white">
              Acceso al Reto NoMorePanza
            </h2>
            <p className="text-xs text-zinc-400">
              Supabase Auth • Correo o Google
            </p>
          </div>
        </div>

        {/* Botón Google OAuth */}
        <button
          type="button"
          onClick={handleGoogleLogin}
          disabled={loading}
          className="mb-4 flex w-full items-center justify-center gap-2.5 rounded-xl bg-white px-4 py-3 text-sm font-semibold text-zinc-900 shadow hover:bg-zinc-200 transition disabled:opacity-50 cursor-pointer"
        >
          <svg className="h-4 w-4" viewBox="0 0 24 24">
            <path
              fill="#EA4335"
              d="M12 5c1.6 0 3 .6 4.1 1.7l3.1-3.1C17.3 1.8 14.8 1 12 1 7.4 1 3.5 3.6 1.6 7.4l3.7 2.8C6.2 7.2 8.9 5 12 5z"
            />
            <path
              fill="#4285F4"
              d="M23.5 12.3c0-.8-.1-1.6-.2-2.3H12v4.5h6.5c-.3 1.5-1.1 2.8-2.4 3.6l3.7 2.9c2.2-2 3.7-5 3.7-8.7z"
            />
            <path
              fill="#FBBC05"
              d="M5.3 14.8c-.2-.8-.4-1.6-.4-2.5s.2-1.7.4-2.5L1.6 7C.6 9 0 11.2 0 13.5s.6 4.5 1.6 6.5l3.7-2.9z"
            />
            <path
              fill="#34A853"
              d="M12 24c3.2 0 6-1.1 8-3l-3.7-2.9c-1.1.7-2.5 1.2-4.3 1.2-3.1 0-5.8-2.1-6.7-5l-3.7 2.9C3.5 21.4 7.4 24 12 24z"
            />
          </svg>
          Continuar con Google
        </button>

        <div className="relative my-4 flex items-center justify-center">
          <div className="w-full border-t border-zinc-800" />
          <span className="bg-zinc-950 px-3 text-xs uppercase text-zinc-500">
            o con tu correo
          </span>
          <div className="w-full border-t border-zinc-800" />
        </div>

        <div className="mb-4 grid grid-cols-2 gap-1 rounded-xl bg-zinc-900 p-1">
          <button
            type="button"
            onClick={() => setMode('login')}
            className={`rounded-lg py-1.5 text-xs font-semibold transition ${
              mode === 'login'
                ? 'bg-emerald-500 text-zinc-950'
                : 'text-zinc-400 hover:text-white'
            }`}
          >
            Iniciar Sesión
          </button>
          <button
            type="button"
            onClick={() => setMode('register')}
            className={`rounded-lg py-1.5 text-xs font-semibold transition ${
              mode === 'register'
                ? 'bg-emerald-500 text-zinc-950'
                : 'text-zinc-400 hover:text-white'
            }`}
          >
            Crear Cuenta
          </button>
        </div>

        <form onSubmit={handleEmailSubmit} className="space-y-3.5">
          {mode === 'register' ? (
            <>
              <div>
                <label className="mb-1 block text-xs font-medium text-zinc-300">
                  Nombre o Apodo en la Familia/Grupo
                </label>
                <input
                  type="text"
                  required
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  placeholder="Ej. Primo Diego, Tía Laura..."
                  className="w-full rounded-xl border border-zinc-800 bg-zinc-900 px-3.5 py-2.5 text-sm text-white focus:border-emerald-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="mb-1 flex items-center gap-1.5 text-xs font-medium text-zinc-300">
                  <Watch className="h-3.5 w-3.5 text-emerald-400" />
                  Marca de tu Smartwatch
                </label>
                <select
                  value={watchBrand}
                  onChange={(e) => setWatchBrand(e.target.value as WatchBrand)}
                  className="w-full rounded-xl border border-zinc-800 bg-zinc-900 px-3.5 py-2.5 text-sm text-white focus:border-emerald-500 focus:outline-none"
                >
                  <option value="apple">⌚ Apple Watch (HealthKit)</option>
                  <option value="samsung">⌚ Samsung Galaxy Watch (Health)</option>
                  <option value="huawei">⌚ Huawei Watch (Huawei Health)</option>
                  <option value="garmin">⌚ Garmin / Otro Reloj</option>
                </select>
              </div>
            </>
          ) : null}

          <div>
            <label className="mb-1 block text-xs font-medium text-zinc-300">
              Correo Electrónico
            </label>
            <div className="relative">
              <Mail className="pointer-events-none absolute left-3.5 top-3 h-4 w-4 text-zinc-500" />
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="tu@correo.com"
                className="w-full rounded-xl border border-zinc-800 bg-zinc-900 pl-10 pr-3.5 py-2.5 text-sm text-white focus:border-emerald-500 focus:outline-none"
              />
            </div>
          </div>

          <div>
            <label className="mb-1 block text-xs font-medium text-zinc-300">
              Contraseña
            </label>
            <input
              type="password"
              required
              minLength={6}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              className="w-full rounded-xl border border-zinc-800 bg-zinc-900 px-3.5 py-2.5 text-sm text-white focus:border-emerald-500 focus:outline-none"
            />
          </div>

          {error ? (
            <div className="rounded-xl border border-rose-500/40 bg-rose-500/10 p-3 text-xs text-rose-300">
              {error}
            </div>
          ) : null}

          {message ? (
            <div className="rounded-xl border border-emerald-500/40 bg-emerald-500/10 p-3 text-xs text-emerald-300">
              {message}
            </div>
          ) : null}

          <button
            type="submit"
            disabled={loading}
            className="flex w-full items-center justify-center gap-2 rounded-xl bg-emerald-500 px-4 py-3 text-sm font-bold text-zinc-950 hover:bg-emerald-400 transition disabled:opacity-50 cursor-pointer"
          >
            <LogIn className="h-4 w-4" />
            {loading
              ? 'Procesando...'
              : mode === 'login'
              ? 'Entrar al Reto'
              : 'Registrarme en el Grupo'}
          </button>
        </form>
      </div>
    </div>
  );
}
