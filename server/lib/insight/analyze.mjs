// Verinin tamamını çözümler: kolon türleri ve önemleri, ana kolonlar, sektör önerisi, veri sağlığı ve göstergeler.
// Saf fonksiyondur (girdi aynıysa çıktı aynı); internete çıkmaz, veritabanına yazmaz.
//
// v1.7.0: sektör önerisi ve arama ipucu tüm veriden; kartlar ve veri sağlığı her sekme için o sekmenin kendi
// kolonlarından (kpi.mjs). Kartlar hücre hücre doğrulanır (cards.mjs); doğrulanamayan kart gösterilmez, nedeni yazılır.
import { columnOrder } from "../sources.mjs";
import { isTotalRow } from "./cells.mjs";
import { analyzeColumns, primaryColumns } from "./columns.mjs";
import { computeKpis } from "./kpi.mjs";
import { recordTitle } from "./quality.mjs";
import { reasonAbout } from "./reasoning.mjs";
import { classifySector } from "./sectors.mjs";

export const ANALYSIS_VERSION = 3;

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
  warning: item.warning ?? null,
  forced: item.forced ?? null,
  ignored: Boolean(item.ignored),
  evidence: item.evidence || [],
  certainty: item.certainty || "belirsiz",
  inferred: item.inferred || null,
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
export function analyzeDataset({ rows, label = "", tabs = [], now = new Date(), sectors = [], forced = null }) {
  const started = performance.now();
  const data = Array.isArray(rows) ? rows : [];
  const columns = columnOrder(data);
  // Toplam/ara toplam satırları kayıt değildir: kolon türünü ("Sıra" 1, 2, 3 … ile "Ara toplam" karışmasın) ve sektörü
  // gövde satırları belirler; satırların kendisi görünümde kalır.
  const body = data.filter(row => !isTotalRow(row));
  const sample = body.length ? body : data;
  const analyses = analyzeColumns(sample, columns, { now, forced });
  const primary = primaryColumns(analyses);
  const sector = classifySector({ analyses, rows: sample, label, tabs, extra: sectors });
  const kpis = computeKpis(data, { tabs, now, forced });
  const { quality, ...indicators } = kpis;
  // Mantık denetimi (v2.0.1): verinin kendi kurallarını öğrenir, uymayan kayıtları bulur (reasoning.mjs).
  const reasoning = reasonAbout(data, { tabs, now, titleOf: row => recordTitle(row, primary), forced });
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
    reasoning,
    kpis: indicators,
  };
}
