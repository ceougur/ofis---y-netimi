// Gezinti yardımcısı: indirilen .xlsx'in ilk sayfasını satır satır yazar (paylaşılan dizgeler + satır içi dizgeler).
import { readFileSync } from "node:fs";
const { readZip } = await import(new URL("../../../../server/lib/zip.mjs", import.meta.url).href);
const files = new Map(readZip(readFileSync(process.argv[2])).map(e => [e.name, e.data.toString("utf8")]));
const shared = [...(files.get("xl/sharedStrings.xml") || "").matchAll(/<si>([\s\S]*?)<\/si>/g)].map(m => [...m[1].matchAll(/<t[^>]*>([\s\S]*?)<\/t>/g)].map(x => x[1]).join(""));
const sheet = files.get("xl/worksheets/sheet1.xml");
for (const row of sheet.matchAll(/<row [^>]*>([\s\S]*?)<\/row>/g)) {
  const cells = [...row[1].matchAll(/<c r="([A-Z]+)\d+"([^>]*)>([\s\S]*?)<\/c>/g)].map(([, col, attrs, body]) => {
    const t = /t="(\w+)"/.exec(attrs)?.[1];
    const v = /<v>([\s\S]*?)<\/v>/.exec(body)?.[1];
    const txt = t === "s" ? shared[Number(v)] : t === "inlineStr" ? [...body.matchAll(/<t[^>]*>([\s\S]*?)<\/t>/g)].map(x => x[1]).join("") : v;
    return `${col}=${txt}`;
  });
  console.log(cells.join(" | "));
}
