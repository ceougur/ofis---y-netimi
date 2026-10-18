// Önce/sonra karşılaştırma tablosu (Markdown). Kullanım: node karsilastir.mjs <klasör> <etiket...>  (ör. tam once sonra cekirdek)
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
const [dir, ...labels] = process.argv.slice(2);
const load = (label, level) => { const file = path.join(dir, `sonuc-${label}-${level}.json`); return existsSync(file) ? JSON.parse(readFileSync(file, "utf8")) : null; };
const fmt = n => (n === null || n === undefined ? "—" : Number(n).toLocaleString("tr-TR"));
const out = [];
for (const level of ["D1", "D2"]) {
  const runs = labels.map(label => [label, load(label, level)]).filter(([, r]) => r);
  if (!runs.length) continue;
  out.push(`\n### ${level} (${runs[0][1].ekran} ekran + ${runs[0][1].api} API, ${runs[0][1].sureSn} sn)\n`);
  out.push(`| Ölçü | ${runs.map(([l]) => l).join(" | ")} |`);
  out.push(`|---|${runs.map(() => "---").join("|")}|`);
  const row = (name, fn) => out.push(`| ${name} | ${runs.map(([, r]) => { try { return fn(r); } catch { return "—"; } }).join(" | ")} |`);
  row("Belge (koşuda yazılan)", r => fmt(r.belge));
  row("Doğruluk denetimi geçti / kaldı", r => `${r.gecti} / ${r.kaldi}`);
  row("Ekran hata / API hata / karakter kaybı / sayfa hatası", r => `${r.issues.ekranHata.length} / ${r.issues.apiHata.length} / ${r.issues.karakterKaybi.length} / ${r.issues.sayfaHata.length}`);
  row("Sunucu CPU ort / en çok (%)", r => `${r.sunucu.cpuOrt} / ${r.sunucu.cpuMax}`);
  row("Olay döngüsü p99 en çok (ms)", r => fmt(r.sunucu.donguP99Max));
  const ag = r => r.ag || {};
  const total = r => Object.values(ag(r)).reduce((s, v) => s + v.n, 0);
  row("Tarayıcı API isteği toplam (adet)", r => fmt(total(r)));
  for (const ep of ["GET /api/workspace/stock/alerts", "POST /api/workspace/invoices/calc", "GET /api/workspace/dues", "GET /api/workspace/invoices", "GET /api/workspace/tasks", "GET /api/workspace/cheques", "GET /api/workspace/bank/badge"]) {
    row(`${ep} adet · p50/p95 ms`, r => (ag(r)[ep] ? `${fmt(ag(r)[ep].n)} · ${fmt(ag(r)[ep].p50)}/${fmt(ag(r)[ep].p95)}` : "0"));
  }
  row("Takvim (dues) yanıt baytı toplam (MB)", r => (r.agBayt ? (r.agBayt["GET /api/workspace/dues"] / 1e6).toFixed(1) : "—"));
  row("Bütün API yanıt baytı toplam (MB)", r => (r.agBayt ? (Object.values(r.agBayt).reduce((s, v) => s + v, 0) / 1e6).toFixed(1) : "—"));
  for (const op of ["Liste açılışı (menü → satırlar)", "Cari arama (son tuş → liste)", "Ürün arama (son tuş → liste)", "Toplam güncellenmesi (Tab → Genel Toplam)", "Kaydet ve Gönder → kart", "Liste arama (Enter → sonuç)", "Daha Fazla Göster (sayfa çevirme)", "Form açılışı (senaryo tık → form hazır)", "Fatura kartı açılışı", "PDF açılışı (indirme tamam)", "Rapor açılışı (Satış Faturaları, Bu Yıl)"]) {
    row(`Ekran: ${op} p50/p95 ms (n)`, r => (r.ekranOlcum[op] ? `${fmt(r.ekranOlcum[op].p50)}/${fmt(r.ekranOlcum[op].p95)} (${r.ekranOlcum[op].n})` : "—"));
  }
  row("Düzen kayması (CLS) pencere başına en az–en çok", r => { const v = Object.values(r.tarayici).filter(Boolean).map(p => p.cls); return `${Math.min(...v).toFixed(2)}–${Math.max(...v).toFixed(2)}`; });
  row("CLS içinde Fatura/diğer pencere kayması (section.hof-modal) toplam", r => Object.values(r.tarayici).filter(Boolean).reduce((s, p) => s + Object.entries(p.clsBy || {}).filter(([k]) => k.startsWith("section.hof-modal")).reduce((a, [, v]) => a + v, 0), 0).toFixed(2));
  row("30 sn bekleme aşımı (ekran)", r => r.issues.ekranHata.filter(e => /Timeout 30000ms/.test(e)).length);
}
console.log(out.join("\n"));
