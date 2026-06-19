import { createSupabaseServerClient } from "@/lib/supabase/server";
import { FinancesClient } from "@/app/dashboard/finances/ui";

function parsePeriodDays(value: string | undefined) {
  const allowed = new Set([30, 90, 180]);
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || !allowed.has(parsed)) return 30;
  return parsed;
}

function monthKey(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
}

function monthLabel(date: Date) {
  return date.toLocaleDateString("fr-FR", { month: "short", year: "2-digit" });
}

type PageProps = { searchParams: Promise<{ period?: string }> };

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
  caTotal: number;
  depositCollected: number;
  balancePending: number;
};

export type FinancesPageData = {
  period: number;
  today: string;
  periodStart: string;
  // Historical KPIs
  caTotal: number;
  encaissements: number;
  totalExpenses: number;
  profit: number;
  reservationsCount: number;
  // Monthly evolution (historical)
  monthlyBuckets: { key: string; label: string; ca: number; expenses: number }[];
  // Expenses list
  expenses: Expense[];
  // Category analysis
  categoryAnalysis: CategoryAnalysis[];
  // Forecast
  forecastMonths: ForecastMonth[];
  // For expense form
  dressCategories: string[];
};

export default async function FinancesPage({ searchParams }: PageProps) {
  const params = await searchParams;
  const supabase = await createSupabaseServerClient();
  const period = parsePeriodDays(params.period);

  const today = new Date().toISOString().slice(0, 10);
  const periodStartDate = new Date();
  periodStartDate.setDate(periodStartDate.getDate() - (period - 1));
  const periodStart = periodStartDate.toISOString().slice(0, 10);

  const sixMonthsAhead = new Date();
  sixMonthsAhead.setMonth(sixMonthsAhead.getMonth() + 6);
  const forecastEnd = sixMonthsAhead.toISOString().slice(0, 10);

  const [reservationsRes, expensesRes, futureRes, dressRowsRes, categoriesRes] = await Promise.all([
    // Historical reservations (for CA/profit)
    supabase
      .from("reservations")
      .select("id, start_date, status, total_price, deposit_paid, balance_due")
      .gte("start_date", periodStart)
      .lte("start_date", today)
      .order("start_date", { ascending: true }),

    // Expenses in period
    supabase
      .from("expenses")
      .select("id, date, amount, category, dress_category, description, created_at")
      .gte("date", periodStart)
      .lte("date", today)
      .order("date", { ascending: false }),

    // Future reservations for forecast (next 6 months)
    supabase
      .from("reservations")
      .select("id, start_date, status, total_price, deposit_paid, balance_due")
      .gt("start_date", today)
      .lte("start_date", forecastEnd)
      .not("status", "in", '("cancelled","draft")')
      .order("start_date", { ascending: true }),

    // Reservation dresses in period (for category revenue)
    supabase
      .from("reservation_dresses")
      .select("dress_id, price, start_date, status, dresses(category)")
      .gte("start_date", periodStart)
      .lte("start_date", today)
      .not("status", "in", '("cancelled","draft")'),

    // Distinct dress categories for the expense form
    supabase.from("dresses").select("category"),
  ]);

  // ── Historical KPIs ──────────────────────────────────────────────────────
  const analyticRows = (reservationsRes.data ?? []).filter(
    (r) => r.status !== "cancelled" && r.status !== "draft"
  );

  const caTotal = analyticRows.reduce((s, r) => s + Number(r.total_price ?? 0), 0);

  // Encaissements: full amount for rentals that have started, deposit only for future ones
  // (In a historical period start_date <= today for all rows, so encaissements = caTotal)
  const encaissements = analyticRows.reduce((s, r) => {
    if (r.start_date <= today) return s + Number(r.total_price ?? 0);
    return s + Number(r.deposit_paid ?? 0);
  }, 0);

  const expenses = (expensesRes.data ?? []) as Expense[];
  const totalExpenses = expenses.reduce((s, e) => s + Number(e.amount ?? 0), 0);
  const profit = encaissements - totalExpenses;
  const reservationsCount = analyticRows.length;

  // ── Monthly evolution (historical) ───────────────────────────────────────
  const monthCount = Math.min(12, Math.max(3, Math.ceil(period / 30) + 1));
  const monthlyBuckets = Array.from({ length: monthCount }, (_, i) => {
    const d = new Date();
    d.setDate(1);
    d.setMonth(d.getMonth() - (monthCount - 1 - i));
    return { key: monthKey(d), label: monthLabel(d), ca: 0, expenses: 0 };
  });
  const monthIndexMap = new Map(monthlyBuckets.map((b, i) => [b.key, i]));

  for (const r of analyticRows) {
    const idx = monthIndexMap.get(r.start_date.slice(0, 7));
    if (idx !== undefined) monthlyBuckets[idx].ca += Number(r.total_price ?? 0);
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

  // Merge all categories that appear in either revenue or purchases
  const allCategories = new Set([...categoryRevenue.keys(), ...categoryPurchases.keys()]);
  const categoryAnalysis: CategoryAnalysis[] = Array.from(allCategories)
    .map((cat) => {
      const revenue = categoryRevenue.get(cat) ?? 0;
      const purchaseExpenses = categoryPurchases.get(cat) ?? 0;
      return { category: cat, revenue, purchaseExpenses, profit: revenue - purchaseExpenses };
    })
    .sort((a, b) => b.revenue - a.revenue);

  // ── Forecast (next 6 months) ─────────────────────────────────────────────
  const forecastMonths: ForecastMonth[] = Array.from({ length: 6 }, (_, i) => {
    const d = new Date();
    d.setDate(1);
    d.setMonth(d.getMonth() + 1 + i);
    return { key: monthKey(d), label: monthLabel(d), caTotal: 0, depositCollected: 0, balancePending: 0 };
  });
  const forecastIndexMap = new Map(forecastMonths.map((m, i) => [m.key, i]));

  for (const r of futureRes.data ?? []) {
    const idx = forecastIndexMap.get(r.start_date.slice(0, 7));
    if (idx !== undefined) {
      forecastMonths[idx].caTotal += Number(r.total_price ?? 0);
      forecastMonths[idx].depositCollected += Number(r.deposit_paid ?? 0);
      forecastMonths[idx].balancePending += Number(r.balance_due ?? 0);
    }
  }

  // ── Dress categories for expense form ────────────────────────────────────
  const dressCategories = Array.from(
    new Set((categoriesRes.data ?? []).map((d) => d.category).filter(Boolean))
  ).sort((a, b) => (a ?? "").localeCompare(b ?? "", "fr")) as string[];

  const data: FinancesPageData = {
    period,
    today,
    periodStart,
    caTotal,
    encaissements,
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
