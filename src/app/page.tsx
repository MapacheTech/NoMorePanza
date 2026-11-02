'use client';

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  PenaltyRecord,
  UserProfile,
  WatchBrand,
  WorkoutLog,
} from '@/types/fitness';
import {
  buildGamifiedLeaderboard,
  getCurrentWeekDaysISO,
  getMexicoTodayISO,
} from '@/lib/penalty-engine';
import { createClient } from '@/lib/supabase/client';
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
  const [profiles, setProfiles] = useState<UserProfile[]>([]);
  const [logs, setLogs] = useState<WorkoutLog[]>([]);
  const [penalties, setPenalties] = useState<PenaltyRecord[]>([]);
  const [currentUser, setCurrentUser] = useState<UserProfile | null>(null);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [loadingData, setLoadingData] = useState(true);

  const [isCheckInOpen, setIsCheckInOpen] = useState(false);
  const [isAuthOpen, setIsAuthOpen] = useState(false);
  const [bannerAlert, setBannerAlert] = useState<string | null>(null);

  const todayISO = getMexicoTodayISO();

  const loadFromSupabase = useCallback(async () => {
    setLoadingData(true);
    try {
      const supabase = createClient();
      const { data: authData } = await supabase.auth.getUser();
      const loggedInUser = authData?.user ?? null;
      setIsAuthenticated(Boolean(loggedInUser));

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

      const realProfiles = (dbProfiles || []) as UserProfile[];
      setProfiles(realProfiles);

      if (loggedInUser) {
        const found = realProfiles.find((p) => p.id === loggedInUser.id);
        setCurrentUser(found || realProfiles[0] || null);
      } else {
        setCurrentUser(realProfiles[0] || null);
      }

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
    } finally {
      setLoadingData(false);
    }
  }, []);

  useEffect(() => {
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
    if (!currentUser) {
      return {
        remaining_rest_days_this_week: 2,
        week_workouts: 0,
        unpaid_fine_mxn: 0,
      };
    }
    return (
      leaderboard.find((e) => e.user_id === currentUser.id) || {
        remaining_rest_days_this_week: 2,
        week_workouts: 0,
        unpaid_fine_mxn: 0,
      }
    );
  }, [leaderboard, currentUser]);

  const hasCheckedInToday = useMemo(() => {
    if (!currentUser) return false;
    return logs.some(
      (l) => l.user_id === currentUser.id && l.workout_date === todayISO
    );
  }, [logs, currentUser, todayISO]);

  function handleOpenCheckIn() {
    if (!isAuthenticated || !currentUser) {
      setIsAuthOpen(true);
      return;
    }
    setIsCheckInOpen(true);
  }

  async function handleWatchBrandQuickChange(newBrand: WatchBrand) {
    if (!currentUser) return;
    setCurrentUser({ ...currentUser, watch_brand: newBrand });
    setProfiles((prev) =>
      prev.map((p) =>
        p.id === currentUser.id ? { ...p, watch_brand: newBrand } : p
      )
    );
    if (isAuthenticated) {
      const supabase = createClient();
      await supabase
        .from('profiles')
        .update({ watch_brand: newBrand })
        .eq('id', currentUser.id);
    }
  }

  async function handleWorkoutSaved(
    newLog: WorkoutLog,
    triggeredPenaltyMxn: number
  ) {
    if (!currentUser) return;

    if (newLog.watch_brand !== currentUser.watch_brand) {
      await handleWatchBrandQuickChange(newLog.watch_brand);
    }

    if (triggeredPenaltyMxn > 0) {
      const weekStart = getCurrentWeekDaysISO(todayISO)[0];
      const reason =
        'Excedió los 2 días de descanso libres de la semana (Multa automática de $50 MXN)';

      const supabase = createClient();
      await supabase.from('penalties').upsert(
        {
          user_id: currentUser.id,
          penalty_date: todayISO,
          week_start: weekStart,
          amount_mxn: triggeredPenaltyMxn,
          reason,
          is_paid: false,
        },
        { onConflict: 'user_id,penalty_date' }
      );

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

    await loadFromSupabase();
  }

  async function handleMarkPenaltyPaid(penaltyId: string) {
    if (!penaltyId.startsWith('auto_')) {
      const supabase = createClient();
      await supabase
        .from('penalties')
        .update({ is_paid: true, paid_at: new Date().toISOString() })
        .eq('id', penaltyId);
      await loadFromSupabase();
    }
    setBannerAlert('✅ ¡Multa de $50 MXN marcada como pagada en el cochinito!');
  }

  async function handleSignOut() {
    const supabase = createClient();
    await supabase.auth.signOut();
    setIsAuthenticated(false);
    setBannerAlert('Sesión cerrada.');
    await loadFromSupabase();
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
            {isAuthenticated && currentUser ? (
              <select
                aria-label="Marca de tu Smartwatch"
                value={currentUser.watch_brand}
                onChange={(e) =>
                  handleWatchBrandQuickChange(e.target.value as WatchBrand)
                }
                className="hidden md:block rounded-xl border border-zinc-800 bg-zinc-900 px-3 py-2 text-xs font-semibold text-zinc-200 focus:border-emerald-500 focus:outline-none"
              >
                <option value="apple">⌚ Mi Reloj: Apple Watch</option>
                <option value="samsung">⌚ Mi Reloj: Samsung Watch</option>
                <option value="huawei">⌚ Mi Reloj: Huawei Watch</option>
                <option value="garmin">⌚ Mi Reloj: Garmin / Otro</option>
              </select>
            ) : null}

            <button
              type="button"
              onClick={handleOpenCheckIn}
              className="flex items-center gap-1.5 rounded-xl bg-emerald-500 px-3.5 py-2 text-xs font-extrabold text-zinc-950 shadow-lg shadow-emerald-500/20 hover:bg-emerald-400 transition cursor-pointer"
            >
              <PlusCircle className="h-4 w-4" />
              <span>Subir Ejercicio / Foto</span>
            </button>

            {isAuthenticated && currentUser ? (
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
                  <Database className="h-3.5 w-3.5 text-emerald-400" />
                  {loadingData
                    ? 'Sincronizando con Supabase...'
                    : `Grupo en Vivo (${profiles.length} integrante${
                        profiles.length === 1 ? '' : 's'
                      })`}
                </span>
              </div>

              <h2 className="text-2xl sm:text-3xl font-black text-white tracking-tight">
                {currentUser ? (
                  <>
                    Hola, {currentUser.full_name} 👋{' '}
                    {hasCheckedInToday ? (
                      <span className="text-emerald-400">
                        ¡Ya cumpliste hoy!
                      </span>
                    ) : (
                      <span className="text-amber-400">
                        ¡Aún no subes tu prueba de hoy!
                      </span>
                    )}
                  </>
                ) : (
                  <span>¡Bienvenido al Reto NoMorePanza! 💪</span>
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
                onClick={handleOpenCheckIn}
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
      {currentUser ? (
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
      ) : null}

      {/* Modal de Autenticación con Supabase (Google OAuth + Correo) */}
      <AuthModal
        isOpen={isAuthOpen}
        onClose={() => setIsAuthOpen(false)}
        onSuccessDemoLogin={() => loadFromSupabase()}
      />
    </div>
  );
}
