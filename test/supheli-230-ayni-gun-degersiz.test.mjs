// Aynı gün Değersiz Alacak satırı + tahsilat (15.10.2026; Uzun Doğrulama #199 tohum 7/8/10 + uzun koşu: kapı "doubtful:records" 409 — supheli-tahsil
// / supheli-sil). Kök neden: ayırma kuralı aynı gündeki bütün alacak satırlarını tek sınıfta tutup anahtara (rastgele UUID; kapı 'account:<id>',
// yevmiye '<id>#<satır>') göre sıralıyordu → sıra rastgele ve iki yükleyicide farklı; tahsilat önce gelirse değersiz satırı kalanı aşıp kayıt dışı
// düşüyordu. Kural (kâhin dili §4.15, plan §3.11b K3): aynı gün al → karşılık → DEĞERSİZ → alacak satırı → çıkar; anahtardan bağımsız.
import assert from "node:assert/strict";
import { test } from "node:test";
import { allocateDoubtful } from "../server/lib/doubtful-gl.mjs";

const D = "2026-03-10";
const record = { id: "rec-1", party: "c1", date: "2026-02-01", amountMinor: 12_000, status: "open", closedDate: "" };

function run(keys) {
  const credits = [
    { key: keys.collection, party: "c1", date: D, minor: 10_000, target: "" },
    { key: keys.writeOff, party: "c1", date: D, minor: 5_000, target: "rec-1" },
  ];
  const { allocations, state } = allocateDoubtful({ records: [record], provisions: [], credits });
  const s = state.get("rec-1");
  return { writtenOff: s.writtenOff, collected: s.collected, remaining: s.remaining, outside: allocations.get(keys.writeOff)?.outsideMinor ?? 0, collectionHit: allocations.get(keys.collection)?.records.reduce((sum, item) => sum + item.minor, 0) ?? 0 };
}

test("aynı gün değersiz satırı tahsilattan ÖNCE düşer; anahtar sırası sonucu değiştirmez", () => {
  const a = run({ collection: "account:aaaa", writeOff: "account:zzzz" }); // anahtara göre tahsilat önce
  const b = run({ collection: "account:zzzz", writeOff: "account:aaaa" }); // anahtara göre değersiz önce
  const expected = { writtenOff: 5_000, collected: 7_000, remaining: 0, outside: 0, collectionHit: 7_000 };
  assert.deepEqual(a, expected, "tahsilat anahtarı küçükken");
  assert.deepEqual(b, expected, "değersiz anahtarı küçükken");
});

test("aynı gün iki tahsilatın kendi arası sırası kayıt toplamlarını değiştirmez", () => {
  const credits = (k1, k2) => [
    { key: k1, party: "c1", date: D, minor: 8_000, target: "" },
    { key: k2, party: "c1", date: D, minor: 6_000, target: "" },
  ];
  const one = allocateDoubtful({ records: [record], credits: credits("account:a", "account:b") }).state.get("rec-1");
  const two = allocateDoubtful({ records: [record], credits: credits("account:b", "account:a") }).state.get("rec-1");
  assert.deepEqual({ c: one.collected, r: one.remaining }, { c: 12_000, r: 0 });
  assert.deepEqual({ c: two.collected, r: two.remaining }, { c: 12_000, r: 0 });
});
