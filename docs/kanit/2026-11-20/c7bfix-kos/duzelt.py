import sys
p = sys.argv[1]
s = open(p, encoding='utf-8').read()
old = '''  const queueFor = accountId => {
    if (store.inTransaction || !accountId) return null;
    const module = invoices();'''
new = '''  const queueFor = accountId => (store.inTransaction ? null : queueBuild(accountId));
  // 2.5.0 Ç7b aday düzeltme turu (YB-1; ana oturumun ekran yürüyüşü ORTA bulgusu): kuyruğu işlem İÇİNDE de kuran yol — YALNIZ Kartı Kapat onayının denetimi (shownRemaining)
  // çağırır. invoices.obligationsOf işlem içinde önbelleğe okumaz / yazmaz (kesinleşmemiş veri saklanmaz); queueFor / queueOf'un işlem içindeki davranışı (kuyruk yok) DEĞİŞMEDİ.
  function queueBuild(accountId) {
    if (!accountId) return null;
    const module = invoices();'''
assert s.count(old) == 1
s = s.replace(old, new)
old2 = '''    const result = module.obligationsOf(accountId, ledgerOf);
    return result ? new Map([[accountId, result]]) : null;
  };
  // Kart ekranı (GET): kartın kendi hesabı + kuyruk görünümü.'''
new2 = '''    const result = module.obligationsOf(accountId, ledgerOf);
    return result ? new Map([[accountId, result]]) : null;
  }
  // Kart ekranı (GET): kartın kendi hesabı + kuyruk görünümü.'''
assert s.count(old2) == 1
s = s.replace(old2, new2)
old3 = '''    return view === shaped ? shaped : { ...shaped, ...view };
  };
'''
assert s.count(old3) == 1
new3 = '''    return view === shaped ? shaped : { ...shaped, ...view };
  };
  // 2.5.0 Ç7b aday düzeltme turu (YB-1): kart penceresinin GÖSTERDİĞİ kalan (detailView ile aynı kural — S129 = A tek kuyruk: totals.remaining) işlemin İÇİNDE, güncel kartla.
  // Önceden denetim detail() → shape() okuyordu: işlem içinde kuyruk kurulmadığı için kartın KENDİ hesabı (allocate) çıkıyordu — cari kartından tahsilat girilmiş kartta pencere
  // "Kalan 2.500" diye onay alıyor, sunucu "güncel kalan 3.000,00 TL" diye reddediyordu (pencere ikinci kez soruyordu). Karşılaştırma yazımla aynı işlemde (BEGIN IMMEDIATE):
  // denetimle yazım arasına başka yazım giremez. Carisiz kart / eski kapama görünümü: kuyruk yok → kartın kendi kalanı (pencere de onu gösterir).
  const shownRemaining = (plan, user) => {
    const shaped = shape(plan, user);
    const view = withQueue(plan, shaped, queueBuild(plan.accountId));
    return roundMoney(Number(view?.totals?.remaining) || 0);
  };
'''
s = s.replace(old3, new3)
old4 = '''        const current = roundMoney(Number(detail(previous.id, user)?.totals?.remaining) || 0);'''
assert s.count(old4) == 1
new4 = '''        // Ç7b aday düzeltme turu: kart penceresinin GÖSTERDİĞİ kalan (shownRemaining; işlem içinde kuyruk dahil) — önceden kartın kendi hesabı (detail) okunuyordu.
        const current = shownRemaining(previous, user);'''
s = s.replace(old4, new4)
open(p, 'w', encoding='utf-8').write(s)
print("tamam")
