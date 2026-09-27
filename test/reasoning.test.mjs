// Mantık denetimi (v2.0.1): veriden kural öğrenme, uymayan kayıtlar, yanlış alarm vermeme, tahsilat tutarlılığı.
import assert from "node:assert/strict";
import { after, before, describe, it } from "node:test";
import { reasonAbout } from "../server/lib/insight/reasoning.mjs";
import { loginAdmin, startTestServer } from "./helpers.mjs";

const tl = value => `${new Intl.NumberFormat("tr-TR", { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(value)} ₺`;
function installments(count = 40) {
  const rows = [];
  for (let i = 1; i <= count; i += 1) {
    const total = 10_000 + i * 1000;
    const t1 = 2000;
    const t2 = i % 3 ? 1500 : 0;
    const t3 = i % 5 ? 0 : 1000;
    const rest = total - t1 - t2 - t3;
    rows.push({ __hofKey: `M-${i}`, __sheet: "Taksitler", "Müşteri No": `M-${i}`, Müşteri: `Kişi ${i}`, Tutar: tl(total), "Taksit 1": tl(t1), "Taksit 2": t2 ? tl(t2) : "", "Taksit 3": t3 ? tl(t3) : "", Kalan: tl(rest), Durum: "Borçlu", Başlangıç: `0${1 + (i % 9)}.03.2025`, Bitiş: `0${1 + (i % 9)}.03.2026` });
  }
  return rows;
}

