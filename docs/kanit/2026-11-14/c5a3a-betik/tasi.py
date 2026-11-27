#!/usr/bin/env python3
# Ç5-A tur 3a: routes/invoices.mjs'teki girdi kurucusu bloklarını BAYT BAYT lib/obligation-input.mjs'e taşır (kullanım: python3 -I tasi.py <worktree kökü>).
import sys, os
root = sys.argv[1]
inv_path = os.path.join(root, 'server/routes/invoices.mjs')
src = open(inv_path, encoding='utf-8').read()
lines = src.split('\n')
def block(a, b):  # 1 tabanlı, iki uç dahil
    return lines[a-1:b]
# Taban (c5a3a-taban) satırlarının beklenen başları — kayma varsa dur.
checks = {631: '  // v2.0.17: mahsup fişinin', 632: '  function offsetLabel(offset) {', 639: '  }', 647: '  // Çek/senet olaylarının kapama girdisi',
          656: '  function chequeLinks(', 733: '  const settleKey = day =>', 740: '  // Kapamanın girdisine TYK', 742: '  const groupInto =',
          844: '  const withExtras =', 845: '  let settledCache =', 986: '  // Bir carinin kapama girdisi', 987: '  function accountSettleInput(', 1009: '  }', 1010: '  function paymentStates(rows) {',
          734: '  // 2.4.5 G8', 739: '  // ---------- 2.5.0 Ç5-B: Tek Yükümlülük Kuyruğu', 640: '  // v2.0.22 (Excel denetimi', 630: '  // Ödeme durumu (kapama)'}
for n, head in checks.items():
    if not lines[n-1].startswith(head):
        sys.exit(f'satır {n} beklenmedik: {lines[n-1][:80]!r}')
moved = block(631, 639) + block(647, 733) + block(740, 844) + block(986, 1009)
names_out = ['offsetLabel', 'chequeLinks', 'settleTables', 'batchSettleInput', 'settleKey', 'lockResolver', 'doubtfulRecordsOf', 'obligationExtras', 'linkTimesOf', 'chequeLinkMoments', 'withExtras', 'accountSettleInput']
header = '''// 2.5.0 Ç5-A tur 3a (tasarım notu docs/erp/C5-ACILIS-TASARIM.md §18.9; BAŞ MİMAR KARARI 13.11 — §18.3 (a)): Tek Yükümlülük Kuyruğu'nun (lib/obligation-queue.mjs buildObligations)
// ve fatura kapamasının (lib/invoice-settle.mjs) GİRDİ KURUCUSU — yalnız store ile kurulur (servis ağacı yok; saat yok — gün parametreyle). Gövdeler routes/invoices.mjs
// registerInvoiceRoutes kapanışından AYNEN taşındı (girinti aynı; kapanış değişkeni yalnız store). Fatura servisi BİR örnek kurar (kilit izi belleği örnekte — ömrü aynı);
// defter yükleyicileri ve işçiler (tur 3b) kendi örneğini kurar: createObligationInput({ store }). Carinin satırları (lib/accounts.mjs accountLedger) çağırandan gelir (§18.9 (4)).
import { parseJson } from "./http.mjs";
import { INVOICE_KINDS } from "./invoice-math.mjs";
import { lockAtOf, lockHistory } from "./obligation-queue.mjs";
import { doubtfulState } from "./bank/doubtful.mjs";
import { dayText } from "./plans.mjs";

export function createObligationInput({ store }) {'''
footer = '''  return { offsetLabel, chequeLinks, settleTables, batchSettleInput, settleKey, lockResolver, doubtfulRecordsOf, obligationExtras, linkTimesOf, chequeLinkMoments, withExtras, accountSettleInput };
}
'''
module = header + '\n' + '\n'.join(moved) + '\n' + footer
inject = ['  // 2.5.0 Ç5-A tur 3a: kuyruğun / kapamanın girdi kurucusu lib/obligation-input.mjs\'te (yalnız store ile kurulur; tasarım §18.9). Servis BİR örnek kurar; aşağıdaki adlar oradan.',
          '  const { offsetLabel, settleTables, batchSettleInput, settleKey, obligationExtras, withExtras, accountSettleInput } = createObligationInput({ store });']
new_lines = lines[:630] + inject + lines[639:646] + lines[733:739] + lines[844:985] + lines[1009:]
new = '\n'.join(new_lines)
# içe aktarımlar
old_q = 'import { CLOSER_MODES, buildObligations, lockAtOf, lockHistory } from "../lib/obligation-queue.mjs";\nimport { doubtfulState } from "../lib/bank/doubtful.mjs";\n'
if new.count(old_q) != 1:
    sys.exit('içe aktarım satırları bulunamadı')
new = new.replace(old_q, 'import { CLOSER_MODES, buildObligations } from "../lib/obligation-queue.mjs";\nimport { createObligationInput } from "../lib/obligation-input.mjs";\n')
open(inv_path, 'w', encoding='utf-8').write(new)
open(os.path.join(root, 'server/lib/obligation-input.mjs'), 'w', encoding='utf-8').write(module)
print('taşınan satır', len(moved), 'kalan fatura satırı', len(new.split('\n')))
