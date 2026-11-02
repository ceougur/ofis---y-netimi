// Ders 20 / 22 zorla üretme ön yüklemesi (`node --import`): sürecin saati yerel gece yarısına SUREC_SAATI_SN saniye kala başlar ve akar
// (varsayılan 5). Çıkışta dış saatin günü başta ve sonda yazılır: ön koşul (koşu gece yarısını geçti) gerçekleşti mi okunur.
import { installProcessClock } from "./surec-saati.mjs";

const lead = Number(process.env.SUREC_SAATI_SN || 5) * 1000;
const d = new Date();
const start = new Date(d.getFullYear(), d.getMonth(), d.getDate() + 1, 0, 0, 0, 0).getTime() - lead;
const clock = installProcessClock(start);
const first = clock.today();
process.on("exit", () => {
  const last = clock.today();
  process.stdout.write(`\n[dış saat] başlangıç günü ${first} → bitiş günü ${last}: ön koşul ${first !== last ? "GERÇEKLEŞTİ" : "GERÇEKLEŞMEDİ"}\n`);
});
