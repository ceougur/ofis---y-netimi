// Geçici: dayanıklılık B sonrası kurtarma (yeniden gönder + eksik resmî PDF + karekod yeniden çözüm). Depoya girmez.
import { writeFileSync, readFileSync, rmSync, mkdirSync } from "node:fs";
import { execFileSync } from "node:child_process";
import path from "node:path";
const R = "/home/user/ofis---y-netimi";
const [WORK, OUT] = process.argv.slice(2);
const { createClient, ADMIN_PASSWORD } = await import(`${R}/test/helpers.mjs`);
const { createApp } = await import(`${R}/server/app.mjs`);
const jsQR = (await import(`${R}/node_modules/jsqr/dist/jsQR.js`)).default;
const app = createApp({ dataDir: path.join(WORK, "data"), backupDir: path.join(WORK, "backups"), logLevel: "silent", scheduleBackups: false,
  env: { HUKUK_ADMIN_PASSWORD: ADMIN_PASSWORD, HUKUK_DATASET_AUTOSYNC: "0", HUKUK_LICENSE_URL: "http://127.0.0.1:9" },
  license: { enforce: false, machineId: "0123456789abcdef0123456789abcdef" }, startLicenseTimers: false,
  edocEnabled: true, edocLive: true, moneyStrict: true, gateVerify: true, reportWorker: false });
const a = await app.listen(0, "127.0.0.1");
const base = `http://127.0.0.1:${a.port}`;
const api = createClient(base); await api.login("admin", ADMIN_PASSWORD);
const comps = (await api.get("/api/companies")).data; const list = comps.data?.companies || comps.companies || comps.data || comps;
const idOf = code => list.find(c => c.code === code).id;
const sel = async code => { const r = await api.post("/api/companies/select", { id: idOf(code) }); if (r.status !== 200) throw new Error("select " + JSON.stringify(r.data)); };
const rowOf = async id => { const r = await api.get(`/api/workspace/invoices/${id}`); const d = r.data?.data || r.data; const inv = d.invoice || d; return { status: inv.status, e: inv.e?.status || inv.eStatus, msg: inv.e?.message || inv.eMessage }; };
const getPdf = async (id, file) => { const r = await fetch(`${base}/api/workspace/invoices/${id}/resmi.pdf`, { headers: api.headers ? api.headers() : {} }); return r; };
const decode = pdf => { for (const dpi of [150, 220, 300, 400]) { const b = path.join(OUT, `qr-${dpi}`); execFileSync("pdftoppm", ["-r", String(dpi), "-gray", "-f", "1", "-l", "1", "-singlefile", pdf, b]); const f = readFileSync(`${b}.pgm`); rmSync(`${b}.pgm`); const h = f.toString("latin1", 0, 64).split(/\s+/); const w = +h[1], ht = +h[2], s = f.length - w * ht; const px = new Uint8ClampedArray(w * ht * 4); for (let i = 0; i < w * ht; i++) { px[i*4]=px[i*4+1]=px[i*4+2]=f[s+i]; px[i*4+3]=255; } const q = jsQR(px, w, ht); if (q?.data) return { dpi, json: JSON.parse(q.data) }; } return { error: "okunamadı" }; };
mkdirSync(OUT, { recursive: true });
const sonuc = {};
const out = (k, v) => { sonuc[k] = v; console.log(k, JSON.stringify(v)); };
// 1) TEF2026393757760: EDM geçici 11059 sonrası yeniden gönder (kartın "e-Belge Gönder" düğmesinin çağırdığı uç)
await sel("001");
const id760 = "invoice-c25fc1f8-12fc-4cb4-bf5b-3bb9381720b7";
out("760-once", await rowOf(id760));
const s = await api.post(`/api/workspace/invoices/${id760}/send`, {}); out("760-gonder", { status: s.status, data: JSON.stringify(s.data).slice(0, 300) });
for (let i = 0; i < 40; i++) { const r = await rowOf(id760); if (["sent", "accepted", "rejected", "error"].includes(r.e) && i > 0) break; await new Promise(z => setTimeout(z, 15000)); await api.post(`/api/workspace/invoices/${id760}/e-refresh`, {}); }
out("760-sonra", await rowOf(id760));
const docs = [["001", id760, "TEF2026393757760"], ["002", "invoice-478f62a5-d6af-4ea2-8f06-d8dd2fae759b", "TEF2026394257817"], ["002", "invoice-3e1b833a-e76e-4b37-83b4-c89cc15422e2", "TEF2026394257812"]];
for (const [code, id, no] of docs) {
  await sel(code);
  const r = await api.raw("GET", `/api/workspace/invoices/${id}/resmi.pdf`);
  if (r && r.status === 200) { const f = path.join(OUT, `${no}.pdf`); writeFileSync(f, r.buffer); out(`${no}-pdf`, { status: 200, bayt: r.buffer.length, karekod: decode(f) }); }
  else out(`${no}-pdf`, { status: r?.status, ileti: r?.buffer?.toString("utf8").slice(0, 200) });
}
writeFileSync(path.join(OUT, "sonuc.json"), JSON.stringify(sonuc, null, 2));
await app.close?.(); process.exit(0);
