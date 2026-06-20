import { createSupabaseServerClient } from "@/lib/supabase/server";
import { FinancesClient } from "@/app/dashboard/finances/ui";
import { isValidDate } from "@/lib/format";

function addDaysStr(dateStr: string, days: number) {
  const d = new Date(dateStr + "T00:00:00Z");
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

function monthKeyFromDate(d: Date) {
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
}

function monthLabelFromKey(key: string) {
  const [y, m] = key.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, 1)).toLocaleDateString("fr-FR", {
    month: "short",
    year: "2-digit",
  });
}

type PageProps = { searchParams: Promise<{ from?: string; to?: string }> };

export type Expense = {
  id: string;
  date: string;
  amount: number;
  category: string;
  dress_category: string | null;
  description: string | null;
  created_at: string;
};

export type CategoryAnalysis = {
  category: string;
  revenue: number;
  purchaseExpenses: number;
  profit: number;
};

export type ForecastMonth = {
  key: string;
  label: string;
  // Reste à payer (versements à venir) — l'acompte est déjà compté dans le CA actuel
  balancePending: number;
};

export type FinancesPageData = {
  from: string;
  to: string;
  today: string;
  // Cash-based KPIs over the selected range
  caEncaisse: number; // acomptes + soldes encaissés
  acomptes: number; // acomptes encaissés (à la date de réservation)
  soldes: number; // soldes encaissés (au 1er jour de location)
  totalExpenses: number;
  profit: number;
  reservationsCount: number;
  // Monthly evolution (cash-based) over the range
  monthlyBuckets: { key: string; label: string; ca: number; expenses: number }[];
  // Expenses list
  expenses: Expense[];
  // Category analysis
  categoryAnalysis: CategoryAnalysis[];
  // Forecast (6 months from current month)
  forecastMonths: ForecastMonth[];
  // For expense form
  dressCategories: string[];
};

