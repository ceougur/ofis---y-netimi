// PE kaynak dizininin üst düzey türlerini okur (3 ICON, 14 GROUP_ICON, 16 VERSION, 24 MANIFEST) + FileVersion metni.
import { readFileSync } from "node:fs";
for (const f of process.argv.slice(2)) {
  const b = readFileSync(f);
  const pe = b.readUInt32LE(0x3c); const nsec = b.readUInt16LE(pe + 6); const optSize = b.readUInt16LE(pe + 20);
  const opt = pe + 24; const magic = b.readUInt16LE(opt); const ddOff = opt + (magic === 0x20b ? 112 : 96);
  const rsrcRva = b.readUInt32LE(ddOff + 2 * 8);
  let secs = []; for (let i = 0; i < nsec; i++) { const s = opt + optSize + i * 40; secs.push({ name: b.toString("latin1", s, s + 8).replace(/\0.*$/, ""), va: b.readUInt32LE(s + 12), vs: b.readUInt32LE(s + 8), raw: b.readUInt32LE(s + 20) }); }
  const sec = secs.find(s => rsrcRva >= s.va && rsrcRva < s.va + Math.max(s.vs, 1));
  const types = [];
  if (sec) { const base = sec.raw + (rsrcRva - sec.va); const n = b.readUInt16LE(base + 12) + b.readUInt16LE(base + 14);
    for (let i = 0; i < n; i++) { const id = b.readUInt32LE(base + 16 + i * 8); types.push(id & 0x80000000 ? "ad" : id); } }
  const fv = /F\0i\0l\0e\0V\0e\0r\0s\0i\0o\0n\0\0\0(?:\0\0)?((?:[0-9.]\0)+)/.exec(b.toString("latin1"));
  console.log(`${f.split("/").pop()}: ${b.length} B · bölümler ${secs.map(s => s.name).join(",")} · kaynak türleri [${types.join(",")}] · ICON ${types.includes(3) ? "VAR" : "YOK"} · GROUP_ICON ${types.includes(14) ? "VAR" : "YOK"} · VERSION ${types.includes(16) ? "VAR" : "YOK"} · FileVersion ${fv ? fv[1].replace(/\0/g, "") : "?"}`);
}
