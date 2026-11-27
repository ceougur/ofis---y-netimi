// Ç2 tur 1 — madde 5 YENİDEN ÜRETİM (ders 6): ters kayıt ucunda nesne açıklama "[object Object]" olarak saklanıyor mu?
// Kullanım: HUKUK_LICENSE_URL=http://127.0.0.1:9 node r5-object-aciklama.mjs <depo kökü>
import path from "node:path";
import { pathToFileURL } from "node:url";

const ROOT = path.resolve(process.argv[2]);
const { startTestServer, loginAdmin } = await import(pathToFileURL(path.join(ROOT, "test/helpers.mjs")).href);
const server = await startTestServer({ now: { time: "2027-01-10T10:00:00+03:00", fixed: true } });
try {
  const admin = await loginAdmin(server);
  const V = server.app.ledger.vouchers;
  for (const [tag, description] of [["nesne", { x: 1 }], ["dizi", ["a", "b"]], ["mantıksal", true], ["metin", "Düzeltme"]]) {
    const voucher = V.post({ id: "r5", display_name: "R5" }, { type: "opening-match", date: "2027-01-05", requestKey: `r5-${tag}-asil-0001`, lines: [{ account: "590", debit: 100 }, { account: "519", credit: 100 }] });
    const res = await admin.post(`/api/admin/ledger/vouchers/${voucher.id}/reverse`, { requestId: `r5-${tag}-ters-000000001`, description });
    const stored = server.app.store.get("SELECT description FROM ledger_vouchers WHERE reversal_of = ?", voucher.id);
    console.log(`${tag}: HTTP ${res.status} ${res.data?.code || ""}; saklanan açıklama = ${JSON.stringify(stored?.description ?? null)}`);
  }
  // İç API: post'un açıklaması / satır notu / kaynak nesne gelirse
  for (const [field, patch] of [["description", { description: { a: 1 } }], ["source", { source: { a: 1 } }], ["note", { lines: [{ account: "590", debit: 100, note: { a: 1 } }, { account: "519", credit: 100 }] }]]) {
    try {
      const v = V.post({ id: "r5" }, { type: "opening-match", date: "2027-01-05", requestKey: `r5-ic-${field}-0001`, lines: [{ account: "590", debit: 100 }, { account: "519", credit: 100 }], ...patch });
      console.log(`iç API ${field}: KABUL — saklanan ${JSON.stringify(field === "note" ? v.lines[0].note : v[field])}`);
    } catch (error) {
      console.log(`iç API ${field}: RED ${error.status} ${error.extra?.code || ""}`);
    }
  }
} finally {
  await server.close();
}
