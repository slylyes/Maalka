"use client";

import React, { useCallback, useState, useMemo, useRef, useEffect } from "react";

import { formatAmount, formatDateFr } from "@/lib/format";
import { useEscapeKey } from "@/lib/use-escape-key";

type DressOption = {
  id: string;
  reference: string;
  name: string | null;
  status: string;
  price: number;
};
type ClientOption = { id: string; first_name: string; last_name: string; phone: string };

type Reservation = {
  id: string;
  contract_number: string;
  client_id: string;
  start_date: string;
  end_date: string;
  status: string;
  total_price: number;
  supplement?: number | null;
  deposit_paid: number;
  balance_due: number;
  caution_amount: number;
  caution_status: string;
  notes?: string | null;
  reservation_dresses?: Array<{
    dress_id: string;
    price: number;
    base_price?: number | null;
    discount_amount?: number | null;
    dresses?: { reference?: string; name?: string } | null;
  }> | null;
  clients?: { first_name?: string; last_name?: string; phone?: string } | null;
};

type ReservationsClientProps = {
  initialReservations: Reservation[];
  initialDresses: DressOption[];
  initialClients: ClientOption[];
};

// ── Dropdown with search (closes on outside click) ───────────────────────────
function SearchDropdown({
  options,
  value,
  onChange,
  placeholder,
  renderOption,
  renderSelected,
  required,
}: {
  options: { id: string; label: string }[];
  value: string;
  onChange: (id: string) => void;
  placeholder: string;
  renderOption?: (opt: { id: string; label: string }) => React.ReactNode;
  renderSelected?: (opt: { id: string; label: string }) => React.ReactNode;
  required?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const containerRef = useRef<HTMLDivElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);

  const filtered = useMemo(() => {
    const q = query.toLowerCase();
    return options.filter((o) => o.label.toLowerCase().includes(q));
  }, [options, query]);

  const selected = options.find((o) => o.id === value);

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
        setQuery("");
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  useEffect(() => {
    if (open) {
      setTimeout(() => searchRef.current?.focus(), 0);
    }
  }, [open]);

  function select(id: string) {
    onChange(id);
    setOpen(false);
    setQuery("");
  }

  return (
    <div ref={containerRef} className="relative">
      {/* Trigger button */}
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="premium-input w-full text-left flex items-center justify-between"
      >
        <span className={selected ? "text-[var(--foreground)]" : "text-[var(--muted)]"}>
          {selected ? (renderSelected ? renderSelected(selected) : selected.label) : placeholder}
        </span>
        <span className="ml-2 text-[var(--muted)]">{open ? "▲" : "▼"}</span>
      </button>

      {/* Hidden native input for required validation */}
      {required && (
        <input
          tabIndex={-1}
          required
          value={value}
          onChange={() => {}}
          className="absolute inset-0 opacity-0 pointer-events-none"
          aria-hidden
        />
      )}

      {/* Dropdown panel */}
      {open && (
        <div className="absolute z-30 mt-1 w-full rounded-xl border border-[var(--border-soft)] bg-white shadow-lg">
          <div className="p-2 border-b border-[var(--border-soft)]">
            <input
              ref={searchRef}
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Rechercher…"
              className="w-full rounded-lg border border-[var(--border-soft)] px-3 py-1.5 text-sm outline-none"
            />
          </div>
          <ul className="max-h-48 overflow-y-auto py-1">
            {filtered.length === 0 ? (
              <li className="px-3 py-2 text-sm text-[var(--muted)]">Aucun résultat</li>
            ) : (
              filtered.map((opt) => (
                <li key={opt.id}>
                  <button
                    type="button"
                    onMouseDown={() => select(opt.id)}
                    className={`w-full px-3 py-2 text-left text-sm hover:bg-[var(--surface-soft)] ${
                      opt.id === value ? "font-medium text-[var(--foreground)]" : "text-[var(--muted)]"
                    }`}
                  >
                    {renderOption ? renderOption(opt) : opt.label}
                  </button>
                </li>
              ))
            )}
          </ul>
        </div>
      )}
    </div>
  );
}

