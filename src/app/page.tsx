'use client';

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  PenaltyRecord,
  UserProfile,
  WatchBrand,
  WorkoutLog,
} from '@/types/fitness';
import {
  CHALLENGE_START_DATE_ISO,
  FREE_REST_DAYS_PER_WEEK,
  REQUIRED_WORKOUT_DAYS_PER_WEEK,
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
  CalendarDays,
  Camera,
  CheckCircle2,
  Database,
  Dumbbell,
  Flame,
  Home,
  LogIn,
  LogOut,
  PlusCircle,
  ShieldAlert,
  Sparkles,
  Trophy,
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
        remaining_rest_days_this_week: FREE_REST_DAYS_PER_WEEK,
        week_workouts: 0,
        unpaid_fine_mxn: 0,
      };
    }
    return (
      leaderboard.find((e) => e.user_id === currentUser.id) || {
        remaining_rest_days_this_week: FREE_REST_DAYS_PER_WEEK,
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
      const reason = `Excedió los ${FREE_REST_DAYS_PER_WEEK} días de descanso libres de la semana (Multa automática de $50 MXN)`;

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
        `💸 Se registró tu día sin entrenar y como ya agotaste tus ${FREE_REST_DAYS_PER_WEEK} descansos semanales, se sumaron $${triggeredPenaltyMxn} MXN a tu cuenta.`
      );
    } else if (newLog.log_type === 'workout') {
      setBannerAlert(
        `🔥 ¡Excelente ${currentUser.full_name}! Foto y datos de tu reloj (${newLog.calories_burned} kcal) validados. ¡Te salvaste de los $50 MXN hoy!`
      );
    } else {
      setBannerAlert(
        `🛌 Día de descanso libre registrado ($0 MXN). Recuerda que tienes máximo ${FREE_REST_DAYS_PER_WEEK} por semana.`
      );
    }

    await loadFromSupabase();
  }

  async function handleMarkPenaltyPaid(penalty: PenaltyRecord) {
    if (!isAuthenticated) {
      setIsAuthOpen(true);
      return;
    }

    const supabase = createClient();
    const nowIso = new Date().toISOString();

    if (penalty.id.startsWith('auto_')) {
      await supabase.from('penalties').upsert(
        {
          user_id: penalty.user_id,
          penalty_date: penalty.penalty_date,
          week_start: penalty.week_start,
          amount_mxn: penalty.amount_mxn,
          reason: penalty.reason,
          is_paid: true,
          paid_at: nowIso,
        },
        { onConflict: 'user_id,penalty_date' }
      );
    } else {
      await supabase
        .from('penalties')
        .update({ is_paid: true, paid_at: nowIso })
        .eq('id', penalty.id);
    }

    await loadFromSupabase();
    setBannerAlert(
      `✅ ¡Pago de $${penalty.amount_mxn} MXN de ${
        penalty.user_name || 'integrante'
      } registrado en el cochinito!`
    );
  }

  async function handlePayAllUserPenalties(userId: string) {
    if (!isAuthenticated) {
      setIsAuthOpen(true);
      return;
    }

    const unpaidList = computedPenalties.filter(
      (p) => p.user_id === userId && !p.is_paid
    );
    if (unpaidList.length === 0) return;

    const supabase = createClient();
    const nowIso = new Date().toISOString();

    const rowsToUpsert = unpaidList.map((pen) => ({
      user_id: pen.user_id,
      penalty_date: pen.penalty_date,
      week_start: pen.week_start,
      amount_mxn: pen.amount_mxn,
      reason: pen.reason,
      is_paid: true,
      paid_at: nowIso,
    }));

    await supabase
      .from('penalties')
      .upsert(rowsToUpsert, { onConflict: 'user_id,penalty_date' });

    await loadFromSupabase();
    const totalPaid = unpaidList.reduce((s, p) => s + p.amount_mxn, 0);
    setBannerAlert(
      `✅ ¡Se liquidaron $${totalPaid} MXN de deuda acumulada en el cochinito!`
    );
  }

  async function handleSignOut() {
    const supabase = createClient();
    await supabase.auth.signOut();
    setIsAuthenticated(false);
    setBannerAlert('Sesión cerrada.');
    await loadFromSupabase();
  }

  const isBeforeChallengeStart = todayISO < CHALLENGE_START_DATE_ISO;

  return (
    <div id="top" className="min-h-screen bg-zinc-950 text-zinc-100 pb-24 md:pb-16">
      {/* Top Navbar */}
      <header className="sticky top-0 z-30 border-b border-zinc-800/80 bg-zinc-950/90 backdrop-blur-md">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-3.5 sm:px-4 py-3">
          <div className="flex items-center gap-2.5">
            <div className="flex h-9 w-9 sm:h-10 sm:w-10 items-center justify-center rounded-xl bg-emerald-500 text-zinc-950 font-black shadow-lg shadow-emerald-500/20">
              <Dumbbell className="h-5 w-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-base sm:text-lg font-black tracking-tight text-white">
                  NoMorePanza
                </h1>
                <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/15 border border-emerald-500/30 px-2 py-0.5 text-[10px] font-bold text-emerald-400">
                  <Sparkles className="h-2.5 w-2.5" /> Inicia 2 Nov
                </span>
              </div>
              <p className="text-[10px] sm:text-[11px] text-zinc-400">
                {FREE_REST_DAYS_PER_WEEK} descansos/sem • Meta{' '}
                {REQUIRED_WORKOUT_DAYS_PER_WEEK} días • Falta = $50 MXN
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
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
              className="hidden sm:flex items-center gap-1.5 rounded-xl bg-emerald-500 px-3.5 py-2 text-xs font-extrabold text-zinc-950 shadow-lg shadow-emerald-500/20 hover:bg-emerald-400 transition cursor-pointer"
            >
              <PlusCircle className="h-4 w-4" />
              <span>Subir Ejercicio / Foto</span>
            </button>

            {isAuthenticated && currentUser ? (
              <div className="flex items-center gap-1.5">
                <span className="inline-flex items-center gap-1 rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-2.5 py-1.5 text-xs font-bold text-emerald-300 max-w-32 sm:max-w-none truncate">
                  <UserCheck className="h-3.5 w-3.5 shrink-0" />
                  <span className="truncate">{currentUser.full_name}</span>
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
                className="flex items-center gap-1.5 rounded-xl border border-emerald-500/40 bg-emerald-500/15 px-3 py-2 text-xs font-bold text-emerald-300 hover:bg-emerald-500/25 transition cursor-pointer"
              >
                <LogIn className="h-4 w-4 text-emerald-400" />
                <span>Entrar</span>
              </button>
            )}
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-3.5 sm:px-4 pt-4 sm:pt-6 space-y-6 sm:space-y-8">
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
          <div className="lg:col-span-8 rounded-3xl border border-zinc-800 bg-gradient-to-br from-zinc-900 via-zinc-900/90 to-emerald-950/30 p-4 sm:p-6 flex flex-col justify-between space-y-4">
            <div className="space-y-2">
              <div className="flex flex-wrap items-center gap-1.5 sm:gap-2">
                <span className="inline-flex items-center gap-1 rounded-full bg-zinc-800 px-2.5 py-1 text-[11px] font-semibold text-zinc-300">
                  <Watch className="h-3 w-3 text-emerald-400" />
                  Apple • Samsung • Huawei
                </span>
                <span className="inline-flex items-center gap-1 rounded-full bg-zinc-800 px-2.5 py-1 text-[11px] font-semibold text-zinc-300">
                  <Database className="h-3 w-3 text-emerald-400" />
                  {loadingData
                    ? 'Sincronizando...'
                    : `${profiles.length} integrante${
                        profiles.length === 1 ? '' : 's'
                      } en vivo`}
                </span>
              </div>

              <h2 className="text-xl sm:text-3xl font-black text-white tracking-tight leading-snug">
                {currentUser ? (
                  <>
                    Hola, {currentUser.full_name} 👋{' '}
                    {hasCheckedInToday ? (
                      <span className="text-emerald-400 block sm:inline">
                        ¡Ya cumpliste hoy!
                      </span>
                    ) : isBeforeChallengeStart ? (
                      <span className="text-emerald-400 block sm:inline">
                        ¡El reto arranca mañana 2 de Nov!
                      </span>
                    ) : (
                      <span className="text-amber-400 block sm:inline">
                        ¡Aún no subes tu prueba de hoy!
                      </span>
                    )}
                  </>
                ) : (
                  <span>¡Bienvenido al Reto NoMorePanza! 💪</span>
                )}
              </h2>

              <p className="text-xs sm:text-sm text-zinc-300 max-w-2xl leading-relaxed">
                El reto inicia oficialmente el{' '}
                <strong className="text-emerald-400">
                  Lunes 2 de Noviembre
                </strong>
                . Debes entrenar{' '}
                <strong>{REQUIRED_WORKOUT_DAYS_PER_WEEK} días por semana</strong>{' '}
                subiendo tu <strong>foto de prueba obligatoria</strong> y datos
                de tu smartwatch. Tienes{' '}
                <strong>
                  {FREE_REST_DAYS_PER_WEEK} días de descanso libres por semana
                </strong>
                ; cada falta adicional cuesta <strong>$50 MXN</strong>.
              </p>
            </div>

            {/* Selector rápido de reloj para móvil */}
            {isAuthenticated && currentUser ? (
              <div className="flex items-center gap-2 md:hidden pt-1">
                <span className="text-xs text-zinc-400 shrink-0">
                  Tu reloj:
                </span>
                <div className="grid grid-cols-3 gap-1.5 flex-1">
                  {(['apple', 'samsung', 'huawei'] as WatchBrand[]).map(
                    (brand) => (
                      <button
                        key={brand}
                        type="button"
                        onClick={() => handleWatchBrandQuickChange(brand)}
                        className={`rounded-xl border py-1.5 px-2 text-[11px] font-bold transition ${
                          currentUser.watch_brand === brand
                            ? 'border-emerald-500 bg-emerald-500/20 text-emerald-300'
                            : 'border-zinc-800 bg-zinc-950/70 text-zinc-400'
                        }`}
                      >
                        {brand === 'apple'
                          ? '⌚ Apple'
                          : brand === 'samsung'
                          ? '⌚ Samsung'
                          : '⌚ Huawei'}
                      </button>
                    )
                  )}
                </div>
              </div>
            ) : null}

            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5 pt-1">
              <button
                type="button"
                onClick={handleOpenCheckIn}
                className="flex items-center justify-center gap-2 rounded-2xl bg-emerald-500 px-5 py-3.5 text-sm font-black text-zinc-950 shadow-xl shadow-emerald-500/20 hover:bg-emerald-400 active:scale-[0.99] transition cursor-pointer"
              >
                <Camera className="h-4 w-4" />
                {hasCheckedInToday
                  ? 'Actualizar mi Entrenamiento / Foto'
                  : 'Registrar Ejercicio + Subir Foto'}
              </button>

              <a
                href="/api/strava/connect"
                className="flex items-center justify-center gap-2 rounded-2xl border border-orange-500/40 bg-orange-500/15 px-4 py-3 text-xs font-bold text-orange-300 hover:bg-orange-500/25 transition text-center"
              >
                <Flame className="h-4 w-4 shrink-0" />
                <span>Vincular OAuth Strava (Reloj)</span>
              </a>
            </div>
          </div>

          {/* Tarjeta Resumen Personal de Multas y Descansos */}
          <div className="lg:col-span-4 rounded-3xl border border-zinc-800 bg-zinc-900/70 p-4 sm:p-5 flex flex-col justify-between space-y-3.5">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold uppercase tracking-wider text-zinc-400">
                Tu Resumen Semanal
              </span>
              {hasCheckedInToday ? (
                <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/20 px-2.5 py-0.5 text-xs font-bold text-emerald-300">
                  <CheckCircle2 className="h-3.5 w-3.5" /> Hoy cumplido
                </span>
              ) : isBeforeChallengeStart ? (
                <span className="inline-flex items-center gap-1 rounded-full bg-sky-500/20 px-2.5 py-0.5 text-xs font-bold text-sky-300">
                  Inicia 2 Nov
                </span>
              ) : (
                <span className="inline-flex items-center gap-1 rounded-full bg-amber-500/20 px-2.5 py-0.5 text-xs font-bold text-amber-300">
                  <ShieldAlert className="h-3.5 w-3.5" /> Pendiente hoy
                </span>
              )}
            </div>

            <div className="grid grid-cols-2 gap-2.5">
              <div className="rounded-2xl border border-zinc-800 bg-zinc-950 p-3">
                <p className="text-[11px] text-zinc-400">Días Entrenados</p>
                <p className="mt-1 text-2xl font-black text-emerald-400">
                  {currentUserStats.week_workouts}{' '}
                  <span className="text-xs font-normal text-zinc-500">
                    / {REQUIRED_WORKOUT_DAYS_PER_WEEK}
                  </span>
                </p>
              </div>

              <div className="rounded-2xl border border-zinc-800 bg-zinc-950 p-3">
                <p className="text-[11px] text-zinc-400">Descansos Gratis</p>
                <p className="mt-1 text-2xl font-black text-sky-400">
                  {currentUserStats.remaining_rest_days_this_week}{' '}
                  <span className="text-xs font-normal text-zinc-500">
                    / {FREE_REST_DAYS_PER_WEEK}
                  </span>
                </p>
              </div>
            </div>

            <div className="rounded-2xl border border-rose-500/30 bg-rose-500/10 p-3.5 flex items-center justify-between">
              <div>
                <p className="text-xs font-bold text-rose-200">
                  Tu Saldo de Multas ($50/día)
                </p>
                <p className="text-[11px] text-rose-300/80">
                  Por faltas &gt;{FREE_REST_DAYS_PER_WEEK} descansos/sem
                </p>
              </div>
              <span className="text-xl font-black text-rose-400">
                ${currentUserStats.unpaid_fine_mxn} MXN
              </span>
            </div>
          </div>
        </section>

        {/* Calendario Semanal Lunes a Domingo */}
        <section id="semana" className="scroll-mt-20">
          <WeeklyCalendarTracker profiles={profiles} logs={logs} />
        </section>

        {/* Tabla Gamificada (Ranking de Ejercicio + Tabla de Castigo de $50 MXN) */}
        <section id="ranking" className="scroll-mt-20">
          <GamifiedLeaderboard
            leaderboard={leaderboard}
            penalties={computedPenalties}
            totalPotMXN={totalPotMXN}
            onMarkPenaltyPaid={handleMarkPenaltyPaid}
            onPayAllUserPenalties={handlePayAllUserPenalties}
          />
        </section>

        {/* Muro de Fotos de Prueba + Métricas de Smartwatch */}
        <section id="muro" className="scroll-mt-20">
          <ProofFeed logs={logs} />
        </section>
      </main>

      {/* Barra de Navegación Inferior Fija para Móvil (Estilo App Nativa) */}
      <nav className="fixed bottom-0 inset-x-0 z-40 border-t border-zinc-800/90 bg-zinc-950/95 backdrop-blur-lg md:hidden">
        <div className="mx-auto grid max-w-md grid-cols-5 items-center px-2 py-1.5">
          <a
            href="#top"
            className="flex flex-col items-center justify-center py-1 text-[10px] font-semibold text-zinc-400 hover:text-emerald-400"
          >
            <Home className="h-4 w-4 mb-0.5" />
            <span>Inicio</span>
          </a>

          <a
            href="#semana"
            className="flex flex-col items-center justify-center py-1 text-[10px] font-semibold text-zinc-400 hover:text-emerald-400"
          >
            <CalendarDays className="h-4 w-4 mb-0.5" />
            <span>Semana</span>
          </a>

          <button
            type="button"
            onClick={handleOpenCheckIn}
            className="-mt-4 flex flex-col items-center justify-center"
          >
            <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-emerald-500 text-zinc-950 shadow-lg shadow-emerald-500/30 active:scale-95 transition">
              <Camera className="h-6 w-6" />
            </span>
            <span className="mt-0.5 text-[10px] font-extrabold text-emerald-400">
              Subir Foto
            </span>
          </button>

          <a
            href="#ranking"
            className="flex flex-col items-center justify-center py-1 text-[10px] font-semibold text-zinc-400 hover:text-emerald-400"
          >
            <Trophy className="h-4 w-4 mb-0.5" />
            <span>Ranking</span>
          </a>

          <a
            href="#muro"
            className="flex flex-col items-center justify-center py-1 text-[10px] font-semibold text-zinc-400 hover:text-emerald-400"
          >
            <Camera className="h-4 w-4 mb-0.5" />
            <span>Evidencias</span>
          </a>
        </div>
      </nav>

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
