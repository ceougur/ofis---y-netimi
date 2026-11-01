// İŞ Z (2.4.8, T9 ORTA bulgusu): T9 ölçek ajanının düzeneğinin (wt-t9-248 test/t9-248/ortak.mjs, b2e7bf19 üzerinde) AYNEN kopyası; yalnız sahte Meta yolu bu klasöre.
// T9 ÖLÇEK (2.4.8 son aday; CLAUDE.md DURUM 11 "T9 ölçek TEK BAŞINA"; plan docs/erp/WHATSAPP-API-PLANI-2.4.8.md §8 ÖLÇEK, §9 Ölçüm) — ortak düzenek.
// Ürün kodu DEĞİŞMEZ; yalnız ölçer. npm test'e girmez (test/t9-248/ — *.test.mjs değil).
//
// GERÇEK program (createApp; üretime yakın ayarlar: gateVerify kapalı, rapor iş parçacığı açık, moneyStrict kapalı) + yerel kapıcı (bulut/kapi/kapi.mjs, test/kapi-yerel.mjs)
// + sahte lisans servisi + AYRI SÜREÇTE sahte Meta Graph (sahte-meta-cocuk.mjs). Dış istek YOK (ders 30: HUKUK_LICENSE_URL ölü adres; Meta / Cloudflare / lisans yerel sahte).
// Durum bildirimleri (Meta'nın kancası) GERÇEK yoldan gelir: sahte "Meta" → kapıcı (Host: ofisin adresi) → tünel → programın uzak dinleyicisi → /wa/kanca/<gizli yol>.
// Saat sahte (config.now; ders 13, 22): verilen andan akar ya da durur. Veri: verilen klasörün TAZE KOPYASI (önce/sonra aynı veri — ders 15).
import { fork } from "node:child_process";
import { cpSync, rmSync, statSync, existsSync, readdirSync } from "node:fs";
import http from "node:http";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createClock } from "../../server/lib/clock.mjs";
import { startTestServer } from "../helpers.mjs";
import { lisansAnahtari } from "../kapi-ortak.mjs";
import { startKapi } from "../kapi-yerel.mjs";
import { PNID, TOKEN, WABA } from "../whatsapp-248-ortak.mjs";

export const KOK = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
export const PASS = "Olcek-210-Yonetici!";
export const STAFF_PASS = "Olcek-210-Personel!";
const MACHINE = "0123456789abcdef0123456789abcdef";
process.env.HUKUK_LICENSE_URL ||= "http://127.0.0.1:9";

export const yuzdelik = (l, p) => {
  const s = l.slice().sort((a, b) => a - b);
  return s.length ? Math.round(s[Math.min(s.length - 1, Math.ceil((p / 100) * s.length) - 1)]) : null;
};
export const ozet = l => ({ n: l.length, p50: yuzdelik(l, 50), p95: yuzdelik(l, 95), enCok: l.length ? Math.round(Math.max(...l)) : null });
export const log = (...a) => console.log(new Date().toISOString().slice(11, 19), ...a);
export const mb = b => Math.round((b / 1048576) * 10) / 10;

/** Klasördeki dosyaların boyutu (bayt), göreli yol → boyut. */
export function boyutlar(dir) {
  const out = {};
  const gez = d => {
    for (const ad of readdirSync(d, { withFileTypes: true })) {
      const p = path.join(d, ad.name);
      if (ad.isDirectory()) gez(p);
      else out[path.relative(dir, p)] = statSync(p).size;
    }
  };
  if (existsSync(dir)) gez(dir);
  return out;
}

/** Sahte Meta çocuk süreci. */
async function sahteMeta(tier, onEk) {
  const child = fork(path.join(KOK, "test/isz-248/sahte-meta-cocuk.mjs"), [tier, onEk], { stdio: ["ignore", "inherit", "inherit", "ipc"], env: { ...process.env } });
  const bekleyen = new Map();
  let sira = 0;
  const url = await new Promise((resolve, reject) => {
    child.once("error", reject);
    child.on("message", m => {
      if (m.hazir) return resolve(m.url);
      const cb = bekleyen.get(m.kimlik);
      if (cb) {
        bekleyen.delete(m.kimlik);
        cb(m.deger);
      }
    });
  });
  const iste = (tur, ek = {}) =>
    new Promise(resolve => {
      sira += 1;
      bekleyen.set(sira, resolve);
      child.send({ kimlik: sira, tur, ...ek });
    });
  return {
    url,
    ayarla: yama => iste("ayarla", { yama }),
    yeni: () => iste("yeni"),
    abonelik: () => iste("abonelik"),
    sayac: () => iste("sayac"),
    kapat: () => iste("kapat").catch(() => {}),
    pid: child.pid,
  };
}

