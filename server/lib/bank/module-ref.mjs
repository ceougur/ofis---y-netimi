// Modül formlarında havale/EFT satırının banka hesabı, kurumsal kartla ödemenin kart hesabı ve eksi bakiye denetimi (v2.1.0 Aşama 5–8;
// docs/BANKA-MODULU-PLAN.md §3.5 K13, §3.9 K7, §4.6).
//
// Cari tahsilat/ödeme ve Kasa ↔ Banka transferi bu yardımcıyla hesap seçer (Aşama 7–8'de fatura peşini, taksit, kayıt, stok ve çek de):
//   pickRef({ method, value, date, previous, changed, corporate }) → fin_ref ('' = hesapsız)
//     1. Hesap ailesi yoldan ve belge türünden (§4.6 "Alan, yöne göre değil belge türüne göre seçilir"): havale → banka hesabı (Vadesiz/Ticari/
//        Diğer, TL); kart yolu + corporate (ödeme, alış, alıştan iade: kurumsal kartla ödeme ya da kurumsal karta iade; §3.5 tablo "Kurumsal
//        Kredi Kartı | card | 309 / 309.NN | Ödemede ve kurumsal karta gelen iadede") → Kurumsal Kredi Kartı hesabı. Nakit '' (hesap yok sayılır).
//        Kart yolunun öbür anlamı (POS tahsilatı ve POS iadesi) 2.2.0'da POS'a bağlanır; bugün '' ve hesap verilirse 400 bank-account-invalid
//        (§12.4 "Bağ": yanlış türde hesap bağlama reddedilir; önceden kimlik sessizce yok sayılıyordu — K2).
//     2. Ailede hiç uygun hesap (etkin, TL) yoksa ve hesap verilmemişse '' (bugünkü davranış; §3.5/1: 102.00 / 108.00).
//     3. Hesap verilmemişse: düzeltmede önceki bağ korunur (parası değişirse 4'teki denetimden yeniden geçer); önceki satır bağsızsa ve parası (yol, tutar, tarih) değişmiyorsa bağsız kalır
//        (§3.5 kural 4). Yoksa tek uygun hesap kendiliğinden seçilir, birden çoksa 400 bank-account-required (alan: bankAccountId).
//     4. Verilen hesap: yoksa 404, pasifse ya da türü (ailesi) uymuyorsa 400 bank-account-invalid, havalede döviz hesabıysa 400 bank-currency; satır
//        hesabın açılışından önceyse 409 bank-before-opening, Devir Kapanışı sınırından önceyse 409 bank-carry-closed (aynı para iki kez sayılmasın).
//   K2 (bağımsız kâhin + hakem, 10.10.2026): önceden 1. adım "yol havale değilse ''" idi — kurumsal kartla ödeme 108.00 "Hesabı Atanmamış"a
//   düşüyor, Kart ve Kredi Borcu 0 görünüyor, kart limiti (K7) çalışmıyor, iki kartta seçim istenmiyordu (plan kurumsal kartı 2.1.0'a koyar).
//   negative({ refs, date, force }) → { capture, guard, prime }: K7 (Banka Fişi'nin kuralı, lib/bank/vouchers.mjs): capture() yazımdan HEMEN
//     önce (bank.post'un write geri çağrısında, aynı işlemde), guard bank.post'un guard adımına, prime(result) COMMIT'ten sonra (saklı hesap
//     toplamı; bir sonraki okuma hesabın bütün satırlarını yeniden toplamaz — GG2.6 notu).
import { HttpError, text } from "../http.mjs";
import { PERMISSION_GROUPS, canUser } from "../permissions.mjs";

const BANK_FORM_KINDS = new Set(["demand", "commercial", "other"]);
const dayText = iso => (iso ? iso.split("-").reverse().join(".") : "");
const labelOf = row => `${row.bank_name} · ${row.name}`;
const bad = (status, message, code, extra = {}) => new HttpError(status, message, { code, field: "bankAccountId", ...extra });

