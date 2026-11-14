// 2.5.0 Ç5-A tur 2b İş 2 — Kural Farkı Düzeltme Fişi + "Düzeltildi" (docs/erp/C5-ACILIS-TASARIM.md §3.3, §17.8; KG-15 A; EK-1 M7 ve §4 (9); BAŞ MİMAR B14 (a), B16;
// KULLANICI S76 = A, S164 = C; D 12.11 15:57 (4)).
// KURAL (karar metinlerinden): tarih = kilit + 1; 1–5 sınıfı birikimli fark; 6 / 7 sınıfı yıl yıl — fişin yılı aynı hesap, önceki yıl borç yönlü 681 / alacak yönlü 671; alt defter
// hesabı fişe girmez; kilit bugünse düğme pasif + neden; kilitli dönemde onay bekleyen Açılış Olabilir kaydı varken fiş yazılmaz (B16); fiş farkı kapatınca Mutabakat Testi uyarısız,
// öğe "… — Düzeltildi (Fiş …)"; ters kayıtla uyarı geri gelir; değişmez: fişten sonra 1–5 sınıfı karma bakiyeleri = yeni kuralla baştan türetilmiş defter.
// BEKLENEN SAYILAR programın kodundan DEĞİL: fikstürün eski sürüm (v2.4.9 / v2.0.26 GERÇEK kodu) mizanından + ham tablolardan + karar metninden (ders 5).
// Veri: programın kendi ürettiği eski sürüm fikstürleri (surum-2.4.9-s127 kilit 31.12.2025, surum-2.0.26-zincir kilit 05.10.2026, surum-2.4.9-s127-kilitsiz). Dondurmanın bitişi ÜRÜNÜN
// DURUMUNDAN beklenir (runPending; ders 20). Sahte saat (ders 13); iki TZ'de koşulur; lisans servisi yok (ders 30).
import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";
import { describe, it } from "node:test";
import { CURRENT, bootVersion, tagsAvailable } from "./guvenilirlik/surumler.mjs";
import { readFixture, unpackFixture } from "./guvenilirlik/fikstur.mjs";

process.env.HUKUK_LICENSE_URL ||= "http://127.0.0.1:9";
const URL = "/api/admin/ledger/rule-diff-correction";
const RULE_DIFF = "ledger:rule-diff";
const todayOf = name => readFixture(name).oncesi?.today || String(readFixture(name).now || "").slice(0, 10);
let seq = 0;
const rid = () => `kfd-${process.pid}-${String(++seq).padStart(8, "0")}`;

async function open(name, { today = todayOf(name) } = {}) {
  const fixture = unpackFixture(name);
  const server = await bootVersion(CURRENT, { dataDir: fixture.dataDir, backupDir: fixture.backupDir, maxCompanies: 10, now: { time: `${today}T12:00:00+03:00`, fixed: true }, integrityScan: false });
  const alerts = [];
  server.app.events.tap((event, payload) => {
    if (event === "integrity.alert") alerts.push(payload.findings.map(item => item.code));
  });
  await server.app.ledger.snapshots.runPending();
  const state = server.app.ledger.snapshots.state();
  assert.equal(state.pending, null, `${name}: açılıştaki dondurma bitmeli`);
  const api = await server.login();
  const logCount = () => server.app.store.get("SELECT COUNT(*) AS n FROM integrity_log").n;
  return { fixture, server, app: server.app, api, alerts, logCount, close: async () => { await server.close().catch(() => {}); fixture.cleanup(); } };
}
const integrity = async api => {
  const r = await api.get("/api/workspace/ledger/integrity");
  assert.equal(r.status, 200);
  return { ok: r.data.ok, failures: (r.data.failures || []).map(item => item.code), item: (r.data.checks || []).find(item => item.code === RULE_DIFF) || null };
};
const lineText = lines => lines.map(line => `${line.debit ? "B" : "A"} ${line.sub || line.account} ${(line.debit || line.credit) / 100}`).sort();
const class15 = entries => {
  const out = new Map();
  for (const entry of entries) for (const line of entry.lines) if (/^[1-5]/.test(line.account)) out.set(line.account, (out.get(line.account) || 0) + line.debit - line.credit);
  return out;
};
/** Değişmez (EK-1 §4 (9)): karma defter (donmuş ≤ kilit + canlı > kilit + fişler) 1–5 sınıfı bakiyeleri = yeni kuralla baştan türetilmiş defter (fişsiz). Alt defter hesabı farkı (B14) yok sayılmaz. */
function assertInvariant(app, label) {
  const karma = class15(app.ledger.book({}));
  const fresh = class15(app.ledger.build().filter(entry => !String(entry.id).startsWith("voucher")));
  const bad = [...new Set([...karma.keys(), ...fresh.keys()])].filter(key => (karma.get(key) || 0) !== (fresh.get(key) || 0)).map(key => `${key}: karma ${(karma.get(key) || 0) / 100} ↔ baştan ${(fresh.get(key) || 0) / 100}`);
  assert.deepEqual(bad, [], `${label}: fişten sonra 1–5 sınıfı karma bakiyeleri = yeni kuralla baştan türetilmiş defter`);
}

