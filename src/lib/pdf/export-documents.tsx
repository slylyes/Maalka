import { Document, Image, Page, Text, View, StyleSheet, renderToBuffer } from "@react-pdf/renderer";

import { getLogoDataUrl } from "@/lib/pdf/reservation-documents";
import type { FinancesPageData } from "@/lib/finances";

/* eslint-disable jsx-a11y/alt-text */

export type ReservationExportRow = {
  contractNumber: string;
  clientName: string;
  phone: string;
  reservationDate: string;
  startDate: string;
  endDate: string;
  status: string;
  dresses: string;
  totalPrice: number;
  depositPaid: number;
  balanceDue: number;
};

const STATUS_LABELS: Record<string, string> = {
  draft: "Brouillon",
  reserved: "Réservé",
  preparing: "En préparation",
  rented: "En location",
  completed: "Terminé",
  cancelled: "Annulé",
};

const styles = StyleSheet.create({
  page: {
    padding: 28,
    fontSize: 9,
    fontFamily: "Helvetica",
    color: "#2f2b25",
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#e9e2d4",
    paddingBottom: 8,
  },
  logo: {
    width: 100,
    height: 43,
  },
  title: {
    fontSize: 15,
    fontWeight: "bold",
  },
  meta: {
    fontSize: 9,
    color: "#6f675b",
    textAlign: "right",
  },
  sectionTitle: {
    fontSize: 10,
    fontWeight: "bold",
    marginTop: 10,
    marginBottom: 5,
    color: "#9f7e4e",
    textTransform: "uppercase",
    letterSpacing: 0.4,
  },
  tableHeader: {
    flexDirection: "row",
    borderBottomWidth: 1,
    borderBottomColor: "#c5a065",
    paddingBottom: 3,
    marginBottom: 2,
    fontWeight: "bold",
  },
  tableRow: {
    flexDirection: "row",
    borderBottomWidth: 0.5,
    borderBottomColor: "#e9e2d4",
    paddingVertical: 3,
  },
  kpiGrid: {
    flexDirection: "row",
    gap: 8,
    marginBottom: 4,
  },
  kpiBox: {
    flex: 1,
    borderWidth: 1,
    borderColor: "#e9e2d4",
    borderRadius: 5,
    padding: 7,
    backgroundColor: "#fffdfa",
  },
  kpiLabel: {
    fontSize: 7.5,
    color: "#6f675b",
    textTransform: "uppercase",
    marginBottom: 3,
  },
  kpiValue: {
    fontSize: 11,
    fontWeight: "bold",
  },
  footer: {
    position: "absolute",
    bottom: 16,
    left: 28,
    right: 28,
    fontSize: 8,
    color: "#6f675b",
    textAlign: "center",
  },
});

function money(value: number) {
  return `${value.toFixed(2)} DA`;
}

function formatDateFr(value: string) {
  const [year, month, day] = value.split("-");
  if (!year || !month || !day) return value;
  return `${day}-${month}-${year}`;
}

function Header({ title, subtitle, logoDataUrl }: { title: string; subtitle: string; logoDataUrl: string | null }) {
  return (
    <View style={styles.header}>
      <View>
        {logoDataUrl ? <Image src={logoDataUrl} style={styles.logo} /> : <Text style={styles.title}>MAALKA</Text>}
      </View>
      <View>
        <Text style={styles.title}>{title}</Text>
        <Text style={styles.meta}>{subtitle}</Text>
        <Text style={styles.meta}>Édité le {new Date().toLocaleDateString("fr-FR")}</Text>
      </View>
    </View>
  );
}

