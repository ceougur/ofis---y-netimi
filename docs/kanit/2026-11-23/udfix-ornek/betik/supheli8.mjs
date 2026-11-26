// Tohum 8 düzeneği (saf ayırıcı): aynı gün önce eski kayıt Şüpheliden Çıkarıldı, sonra yeni kayıt (bakiyenin tamamı), sonra tahsilat.
// ROOT=<kod> node supheli8.mjs
import path from "node:path";
import { pathToFileURL } from "node:url";
const { allocateDoubtful } = await import(pathToFileURL(path.join(process.env.ROOT, "server/lib/doubtful-gl.mjs")).href);
const records = [
  { id: "ESKI", party: "C", date: "2026-09-20", amountMinor: 92456, status: "released", closedDate: "2026-09-26", seq: 1 },
  { id: "YENI", party: "C", date: "2026-09-26", amountMinor: 3384762, status: "open", closedDate: "", seq: 2 },
];
const credits = [{ key: "account:T", party: "C", date: "2026-09-26", minor: 2323609, at: "2026-11-23T06:30:00.000Z", seq: 9 }];
const { state } = allocateDoubtful({ records, provisions: [], credits });
for (const [id, s] of state) console.log(id, "kalan", s.remaining / 100, "tahsil", s.collected / 100, "çıkarılan", s.released / 100);