describe("mantık denetimi: kural öğrenme", () => {
  it("Kalan = Tutar − taksitler kuralını öğrenir; uymayan kayıtta doğru değeri önerir", () => {
    const rows = installments();
    rows[4].Kalan = tl(99_999);
    const result = reasonAbout(rows, { tabs: ["Taksitler"], now: new Date("2026-09-27") });
    assert.deepEqual(result.relations.map(item => item.text), ["Kalan = Tutar − (Taksit 1 + Taksit 2 + Taksit 3)"]);
    const [finding] = result.findings.filter(item => item.rule === "relation");
    assert.equal(finding.key, "M-5");
    assert.deepEqual(finding.suggest, { field: "Kalan", value: "10.500,00 ₺" });
    assert.match(finding.why, /%98'inde/);
  });

  it("durum–bakiye, tarih sırası, yıl hatası, eksi değer ve fazladan sıfır bulunur", () => {
    const rows = installments();
    rows[7].Durum = "Ödendi";
    rows[9].Bitiş = "01.01.2024";
    rows[11].Başlangıç = "05.03.2062";
    rows[13].Tutar = tl(2_500_000);
    rows[13].Kalan = tl(2_500_000 - 3500);
    rows[15].Kalan = tl(-500);
    rows[15].Tutar = tl(16_000 + 3000);
    rows[15]["Taksit 1"] = tl(19_500);
    const found = reasonAbout(rows, { tabs: ["Taksitler"], now: new Date("2026-09-27") }).findings.map(item => `${item.rule}:${item.key}`);
    for (const expected of ["status:M-8", "order:M-10", "year:M-12", "outlier:M-14", "negative:M-16"]) assert.ok(found.includes(expected), `${expected} bulunamadı: ${found}`);
    assert.ok(!found.includes("outlier:M-14") || found.filter(item => item === "outlier:M-14").length === 1, "türetilmiş uç değer ikinci kez raporlanmaz");
  });

  it("rastgele ve kuralsız veride yanlış alarm vermez", () => {
    let seed = 7;
    const random = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
    const rows = Array.from({ length: 80 }, (_, i) => ({ __hofKey: `N${i}`, A: String(Math.round(random() * 1000)), B: String(Math.round(random() * 1000)), C: String(Math.round(random() * 1000)), Tarih: `${String(1 + (i % 28)).padStart(2, "0")}.0${1 + (i % 9)}.2025`, Durum: i % 2 ? "Açık" : "Kapalı" }));
    const result = reasonAbout(rows);
    assert.equal(result.relations.length, 0);
    assert.equal(result.findings.filter(item => item.severity === "warn").length, 0);
  });

  it("telefon, kimlik ve toplam satırı sayı sayılmaz; toplam satırı kurala karışmaz", () => {
    const rows = installments(20);
    rows.push({ __hofKey: "T", __sheet: "Taksitler", Müşteri: "TOPLAM", Tutar: tl(999_999), Kalan: tl(1) });
    rows.forEach((row, index) => (row.Telefon = `0532 111 22 ${String(index).padStart(2, "0")}`));
    const result = reasonAbout(rows, { tabs: ["Taksitler"] });
    assert.ok(!result.findings.some(item => item.key === "T"), "toplam satırı denetlenmez");
    assert.ok(!result.findings.some(item => (item.fields || []).includes("Telefon")));
  });

  it("200 bin satırda makul sürede biter", () => {
    const big = [];
    for (let i = 0; i < 200_000; i += 1) {
      const total = 1000 + i * 3.17;
      big.push({ __hofKey: `B${i}`, __sheet: "S", No: `2024/${i}`, Tutar: tl(total), "Taksit 1": tl(100 + (i % 97)), "Taksit 2": tl(50), Kalan: tl(total - 150 - (i % 97)), Tarih: `${String(1 + (i % 28)).padStart(2, "0")}.0${1 + (i % 9)}.2025`, Durum: i % 7 ? "Borçlu" : "Takipte" });
    }
    const started = performance.now();
    const result = reasonAbout(big, { tabs: ["S"] });
    assert.equal(result.relations.length, 1);
    assert.ok(performance.now() - started < 6000, `${Math.round(performance.now() - started)} ms`);
  });
});

describe("mantık denetimi: detay kartı uçları", () => {
  let server;
  let admin;
  before(async () => {
    server = await startTestServer();
    admin = await loginAdmin(server);
    const rows = installments();
    rows[4].Kalan = tl(99_999);
    const columns = ["Müşteri No", "Müşteri", "Tutar", "Taksit 1", "Taksit 2", "Taksit 3", "Kalan", "Durum", "Başlangıç", "Bitiş"];
    const matrix = [columns, ...rows.map(row => columns.map(column => row[column]))];
    const staged = await admin.post("/api/workspace/dataset/stage", { kind: "excel", fileName: "taksit.xlsx", sheets: [{ name: "Taksitler", matrix }] });
    assert.equal((await admin.post("/api/workspace/dataset/commit", { stageId: staged.data.data.stageId, mode: "replace" })).status, 200);
    await admin.put("/api/workspace/columns", { columns: { Kalan: "Kalan borç" } });
  });
  after(() => server.close());
  const checks = async key => (await admin.get(`/api/workspace/cases/${encodeURIComponent(key)}/checks`)).data.data.findings;

  it("analiz özeti öğrenilen kuralı ve işaretli kayıtları verir (ofisin kolon adıyla)", async () => {
    const summary = (await admin.get("/api/workspace/insight")).data.data.analysis.reasoning;
    assert.equal(summary.relations[0].text, "Kalan borç = Tutar − (Taksit 1 + Taksit 2 + Taksit 3)");
    assert.equal(summary.warnKeys.length, 1);
    assert.equal(summary.issues[0].id, "relation");
    assert.ok(!("findings" in summary), "tam liste istemciye gitmez");
  });

  it("kayda özel bulgu öneriyle gelir; yoksayılınca bir daha gösterilmez", async () => {
    const key = (await admin.get("/api/workspace/insight")).data.data.analysis.reasoning.warnKeys[0];
    const [finding] = await checks(key);
    assert.match(finding.message, /^Kalan borç 99\.999,00 ₺ görünüyor/);
    assert.equal(finding.suggest.label, "Kalan borç");
    assert.equal((await admin.post("/api/workspace/insight/dismiss", { signature: finding.signature })).status, 200);
    assert.deepEqual(await checks(key), []);
    assert.equal((await admin.get("/api/workspace/insight")).data.data.analysis.reasoning.count, 0);
  });

  it("tahsilat işlenip Kalan değişmediyse boş taksit alanına yazmayı önerir; tahsilat borcu aşarsa uyarır", async () => {
    const rows = (await admin.get(`/api/trpc/sheets.getRows?input=${encodeURIComponent(JSON.stringify({ json: {} }))}`)).data.result.data.json.rows;
    const row = rows.find(item => item["Müşteri"] === "Kişi 1"); // Taksit 3 boş, Kalan 11.000 − 2.000 − 1.500 = 7.500
    await new Promise(resolve => setTimeout(resolve, 5));
    assert.equal((await admin.post(`/api/workspace/cases/${encodeURIComponent(row.__hofKey)}/payments`, { amount: "1.000", date: "2026-09-20" })).status, 200);
    let [finding] = await checks(row.__hofKey);
    assert.equal(finding.rule, "payment");
    assert.match(finding.message, /20\.09\.2026 tarihinden beri 1\.000,00 ₺ tahsilat işlendi; Kalan borç \(7\.500,00 ₺\)/);
    assert.deepEqual({ field: finding.suggest.field, value: finding.suggest.value }, { field: "Taksit 3", value: "1.000,00 ₺" });

    // Öneri uygulanınca (taksit girilir) uyarı kalkar.
    await admin.post("/api/workspace/overrides", { caseKey: row.__hofKey, field: "Taksit 3", value: "1.000,00 ₺" });
    await admin.post("/api/workspace/overrides", { caseKey: row.__hofKey, field: "Kalan", value: "6.500,00 ₺" });
    assert.deepEqual((await checks(row.__hofKey)).filter(item => item.rule === "payment"), []);

    await admin.post(`/api/workspace/cases/${encodeURIComponent(row.__hofKey)}/payments`, { amount: "20.000", date: "2026-09-25" });
    [finding] = (await checks(row.__hofKey)).filter(item => item.signature.startsWith("payment-over"));
    assert.equal(finding.severity, "warn");
    assert.match(finding.message, /Tutar tutarını \(11\.000,00 ₺\) aşıyor/);
  });
});
