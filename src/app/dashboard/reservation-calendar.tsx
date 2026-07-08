"use client";

import { useMemo, useState } from "react";
import { ChevronLeftIcon, ChevronRightIcon } from "@heroicons/react/24/outline";

import { formatAmount, formatDateFr } from "@/lib/format";
import { useEscapeKey } from "@/lib/use-escape-key";

export type CalendarReservation = {
  id: string;
  contractNumber: string;
  clientName: string;
  startDate: string;
  endDate: string;
  totalPrice: number;
  balanceDue: number;
  dressLabels: string[];
  status: string;
};

type Phase = "completed" | "in_progress" | "upcoming";

const WEEKDAY_LABELS = ["Lun", "Mar", "Mer", "Jeu", "Ven", "Sam", "Dim"];

const PHASE_META: Record<Phase, { label: string; badgeClassName: string; cellClassName: string; dotClassName: string; counterClassName: string }> = {
  completed: {
    label: "Terminée (robe rendue)",
    badgeClassName: "border-emerald-200 bg-emerald-50 text-emerald-700",
    cellClassName: "border-emerald-300 bg-emerald-100 text-emerald-700 hover:bg-emerald-200",
    dotClassName: "border-emerald-300 bg-emerald-100",
    counterClassName: "bg-emerald-600",
  },
  in_progress: {
    label: "En cours",
    badgeClassName: "border-amber-200 bg-amber-50 text-amber-700",
    cellClassName: "border-amber-300 bg-amber-100 text-amber-700 hover:bg-amber-200",
    dotClassName: "border-amber-300 bg-amber-100",
    counterClassName: "bg-amber-600",
  },
  upcoming: {
    label: "À venir",
    badgeClassName: "border-rose-200 bg-rose-50 text-rose-700",
    cellClassName: "border-rose-300 bg-rose-100 text-rose-700 hover:bg-rose-200",
    dotClassName: "border-rose-300 bg-rose-100",
    counterClassName: "bg-rose-600",
  },
};

function reservationPhase(status: string): Phase {
  if (status === "completed") return "completed";
  if (status === "rented") return "in_progress";
  return "upcoming"; // reserved, preparing
}

/** Phase dominante du jour: en cours > à venir > terminée (priorité à ce qui demande une action). */
function dayPhase(dayReservations: CalendarReservation[]): Phase | null {
  if (dayReservations.length === 0) return null;
  const phases = dayReservations.map((r) => reservationPhase(r.status));
  if (phases.includes("in_progress")) return "in_progress";
  if (phases.includes("upcoming")) return "upcoming";
  return "completed";
}

