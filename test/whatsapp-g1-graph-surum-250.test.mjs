// 2.5.0 G1 — Graph API sürümü TEK YERDEN (plan docs/erp/WHATSAPP-PAKETI-2.5.0-PLANI.md §1 G1: "v26 kaldırılmadan en az 6 ay önce geçilir"). 06.11.2026 okunan Meta takvimi
// (developers.facebook.com/docs/graph-api/changelog/versions): v26.0 29.07.2026'da çıktı, "Available Until: TBD" — bir sürüm, kendisinden SONRAKİ sürümün çıkışından iki yıl
// sonra kalkar (docs/graph-api/guides/versioning) → geçiş bu sürümde GEREKMEZ (ayrıntı ve kaynak: 2.5.0 iş listesi, G1 kaydı). Bu test geçişin bir günde, tek değişiklikle
// yapılabilmesini korur: program (server/lib/whatsapp/meta-graph.mjs GRAPH_VERSION) ve kapıcı (bulut/kapi/wa-bagla.mjs WA_BAGLA_D0.graphSurum — ayrı dağıtım birimi, Cloudflare
// Worker) AYNI sürümü kullanır; kaynakta başka yerde "vNN.N" Graph sürümü yazılmaz (yeni bir sabit ya da adrese gömülü sürüm testi kırar).
// Taban kodda da yeşildir (var olan değişmezin koruması); dişi mutasyonla gösterilir (kopyada ikinci sürüm yazılınca kırmızı — kanıt docs/kanit/2026-11-06/wkucuk-*).
import assert from "node:assert/strict";
import { readFileSync, readdirSync, statSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, it } from "node:test";
import { GRAPH_VERSION } from "../server/lib/whatsapp/meta-graph.mjs";
import { WA_BAGLA_D0 } from "../bulut/kapi/wa-bagla.mjs";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const walk = dir => readdirSync(dir).flatMap(name => {
  const full = path.join(dir, name);
  return statSync(full).isDirectory() ? walk(full) : [full];
});
// Sürüm sabitlerinin TEK tanım satırları (dosya → satırı tanıyan kalıp).
const DEFINITIONS = new Map([
  [path.join("server", "lib", "whatsapp", "meta-graph.mjs"), /^export const GRAPH_VERSION = "v\d+\.\d+";$/],
  [path.join("bulut", "kapi", "wa-bagla.mjs"), /^export const WA_BAGLA_D0 = Object\.freeze\(\{ graphSurum: "v\d+\.\d+",/],
]);
const LITERAL = /["'`/]v\d{1,2}\.\d+["'`/?]/;

describe("2.5.0 G1 — Graph API sürümü tek yerden (program + kapıcı)", () => {
  it("program ve kapıcı aynı Graph sürümünü kullanır; biçim vNN.0", () => {
    assert.match(GRAPH_VERSION, /^v\d+\.0$/);
    assert.equal(WA_BAGLA_D0.graphSurum, GRAPH_VERSION, "kapıcının kod değişimi (oauth/access_token) ve bağlama sayfasının FB.init sürümü programınkiyle aynı");
  });
  it("kaynakta (server/, bulut/, istemcinin WhatsApp dosyaları) başka yerde Graph sürümü yazılı değil", () => {
    const files = [...walk(path.join(ROOT, "server")), ...walk(path.join(ROOT, "bulut"))].filter(file => /\.(mjs|js)$/.test(file));
    files.push(...readdirSync(path.join(ROOT, "client", "assets")).filter(name => /^hof-whatsapp.*\.js$/.test(name)).map(name => path.join(ROOT, "client", "assets", name)));
    const extra = [];
    const seen = new Set();
    for (const file of files) {
      const rel = path.relative(ROOT, file);
      const lines = readFileSync(file, "utf8").split(/\r?\n/); // ders 27: Windows CRLF
      lines.forEach((line, index) => {
        if (!LITERAL.test(line)) return;
        const definition = DEFINITIONS.get(rel);
        if (definition?.test(line)) {
          seen.add(rel);
          return;
        }
        extra.push(`${rel}:${index + 1}: ${line.trim().slice(0, 160)}`);
      });
    }
    assert.deepEqual(extra, [], "Graph sürümü yalnız iki sabitte");
    assert.deepEqual([...seen].sort(), [...DEFINITIONS.keys()].sort(), "iki tanım satırı da bulundu");
  });
});
