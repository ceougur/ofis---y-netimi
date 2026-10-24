// 2.4.4 31e B1–B3 göç karşılaştırması (CLAUDE.md test kuralı: eski sürüm verisi o sürümün GERÇEK koduyla üretilir). Kaynak: 31e tur 6 dar kontrol
// betiği (kimlik-bag.mjs) + kâhin b3g/b3h "Devamı olarak ekle farklı kişi". Veri v2.4.3'ün gerçek koduyla (git etiketi) yüklenir, bağlar o kodla girilir
// (kayıt tahsilatı, not, düzeltme, "Ödendi say", cari); sonra GÜNCEL kodla değişmiş tablo Yerine koy / Devamı olarak ekle / Sheets eşitlemesi.
// Çiftler: v2.4.3→v2.4.3 (eski davranış, yalnız kayıt), v2.4.3→güncel ve güncel→güncel (beklenen: bağ kopmaz; onaysız 409 yalnız eşleşmeyen/çift varsa).
// Kullanım: node --disable-warning=ExperimentalWarning test/guvenilirlik/kimlik-bag-goc.mjs [senaryo …]   (v2.4.3 etiketi gerekir; yoksa çıkış 2)
import { mkdtempSync, rmSync } from "node:fs";
import path from "node:path";
import { tmpdir } from "node:os";
import { CURRENT, bootVersion, tagsAvailable } from "./surumler.mjs";
import { createClock } from "../../server/lib/clock.mjs";
const NB = tmpdir();
const pad = v => String(v).padStart(2, "0");
const d = days => { const x = new Date(2026, 9, 23 + days, 12); return `${pad(x.getDate())}.${pad(x.getMonth() + 1)}.${x.getFullYear()}`; };
const iso = days => { const x = new Date(2026, 9, 23 + days, 12); return `${x.getFullYear()}-${pad(x.getMonth() + 1)}-${pad(x.getDate())}`; };
const NAMES = ["Ali Veli", "Ayşe Kaya", "Can Er", "Deniz Ak", "Ece Su", "Fırat Er"];
const PEOPLE = NAMES.map((name, i) => ({ name, tutar: String(1000 * (i + 1)), vade: d(-3 - i), aciklama: `Aidat ${i + 1}`, dosya: `2026/${101 + i}`, kod: `D-${101 + i}`, mno: `M-00${i + 1}`, tel: `0532 111 22 ${pad(i + 10)}` }));
// Tablo kurucu: cols = [[başlık, kişi → değer], ...]
const table = (cols, people = PEOPLE, patch = null) => [cols.map(c => c[0]), ...people.map(p => cols.map(c => String(c[1](patch && patch.name === p.name ? { ...p, ...patch } : p))))];
const C = {
  ad: ["Ad Soyad", p => p.name], tutar: ["Tutar", p => p.tutar], vade: ["Son Ödeme", p => p.vade], acik: ["Açıklama", p => p.aciklama],
  dosya: ["Dosya No", p => p.dosya], takip: ["Takip No", p => p.dosya], kod: ["Dosya No", p => p.kod], mkod: ["Müşteri Kodu", p => p.kod],
  mno: ["Müşteri No", p => p.mno], tel: ["Telefon", p => p.tel],
};
const T0 = [C.ad, C.tutar, C.vade, C.acik];
const T1 = [C.dosya, C.ad, C.tutar, C.vade, C.acik];
const T2 = [C.kod, C.ad, C.tutar, C.vade, C.acik];
const T3 = [C.mno, C.ad, C.tutar, C.vade, C.acik];
const shuffled = [PEOPLE[3], PEOPLE[0], PEOPLE[5], PEOPLE[1], PEOPLE[4], PEOPLE[2]];
const withoutDeniz = PEOPLE.filter(p => p.name !== "Deniz Ak");
const SCEN = {
  "a1-dosyano-ekle-2026": { base: table(T0), next: table([C.dosya, ...T0]), mode: "replace" },
  "a2-dosyano-ekle-2026-ekle": { base: table(T0), next: table([C.dosya, ...T0]), mode: "merge" },
  "a3-dosyano-ekle-D": { base: table(T0), next: table([C.kod, ...T0]), mode: "replace" },
  "b1-dosyano-adi-degisir-2026": { base: table(T1), next: table([C.takip, C.ad, C.tutar, C.vade, C.acik]), mode: "replace" },
  "b2-dosyano-silinir-2026": { base: table(T1), next: table(T0), mode: "replace" },
  "b3-dosyano-adi-degisir-D": { base: table(T2), next: table([C.mkod, C.ad, C.tutar, C.vade, C.acik]), mode: "replace" },
  "b4-dosyano-silinir-D": { base: table(T2), next: table(T0), mode: "replace" },
  "b5-dosyano-tutar-degisir": { base: table(T1), next: table(T1, PEOPLE, { name: "Ali Veli", tutar: "1200" }), mode: "replace" },
  "c1-sira-degisir": { base: table(T0), next: table(T0, shuffled), mode: "replace" },
  "c2-satir-silinir": { base: table(T0), next: table(T0, withoutDeniz), mode: "replace" },
  "c3-tutar-degisir": { base: table(T0), next: table(T0, PEOPLE, { name: "Ali Veli", tutar: "1200" }), mode: "replace" },
  "c4-kolon-eklenir": { base: table(T0), next: table([...T0, C.tel]), mode: "replace" },
  "c5-ayni-dosya": { base: table(T0), next: table(T0), mode: "replace" },
  "d1-tutar-degisir-ekle": { base: table(T0), next: table(T0, PEOPLE, { name: "Ali Veli", tutar: "1200" }), mode: "merge" },
  "d2-kolon-eklenir-ekle": { base: table(T0), next: table([...T0, C.tel]), mode: "merge" },
  "d3-sira-degisir-ekle": { base: table(T0), next: table(T0, shuffled), mode: "merge" },
  "e1-musterino-tutar-degisir": { base: table(T3), next: table(T3, PEOPLE, { name: "Ali Veli", tutar: "1200" }), mode: "replace" },
  "e2-musterino-silinir": { base: table(T3), next: table(T0), mode: "replace" },
  // Bağlı Google Sheets eşitlemesi (sahte fetch; sunucunun gerçek okuyucusu ve eşitleme yolu): kaynakta Ali'nin tutarı değişir / kolon eklenir / sıra değişir.
  "s1-sheets-tutar-degisir": { base: table(T0), next: table(T0, PEOPLE, { name: "Ali Veli", tutar: "1200" }), mode: "sync" },
  "s2-sheets-kolon-eklenir": { base: table(T0), next: table([...T0, C.tel]), mode: "sync" },
  "s3-sheets-sira-degisir": { base: table(T0), next: table(T0, shuffled), mode: "sync" },
  // Kâhin b3g/b3h: Devamı olarak eklemede 2. satırda başka kişi (Ayşe Kaya yerine Yeni Kişi) — Ayşe'nin "Ödendi say"ı ve satırı durmalı.
  "f1-devam-farkli-kisi": { base: table(T0), next: table(T0, PEOPLE.map(p => (p.name === "Ayşe Kaya" ? { ...p, name: "Yeni Kişi", tutar: "9000" } : p))), mode: "merge" },
  "f2-sheets-farkli-kisi": { base: table(T0), next: table(T0, PEOPLE.map(p => (p.name === "Ayşe Kaya" ? { ...p, name: "Yeni Kişi", tutar: "9000" } : p))), mode: "sync" },
};
const csvOf = matrix => matrix.map(line => line.map(cell => (/[",\n]/.test(cell) ? `"${cell.replace(/"/g, '""')}"` : cell)).join(",")).join("\n");
const SHEET_URL = "https://docs.google.com/spreadsheets/d/KIMLIKBAG/edit";
let CSV = "";
const fetchImpl = async target => (String(target).includes("/edit") ? new Response('<script>"gid":"0","name":"Müşteriler"</script>') : new Response(CSV, { headers: { "content-type": "text/csv" } }));
const RANGE = "from=2000-01-01&to=2099-12-31";
const rowsOf = store => store.all("SELECT case_key AS k, values_json AS v FROM dataset_rows ORDER BY position").map(r => ({ k: r.k, name: JSON.parse(r.v)["Ad Soyad"] }));
const keyOfName = (rows, name) => rows.filter(r => r.name === name).map(r => r.k);
// İstemcinin "Yerine Koy" onayı (client/assets/hof-sources.js:299-300, iki sürümde aynı): yalnız replace ve replace.removed > 0.
const confirmText = (mode, preview) => (mode === "replace" && preview.replace.removed > 0 ? `Yeni dosyada olmayan ${preview.replace.removed} kayıt tablodan kalkacak. Notları ve geçmişi silinmez; işlemden önce yedek alınır. Devam edilsin mi?` : null);
async function load(api, matrix, sheets = false) {
  if (sheets) CSV = csvOf(matrix);
  const s = await api.post("/api/workspace/dataset/stage", sheets ? { kind: "sheets", url: SHEET_URL } : { kind: "excel", fileName: "musteriler.xlsx", sheets: [{ name: "Müşteriler", matrix }] });
  if (s.status !== 200) throw new Error(`stage ${s.status} ${JSON.stringify(s.data)}`);
  return s.data;
}
async function bonds(api, store) {
  const rows = rowsOf(store);
  const ali = keyOfName(rows, "Ali Veli")[0];
  const ayse = keyOfName(rows, "Ayşe Kaya")[0];
  const can = keyOfName(rows, "Can Er")[0];
  const r = {};
  r.tahsilat = (await api.post(`/api/workspace/cases/${encodeURIComponent(ali)}/payments`, { amount: 400, date: iso(-1), method: "cash", cashForce: true, note: "Ali tahsilat", caseTitle: "Ali Veli" })).status;
  r.not = (await api.post(`/api/workspace/cases/${encodeURIComponent(ali)}/notes`, { note: "Ali ile görüşüldü" })).status;
  r.duzeltme = (await api.post("/api/workspace/overrides", { caseKey: ali, field: "Açıklama", value: "Düzeltildi" })).status;
  const dues = await api.get("/api/workspace/dues");
  const ayseItem = (dues.data?.items || []).find(i => i.person === "Ayşe Kaya");
  r.odendiSay = ayseItem ? (await api.post("/api/workspace/dues/settle", { id: ayseItem.id })).status : "kalem yok";
  const acc = await api.post("/api/workspace/accounts", { name: "Can Er", type: "customer", caseKey: can, caseTitle: "Can Er" });
  r.cari = acc.status;
  return { kayit: r, anahtar: { ali, ayse, can } };
}
async function observe(api, store, keys0) {
  const rows = rowsOf(store);
  const where = key => { const hit = rows.filter(r => r.k === key).map(r => r.name); return hit.length ? hit.join("+") : "YOK"; };
  const payKey = store.get("SELECT case_key AS k FROM payments WHERE note = 'Ali tahsilat'")?.k;
  const noteKey = store.get("SELECT case_key AS k FROM notes WHERE note = 'Ali ile görüşüldü'")?.k;
  const ovKey = store.get("SELECT case_key AS k FROM overrides WHERE field = 'Açıklama' AND value = 'Düzeltildi'")?.k;
  const accKey = store.get("SELECT case_key AS k FROM accounts WHERE name = 'Can Er' AND deleted_at IS NULL")?.k;
  const ce = await api.get(`/api/workspace/reports/cari-ekstre?${RANGE}`);
  const groups = ce.data?.report?.groups || [];
  const g = name => groups.filter(x => x.cari === name).map(x => [x.debit, x.credit]);
  const dues = await api.get("/api/workspace/dues");
  const items = dues.data?.items || [];
  const t = name => items.filter(i => i.person === name).map(i => [i.amount, i.remaining ?? null, i.state]);
  const aliKeys = keyOfName(rows, "Ali Veli");
  const act = aliKeys.length ? await api.get(`/api/workspace/cases/${encodeURIComponent(aliKeys[aliKeys.length - 1])}/activity`) : null;
  const canKeys = keyOfName(rows, "Can Er");
  const accView = canKeys.length ? await api.get(`/api/workspace/cases/${encodeURIComponent(canKeys[canKeys.length - 1])}/account`) : null;
  return {
    satir: rows.length,
    aliAnahtar: aliKeys, anahtarDegisti: aliKeys[0] !== keys0.ali,
    bag: { tahsilat: where(payKey), not: where(noteKey), duzeltme: where(ovKey), cari: where(accKey), odendiSayAyse: t("Ayşe Kaya").length ? "Ayşe Takvim'de YENİDEN" : "kapalı kalıyor" },
    kisilerAli: g("Ali Veli"), takvimAli: t("Ali Veli"), takvimAyse: t("Ayşe Kaya"),
    aliKartiGecmis: act ? { notlar: (act.data?.items || []).filter(i => i.type === "note").length, tahsilat: act.data?.paidTotal } : null,
    canKartiCari: accView ? (accView.data?.account?.name || null) : null,
  };
}
async function run(name, sc, first, second) {
  const root = mkdtempSync(path.join(NB, `destekofis-kimlik-bag-${name}-`));
  const dirs = { dataDir: path.join(root, "data"), backupDir: path.join(root, "backups"), env: { HUKUK_LICENSE_URL: "http://127.0.0.1:9" }, fetchImpl, now: createClock({ time: new Date(2026, 9, 23, 10), fixed: true }) };
  const out = { senaryo: name, surum: `${first}→${second === CURRENT ? "aday16" : second}`, mod: sc.mode };
  try {
    let server = await bootVersion(first, dirs);
    let api = await server.login();
    await api.post("/api/workspace/bank/setup/dismiss", {});
    const sync = sc.mode === "sync";
    const s1 = await load(api, sc.base, sync);
    const c1 = await api.post("/api/workspace/dataset/commit", { stageId: s1.stageId, mode: "replace", link: true });
    out.ilkKural = JSON.stringify(s1.identity);
    const b = await bonds(api, server.app.store);
    out.kayit = b.kayit;
    out.ilkAnahtarAli = b.anahtar.ali;
    if (second !== first) {
      await server.close();
      server = await bootVersion(second, dirs);
      api = await server.login();
    }
    if (sync) {
      CSV = csvOf(sc.next);
      const y = await api.post("/api/workspace/dataset/sync", {});
      out.bekletme = y.data?.hold ?? null;
      out.onizleme = { kural: JSON.stringify(server.app.store.get("SELECT value FROM settings WHERE key = 'dataset.identity'")?.value ?? null) };
      out.onay = "yok (eşitleme kendiliğinden / Şimdi Eşitle)";
      out.commit = [c1.status, y.status, y.data];
      out.sonra = await observe(api, server.app.store, b.anahtar);
      await server.close();
      return;
    }
    const s2 = await load(api, sc.next);
    out.onizleme = { kural: JSON.stringify(s2.identity), devami: s2.preview.merge, yerine: s2.preview.replace, ornek: s2.preview.samples };
    out.onay = sc.mode === "merge" ? "yok (Devamı Olarak Ekle onay sormaz)" : confirmText("replace", s2.preview) || "yok (replace.removed = 0)";
    let c2 = await api.post("/api/workspace/dataset/commit", { stageId: s2.stageId, mode: sc.mode });
    // r31e-b: onaysız uygulama 409 ise (eşleşmeyen bağ / aynı görünen satır) iletisi yazılır, sonra onayla uygulanır.
    if (c2.status === 409) {
      out.onayIstendi = { kod: c2.data?.code, ileti: c2.data?.error };
      const s3 = await load(api, sc.next);
      c2 = await api.post("/api/workspace/dataset/commit", { stageId: s3.stageId, mode: sc.mode, confirm: true });
    }
    out.bagOnizleme = s2.bonds ?? null;
    out.commit = [c1.status, c2.status, c2.data?.counts];
    out.sonra = await observe(api, server.app.store, b.anahtar);
    await server.close();
  } catch (error) {
    out.hata = String(error?.stack || error);
  } finally {
    rmSync(root, { recursive: true, force: true });
    console.log(JSON.stringify(out));
    results.push(out);
  }
}
const results = [];
// Beklenen (karar metninden, 23.10.2026): bağ kopmaz — tahsilat/not/düzeltme Ali'de, cari Can'da, Ayşe'nin kalemi kapalı; Kişiler Ali alacak 400;
// tutarı 1.200'e çıkan senaryoda borç 1.200. Devamı'nda Dosya No eklenmiş dosya (a2) onay ister ve onayla çift kayıt olur (bağ eski satırda); farklı kişi
// (f1/f2) Ayşe'yi ezmez.
const ALI_1200 = new Set(["b5-dosyano-tutar-degisir", "c3-tutar-degisir", "d1-tutar-degisir-ekle", "e1-musterino-tutar-degisir", "s1-sheets-tutar-degisir"]);
function verdict(out) {
  const s = out.sonra;
  if (out.hata || !s) return `hata: ${String(out.hata || "sonuç yok").slice(0, 200)}`;
  const problems = [];
  if (s.bag.tahsilat !== "Ali Veli" || s.bag.not !== "Ali Veli" || s.bag.duzeltme !== "Ali Veli") problems.push(`Ali bağları ${JSON.stringify(s.bag)}`);
  if (s.bag.cari !== "Can Er") problems.push(`cari ${s.bag.cari}`);
  // a2: onaylanan çift kayıtta Ayşe'nin YENİ satırı kendi (açık) kalemini taşır; eski satırın işareti durur (bağ denetimi yukarıda).
  if (s.bag.odendiSayAyse !== "kapalı kalıyor" && out.senaryo !== "a2-dosyano-ekle-2026-ekle") problems.push("Ayşe'nin kalemi yeniden açıldı");
  if (out.senaryo === "a2-dosyano-ekle-2026-ekle" && s.takvimAyse.length !== 1) problems.push(`a2: Ayşe'nin Takvim kalemi ${s.takvimAyse.length} (beklenen yalnız yeni satırınki: 1)`);
  const debt = out.senaryo === "a2-dosyano-ekle-2026-ekle" ? 2000 : ALI_1200.has(out.senaryo) ? 1200 : 1000;
  if (JSON.stringify(s.kisilerAli) !== JSON.stringify([[debt, 400]])) problems.push(`Kişiler Ali ${JSON.stringify(s.kisilerAli)} (beklenen [[${debt},400]])`);
  if (out.senaryo === "a2-dosyano-ekle-2026-ekle" && out.onayIstendi?.kod !== "merge-duplicates") problems.push("Devamı'nda çift kayıt onaysız eklendi");
  if (out.senaryo.startsWith("f") && s.satir !== 7) problems.push(`farklı kişi Ayşe'nin satırını ezdi: satır ${s.satir} (beklenen 7)`);
  return problems.join("; ");
}
if (!tagsAvailable(["v2.4.3"])) {
  console.error("v2.4.3 etiketi yok (git fetch --tags); göç karşılaştırması koşulamaz.");
  process.exit(2);
}
const pick = process.argv.slice(2);
const pairs = (process.env.CIFT || "eski,goc,yeni").split(",").map(x => ({ eski: ["v2.4.3", "v2.4.3"], goc: ["v2.4.3", CURRENT], yeni: [CURRENT, CURRENT] })[x]);
for (const [name, sc] of Object.entries(SCEN)) {
  if (pick.length && !pick.includes(name)) continue;
  for (const [a, b2] of pairs) await run(name, sc, a, b2);
}
let fail = 0;
let pass = 0;
const old = [];
for (const out of results) {
  if (out.surum === "v2.4.3→v2.4.3") {
    old.push(`${out.senaryo}: ${verdict(out) || "bağ korunuyor"}`);
    continue;
  }
  const problem = verdict(out);
  if (problem) {
    fail += 1;
    console.log(`not ok - ${out.senaryo} ${out.surum}: ${problem}`);
  } else {
    pass += 1;
    console.log(`ok - ${out.senaryo} ${out.surum}${out.onayIstendi ? ` (onay istendi: ${out.onayIstendi.kod})` : ""}`);
  }
}
console.log("# eski davranış (v2.4.3 → v2.4.3, yalnız kayıt):");
for (const line of old) console.log(`#   ${line}`);
console.log(`# tests ${pass + fail}`);
console.log(`# pass ${pass}`);
console.log(`# fail ${fail}`);
process.exit(fail ? 1 : 0);