function toDateStr(year: number, month: number, day: number) {
  return `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

function capitalize(value: string) {
  return value.charAt(0).toUpperCase() + value.slice(1);
}

function DayModal({
  dateStr,
  reservations,
  onClose,
}: {
  dateStr: string;
  reservations: CalendarReservation[];
  onClose: () => void;
}) {
  useEscapeKey(onClose);

  const label = capitalize(
    new Date(`${dateStr}T00:00:00`).toLocaleDateString("fr-FR", {
      weekday: "long",
      day: "numeric",
      month: "long",
      year: "numeric",
    })
  );

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="premium-card w-full max-w-lg overflow-y-auto max-h-[85vh] p-6">
        <div className="mb-4 flex items-center justify-between gap-2">
          <h2 className="text-lg font-light tracking-wide text-[var(--foreground)]">Sorties du {label}</h2>
          <button
            type="button"
            onClick={onClose}
            className="btn-secondary rounded-lg border border-[var(--border-soft)] px-3 py-1 text-sm text-[var(--muted)]"
          >
            Fermer
          </button>
        </div>
        <ul className="space-y-3">
          {reservations.map((r) => {
            const phase = PHASE_META[reservationPhase(r.status)];
            return (
            <li key={r.id} className="rounded-xl border border-[var(--border-soft)] bg-white p-3.5">
              <div className="flex items-start justify-between gap-2">
                <p className="truncate font-medium text-[var(--foreground)]">{r.clientName || "Client inconnu"}</p>
                <p className="shrink-0 text-sm font-medium text-[var(--foreground)]">{formatAmount(r.totalPrice)}</p>
              </div>
              <div className="mt-1 flex items-center gap-2">
                <p className="font-mono text-[11px] text-[var(--muted)]">{r.contractNumber}</p>
                <span className={`shrink-0 rounded-full border px-2 py-0.5 text-[10px] font-medium ${phase.badgeClassName}`}>
                  {phase.label}
                </span>
              </div>
              <p className="mt-2 text-xs text-[var(--muted)]">
                {formatDateFr(r.startDate)} → {formatDateFr(r.endDate)}
              </p>
              <p className="mt-1 text-xs text-[var(--muted)]">
                Reste à payer{" "}
                <span className={`font-medium ${r.balanceDue > 0 ? "text-amber-700" : "text-emerald-700"}`}>
                  {formatAmount(r.balanceDue)}
                </span>
              </p>
              {r.dressLabels.length > 0 ? (
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {r.dressLabels.map((label2, idx) => (
                    <span
                      key={`${label2}-${idx}`}
                      className="rounded-md bg-[var(--surface-soft)] px-2 py-0.5 text-xs font-medium text-[var(--foreground)]"
                    >
                      {label2}
                    </span>
                  ))}
                </div>
              ) : null}
            </li>
            );
          })}
        </ul>
      </div>
    </div>
  );
}

export function ReservationCalendar({ reservations }: { reservations: CalendarReservation[] }) {
  const now = new Date();
  const [currentMonth, setCurrentMonth] = useState(() => new Date(now.getFullYear(), now.getMonth(), 1));
  const [selectedDate, setSelectedDate] = useState<string | null>(null);

  const todayStr = new Date().toISOString().slice(0, 10);

  const reservationsByDate = useMemo(() => {
    const map = new Map<string, CalendarReservation[]>();
    for (const r of reservations) {
      const list = map.get(r.startDate) ?? [];
      list.push(r);
      map.set(r.startDate, list);
    }
    return map;
  }, [reservations]);

  const year = currentMonth.getFullYear();
  const month = currentMonth.getMonth();

  const cells = useMemo(() => {
    const firstWeekday = (new Date(year, month, 1).getDay() + 6) % 7; // Monday = 0
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const totalCells = firstWeekday + daysInMonth;
    const trailingBlanks = (7 - (totalCells % 7)) % 7;

    const days: ({ dateStr: string; day: number } | null)[] = [
      ...Array(firstWeekday).fill(null),
      ...Array.from({ length: daysInMonth }, (_, i) => ({ dateStr: toDateStr(year, month, i + 1), day: i + 1 })),
      ...Array(trailingBlanks).fill(null),
    ];
    return days;
  }, [year, month]);

  const monthLabel = capitalize(currentMonth.toLocaleDateString("fr-FR", { month: "long", year: "numeric" }));

  return (
    <article className="premium-card p-6">
      <div className="flex items-center justify-between gap-2">
        <h2 className="text-xl font-light tracking-wide text-[var(--foreground)]">Calendrier des sorties</h2>
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => setCurrentMonth(new Date(year, month - 1, 1))}
            className="btn-secondary rounded-lg border border-[var(--border-soft)] p-1.5 text-[var(--muted)]"
            aria-label="Mois précédent"
          >
            <ChevronLeftIcon className="h-4 w-4" />
          </button>
          <span className="min-w-[9rem] text-center text-sm font-medium text-[var(--foreground)]">
            {monthLabel}
          </span>
          <button
            type="button"
            onClick={() => setCurrentMonth(new Date(year, month + 1, 1))}
            className="btn-secondary rounded-lg border border-[var(--border-soft)] p-1.5 text-[var(--muted)]"
            aria-label="Mois suivant"
          >
            <ChevronRightIcon className="h-4 w-4" />
          </button>
          <button
            type="button"
            onClick={() => setCurrentMonth(new Date(now.getFullYear(), now.getMonth(), 1))}
            className="btn-secondary ml-1 rounded-lg border border-[var(--border-soft)] px-2.5 py-1.5 text-xs text-[var(--muted)]"
          >
            Aujourd&apos;hui
          </button>
        </div>
      </div>

      <div className="mt-4 grid grid-cols-7 gap-1.5">
        {WEEKDAY_LABELS.map((label) => (
          <div key={label} className="text-center text-[11px] font-medium uppercase tracking-wide text-[var(--muted)]">
            {label}
          </div>
        ))}
        {cells.map((cell, index) => {
          if (!cell) return <div key={`blank-${index}`} />;
          const dayReservations = reservationsByDate.get(cell.dateStr) ?? [];
          const hasReservations = dayReservations.length > 0;
          const isToday = cell.dateStr === todayStr;
          const phase = dayPhase(dayReservations);

          return (
            <button
              key={cell.dateStr}
              type="button"
              disabled={!hasReservations}
              onClick={() => setSelectedDate(cell.dateStr)}
              className={`relative flex aspect-square flex-col items-center justify-center rounded-lg border text-sm transition-colors ${
                phase
                  ? `cursor-pointer font-semibold ${PHASE_META[phase].cellClassName}`
                  : "border-transparent text-[var(--foreground)]"
              } ${isToday ? "ring-2 ring-[var(--accent)]" : ""}`}
            >
              {cell.day}
              {dayReservations.length > 1 ? (
                <span
                  className={`absolute -top-1 -right-1 flex h-4 w-4 items-center justify-center rounded-full text-[9px] font-medium text-white ${
                    phase ? PHASE_META[phase].counterClassName : "bg-stone-500"
                  }`}
                >
                  {dayReservations.length}
                </span>
              ) : null}
            </button>
          );
        })}
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1.5 text-xs text-[var(--muted)]">
        {(Object.keys(PHASE_META) as Phase[]).map((key) => (
          <span key={key} className="flex items-center gap-1.5">
            <span className={`h-2.5 w-2.5 rounded-full border ${PHASE_META[key].dotClassName}`} />
            {PHASE_META[key].label}
          </span>
        ))}
      </div>

      {selectedDate ? (
        <DayModal
          dateStr={selectedDate}
          reservations={reservationsByDate.get(selectedDate) ?? []}
          onClose={() => setSelectedDate(null)}
        />
      ) : null}
    </article>
  );
}
