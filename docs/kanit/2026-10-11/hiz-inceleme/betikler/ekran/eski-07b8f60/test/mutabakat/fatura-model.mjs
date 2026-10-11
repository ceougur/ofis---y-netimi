// Mutabakat motorunun BAĞIMSIZ fatura hesabı (v2.0.15). Programın invoice-math.mjs'ini KULLANMAZ: aynı kuralları
// (satır bazında yuvarlama, yarım kuruş sıfırdan uzağa, KDV dahil fiyatta matrahın geriye hesabı, tevkifat, genel
// iskonto, stopaj, kurla TL karşılığı) yalnız tamsayı/BigInt ile yeniden yazar. Program ile model kuruşu kuruşuna
// aynı sonucu vermezse motor ilk sapmada durur.
//
// Kalem: { qty (binde bir tamsayı), price4 (on binde bir tamsayı), disc (tam sayı %), vat (0|1|10|20), wh: [pay, payda] | null,
//          account ('600', '610', '153', '770', '760', '255') }
// Belge: { incl (KDV dahil), disc (genel iskonto tam sayı %), stop (stopaj tam sayı %), rate6 (kur × 1e6 tamsayı) }

const half = (num, den) => {
  const n = BigInt(num), d = BigInt(den);
  if (n <= 0n) return 0;
  return Number((2n * n + d) / (2n * d));
};

export function modelLine(line, { incl = false, disc = 0 } = {}) {
  const base = half(BigInt(line.qty) * BigInt(line.price4), 100000n);
  const lineDisc = half(BigInt(base) * BigInt(line.disc || 0), 100n);
  const docDisc = disc ? half(BigInt(base - lineDisc) * BigInt(disc), 100n) : 0;
  const after = base - lineDisc - docDisc;
  const net = incl ? half(BigInt(after) * 100n, BigInt(100 + line.vat)) : after;
  const vat = incl ? after - net : half(BigInt(net) * BigInt(line.vat), 100n);
  const withheld = line.wh ? half(BigInt(vat) * BigInt(line.wh[0]), BigInt(line.wh[1])) : 0;
  return { base, net, vat, withheld };
}

export function modelInvoice(lines, { incl = false, disc = 0, stop = 0, rate6 = 1_000_000 } = {}) {
  const out = lines.map(line => ({ ...line, ...modelLine(line, { incl, disc }) }));
  const sum = key => out.reduce((s, l) => s + l[key], 0);
  const net = sum("net");
  const stoppage = stop ? half(BigInt(net) * BigInt(stop * 100), 10000n) : 0;
  const payable = sum("net") + sum("vat") - sum("withheld") - stoppage;
  const conv = v => (rate6 === 1_000_000 ? v : half(BigInt(v) * BigInt(rate6), 1_000_000n));
  const byAccount = new Map();
  for (const l of out) byAccount.set(l.account, (byAccount.get(l.account) || 0) + l.net);
  const tryNet = [...byAccount.values()].reduce((s, v) => s + conv(v), 0);
  const tryVat = conv(sum("vat"));
  const tryWithheld = conv(sum("withheld"));
  const tryStoppage = conv(stoppage);
  // Stok hareketinin tutarı: kalemin TL matrahı (kalem bazında çevrilir).
  for (const l of out) l.tryNet = conv(l.net);
  return { lines: out, net, vat: sum("vat"), withheld: sum("withheld"), stoppage, payable, tryNet, tryVat, tryWithheld, tryStoppage, tryPayable: tryNet + tryVat - tryWithheld - tryStoppage };
}
