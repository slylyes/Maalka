"use client";

/* eslint-disable @next/next/no-img-element */

import { FormEvent, useCallback, useMemo, useState } from "react";

type Dress = {
  id: string;
  reference: string;
  name: string | null;
  category: string;
  price: number;
  size: string | null;
  notes: string | null;
  primary_photo_url?: string | null;
};

type Photo = {
  id: string;
  storage_path: string;
  is_primary: boolean;
};

type CalendarReservation = {
  id: string;
  contract_number: string;
  start_date: string;
  end_date: string;
  status: string;
  client_name: string | null;
};

const categoryOptions = ["Caftans", "Robes Kabyles", "Karakou", "Fergani", "Blouza"];

const blockingStatuses = new Set(["reserved", "rented", "preparing"]);

function dateFromISO(value: string) {
  return new Date(`${value}T00:00:00`);
}

function formatMonthKey(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
}

function dateKey(date: Date) {
  return [date.getFullYear(), String(date.getMonth() + 1).padStart(2, "0"), String(date.getDate()).padStart(2, "0")].join("-");
}

function formatDateFr(value: string) {
  const [year, month, day] = value.split("-");
  if (!year || !month || !day) return value;
  return `${day}-${month}-${year}`;
}

function addDays(value: Date, amount: number) {
  const result = new Date(value);
  result.setDate(result.getDate() + amount);
  return result;
}

type DressesClientProps = {
  initialDresses: Dress[];
};