/**
 * Yargıç Y1 (plan §3.5 "Pasif hesap → 400"; en yaygın kalıp: pasif hesapta önce yeniden etkinleştirme): pasif hesabın bakiyesini değiştiren her
 * işlem (silme, tutar/yol/hesap değişikliği, nakde çevirme, fatura iptali/silmesi/Düzenle'de satırın kalkması, geri yükleme) 400. Yalnız para
 * dışı alan (açıklama) değişir. row: bank_accounts satırı (bank_name, name, id).
 */
export const bankPassiveError = row =>
  new HttpError(400, `${row.bank_name} · ${row.name} hesabı pasif; bu hesabın bakiyesini değiştiren işlem (silme, tutar, tarih, yol ya da hesap değişikliği, geri yükleme) yapılmaz. Önce Banka → Hesaplar'dan Etkinleştir.`, { code: "bank-account-passive", field: "bankAccountId", accountId: row.id });
const PERMISSION_LABEL = new Map(PERMISSION_GROUPS.flatMap(group => group.items.map(([key, label]) => [key, label])));

/**
 * Hakem K5 (plan §3.9 "Uyarıyı geçmek ("Yine de Kaydet", cashForce)", §7): hesap bazlı eksi bakiye uyarısının (409 cash-negative + accountId) onayı.
 * Planın bayrağı cashForce (gövde ya da ?cashForce=1); eski istemcinin negativeOk'u (?negativeOk=1) eşanlamlı. Ekran Kasa sorusunu onaylayıp aynı
 * isteği yeniden gönderirken (HOF.api) banka hesabının sorusunu henüz görmediyse negativeOk:false (?negativeOk=0) ekler: o zaman cashForce yalnız
 * Kasa'yı geçer, banka hesabı ayrıca sorulur (tek onay iki hesabı birden sessizce geçmesin). Engelle'yi hiçbir bayrak geçmez (vouchers.mjs).
 */
export function negativeConfirmed(body, url = null) {
  const query = url?.searchParams;
  if (body?.negativeOk === true || query?.get("negativeOk") === "1") return true;
  if (body?.negativeOk === false || query?.get("negativeOk") === "0") return false;
  return body?.cashForce === true || query?.get("cashForce") === "1";
}

/**
 * @param {{ store, accounts, negative: { balancesOf, guardNegative, primeTotals } }} options  accounts: banka hesap servisi (rowOf, carryBoundary)
 */
