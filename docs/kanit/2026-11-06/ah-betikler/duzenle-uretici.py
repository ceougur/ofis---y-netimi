import sys
p = sys.argv[1]
s = open(p, encoding="utf8").read()
old_block_start = s.index("      // Her altıncı caride: açık hesap satışı")
old_block_end = s.index("    const lockedUntil = addDays(T, -30);")
block = s[old_block_start:old_block_end]
s = s[:old_block_start] + "      if (open) {\n        if (await maybe(\"açık satış iadesi\", api.post(\"/api/workspace/invoices\", { kind: \"sale_return\", accountId: acc.id, originalId: open.id, issueDate: T, lines: [{ originLineId: open.lines[0].id, qty: 3 }], payment: { cash: nakit(300), cheques: [], endorse: [], rest: \"open\" }, force: true }))) stats.iade += 1;\n      }\n    }\n" + s[old_block_end:]
anchor = "      stats.cari += 1;\n"
assert s.count(anchor) == 1
first = ("      stats.cari += 1;\n"
 "      // Her dördüncü caride önce açık hesap satışı + onu kapsayan Mevcut Borç kartı (taksitli satışlardan önce: borç henüz kartsız); sonunda geri ödemeli iadesi.\n"
 "      let open = null;\n"
 "      if (k % 4 === 0) {\n"
 "        open = await must(\"açık satış\", api.post(\"/api/workspace/invoices\", { kind: \"sale\", accountId: acc.id, issueDate: saleDay, currency: \"TRY\", rate: 1, pricesIncludeVat: false, lines: [{ name: \"Hizmet\", qty: 10, unitPrice: 100, vatRate: 0 }], payment: { cash: [], cheques: [], endorse: [], rest: \"open\", dueDate: addDays(T, -10) }, force: true }));\n"
 "        const cover = await maybe(\"Mevcut Borç kartı\", api.post(\"/api/workspace/plans\", { name: acc.name, accountId: acc.id, total: \"600\", registeredOn: addDays(T, -50), coversBalance: true, count: 2, firstDue: addDays(T, between(-45, 10)), everyMonths: 1 }));\n"
 "        if (cover) stats.mevcutBorc += 1;\n"
 "      }\n")
s = s.replace(anchor, first)
open(p, "w", encoding="utf8").write(s)
print("ok")
