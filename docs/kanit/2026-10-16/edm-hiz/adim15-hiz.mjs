// EDM TEST ORTAMI — HIZ / STRES TESTİ: dakikada 100, 500, 1.000 belge (kullanıcı, 16.10.2026: "sadece dakikada 100–1.000 belgeli büyük stres testi yap
// sonuçlarına bakalım, ben de portaldan bakayım; müşteri DESTEK OFİS olsun").
// Satıcı DESTEK OFİS; alıcılar "DESTEK OFİS" (e-Fatura) ve "DESTEK OFİS Bireysel" (e-Arşiv), yarı yarıya. Her belge programın "Kaydet ve Gönder" yoluyla
// (POST /api/workspace/invoices, eSend "now") — ekranın çağırdığı uç. Sunucu ÜRETİM ayarıyla (gateVerify / moneyStrict test denetimleri kapalı).
// Kademeler: her biri 60 sn, hedef hız kadar istek eşit aralıkla başlatılır (en çok EŞZAMANLI istek sınırı). FREN: kademede hata > %10 ya da EDM'den
// aşırı yük / hizmet yok (429/503) görülürse sonraki kademeye geçilmez (ortak test ortamı).
// Ölçülür: ulaşılan hız, istek süresi (p50/p95/en çok), hata türleri, numara benzersiz + boşluksuz, tek gönderim, bakiye = bağımsız hesap, defter
// bütünlüğü, EDM son durumları. Kimlik bilgisi yalnız yüklenen dosyadan; çıktıda maskelenir. Canlı kilitli. HUKUK_LICENSE_URL ölü adres (ders 30).
// Kullanım: NODE_USE_ENV_PROXY=1 node adim15-hiz.mjs <kimlik dosyası> <çıktı klasörü> [kademeler, ör. 100,500,1000]
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import path from "node:path";
const R = "/home/user/ofis---y-netimi";
const { startTestServer, ADMIN_PASSWORD } = await import(`${R}/test/helpers.mjs`);
const text = readFileSync(process.argv[2], "utf8");
const username = (text.match(/kullan[ıi]c[ıi] ad[ıi]\s*:\s*(\S+)/i) || [])[1];
const password = (text.match(/şifre\s*:\s*(\S+)/i) || [])[1];
const OUT = process.argv[3];
const TIERS = (process.argv[4] || "100,500,1000").split(",").map(Number);
const MAX_INFLIGHT = 60;
mkdirSync(OUT, { recursive: true });
const mask = value => String(typeof value === "string" ? value : JSON.stringify(value ?? "")).split(password).join("***").split(username).join("<kullanıcı>");
const log = (label, value = "") => console.log(`${new Date().toISOString().slice(11, 19)} ${label}${value === "" ? "" : `: ${mask(value).slice(0, 1200)}`}`);
let pass = 0, fail = 0;
const check = (cond, what) => { cond ? (pass += 1) : (fail += 1); console.log(`  ${cond ? "✓" : "✗"} ${mask(what)}`); return Boolean(cond); };
const unwrap = r => ({ ...r, data: r.data && typeof r.data === "object" && "ok" in r.data ? (r.data.ok ? r.data.data : r.data) : r.data });
const sleep = ms => new Promise(r => setTimeout(r, ms));
const k = x => Math.round(x * 100) / 100;
const pct = (arr, p) => { const s = [...arr].sort((a, b) => a - b); return s.length ? s[Math.min(s.length - 1, Math.floor((p / 100) * s.length))] : 0; };

