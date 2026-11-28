# m2t6: tur 5 mutant.py'den tur 6 mutant.py üretir (tur 2–5 AYNEN + M27' + tur 6 yenileri).
import os
W = "/home/user/ofis---y-netimi/.claude/worktrees/agent-a961aa7259bce4276"
src = open(os.path.join(W, "docs/kanit/2026-11-28/m2t5-arac/mutant.py"), encoding="utf-8").read()
def rep(a, b):
    global src
    assert src.count(a) == 1, a
    src = src.replace(a, b)
rep("# M2T5 mutasyon (docs/kanit/2026-11-28/m2t4-arac/mutant.py'den üretildi): tur 2–4 mutantları AYNEN + tur 5'in yenileri. Her mutant /dev/shm/m2t5-mut/mut kopyasında (tur 5 kodu)",
    "# M2T6 mutasyon (docs/kanit/2026-11-28/m2t5-arac/mutant.py'den m2t6-arac/mutant-uret.py ile üretildi): tur 2–5 mutantları AYNEN (M27'nin metni tur 6'da değişti → M27p aynı anlamla\n# yeni metinde) + tur 6'nın yenileri. Her mutant /dev/shm/m2t6-mut/mut kopyasında (tur 6 kodu); TZ ortamdan (MUT_TZ, varsayılan UTC); argüman verilirse yalnız o mutantlar.")
rep('M = "/dev/shm/m2t5-mut/mut"', 'M = "/dev/shm/m2t6-mut/mut"')
rep('K = "/tmp/claude-0/-home-user/de5e1cbf-7e68-5683-b7bb-f27655eaed4f/scratchpad/m2t5/kanit/mutant"',
    'TZV = os.environ.get("MUT_TZ", "UTC")\nK = "/tmp/claude-0/-home-user/de5e1cbf-7e68-5683-b7bb-f27655eaed4f/scratchpad/m2t6-kanit/mutant-" + TZV.replace("/", "-")')
rep('"test/supheli-degersiz-m2t5-251.test.mjs"]', '"test/supheli-degersiz-m2t5-251.test.mjs", "test/supheli-degersiz-m2t6-251.test.mjs"]')
NEWC = ': existing.kind === \\"purchase\\" && !(doc.account?.id && doc.account.id !== existing.accountId)'
old27 = '  ("M27-alis-faturasi-artirma-denetimi-yok", I, ": existing.kind === \\"purchase\\" && decrease < -0.005", ": false && decrease < -0.005"),\n'
rep(old27, old27.rstrip("\n") + "  # tur 6 metni değişti: UYGULANAMADI beklenir\n"
    f'  ("M27p-alis-faturasi-denetimi-yok", I, "{NEWC}", ": false"),\n')
tail = '  ("M26-pos-iadesi-sozcugu-yok", A, "(previous.kind === \\"out\\" && posRefundOf(null, previous) ? \\"pos-refund\\" : previous.kind)", "(previous.kind)"),\n]'
rep(tail, tail[:-1] +
    '  # --- tur 6 ---\n'
    f'  ("M28-alis-tutar-kosulu-geri-geldi", I, "{NEWC}", ": existing.kind === \\"purchase\\" && decrease < -0.005"),\n'
    '  ("M29-alis-ileti-sozu-tutarin-artirilmasi", D, "op: \\"alış faturasının düzenlenmesi\\"", "op: \\"alış faturasının tutarının artırılması\\""),\n'
    f'  ("M30-alis-cari-degisiminde-de-denetim", I, "{NEWC}", ": existing.kind === \\"purchase\\""),\n'
    f'  ("M31-alis-yalniz-tutar-duserken", I, "{NEWC}", ": existing.kind === \\"purchase\\" && decrease > 0.005"),\n'
    ']')
rep('env = dict(os.environ, TZ="UTC",', 'env = dict(os.environ, TZ=TZV,')
open(os.path.join(W, "docs/kanit/2026-11-28/m2t6-arac/mutant.py"), "w", encoding="utf-8").write(src)
print("yazıldı")
