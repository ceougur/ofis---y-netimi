import sys, shutil
# Kullanım: python3 -I mutant.py <mut kökü> <ad> — kaynak dosyayı yedekten (.orj) geri koyar, adı verilen mutantı uygular ("geri" = yalnız geri koy).
root, name = sys.argv[1], sys.argv[2]
Q = f"{root}/server/lib/obligation-queue.mjs"
D = f"{root}/server/lib/invoice-settle.mjs"
for p in (Q, D):
    try:
        shutil.copyfile(p + ".orj", p)
    except FileNotFoundError:
        shutil.copyfile(p, p + ".orj")
MUT = {
    # M1: sıra 3'te tutulan kısım yok sayılır (bağlı ödeme kartın kısmını da kapatır — taban davranışı).
    "M1": (Q, ": order === 3 ? linkHolds.get(target.key) || 0 : 0;", ": 0;"),
    # M2: kapama defterinde bağlı ödeme kapsanan kısmı da kapatır.
    "M2": (D, "if (freeOnly) continue;", ""),
    # M3: kuyrukta iadeden sonra yazılmış bağlı ödeme ertelenmez (K1 sırası).
    "M3": (Q, "const deferred = link => link.order === 3 && firstReturn.has(link.targetKey)", "const deferred = link => false && firstReturn.has(link.targetKey)"),
    # M4: sıra 3 kesildiyse sıra 4'ün koruması yok.
    "M4": (Q, "capped.has(target.key) ? linkHolds.get(target.key) || 0 : 0", "0"),
    # M5: defterde 'fazla' kapsanan açıkla düzeltilmez.
    "M5": (D, "if (coveredLeft > 0) overpaid.set(owner, Math.max(0, value - coveredLeft));", ""),
    # M6: defterde iadeden sonra yazılmış bağlı ödeme ertelenmez.
    "M6": (D, "const lateLink = payment => !payment.returnId && firstReturn.has(payment.owner)", "const lateLink = payment => false && firstReturn.has(payment.owner)"),
}
if name != "geri":
    path, old, new = MUT[name]
    s = open(path).read()
    assert s.count(old) == 1, (name, s.count(old))
    open(path, "w").write(s.replace(old, new))
print("uygulandı", name)