function ham(base, method, yol, { body = null, headers = {} } = {}) {
  const url = new URL(base);
  const payload = body === null ? null : Buffer.from(body);
  return new Promise((resolve, reject) => {
    const req = http.request({ host: url.hostname, port: url.port, method, path: yol, agent: hamAjan, headers: { ...(payload ? { "content-type": "application/json", "content-length": payload.length } : {}), ...headers } }, res => {
      const parts = [];
      res.on("data", c => parts.push(c));
      res.on("end", () => resolve({ status: res.statusCode, text: Buffer.concat(parts).toString("utf8") }));
    });
    req.on("error", reject);
    if (payload) req.write(payload);
    req.end();
  });
}
const hamAjan = new http.Agent({ keepAlive: true, maxSockets: 8 });

export const durumOlayi = statuses => JSON.stringify({ object: "whatsapp_business_account", entry: [{ id: WABA, changes: [{ field: "messages", value: { messaging_product: "whatsapp", metadata: { display_phone_number: "902125550102", phone_number_id: PNID }, statuses } }] }] });
const UCRET = { billable: true, pricing_model: "PMP", category: "utility", type: "regular" };
export const durum = (wamid, value, at, to, extra = {}) => ({ id: wamid, status: value, timestamp: String(Math.floor(at / 1000)), recipient_id: String(to || "").replace(/\D/g, ""), ...(value === "delivered" || value === "sent" ? { pricing: UCRET } : {}), ...extra });

/**
 * @param {object} o
 * @param {string} o.veri kaynak veri klasörü (içinde data/) — taze kopyası açılır
 * @param {string} o.is çalışma klasörü (silinip yeniden kurulur)
 * @param {object} o.saat createClock girdisi { time, fixed }
 * @param {"auto"|"manual"} o.isci gönderim işçisi
 * @param {number} o.aralik iletiler arası bekleme (üretimde 1000 ms)
 * @param {string} o.tier sahte Meta'nın gönderim basamağı
 * @param {boolean} o.baglan WhatsApp bağlantısı + onay + kanca kaydı yapılsın mı (veride zaten varsa false)
 */
