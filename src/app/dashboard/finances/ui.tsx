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

// ── Date range picker ──────────────────────────────────────────────────────
function DateRangePicker({ from, to }: { from: string; to: string }) {
  const router = useRouter();
  const [f, setF] = useState(from);
  const [t, setT] = useState(to);

  function go(nf: string, nt: string) {
    router.push(`/dashboard/finances?from=${nf}&to=${nt}`);
  }

  function applyPreset(days: number) {
    const today = new Date().toISOString().slice(0, 10);
    const d = new Date(today + "T00:00:00Z");
    d.setUTCDate(d.getUTCDate() - (days - 1));
    const nf = d.toISOString().slice(0, 10);
    setF(nf);
    setT(today);
    go(nf, today);
  }

  function applyThisMonth() {
    const today = new Date().toISOString().slice(0, 10);
    const nf = today.slice(0, 7) + "-01";
    setF(nf);
    setT(today);
    go(nf, today);
  }

  return (
    <div className="flex flex-col gap-2 sm:items-end">
      <div className="flex flex-wrap items-end gap-2">
        <div>
          <label className="mb-1 block text-[10px] uppercase tracking-wide text-[var(--muted)]">Du</label>
          <input
            type="date"
            value={f}
            max={t}
            onChange={(e) => setF(e.target.value)}
            className="premium-input"
          />
        </div>
        <div>
          <label className="mb-1 block text-[10px] uppercase tracking-wide text-[var(--muted)]">Au</label>
          <input
            type="date"
            value={t}
            min={f}
            onChange={(e) => setT(e.target.value)}
            className="premium-input"
          />
        </div>
        <button
          type="button"
          onClick={() => go(f, t)}
          className="premium-btn px-4 py-2 text-xs"
        >
          Appliquer
        </button>
      </div>
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => applyPreset(30)}
          className="rounded-lg border border-[var(--border-soft)] bg-white px-2.5 py-1 text-xs text-[var(--muted)] hover:bg-[var(--surface-soft)]"
        >
          30 j
        </button>
        <button
          type="button"
          onClick={() => applyPreset(90)}
          className="rounded-lg border border-[var(--border-soft)] bg-white px-2.5 py-1 text-xs text-[var(--muted)] hover:bg-[var(--surface-soft)]"
        >
          90 j
        </button>
        <button
          type="button"
          onClick={() => applyPreset(180)}
          className="rounded-lg border border-[var(--border-soft)] bg-white px-2.5 py-1 text-xs text-[var(--muted)] hover:bg-[var(--surface-soft)]"
        >
          180 j
        </button>
        <button
          type="button"
          onClick={applyThisMonth}
          className="rounded-lg border border-[var(--border-soft)] bg-white px-2.5 py-1 text-xs text-[var(--muted)] hover:bg-[var(--surface-soft)]"
        >
          Ce mois-ci
        </button>
      </div>
    </div>
  );
}

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
    from,
    to,
    caEncaisse,
    acomptes,
    soldes,
    totalExpenses,
    profit,
    reservationsCount,
    monthlyBuckets,
    categoryAnalysis,
    forecastMonths,
    dressCategories,
  } = initialData;

  const maxMonthlyCA = Math.max(1, ...monthlyBuckets.map((b) => Math.max(b.ca, b.expenses)));
  const maxForecast = Math.max(1, ...forecastMonths.map((m) => m.balancePending));

  const totalForecastPending = forecastMonths.reduce((s, m) => s + m.balancePending, 0);

  return (
    <section className="grid gap-5">
      {/* Header + date range picker */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h2 className="text-xl font-light tracking-wide text-[var(--foreground)]">
            Analyse financière
          </h2>
          <p className="text-sm text-[var(--muted)]">
            Du {formatDateFr(from)} au {formatDateFr(to)}
          </p>
        </div>
        <DateRangePicker from={from} to={to} />
      </div>

      {/* KPI cards */}
      <article className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <KpiCard
          label={`CA encaissé (${reservationsCount} réservations)`}
          value={formatAmount(caEncaisse)}
          sub={`Dont ${formatAmount(soldes)} de soldes au 1er jour`}
        />
        <KpiCard
          label="Acomptes encaissés"
          value={formatAmount(acomptes)}
          sub="À la date de réservation"
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
              Reste à encaisser sur les locations à venir (les acomptes sont déjà dans le CA actuel)
            </p>
          </div>
          <div className="text-sm">
            <span className="text-[var(--muted)]">Reste à encaisser </span>
            <span className="font-medium text-[var(--foreground)]">{formatAmount(totalForecastPending)}</span>
          </div>
        </div>

        {forecastMonths.every((m) => m.balancePending === 0) ? (
          <p className="mt-4 text-sm text-[var(--muted)]">
            Aucun versement à venir pour les 6 prochains mois.
          </p>
        ) : (
          <BarChart
            bars={forecastMonths.map((m) => ({
              key: m.key,
              label: m.label,
              primary: m.balancePending,
              primaryLabel: "Reste à encaisser",
            }))}
            maxValue={maxForecast}
          />
        )}
      </article>
    </section>
  );
}
