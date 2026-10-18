// H4 yeniden üretme (ders 20): yükte "EDM'ye bağlanılamadı: UND_ERR_SOCKET" sahte EDM'nin yük altındaki süreçte olmasından mı (test düzeni),
// programın kendisinden mi? Program AYRI SÜREÇTE (fork), sahte EDM ya AYRI SÜREÇTE ("ayri") ya da yük üreticisiyle AYNI süreçte ("ayni", hız
// testindeki düzen). Yük: N API işçisi, beklemesiz — Kaydet ve Gönder (e-Arşiv / e-Fatura), Durum Sorgula, iptal, liste.
// Kullanım: node yuk.mjs <kod kökü> <ayri|ayni> [isci=15] [sn=180] [hazirlik=1500] [gecikme=min-maks ms, ör. 1500-3500]
// Çıktı (stdout JSON): istek sayıları, hata kodları (integrator-unreachable, buyer-check-failed, einvoice-uncertain), Kaydet ve Gönder'de
// autoSend.ok=false sayısı ve iletileri, programın olay döngüsü gecikmesi (p50/p99/en çok, ms).
// Ağa çıkmaz (sahte EDM 127.0.0.1), HUKUK_LICENSE_URL=http://127.0.0.1:9 (ders 30).
import { fork } from "node:child_process";
import { mkdtempSync, rmSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { monitorEventLoopDelay } from "node:perf_hooks";
import { fileURLToPath } from "node:url";
import { lagLoop } from "./gecikme.mjs";

const SELF = fileURLToPath(import.meta.url);
const HERE = path.dirname(SELF);
const PASS = "Yuk-H4-Yonetici-1!";
const DEAD = "http://127.0.0.1:9";

if (process.env.H4_SUNUCU) {
  const conf = JSON.parse(process.env.H4_SUNUCU);
  const { createApp } = await import(`${conf.root}/server/app.mjs`);
  const loop = monitorEventLoopDelay({ resolution: 10 });
  loop.enable();
  const app = createApp({ dataDir: conf.dataDir, backupDir: path.join(conf.dataDir, "..", "b"), logLevel: "silent", scheduleBackups: false, env: { HUKUK_ADMIN_PASSWORD: PASS, HUKUK_DATASET_AUTOSYNC: "0", HUKUK_LICENSE_URL: DEAD }, license: { enforce: false, machineId: "0123456789abcdef0123456789abcdef" }, startLicenseTimers: false, edocEnabled: true, edocLive: true });
  const { port } = await app.listen(0, "127.0.0.1");
  // Zorla gecikme (ders 20): hız testi D3'teki doymuş olay döngüsü (p99 1,9–4,1 sn) yerine, programın sürecinde aralıklı EŞZAMANLI iş (min–maks ms)
  // — yükteki uzun eşzamanlı işin (store.tx, büyük liste) ön koşulunu sabit üretir. Sahte EDM bu süreçte DEĞİL.
  if (conf.lag) {
    const [min, max] = conf.lag.split("-").map(Number);
    const busy = ms => {
      const end = Date.now() + ms;
      while (Date.now() < end);
    };
    const tick = () => {
      busy(min + Math.random() * (max - min));
      setTimeout(tick, 200 + Math.random() * 800);
    };
    setTimeout(tick, 1000);
  }
  process.send({ cmd: "ready", port });
  process.on("message", async message => {
    if (message === "reset") {
      loop.reset();
      process.send({ cmd: "reset" });
    }
    if (message === "stat") process.send({ cmd: "stat", p50: loop.percentile(50) / 1e6, p99: loop.percentile(99) / 1e6, max: loop.max / 1e6 });
    if (message === "kapat") {
      await app.close();
      process.exit(0);
    }
  });
} else {
  const root = path.resolve(process.argv[2]);
  const mode = process.argv[3] === "ayni" ? "ayni" : "ayri";
  const workers = Number(process.argv[4] || 15);
  const seconds = Number(process.argv[5] || 180);
  const prep = Number(process.argv[6] || 1500);
  const lag = process.argv[7] || "";
  // Gecikmenin yeri: "program" (programın süreci) ya da "edm" (sahte EDM'nin bulunduğu süreç: "ayri"da sahte EDM süreci, "ayni"da bu süreç).
  const lagWhere = process.argv[8] === "edm" ? "edm" : "program";
  const work = mkdtempSync(path.join(os.tmpdir(), "h4-yuk-"));
  const { createClient } = await import(`${root}/test/helpers.mjs`);
  const { startMockEdm, OUR_VKN, BUYER_VKN } = await import(`${root}/test/einvoice-mock.mjs`);
  let mock;
  let mockChild;
  if (mode === "ayri") {
    mockChild = fork(path.join(HERE, "mock-surec.mjs"), [root, lagWhere === "edm" ? lag : ""], { stdio: ["ignore", "ignore", "inherit", "ipc"] });
    mock = { url: await new Promise(resolve => mockChild.once("message", message => resolve(message.url))) };
  } else mock = await startMockEdm();
  const server = fork(SELF, [], { env: { ...process.env, H4_SUNUCU: JSON.stringify({ root, dataDir: path.join(work, "data"), lag: lagWhere === "program" ? lag : "" }), HUKUK_LICENSE_URL: DEAD, HTTPS_PROXY: "", https_proxy: "", HTTP_PROXY: "", http_proxy: "" }, stdio: ["ignore", "inherit", "inherit", "ipc"], execArgv: ["--disable-warning=ExperimentalWarning"] });
  const port = await new Promise(resolve => server.on("message", message => message.cmd === "ready" && resolve(message.port)));
  const ask = cmd => new Promise(resolve => {
    const on = message => {
      if (message.cmd === cmd) {
        server.off("message", on);
        resolve(message);
      }
    };
    server.on("message", on);
    server.send(cmd);
  });
  const unwrap = r => (r?.data && typeof r.data === "object" && "ok" in r.data ? (r.data.ok ? r.data.data : r.data) : r?.data);
  const login = async () => {
    const api = createClient(`http://127.0.0.1:${port}`);
    const r = await api.login("admin", PASS);
    if (r.status !== 200) throw new Error(`giriş ${r.status}`);
    return api;
  };
  const step = label => console.error(`[yük] ${new Date().toISOString().slice(11, 19)} ${label}`);
  step(`program hazır :${port}, sahte EDM ${mock.url}`);
  const api = await login();
  step("giriş");
  const must = async (label, p) => {
    const r = await p;
    if (r.status !== 200) throw new Error(`${label}: ${r.status} ${JSON.stringify(r.data).slice(0, 300)}`);
    return unwrap(r);
  };
  await must("kurulum", api.post("/api/workspace/bank/setup/dismiss", {}));
  await must("ayar", api.put("/api/workspace/invoices/settings", { seller: { name: "H4 YÜK A.Ş.", taxNo: OUR_VKN, taxOffice: "Çankaya", address: "Atatürk Blv. 1", district: "Çankaya", city: "Ankara" }, efatura: true, earsiv: true, integrator: { env: "test", baseUrl: mock.url, username: "edmkullanici", password: "Gizli-Parola-1", senderAlias: "urn:mail:defaultgb@deneme.com.tr" } }));
  const tckn = seed => {
    const d = [1 + (seed % 9), ...String(seed * 7919 + 12345678).padStart(8, "0").slice(-8).split("").map(Number)];
    const odd = d[0] + d[2] + d[4] + d[6] + d[8];
    const even = d[1] + d[3] + d[5] + d[7];
    d.push((((odd * 7 - even) % 10) + 10) % 10);
    d.push(d.reduce((a, b) => a + b, 0) % 10);
    return d.join("");
  };
  const people = [];
  for (let i = 0; i < 20; i += 1) people.push((await must("kişi", api.post("/api/workspace/accounts", { name: `Kişi ${i}`, type: "customer", partyKind: "person", firstName: "Kişi", familyName: `No${i}`, taxNo: tckn(500 + i), taxOffice: "M", address: "A", district: "B", city: "İzmir" }))).id);
  const firms = [];
  for (let i = 0; i < 5; i += 1) firms.push((await must("firma", api.post("/api/workspace/accounts", { name: `Firma ${i} A.Ş.`, type: "customer", taxNo: BUYER_VKN, taxOffice: "M", address: "A", district: "B", city: "Ankara", eInvoice: true, eAlias: "urn:mail:defaultpk@alici.com.tr" }))).id);
  let seed = 7;
  const rand = () => ((seed = (seed * 1103515245 + 12345) % 2147483648) / 2147483648);
  const pick = list => list[Math.floor(rand() * list.length)];
  const sale = (who, eSend = "now") => api.post("/api/workspace/invoices", { scenario: "service_sale", accountId: who, lines: [{ name: "Hizmet", qty: 1 + Math.floor(rand() * 5), unitPrice: 100 + Math.floor(rand() * 900), vatRate: 20 }], payment: { rest: "open" }, eSend });
  step("cariler");
  const sent = [];
  for (let i = 0; i < prep; i += 8) {
    const batch = await Promise.all(Array.from({ length: Math.min(8, prep - i) }, () => sale(rand() < 0.6 ? pick(people) : pick(firms), "later")));
    for (const r of batch) if (r.status === 200) sent.push(unwrap(r).id);
  }
  const counts = { istek: 0, durum: {}, hata: {}, autoSendFail: 0, autoSendMesaj: {} };
  const note = (label, r) => {
    counts.istek += 1;
    counts.durum[r.status] = (counts.durum[r.status] || 0) + 1;
    const data = unwrap(r);
    if (r.status !== 200) {
      const key = `${label} ${r.status} ${data?.code || ""} ${String(data?.error || "").slice(0, 80)}`;
      counts.hata[key] = (counts.hata[key] || 0) + 1;
    } else if (data?.autoSend && data.autoSend.ok === false) {
      counts.autoSendFail += 1;
      const key = String(data.autoSend.message || "").slice(0, 120);
      counts.autoSendMesaj[key] = (counts.autoSendMesaj[key] || 0) + 1;
    }
    return data;
  };
  step(`hazırlık ${sent.length} belge`);
  await ask("reset");
  const end = Date.now() + seconds * 1000;
  if (lag && lagWhere === "edm" && mode === "ayni") lagLoop(lag, () => Date.now() < end);
  const ids = [];
  const worker = async () => {
    const client = await login();
    while (Date.now() < end) {
      const roll = rand();
      if (roll < 0.45) {
        const r = await client.post("/api/workspace/invoices", { scenario: "service_sale", accountId: rand() < 0.6 ? pick(people) : pick(firms), lines: [{ name: "Hizmet", qty: 1, unitPrice: 100 + Math.floor(rand() * 900), vatRate: 20 }], payment: { rest: "open" }, eSend: "now" });
        const data = note("Kaydet ve Gönder", r);
        if (r.status === 200 && data?.id) ids.push(data.id);
      } else if (roll < 0.7 && ids.length) {
        note("Durum Sorgula", await client.post(`/api/workspace/invoices/${pick(ids)}/e-refresh`, {}));
      } else if (roll < 0.78 && ids.length) {
        const id = ids.splice(Math.floor(rand() * ids.length), 1)[0];
        note("İptal", await client.post(`/api/workspace/invoices/${id}/cancel`, { reason: "yük" }));
      } else if (roll < 0.85 && sent.length) {
        const id = sent.pop();
        note("e-Belge Gönder", await client.post(`/api/workspace/invoices/${id}/send`, {}));
      } else note("Liste", await client.get("/api/workspace/invoices?tab=all&limit=200"));
    }
  };
  const t0 = Date.now();
  await Promise.all(Array.from({ length: workers }, worker));
  step("yük bitti");
  const loop = await ask("stat");
  const out = { root, mode, workers, seconds, prep, lag, lagWhere, sureSn: Math.round((Date.now() - t0) / 1000), olayDongusuMs: { p50: Math.round(loop.p50), p99: Math.round(loop.p99), max: Math.round(loop.max) }, ...counts };
  console.log(JSON.stringify(out, null, 1));
  server.send("kapat");
  mockChild?.send("kapat");
  if (!mockChild) await mock.close?.();
  await new Promise(resolve => server.once("exit", resolve));
  rmSync(work, { recursive: true, force: true });
}
