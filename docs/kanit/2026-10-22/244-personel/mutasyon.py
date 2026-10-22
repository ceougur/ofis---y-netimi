import sys,subprocess,shutil
M=sys.argv[1]
src=open('/home/user/wt/personel/server/routes/staff.mjs',encoding='utf8').read()
muts=[
 ("M1 Toplam Maaş ayrılanı da sayar","salaryMinor: active.reduce(","salaryMinor: items.reduce("),
 ("M2 işlem geçmişine değer yazılır","audit(user, \"staff.created\", id, { fields: filled.map(key => STAFF_FIELDS[key]) });","audit(user, \"staff.created\", id, { fields: filled.map(key => String(values[key])) });"),
 ("M3 düzenleme görüntülemesiz yazar","    auth.requirePermission(req, \"staff.view\");\n    return user;","    return user;"),
 ("M4 TC denetimi kapalı","if (tc && !isValidTckn(tc))","if (false)"),
 ("M5 ayrılış < giriş serbest","if (values.leaveDate && values.hireDate && values.leaveDate < values.hireDate)","if (false)"),
 ("M6 yaş doğum gününü beklemez","  if (tm < bm || (tm === bm && td < bd)) age -= 1;\n",""),
 ("M7 aynı TC serbest","    if (other) throw","    if (false) throw"),
 ("M8 durum ayrılış tarihinden türemez","status: row.leave_date ? \"left\" : \"active\"","status: \"active\""),
]
for name,a,b in muts:
    assert src.count(a)==1,(name)
    open(M+'/server/routes/staff.mjs','w',encoding='utf8').write(src.replace(a,b))
    r=subprocess.run(['node','--test','--disable-warning=ExperimentalWarning','test/personel-ozluk-244.test.mjs'],cwd=M,capture_output=True,text=True)
    out=r.stdout
    fail=[l for l in out.splitlines() if l.startswith('# fail')]
    print(f"{name}: çıkış {r.returncode} {fail[0] if fail else '?'} -> {'YAKALANDI' if r.returncode!=0 else 'YAKALANMADI'}")
open(M+'/server/routes/staff.mjs','w',encoding='utf8').write(src)
r=subprocess.run(['node','--test','--disable-warning=ExperimentalWarning','test/personel-ozluk-244.test.mjs'],cwd=M,capture_output=True,text=True)
print("geri alınmış kod: çıkış",r.returncode,[l for l in r.stdout.splitlines() if l.startswith('# fail')])