export function createModuleBank({ store, accounts, negative, legacy = () => false }) {
  /** Ailenin seçilebilir hesapları (etkin, TL): bank → Vadesiz/Ticari/Diğer; card → Kurumsal Kredi Kartı. */
  const eligible = (family = "bank") =>
    store
      .all(`SELECT id FROM bank_accounts WHERE deleted_at IS NULL AND status = 'active' AND currency = 'TRY' AND kind IN (${family === "card" ? "'card'" : "'demand', 'commercial', 'other'"}) ORDER BY position, created_at`)
      .map(row => row.id);

  /** Seçilen hesabın denetimi (yukarıdaki 4). family: bank | card. */
  function check(id, date, family = "bank") {
    const row = accounts.rowOf(id);
    if (!row) throw bad(404, "Banka hesabı bulunamadı. Silinmiş ya da başka şirkete ait olabilir.", "bank-account-missing");
    if (row.status !== "active") throw bad(400, `${labelOf(row)} pasif; bu hesaba hareket girmek için önce Banka → Hesaplar'dan Etkinleştir.`, "bank-account-invalid", { accountId: row.id });
    if (family === "card") {
      if (row.kind !== "card" || row.currency !== "TRY") throw bad(400, `${labelOf(row)} kurumsal kredi kartı değil: Kredi Kartı yolunda yalnız Kurumsal Kredi Kartı hesabı seçilir (bankadan ödeme için yolu Havale / EFT yapın).`, "bank-account-invalid", { accountId: row.id });
    } else {
      if (row.currency !== "TRY") throw bad(400, `${labelOf(row)} ${row.currency} hesabı; bu işlem yalnız TL hesapla yapılır.`, "bank-currency", { accountId: row.id });
      if (!BANK_FORM_KINDS.has(row.kind)) throw bad(400, `${labelOf(row)}: havale/EFT yalnız Vadesiz, Ticari ya da Diğer TL hesapla yapılır.`, "bank-account-invalid", { accountId: row.id });
    }
    if (date && row.opening_date && date < row.opening_date) {
      throw bad(409, `İşlem tarihi (${dayText(date)}) ${labelOf(row)} hesabının açılışından (${dayText(row.opening_date)}) önce; o tarihteki para açılış bakiyesinin içindedir. Tarihi düzeltin ya da başka hesap seçin.`, "bank-before-opening", { accountId: row.id });
    }
    const closed = accounts.carryBoundary();
    if (date && closed && date < closed) {
      throw bad(409, `İşlem tarihi (${dayText(date)}) ${dayText(closed)} tarihli Devir Kapanışı'ndan önce; o tarihten önceki banka hareketleri açılış bakiyelerinin içinde sayıldı. Hesaba bağlanırsa iki kez sayılır. Tarihi düzeltin (ya da Kurulum Geçmişi'nden kurulumu Geri Al'ın).`, "bank-carry-closed", { accountId: row.id, closedThrough: closed });
    }
    return row.id;
  }

  /**
   * Satırın banka hesabı (fin_ref). previous: { method, finRef } (düzeltmede); changed: yol, tutar ya da tarih değişti mi. corporate: kart yolu bu
   * belgede kurumsal kartla ödeme ya da kurumsal karta iade mi (cari ödeme, alış faturası ve alıştan iade, stok alımı); değilse kart yolu POS'tur.
   */
  function pickRef({ method, value = "", date = "", previous = null, changed = true, corporate = false } = {}) {
    const way = String(method || "");
    const family = way === "bank" ? "bank" : way === "card" && corporate ? "card" : "";
    const id = text(value);
    if (!family) {
      // K2: POS tahsilatı / POS iadesi 2.2.0'da POS'a bağlanır; bugün hesaba bağlanmaz. Kimlik verilmişse yanlış türde bağdır (önceden yok sayılıyordu).
      if (id && way === "card") throw bad(400, "POS tahsilatı ve POS iadesi banka hesabına bağlanmaz; Banka Hesabı alanını boş bırakın (kurumsal kart yalnız ödemede ve kurumsal karta gelen iadede seçilir).", "bank-account-invalid");
      return "";
    }
    const before = previous && String(previous.method || "") === way ? String(previous.finRef ?? previous.fin_ref ?? "") : "";
    // Aşama 7–8: satırın kendi (artık pasif olabilen) hesabı parası değişmeden yeniden gönderilirse bağ olduğu gibi kalır.
    if (id && before && id === before && !changed) return before;
    if (id) return check(id, date, family);
    if (previous && String(previous.method || "") === way) {
      // Hızlı Nasıl Bozarım (H3): parası (yol, tutar, tarih) değişen bağlı satır, hesap kimliği gövdede olmasa da hesabın kurallarından geçer
      // (pasif hesap, açılış ve Devir Kapanışı öncesi tarih). Önceden kimlik gönderilince 400/409, gönderilmeyince denetimsiz kalıyordu.
      if (before) return changed ? check(before, date, family) : before;
      if (!changed) return "";
    }
    // Yalnız testler (config.bankPickLegacy): eski sürüm gibi hesap verilmeyen havale ve kart ödemesi hesapsız yazılır (Aşama 2–4 testlerinin eski
    // hareketleri; mutabakat motoru bağlı ve bağsız satırı birlikte üretir).
    if (legacy()) return "";
    const ids = eligible(family);
    if (!ids.length) return "";
    if (ids.length > 1) throw bad(400, family === "card" ? "Kurumsal Kart seçin: kartla ödeme hangi kurumsal karttan yapıldı (ya da iade hangi karta geldi)?" : "Banka Hesabı seçin: havale/EFT hangi hesaba girdi ya da hangi hesaptan çıktı?", "bank-account-required");
    return check(ids[0], date, family);
  }

  /** K7 (yukarıdaki not). refs: dokunulacak hesaplar (önceki ve yeni bağ); boşsa hiçbir şey yapmaz. */
  function negativeGuard({ refs = [], date = "", force = false } = {}) {
    const list = [...new Set(refs.filter(Boolean))];
    const settled = new Map();
    let before = null;
    return {
      capture() {
        if (list.length) before = negative.balancesOf(list);
      },
      guard: (_, ctx) => {
        if (before) negative.guardNegative(before, { date, force, ctx, settled });
      },
      prime(result) {
        negative.primeTotals(settled, result);
      },
    };
  }

  /** Hesap etkin mi (yoksa ya da silinmişse karar keepRef'te; pasifse 400 bank-account-passive). */
  function assertActive(id) {
    const row = id ? accounts.rowOf(id) : null;
    if (row && !row.deleted_at && row.status !== "active") throw bankPassiveError(row);
  }

  return { pickRef, negative: negativeGuard, eligible, assertActive };
}

