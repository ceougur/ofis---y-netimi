// 2.4.7 M1 — mobil görünüm programın içinde (docs/erp/OTURUM-DEVIR-TESLIM-2.4.7.md §3.1; server/lib/mobile.mjs, client/mobil/).
// Denenen: (1) /mobil/ sayfası ve dosyaları programın kendi sunucusundan, telefon ana adreste mobile yönlenir; (2) /api/mobil/… beyaz listesi —
// her uç programın mevcut ucuna gider ve SAYILAR masaüstü ucunun döndürdüğüyle aynı; (3) yetki: oturumsuz 401, Personel kasa/banka/rapor 403,
// Finans Raporları kişiden kaldırılmış Muhasebe rapor 403, başka şirketin kimliği 403 / olmayan şirket 409; (4) SALT OKUNUR: giriş/çıkış dışındaki
// her yazma isteği 405 ve veri tabanı değişmez; (5) Raporlar'da yalnız izinli 10 rapor, parametreler doğrulanmış; (6) iki şirket ayrı veri.
import assert from "node:assert/strict";
import { after, before, describe, it } from "node:test";
import { MOBILE_REPORT_IDS, isPhone, resolveMobile } from "../server/lib/mobile.mjs";
import { ADMIN_PASSWORD, startTestServer } from "./helpers.mjs";
import { ZIRAAT_IBAN } from "./banka-210-hesap-ortak.mjs";

const IPHONE = "Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1";
const ANDROID_PHONE = "Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Mobile Safari/537.36";
const ANDROID_TABLET = "Mozilla/5.0 (Linux; Android 14; SM-X710) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36";
const DESKTOP = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36";

const must = async (label, promise) => {
  const res = await promise;
  assert.equal(res.status, 200, `${label}: ${res.status} ${JSON.stringify(res.data).slice(0, 300)}`);
  return res.data.data;
};

