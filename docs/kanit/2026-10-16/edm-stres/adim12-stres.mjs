// EDM TEST ORTAMI — 5 KULLANICI AYNI ANDA 30 BELGE (kullanıcı, 16.10.2026: "müşteri DESTEK OFİS şeklinde 5 kullanıcı ile 30 tane e-fatura,
// e-arşiv karışık kesmeye zorlar mısın"). Firma (satıcı) DESTEK OFİS; alıcılar "DESTEK OFİS" (e-Fatura mükellefi; EDM test hesabının kendi VKN'si)
// ve "DESTEK OFİS Bireysel" (TCKN, e-Arşiv). Beş kullanıcı (3 Muhasebe + 2 Avukat rolü) ayrı tarayıcı oturumlarında, programın ekranından, aynı anda
// kullanıcı başına 6 belge keser: Kaydet ve Gönder / Kaydet, Sonra Gönder → e-Belge Gönder, Temel / Ticari / e-Arşiv karışık. Sonra: numaralar
// benzersiz ve boşluksuz, çift gönderim yok, EDM son durumları, cari bakiyeleri, defter bütünlüğü, sayfa hataları. Kimlik bilgisi yalnız yüklenen
// dosyadan; çıktıda maskelenir. Canlı kilitli. HUKUK_LICENSE_URL ölü adres (ders 30).
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import path from "node:path";
const R = "/home/user/ofis---y-netimi";
const { chromium } = await import(`${R}/node_modules/playwright/index.mjs`);
const { startTestServer, ADMIN_PASSWORD } = await import(`${R}/test/helpers.mjs`);
const text = readFileSync(process.argv[2], "utf8");
const username = (text.match(/kullan[ıi]c[ıi] ad[ıi]\s*:\s*(\S+)/i) || [])[1];
const password = (text.match(/şifre\s*:\s*(\S+)/i) || [])[1];
const OUT = process.argv[3];
mkdirSync(OUT, { recursive: true });
const mask = value => String(typeof value === "string" ? value : JSON.stringify(value ?? "")).split(password).join("***").split(username).join("<kullanıcı>");
const log = (label, value = "") => console.log(`${new Date().toISOString().slice(11, 19)} ${label}${value === "" ? "" : `: ${mask(value).slice(0, 700)}`}`);
let pass = 0, fail = 0;
const check = (cond, what) => { cond ? (pass += 1) : (fail += 1); console.log(`  ${cond ? "✓" : "✗"} ${mask(what)}`); return Boolean(cond); };
const unwrap = r => ({ ...r, data: r.data && typeof r.data === "object" && "ok" in r.data ? (r.data.ok ? r.data.data : r.data) : r.data });
const sleep = ms => new Promise(r => setTimeout(r, ms));
const server = await startTestServer({ edocEnabled: true, env: { HUKUK_LICENSE_URL: "http://127.0.0.1:9" } });
const api = server.client();
await api.login("admin", ADMIN_PASSWORD);
const post = async (u, b) => unwrap(await api.post(u, b));
const put = async (u, b) => unwrap(await api.put(u, b));
const get = async u => unwrap(await api.get(u));
await post("/api/workspace/bank/setup/dismiss", {});
const jpeg = file => `data:image/jpeg;base64,${readFileSync(`${R}/docs/pazarlama/${file}`).toString("base64")}`;
const seq = 100_000_000 + Math.floor(Math.random() * 800_000_000);
const year = new Date().getFullYear();
await put("/api/workspace/invoices/settings", {
  seller: { name: "DESTEK OFİS", taxNo: "3230512384", taxOffice: "Kadıköy", address: "Test Cd. 1", district: "Kadıköy", city: "İstanbul", postalCode: "34000", email: "test@destekofis.com.tr", logo: jpeg("DestekOfis-Logo-Fatura-Yatay.jpg"), banks: [{ name: "Örnek Bankası A.Ş.", iban: "TR330006100519786457841326" }] },
  efatura: true, earsiv: true, start: { [`TEF${year}`]: seq, [`TEA${year}`]: seq },
  defaults: { footer: "DestekOfis 2.4.0 — 5 kullanıcı eşzamanlı kesim denemesi." },
});
const db = sql => (...args) => server.app.store.get(sql, ...args);
const dbAll = sql => (...args) => server.app.store.all(sql, ...args);
const invRow = id => db("SELECT id, number, ettn, profile, status, e_status AS eStatus, e_message AS eMessage, try_payable AS payable, account_id AS accountId FROM invoices WHERE id = ?")(id);
const lastCreatedBy = actorId => db("SELECT entity_id AS id FROM audit_events WHERE type = 'invoice.created' AND actor_id = ? ORDER BY created_at DESC, rowid DESC LIMIT 1")(actorId)?.id || "";
const balance = async accountId => { const r = await get(`/api/workspace/accounts/${accountId}`); return Number(r.data?.totals?.balance ?? NaN); };

