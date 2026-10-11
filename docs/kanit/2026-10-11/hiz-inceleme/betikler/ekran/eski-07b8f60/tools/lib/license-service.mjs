// Lisans servisinin başvuru (referans) uygulaması.
//
// Faz 4'te bu mantık Vercel (API) + Supabase (veri) üzerine taşınır; protokol aynı kalır (docs/LISANS.md).
// Burada testlerde, yerel denemede ve Faz 4'e kadar küçük bir ofis ağında çalıştırmak için kullanılır:
// node tools/lisans-servisi.mjs baslat --anahtar <gizli.pem> --veri lisans-veri.json
//
// Uçlar (JSON, POST):
//   /v1/activate { product, kind: "trial"|"license", machine, instanceId, version, licenseKey?, office? }
//   /v1/check    { product, licenseId, machine, instanceId, version }
// Yanıt: { ok: true, token: <imzalı zarf> } veya { ok: false, code, error }.
// Kurallar: deneme bilgisayar başına bir kez verilir (aynı bilgisayar yeniden isterse ilk denemenin belirteci döner,
// süresi dolmuşsa dolmuş olarak); lisans anahtarı ilk etkinleştirildiği bilgisayara bağlanır; engellenen lisans
// doğrulamada "blocked" durumlu imzalı belirteç alır (program salt okunur olur).
import { createPrivateKey, createPublicKey, randomBytes } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import path from "node:path";
import { PRODUCT, normalizeMachineId, signToken } from "../../server/lib/license-token.mjs";
import { normalizeLicenseKey } from "../../server/lib/license.mjs";

export const DEFAULT_TRIAL_DAYS = 30;
const DAY = 86_400_000;
const CROCKFORD = "0123456789ABCDEFGHJKMNPQRSTVWXYZ";

export function newLicenseKey() {
  const bytes = randomBytes(20);
  const chars = [...bytes].map(byte => CROCKFORD[byte % 32]).join("");
  return `DO-${chars.match(/.{5}/g).join("-")}`;
}
const newId = prefix => `${prefix}-${new Date().toISOString().slice(0, 10).replace(/-/g, "")}-${randomBytes(4).toString("hex").toUpperCase()}`;

// Gizli anahtarın hangi güvenilen anahtara karşılık geldiğini bulur (yoksa null).
export function keyIdForLicense(privateKeyPem, trustedKeys) {
  const spki = createPublicKey(createPrivateKey(privateKeyPem)).export({ format: "der", type: "spki" }).toString("base64");
  return Object.entries(trustedKeys).find(([, value]) => value === spki)?.[0] || null;
}

// Basit JSON dosyası deposu (Faz 4'te Supabase tabloları: trials, licenses, events).
export function createFileStore(file) {
  const empty = () => ({ trials: {}, licenses: {}, events: [] });
  const read = () => {
    if (!file || !existsSync(file)) return empty();
    try {
      return { ...empty(), ...JSON.parse(readFileSync(file, "utf8")) };
    } catch {
      throw new Error(`Lisans veri dosyası okunamadı: ${file}`);
    }
  };
  let data = read();
  return {
    get data() {
      return data;
    },
    save() {
      if (!file) return;
      mkdirSync(path.dirname(path.resolve(file)), { recursive: true });
      const temp = `${file}.tmp`;
      writeFileSync(temp, JSON.stringify(data, null, 2));
      renameSync(temp, file);
    },
    reload() {
      data = read();
    },
  };
}

