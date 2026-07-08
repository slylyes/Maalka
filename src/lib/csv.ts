"use client";

/**
 * Génère et télécharge un fichier CSV côté navigateur.
 * Format compatible Excel fr : BOM UTF-8 + séparateur point-virgule.
 */
export function downloadCsv(
  filename: string,
  headers: string[],
  rows: (string | number | null | undefined)[][]
) {
  const escapeCell = (value: string | number | null | undefined) => {
    const text = value === null || value === undefined ? "" : String(value);
    return `"${text.replace(/"/g, '""')}"`;
  };

  const content =
    "\uFEFF" +
    [headers, ...rows].map((row) => row.map(escapeCell).join(";")).join("\r\n");

  const blob = new Blob([content], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}
