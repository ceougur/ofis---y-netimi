import sys,subprocess
M=sys.argv[1]
f=M+'/server/routes/staff.mjs'
src=open(f,encoding='utf8').read()
muts=[
 ("M9 ayrılış günü hâlâ çalışıyor (>=)","if (today && leaveDate > today)","if (today && leaveDate >= today)"),
 ("M10 ileri tarih de hemen ayrılır (eski davranış)","if (today && leaveDate > today)","if (false)"),
 ("M11 Ayrılacak'ın maaşı Toplam Maaş'a girmez","salaryMinor: active.reduce((sum, item) => sum + item.salaryMinor, 0)","salaryMinor: active.filter(item => !item.leaving).reduce((sum, item) => sum + item.salaryMinor, 0)"),
 ("M12 'Ayrılacak olarak işaretlendi' bildirilmez",": after.leaving && !before.leaving ? \"leaving\" : \"\"",": \"\""),
 ("M13 bugün yerine sabit saat (gün ilerlemez)","const today = () => (typeof now.today === \"function\" ? now.today() : new Date().toISOString().slice(0, 10));","const today = () => \"2026-10-22\";"),
]
for name,a,b in muts:
    assert src.count(a)==1,name
    open(f,'w',encoding='utf8').write(src.replace(a,b))
    r=subprocess.run(['node','--test','--disable-warning=ExperimentalWarning','test/personel-ozluk-244.test.mjs'],cwd=M,capture_output=True,text=True)
    fail=[l for l in r.stdout.splitlines() if l.startswith('# fail')]
    print(f"{name}: çıkış {r.returncode} {fail[0] if fail else '?'} -> {'YAKALANDI' if r.returncode else 'YAKALANMADI'}")
open(f,'w',encoding='utf8').write(src)
r=subprocess.run(['node','--test','--disable-warning=ExperimentalWarning','test/personel-ozluk-244.test.mjs'],cwd=M,capture_output=True,text=True)
print("geri alınmış kod: çıkış",r.returncode,[l for l in r.stdout.splitlines() if l.startswith('# fail')])
