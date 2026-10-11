// 2.0.13 müşteri talebi: WhatsApp ile tek/toplu ekstre ve toplu mesaj. Sunucu alıcıları hazırlar (numara doğrulama,
// bakiye, sıradaki taksit, kişiye özel ekstre metni); her gönderim cari kartına kaydedilir.
import assert from "node:assert/strict";
import { after, before, describe, it } from "node:test";
import { statementText, waNumber } from "../server/routes/whatsapp.mjs";
import { loginAdmin, startTestServer } from "./helpers.mjs";

const ok = (response, label) => {
  assert.equal(response.status, 200, `${label}: ${JSON.stringify(response.data)}`);
  return response.data.data;
};

describe("WhatsApp numara ve ekstre metni", () => {
  it("Türkiye cep numaralarını wa.me biçimine çevirir; sabit hattı ve eksik numarayı ayırır", () => {
    assert.deepEqual(waNumber("0537 454 65 76"), { wa: "905374546576", valid: true, reason: "" });
    assert.equal(waNumber("+90 (532) 777-66-55").wa, "905327776655");
    assert.equal(waNumber("5327776655").wa, "905327776655");
    assert.equal(waNumber("0090 532 777 66 55").wa, "905327776655");
    assert.equal(waNumber("").valid, false);
    assert.equal(waNumber("0537 454 65 76 / 0212 555 44 33").wa, "905374546576", "hücrede iki numara: ilki");
    assert.match(waNumber("0212 555 44 33").reason, /Sabit hat/);
    assert.match(waNumber("0532 777 66").reason, /eksik/);
    assert.equal(waNumber("+49 1512 3456789").valid, true, "yurt dışı ülke kodlu");
  });
  it("ekstre metni devir, dönem hareketleri ve güncel bakiyeyi verir", () => {
    const lines = [
      { date: "2026-08-10", label: "Borç", note: "", debit: 1000, credit: 0, balance: 1000 },
      { date: "2026-09-05", label: "Satış", note: "Bebek bezi", debit: 500, credit: 0, balance: 1500 },
      { date: "2026-09-20", label: "Tahsilat", note: "", debit: 0, credit: 700, balance: 800 },
    ];
    const text = statementText({ office: "Demir Market", account: { name: "Tülay Arıkan" }, lines, range: { from: "2026-09-01", to: "2026-09-30" }, next: null, overdue: { count: 1, amount: 300 } });
    assert.match(text, /Sayın Tülay Arıkan/);
    assert.match(text, /Devir: 1\.000,00 TL \(borcunuz\)/);
    assert.match(text, /05\.09\.2026 Satış · Bebek bezi: \+500,00 TL/);
    assert.match(text, /20\.09\.2026 Tahsilat: −700,00 TL/);
    assert.match(text, /\*Güncel bakiye: 800,00 TL \(borcunuz\)\*/);
    assert.match(text, /Vadesi geçen: 1 taksit/);
    assert.doesNotMatch(text, /10\.08\.2026/, "dönem dışı hareket listelenmez");
  });
});

describe("WhatsApp gönderim API'si", () => {
  let server;
  let admin;
  let tulay;
  let sabit;
  let bos;
  before(async () => {
    server = await startTestServer();
    admin = await loginAdmin(server);
    tulay = ok(await admin.post("/api/workspace/accounts", { name: "Tülay Arıkan", phone: "0537 454 65 76", openingBalance: "1.250" }), "cari");
    sabit = ok(await admin.post("/api/workspace/accounts", { name: "Kemal Bakkal", phone: "0212 555 44 33" }), "sabit hat");
    bos = ok(await admin.post("/api/workspace/accounts", { name: "Numarasız Cari" }), "numarasız");
  });
  after(async () => server?.close());

  it("seçilen carilere kişiye özel ekstre hazırlar; numarası geçersiz olanı nedeniyle ayırır", async () => {
    const result = ok(await admin.post("/api/workspace/whatsapp/targets", { ids: [tulay.id, sabit.id, bos.id], kind: "statement", preset: "all" }), "hazırla");
    assert.equal(result.recipients.length, 3);
    const t = result.recipients.find(item => item.id === tulay.id);
    assert.equal(t.valid, true);
    assert.equal(t.wa, "905374546576");
    assert.equal(t.balance, 1250);
    assert.match(t.statement, /Güncel bakiye: 1\.250,00 TL \(borcunuz\)/);
    assert.match(result.recipients.find(item => item.id === sabit.id).reason, /Sabit hat/);
    assert.equal(result.recipients.find(item => item.id === bos.id).reason, "Telefon yok");
  });
  it("süzgeçteki carilerin hepsi (all) seçilebilir; seçim yoksa hata verir", async () => {
    const all = ok(await admin.post("/api/workspace/whatsapp/targets", { all: true, kind: "message", balance: "debtor" }), "hepsi");
    assert.deepEqual(all.recipients.map(item => item.id), [tulay.id], "yalnız borçlu süzgeci");
    assert.equal(all.recipients[0].statement, "", "mesajda ekstre metni hazırlanmaz");
    const empty = await admin.post("/api/workspace/whatsapp/targets", { ids: [] });
    assert.equal(empty.status, 400);
  });
  it("gönderim ve atlama cari kartının geçmişine yazılır; son gönderim alıcı listesinde görünür", async () => {
    ok(await admin.post("/api/workspace/whatsapp/log", { batchId: "wa-test", accountId: tulay.id, kind: "statement", phone: "905374546576", body: "Sayın Tülay…", status: "sent" }), "gönderildi");
    ok(await admin.post("/api/workspace/whatsapp/log", { batchId: "wa-test", accountId: sabit.id, kind: "statement", status: "skipped" }), "atlandı");
    const history = ok(await admin.get(`/api/workspace/whatsapp/history?accountId=${tulay.id}`), "geçmiş");
    assert.equal(history.length, 1);
    assert.equal(history[0].kind, "statement");
    assert.equal(history[0].status, "sent");
    const again = ok(await admin.post("/api/workspace/whatsapp/targets", { ids: [tulay.id], kind: "message" }), "tekrar");
    assert.ok(again.recipients[0].lastSend?.at, "son gönderim tarihi");
    const bad = await admin.post("/api/workspace/whatsapp/log", { accountId: "yok", status: "sent" });
    assert.equal(bad.status, 400);
  });
});
