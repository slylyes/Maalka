"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import type { FinancesPageData, Expense } from "@/app/dashboard/finances/page";

function formatAmount(v: number) {
  return `${v.toLocaleString("fr-FR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} DA`;
}

function formatDateFr(value: string) {
  const [y, m, d] = value.split("-");
  if (!y || !m || !d) return value;
  return `${d}-${m}-${y}`;
}

const CATEGORY_LABELS: Record<string, string> = {
  salaires: "Salaires",
  achat_robes: "Achat de robes",
  charges: "Charges",
  autre: "Autre",
};

// ── KPI card ─────────────────────────────────────────────────────────────────
function KpiCard({
  label,
  value,
  sub,
  highlight,
}: {
  label: string;
  value: string;
  sub?: string;
  highlight?: "positive" | "negative" | "neutral";
}) {
  const color =
    highlight === "positive"
      ? "text-emerald-700"
      : highlight === "negative"
        ? "text-rose-700"
        : "text-[var(--foreground)]";
  return (
    <div className="rounded-2xl border border-[var(--border-soft)] bg-white p-4">
      <p className="text-xs uppercase tracking-wide text-[var(--muted)]">{label}</p>
      <p className={`mt-2 text-2xl font-light ${color}`}>{value}</p>
      {sub && <p className="mt-1 text-xs text-[var(--muted)]">{sub}</p>}
    </div>
  );
}

// ── Add expense form ──────────────────────────────────────────────────────────
function AddExpenseForm({
  dressCategories,
  onAdded,
}: {
  dressCategories: string[];
  onAdded: () => void;
}) {
  const today = new Date().toISOString().slice(0, 10);
  const [date, setDate] = useState(today);
  const [amount, setAmount] = useState("");
  const [category, setCategory] = useState("charges");
  const [dressCategory, setDressCategory] = useState("");
  const [description, setDescription] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);

    const parsedAmount = Number(amount);
    if (!parsedAmount || parsedAmount <= 0) {
      setError("Le montant doit être positif.");
      setSubmitting(false);
      return;
    }

    const res = await fetch("/api/expenses", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        date,
        amount: parsedAmount,
        category,
        dress_category: category === "achat_robes" ? dressCategory || null : null,
        description: description || null,
      }),
    });

    const json = await res.json().catch(() => ({}));
    if (!res.ok) {
      setError(json.error ?? "Erreur lors de l'ajout.");
      setSubmitting(false);
      return;
    }

    setAmount("");
    setDescription("");
    setDressCategory("");
    setSubmitting(false);
    onAdded();
  }

  return (
    <form className="space-y-3" onSubmit={handleSubmit}>
      <div className="grid grid-cols-2 gap-2">
        <div>
          <label className="mb-1 block text-xs uppercase tracking-wide text-[var(--muted)]">Date</label>
          <input
            required
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            className="premium-input w-full"
          />
        </div>
        <div>
          <label className="mb-1 block text-xs uppercase tracking-wide text-[var(--muted)]">
            Montant (DA)
          </label>
          <input
            required
            type="number"
            min={0.01}
            step="0.01"
            placeholder="0.00"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            className="premium-input w-full"
          />
        </div>
      </div>

      <div>
        <label className="mb-1 block text-xs uppercase tracking-wide text-[var(--muted)]">Catégorie</label>
        <select
          value={category}
          onChange={(e) => {
            setCategory(e.target.value);
            setDressCategory("");
          }}
          className="premium-input w-full"
        >
          <option value="salaires">Salaires</option>
          <option value="achat_robes">Achat de robes</option>
          <option value="charges">Charges</option>
          <option value="autre">Autre</option>
        </select>
      </div>

      {category === "achat_robes" && (
        <div>
          <label className="mb-1 block text-xs uppercase tracking-wide text-[var(--muted)]">
            Catégorie de robe
          </label>
          <select
            value={dressCategory}
            onChange={(e) => setDressCategory(e.target.value)}
            className="premium-input w-full"
          >
            <option value="">— Non précisée —</option>
            {dressCategories.map((cat) => (
              <option key={cat} value={cat}>
                {cat}
              </option>
            ))}
          </select>
        </div>
      )}

      <div>
        <label className="mb-1 block text-xs uppercase tracking-wide text-[var(--muted)]">
          Description
        </label>
        <input
          type="text"
          placeholder="Description (optionnel)"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          className="premium-input w-full"
        />
      </div>

      {error && <p className="text-sm text-red-600">{error}</p>}

      <button
        disabled={submitting}
        type="submit"
        className="premium-btn w-full px-3 py-2.5 text-sm disabled:opacity-60"
      >
        {submitting ? "Ajout…" : "Ajouter la dépense"}
      </button>
    </form>
  );
}

