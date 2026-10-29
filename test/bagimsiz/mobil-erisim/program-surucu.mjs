// Mobil uzaktan erişim kâhininin PROGRAM SÜRÜCÜSÜ (2.4.7 M2; kâhin bu dosyayı okumaz — README "Sürücü (program tarafı)").
//
// kabul.json'daki her senaryoyu GERÇEK programda koşar (her ofis ayrı kurulum: kendi veri klasörü, kendi lisansı, kendi uzak dinleyicisi; ders 17), olay
// dilini programın uçlarına bağlar, programın yanıtlarını kâhinin ret sınıflarına çevirip program.json yazar, sonra kâhinin kendi modeliyle (kahin.py
// Model.kos(gozlem=…), SEÇİLEN birleşim) karşılaştırır ve her farkı sınıflar. Kâhinin beklentisine DOKUNMAZ (ders 40): eşleme tablosu aşağıda, karşılaştırmadan
// ÖNCE yazıldı.
//
// Saat: tek sahte, SABİT saat (iş saati config.now, uzak güvenlik saati config.remoteNow, lisans saati); her olaydan önce olayın anına kurulur (ders 13, 22).
// Lisans servisi sahte ve yereldir (fetchImpl; ders 30 — gerçek servise istek gitmez). Program lisans değişikliğini HEMEN öğrenir (lisans_degis /
// program_lisans_denetle / servis geri gelince denetim): kapıcının ≤ P9 penceresinin en hızlı ucu (kâhin V9/V10 bu anı da kabul eder).
//
// Kullanım:
//   node test/bagimsiz/mobil-erisim/program-surucu.mjs [--senaryo U01,U15] [--cikti <klasör>] [--birlesim "k=v;…"]
//   KANIT_DIR=… node tools/kanit.mjs kos m2-kahin -- node test/bagimsiz/mobil-erisim/program-surucu.mjs --cikti <klasör>
// Çıktı: <klasör>/program.json, <klasör>/karsilastirma.json; ekrana senaryo başına TAP + "# tests/pass/fail" (fail = BULGU ya da İNCELE içeren senaryo).
import { execFileSync } from "node:child_process";
import { generateKeyPairSync } from "node:crypto";
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createClock } from "../../../server/lib/clock.mjs";
import { signToken } from "../../../server/lib/license-token.mjs";
import { isGrantable, permissionsFor } from "../../../server/lib/permissions.mjs";
import { ADMIN_PASSWORD, createClient, startTestServer } from "../../helpers.mjs";
import { createPhone, rawRequest } from "../../mobil-uzak-ortak.mjs";
import { M3_SINIFLAR, m3Kur } from "./m3-surucu.mjs"; // 2.4.7 M3: kapıcı (uzak istek önce kapıcıdan) + şifreli özet olayları

const HERE = path.dirname(fileURLToPath(import.meta.url));
const PASSWORD = "Uzak-Parola-2026!";
const WRONG = "Yanlis-Parola-9!";

