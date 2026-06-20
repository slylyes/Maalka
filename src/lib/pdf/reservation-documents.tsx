import { readFile } from "node:fs/promises";
import path from "node:path";

import { Document, Image, Page, Text, View, StyleSheet, renderToBuffer } from "@react-pdf/renderer";

/* eslint-disable jsx-a11y/alt-text */

type ReservationPdfData = {
  contractNumber: string;
  startDate: string;
  endDate: string;
  status: string;
  baseTotal: number;
  totalPrice: number;
  discountAmount: number;
  supplement: number;
  depositPaid: number;
  balanceDue: number;
  cautionAmount: number;
  cautionStatus: string;
  dressItems: Array<{
    reference: string;
    name?: string | null;
    basePrice: number;
    discountAmount: number;
    price: number;
  }>;
  clientFirstName: string;
  clientLastName: string;
  clientPhone: string;
  clientEmail?: string | null;
  clientAddress?: string | null;
  notes?: string | null;
};

const styles = StyleSheet.create({
  page: {
    padding: 30,
    fontSize: 11,
    fontFamily: "Helvetica",
    color: "#2f2b25",
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 14,
    borderBottomWidth: 1,
    borderBottomColor: "#e9e2d4",
    paddingBottom: 10,
  },
  logo: {
    width: 130,
    height: 56,
  },
  title: {
    fontSize: 17,
    fontWeight: "bold",
  },
  meta: {
    fontSize: 10,
    color: "#6f675b",
    textAlign: "right",
  },
  section: {
    marginBottom: 12,
    padding: 10,
    borderWidth: 1,
    borderColor: "#e9e2d4",
    borderRadius: 6,
    backgroundColor: "#fffdfa",
  },
  sectionTitle: {
    fontSize: 11,
    fontWeight: "bold",
    marginBottom: 6,
    color: "#9f7e4e",
    textTransform: "uppercase",
    letterSpacing: 0.4,
  },
  split: {
    flexDirection: "row",
    gap: 10,
    marginBottom: 10,
  },
  col: {
    flex: 1,
  },
  contractInfo: {
    marginTop: 2,
    fontSize: 10,
    color: "#6f675b",
  },
  row: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 5,
  },
  tableHeader: {
    flexDirection: "row",
    borderBottomWidth: 1,
    borderBottomColor: "#e9e2d4",
    paddingBottom: 4,
    marginBottom: 6,
    fontWeight: "bold",
  },
  cellLabel: {
    flex: 2,
  },
  cellValue: {
    flex: 1,
    textAlign: "right",
  },
  legal: {
    marginTop: 10,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: "#e9e2d4",
    fontSize: 9,
    color: "#6f675b",
    lineHeight: 1.4,
  },
  signatures: {
    marginTop: 14,
    flexDirection: "row",
    gap: 12,
  },
  signatureBox: {
    flex: 1,
    minHeight: 78,
    borderWidth: 1,
    borderColor: "#e9e2d4",
    borderRadius: 6,
    padding: 8,
    justifyContent: "space-between",
  },
  signatureLabel: {
    fontSize: 10,
    fontWeight: "bold",
  },
  signatureLine: {
    marginTop: 22,
    paddingTop: 3,
    borderBottomWidth: 1,
    borderBottomColor: "#c5a065",
  },
  footer: {
    marginTop: 10,
    fontSize: 9,
    color: "#6f675b",
    textAlign: "center",
  },
  label: {
    fontWeight: "bold",
  },
  muted: {
    color: "#4b5563",
  },
});

function Money({ value }: { value: number }) {
  return <Text>{value.toFixed(2)} DA</Text>;
}

function formatDateFr(value: string) {
  const [year, month, day] = value.split("-");
  if (!year || !month || !day) return value;
  return `${day}-${month}-${year}`;
}

function cautionStatusLabel(value: string) {
  switch (value) {
    case "pending":
      return "En attente";
    case "received":
      return "Reçue";
    case "not_required":
      return "Pas de caution";
    case "returned":
      return "Rendue";
    case "retained":
      return "Retenue";
    default:
      return value;
  }
}

