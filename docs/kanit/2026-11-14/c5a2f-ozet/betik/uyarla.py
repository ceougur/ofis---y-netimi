#!/usr/bin/env python3
# hedefli.mjs kopyasına tur 2f'nin gözlemlerini ekler: satırda kendi yılı fazlası + ipucunun sonu; vaka A'da 'rule-diff-own-year' ise ekranın tarihsiz Ters Kaydet'i.
import pathlib
p = pathlib.Path("/tmp/claude-0/-home-user/de5e1cbf-7e68-5683-b7bb-f27655eaed4f/scratchpad/c5a2f-k1/p/hedefli.mjs")
s = p.read_text(encoding="utf-8")
a = 'fazla=${r.item.correction?.over ?? "-"} ipucu="${(r.item.hint || "").slice(-120)}"'
assert s.count(a) == 1
s = s.replace(a, 'fazla=${r.item.correction?.over ?? "-"} kendi-yılı=${r.item.correction?.ownYearMinor ? `${r.item.correction.ownYear.join(",")} ${r.item.correction.ownYearMinor / 100}` : "-"} ipucu="${(r.item.hint || "").slice(-200)}"')
b = """      if (!v2.disabled) {
        const p2 = await c.api.post(URL, { requestId: rid(), digest: v2.digest, confirm: true });
        console.log(`[A ${how}] öneri kaydedildi: ${p2.status} ${p2.data?.voucher?.noText} ${p2.data?.voucher?.date} ${lt(p2.data?.voucher?.lines)} | satır: ${await rowText(c.api)}`);
      }
"""
assert s.count(b) == 1
s = s.replace(b, b + """      console.log(`[A ${how}] ön izleme nedeni: ${v2.reason}`);
      if (v2.code === "rule-diff-own-year") {
        const rv = await c.api.post(`/api/admin/ledger/vouchers/${p1.voucher.id}/reverse`, { requestId: rid() });
        console.log(`[A ${how}] ekranın tarihsiz Ters Kaydet'i: ${rv.status} ${rv.data?.code || ""} ${rv.data?.voucher?.noText || ""} ${rv.data?.voucher?.date || ""} | sonra ön izleme ${vshort(await view(c.api))} | satır: ${await rowText(c.api)}`);
      }
""")
p.write_text(s, encoding="utf-8")
print("tamam")