// ── Edit modal ────────────────────────────────────────────────────────────────
function EditReservationModal({
  reservation,
  allDresses,
  clients,
  onClose,
  onSaved,
}: {
  reservation: Reservation;
  allDresses: DressOption[];
  clients: ClientOption[];
  onClose: () => void;
  onSaved: () => void;
}) {
  const initialDressIds = useMemo(
    () => (reservation.reservation_dresses ?? []).map((rd) => rd.dress_id),
    [reservation]
  );

  const [clientId, setClientId] = useState(reservation.client_id);
  const [startDate, setStartDate] = useState(reservation.start_date);
  const [endDate, setEndDate] = useState(reservation.end_date);
  const [status, setStatus] = useState(reservation.status);
  const [dressIds, setDressIds] = useState<string[]>(initialDressIds);
  const [pickerDressId, setPickerDressId] = useState("");
  const [discountAmount, setDiscountAmount] = useState(() => {
    const total = (reservation.reservation_dresses ?? []).reduce(
      (s, rd) => s + Number(rd.discount_amount ?? 0),
      0
    );
    return total > 0 ? String(total) : "";
  });
  const [supplement, setSupplement] = useState(() =>
    Number(reservation.supplement ?? 0) > 0 ? String(reservation.supplement) : ""
  );
  const [depositPaid, setDepositPaid] = useState(String(reservation.deposit_paid));
  const [cautionAmount, setCautionAmount] = useState(String(reservation.caution_amount));
  const [cautionStatus, setCautionStatus] = useState(reservation.caution_status);
  const [notes, setNotes] = useState(reservation.notes ?? "");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEscapeKey(onClose);

  const selectedDresses = useMemo(
    () => allDresses.filter((d) => dressIds.includes(d.id)),
    [allDresses, dressIds]
  );
  const availableForPicker = useMemo(
    () => allDresses.filter((d) => !dressIds.includes(d.id)),
    [allDresses, dressIds]
  );

  const baseTotal = selectedDresses.reduce((s, d) => s + Number(d.price ?? 0), 0);
  const parsedDiscount = discountAmount.trim().length > 0 ? Number(discountAmount) : 0;
  const safeDiscount = Number.isFinite(parsedDiscount) ? Math.max(parsedDiscount, 0) : 0;
  const parsedSupplement = supplement.trim().length > 0 ? Number(supplement) : 0;
  const safeSupplement = Number.isFinite(parsedSupplement) ? Math.max(parsedSupplement, 0) : 0;
  const computedTotal = Math.max(baseTotal - safeDiscount, 0) + safeSupplement;

  const clientOptions = useMemo(
    () =>
      [...clients]
        .sort((a, b) =>
          `${a.last_name} ${a.first_name}`.localeCompare(`${b.last_name} ${b.first_name}`, "fr")
        )
        .map((c) => ({ id: c.id, label: `${c.last_name} ${c.first_name} — ${c.phone}` })),
    [clients]
  );

  const dressOptions = useMemo(
    () =>
      availableForPicker.map((d) => ({
        id: d.id,
        label: `${d.reference}${d.name ? ` - ${d.name}` : ""}`,
      })),
    [availableForPicker]
  );

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);

    if (dressIds.length === 0) {
      setError("La réservation doit contenir au moins une robe.");
      setSubmitting(false);
      return;
    }
    if (startDate > endDate) {
      setError("La date de fin doit être supérieure ou égale à la date de début.");
      setSubmitting(false);
      return;
    }
    if (safeDiscount > baseTotal) {
      setError("La remise ne peut pas dépasser le prix total.");
      setSubmitting(false);
      return;
    }
    const parsedDeposit = Number(depositPaid);
    if (parsedDeposit > computedTotal) {
      setError("L'acompte ne peut pas dépasser le prix total.");
      setSubmitting(false);
      return;
    }

    const response = await fetch(`/api/reservations/${reservation.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        client_id: clientId,
        start_date: startDate,
        end_date: endDate,
        status,
        dress_ids: dressIds,
        discount_amount: safeDiscount,
        supplement: safeSupplement,
        total_price: computedTotal,
        deposit_paid: parsedDeposit,
        caution_amount: Number(cautionAmount) || 0,
        caution_status: cautionStatus,
        notes,
      }),
    });

    const json = await response.json().catch(() => ({}));
    if (!response.ok) {
      setError(json.error ?? "Erreur lors de la modification.");
      setSubmitting(false);
      return;
    }

    setSubmitting(false);
    onSaved();
    onClose();
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="premium-card w-full max-w-lg overflow-y-auto max-h-[90vh] p-6">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-light tracking-wide text-[var(--foreground)]">
            Modifier — {reservation.contract_number}
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="btn-secondary rounded-lg border border-[var(--border-soft)] px-3 py-1 text-sm text-[var(--muted)]"
          >
            Fermer
          </button>
        </div>

        <form className="space-y-3" onSubmit={handleSubmit}>
          {/* Robes */}
          <div>
            <label className="mb-1 block text-xs uppercase tracking-wide text-[var(--muted)]">Robes</label>
            <div className="space-y-2">
              <SearchDropdown
                options={dressOptions}
                value={pickerDressId}
                onChange={setPickerDressId}
                placeholder="Ajouter une robe…"
              />
              <button
                type="button"
                onClick={() => {
                  if (!pickerDressId) return;
                  setDressIds((prev) => [...prev, pickerDressId]);
                  setPickerDressId("");
                }}
                className="btn-secondary w-full rounded-xl border border-[var(--border-soft)] bg-white px-3 py-2 text-sm text-[var(--muted)]"
              >
                Ajouter la robe
              </button>
              {selectedDresses.length > 0 && (
                <ul className="rounded-xl border border-[var(--border-soft)] bg-[var(--surface-soft)] p-3 space-y-2">
                  {selectedDresses.map((dress) => (
                    <li key={dress.id} className="flex items-center justify-between gap-2 text-sm">
                      <span className="text-[var(--foreground)]">
                        {dress.reference}{dress.name ? ` - ${dress.name}` : ""}{" "}
                        <span className="text-[var(--muted)]">({formatAmount(dress.price)})</span>
                      </span>
                      <button
                        type="button"
                        onClick={() => setDressIds((prev) => prev.filter((id) => id !== dress.id))}
                        className="btn-danger rounded-lg border border-rose-200 bg-white px-2.5 py-1 text-xs text-rose-700"
                      >
                        Retirer
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>

          {/* Client */}
          <div>
            <label className="mb-1 block text-xs uppercase tracking-wide text-[var(--muted)]">Client</label>
            <SearchDropdown
              options={clientOptions}
              value={clientId}
              onChange={setClientId}
              placeholder="Sélectionner un client…"
              required
            />
          </div>

          {/* Dates */}
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="mb-1 block text-xs uppercase tracking-wide text-[var(--muted)]">Début</label>
              <input
                required
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="premium-input w-full"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs uppercase tracking-wide text-[var(--muted)]">Fin</label>
              <input
                required
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="premium-input w-full"
              />
            </div>
          </div>

          {/* Statut */}
          <div>
            <label className="mb-1 block text-xs uppercase tracking-wide text-[var(--muted)]">Statut</label>
            <select
              value={status}
              onChange={(e) => setStatus(e.target.value)}
              className="premium-input w-full"
            >
              <option value="draft">Brouillon</option>
              <option value="reserved">Réservé</option>
              <option value="rented">En location</option>
              <option value="preparing">En préparation</option>
              <option value="completed">Terminé</option>
              <option value="cancelled">Annulé</option>
            </select>
          </div>

          {/* Prix */}
          <div>
            <label className="mb-1 block text-xs uppercase tracking-wide text-[var(--muted)]">
              Remise (DA)
            </label>
            <input
              type="number"
              min={0}
              step="0.01"
              value={discountAmount}
              onChange={(e) => setDiscountAmount(e.target.value)}
              className="premium-input w-full"
            />
          </div>

          <div>
            <label className="mb-1 block text-xs uppercase tracking-wide text-[var(--muted)]">
              Supplément (DA)
            </label>
            <input
              type="number"
              min={0}
              step="0.01"
              value={supplement}
              onChange={(e) => setSupplement(e.target.value)}
              placeholder="Ex: journée supplémentaire"
              className="premium-input w-full"
            />
          </div>

          <div>
            <label className="mb-1 block text-xs uppercase tracking-wide text-[var(--muted)]">
              Prix total (DA)
            </label>
            <input
              readOnly
              type="text"
              value={selectedDresses.length ? computedTotal.toFixed(2) : ""}
              placeholder="Prix total (auto)"
              className="premium-input w-full bg-[var(--surface-soft)]"
            />
          </div>

          <div>
            <label className="mb-1 block text-xs uppercase tracking-wide text-[var(--muted)]">
              Acompte (DA)
            </label>
            <input
              type="number"
              min={0}
              step="0.01"
              value={depositPaid}
              onChange={(e) => setDepositPaid(e.target.value)}
              className="premium-input w-full"
            />
          </div>

          {/* Caution */}
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="mb-1 block text-xs uppercase tracking-wide text-[var(--muted)]">
                Caution (DA)
              </label>
              <input
                type="number"
                min={0}
                step="0.01"
                value={cautionAmount}
                onChange={(e) => setCautionAmount(e.target.value)}
                className="premium-input w-full"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs uppercase tracking-wide text-[var(--muted)]">
                Statut caution
              </label>
              <select
                value={cautionStatus}
                onChange={(e) => setCautionStatus(e.target.value)}
                className="premium-input w-full"
              >
                <option value="pending">En attente</option>
                <option value="received">Reçue</option>
                <option value="returned">Restituée</option>
                <option value="retained">Retenue</option>
                <option value="not_required">Non requise</option>
              </select>
            </div>
          </div>

          {/* Notes */}
          <div>
            <label className="mb-1 block text-xs uppercase tracking-wide text-[var(--muted)]">Notes</label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="premium-input min-h-20 w-full"
            />
          </div>

          {error ? <p className="text-sm text-red-600">{error}</p> : null}

          <button
            disabled={submitting}
            type="submit"
            className="premium-btn w-full px-3 py-2.5 text-sm disabled:opacity-60"
          >
            {submitting ? "Enregistrement…" : "Enregistrer les modifications"}
          </button>
        </form>
      </div>
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────
export function ReservationsClient({
  initialReservations,
  initialDresses,
  initialClients,
}: ReservationsClientProps) {
  const [reservations, setReservations] = useState<Reservation[]>(initialReservations);
  const dresses = initialDresses;
  const clients = initialClients;
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");

  // Create form state
  const [dressId, setDressId] = useState("");
  const [dressIds, setDressIds] = useState<string[]>([]);
  const [clientId, setClientId] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [depositPaid, setDepositPaid] = useState("");
  const [discountAmount, setDiscountAmount] = useState("");
  const [supplement, setSupplement] = useState("");
  const [cautionAmount, setCautionAmount] = useState("");
  const [cautionStatus, setCautionStatus] = useState("pending");
  const [notes, setNotes] = useState("");
  const [submitting, setSubmitting] = useState(false);

  // Edit modal state
  const [editingReservation, setEditingReservation] = useState<Reservation | null>(null);

  const selectedDresses = dresses.filter((dress) => dressIds.includes(dress.id));
  const baseTotalValue = selectedDresses.reduce((total, dress) => total + Number(dress.price || 0), 0);
  const parsedDiscount = discountAmount.trim().length > 0 ? Number(discountAmount) : 0;
  const safeDiscount = Number.isFinite(parsedDiscount) ? Math.max(parsedDiscount, 0) : 0;
  const parsedSupplement = supplement.trim().length > 0 ? Number(supplement) : 0;
  const safeSupplement = Number.isFinite(parsedSupplement) ? Math.max(parsedSupplement, 0) : 0;
  const totalPriceValue = Math.max(baseTotalValue - safeDiscount, 0) + safeSupplement;
  const totalPrice = selectedDresses.length ? totalPriceValue.toFixed(2) : "";

  const availableDressesForPicker = useMemo(
    () => dresses.filter((d) => !dressIds.includes(d.id)),
    [dresses, dressIds]
  );

  const clientOptions = useMemo(
    () =>
      [...clients]
        .sort((a, b) =>
          `${a.last_name} ${a.first_name}`.localeCompare(`${b.last_name} ${b.first_name}`, "fr")
        )
        .map((c) => ({ id: c.id, label: `${c.last_name} ${c.first_name} — ${c.phone}` })),
    [clients]
  );

  const dressOptions = useMemo(
    () =>
      availableDressesForPicker.map((d) => ({
        id: d.id,
        label: `${d.reference}${d.name ? ` - ${d.name}` : ""}`,
      })),
    [availableDressesForPicker]
  );

  const reservationDressNames = (reservation: Reservation) =>
    (reservation.reservation_dresses ?? []).map(
      (item) => item.dresses?.name || item.dresses?.reference || "Robe"
    );

  const hasFilters = search.trim() !== "" || dateFrom !== "" || dateTo !== "";

  const filteredReservations = useMemo(() => {
    const query = search.trim().toLowerCase();
    return reservations.filter((reservation) => {
      // Filtre texte (client, contrat, robe)
      if (query) {
        const clientName = `${reservation.clients?.first_name ?? ""} ${reservation.clients?.last_name ?? ""}`;
        const dressText = (reservation.reservation_dresses ?? [])
          .map((item) => `${item.dresses?.name ?? ""} ${item.dresses?.reference ?? ""}`)
          .join(" ");
        const matchesText = [clientName, reservation.contract_number, dressText].some((value) =>
          value.toLowerCase().includes(query)
        );
        if (!matchesText) return false;
      }
      // Filtre période : on garde les réservations qui chevauchent [dateFrom, dateTo]
      if (dateFrom && reservation.end_date < dateFrom) return false;
      if (dateTo && reservation.start_date > dateTo) return false;
      return true;
    });
  }, [reservations, search, dateFrom, dateTo]);

  // Rafraîchissement ciblé : seules les réservations changent après une mutation
  // de réservation (les listes robes/clients sont inchangées) → 1 requête au lieu de 3.
  const reloadReservations = useCallback(async () => {
    setLoading(true);
    const response = await fetch("/api/reservations", { cache: "no-store" });
    const json = await response.json().catch(() => ({}));
    if (!response.ok) {
      setError(json.error || "Erreur chargement réservations");
      setLoading(false);
      return;
    }
    const normalized = (json.data ?? []).map((reservation: Reservation) => ({
      ...reservation,
      reservation_dresses: Array.isArray(reservation.reservation_dresses)
        ? reservation.reservation_dresses
        : reservation.reservation_dresses
          ? [reservation.reservation_dresses]
          : [],
    }));
    setReservations(normalized);
    setLoading(false);
  }, []);

  async function createReservation(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitting(true);
    setError(null);

    if (dressIds.length === 0 || !clientId || !startDate || !endDate) {
      setError("Merci de renseigner au moins une robe, le client et les dates de réservation.");
      setSubmitting(false);
      return;
    }

    if (startDate > endDate) {
      setError("La date de fin doit être supérieure ou égale à la date de début.");
      setSubmitting(false);
      return;
    }

    if (safeDiscount > baseTotalValue) {
      setError("La remise ne peut pas dépasser le prix total.");
      setSubmitting(false);
      return;
    }

    const parsedDeposit = depositPaid.trim().length > 0 ? Number(depositPaid) : 0;
    if (parsedDeposit > totalPriceValue) {
      setError("L'acompte ne peut pas dépasser le prix total.");
      setSubmitting(false);
      return;
    }

    const response = await fetch("/api/reservations", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        dress_ids: dressIds,
        client_id: clientId,
        start_date: startDate,
        end_date: endDate,
        discount_amount: safeDiscount,
        supplement: safeSupplement,
        deposit_paid: parsedDeposit,
        caution_amount: cautionAmount.trim().length > 0 ? Number(cautionAmount) : 0,
        caution_status: cautionStatus,
        notes,
      }),
    });

    const json = await response.json();

    if (!response.ok) {
      setError(json.error || "Erreur lors de la création de la réservation");
      setSubmitting(false);
      return;
    }

    setDressId("");
    setDressIds([]);
    setClientId("");
    setStartDate("");
    setEndDate("");
    setDepositPaid("");
    setDiscountAmount("");
    setSupplement("");
    setCautionAmount("");
    setCautionStatus("pending");
    setNotes("");
    setSubmitting(false);
    await reloadReservations();
  }

  async function deleteReservation(id: string) {
    setError(null);
    const response = await fetch(`/api/reservations/${id}`, { method: "DELETE" });
    const json = await response.json().catch(() => ({}));

    if (response.ok) {
      await reloadReservations();
      return;
    }

    setError(json.error || "Suppression impossible pour cette réservation.");
  }

  return (
    <>
      {editingReservation ? (
        <EditReservationModal
          reservation={editingReservation}
          allDresses={dresses}
          clients={clients}
          onClose={() => setEditingReservation(null)}
          onSaved={reloadReservations}
        />
      ) : null}

      <section className="grid gap-5 xl:grid-cols-12">
        <article className="premium-card p-6 xl:col-span-4">
          <h2 className="text-xl font-light tracking-wide text-[var(--foreground)]">Nouvelle réservation</h2>
          <form className="mt-3 space-y-3" onSubmit={createReservation}>
            <div className="space-y-2">
              <p className="text-xs font-medium uppercase tracking-wide text-[var(--muted)]">Robe</p>
              <SearchDropdown
                options={dressOptions}
                value={dressId}
                onChange={setDressId}
                placeholder="Sélectionner une robe…"
              />
              <button
                type="button"
                onClick={() => {
                  setError(null);
                  if (!dressId) {
                    setError("Sélectionne une robe avant de l'ajouter.");
                    return;
                  }
                  if (dressIds.includes(dressId)) {
                    setError("Cette robe est déjà ajoutée.");
                    return;
                  }
                  setDressIds((previous) => [...previous, dressId]);
                  setDressId("");
                }}
                className="btn-secondary w-full rounded-xl border border-[var(--border-soft)] bg-white px-3 py-2 text-sm text-[var(--muted)]"
              >
                Ajouter la robe
              </button>
            </div>

            <div className="rounded-xl border border-[var(--border-soft)] bg-[var(--surface-soft)] p-3">
              <p className="text-xs font-medium uppercase tracking-wide text-[var(--muted)]">Robes ajoutées</p>
              {selectedDresses.length === 0 ? (
                <p className="mt-2 text-sm text-[var(--muted)]">Aucune robe ajoutée pour l&apos;instant.</p>
              ) : (
                <ul className="mt-2 space-y-2">
                  {selectedDresses.map((dress) => (
                    <li key={dress.id} className="flex items-center justify-between gap-2 text-sm">
                      <span className="text-[var(--foreground)]">
                        {dress.reference} {dress.name ? `- ${dress.name}` : ""}
                      </span>
                      <button
                        type="button"
                        onClick={() => {
                          setError(null);
                          setDressIds((previous) => previous.filter((id) => id !== dress.id));
                        }}
                        className="btn-danger rounded-lg border border-rose-200 bg-white px-2.5 py-1 text-xs text-rose-700"
                      >
                        Retirer
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            <div>
              <p className="mb-1 text-xs font-medium uppercase tracking-wide text-[var(--muted)]">Client</p>
              <SearchDropdown
                options={clientOptions}
                value={clientId}
                onChange={setClientId}
                placeholder="Sélectionner un client…"
                required
              />
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="mb-1 block text-xs uppercase tracking-wide text-[var(--muted)]">Début</label>
                <input
                  required
                  type="date"
                  value={startDate}
                  onChange={(event) => setStartDate(event.target.value)}
                  className="premium-input w-full"
                />
              </div>
              <div>
                <label className="mb-1 block text-xs uppercase tracking-wide text-[var(--muted)]">Fin</label>
                <input
                  required
                  type="date"
                  value={endDate}
                  onChange={(event) => setEndDate(event.target.value)}
                  className="premium-input w-full"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="mb-1 block text-xs uppercase tracking-wide text-[var(--muted)]">Remise (DA)</label>
                <input
                  min={0}
                  type="number"
                  step="0.01"
                  value={discountAmount}
                  onChange={(event) => setDiscountAmount(event.target.value)}
                  className="premium-input w-full"
                />
              </div>
              <div>
                <label className="mb-1 block text-xs uppercase tracking-wide text-[var(--muted)]">Supplément (DA)</label>
                <input
                  min={0}
                  type="number"
                  step="0.01"
                  placeholder="ex: journée en plus"
                  value={supplement}
                  onChange={(event) => setSupplement(event.target.value)}
                  className="premium-input w-full"
                />
              </div>
            </div>

            <div>
              <label className="mb-1 block text-xs uppercase tracking-wide text-[var(--muted)]">Prix total (auto)</label>
              <input
                readOnly
                type="text"
                placeholder="Prix total (auto)"
                value={totalPrice}
                className="premium-input w-full bg-[var(--surface-soft)]"
              />
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="mb-1 block text-xs uppercase tracking-wide text-[var(--muted)]">Acompte (DA)</label>
                <input
                  min={0}
                  type="number"
                  step="0.01"
                  value={depositPaid}
                  onChange={(event) => setDepositPaid(event.target.value)}
                  className="premium-input w-full"
                />
              </div>
              <div>
                <label className="mb-1 block text-xs uppercase tracking-wide text-[var(--muted)]">Caution (DA)</label>
                <input
                  min={0}
                  type="number"
                  step="0.01"
                  value={cautionAmount}
                  onChange={(event) => setCautionAmount(event.target.value)}
                  className="premium-input w-full"
                />
              </div>
            </div>

            <div>
              <label className="mb-1 block text-xs uppercase tracking-wide text-[var(--muted)]">Statut caution</label>
              <select
                value={cautionStatus}
                onChange={(event) => setCautionStatus(event.target.value)}
                className="premium-input w-full"
              >
                <option value="pending">Caution en attente</option>
                <option value="received">Caution reçue</option>
                <option value="not_required">Pas de caution</option>
              </select>
            </div>

            <div>
              <label className="mb-1 block text-xs uppercase tracking-wide text-[var(--muted)]">Notes</label>
              <textarea
                value={notes}
                onChange={(event) => setNotes(event.target.value)}
                className="premium-input min-h-24 w-full"
              />
            </div>
            <button
              disabled={submitting}
              type="submit"
              className="premium-btn w-full px-3 py-2.5 text-sm disabled:opacity-60"
            >
              {submitting ? "Création..." : "Créer la réservation"}
            </button>
          </form>
          {error ? <p className="mt-3 text-sm text-red-600">{error}</p> : null}
        </article>

        <article className="premium-card p-6 xl:col-span-8">
          <div className="flex flex-col gap-3">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <h2 className="text-xl font-light tracking-wide text-[var(--foreground)]">Réservations</h2>
              <input
                type="search"
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Rechercher (client, contrat, robe…)"
                className="premium-input w-full sm:max-w-xs"
              />
            </div>
            <div className="flex flex-wrap items-end gap-2">
              <div>
                <label className="mb-1 block text-[10px] uppercase tracking-wide text-[var(--muted)]">Du</label>
                <input
                  type="date"
                  value={dateFrom}
                  max={dateTo || undefined}
                  onChange={(event) => setDateFrom(event.target.value)}
                  className="premium-input"
                />
              </div>
              <div>
                <label className="mb-1 block text-[10px] uppercase tracking-wide text-[var(--muted)]">Au</label>
                <input
                  type="date"
                  value={dateTo}
                  min={dateFrom || undefined}
                  onChange={(event) => setDateTo(event.target.value)}
                  className="premium-input"
                />
              </div>
              {dateFrom || dateTo ? (
                <button
                  type="button"
                  onClick={() => {
                    setDateFrom("");
                    setDateTo("");
                  }}
                  className="btn-secondary rounded-lg border border-[var(--border-soft)] bg-white px-3 py-2 text-xs text-[var(--muted)]"
                >
                  Effacer la période
                </button>
              ) : null}
            </div>
          </div>
          {loading ? <p className="mt-3 text-sm text-[var(--muted)]">Chargement...</p> : null}
          {!loading && reservations.length > 0 && filteredReservations.length === 0 && hasFilters ? (
            <p className="mt-4 text-sm text-[var(--muted)]">Aucune réservation ne correspond aux filtres.</p>
          ) : null}
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            {filteredReservations.map((reservation) => {
              const dressNames = reservationDressNames(reservation);
              const balance = Number(reservation.balance_due ?? 0);
              return (
                <div
                  key={reservation.id}
                  className="rounded-xl border border-[var(--border-soft)] bg-white p-4 transition-colors hover:border-[var(--accent)]"
                >
                  {/* Client + contrat */}
                  <p className="truncate font-medium text-[var(--foreground)]">
                    {reservation.clients?.first_name} {reservation.clients?.last_name}
                  </p>
                  <p className="mt-0.5 font-mono text-[11px] text-[var(--muted)]">
                    {reservation.contract_number}
                  </p>

                  {/* Période */}
                  <p className="mt-2 text-sm text-[var(--muted)]">
                    {formatDateFr(reservation.start_date)} → {formatDateFr(reservation.end_date)}
                  </p>

                  {/* Robes (nom seul) */}
                  {dressNames.length > 0 ? (
                    <div className="mt-2 flex flex-wrap gap-1.5">
                      {dressNames.map((name, index) => (
                        <span
                          key={`${name}-${index}`}
                          className="rounded-md bg-[var(--surface-soft)] px-2 py-0.5 text-xs font-medium text-[var(--foreground)]"
                        >
                          {name}
                        </span>
                      ))}
                    </div>
                  ) : null}

                  {/* Paiement compact */}
                  <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-xs text-[var(--muted)]">
                    <span>
                      Total{" "}
                      <span className="font-medium text-[var(--foreground)]">
                        {formatAmount(reservation.total_price)}
                      </span>
                    </span>
                    <span>
                      Acompte{" "}
                      <span className="text-[var(--foreground)]">{formatAmount(reservation.deposit_paid)}</span>
                    </span>
                    <span>
                      Reste{" "}
                      <span className={`font-medium ${balance > 0 ? "text-amber-700" : "text-emerald-700"}`}>
                        {formatAmount(reservation.balance_due)}
                      </span>
                    </span>
                  </div>

                  {/* Actions */}
                  <div className="mt-4 flex flex-wrap gap-2">
                    <a
                      href={`/api/reservations/${reservation.id}/contract-pdf`}
                      className="btn-secondary rounded-lg border border-[var(--border-soft)] bg-white px-3 py-1.5 text-xs text-[var(--muted)]"
                    >
                      Contrat
                    </a>
                    <a
                      href={`/api/reservations/${reservation.id}/invoice-pdf`}
                      className="btn-secondary rounded-lg border border-[var(--border-soft)] bg-white px-3 py-1.5 text-xs text-[var(--muted)]"
                    >
                      Facture
                    </a>
                    <button
                      type="button"
                      onClick={() => setEditingReservation(reservation)}
                      className="btn-secondary rounded-lg border border-[var(--border-soft)] bg-white px-3 py-1.5 text-xs text-[var(--muted)]"
                    >
                      Modifier
                    </button>
                    <button
                      type="button"
                      onClick={() => void deleteReservation(reservation.id)}
                      className="btn-danger rounded-lg border border-rose-200 bg-white px-3 py-1.5 text-xs text-rose-700"
                    >
                      Supprimer
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
          {!loading && reservations.length === 0 ? (
            <p className="mt-4 text-sm text-[var(--muted)]">Aucune réservation enregistrée.</p>
          ) : null}
        </article>
      </section>
    </>
  );
}