describe("Ç5-A tur 2b İş 2 — Kural Farkı Düzeltme Fişi", () => {
  it("[1] v2.4.9 verisi (kilit 31.12.2025, Excel kartları): fiş 01.01.2026; önceki yıl 602 farkı 681'e; Düzeltildi; ters kayıtla uyarı geri; ikinci fiş; değişmez", { timeout: 240_000 }, async () => {
    const name = "surum-2.4.9-s127";
    const meta = readFixture(name);
    const ctx = await open(name);
    try {
      const { app, api } = ctx;
      // Beklenen (karar metni + eski sürümün kendi mizanı + ham tablolar): v2.4.9'da 2025'in 500 / 602 bakiyesi; yeni kuralda açılış karşı hesabı 519 (500 yalnız eşleştirme fişiyle)
      // ve Excel kartının geliri yok (KG-5; S127'nin eski kurala bağlı kartı da 519'da — BAŞ MİMAR 12.11 03:57). Ön koşul: 2025'in 602'si yalnız yüklenen kartlardan.
      const m500 = meta.oncesi.mizan2025["500"];
      const m602 = meta.oncesi.mizan2025["602"];
      const cardT = Math.round(Number(app.store.get("SELECT COALESCE(SUM(total), 0) AS t FROM plans WHERE deleted_at IS NULL AND import_id <> '' AND NOT covers_balance AND COALESCE(NULLIF(registered_on, ''), substr(created_at, 1, 10)) <= ?", meta.lockedUntil).t) * 100);
      assert.equal(-m602, cardT, "ön koşul: v2.4.9'un 2025 geliri (602) yalnız yüklenen taksit kartlarının tutarı");
      const expected = lineText([{ account: "500", debit: -m500, credit: 0 }, { account: "681", debit: -m602, credit: 0 }, { account: "519", debit: 0, credit: -(m500 + m602) }]);
      const before = await integrity(api);
      assert.ok(before.item && before.item.ok === false && before.item.count > 0, `ön koşul: kural farkı uyarısı: ${JSON.stringify(before.item)}`);
      assert.deepEqual(before.failures, [RULE_DIFF], "ön koşul: başka sapma yok");
      const log0 = ctx.logCount();
      const view = (await api.get(URL)).data;
      assert.equal(view.disabled, false, view.reason);
      assert.equal(view.date, "2026-01-01", "fiş tarihi kilit + 1");
      assert.deepEqual(lineText(view.lines), expected, "fiş satırları: 1–5 birikimli, önceki yılın 602 farkı 681");
      assert.deepEqual(view.excluded, [], "alt defter farkı yok");
      assert.equal(view.sourceCount, before.item.count, "farkı doğuran kayıt sayısı = kural farkı madde sayısı");
      assert.ok(view.sources.every(item => item.deltas.length && item.date <= meta.lockedUntil), "kaynak satırları hesap farkıyla, kilitli dönemden");
      // Onaysız ve imzası yanlış istek fiş yazmaz.
      assert.equal((await api.post(URL, { requestId: rid(), digest: view.digest })).status, 400);
      const wrong = await api.post(URL, { requestId: rid(), digest: "0".repeat(32), confirm: true });
      assert.equal(wrong.status, 409);
      assert.equal(wrong.data?.code ?? wrong.data?.error?.code, "rule-diff-changed");
      assert.equal(app.store.get("SELECT COUNT(*) AS n FROM ledger_vouchers").n, 0, "reddedilen istek fiş yazmaz");
      const id = rid();
      const post = await api.post(URL, { requestId: id, digest: view.digest, confirm: true });
      assert.equal(post.status, 200, JSON.stringify(post.data));
      const voucher = post.data.voucher;
      assert.equal(voucher.type, "rule-diff-correction");
      assert.equal(voucher.cls, "ordinary");
      assert.equal(voucher.date, "2026-01-01");
      assert.deepEqual(lineText(voucher.lines), expected);
      const again = await api.post(URL, { requestId: id, digest: view.digest, confirm: true });
      assert.equal(again.status, 200);
      assert.equal(again.data.replayed, true, "aynı istek ikinci fiş yazmaz");
      assert.equal(app.store.get("SELECT COUNT(*) AS n FROM ledger_vouchers").n, 1);
      const after = await integrity(api);
      assert.equal(after.ok, true, `Mutabakat Testi uyarısız döner (D 12.11 15:57 (4)): ${JSON.stringify(after)}`);
      assert.ok(after.item?.ok === true && after.item.corrected?.vouchers?.[0] === voucher.noText, `öğe bilgi olarak kalır: ${JSON.stringify(after.item)}`);
      assert.match(after.item.name, /— Düzeltildi \(Fiş 2026-000001\)$/);
      assert.equal(ctx.logCount() - log0, 0, "fiş Mutabakat Günlüğü'ne satır yazmaz");
      assertInvariant(app, "fiş sonrası");
      const later = (await api.get(URL)).data;
      assert.equal(later.disabled, true);
      assert.equal(later.code, "rule-diff-nothing");
      assert.deepEqual(later.lines, []);
      // Ters kayıt: uyarı geri gelir; yeni ön izleme aynı satırları önerir; ikinci fiş yine düzeltir.
      assert.equal((await api.post(`/api/admin/ledger/vouchers/${voucher.id}/reverse`, { requestId: rid() })).status, 200);
      const reversed = await integrity(api);
      assert.equal(reversed.ok, false);
      assert.ok(reversed.item && reversed.item.ok === false && !reversed.item.corrected, "ters kayıttan sonra uyarı");
      const view2 = (await api.get(URL)).data;
      assert.deepEqual(lineText(view2.lines), expected, "ters kayıttan sonra aynı satırlar");
      const post2 = await api.post(URL, { requestId: rid(), digest: view2.digest, confirm: true });
      assert.equal(post2.status, 200);
      assert.equal(post2.data.voucher.noText, "Fiş 2026-000003", "ters kayıt 000002, ikinci düzeltme 000003");
      assert.equal((await integrity(api)).ok, true);
      assert.equal(ctx.logCount() - log0, 0, "ters kayıt ve ikinci fiş de Mutabakat Günlüğü'ne yazmaz");
      assert.deepEqual(ctx.alerts, [], "zil yok");
      assertInvariant(app, "ikinci fiş sonrası");
    } finally {
      await ctx.close();
    }
  });

  it("[2] v2.0.26 verisi (kilit 05.10.2026; aynı yıl): yalnız 500 ↔ 519; gerçek eski sürüm satırı (ileri tarihli evrak) ayrı kalır; Muhasebe 403; iki kişi aynı anda", { timeout: 240_000 }, async () => {
    const name = "surum-2.0.26-zincir";
    const ctx = await open(name);
    try {
      const { app, api } = ctx;
      const lock = app.ledger.snapshots.coverage();
      assert.equal(lock, "2026-10-05");
      const frozen500 = (app.ledger.snapshots.trial({ to: lock }).accounts.find(row => row.code === "500")?.balance || 0) * 100;
      assert.ok(frozen500 < 0, "ön koşul: eski kuralın donmuş 500'ü alacaklı (açılışlar)");
      const view = (await api.get(URL)).data;
      assert.equal(view.date, "2026-10-06");
      assert.deepEqual(lineText(view.lines), lineText([{ account: "500", debit: Math.round(-frozen500), credit: 0 }, { account: "519", debit: 0, credit: Math.round(-frozen500) }]), "aynı yıl: açılışların 500'ü 519'a");
      // Muhasebe rolü: ön izleme ve kayıt 403 (system.manage).
      const made = await api.post("/api/admin/users", { username: "kfd-muhasebe", name: "Kfd Muhasebe", role: "muhasebe", password: "Kfd-Muhasebe-2026!", mustChangePassword: false });
      assert.equal(made.status, 200, JSON.stringify(made.data));
      const accountant = await ctx.server.login("kfd-muhasebe", "Kfd-Muhasebe-2026!");
      assert.equal((await accountant.get(URL)).status, 403);
      assert.equal((await accountant.post(URL, { requestId: rid(), digest: view.digest, confirm: true })).status, 403);
      // İki kişi aynı ön izlemeyle: ilki yazar, ikincisi fiş yazmaz (409).
      const [first, second] = await Promise.all([api.post(URL, { requestId: rid(), digest: view.digest, confirm: true }), api.post(URL, { requestId: rid(), digest: view.digest, confirm: true })]);
      assert.deepEqual([first.status, second.status].sort(), [200, 409], `iki istek: ${first.status} ${second.status}`);
      assert.equal(app.store.get("SELECT COUNT(*) AS n FROM ledger_vouchers").n, 1, "iki kişi aynı anda: tek fiş");
      const after = await integrity(api);
      assert.ok(after.item?.corrected, "kural farkı düzeltildi");
      assert.deepEqual(after.failures, ["dates:future:cheque_events"], "eski sürümden kalan gerçek satır ayrı ve aynen görünür");
      assertInvariant(app, "v2.0.26 fiş sonrası");
    } finally {
      await ctx.close();
    }
  });

  it("[3] kilit bugün: ön izleme pasif + görünür neden, kayıt 400 ve fiş yok", { timeout: 240_000 }, async () => {
    const name = "surum-2.0.26-zincir";
    const ctx = await open(name);
    try {
      const { app, api } = ctx;
      const today = todayOf(name);
      assert.equal((await api.put("/api/admin/period-lock", { lockedUntil: today })).status, 200);
      await app.ledger.snapshots.runPending();
      const view = (await api.get(URL)).data;
      assert.equal(view.date > today, true);
      assert.equal(view.disabled, true);
      assert.equal(view.code, "rule-diff-lock-today");
      assert.equal(view.reason, "Kilit bugünün tarihinde; düzeltme fişi yarın yazılabilir.");
      assert.ok(view.lines.length > 0, "fark var (yalnız tarih engelliyor)");
      const post = await api.post(URL, { requestId: rid(), digest: view.digest, confirm: true });
      assert.equal(post.status, 400);
      assert.equal(app.store.get("SELECT COUNT(*) AS n FROM ledger_vouchers").n, 0);
    } finally {
      await ctx.close();
    }
  });

  it("[4] B16: kilitli dönemde onay bekleyen Açılış Olabilir kaydı varken fiş yazılmaz; karar verilince satırlar kararla değişir (onay 519, ret 602 / 770)", { timeout: 240_000 }, async () => {
    const name = "surum-2.0.26-zincir";
    const ctx = await open(name);
    try {
      const { app, api } = ctx;
      const lock = app.ledger.snapshots.coverage();
      // Göçün (48) yazdığı durum: kilitli dönemdeki işaretsiz sıradan bir Borç Yaz satırı aday (test/defter-hiz-esdegerlik-250 kalıbı; para alanı değil, kapının kopyasıyla).
      const row = app.store.get("SELECT e.id, e.kind, e.amount, e.date FROM account_entries e JOIN accounts a ON a.id = e.account_id AND a.deleted_at IS NULL WHERE COALESCE(e.source, '') = '' AND e.kind = 'debt' AND e.is_opening = 0 AND e.opening_review = '' AND e.date <= ? ORDER BY e.rowid LIMIT 1", lock);
      assert.ok(row, "ön koşul: kilitli dönemde sıradan Borç Yaz satırı");
      app.store.raw("test.opening-review", () => app.store.run("UPDATE account_entries SET opening_review = 'candidate', opening_review_gate = 'candidate' WHERE id = ?", row.id));
      const blocked = (await api.get(URL)).data;
      assert.equal(blocked.disabled, true);
      assert.equal(blocked.code, "rule-diff-candidates");
      assert.match(blocked.reason, /^Önce Açılış Olabilir listesini tamamlayın: kilitli dönemde onay bekleyen 1 kayıt var/);
      const refused = await api.post(URL, { requestId: rid(), digest: blocked.digest, confirm: true });
      assert.equal(refused.status, 409);
      assert.equal(app.store.get("SELECT COUNT(*) AS n FROM ledger_vouchers").n, 0);
      const minor = Math.round(Number(row.amount) * 100);
      const sum = (view, account) => view.lines.filter(line => line.account === account).reduce((total, line) => total + line.credit - line.debit, 0);
      assert.equal((await api.post(`/api/workspace/opening-review/${row.id}`, { decision: "reject" })).status, 200);
      const rejected = (await api.get(URL)).data;
      assert.equal(rejected.disabled, false, rejected.reason);
      assert.equal((await api.post(`/api/workspace/opening-review/${row.id}`, { decision: "confirm" })).status, 200);
      const confirmed = (await api.get(URL)).data;
      assert.equal(sum(confirmed, "519") - sum(rejected, "519"), minor, "onaylanan açılış Borç Yaz'ın karşılığı 519'a girer (ret: 602, fark yok)");
      assert.notEqual(confirmed.digest, rejected.digest, "kararla satırlar ve imza değişir (önce liste, sonra fiş)");
      // Fişten SONRA kilitli satırın kararı değişirse (ret → onay; kilitli satırda yapılabilir — K8-2) fark yeniden açılır: "Düzeltildi" fiş toplamına bakar, kalan ikinci fişle.
      assert.equal((await api.post(`/api/workspace/opening-review/${row.id}`, { decision: "reject" })).status, 200);
      const first = (await api.get(URL)).data;
      assert.equal((await api.post(URL, { requestId: rid(), digest: first.digest, confirm: true })).status, 200);
      assert.ok((await integrity(api)).item?.corrected, "ret durumunda fiş farkı kapattı");
      assert.equal((await api.post(`/api/workspace/opening-review/${row.id}`, { decision: "confirm" })).status, 200);
      const reopened = await integrity(api);
      assert.ok(reopened.item && reopened.item.ok === false && !reopened.item.corrected && reopened.item.correction?.remainderMinor === minor, `kararı değişen satır: kalan fark ${minor} kuruş, Düzeltildi değil: ${JSON.stringify(reopened.item)}`);
      const rest = (await api.get(URL)).data;
      assert.deepEqual(lineText(rest.lines).sort(), lineText([{ account: "519", debit: 0, credit: minor }, { account: row.date.slice(0, 4) === first.date.slice(0, 4) ? "602" : "681", debit: minor, credit: 0 }]).sort(), "ikinci fiş yalnız kalanı önerir (önceki yılın 602 farkı 681)");
      assert.equal((await api.post(URL, { requestId: rid(), digest: rest.digest, confirm: true })).status, 200);
      assert.ok((await integrity(api)).item?.corrected?.vouchers?.length === 2, "iki fişle düzeltildi");
      assertInvariant(app, "iki fiş sonrası");
    } finally {
      await ctx.close();
    }
  });

  it("[5] fazla düzeltme: fişten sonra kilit kaldırılır → uyarı (kilit olmasa da görünür); yeniden kilitlenir → yine fazla; ters kayıtla temiz", { timeout: 240_000 }, async () => {
    const name = "surum-2.0.26-zincir";
    const ctx = await open(name);
    try {
      const { app, api } = ctx;
      const lock = app.ledger.snapshots.coverage();
      const view = (await api.get(URL)).data;
      const post = await api.post(URL, { requestId: rid(), digest: view.digest, confirm: true });
      assert.equal(post.status, 200);
      assert.equal((await api.put("/api/admin/period-lock", { lockedUntil: "" })).status, 200);
      await app.ledger.snapshots.runPending();
      const unlocked = await integrity(api);
      assert.ok(unlocked.item && unlocked.item.ok === false && unlocked.item.correction?.over === true, `kilit kalkınca fiş fazla görünür: ${JSON.stringify(unlocked.item)}`);
      assert.match(unlocked.item.hint, /artık fazla — Yönetim › Sistem › Kural Farkı Düzeltme'den ters kaydedin\.$/, "ipucundaki ekran yeri (tur 2e DÜŞÜK-3)");
      assert.equal((await api.put("/api/admin/period-lock", { lockedUntil: lock })).status, 200);
      await app.ledger.snapshots.runPending();
      const relocked = await integrity(api);
      assert.ok(relocked.item?.correction?.over === true, `yeniden kilit (güncel kuralla donar): fiş yine fazla: ${JSON.stringify(relocked.item)}`);
      assert.equal((await api.post(`/api/admin/ledger/vouchers/${post.data.voucher.id}/reverse`, { requestId: rid() })).status, 200);
      const clean = await integrity(api);
      assert.equal(clean.item, null, `ters kayıttan sonra kural farkı öğesi yok: ${JSON.stringify(clean.item)}`);
    } finally {
      await ctx.close();
    }
  });

  it("[7] S164 = C: kilitli kaynağın kapı dışı değişikliği kural farkına karışırsa fişe sessizce girmez — alt defter hesabı farkı dışarıda, kaydı kaynak listesinde 'fişle düzeltilmez'", { timeout: 240_000 }, async () => {
    const name = "surum-2.0.26-zincir";
    const ctx = await open(name);
    try {
      const { app, api } = ctx;
      const lock = app.ledger.snapshots.coverage();
      const before = (await api.get(URL)).data;
      const row = app.store.get("SELECT e.id, e.account_id AS party FROM account_entries e JOIN accounts a ON a.id = e.account_id AND a.deleted_at IS NULL AND a.type = 'customer' WHERE COALESCE(e.source, '') = '' AND e.kind = 'debt' AND e.is_opening = 0 AND e.opening_review = '' AND e.date <= ? ORDER BY e.rowid LIMIT 1", lock);
      assert.ok(row, "ön koşul: kilitli dönemde müşterinin sıradan Borç Yaz satırı");
      assert.ok(!before.sources.some(item => item.id === `account:${row.id}`), "ön koşul: satır kural farkında değil");
      const other = new DatabaseSync(app.store.get("PRAGMA database_list").file);
      try {
        other.exec("PRAGMA busy_timeout = 5000");
        other.prepare("UPDATE account_entries SET amount = amount + 100 WHERE id = ?").run(row.id);
      } finally {
        other.close();
      }
      const after = (await api.get(URL)).data;
      assert.deepEqual(lineText(after.lines), lineText(before.lines), "fiş satırları değişmez (bozulan satır fişe girmez)");
      const source = after.sources.find(item => item.id === `account:${row.id}`);
      assert.ok(source && source.excluded === true, `bozulan kayıt kaynak listesinde, fişle düzeltilmez: ${JSON.stringify(source)}`);
      const excluded120 = after.excluded.find(item => item.account === "120" && item.party === row.party);
      assert.ok(excluded120 && excluded120.minor === 10_000 && excluded120.subledger === true, `120 farkı dışarıda, nedeniyle: ${JSON.stringify(after.excluded)}`);
      assert.match(after.excluded[0].reason, /Alt defter hesabı/);
      const post = await api.post(URL, { requestId: rid(), digest: after.digest, confirm: true });
      // Kapı (kilit izi) kilitli kaynağın kapı dışı değişikliğini görür: hiçbir yazım (fiş dahil) geçmez — fark fişe sessizce giremez (409 ledger-integrity, fiş yok).
      assert.equal(post.status, 409);
      assert.equal(post.data?.code ?? post.data?.error?.code, "ledger-integrity");
      assert.equal(app.store.get("SELECT COUNT(*) AS n FROM ledger_vouchers").n, 0);
    } finally {
      await ctx.close();
    }
  });

  // Ç5-A tur 2d İş 3 — S164 = C'nin İKİNCİ örneği (kullanıcı kararı 13.11.2026 17:30: program dışından yazılan değişikliğin fark edilmemesi BİLİNEN SINIR — bu vaka yalnız bugünkü
  // davranışı sabitler, taramanın onu görüp görmediğini SINAMAZ): kilitli tahsilatın fatura bağı (kilit izinde OLMAYAN alan; K-b) ayrı bağlantıyla yazılır — şüpheli caride kilitli
  // dönemin canlı türetmesi A 128 → A 120 olur. Ön izleme farkı KAYNAĞIYLA gösterir (kayıt, tarih, hesap, cari; "fişle düzeltilmez") ve fiş satırlarına SESSİZCE GİRMEZ: fiş yalnız
  // gerçek kural farkını (v2.4.9'un cari açılışı A 500 → A 519) taşır. Veri v2.4.9'un GERÇEK koduyla API'den (ders 17).
  it("[8] S164 = C ikinci örnek: kilitli tahsilatın fatura bağı kapı dışından yazılınca 120 / 128 farkı kaynağıyla dışarıda; fiş yalnız gerçek kural farkı (500 → 519)", { timeout: 240_000, skip: tagsAvailable(["v2.4.9"]) ? false : "v2.4.9 etiketi yok" }, async () => {
    const NOW = { time: "2026-10-20T12:00:00+03:00", fixed: true };
    const root = mkdtempSync(path.join(tmpdir(), "kfd-s164b-"));
    const dirs = { dataDir: path.join(root, "data"), backupDir: path.join(root, "backups") };
    const must = async (label, promise) => {
      const res = await promise;
      assert.equal(res.status, 200, `${label}: ${res.status} ${JSON.stringify(res.data).slice(0, 300)}`);
      return res.data;
    };
    const ids = {};
    let server = null;
    try {
      const old = await bootVersion("v2.4.9", { ...dirs, now: NOW });
      try {
        const api = await old.login();
        const party = await must("cari (açılışlı)", api.post("/api/workspace/accounts", { name: "S164 İkinci Örnek", type: "customer", registeredOn: "2026-08-01", openingBalance: "800" }));
        await must("borç", api.post(`/api/workspace/accounts/${party.id}/entries`, { kind: "debt", amount: "1000", date: "2026-08-20", note: "Hizmet" }));
        await must("şüpheli", api.post(`/api/workspace/accounts/${party.id}/doubtful`, { amount: 600, date: "2026-09-20", reason: "lawsuit", note: "S164" }));
        const invoice = await must("açık dönem faturası", api.post("/api/workspace/invoices", { scenario: "service_sale", accountId: party.id, issueDate: "2026-10-15", lines: [{ name: "Danışmanlık", qty: 1, unitPrice: 300, vatRate: 0 }], payment: { rest: "open" } }));
        await must("kilitli tahsilat (bağsız)", api.post(`/api/workspace/accounts/${party.id}/entries`, { kind: "in", amount: "100", date: "2026-10-09", method: "cash", cashForce: true, similarOk: true }));
        await must("kilit", api.put("/api/admin/period-lock", { lockedUntil: "2026-10-10" }));
        Object.assign(ids, { party: party.id, invoice: invoice.id, entry: old.app.store.get("SELECT id FROM account_entries WHERE account_id = ? AND kind = 'in'", party.id).id });
      } finally {
        await old.close();
      }
      server = await bootVersion(CURRENT, { ...dirs, now: NOW, integrityScan: false });
      const { app } = server;
      await app.ledger.snapshots.runPending();
      assert.equal(app.ledger.snapshots.state().pending, null, "açılıştaki dondurma bitmeli");
      const api = await server.login();
      const before = (await api.get(URL)).data;
      assert.deepEqual(lineText(before.lines), ["A 519 800", "B 500 800"], "ön koşul: gerçek kural farkı (v2.4.9'un cari açılışı 500 → 519)");
      assert.deepEqual(before.excluded, [], "ön koşul: dışarıda kalan fark yok");
      assert.ok(!before.sources.some(item => item.id === `account:${ids.entry}`), "ön koşul: tahsilat kural farkında değil");
      const ruleBefore = await integrity(api);
      assert.equal(ruleBefore.item?.count, 1, "ön koşul: Mutabakat Testi'nde bir kural farkı kaydı");
      const other = new DatabaseSync(app.store.get("PRAGMA database_list").file);
      try {
        other.exec("PRAGMA busy_timeout = 5000");
        assert.equal(other.prepare("UPDATE account_entries SET invoice_id = ? WHERE id = ?").run(ids.invoice, ids.entry).changes, 1, "kapı dışı yazım");
      } finally {
        other.close();
      }
      const after = (await api.get(URL)).data;
      assert.deepEqual(lineText(after.lines), lineText(before.lines), "fiş satırları değişmez (bağ farkı fişe girmez)");
      const source = after.sources.find(item => item.id === `account:${ids.entry}`);
      assert.ok(source, `bağı değişen kayıt kaynak listesinde: ${JSON.stringify(after.sources).slice(0, 400)}`);
      assert.equal(source.excluded, true, "fişle düzeltilmez");
      assert.equal(source.date, "2026-10-09");
      assert.deepEqual(source.deltas.map(item => `${item.account} ${item.party === ids.party ? "cari" : item.party} ${item.minor}`).sort(), ["120 cari -10000", "128 cari 10000"], "kaynağın hesap farkı (A 128 → A 120)");
      assert.deepEqual(after.excluded.map(item => `${item.account} ${item.party === ids.party ? "cari" : item.party} ${item.minor} ${item.subledger}`).sort(), ["120 cari -10000 true", "128 cari 10000 true"], "120 / 128 farkı dışarıda (alt defter hesabı)");
      for (const item of after.excluded) assert.match(item.reason, /Alt defter hesabı/);
      const ruleAfter = await integrity(api);
      assert.equal(ruleAfter.item?.count, 2, "Mutabakat Testi'nde kural farkı kaydı 1 → 2");
      assert.ok(ruleAfter.item.sample.some(text => text.startsWith(`account:${ids.entry}`)), `Mutabakat Testi kaydı adıyla gösterir: ${JSON.stringify(ruleAfter.item.sample)}`);
      const post = await api.post(URL, { requestId: rid(), digest: after.digest, confirm: true });
      assert.equal(post.status, 200, JSON.stringify(post.data).slice(0, 300));
      const lines = app.store.all("SELECT l.account, l.sub, l.debit_minor AS debit, l.credit_minor AS credit FROM ledger_vouchers v JOIN ledger_voucher_lines l ON l.voucher_id = v.id WHERE v.type = 'rule-diff-correction'");
      assert.deepEqual(lines.map(line => `${line.debit ? "B" : "A"} ${line.sub || line.account} ${(line.debit || line.credit) / 100}`).sort(), ["A 519 800", "B 500 800"], "fiş yalnız gerçek kural farkı: 120 / 128 satırı yok");
      assert.equal(app.store.get("SELECT COUNT(*) AS n FROM ledger_vouchers").n, 1);
      // Tur 2e DÜŞÜK-2 (dar kontrol c5a2 N4): fiş yazıldıktan SONRA dışarıda kalan alt defter farkı (120 / 128, 100 TL) sürüyor → "Düzeltildi" DEĞİL; uyarı ve ipucu B14'ü söyler.
      const fixed = await integrity(api);
      assert.ok(fixed.item && fixed.item.ok === false && !fixed.item.corrected, `dışarıda kalan alt defter farkı varken Düzeltildi yok: ${JSON.stringify(fixed.item).slice(0, 400)}`);
      assert.equal(fixed.item.correction?.remainderMinor, 0, "fişle düzeltilebilen fark kalmadı");
      assert.equal(fixed.item.correction?.excludedMinor, 10_000, "dışarıda kalan 100 TL");
      assert.match(fixed.item.hint, /fişle düzeltilebilen farkı kapattı; alt defter hesabı farkı fişle düzeltilmez/);
    } finally {
      await server?.close().catch(() => {});
      rmSync(root, { recursive: true, force: true });
    }
  });

  it("[6] kilitsiz v2.4.9 verisi: ön izleme pasif (kilit yok), fiş yazılmaz, Mutabakat Testi çıktısı değişmez", { timeout: 240_000 }, async () => {
    const name = "surum-2.4.9-s127-kilitsiz";
    const ctx = await open(name);
    try {
      const { api } = ctx;
      const before = await integrity(api);
      const view = (await api.get(URL)).data;
      assert.equal(view.disabled, true);
      assert.equal(view.code, "rule-diff-no-lock");
      assert.equal((await api.post(URL, { requestId: rid(), digest: view.digest, confirm: true })).status, 409);
      assert.deepEqual(await integrity(api), before, "kilitsiz veride Mutabakat Testi aynı");
      assert.equal(before.item, null, "kilitsiz veride kural farkı öğesi yok");
    } finally {
      await ctx.close();
    }
  });
});
