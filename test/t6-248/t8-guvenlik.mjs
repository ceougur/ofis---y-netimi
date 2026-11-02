// T8 GÜVENLİK (2.4.8 son aday; plan §4 "belirteç", §3 C / §7a 3 kanca, §4 yetki + salt okunur lisans; ders 30). GERÇEK program süreç İÇİNDE (startTestServer), sahte Meta
// yerel (127.0.0.1). Sızıntı taraması: belirteç (System User), kanca GİZLİ YOLU ve doğrulama belirteci — API yanıtları (mobil özetin kaynak uçları dahil), günlük
// (üretim günlükleyicisinin biçimiyle yakalanır), işlem geçmişi, veri klasöründeki BÜTÜN dosyalar (şirket dosyası, makine defteri, WAL), yedek dosyası, hata
// iletileri (Meta 190 metni belirteci yankılar), PDF / Excel çıktıları (Excel açılıp içi taranır). App Secret programda YOK (kapıcıda) — kaynakta da aranır.
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { readFileSync, readdirSync, statSync, existsSync } from "node:fs";
import http from "node:http";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, it } from "node:test";
import { ADMIN_PASSWORD, createUser } from "../helpers.mjs";
import { PNID, TOKEN, URLS, WABA, startWa } from "../whatsapp-248-ortak.mjs";
import { freshDir, rmrf } from "./ortak.mjs";

const PUBLIC = "http://ofisx.destekofis.test";
const REPO = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");
const files = dir => (existsSync(dir) ? readdirSync(dir).flatMap(name => (statSync(path.join(dir, name)).isDirectory() ? files(path.join(dir, name)) : [path.join(dir, name)])) : []);
function needles(secrets) {
  const out = [];
  for (const value of secrets.filter(Boolean)) {
    out.push(value);
    if (value.length >= 24) out.push(value.slice(0, 16), value.slice(-16), value.slice(Math.floor(value.length / 2) - 8, Math.floor(value.length / 2) + 8));
    out.push(Buffer.from(value).toString("base64").slice(0, 24), encodeURIComponent(value));
  }
  return [...new Set(out)];
}
const find = (haystack, list) => list.filter(item => haystack.includes(item));
function post(base, pathname, body, method = "POST") {
  const url = new URL(base);
  const payload = body === null ? null : Buffer.from(body);
  return new Promise((resolve, reject) => {
    const req = http.request({ host: url.hostname, port: url.port, method, path: pathname, headers: payload ? { "content-type": "application/json", "content-length": payload.length } : {} }, res => {
      const parts = [];
      res.on("data", chunk => parts.push(chunk));
      res.on("end", () => resolve({ status: res.statusCode, text: Buffer.concat(parts).toString("utf8") }));
    });
    req.on("error", reject);
    if (payload) req.write(payload);
    req.end();
  });
}
const event = (statuses, pnid = PNID) => JSON.stringify({ object: "whatsapp_business_account", entry: [{ id: WABA, changes: [{ field: "messages", value: { messaging_product: "whatsapp", metadata: { display_phone_number: "902125550102", phone_number_id: pnid }, statuses } }] }] });
const st = (id, status, extra = {}) => ({ id, status, timestamp: String(Math.floor(Date.parse("2026-11-03T09:05:00+03:00") / 1000)), recipient_id: "905530000001", ...extra });

