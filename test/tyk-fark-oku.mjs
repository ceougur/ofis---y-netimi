// 2.5.0 Ç5-B tur 2b-1 — KALICI ESKİ SÜRÜM FARK TESTİ'nin okuyucusu (ders 53). Aynı okuyucu iki yerde koşar: (1) fikstür üretilirken v2.4.9'un GERÇEK kodunun KENDİ API'sinden
// (test/fixtures/tyk-fark-v249/uret.mjs.txt), (2) testte fikstürün kopyası BUGÜNKÜ kodla açılınca (test/tyk-fark-v249-250.test.mjs). Yalnız iki sürümde de var olan uçlar okunur;
// alanlar cari başına: bakiye, Cari Listesi'nin gecikmiş kolonu, kartların durumu + Taksitler sekmeleri + taksitleri (tutar:kalan:durum), Vade Takip ve zil kalemleri;
// Ç5-B tur 2b-2 (S99 / S98 × S99 / S95 fatura durumunu değiştirir): faturalar (Fatura Listesi: gün|tutar|açık|ödeme durumu, belge sırasıyla) — alan yalnız faturası olan caride.
// get(url) → yanıtın verisi (200 değilse hata atar). prefix: yalnız adı bu önekle başlayan cariler (fikstürün sınıfları).
export async function readFacts(get, { today, prefix }) {
  const list = (await get("/api/workspace/accounts?status=all&limit=100000")).accounts || [];
  const people = list.filter(row => String(row.name || "").startsWith(prefix)).sort((a, b) => (a.name < b.name ? -1 : a.name > b.name ? 1 : 0));
  const tabs = {};
  for (const status of ["active", "overdue", "done", "closed"]) tabs[status] = new Set(((await get(`/api/workspace/plans?status=${status}&limit=5000`)).plans || []).map(plan => plan.id));
  const vade = (await get("/api/workspace/overview/vade-takip?from=2000-01-01&to=2100-01-01")).rows || [];
  const dues = (await get("/api/workspace/dues")).items || [];
  const invoices = (await get("/api/workspace/invoices?tab=all&limit=100000")).invoices || [];
  const money = value => Math.round((Number(value) || 0) * 100) / 100;
  const out = {};
  for (const person of people) {
    const card = await get(`/api/workspace/accounts/${person.id}`);
    const mine = new Set(invoices.filter(row => row.accountId === person.id).map(row => row.id));
    const details = [];
    for (const summary of card.plans || []) details.push(await get(`/api/workspace/plans/${summary.id}`));
    details.sort((a, b) => (String(a.createdAt) === String(b.createdAt) ? (a.id < b.id ? -1 : 1) : String(a.createdAt) < String(b.createdAt) ? -1 : 1));
    const plans = [];
    for (const plan of details) {
      plans.push({
        ad: plan.name,
        durum: plan.state,
        sekme: Object.entries(tabs).filter(([, ids]) => ids.has(plan.id)).map(([status]) => status).join("/"),
        taksitler: (plan.items || []).map(item => `${item.seq}:${money(item.amount)}:${money(item.remaining)}:${item.state}`),
        // Birleşik tur 8 (dar kontrol Ç5-B kapanış 2 DÜŞÜK-E; ders 53 (b)): kartın göstergesi (Tahsil Edilen / Kalan) ve satırın Ödenen'i de karşılaştırılır (S129 / S151 / S158).
        gosterge: `${money(plan.totals?.paid)}|${money(plan.totals?.remaining)}`,
        odenen: (plan.items || []).map(item => money(item.paid)),
      });
    }
    const rows = vade.filter(row => row.accountId === person.id || (row.ref?.type === "account" && row.ref?.id === person.id) || (row.ref?.type === "invoice" && mine.has(row.ref.id)));
    out[person.name] = {
      bakiye: money(card.totals?.balance),
      gecikmis: money(person.overdue),
      kartlar: plans,
      vadeTakip: rows.map(row => `${row.source}|${row.label}|${money(row.amount)}|${row.date}|${row.direction}`).sort(),
      zil: dues.filter(row => row.accountId === person.id || row.person === person.name).map(row => `${row.source}|${row.label || ""}|${money(row.amount)}|${row.state}`).sort(),
    };
    const bills = invoices.filter(row => row.accountId === person.id && row.status === "issued").sort((a, b) => (a.issueDate === b.issueDate ? (String(a.createdAt) < String(b.createdAt) ? -1 : 1) : a.issueDate < b.issueDate ? -1 : 1));
    if (bills.length) out[person.name].faturalar = bills.map(row => `${row.issueDate}|${row.kind}|${money(row.tryPayable ?? row.payable)}|${money(row.open)}|${row.payState}`);
  }
  return { today, cariler: out };
}

/** Bir carinin iki okuması arasındaki farklar: [{ cari, alan, eski, yeni }] (alan: bakiye, gecikmis, kart<n>.durum / .sekme / .taksitler, kart sayısı, vadeTakip, zil). */
export function diffFacts(oldFacts, newFacts) {
  const out = [];
  const text = value => JSON.stringify(value ?? null);
  const names = [...new Set([...Object.keys(oldFacts.cariler), ...Object.keys(newFacts.cariler)])].sort();
  for (const name of names) {
    const a = oldFacts.cariler[name];
    const b = newFacts.cariler[name];
    if (!a || !b) {
      out.push({ cari: name, alan: "cari", eski: a ? "var" : "yok", yeni: b ? "var" : "yok" });
      continue;
    }
    const push = (alan, x, y) => {
      if (text(x) !== text(y)) out.push({ cari: name, alan, eski: text(x), yeni: text(y) });
    };
    push("bakiye", a.bakiye, b.bakiye);
    push("gecikmis", a.gecikmis, b.gecikmis);
    push("kartSayisi", a.kartlar.length, b.kartlar.length);
    for (let i = 0; i < Math.min(a.kartlar.length, b.kartlar.length); i += 1) {
      for (const key of ["durum", "sekme", "taksitler"]) push(`kart${i + 1}.${key}`, a.kartlar[i][key], b.kartlar[i][key]);
      for (const key of ["gosterge", "odenen"]) push(`kart${i + 1}.${key}`, a.kartlar[i][key], b.kartlar[i][key]);
    }
    push("vadeTakip", a.vadeTakip, b.vadeTakip);
    push("zil", a.zil, b.zil);
    if (a.faturalar || b.faturalar) push("faturalar", a.faturalar, b.faturalar);
  }
  return out;
}
