#!/usr/bin/env python3
# Tur 2f mutantları: tur 2f ucunun AYRIK git çalışma ağacında (/dev/shm/c5a2f-k1/mut; `git worktree add --detach` — v2.4.9 etiketi için, depo değişkeni YOK, ders 54) her mutant için
# tek dosyada metin değişikliği → testler (TZ verilen) → dosya özgün içeriğine geri yazılır. Kullanım: python3 -I mutant.py <TZ> <koşu etiketi> [mutant adı …]
import os, re, subprocess, sys, pathlib
WT = "/dev/shm/c5a2f-k1/mut"
LO = "server/lib/ledger-opening.mjs"
SN = "server/lib/ledger-snapshots.mjs"
LG = "server/routes/ledger.mjs"
TESTS = os.environ.get("MUT_TESTS", "test/kural-farki-yil-250.test.mjs test/kural-farki-duzeltme-250.test.mjs").split()
M = {
    # S185 yön 1: fişin yılı > eşleme yılında fiş satırları yine eşlenmiş toplamdan düşülür (tur 2e davranışı)
    "S1-gec-yil-dusulur": [(LO, "    if (Number(postYear) > year) continue;\n", ""), (LO, ".filter(([postYear]) => Number(postYear) > year)", ".filter(() => false)")],
    # DÜŞÜK-1: ipucu eski metin (kilitli fişe de 'ters kaydedin')
    "S2-ipucu-eski": [(SN, "const locked = Boolean(lock) && corrections.active.some(voucher => String(voucher.date) <= lock);", "const locked = false;")],
    # fazla fiş fazla sayılmaz (kısmi kapama uygulanır)
    "S3-fazla-sayilmaz": [(LO, "    if (over.debit || over.credit) {\n", "    if (false) {\n")],
    # fazla varken satırlar yine önerilir
    "S4-fazla-satir": [(LO, "if (!minor || ownYearOver.length) continue;", "if (!minor) continue;")],
    # bölünmüş kova: kalan ilk hesaba (karar söylemiyor — bugünkü kural sabit)
    "S5-bolunmus-ilk": [(LO, "      else split = true;\n", "      else apply.push([item.keys[0], covered]);\n")],
    # ön izleme nedeni yok (fazla varken 'rule-diff-nothing')
    "S6-neden-yok": [(LG, "    else if (plan.ownYearOver?.length) {\n", "    else if (false) {\n")],
    # eşleme yılının 6 / 7 sınıfı farkı fişin yılında 671 / 681'e çevrilmez
    "S7-kova-cevrilmez": [(LO, "!PRIOR_YEAR_SET.has(key.split(\"|\")[0]) ? priorOf(minor) : key", "!PRIOR_YEAR_SET.has(key.split(\"|\")[0]) ? key : key")],
    # Yönetim satırı kendi yılı ipucunu vermez (eski 'fazla' dalına düşer)
    "S8-kendi-ipucu-yok": [(SN, "        if (ownYearMinor) {\n", "        if (false) {\n")],
    # dar kontrol c5a2e: K-c (Yönetim satırının yılı = son etkin fişin yılı)
    "K-c-satir-yili": [(SN, "const year = ruleDiffCorrectionYear({ lock, cover, today: period?.today?.() || \"\" });", "const year = corrections.active.length ? corrections.active.at(-1).year : ruleDiffCorrectionYear({ lock, cover, today: period?.today?.() || \"\" });")],
    # dar kontrol c5a2e: P3 (671 / 681 yönü ham farktan)
    "P3-yon-ham": [(LO, "for (const [, minor] of prior) if (minor) add(due, priorOf(minor), minor);", "for (const [k, minor] of prior) if (minor) add(due, priorOf(result.get(k) || minor), minor);")],
    # dar kontrol c5a2e: Y2 (donmuş dönem kilitten önce)
    "Y2-ortu-once": [(LO, "nextDayOf(lock || cover)", "nextDayOf(cover || lock)")],
}
def run(tz):
    env = {k: v for k, v in os.environ.items() if k not in ("GIT_DIR", "GIT_WORK_TREE")}
    env.update(TZ=tz, HUKUK_LICENSE_URL="http://127.0.0.1:9")
    r = subprocess.run(["timeout", "-k", "5", "1500", "node", "--disable-warning=ExperimentalWarning", "--test", "--test-reporter=tap", *TESTS], cwd=WT, capture_output=True, text=True, env=env)
    txt = r.stdout + r.stderr
    nums = {k: int(m.group(1)) for k in ("tests", "pass", "fail", "cancelled") if (m := re.search(rf"^# {k} (\d+)", txt, re.M))}
    fails = re.findall(r"^    not ok \d+ - (\[[^\]]+\])", txt, re.M)
    msgs = [re.sub(r"\s+", " ", m)[:300] for m in re.findall(r"^    not ok \d+ - \[[^\]]+\].*?\n      error: (.*?)\n      code:", txt, re.M | re.S)]
    return r.returncode, nums, fails, msgs
def main():
    tz, tag, *names = sys.argv[1:]
    names = names or ["taban", *M]
    for name in names:
        changes = M.get(name, [])
        orig = {}
        try:
            for f, old, new in changes:
                p = pathlib.Path(WT, f)
                s = orig.setdefault(f, p.read_text(encoding="utf-8")) if f not in orig else p.read_text(encoding="utf-8")
                if s.count(old) != 1:
                    raise SystemExit(f"{name}: KALIP {s.count(old)} kez ({f})")
                p.write_text(s.replace(old, new), encoding="utf-8")
            code, nums, fails, msgs = run(tz)
        finally:
            for f, s in orig.items():
                pathlib.Path(WT, f).write_text(s, encoding="utf-8")
        killed = code != 0 or nums.get("fail", 0) > 0
        verdict = "ÖLDÜ" if killed else "YAŞADI"
        if name == "taban":
            verdict = "TABAN YEŞİL" if not killed else "TABAN KIRMIZI (GEÇERSİZ)"
        print(f"== [{tag}] {name} (TZ {tz}): {verdict} · çıkış {code} {nums} · düşen: {' '.join(fails)}")
        for m in msgs[:3]:
            print(f"     · {m}")
        sys.stdout.flush()
main()
