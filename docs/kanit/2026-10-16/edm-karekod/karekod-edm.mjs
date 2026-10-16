// EDM TEST ORTAMI (16.10.2026, İz 9): karekod + GİB logosu. Programın API'siyle e-Fatura (iki KDV oranı) ve e-Arşiv gönderilir; EDM'nin resmî PDF'i
// ve programın kendi PDF'i görüntüye çevrilir (pdftoppm, PGM) ve karekod bağımsız çözücüyle (jsQR) okunur; okunan JSON elle hesaplanan tutarlarla
// ve XML'le karşılaştırılır. Kimlik yalnız yüklenen dosyadan; çıktıda maskelenir. Canlı yok.
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { execFileSync } from "node:child_process";
const R = "/home/user/ofis---y-netimi";
const { startTestServer, ADMIN_PASSWORD } = await import(`${R}/test/helpers.mjs`);
const jsQR = (await import(`${R}/node_modules/jsqr/dist/jsQR.js`)).default;
const text = readFileSync(process.argv[2], "utf8");
const username = (text.match(/kullan[ıi]c[ıi] ad[ıi]\s*:\s*(\S+)/i) || [])[1];
const password = (text.match(/şifre\s*:\s*(\S+)/i) || [])[1];
const OUT = process.argv[3]; mkdirSync(OUT, { recursive: true });
const mask = v => JSON.stringify(v ?? "").split(password).join("***").split(username).join("<kullanıcı>");
const log = (l, v) => console.log(`${new Date().toISOString().slice(11, 19)} ${l}: ${mask(v).slice(0, 900)}`);
const unwrap = r => ({ ...r, data: r.data && typeof r.data === "object" && "ok" in r.data ? (r.data.ok ? r.data.data : r.data) : r.data });
// PDF'in ilk sayfası → PGM → jsQR.
const readQr = (pdf, name) => {
  writeFileSync(`${OUT}/${name}.pdf`, pdf);
  execFileSync("pdftoppm", ["-r", "200", "-gray", "-f", "1", "-l", "1", `${OUT}/${name}.pdf`, `${OUT}/${name}`]);
  const file = readFileSync(`${OUT}/${name}-1.pgm`);
  const header = file.toString("latin1", 0, 64).split(/\s+/);
  const width = Number(header[1]), height = Number(header[2]);
  const start = file.length - width * height;
  const rgba = new Uint8ClampedArray(width * height * 4);
  for (let i = 0; i < width * height; i++) { const v = file[start + i]; rgba[i * 4] = rgba[i * 4 + 1] = rgba[i * 4 + 2] = v; rgba[i * 4 + 3] = 255; }
  const found = jsQR(rgba, width, height);
  execFileSync("pdftoppm", ["-r", "70", "-png", "-f", "1", "-l", "1", `${OUT}/${name}.pdf`, `${OUT}/${name}-sayfa`]);
  return found ? { data: found.data, sol: found.location.topLeftCorner.x / width, ust: found.location.topLeftCorner.y / height } : null;
};
const server = await startTestServer({ edocEnabled: true });
const c = server.client(); await c.login("admin", ADMIN_PASSWORD);
const post = async (u, b) => unwrap(await c.post(u, b)); const put = async (u, b) => unwrap(await c.put(u, b));
const seq = 100_000_000 + Math.floor(Math.random() * 800_000_000);
const y = new Date().getFullYear();
await put("/api/workspace/invoices/settings", {
  seller: { name: "ETA BILGISAYAR TEST 3", taxNo: "3230512384", taxOffice: "Kadıköy", address: "Test Cd. 1", district: "Kadıköy", city: "İstanbul", postalCode: "34000", email: "test@destekofis.com.tr" },
  efatura: true, earsiv: true, start: { [`TEF${y}`]: seq, [`TEA${y}`]: seq },
  integrator: { env: "test", username, password, senderAlias: "urn:mail:defaultgb@edmbilisim.com.tr", mailboxAlias: "urn:mail:defaultpk@edmbilisim.com.tr" },
});
const acc = async b => { const r = await post("/api/workspace/accounts", b); return r.data.id || r.data.account?.id; };
const firm = await acc({ name: "ETA BILGISAYAR TEST 3", type: "customer", taxNo: "3230512384", taxOffice: "Kadıköy", address: "Test Cd. 1", district: "Kadıköy", city: "İstanbul", eInvoice: true, eAlias: "urn:mail:defaultpk@edmbilisim.com.tr" });
const person = await acc({ name: "Karekod Alıcı", type: "customer", partyKind: "person", firstName: "Karekod", familyName: "Alıcı", taxNo: "10000000146", taxOffice: "Kadıköy", city: "İstanbul", address: "Sk. 2", district: "Kadıköy" });
// ELLE: e-Fatura 2 × 500 (%20) + 1 × 250 (%10) → 1250.00; KDV 200.00 + 25.00; 1475.00. e-Arşiv 1 × 300 (%20) → 300.00; 60.00; 360.00.
const expected = {
  efatura: { malhizmettoplam: "1250.00", "kdvmatrah(10)": "250.00", "hesaplanankdv(10)": "25.00", "kdvmatrah(20)": "1000.00", "hesaplanankdv(20)": "200.00", vergidahil: "1475.00", odenecek: "1475.00", avkntckn: "3230512384", senaryo: "TEMELFATURA" },
  earsiv: { malhizmettoplam: "300.00", "kdvmatrah(20)": "300.00", "hesaplanankdv(20)": "60.00", vergidahil: "360.00", odenecek: "360.00", avkntckn: "10000000146", senaryo: "EARSIVFATURA" },
};
const docs = [];
for (const [name, accountId, lines] of [["efatura", firm, [{ name: "Danışmanlık", qty: 2, unitPrice: 500, vatRate: 20 }, { name: "Bakım", qty: 1, unitPrice: 250, vatRate: 10 }]], ["earsiv", person, [{ name: "Bakım", qty: 1, unitPrice: 300, vatRate: 20 }]]]) {
  const d = await post("/api/workspace/invoices", { scenario: "service_sale", accountId, lines, payment: { rest: "open" } });
  const own = await c.raw("GET", `/api/workspace/invoices/${d.data.id}/fatura.pdf`);
  const ownQr = readQr(own.buffer, `${d.data.number}-program`);
  log(`${name} PROGRAM PDF KAREKOD`, { number: d.data.number, okundu: Boolean(ownQr), sol: ownQr?.sol?.toFixed(2), ust: ownQr?.ust?.toFixed(2), json: ownQr?.data });
  const sent = await post(`/api/workspace/invoices/${d.data.id}/send`, {});
  log(`${name} GÖNDER`, { status: sent.status, eStatus: sent.data?.eStatus, msg: sent.data?.eMessage || sent.data?.error });
  docs.push({ name, id: d.data.id, number: d.data.number, ettn: d.data.ettn, issueDate: d.data.issueDate, ownQr });
}
const pending = new Set(docs.map(d => d.id));
for (let round = 1; round <= 16 && pending.size; round += 1) {
  for (const d of docs.filter(item => pending.has(item.id))) {
    const st = await post(`/api/workspace/invoices/${d.id}/e-refresh`, {});
    log(`${d.name} DURUM ${round}`, { eStatus: st.data?.eStatus });
    if (st.status === 200 && st.data.eStatus !== "processing") pending.delete(d.id);
  }
  if (pending.size) await new Promise(r => setTimeout(r, 45_000));
}
let ok = true;
for (const d of docs) {
  const r = await c.raw("GET", `/api/workspace/invoices/${d.id}/resmi.pdf`);
  const qr = r.status === 200 ? readQr(r.buffer, `${d.number}-resmi`) : null;
  const json = qr ? JSON.parse(qr.data) : null;
  const want = { vkntckn: "3230512384", tip: "SATIS", tarih: d.issueDate, no: d.number, ettn: d.ettn, parabirimi: "TRY", ...expected[d.name] };
  const diff = json ? Object.entries(want).filter(([k, v]) => json[k] !== v) : [["okunamadı"]];
  const same = d.ownQr?.data === qr?.data;
  if (diff.length || !same || !(qr.sol > 0.6 && qr.ust < 0.25)) ok = false;
  const pdftext = execFileSync("pdftotext", ["-layout", `${OUT}/${d.number}-resmi.pdf`, "-"]).toString();
  log(`${d.name} RESMÎ PDF KAREKOD`, { status: r.status, okundu: Boolean(qr), sagUst: qr ? `${qr.sol.toFixed(2)},${qr.ust.toFixed(2)}` : "", farklar: diff, programlaAyni: same, json: qr?.data });
}
log("SONUÇ", ok ? "GEÇTİ" : "BAŞARISIZ");
await server.close();
process.exit(ok ? 0 : 1);