const NOOP_GUARD = Object.freeze({ capture() {}, guard: null, prime() {} });
/**
 * Modül rotalarının ortak bankalı yazım yardımcıları (Aşama 7–8: fatura peşini, taksit ve kayıt tahsilatı, stok peşini, çek tahsil/ödeme; cari
 * rotası Aşama 5'te aynı kuralları kendi içinde kurdu). bankModule: istek anında context.bankAccounts.module (rotalar banka rotalarından önce kurulur).
 *   ref({ method, value, date, previous, changed, corporate }) → fin_ref (pickRef; banka modülü yoksa ''; corporate: kart yolu kurumsal kart)
 *   negative(refs, date, force)                     → K7 { capture, guard, prime } (banka modülü yoksa etkisiz)
 *   requireOut(user, out, ref)                      → bankadan (ya da kurumsal karttan) çıkış "Banka Hareketi Girme ve Bankadan Çıkış" (bank.move) ister
 *                                                     (403 bank-permission; plan §3.7 #3 #5, §9.2/3)
 *   forced(body, url)                               → eksi bakiye onayı (negativeConfirmed: cashForce ya da eşanlamlı negativeOk)
 *   requestId(req, body)                            → x-hof-request ya da gövdedeki requestId
 *   eligible(family)                                → seçilebilir hesaplar (bank | card; K7 ön yakalamada "tek hesapta kendiliğinden" seçimi kapsamak için)
 *   restore(user, { refs, date, force, permission }) → Silinenler'den geri yükleme (plan §3.8, §9.2/7): banka bağlı satırda kaynak modül yetkisi +
 *                                                     bank.move, pasif hesap 400, K7 { capture, guard, prime } (yazımdan sonraki son durumla)
 */
export function bankForm(bankModule = () => null) {
  const module = () => bankModule?.() || null;
  return {
    ref: (options = {}) => module()?.pickRef(options) || "",
    negative: (refs = [], date = "", force = false) => module()?.negative({ refs, date, force }) || NOOP_GUARD,
    requireOut(user, out, ref) {
      if (out && ref && !canUser(user, "bank.move")) throw new HttpError(403, "Bankadan ödeme için \"Banka Hareketi Girme ve Bankadan Çıkış\" yetkisi gerekir.", { code: "bank-permission", permission: "bank.move" });
    },
    forced: (body, url) => negativeConfirmed(body, url),
    requestId: (req, body) => text(req?.headers?.["x-hof-request"]) || text(body?.requestId),
    eligible: (family = "bank") => module()?.eligible(family) || [],
    restore(user, { refs = [], date = "", force = false, permission = "" } = {}) {
      const list = [...new Set(refs.filter(Boolean))];
      const bank = module();
      if (!list.length || !bank) return NOOP_GUARD;
      if (permission && !canUser(user, permission)) {
        throw new HttpError(403, `Bu hareket bir banka hesabına bağlı; geri yüklemek için hareketin kendi bölümündeki "${PERMISSION_LABEL.get(permission) || permission}" yetkisi de gerekir.`, { code: "module-permission", permission });
      }
      if (!canUser(user, "bank.move")) throw new HttpError(403, "Bu hareket bir banka hesabına bağlı; geri yüklemek için \"Banka Hareketi Girme ve Bankadan Çıkış\" yetkisi gerekir.", { code: "bank-permission", permission: "bank.move" });
      for (const ref of list) bank.assertActive(ref);
      return bank.negative({ refs: list, date, force });
    },
  };
}