function Header({ title, contractNumber, logoDataUrl }: { title: string; contractNumber: string; logoDataUrl: string | null }) {
  return (
    <View style={styles.header}>
      <View>
        {logoDataUrl ? (
          <Image src={logoDataUrl} style={styles.logo} />
        ) : (
          <Text style={styles.title}>MAALKA</Text>
        )}
        <Text style={styles.contractInfo}>Location de robes de mariage</Text>
      </View>
      <View>
        <Text style={styles.title}>{title}</Text>
        <Text style={styles.meta}>Réf: {contractNumber}</Text>
        <Text style={styles.meta}>Date: {new Date().toLocaleDateString("fr-FR")}</Text>
      </View>
    </View>
  );
}

function ContractDocument({ data, logoDataUrl }: { data: ReservationPdfData; logoDataUrl: string | null }) {
  const dressesLabel = data.dressItems
    .map((item) => (item.name ? `${item.reference} - ${item.name}` : item.reference))
    .join(", ");

  return (
    <Document>
      <Page size="A4" style={styles.page}>
        <Header title="Contrat de location" contractNumber={data.contractNumber} logoDataUrl={logoDataUrl} />

        <View style={styles.split}>
          <View style={[styles.section, styles.col]}>
            <Text style={styles.sectionTitle}>Client</Text>
            <Text>
              {data.clientFirstName} {data.clientLastName}
            </Text>
            <Text>Téléphone: {data.clientPhone}</Text>
            {data.clientEmail ? <Text>Email: {data.clientEmail}</Text> : null}
            {data.clientAddress ? <Text>Adresse: {data.clientAddress}</Text> : null}
          </View>

          <View style={[styles.section, styles.col]}>
            <Text style={styles.sectionTitle}>Location</Text>
            <Text>Robes: {dressesLabel || "-"}</Text>
            <Text>
              Période: {formatDateFr(data.startDate)} au {formatDateFr(data.endDate)}
            </Text>
            <Text>Statut: {data.status}</Text>
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Paiements</Text>
          <View style={styles.row}>
            <Text>Sous-total</Text>
            <Money value={data.baseTotal} />
          </View>
          {data.discountAmount > 0 ? (
            <View style={styles.row}>
              <Text>Remise</Text>
              <Money value={data.discountAmount} />
            </View>
          ) : null}
          {data.supplement > 0 ? (
            <View style={styles.row}>
              <Text>Supplément</Text>
              <Money value={data.supplement} />
            </View>
          ) : null}
          <View style={styles.row}>
            <Text>Prix total</Text>
            <Money value={data.totalPrice} />
          </View>
          <View style={styles.row}>
            <Text>Acompte payé</Text>
            <Money value={data.depositPaid} />
          </View>
          <View style={styles.row}>
            <Text>Reste à payer</Text>
            <Money value={data.balanceDue} />
          </View>
          <View style={styles.row}>
            <Text>Caution</Text>
            <Money value={data.cautionAmount} />
          </View>
          <Text>Statut caution: {cautionStatusLabel(data.cautionStatus)}</Text>
        </View>

        {data.notes ? (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Notes</Text>
            <Text style={styles.muted}>{data.notes}</Text>
          </View>
        ) : null}

        <Text style={styles.legal}>
          Conditions générales: le locataire s&apos;engage à restituer la robe dans l&apos;état initial à la date convenue.
          Toute dégradation peut entraîner une retenue partielle ou totale de la caution. Les montants et dates figurant
          sur ce document font foi.
        </Text>

        <View style={styles.signatures}>
          <View style={styles.signatureBox}>
            <Text style={styles.signatureLabel}>Signature Maalka</Text>
            <Text style={styles.signatureLine}> </Text>
          </View>
          <View style={styles.signatureBox}>
            <Text style={styles.signatureLabel}>Signature cliente</Text>
            <Text style={styles.signatureLine}> </Text>
          </View>
        </View>

        <Text style={styles.footer}>Document généré automatiquement par Maalka.</Text>
      </Page>
    </Document>
  );
}

