// Parola özetleme (scrypt + tuz). v1.0.0 ile aynı "tuz:özet" biçimi korunur.
import { randomBytes, scryptSync, timingSafeEqual } from "node:crypto";
import { DEFAULT_ADMIN_PASSWORD } from "./config.mjs";

export function hashPassword(password) {
  const salt = randomBytes(16).toString("hex");
  return `${salt}:${scryptSync(String(password), salt, 64).toString("hex")}`;
}

export function verifyPassword(password, stored) {
  const [salt, digest] = String(stored || "").split(":");
  if (!salt || !digest) return false;
  const actual = scryptSync(String(password), salt, 64);
  const expected = Buffer.from(digest, "hex");
  return expected.length === actual.length && timingSafeEqual(actual, expected);
}

// Kullanıcı yokken de aynı sürede yanıt vermek için sabit bir sahte özet.
export const DUMMY_HASH = hashPassword(randomBytes(12).toString("hex"));

export function passwordProblem(password, { username = "" } = {}) {
  const value = String(password || "");
  if (value.length < 10) return "Parola en az 10 karakter olmalı.";
  if (value.length > 200) return "Parola en fazla 200 karakter olabilir.";
  if (value === DEFAULT_ADMIN_PASSWORD) return "Varsayılan parola kullanılamaz.";
  if (username && value.toLocaleLowerCase("tr-TR") === String(username).toLocaleLowerCase("tr-TR")) return "Parola kullanıcı adıyla aynı olamaz.";
  if (!/[A-Za-zÇĞİÖŞÜçğıöşü]/.test(value) || !/\d/.test(value)) return "Parola en az bir harf ve bir rakam içermeli.";
  return null;
}
