// 2.0.22 bağımsız gözden geçirme bulguları (çalıştırılarak doğrulananlar; sunucu tarafı) — her biri düzeltmeden önce kırmızıydı.
//  2. Fatura ödeme durumu önbelleği yalnız kendi bağlantısının yazmalarını görüyordu (total_changes): veri dosyasını paylaşan
//     şirketin (2.0.17–2.0.19'dan kalan, "Ayır" yapılmamış kurulum) tahsilatı fatura listesinde görünmüyordu.
//  5. Aynı formun "Taslak Olarak Kaydet"i (yanıt kayboldu) ve ardından "Kaydet"i ayrı işlem sayılıyordu: bir taslak + bir
//     kaydedilmiş fatura açılıyordu. Silinmiş faturanın kimliğiyle gelen yineleme 404 "Fatura bulunamadı" diyordu.
//  6. Cari türü olarak "constructor", "toString", "__proto__" gibi değerler (Excel Tür eşlemesi, doğrudan API) 500 veriyor ya da
//     cariye tanımsız tür yazılıyordu.
//  7. Tür Değerleri'nde tanınan bir değer ("Tedarikçi") için "Varsayılan Tür" seçimi etkisizdi.
// 10. Yalnız Cari No değişince olay "bilgi" sayılıyordu: carinin numarasını gösteren açık pencereler (taksit, fatura) yenilenmiyordu.
import assert from "node:assert/strict";
import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { after, before, describe, test } from "node:test";
import { accountTypeKey } from "../server/lib/accounts.mjs";
import { createUser, loginAdmin, startTestServer } from "./helpers.mjs";

const data = response => (response.data && typeof response.data === "object" && "ok" in response.data ? (response.data.ok ? response.data.data : response.data) : response.data);
const pad = value => String(value).padStart(2, "0");
const now = new Date();
const TODAY = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
const ID = suffix => `inceleme-222-${suffix}-0123456789abcdef`;

describe("2: veri dosyasını paylaşan şirketlerde fatura ödeme durumu", () => {
  let server;
  let api;
  before(async () => {
    server = await startTestServer({
      prepare: ({ dataDir }) => {
        mkdirSync(path.join(dataDir, "sirketler", "002"), { recursive: true });
        writeFileSync(path.join(dataDir, "sirketler.json"), JSON.stringify({ companies: [
          { id: "sirket-001", code: "001", name: "Ana Şirket", dir: "", createdAt: "2026-09-01T08:00:00.000Z", createdBy: "" },
          { id: "sirket-eski", code: "005", name: "Eski Şirket", dir: "sirketler/002", createdAt: "2026-10-01T08:00:00.000Z", createdBy: "" },
          { id: "sirket-yeni", code: "002", name: "Yeni Şirket", dir: "sirketler/002", createdAt: "2026-10-02T08:00:00.000Z", createdBy: "" },
        ] }));
      },
    });
    api = await loginAdmin(server);
  });
  after(() => server.close());

  test("öbür şirketin bağlantısından girilen tahsilat listede de görünür (kartla aynı)", async () => {
    const as = company => `hofCompany=${company}`;
    const item = data(await api.post(`/api/workspace/stock?${as("sirket-eski")}`, { name: "Ürün", code: "P-1", unit: "Adet", unitPrice: 10, salePrice: 100 })).id;
    const invoices = [];
    // Toplu (önbellekli) yol 8'den çok carili listede devreye girer.
    for (let index = 0; index < 10; index += 1) {
      const account = data(await api.post(`/api/workspace/accounts?${as("sirket-eski")}`, { name: `Müşteri ${index}`, type: "customer" })).id;
      const invoice = await api.post(`/api/workspace/invoices?${as("sirket-eski")}`, { scenario: "goods_sale", accountId: account, issueDate: TODAY, lines: [{ itemId: item, qty: 1, unitPrice: 100, vatRate: 0 }], payment: { rest: "open" }, force: true });
      assert.equal(invoice.status, 200, JSON.stringify(invoice.data));
      invoices.push({ id: data(invoice).id, account });
    }
    const listed = async () => data(await api.get(`/api/workspace/invoices?${as("sirket-eski")}&tab=sale&limit=5000`)).invoices.find(item => item.id === invoices[0].id);
    assert.equal((await listed()).paid, 0);
    const pay = await api.post(`/api/workspace/accounts/${invoices[0].account}/entries?${as("sirket-yeni")}`, { kind: "in", amount: 100, date: TODAY, method: "cash", invoiceId: invoices[0].id });
    assert.equal(pay.status, 200, JSON.stringify(pay.data));
    const card = data(await api.get(`/api/workspace/invoices/${invoices[0].id}?${as("sirket-eski")}`));
    assert.equal(card.paid, 100, "kart (cari başına yol) tahsilatı görür");
    const row = await listed();
    assert.equal(row.paid, card.paid, "liste (toplu, önbellekli yol) kartla aynı");
    assert.equal(row.payState, card.payState);
  });
});

