// Verinin tamamını tek geçişte çözümler: kolon türleri ve önemleri, ana kolonlar, sektör önerisi, veri sağlığı ve
// göstergeler. Saf fonksiyondur (girdi aynıysa çıktı aynı); internete çıkmaz, veritabanına yazmaz.
import { columnOrder } from "../sources.mjs";
import { analyzeColumns, primaryColumns } from "./columns.mjs";
import { computeKpis } from "./kpi.mjs";
import { assessQuality } from "./quality.mjs";
import { classifySector } from "./sectors.mjs";

export const ANALYSIS_VERSION = 1;

// Arama kutusu ipucu: verideki gerçek kolon adlarından (kimlik, kişi, telefon/plaka).
export function searchColumns(primary) {
  return [primary.id, primary.person, primary.phone || primary.plate].filter(Boolean).slice(0, 3);
}

const slim = item => ({
  column: item.column,
  role: item.role,
  kind: item.kind ?? null,
  confidence: item.confidence,
  verified: item.verified,
  validRate: item.validRate ?? null,
  currency: item.currency ?? null,
  importance: item.importance,
  fill: item.stats.fill,
  filled: item.stats.nonEmpty,
  uniqueness: item.stats.uniqueness,
  values: item.role === "status" || item.role === "category" ? (item.values || []).slice(0, 6) : undefined,
});

/**
 * @param {{ rows: Array<Record<string,string>>, label?: string, tabs?: string[], now?: Date }} input
 */
export function analyzeDataset({ rows, label = "", tabs = [], now = new Date() }) {
  const started = performance.now();
  const data = Array.isArray(rows) ? rows : [];
  const columns = columnOrder(data);
  const analyses = analyzeColumns(data, columns);
  const primary = primaryColumns(analyses);
  const sector = classifySector({ analyses, rows: data, label, tabs });
  const quality = assessQuality(data, analyses, primary);
  const kpis = computeKpis(data, analyses, primary, { now });
  const order = analyses
    .filter(item => item.role !== "empty" && item.role !== "sequence")
    .slice()
    .sort((a, b) => b.importance - a.importance || columns.indexOf(a.column) - columns.indexOf(b.column))
    .map(item => item.column);
  return {
    version: ANALYSIS_VERSION,
    generatedAt: now.toISOString(),
    ms: Math.round(performance.now() - started),
    rowCount: data.length,
    columnCount: columns.length,
    tabs,
    columns: analyses.map(slim),
    order,
    primary,
    search: searchColumns(primary),
    sector,
    quality,
    kpis,
  };
}