export async function kurulum({ veri, is, saat, isci = "auto", aralik = 1000, tier = "TIER_250", onEk = "t9", baglan = true, uretim = true } = {}) {
  rmSync(is, { recursive: true, force: true });
  cpSync(path.join(veri, "data"), path.join(is, "data"), { recursive: true });
  const ofisSaati = createClock(saat);
  const gercek = createClock({ time: Date.now() });
  const lisans = lisansAnahtari();
  const belirtec = () => lisans.belirtec({ at: gercek.ms(), machine: MACHINE, licenseId: "LIS-OLCUM-T9" });
  const meta = await sahteMeta(tier, onEk);
  const kapi = await startKapi({ now: () => gercek.ms(), trustedKeys: lisans.trusted, lisansFetch: async () => ({ json: async () => ({ ok: true, token: belirtec() }) }) });
  const t0 = performance.now();
  const server = await startTestServer({
    dataDir: path.join(is, "data"),
    backupDir: path.join(is, "backups"),
    adminPassword: PASS,
    now: ofisSaati,
    // Uzaktan erişimin güvenlik saati GERÇEK ve akar (üretimdeki gibi): kapıcı işaretinin zaman payı (KAPI_KURALLARI.vekilPayiMs) kapıcının gerçek saatine göre
    // ölçülür; DURAN iş saatine bağlanırsa ölçüm dakikalar sürünce kanca "İstek kapıcıdan gelmedi" (401) alır — test düzeneği hatası, ürün değil (ilk sınır koşusu).
    remoteNow: gercek,
    // Lisans da ALTYAPI SAATİYLE (gerçek; lib/clock.mjs: "lisans … gerçek saat") — iş saati geçmişe alınınca (geçmiş üretimi) belirteç "gelecekte" görünmesin.
    mobileKapiUrl: kapi.base,
    env: { HUKUK_LICENSE_URL: "http://127.0.0.1:9" },
    license: { enforce: true, trustedKeys: lisans.trusted, services: ["https://lisans.olcum.test/api/lisans"], fetchImpl: async () => ({ status: 200, json: async () => ({ ok: true, token: belirtec() }) }), machineId: MACHINE, now: () => gercek.ms(), firstCheckDelayMs: 3_600_000, autoTrial: false },
    whatsappGraphUrl: meta.url,
    whatsappWorker: isci,
    whatsappGapMs: aralik,
    tunnel: { enabled: false, tickMs: 3_600_000, firstTickMs: 3_600_000 },
    // Üretime yakın: tam kapı her işlemde değil, para yazım denetimi günlükte, büyük raporlar iş parçacığında (üretimin varsayılanları).
    ...(uretim ? { gateVerify: false, moneyStrict: false, reportWorker: true } : {}),
  });
  const acilisMs = Math.round(performance.now() - t0);
  let ofis;
  let host;
  try {
    await server.app.license.activateKey("DO-ABCDE-FGHJK-MNPQR-STVWX");
    const sync = server.app.mobileSync;
    ofis = await sync.ofis();
    await sync.kayitGonder();
    const remote = await server.app.listenRemote(0, "127.0.0.1");
    kapi.tunel(ofis.id, `http://127.0.0.1:${remote.port}`);
    host = kapi.ofisHost(ofis.id);
    server.app.mobileRemote.setPublicUrl(`http://${host}`);
  } catch (error) {
    await server.close().catch(() => {});
    await kapi.close();
    await meta.kapat();
    throw error;
  }
  const admin = server.client();
  const giris = await admin.login("admin", PASS);
  if (giris.status !== 200) throw new Error(`admin girişi ${giris.status}`);
  const sirketler = (await admin.get("/api/companies")).data.data.companies;
  const s1 = sirketler.find(c => String(c.code) === "001")?.id || sirketler[0].id;
  const at = u => `${u}${u.includes("?") ? "&" : "?"}hofCompany=${encodeURIComponent(s1)}`;
  const ctx = {
    server,
    app: server.app,
    admin,
    at,
    s1,
    sirketler,
    saat: ofisSaati,
    meta,
    kapi,
    host,
    acilisMs,
    is,
    wa: server.app.whatsapp,
    kuyruk: () => server.app.context.whatsapp.queue,
    gizli: null,
    async kanca(statuses) {
      if (!ctx.gizli) {
        const abone = await meta.abonelik();
        if (!abone?.override_callback_uri) throw new Error("kanca kaydı yok");
        ctx.gizli = new URL(abone.override_callback_uri).pathname.split("/").pop();
      }
      return ham(kapi.base, "POST", `/wa/kanca/${ctx.gizli}`, { body: durumOlayi(statuses), headers: { host } });
    },
    async kapat() {
      await server.close().catch(error => log("kapanış hatası", error?.message));
      await kapi.close();
      await meta.kapat();
      hamAjan.destroy();
    },
  };
  if (baglan) {
    server.app.store.setSetting("office.name", "Ölçek Ticaret");
    const c = await admin.put(at("/api/workspace/whatsapp/connection"), { phoneNumberId: PNID, wabaId: WABA, token: TOKEN });
    if (c.status !== 200) throw new Error(`bağlantı: ${c.status} ${JSON.stringify(c.data)}`);
    const a = await admin.put(at("/api/workspace/whatsapp/ack"), { ack: true });
    if (a.status !== 200) throw new Error(`onay: ${a.status} ${JSON.stringify(a.data)}`);
  }
  await server.app.context.whatsapp.connection.registerHook(null, `http://${host}`);
  const abone = await meta.abonelik();
  if (!abone?.override_callback_uri) throw new Error("kanca Meta'ya kaydedilmedi");
  ctx.gizli = new URL(abone.override_callback_uri).pathname.split("/").pop();
  return ctx;
}

/**
 * "Meta" durum bildirimi döngüsü: sahte Meta'nın kabul ettiği her ileti için sent → delivered (→ okunanlarda read) bildirimi programın kancasına (kapıcı yolu).
 * toplu: tek POST'ta en çok bu kadar durum (Meta birden çok durumu tek olayda gönderebilir); okunma: okundu oranı. Dönüş: { dur(), istatistik }.
 */
export function durumDongusu(ctx, { toplu = 1, okunma = 0.5, aralikMs = 250 } = {}) {
  const ist = { olay: 0, durum: 0, kodlar: {}, sureler: [] };
  let dur = false;
  const bekleyen = [];
  const calis = (async () => {
    for (;;) {
      const sonTur = dur;
      const yeni = await ctx.meta.yeni();
      const at = ctx.saat.ms();
      for (const m of yeni) {
        bekleyen.push(durum(m.wamid, "sent", at, m.to));
        bekleyen.push(durum(m.wamid, "delivered", at + 1000, m.to));
        if (Math.random() < okunma) bekleyen.push(durum(m.wamid, "read", at + 2000, m.to));
      }
      while (bekleyen.length) {
        const parca = bekleyen.splice(0, toplu);
        const t = performance.now();
        const r = await ctx.kanca(parca);
        ist.sureler.push(performance.now() - t);
        ist.olay += 1;
        ist.durum += parca.length;
        ist.kodlar[r.status] = (ist.kodlar[r.status] || 0) + 1;
        if (r.status !== 200 && ist.kodlar[r.status] <= 3) log("kanca yanıtı", r.status, r.text.slice(0, 200));
      }
      if (sonTur) break;
      await new Promise(res => setTimeout(res, aralikMs));
    }
  })();
  return {
    ist,
    async dur() {
      dur = true;
      await calis;
      return ist;
    },
  };
}
