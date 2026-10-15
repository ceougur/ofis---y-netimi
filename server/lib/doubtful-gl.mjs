// Şüpheli Ticari Alacaklar — TEK KURAL (2.3.0 İz 1; docs/BANKA-MODULU-PLAN.md §3.11b; kabul: docs/2.3.0-SUPHELI-KABUL.md §1 K1–K7).
// Saf işlevler (veri tabanı yok): yevmiye (lib/general-ledger.mjs), Ana Defter'in beklenenleri (routes/ledger.mjs expected), cari kartı
// özeti, rapor verisi ve kapı (lib/bank/doubtful.mjs) hepsi buradaki ayırma kuralını kullanır; iki yükleyici (yevmiye satırları ↔ SQL
// satırları) aynı kuraldan geçer, kapı ikisini karşılaştırır.
//
// Hesaplar (Tekdüzen): 128 Şüpheli Ticari Alacaklar · 129 Şüpheli Ticari Alacaklar Karşılığı (−) · 644 Konusu Kalmayan Karşılıklar ·
// 654 Karşılık Giderleri · 659 Diğer Olağan Gider ve Zararlar.
//
// Kural (kuruş; cari başına, tarih sırasıyla; aynı günde sıra: al → karşılık → alacak satırı → çıkar):
//   al        : B 128 / A 120 (tutar); kayıt "kalan" = tutar
//   karşılık  : B 654 / A 129; kaydın karşılığı += tutar (yazımda ≤ kalan)
//   alacak    : carinin kontrol hesabını alacaklandıran satır (tahsilat, alınan evrak, Alacak Yaz, iade/alış faturası, taksit tahsilatı,
//               kapatılan kartın vazgeçilen kalanı) kayıt tarihinden sonra geldiyse ÖNCE şüpheliden düşer: A 120 yerine A 128 (en eski
//               açık kayıttan başlayarak, kalan kadar; artan A 120). 644 kuralı: düşümden sonra karşılık > kalan ise aşan kısım aynı gün
//               B 129 / A 644. Değersiz Alacak satırı (source 'doubtful') HEDEFLİ: yalnız kendi kaydından düşer; borç tarafı önce 129
//               (karşılık kadar), kalanı 659; kalanı aşan kısım A 120 / B 659 (kayıt dışı kayıp; yazımda engellenir, eski veri için).
//   çıkar     : kapanış günü kalan B 120 / A 128; karşılık varsa B 129 / A 644 (konusu kalmadı); kayıt kapanır.
import { roundMoney } from "./money.mjs";

export const DOUBTFUL_GL = Object.freeze({ doubtful: "128", provision: "129", groundless: "644", expense: "654", loss: "659" });
export const DOUBTFUL_CHART = Object.freeze({
  128: "Şüpheli Ticari Alacaklar",
  129: "Şüpheli Ticari Alacaklar Karşılığı (−)",
  644: "Konusu Kalmayan Karşılıklar",
  654: "Karşılık Giderleri",
});
// Kalıtımsız nesne (2.0.22 dersi): "constructor" gibi adlar neden sayılmasın.
export const DOUBTFUL_REASONS = Object.freeze(Object.assign(Object.create(null), { cheque: "Karşılıksız Çek", note: "Protestolu Senet", lawsuit: "Dava", enforcement: "İcra", other: "Diğer" }));
export const isDoubtfulReason = value => typeof value === "string" && Object.hasOwn(DOUBTFUL_REASONS, value);
export const DOUBTFUL_STATUS_LABELS = Object.freeze({ open: "Şüpheli Alacakta", collected: "Tahsil Edildi", writtenOff: "Değersiz Yazıldı", released: "Şüpheliden Çıkarıldı", cancelled: "İptal Edildi" });
/** Kaydın görünen durumu: kalan 0 ise nasıl kapandığı (çıkarıldı / değersiz yazıldı / tahsil edildi). */
export function doubtfulStatusOf(record, state) {
  if (record.status === "cancelled") return "cancelled";
  if (record.status === "released") return "released";
  if (!state || state.remaining > 0) return "open";
  return state.writtenOff > 0 ? "writtenOff" : "collected";
}
export const doubtfulStatusLabel = (record, state) => DOUBTFUL_STATUS_LABELS[doubtfulStatusOf(record, state)];

