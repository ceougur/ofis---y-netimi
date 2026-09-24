// Bir uygulama sürümünü (app\<sürüm>) oluşturan dosyalar. Hem kurulum dosyası hem güncelleme paketi bunu kullanır;
// böylece ikisi her zaman aynı içeriği taşır.
import { readdirSync, statSync } from "node:fs";
import path from "node:path";

export const APP_ITEMS = Object.freeze(["server", "client", "docs/KURULUM-VE-KULLANIM.md", "package.json", "CHANGELOG.md", "README.md", "tools/backup.mjs"]);
const EXCLUDE = /(^|\/)(\.DS_Store|Thumbs\.db|desktop\.ini|.*\.log)$/i;

export function collectAppFiles(root, items = APP_ITEMS) {
  const files = [];
  const walk = relative => {
    const full = path.join(root, relative);
    const stats = statSync(full);
    if (stats.isDirectory()) {
      for (const name of readdirSync(full).sort()) walk(path.posix.join(relative, name));
    } else if (!EXCLUDE.test(relative)) files.push({ relative, full, mtime: stats.mtime, size: stats.size });
  };
  for (const item of items) walk(item);
  return files;
}