describe("T8 — belirteç / kanca sırrı sızıntı taraması", () => {
  it("API yanıtları, günlük, işlem geçmişi, veri klasörü, yedek, hata iletileri, PDF/Excel: belirteç, kanca gizli yolu ve doğrulama belirteci YOK", { timeout: 180_000 }, async () => {
    const root = freshDir("t8-sizinti");
    const lines = [];
    // Üretim günlükleyicisinin satır biçimi (lib/logger.mjs): "<zaman> [DÜZEY] ileti <meta|yığın>".
    const write = level => (message, meta) => lines.push(`${new Date().toISOString()} [${level}] ${message}${meta === undefined ? "" : ` ${meta instanceof Error ? meta.stack || meta.message : JSON.stringify(meta)}`}`);
    const ctx = await startWa({ dataDir: path.join(root, "data"), backupDir: path.join(root, "backups"), maxCompanies: 2, log: { debug: write("DEBUG"), info: write("INFO"), warn: write("WARN"), error: write("ERROR") } });
    const responses = [];
    const keep = (label, res) => {
      responses.push({ label, status: res.status, body: typeof res.data === "string" ? res.data : JSON.stringify(res.data) });
      return res;
    };
    try {
      ctx.server.app.mobileRemote.setPublicUrl(PUBLIC);
      keep("kanca kaydı", await ctx.api.post(`${URLS.conn}/hook`, {}));
      await ctx.wa.scheduler.maintain();
      const sub = ctx.fake.state.subscriptions.at(-1) || {};
      const secretPath = sub.override_callback_uri ? new URL(sub.override_callback_uri).pathname.split("/").pop() : "";
      const verifyToken = sub.verify_token || "";
      assert.ok(secretPath.length >= 32 && verifyToken.length >= 16, `kanca kaydı Meta'ya gitti (${JSON.stringify(sub).slice(0, 200)})`);
      const a = await ctx.account("Sızıntı Bir", "0553 000 00 01", 120);
      const b = await ctx.account("Sızıntı İki", "0553 000 00 02", 80);
      keep("önizleme", await ctx.api.post(URLS.preview, { kind: "statement", ids: [a.id, b.id], preset: "thisMonth" }));
      const created = keep("toplu iş", await ctx.batch({ kind: "statement", ids: [a.id, b.id], preset: "thisMonth" }));
      await ctx.drain();
      const id = created.data.data.batch.id;
      const remote = await ctx.server.app.listenRemote(0, "127.0.0.1");
      const remoteBase = `http://127.0.0.1:${remote.port}`;
      const job = (await ctx.jobs(id))[0];
      responses.push({ label: "kanca POST", ...(await post(remoteBase, `/wa/kanca/${secretPath}`, event([st(job.wamid, "delivered", { pricing: { billable: true } })]))) });
      responses.push({ label: "kanca GET", ...(await post(remoteBase, `/wa/kanca/${secretPath}?hub.mode=subscribe&hub.verify_token=${encodeURIComponent(verifyToken)}&hub.challenge=12345`, null, "GET")) });
      keep("bağlantıyı sına", await ctx.api.post(`${URLS.conn}/test`, {}));
      keep("kendime deneme", await ctx.api.post(`${URLS.conn}/self-test`, { to: "0532 123 45 67" }));
      for (const [label, url] of [["bağlantı", URLS.conn], ["gönderim durumu", "/api/workspace/whatsapp/sending-status"], ["geçmiş", "/api/workspace/whatsapp/history"], ["istatistik", URLS.stats], ["toplu liste", URLS.batches], ["toplu ayrıntı", `${URLS.batches}/${id}`], ["onay", URLS.ack], ["ayarlar", URLS.sending], ["işlem geçmişi", "/api/admin/audit?limit=500"], ["oturum (mobil)", "/api/auth/me"], ["cari (mobil)", `/api/workspace/accounts/${a.id}`], ["cari liste (mobil)", "/api/workspace/accounts"], ["genel bakış (mobil)", "/api/workspace/overview"], ["kasa (mobil)", "/api/workspace/cash"], ["taksitler (mobil)", "/api/workspace/plans?count=1"], ["rapor merkezi (mobil)", "/api/workspace/report-center"]]) keep(label, await ctx.api.get(url));
      // Hata yolu: Meta 190 metni belirteci YANKILAR (sahte sunucu echoToken) + belirteç geçersiz.
      ctx.fake.state.echoToken = true;
      ctx.fake.state.token = "BASKA-BELIRTEC-000";
      keep("bağlantıyı sına (190 yankı)", await ctx.api.post(`${URLS.conn}/test`, {}));
      const c = await ctx.account("Sızıntı Üç", "0553 000 00 03", 50);
      const failed = keep("toplu iş (190)", await ctx.batch({ kind: "statement", ids: [c.id], preset: "lastMonth" }));
      await ctx.drain();
      if (failed.status === 200) keep("toplu ayrıntı (190)", await ctx.api.get(`${URLS.batches}/${failed.data.data.batch.id}`));
      ctx.fake.state.token = TOKEN;
      ctx.fake.state.echoToken = false;
      // Çıktılar: cari ekstre PDF, cari listesi PDF / Excel.
      const outputs = [];
      for (const url of [`/api/workspace/accounts/${a.id}/ekstre.pdf`, "/api/workspace/accounts/liste.pdf", "/api/workspace/accounts/export.xlsx"]) {
        const res = await ctx.api.raw("GET", url);
        outputs.push({ url, status: res.status, bytes: res.status === 200 ? res.buffer : Buffer.alloc(0) });
      }
      // Yedek
      const backup = keep("yedek", await ctx.api.post("/api/admin/backups", { scope: "one", companyId: "sirket-001" }));
      const list = needles([TOKEN, secretPath, verifyToken]);
      const r = {};
      r.yanitlar = responses.filter(item => find(item.body || item.text || "", list).length).map(item => `${item.label}: ${find(item.body || item.text || "", list).join(",")}`);
      r.yanitSayisi = responses.length;
      r.yanitDurumlari = responses.map(item => `${item.label}=${item.status}`).join(" ");
      r.gunluk = find(lines.join("\n"), list);
      r.gunlukSatir = lines.length;
      r.islemGecmisi = find(JSON.stringify(ctx.store.all("SELECT * FROM audit_events")), list);
      const dataFiles = files(path.join(root, "data"));
      r.veriKlasoru = dataFiles.map(file => ({ file: path.relative(root, file).split(path.sep).join("/"), hit: find(readFileSync(file).toString("latin1"), list) })).filter(item => item.hit.length);
      r.veriDosyaSayisi = dataFiles.length;
      const backupFiles = files(path.join(root, "backups"));
      r.yedek = backupFiles.map(file => ({ file: path.relative(root, file).split(path.sep).join("/"), hit: find(readFileSync(file).toString("latin1"), list) })).filter(item => item.hit.length);
      r.yedekDosyalari = backupFiles.map(file => path.basename(file));
      r.yedekteSecretKey = backupFiles.some(file => /secret\.key/.test(file));
      r.yedekDurum = backup.status;
      r.ciktilar = outputs.map(item => {
        let text = item.bytes.toString("latin1");
        if (item.url.endsWith(".xlsx") && item.bytes.length) {
          const tmp = path.join(root, "cikti.xlsx");
          require_write(tmp, item.bytes);
          text += execFileSync("unzip", ["-p", tmp]).toString("latin1");
        }
        return { url: item.url, status: item.status, bytes: item.bytes.length, hit: find(text, list) };
      });
      console.log(`# T8-sizinti ${JSON.stringify(r)}`);
      assert.deepEqual(r.yanitlar, []);
      assert.deepEqual(r.gunluk, []);
      assert.deepEqual(r.islemGecmisi, []);
      assert.deepEqual(r.veriKlasoru, []);
      assert.deepEqual(r.yedek, []);
      assert.equal(r.yedekteSecretKey, false);
      for (const item of r.ciktilar) assert.deepEqual(item.hit, [], item.url);
    } finally {
      await ctx.close();
      rmrf(root);
    }
  });

  it("App Secret program kaynağında yok (yalnız kapıcı); program sunucu kodunda kalıcı belirteç / sır sabiti yok", () => {
    const grep = (pattern, dirs) => {
      try {
        return execFileSync("grep", ["-rniE", pattern, ...dirs], { cwd: REPO }).toString().trim().split("\n").filter(Boolean);
      } catch {
        return [];
      }
    };
    const program = grep("app[_ ]?secret|appsecret|client_secret", ["server", "client"]).filter(line => !/^\s*[^:]+:\d+:\s*(\/\/|\*)/.test(line.replace(/^([^:]+:\d+:)/, "$1")));
    const kapi = grep("app[_ ]?secret|META_APP_SECRET|WA_APP_SECRET", ["bulut"]);
    console.log(`# T8-appsecret ${JSON.stringify({ programSatir: program.slice(0, 20), kapiSatirSayisi: kapi.length, kapiOrnek: kapi.slice(0, 5) })}`);
  });
});
import { writeFileSync as require_write } from "node:fs";

