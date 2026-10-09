// Modül formlarında havale/EFT satırının banka hesabı ve eksi bakiye denetimi (v2.1.0 Aşama 5–6; docs/BANKA-MODULU-PLAN.md §3.5 K13, §3.9 K7).
//
// Cari tahsilat/ödeme ve Kasa ↔ Banka transferi bu yardımcıyla hesap seçer (Aşama 7–8'de fatura peşini, taksit, kayıt, stok ve çek de):
//   pickRef({ method, value, date, previous, changed }) → fin_ref ('' = hesapsız)
//     1. Yol havale değilse ''. (POS ve kurumsal kart 2.2.0 / sonraki dilim; bugünkü gibi hesapsız.)
//     2. Hiç uygun hesap (etkin, TL, Vadesiz/Ticari/Diğer) yoksa ve hesap verilmemişse '' (bugünkü davranış).
//     3. Hesap verilmemişse: düzeltmede önceki bağ korunur (parası değişirse 4'teki denetimden yeniden geçer); önceki satır bağsızsa ve parası (yol, tutar, tarih) değişmiyorsa bağsız kalır
//        (§3.5 kural 4). Yoksa tek uygun hesap kendiliğinden seçilir, birden çoksa 400 bank-account-required (alan: bankAccountId).
//     4. Verilen hesap: yoksa 404, pasifse ya da türü uymuyorsa 400 bank-account-invalid, döviz hesabıysa 400 bank-currency; satır hesabın
//        açılışından önceyse 409 bank-before-opening, Devir Kapanışı sınırından önceyse 409 bank-carry-closed (aynı para iki kez sayılmasın).
//   negative({ refs, date, force }) → { capture, guard, prime }: K7 (Banka Fişi'nin kuralı, lib/bank/vouchers.mjs): capture() yazımdan HEMEN
//     önce (bank.post'un write geri çağrısında, aynı işlemde), guard bank.post'un guard adımına, prime(result) COMMIT'ten sonra (saklı hesap
//     toplamı; bir sonraki okuma hesabın bütün satırlarını yeniden toplamaz — GG2.6 notu).
import { HttpError, text } from "../http.mjs";
import { canUser } from "../permissions.mjs";

const BANK_FORM_KINDS = new Set(["demand", "commercial", "other"]);
const dayText = iso => (iso ? iso.split("-").reverse().join(".") : "");
const labelOf = row => `${row.bank_name} · ${row.name}`;
const bad = (status, message, code, extra = {}) => new HttpError(status, message, { code, field: "bankAccountId", ...extra });

/**
 * @param {{ store, accounts, negative: { balancesOf, guardNegative, primeTotals } }} options  accounts: banka hesap servisi (rowOf, carryBoundary)
 */