// ---------- Eşleme tablosu (sürücü kararı; karşılaştırmadan ÖNCE yazıldı) ----------
// Kullanıcı rolü: yonetici → admin; kullanici → personel, etkin yetkileri YALNIZ aşağıdaki karşılıklar (personelin öbür varsayılanları kaldırılır).
const GRANT_OF = { kasa: "cash.view", cari: "accounts.view", stok: "stock.view", taksit: "plans.view", "rapor:cari-ekstre": "overview.view" };
// "anlik_durum" yalnız yönetici rolündedir (overview.card verilemez); "rapor:kasa" mobil beyaz listede yok → olay koşulur (oturum etkisi), çıktıya YAZILMAZ.
// İstek yetkisi → programın mobil ucu (yetki o uçta denetlenir).
const ENDPOINT_OF = { kasa: "/api/mobil/cash", cari: "/api/mobil/accounts", stok: "/api/mobil/stock", taksit: "/api/mobil/plans", anlik_durum: "/api/mobil/overview", "rapor:cari-ekstre": "/api/mobil/reports" };
const UNMAPPED_YETKI = { "rapor:kasa": "DENENMEYEN: mobilde Kasa raporu yok (M1 beyaz listesi, v0.3 MOBILE_REPORT_IDS)", tahsilat: "DENENMEYEN: mobil yazma M5'te (bu işte /api/mobil/ yazma 405)" };
// Programın yanıtı (HTTP + code) → kâhinin ret sınıfı.
const CLASS_OF_CODE = {
  "remote-device": "cihaz_yok", "remote-proof": "cihaz_yok", "remote-license": "lisans_gecersiz", "LICENSE_READ_ONLY": "lisans_gecersiz", "remote-path": "yol_yasak",
  "remote-session": "oturum_gecersiz", "company-missing": "sirket_yok", "company-forbidden": "yetki_yok", FORBIDDEN: "yetki_yok", "remote-code": "kod_gecersiz",
  "remote-limit": "sinir_dolu", "remote-permission": "uzaktan_izni_yok", "remote-password-change": "uzaktan_izni_yok", "remote-password": "parola_yanlis",
  "remote-locked": "deneme_siniri", "remote-device-user": "cihaz_baska_kullanici", "remote-device-missing": "cihaz_yok", "mobile-read-only": "yazma_yasak",
};
Object.assign(CLASS_OF_CODE, M3_SINIFLAR); // 2.4.7 M3
const classify = response => {
  if (response.status >= 200 && response.status < 300) return "kabul";
  const cls = CLASS_OF_CODE[response.code];
  return cls ? `ret:${cls}` : `ret:tanınmadı_${response.status}_${response.code || "kodsuz"}`;
};
const DOWN = "ret:sunucu_kapali";
const MAINTENANCE = new Set(["lisans_degis", "lisans_servisi", "program_lisans_denetle", "sunucu", "bekle"]);
const CLASS = { lisans_degis: 0, lisans_servisi: 0, program_lisans_denetle: 0, sunucu: 0, bekle: 0, kullanici_degis: 1, cihaz_sil: 1, karekod_uret: 1, ozet_yukle: 1, esle: 2, kapici_dogrudan_kayit: 2, giris: 3, istek: 4, ozet_oku: 4, ozet_yaz: 4 };
const NOT_IN_PROGRAM = { ozet_yukle: "DENENMEYEN: şifreli özet (R2) M3'te", ozet_oku: "DENENMEYEN: şifreli özet (R2) M3'te", ozet_yaz: "DENENMEYEN: kapıcı/özet M3'te", kapici_dogrudan_kayit: "DENENMEYEN: kapıcı (Worker) M3'te" };

// Saat: ofsetsiz saat TR (UTC+3; kâhin V1).
const ms = text => Date.parse(/[zZ]|[+-]\d{2}:?\d{2}$/.test(text) ? text : `${text}+03:00`);

// Kâhinin yol beyaz listesinin (yalnız EŞLEME kararı için: izinli bir yolu hangi gerçek uca göndereceğiz) aynısı; yasak yol programa harfi harfine gider.
function oracleAllowed(yol) {
  if (typeof yol !== "string" || !yol.startsWith("/")) return false;
  const pathOnly = yol.split("#")[0].split("?")[0];
  const unquote = s => s.replace(/%([0-9A-Fa-f]{2})/g, (_, h) => String.fromCharCode(parseInt(h, 16)));
  const once = unquote(pathOnly);
  if (once.includes("%") && unquote(once) !== once) return false;
  if (once.includes("\\") || once.includes("\0") || once.includes("//")) return false;
  if (once.split("/").slice(1).some(b => b === "." || b === "..")) return false;
  return once.startsWith("/mobil/") || once.startsWith("/api/mobil/");
}

