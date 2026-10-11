"""H7 kırmızı kanıtı: yeni test dosyasındaki casus testi, ESKİ oldPath tanımıyla (3c9f8d3) koşulacak kopyaya yazar."""
import sys
src, dst = sys.argv[1], sys.argv[2]
s = open(src, encoding="utf8").read()
start = s.index("function oldPath(app) {")
end = s.index("  return { money, cash, center };\n}", start)
old_body = '''function oldPath(app) {
  const ctx = app.context;
  const money = createOldMoneyLines(ctx.store);
  const cash = registerCashRoutes(noRouter(), { ...ctx, money });
  const center = registerOldReportCenter(noRouter(), { ...ctx, money, cash: () => cash, accounts: () => ctx.accounts, plans: () => ctx.plans, stock: () => ctx.stock, cheques: () => ctx.cheques, invoices: () => ctx.invoices, overview: () => ctx.overview, ledger: () => ctx.ledger, integrity: () => ctx.integrity });
'''
s = s[:start] + old_body + s[end:]
open(dst, "w", encoding="utf8").write(s)
print("eski oldPath ile yazildi:", dst)