// ── Liste des réservations ────────────────────────────────────────────────────
function ReservationsListDocument({
  rows,
  subtitle,
  logoDataUrl,
}: {
  rows: ReservationExportRow[];
  subtitle: string;
  logoDataUrl: string | null;
}) {
  const totalCA = rows.reduce((s, r) => s + r.totalPrice, 0);
  const totalDeposit = rows.reduce((s, r) => s + r.depositPaid, 0);
  const totalBalance = rows.reduce((s, r) => s + r.balanceDue, 0);

  return (
    <Document>
      <Page size="A4" orientation="landscape" style={styles.page}>
        <Header title="Liste des réservations" subtitle={subtitle} logoDataUrl={logoDataUrl} />

        <View style={styles.tableHeader}>
          <Text style={{ flex: 2.2 }}>Contrat</Text>
          <Text style={{ flex: 2 }}>Client</Text>
          <Text style={{ flex: 1.4 }}>Réservé le</Text>
          <Text style={{ flex: 2 }}>Période</Text>
          <Text style={{ flex: 2.2 }}>Robes</Text>
          <Text style={{ flex: 1.3 }}>Statut</Text>
          <Text style={{ flex: 1.4, textAlign: "right" }}>Total</Text>
          <Text style={{ flex: 1.4, textAlign: "right" }}>Acompte</Text>
          <Text style={{ flex: 1.4, textAlign: "right" }}>Reste</Text>
        </View>

        {rows.map((r, i) => (
          <View key={`${r.contractNumber}-${i}`} style={styles.tableRow} wrap={false}>
            <Text style={{ flex: 2.2 }}>{r.contractNumber}</Text>
            <Text style={{ flex: 2 }}>{r.clientName}</Text>
            <Text style={{ flex: 1.4 }}>{formatDateFr(r.reservationDate)}</Text>
            <Text style={{ flex: 2 }}>
              {formatDateFr(r.startDate)} → {formatDateFr(r.endDate)}
            </Text>
            <Text style={{ flex: 2.2 }}>{r.dresses}</Text>
            <Text style={{ flex: 1.3 }}>{STATUS_LABELS[r.status] ?? r.status}</Text>
            <Text style={{ flex: 1.4, textAlign: "right" }}>{money(r.totalPrice)}</Text>
            <Text style={{ flex: 1.4, textAlign: "right" }}>{money(r.depositPaid)}</Text>
            <Text style={{ flex: 1.4, textAlign: "right" }}>{money(r.balanceDue)}</Text>
          </View>
        ))}

        <View style={[styles.tableRow, { borderBottomWidth: 0, marginTop: 4 }]}>
          <Text style={{ flex: 9.7, fontWeight: "bold" }}>
            Total ({rows.length} réservation{rows.length > 1 ? "s" : ""})
          </Text>
          <Text style={{ flex: 1.4, textAlign: "right", fontWeight: "bold" }}>{money(totalCA)}</Text>
          <Text style={{ flex: 1.4, textAlign: "right", fontWeight: "bold" }}>{money(totalDeposit)}</Text>
          <Text style={{ flex: 1.4, textAlign: "right", fontWeight: "bold" }}>{money(totalBalance)}</Text>
        </View>

        <Text style={styles.footer} fixed>
          Document généré automatiquement par Maalka.
        </Text>
      </Page>
    </Document>
  );
}

// ── Rapport financier ─────────────────────────────────────────────────────────
const EXPENSE_CATEGORY_LABELS: Record<string, string> = {
  salaires: "Salaires",
  achat_robes: "Achat de robes",
  charges: "Charges",
  autre: "Autre",
};