describe("5, 6, 7, 10: tek sunucu", () => {
  let server;
  let admin;
  let watcher;
  let customer;
  let item;
  const sale = (extra = {}) => ({ scenario: "goods_sale", accountId: customer, issueDate: TODAY, lines: [{ itemId: item, qty: 1, unitPrice: 500, vatRate: 20 }], payment: { rest: "open" }, force: true, ...extra });
  const post = (body, requestId) => admin.post("/api/workspace/invoices", body, requestId ? { "x-hof-request": requestId } : undefined);
  const docs = async () => data(await admin.get("/api/workspace/invoices?tab=all&limit=5000")).invoices;
  before(async () => {
    server = await startTestServer();
    admin = await loginAdmin(server);
    watcher = await createUser(server, admin, { username: "izleyici222", role: "muhasebe" });
    customer = data(await admin.post("/api/workspace/accounts", { name: "İnceleme Müşterisi", type: "customer" })).id;
    item = data(await admin.post("/api/workspace/stock", { name: "İnceleme Ürünü", code: "INC-1", unit: "Adet", unitPrice: 100, salePrice: 500 })).id;
  });
  after(() => server.close());

  test("5: aynı form önce taslak (yanıt kayboldu), sonra Kaydet → ikinci belge açılmaz, taslak söylenir", async () => {
    const before = (await docs()).length;
    const draft = await post({ ...sale(), status: "draft" }, ID("taslak"));
    assert.equal(draft.status, 200, JSON.stringify(draft.data));
    const issued = await post(sale(), ID("taslak"));
    assert.equal(issued.status, 409, JSON.stringify(issued.data));
    assert.equal(issued.data.code, "request-id-reused");
    assert.match(issued.data.error, /taslak/i);
    assert.equal((await docs()).length - before, 1, "yalnız taslak var");
    // Aynı taslak isteğinin yinelemesi taslağı döndürür (ikinci taslak açılmaz).
    const again = await post({ ...sale(), status: "draft" }, ID("taslak"));
    assert.equal(again.status, 200);
    assert.equal(data(again).id, data(draft).id);
    assert.equal(data(again).replayed, true);
    assert.equal((await docs()).length - before, 1);
  });

  test("5: kaydedilen fatura silindikten sonra aynı kimlikle yineleme → açık neden (404 değil), yeni belge açılmaz", async () => {
    const first = await post({ ...sale(), status: "draft" }, ID("silinen"));
    assert.equal(first.status, 200);
    assert.equal((await admin.del(`/api/workspace/invoices/${data(first).id}`)).status, 200);
    const before = (await docs()).length;
    const again = await post({ ...sale(), status: "draft" }, ID("silinen"));
    assert.equal(again.status, 409, JSON.stringify(again.data));
    assert.equal(again.data.code, "request-id-gone");
    assert.match(again.data.error, /silindi/);
    assert.equal((await docs()).length, before);
  });

  test("5: aynı kimlikle aynı anda 6 istek → tek fatura", async () => {
    const before = (await docs()).length;
    const results = await Promise.all(Array.from({ length: 6 }, () => post(sale(), ID("esz"))));
    assert.deepEqual([...new Set(results.map(result => result.status))], [200]);
    assert.equal(new Set(results.map(result => data(result).id)).size, 1);
    assert.equal((await docs()).length - before, 1);
  });

  test("6: nesne kalıtımından gelen adlar cari türü sayılmaz (500 yok, tanımsız tür yazılmaz)", async () => {
    const matrix = [["Ad Soyad", "Telefon", "Tür"], ["Proto Bir", "05321112233", "Garip"], ["Proto İki", "05321112234", "Garip2"], ["Proto Üç", "05321112235", "Garip3"]];
    const preview = data(await admin.post("/api/workspace/accounts/import/preview", { matrix, typeMap: { garip: "constructor", garip2: "toString", __proto__: "supplier" } }));
    assert.ok(preview.roles, JSON.stringify(preview));
    const imported = await admin.post("/api/workspace/accounts/import", { matrix, headerAt: 0, roles: preview.roles, type: "customer", typeMap: { garip: "constructor", garip2: "toString", garip3: "__proto__" }, mode: "skip" });
    assert.equal(imported.status, 200, JSON.stringify(imported.data));
    assert.equal(data(imported).created, 3);
    assert.equal(data(imported).typeDefaultedTotal, 3, "üçü de varsayılan türle açılır ve raporlanır");
    const created = data(await admin.get("/api/workspace/accounts?status=all&q=Proto")).accounts;
    assert.deepEqual(created.map(account => account.type).sort(), ["customer", "customer", "customer"]);
    const direct = await admin.post("/api/workspace/accounts", { name: "Doğrudan Proto", type: "valueOf" });
    assert.equal(direct.status, 200);
    assert.equal(data(direct).type, "customer");
    for (const type of ["constructor", "__proto__", "hasOwnProperty"]) {
      const list = await admin.get(`/api/workspace/accounts?status=all&type=${type}`);
      assert.equal(list.status, 200, `liste süzgeci ${type}`);
      const search = await admin.get(`/api/workspace/accounts/search?q=Proto&type=${type}`);
      assert.equal(search.status, 200, `arama süzgeci ${type}`);
    }
    const ledger = await admin.get("/api/workspace/ledger");
    assert.equal(ledger.status, 200);
  });

  test("7: tanınan değer için \"Varsayılan Tür\" seçilirse varsayılan tür yazılır (uyarısız)", async () => {
    const matrix = [["Ad Soyad", "Tür"], ["Varsayılan Ali", "Tedarikçi"], ["Varsayılan Ayşe", "Müşteri/Tedarikçi"]];
    const preview = data(await admin.post("/api/workspace/accounts/import/preview", { matrix }));
    const typeMap = { [accountTypeKey("Tedarikçi")]: "default" };
    const gate = data(await admin.post("/api/workspace/accounts/import/preview", { matrix, roles: preview.roles, typeMap }));
    const warned = (gate.gate?.issues || []).filter(issue => issue.column === "Tür").map(issue => issue.row);
    assert.equal(warned.length, 1, `yalnız seçilmemiş iki türlü satır uyarılır: ${JSON.stringify(gate.gate?.issues)}`);
    const imported = data(await admin.post("/api/workspace/accounts/import", { matrix, headerAt: 0, roles: preview.roles, type: "customer", typeMap, mode: "skip" }));
    assert.equal(imported.created, 2);
    assert.equal(imported.typeDefaultedTotal, 1, "yalnız seçilmeyen iki türlü değer raporlanır");
    const list = data(await admin.get("/api/workspace/accounts?status=all&q=Varsayılan")).accounts;
    assert.deepEqual(Object.fromEntries(list.map(account => [account.name, account.type])), { "Varsayılan Ali": "customer", "Varsayılan Ayşe": "customer" });
  });

  test("10: yalnız Cari No değişince olay bilgi sayılmaz (numarayı gösteren pencereler yenilenir)", async () => {
    const account = data(await admin.post("/api/workspace/accounts", { name: "Olay Carisi", type: "customer", refNo: "9100" }));
    const events = [];
    const controller = new AbortController();
    const response = await fetch(`${server.base}/api/events`, { headers: { cookie: watcher.cookie, accept: "text/event-stream" }, signal: controller.signal });
    const reader = response.body.getReader();
    const reading = (async () => {
      let buffer = "";
      try {
        for (;;) {
          const { value, done } = await reader.read();
          if (done) break;
          buffer += new TextDecoder().decode(value);
          let at;
          while ((at = buffer.indexOf("\n\n")) >= 0) {
            const chunk = buffer.slice(0, at);
            buffer = buffer.slice(at + 2);
            const event = /event: (.*)/.exec(chunk)?.[1];
            const payload = /data: (.*)/.exec(chunk)?.[1];
            if (event === "workspace.changed") events.push(JSON.parse(payload));
          }
        }
      } catch {}
    })();
    await new Promise(resolve => setTimeout(resolve, 300));
    const put = await admin.put(`/api/workspace/accounts/${account.id}`, { ...account, refNo: "9177" });
    assert.equal(put.status, 200);
    assert.equal(data(put).refNo, "9177");
    await new Promise(resolve => setTimeout(resolve, 700));
    const afterRef = events.splice(0);
    assert.ok(afterRef.length, "olay geldi");
    assert.ok(afterRef.some(event => !event.info), `Cari No değişimi bilgi olayı değil: ${JSON.stringify(afterRef)}`);
    assert.ok(afterRef.some(event => event.kind === "plans"), "taksit pencereleri de haber alır");
    // Yalnız not değişince olay bilgi olarak kalır (ANLIK DURUM ve para pencereleri yenilenmez).
    await admin.put(`/api/workspace/accounts/${account.id}`, { ...data(put), note: "yalnız not" });
    await new Promise(resolve => setTimeout(resolve, 700));
    const afterNote = events.splice(0);
    assert.ok(afterNote.length && afterNote.every(event => event.info), `not düzeltmesi bilgi olayı: ${JSON.stringify(afterNote)}`);
    controller.abort();
    await reading;
  });
});
