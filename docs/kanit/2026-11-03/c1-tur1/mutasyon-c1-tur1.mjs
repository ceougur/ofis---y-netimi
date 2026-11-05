// C1 TUR 1 mutasyon kanıtı (ders 7): her düzeltme tek tek geri alınır (ayrı kopyada — ders 23), test/c1-tur1-249.test.mjs koşulur; beklenen test
// BEKLENEN NEDENLE kırmızı olmalı (ders 38). Kullanım: node mutasyon-c1-tur1.mjs <fe5bcf27 / 16a80a7d kopyasının kökü> (M9–M10 yalnız 16a80a7d'de uygulanır). Çıkış 0 = her mutasyon yakalandı.
import { spawnSync } from "node:child_process";
import { readFileSync, writeFileSync } from "node:fs";
import path from "node:path";

const root = path.resolve(process.argv[2] || ".");
const MUTATIONS = [
  { ad: "M1 H14: POS taraması yeniden her satırsız başlıkta", dosya: "server/lib/account-movements.mjs", eski: "(+e.type = 'pos_cancel_refund' AND EXISTS (SELECT 1 FROM pos_sales s WHERE s.event_id = e.id))", yeni: "EXISTS (SELECT 1 FROM pos_sales s WHERE s.event_id = e.id)", beklenen: "E2", neden: /masraf başlığı \(fee\) POS kaydı taşısa da banka fişi sayılmaz/ },
  { ad: "M2 H14: yanlış tür adı (pos_refund)", dosya: "server/lib/account-movements.mjs", eski: "+e.type = 'pos_cancel_refund' AND", yeni: "+e.type = 'pos_refund' AND", beklenen: "E1", neden: /banka fişi sayısı eski tanımla aynı/ },
  { ad: "M3 detail withRemaining:false yine silme engeli hesaplar", dosya: "server/routes/accounts.mjs", eski: "deleteBlock: manage && withRemaining ? deleteBlock(account)", yeni: "deleteBlock: manage ? deleteBlock(account)", beklenen: "E3", neden: /hareket sayacı\) hesaplamamalı/ },
  { ad: "M4 kart tahsilatı/iadesi: prepare'de kart denetimi yok", dosya: "server/routes/plans.mjs", eski: "      prepare: () => {\n        assertPlanLive(plan.id);\n        // K8 (2.3.0)", yeni: "      prepare: () => {\n        // K8 (2.3.0)", beklenen: "Y1", neden: /silinmiş karta yazılmamalı/ },
  { ad: "M5 tahsilat düzeltme: prepare'de kart denetimi yok", dosya: "server/routes/plans.mjs", eski: "      prepare: () => {\n        assertPlanLive(plan.id);\n        if (previous.kind", yeni: "      prepare: () => {\n        if (previous.kind", beklenen: "Y2", neden: /silinmiş karta yazılmamalı/ },
  { ad: "M6 taksit ekleme: işlemde kart denetimi yok", dosya: "server/routes/plans.mjs", eski: "    store.tx(() => {\n      assertPlanLive(plan.id);\n      const seq", yeni: "    store.tx(() => {\n      const seq", beklenen: "Y3", neden: /silinmiş karta yazılmamalı/ },
  { ad: "M7 taksit düzeltme: işlemde kart denetimi yok", dosya: "server/routes/plans.mjs", eski: "    store.tx(() => {\n      assertPlanLive(plan.id);\n      store.run(\"UPDATE plan_items", yeni: "    store.tx(() => {\n      store.run(\"UPDATE plan_items", beklenen: "Y4", neden: /silinmiş karta yazılmamalı/ },
  { ad: "M8 Silinenler cari notu eski metin", dosya: "server/routes/accounts.mjs", eski: 'note: "Cari listesine geri döner.",', yeni: 'note: "Hareketleriyle Cari listesine geri döner; Kasa yeniden hesaplanır.",', beklenen: "D3", neden: /Hareketleriyle Cari listesine/ },
  { ad: "M9 stok satışı: prepare'de ürün denetimi yok", dosya: "server/routes/stock.mjs", eski: "    const prepare = () => {\n      itemRow(item.id);\n      assertAvailable", yeni: "    const prepare = () => {\n      assertAvailable", beklenen: "S1", neden: /silinmiş ürüne yazılmamalı/ },
  { ad: "M10 stok düzeltme: prepare'de ürün denetimi yok", dosya: "server/routes/stock.mjs", eski: "      prepare: () => {\n        itemRow(item.id);\n      },\n", yeni: "", beklenen: "S2", neden: /silinmiş ürüne yazılmamalı/ },
];

const results = [];
for (const m of MUTATIONS) {
  const file = path.join(root, m.dosya);
  const original = readFileSync(file, "utf8");
  const count = original.split(m.eski).length - 1;
  if (count !== 1) {
    results.push({ ad: m.ad, sonuc: "UYGULANAMADI", neden: `eski metin ${count} kez` });
    continue;
  }
  writeFileSync(file, original.replace(m.eski, m.yeni));
  try {
    const run = spawnSync(process.execPath, ["--disable-warning=ExperimentalWarning", "--test", "--test-reporter=spec", "test/c1-tur1-249.test.mjs"], { cwd: root, encoding: "utf8", env: { ...process.env, HUKUK_LICENSE_URL: "http://127.0.0.1:9" }, timeout: 600_000 });
    const text = `${run.stdout || ""}${run.stderr || ""}`;
    const failed = [...text.matchAll(/^\s*✖ (Y\d|D\d|E\d|S\d)\b/gm)].map(match => match[1]);
    const unique = [...new Set(failed)];
    const caught = run.status !== 0 && unique.includes(m.beklenen) && m.neden.test(text);
    results.push({ ad: m.ad, dosya: m.dosya, cikis: run.status, kirmizi: unique, beklenen: m.beklenen, nedenGorundu: m.neden.test(text), sonuc: caught ? "YAKALANDI" : "KAÇTI" });
  } finally {
    writeFileSync(file, original);
  }
}
// Kopya geri yüklendi mi (sonraki koşu için): her dosya mutasyonsuz.
for (const m of MUTATIONS) if (readFileSync(path.join(root, m.dosya), "utf8").split(m.eski).length - 1 !== 1) results.push({ ad: `${m.ad} (geri yükleme)`, sonuc: "GERİ YÜKLENMEDİ" });
for (const row of results) console.log(`${row.sonuc}\t${row.ad}\tkırmızı: ${(row.kirmizi || []).join(",") || "-"}\tbeklenen: ${row.beklenen || "-"}\tneden: ${row.nedenGorundu ?? "-"}`);
const caught = results.filter(row => row.sonuc === "YAKALANDI").length;
console.log(`# tests ${MUTATIONS.length}\n# pass ${caught}\n# fail ${results.length - caught}`);
console.log(JSON.stringify(results));
process.exit(caught === MUTATIONS.length && results.length === MUTATIONS.length ? 0 : 1);
