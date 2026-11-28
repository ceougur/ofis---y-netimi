# M2T2 komşu listesi (ders 10): git grep taramaları (komsu-supheli.txt: doubtful / Değersiz / write-off; komsu-fatura.txt: /cancel / sale_return) + kapı ve şema kapısı / geri yükleme.
D = "/tmp/claude-0/-home-user/de5e1cbf-7e68-5683-b7bb-f27655eaed4f/scratchpad/m2t2/"
sup = [l.strip() for l in open(D + "komsu-supheli.txt") if l.strip()]
fat = [l.strip() for l in open(D + "komsu-fatura.txt") if l.strip()]
keys = ["iade", "iptal", "fatura-2", "s160", "s229", "ux18", "supheli-240", "goc-246", "gg243-dar2", "stopaj-tevkifat-iade"]
fat_pick = [f for f in fat if any(k in f for k in keys)]
extra = ["test/banka-210-gg-kapi.test.mjs", "test/banka-210-kapi-kapsam.test.mjs", "test/banka-220-tahsile-ver-dogrulama.test.mjs", "test/donem-213.test.mjs", "test/mutabakat-213.test.mjs",
         "test/sema-kapisi-bs7.test.mjs", "test/banka-210-gg-geri-yukle.test.mjs", "test/geri-yukleme-uyari-244.test.mjs", "test/isgecmisi-230-geri-yukleme-yetki.test.mjs"]
out = sorted(set(sup + fat_pick + extra) - {"test/supheli-degersiz-hiz-m2t2-251.test.mjs", "test/supheli-degersiz-iptal-iade-m2t2-251.test.mjs"})
open(D + "komsu-liste.txt", "w").write("\n".join(out) + "\n")
print(len(out), "dosya;", "fatura seçilen:", len(fat_pick), "/", len(fat))
print(" ".join(f for f in fat if f not in fat_pick))