const ORDER = { take: 0, provision: 1, credit: 2, release: 3 };
const by = (a, b) => (a.date === b.date ? (a.order === b.order ? (a.tie < b.tie ? -1 : a.tie > b.tie ? 1 : 0) : a.order - b.order) : a.date < b.date ? -1 : 1);
const fresh = record => ({ taken: record.amountMinor, collected: 0, writtenOff: 0, released: 0, remaining: record.amountMinor, provision: 0, provisionAdded: 0, provisionReleased: 0, provisionUsed: 0, lost: 0, closedOn: "" });

/**
 * Ayırma kuralı.
 * @param {{ records: Array<{ id, party, date, amountMinor, status, closedDate }>, provisions: Array<{ id, recordId, date, amountMinor }>,
 *           credits: Array<{ key, party, date, minor, target? }> }} input  credits: kontrol hesabını alacaklandıran satırlar (kuruş, artı);
 *           target: Değersiz Alacak satırının kaydı ('' = hedefsiz)
 * @returns {{ allocations: Map<string, { records: Array<{ recordId, minor }>, provisionUsed: number, lossMinor: number }>,
 *             extras: Array<{ kind: 'release644' | 'release' | 'release644close', recordId, party, date, minor, key? }>,
 *             state: Map<string, object> }}
 */
export function allocateDoubtful({ records = [], provisions = [], credits = [] } = {}) {
  const state = new Map();
  const allocations = new Map();
  const extras = [];
  const byParty = new Map();
  for (const record of records) {
    if (record.status === "cancelled") continue;
    if (!byParty.has(record.party)) byParty.set(record.party, { records: [], provisions: [], credits: [] });
    byParty.get(record.party).records.push(record);
    state.set(record.id, fresh(record));
  }
  const recordById = new Map(records.map(record => [record.id, record]));
  for (const item of provisions) {
    const record = recordById.get(item.recordId);
    if (!record || !byParty.has(record.party)) continue;
    byParty.get(record.party).provisions.push({ ...item, party: record.party });
  }
  for (const credit of credits) if (byParty.has(credit.party) && credit.minor > 0) byParty.get(credit.party).credits.push(credit);
  for (const [party, group] of byParty) {
    const events = [
      // Aynı tarihte AÇILIŞ sırası (rowid = seq): kimlik rastgele UUID olduğundan ona göre sıralamak sırayı rastgele yapıyordu
      // (kâhin sürüm 4 tohum 4, 15.10.2026: aynı gün iki kayıt, tahsilat yanlış kayıttan düştü). seq yoksa kimlik.
      ...group.records.map(record => ({ kind: "take", date: record.date, order: ORDER.take, tie: record.seq ?? record.id, record })),
      ...group.provisions.map(item => ({ kind: "provision", date: item.date, order: ORDER.provision, tie: item.id, item })),
      ...group.credits.map(credit => ({ kind: "credit", date: credit.date, order: ORDER.credit, tie: credit.key, credit })),
      ...group.records.filter(record => record.status === "released" && record.closedDate).map(record => ({ kind: "release", date: record.closedDate, order: ORDER.release, tie: record.id, record })),
    ].sort(by);
    // Açık (alınmış, kapanmamış) kayıtlar en eskiden yeniye; aynı tarihte açılış (rowid) sırası.
    const open = [];
    for (const event of events) {
      if (event.kind === "take") {
        open.push(event.record);
        continue;
      }
      if (event.kind === "provision") {
        const s = state.get(event.item.recordId);
        if (!s || s.closedOn) continue;
        s.provision += event.item.amountMinor;
        s.provisionAdded += event.item.amountMinor;
        continue;
      }
      if (event.kind === "release") {
        const s = state.get(event.record.id);
        if (!s || s.closedOn) continue;
        if (s.remaining > 0) {
          extras.push({ kind: "release", recordId: event.record.id, party, date: event.date, minor: s.remaining });
          s.released = s.remaining;
          s.remaining = 0;
        }
        if (s.provision > 0) {
          extras.push({ kind: "release644close", recordId: event.record.id, party, date: event.date, minor: s.provision });
          s.provisionReleased += s.provision;
          s.provision = 0;
        }
        s.closedOn = event.date;
        const at = open.indexOf(event.record);
        if (at >= 0) open.splice(at, 1);
        continue;
      }
      // alacak satırı
      const { credit } = event;
      let left = credit.minor;
      const hit = { records: [], provisionUsed: 0, lossMinor: 0 };
      if (credit.target) {
        const s = state.get(credit.target);
        if (s && !s.closedOn && s.remaining > 0) {
          const minor = Math.min(left, s.remaining);
          s.remaining -= minor;
          s.writtenOff += minor;
          left -= minor;
          const used = Math.min(minor, s.provision);
          s.provision -= used;
          s.provisionUsed += used;
          s.lost += minor - used;
          hit.records.push({ recordId: credit.target, minor });
          hit.provisionUsed = used;
        }
        hit.lossMinor = credit.minor - hit.provisionUsed;
      } else {
        for (const record of open) {
          if (left <= 0) break;
          const s = state.get(record.id);
          if (!s || s.remaining <= 0) continue;
          const minor = Math.min(left, s.remaining);
          s.remaining -= minor;
          s.collected += minor;
          left -= minor;
          hit.records.push({ recordId: record.id, minor });
          if (s.provision > s.remaining) {
            const release = s.provision - s.remaining;
            s.provision -= release;
            s.provisionReleased += release;
            extras.push({ kind: "release644", recordId: record.id, party, date: credit.date, minor: release, key: credit.key });
          }
        }
      }
      if (hit.records.length || credit.target) allocations.set(credit.key, hit);
      // Kalanı sıfırlanan kayıt açık listesinden düşer (sonraki alacaklar sonraki kayda).
      for (let k = open.length - 1; k >= 0; k -= 1) if ((state.get(open[k].id)?.remaining ?? 0) <= 0) open.splice(k, 1);
    }
  }
  return { allocations, extras, state };
}