function InvoiceDocument({ data, logoDataUrl }: { data: ReservationPdfData; logoDataUrl: string | null }) {
  const dressesLabel = data.dressItems
    .map((item) => (item.name ? `${item.reference} - ${item.name}` : item.reference))
    .join(", ");

  return (
    <Document>
      <Page size="A4" style={styles.page}>
        <Header title="Facture" contractNumber={data.contractNumber} logoDataUrl={logoDataUrl} />

        <View style={styles.split}>
          <View style={[styles.section, styles.col]}>
            <Text style={styles.sectionTitle}>Client</Text>
            <Text>
              {data.clientFirstName} {data.clientLastName}
            </Text>
            <Text>Téléphone: {data.clientPhone}</Text>
            {data.clientEmail ? <Text>Email: {data.clientEmail}</Text> : null}
          </View>

          <View style={[styles.section, styles.col]}>
            <Text style={styles.sectionTitle}>Location</Text>
            <Text>
              {formatDateFr(data.startDate)} au {formatDateFr(data.endDate)}
            </Text>
            <Text>{dressesLabel || "-"}</Text>
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Détail facture</Text>
          <View style={styles.tableHeader}>
            <Text style={styles.cellLabel}>Désignation</Text>
            <Text style={styles.cellValue}>Montant</Text>
          </View>
          {data.dressItems.length ? (
            data.dressItems.map((item, index) => (
              <View key={`${item.reference}-${index}`}>
                <Text>
                  Robe {item.reference}
                  {item.name ? ` - ${item.name}` : ""}
                </Text>
                <View style={styles.row}>
                  <Text>Prix</Text>
                  <Money value={item.basePrice} />
                </View>
              </View>
            ))
          ) : (
            <Text>Aucune robe associée.</Text>
          )}
          <View style={styles.row}>
            <Text>Sous-total</Text>
            <Money value={data.baseTotal} />
          </View>
          {data.discountAmount > 0 ? (
            <View style={styles.row}>
              <Text>Remise</Text>
              <Money value={data.discountAmount} />
            </View>
          ) : null}
          {data.supplement > 0 ? (
            <View style={styles.row}>
              <Text>Supplément</Text>
              <Money value={data.supplement} />
            </View>
          ) : null}
          <View style={styles.row}>
            <Text>Acompte</Text>
            <Money value={data.depositPaid} />
          </View>
          <View style={styles.row}>
            <Text>Reste à payer</Text>
            <Money value={data.balanceDue} />
          </View>
          <View style={styles.row}>
            <Text>Statut caution</Text>
            <Text>{cautionStatusLabel(data.cautionStatus)}</Text>
          </View>
          <View style={styles.row}>
            <Text>Total</Text>
            <Money value={data.totalPrice} />
          </View>
        </View>

        <Text style={styles.legal}>
          Merci pour votre confiance. Cette facture est éditée pour usage interne et preuve de transaction entre Maalka et
          la cliente.
        </Text>

        <View style={styles.signatures}>
          <View style={styles.signatureBox}>
            <Text style={styles.signatureLabel}>Cachet et signature Maalka</Text>
            <Text style={styles.signatureLine}> </Text>
          </View>
          <View style={styles.signatureBox}>
            <Text style={styles.signatureLabel}>Signature cliente</Text>
            <Text style={styles.signatureLine}> </Text>
          </View>
        </View>

        <Text style={styles.footer}>Facture générée automatiquement par Maalka.</Text>
      </Page>
    </Document>
  );
}

let logoDataUrlCache: string | null = null;

async function getLogoDataUrl() {
  if (logoDataUrlCache) {
    return logoDataUrlCache;
  }

  try {
    const filePath = path.join(process.cwd(), "public", "maalka_logo.png");
    const image = await readFile(filePath);
    logoDataUrlCache = `data:image/png;base64,${image.toString("base64")}`;
    return logoDataUrlCache;
  } catch {
    return null;
  }
}

export async function generateContractPdf(data: ReservationPdfData) {
  const logoDataUrl = await getLogoDataUrl();
  return renderToBuffer(<ContractDocument data={data} logoDataUrl={logoDataUrl} />);
}

export async function generateInvoicePdf(data: ReservationPdfData) {
  const logoDataUrl = await getLogoDataUrl();
  return renderToBuffer(<InvoiceDocument data={data} logoDataUrl={logoDataUrl} />);
}

export type { ReservationPdfData };
