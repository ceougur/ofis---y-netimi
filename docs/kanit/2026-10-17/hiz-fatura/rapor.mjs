// sonuc-*.json → tablo bölümleri (RAPOR.md'nin sayısal kısmı). Kullanım: node rapor.mjs <klasör> D1 D2 D3 > tablolar.md
import { readFileSync, existsSync } from "node:fs";
import path from "node:path";
const [dir, ...levels] = process.argv.slice(2);
const USERS = { D1: [5, 0], D2: [8, 2], D3: [5, 15] };
const R = Object.fromEntries(levels.filter(l => existsSync(path.join(dir, `sonuc-${l}.json`))).map(l => { const r = JSON.parse(readFileSync(path.join(dir, `sonuc-${l}.json`), "utf8")); if (!r.ekranOlcum) { r.ekranOlcum = r.ekran; r.apiOlcum = r.api; } r.ekran_n = USERS[l]?.[0]; r.api_n = USERS[l]?.[1]; return [l, r]; }));
const L = Object.keys(R);
const out = [];
const f = v => (v === null || v === undefined ? "—" : String(v));
const cell = s => (s ? `${f(s.p50)} / ${f(s.p95)} / ${f(s.p99)} / ${f(s.max)} (n=${s.n})` : "—");
out.push(`| Düzey | Ekran | API | Süre (sn) | Belge | Belge/dk | Belge/sn | Ekran hata | API beklenmeyen hata | Karakter kaybı | Sayfa (JS) hatası | Denetim |`);
out.push(`|---|---|---|---|---|---|---|---|---|---|---|---|`);
for (const l of L) { const r = R[l]; out.push(`| ${l} | ${r.ekran_n ?? levelsOf(r).ekran} | ${r.api_n ?? levelsOf(r).api} | ${r.sureSn} | ${r.belge} (${Object.entries(r.belgeKaynak).map(([k, v]) => `${k} ${v}`).join(", ")}) | ${r.belgeDakikada} | ${r.belgeSaniyede} | ${r.issues.ekranHata.length} | ${r.issues.apiHata.length} | ${r.issues.karakterKaybi.length} | ${r.issues.sayfaHata.length} | ${r.gecti} geçti / ${r.kaldi} kaldı |`); }
function levelsOf(r) { return { ekran: typeof r.ekran === "number" ? r.ekran : "?", api: typeof r.api === "number" ? r.api : "?" }; }
out.push("");
out.push("### Kullanıcının ekranda gördüğü süre (ms) — p50 / p95 / p99 / en çok (adet)");
const ekranKinds = [...new Set(L.flatMap(l => Object.keys(R[l].ekranOlcum || {})))];
out.push(`| İşlem | ${L.join(" | ")} |`);
out.push(`|---|${L.map(() => "---").join("|")}|`);
for (const k of ekranKinds) out.push(`| ${k} | ${L.map(l => cell(R[l].ekranOlcum?.[k])).join(" | ")} |`);
out.push("");
out.push("### Tarayıcının ağdan gördüğü istek süresi (ms, istek → yanıt sonu) — p50 / p95 / p99 / en çok (adet); en sık 25 uç");
const netKinds = [...new Set(L.flatMap(l => Object.entries(R[l].ag).sort((a, b) => b[1].n - a[1].n).slice(0, 25).map(([k]) => k)))];
out.push(`| Uç | ${L.join(" | ")} |`);
out.push(`|---|${L.map(() => "---").join("|")}|`);
for (const k of netKinds) out.push(`| \`${k}\` | ${L.map(l => cell(R[l].ag[k])).join(" | ")} |`);
out.push("");
out.push("### API yük üreticisinin gördüğü süre (ms, HTTP gidiş-dönüş) — p50 / p95 / p99 / en çok (adet) · durum kodları");
const apiKinds = [...new Set(L.flatMap(l => Object.keys(R[l].apiOlcum || {})))];
out.push(`| İşlem | ${L.join(" | ")} |`);
out.push(`|---|${L.map(() => "---").join("|")}|`);
for (const k of apiKinds) out.push(`| ${k} | ${L.map(l => { const s = R[l].apiOlcum?.[k]; return s ? `${cell(s)} ${Object.entries(s.durum).map(([c, n]) => `${c}:${n}`).join(" ")}` : "—"; }).join(" | ")} |`);
out.push("");
out.push("### Sunucu süreci (15 sn'lik örnekler) ve makine");
out.push(`| Düzey | CPU ort. % (1 çekirdek = 100) | CPU en çok % | RSS en çok MB | Olay döngüsü p99 en çok (ms) | Olay döngüsü en çok (ms) | load1 en çok (4 çekirdek) | Boş bellek en az MB |`);
out.push(`|---|---|---|---|---|---|---|---|`);
for (const l of L) { const s = R[l].sunucu; out.push(`| ${l} | ${s.cpuOrt} | ${s.cpuMax} | ${s.rssMax} | ${s.donguP99Max} | ${s.donguMax} | ${s.load1Max} | ${Math.min(...s.ornek.map(x => x.memAvailMB))} |`); }
out.push("");
out.push("### Tarayıcı (pencere başına, koşu boyunca): uzun görev toplamı / adedi / en uzun (ms), layout-shift (CLS)");
for (const l of L) out.push(`- ${l}: ${Object.entries(R[l].tarayici).map(([u, p]) => (p ? `${u} ${Math.round(p.longSum)}/${p.longN}/${Math.round(p.longMax)} CLS ${p.cls.toFixed(4)}` : `${u} okunamadı`)).join(" · ")}`);
out.push("");
out.push("### Doğruluk denetimleri");
for (const l of L) { out.push(`**${l}**`); for (const c of R[l].checks) out.push(`- ${c.ok ? "✓" : "✗"} ${c.what}`); out.push(""); }
out.push("### Hata kayıtları (ilk 15)");
for (const l of L) { const i = R[l].issues; out.push(`**${l}** ekran: ${i.ekranHata.slice(0, 15).map(x => `\`${x.replace(/`/g, "'")}\``).join("; ") || "yok"} · API: ${i.apiHata.slice(0, 15).map(x => `\`${x.replace(/`/g, "'")}\``).join("; ") || "yok"} · karakter kaybı: ${i.karakterKaybi.slice(0, 5).join("; ") || "yok"} · sayfa hatası: ${i.sayfaHata.slice(0, 5).join("; ") || "yok"}`); out.push(""); }
out.push("### Belge durumu dağılımı (koşuda yazılanlar: tür/profil/durum/e-durum)");
for (const l of L) out.push(`- ${l}: ${Object.entries(R[l].eDagilim).map(([k, v]) => `${k} ${v}`).join(", ")}`);
console.log(out.join("\n"));
