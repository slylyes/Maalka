import Link from "next/link";
import { CalendarDaysIcon } from "@heroicons/react/24/outline";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { formatAmount, formatDateFr } from "@/lib/format";

type DressListItem = {
  dresses?: { reference?: string; name?: string } | { reference?: string; name?: string }[] | null;
};

function firstRelation<T>(value: T[] | T | null | undefined): T | null {
  if (!value) return null;
  return Array.isArray(value) ? (value[0] ?? null) : value;
}

function dressReferences(items: DressListItem[] | null | undefined): string[] {
  if (!items || items.length === 0) return [];
  return items.map((item) => {
    const dress = firstRelation(
      item.dresses as { reference?: string; name?: string } | { reference?: string; name?: string }[] | null
    );
    return dress?.reference ?? "Robe";
  });
}

const STATUS_META: Record<string, { label: string; className: string }> = {
  reserved: { label: "Réservé", className: "border-amber-200 bg-amber-50 text-amber-700" },
  preparing: { label: "En préparation", className: "border-sky-200 bg-sky-50 text-sky-700" },
  rented: { label: "En location", className: "border-emerald-200 bg-emerald-50 text-emerald-700" },
  completed: { label: "Terminé", className: "border-stone-200 bg-stone-100 text-stone-600" },
  cancelled: { label: "Annulé", className: "border-rose-200 bg-rose-50 text-rose-700" },
  draft: { label: "Brouillon", className: "border-stone-200 bg-stone-100 text-stone-600" },
};

function StatusBadge({ status }: { status: string }) {
  const meta =
    STATUS_META[status] ?? { label: status, className: "border-stone-200 bg-stone-100 text-stone-600" };
  return (
    <span className={`shrink-0 rounded-full border px-2 py-0.5 text-[11px] font-medium ${meta.className}`}>
      {meta.label}
    </span>
  );
}

function DressChips({ items }: { items: DressListItem[] | null | undefined }) {
  const refs = dressReferences(items);
  if (refs.length === 0) return null;
  return (
    <div className="mt-2 flex flex-wrap gap-1.5">
      {refs.map((ref, index) => (
        <span
          key={`${ref}-${index}`}
          className="rounded-md bg-[var(--surface-soft)] px-2 py-0.5 text-xs font-medium text-[var(--foreground)]"
        >
          {ref}
        </span>
      ))}
    </div>
  );
}

function ReservationCard({
  contractNumber,
  clientName,
  status,
  items,
  dateRange,
}: {
  contractNumber: string;
  clientName: string;
  status: string;
  items: DressListItem[] | null | undefined;
  dateRange?: { start: string; end: string };
}) {
  return (
    <li className="rounded-xl border border-[var(--border-soft)] bg-white p-3.5 transition-colors hover:border-[var(--accent)]">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="truncate font-medium text-[var(--foreground)]">{clientName || "Client inconnu"}</p>
          <p className="mt-0.5 font-mono text-[11px] text-[var(--muted)]">{contractNumber}</p>
        </div>
        <StatusBadge status={status} />
      </div>
      {dateRange ? (
        <p className="mt-2 flex items-center gap-1.5 text-xs text-[var(--muted)]">
          <CalendarDaysIcon className="h-3.5 w-3.5 shrink-0" />
          {formatDateFr(dateRange.start)} → {formatDateFr(dateRange.end)}
        </p>
      ) : null}
      <DressChips items={items} />
    </li>
  );
}

function SectionCount({ count }: { count: number }) {
  if (count <= 0) return null;
  return (
    <span className="rounded-full bg-[var(--surface-soft)] px-2.5 py-0.5 text-xs font-medium text-[var(--muted)]">
      {count}
    </span>
  );
}

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

  const clientName = (client: { first_name?: string; last_name?: string } | null) =>
    `${client?.first_name ?? ""} ${client?.last_name ?? ""}`.trim();

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
          <div className="flex items-center justify-between gap-2">
            <h2 className="text-xl font-light tracking-wide text-[var(--foreground)]">
              Sorties prévues aujourd&apos;hui
            </h2>
            <SectionCount count={pickups?.length ?? 0} />
          </div>
          <ul className="mt-4 space-y-3">
            {pickups?.length ? (
              pickups.map((item) => (
                <ReservationCard
                  key={item.id}
                  contractNumber={item.contract_number}
                  clientName={clientName(firstRelation(item.clients))}
                  status={item.status}
                  items={item.reservation_dresses as DressListItem[] | null}
                />
              ))
            ) : (
              <li className="text-sm text-[var(--muted)]">Aucune sortie prévue aujourd&apos;hui.</li>
            )}
          </ul>
        </article>

        <article className="premium-card p-6">
          <div className="flex items-center justify-between gap-2">
            <h2 className="text-xl font-light tracking-wide text-[var(--foreground)]">
              Retours attendus aujourd&apos;hui
            </h2>
            <SectionCount count={returns?.length ?? 0} />
          </div>
          <ul className="mt-4 space-y-3">
            {returns?.length ? (
              returns.map((item) => (
                <ReservationCard
                  key={item.id}
                  contractNumber={item.contract_number}
                  clientName={clientName(firstRelation(item.clients))}
                  status={item.status}
                  items={item.reservation_dresses as DressListItem[] | null}
                />
              ))
            ) : (
              <li className="text-sm text-[var(--muted)]">Aucun retour attendu aujourd&apos;hui.</li>
            )}
          </ul>
        </article>
      </section>

      {/* Upcoming reservations */}
      <article className="premium-card p-6">
        <div className="flex items-center justify-between gap-2">
          <h2 className="text-xl font-light tracking-wide text-[var(--foreground)]">Prochaines réservations</h2>
          <SectionCount count={upcomingReservations?.length ?? 0} />
        </div>
        <ul className="mt-4 grid gap-3 sm:grid-cols-2">
          {upcomingReservations?.length ? (
            upcomingReservations.map((item) => (
              <ReservationCard
                key={item.id}
                contractNumber={item.contract_number}
                clientName={clientName(firstRelation(item.clients))}
                status={item.status}
                items={item.reservation_dresses as DressListItem[] | null}
                dateRange={{ start: item.start_date, end: item.end_date }}
              />
            ))
          ) : (
            <li className="text-sm text-[var(--muted)]">Aucune réservation à venir.</li>
          )}
        </ul>
      </article>
    </section>
  );
}
