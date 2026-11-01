'use client';

import React, { useState } from 'react';
import { LeaderboardEntry, PenaltyRecord } from '@/types/fitness';
import { getWatchLabel } from '@/lib/penalty-engine';
import {
  Award,
  CheckCircle,
  Coins,
  Flame,
  PiggyBank,
  ShieldAlert,
  Trophy,
  Watch,
} from 'lucide-react';

interface GamifiedLeaderboardProps {
  leaderboard: LeaderboardEntry[];
  penalties: PenaltyRecord[];
  totalPotMXN: number;
  onMarkPenaltyPaid: (penaltyId: string) => void;
}

export function GamifiedLeaderboard({
  leaderboard,
  penalties,
  totalPotMXN,
  onMarkPenaltyPaid,
}: GamifiedLeaderboardProps) {
  const [activeTab, setActiveTab] = useState<'athletes' | 'debtors'>('athletes');

  // Ranking ordenado por los que más han fallado / más dinero deben al cochinito
  const debtorsRanking = leaderboard.toSorted((a, b) => {
    if (b.unpaid_fine_mxn !== a.unpaid_fine_mxn) {
      return b.unpaid_fine_mxn - a.unpaid_fine_mxn;
    }
    return b.penalty_days - a.penalty_days;
  });

  const unpaidPotMXN = penalties
    .filter((p) => !p.is_paid)
    .reduce((sum, p) => sum + p.amount_mxn, 0);

  return (
    <div className="space-y-4">
      {/* Banner del Cochinito Acumulado ($50 MXN por falta) */}
      <div className="relative overflow-hidden rounded-2xl border border-amber-500/30 bg-gradient-to-r from-amber-500/15 via-rose-500/10 to-zinc-900 p-5">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div className="flex items-start gap-3.5">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-amber-500/20 border border-amber-500/40 text-amber-300">
              <PiggyBank className="h-6 w-6" />
            </div>
            <div>
              <span className="inline-flex items-center gap-1 rounded-full bg-amber-500/20 px-2.5 py-0.5 text-[11px] font-bold text-amber-300">
                Regla Oficial: 2 Descansos Libres/Semana • 3er Fallo = $50 MXN
              </span>
              <h3 className="mt-1 text-lg font-extrabold text-white">
                Bote Acumulado del Castigo Familiar / Amigos
              </h3>
              <p className="text-xs text-zinc-300">
                Cada día sin foto de prueba ni registro de smartwatch después de
                tus 2 descansos semanales suma{' '}
                <strong className="text-amber-300">$50.00 MXN</strong> al pozo.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-4 sm:text-right">
            <div className="rounded-xl border border-zinc-800 bg-zinc-950/80 px-4 py-2.5">
              <p className="text-[11px] uppercase tracking-wider text-zinc-400">
                Por Cobrar
              </p>
              <p className="text-xl font-black text-rose-400">
                ${unpaidPotMXN.toLocaleString('es-MX')} MXN
              </p>
            </div>
            <div className="rounded-xl border border-amber-500/40 bg-zinc-950/90 px-4 py-2.5">
              <p className="text-[11px] uppercase tracking-wider text-amber-300/80">
                Acumulado Total
              </p>
              <p className="text-2xl font-black text-amber-400">
                ${totalPotMXN.toLocaleString('es-MX')} MXN
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Selector de Pestañas del Ranking */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="inline-flex rounded-xl border border-zinc-800 bg-zinc-900 p-1">
          <button
            type="button"
            onClick={() => setActiveTab('athletes')}
            className={`flex items-center gap-2 rounded-lg px-4 py-2 text-xs font-bold transition cursor-pointer ${
              activeTab === 'athletes'
                ? 'bg-emerald-500 text-zinc-950 shadow'
                : 'text-zinc-400 hover:text-white'
            }`}
          >
            <Trophy className="h-4 w-4" />
            Ranking de Cumplimiento (Más Ejercitados)
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('debtors')}
            className={`flex items-center gap-2 rounded-lg px-4 py-2 text-xs font-bold transition cursor-pointer ${
              activeTab === 'debtors'
                ? 'bg-rose-500 text-white shadow'
                : 'text-zinc-400 hover:text-white'
            }`}
          >
            <Coins className="h-4 w-4" />
            Tabla de Multas y Faltas ($50 MXN/día)
          </button>
        </div>
      </div>

      {activeTab === 'athletes' ? (
        /* TABLA 1: RANKING DE LOS QUE MÁS SE HAN EJERCITADO */
        <div className="overflow-hidden rounded-2xl border border-zinc-800 bg-zinc-900/60">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-zinc-800 bg-zinc-950/80 text-[11px] uppercase tracking-wider text-zinc-400">
                <tr>
                  <th className="px-4 py-3.5">Rank</th>
                  <th className="px-4 py-3.5">Integrante & Smartwatch</th>
                  <th className="px-4 py-3.5">Semana (Meta 5 días)</th>
                  <th className="px-4 py-3.5">Descansos Libres</th>
                  <th className="px-4 py-3.5">Kcal / Minutos</th>
                  <th className="px-4 py-3.5">Multa Acumulada</th>
                  <th className="px-4 py-3.5 text-right">Puntos XP</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-800/70">
                {leaderboard.map((entry, idx) => {
                  const rankMedal =
                    idx === 0
                      ? '🥇 1°'
                      : idx === 1
                      ? '🥈 2°'
                      : idx === 2
                      ? '🥉 3°'
                      : `#${idx + 1}`;
                  const progressPct = Math.min(
                    100,
                    Math.round((entry.week_workouts / 5) * 100)
                  );

                  return (
                    <tr
                      key={entry.user_id}
                      className="hover:bg-zinc-800/30 transition"
                    >
                      <td className="px-4 py-3.5 font-extrabold text-white whitespace-nowrap">
                        <span className="inline-flex items-center rounded-lg bg-zinc-800 px-2.5 py-1 text-xs">
                          {rankMedal}
                        </span>
                      </td>

                      <td className="px-4 py-3.5">
                        <div className="font-bold text-white flex items-center gap-2">
                          <span>{entry.full_name}</span>
                          <span className="rounded-full bg-zinc-800 px-2 py-0.5 text-[10px] font-semibold text-emerald-400">
                            {entry.badge}
                          </span>
                        </div>
                        <div className="mt-0.5 flex items-center gap-1.5 text-xs text-zinc-400">
                          <Watch className="h-3.5 w-3.5 text-zinc-500" />
                          <span>{getWatchLabel(entry.watch_brand)}</span>
                        </div>
                      </td>

                      <td className="px-4 py-3.5">
                        <div className="flex items-center justify-between text-xs mb-1">
                          <span className="font-bold text-emerald-400">
                            {entry.week_workouts} / 5 entrenados
                          </span>
                          <span className="text-zinc-500">
                            Total: {entry.total_workouts}d
                          </span>
                        </div>
                        <div className="h-2 w-36 overflow-hidden rounded-full bg-zinc-800">
                          <div
                            className="h-full rounded-full bg-emerald-500 transition-all"
                            style={{ width: `${progressPct}%` }}
                          />
                        </div>
                      </td>

                      <td className="px-4 py-3.5">
                        <span
                          className={`inline-flex items-center rounded-lg px-2.5 py-1 text-xs font-semibold ${
                            entry.remaining_rest_days_this_week > 0
                              ? 'bg-sky-500/15 text-sky-300 border border-sky-500/30'
                              : 'bg-amber-500/15 text-amber-300 border border-amber-500/30'
                          }`}
                        >
                          {entry.remaining_rest_days_this_week} de 2 disponibles
                        </span>
                      </td>

                      <td className="px-4 py-3.5">
                        <div className="flex items-center gap-1 font-semibold text-orange-300 text-xs">
                          <Flame className="h-3.5 w-3.5" />
                          {entry.total_calories.toLocaleString('es-MX')} kcal
                        </div>
                        <div className="text-[11px] text-zinc-400">
                          {entry.total_minutes} min activos
                        </div>
                      </td>

                      <td className="px-4 py-3.5">
                        {entry.unpaid_fine_mxn > 0 ? (
                          <span className="inline-flex items-center gap-1 rounded-lg bg-rose-500/20 border border-rose-500/40 px-2.5 py-1 text-xs font-extrabold text-rose-300">
                            Debe ${entry.unpaid_fine_mxn} MXN (
                            {entry.penalty_days} faltas)
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 rounded-lg bg-emerald-500/15 border border-emerald-500/30 px-2.5 py-1 text-xs font-bold text-emerald-300">
                            $0 MXN • Al corriente
                          </span>
                        )}
                      </td>

                      <td className="px-4 py-3.5 text-right">
                        <span className="inline-flex items-center gap-1 rounded-xl bg-zinc-950 border border-zinc-800 px-3 py-1.5 text-xs font-black text-emerald-400">
                          <Award className="h-3.5 w-3.5" />
                          {entry.xp_score} XP
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        /* TABLA 2: MURO DEL CASTIGO MONETARIO ($50 MXN POR DÍA FALLADO) */
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
          <div className="lg:col-span-5 rounded-2xl border border-rose-500/30 bg-zinc-900/70 p-4 space-y-3">
            <div className="flex items-center gap-2 text-rose-400">
              <ShieldAlert className="h-5 w-5" />
              <h4 className="text-sm font-bold text-white">
                Ranking de Faltas y Deudores ($50 MXN / día)
              </h4>
            </div>
            <p className="text-xs text-zinc-400">
              Ordenado por quienes más días han faltado después de usar sus 2
              descansos semanales.
            </p>

            <div className="space-y-2.5">
              {debtorsRanking.map((person, index) => (
                <div
                  key={person.user_id}
                  className="flex items-center justify-between rounded-xl border border-zinc-800 bg-zinc-950 p-3"
                >
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-black text-rose-400">
                        #{index + 1}
                      </span>
                      <span className="text-sm font-bold text-white">
                        {person.full_name}
                      </span>
                    </div>
                    <p className="text-xs text-zinc-400 mt-0.5">
                      {person.penalty_days} día(s) de castigo • Total histórico: $
                      {person.total_fine_mxn} MXN
                    </p>
                  </div>

                  <div className="text-right">
                    <span
                      className={`inline-block rounded-xl px-3 py-1 text-xs font-black ${
                        person.unpaid_fine_mxn > 0
                          ? 'bg-rose-500 text-white'
                          : 'bg-zinc-800 text-zinc-400'
                      }`}
                    >
                      Debe ${person.unpaid_fine_mxn} MXN
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="lg:col-span-7 rounded-2xl border border-zinc-800 bg-zinc-900/70 p-4 space-y-3">
            <h4 className="text-sm font-bold text-white">
              Historial Detallado de Multas ($50 MXN cada una)
            </h4>
            {penalties.length === 0 ? (
              <div className="rounded-xl border border-zinc-800 bg-zinc-950 p-6 text-center text-xs text-zinc-400">
                ¡Nadie tiene multas registradas todavía! Todos han cumplido con
                su foto y smartwatch.
              </div>
            ) : (
              <div className="space-y-2.5 max-h-80 overflow-y-auto pr-1">
                {penalties.map((pen) => (
                  <div
                    key={pen.id}
                    className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 rounded-xl border border-zinc-800 bg-zinc-950 p-3"
                  >
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-bold text-white">
                          {pen.user_name || 'Integrante'}
                        </span>
                        <span className="text-[11px] text-zinc-500">
                          • Fecha: {pen.penalty_date}
                        </span>
                        <span className="rounded-md bg-rose-500/20 px-2 py-0.5 text-[11px] font-bold text-rose-300">
                          +${pen.amount_mxn} MXN
                        </span>
                      </div>
                      <p className="text-xs text-zinc-400 mt-0.5">
                        {pen.reason}
                      </p>
                    </div>

                    <div className="flex items-center gap-2">
                      {pen.is_paid ? (
                        <span className="inline-flex items-center gap-1 rounded-lg bg-emerald-500/15 border border-emerald-500/30 px-2.5 py-1 text-xs font-bold text-emerald-300">
                          <CheckCircle className="h-3.5 w-3.5" /> Pagado
                        </span>
                      ) : (
                        <button
                          type="button"
                          onClick={() => onMarkPenaltyPaid(pen.id)}
                          className="rounded-lg bg-amber-500 px-3 py-1.5 text-xs font-extrabold text-zinc-950 hover:bg-amber-400 transition cursor-pointer"
                        >
                          Marcar $50 Pagados
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