const KEY = (() => {
  const { publicKey, privateKey } = generateKeyPairSync("ed25519");
  return { pem: privateKey.export({ format: "pem", type: "pkcs8" }), spki: publicKey.export({ format: "der", type: "spki" }).toString("base64") };
})();
const TRUSTED = { "kahin-surucu-1": KEY.spki };

function licenseRecord(raw, previous) {
  const rec = previous ? { ...previous } : { durum: "gecerli", bitis: null, cihaz_siniri: 3, plan: "standart" };
  for (const [k, v] of Object.entries(raw || {})) rec[k] = v;
  return rec;
}

async function runScenario(sen, root) {
  const clock = createClock({ time: ms(sen.olaylar.map(e => e.t).sort((a, b) => ms(a) - ms(b))[0]) - 3_600_000, fixed: true });
  const world = { online: sen.baslangic.lisans_servisi !== "yok" };
  const offices = {};
  const out = {};
  const notes = {};
  const phones = new Map(); // cihaz etiketi → { office, phone }
  const sessions = new Map(); // oturum etiketi → hof_mobil çerezi
  const codes = new Map(); // "ofis|etiket" → karekod
  let machineSeq = 0;

  const fetchFor = office => async (url, init) => {
    if (!world.online && !office.forceOnline) throw Object.assign(new TypeError("fetch failed"), { cause: { code: "ENOTFOUND" } });
    const rec = office.record;
    const at = new Date(clock.ms()).toISOString();
    const token = signToken({
      schema: 1, product: "DestekOfis", type: "license-token", kind: "license", status: rec.durum === "engelli" ? "blocked" : "active", licenseId: `LIS-KAHIN-${office.name}`,
      customer: `Ofis ${office.name}`, machine: office.machine, issuedAt: at, startsAt: at, expiresAt: rec.bitis ? new Date(ms(rec.bitis)).toISOString() : null, offline: false, message: "",
      ...(Number.isInteger(rec.cihaz_siniri) ? { mobileDevices: rec.cihaz_siniri } : {}),
    }, KEY.pem, "kahin-surucu-1");
    void url;
    void init;
    return { status: 200, json: async () => ({ ok: true, token }) };
  };
  const m3 = await m3Kur({ clock, offices, fetchFor, trustedKeys: TRUSTED }); // 2.4.7 M3

  async function boot(office) {
    office.server = await startTestServer({
      dataDir: office.dataDir, backupDir: office.backupDir, now: clock, remoteNow: clock, ...m3.sunucu(),
      license: { enforce: true, trustedKeys: TRUSTED, services: ["https://lisans.kahin.test/api/lisans"], fetchImpl: fetchFor(office), machineId: office.machine, now: () => clock.ms(), firstCheckDelayMs: 3_600_000, autoTrial: false },
    });
    const address = await office.server.app.listenRemote(0, "127.0.0.1");
    office.remoteBase = `http://127.0.0.1:${address.port}`;
    office.clients = new Map();
    office.up = true;
    await m3.acildi(office); // 2.4.7 M3: telefonlar kapıcıya bağlanır (remoteBase = kapıcı)
    for (const { office: name, phone } of phones.values()) if (name === office.name) phone.base = office.remoteBase;
  }
  async function clientOf(office, username) {
    if (office.clients.has(username)) return office.clients.get(username);
    const client = createClient(office.server.base);
    const login = await client.login(username, username === "admin" ? ADMIN_PASSWORD : PASSWORD);
    if (login.status !== 200) throw new Error(`${office.name}: ${username} ofiste giriş yapamadı (${login.status} ${JSON.stringify(login.data)})`);
    office.clients.set(username, client);
    return client;
  }
  const userIds = async office => Object.fromEntries((await (await clientOf(office, "admin")).get("/api/admin/users")).data.data.map(u => [u.username, u.id]));
  const checkLicense = async office => {
    if (office.up && (world.online || office.forceOnline)) await office.server.app.license.check().catch(() => {});
  };
  const grantsFor = user => {
    const wanted = (user.yetkiler || []).map(y => GRANT_OF[y]).filter(Boolean);
    return { add: wanted, remove: permissionsFor("personel").filter(p => !wanted.includes(p) && isGrantable(p)) };
  };
  async function applyUser(office, name, user, admin) {
    const id = office.ids[name];
    const role = user.rol === "yonetici" ? "admin" : "personel";
    const results = [];
    results.push(await admin.patch(`/api/admin/users/${id}`, role === "admin" ? { role } : { role, grants: grantsFor(user) }));
    if (role !== "admin") {
      const companies = (user.sirketler || []).filter(code => office.companyIds[code]).map(code => office.companyIds[code]);
      results.push(await admin.put(`/api/companies/access/${id}`, { companies }));
    }
    return results;
  }

  // ---------- Kurulum (her ofis; lisans geçerliyken; sonra başlangıç lisansı) ----------
  for (const [name, spec] of Object.entries(sen.baslangic.ofisler)) {
    const dir = mkdtempSync(path.join(root, `${sen.ad}-${name}-`));
    machineSeq += 1;
    const office = { name, dataDir: path.join(dir, "data"), backupDir: path.join(dir, "backups"), machine: `${String(machineSeq).padStart(2, "0")}${"ab".repeat(15)}`, record: licenseRecord({}), forceOnline: true, users: {}, ids: {}, companyIds: {} };
    offices[name] = office;
    await boot(office);
    const activated = await office.server.app.license.activateKey("DO-ABCDE-FGHJK-MNPQR-STVWX").catch(error => error);
    if (activated instanceof Error || !office.server.app.license.status().writable) throw new Error(`${name}: kurulum lisansı etkinleşmedi (${activated?.message || "salt okunur"})`);
    const admin = await clientOf(office, "admin");
    const companies = await admin.get("/api/companies");
    office.companyIds["001"] = companies.data.data.companies.find(c => c.code === "001").id;
    for (const code of (spec.sirketler || ["001"]).filter(code => code !== "001")) {
      const created = await admin.post("/api/companies", { code, name: `Şirket ${code}` });
      if (created.status !== 200) throw new Error(`${name}: şirket ${code} açılamadı ${JSON.stringify(created.data)}`);
      office.companyIds[code] = created.data.data.company.id;
    }
    for (const [uname, user] of Object.entries(spec.kullanicilar || {})) {
      office.users[uname] = JSON.parse(JSON.stringify(user));
      const created = await admin.post("/api/admin/users", { username: uname, name: uname, role: user.rol === "yonetici" ? "admin" : "personel", password: PASSWORD, mustChangePassword: false });
      if (created.status !== 200) throw new Error(`${name}: kullanıcı ${uname} açılamadı ${JSON.stringify(created.data)}`);
    }
    office.ids = await userIds(office);
    for (const [uname, user] of Object.entries(spec.kullanicilar || {})) {
      for (const r of await applyUser(office, uname, user, admin)) if (r.status !== 200) throw new Error(`${name}: ${uname} yetki/şirket ayarı ${r.status} ${JSON.stringify(r.data)}`);
      if (user.uzaktan) {
        const r = await admin.put(`/api/admin/mobile/access/${office.ids[uname]}`, { remote: true });
        if (r.status !== 200) throw new Error(`${name}: ${uname} uzak izin ${r.status}`);
      }
    }
    office.record = licenseRecord(spec.lisans);
    await checkLicense(office);
    await m3.kayit(office); // 2.4.7 M3: açılış kaydı (üretimde zamanlayıcı yapar)
    office.forceOnline = false;
    if ((spec.sunucu || "acik") === "kapali") {
      await office.server.close();
      office.up = false;
      m3.kapandi(office);
    }
  }

  const esliOf = async office => (office.up ? { [office.name]: (await (await clientOf(office, "admin")).get("/api/admin/mobile/devices")).data.data.used } : null);
  const phoneOf = (label, officeName) => {
    if (!phones.has(label)) phones.set(label, { office: officeName, phone: createPhone(offices[officeName].remoteBase || "http://127.0.0.1:9", m3.host(officeName)) });
    return phones.get(label);
  };
  // 2.4.7 M3: ofis adresi (Host) EN SONDA — Cloudflare kenarı yönlendirmeyi Host'a göre yapar; istemcinin Host taklidi ofisin kapıcısına ulaşamaz (m3-surucu.mjs).
  const extraHeaders = e => ({ ...(e.gorunen_adres ? { "x-forwarded-for": e.gorunen_adres } : {}), ...Object.fromEntries(Object.entries(e.basliklar || {}).map(([k, v]) => [k.toLowerCase(), String(v)])), ...m3.host(e.ofis) });

  async function run(e) {
    const office = offices[e.ofis];
    const record = (sonuc, extra = {}) => {
      out[String(e.no)] = { sonuc, ...extra };
    };
    switch (e.olay) {
      case "bekle":
        return;
      case "lisans_servisi":
        world.online = e.erisim === "var";
        if (world.online) for (const o of Object.values(offices)) await checkLicense(o);
        return;
      case "lisans_degis":
        office.record = licenseRecord(e.lisans, office.record);
        await checkLicense(office);
        return;
      case "program_lisans_denetle":
        await checkLicense(office);
        return;
      case "sunucu":
        if (e.durum === "kapali" && office.up) {
          await office.server.close();
          office.up = false;
          m3.kapandi(office);
        } else if (e.durum === "acik" && !office.up) {
          await boot(office);
          await checkLicense(office);
        }
        return;
      default:
    }
    if (m3.olaylar.has(e.olay)) return m3.olay(e, { office, record, phones, phoneOf }); // 2.4.7 M3
    if (NOT_IN_PROGRAM[e.olay]) {
      notes[String(e.no)] = NOT_IN_PROGRAM[e.olay];
      return;
    }
    if (!office.up && !m3.kapidan(e)) return record(DOWN);
    if (e.olay === "karekod_uret") {
      const client = await clientOf(office, e.yapan);
      const response = await client.post("/api/admin/mobile/codes", { userId: office.ids[e.kullanici] });
      if (response.status === 200) codes.set(`${e.ofis}|${e.kod}`, response.data.data.code);
      return record(classify({ status: response.status, code: response.data?.code }));
    }
    if (e.olay === "cihaz_sil") {
      const client = await clientOf(office, e.yapan);
      const known = phones.get(e.cihaz);
      const id = known && known.office === e.ofis && known.phone.deviceId ? known.phone.deviceId : "dev-00000000-0000-0000-0000-000000000000";
      const response = await client.del(`/api/admin/mobile/devices/${id}`);
      return record(classify({ status: response.status, code: response.data?.code }), { esli: await esliOf(office) });
    }
    if (e.olay === "kullanici_degis") {
      const client = await clientOf(office, e.yapan);
      const user = { ...office.users[e.kullanici] };
      for (const [k, v] of Object.entries(e.degisiklik)) user[k] = v;
      const id = office.ids[e.kullanici];
      let result = null;
      const keys = Object.keys(e.degisiklik);
      if (keys.some(k => ["rol", "yetkiler", "sirketler"].includes(k))) {
        for (const r of await applyUser(office, e.kullanici, user, client)) if (!result && r.status !== 200) result = r;
      }
      if (!result && "uzaktan" in e.degisiklik) {
        const r = await client.put(`/api/admin/mobile/access/${id}`, { remote: Boolean(e.degisiklik.uzaktan) });
        if (r.status !== 200) result = r;
      }
      if (!result) office.users[e.kullanici] = user;
      return record(result ? classify({ status: result.status, code: result.data?.code }) : "kabul");
    }
    if (e.olay === "esle") {
      if (phones.get(e.cihaz)?.phone.deviceId) throw new Error(`cihaz etiketi yeniden kullanıldı: ${e.cihaz}`);
      phones.delete(e.cihaz);
      const { phone } = phoneOf(e.cihaz, e.ofis);
      phone.base = office.remoteBase;
      phone.kind = e.cihaz_turu || "telefon";
      const own = codes.get(`${e.ofis}|${e.kod}`);
      const foreign = [...codes].find(([key]) => key.endsWith(`|${e.kod}`))?.[1];
      const response = await phone.pair(own || foreign || "kahin-olmayan-kod-0000");
      return record(classify(response), { esli: await esliOf(office) });
    }
    if (e.olay === "giris") {
      const { phone } = phoneOf(e.cihaz, e.ofis);
      const target = phones.get(e.cihaz).office === e.ofis ? phone : createPhone(office.remoteBase);
      target.base = office.remoteBase;
      const response = await target.login(e.kullanici, e.parola === "dogru" ? PASSWORD : WRONG, { headers: extraHeaders(e) });
      if (response.status === 200) sessions.set(e.oturum, target.jar.get("hof_mobil"));
      return record(classify(response));
    }
    if (e.olay === "istek") {
      const entry = phones.get(e.cihaz);
      const device = entry && entry.office === e.ofis ? entry.phone.jar.get("hof_device") : "";
      const session = e.oturum ? sessions.get(e.oturum) : "";
      const cookie = [device ? `hof_device=${device}` : "", session ? `hof_mobil=${session}` : ""].filter(Boolean).join("; ");
      let target = e.yol;
      const company = e.sirket ? office.companyIds[e.sirket] || `sirket-${e.sirket}-yok` : "";
      if (e.yetki && oracleAllowed(e.yol)) target = `${ENDPOINT_OF[e.yetki] || `/api/mobil/reports/kahin-${e.yetki.replace(/[^a-z0-9-]/gi, "-")}`}${company ? `?company=${encodeURIComponent(company)}` : ""}`;
      else if (oracleAllowed(e.yol) && !decodeURIComponent(e.yol.split("?")[0]).startsWith("/mobil/")) target = `/api/mobil/session${company ? `?company=${encodeURIComponent(company)}` : ""}`;
      const method = e.yazma ? "POST" : "GET";
      const headers = { ...(cookie ? { cookie } : {}), ...extraHeaders(e) };
      const response = await rawRequest(office.remoteBase, method, e.yazma ? "/api/mobil/tahsilat" : target, { headers, ...(e.yazma ? { body: { tutar: 1 } } : {}) });
      if (e.yetki && UNMAPPED_YETKI[e.yetki]) {
        notes[String(e.no)] = `${UNMAPPED_YETKI[e.yetki]} (program: ${classify(response)})`;
        return;
      }
      return record(classify(response));
    }
    throw new Error(`bilinmeyen olay ${e.olay}`);
  }

  const sorted = [...sen.olaylar].sort((a, b) => ms(a.t) - ms(b.t) || CLASS[a.olay] - CLASS[b.olay] || a.no - b.no);
  const done = new Set();
  try {
    for (const e of sorted) {
      if (done.has(e.no)) continue;
      const group = e.grup ? sorted.filter(x => x.grup === e.grup) : [e];
      for (const x of group) done.add(x.no);
      clock.set(ms(e.t));
      await Promise.all(group.map(x => run(x)));
      await m3.bekle(); // 2.4.7 M3: güvenlik yüklemeleri (eşleme, silme, yetki) bir sonraki olaydan önce biter
    }
  } finally {
    for (const office of Object.values(offices)) if (office.up) await office.server.close().catch(() => {});
    await m3.kapat();
  }
  return { out, notes };
}

