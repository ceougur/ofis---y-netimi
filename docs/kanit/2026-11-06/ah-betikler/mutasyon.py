#!/usr/bin/env python3
# AH + BS-6 mutasyonları: ah-mut kopyasında (çalışma ağacı değil) asıl dosyadan başlayıp tek bir bilinçli hata enjekte eder.
#   python3 mutasyon.py <ah-mut kökü> <mutasyon adı>   (adı "asil" → geri yükler)
import shutil
import sys

root, name = sys.argv[1], sys.argv[2]
inv = f"{root}/server/routes/invoices.mjs"
db = f"{root}/server/lib/db.mjs"
shutil.copyfile(f"{root}/invoices.asil.mjs", inv)
shutil.copyfile(f"{root}/db.asil.mjs", db)
M = {
    # kart atlanır: her ikinci aday hiç değerlendirilmez
    "M1-kart-atlanir": (inv, "    for (const row of rows) {\n      const refunds = refundsOf.get(row.id) || 0;", "    for (const row of rows.filter((_, index) => index % 2 === 0)) {\n      const refunds = refundsOf.get(row.id) || 0;"),
    # işlem sırası ters: adaylar ters sırayla onarılır
    "M2-sira-ters": (inv, "    for (const row of rows) {\n      const refunds = refundsOf.get(row.id) || 0;", "    for (const row of [...rows].reverse()) {\n      const refunds = refundsOf.get(row.id) || 0;"),
    # iptal edilmiş iadenin geri ödemesi sayılır
    "M3-iptal-iade-sayilir": (inv, "WHERE r.kind = 'sale_return' AND r.status = 'issued' AND r.original_id <> '' ORDER BY r.rowid, e.rowid", "WHERE r.kind = 'sale_return' AND r.original_id <> '' ORDER BY r.rowid, e.rowid"),
    # fazla tahsilat (excess) yok sayılır
    "M4-fazla-yok-sayilir": (inv, "const signed = roundMoney(state.open - state.excess + (legacyClosing ? refunds : 0));\n      return { target:", "const signed = roundMoney(state.open + (legacyClosing ? refunds : 0));\n      return { target:"),
    # yazılan carinin bayat toplu durumu kullanılır (kirli işareti yok)
    "M5-kirli-yok": (inv, "          dirty.add(store.get(\"SELECT account_id AS accountId FROM plans WHERE id = ?\", row.planId)?.accountId || \"\");\n          for (const owner of store.all(\"SELECT DISTINCT account_id AS accountId FROM invoices WHERE plan_id = ?\", row.planId)) dirty.add(owner.accountId || \"\");", ""),
    # eleme sonrası cari başına yeniden okuma yok + üst sınır (before) düşer
    "M6-ust-sinir-yok": (inv, "      if (!(left > target + 0.005) || left > before + 0.005) continue;\n      if (!exact) {", "      if (!(left > target + 0.005)) continue;\n      if (false) {"),
    # geri ödeme: giriş satırları da sayılır (kind 'in')
    "M7-giris-sayilir": (inv, "JOIN account_entries e ON e.source = 'invoice' AND e.source_id = r.id AND e.kind = 'out'", "JOIN account_entries e ON e.source = 'invoice' AND e.source_id = r.id AND e.kind IN ('out', 'in')"),
    # geri ödeme eksik sayılır: iki iadeli faturada yalnız büyük iadenin geri ödemesi
    "M8-geri-odeme-eksik": (inv, "      out.set(originalId, (out.get(originalId) || 0) + roundMoney(sum));", "      out.set(originalId, Math.max(out.get(originalId) || 0, roundMoney(sum)));"),
    # elemede yanlış alan: açık yerine fatura tutarı (yanlış negatif — onarılması gereken kart elenir)
    # parça sınırı: her parçanın son carisi okunmaz (eleme o carinin adaylarını cari başına yola düşürmez, durum yok sayılır)
    "M11-parca-siniri": (inv, "      const chunk = accountIds.slice(at, at + step);", "      const chunk = accountIds.slice(at, at + step - 1);"),
    # BS-6: store.run'da işlem denetimi yok
    "B1-run-denetimi-yok": (db, "    run: (sql, ...args) => {\n      assertLive();", "    run: (sql, ...args) => {"),
    # BS-6: iç store.tx'te SAVEPOINT öncesi denetim yok
    "B2-savepoint-denetimi-yok": (db, "        assertLive();\n        db.exec(`SAVEPOINT ${savepoint}`);", "        db.exec(`SAVEPOINT ${savepoint}`);"),
    "M10-eleme-yanlis-alan": (inv, "if (found) state = { open: Number(found.open) || 0, excess: Number(found.excess) || 0 };", "if (found) state = { open: Number(found.payable) || 0, excess: Number(found.excess) || 0 };"),
}
if name != "asil":
    path, old, new = M[name]
    text = open(path, encoding="utf8").read()
    assert text.count(old) == 1, f"{name}: kalıp {text.count(old)} kez"
    open(path, "w", encoding="utf8").write(text.replace(old, new))
print(name)
