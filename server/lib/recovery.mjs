// Yönetici parolası kurtarma (v2.0.10): üyeliksiz, ücretsiz, internetsiz.
//
// 1) Kurtarma anahtarı: yönetici Yönetim → Kullanıcılar'da oluşturur, yazdırıp saklar. 20 karakter (100 bit), programda
//    yalnız özeti (scrypt) tutulur. Giriş ekranında "Yönetici parolamı unuttum" → anahtar + yeni parola. Kullanılınca
//    geçersiz olur ve hemen yenisi üretilir (yeni anahtar o ekranda bir kez gösterilir).
// 2) Sunucu kodu (anahtar da kaybolduysa): yalnız programın kurulu olduğu bilgisayardan istenir (localhost). Program
//    veri klasörüne 10 dakika geçerli, tek kullanımlık bir kod yazar; Windows'ta dosyayı yalnız Windows yöneticileri ve
//    sistem okuyabilir (aynı bilgisayarı kullanan personel okuyamaz). Kanıt: sunucu bilgisayarında Windows yöneticiliği.
// İki yolda da eski parola sorulmaz; yalnız parola değişir (kayıtlar, kullanıcılar, lisans olduğu gibi kalır).
import { execFileSync } from "node:child_process";
import { randomBytes } from "node:crypto";
import { existsSync, rmSync, writeFileSync } from "node:fs";
import path from "node:path";
import { hashPassword, verifyPassword } from "./passwords.mjs";

const ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // 32 harf: 0/O ve 1/I karışmaz; 256'yı böldüğü için eğilimsiz
const SETTING = "auth.recovery";
const LOCAL_MINUTES = 10;
export const LOCAL_FILE = "YONETICI-KURTARMA-KODU.txt";

const makeCode = length => [...randomBytes(length)].map(byte => ALPHABET[byte % ALPHABET.length]).join("");
export const normalizeCode = value => String(value || "").toLocaleUpperCase("en-US").replace(/[^A-Z0-9]/g, "");
const grouped = (code, size) => code.match(new RegExp(`.{1,${size}}`, "g")).join("-");

export function createRecovery({ store, dataDir, log = null, clock = () => Date.now(), platform = process.platform }) {
  const read = () => {
    try {
      const value = JSON.parse(store.setting(SETTING, "") || "null");
      return value && typeof value.hash === "string" ? value : null;
    } catch {
      return null;
    }
  };
  let local = null; // { hash, expiresAt } — yalnız bellekte; sunucu yeniden başlarsa kod geçersizleşir
  const localFile = path.join(dataDir, LOCAL_FILE);

  function status() {
    const current = read();
    if (!current) return { exists: false };
    const by = current.createdBy ? store.get("SELECT display_name AS name FROM users WHERE id = ?", current.createdBy)?.name || "" : "";
    return { exists: true, createdAt: current.createdAt, createdByName: by };
  }

  // Yeni anahtar: eskisi hemen geçersiz olur. Düz metin yalnız bu yanıtta döner, hiçbir yere yazılmaz.
  function createKey(actor = null) {
    const code = makeCode(20);
    store.setSetting(SETTING, JSON.stringify({ hash: hashPassword(code), createdAt: new Date(clock()).toISOString(), createdBy: actor?.id || "" }), actor?.id || null);
    return grouped(code, 5);
  }

  // Windows: dosya yalnız Yöneticiler (S-1-5-32-544) ve SYSTEM (S-1-5-18) için okunur; dil ayarından bağımsız SID'ler.
  function restrict(file) {
    if (platform !== "win32") return true;
    try {
      execFileSync("icacls", [file, "/inheritance:r", "/grant:r", "*S-1-5-32-544:F", "*S-1-5-18:F"], { stdio: "ignore", windowsHide: true });
      return true;
    } catch (error) {
      log?.warn?.(`Kurtarma kodu dosyasının izinleri kısıtlanamadı: ${error.message}`);
      return false;
    }
  }
  function createLocalCode() {
    const code = makeCode(10);
    const expiresAt = clock() + LOCAL_MINUTES * 60_000;
    local = { hash: hashPassword(code), expiresAt };
    const until = new Date(expiresAt);
    const text = [
      "DestekOfis — yönetici parolası kurtarma kodu",
      "",
      `Kod: ${grouped(code, 5)}`,
      `Geçerlilik: ${String(until.getHours()).padStart(2, "0")}:${String(until.getMinutes()).padStart(2, "0")}'e kadar (${LOCAL_MINUTES} dakika), tek kullanımlık.`,
      "",
      "Giriş ekranında \"Yönetici parolamı unuttum\" bölümüne bu kodu ve yeni parolanızı yazın.",
      "Kodu siz istemediyseniz bu dosyayı silin; kod 10 dakika sonra kendiliğinden geçersiz olur.",
      "",
    ].join("\r\n");
    // Önce boş dosya ve kısıtlı izin, sonra içerik: kod hiçbir an herkesin okuyabileceği bir dosyada durmaz.
    writeFileSync(localFile, "");
    const restricted = restrict(localFile);
    writeFileSync(localFile, `﻿${text}`);
    return { file: localFile, minutes: LOCAL_MINUTES, restricted };
  }
  const clearLocal = () => {
    local = null;
    try {
      if (existsSync(localFile)) rmSync(localFile, { force: true });
    } catch {
      // dosya silinemezse kod zaten geçersiz
    }
  };

  // Kodun türü: "key" (kurtarma anahtarı) | "local" (sunucu kodu) | null.
  function match(value) {
    const code = normalizeCode(value);
    if (!code) return null;
    if (local && clock() > local.expiresAt) clearLocal();
    if (local && code.length === 10 && verifyPassword(code, local.hash)) return "local";
    const current = read();
    if (current && code.length === 20 && verifyPassword(code, current.hash)) return "key";
    return null;
  }
  // Kullanılan kod geçersizleşir. Anahtar kullanıldıysa yenisi üretilir ve döner (kurtarma ekranında gösterilir).
  function consume(kind, actor) {
    if (kind === "local") {
      clearLocal();
      return null;
    }
    return createKey(actor);
  }
  return { status, createKey, createLocalCode, match, consume, localFile };
}