export function createModuleBank({ store, accounts, negative, legacy = () => false }) {
  const eligible = () => store.all("SELECT id FROM bank_accounts WHERE deleted_at IS NULL AND status = 'active' AND currency = 'TRY' AND kind IN ('demand', 'commercial', 'other') ORDER BY position, created_at").map(row => row.id);

  /** Seçilen hesabın denetimi (yukarıdaki 4). */
  function check(id, date) {
    const row = accounts.rowOf(id);
    if (!row) throw bad(404, "Banka hesabı bulunamadı. Silinmiş ya da başka şirkete ait olabilir.", "bank-account-missing");
    if (row.status !== "active") throw bad(400, `${labelOf(row)} pasif; bu hesaba hareket girmek için önce Banka → Hesaplar'dan Etkinleştir.`, "bank-account-invalid", { accountId: row.id });
    if (row.currency !== "TRY") throw bad(400, `${labelOf(row)} ${row.currency} hesabı; bu işlem yalnız TL hesapla yapılır.`, "bank-currency", { accountId: row.id });
    if (!BANK_FORM_KINDS.has(row.kind)) throw bad(400, `${labelOf(row)}: havale/EFT yalnız Vadesiz, Ticari ya da Diğer TL hesapla yapılır.`, "bank-account-invalid", { accountId: row.id });
    if (date && row.opening_date && date < row.opening_date) {
      throw bad(409, `İşlem tarihi (${dayText(date)}) ${labelOf(row)} hesabının açılışından (${dayText(row.opening_date)}) önce; o tarihteki para açılış bakiyesinin içindedir. Tarihi düzeltin ya da başka hesap seçin.`, "bank-before-opening", { accountId: row.id });
    }
    const closed = accounts.carryBoundary();
    if (date && closed && date < closed) {
      throw bad(409, `İşlem tarihi (${dayText(date)}) ${dayText(closed)} tarihli Devir Kapanışı'ndan önce; o tarihten önceki banka hareketleri açılış bakiyelerinin içinde sayıldı. Hesaba bağlanırsa iki kez sayılır. Tarihi düzeltin (ya da Kurulum Geçmişi'nden kurulumu Geri Al'ın).`, "bank-carry-closed", { accountId: row.id, closedThrough: closed });
    }
    return row.id;
  }

  /** Satırın banka hesabı (fin_ref). previous: { method, finRef } (düzeltmede); changed: yol, tutar ya da tarih değişti mi. */
  function pickRef({ method, value = "", date = "", previous = null, changed = true } = {}) {
    if (String(method || "") !== "bank") return "";
    const id = text(value);
    const before = previous && String(previous.method || "") === "bank" ? String(previous.finRef ?? previous.fin_ref ?? "") : "";
    // Aşama 7–8: satırın kendi (artık pasif olabilen) hesabı parası değişmeden yeniden gönderilirse bağ olduğu gibi kalır.
    if (id && before && id === before && !changed) return before;
    if (id) return check(id, date);
    if (previous && String(previous.method || "") === "bank") {
      // Hızlı Nasıl Bozarım (H3): parası (yol, tutar, tarih) değişen bağlı satır, hesap kimliği gövdede olmasa da hesabın kurallarından geçer
      // (pasif hesap, açılış ve Devir Kapanışı öncesi tarih). Önceden kimlik gönderilince 400/409, gönderilmeyince denetimsiz kalıyordu.
      if (before) return changed ? check(before, date) : before;
      if (!changed) return "";
    }
    // Yalnız testler (config.bankPickLegacy): eski sürüm gibi hesap verilmeyen havale hesapsız yazılır (Aşama 2–4 testlerinin eski hareketleri).
    if (legacy()) return "";
    const ids = eligible();
    if (!ids.length) return "";
    if (ids.length > 1) throw bad(400, "Banka Hesabı seçin: havale/EFT hangi hesaba girdi ya da hangi hesaptan çıktı?", "bank-account-required");
    return check(ids[0], date);
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

  return { pickRef, negative: negativeGuard, eligible };
}

const NOOP_GUARD = Object.freeze({ capture() {}, guard: null, prime() {} });
/**
 * Modül rotalarının ortak bankalı yazım yardımcıları (Aşama 7–8: fatura peşini, taksit ve kayıt tahsilatı, stok peşini, çek tahsil/ödeme; cari
 * rotası Aşama 5'te aynı kuralları kendi içinde kurdu). bankModule: istek anında context.bankAccounts.module (rotalar banka rotalarından önce kurulur).
 *   ref({ method, value, date, previous, changed })  → fin_ref (pickRef; banka modülü yoksa '')
 *   negative(refs, date, force)                     → K7 { capture, guard, prime } (banka modülü yoksa etkisiz)
 *   requireOut(user, out, ref)                      → bankadan çıkış "Banka Hareketi Girme ve Bankadan Çıkış" (bank.move) ister (403 bank-permission)
 *   forced(body, url)                               → negativeOk (gövde ya da ?negativeOk=1)
 *   requestId(req, body)                            → x-hof-request ya da gövdedeki requestId
 *   eligible()                                      → seçilebilir hesaplar (K7 ön yakalamada "tek hesapta kendiliğinden" seçimi kapsamak için)
 */
export function bankForm(bankModule = () => null) {
  const module = () => bankModule?.() || null;
  return {
    ref: (options = {}) => module()?.pickRef(options) || "",
    negative: (refs = [], date = "", force = false) => module()?.negative({ refs, date, force }) || NOOP_GUARD,
    requireOut(user, out, ref) {
      if (out && ref && !canUser(user, "bank.move")) throw new HttpError(403, "Bankadan ödeme için \"Banka Hareketi Girme ve Bankadan Çıkış\" yetkisi gerekir.", { code: "bank-permission", permission: "bank.move" });
    },
    forced: (body, url) => body?.negativeOk === true || url?.searchParams?.get("negativeOk") === "1",
    requestId: (req, body) => text(req?.headers?.["x-hof-request"]) || text(body?.requestId),
    eligible: () => module()?.eligible() || [],
  };
}
