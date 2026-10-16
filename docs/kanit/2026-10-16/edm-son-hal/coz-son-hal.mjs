import { readFileSync, readdirSync } from "node:fs";
import { execFileSync } from "node:child_process";
const R = "/home/user/ofis---y-netimi";
const jsQR = (await import(`${R}/node_modules/jsqr/dist/jsQR.js`)).default;
const D = process.argv[2];
for (const f of readdirSync(D).filter(n => n.endsWith("-resmi.pdf")).sort()) {
  const base = `${D}/${f.replace(".pdf", "")}-qr`;
  execFileSync("pdftoppm", ["-r", "200", "-gray", "-f", "1", "-l", "1", `${D}/${f}`, base]);
  const file = readFileSync(`${base}-1.pgm`);
  const header = file.toString("latin1", 0, 64).split(/\s+/);
  const width = Number(header[1]), height = Number(header[2]);
  const start = file.length - width * height;
  const rgba = new Uint8ClampedArray(width * height * 4);
  for (let i = 0; i < width * height; i++) { const v = file[start + i]; rgba[i * 4] = rgba[i * 4 + 1] = rgba[i * 4 + 2] = v; rgba[i * 4 + 3] = 255; }
  const found = jsQR(rgba, width, height);
  console.log(f, found ? found.data : "KAREKOD OKUNAMADI");
}