const browser = await chromium.launch();
const modal = ".hof-modal-backdrop.is-visible";
const last = `${modal}:last-of-type`;
const card = `${modal} [data-integ-root]`;
const inv = `${modal} .hof-invoices-modal`;
const errors = [];
// Bir kullanıcının tarayıcı oturumu ve ekran yardımcıları.
const session = async (tag, login, pass_) => {
  const context = await browser.newContext({ viewport: { width: 1360, height: 900 }, locale: "tr-TR" });
  await context.addInitScript(() => {
    window.__toasts = [];
    document.addEventListener("DOMContentLoaded", () => {
      document.head.appendChild(Object.assign(document.createElement("style"), { textContent: "#hof-license-bar,.hof-license-notice{display:none!important}" }));
      new MutationObserver(list => { for (const m of list) for (const n of m.addedNodes) if (n.nodeType === 1 && (n.matches?.(".hof-toast") || n.querySelector?.(".hof-toast"))) window.__toasts.push((n.matches(".hof-toast") ? n : n.querySelector(".hof-toast")).textContent.replace(/\s+/g, " ").trim()); }).observe(document.body, { childList: true, subtree: true });
    });
  });
  const page = await context.newPage();
  page.setDefaultTimeout(30000);
  page.on("pageerror", error => errors.push(`${tag}: ${error.message}`));
  const pause = ms => page.waitForTimeout(ms);
  const ui = {
    tag, page, pause,
    textOf: selector => page.$eval(selector, node => node.textContent.replace(/\s+/g, " ").trim()).catch(() => ""),
    toasts: () => page.evaluate(() => window.__toasts.splice(0)),
    shot: name => page.screenshot({ path: path.join(OUT, `${tag}-${name}.png`) }),
    closeAll: async () => { for (let i = 0; i < 5 && (await page.$(modal)); i += 1) { await page.keyboard.press("Escape"); await pause(250); } },
    yesIfAsked: async (tries = 12) => { for (let i = 0; i < tries; i += 1) { await pause(400); const yes = await page.$(`${modal} [data-answer="yes"]`); if (yes) { await yes.click(); return true; } } return false; },
    clickAct: async act => { await page.waitForSelector(`${inv} [data-act="${act}"]`, { timeout: 30000 }); await page.click(`${inv} [data-act="${act}"]`); },
  };
  await page.goto(`${server.base}/`);
  await page.fill("#hof-auth input[name=username]", login);
  await page.fill("#hof-auth input[name=password]", pass_);
  await Promise.all([page.waitForEvent("load"), page.click('#hof-auth button[type="submit"]')]);
  await page.waitForSelector("#hof-sidecard", { timeout: 60000 });
  await page.waitForFunction(() => Boolean(window.HOF?.invoices?.open), null, { timeout: 30000 });
  return ui;
};
const newSale = async (ui, accountId, query, lines, { profile = "" } = {}) => {
  const { page, pause } = ui;
  await ui.closeAll();
  await page.click("#hof-sidecard [data-action=invoices]");
  await page.waitForSelector(`${inv} [data-act="new"]`);
  await page.click(`${inv} [data-act="new"]`);
  await page.click(`${inv} [data-scenario="service_sale"]`);
  await page.waitForSelector(`${inv} [data-lines]`);
  await page.click(`${inv} [data-acc-query]`);
  await page.keyboard.type(query, { delay: 30 });
  await page.waitForSelector(`${inv} .hof-acc-picker li[data-id="${accountId}"]`, { timeout: 20000 });
  await (await page.$(`${inv} .hof-acc-picker li[data-id="${accountId}"]`)).dispatchEvent("mousedown");
  await pause(700);
  for (const [index, line] of lines.entries()) {
    if (index > 0) { await page.click(`${inv} [data-act="add-line"]`); await pause(300); }
    await page.click(`${inv} [data-l="${index}"][data-f="name"]`);
    await page.keyboard.type(line.name, { delay: 25 });
    await page.keyboard.press("Tab");
    for (const [field, value] of [["qty", line.qty], ["unitPrice", line.unitPrice]]) {
      const sel = `${inv} [data-l="${index}"][data-f="${field}"]`;
      await page.click(sel, { clickCount: 3 });
      await page.keyboard.type(String(value), { delay: 25 });
      await page.keyboard.press("Tab");
    }
    if (line.vatRate !== undefined) await page.selectOption(`${inv} [data-l="${index}"][data-f="vatRate"]`, String(line.vatRate));
  }
  await pause(500);
  if (profile) {
    await page.waitForSelector(`${inv} [data-profile-field]:not([hidden]) select`, { timeout: 20000 });
    await page.selectOption(`${inv} [data-f="profile"]`, profile);
    await pause(400);
  }
};