/** Kaydın görünümü için toplamlar (kuruş → TL de); state yoksa alınmış ama defterde olmayan (silinmiş cari) kayıt. */
export function doubtfulView(record, state) {
  const s = state || fresh(record);
  const status = doubtfulStatusOf(record, s);
  return {
    status: record.status,
    stateKey: status,
    statusLabel: DOUBTFUL_STATUS_LABELS[status],
    amountMinor: record.amountMinor,
    amount: roundMoney(record.amountMinor / 100),
    collectedMinor: s.collected,
    writtenOffMinor: s.writtenOff,
    releasedMinor: s.released,
    remainingMinor: s.remaining,
    provisionMinor: s.provision,
    provisionAddedMinor: s.provisionAdded,
    provisionReleasedMinor: s.provisionReleased,
    provisionUsedMinor: s.provisionUsed,
    lossMinor: s.lost,
    closedOn: s.closedOn || "",
  };
}

const CONTROL_OF = { customer: "120", supplier: "320", other: "336" };
export const doubtfulControl = accountType => CONTROL_OF[accountType] || CONTROL_OF.customer;

/**
 * Yevmiyeye uygular (lib/general-ledger.mjs journal; satırlar party taşır): kontrol hesabının alacak satırları 128'e bölünür, al / karşılık /
 * 644 / çıkar maddeleri eklenir. entries YERİNDE değişir. doubtful: { records: [{ id, party, control, date, amountMinor, status, closedDate,
 * reasonLabel, note, chequeSerialNo }], provisions: [{ id, recordId, date, amountMinor, note }] }. Dönüş: state.
 */