export function createReferenceLicenseService({ privateKeyPem, keyId, store = createFileStore(null), trialDays = DEFAULT_TRIAL_DAYS, now = () => Date.now() }) {
  const iso = time => new Date(time).toISOString();
  const log = (type, details) => {
    store.data.events.push({ at: iso(now()), type, ...details });
    if (store.data.events.length > 5000) store.data.events.splice(0, store.data.events.length - 5000);
  };
  const token = ({ kind, status = "active", licenseId, customer = "", machine, startsAt, expiresAt, message = "" }) =>
    signToken({ schema: 1, product: PRODUCT, type: "license-token", kind, status, licenseId, customer, machine, issuedAt: iso(now()), startsAt, expiresAt, offline: false, message }, privateKeyPem, keyId);
  const reject = (code, error) => ({ status: code === "BAD_REQUEST" ? 400 : 409, body: { ok: false, code, error } });
  const accept = envelope => ({ status: 200, body: { ok: true, token: envelope } });

  function trialToken(machine) {
    const trial = store.data.trials[machine];
    return token({ kind: "trial", status: trial.status || "active", licenseId: trial.licenseId, customer: trial.office?.name || "", machine, startsAt: trial.startsAt, expiresAt: trial.expiresAt, message: trial.message || "" });
  }
  function licenseToken(license) {
    return token({ kind: "license", status: license.status, licenseId: license.licenseId, customer: license.customer, machine: license.machine, startsAt: license.activatedAt || license.createdAt, expiresAt: license.expiresAt, message: license.message || "" });
  }
  const findLicense = idOrKey => {
    const key = normalizeLicenseKey(idOrKey);
    if (key && store.data.licenses[key]) return [key, store.data.licenses[key]];
    return Object.entries(store.data.licenses).find(([, item]) => item.licenseId === idOrKey) || [null, null];
  };

  function activate(body) {
    const machine = normalizeMachineId(body.machine);
    if (body.product !== PRODUCT || !machine) return reject("BAD_REQUEST", "Geçersiz istek.");
    if (body.kind === "trial") {
      if (!store.data.trials[machine]) {
        const startsAt = now();
        const office = body.office && typeof body.office === "object" ? { name: String(body.office.name || "").slice(0, 120), contact: String(body.office.contact || "").slice(0, 120), email: String(body.office.email || "").slice(0, 160), phone: String(body.office.phone || "").slice(0, 40) } : {};
        store.data.trials[machine] = { licenseId: newId("DEN"), startsAt: iso(startsAt), expiresAt: iso(startsAt + trialDays * DAY), office, instanceId: String(body.instanceId || "").slice(0, 80), version: String(body.version || "").slice(0, 20), createdAt: iso(startsAt) };
        log("trial.started", { machine, licenseId: store.data.trials[machine].licenseId });
        store.save();
      } else log("trial.repeated", { machine, licenseId: store.data.trials[machine].licenseId });
      return accept(trialToken(machine));
    }
    if (body.kind === "license") {
      const [key, license] = findLicense(body.licenseKey);
      if (!license) return reject("LICENSE_NOT_FOUND", "Lisans anahtarı bulunamadı.");
      if (license.status === "blocked") return reject("LICENSE_BLOCKED", license.message || "Bu lisans engellenmiş.");
      if (license.machine && license.machine !== machine) return reject("LICENSE_IN_USE", "Bu lisans başka bir bilgisayarda etkin.");
      if (!license.machine) {
        license.machine = machine;
        license.activatedAt = iso(now());
        license.instanceId = String(body.instanceId || "").slice(0, 80);
        log("license.activated", { key, machine, licenseId: license.licenseId });
        store.save();
      }
      return accept(licenseToken(license));
    }
    return reject("BAD_REQUEST", "Geçersiz lisans türü.");
  }

  function check(body) {
    const machine = normalizeMachineId(body.machine);
    if (body.product !== PRODUCT || !machine || typeof body.licenseId !== "string") return reject("BAD_REQUEST", "Geçersiz istek.");
    const trial = store.data.trials[machine];
    if (trial && trial.licenseId === body.licenseId) return accept(trialToken(machine));
    const [, license] = findLicense(body.licenseId);
    if (!license || license.machine !== machine) return reject("LICENSE_NOT_FOUND", "Lisans bulunamadı.");
    return accept(licenseToken(license));
  }

  // ---------- Operatör işlemleri (Faz 4'te operatör paneli) ----------
  const admin = {
    createLicense({ customer = "", expiresAt = null, message = "" } = {}) {
      const key = newLicenseKey();
      store.data.licenses[key] = { licenseId: newId("LIS"), customer: String(customer).slice(0, 120), expiresAt: expiresAt ? new Date(expiresAt).toISOString() : null, status: "active", message, machine: null, createdAt: iso(now()) };
      log("license.created", { key, licenseId: store.data.licenses[key].licenseId });
      store.save();
      return { key, ...store.data.licenses[key] };
    },
    setStatus(idOrKey, status, message = "") {
      const [key, license] = findLicense(idOrKey);
      if (license) {
        license.status = status;
        license.message = message;
        log(`license.${status}`, { key, licenseId: license.licenseId });
      } else {
        const trial = Object.values(store.data.trials).find(item => item.licenseId === idOrKey);
        if (!trial) throw new Error(`Lisans bulunamadı: ${idOrKey}`);
        trial.status = status;
        trial.message = message;
        log(`trial.${status}`, { licenseId: trial.licenseId });
      }
      store.save();
    },
    extend(idOrKey, expiresAt) {
      const [key, license] = findLicense(idOrKey);
      if (!license) throw new Error(`Lisans bulunamadı: ${idOrKey}`);
      license.expiresAt = expiresAt ? new Date(expiresAt).toISOString() : null;
      log("license.extended", { key, licenseId: license.licenseId, expiresAt: license.expiresAt });
      store.save();
    },
    release(idOrKey) {
      const [key, license] = findLicense(idOrKey);
      if (!license) throw new Error(`Lisans bulunamadı: ${idOrKey}`);
      log("license.released", { key, licenseId: license.licenseId, machine: license.machine });
      license.machine = null;
      license.activatedAt = null;
      store.save();
    },
  };

  // HTTP işleyicisi (node:http veya fetch uyumlu test ağı için).
  async function handle(pathname, body) {
    try {
      if (pathname.endsWith("/v1/activate")) return activate(body || {});
      if (pathname.endsWith("/v1/check")) return check(body || {});
      return { status: 404, body: { ok: false, code: "NOT_FOUND", error: "Uç bulunamadı." } };
    } catch (error) {
      return { status: 500, body: { ok: false, code: "SERVER_ERROR", error: error.message } };
    }
  }

  // Testler için fetch taklidi: uygulamanın isteklerini ağa çıkmadan bu servise yönlendirir.
  const fetch = async (url, init = {}) => {
    const { status, body } = await handle(new URL(url).pathname, init.body ? JSON.parse(init.body) : {});
    return new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });
  };

  return { activate, check, handle, fetch, admin, store };
}