const result = { users: [], docs: [] };
try {
  // ---------- Hazırlık (yönetici, ekrandan): entegratör + cariler ----------
  const admin = await session("yonetici", "admin", ADMIN_PASSWORD);
  const { page } = admin;
  await page.click("#hof-sidecard [data-action=invoices]");
  await page.waitForSelector(`${inv} [data-act="integrator"]`);
  await page.click(`${inv} [data-act="integrator"]`);
  await page.waitForSelector(`${card} input[data-i="username"]`);
  await page.click(`${card} input[data-i="username"]`);
  await page.keyboard.type(username, { delay: 30 });
  await page.keyboard.press("Tab");
  await page.keyboard.type(password, { delay: 30 });
  await page.click(`${card} [data-integ-act="save"]`);
  await page.waitForFunction(sel => /Bağlantı denenmedi|Bağlantı kuruldu/.test(document.querySelector(sel)?.textContent || ""), `${card} [data-integ-status]`);
  await page.click(`${card} [data-integ-act="test"]`);
  await page.waitForFunction(sel => /Bağlantı kuruldu|başarısız|hata/i.test(document.querySelector(sel)?.textContent || ""), `${card} [data-integ-status]`, { timeout: 90000 });
  check(/Bağlantı kuruldu/.test(await admin.textOf(`${card} [data-integ-status]`)), `Bağlantıyı Test Et: ${await admin.textOf(`${card} [data-integ-status]`)}`);
  await page.click(`${card} [data-integ-act="aliases"]`);
  await page.waitForFunction(sel => (document.querySelector(sel)?.options || []).length > 1, `${card} select[data-i="senderAlias"]`, { timeout: 90000 });
  await page.selectOption(`${card} select[data-i="senderAlias"]`, "urn:mail:defaultgb@edmbilisim.com.tr");
  await page.selectOption(`${card} select[data-i="mailboxAlias"]`, "urn:mail:defaultpk@edmbilisim.com.tr");
  if (!(await page.$eval(`${card} input[data-i="autoCheckUser"]`, node => node.checked))) await page.click(`${card} input[data-i="autoCheckUser"]`);
  await page.click(`${card} [data-integ-act="save"]`);
  await admin.pause(1200);
  await admin.closeAll();
  const newAccount = async ({ name, taxNo, partyKind = "", firstName = "", familyName = "", pk = "" }) => {
    await admin.closeAll();
    await page.evaluate(() => window.HOF.accounts.newFor({}));
    await page.waitForSelector(`${modal} input[name="taxNo"]`);
    await page.click(`${modal} input[name="name"]`);
    await page.keyboard.type(name, { delay: 30 });
    if (partyKind) await page.selectOption(`${modal} select[name="partyKind"]`, partyKind);
    await page.click(`${modal} input[name="taxNo"]`);
    await page.keyboard.type(taxNo, { delay: 30 });
    await page.keyboard.press("Tab");
    if (pk) {
      await page.waitForSelector(`${last} select[name="alias"]`, { timeout: 60000 });
      await page.selectOption(`${last} select[name="alias"]`, pk);
      await page.click(`${last} .hof-form button[type="submit"]`);
      await page.waitForFunction(value => document.querySelector('input[name="eAlias"]')?.value === value, pk, { timeout: 15000 });
    } else await admin.pause(3000);
    for (const [field, value] of [["firstName", firstName], ["familyName", familyName], ["taxOffice", "Kadıköy"], ["address", "Test Cd. 1"], ["district", "Kadıköy"], ["city", "İstanbul"], ["email", partyKind === "person" ? "alici@example.com" : ""]]) {
      const sel = `${modal} [name="${field}"]`;
      if (value && (await page.$(sel))) { await page.click(sel); await page.fill(sel, ""); await page.keyboard.type(value, { delay: 20 }); }
    }
    await page.click(`${modal} .hof-form button[type="submit"]`);
    await admin.pause(2500);
    const row = db("SELECT id, e_invoice AS eInvoice, e_alias AS eAlias FROM accounts WHERE name = ?")(name);
    log(`CARİ (ekrandan) ${name}`, row);
    return row;
  };
  const firm = await newAccount({ name: "DESTEK OFİS", taxNo: "3230512384", pk: "urn:mail:defaultpk@edmbilisim.com.tr" });
  check(firm?.eInvoice === 1 && firm.eAlias === "urn:mail:defaultpk@edmbilisim.com.tr", "DESTEK OFİS carisi: e-Fatura mükellefi, posta kutusu seçildi");
  const person = await newAccount({ name: "DESTEK OFİS Bireysel", taxNo: "10000000146", partyKind: "person", firstName: "Destek", familyName: "Ofis" });
  check(person && person.eInvoice === 0, "DESTEK OFİS Bireysel carisi: e-Arşiv alıcısı");
  const firm0 = await balance(firm.id);
  const person0 = await balance(person.id);

  // ---------- 5 kullanıcı ----------
  const roles = ["muhasebe", "muhasebe", "muhasebe", "avukat", "avukat"];
  const users = [];
  for (const [index, role] of roles.entries()) {
    const login = `destek${index + 1}`;
    const pw = `Destek!2026-Kul${index + 1}x`;
    const created = await post("/api/admin/users", { username: login, name: `DESTEK OFİS Kullanıcı ${index + 1}`, role, password: pw, mustChangePassword: false });
    check(created.status === 200, `kullanıcı ${login} (${role}) açıldı: ${created.status} ${created.status === 200 ? "" : JSON.stringify(created.data).slice(0, 200)}`);
    const id = db("SELECT id FROM users WHERE username = ?")(login)?.id;
    users.push({ login, pw, role, id });
  }
  result.users = users.map(({ login, role, id }) => ({ login, role, id }));
  const sessions = await Promise.all(users.map(u => session(u.login, u.login, u.pw)));
  log("OTURUMLAR", sessions.map(s => s.tag));

  // ---------- Plan: kullanıcı başına 6 belge (15 e-Fatura + 15 e-Arşiv) ----------
  const KINDS = [
    { kind: "eF-Temel", acc: () => firm, q: "DESTEK", how: "issue-now" },
    { kind: "eA", acc: () => person, q: "DESTEK OFİS B", how: "issue-now" },
    { kind: "eF-Ticari", acc: () => firm, q: "DESTEK", how: "issue-later", profile: "TICARIFATURA" },
    { kind: "eA", acc: () => person, q: "DESTEK OFİS B", how: "issue-later" },
    { kind: "eF-Temel", acc: () => firm, q: "DESTEK", how: "issue-later" },
    { kind: "eA", acc: () => person, q: "DESTEK OFİS B", how: "issue-now" },
  ];
  const ITEMS = ["Yazılım Destek Hizmeti", "Eğitim", "Kurulum", "Danışmanlık", "Yıllık Bakım", "Uzaktan Destek"];
  const plans = users.map((u, ui) => KINDS.map((_, k) => {
    const pick = KINDS[(k + ui) % KINDS.length];
    const n = ui * 6 + k + 1;
    const lines = [{ name: `${ITEMS[(n + 1) % ITEMS.length]} ${n}`, qty: 1 + (n % 3), unitPrice: 100 + n * 10, vatRate: 20 }];
    if (n % 4 === 0) lines.push({ name: `Eğitim Seti ${n}`, qty: 1, unitPrice: 50 + n, vatRate: 10 });
    return { n, ...pick, lines };
  }));
  const started = Date.now();
  const worker = async (ui, user, plan) => {
    const done = [];
    for (const p of plan) {
      const t0 = Date.now();
      try {
        await newSale(ui, p.acc().id, p.q, p.lines, { profile: p.profile || "" });
        await ui.toasts();
        await ui.page.click(`${inv} [data-act="${p.how}"]`);
        await ui.yesIfAsked();
        await ui.page.waitForSelector(`${inv} .hof-inv-pills`, { timeout: 60000 });
        await ui.pause(1200);
        const id = lastCreatedBy(user.id);
        if (p.how === "issue-later") {
          const before = invRow(id);
          if (!(before.eStatus === "waiting" && before.number === "")) log(`${ui.tag} #${p.n} BEKLENMEYEN (Sonra Gönder)`, before);
          await ui.clickAct("e-send");
          await ui.yesIfAsked(6);
          for (let i = 0; i < 40 && ["waiting", "none"].includes(invRow(id).eStatus); i += 1) await ui.pause(500);
        }
        const row = invRow(id);
        const toasts = await ui.toasts();
        const item = { user: user.login, role: user.role, n: p.n, kind: p.kind, how: p.how, id, number: row.number, ettn: row.ettn, profile: row.profile, eStatus: row.eStatus, payable: row.payable, ms: Date.now() - t0, toasts };
        done.push(item);
        log(`${ui.tag} #${p.n} ${p.kind} ${p.how}`, { no: row.number, eStatus: row.eStatus, tutar: row.payable, sn: Math.round(item.ms / 1000), ileti: toasts.slice(-1)[0] || "" });
      } catch (error) {
        await ui.shot(`hata-${p.n}`).catch(() => {});
        log(`${ui.tag} #${p.n} HATA`, String(error?.message || error).slice(0, 400));
        done.push({ user: user.login, n: p.n, kind: p.kind, how: p.how, error: String(error?.message || error).slice(0, 300) });
      }
    }
    await ui.shot("son");
    return done;
  };
  console.log("\n■ 5 kullanıcı aynı anda başlıyor");
  const all = (await Promise.all(sessions.map((ui, i) => worker(ui, users[i], plans[i])))).flat();
  log("KESİM SÜRESİ (sn)", Math.round((Date.now() - started) / 1000));
  result.docs = all;

  // ---------- Doğrulama ----------
  console.log("\n■ Kesim sonrası denetim");
  const ok = all.filter(d => !d.error);
  check(ok.length === 30, `30 belge ekrandan kesildi (${ok.length}; hata ${all.length - ok.length})`);
  check(new Set(ok.map(d => d.id)).size === ok.length, "her belge ayrı kayıt (kimlikler benzersiz)");
  const tef = ok.filter(d => d.kind.startsWith("eF")).map(d => d.number).sort();
  const tea = ok.filter(d => d.kind === "eA").map(d => d.number).sort();
  const seqOf = no => Number(String(no).slice(7));
  const consecutive = list => list.every((no, i) => seqOf(no) === seq + i);
  check(tef.length === 15 && new Set(tef).size === 15 && tef.every(no => /^TEF\d{13}$/.test(no)) && consecutive(tef), `e-Fatura numaraları TEF, benzersiz, boşluksuz ${tef[0]} … ${tef.at(-1)}`);
  check(tea.length === 15 && new Set(tea).size === 15 && tea.every(no => /^TEA\d{13}$/.test(no)) && consecutive(tea), `e-Arşiv numaraları TEA, benzersiz, boşluksuz ${tea[0]} … ${tea.at(-1)}`);
  check(new Set(ok.map(d => d.ettn)).size === ok.length, "ETTN'ler benzersiz");
  check(ok.every(d => (d.kind === "eA") === (d.profile === "EARSIVFATURA")) && ok.filter(d => d.kind === "eF-Ticari").every(d => d.profile === "TICARIFATURA"), "belge türleri plana uygun (Temel / Ticari / e-Arşiv)");
  check(ok.every(d => ["processing", "sent", "accepted"].includes(d.eStatus)), `hepsi EDM'ye ulaştı (durumlar: ${[...new Set(ok.map(d => d.eStatus))].join(", ")})`);
  const sends = dbAll("SELECT entity_id AS id, actor_id AS actor, COUNT(*) AS n FROM audit_events WHERE type = 'invoice.e.sent' GROUP BY entity_id, actor_id")();
  const sendMap = new Map(sends.map(r => [r.id, r]));
  check(ok.every(d => sendMap.get(d.id)?.n === 1), "her belge EDM'ye BİR kez gönderildi (işlem kaydı)");
  check(ok.every(d => sendMap.get(d.id)?.actor === users.find(u => u.login === d.user).id), "her belge kendisini kesen kullanıcının adıyla gönderildi");

  // ---------- EDM son durum (Durum Sorgula; aynı uç) ----------
  console.log("\n■ Durum Sorgula — 30 belge, son duruma kadar");
  const pending = new Set(ok.map(d => d.id));
  for (let round = 1; round <= 20 && pending.size; round += 1) {
    await Promise.all(sessions.map(async (ui, i) => {
      for (const d of ok.filter(x => x.user === users[i].login && pending.has(x.id))) {
        const st = unwrap(await ui.page.evaluate(async id => { const r = await fetch(`/api/workspace/invoices/${id}/e-refresh`, { method: "POST", headers: { "content-type": "application/json", "x-requested-with": "fetch" }, body: "{}" }); return { status: r.status, data: await r.json().catch(() => null) }; }, d.id));
        if (st.status === 200 && st.data?.eStatus && st.data.eStatus !== "processing") pending.delete(d.id);
        if (st.status !== 200) log(`  ${d.number} Durum Sorgula ${st.status}`, st.data);
      }
    }));
    const counts = {};
    for (const d of ok) { const s = invRow(d.id).eStatus; counts[s] = (counts[s] || 0) + 1; }
    log(`TUR ${round}`, counts);
    if (pending.size) await sleep(40_000);
  }
  const finals = ok.map(d => ({ ...d, ...invRow(d.id) }));
  check(finals.every(d => ["sent", "accepted"].includes(d.eStatus)), `30 belgenin son durumu Gönderildi (${finals.filter(d => !["sent", "accepted"].includes(d.eStatus)).map(d => `${d.number}:${d.eStatus}`).join(", ") || "hepsi"})`);
  for (const d of finals.filter(x => !["sent", "accepted"].includes(x.eStatus))) log(`  SORUNLU ${d.number}`, d.eMessage);
  // Bakiyeler + defter
  const expFirm = finals.filter(d => d.accountId === firm.id).reduce((s, d) => s + d.payable, 0);
  const expPerson = finals.filter(d => d.accountId === person.id).reduce((s, d) => s + d.payable, 0);
  const firm1 = await balance(firm.id);
  const person1 = await balance(person.id);
  log("BAKİYELER", { firma: [firm0, firm1, expFirm], kisi: [person0, person1, expPerson] });
  check(Math.abs(firm1 - firm0 - expFirm) < 0.01, `DESTEK OFİS bakiyesi = 15 e-Fatura toplamı (${expFirm.toFixed(2)})`);
  check(Math.abs(person1 - person0 - expPerson) < 0.01, `DESTEK OFİS Bireysel bakiyesi = 15 e-Arşiv toplamı (${expPerson.toFixed(2)})`);
  const gate = await get("/api/workspace/ledger/integrity");
  check(gate.status === 200 && gate.data?.ok !== false && !(gate.data?.problems || []).length, `defter bütünlüğü temiz (${JSON.stringify(gate.data).slice(0, 160)})`);
  for (const d of finals.filter((_, i) => i % 6 === 0)) {
    const pdf = await api.raw("GET", `/api/workspace/invoices/${d.id}/resmi.pdf`);
    if (pdf.status === 200) writeFileSync(path.join(OUT, `${d.number}-resmi.pdf`), pdf.buffer);
    check(pdf.status === 200 && pdf.buffer.subarray(0, 5).toString("latin1") === "%PDF-", `${d.number} Resmî Görüntü (EDM) alındı`);
  }
  result.docs = finals.map(({ user, role, n, kind, how, number, ettn, profile, eStatus, payable, ms }) => ({ user, role, n, kind, how, number, ettn, profile, eStatus, payable, ms }));
  console.log("\nÖZET TABLO");
  for (const d of result.docs.sort((a, b) => a.number.localeCompare(b.number))) console.log(`  ${d.number}  ${d.ettn}  ${d.kind.padEnd(9)} ${d.how.padEnd(11)} ${d.user}  ${String(d.payable).padStart(8)}  ${d.eStatus}`);
} catch (error) {
  log("HATA", String(error?.stack || error).slice(0, 900));
  fail += 1;
} finally {
  log("SAYFA HATALARI", errors.length ? errors : "yok");
  check(!errors.length, "5 kullanıcının sayfasında hata yok");
  writeFileSync(path.join(OUT, "sonuc.json"), mask(JSON.stringify(result, null, 1)));
  console.log(`SONUÇ: ${pass} geçti, ${fail} kaldı`);
  process.exitCode = fail ? 1 : 0;
  await browser.close();
  await server.close();
}
