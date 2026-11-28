# Tur 4'ün mutant.py'sinden tur 5'in mutant.py'sini üretir: tur 2–4 mutantları AYNEN (metni tur 5'te değişen dört mutant yeni koddaki karşılığına UYARLANIR — adları "-t5" ekiyle),
# sonra tur 5'in yenileri. Çıktı: docs/kanit/2026-11-28/m2t5-arac/mutant.py
import sys
src, dst = sys.argv[1], sys.argv[2]
s = open(src, encoding="utf-8").read()
s = s.replace('M = "/dev/shm/m2t4-a752/mut"', 'M = "/dev/shm/m2t5-mut/mut"')
s = s.replace('K = "/tmp/claude-0/-home-user/de5e1cbf-7e68-5683-b7bb-f27655eaed4f/scratchpad/m2t4-ajan/kanit/mutant"', 'K = "/tmp/claude-0/-home-user/de5e1cbf-7e68-5683-b7bb-f27655eaed4f/scratchpad/m2t5/kanit/mutant"')
s = s.replace('# M2T4 mutasyon: tur 2 + 3\'ün mutantları AYNEN (metinleri docs/kanit/2026-11-28/m2t3-arac/mutant.py) + tur 4\'ün yenileri. Her mutant /dev/shm/m2t4-a752/mut kopyasında (tur 4 HEAD)',
              '# M2T5 mutasyon (docs/kanit/2026-11-28/m2t4-arac/mutant.py\'den üretildi): tur 2–4 mutantları AYNEN + tur 5\'in yenileri. Her mutant /dev/shm/m2t5-mut/mut kopyasında (tur 5 kodu)')
s = s.replace('"test/supheli-degersiz-m2t4-251.test.mjs"]', '"test/supheli-degersiz-m2t4-251.test.mjs", "test/supheli-degersiz-m2t5-251.test.mjs"]')
adapt = {
  '("M16-silinenler-taramasi-eski-hali", D, "      return store.get(WRITE_OFF_TRASH_SQL, party, since)?.at || \\"\\";", "      return store.get(\\"SELECT MAX(deleted_at) AS at FROM trash WHERE kind = \'invoice\' AND instr(payload_json, ?) > 0\\", party)?.at || \\"\\";"),':
  '("M16-t5-silinenler-taramasi-eski-hali", D, "    const at = store.get(WRITE_OFF_TRASH_SQL, wanted[0].party, wanted[0].since)?.at || \\"\\";", "    const at = store.get(\\"SELECT MAX(deleted_at) AS at FROM trash WHERE kind = \'invoice\' AND instr(payload_json, ?) > 0\\", wanted[0].party)?.at || \\"\\";"),',
  '("M16c-daraltma-en-son-satirdan", D, "    const since = own[0].at;", "    const since = own[own.length - 1].at;"),':
  '("M16c-t5-daraltma-en-son-satirdan", D, "    if (since !== null && line.at >= since) continue;", "    if (since !== null && line.at <= since) continue;"),',
  '("M18-borc-yaz-silme-denetimi-yok", A, "const writeOffGuard = previous.kind === \\"debt\\" ? writeOffBalanceGuard(store, account.id, { action: \\"entry-delete\\" }) : null;", "const writeOffGuard = null;"),':
  '("M18-t5-borc-yaz-silme-denetimi-yok", A, "const writeOffGuard = WRITE_OFF_GUARDED.delete.has(previous.kind) ? writeOffBalanceGuard(store, account.id, { action: \\"entry-delete\\", kind: guardKindOf(previous) }) : null;", "const writeOffGuard = null;"),',
  '("M18b-borc-yaz-duzeltme-denetimi-yok", A, "const writeOffGuard = previous.kind === \\"debt\\" ? writeOffBalanceGuard(store, account.id, { action: \\"entry-edit\\" }) : null;", "const writeOffGuard = null;"),':
  '("M18b-t5-borc-yaz-duzeltme-denetimi-yok", A, "const writeOffGuard = WRITE_OFF_GUARDED.edit.has(previous.kind) ? writeOffBalanceGuard(store, account.id, { action: \\"entry-edit\\", kind: guardKindOf(previous) }) : null;", "const writeOffGuard = null;"),',
}
for a, b in adapt.items():
    assert s.count(a) == 1, a[:60]
    s = s.replace(a, b)
new = '''  # --- tur 5 ---
  ("M20-odeme-silme-denetimi-yok", A, "delete: new Set([\\"debt\\", \\"out\\"])", "delete: new Set([\\"debt\\"])"),
  ("M21-alacak-artirma-denetimi-yok", A, "edit: new Set([\\"debt\\", \\"out\\", \\"credit\\"])", "edit: new Set([\\"debt\\", \\"out\\"])"),
  ("M21b-odeme-duzeltme-denetimi-yok", A, "edit: new Set([\\"debt\\", \\"out\\", \\"credit\\"])", "edit: new Set([\\"debt\\", \\"credit\\"])"),
  ("M22-otomatik-dagit-denetimi-yok", P, "writeOffGuard = plan.accountId ? writeOffBalanceGuard(store, plan.accountId, { action: \\"plan-distribute\\" }) : null;", "writeOffGuard = null;"),
  ("M22b-otomatik-dagit-denetlenmeden-yazar", P, "      writeOffGuard?.check();\\n      audit(user, \\"plan.distributed\\"", "      audit(user, \\"plan.distributed\\""),
  ("M23-silinenler-taramasi-tur4-hali", D, "  const trashAt = writeOffTrashMax(store, prepared, has(\\"trash\\"));", "  const trashAt = new Map(prepared.map(item => [item.party, has(\\"trash\\") ? store.get(WRITE_OFF_TRASH_SQL, item.party, item.own[0].at)?.at || \\"\\" : \\"\\"]));"),
  ("M23b-gereken-satir-daraltmasi-yok", D, "  if (!unbondIds.size) return null;\\n  let since = null;", "  if (true) return own[0].at;\\n  let since = null;"),
  ("M23c-tek-gecis-cari-kosulu-yok", D, "if (row.at >= since && (!out.has(party) || row.at > out.get(party)) && body.includes(party)) out.set(party, row.at);", "if (row.at >= since && (!out.has(party) || row.at > out.get(party))) out.set(party, row.at);"),
  ("M24-ileti-sozcugu-borc-hareketi", D, "}[kind && kind !== \\"debt\\" ? `${action}:${kind}` : action]", "}[action]"),
  ("M25-kart-iadesi-silme-denetimi-yok", P, "const writeOffGuard = previous.kind === \\"out\\" && plan.accountId ? writeOffBalanceGuard(store, plan.accountId, { action: \\"plan-entry-delete\\" }) : null;", "const writeOffGuard = null;"),
  ("M25b-kart-iadesi-duzeltme-denetimi-yok", P, "const writeOffGuard = previous.kind === \\"out\\" && plan.accountId ? writeOffBalanceGuard(store, plan.accountId, { action: \\"plan-entry-edit\\" }) : null;", "const writeOffGuard = null;"),
  ("M27-alis-faturasi-artirma-denetimi-yok", I, ": existing.kind === \\"purchase\\" && decrease < -0.005", ": false && decrease < -0.005"),
  ("M26-pos-iadesi-sozcugu-yok", A, "(previous.kind === \\"out\\" && posRefundOf(null, previous) ? \\"pos-refund\\" : previous.kind)", "(previous.kind)"),
]
'''
anchor = ']\nonly = sys.argv[1:]'
assert s.count(anchor) == 1
s = s.replace(anchor, new[:-2] + anchor)
open(dst, "w", encoding="utf-8").write(s)
print("tamam")
