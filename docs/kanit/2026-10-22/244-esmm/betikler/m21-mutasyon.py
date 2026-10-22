import json
U="server/lib/einvoice/ubl-tr.mjs"; T=["test/esmm-ubl.test.mjs"]
m=[
 ("U1","stopaj oranı sabit %20 (girilen oran değil)",U,'${tag("cbc:CalculationSequenceNumeric", 1)}${tag("cbc:Percent", doc.stoppageRate)}','${tag("cbc:CalculationSequenceNumeric", 1)}${tag("cbc:Percent", 20)}'),
 ("U2","kalem kalem yuvarlama (belge stopajına dağıtım yok)",U,'const shares = exact.map(value => Math.floor(value / 10000));','const shares = exact.map(value => Math.floor((2 * value + 10000) / 20000)); if (shares) return shares;'),
 ("U3","Net Ücret yerine brüt (e-Fatura anlamı)",U,'money("cbc:TaxExclusiveAmount", minor(smm.netFee), currency)','money("cbc:TaxExclusiveAmount", minor(smm.gross), currency)'),
 ("U4","Tahsil Edilen KDV yerine brüt + KDV (e-Fatura anlamı)",U,'money("cbc:TaxInclusiveAmount", minor(smm.collectedVat), currency)','money("cbc:TaxInclusiveAmount", minor(smm.gross + smm.vat), currency)'),
 ("U5","Tahsil Edilen KDV tevkifatı düşmüyor",U,'const collectedVat = vat - withheld;','const collectedVat = vat;'),
 ("U6","kalem miktarı Net Ücret değil gerçek miktar",U,'`<cbc:InvoicedQuantity unitCode="NIU">${amount(minor(netFee))}</cbc:InvoicedQuantity>`','`<cbc:InvoicedQuantity unitCode="NIU">${escape(line.qty)}</cbc:InvoicedQuantity>`'),
 ("U7","stopaj matrahı 0 (EDM örneğindeki gibi)",U,'`<cac:TaxSubtotal>${money("cbc:TaxableAmount", taxable, currency)}${money("cbc:TaxAmount", stoppage, currency)}','`<cac:TaxSubtotal>${money("cbc:TaxableAmount", 0, currency)}${money("cbc:TaxAmount", stoppage, currency)}'),
 ("U8","0003 stopaj satırı hiç yazılmıyor",U,'const withStoppage = esmm && (Number(doc.stoppageRate) > 0 || smm.stoppage > 0);','const withStoppage = false;'),
 ("U9","e-SMM'ye fatura görünüm şablonu gömülüyor","server/routes/invoices.mjs",'ownsDocument(doc) && doc.profile !== "ESMM"))','ownsDocument(doc)))'),
 ("U10","kalem fiyatı Net Tahsilat değil brüt",U,'money("cbc:PriceAmount", minor(netFee + collected), currency)','money("cbc:PriceAmount", line.net, currency)'),
 ("U11","stopaj Not'u e-SMM'de de yazılıyor",U,'doc.stoppageTotal > 0 && !esmm ?','doc.stoppageTotal > 0 ?'),
 ("U12","stopajsız (kişi alıcı) makbuza da 0003 satırı",U,'const withStoppage = esmm && (Number(doc.stoppageRate) > 0 || smm.stoppage > 0);','const withStoppage = esmm;'),
 ("U13","kalan kuruş en küçük kesre veriliyor",U,'sort((a, b) => b.remainder - a.remainder || a.index - b.index)','sort((a, b) => a.remainder - b.remainder || a.index - b.index)'),
]
print(json.dumps([{"id":i,"desc":d,"file":f,"old":o,"new":n,"tests":T} for i,d,f,o,n in m], ensure_ascii=False, indent=1))
