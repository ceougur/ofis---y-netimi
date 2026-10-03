// Drive'a yedek (v2.0.2). Her yedek yerel yedek klasörüne alındıktan sonra bir de kullanıcının bağladığı yere kopyalanır.
// İki bağlama yolu:
//   klasör  — Google Drive / OneDrive / Dropbox masaüstü uygulamasının senkron klasörü (ör. "G:\Drive'ım\Yedekler" ya da
//             "C:\Users\Ali\Google Drive\DestekOfis"): program içinde "DestekOfis Yedekleri" klasörünü açar, her yedeği
//             oraya kopyalar; masaüstü uygulaması buluta taşır. İnternet ya da hesap bilgisi gerekmez.
//   bağlantı— Google Drive klasör bağlantısı (https://drive.google.com/drive/folders/<id>): yükleme lisans servisi
//             üzerinden yapılır (servis, DestekOfis'in hizmet hesabıyla klasöre yazar; kullanıcı klasörü "bağlantıya
//             sahip herkes düzenleyebilir" yapar). Servis "yedek/oturum" ucu verilmemişse durum ekranda yazar; yerel
//             yedek her durumda alınır. Sır programda tutulmaz (docs/DRIVE-YEDEK.md).
// İlkeler: kopya başarısız olsa da yerel yedek asla engellenmez; hata durumu ayarda saklanır ve yönetim panelinde
// görünür; aynı yedek iki kez yüklenmez (ad + boyut kaydı); en fazla `keep` kopya tutulur (klasör yolunda).
import { copyFileSync, existsSync, mkdirSync, readdirSync, statSync, unlinkSync, createReadStream } from "node:fs";
import path from "node:path";

export const CLOUD_KEY = "backup.cloud";
const FOLDER_NAME = "DestekOfis Yedekleri";
const DRIVE_LINK = /drive\.google\.com\/(?:drive\/(?:u\/\d+\/)?folders\/|open\?id=)([A-Za-z0-9_-]{10,})/;
// Şirket yedek klasörü adı ("001" ya da "001 - Şirket 1"; backup.mjs companyFolderName). Yol ayıracı içeremez.
const COMPANY_FOLDER = /^\d{3}(?: - [^\\/]+)?$/;

/** Kullanıcının yapıştırdığı metni sınıflandırır: { mode: "folder"|"link", folderId?, path? } ya da null. */
export function parseTarget(text) {
  const value = String(text || "").trim();
  if (!value) return null;
  const link = DRIVE_LINK.exec(value);
  if (link) return { mode: "link", folderId: link[1], value };
  if (/^(?:[A-Za-z]:[\\/]|\\\\|\/)/.test(value)) return { mode: "folder", path: value.replace(/[\\/]+$/, ""), value };
  return null;
}

