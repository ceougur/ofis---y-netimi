#!/usr/bin/env node
// 2.4.7 — Maliyet Hesap Kartı şablon yükseltmesinin ESKİ SÜRÜMÜN GERÇEK VERİSİYLE denenmesi (CLAUDE.md test kuralı: test verisi programın kendisinin
// ürettiği veridir; ders 17, 23). Elle koşulur (npm test'te değil; v2.4.6 etiketi gerekir — CI sığ klonda etiket yok):
//   node test/maliyet-sablon-247-eski-surum.mjs
// Eski kod test/guvenilirlik/surumler.mjs ile `git archive` kopyasından açılır (çalışma ağacına girmez).
// Adımlar: (1) v2.4.6'nın GERÇEK kodu: sektör Duşakabin Üretimi → kart açılır (şablon kurulur: KDV/18 18, %20 Maliyet 20, Masraf% 11–17, %15 Maliyet 15);
// kullanıcı Cam 100X100 Köşe Kabin'e fiyat yazıp KAYDEDER (oranlara dokunmadan — 18 / 20 kalır), Mika 170'in oranını 14 yapıp kaydeder.
// (2) Aynı veri klasörü bu dalın koduyla açılır: hiç kaydedilmemiş kartlarda oranlar boş, etiketler "KDV" / "Maliyet" / "Toplam"; kaydedilmiş iki kart
// AYNEN (18 / 20, 14 / 15, eski etiketler, fiyatlar); rev'ler değişmez. (3) Eski sürüme dönüş: v2.4.6 aynı dosyayı açar, boş oranı 0 sayar (hata yok).
// Ders 30: HUKUK_LICENSE_URL=http://127.0.0.1:9. Çıkış 0 = bütün denetimler geçti; 1 = biri geçmedi; 2 = etiket yok (koşulamadı, geçti sayılmaz).
import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { CURRENT, bootVersion, tagCommit } from "./guvenilirlik/surumler.mjs";

process.env.HUKUK_LICENSE_URL = "http://127.0.0.1:9";
const ESKI = "v2.4.6";
if (!tagCommit(ESKI)) {
  console.error(`${ESKI} etiketi yok (git fetch --tags); koşulamadı — GEÇTİ SAYILMAZ`);
  process.exit(2);
}
const root = mkdtempSync(path.join(tmpdir(), "maliyet-sablon-247-"));
const dirs = { dataDir: path.join(root, "data"), backupDir: path.join(root, "backups"), env: { HUKUK_LICENSE_URL: "http://127.0.0.1:9" } };
let checks = 0;
const ok = (value, message) => {
  assert.ok(value, message);
  checks += 1;
  console.log(`  ✓ ${message}`);
};
const eq = (actual, expected, message) => {
  assert.deepEqual(actual, expected, message);
  checks += 1;
  console.log(`  ✓ ${message}`);
};
const must = async (label, promise) => {
  const res = await promise;
  if (res.status !== 200) throw new Error(`${label}: ${res.status} ${JSON.stringify(res.data).slice(0, 300)}`);
  return res.data;
};
const adim = (kart, kod) => kart.adimlar.find(item => item.kod === kod);
const oranlar = kart => kart.adimlar.filter(item => ["yuzde", "toplama", "yuzde_ekle"].includes(item.kod)).map(item => [item.kod, item.etiket, item.oran ?? null]);
const KOSE = "cam/100x100-kose-kabin";
const MIKA170 = "mika/170-2s2c-h182";
const DOKUNULMAMIS = ["cam/100x100-oval-kabin", "cam/170-2s2c-h182", "cam/130-1s1c-h182-kabin", "cam/130-1s2c-h182-kabin", "mika/100x100-oval-kabin", "mika/100x100-kose-kabin", "mika/150-1s1c-h182-kabin", "mika/120-1s2c-h182-kabin", "mika/80-lik-yan-panel"];

