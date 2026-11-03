// B1 mutasyonları (tasarım notu §7): node mutasyon.mjs <kopya kökü> <m1|m2|m3|m4> — server/app.mjs'te tek değişiklik; değişmezse çıkış 2.
import { readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
const [root, name] = process.argv.slice(2);
const file = path.join(root, "server", "app.mjs");
const text = readFileSync(file, "utf8");
const MUTATIONS = {
  m1: ["  undo.push(() => db.close());\n", ""],
  m2: ["    rollbackOpen(opening, error);\n    throw error;\n", "    rollbackOpen(opening, error);\n    throw new Error(\"mutasyon m2: asıl hata yerine başka hata\");\n"],
  m3: ["    undo.push(() => whatsapp.scheduler.unregister(companyId)); // yalnız bu örnek kaydettiyse (kayıttan hemen sonra)\n", ""],
  m4: ["  undo.push(() => dataset.stop());\n", ""],
};
const [from, to] = MUTATIONS[name] || [];
if (!from || text.split(from).length !== 2) {
  console.error(`mutasyon ${name}: kalıp tam bir kez bulunamadı`);
  process.exit(2);
}
writeFileSync(file, text.replace(from, to));
console.log(`mutasyon ${name} uygulandı: ${file}`);