export function DressesClient({ initialDresses }: DressesClientProps) {
  const [dresses, setDresses] = useState<Dress[]>(initialDresses);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [editingDressId, setEditingDressId] = useState<string | null>(null);

  const [reference, setReference] = useState("");
  const [name, setName] = useState("");
  const [category, setCategory] = useState("");
  const [price, setPrice] = useState("");
  const [size, setSize] = useState("");
  const [notes, setNotes] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const [selectedDressId, setSelectedDressId] = useState<string>("");
  const [photos, setPhotos] = useState<Photo[]>([]);
  const [photoLoading, setPhotoLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [calendarMonth, setCalendarMonth] = useState(() => {
    const today = new Date();
    return new Date(today.getFullYear(), today.getMonth(), 1);
  });
  const [calendarRows, setCalendarRows] = useState<CalendarReservation[]>([]);
  const [calendarLoading, setCalendarLoading] = useState(false);

  const selectedDress = useMemo(
    () => dresses.find((dress) => dress.id === selectedDressId) ?? null,
    [dresses, selectedDressId]
  );

  const groupedByCategory = useMemo(() => {
    const grouped = new Map<string, Dress[]>();
    for (const dress of dresses) {
      const key = dress.category || "Catégorie 1";
      if (!grouped.has(key)) grouped.set(key, []);
      grouped.get(key)?.push(dress);
    }
    return Array.from(grouped.entries());
  }, [dresses]);

  const calendarGrid = useMemo(() => {
    const year = calendarMonth.getFullYear();
    const month = calendarMonth.getMonth();
    const firstDay = new Date(year, month, 1);
    const startOffset = (firstDay.getDay() + 6) % 7;
    const daysInMonth = new Date(year, month + 1, 0).getDate();

    const blockedDays = new Set<string>();
    for (const reservation of calendarRows) {
      if (!blockingStatuses.has(reservation.status)) continue;

      const start = dateFromISO(reservation.start_date);
      const end = dateFromISO(reservation.end_date);
      let cursor = start;

      while (cursor <= end) {
        if (cursor.getMonth() === month && cursor.getFullYear() === year) {
          blockedDays.add(dateKey(cursor));
        }
        cursor = addDays(cursor, 1);
      }
    }

    const cells: Array<{ key: string; day?: number; blocked?: boolean }> = [];

    for (let i = 0; i < startOffset; i += 1) {
      cells.push({ key: `empty-${i}` });
    }

    for (let day = 1; day <= daysInMonth; day += 1) {
      const current = new Date(year, month, day);
      cells.push({
        key: dateKey(current),
        day,
        blocked: blockedDays.has(dateKey(current)),
      });
    }

    return cells;
  }, [calendarMonth, calendarRows]);

  const loadDresses = useCallback(async () => {
    setLoading(true);
    setError(null);

    const response = await fetch("/api/dresses", { cache: "no-store" });
    const json = await response.json();

    if (!response.ok) {
      setError(json.error || "Erreur lors du chargement des robes");
      setLoading(false);
      return;
    }

    setDresses(json.data ?? []);
    setLoading(false);
  }, []);

  const loadPhotos = useCallback(async (dressId: string) => {
    if (!dressId) {
      setPhotos([]);
      return;
    }

    setPhotoLoading(true);
    const response = await fetch(`/api/dresses/${dressId}/photos`, { cache: "no-store" });
    const json = await response.json();

    if (response.ok) {
      setPhotos(json.data ?? []);
    } else {
      setPhotos([]);
    }

    setPhotoLoading(false);
  }, []);

  const loadCalendar = useCallback(async (dressId: string, monthDate: Date) => {
    if (!dressId) {
      setCalendarRows([]);
      return;
    }

    setCalendarLoading(true);

    const response = await fetch(
      `/api/dresses/${dressId}/calendar?month=${encodeURIComponent(formatMonthKey(monthDate))}`,
      { cache: "no-store" }
    );
    const json = await response.json();

    if (response.ok) {
      setCalendarRows(json.data ?? []);
    } else {
      setCalendarRows([]);
    }

    setCalendarLoading(false);
  }, []);

  const goToMonth = useCallback(
    (offset: number) => {
      setCalendarMonth((previous) => {
        const next = new Date(previous.getFullYear(), previous.getMonth() + offset, 1);
        if (selectedDressId) {
          void loadCalendar(selectedDressId, next);
        }
        return next;
      });
    },
    [loadCalendar, selectedDressId]
  );

  async function saveDress(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitting(true);
    setError(null);

    const parsedPrice = Number(price);
    if (Number.isNaN(parsedPrice) || parsedPrice < 0) {
      setError("Le prix initial doit être un nombre positif.");
      setSubmitting(false);
      return;
    }

    const endpoint = editingDressId ? `/api/dresses/${editingDressId}` : "/api/dresses";
    const method = editingDressId ? "PATCH" : "POST";

    const response = await fetch(endpoint, {
      method,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        reference,
        name,
        category,
        price: parsedPrice,
        size,
        notes,
      }),
    });

    const json = await response.json();

    if (!response.ok) {
      setError(json.error || "Erreur lors de la création");
      setSubmitting(false);
      return;
    }

    setReference("");
    setName("");
    setCategory("");
    setPrice("");
    setSize("");
    setNotes("");
    setEditingDressId(null);
    setSubmitting(false);
    await loadDresses();
  }

  function startEditDress(dress: Dress) {
    setEditingDressId(dress.id);
    setReference(dress.reference);
    setName(dress.name ?? "");
    setCategory(dress.category || "");
    setPrice(String(dress.price));
    setSize(dress.size ?? "");
    setNotes(dress.notes ?? "");
    setError(null);
  }

  function resetDressForm() {
    setEditingDressId(null);
    setReference("");
    setName("");
    setCategory("");
    setPrice("");
    setSize("");
    setNotes("");
    setError(null);
  }

  async function deleteDress(id: string) {
    setError(null);
    const response = await fetch(`/api/dresses/${id}`, { method: "DELETE" });
    const json = await response.json().catch(() => ({}));

    if (response.ok) {
      if (selectedDressId === id) {
        setSelectedDressId("");
        setPhotos([]);
      }
      await loadDresses();
      return;
    }

    setError(json.error || "Suppression impossible pour cette robe.");
  }

  async function uploadPhoto(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selectedDressId) return;

    const form = event.currentTarget;
    const fileInput = form.elements.namedItem("file") as HTMLInputElement | null;
    const isPrimaryInput = form.elements.namedItem("isPrimary") as HTMLInputElement | null;

    if (!fileInput?.files?.[0]) return;

    const formData = new FormData();
    formData.append("file", fileInput.files[0]);
    formData.append("isPrimary", String(Boolean(isPrimaryInput?.checked)));

    setUploading(true);
    const response = await fetch(`/api/dresses/${selectedDressId}/photos`, {
      method: "POST",
      body: formData,
    });

    const json = await response.json().catch(() => ({}));

    if (response.ok) {
      form.reset();
      await loadPhotos(selectedDressId);
      await loadDresses();
    } else {
      setError(json.error || "Impossible d'ajouter cette photo.");
    }

    setUploading(false);
  }

  return (
    <section className="grid gap-5 xl:grid-cols-12">
      <article className="premium-card p-6 xl:col-span-4">
        <h2 className="text-xl font-light tracking-wide text-[var(--foreground)]">
          {editingDressId ? "Modifier la robe" : "Nouvelle robe"}
        </h2>
        <form className="mt-3 space-y-3" onSubmit={saveDress}>
          <input
            required
            placeholder="Référence"
            value={reference}
            onChange={(event) => setReference(event.target.value)}
            className="premium-input w-full"
          />
          <input
            placeholder="Nom"
            value={name}
            onChange={(event) => setName(event.target.value)}
            className="premium-input w-full"
          />
          <select
            required
            value={category}
            onChange={(event) => setCategory(event.target.value)}
            className="premium-input w-full"
          >
            <option value="" disabled>
              Catégorie
            </option>
            {categoryOptions.map((option) => (
              <option key={option} value={option}>
                {option}
              </option>
            ))}
          </select>
          <input
            required
            min={0}
            type="number"
            step="0.01"
            placeholder="Prix initial"
            value={price}
            onChange={(event) => setPrice(event.target.value)}
            className="premium-input w-full"
          />
          <input
            placeholder="Taille"
            value={size}
            onChange={(event) => setSize(event.target.value)}
            className="premium-input w-full"
          />
          <textarea
            placeholder="Notes"
            value={notes}
            onChange={(event) => setNotes(event.target.value)}
            className="premium-input min-h-24 w-full"
          />
          <button
            disabled={submitting}
            type="submit"
            className="premium-btn w-full px-3 py-2.5 text-sm disabled:opacity-60"
          >
            {submitting
              ? editingDressId
                ? "Mise à jour..."
                : "Création..."
              : editingDressId
                ? "Enregistrer les modifications"
                : "Créer la robe"}
          </button>
          {editingDressId ? (
            <button
              type="button"
              onClick={resetDressForm}
              className="w-full rounded-xl border border-[var(--border-soft)] bg-white px-3 py-2.5 text-sm text-[var(--muted)]"
            >
              Annuler la modification
            </button>
          ) : null}
        </form>
        {error ? <p className="mt-3 text-sm text-red-600">{error}</p> : null}
      </article>

      <article className="premium-card p-6 xl:col-span-8">
        <h2 className="text-xl font-light tracking-wide text-[var(--foreground)]">Catalogue des robes</h2>
        {loading ? <p className="mt-3 text-sm text-[var(--muted)]">Chargement...</p> : null}
        <div className="mt-4 space-y-6">
          {groupedByCategory.map(([groupName, items]) => (
            <section key={groupName}>
              <h3 className="text-sm font-medium uppercase tracking-wide text-[var(--muted)]">{groupName}</h3>
              <ul className="mt-3 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                {items.map((dress) => (
                  <li
                    key={dress.id}
                    className="overflow-hidden rounded-2xl border border-[var(--border-soft)] bg-white shadow-sm"
                  >
                    <div className="aspect-[4/3] w-full bg-[var(--surface-soft)]">
                      {dress.primary_photo_url ? (
                        <img
                          src={dress.primary_photo_url}
                          alt={dress.name ?? dress.reference}
                          className="h-full w-full object-cover"
                        />
                      ) : (
                        <div className="flex h-full items-center justify-center text-xs text-[var(--muted)]">
                          Pas de photo
                        </div>
                      )}
                    </div>
                    <div className="p-4">
                      <p className="text-base font-medium tracking-wide text-[var(--foreground)]">
                        {dress.reference}
                      </p>
                      <p className="mt-1 text-sm text-[var(--muted)]">{dress.name || "Sans nom"}</p>
                      <div className="mt-3 space-y-1 text-sm text-[var(--muted)]">
                        <p>Prix: {dress.price} DA</p>
                        <p>Taille: {dress.size || "-"}</p>
                      </div>
                      <div className="mt-4 flex flex-wrap gap-2">
                        <button
                          type="button"
                          onClick={() => {
                            setSelectedDressId(dress.id);
                            void loadPhotos(dress.id);
                            void loadCalendar(dress.id, calendarMonth);
                          }}
                          className="rounded-lg border border-[var(--border-soft)] bg-[var(--surface-soft)] px-3 py-1.5 text-xs text-[var(--muted)]"
                        >
                          Gérer
                        </button>
                        <button
                          type="button"
                          onClick={() => startEditDress(dress)}
                          className="rounded-lg border border-[var(--border-soft)] bg-white px-3 py-1.5 text-xs text-[var(--muted)]"
                        >
                          Modifier
                        </button>
                        <button
                          type="button"
                          onClick={() => void deleteDress(dress.id)}
                          className="rounded-lg border border-rose-200 bg-white px-3 py-1.5 text-xs text-rose-700"
                        >
                          Supprimer
                        </button>
                      </div>
                    </div>
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </div>
        {!loading && dresses.length === 0 ? (
          <p className="mt-4 text-sm text-[var(--muted)]">Aucune robe enregistrée.</p>
        ) : null}
      </article>

      <article className="premium-card p-6 xl:col-span-12">
        <h2 className="text-xl font-light tracking-wide text-[var(--foreground)]">Photos et calendrier de robe</h2>
        {!selectedDress ? (
          <p className="mt-2 text-sm text-[var(--muted)]">
            Sélectionne une robe dans le catalogue pour gérer ses photos et son calendrier.
          </p>
        ) : (
          <>
            <p className="mt-2 text-sm text-[var(--muted)]">
              Robe sélectionnée: {selectedDress.reference} {selectedDress.name ? `- ${selectedDress.name}` : ""}
            </p>
            <form className="mt-3 flex flex-col gap-2 sm:flex-row sm:items-center" onSubmit={uploadPhoto}>
              <input
                name="file"
                type="file"
                accept="image/*"
                className="premium-input text-sm file:mr-3 file:rounded-md file:border-0 file:bg-[var(--surface-soft)] file:px-2.5 file:py-1.5"
                required
              />
              <label className="text-sm text-[var(--muted)]">
                <input className="mr-2" type="checkbox" name="isPrimary" />
                Photo principale
              </label>
              <button
                type="submit"
                disabled={uploading}
                className="premium-btn px-4 py-2 text-sm disabled:opacity-60"
              >
                {uploading ? "Upload..." : "Ajouter la photo"}
              </button>
            </form>

            {photoLoading ? <p className="mt-3 text-sm text-[var(--muted)]">Chargement des photos...</p> : null}
            <ul className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
              {photos.map((photo) => (
                <li
                  key={photo.id}
                  className="rounded-lg border border-[var(--border-soft)] bg-[var(--surface-soft)] p-3 text-xs text-[var(--muted)]"
                >
                  <p className="font-medium text-[var(--foreground)]">
                    {photo.is_primary ? "Principale" : "Secondaire"}
                  </p>
                  <p className="break-all">{photo.storage_path}</p>
                </li>
              ))}
              {!photoLoading && selectedDress && photos.length === 0 ? (
                <li className="text-sm text-[var(--muted)]">Aucune photo pour cette robe.</li>
              ) : null}
            </ul>

            <div className="mt-6 rounded-xl border border-[var(--border-soft)] bg-[var(--surface-soft)] p-4">
              <div className="flex items-center justify-between gap-2">
                <h3 className="text-base font-medium text-[var(--foreground)]">Calendrier des indisponibilités</h3>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => goToMonth(-1)}
                    className="rounded-lg border border-[var(--border-soft)] bg-white px-2.5 py-1 text-xs text-[var(--muted)]"
                  >
                    Précédent
                  </button>
                  <span className="text-sm text-[var(--muted)]">
                    {calendarMonth.toLocaleDateString("fr-FR", {
                      month: "long",
                      year: "numeric",
                    })}
                  </span>
                  <button
                    type="button"
                    onClick={() => goToMonth(1)}
                    className="rounded-lg border border-[var(--border-soft)] bg-white px-2.5 py-1 text-xs text-[var(--muted)]"
                  >
                    Suivant
                  </button>
                </div>
              </div>

              {calendarLoading ? <p className="mt-3 text-sm text-[var(--muted)]">Chargement...</p> : null}

              <div className="mt-3 grid grid-cols-7 gap-2 text-center text-xs text-[var(--muted)]">
                {["L", "M", "M", "J", "V", "S", "D"].map((day, index) => (
                  <div key={`${day}-${index}`} className="font-medium">
                    {day}
                  </div>
                ))}
              </div>

              <div className="mt-2 grid grid-cols-7 gap-2">
                {calendarGrid.map((cell) => (
                  <div
                    key={cell.key}
                    className={`flex h-10 items-center justify-center rounded-lg border text-xs ${
                      !cell.day
                        ? "border-transparent bg-transparent"
                        : cell.blocked
                          ? "border-amber-300 bg-amber-100 text-amber-800"
                          : "border-[var(--border-soft)] bg-white text-[var(--muted)]"
                    }`}
                  >
                    {cell.day ?? ""}
                  </div>
                ))}
              </div>

              <div className="mt-4 space-y-2">
                {calendarRows.length > 0 ? (
                  calendarRows.map((reservation) => (
                    <div
                      key={reservation.id}
                      className="rounded-lg border border-[var(--border-soft)] bg-white p-2 text-xs text-[var(--muted)]"
                    >
                      <p className="font-medium text-[var(--foreground)]">{reservation.contract_number}</p>
                      <p>
                        {formatDateFr(reservation.start_date)} → {formatDateFr(reservation.end_date)} ({reservation.status})
                      </p>
                      {reservation.client_name ? <p>Client: {reservation.client_name}</p> : null}
                    </div>
                  ))
                ) : (
                  <p className="text-xs text-[var(--muted)]">Aucune réservation sur ce mois.</p>
                )}
              </div>
            </div>
          </>
        )}
      </article>
    </section>
  );
}