// ---------- Karşılaştırma: kâhinin KENDİ modeli (değiştirilmeden) programın gözlemiyle ----------
const PY = `
import importlib.util, json, sys
spec = importlib.util.spec_from_file_location("kahin_model", sys.argv[1]); k = importlib.util.module_from_spec(spec); spec.loader.exec_module(k)
kabul = json.load(open(sys.argv[2], encoding="utf-8")); program = json.load(open(sys.argv[3], encoding="utf-8"))
atama = k.tam_birlesim(k.birlesim_coz(sys.argv[4] or (kabul.get("secilen_birlesim") or "")))
sonuc = {}
for sen in kabul["senaryolar"]:
    gz = program.get(sen["ad"])
    if gz is None: continue
    r = k.Model(sen, k.Parametreler(atama)).kos(gozlem=gz)
    sonuc[sen["ad"]] = {"farklar": r["farklar"], "beklenen": {n: v["sonuc"] for n, v in r["olaylar"].items()}}
print(json.dumps({"birlesim": k.birlesim_metni(atama), "sonuc": sonuc}, ensure_ascii=False))
`;

function hint(sen, no, fark) {
  const e = sen.olaylar.find(x => x.no === no);
  const before = sen.olaylar.filter(x => ms(x.t) <= ms(e.t) && x.no !== no);
  const hints = [];
  if (before.some(x => x.olay === "kapici_dogrudan_kayit" && x.ofis === e.ofis)) hints.push("kapıcıya doğrudan kayıt (M3, DENENMEYEN) sonrası zincir: kâhinin dünyasında programda olmayan cihaz var");
  if (false && fark.kahin?.sonuc?.includes("ret:lisans_dogrulanamadi")) hints.push("kapıcının lisans önbelleği P9 (M3 kapıcı kuralı; program kendi 7 günlük internetsiz toleransını uygular)");
  if (false && fark.program?.sonuc === DOWN && !fark.kahin?.sonuc?.includes(DOWN)) hints.push("sunucu kapalıyken kapıcı (M3/M4) önce yanıtlar; programın tek yanıtı 'sunucu kapalı'");
  return hints;
}