describe("mobil görünüm: beyaz liste (lib/mobile.mjs)", () => {
  const q = text => new URLSearchParams(text);
  it("her mobil yol programın mevcut ucuna, şirket hofCompany ile gider", () => {
    assert.deepEqual(resolveMobile("GET", "/api/mobil/session", q("company=x")), { url: "/api/auth/me", transform: "session" });
    assert.equal(resolveMobile("GET", "/api/mobil/cash", q("company=co-2")).url, "/api/workspace/cash?hofCompany=co-2");
    assert.equal(resolveMobile("GET", "/api/mobil/bank", q("")).url, "/api/workspace/bank/summary");
    assert.equal(resolveMobile("GET", "/api/mobil/bank/accounts", q("")).url, "/api/workspace/bank/accounts");
    assert.equal(resolveMobile("GET", "/api/mobil/accounts", q("limit=5000&q=Ali&evil=1")).url, "/api/workspace/accounts?q=Ali&limit=100");
    assert.equal(resolveMobile("GET", "/api/mobil/accounts/search", q("q=Al")).url, "/api/workspace/accounts/search?q=Al");
    assert.equal(resolveMobile("GET", "/api/mobil/accounts/acc-1", q("")).url, "/api/workspace/accounts/acc-1");
    assert.equal(resolveMobile("GET", "/api/mobil/accounts/acc-1/statement.pdf", q("")).url, "/api/workspace/accounts/acc-1/ekstre.pdf");
    assert.equal(resolveMobile("GET", "/api/mobil/accounts/acc-1/entries/e-2/receipt.pdf", q("")).url, "/api/workspace/accounts/acc-1/entries/e-2/makbuz.pdf");
    assert.equal(resolveMobile("GET", "/api/mobil/stock", q("")).url, "/api/workspace/stock?limit=30");
    assert.equal(resolveMobile("GET", "/api/mobil/stock/st-1", q("")).url, "/api/workspace/stock/st-1");
    assert.equal(resolveMobile("HEAD", "/api/mobil/cash", q("")).url, "/api/workspace/cash");
    assert.equal(resolveMobile("POST", "/api/mobil/session/login", q("")).url, "/api/auth/login");
    assert.equal(resolveMobile("POST", "/api/mobil/session/logout", q("")).url, "/api/auth/logout");
  });
  it("Raporlar: yalnız izinli 10 rapor ve raporun izinli süzgeçleri; değerler doğrulanır", () => {
    assert.equal(MOBILE_REPORT_IDS.length, 10);
    assert.deepEqual(resolveMobile("GET", "/api/mobil/reports", q("")), { url: "/api/workspace/report-center", transform: "reports" });
    assert.equal(resolveMobile("GET", "/api/mobil/reports/mizan", q("preset=thisYear&type=customer&side=debtor&account=zz")).url, "/api/workspace/report-center/mizan?preset=thisYear&type=customer&side=debtor");
    assert.equal(resolveMobile("GET", "/api/mobil/reports/cari-ekstre/pdf", q("account=acc-1&items=1")).url, "/api/workspace/report-center/cari-ekstre/pdf?account=acc-1&items=1&download=1");
    assert.equal(resolveMobile("GET", "/api/mobil/reports/taksit-kartlari/xlsx", q("planStatus=all")).url, "/api/workspace/report-center/taksit-kartlari/xlsx?planStatus=all");
    const status = (fn, code) => assert.throws(fn, error => error.status === code, `beklenen ${code}`);
    status(() => resolveMobile("GET", "/api/mobil/reports/kdv-ozeti", q("")), 404);
    status(() => resolveMobile("GET", "/api/mobil/reports/ba-bs/pdf", q("")), 404);
    status(() => resolveMobile("GET", "/api/mobil/reports/mizan", q("preset=evil")), 400);
    status(() => resolveMobile("GET", "/api/mobil/reports/mizan", q("preset=custom&from=2026-02-30")), 400);
    status(() => resolveMobile("GET", "/api/mobil/reports/mizan", q("preset=custom&from=2026-05-01&to=2026-04-01")), 400);
    status(() => resolveMobile("GET", "/api/mobil/reports/cari-ekstre", q("")), 400);
    status(() => resolveMobile("GET", "/api/mobil/reports/cari-listesi", q("side=all")), 400);
    status(() => resolveMobile("GET", "/api/mobil/accounts/a%2Fb", q("")), 400);
    status(() => resolveMobile("GET", "/api/mobil/cash", q("company=../x")), 400);
  });
  it("salt okunur: giriş/çıkış dışındaki her yazma isteği 405, listede olmayan yol 404", () => {
    const status = (fn, code) => assert.throws(fn, error => error.status === code && (code !== 405 || error.extra.code === "mobile-read-only"), `beklenen ${code}`);
    status(() => resolveMobile("POST", "/api/mobil/accounts/acc-1/entry", q("")), 405);
    status(() => resolveMobile("POST", "/api/mobil/stock/st-1/move", q("")), 405);
    status(() => resolveMobile("POST", "/api/mobil/cash", q("")), 405);
    status(() => resolveMobile("PUT", "/api/mobil/accounts/acc-1", q("")), 405);
    status(() => resolveMobile("DELETE", "/api/mobil/stock/st-1", q("")), 405);
    status(() => resolveMobile("GET", "/api/mobil/session/login", q("")), 405);
    // 2.4.7 M5: yazma formlarının hesap / POS seçicisi (masaüstü formunun ucu, kendi yetki denetimiyle) beyaz listede; başka banka ucu yok.
    assert.equal(resolveMobile("GET", "/api/mobil/bank/choices", q("")).url, "/api/workspace/bank/choices");
    status(() => resolveMobile("GET", "/api/mobil/bank/vouchers", q("")), 404);
    status(() => resolveMobile("GET", "/api/mobil/admin/users", q("")), 404);
    status(() => resolveMobile("GET", "/api/mobil/invoices", q("")), 404);
    status(() => resolveMobile("GET", "/api/mobil/ledger", q("")), 404);
  });
  it("telefon imzası: iPhone ve Android telefon evet; Android tablet ve bilgisayar hayır", () => {
    assert.equal(isPhone(IPHONE), true);
    assert.equal(isPhone(ANDROID_PHONE), true);
    assert.equal(isPhone(ANDROID_TABLET), false);
    assert.equal(isPhone(DESKTOP), false);
    assert.equal(isPhone(""), false);
  });
});

