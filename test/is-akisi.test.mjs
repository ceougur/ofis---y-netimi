// İş akışı testleri (v2.0.7, CLAUDE.md test kuralı): kullanıcı gözüyle senaryolar, sayılarla karşılaştırma.
// Boş veri; kayıt önce / cari önce / taksit önce; aynı adlı iki kişi; ileri tarihli kasa; karşılıksız çek; yetkili
// personel; mizan = cari listesi; ekstre = kart bakiyesi. Bulgu = test hatası.
import assert from "node:assert/strict";
import { after, before, describe, it } from "node:test";
import { createUser, loginAdmin, startTestServer } from "./helpers.mjs";

describe("iş akışı (v2.0.7)", () => {
  let server;
  let admin;
  let staff;
  let rows = [];
  const near = (a, b) => Math.abs(Number(a) - Number(b)) < 0.005;
  const day = offset => { const t = new Date(); t.setDate(t.getDate() + offset); return `${t.getFullYear()}-${String(t.getMonth() + 1).padStart(2, "0")}-${String(t.getDate()).padStart(2, "0")}`; };
  const get = async (url, client = admin) => { const r = await client.get(url); return { status: r.status, data: r.data?.data, error: r.data?.error }; };
  const post = async (url, body, client = admin) => { const r = await client.post(url, body); return { status: r.status, data: r.data?.data, error: r.data?.error }; };
  const okk = (cond, text) => assert.ok(cond, text);
  const keyOf = name => rows.find(r => r["Öğrenci Adı"] === name)?.__hofKey;
  before(async () => {
    server = await startTestServer();
    admin = await loginAdmin(server);
    staff = await createUser(server, admin, { username: "vezne", name: "Vezne Personeli", role: "personel" });
  });
  after(() => server.close());

  it("A. Boş veri: ekranlar hata vermeden açılır", async () => {
  {
    const ov = await get("/api/workspace/overview");
    okk(ov.status === 200 && ov.data.cash.balance === 0 && ov.data.receivable.total === 0 && ov.data.stock.products === 0, "boş veride ANLIK DURUM sıfırlarla");
    okk((await get("/api/workspace/overview/mizan?preset=thisMonth")).status === 200, "boş mizan");
    okk((await get("/api/workspace/overview/nakit-akisi?preset=next30")).status === 200, "boş nakit akışı");
    okk((await get("/api/workspace/overview/ekstre?preset=thisMonth")).status === 400, "cari seçilmeden ekstre anlaşılır hata");
    const catalog = (await get("/api/workspace/report-center")).data.reports;
    for (const r of catalog) {
      const q = r.params.includes("account") ? "?preset=all&account=yok" : "?preset=all";
      const res = await get(`/api/workspace/report-center/${r.id}${q}`);
      okk(res.status === 200 || (r.params.includes("account") && [400, 404].includes(res.status)), `boş rapor ${r.id}: ${res.status} ${res.error || ""}`);
    }
    okk((await get("/api/workspace/overview/nakit-akisi?from=2026-12-01&to=2026-11-01")).status === 400, "ters tarih aralığı 400");
    okk((await get("/api/workspace/overview/mizan?from=1800-01-01&to=2026-01-01")).status === 400, "100 yıldan uzun aralık 400");
  }
  });

  it("B. Sıra bağımsız bütünlük: kayıt önce / cari önce / taksit önce", async () => {
    let matrix;
  matrix = [["Sıra", "Öğrenci Adı", "Telefon", "Tutar"], ["1", "Kayıt Önce", "0532 100 00 01", "9000"], ["2", "Cari Önce", "0532 100 00 02", "9000"], ["3", "Taksit Önce", "0532 100 00 03", "9000"], ["4", "Ali Ak", "0532 100 00 04", "1000"], ["5", "Ali Ak", "0532 100 00 05", "1000"]];
  const staged = await post("/api/workspace/dataset/stage", { kind: "excel", fileName: "servis.xlsx", sheets: [{ name: "Servis", matrix }] });
  await post("/api/workspace/dataset/commit", { stageId: staged.data.stageId, mode: "replace" });
  rows = (await admin.get(`/api/trpc/sheets.getRows?input=${encodeURIComponent(JSON.stringify({ json: {} }))}`)).data.result.data.json.rows;
  const keyOf = name => rows.find(r => r["Öğrenci Adı"] === name)?.__hofKey;
  {
    // B1 kayıt önce: yeni kayıt formu → cari
    const k1 = keyOf("Kayıt Önce");
    const a1 = (await post(`/api/workspace/cases/${encodeURIComponent(k1)}/account`, { name: "Kayıt Önce", phone: "0532 100 00 01", caseTitle: "1 · Kayıt Önce" })).data;
    const p1 = (await post("/api/workspace/plans", { name: "Kayıt Önce", accountId: a1.id, total: "9.000", mode: "auto", count: 9, firstDue: day(-40) })).data;
    okk(p1.caseKey === k1, "B1: kart, carinin kayıt bağını devraldı");
    // B2 cari önce: cari bağsız açıldı, sonra kayda bağlandı, sonra taksit
    const a2 = (await post("/api/workspace/accounts", { name: "Cari Önce", phone: "0532 100 00 02" })).data;
    const link2 = await post(`/api/workspace/cases/${encodeURIComponent(keyOf("Cari Önce"))}/account`, { name: "Cari Önce", phone: "0532 100 00 02" });
    okk(link2.data.id === a2.id && link2.data.outcome === "linked", "B2: bağsız cari kayda bağlandı, yeni cari açılmadı");
    const p2 = (await post("/api/workspace/plans", { name: "Cari Önce", phone: "0532 100 00 02", total: "9.000", mode: "auto", count: 9, firstDue: day(-40) })).data;
    okk(p2.accountId === a2.id && p2.caseKey === keyOf("Cari Önce"), "B2: cari seçilmeden açılan kart aynı cariye ve kayda bağlandı");
    // B3 taksit önce: kart kayda bağlı açıldı → cari kendiliğinden açılır ve kayda bağlıdır
    const k3 = keyOf("Taksit Önce");
    const p3 = (await post("/api/workspace/plans", { name: "Taksit Önce", phone: "0532 100 00 03", total: "9.000", caseKey: k3, caseTitle: "3 · Taksit Önce", mode: "auto", count: 9, firstDue: day(-40) })).data;
    const linked3 = (await get(`/api/workspace/cases/${encodeURIComponent(k3)}/account`)).data.account;
    okk(linked3 && linked3.id === p3.accountId, "B3: taksit önce açılınca cari kayda bağlı açıldı");
    const again3 = (await post(`/api/workspace/cases/${encodeURIComponent(k3)}/account`, { name: "Taksit Önce", phone: "0532 100 00 03" })).data;
    okk(again3.id === p3.accountId && again3.outcome === "existing", "B3: sonra 'cari kartı da aç' çift cari açmaz");
    const all = (await get("/api/workspace/accounts?status=all")).data.accounts;
    okk(all.length === 3, `B: üç kişi için üç cari (${all.length})`);
  }
  });

  it("C. Aynı adlı iki kişi", async () => {
  {
    const r4 = await post(`/api/workspace/cases/${encodeURIComponent(keyOf("Ali Ak"))}/account`, { name: "Ali Ak", phone: "0532 100 00 04" });
    const k5 = rows.filter(r => r["Öğrenci Adı"] === "Ali Ak")[1].__hofKey;
    const r5 = await post(`/api/workspace/cases/${encodeURIComponent(k5)}/account`, { name: "Ali Ak", phone: "0532 100 00 05" });
    okk(r4.data.id !== r5.data.id, "C: farklı telefonlu aynı ad → iki ayrı cari");
    const pX = (await post("/api/workspace/plans", { name: "Ali Ak", total: "500" })).data;
    okk(pX.accountId !== r4.data.id && pX.accountId !== r5.data.id, "C: telefonsuz 'Ali Ak' kartı tahmin edilmez, yeni cari (yanlış deftere yazılmaz)");
    const dup = await post("/api/workspace/accounts", { name: "Ali Ak", caseKey: k5 });
    okk(dup.status === 409, "C: aynı kayda ikinci cari 409");
  }
  });

  it("D. Kasa: ileri tarihli hareket ANLIK DURUM'da", async () => {
  {
    await post("/api/workspace/cash", { kind: "in", amount: "10000", date: day(-3), description: "Açılış" });
    await post("/api/workspace/cash", { kind: "out", amount: "4000", date: day(15), description: "Kira (ileri tarihli)" });
    const ov = (await get("/api/workspace/overview")).data;
    const flow = (await get("/api/workspace/overview/nakit-akisi?preset=next30")).data;
    okk(near(ov.cash.balance, flow.cashToday), "D: ANLIK DURUM kasası ile nakit akışı başlangıcı aynı sayı (bugünkü kasa)");
    okk(near(ov.cash.balance, 10000), "D: ileri tarihli kira bugünkü kasadan düşmez");
  }
  });

  it("E. Çek/senet: alacak yaşlandırma ve portföy tutarlılığı", async () => {
  {
    const a = (await get("/api/workspace/accounts?status=all")).data.accounts.find(x => x.name === "Kayıt Önce");
    const ch = (await post("/api/workspace/cheques", { direction: "in", accountId: a.id, amount: "2.000", issueDate: day(-20), dueDate: day(-5), serialNo: "K1" })).data;
    const ov = (await get("/api/workspace/overview")).data;
    const aging = (await get("/api/workspace/report-center/alacak-yaslandirma")).data;
    const total = Number(String(aging.summary.find(([l]) => /gecikmiş/i.test(l))?.[1] || "0").replace(/[^\d,]/g, "").replace(",", "."));
    await post(`/api/workspace/cheques/${ch.id}/actions`, { action: "bounce", date: day(0), status: "portfolio" });
    const ov2 = (await get("/api/workspace/overview")).data;
    okk(near(ov2.receivable.cheques, 0) && near(ov2.receivable.accounts, ov.receivable.accounts + 2000), "E: karşılıksız çek portföyden çıkar, müşteri yeniden borçlanır");
    const port = (await get("/api/workspace/report-center/cek-portfoy?status=open")).data;
    okk(!port.rows.some(r => r.includes("K1")), "E: karşılıksız çek açık portföy raporunda yok");
  }
  });

  it("F. Yetki: ANLIK DURUM yetkisi verilen personel", async () => {
  {
    const users = (await get("/api/admin/users")).data;
    const me = users.find(u => u.username === "vezne");
    await admin.patch(`/api/admin/users/${me.id}`, { grants: ["overview.view"] });
    const ov = await get("/api/workspace/overview", staff);
    okk(ov.status === 200, "F: yetkili personel kartı görür");
    const cat = (await get("/api/workspace/report-center", staff)).data;
    okk(cat && cat.reports.length > 0, `F: personel rapor merkezini açar (${cat?.reports.length} rapor)`);
    const forbidden = ["islem-gecmisi"];
    okk(!cat.reports.some(r => forbidden.includes(r.id)), "F: işlem geçmişi raporu personelde listelenmez");
    const mizanAll = (await get("/api/workspace/report-center/mizan?preset=all", staff)).data;
    okk(mizanAll && /19\d\d|20\d\d/.test(mizanAll.subtitle || ""), `F: rapor merkezinde mizan "Tüm zamanlar" açılır (${mizanAll?.subtitle})`);
    const chq = await get("/api/workspace/cheques?status=open&limit=1", staff);
    okk(chq.status === 200, "F: ANLIK DURUM yetkili personel Rapor Al › Çek/Senet sekmesini görür (salt okunur)");
    okk((await staff.raw("GET", "/api/workspace/cheques/liste.pdf")).status === 200, "F: ... ve PDF'ini indirir");
    okk((await post("/api/workspace/cheques", { direction: "in", drawer: "X", amount: "1", dueDate: day(3) }, staff)).status === 403, "F: ama çek giremez");
    const detail0 = (await get("/api/workspace/cheques?limit=1", staff)).data.cheques[0];
    if (detail0) okk((await get(`/api/workspace/cheques/${detail0.id}`, staff)).status === 403, "F: ve evrak kartını açamaz");
    const pdf = await staff.raw("GET", "/api/workspace/overview/mizan.pdf?preset=thisMonth");
    okk(pdf.status === 200, "F: yetkili personel mizan PDF'i indirir");
  }
  });

  it("G. Rapor doğruluğu: mizan = cari listesi; ekstre kapanış = kart bakiyesi", async () => {
  {
    const list = (await get("/api/workspace/accounts?status=all")).data;
    const mizan = (await get(`/api/workspace/overview/mizan?from=2000-01-01&to=${day(0)}&idle=1`)).data;
    const sumList = list.accounts.reduce((s, a) => s + a.balance, 0);
    const sumMizan = (mizan.rows || []).reduce((s, r) => s + (r.balance ?? r.closing ?? 0), 0);
    okk(near(sumList, sumMizan), "G: mizan bakiye toplamı cari listesiyle aynı");
    for (const a of list.accounts) {
      const ek = (await get(`/api/workspace/overview/ekstre?account=${a.id}&from=2000-01-01&to=${day(0)}`)).data;
      okk(near(ek.closing ?? ek.totals?.closing, a.balance), `G: ${a.name} ekstre kapanış ${ek.closing ?? ek.totals?.closing} ≠ kart bakiyesi ${a.balance}`);
    }
  }
  });

});