// ── Expenses list ─────────────────────────────────────────────────────────────
function ExpensesList({
  expenses,
  onDeleted,
}: {
  expenses: Expense[];
  onDeleted: (id: string) => void;
}) {
  const [deleting, setDeleting] = useState<string | null>(null);

  async function handleDelete(id: string) {
    setDeleting(id);
    const res = await fetch(`/api/expenses/${id}`, { method: "DELETE" });
    const json = await res.json().catch(() => ({}));
    setDeleting(null);
    if (res.ok) {
      onDeleted(id);
    } else {
      alert(json.error ?? "Suppression impossible.");
    }
  }

  if (expenses.length === 0) {
    return <p className="mt-2 text-sm text-[var(--muted)]">Aucune dépense sur cette période.</p>;
  }

  return (
    <ul className="mt-2 max-h-80 space-y-2 overflow-y-auto">
      {expenses.map((e) => (
        <li
          key={e.id}
          className="flex items-start justify-between gap-2 rounded-xl border border-[var(--border-soft)] bg-white p-3 text-sm"
        >
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="font-medium text-[var(--foreground)]">{formatAmount(Number(e.amount))}</span>
              <span className="rounded-full bg-[var(--surface-soft)] px-2 py-0.5 text-xs text-[var(--muted)]">
                {CATEGORY_LABELS[e.category] ?? e.category}
                {e.dress_category ? ` — ${e.dress_category}` : ""}
              </span>
            </div>
            <p className="mt-0.5 text-xs text-[var(--muted)]">
              {formatDateFr(e.date)}
              {e.description ? ` · ${e.description}` : ""}
            </p>
          </div>
          <button
            type="button"
            disabled={deleting === e.id}
            onClick={() => void handleDelete(e.id)}
            className="shrink-0 rounded-lg border border-rose-200 bg-white px-2.5 py-1 text-xs text-rose-700 disabled:opacity-50"
          >
            {deleting === e.id ? "…" : "Supprimer"}
          </button>
        </li>
      ))}
    </ul>
  );
}

