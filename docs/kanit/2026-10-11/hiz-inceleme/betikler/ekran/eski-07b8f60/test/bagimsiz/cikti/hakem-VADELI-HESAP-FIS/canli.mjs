// Hakem (VADELI-HESAP-FIS): vadeli hesapta Banka Fişi türleri, verilen kod kökünde (HEAD ya da v2.0.26) programın GERÇEK HTTP API'siyle,
// koşucusuz.
//   node canli.mjs <kod-kökü>
// Beklenen değer hesaplamaz; yalnız programın döndürdüğünü (durum, kod, ileti, sonraki hesap bakiyesi) yazar.
//
// Vakalar:
//   P0  GET /api/workspace/bank/accounts (banka modülü var mı).
//   (banka modülü olan sürümde) V = vadeli TL hesap 50.000, D = vadesiz TL hesap 40.000 (karşı deney). Her hesaba:
//     fee (Yok ve BSMV Dahil), other_in, other_out, interest_out, interest_in (brüt 50 / %15); her yazımdan sonra hesap bakiyesi.
//   (banka modülü olmayan sürümde, ör. v2.0.26) POST /api/workspace/bank/vouchers ve Kasa'ya "bank" yolundan elle giriş/çıkış
//     (2.0.17 m9: Kasa yalnız nakit) — vadeli hesap ya da Banka Fişi kavramı var mı.
import path from "node:path";
import { pathToFileURL } from "node:url";

const root = path.resolve(process.argv[2]);
const { startTestServer, loginAdmin } = await import(pathToFileURL(path.join(root, "test", "helpers.mjs")).href);
const server = await startTestServer({ moneyStrict: false });
const admin = await loginAdmin(server);
const today = new Date().toISOString().slice(0, 10);
const out = { kok: root, bugun: today, vakalar: [] };
const body = r => (r.data && typeof r.data === "object" && "data" in r.data && r.data.ok !== undefined ? r.data.data : r.data);
const pick = r => {
  const d = r.data && typeof r.data === "object" ? r.data : {};
  return { durum: r.status, kod: r.status === 200 ? null : d.code ?? null, ileti: r.status === 200 ? null : d.error ?? d.message ?? null };
};

const probe = await admin.get("/api/workspace/bank/accounts");
out.bankaModulu = probe.status === 200;
out.vakalar.push({ ad: "P0 GET /api/workspace/bank/accounts", durum: probe.status });

if (out.bankaModulu) {
  const open = async (bankName, name, kind, amount) => {
    const r = await admin.post("/api/workspace/bank/accounts", { bankName, name, kind, currency: "TRY", opening: { date: today, amount, confirmed: false } });
    if (r.status !== 200) throw new Error("hesap: " + JSON.stringify(r.data));
    return body(r).id;
  };
  const accounts = { V: await open("Garanti BBVA", "Vadeli", "time", "50000"), D: await open("Ziraat Bankası", "Ana TL", "demand", "40000") };
  const balance = async id => {
    const b = body(await admin.get("/api/workspace/bank/accounts"));
    const rows = Array.isArray(b) ? b : b.accounts || b.rows || [];
    const row = rows.find(x => x.id === id);
    return row ? Object.fromEntries(Object.entries(row).filter(([k]) => /bal/i.test(k))) : null;
  };
  const types = [
    ["fee Yok 10", { type: "fee", amount: "10", feeType: "eft", tax: "none" }],
    ["fee BSMV Dahil 21", { type: "fee", amount: "21", feeType: "hesap-isletim", tax: "bsmv_incl" }],
    ["other_in 18,57", { type: "other_in", amount: "18,57" }],
    ["other_out 30", { type: "other_out", amount: "30" }],
    ["interest_out 40", { type: "interest_out", amount: "40", taxAmount: "0" }],
    ["interest_in brüt 50 / %15", { type: "interest_in", amount: "50", stoppageRate: "15" }],
  ];
  for (const [key, id] of Object.entries(accounts)) {
    out.vakalar.push({ ad: `${key} açılış`, bakiye: await balance(id) });
    for (const [label, voucher] of types) {
      const r = await admin.post("/api/workspace/bank/vouchers", { ...voucher, accountId: id, date: today });
      out.vakalar.push({ ad: `${key} ${label}`, ...pick(r), bakiyeSonra: await balance(id) });
    }
  }
} else {
  const v = await admin.post("/api/workspace/bank/vouchers", { type: "other_in", amount: "18,57", date: today });
  out.vakalar.push({ ad: "L0 POST /api/workspace/bank/vouchers (diğer gelir)", ...pick(v) });
  const kinds = await admin.get("/api/workspace/bank/accounts?kind=time");
  out.vakalar.push({ ad: "L1 GET /api/workspace/bank/accounts?kind=time", durum: kinds.status });
  for (const kind of ["in", "out"]) {
    const r = await admin.post("/api/workspace/cash", { kind, amount: 18.57, date: today, description: "Diğer Gelir/Gider", method: "bank" });
    out.vakalar.push({ ad: `L2 Kasa'ya 'bank' yolundan elle ${kind === "in" ? "giriş" : "çıkış"} 18,57`, ...pick(r) });
  }
}
await server.close();
process.stdout.write(JSON.stringify(out, null, 2) + "\n");