export default async function FinancesPage({ searchParams }: PageProps) {
  const params = await searchParams;
  const supabase = await createSupabaseServerClient();

  const today = new Date().toISOString().slice(0, 10);

  // ── Resolve selected date range ──────────────────────────────────────────
  let to = isValidDate(params.to) ? params.to : today;
  let from = isValidDate(params.from) ? params.from : addDaysStr(today, -29);
  if (from > to) {
    [from, to] = [to, from];
  }
  // Exclusive upper bound for created_at (timestamptz) filtering
  const toExclusive = addDaysStr(to, 1);
  // Balances are only collected once start_date has been reached (<= today)
  const balanceTo = to < today ? to : today;

  // ── Forecast window: 6 months starting from the CURRENT month ────────────
  const [ty, tm] = today.split("-").map(Number);
  const forecastMonths: ForecastMonth[] = Array.from({ length: 6 }, (_, i) => {
    const total = tm - 1 + i;
    const y = ty + Math.floor(total / 12);
    const m = (total % 12) + 1;
    const key = `${y}-${String(m).padStart(2, "0")}`;
    return { key, label: monthLabelFromKey(key), balancePending: 0 };
  });
  const totalEnd = tm - 1 + 6;
  const fey = ty + Math.floor(totalEnd / 12);
  const fem = (totalEnd % 12) + 1;
  const forecastEnd = `${fey}-${String(fem).padStart(2, "0")}-01`;

  const [depositRowsRes, balanceRowsRes, expensesRes, futureRes, dressRowsRes, categoriesRes] =
    await Promise.all([
      // Acomptes encaissés: reservations created within the range
      supabase
        .from("reservations")
        .select("id, deposit_paid, created_at, status")
        .gte("created_at", from)
        .lt("created_at", toExclusive)
        .not("status", "in", '("cancelled","draft")'),

      // Soldes encaissés: reservations whose rental started within the range (and reached)
      supabase
        .from("reservations")
        .select("id, total_price, deposit_paid, balance_due, start_date, status")
        .gte("start_date", from)
        .lte("start_date", balanceTo)
        .not("status", "in", '("cancelled","draft")'),

      // Expenses in range
      supabase
        .from("expenses")
        .select("id, date, amount, category, dress_category, description, created_at")
        .gte("date", from)
        .lte("date", to)
        .order("date", { ascending: false }),

      // Future reservations for forecast (reste à payer, de demain → +6 mois)
      supabase
        .from("reservations")
        .select("id, start_date, status, balance_due")
        .gt("start_date", today)
        .lt("start_date", forecastEnd)
        .not("status", "in", '("cancelled","draft")')
        .order("start_date", { ascending: true }),

      // Reservation dresses with rentals started in range (for category revenue)
      supabase
        .from("reservation_dresses")
        .select("dress_id, price, start_date, status, dresses(category)")
        .gte("start_date", from)
        .lte("start_date", balanceTo)
        .not("status", "in", '("cancelled","draft")'),

      // Distinct dress categories for the expense form
      supabase.from("dresses").select("category"),
    ]);

  const depositRows = depositRowsRes.data ?? [];
  const balanceRows = balanceRowsRes.data ?? [];

  // ── Cash-based KPIs ──────────────────────────────────────────────────────
  const acomptes = depositRows.reduce((s, r) => s + Number(r.deposit_paid ?? 0), 0);
  const soldes = balanceRows.reduce((s, r) => s + Number(r.balance_due ?? 0), 0);
  const caEncaisse = acomptes + soldes;

  const expenses = (expensesRes.data ?? []) as Expense[];
  const totalExpenses = expenses.reduce((s, e) => s + Number(e.amount ?? 0), 0);
  const profit = caEncaisse - totalExpenses;

  const contributingIds = new Set<string>();
  for (const r of depositRows) if (Number(r.deposit_paid ?? 0) > 0) contributingIds.add(r.id);
  for (const r of balanceRows) if (Number(r.balance_due ?? 0) > 0) contributingIds.add(r.id);
  const reservationsCount = contributingIds.size;

  // ── Monthly evolution (cash-based) over the range ────────────────────────
  const monthlyBuckets: { key: string; label: string; ca: number; expenses: number }[] = [];
  {
    const cur = new Date(from + "T00:00:00Z");
    cur.setUTCDate(1);
    const endM = new Date(to + "T00:00:00Z");
    endM.setUTCDate(1);
    while (cur <= endM && monthlyBuckets.length < 24) {
      const key = monthKeyFromDate(cur);
      monthlyBuckets.push({ key, label: monthLabelFromKey(key), ca: 0, expenses: 0 });
      cur.setUTCMonth(cur.getUTCMonth() + 1);
    }
  }
  const monthIndexMap = new Map(monthlyBuckets.map((b, i) => [b.key, i]));
  for (const r of depositRows) {
    const idx = monthIndexMap.get(String(r.created_at).slice(0, 7));
    if (idx !== undefined) monthlyBuckets[idx].ca += Number(r.deposit_paid ?? 0);
  }
  for (const r of balanceRows) {
    const idx = monthIndexMap.get(r.start_date.slice(0, 7));
    if (idx !== undefined) monthlyBuckets[idx].ca += Number(r.balance_due ?? 0);
  }
  for (const e of expenses) {
    const idx = monthIndexMap.get(e.date.slice(0, 7));
    if (idx !== undefined) monthlyBuckets[idx].expenses += Number(e.amount ?? 0);
  }

  // ── Category analysis ────────────────────────────────────────────────────
  const firstRelation = <T,>(v: T | T[] | null | undefined): T | null => {
    if (!v) return null;
    return Array.isArray(v) ? (v[0] ?? null) : v;
  };

  const categoryRevenue = new Map<string, number>();
  for (const rd of dressRowsRes.data ?? []) {
    const dress = firstRelation(rd.dresses as { category?: string } | { category?: string }[] | null);
    const cat = dress?.category ?? "Non classé";
    categoryRevenue.set(cat, (categoryRevenue.get(cat) ?? 0) + Number(rd.price ?? 0));
  }

  const categoryPurchases = new Map<string, number>();
  for (const e of expenses) {
    if (e.category === "achat_robes" && e.dress_category) {
      categoryPurchases.set(
        e.dress_category,
        (categoryPurchases.get(e.dress_category) ?? 0) + Number(e.amount ?? 0)
      );
    }
  }

  const allCategories = new Set([...categoryRevenue.keys(), ...categoryPurchases.keys()]);
  const categoryAnalysis: CategoryAnalysis[] = Array.from(allCategories)
    .map((cat) => {
      const revenue = categoryRevenue.get(cat) ?? 0;
      const purchaseExpenses = categoryPurchases.get(cat) ?? 0;
      return { category: cat, revenue, purchaseExpenses, profit: revenue - purchaseExpenses };
    })
    .sort((a, b) => b.revenue - a.revenue);

  // ── Forecast bucketing ───────────────────────────────────────────────────
  const forecastIndexMap = new Map(forecastMonths.map((m, i) => [m.key, i]));
  for (const r of futureRes.data ?? []) {
    const idx = forecastIndexMap.get(r.start_date.slice(0, 7));
    if (idx !== undefined) {
      forecastMonths[idx].balancePending += Number(r.balance_due ?? 0);
    }
  }

  // ── Dress categories for expense form ────────────────────────────────────
  const dressCategories = Array.from(
    new Set((categoriesRes.data ?? []).map((d) => d.category).filter(Boolean))
  ).sort((a, b) => (a ?? "").localeCompare(b ?? "", "fr")) as string[];

  const data: FinancesPageData = {
    from,
    to,
    today,
    caEncaisse,
    acomptes,
    soldes,
    totalExpenses,
    profit,
    reservationsCount,
    monthlyBuckets,
    expenses,
    categoryAnalysis,
    forecastMonths,
    dressCategories,
  };

  return <FinancesClient data={data} />;
}
