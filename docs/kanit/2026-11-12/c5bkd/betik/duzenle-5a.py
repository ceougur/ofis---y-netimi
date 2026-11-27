"""Madde 5 — test/takvim-govde-250.test.mjs: tembel bölüm yerine 'eski sorgu hakem' eşdeğerlik bölümü. Çalışma ağacının kökünden."""
p = "test/takvim-govde-250.test.mjs"
s = open(p, encoding="utf-8").read()
start = s.index('describe("Tek carinin kuyruğunda çek / senet bağlarının anı yalnız SORULUNCA okunur')
new = r'''describe("Tek carinin kuyruğunda çek / senet bağlarının anı: carinin KENDİ evrak satırlarından sürülen sorgu ≡ önceki sorgu (kilit açık; gerçek program)", () => {
  let server;
  let admin;
  const sqlSeen = [];
  let restore = null;
  let store;
  const must = async (label, promise) => {
    const res = unwrap(await promise);
    assert.equal(res.status, 200, `${label}: ${res.status} ${JSON.stringify(res.data).slice(0, 300)}`);
    return res.data;
  };
  // HAKEM: düzeltmeden önceki tek cari sorgusu (routes/invoices.mjs chequeLinkMoments, 8d6ea9c9) — bütün ilk olaylar taranıp cariye süzülür.
  const OLD_SQL = `SELECT ev.effects_json AS effects, ev.created_at AS created,
           (SELECT MAX(a.created_at) FROM audit_events a WHERE a.entity_id = ev.cheque_id AND a.type = 'cheque.updated' AND json_extract(a.payload_json, '$.invoiceId') IS NOT NULL) AS changed
         FROM cheque_events ev JOIN cheques c ON c.id = ev.cheque_id
         WHERE ev.kind IN ('receive', 'issue') AND ev.invoice_id <> '' AND (c.account_id = ? OR c.endorse_account_id = ? OR ev.account_id = ?)`;
  const mapOf = rows => {
    const out = new Map();
    for (const row of rows) {
      const at = String(row.changed || "") > String(row.created || "") ? String(row.changed) : String(row.created || "");
      if (!at) continue;
      const effects = JSON.parse(row.effects || "[]");
      for (const effect of Array.isArray(effects) ? effects : []) if (effect?.table === "account_entries" && effect.id) out.set(effect.id, at);
    }
    return out;
  };
  const isMoments = sql => /cheque\.updated/.test(sql) && /cheque_events ev/.test(sql);
  before(async () => {
    // Akan saat: bağı değiştiren düzeltmenin anı kaydın anından SONRA olsun (gerçek kurulum).
    let at = Date.parse(NOW);
    server = await startTestServer({ now: () => (at += 1000), env: { HUKUK_LICENSE_URL: "http://127.0.0.1:9" } });
    admin = await loginAdmin(server);
    await admin.post("/api/workspace/bank/setup/dismiss", {});
    store = server.app.store;
    const original = store.all.bind(store);
    store.all = (sql, ...args) => {
      const rows = original(sql, ...args);
      if (isMoments(String(sql))) sqlSeen.push({ sql: String(sql), args, rows });
      return rows;
    };
    restore = () => { store.all = original; };
  });
  after(async () => {
    restore?.();
    await server?.close();
  });

  it("evrakı faturaya bağlı (düzeltmeyle bağı değişmiş, ciro edilmiş, bağsız) cariler: programın tek cari sorgusu, carinin HER defter satırı için önceki sorguyla aynı anı verir", async () => {
    const item = await must("hizmet", admin.post("/api/workspace/stock", { kind: "service", code: "HZM-AN", name: "Hizmet", unit: "Adet", salePrice: "1000" }));
    const account = (name, type = "customer", n = 1) => must("cari", admin.post("/api/workspace/accounts", { name, type, registeredOn: day(-400), phone: `0500 257 30 ${String(n).padStart(2, "0")}` }));
    const sale = (acc, date, amount) => must("fatura", admin.post("/api/workspace/invoices", { scenario: "service_sale", accountId: acc.id, issueDate: date, lines: [{ itemId: item.id, qty: 1, unitPrice: String(amount), vatRate: 0 }], payment: { rest: "open", dueDate: date }, cashForce: true })).then(doc => doc.id);
    const cheque = body => must("çek", admin.post("/api/workspace/cheques", { direction: "in", instrument: "cheque", issueDate: day(-30), dueDate: day(40), ...body }));
    const a = await account("An Bağlı", "customer", 1); // iki fatura; çek F2'ye bağlı, sonra düzeltmeyle F1'e
    const b = await account("An Ciro Alan", "supplier", 2); // a'nın bağlı çeki buna ciro edilir
    const c = await account("An Bağsız Çekli", "customer", 3); // bağsız çek
    const d = await account("An Çeksiz", "customer", 4); // hiç evrak yok
    const e = await account("An İki Çekli", "customer", 5); // iki bağlı çek; birinin tutarı düzeltilir (satırlar yeniden yazılır)
    const f1 = await sale(a, day(-50), 300);
    const f2 = await sale(a, day(-45), 300);
    const ch1 = await cheque({ amount: "300", serialNo: "AN-1", accountId: a.id, invoiceId: f2 });
    await must("çek bağı F1'e", admin.put(`/api/workspace/cheques/${ch1.id}`, { invoiceId: f1 }));
    const ch2 = await cheque({ amount: "200", serialNo: "AN-2", accountId: a.id, invoiceId: f2 });
    await must("ciro", admin.post(`/api/workspace/cheques/${ch2.id}/actions`, { action: "endorse", date: day(-6), accountId: b.id }));
    await cheque({ amount: "150", serialNo: "AN-3", accountId: c.id });
    await must("borç", admin.post(`/api/workspace/accounts/${d.id}/entries`, { kind: "debt", amount: "100", date: day(-20), note: "d", similarOk: true }));
    const e1 = await sale(e, day(-40), 500);
    const e2 = await sale(e, day(-35), 400);
    await cheque({ amount: "500", serialNo: "AN-4", accountId: e.id, invoiceId: e1 });
    const ch5 = await cheque({ amount: "400", serialNo: "AN-5", accountId: e.id, invoiceId: e2 });
    await must("çek tutarı düzelt (satırlar yeniden yazılır; bağ aynı)", admin.put(`/api/workspace/cheques/${ch5.id}`, { amount: "350" }));
    await must("kilit", admin.put("/api/admin/period-lock", { lockedUntil: day(-90) }));
    let asked = 0;
    let known = 0;
    for (const acc of [a, b, c, d, e]) {
      sqlSeen.length = 0;
      // Tek carinin kuyruğunu kurduran yazım: Borç Yaz (yanıt cari kartını döndürür).
      await must("Borç Yaz", admin.post(`/api/workspace/accounts/${acc.id}/entries`, { kind: "debt", amount: "10", date: day(-1), note: "an", similarOk: true }));
      const mine = sqlSeen.filter(row => row.args.includes(acc.id));
      assert.ok(mine.length >= 1, `${acc.name}: kilit açıkken tek carinin kuyruğu evrak bağı anlarını okudu`);
      const got = mapOf(mine.at(-1).rows);
      const want = mapOf(store.all(OLD_SQL, acc.id, acc.id, acc.id));
      for (const line of store.all("SELECT id FROM account_entries WHERE account_id = ?", acc.id)) {
        asked += 1;
        if (want.has(line.id)) known += 1;
        assert.equal(got.get(line.id), want.get(line.id), `${acc.name}: defter satırı ${line.id} için bağın anı önceki sorguyla aynı`);
      }
    }
    assert.ok(asked >= 12 && known >= 4, `ön koşul: sorulan defter satırı ${asked}, haritada olan ${known} (bağlı evrak satırları gerçekten sınandı)`);
    // Düzeltmeyle değişen bağın anı kaydın anından sonradır (iz okunuyor) — yeni sorgu bunu da taşır.
    const rowA = store.get("SELECT id, created_at AS at FROM account_entries WHERE account_id = ? AND source = 'cheque' AND source_id = ?", a.id, ch1.id);
    sqlSeen.length = 0;
    await must("Borç Yaz", admin.post(`/api/workspace/accounts/${a.id}/entries`, { kind: "debt", amount: "5", date: day(-1), note: "an2", similarOk: true }));
    const moment = mapOf(sqlSeen.filter(row => row.args.includes(a.id)).at(-1).rows).get(rowA.id);
    assert.ok(moment > rowA.at, `bağı düzeltmeyle değişen çekin anı (${moment}) satırın kayıt anından (${rowA.at}) sonra`);
    // Tek cari sorgusu artık bütün ilk olayları taramaz: carinin evrak satırı yoksa (d) hiç olay satırı dönmez; sorgu carinin kendi evraklarından sürülür.
    assert.match(sqlSeen.at(-1).sql, /FROM \(SELECT DISTINCT source_id AS id FROM account_entries WHERE account_id = \?1 AND \+source = 'cheque'\) own/, "tek cari sorgusu carinin kendi evrak satırlarından sürülüyor (hız düzeltmesinin dişi)");
  });
});
'''
s = s[:start] + new
a = '''//   (2) Tek carinin kuyruğunda çek / senet bağlarının anı yalnız kuyruk sorarsa okunur (routes/invoices.mjs lazyMoments) — sayılar aynı; kilit açıkken bağlı evrakın
//       kilit davranışı test/tyk-tur2b1-250.test.mjs'te (değişmedi), burada "sorulmayan caride sorgu koşmaz, sorulanda koşar" dişi.'''
b = '''//   (2) Tek carinin kuyruğunda çek / senet bağlarının anı carinin KENDİ evrak satırlarından sürülen sorguyla okunur (routes/invoices.mjs chequeLinkMoments; önceden bütün
//       ilk olaylar taranıyordu — Borç Yaz başına ~16 ms). Hakem önceki sorgu: carinin her defter satırı için aynı an. Kilit davranışı test/tyk-tur2b1-250.test.mjs'te.'''
assert s.count(a) == 1
open(p, "w", encoding="utf-8").write(s.replace(a, b))
print("tamam")