// ── Bar chart (generic) ───────────────────────────────────────────────────────
function BarChart({
  bars,
  maxValue,
}: {
  bars: { key: string; label: string; primary: number; secondary?: number; primaryLabel: string; secondaryLabel?: string }[];
  maxValue: number;
}) {
  const safeMax = Math.max(1, maxValue);
  return (
    <div className="flex items-end gap-2 overflow-x-auto pb-2 pt-4">
      {bars.map((bar) => {
        const primaryH = Math.max(4, Math.round((bar.primary / safeMax) * 120));
        const secondaryH = bar.secondary
          ? Math.max(4, Math.round((bar.secondary / safeMax) * 120))
          : 0;
        return (
          <div key={bar.key} className="flex min-w-[60px] flex-col items-center gap-1">
            <div className="text-[10px] text-[var(--muted)] text-center leading-tight">
              {Math.round(bar.primary / 1000) > 0 ? `${Math.round(bar.primary / 1000)}k` : bar.primary.toFixed(0)}
            </div>
            <div className="flex h-32 w-8 flex-col justify-end gap-0.5">
              {bar.secondary !== undefined && (
                <div
                  className="w-full rounded-t-sm bg-[var(--accent)] opacity-40"
                  style={{ height: `${secondaryH}px` }}
                  title={`${bar.secondaryLabel}: ${formatAmount(bar.secondary)}`}
                />
              )}
              <div
                className="w-full rounded-t-sm bg-[var(--accent)]"
                style={{ height: `${primaryH}px` }}
                title={`${bar.primaryLabel}: ${formatAmount(bar.primary)}`}
              />
            </div>
            <div className="text-[10px] uppercase tracking-wide text-[var(--muted)] text-center">
              {bar.label}
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ── Main client component ─────────────────────────────────────────────────────
export function FinancesClient({ data: initialData }: { data: FinancesPageData }) {
  const router = useRouter();
  const [expenses, setExpenses] = useState<Expense[]>(initialData.expenses);

  // When an expense is added via form: router.refresh() re-renders the server component
  // and passes fresh data. For immediate feedback, we also optimistically update the list.
  function handleExpenseAdded() {
    router.refresh();
  }

  function handleExpenseDeleted(id: string) {
    setExpenses((prev) => prev.filter((e) => e.id !== id));
    router.refresh();
  }

  const {
    period,
    today,
    periodStart,
    caTotal,
    encaissements,
    totalExpenses,
    profit,
    reservationsCount,
    monthlyBuckets,
    categoryAnalysis,
    forecastMonths,
    dressCategories,
  } = initialData;

  const maxMonthlyCA = Math.max(1, ...monthlyBuckets.map((b) => Math.max(b.ca, b.expenses)));
  const maxForecast = Math.max(1, ...forecastMonths.map((m) => m.caTotal));

  const totalForecastCA = forecastMonths.reduce((s, m) => s + m.caTotal, 0);
  const totalForecastPending = forecastMonths.reduce((s, m) => s + m.balancePending, 0);
  const totalForecastDeposits = forecastMonths.reduce((s, m) => s + m.depositCollected, 0);

  return (
    <section className="grid gap-5">
      {/* Header + period tabs */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h2 className="text-xl font-light tracking-wide text-[var(--foreground)]">
            Analyse financière
          </h2>
          <p className="text-sm text-[var(--muted)]">
            Du {formatDateFr(periodStart)} au {formatDateFr(today)}
          </p>
        </div>
        <div className="flex gap-2">
          {[30, 90, 180].map((value) => (
            <a
              key={value}
              href={`/dashboard/finances?period=${value}`}
              className={`rounded-lg border px-3 py-1.5 text-xs transition-colors ${
                value === period
                  ? "border-[var(--accent)] bg-[var(--surface-soft)] text-[var(--accent-deep)]"
                  : "border-[var(--border-soft)] bg-white text-[var(--muted)] hover:bg-[var(--surface-soft)]"
              }`}
            >
              {value} jours
            </a>
          ))}
        </div>
      </div>

      {/* KPI cards */}
      <article className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <KpiCard
          label={`CA (${reservationsCount} réservations)`}
          value={formatAmount(caTotal)}
          sub="Hors annulations et brouillons"
        />
        <KpiCard
          label="Encaissé"
          value={formatAmount(encaissements)}
          sub="Acomptes + soldes au 1er jour de location"
          highlight="neutral"
        />
        <KpiCard
          label="Dépenses"
          value={formatAmount(totalExpenses)}
          highlight="negative"
        />
        <KpiCard
          label="Bénéfice"
          value={formatAmount(profit)}
          sub={profit >= 0 ? "Positif" : "Déficitaire"}
          highlight={profit >= 0 ? "positive" : "negative"}
        />
      </article>

      {/* Main grid: expenses form + category analysis */}
      <div className="grid gap-5 xl:grid-cols-12">
        {/* Left: expense form + list */}
        <article className="premium-card p-6 xl:col-span-5">
          <h3 className="text-lg font-light tracking-wide text-[var(--foreground)]">Nouvelle dépense</h3>
          <div className="mt-3">
            <AddExpenseForm dressCategories={dressCategories} onAdded={handleExpenseAdded} />
          </div>

          <div className="mt-5">
            <h3 className="text-sm font-medium uppercase tracking-wide text-[var(--muted)]">
              Dépenses de la période
            </h3>
            <ExpensesList expenses={expenses} onDeleted={handleExpenseDeleted} />
          </div>

          {/* Breakdown by expense category */}
          {expenses.length > 0 && (
            <div className="mt-4 space-y-1.5 rounded-xl border border-[var(--border-soft)] bg-[var(--surface-soft)] p-3">
              <p className="text-xs font-medium uppercase tracking-wide text-[var(--muted)]">
                Répartition
              </p>
              {Object.entries(CATEGORY_LABELS).map(([key, label]) => {
                const total = expenses
                  .filter((e) => e.category === key)
                  .reduce((s, e) => s + Number(e.amount), 0);
                if (total === 0) return null;
                return (
                  <div key={key} className="flex justify-between text-sm">
                    <span className="text-[var(--muted)]">{label}</span>
                    <span className="text-[var(--foreground)]">{formatAmount(total)}</span>
                  </div>
                );
              })}
            </div>
          )}
        </article>

        {/* Right: category profitability + monthly chart */}
        <div className="flex flex-col gap-5 xl:col-span-7">
          {/* Category profitability table */}
          <article className="premium-card p-6">
            <h3 className="text-lg font-light tracking-wide text-[var(--foreground)]">
              Rentabilité par catégorie de robe
            </h3>
            <p className="mt-1 text-xs text-[var(--muted)]">
              CA = loyers encaissés · Achats = dépenses catégorie &quot;Achat de robes&quot;
            </p>
            {categoryAnalysis.length === 0 ? (
              <p className="mt-4 text-sm text-[var(--muted)]">
                Aucune donnée disponible sur cette période.
              </p>
            ) : (
              <div className="mt-4 overflow-x-auto">
                <table className="min-w-full text-left text-sm">
                  <thead>
                    <tr className="text-xs uppercase tracking-wide text-[var(--muted)]">
                      <th className="pb-2 pr-4 font-medium">Catégorie</th>
                      <th className="pb-2 pr-4 font-medium text-right">CA loyers</th>
                      <th className="pb-2 pr-4 font-medium text-right">Achats</th>
                      <th className="pb-2 font-medium text-right">Bénéfice</th>
                    </tr>
                  </thead>
                  <tbody>
                    {categoryAnalysis.map((row) => (
                      <tr
                        key={row.category}
                        className="border-t border-[var(--border-soft)] text-[var(--muted)]"
                      >
                        <td className="py-2.5 pr-4 font-medium text-[var(--foreground)]">
                          {row.category}
                        </td>
                        <td className="py-2.5 pr-4 text-right">{formatAmount(row.revenue)}</td>
                        <td className="py-2.5 pr-4 text-right">
                          {row.purchaseExpenses > 0 ? (
                            <span className="text-rose-700">{formatAmount(row.purchaseExpenses)}</span>
                          ) : (
                            "—"
                          )}
                        </td>
                        <td
                          className={`py-2.5 text-right font-medium ${
                            row.profit >= 0 ? "text-emerald-700" : "text-rose-700"
                          }`}
                        >
                          {formatAmount(row.profit)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </article>

          {/* Monthly evolution chart */}
          <article className="premium-card p-6">
            <h3 className="text-lg font-light tracking-wide text-[var(--foreground)]">
              Évolution mensuelle
            </h3>
            <p className="mt-1 text-xs text-[var(--muted)]">CA (foncé) · Dépenses (clair)</p>
            <BarChart
              bars={monthlyBuckets.map((b) => ({
                key: b.key,
                label: b.label,
                primary: b.ca,
                secondary: b.expenses,
                primaryLabel: "CA",
                secondaryLabel: "Dépenses",
              }))}
              maxValue={maxMonthlyCA}
            />
          </article>
        </div>
      </div>

      {/* Forecast section */}
      <article className="premium-card p-6">
        <div className="flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h3 className="text-lg font-light tracking-wide text-[var(--foreground)]">
              Prévisions 6 mois
            </h3>
            <p className="text-sm text-[var(--muted)]">
              Basé sur les réservations à venir (hors annulations)
            </p>
          </div>
          <div className="flex gap-6 text-sm">
            <div>
              <span className="text-[var(--muted)]">CA prévisionnel </span>
              <span className="font-medium text-[var(--foreground)]">{formatAmount(totalForecastCA)}</span>
            </div>
            <div>
              <span className="text-[var(--muted)]">Acomptes reçus </span>
              <span className="font-medium text-emerald-700">{formatAmount(totalForecastDeposits)}</span>
            </div>
            <div>
              <span className="text-[var(--muted)]">Reste à encaisser </span>
              <span className="font-medium text-[var(--foreground)]">{formatAmount(totalForecastPending)}</span>
            </div>
          </div>
        </div>

        {forecastMonths.every((m) => m.caTotal === 0) ? (
          <p className="mt-4 text-sm text-[var(--muted)]">
            Aucune réservation enregistrée pour les 6 prochains mois.
          </p>
        ) : (
          <>
            {/* Stacked bar: deposit (dark) + pending (light) = total */}
            <div className="mt-4 flex items-end gap-2 overflow-x-auto pb-2">
              {forecastMonths.map((m) => {
                const safeMax = Math.max(1, maxForecast);
                const totalH = Math.max(m.caTotal > 0 ? 8 : 0, Math.round((m.caTotal / safeMax) * 120));
                const depositRatio = m.caTotal > 0 ? m.depositCollected / m.caTotal : 0;
                const depositH = Math.round(totalH * depositRatio);
                const pendingH = totalH - depositH;

                return (
                  <div key={m.key} className="flex min-w-[64px] flex-col items-center gap-1">
                    <div className="text-[10px] text-[var(--muted)]">
                      {Math.round(m.caTotal / 1000) > 0
                        ? `${Math.round(m.caTotal / 1000)}k`
                        : m.caTotal > 0
                          ? m.caTotal.toFixed(0)
                          : "—"}
                    </div>
                    <div className="flex h-32 w-10 flex-col justify-end">
                      {pendingH > 0 && (
                        <div
                          className="w-full bg-[var(--accent)] opacity-30 rounded-t-sm"
                          style={{ height: `${pendingH}px` }}
                          title={`Reste à encaisser: ${formatAmount(m.balancePending)}`}
                        />
                      )}
                      {depositH > 0 && (
                        <div
                          className="w-full bg-[var(--accent)]"
                          style={{ height: `${depositH}px`, borderRadius: pendingH > 0 ? "0" : "4px 4px 0 0" }}
                          title={`Acomptes reçus: ${formatAmount(m.depositCollected)}`}
                        />
                      )}
                    </div>
                    <div className="text-[10px] uppercase tracking-wide text-[var(--muted)] text-center">
                      {m.label}
                    </div>
                    {m.balancePending > 0 && (
                      <div className="text-[9px] text-[var(--muted)] text-center">
                        +{Math.round(m.balancePending / 1000) > 0
                          ? `${Math.round(m.balancePending / 1000)}k`
                          : m.balancePending.toFixed(0)} att.
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
            <div className="mt-3 flex gap-4 text-xs text-[var(--muted)]">
              <span className="flex items-center gap-1.5">
                <span className="inline-block h-2.5 w-4 rounded-sm bg-[var(--accent)]" />
                Acomptes reçus
              </span>
              <span className="flex items-center gap-1.5">
                <span className="inline-block h-2.5 w-4 rounded-sm bg-[var(--accent)] opacity-30" />
                Reste à encaisser
              </span>
            </div>
          </>
        )}
      </article>
    </section>
  );
}
