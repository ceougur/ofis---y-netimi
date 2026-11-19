import sys
W = '/home/user/ofis---y-netimi/.claude/worktrees/agent-a21e56c46518ba374/'
def edit(rel, pairs):
    p = W + rel
    s = open(p, encoding='utf-8').read()
    for a, b in pairs:
        assert s.count(a) == 1, (rel, a[:80])
        s = s.replace(a, b)
    open(p, 'w', encoding='utf-8').write(s)

edit('server/lib/doubtful-gl.mjs', [(
'''/**
 * Karar 15.10.2026 (plan §3.11b/2): tahsilat satırı şüpheliden düşmeyip 120'de kalır mı? Kullanıcı işareti (doubtful_skip = 1, "Normal Cari
 * Hesaba İşle") ya da fatura peşini (source 'invoice'). Yalnız tahsilat ('in') satırında anlamlı.
 * 2.5.0 Ç5-A tur 3c (S25 (c), S39, S168 = B; C5-ACILIS-TASARIM §19.1): Kapatılacak Fatura bağı (invoice_id) artık "her zaman 120" DEĞİL — bağlı satır ayırıcıya girer, faturanın kuyrukta
 * şüpheli sayılan kısmı önce 128'den düşer (allocateDoubtful `linked`); invoiceId alanı imzada kalır (çağıranlar aynı), sonucu etkilemez.
 * SQL ikizi: lib/bank/doubtful.mjs doubtfulCredits (e.doubtful_skip = 0 AND e.source <> 'invoice').
 */
export const doubtfulSkipOf = ({ kind, source = "", invoiceId: _invoiceId = "", doubtfulSkip = 0 } = {}) =>
  kind === "in" && (doubtfulSkip === true || Number(doubtfulSkip) === 1 || source === "invoice");
''',
'''/**
 * Karar 15.10.2026 (plan §3.11b/2): tahsilat satırı "Normal Cariye İşlendi" mi? Kullanıcı işareti (doubtful_skip = 1, "Normal Cari Hesaba İşle"),
 * fatura peşini (source 'invoice') ya da Kapatılacak Fatura bağı (invoice_id). Yalnız tahsilat ('in') satırında anlamlı.
 * 2.5.0 Ç5-A tur 3c (S25 (c), S39, S168 = B; C5-ACILIS-TASARIM §19): DEFTERİN 120 / 128 ayrımı artık bunu DEĞİL doubtfulKeepOf'u okur — Kapatılacak Fatura bağlı satır ayırıcıya
 * girer, faturanın kuyrukta şüpheli sayılan kısmı önce 128'den düşer (allocateDoubtful `linked`). Bu işlev yalnız cari kartının "Normal Cariye İşlendi" etiketinin (routes/accounts.mjs
 * detail — bu turun dosya sınırı dışında; etiketin ayırıcıdan okunması BAŞ MİMAR KARARI bekliyor) bugünkü tanımı olarak kalır.
 */
export const doubtfulSkipOf = ({ kind, source = "", invoiceId = "", doubtfulSkip = 0 } = {}) =>
  kind === "in" && (doubtfulSkip === true || Number(doubtfulSkip) === 1 || source === "invoice" || Boolean(invoiceId));
/**
 * 2.5.0 Ç5-A tur 3c (§19.1): tahsilat satırı şüpheliden HİÇ düşmeyip tamamı 120'de kalır mı (defterin ayırıcısı)? "Normal Cari Hesaba İşle" işareti ya da fatura peşini (15.10.2026
 * kararı, değişmez). Kapatılacak Fatura bağı burada YOK: bağlı satırın payı ayırıcının `linked` kuralıyla. SQL ikizi: lib/bank/doubtful.mjs doubtfulCredits (e.doubtful_skip = 0 AND e.source <> 'invoice').
 */
export const doubtfulKeepOf = ({ kind, source = "", doubtfulSkip = 0 } = {}) =>
  kind === "in" && (doubtfulSkip === true || Number(doubtfulSkip) === 1 || source === "invoice");
''')])

edit('server/lib/general-ledger.mjs', [
('import { DOUBTFUL_CHART, DOUBTFUL_GL, applyDoubtfulToJournal, doubtfulSkipOf } from "./doubtful-gl.mjs";',
 'import { DOUBTFUL_CHART, DOUBTFUL_GL, applyDoubtfulToJournal, doubtfulKeepOf } from "./doubtful-gl.mjs";'),
('''      // Karar 15.10.2026 (plan §3.11b/2; lib/doubtful-gl.mjs doubtfulSkipOf): "Normal Cari Hesaba İşle" işaretli tahsilat, fatura peşini ve
      // Kapatılacak Fatura bağlı tahsilat şüpheliden düşmez (A 120 kalır); ayırma kuralı bu işareti okur. SQL ikizi doubtfulCredits.
      const n = out.length;
      post(id, row.date, "Cari tahsilat", row.note, moneyOf(row), control, row.amount);
      if (out.length > n && doubtfulSkipOf(row)) out[out.length - 1].doubtful = { skip: true };''',
'''      // Karar 15.10.2026 (plan §3.11b/2): "Normal Cari Hesaba İşle" işaretli tahsilat ve fatura peşini şüpheliden düşmez (A 120 kalır); ayırma kuralı bu işareti okur.
      // 2.5.0 Ç5-A tur 3c (S25 (c), S39, S168 = B): Kapatılacak Fatura bağlı tahsilat ayırıcıya girer (lib/doubtful-gl.mjs doubtfulKeepOf / `linked`). SQL ikizi doubtfulCredits.
      const n = out.length;
      post(id, row.date, "Cari tahsilat", row.note, moneyOf(row), control, row.amount);
      if (out.length > n && doubtfulKeepOf(row)) out[out.length - 1].doubtful = { skip: true };'''),
])

edit('server/routes/accounts.mjs', [
('import { doubtfulSkipOf } from "../lib/doubtful-gl.mjs";', 'import { doubtfulKeepOf, doubtfulSkipOf } from "../lib/doubtful-gl.mjs";'),
('    const flagged = doubtfulSkipOf({ kind: "in", doubtfulSkip: input.doubtfulSkip });', '    const flagged = doubtfulKeepOf({ kind: "in", doubtfulSkip: input.doubtfulSkip });'),
('      ? (doubtfulSkipOf({ kind: "in", source: previous.source, invoiceId: previous.invoiceId, doubtfulSkip: previous.doubtfulSkip })',
 '      ? (doubtfulKeepOf({ kind: "in", source: previous.source, doubtfulSkip: previous.doubtfulSkip })'),
])
print('ok')