export function createCloudBackup({ store, log = null, fetchImpl = globalThis.fetch, license = null, services = [], keep = 30, now = () => new Date() }) {
  const read = () => {
    try {
      const value = JSON.parse(store.setting(CLOUD_KEY, "") || "null");
      return value && typeof value === "object" ? value : null;
    } catch {
      return null;
    }
  };
  const write = (value, by = null) => store.setSetting(CLOUD_KEY, value ? JSON.stringify(value) : "", by);

  /** Bağlantıyı/klasörü kaydeder ve hemen doğrular (klasör açılabiliyor mu). */
  function configure(user, text) {
    const target = parseTarget(text);
    if (!text || !String(text).trim()) {
      write(null, user?.id);
      return { enabled: false };
    }
    if (!target) throw Object.assign(new Error("Bir Google Drive klasör bağlantısı (https://drive.google.com/drive/folders/…) ya da bilgisayarınızdaki Drive/OneDrive klasörünün yolu (ör. G:\\Drive'ım\\Yedekler) yapıştırın."), { status: 400 });
    const state = { enabled: true, mode: target.mode, value: target.value, folderId: target.folderId || null, path: target.path || null, configuredBy: user?.id || null, configuredAt: now().toISOString(), lastAt: null, lastError: null, lastName: null, copies: 0 };
    if (target.mode === "folder") {
      const dir = path.join(target.path, FOLDER_NAME);
      try {
        mkdirSync(dir, { recursive: true });
        state.resolvedPath = dir;
      } catch (error) {
        throw Object.assign(new Error(`Klasör açılamadı: ${target.path} (${error.code || error.message}). Yolu kontrol edin; Drive masaüstü uygulaması kuruluysa klasör bilgisayarınızda görünür olmalı.`), { status: 400 });
      }
    }
    write(state, user?.id);
    return status();
  }

  /** Yerel yedek dosyasını hedefe kopyalar/yükler. Asla fırlatmaz; durumu ayara yazar. */
  async function mirror(file) {
    const state = read();
    if (!state?.enabled || !file?.path) return { skipped: true };
    const name = path.basename(file.path);
    if (state.lastName === name && !state.lastError) return { skipped: true, reason: "already" };
    try {
      if (state.mode === "folder") {
        // v2.0.20: her şirketin kopyası kendi klasörüne ("DestekOfis Yedekleri/001 - Şirket 1/"), yereldeki düzenle aynı;
        // eski budama klasör başına yapılır, bir şirketin sık yedeği öbürününkini silmez.
        const base = state.resolvedPath || path.join(state.path, FOLDER_NAME);
        const dir = COMPANY_FOLDER.test(String(file.folder || "")) ? path.join(base, file.folder) : base;
        mkdirSync(dir, { recursive: true });
        copyFileSync(file.path, path.join(dir, name));
        prune(dir);
      } else {
        await uploadViaService(state, file, name);
      }
      write({ ...state, lastAt: now().toISOString(), lastError: null, lastName: name, copies: (state.copies || 0) + 1 });
      log?.info?.(`Yedek Drive'a da kopyalandı: ${name}`);
      return { ok: true, name };
    } catch (error) {
      write({ ...state, lastError: error.message, lastErrorAt: now().toISOString() });
      log?.warn?.(`Yedek Drive'a kopyalanamadı: ${error.message}`);
      return { ok: false, error: error.message };
    }
  }

  function prune(dir) {
    const files = readdirSync(dir)
      .filter(name => /\.(sqlite|db|bak|zip)$/i.test(name))
      .map(name => ({ name, at: statSync(path.join(dir, name)).mtimeMs }))
      .sort((a, b) => b.at - a.at);
    for (const item of files.slice(keep)) {
      try {
        unlinkSync(path.join(dir, item.name));
      } catch {
        // silinemeyen eski kopya kalır
      }
    }
  }

  // Lisans servisi: yükleme oturumu (Google resumable upload URL) ister, dosyayı doğrudan Google'a PUT eder.
  async function uploadViaService(state, file, name) {
    const key = license?.summary?.()?.licenseKey || license?.licenseKey?.() || "";
    const size = statSync(file.path).size;
    let session = null;
    let lastError = null;
    for (const base of services) {
      try {
        const response = await fetchImpl(`${base.replace(/\/$/, "")}/v1/yedek/oturum`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ licenseKey: key, folderId: state.folderId, name, size, mime: "application/octet-stream" }), signal: AbortSignal.timeout(20_000) });
        if (response.status === 404) throw new Error("Drive yükleme servisi bu sürümde etkin değil; Drive masaüstü klasör yolunu kullanın.");
        const payload = await response.json().catch(() => ({}));
        if (!response.ok || !payload.uploadUrl) throw new Error(payload.error || `Yükleme oturumu alınamadı (${response.status}).`);
        session = payload;
        break;
      } catch (error) {
        lastError = error;
      }
    }
    if (!session) throw lastError || new Error("Yükleme servisi yanıt vermedi.");
    const put = await fetchImpl(session.uploadUrl, { method: "PUT", headers: { "content-length": String(size), "content-type": "application/octet-stream" }, body: createReadStream(file.path), duplex: "half", signal: AbortSignal.timeout(10 * 60_000) });
    if (!put.ok) throw new Error(`Drive yüklemesi başarısız (${put.status}).`);
  }

  function status() {
    const state = read();
    if (!state?.enabled) return { enabled: false };
    return { enabled: true, mode: state.mode, value: state.value, folderId: state.folderId, path: state.resolvedPath || null, lastAt: state.lastAt, lastError: state.lastError, lastErrorAt: state.lastErrorAt || null, lastName: state.lastName, copies: state.copies || 0, configuredAt: state.configuredAt };
  }

  return { configure, mirror, status, parseTarget, folderName: FOLDER_NAME };
}