async function main() {
  const args = process.argv.slice(2);
  const opt = name => (args.includes(name) ? args[args.indexOf(name) + 1] : "");
  const only = opt("--senaryo") ? new Set(opt("--senaryo").split(",")) : null;
  const outDir = path.resolve(opt("--cikti") || mkdtempSync(path.join(tmpdir(), "m2-kahin-")));
  mkdirSync(outDir, { recursive: true });
  const kabulPath = path.join(HERE, "kabul.json");
  const kabul = JSON.parse(readFileSync(kabulPath, "utf8"));
  const root = mkdtempSync(path.join(tmpdir(), "m2-kahin-veri-"));
  const program = {};
  const notes = {};
  try {
    for (const sen of kabul.senaryolar) {
      if (only && !only.has(sen.ad)) continue;
      const started = Date.now();
      const result = await runScenario(sen, root);
      program[sen.ad] = result.out;
      notes[sen.ad] = result.notes;
      process.stderr.write(`${sen.ad}: ${Object.keys(result.out).length} olay, ${Math.round((Date.now() - started) / 1000)} sn\n`);
    }
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
  const programPath = path.join(outDir, "program.json");
  writeFileSync(programPath, JSON.stringify(program, null, 1));
  const kabulSub = only ? path.join(outDir, "kabul-secili.json") : kabulPath;
  if (only) writeFileSync(kabulSub, JSON.stringify({ ...kabul, senaryolar: kabul.senaryolar.filter(s => only.has(s.ad)) }));
  const compared = JSON.parse(execFileSync("python3", ["-I", "-c", PY, path.join(HERE, "kahin.py"), kabulSub, programPath, opt("--birlesim")], { encoding: "utf8", maxBuffer: 256 * 1024 * 1024 }));
  const report = { birlesim: compared.birlesim, senaryolar: {} };
  const totals = { olay: 0, eslesen: 0, DENENMEYEN: 0, M3_KAPICI: 0, BULGU: 0, "İNCELE": 0, denenmeyen_nedenleri: {} };
  let index = 0;
  let failed = 0;
  console.log("TAP version 13");
  for (const sen of kabul.senaryolar) {
    if (only && !only.has(sen.ad)) continue;
    index += 1;
    const r = compared.sonuc[sen.ad];
    const events = sen.olaylar.filter(e => !MAINTENANCE.has(e.olay));
    const farklar = (r?.farklar || []).map(f => {
      const no = f.no;
      const note = notes[sen.ad][String(no)];
      if (f.neden && note) return { ...f, sinif: note.startsWith("DENENMEYEN") ? "DENENMEYEN" : "İNCELE", neden: note };
      const ipucu = hint(sen, no, f);
      let sinif = String(f.sinif || f.neden || "").startsWith("BULGU") ? "BULGU" : String(f.sinif || "").startsWith("İNCELE") ? "İNCELE" : "BULGU";
      // Kâhinin M3 KAPICI kuralına (P9 lisans önbelleği; kapıcıya doğrudan kayıt) bağlı fark: programda bu işte üretilemez; ayrı sayılır ve listelenir
      // (gizlenmez, beklenti değişmez — ders 40). M3 kapıcısıyla birlikte koşulur.
      if (ipucu.length && ipucu.every(text => text.includes("M3"))) sinif = "M3_KAPICI";
      return { ...f, sinif, ayrinti: f.sinif || f.neden, ipucu };
    });
    const differing = new Set(farklar.map(f => f.no));
    const matched = events.filter(e => !differing.has(e.no)).length;
    totals.olay += events.length;
    totals.eslesen += matched;
    for (const f of farklar) {
      totals[f.sinif] += 1;
      if (f.sinif === "DENENMEYEN") {
        const reason = String(f.neden).replace(/ \(program: .*\)$/, "");
        totals.denenmeyen_nedenleri[reason] = (totals.denenmeyen_nedenleri[reason] || 0) + 1;
      }
    }
    const real = farklar.filter(f => f.sinif === "BULGU" || f.sinif === "İNCELE");
    const m3 = farklar.filter(f => f.sinif === "M3_KAPICI");
    for (const f of m3) console.log(`  # M3_KAPICI ${sen.ad} ${JSON.stringify({ no: f.no, olay: f.olay, program: f.program?.sonuc, kahin: f.kahin?.sonuc, ipucu: f.ipucu })}`);
    report.senaryolar[sen.ad] = { olay: events.length, eslesen: matched, farklar };
    if (real.length) {
      failed += 1;
      console.log(`not ok ${index} - ${sen.ad} (${matched}/${events.length}; ${real.length} fark)`);
      for (const f of real.slice(0, 12)) console.log(`  # ${f.sinif} ${JSON.stringify({ no: f.no, olay: f.olay, program: f.program?.sonuc, kahin: f.kahin?.sonuc, ipucu: f.ipucu })}`);
    } else console.log(`ok ${index} - ${sen.ad} (${matched}/${events.length}${farklar.length ? `; ${farklar.length} DENENMEYEN` : ""})`);
  }
  writeFileSync(path.join(outDir, "karsilastirma.json"), JSON.stringify({ ...report, toplam: totals }, null, 1));
  console.log(`# birlesim ${compared.birlesim}`);
  const producible = totals.olay - totals.DENENMEYEN - totals.M3_KAPICI;
  console.log(`# olay eşleşen ${totals.eslesen}/${totals.olay} (programda üretilebilen ${totals.eslesen}/${producible}) · BULGU ${totals.BULGU} · İNCELE ${totals["İNCELE"]} · M3_KAPICI ${totals.M3_KAPICI} · DENENMEYEN ${totals.DENENMEYEN}`);
  for (const [reason, count] of Object.entries(totals.denenmeyen_nedenleri)) console.log(`# DENENMEYEN ${count} × ${reason}`);
  console.log(`# çıktı ${outDir}`);
  console.log(`# tests ${index}\n# pass ${index - failed}\n# fail ${failed}`);
  process.exitCode = failed ? 1 : 0;
}

main().catch(error => {
  console.error(error);
  console.log("# tests 1\n# pass 0\n# fail 1");
  process.exitCode = 1;
});
