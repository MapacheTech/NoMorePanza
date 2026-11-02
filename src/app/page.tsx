'use client';

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  PenaltyRecord,
  UserProfile,
  WatchBrand,
  WorkoutLog,
} from '@/types/fitness';
import { getInitialDemoData } from '@/lib/demo-data';
import {
  buildGamifiedLeaderboard,
  getCurrentWeekDaysISO,
  getMexicoTodayISO,
} from '@/lib/penalty-engine';
import { createClient, isSupabaseConfigured } from '@/lib/supabase/client';
import { GamifiedLeaderboard } from '@/components/GamifiedLeaderboard';
import { WeeklyCalendarTracker } from '@/components/WeeklyCalendarTracker';
import { ProofFeed } from '@/components/ProofFeed';
import { CheckInModal } from '@/components/CheckInModal';
import { AuthModal } from '@/components/AuthModal';
import {
  Camera,
  CheckCircle2,
  Database,
  Dumbbell,
  Flame,
  LogIn,
  LogOut,
  PlusCircle,
  ShieldAlert,
  Sparkles,
  UserCheck,
  Watch,
} from 'lucide-react';

export default function HomePage() {
  const initialDemo = useMemo(() => getInitialDemoData(), []);
  const [profiles, setProfiles] = useState<UserProfile[]>(initialDemo.profiles);
  const [logs, setLogs] = useState<WorkoutLog[]>(initialDemo.logs);
  const [penalties, setPenalties] = useState<PenaltyRecord[]>(
    initialDemo.penalties
  );

  const [currentUser, setCurrentUser] = useState<UserProfile>(
    initialDemo.profiles[0]
  );
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isCheckInOpen, setIsCheckInOpen] = useState(false);
  const [isAuthOpen, setIsAuthOpen] = useState(false);
  const [bannerAlert, setBannerAlert] = useState<string | null>(null);
  const [supabaseConnected, setSupabaseConnected] = useState(false);

  const todayISO = getMexicoTodayISO();

  const loadFromSupabase = useCallback(async () => {
    if (!isSupabaseConfigured()) return;
    setSupabaseConnected(true);
    const supabase = createClient();

    const { data: authData } = await supabase.auth.getUser();
    const loggedInUser = authData?.user ?? null;
    setIsAuthenticated(Boolean(loggedInUser));

    // Si el usuario acaba de iniciar sesión con Google/Correo, aseguramos que exista su fila en public.profiles
    if (loggedInUser) {
      const metaName =
        loggedInUser.user_metadata?.full_name ||
        loggedInUser.user_metadata?.name ||
        loggedInUser.email?.split('@')[0] ||
        'Atleta';

      await supabase.from('profiles').upsert(
        {
          id: loggedInUser.id,
          email: loggedInUser.email,
          full_name: metaName,
          avatar_url: loggedInUser.user_metadata?.avatar_url || null,
        },
        { onConflict: 'id' }
      );
    }

    const [{ data: dbProfiles }, { data: dbLogs }, { data: dbPenalties }] =
      await Promise.all([
        supabase
          .from('profiles')
          .select('*')
          .order('created_at', { ascending: true }),
        supabase
          .from('workout_logs')
          .select('*, profiles(full_name, avatar_url)')
          .order('workout_date', { ascending: false })
          .limit(100),
        supabase
          .from('penalties')
          .select('*, profiles(full_name)')
          .order('penalty_date', { ascending: false }),
      ]);

    if (dbProfiles && dbProfiles.length > 0) {
      setProfiles(dbProfiles as UserProfile[]);
      if (loggedInUser) {
        const found = dbProfiles.find((p) => p.id === loggedInUser.id);
        if (found) setCurrentUser(found as UserProfile);
      } else {
        setCurrentUser(dbProfiles[0] as UserProfile);
      }

      // Al haber perfiles reales en Supabase, mostramos los registros y multas reales del grupo
      const mappedLogs: WorkoutLog[] = (dbLogs || []).map(
        (row: Record<string, unknown>) => {
          const prof = row.profiles as {
            full_name?: string;
            avatar_url?: string;
          } | null;
          return {
            ...(row as unknown as WorkoutLog),
            user_name: prof?.full_name || 'Integrante',
            user_avatar: prof?.avatar_url || null,
          };
        }
      );
      setLogs(mappedLogs);

      const mappedPen: PenaltyRecord[] = (dbPenalties || []).map(
        (row: Record<string, unknown>) => {
          const prof = row.profiles as { full_name?: string } | null;
          return {
            ...(row as unknown as PenaltyRecord),
            user_name: prof?.full_name || 'Integrante',
          };
        }
      );
      setPenalties(mappedPen);
    }
  }, []);

  useEffect(() => {
    if (!isSupabaseConfigured()) return;
    loadFromSupabase();

    const supabase = createClient();
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(() => {
      loadFromSupabase();
    });

    return () => {
      subscription.unsubscribe();
    };
  }, [loadFromSupabase]);

  const { leaderboard, computedPenalties, totalPotMXN } = useMemo(
    () => buildGamifiedLeaderboard(profiles, logs, penalties, todayISO),
    [profiles, logs, penalties, todayISO]
  );

  const currentUserStats = useMemo(() => {
    return (
      leaderboard.find((e) => e.user_id === currentUser.id) || {
        remaining_rest_days_this_week: 2,
        week_workouts: 0,
        unpaid_fine_mxn: 0,
      }
    );
  }, [leaderboard, currentUser.id]);

  const hasCheckedInToday = useMemo(() => {
    return logs.some(
      (l) => l.user_id === currentUser.id && l.workout_date === todayISO
    );
  }, [logs, currentUser.id, todayISO]);

  async function handleWorkoutSaved(
    newLog: WorkoutLog,
    triggeredPenaltyMxn: number
  ) {
    setLogs((prev) => {
      const filtered = prev.filter(
        (l) =>
          !(
            l.user_id === newLog.user_id &&
            l.workout_date === newLog.workout_date
          )
      );
      return [newLog, ...filtered];
    });

    // Actualizar la marca de reloj favorita del usuario si la cambió durante el check-in
    if (newLog.watch_brand !== currentUser.watch_brand) {
      setCurrentUser((prev) => ({ ...prev, watch_brand: newLog.watch_brand }));
      setProfiles((prev) =>
        prev.map((p) =>
          p.id === currentUser.id ? { ...p, watch_brand: newLog.watch_brand } : p
        )
      );
      if (isSupabaseConfigured() && isAuthenticated) {
        const supabase = createClient();
        await supabase
          .from('profiles')
          .update({ watch_brand: newLog.watch_brand })
          .eq('id', currentUser.id);
      }
    }

    if (triggeredPenaltyMxn > 0) {
      const weekStart = getCurrentWeekDaysISO(todayISO)[0];
      const newPenalty: PenaltyRecord = {
        id: `pen_${Date.now()}`,
        user_id: currentUser.id,
        user_name: currentUser.full_name,
        penalty_date: todayISO,
        week_start: weekStart,
        amount_mxn: triggeredPenaltyMxn,
        reason:
          'Excedió los 2 días de descanso libres de la semana (Multa automática de $50 MXN)',
        is_paid: false,
      };
      setPenalties((prev) => [newPenalty, ...prev]);

      if (isSupabaseConfigured() && isAuthenticated) {
        const supabase = createClient();
        await supabase.from('penalties').upsert(
          {
            user_id: currentUser.id,
            penalty_date: todayISO,
            week_start: weekStart,
            amount_mxn: triggeredPenaltyMxn,
            reason: newPenalty.reason,
            is_paid: false,
          },
          { onConflict: 'user_id,penalty_date' }
        );
      }

      setBannerAlert(
        `💸 Se registró tu día sin entrenar y como ya agotaste tus 2 descansos semanales, se sumaron $${triggeredPenaltyMxn} MXN a tu cuenta.`
      );
    } else if (newLog.log_type === 'workout') {
      setBannerAlert(
        `🔥 ¡Excelente ${currentUser.full_name}! Foto y datos de tu reloj (${newLog.calories_burned} kcal) validados. ¡Te salvaste de los $50 MXN hoy!`
      );
    } else {
      setBannerAlert(
        `🛌 Día de descanso libre registrado ($0 MXN). Recuerda que tienes máximo 2 por semana.`
      );
    }

    if (isSupabaseConfigured() && isAuthenticated) {
      await loadFromSupabase();
    }
  }

  async function handleMarkPenaltyPaid(penaltyId: string) {
    setPenalties((prev) =>
      prev.map((p) =>
        p.id === penaltyId
          ? { ...p, is_paid: true, paid_at: new Date().toISOString() }
          : p
      )
    );

    if (isSupabaseConfigured() && !penaltyId.startsWith('auto_')) {
      const supabase = createClient();
      await supabase
        .from('penalties')
        .update({ is_paid: true, paid_at: new Date().toISOString() })
        .eq('id', penaltyId);
      await loadFromSupabase();
    }

    setBannerAlert('✅ ¡Multa de $50 MXN marcada como pagada en el cochinito!');
  }

  function handleSuccessDemoLogin(info: {
    name: string;
    email: string;
    watchBrand: WatchBrand;
  }) {
    const newId = `user_${Date.now()}`;
    const newUser: UserProfile = {
      id: newId,
      email: info.email,
      full_name: info.name,
      watch_brand: info.watchBrand,
      strava_connected: true,
    };
    setProfiles((prev) => [...prev, newUser]);
    setCurrentUser(newUser);
    setBannerAlert(
      `👋 ¡Bienvenido ${info.name}! Tu smartwatch se configuró y ya estás en el ranking.`
    );
  }

  async function handleSignOut() {
    if (isSupabaseConfigured()) {
      const supabase = createClient();
      await supabase.auth.signOut();
      setIsAuthenticated(false);
    }
    setBannerAlert('Sesión cerrada.');
  }

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100 pb-16">
      {/* Top Navbar */}
      <header className="sticky top-0 z-30 border-b border-zinc-800/80 bg-zinc-950/85 backdrop-blur-md">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3.5">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-500 text-zinc-950 font-black shadow-lg shadow-emerald-500/20">
              <Dumbbell className="h-5 w-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-base sm:text-lg font-black tracking-tight text-white">
                  NoMorePanza
                </h1>
                <span className="hidden sm:inline-flex items-center gap-1 rounded-full bg-emerald-500/15 border border-emerald-500/30 px-2 py-0.5 text-[10px] font-bold text-emerald-400">
                  <Sparkles className="h-3 w-3" /> Reto Familiar & Amigos
                </span>
              </div>
              <p className="text-[11px] text-zinc-400">
                Smartwatch + Foto Obligatoria • 2 descansos/sem • Falta = $50 MXN
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2.5">
            <select
              aria-label="Cambiar integrante activo"
              value={currentUser.id}
              onChange={(e) => {
                const found = profiles.find((p) => p.id === e.target.value);
                if (found) setCurrentUser(found);
              }}
              className="hidden md:block rounded-xl border border-zinc-800 bg-zinc-900 px-3 py-2 text-xs font-semibold text-zinc-200 focus:border-emerald-500 focus:outline-none"
            >
              {profiles.map((p) => (
                <option key={p.id} value={p.id}>
                  👤 {p.full_name} ({p.watch_brand.toUpperCase()})
                </option>
              ))}
            </select>

            <button
              type="button"
              onClick={() => setIsCheckInOpen(true)}
              className="flex items-center gap-1.5 rounded-xl bg-emerald-500 px-3.5 py-2 text-xs font-extrabold text-zinc-950 shadow-lg shadow-emerald-500/20 hover:bg-emerald-400 transition cursor-pointer"
            >
              <PlusCircle className="h-4 w-4" />
              <span>Subir Ejercicio / Foto</span>
            </button>

            {isAuthenticated ? (
              <div className="flex items-center gap-2">
                <span className="hidden sm:inline-flex items-center gap-1.5 rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-3 py-2 text-xs font-bold text-emerald-300">
                  <UserCheck className="h-3.5 w-3.5" />
                  {currentUser.full_name}
                </span>
                <button
                  type="button"
                  onClick={handleSignOut}
                  title="Cerrar sesión"
                  className="rounded-xl border border-zinc-800 bg-zinc-900 p-2 text-zinc-400 hover:text-white cursor-pointer"
                >
                  <LogOut className="h-4 w-4" />
                </button>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => setIsAuthOpen(true)}
                className="flex items-center gap-1.5 rounded-xl border border-zinc-800 bg-zinc-900 px-3 py-2 text-xs font-semibold text-zinc-200 hover:bg-zinc-800 transition cursor-pointer"
              >
                <LogIn className="h-4 w-4 text-emerald-400" />
                <span>Iniciar Sesión / Google</span>
              </button>
            )}
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-4 pt-6 space-y-8">
        {bannerAlert ? (
          <div className="flex items-center justify-between rounded-2xl border border-emerald-500/40 bg-emerald-500/15 px-4 py-3 text-xs sm:text-sm font-semibold text-emerald-200">
            <span>{bannerAlert}</span>
            <button
              onClick={() => setBannerAlert(null)}
              className="ml-4 text-xs underline opacity-80 hover:opacity-100"
            >
              Cerrar
            </button>
          </div>
        ) : null}

        {/* Hero / Estado de Hoy del Usuario Activo */}
        <section className="grid grid-cols-1 lg:grid-cols-12 gap-4">
          <div className="lg:col-span-8 rounded-3xl border border-zinc-800 bg-gradient-to-br from-zinc-900 via-zinc-900/90 to-emerald-950/30 p-6 flex flex-col justify-between space-y-5">
            <div className="space-y-2">
              <div className="flex flex-wrap items-center gap-2">
                <span className="inline-flex items-center gap-1.5 rounded-full bg-zinc-800 px-3 py-1 text-xs font-semibold text-zinc-300">
                  <Watch className="h-3.5 w-3.5 text-emerald-400" />
                  Apple • Samsung • Huawei (Opción C Híbrida)
                </span>
                <span className="inline-flex items-center gap-1.5 rounded-full bg-zinc-800 px-3 py-1 text-xs font-semibold text-zinc-300">
                  <Database className="h-3.5 w-3.5 text-sky-400" />
                  {supabaseConnected
                    ? isAuthenticated
                      ? 'Conectado a Supabase Live (Sesión Activa)'
                      : 'Supabase Conectado (Inicia sesión con Google)'
                    : 'Modo Interactivo (Listo para Supabase)'}
                </span>
              </div>

              <h2 className="text-2xl sm:text-3xl font-black text-white tracking-tight">
                Hola, {currentUser.full_name} 👋{' '}
                {hasCheckedInToday ? (
                  <span className="text-emerald-400">¡Ya cumpliste hoy!</span>
                ) : (
                  <span className="text-amber-400">
                    ¡Aún no subes tu prueba de hoy!
                  </span>
                )}
              </h2>

              <p className="text-xs sm:text-sm text-zinc-300 max-w-2xl leading-relaxed">
                Para que el día cuente debes sincronizar los datos de tu{' '}
                <strong>Apple Watch, Samsung Galaxy Watch o Huawei Watch</strong>{' '}
                y subir tu <strong>foto obligatoria entrenando</strong>. Tienes{' '}
                <strong>2 días de descanso libres por semana</strong>; cada falta
                adicional cuesta <strong>$50 MXN</strong>.
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-3 pt-1">
              <button
                type="button"
                onClick={() => setIsCheckInOpen(true)}
                className="flex items-center gap-2 rounded-2xl bg-emerald-500 px-5 py-3 text-sm font-black text-zinc-950 shadow-xl shadow-emerald-500/20 hover:bg-emerald-400 transition cursor-pointer"
              >
                <Camera className="h-4 w-4" />
                {hasCheckedInToday
                  ? 'Actualizar mi Entrenamiento / Foto de Hoy'
                  : 'Registrar Ejercicio + Subir Foto de Prueba'}
              </button>

              <a
                href="/api/strava/connect"
                className="flex items-center gap-2 rounded-2xl border border-orange-500/40 bg-orange-500/15 px-4 py-3 text-xs font-bold text-orange-300 hover:bg-orange-500/25 transition"
              >
                <Flame className="h-4 w-4" />
                Vincular OAuth Strava (Apple/Samsung/Huawei)
              </a>
            </div>
          </div>

          {/* Tarjeta Resumen Personal de Multas y Descansos */}
          <div className="lg:col-span-4 rounded-3xl border border-zinc-800 bg-zinc-900/70 p-5 flex flex-col justify-between space-y-4">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold uppercase tracking-wider text-zinc-400">
                Tu Estado Esta Semana
              </span>
              {hasCheckedInToday ? (
                <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/20 px-2.5 py-0.5 text-xs font-bold text-emerald-300">
                  <CheckCircle2 className="h-3.5 w-3.5" /> Hoy cumplido
                </span>
              ) : (
                <span className="inline-flex items-center gap-1 rounded-full bg-amber-500/20 px-2.5 py-0.5 text-xs font-bold text-amber-300">
                  <ShieldAlert className="h-3.5 w-3.5" /> Pendiente hoy
                </span>
              )}
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="rounded-2xl border border-zinc-800 bg-zinc-950 p-3.5">
                <p className="text-[11px] text-zinc-400">Días Entrenados</p>
                <p className="mt-1 text-2xl font-black text-emerald-400">
                  {currentUserStats.week_workouts}{' '}
                  <span className="text-xs font-normal text-zinc-500">/ 5</span>
                </p>
              </div>

              <div className="rounded-2xl border border-zinc-800 bg-zinc-950 p-3.5">
                <p className="text-[11px] text-zinc-400">Descansos Gratis</p>
                <p className="mt-1 text-2xl font-black text-sky-400">
                  {currentUserStats.remaining_rest_days_this_week}{' '}
                  <span className="text-xs font-normal text-zinc-500">/ 2</span>
                </p>
              </div>
            </div>

            <div className="rounded-2xl border border-rose-500/30 bg-rose-500/10 p-3.5 flex items-center justify-between">
              <div>
                <p className="text-xs font-bold text-rose-200">
                  Tu Saldo de Multas ($50/día)
                </p>
                <p className="text-[11px] text-rose-300/80">
                  Por faltas mayores a 2 descansos/sem
                </p>
              </div>
              <span className="text-xl font-black text-rose-400">
                ${currentUserStats.unpaid_fine_mxn} MXN
              </span>
            </div>
          </div>
        </section>

        {/* Calendario Semanal Lunes a Domingo */}
        <section>
          <WeeklyCalendarTracker profiles={profiles} logs={logs} />
        </section>

        {/* Tabla Gamificada (Ranking de Ejercicio + Tabla de Castigo de $50 MXN) */}
        <section>
          <GamifiedLeaderboard
            leaderboard={leaderboard}
            penalties={computedPenalties}
            totalPotMXN={totalPotMXN}
            onMarkPenaltyPaid={handleMarkPenaltyPaid}
          />
        </section>

        {/* Muro de Fotos de Prueba + Métricas de Smartwatch */}
        <section>
          <ProofFeed logs={logs} />
        </section>
      </main>

      {/* Modal para Registrar Entrenamiento (Reloj + Foto Obligatoria) o Descanso */}
      <CheckInModal
        isOpen={isCheckInOpen}
        onClose={() => setIsCheckInOpen(false)}
        userId={currentUser.id}
        userName={currentUser.full_name}
        defaultWatchBrand={currentUser.watch_brand}
        remainingRestDaysThisWeek={
          currentUserStats.remaining_rest_days_this_week
        }
        onWorkoutSaved={handleWorkoutSaved}
      />

      {/* Modal de Autenticación con Supabase (Google OAuth + Correo) */}
      <AuthModal
        isOpen={isAuthOpen}
        onClose={() => setIsAuthOpen(false)}
        onSuccessDemoLogin={handleSuccessDemoLogin}
      />
    </div>
  );
}
