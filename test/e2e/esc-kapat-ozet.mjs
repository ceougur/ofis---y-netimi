// Ders 34: escClose'un ("Kaydedilmemiş Değişiklik" sorusunu kendiliğinden "Kaydetmeden Kapat" ile geçen yardımcı) günlüğünü özetler.
// Kullanım: ESC_KAPAT_GUNLUK=<dosya.jsonl> ile e2e koş → node test/e2e/esc-kapat-ozet.mjs <dosya.jsonl>
// Her soru çağrı zincirine göre gruplanır (closeAll gibi yardımcının içinden çağrılan escClose'un adımı zincirin sonraki halkasıdır).
// Ön sınıf (elle doğrulanır; hof-core isDirty() iki kaynağı):
//   ADAY-MEŞRU  neden "alan": kullanıcının dokunduğu alan kayıtlı (çizilen) değerinden farklı;
//               neden "kapsam" ve formda kullanıcı içeriği var (fatura taslağı: cari ya da kalem adı / fiyatı dolu; ya da dokunulmuş alan farklı).
//   KURAL-GERİ-ALINMIŞ  neden "kapsam", kullanıcı içeriği yok ama dokunulmuş alan var ve kayıtlı değerine dönmüş (yaz-sil, işaret geri alındı):
//               hof-core kapsam kuralı gereği soru (pencere kapanana kadar "değiştirildi" sayılır) — yanlış değil, tasarım; elle bakılır;
//   ELLE-BAK    neden "kapsam", düzenleme / taslak formu ("Düzenleme: …", "Taslak: …"): dolu kalem kayıtlı olabilir — kayıtlı belgeyle elle karşılaştırılır;
//   ŞÜPHELİ     neden "kapsam" ama formda ne kullanıcı içeriği ne dokunulmuş alan görünüyor — yanlış soru adayı;
//               neden "kapatma-sorusu" (pencerenin kendi beforeClose'u) — pencereye özgü kural, elle bakılır.
//   ESKİ-GÜNLÜK satırda "neden" yok (genişletilmeden önceki günlük) ve değişmiş dokunulmuş alan yok: kapsam görünmez, sınıflanamaz.
import { readFileSync } from "node:fs";

const file = process.argv[2];
if (!file) {
  console.error("kullanım: node test/e2e/esc-kapat-ozet.mjs <esc-gunluk.jsonl>");
  process.exit(2);
}
const lines = readFileSync(file, "utf8")
  .split(/\r?\n/)
  .filter(Boolean)
  .map(line => JSON.parse(line));

// Adım: çağrı zinciri (escClose'u çağıran satır ← onu çağıran …); closeAll gibi yardımcının içinden gelen sorular adımlarına ayrılır.
const stepOf = item => (item.zincir?.length ? item.zincir.slice(0, 3).join(" ← ") : item.yer);
const userContent = item => {
  const filled = item.dolu || [];
  const invoice = filled.filter(field => field.name === "cari" || /^kalem\d+\.(name|unitPrice|qty)$/.test(field.name));
  const meaningful = invoice.filter(field => !(/\.qty$/.test(field.name) && String(field.value) === "1"));
  return { invoice: meaningful, changed: (item.touched || []).filter(field => field.changed) };
};
const classify = item => {
  if (!item.neden) return (item.touched || []).some(field => field.changed) ? "ADAY-MEŞRU" : "ESKİ-GÜNLÜK";
  if (item.neden === "alan") return "ADAY-MEŞRU";
  if (item.neden === "kapatma-sorusu") return "ŞÜPHELİ";
  const content = userContent(item);
  if (content.changed.length) return "ADAY-MEŞRU";
  // Düzenleme / taslak formunda kalem ve cari zaten kayıtlıdır: dolu olmaları kullanıcı girdisi sayılmaz.
  if (content.invoice.length && /^(Düzenleme|Taslak)/.test(item.altBaslik || "")) return "ELLE-BAK";
  if (content.invoice.length) return "ADAY-MEŞRU";
  // Kapsam kuralı: kullanıcı alana dokundu ama alan kayıtlı değerine döndü (yaz-sil, işareti geri al) → pencere kapanana kadar kaydedilmemiş sayılır.
  return (item.touched || []).length ? "KURAL-GERİ-ALINMIŞ" : "ŞÜPHELİ";
};

const groups = new Map();
for (const item of lines) {
  const step = stepOf(item);
  const cls = classify(item);
  const key = `${item.senaryo} ${step} ${item.title} ${cls}`;
  const entry = groups.get(key) || { item, step, cls, count: 0 };
  entry.count += 1;
  groups.set(key, entry);
}
const fmt = field => `${field.label && field.label !== field.name ? `${field.name}(${field.label})` : field.name}=${field.value}${field.changed ? "*" : ""}`;
let suspicious = 0;
for (const { item, step, cls, count } of groups.values()) {
  if (["ŞÜPHELİ", "ESKİ-GÜNLÜK", "ELLE-BAK"].includes(cls)) suspicious += 1;
  const content = userContent(item);
  const evidence = cls === "ADAY-MEŞRU" && item.neden ? [...content.invoice, ...content.changed] : item.touched || [];
  console.log(
    [
      cls,
      item.senaryo,
      `adım ${step}`,
      `×${count}`,
      `«${item.title}${item.altBaslik ? ` · ${item.altBaslik}` : ""}»`,
      `neden:${item.neden || "?"}`,
      `kapsam:${(item.kapsam || []).join(",") || "-"}`,
      `dokunulan:${(item.touched || []).length} değişen:${content.changed.length} dolu:${item.doluSayi ?? "?"}`,
      JSON.stringify(evidence.slice(0, 6).map(fmt)),
    ].join("\t"),
  );
}
console.log(`toplam soru ${lines.length}, adım ${groups.size}, ŞÜPHELİ / ELLE-BAK / sınıflanamayan ${suspicious}`);
// Çıkış 1: elle bakılması gereken soru var (ders 34: yanıtlanan her soru sınıflanır).
process.exitCode = suspicious ? 1 : 0;