const server = await startTestServer({ edocEnabled: true, gateVerify: false, moneyStrict: false, env: { HUKUK_LICENSE_URL: "http://127.0.0.1:9" } });
const api = server.client();
await api.login("admin", ADMIN_PASSWORD);
const post = async (u, b) => unwrap(await api.post(u, b));
const put = async (u, b) => unwrap(await api.put(u, b));
const get = async u => unwrap(await api.get(u));
const db = server.app.store;
const seq = 100_000_000 + Math.floor(Math.random() * 700_000_000);
const year = new Date().getFullYear();
const all = [];
const summary = { tiers: [] };
try {
  const s = await put("/api/workspace/invoices/settings", {
    seller: { name: "DESTEK OFİS", taxNo: "3230512384", taxOffice: "Kadıköy", address: "Caferağa Mh. Moda Cd. 12", district: "Kadıköy", city: "İstanbul", postalCode: "34710", email: "bilgi@destekofis.com.tr" },
    efatura: true, earsiv: true, start: { [`TEF${year}`]: seq, [`TEA${year}`]: seq },
    integrator: { env: "test", baseUrl: "", username, password, senderAlias: "urn:mail:defaultgb@edmbilisim.com.tr", mailboxAlias: "urn:mail:defaultpk@edmbilisim.com.tr" },
  });
  check(s.status === 200, `ayarlar ${s.status}`);
  const firm = (await post("/api/workspace/accounts", { name: "DESTEK OFİS", type: "customer", taxNo: "3230512384", taxOffice: "Kadıköy", address: "Caferağa Mh. 12", district: "Kadıköy", city: "İstanbul", eInvoice: true, eAlias: "urn:mail:defaultpk@edmbilisim.com.tr" })).data.id;
  const person = (await post("/api/workspace/accounts", { name: "DESTEK OFİS Bireysel", type: "customer", partyKind: "person", firstName: "Destek", familyName: "Ofis", taxNo: "10000000146", address: "Moda Cd. 1", district: "Kadıköy", city: "İstanbul", email: "alici@example.com" })).data.id;
  const ITEMS = [["Yazılım Lisansı", 1500, 20], ["Kurulum Hizmeti", 750, 20], ["Eğitim", 400, 10], ["Kırtasiye", 85.5, 20], ["Kitap", 120, 1]];
  const specOf = n => {
    const count = 1 + (n % 3);
    const lines = Array.from({ length: count }, (_, i) => { const [name, price, vat] = ITEMS[(n + i) % ITEMS.length]; return { name: `${name} ${n}`, qty: 1 + ((n + i) % 4), unitPrice: price, vatRate: vat }; });
    return { efatura: n % 2 === 0, lines };
  };
  const expectedPayable = spec => k(spec.lines.reduce((sum, l) => { const net = k(l.qty * l.unitPrice); return sum + net + k(net * l.vatRate / 100); }, 0));
  let n = 0;
  for (const rate of TIERS) {
    const tier = { rate, started: 0, done: 0, ok: 0, errors: {}, ms: [], t0: Date.now() };
    log(`■ KADEME ${rate}/dk başlıyor`);
    const interval = 60_000 / rate;
    let inflight = 0;
    const jobs = [];
    const tierStart = Date.now();
    for (let i = 0; i < rate; i += 1) {
      const due = tierStart + i * interval;
      const wait = due - Date.now();
      if (wait > 0) await sleep(wait);
      while (inflight >= MAX_INFLIGHT) await sleep(5);
      const id = ++n;
      const spec = specOf(id);
      inflight += 1;
      tier.started += 1;
      const t0 = Date.now();
      jobs.push(post("/api/workspace/invoices", { scenario: "service_sale", accountId: spec.efatura ? firm : person, lines: spec.lines, payment: { rest: "open" }, eSend: "now" })
        .then(r => {
          const ms = Date.now() - t0;
          tier.ms.push(ms);
          const send = r.data?.autoSend || {};
          // "Kaydet ve Gönder" yanıtı: { …belge, autoSend: { ok, message } } — gönderim sonucu autoSend'de.
          const code = r.status !== 200 ? `kayıt ${r.status} ${r.data?.code || r.data?.error || ""}`.slice(0, 90) : send.ok !== true ? `gönderim: ${String(send.message || "yanıt yok").slice(0, 80)}` : "";
          if (code) tier.errors[code] = (tier.errors[code] || 0) + 1; else tier.ok += 1;
          all.push({ n: id, tier: rate, efatura: spec.efatura, id: r.data?.id, ms, code, expected: expectedPayable(spec), sendMsg: String(send.message || send.error || "").slice(0, 160) });
        })
        .catch(error => { tier.errors[`istisna ${error.code || error.message}`] = (tier.errors[`istisna ${error.code || error.message}`] || 0) + 1; })
        .finally(() => { inflight -= 1; tier.done += 1; }));
    }
    const launchSec = (Date.now() - tierStart) / 1000;
    await Promise.all(jobs);
    const totalSec = (Date.now() - tierStart) / 1000;
    const errCount = Object.values(tier.errors).reduce((a, b) => a + b, 0);
    const row = { hedef: `${rate}/dk`, baslatilan: tier.started, basarili: tier.ok, hata: errCount, hatalar: tier.errors, baslatmaSn: Math.round(launchSec), bitisSn: Math.round(totalSec), ulasilanHiz: Math.round((tier.ok / totalSec) * 60), p50ms: pct(tier.ms, 50), p95ms: pct(tier.ms, 95), enCokMs: Math.max(0, ...tier.ms) };
    summary.tiers.push(row);
    log(`KADEME ${rate}/dk SONUÇ`, row);
    const overload = Object.keys(tier.errors).some(key => /429|503|aşırı|unavailable|busy/i.test(key));
    if (errCount / Math.max(1, tier.started) > 0.1 || overload) { log("FREN: hata > %10 ya da aşırı yük — sonraki kademeye geçilmedi"); summary.fren = true; break; }
  }

  // ---------- Denetim ----------
  console.log("\n■ Denetim");
  const rows = db.all("SELECT id, number, ettn, profile, status, e_status AS eStatus, e_adapter AS eAdapter, try_payable AS payable, account_id AS accountId FROM invoices WHERE kind = 'sale'");
  const byId = new Map(rows.map(r => [r.id, r]));
  const created = all.filter(d => d.id);
  check(created.length === all.length, `kaydedilen belge ${created.length}/${all.length}`);
  for (const [series, ef] of [["TEF", true], ["TEA", false]]) {
    const nums = created.filter(d => d.efatura === ef).map(d => byId.get(d.id)?.number).filter(Boolean).sort();
    const uniq = new Set(nums).size === nums.length;
    const gapless = nums.every((no, i) => Number(no.slice(7)) === seq + i);
    check(uniq && gapless, `${series} numaraları benzersiz ${uniq} + boşluksuz ${gapless}: ${nums.length} belge ${nums[0] || ""} … ${nums.at(-1) || ""}`);
  }
  const sends = new Map(db.all("SELECT entity_id AS id, COUNT(*) AS n FROM audit_events WHERE type = 'invoice.e.sent' GROUP BY entity_id").map(r => [r.id, r.n]));
  check(created.every(d => (sends.get(d.id) || 0) <= 1), `hiçbir belge iki kez gönderilmedi (en çok ${Math.max(0, ...sends.values())})`);
  const sentOnce = created.filter(d => sends.get(d.id) === 1).length;
  log("EDM'YE GİDEN", `${sentOnce}/${created.length}`);
  const payBad = created.filter(d => Math.abs((byId.get(d.id)?.payable ?? NaN) - d.expected) > 0.005);
  check(!payBad.length, `ödenecek tutarlar = bağımsız hesap (${created.length - payBad.length}/${created.length})`);
  for (const [label, accountId, ef] of [["DESTEK OFİS", firm, true], ["DESTEK OFİS Bireysel", person, false]]) {
    const exp = k(created.filter(d => d.efatura === ef).reduce((s2, d) => s2 + d.expected, 0));
    const bal = Number((await get(`/api/workspace/accounts/${accountId}`)).data?.totals?.balance);
    check(Math.abs(bal - exp) < 0.01, `${label} bakiyesi ${bal} = beklenen ${exp}`);
  }
  const gate = await get("/api/workspace/ledger/integrity");
  check(gate.status === 200 && gate.data?.ok !== false, "defter bütünlüğü temiz");

  // ---------- EDM son durumları (Durum Sorgula; 10 eşzamanlı) ----------
  console.log("\n■ EDM son durumları");
  const targets = created.filter(d => sends.get(d.id) === 1);
  for (let round = 1; round <= 25; round += 1) {
    const open = targets.filter(d => ["processing", "sent"].includes(byId.get(d.id)?.eStatus) && !d.final);
    if (!open.length) break;
    const queue = [...open];
    await Promise.all(Array.from({ length: 10 }, async () => { while (queue.length) { const d = queue.shift(); const r = await post(`/api/workspace/invoices/${d.id}/e-refresh`, {}); if (r.status === 200 && r.data?.eStatus !== "processing") d.final = r.data.eStatus; d.last = r.data?.eStatus || `HTTP ${r.status}`; } }));
    const counts = {};
    for (const d of targets) counts[d.final || d.last || "?"] = (counts[d.final || d.last || "?"] || 0) + 1;
    log(`durum turu ${round}`, counts);
    if (targets.every(d => d.final)) break;
    await sleep(40_000);
  }
  const finals = {};
  for (const d of targets) finals[d.final || "sonuçlanmadı"] = (finals[d.final || "sonuçlanmadı"] || 0) + 1;
  summary.edmSon = finals;
  check(targets.every(d => d.final === "sent" || d.final === "accepted"), `EDM son durum: ${JSON.stringify(finals)}`);
  const ranges = {};
  for (const ef of [true, false]) { const nums = created.filter(d => d.efatura === ef).map(d => byId.get(d.id)?.number).filter(Boolean).sort(); ranges[ef ? "eFatura" : "eArsiv"] = `${nums[0]} … ${nums.at(-1)} (${nums.length})`; }
  summary.numaralar = ranges;
} catch (error) {
  log("HATA", String(error?.stack || error).slice(0, 900));
  fail += 1;
} finally {
  writeFileSync(path.join(OUT, "ozet.json"), mask(JSON.stringify(summary, null, 1)));
  writeFileSync(path.join(OUT, "belgeler.json"), mask(JSON.stringify(all.map(({ n, tier, efatura, ms, code, expected, final, sendMsg }) => ({ n, tier, efatura, ms, code, expected, final, sendMsg })), null, 0)));
  log("ÖZET", summary);
  console.log(`SONUÇ: ${pass} geçti, ${fail} kaldı`);
  process.exitCode = fail ? 1 : 0;
  await server.close();
}
