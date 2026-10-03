// Sürüm verisi fikstürleri (2.0.21): eski sürümlerin GERÇEK koduyla üretilmiş veri ve yedek klasörlerinin depoya konan,
// sıkıştırılmış kopyası. CI'da (sığ klon, eski etiketler yok) testler bunları açar; üretim yolu tools/surum-verisi.mjs.
//
// Düzen: test/fixtures/surum-<ad>/fikstur.json (manifest + dosya listesi: göreli yol, sha256, boyut, değişme zamanı, yedek
// dosyasının beklenen sahibi) ve içerik deposu test/fixtures/surum-nesneler/<sha256>.br (Brotli; aynı içerik bir kez —
// zincirin kesitleri ortak yedekleri paylaşır). Açılan kopya bayt bayt üretilenle aynıdır (sha256 denetlenir).
import { brotliCompressSync, brotliDecompressSync, constants } from "node:zlib";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, statSync, utimesSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { createHash } from "node:crypto";
import { fileURLToPath } from "node:url";
import { BACKUP_NAME, companyFolderName, readBackupIdentity } from "../../server/lib/backup.mjs";

export const FIXTURES = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "fixtures");
export const STORE = path.join(FIXTURES, "surum-nesneler");
const sha = buffer => createHash("sha256").update(buffer).digest("hex");

function listFiles(root) {
  const out = [];
  const walk = dir => {
    if (!existsSync(dir)) return;
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) walk(full);
      // SQLite'ın paylaşımlı bellek dosyası (-shm) her açılışta yeniden kurulur; içerik taşımaz.
      else if (!entry.name.endsWith("-shm")) out.push(full);
    }
  };
  walk(root);
  return out.sort();
}

/**
 * Yedek dosyasının, ÜRETİLDİĞİ sürümün düzenine göre sahibi (şirket kimlikleri). 2.0.16: hepsi tek şirketin (001). 2.0.17–2.0.19:
 * kökteki dosyalar 001'in, sirket-<klasör>/ altındakiler veri klasörü <klasör> olan şirketin (çakışmalı kurulumda birden çok
 * şirket). 2.0.20 ve sonrası: dosyanın içindeki kimlik; kimliksizse bulunduğu "<kod> - <ad>" klasörünün şirketi. Silinmiş
 * şirketin dosyası: boş liste (hiçbir şirketin listesinde görünmemeli).
 */
export function expectedOwners({ version, registry, backupDir, file }) {
  const rel = path.relative(backupDir, file).split(path.sep);
  const companies = registry || [{ id: "sirket-001", code: "001", name: "", dir: "" }];
  const legacy = ["v2.0.16", "v2.0.17", "v2.0.18", "v2.0.19"].includes(version);
  if (rel.length === 1) return ["sirket-001"];
  const folder = rel[0];
  if (legacy) {
    const match = /^sirket-(.+)$/.exec(folder);
    return match ? companies.filter(item => item.dir && path.basename(item.dir) === match[1]).map(item => item.id) : [];
  }
  const identity = readBackupIdentity(file);
  if (identity) return companies.some(item => item.id === identity.id) ? [identity.id] : [];
  return companies.filter(item => (item.backupFolder ? path.basename(item.backupFolder) : companyFolderName(item)) === folder).map(item => item.id);
}

/** Kesiti fikstür olarak yazar: dosyalar içerik deposuna (Brotli), liste ve manifest fikstur.json'a. */
export function packFixture({ name, dataDir, backupDir, manifest, store = STORE, fixtures = FIXTURES }) {
  mkdirSync(store, { recursive: true });
  const dir = path.join(fixtures, name);
  rmSync(dir, { recursive: true, force: true });
  mkdirSync(dir, { recursive: true });
  const files = [];
  for (const [prefix, root] of [["veri", dataDir], ["yedek", backupDir]]) {
    for (const full of listFiles(root)) {
      const buffer = readFileSync(full);
      const digest = sha(buffer);
      const blob = path.join(store, `${digest}.br`);
      if (!existsSync(blob)) writeFileSync(blob, brotliCompressSync(buffer, { params: { [constants.BROTLI_PARAM_QUALITY]: 11, [constants.BROTLI_PARAM_LGWIN]: 24, [constants.BROTLI_PARAM_SIZE_HINT]: buffer.length } }));
      const stats = statSync(full);
      const item = { path: `${prefix}/${path.relative(root, full).split(path.sep).join("/")}`, sha256: digest, size: buffer.length, mtimeMs: Math.round(stats.mtimeMs) };
      if (prefix === "yedek" && BACKUP_NAME.test(path.basename(full))) item.owners = expectedOwners({ version: manifest.cut, registry: manifest.registry, backupDir, file: full });
      files.push(item);
    }
  }
  writeFileSync(path.join(dir, "fikstur.json"), `${JSON.stringify({ name, ...manifest, files }, null, 1)}\n`);
  return { dir, files: files.length, bytes: files.reduce((sum, item) => sum + item.size, 0) };
}

export const fixtureExists = name => existsSync(path.join(FIXTURES, name, "fikstur.json"));
export const readFixture = name => JSON.parse(readFileSync(path.join(FIXTURES, name, "fikstur.json"), "utf8"));

/**
 * Fikstürü geçici bir klasöre açar: { root, dataDir, backupDir, fixture, cleanup() }. Her dosyanın sha256'sı denetlenir,
 * değişme zamanı üretildiği ana döner.
 */
export function unpackFixture(name, { root = mkdtempSync(path.join(tmpdir(), `destekofis-${name}-`)), store = STORE } = {}) {
  const fixture = readFixture(name);
  const dataDir = path.join(root, "data");
  const backupDir = path.join(root, "backups");
  mkdirSync(dataDir, { recursive: true });
  mkdirSync(backupDir, { recursive: true });
  for (const item of fixture.files) {
    const buffer = brotliDecompressSync(readFileSync(path.join(store, `${item.sha256}.br`)));
    if (sha(buffer) !== item.sha256) throw new Error(`Fikstür dosyası bozuk: ${item.path}`);
    const [prefix, ...rest] = item.path.split("/");
    const target = path.join(prefix === "veri" ? dataDir : backupDir, ...rest);
    mkdirSync(path.dirname(target), { recursive: true });
    writeFileSync(target, buffer);
    utimesSync(target, item.mtimeMs / 1000, item.mtimeMs / 1000);
  }
  return { root, dataDir, backupDir, fixture, cleanup: () => rmSync(root, { recursive: true, force: true }) };
}
