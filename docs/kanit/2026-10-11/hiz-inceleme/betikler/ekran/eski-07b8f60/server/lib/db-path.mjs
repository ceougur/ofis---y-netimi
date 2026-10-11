// Veritabanı dosyasının adı. 1.6.0'dan itibaren yeni kurulumlar sektörden bağımsız "destekofis.sqlite" kullanır;
// önceki sürümlerden gelen kurulumlar eski adlı dosyalarıyla ("hukuk-ofisi.sqlite") çalışmaya devam eder — dosya
// taşınmaz, yeniden adlandırılmaz (servis, yedekler ve geri dönüş aynı dosyayı görmeli).
// Karar her kullanımda yeniden verilir: servis yöneticisi uygulamadan önce açıldığında dosya henüz yoksa bile
// uygulamayla aynı dosyayı bulur.
import { existsSync } from "node:fs";
import path from "node:path";

export const DB_FILE = "destekofis.sqlite";
export const LEGACY_DB_FILE = "hukuk-ofisi.sqlite";

export function resolveDbPath(dataDir) {
  const legacy = path.join(dataDir, LEGACY_DB_FILE);
  return existsSync(legacy) ? legacy : path.join(dataDir, DB_FILE);
}