let server = null;
try {
  console.log(`■ (1) ${ESKI} gerçek kodu: şablon kurulur, iki kart kaydedilir`);
  server = await bootVersion(ESKI, dirs);
  let api = await server.login();
  await must("sektör", api.post("/api/workspace/insight/sector", { sectorId: "dusakabin", source: "manual" }));
  const eski = await must("aç", api.get("/api/maliyet"));
  eq(oranlar(eski.kartlar[KOSE]), [["yuzde", "KDV/18", 18], ["toplama", "", null], ["yuzde_ekle", "%20 Maliyet", 20]], `${ESKI} şablonu: KDV/18 18, %20 Maliyet 20`);
  const kose = eski.kartlar[KOSE];
  const mika = eski.kartlar[MIKA170];
  await must("kaydet", api.put("/api/maliyet", {
    kartlar: [
      { kod: KOSE, rev: kose.rev, satirlar: kose.satirlar.map(({ id, ad, birim }, index) => ({ id, ad, birim, miktar: index + 1, fiyat: 12.5 })) },
      { kod: MIKA170, rev: mika.rev, adimlar: [{ kod: "yuzde", oran: 14 }] },
    ],
  }));
  const kayitli = await must("oku", api.get("/api/maliyet"));
  const koseOnce = kayitli.kartlar[KOSE];
  const mikaOnce = kayitli.kartlar[MIKA170];
  ok(koseOnce.rev === 2 && mikaOnce.rev === 2 && adim(mikaOnce, "yuzde").oran === 14, `${ESKI}: iki kart kaydedildi (rev 2; Mika 170 Masraf% 14)`);
  await server.close();
  server = null;

  console.log("\n■ (2) bu dalın kodu aynı veri klasörüyle");
  server = await bootVersion(CURRENT, dirs);
  api = await server.login();
  const yeni = await must("aç", api.get("/api/maliyet"));
  for (const kod of DOKUNULMAMIS) {
    const kart = yeni.kartlar[kod];
    ok(adim(kart, "yuzde").oran === null && adim(kart, "yuzde_ekle").oran === null && adim(kart, "yuzde_ekle").etiket === "Maliyet" && !/\d/.test(adim(kart, "yuzde").etiket) && adim(kart, "toplama").etiket === (kod.endsWith("yan-panel") ? "Genel" : "Toplam") && kart.rev === 1, `hiç kaydedilmemiş ${kod}: oranlar boş, ${JSON.stringify(oranlar(kart))}`);
  }
  eq(oranlar(yeni.kartlar[KOSE]), [["yuzde", "KDV/18", 18], ["toplama", "", null], ["yuzde_ekle", "%20 Maliyet", 20]], "kaydedilmiş Köşe Kabin AYNEN (18 / 20, eski etiketler)");
  eq(yeni.kartlar[KOSE].satirlar.map(satir => [satir.miktar, satir.fiyat]), koseOnce.satirlar.map(satir => [satir.miktar, satir.fiyat]), "Köşe Kabin fiyatları aynen");
  eq(yeni.kartlar[KOSE].sonuc, koseOnce.sonuc, "Köşe Kabin sonucu aynen");
  eq(oranlar(yeni.kartlar[MIKA170]), [["yuzde", "Masraf%", 14], ["toplama", "", null], ["yuzde_ekle", "%15 Maliyet", 15]], "kaydedilmiş Mika 170 AYNEN (14 / 15)");
  ok(yeni.kartlar[KOSE].rev === 2 && yeni.kartlar[MIKA170].rev === 2, "rev'ler değişmedi");
  const ikinci = await must("yeniden aç", api.get("/api/maliyet"));
  eq(ikinci.kartlar, yeni.kartlar, "ikinci açılış aynı (yükseltme bir kez)");
  await server.close();
  server = null;

  console.log(`\n■ (3) ${ESKI}'e dönüş: aynı dosya`);
  server = await bootVersion(ESKI, dirs);
  api = await server.login();
  const geri = await must("aç", api.get("/api/maliyet"));
  const oval = geri.kartlar["cam/100x100-oval-kabin"];
  ok(adim(oval, "yuzde").oran === null && oval.sonuc === 0, `${ESKI} boş oranlı kartı açar (oran boş, sonuç 0)`);
  eq(oranlar(geri.kartlar[KOSE]), [["yuzde", "KDV/18", 18], ["toplama", "", null], ["yuzde_ekle", "%20 Maliyet", 20]], `${ESKI}: kaydedilmiş kart aynen`);
  await server.close();
  server = null;
  console.log(`\n${checks} denetim geçti`);
} catch (error) {
  console.error(`✗ ${error.stack || error.message}`);
  process.exitCode = 1;
} finally {
  await server?.close().catch(() => null);
  rmSync(root, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 });
}