describe("mobil görünüm: programın içinde, gerçek sunucu", () => {
  let server;
  let admin;
  let base;
  let data;
  const fetchRaw = (url, init = {}) => fetch(base + url, { redirect: "manual", ...init });
  before(async () => {
    server = await startTestServer();
    base = server.base;
    // Yönetici, mobilin kendi giriş ucundan girer (programın /api/auth/login'i; aynı çerez).
    admin = server.client();
    const login = await admin.post("/api/mobil/session/login", { username: "admin", password: ADMIN_PASSWORD });
    assert.equal(login.status, 200, JSON.stringify(login.data));
    // Programın kendi API'siyle veri (masaüstünün ürettiği veri): cari + hareketler, Kasa, banka hesabı + açılış, stok + hareket.
    const ali = await must("cari", admin.post("/api/workspace/accounts", { name: "Ali Yılmaz", type: "customer" }));
    await must("borç", admin.post(`/api/workspace/accounts/${ali.id}/entries`, { kind: "debt", amount: "1.250,50", note: "Hizmet bedeli" }));
    await must("tahsilat", admin.post(`/api/workspace/accounts/${ali.id}/entries`, { kind: "in", amount: "400", note: "Elden" }));
    const veli = await must("cari 2", admin.post("/api/workspace/accounts", { name: "Veli Toptan", type: "supplier" }));
    await must("kasa girişi", admin.post("/api/workspace/cash", { kind: "in", amount: "3.000", description: "Danışmanlık" }));
    await must("kasa çıkışı", admin.post("/api/workspace/cash", { kind: "out", amount: "120,25", description: "Kırtasiye" }));
    const bank = await must("banka hesabı", admin.post("/api/workspace/bank/accounts", { bankName: "Ziraat Bankası", name: "Ana TL Hesabı", kind: "demand", currency: "TRY", iban: ZIRAAT_IBAN, opening: { date: "2026-01-02", amount: "25.000", confirmed: true } }));
    const kalem = await must("stok", admin.post("/api/workspace/stock", { name: "Kurşun Kalem", unit: "Adet", unitPrice: "5", openingQty: "40", openingPay: "none" }));
    await must("stok çıkışı", admin.post(`/api/workspace/stock/${kalem.id}/moves`, { kind: "out", qty: "7", note: "Ofis tüketimi" }));
    data = { ali, veli, bank, kalem };
  });
  after(async () => server?.close());

  it("/mobil/ sayfası ve dosyaları programın sunucusundan; /mobil → /mobil/", async () => {
    const page = await fetchRaw("/mobil/");
    assert.equal(page.status, 200);
    assert.match(page.headers.get("content-type"), /text\/html/);
    assert.match(page.headers.get("content-security-policy") || "", /script-src 'self'/);
    const html = await page.text();
    assert.match(html, /<script type="module" src="app\.js"><\/script>/);
    assert.match(html, /<title>DestekOfis Mobil<\/title>/);
    assert.doesNotMatch(html, /Demo|test onayına/i, "demo şeridi ve test metni ürüne girmez");
    const bare = await fetchRaw("/mobil");
    assert.equal(bare.status, 302);
    assert.equal(bare.headers.get("location"), "/mobil/");
    for (const [file, type] of [["app.js", /javascript/], ["styles.css", /css/], ["sw.js", /javascript/], ["manifest.webmanifest", /manifest\+json/], ["icons/app.svg", /svg/]]) {
      const res = await fetchRaw(`/mobil/${file}`);
      assert.equal(res.status, 200, file);
      assert.match(res.headers.get("content-type"), type, file);
    }
    // 2.4.7 gezinti B1: kayıt girişi modülleri kabuk önbelleğinde (sunucu kapalıyken açılan sayfa, sunucu dönünce düğmeleri gösterir).
    const sw = await (await fetchRaw("/mobil/sw.js")).text();
    for (const file of ["yazma.js", "yazma.css", "yazma-bekleyen.js"]) assert.match(sw, new RegExp(`"${file.replace(".", "\\.")}"`), `sw.js önbellek listesinde ${file}`);
    const manifest = await (await fetchRaw("/mobil/manifest.webmanifest")).json();
    assert.equal(manifest.start_url, "/mobil/");
    assert.equal(manifest.scope, "/mobil/");
  });
  it("telefon ana adreste mobil görünüme yönlenir; bilgisayar, tablet ve ?masaustu=1 masaüstünü görür", async () => {
    const phone = await fetchRaw("/", { headers: { "user-agent": IPHONE } });
    assert.equal(phone.status, 302);
    assert.equal(phone.headers.get("location"), "/mobil/");
    assert.equal((await fetchRaw("/index.html", { headers: { "user-agent": ANDROID_PHONE } })).headers.get("location"), "/mobil/");
    for (const ua of [DESKTOP, ANDROID_TABLET]) {
      const res = await fetchRaw("/", { headers: { "user-agent": ua } });
      assert.equal(res.status, 200, ua);
      assert.doesNotMatch(await res.text(), /DestekOfis Mobil<\/title>/);
    }
    assert.equal((await fetchRaw("/?masaustu=1", { headers: { "user-agent": IPHONE } })).status, 200);
  });
  it("oturumsuz istek 401 (veri dönmez)", async () => {
    const anon = server.client();
    for (const url of ["/api/mobil/session", "/api/mobil/cash", "/api/mobil/bank", "/api/mobil/accounts", `/api/mobil/accounts/${data.ali.id}`, "/api/mobil/stock", "/api/mobil/reports", "/api/mobil/reports/cari-listesi"]) {
      const res = await anon.get(url);
      assert.equal(res.status, 401, url);
      assert.equal(res.data.ok, false, url);
      assert.equal(res.data.data, undefined, url);
    }
    const wrong = await anon.post("/api/mobil/session/login", { username: "admin", password: "yanlış-parola" });
    assert.equal(wrong.status, 401);
  });
  it("başka siteden giriş isteği reddedilir (programın istek kaynağı denetimi mobil yolda da)", async () => {
    const res = await fetch(`${base}/api/mobil/session/login`, { method: "POST", headers: { "content-type": "application/json", origin: "https://kotu.example" }, body: JSON.stringify({ username: "admin", password: ADMIN_PASSWORD }) });
    assert.equal(res.status, 403);
    assert.equal(res.headers.get("set-cookie"), null);
  });
  it("oturum özeti: kullanıcı, şirketler, seçili şirket; mobil yazma hakları (2.4.7 M5: yönetici tahsilat / ödeme / stok girişi)", async () => {
    const session = await must("oturum", admin.get("/api/mobil/session"));
    assert.equal(session.user.username, "admin");
    assert.equal(session.writesEnabled, true, "M5: yöneticinin mobil yazma hakkı var (yetkiden; asıl denetim programın ucunda)");
    assert.equal(session.companies.length, 1);
    assert.equal(session.company, session.companies[0].id);
    assert.equal(session.user.permissions, undefined, "mobil özet yetki listesini taşımaz");
  });
  it("sayılar masaüstü ucunun döndürdüğüyle aynı (Kasa, banka, cari bakiyesi, stok miktarı)", async () => {
    const cash = await must("mobil kasa", admin.get("/api/mobil/cash"));
    const deskCash = await must("masaüstü kasa", admin.get("/api/workspace/cash"));
    assert.equal(cash.totals.balance, deskCash.totals.balance);
    assert.equal(cash.totals.balance, 3279.75, "Kasa: 3.000 − 120,25 + carinin 400 nakit tahsilatı");
    const bank = await must("mobil banka", admin.get("/api/mobil/bank"));
    assert.equal(bank.realBank.minor, (await must("masaüstü banka", admin.get("/api/workspace/bank/summary"))).realBank.minor);
    assert.equal(bank.realBank.minor, 2_500_000);
    const accountsList = await must("mobil banka hesapları", admin.get("/api/mobil/bank/accounts"));
    assert.deepEqual(accountsList, await must("masaüstü banka hesapları", admin.get("/api/workspace/bank/accounts")));
    const list = await must("mobil cariler", admin.get("/api/mobil/accounts?limit=50"));
    const deskList = await must("masaüstü cariler", admin.get("/api/workspace/accounts?limit=50"));
    assert.equal(list.total, 2);
    const balanceOf = (rows, id) => rows.find(row => row.id === id)?.balance;
    assert.equal(balanceOf(list.accounts, data.ali.id), balanceOf(deskList.accounts, data.ali.id));
    assert.equal(balanceOf(list.accounts, data.ali.id), 850.5, "1.250,50 − 400");
    const detail = await must("mobil cari kartı", admin.get(`/api/mobil/accounts/${data.ali.id}`));
    assert.deepEqual(detail.entries.map(e => [e.kind, e.amount]), (await must("masaüstü cari kartı", admin.get(`/api/workspace/accounts/${data.ali.id}`))).entries.map(e => [e.kind, e.amount]));
    const stock = await must("mobil stok", admin.get("/api/mobil/stock"));
    const deskStock = await must("masaüstü stok", admin.get("/api/workspace/stock"));
    const qtyOf = rows => rows.find(row => row.id === data.kalem.id)?.qty;
    assert.equal(qtyOf(stock.items), qtyOf(deskStock.items));
    assert.equal(qtyOf(stock.items), 33, "40 − 7");
    const item = await must("mobil stok kartı", admin.get(`/api/mobil/stock/${data.kalem.id}`));
    assert.equal(item.qty, 33);
    assert.equal(item.moves.length, 2);
    const found = await must("mobil cari arama", admin.get("/api/mobil/accounts/search?q=Ali"));
    assert.deepEqual(found.map(row => row.id), [data.ali.id]);
  });
  it("Raporlar: katalogda yalnız izinli raporlar; ön izleme, PDF ve Excel programın rapor motorundan", async () => {
    const catalog = await must("katalog", admin.get("/api/mobil/reports"));
    assert.deepEqual(catalog.reports.map(r => r.id).sort(), [...MOBILE_REPORT_IDS].sort());
    const desk = await must("masaüstü katalog", admin.get("/api/workspace/report-center"));
    assert.ok(desk.reports.length > catalog.reports.length, "masaüstünde daha çok rapor var");
    const mobile = await must("cari listesi", admin.get("/api/mobil/reports/cari-listesi"));
    assert.deepEqual(mobile.rows, (await must("masaüstü cari listesi", admin.get("/api/workspace/report-center/cari-listesi"))).rows);
    assert.equal(mobile.total, 2);
    const ekstre = await must("cari ekstre", admin.get(`/api/mobil/reports/cari-ekstre?account=${data.ali.id}&preset=thisYear`));
    assert.ok(ekstre.rows.length >= 2, "ekstre satırları");
    const pdf = await admin.raw("GET", `/api/mobil/reports/cari-listesi/pdf`);
    assert.equal(pdf.status, 200);
    assert.match(pdf.headers.get("content-type"), /application\/pdf/);
    assert.match(pdf.headers.get("content-disposition"), /^attachment/);
    assert.equal(pdf.buffer.subarray(0, 4).toString(), "%PDF");
    const xlsx = await admin.raw("GET", `/api/mobil/reports/mizan/xlsx?preset=thisYear`);
    assert.equal(xlsx.status, 200);
    assert.match(xlsx.headers.get("content-type"), /spreadsheetml/);
    const statement = await admin.raw("GET", `/api/mobil/accounts/${data.ali.id}/statement.pdf`);
    assert.equal(statement.status, 200);
    assert.equal(statement.buffer.subarray(0, 4).toString(), "%PDF");
    const kdv = await admin.get("/api/mobil/reports/kdv-ozeti");
    assert.equal(kdv.status, 404, "mobil dışı rapor");
  });
  it("salt okunur: mobil yoldan yazma 405, veri tabanı değişmez", async () => {
    const counts = () => server.app.store.get("SELECT (SELECT COUNT(*) FROM account_entries) AS entries, (SELECT COUNT(*) FROM stock_moves) AS moves, (SELECT COUNT(*) FROM accounts) AS accounts");
    const before_ = counts();
    const attempts = [
      ["POST", `/api/mobil/accounts/${data.ali.id}/entry`, { kind: "in", amount: "10", method: "cash", date: "2026-10-27" }],
      ["POST", `/api/mobil/accounts/${data.ali.id}/entries`, { kind: "in", amount: "10" }],
      ["POST", `/api/mobil/stock/${data.kalem.id}/move`, { kind: "out", qty: "1", pay: "none" }],
      ["POST", "/api/mobil/accounts", { name: "Mobil Cari" }],
      ["PUT", `/api/mobil/accounts/${data.ali.id}`, { name: "Değişti" }],
      ["DELETE", `/api/mobil/stock/${data.kalem.id}`, undefined],
    ];
    for (const [method, url, body] of attempts) {
      const res = await fetch(base + url, { method, headers: { cookie: admin.cookie, "content-type": "application/json", "x-hof-request": `mobil-yazma-${method}` }, body: body ? JSON.stringify(body) : undefined });
      assert.equal(res.status, 405, `${method} ${url}`);
      assert.equal((await res.json()).code, "mobile-read-only");
    }
    assert.deepEqual(counts(), before_);
  });
  describe("yetki ve şirket", () => {
    let staff;
    let accountant;
    let second;
    before(async () => {
      await must("personel", admin.post("/api/admin/users", { username: "mobil-personel", name: "Mobil Personel", role: "personel", password: "Personel-Mobil-2026!", mustChangePassword: false }));
      staff = server.client();
      assert.equal((await staff.post("/api/mobil/session/login", { username: "mobil-personel", password: "Personel-Mobil-2026!" })).status, 200);
      // Muhasebe rolü Finans Raporları'nı varsayılan görür; bu kişiden kaldırıldı (CLAUDE.md 2.4.3 kararı: kişiden kaldırılabilir).
      await must("muhasebe", admin.post("/api/admin/users", { username: "mobil-muhasebe", name: "Mobil Muhasebe", role: "muhasebe", password: "Muhasebe-Mobil-2026!", mustChangePassword: false, grants: { add: [], remove: ["overview.view"] } }));
      accountant = server.client();
      assert.equal((await accountant.post("/api/mobil/session/login", { username: "mobil-muhasebe", password: "Muhasebe-Mobil-2026!" })).status, 200);
      second = (await must("ikinci şirket", admin.post("/api/companies", { name: "Mobil İkinci Şirket" }))).company;
    });
    it("Personel: cari ve stok görür; Kasa, banka ve raporlar 403", async () => {
      assert.equal((await staff.get("/api/mobil/accounts")).status, 200);
      assert.equal((await staff.get("/api/mobil/stock")).status, 200);
      for (const url of ["/api/mobil/cash", "/api/mobil/bank", "/api/mobil/bank/accounts", "/api/mobil/reports", "/api/mobil/reports/cari-listesi", "/api/mobil/reports/mizan/pdf"]) {
        const res = await staff.get(url);
        assert.equal(res.status, 403, url);
        assert.equal(res.data.data, undefined, url);
      }
    });
    it("Finans Raporları kaldırılmış Muhasebe: Kasa görür, raporlar 403", async () => {
      assert.equal((await accountant.get("/api/mobil/cash")).status, 200);
      // Katalog ucu açılır (kişide Banka Raporları gibi başka rapor yetkisi var) ama mobil listede rapor YOK; her mobil rapor 403.
      assert.deepEqual((await must("muhasebe katalog", accountant.get("/api/mobil/reports"))).reports, []);
      for (const url of ["/api/mobil/reports/cari-listesi", `/api/mobil/reports/cari-ekstre?account=${data.ali.id}`, "/api/mobil/reports/taksit-kartlari/xlsx"]) assert.equal((await accountant.get(url)).status, 403, url);
    });
    it("yetkisi olmadığı şirketin kimliği 403, olmayan şirket 409; oturum özetinde yalnız kendi şirketleri", async () => {
      const res = await staff.get(`/api/mobil/accounts?company=${second.id}`);
      assert.equal(res.status, 403);
      assert.equal(res.data.code, "company-forbidden");
      assert.equal((await staff.get(`/api/mobil/stock/${data.kalem.id}?company=${second.id}`)).status, 403);
      assert.equal((await staff.get("/api/mobil/accounts?company=yok-boyle-sirket")).status, 409);
      const session = await must("personel oturum", staff.get("/api/mobil/session"));
      assert.deepEqual(session.companies.map(c => c.id), [session.company]);
      assert.notEqual(session.company, second.id);
    });
    it("iki şirket: ikinci şirket boş başlar, verisi birinciye karışmaz; şirket geçişi istek başına", async () => {
      const session = await must("yönetici oturum", admin.get("/api/mobil/session"));
      assert.equal(session.companies.length, 2);
      const first = session.companies.find(c => c.id !== second.id).id;
      const empty = await must("boş şirket carileri", admin.get(`/api/mobil/accounts?company=${second.id}`));
      assert.equal(empty.total, 0);
      assert.equal((await must("boş şirket kasası", admin.get(`/api/mobil/cash?company=${second.id}`))).totals.balance, 0);
      assert.equal((await must("boş şirket stoku", admin.get(`/api/mobil/stock?company=${second.id}`))).total, 0);
      assert.equal((await must("boş şirket raporu", admin.get(`/api/mobil/reports/cari-listesi?company=${second.id}`))).total, 0);
      await must("ikinci şirkete cari", admin.post(`/api/workspace/accounts?hofCompany=${second.id}`, { name: "Ayşe Demir", type: "customer" }));
      assert.equal((await must("ikinci şirket carileri", admin.get(`/api/mobil/accounts?company=${second.id}`))).total, 1);
      assert.equal((await must("birinci şirket carileri", admin.get(`/api/mobil/accounts?company=${first}`))).total, 2);
      assert.equal((await admin.get(`/api/mobil/accounts/${data.ali.id}?company=${second.id}`)).status, 404, "001'in carisi 002'de yok");
    });
    it("çıkıştan sonra oturum kapanır", async () => {
      const temp = server.client();
      assert.equal((await temp.post("/api/mobil/session/login", { username: "mobil-personel", password: "Personel-Mobil-2026!" })).status, 200);
      const cookie = temp.cookie;
      assert.equal((await temp.post("/api/mobil/session/logout", {})).status, 200);
      const res = await fetch(`${base}/api/mobil/accounts`, { headers: { cookie } });
      assert.equal(res.status, 401);
    });
  });
});