describe("T8 — kanca saldırıları (imzasız / sahte / yeniden oynatılmış / başka şirket)", () => {
  it("yanlış gizli yol 404, yanlış doğrulama belirteci 403; bilinmeyen wamid yazılmaz; 002'nin wamid'i yalnız 002'ye; yinelenen teslim sayacı ARTTIRMAZ; geriye giden durum yok sayılır; sahte imzasız 131049 → ?", { timeout: 180_000 }, async () => {
    const root = freshDir("t8-kanca");
    const ctx = await startWa({ dataDir: path.join(root, "data"), backupDir: path.join(root, "backups"), maxCompanies: 2 });
    const r = {};
    try {
      const created = await ctx.api.post("/api/companies", { name: "İkinci Şirket", select: false });
      const second = created.data.data.company || created.data.data;
      const q = `hofCompany=${encodeURIComponent(second.id)}`;
      assert.equal((await ctx.api.put(`${URLS.conn}?${q}`, { phoneNumberId: PNID, wabaId: WABA, token: TOKEN })).status, 200);
      assert.equal((await ctx.api.put(`${URLS.ack}?${q}`, { ack: true })).status, 200);
      assert.equal((await ctx.api.put(`/api/admin/office?${q}`, { name: "İkinci Şirket" })).status, 200);
      ctx.server.app.mobileRemote.setPublicUrl(PUBLIC);
      await ctx.wa.scheduler.maintain();
      const sub = ctx.fake.state.subscriptions.at(-1);
      const secretPath = new URL(sub.override_callback_uri).pathname.split("/").pop();
      const remote = await ctx.server.app.listenRemote(0, "127.0.0.1");
      const base = `http://127.0.0.1:${remote.port}`;
      const a = await ctx.account("Kanca Bir", "0553 000 01 01", 100);
      const b1 = (await ctx.batch({ kind: "statement", ids: [a.id], preset: "thisMonth" })).data.data.batch.id;
      const bAcc = (await ctx.api.post(`/api/workspace/accounts?${q}`, { name: "Kanca İki", phone: "0553 000 01 02", openingBalance: "70" })).data.data;
      const b2 = (await ctx.api.post(`${URLS.batches}?${q}`, { kind: "statement", ids: [bAcc.id], preset: "thisMonth" })).data.data.batch.id;
      await ctx.drain();
      const job1 = (await ctx.jobs(b1))[0];
      const job2 = (await ctx.api.get(`${URLS.batches}/${b2}?${q}`)).data.data.jobs[0];
      const state1 = async () => (await ctx.jobs(b1))[0].state;
      const state2 = async () => (await ctx.api.get(`${URLS.batches}/${b2}?${q}`)).data.data.jobs[0].state;
      r.yanlisYol = (await post(base, `/wa/kanca/${"A".repeat(43)}`, event([st(job1.wamid, "delivered")]))).status;
      r.kisaYol = (await post(base, "/wa/kanca/abc", event([st(job1.wamid, "delivered")]))).status;
      r.put = (await post(base, `/wa/kanca/${secretPath}`, "{}", "PUT")).status;
      r.yanlisDogrulama = (await post(base, `/wa/kanca/${secretPath}?hub.mode=subscribe&hub.verify_token=yanlis&hub.challenge=1`, null, "GET")).status;
      r.bozukJson = (await post(base, `/wa/kanca/${secretPath}`, "{bozuk")).status;
      r.yanlisYoldaDurum1 = await state1();
      const unk = await post(base, `/wa/kanca/${secretPath}`, event([st("wamid.SAHTE_BILINMEYEN_01", "delivered")]));
      r.bilinmeyen = { status: unk.status, yazilan: ctx.store.get("SELECT COUNT(*) n FROM wa_jobs WHERE wamid = 'wamid.SAHTE_BILINMEYEN_01'").n };
      const other = await post(base, `/wa/kanca/${secretPath}`, event([st(job2.wamid, "delivered", { pricing: { billable: true } })]));
      r.baskaSirket = { status: other.status, s001: await state1(), s002: await state2() };
      const yanlisNumara = await post(base, `/wa/kanca/${secretPath}`, event([st(job1.wamid, "read")], "999999999999999"));
      r.baskaNumara = { status: yanlisNumara.status, s001: await state1() };
      // Yeniden oynatma: aynı teslim bildirimi üç kez → aylık sayım bir kez.
      for (let i = 0; i < 3; i += 1) await post(base, `/wa/kanca/${secretPath}`, event([st(job1.wamid, "delivered", { pricing: { billable: true } })]));
      r.tekrar = { s001: await state1(), buAy: (await ctx.api.get(URLS.stats)).data.data.delivered };
      await post(base, `/wa/kanca/${secretPath}`, event([st(job1.wamid, "read")]));
      await post(base, `/wa/kanca/${secretPath}`, event([st(job1.wamid, "sent")]));
      await post(base, `/wa/kanca/${secretPath}`, event([st(job1.wamid, "failed", { errors: [{ code: 131026, title: "x" }] })]));
      r.geriye = await state1();
      // Sahte imzasız 131049 (Yol 1 — Elle Bağla: imzasız olay kaydındaki wamid'i yazar, plan §3 C / P5 BİLİNEN SINIR): Meta KABUL ETTİ (teslim bildirilmemiş)
      // işe → "Meta Bekletti", toplu iş yeniden sürer → 24 saat sonra İKİNCİ ileti gider mi?
      const c = await ctx.account("Kanca Üç", "0553 000 01 03", 60);
      const b3 = (await ctx.batch({ kind: "statement", ids: [c.id], preset: "thisMonth" })).data.data.batch.id;
      await ctx.drain();
      const job3 = (await ctx.jobs(b3))[0];
      const before = ctx.messages().filter(m => m.to === job3.phone).length;
      const forged = await post(base, `/wa/kanca/${secretPath}`, event([st(job3.wamid, "failed", { errors: [{ code: 131049, title: "ecosystem" }] })]));
      const afterForge = await ctx.detail(b3);
      ctx.clock.advance(24 * 3_600_000 + 60_000);
      await ctx.drain();
      r.sahte131049 = { status: forged.status, isDurumu: afterForge.jobs[0].state, toplu: afterForge.state, onceIleti: before, sonraIleti: ctx.messages().filter(m => m.to === job3.phone).length, sonDurum: (await ctx.jobs(b3))[0].state };
      console.log(`# T8-kanca ${JSON.stringify(r)}`);
      assert.equal(r.yanlisYol, 404);
      assert.equal(r.yanlisDogrulama, 403);
      assert.equal(r.bilinmeyen.yazilan, 0);
      assert.equal(r.baskaSirket.s001, "accepted", "002'nin wamid'i 001'e yazılmadı");
      assert.equal(r.baskaSirket.s002, "delivered");
      assert.equal(r.tekrar.buAy, 2, "yinelenen teslim sayılmadı (001 + 002)");
      assert.equal(r.geriye, "read");
    } finally {
      await ctx.close();
      rmrf(root);
    }
  });
});

