// Kâğıt / fiş / iç seri numara tabanı (ayar "invoice.numberFloor"; seri + yıl başına bir kayıt) — routes/invoices.mjs (reserveNumber, lastIssued,
// editChronologyProblem) ve lib/migrations.mjs (v32 scanPaperFloors) AYNI kuralı buradan alır.
//
// Kayıt: { seq, number, issueDate, deleted?, kept? }
//   seq / number / issueDate  seriden ayrılmış EN BÜYÜK numara (belge e-Belge olarak gönderilip seriden çıktı ya da belge silindi). Numara tabanı:
//                             sıradaki numara bundan sonra gelir (E6 + 22.10.2026 "verilmiş kâğıt / fiş numarası bir daha kullanılmaz").
//   deleted                   en büyük ayrılan numaranın belgesi SİLİNDİ (Silinenler'de).
//   kept                      (yalnız deleted iken) seriden ayrılmış en büyük SİLİNMEMİŞ numara — belgesi duruyor (e-Belge olarak gönderildi): { seq, number, issueDate }.
//
// r31e N1 (karar 23.10.2026, kullanıcının 5 dk yetkisiyle): silinen belgenin NUMARASI kullanılmış kalır, TARİHİ numara–tarih sırası tabanını BAĞLAMAZ —
// yanlış (ileri) tarihle kesilip silinen fiş, doğru (daha eski) tarihle yeniden kesilebilmeli; önceden en geç tarihli silinen belge bütün seriyi o güne
// kilitliyordu, çıkış yolu yoktu. Sıra-tarih tabanı seride DURAN belgeler + seriden ayrılmış ama belgesi duran numaradır (keptOf). Silinen belgenin geri
// yüklenmesi sırayı bozacaksa reddedilir (routes/invoices.mjs restoreDeleted). e-Belge serileri bu kaydı kullanmaz.

const entry = value => (value && Number(value.seq) > 0 ? { seq: Number(value.seq), number: String(value.number || ""), issueDate: String(value.issueDate || "") } : null);

/** Sıra-tarih tabanına giren ayrılmış numara (belgesi duran): silinmemiş kayıt kendisi; silinmişse kept; yoksa null. Eski kayıt (kept alanı yok) okunur. */
export function keptOf(floor) {
  if (!floor || !(Number(floor.seq) > 0)) return null;
  return floor.deleted === true ? entry(floor.kept) : entry(floor);
}

/**
 * Kayda yeni ayrılan numarayı katar (sıradan bağımsız: en büyük numara + en büyük silinmemiş numara). Kayıt yalnız yükselir.
 * @param {object|null} current  var olan kayıt
 * @param {{ seq: number, number: string, issueDate: string, deleted?: boolean }} next  ayrılan numara
 * @returns {object} yeni kayıt (değişmediyse current ile aynı içerik)
 */
export function mergeFloor(current, next) {
  const head = current && Number(current.seq) > 0 ? current : null;
  const add = entry(next);
  if (!add) return head;
  const prevKept = keptOf(head);
  const kept = !next.deleted && !(Number(prevKept?.seq) >= add.seq) ? add : prevKept;
  const topDeleted = head && Number(head.seq) >= add.seq ? head.deleted === true : next.deleted === true;
  const top = head && Number(head.seq) >= add.seq ? entry(head) : add;
  return topDeleted ? { ...top, deleted: true, ...(kept ? { kept } : {}) } : top;
}
