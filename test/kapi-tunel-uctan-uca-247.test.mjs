// 2.4.7 M3 + M4 UÇTAN UCA: GERÇEK program (createApp; tünel yöneticisi lib/tunnel/attach.mjs + manager.mjs, gerçek kapıcı istemcisi gate-client.mjs, M3 yükleyicisi
// mobile-sync.mjs) + GERÇEK kapıcı (bulut/kapi/kapi.mjs createKapi — tunel.mjs içe aktarması ve fetchHandler'daki TUNEL_YOLU kancası birleşimde eklendi) + sahte R2
// (test/kapi-yerel.mjs) + SAHTE Cloudflare API (tunel.mjs'in kullandığı genel fetch'te yalnız api.cloudflare.com yakalanır) + SAHTE cloudflared
// (test/fixtures/sahte-cloudflared.mjs: programın yazdığı yapılandırmayı okuyup uzak dinleyiciye ters vekil) + sahte Cloudflare KENARI (kapıcının rota kökeni:
// ad → DNS CNAME → tünel kimliği → o tünelin çalıştırma belirteciyle bağlanmış canlı cloudflared; bağlayıcı yoksa 530 — Cloudflare'in 1033'ü).
// Gerçek Cloudflare'e, gerçek kapıcıya, gerçek lisans servisine ve internete istek YOK (ders 30): genel fetch yerel döngü + sahte Cloudflare dışını reddeder ve
// kaydeder; son denetim o listenin boş olduğunu iddia eder. Saat sahte ve SABİT (ders 13, 22): koşunun başlangıcı, elle ilerletilir.
// Tünel turları elle (tick) sürülür: zamanlayıcı yarışı yok (ders 20).
// "Nasıl bozulur": birleşimde kapıcı tünel yolunu tanımaz (kanca yok → karşılama sayfası 200, program "reddetti" sanar); ilk kayıt düşmüşken tünel hiç açılmaz;
// telefon isteği kapıcının işaretiyle programa ulaşmaz ya da işaretsiz istek tünelden geçer; yasak yol tünele sızar; başka ofisin anahtarı tüneli alır;
// lisans 1 saattir doğrulanamazken tünel verilir / canlı istek programa iletilir; cihaz silinince bağlayıcı açık kalır.
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { existsSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { after, before, describe, it } from "node:test";
import { createClock } from "../server/lib/clock.mjs";
import { ecdsaImzala, hmac, mesaj, sha256Hex } from "../server/lib/kapi-protokol.mjs";
import { kapiIstemcisi, ofisKaydi } from "../server/lib/mobile-ozet.mjs";
import { createGateClient } from "../server/lib/tunnel/gate-client.mjs";
import { ADMIN_PASSWORD, loginAdmin, startTestServer } from "./helpers.mjs";
import { lisansAnahtari } from "./kapi-ortak.mjs";
import { kokeneIlet, startKapi } from "./kapi-yerel.mjs";
import { createPhone, rawRequest } from "./mobil-uzak-ortak.mjs";

const FAKE = path.join(path.dirname(fileURLToPath(import.meta.url)), "fixtures", "sahte-cloudflared.mjs");
const MACHINE = "0123456789abcdef0123456789abcdef";
const MIN = 60_000;
const CF_TOKEN = "CF-HESAP-BELIRTECI-UCTAN-UCA-0123456789";
const runToken = tunnelId => `calistirma-belirteci-${tunnelId}`;
const sha = text => createHash("sha256").update(text).digest("hex");
const wait = ms => new Promise(resolve => setTimeout(resolve, ms));
async function until(fn, ms, what) {
  const end = Date.now() + ms;
  let last;
  while (Date.now() < end) {
    last = await fn();
    if (last) return last;
    await wait(40);
  }
  throw new Error(`${what}: ${ms} ms içinde sağlanmadı (son: ${JSON.stringify(last)})`);
}
const isAlive = pid => {
  if (!Number.isInteger(pid) || pid <= 0) return false;
  try {
    process.kill(pid, 0);
    return true;
  } catch (error) {
    return error.code === "EPERM";
  }
};
const lines = file => (existsSync(file) ? readFileSync(file, "utf8").split(/\r?\n/).filter(Boolean).map(line => JSON.parse(line)) : []);
const memoryStore = () => {
  const settings = new Map();
  return { setting: (key, fallback = null) => (settings.has(key) ? settings.get(key) : fallback), setSetting: (key, value) => void settings.set(key, value) };
};

// Sahte Cloudflare API: tünel (cfd_tunnel) + DNS kayıtları + çalıştırma belirteci; hesap belirteci ve hesap/alan kimliği denetlenir.
function fakeCloudflare() {
  const state = { tunnels: [], dns: [], calls: [] };
  const reply = (result, ok = true, status = 200) => new Response(JSON.stringify({ success: ok, errors: ok ? [] : [{ code: 1000, message: "sahte" }], result }), { status, headers: { "content-type": "application/json" } });
  const fetchImpl = async (url, init = {}) => {
    const u = new URL(url);
    const method = init.method || "GET";
    state.calls.push(`${method} ${u.pathname}`);
    if (init.headers?.authorization !== `Bearer ${CF_TOKEN}`) return reply(null, false, 403);
    const body = init.body ? JSON.parse(init.body) : null;
    let m;
    if (u.pathname === "/client/v4/accounts/acc1/cfd_tunnel") {
      if (method === "GET") return reply(state.tunnels.filter(t => t.name === u.searchParams.get("name")));
      if (method === "POST") {
        if (state.tunnels.some(t => t.name === body.name)) return reply(null, false, 409);
        const tunnel = { id: `${String(state.tunnels.length + 1).padStart(8, "0")}-aaaa-4aaa-8aaa-aaaaaaaaaaaa`, name: body.name, config_src: body.config_src };
        state.tunnels.push(tunnel);
        return reply(tunnel);
      }
    }
    if ((m = u.pathname.match(/^\/client\/v4\/accounts\/acc1\/cfd_tunnel\/([^/]+)\/token$/))) return state.tunnels.some(t => t.id === m[1]) ? reply(runToken(m[1])) : reply(null, false, 404);
    if (u.pathname === "/client/v4/zones/zon1/dns_records") {
      if (method === "GET") return reply(state.dns.filter(r => r.name === u.searchParams.get("name") && r.type === u.searchParams.get("type")));
      if (method === "POST") {
        const rec = { id: `dns${state.dns.length + 1}`, ...body };
        state.dns.push(rec);
        return reply(rec);
      }
    }
    if ((m = u.pathname.match(/^\/client\/v4\/zones\/zon1\/dns_records\/([^/]+)$/)) && method === "PATCH") {
      Object.assign(state.dns.find(r => r.id === m[1]), body);
      return reply(state.dns.find(r => r.id === m[1]));
    }
    return reply(null, false, 404);
  };
  return { state, fetchImpl };
}

describe("M3 + M4 uçtan uca — gerçek program, gerçek createKapi (tünel kancası), sahte Cloudflare API + kenar, sahte cloudflared", () => {
  const root = mkdtempSync(path.join(tmpdir(), "m34-uctan-uca-"));
  const cfLog = path.join(root, "cf.log");
  const cf = fakeCloudflare();
  const outside = [];
  const forwarded = []; // kenarın cloudflared'e ilettiği istekler (kapıcıdan geçen)
  const net = { dropRegistration: false };
  const realFetch = globalThis.fetch;
  const clock = createClock({ time: new Date(Math.floor(Date.now() / MIN) * MIN).toISOString(), fixed: true });
  const lisans = lisansAnahtari();
  const world = { online: true };
  const belirtec = () => lisans.belirtec({ at: clock.ms(), machine: MACHINE, licenseId: "LIS-M34-E2E" });
  let kapi;
  let server;
  let admin;
  let sync;
  let tunnel;
  let ofis;
  let host;
  let adminId;
  let phone;

  // Sahte Cloudflare kenarı: Worker rotasından sonra rota kökeni = ad → DNS (proxied CNAME) → tünel → o tünelin belirteciyle açılmış canlı bağlayıcı.
  async function edge(request) {
    const name = new URL(request.url).hostname;
    const record = cf.state.dns.find(r => r.type === "CNAME" && r.name === name && r.proxied === true);
    if (!record) return new Response("error code: 1016", { status: 530, headers: { "content-type": "text/html" } });
    const tunnelId = record.content.replace(/\.cfargotunnel\.com$/, "");
    const connector = lines(cfLog).filter(l => l.port && l.tokenSha256 === sha(runToken(tunnelId)) && isAlive(l.pid)).at(-1);
    if (!connector) return new Response("error code: 1033", { status: 530, headers: { "content-type": "text/html" } });
    forwarded.push({ method: request.method, path: new URL(request.url).pathname, mark: request.headers.get("x-do-kapi") || "", tunnelId, pid: connector.pid });
    return kokeneIlet(request, `http://127.0.0.1:${connector.port}`);
  }

  const gunlukYollari = () => kapi.gunluk.filter(g => g.adres.includes("/v1/ofis/")).map(g => `${g.yontem} ${g.adres.slice(g.adres.indexOf("/v1/")).replace(/\/v1\/ofis\/[^/]+/, "")} ${g.durum}`);
  const tunnelStatus = async () => (await admin.get("/api/admin/mobile/tunnel")).data?.data;
  const signedTunnelRequest = async ({ pathOffice, bodyOffice, key }) => {
    const yol = `/v1/ofis/${pathOffice}/tunel`;
    const govde = JSON.stringify({ v: 1, ofis: bodyOffice });
    const ms = clock.ms();
    const imza = await ecdsaImzala(key, mesaj.ofis("POST", yol, ms, await sha256Hex(govde)));
    const response = await realFetch(`${kapi.base}${yol}`, { method: "POST", headers: { "content-type": "application/json", "x-do-zaman": String(ms), "x-do-imza": imza }, body: govde });
    return { status: response.status, data: await response.json().catch(() => null) };
  };

  before(async () => {
    globalThis.fetch = async (input, init) => {
      const url = new URL(typeof input === "string" || input instanceof URL ? String(input) : input.url);
      if (url.hostname === "api.cloudflare.com") return cf.fetchImpl(url.href, init);
      if (url.hostname === "127.0.0.1" || url.hostname === "localhost") {
        if (net.dropRegistration && /^\/v1\/ofis\/[^/]+\/kayit$/.test(url.pathname)) throw new TypeError("fetch failed (sahte ağ kesintisi)");
        return realFetch(input, init);
      }
      outside.push(url.href);
      throw new TypeError(`dış ağa istek yasak (test): ${url.href}`);
    };
    kapi = await startKapi({
      now: () => clock.ms(),
      trustedKeys: lisans.trusted,
      lisansFetch: async () => {
        if (!world.online) throw new TypeError("fetch failed");
        return { json: async () => ({ ok: true, token: belirtec() }) };
      },
      fetchOrigin: edge,
    });
    Object.assign(kapi.env, { CF_API_TOKEN: CF_TOKEN, CF_ACCOUNT_ID: "acc1", CF_ZONE_ID: "zon1" });
    server = await startTestServer({
      now: clock,
      remoteNow: clock,
      mobileKapiUrl: kapi.base,
      env: { HUKUK_LICENSE_URL: "http://127.0.0.1:9" },
      license: {
        enforce: true,
        trustedKeys: lisans.trusted,
        services: ["https://lisans.m34.test/api/lisans"],
        fetchImpl: async () => ({ status: 200, json: async () => ({ ok: true, token: belirtec() }) }),
        machineId: MACHINE,
        now: () => clock.ms(),
        firstCheckDelayMs: 3_600_000,
        autoTrial: false,
      },
      tunnel: {
        runner: { command: process.execPath, argsPrefix: [FAKE, "--sahte-log", cfLog, "--sahte-mod", "bagli"], identity: FAKE },
        tickMs: 3_600_000,
        firstTickMs: 3_600_000,
        stopGraceMs: 0,
        root: path.join(root, "bilesen"),
      },
    });
    await server.app.license.activateKey("DO-ABCDE-FGHJK-MNPQR-STVWX");
    sync = server.app.mobileSync;
    tunnel = server.app.context?.tunnel;
    if (!sync || !tunnel) throw new Error(`programda ${!sync ? "M3 yükleyicisi (app.mobileSync)" : "M4 tünel yöneticisi (context.tunnel)"} yok`);
    // Programın ofis kaydı (ortak katman ayarı; sır dahil — yalnız "kapıyı atlatan istek" denetiminde işaret kopyası için).
    // Önce programın kendi hazırlığı biter (sync.ofis bekler); sonra ayar okunur (ofisKaydi yoksa üretir — hazırlıkla aynı anda çağrılırsa iki kimlik olurdu).
    const programOfisi = await sync.ofis();
    ofis = await ofisKaydi(server.app.store);
    assert.equal(ofis.id, programOfisi.id, "ofis kaydı programınkiyle aynı");
    host = kapi.ofisHost(ofis.id);
    admin = await loginAdmin(server);
    adminId = (await admin.get("/api/admin/users")).data.data.find(u => u.username === "admin").id;
  });

  after(async () => {
    await server?.close().catch(() => {});
    await kapi?.close().catch(() => {});
    globalThis.fetch = realFetch;
    rmSync(root, { recursive: true, force: true });
  });

  it("ilk kayıt ağ kesintisinde düşmüş ofis: tünel başvurusu gerçek kapıcıda kapi-ofis-yok → program M3 kaydını yapar, yeniden başvurur → tünel + DNS; eşli cihaz yokken süreç başlamaz", async () => {
    net.dropRegistration = true;
    assert.equal((await admin.put(`/api/admin/mobile/access/${adminId}`, { remote: true })).status, 200);
    await sync.idle();
    net.dropRegistration = false;
    assert.equal(kapi.meta(ofis.id), null, "ön koşul: güvenlik yüklemesi (kayıt) ağ kesintisinde düşmüş olmalı — kapıcı ofisi tanımıyor");
    await tunnel.tick();
    const st = await tunnelStatus();
    const seq = gunlukYollari();
    assert.deepEqual(seq, ["POST /tunel 404", "POST /kayit 200", "POST /tunel 200"], `kapıcı günlüğü (tünel durumu: ${st?.state} — ${st?.reason})`);
    assert.ok(kapi.meta(ofis.id), "kapıcı ofisi artık tanır (M3 kaydı)");
    assert.deepEqual(cf.state.tunnels.map(t => [t.name, t.config_src]), [[`destekofis-${ofis.id}`, "local"]], "ofis başına tek tünel, yerel yönetimli");
    const tunnelId = cf.state.tunnels[0].id;
    assert.deepEqual(cf.state.dns.map(r => [r.type, r.name, r.content, r.proxied]), [["CNAME", host, `${tunnelId}.cfargotunnel.com`, true]], "ofis adı proxied CNAME → tünel");
    assert.equal(st.state, "off", "eşli cihaz ve karekod yokken süreç başlamaz");
    assert.equal(st.publicUrl, `https://${host}`, "ofis adresi kapıcının verdiği ad");
    assert.equal(lines(cfLog).length, 0, "cloudflared hiç başlatılmadı");
    const info = String(server.app.store.setting("mobile.tunnel.info", ""));
    assert.ok(!info.includes(runToken(tunnelId)) && !info.includes(CF_TOKEN), "çalıştırma/hesap belirteci ayara yazılmaz");
  });

  it("karekod → tünel açılır (aynı tünel yeniden kullanılır); cloudflared yalnız uzak dinleyiciye ve kapıcının verdiği belirteçle; telefon kapıdan /mobil/ 200, eşleşir, giriş yapar", async () => {
    const code = await admin.post("/api/admin/mobile/codes", { userId: adminId });
    assert.equal(code.status, 200, JSON.stringify(code.data));
    assert.ok(code.data.data.url.startsWith(`https://${host}/mobil/#eslesme=`), `karekod tünel adresini taşımalı: ${code.data.data.url}`);
    await sync.idle();
    await tunnel.tick();
    await until(async () => (await tunnelStatus())?.state === "connected", 15_000, "tünel Bağlı");
    const tunnelId = cf.state.tunnels[0].id;
    assert.equal(cf.state.calls.filter(c => c === "POST /client/v4/accounts/acc1/cfd_tunnel").length, 1, "tünel yalnız bir kez oluşturuldu");
    assert.equal(cf.state.calls.filter(c => c === "POST /client/v4/zones/zon1/dns_records").length, 1, "DNS yalnız bir kez eklendi");
    const [started] = lines(cfLog);
    assert.equal(started.tokenSha256, sha(runToken(tunnelId)), "cloudflared kapıcının döndürdüğü çalıştırma belirteciyle (ortam değişkeni) başladı");
    assert.ok(!started.args.join(" ").includes(runToken(tunnelId)), "belirteç komut satırında yok");
    assert.equal(started.service, `http://127.0.0.1:${tunnel.remotePort()}`, "tek kural: uzak dinleyici");
    assert.notEqual(tunnel.remotePort(), new URL(server.base).port * 1, "ana port tünele açılmaz");
    assert.equal(started.hostHeader, host);
    assert.equal(started.rules, 2, "kural + 404");

    phone = createPhone(kapi.base, { host });
    const page = await phone.get("/mobil/");
    assert.equal(page.status, 200, `kapıcı → kenar → cloudflared → uzak dinleyici: /mobil/ (gelen ${page.status} ${page.code} ${page.text.slice(0, 120)})`);
    assert.match(forwarded.at(-1).mark, /^\d+\.-\.[A-Za-z0-9_-]+$/, "programa giden istekte kapıcının işareti (cihazsız sayfa isteği)");
    assert.equal(forwarded.at(-1).tunnelId, tunnelId);
    const pair = await phone.pair(code.data.data.code);
    assert.equal(pair.status, 200, `eşleme tünelden: ${pair.text}`);
    await sync.idle();
    assert.deepEqual(kapi.meta(ofis.id).cihazlar.map(c => c.id), [phone.deviceId], "eşleme kapıcıya hemen bildirildi");
    const login = await phone.login("admin", ADMIN_PASSWORD);
    assert.equal(login.status, 200, `uzak giriş tünelden: ${login.text}`);
    const session = await phone.get("/api/mobil/session");
    assert.equal(session.status, 200, session.text.slice(0, 200));
    assert.ok(forwarded.at(-1).mark.includes(`.${phone.deviceId}.`), "işaret cihaz kimliğini taşır");
  });

  it("yasak yol: kapıcıda 404 kapi-yol (programa iletilmez); kapıyı atlatıp cloudflared'e işaretsiz istek 401 remote-kapi; geçerli işaretle yasak yol programda 404 remote-path", async () => {
    const before = forwarded.length;
    const viaGate = await phone.get("/api/admin/users");
    assert.deepEqual([viaGate.status, viaGate.code], [404, "kapi-yol"], viaGate.text.slice(0, 200));
    assert.equal(forwarded.length, before, "yasak yol kenara/programa hiç ulaşmadı");
    const connector = lines(cfLog).at(-1);
    const direct = `http://127.0.0.1:${connector.port}`;
    const cookie = [...phone.jar].map(([k, v]) => `${k}=${v}`).join("; ");
    const unmarked = await rawRequest(direct, "GET", "/api/mobil/session", { headers: { cookie, host } });
    assert.deepEqual([unmarked.status, unmarked.code], [401, "remote-kapi"], "kapıcının işareti olmadan tünelden giren istek reddedilir");
    const mark = async (method, yolSorgu) => {
      const ms = clock.ms();
      return `${ms}.${phone.deviceId}.${await hmac(ofis.sir, mesaj.vekil(method, yolSorgu, phone.deviceId, ms))}`;
    };
    const control = await rawRequest(direct, "GET", "/api/mobil/session", { headers: { cookie, host, "x-do-kapi": await mark("GET", "/api/mobil/session") } });
    assert.equal(control.status, 200, `denetim: kapıcı işaretinin bu kopyası geçerli (gelen ${control.status} ${control.code})`);
    const forbidden = await rawRequest(direct, "GET", "/api/admin/users", { headers: { cookie, host, "x-do-kapi": await mark("GET", "/api/admin/users") } });
    assert.deepEqual([forbidden.status, forbidden.code], [404, "remote-path"], "program kendi yol beyaz listesini de uygular (derinlemesine savunma)");
  });

  it("başka ofisin anahtarı A'nın tünelini alamaz (401 kapi-imza / 400 kapi-istek); B kendi kaydıyla AYRI tünel ve ad alır; A'nın DNS'i değişmez", async () => {
    const storeB = memoryStore();
    const b = await ofisKaydi(storeB);
    const reg = await kapiIstemcisi({ url: kapi.base, fetchImpl: (...a) => globalThis.fetch(...a), simdi: () => clock.ms() }).kayit(b, { lisans: lisans.belirtec({ at: clock.ms(), machine: "cd".repeat(16), licenseId: "LIS-M34-B" }), cihazlar: [] });
    assert.equal(reg.ok, true, `B'nin M3 kaydı: ${JSON.stringify(reg)}`);
    const callsBefore = cf.state.calls.length;
    const r1 = await signedTunnelRequest({ pathOffice: ofis.id, bodyOffice: ofis.id, key: b.imzaAnahtari });
    assert.deepEqual([r1.status, r1.data?.code], [401, "kapi-imza"], "A'nın yolu B'nin anahtarıyla");
    const r2 = await signedTunnelRequest({ pathOffice: b.id, bodyOffice: ofis.id, key: b.imzaAnahtari });
    assert.deepEqual([r2.status, r2.data?.code], [400, "kapi-istek"], "B'nin yolu, gövdede A");
    assert.equal(cf.state.calls.length, callsBefore, "reddedilen başvuru Cloudflare'e gitmez");
    const tb = await createGateClient({ gateUrl: kapi.base, fetchImpl: (...a) => globalThis.fetch(...a), store: storeB, now: () => clock.ms() }).provision();
    const ta = cf.state.tunnels.find(t => t.name === `destekofis-${ofis.id}`);
    assert.notEqual(tb.tunnelId, ta.id);
    assert.equal(tb.hostname, kapi.ofisHost(b.id));
    assert.equal(cf.state.dns.find(r => r.name === host).content, `${ta.id}.cfargotunnel.com`, "A'nın adı hâlâ A'nın tünelinde");
    assert.ok(!JSON.stringify(tb).includes(CF_TOKEN), "yanıtta hesap belirteci yok");
  });

  it("lisans P9: 1 saattir doğrulanamıyor (servis kapalı) → kapıcı tüneli 503 ile reddeder ve canlı isteği programa İLETMEZ; servis dönünce yeniden açılır", async () => {
    world.online = false;
    clock.advance(61 * MIN);
    const gate = createGateClient({ gateUrl: kapi.base, fetchImpl: (...a) => globalThis.fetch(...a), store: server.app.store, now: () => clock.ms() });
    await assert.rejects(gate.provision(), error => {
      assert.deepEqual([error.status, error.gateCode], [503, "kapi-lisans-dogrulanamadi"], error.message);
      return true;
    });
    const before = forwarded.length;
    const live = await phone.get("/mobil/");
    assert.deepEqual([live.status, live.code], [503, "kapi-lisans-dogrulanamadi"], live.text.slice(0, 200));
    assert.equal(forwarded.length, before, "lisans doğrulanamazken istek programa iletilmedi");
    world.online = true;
    clock.advance(61_000); // kapıcının başarısız yenileme aralığı (60 sn) geçsin
    const back = await phone.get("/mobil/");
    assert.equal(back.status, 200, `servis dönünce canlı bağlantı (gelen ${back.status} ${back.code})`);
    const again = await gate.provision();
    assert.equal(again.tunnelId, cf.state.tunnels.find(t => t.name === `destekofis-${ofis.id}`).id, "aynı tünel");
  });

  it("cihaz silinince (eşli cihaz kalmadı) tünel kapanır: cloudflared durur, kapıcı silinen cihazı reddeder, cihazsız istek kenarda bağlayıcı bulamaz (503 kapi-ofis-kapali)", async () => {
    const pid = tunnel.pid();
    assert.ok(isAlive(pid), "ön koşul: bağlayıcı çalışıyor");
    assert.equal((await admin.del(`/api/admin/mobile/devices/${phone.deviceId}`)).status, 200);
    await sync.idle();
    assert.deepEqual(kapi.meta(ofis.id).cihazlar, [], "silme kapıcıya hemen bildirildi");
    await tunnel.tick();
    const st = await tunnelStatus();
    assert.equal(st.state, "off", `tünel kapanmalı (durum ${st.state} — ${st.reason})`);
    assert.equal(tunnel.pid(), null);
    await until(() => !isAlive(pid), 10_000, "cloudflared süreci sonlandı");
    // Bağımsız gözden geçirme B1 (BAŞ MİMAR KARARI): silinen cihazın çerezi veri uçlarında 401 kapi-cihaz + çerez silinir; sayfa yolunda "cihazsız" sayılır
    // (yeni karekodla yeniden eşlenebilsin) — burada tünelde bağlayıcı olmadığından 503, çerez yine silinir. (Önceki beklenti sayfa yolunda da 401'di = B1.)
    const silindi = response => [].concat(response.headers["set-cookie"] || []).some(line => /^__Host-hof_device=;.*Max-Age=0/i.test(line));
    const staleApi = await createPhone(kapi.base, { host }).get("/api/mobil/session", { headers: { cookie: [...phone.jar].map(([k, v]) => `${k}=${v}`).join("; ") } });
    assert.deepEqual([staleApi.status, staleApi.code], [401, "kapi-cihaz"], "silinen cihaz veri ucunda kapıcıda reddedilir");
    assert.ok(silindi(staleApi), `silinen cihazın çerezi yanıtta silinir: ${staleApi.headers["set-cookie"]}`);
    const stale = await phone.get("/mobil/");
    assert.deepEqual([stale.status, stale.code], [503, "kapi-ofis-kapali"], "silinen cihaz sayfa yolunda cihazsız sayılır (B1); bağlayıcı yok: ofis kapalı");
    assert.ok(silindi(stale), `sayfa yolunda da çerez silinir: ${stale.headers["set-cookie"]}`);
    const fresh = await createPhone(kapi.base, { host }).get("/mobil/");
    assert.deepEqual([fresh.status, fresh.code], [503, "kapi-ofis-kapali"], "tünelde bağlayıcı yok: ofis kapalı");
  });

  it("koşu boyunca yerel döngü ve sahte Cloudflare dışına hiçbir istek gitmedi (ders 30)", () => {
    assert.deepEqual(outside, []);
  });
});
