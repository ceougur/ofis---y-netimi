// Yük testi ÖNCE ↔ SONRA tablosu (hız düzeltmesi, 11.10.2026): tools/olcek-210.mjs JSON çıktılarından (duzeyler[]) kullanıcı düzeyi başına
// istek türlerinin p50 / p95 / en çok süresi, olay döngüsü ve ekran ölçümleri. Bir düzey dosyalardan birinde yoksa "—".
// Kullanım: node docs/kanit/2026-10-11/hiz-duzeltme/yuk-karsilastir.mjs --once <json> [--once <json> …] --sonra <json>
import { readFileSync } from "node:fs";

const argv = process.argv.slice(2);
const files = flag => argv.flatMap((value, i) => (argv[i - 1] === flag ? [value] : []));
const levels = list => {
  const map = new Map();
  for (const file of list) for (const level of JSON.parse(readFileSync(file, "utf8")).duzeyler || []) map.set(level.kullanici, level);
  return map;
};
const once = levels(files("--once"));
const sonra = levels(files("--sonra"));
const cell = (stat, key) => (stat && stat[key] != null ? String(stat[key]) : "—");
const triple = stat => (stat ? `${cell(stat, "p50")} / ${cell(stat, "p95")} / ${cell(stat, "enCok")}` : "—");
const out = [];
for (const users of [...new Set([...sonra.keys()])].sort((a, b) => a - b)) {
  const a = once.get(users);
  const b = sonra.get(users);
  out.push(`### ${users} eşzamanlı kullanıcı`, "");
  out.push(`İstek/sn: ${a?.sunucu?.istekSn ?? "—"} → ${b?.sunucu?.istekSn ?? "—"} · tüm istekler p50/p95/en çok (ms): ${triple(a?.sunucu?.genel)} → ${triple(b?.sunucu?.genel)}`);
  out.push(`Olay döngüsü p95 / p99 / en çok (ms): ${a ? `${cell(a.sunucu.olayDongusu, "p95")} / ${cell(a.sunucu.olayDongusu, "p99")} / ${cell(a.sunucu.olayDongusu, "enCok")}` : "—"} → ${cell(b.sunucu.olayDongusu, "p95")} / ${cell(b.sunucu.olayDongusu, "p99")} / ${cell(b.sunucu.olayDongusu, "enCok")}`);
  out.push(`Sonuç: ÖNCE ${a ? (a.sonuc?.hatalar?.length ? `hata ${a.sonuc.hatalar.length}` : "hata yok") : "—"} · SONRA ${b.sonuc?.hatalar?.length ? `HATA ${b.sonuc.hatalar.join(" | ")}` : "hata yok"}; Mutabakat Testi ${Object.entries(b.sonra || {}).map(([code, item]) => `${code} ${item.mutabakatTesti}`).join(", ")}; bağımsız fark ${Object.entries(b.sonra || {}).map(([code, item]) => `${code} Kasa ${item.kasa?.fark} Banka ${item.banka102?.fark}`).join(", ")}`);
  out.push("", "| İşlem | adet ÖNCE → SONRA | ÖNCE p50 / p95 / en çok (ms) | SONRA p50 / p95 / en çok (ms) |", "|---|---|---|---|");
  const kinds = new Set([...(a?.sunucu?.turler || []), ...(b?.sunucu?.turler || [])].map(row => row.tur));
  for (const kind of kinds) {
    const x = a?.sunucu?.turler?.find(row => row.tur === kind);
    const y = b?.sunucu?.turler?.find(row => row.tur === kind);
    out.push(`| ${kind} | ${x?.adet ?? "—"} → ${y?.adet ?? "—"} | ${triple(x)} | ${triple(y)} |`);
  }
  out.push("", "| Ekran (gerçek Chromium) | ÖNCE p50 / p95 / en çok (ms) | SONRA p50 / p95 / en çok (ms) |", "|---|---|---|");
  for (const [name, key] of [["Cari araması: tuş → harf", "cariTusHarf"], ["Cari araması: son tuş → sonuç", "cariAramaSonucu"], ["Banka Hareketleri: hesap süzgeci", "hareketSuzgec"], ["Ekrandan + Masraf → listede", "kaydetListede"], ["Başkasının kaydı açık listede", "baskasininKaydiListede"], ["Raporlar penceresi açılış", "raporlarAcilis"], ["Banka Bakiye Raporu ön izleme", "bankaBakiyeOnIzleme"], ["PDF", "pdf"], ["Excel", "excel"]]) {
    out.push(`| ${name} (adet ${a?.ekran?.[key]?.adet ?? "—"} → ${b?.ekran?.[key]?.adet ?? "—"}) | ${triple(a?.ekran?.[key])} | ${triple(b?.ekran?.[key])} |`);
  }
  out.push(`| Banka penceresi turu / yeniden açılış | ${a?.ekran?.bankaTur ?? "—"} | ${b?.ekran?.bankaTur ?? "—"} / ${b?.ekran?.bankaYenidenAcilis ?? "—"} |`);
  out.push(`| Ekran hataları | ${a?.ekran?.hatalar?.length ?? "—"} | ${b?.ekran?.hatalar?.length ?? "—"} |`, "");
}
console.log(out.join("\n"));