export function applyDoubtfulToJournal(entries, doubtful) {
  const records = (doubtful?.records || []).filter(record => record.status !== "cancelled");
  if (!records.length) return new Map();
  const controlOf = new Map(records.map(record => [record.party, record.control || "120"]));
  const credits = [];
  const lineRefs = new Map();
  for (const entry of entries) {
    entry.lines.forEach((line, index) => {
      if (!line.party || line.credit <= 0 || controlOf.get(line.party) !== line.account) return;
      const key = `${entry.id}#${index}`;
      credits.push({ key, party: line.party, date: entry.date, minor: line.credit, target: entry.doubtful?.record || "" });
      lineRefs.set(key, { entry, line });
    });
  }
  const { allocations, extras, state } = allocateDoubtful({ records, provisions: doubtful?.provisions || [], credits });
  for (const [key, hit] of allocations) {
    const ref = lineRefs.get(key);
    if (!ref) continue;
    const { entry, line } = ref;
    const moved = hit.records.reduce((sum, item) => sum + item.minor, 0);
    const at = entry.lines.indexOf(line);
    const inserted = hit.records.map(item => ({ account: DOUBTFUL_GL.doubtful, debit: 0, credit: item.minor, party: line.party, doubtful: item.recordId }));
    line.credit -= moved;
    entry.lines.splice(at + 1, 0, ...inserted);
    if (line.credit === 0) entry.lines.splice(at, 1);
    // Değersiz Alacak satırı (K7): borç tarafı 659 → karşılıktan karşılanan kısım 129.
    if (entry.doubtful?.writeOff && hit.provisionUsed > 0) {
      const loss = entry.lines.find(item => item.account === DOUBTFUL_GL.loss && item.debit > 0);
      if (loss) {
        loss.debit -= hit.provisionUsed;
        entry.lines.splice(entry.lines.indexOf(loss), loss.debit === 0 ? 1 : 0, { account: DOUBTFUL_GL.provision, debit: hit.provisionUsed, credit: 0 });
      }
    }
  }
  const label = record => [record.reasonLabel || "", record.chequeSerialNo ? `Evrak No ${record.chequeSerialNo}` : "", record.note || ""].filter(Boolean).join(" · ") || "Şüpheli alacak";
  for (const record of records) {
    const control = record.control || "120";
    entries.push({ id: `doubtful-take:${record.id}`, date: record.date, source: "Şüpheli Alacağa Al", text: label(record), lines: [{ account: DOUBTFUL_GL.doubtful, debit: record.amountMinor, credit: 0, party: record.party }, { account: control, debit: 0, credit: record.amountMinor, party: record.party }] });
  }
  const recordById = new Map(records.map(record => [record.id, record]));
  for (const item of doubtful?.provisions || []) {
    const record = recordById.get(item.recordId);
    if (!record || !(item.amountMinor > 0)) continue;
    entries.push({ id: `doubtful-provision:${item.id}`, date: item.date, source: "Karşılık Ayır", text: item.note || label(record), lines: [{ account: DOUBTFUL_GL.expense, debit: item.amountMinor, credit: 0 }, { account: DOUBTFUL_GL.provision, debit: 0, credit: item.amountMinor }] });
  }
  for (const extra of extras) {
    const record = recordById.get(extra.recordId);
    if (!record || !(extra.minor > 0)) continue;
    if (extra.kind === "release") {
      entries.push({ id: `doubtful-release:${record.id}`, date: extra.date, source: "Şüpheliden Çıkar", text: label(record), lines: [{ account: record.control || "120", debit: extra.minor, credit: 0, party: record.party }, { account: DOUBTFUL_GL.doubtful, debit: 0, credit: extra.minor, party: record.party }] });
    } else {
      const suffix = extra.kind === "release644close" ? "release" : extra.key;
      entries.push({ id: `doubtful-644:${record.id}:${suffix}`, date: extra.date, source: "Konusu Kalmayan Karşılık", text: label(record), lines: [{ account: DOUBTFUL_GL.provision, debit: extra.minor, credit: 0 }, { account: DOUBTFUL_GL.groundless, debit: 0, credit: extra.minor }] });
    }
  }
  return state;
}
