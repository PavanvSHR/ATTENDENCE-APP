/**
 * Generic, attendance-agnostic export helpers for tabular data.
 * Consumers (e.g. src/features/reports) build a `TabularData` shape from
 * whatever domain objects they have and hand it to these functions —
 * nothing here knows about students, sessions, or attendance.
 */
import { unparse } from "papaparse";
import * as XLSX from "xlsx";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

export interface TabularData {
  headers: string[];
  rows: (string | number)[][];
}

/** Triggers a browser download for a Blob with the given filename. */
function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

/** Exports tabular data as a downloaded .csv file. */
export function exportToCsv(filename: string, data: TabularData): void {
  const csv = unparse({ fields: data.headers, data: data.rows });
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  downloadBlob(blob, filename.endsWith(".csv") ? filename : `${filename}.csv`);
}

/** Exports tabular data as a downloaded .xlsx workbook. */
export function exportToXlsx(filename: string, data: TabularData): void {
  const worksheet = XLSX.utils.aoa_to_sheet([data.headers, ...data.rows]);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, "Sheet1");
  XLSX.writeFile(workbook, filename.endsWith(".xlsx") ? filename : `${filename}.xlsx`);
}

/** Exports tabular data as a downloaded .pdf with a title and an auto-generated table. */
export function exportToPdf(filename: string, title: string, data: TabularData): void {
  const doc = new jsPDF({ orientation: data.headers.length > 6 ? "landscape" : "portrait" });
  doc.setFontSize(14);
  doc.text(title, 14, 15);
  autoTable(doc, {
    head: [data.headers],
    body: data.rows,
    startY: 20,
    styles: { fontSize: 8 },
    headStyles: { fillColor: [30, 41, 59] },
  });
  doc.save(filename.endsWith(".pdf") ? filename : `${filename}.pdf`);
}
