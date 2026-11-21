# ANA OTURUM — c6-sinama: Ç7b'nin kararlı kurallarından gelen 14 farkı v2.4.9 sınıf testinin beklenen-farklar.json'una karar numarasıyla ekler (ders 53 (b)).
import json,sys
p=sys.argv[1]
d=json.load(open(p,encoding='utf-8'))
K8="KG-8 / F-08 (Ç7b — iade KDV'si: satıştan iade KDV'si 191, alıştan iade KDV'si 391; BAŞ MİMAR KARARI 05.11 Ç7b, kural kitabı P2)"
N8s="v2.4.9'da satıştan iadenin KDV'si 391'i azaltıyordu; Ç7b'de 191 İndirilecek KDV'ye borç (iade 2026-07-15, kilit gününden sonra → kilitli kopyada da)"
N8a="v2.4.9'da alıştan iadenin KDV'si 191'i azaltıyordu; Ç7b'de 391 Hesaplanan KDV'ye alacak (iade 2026-08-10, kilit gününden sonra → kilitli kopyada da)"
K2="KG-2 A (Ç7b — taksit kartı 'Yeni Borç' H-03: 602 → 600.90 Belgesiz Satışlar)"
N2="v2.4.9'da elle açılan taksit kartının borcu 602 Diğer Gelirler; Ç7b'de 600.90 (Gelir Tablosu 600 satırı); kilitli kopyada donmuş dönem (2025) 2.4.9 kuralıyla kalır (Ç3)"
yeni=[]
def f(s,k,t,a,e,y,kar,n): yeni.append({"sinif":s,"kip":k,"tarih":t,"alan":a,"eski":e,"yeni":y,"karar":kar,"not":n})
for k in ("kilitsiz","kilitli"):
  f("satis-fatura",k,"2026-10-20","mizan.191","0","2000",K8,N8s); f("satis-fatura",k,"2026-10-20","mizan.391","-16000","-18000",K8,N8s)
for k in ("kilitsiz","kilitli"):
  f("alis-fatura",k,"2026-10-20","mizan.191","26800","29400",K8,N8a); f("alis-fatura",k,"2026-10-20","mizan.391","0","-2600",K8,N8a)
f("taksit","kilitsiz","2025-12-31","donem.600","0","-120000",K2,N2); f("taksit","kilitsiz","2025-12-31","donem.602","-120000","0",K2,N2)
for k in ("kilitsiz","kilitli"):
  f("taksit",k,"2026-10-20","donem.600","0","-90000",K2,N2); f("taksit",k,"2026-10-20","donem.602","-90000","0",K2,N2)
assert len(yeni)==14
var={(x["sinif"],x["kip"],x["tarih"],x["alan"]) for x in d["farklar"]}
for x in yeni: assert (x["sinif"],x["kip"],x["tarih"],x["alan"]) not in var, x
d["farklar"].extend(yeni)
d["aciklama"]=d["aciklama"]+" Ç7b birleşimiyle (21.11): iade KDV yönü (KG-8 / F-08) ve taksit kartı Yeni Borç 600.90 (KG-2) farkları eklendi."
s=json.dumps(d,ensure_ascii=False,indent=1)+"\n"
open(p,'w',encoding='utf-8').write(s)
print("eklendi",len(yeni),"toplam",len(d["farklar"]))