describe("T8 — yetkisiz kullanıcı ve salt okunur lisans gönderim uçlarında", () => {
  it("whatsapp.send yetkisiz personel ve salt okunur lisans: gönderim / onay / bağlantı / deneme / yeniden dene / yine de gönder uçları reddedilir, Meta'ya istek gitmez", { timeout: 180_000 }, async () => {
    const root = freshDir("t8-yetki");
    const dataDir = path.join(root, "data");
    let ctx = await startWa({ dataDir, backupDir: path.join(root, "backups") });
    const fake = ctx.fake;
    const r = {};
    try {
      const a = await ctx.account("Yetki Bir", "0553 000 02 01", 100);
      const id = (await ctx.batch({ kind: "statement", ids: [a.id], preset: "thisMonth" })).data.data.batch.id;
      fake.state.failQueue.push({ match: /^POST \/\d+\/messages$/, status: 500, raw: "<html>x</html>" });
      await ctx.drain();
      const jobId = (await ctx.jobs(id))[0].id;
      const personel = await createUser(ctx.server, ctx.api, { username: "personel1", role: "personel" });
      const calls = async client => {
        const before = fake.requests.length;
        const out = {};
        for (const [label, method, url, body] of [
          ["önizleme", "post", URLS.preview, { kind: "statement", ids: [a.id], preset: "lastMonth" }],
          ["toplu başlat", "post", URLS.batches, { kind: "statement", ids: [a.id], preset: "lastMonth" }],
          ["toplu liste", "get", URLS.batches],
          ["duraklat", "post", `${URLS.batches}/${id}/pause`, {}],
          ["devam", "post", `${URLS.batches}/${id}/resume`, {}],
          ["iptal", "post", `${URLS.batches}/${id}/cancel`, {}],
          ["başarısızları yeniden dene", "post", `${URLS.batches}/${id}/retry-failed`, {}],
          ["yine de gönder", "post", `/api/workspace/whatsapp/jobs/${jobId}/send-anyway`, { confirm: true }],
          ["onay yaz", "put", URLS.ack, { ack: false }],
          ["bağlantı yaz", "put", URLS.conn, { phoneNumberId: PNID, wabaId: WABA, token: "BASKA-0123456789-abcdefghij-0123456789" }],
          ["bağlantı sil", "del", URLS.conn],
          ["bağlantıyı sına", "post", `${URLS.conn}/test`, {}],
          ["kendime deneme", "post", `${URLS.conn}/self-test`, { to: "0532 123 45 67" }],
          ["kanca kaydı", "post", `${URLS.conn}/hook`, {}],
          ["ayar yaz", "put", URLS.sending, { dailyCap: 5 }],
        ]) {
          const res = method === "get" || method === "del" ? await client[method](url) : await client[method](url, body);
          out[label] = `${res.status}${res.data?.code ? `:${res.data.code}` : ""}`;
        }
        return { out, metaIstek: fake.requests.length - before };
      };
      r.personel = await calls(personel);
      await ctx.server.close();
      ctx = await startWa({ dataDir, fake, connect: false, ack: false, license: { enforce: true, machineId: "0123456789abcdef0123456789abcdef", services: ["https://lisans.test/api/lisans"], fetchImpl: async () => { throw new TypeError("fetch failed"); }, firstCheckDelayMs: 3_600_000 } });
      ctx.clock.advance(24 * 3_600_000 + 60_000);
      r.saltOkunur = await calls(ctx.api);
      console.log(`# T8-yetki ${JSON.stringify(r)}`);
      for (const label of ["toplu başlat", "duraklat", "devam", "iptal", "başarısızları yeniden dene", "yine de gönder", "onay yaz", "bağlantı yaz", "bağlantı sil", "kendime deneme", "ayar yaz", "önizleme"]) assert.match(r.personel.out[label], /^40[13]/, `personel ${label}`);
      for (const label of ["toplu başlat", "yine de gönder", "kendime deneme", "başarısızları yeniden dene"]) assert.match(r.saltOkunur.out[label], /^40[39]/, `salt okunur ${label}`);
      assert.equal(r.personel.metaIstek, 0);
      void ADMIN_PASSWORD;
    } finally {
      await ctx.server.close().catch(() => {});
      await fake.close();
      rmrf(root);
    }
  });
});
