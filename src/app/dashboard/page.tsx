import Link from "next/link";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { formatAmount, formatDateFr } from "@/lib/format";

export default async function DashboardPage() {
  const supabase = await createSupabaseServerClient();

  const today = new Date().toISOString().slice(0, 10);
  const monthStart = today.slice(0, 7) + "-01";
  // Exclusive upper bound (next day) for created_at timestamptz filtering
  const tomorrow = (() => {
    const d = new Date(today + "T00:00:00Z");
    d.setUTCDate(d.getUTCDate() + 1);
    return d.toISOString().slice(0, 10);
  })();

  // Sync dress availability
  const { data: activeDressRows } = await supabase
    .from("reservation_dresses")
    .select("dress_id")
    .in("status", ["reserved", "rented", "preparing"])
    .lte("start_date", today)
    .gte("end_date", today);

  const activeDressIds = Array.from(new Set((activeDressRows ?? []).map((item) => item.dress_id)));

  await supabase.from("dresses").update({ status: "available" }).in("status", ["available", "reserved"]);

  if (activeDressIds.length > 0) {
    await supabase
      .from("dresses")
      .update({ status: "reserved" })
      .in("id", activeDressIds)
      .in("status", ["available", "reserved"]);
  }

  const [
    { data: pickups },
    { data: returns },
    { count: totalDresses },
    { count: availableDresses },
    { count: activeReservations },
    { data: upcomingReservations },
    { data: monthDeposits },
    { data: monthBalances },
    { data: monthExpenses },
  ] = await Promise.all([
    supabase
      .from("reservations")
      .select(
        "id, contract_number, start_date, status, total_price, balance_due, reservation_dresses(dress_id, dresses(reference,name)), clients(first_name,last_name,phone)"
      )
      .eq("start_date", today)
      .in("status", ["reserved", "preparing", "rented"])
      .order("start_date", { ascending: true }),

    supabase
      .from("reservations")
      .select(
        "id, contract_number, end_date, status, reservation_dresses(dress_id, dresses(reference,name)), clients(first_name,last_name,phone)"
      )
      .eq("end_date", today)
      .in("status", ["reserved", "preparing", "rented"])
      .order("end_date", { ascending: true }),

    supabase.from("dresses").select("id", { count: "exact", head: true }),

    supabase.from("dresses").select("id", { count: "exact", head: true }).eq("status", "available"),

    supabase
      .from("reservations")
      .select("id", { count: "exact", head: true })
      .in("status", ["reserved", "preparing", "rented"])
      .lte("start_date", today)
      .gte("end_date", today),

    supabase
      .from("reservations")
      .select(
        "id, contract_number, start_date, end_date, status, reservation_dresses(dress_id, dresses(reference,name)), clients(first_name,last_name)"
      )
      .gte("start_date", today)
      .in("status", ["reserved", "preparing", "rented"])
      .order("start_date", { ascending: true })
      .limit(5),

    // Acomptes encaissés ce mois (à la date de réservation)
    supabase
      .from("reservations")
      .select("deposit_paid, created_at, status")
      .gte("created_at", monthStart)
      .lt("created_at", tomorrow)
      .not("status", "in", '("cancelled","draft")'),

    // Soldes encaissés ce mois (au 1er jour de location atteint)
    supabase
      .from("reservations")
      .select("balance_due, start_date, status")
      .gte("start_date", monthStart)
      .lte("start_date", today)
      .not("status", "in", '("cancelled","draft")'),

    // Current month expenses for the finance summary card
    supabase
      .from("expenses")
      .select("amount")
      .gte("date", monthStart)
      .lte("date", today),
  ]);

  const firstRelation = <T,>(value: T[] | T | null | undefined): T | null => {
    if (!value) return null;
    if (Array.isArray(value)) return value[0] ?? null;
    return value;
  };

  const formatDressList = (
    items:
      | Array<{ dresses?: { reference?: string; name?: string } | { reference?: string; name?: string }[] | null }>
      | null
      | undefined
  ) => {
    if (!items || items.length === 0) return "-";
    const labels = items.map((item) => {
      const dress = firstRelation(item.dresses as { reference?: string; name?: string } | { reference?: string; name?: string }[] | null);
      if (!dress) return "Robe";
      return dress.name ? `${dress.reference ?? "Robe"} - ${dress.name}` : (dress.reference ?? "Robe");
    });
    if (labels.length <= 2) return labels.join(", ");
    return `${labels[0]}, ${labels[1]} +${labels.length - 2}`;
  };

  // Monthly finance summary (cash-based: acomptes à la réservation + soldes au 1er jour)
  const monthAcomptes = (monthDeposits ?? []).reduce((s, r) => s + Number(r.deposit_paid ?? 0), 0);
  const monthSoldes = (monthBalances ?? []).reduce((s, r) => s + Number(r.balance_due ?? 0), 0);
  const monthCA = monthAcomptes + monthSoldes;
  const monthExpensesTotal = (monthExpenses ?? []).reduce((s, e) => s + Number(e.amount ?? 0), 0);
  const monthProfit = monthCA - monthExpensesTotal;

  // Today's expected totals
  const expectedTurnoverToday =
    pickups?.reduce((sum, r) => sum + Number((r as { total_price?: number }).total_price ?? 0), 0) ?? 0;
  const expectedOutstandingToday =
    pickups?.reduce((sum, r) => sum + Number((r as { balance_due?: number }).balance_due ?? 0), 0) ?? 0;

  return (
    <section className="grid gap-5">
      {/* KPI strip */}
      <article className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <div className="premium-card p-5">
          <p className="text-xs uppercase tracking-wide text-[var(--muted)]">Robes en stock</p>
          <p className="mt-2 text-3xl font-light text-[var(--foreground)]">{totalDresses ?? 0}</p>
        </div>
        <div className="premium-card p-5">
          <p className="text-xs uppercase tracking-wide text-[var(--muted)]">Robes disponibles</p>
          <p className="mt-2 text-3xl font-light text-[var(--foreground)]">{availableDresses ?? 0}</p>
        </div>
        <div className="premium-card p-5">
          <p className="text-xs uppercase tracking-wide text-[var(--muted)]">Réservations actives</p>
          <p className="mt-2 text-3xl font-light text-[var(--foreground)]">{activeReservations ?? 0}</p>
        </div>
        <div className="premium-card p-5">
          <p className="text-xs uppercase tracking-wide text-[var(--muted)]">CA prévu aujourd&apos;hui</p>
          <p className="mt-2 text-3xl font-light text-[var(--foreground)]">{formatAmount(expectedTurnoverToday)}</p>
          <p className="mt-1 text-xs text-[var(--muted)]">Reste attendu: {formatAmount(expectedOutstandingToday)}</p>
        </div>
      </article>

      {/* Monthly finance summary card */}
      <article className="premium-card p-6">
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <h2 className="text-xl font-light tracking-wide text-[var(--foreground)]">
            Résumé financier — {new Date().toLocaleDateString("fr-FR", { month: "long", year: "numeric" })}
          </h2>
          <Link
            href="/dashboard/finances"
            className="rounded-lg border border-[var(--border-soft)] bg-white px-3 py-1.5 text-xs text-[var(--muted)] hover:bg-[var(--surface-soft)] transition-colors"
          >
            Voir l&apos;analyse complète →
          </Link>
        </div>
        <div className="mt-4 grid gap-3 sm:grid-cols-3">
          <div className="rounded-2xl border border-[var(--border-soft)] bg-white p-4">
            <p className="text-xs uppercase tracking-wide text-[var(--muted)]">CA du mois</p>
            <p className="mt-2 text-2xl font-light text-[var(--foreground)]">{formatAmount(monthCA)}</p>
          </div>
          <div className="rounded-2xl border border-[var(--border-soft)] bg-white p-4">
            <p className="text-xs uppercase tracking-wide text-[var(--muted)]">Dépenses du mois</p>
            <p className="mt-2 text-2xl font-light text-rose-700">{formatAmount(monthExpensesTotal)}</p>
          </div>
          <div className="rounded-2xl border border-[var(--border-soft)] bg-white p-4">
            <p className="text-xs uppercase tracking-wide text-[var(--muted)]">Bénéfice du mois</p>
            <p className={`mt-2 text-2xl font-light ${monthProfit >= 0 ? "text-emerald-700" : "text-rose-700"}`}>
              {formatAmount(monthProfit)}
            </p>
          </div>
        </div>
      </article>

      {/* Today operations */}
      <section className="grid gap-5 lg:grid-cols-2">
        <article className="premium-card p-6">
          <h2 className="text-xl font-light tracking-wide text-[var(--foreground)]">
            Sorties prévues aujourd&apos;hui
          </h2>
          <ul className="mt-4 space-y-3 text-sm text-[var(--muted)]">
            {pickups?.length ? (
              pickups.map((item) => {
                const client = firstRelation(item.clients);
                return (
                  <li key={item.id} className="rounded-xl border border-[var(--border-soft)] bg-white p-3">
                    <p className="font-medium text-[var(--foreground)]">{item.contract_number}</p>
                    <p className="mt-1">Robes: {formatDressList(item.reservation_dresses)}</p>
                    <p>Client: {client?.first_name} {client?.last_name}</p>
                  </li>
                );
              })
            ) : (
              <li>Aucune sortie prévue aujourd&apos;hui.</li>
            )}
          </ul>
        </article>

        <article className="premium-card p-6">
          <h2 className="text-xl font-light tracking-wide text-[var(--foreground)]">
            Retours attendus aujourd&apos;hui
          </h2>
          <ul className="mt-4 space-y-3 text-sm text-[var(--muted)]">
            {returns?.length ? (
              returns.map((item) => {
                const client = firstRelation(item.clients);
                return (
                  <li key={item.id} className="rounded-xl border border-[var(--border-soft)] bg-white p-3">
                    <p className="font-medium text-[var(--foreground)]">{item.contract_number}</p>
                    <p className="mt-1">Robes: {formatDressList(item.reservation_dresses)}</p>
                    <p>Client: {client?.first_name} {client?.last_name}</p>
                  </li>
                );
              })
            ) : (
              <li>Aucun retour attendu aujourd&apos;hui.</li>
            )}
          </ul>
        </article>
      </section>

      {/* Upcoming reservations */}
      <article className="premium-card p-6">
        <h2 className="text-xl font-light tracking-wide text-[var(--foreground)]">Prochaines réservations</h2>
        <ul className="mt-4 space-y-3 text-sm text-[var(--muted)]">
          {upcomingReservations?.length ? (
            upcomingReservations.map((item) => {
              const client = firstRelation(item.clients);
              return (
                <li key={item.id} className="rounded-xl border border-[var(--border-soft)] bg-white p-3">
                  <p className="font-medium text-[var(--foreground)]">{item.contract_number}</p>
                  <p className="mt-1">
                    {formatDateFr(item.start_date)} → {formatDateFr(item.end_date)} ({item.status})
                  </p>
                  <p>Robes: {formatDressList(item.reservation_dresses)}</p>
                  <p>Client: {client?.first_name} {client?.last_name}</p>
                </li>
              );
            })
          ) : (
            <li>Aucune réservation à venir.</li>
          )}
        </ul>
      </article>
    </section>
  );
}