function FinancesReportDocument({ data, logoDataUrl }: { data: FinancesPageData; logoDataUrl: string | null }) {
  return (
    <Document>
      <Page size="A4" style={styles.page}>
        <Header
          title="Rapport financier"
          subtitle={`Du ${formatDateFr(data.from)} au ${formatDateFr(data.to)}`}
          logoDataUrl={logoDataUrl}
        />

        <View style={styles.kpiGrid}>
          <View style={styles.kpiBox}>
            <Text style={styles.kpiLabel}>CA encaissé</Text>
            <Text style={styles.kpiValue}>{money(data.caEncaisse)}</Text>
          </View>
          <View style={styles.kpiBox}>
            <Text style={styles.kpiLabel}>Acomptes</Text>
            <Text style={styles.kpiValue}>{money(data.acomptes)}</Text>
          </View>
          <View style={styles.kpiBox}>
            <Text style={styles.kpiLabel}>Soldes</Text>
            <Text style={styles.kpiValue}>{money(data.soldes)}</Text>
          </View>
          <View style={styles.kpiBox}>
            <Text style={styles.kpiLabel}>Dépenses</Text>
            <Text style={styles.kpiValue}>{money(data.totalExpenses)}</Text>
          </View>
          <View style={styles.kpiBox}>
            <Text style={styles.kpiLabel}>Bénéfice</Text>
            <Text style={styles.kpiValue}>{money(data.profit)}</Text>
          </View>
        </View>

        <Text style={styles.sectionTitle}>Évolution mensuelle</Text>
        <View style={styles.tableHeader}>
          <Text style={{ flex: 2 }}>Mois</Text>
          <Text style={{ flex: 1.5, textAlign: "right" }}>CA encaissé</Text>
          <Text style={{ flex: 1.5, textAlign: "right" }}>Dépenses</Text>
          <Text style={{ flex: 1.5, textAlign: "right" }}>Bénéfice</Text>
        </View>
        {data.monthlyBuckets.map((b) => (
          <View key={b.key} style={styles.tableRow} wrap={false}>
            <Text style={{ flex: 2 }}>{b.label}</Text>
            <Text style={{ flex: 1.5, textAlign: "right" }}>{money(b.ca)}</Text>
            <Text style={{ flex: 1.5, textAlign: "right" }}>{money(b.expenses)}</Text>
            <Text style={{ flex: 1.5, textAlign: "right" }}>{money(b.ca - b.expenses)}</Text>
          </View>
        ))}

        <Text style={styles.sectionTitle}>Rentabilité par catégorie de robe</Text>
        {data.categoryAnalysis.length === 0 ? (
          <Text>Aucune donnée sur cette période.</Text>
        ) : (
          <>
            <View style={styles.tableHeader}>
              <Text style={{ flex: 3 }}>Catégorie</Text>
              <Text style={{ flex: 1.5, textAlign: "right" }}>Bénéfice</Text>
            </View>
            {data.categoryAnalysis.map((row) => (
              <View key={row.category} style={styles.tableRow} wrap={false}>
                <Text style={{ flex: 3 }}>{row.category}</Text>
                <Text style={{ flex: 1.5, textAlign: "right" }}>{money(row.revenue)}</Text>
              </View>
            ))}
          </>
        )}

        <Text style={styles.sectionTitle}>Dépenses de la période</Text>
        {data.expenses.length === 0 ? (
          <Text>Aucune dépense sur cette période.</Text>
        ) : (
          <>
            <View style={styles.tableHeader}>
              <Text style={{ flex: 1.3 }}>Date</Text>
              <Text style={{ flex: 2 }}>Catégorie</Text>
              <Text style={{ flex: 3.2 }}>Description</Text>
              <Text style={{ flex: 1.5, textAlign: "right" }}>Montant</Text>
            </View>
            {data.expenses.map((e) => (
              <View key={e.id} style={styles.tableRow} wrap={false}>
                <Text style={{ flex: 1.3 }}>{formatDateFr(e.date)}</Text>
                <Text style={{ flex: 2 }}>
                  {EXPENSE_CATEGORY_LABELS[e.category] ?? e.category}
                  {e.dress_category ? ` — ${e.dress_category}` : ""}
                </Text>
                <Text style={{ flex: 3.2 }}>{e.description ?? ""}</Text>
                <Text style={{ flex: 1.5, textAlign: "right" }}>{money(Number(e.amount))}</Text>
              </View>
            ))}
          </>
        )}

        <Text style={styles.footer} fixed>
          Document généré automatiquement par Maalka.
        </Text>
      </Page>
    </Document>
  );
}

export async function generateReservationsListPdf(rows: ReservationExportRow[], subtitle: string) {
  const logoDataUrl = await getLogoDataUrl();
  return renderToBuffer(<ReservationsListDocument rows={rows} subtitle={subtitle} logoDataUrl={logoDataUrl} />);
}

export async function generateFinancesReportPdf(data: FinancesPageData) {
  const logoDataUrl = await getLogoDataUrl();
  return renderToBuffer(<FinancesReportDocument data={data} logoDataUrl={logoDataUrl} />);
}
