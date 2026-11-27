// 2.5.1 M2 — Değersiz Alacak sınırı: senaryo sınıfları (karar girdisi docs/devir/2.5.1-DEVAM/m2-kararlar.md §3) ve sürücüsü. YALNIZ programın API'siyle konuşur (sunucu kodu
// içe aktarılmaz) — aynı dosya v2.4.9'un GERÇEK koduyla da koşulur (test/fixtures/m2-degersiz-v249/uret.mjs.txt; ders 53 (b)).
// Sınıflar kâhinin d62 senaryosuyla (test/bagimsiz/cari/senaryolar/d62-c5-m2-degersiz-siniri.json) aynı olaylar: taban T = Fatura 2.900 (10.09) + Borç 3.400 (12.09) · 17.09 faturaya bağlı
// tahsilat 2.876,45 · 17.09 tahsilattan SONRA yazılmış Şüpheliye Al 3.000. Sahte saat 15.10.2026 (kâhinin 'bugün'ü; ders 13).
// (Bu dosya test değildir: adı ".test.mjs" ile bitmez.)

export const M2_TODAY = "2026-10-15";
export const M2_NOW = `${M2_TODAY}T12:00:00+03:00`;
const ACC = "/api/workspace/accounts";

/** Taban T'nin adımları (önek ile; bagli = false → tahsilat bağsız; sira = "once" → Şüpheliye Al tahsilattan ÖNCE). */
export const m2Base = (p, { bagli = true, sira = "sonra", fatura = 2900, borc = 3400, tahsilat = "2876,45", supheli = 3000 } = {}) => [
  { op: "cari", ad: p },
  { op: "fatura", cari: p, ad: `${p}-F`, tutar: fatura, tarih: "2026-09-10" },
  { op: "borc", cari: p, tutar: borc, tarih: "2026-09-12" },
  ...(sira === "once" ? [{ op: "al", cari: p, ad: `${p}-S`, tutar: supheli, tarih: "2026-09-17" }] : []),
  { op: "tahsilat", cari: p, ad: `${p}-T`, tutar: tahsilat, tarih: "2026-09-17", ...(bagli ? { fatura: `${p}-F` } : {}) },
  ...(sira === "once" ? [] : [{ op: "al", cari: p, ad: `${p}-S`, tutar: supheli, tarih: "2026-09-17" }]),
];
export const m2Deg = (id, kayit, tutar, tarih) => ({ op: "degersiz", id, kayit, tutar, tarih });

/** Sınıflar: { ad, girdi (karar girdisi §3 maddesi), adimlar }. Kimlikler kâhinin d62 adım kimlikleriyle aynı (a1d1 …). */
export function m2Classes() {
  const out = [];
  const add = (ad, girdi, adimlar) => out.push({ ad, girdi, adimlar });
  add("A1", "m.1 tam tutar", [...m2Base("A1"), m2Deg("a1d1", "A1-S", "3000,01", "2026-09-17"), m2Deg("a1d2", "A1-S", "3000", "2026-09-17"), m2Deg("a1d3", "A1-S", "0,01", "2026-09-17")]);
  add("A2", "m.2 iki parça", [...m2Base("A2"), m2Deg("a2d1", "A2-S", "1000", "2026-09-17"), m2Deg("a2d2", "A2-S", "2000", "2026-09-17")]);
  add("A3", "m.2 üç parça", [...m2Base("A3"), m2Deg("a3d1", "A3-S", "1000", "2026-09-17"), m2Deg("a3d2", "A3-S", "1000", "2026-09-17"), m2Deg("a3d3", "A3-S", "1000", "2026-09-17"), m2Deg("a3d4", "A3-S", "0,01", "2026-09-17")]);
  add("A4", "m.3 bağlı = şüpheli", [...m2Base("A4", { fatura: 3000, tahsilat: "3000" }), m2Deg("a4d1", "A4-S", "3000", "2026-09-17")]);
  add("A5", "S270 (ii) bakiye", [
    { op: "cari", ad: "A5" }, { op: "fatura", cari: "A5", ad: "A5-F", tutar: 3000, tarih: "2026-09-10" }, { op: "borc", cari: "A5", tutar: 400, tarih: "2026-09-12" },
    { op: "al", cari: "A5", ad: "A5-S", tutar: 3000, tarih: "2026-09-17" }, { op: "tahsilat", cari: "A5", ad: "A5-T", tutar: "3000", tarih: "2026-09-17", fatura: "A5-F" },
    m2Deg("a5d1", "A5-S", "400,01", "2026-09-17"), m2Deg("a5d2", "A5-S", "400", "2026-09-17"), m2Deg("a5d3", "A5-S", "0,01", "2026-09-17"),
  ]);
  add("A6", "m.4 ertesi gün", [...m2Base("A6"), m2Deg("a6d1", "A6-S", "123,56", "2026-09-18"), m2Deg("a6d2", "A6-S", "123,55", "2026-09-18"), m2Deg("a6d3", "A6-S", "0,01", "2026-09-17")]);
  add("A7", "m.5 sonraki Değersiz", [...m2Base("A7"), m2Deg("a7d1", "A7-S", "100", "2026-09-25"), m2Deg("a7d2", "A7-S", "23,56", "2026-09-17"), m2Deg("a7d3", "A7-S", "23,55", "2026-09-17"), m2Deg("a7d4", "A7-S", "0,01", "2026-09-25")]);
  add("A8", "S270 sonraki satırlar", [
    { op: "cari", ad: "A8" }, { op: "fatura", cari: "A8", ad: "A8-F", tutar: 2900, tarih: "2026-09-10" }, { op: "borc", cari: "A8", tutar: 3400, tarih: "2026-09-12" },
    { op: "al", cari: "A8", ad: "A8-S", tutar: 3000, tarih: "2026-09-17" }, m2Deg("a8d1", "A8-S", "500", "2026-09-20"), { op: "tahsilat", cari: "A8", ad: "A8-N", tutar: "1000", tarih: "2026-10-01" },
    m2Deg("a8d2", "A8-S", "1500,01", "2026-09-17"), m2Deg("a8d3", "A8-S", "1500", "2026-09-17"),
  ]);
  add("A9", "m.6 sonradan bağsız", [...m2Base("A9"), { op: "tahsilat", cari: "A9", ad: "A9-N", tutar: "1000", tarih: "2026-10-01" }, m2Deg("a9d1", "A9-S", "3000", "2026-09-17"), m2Deg("a9d2", "A9-S", "2000,01", "2026-09-17"), m2Deg("a9d3", "A9-S", "2000", "2026-09-17")]);
  add("A10", "m.6 sonraki tarihler", [...m2Base("A10"), { op: "tahsilat", cari: "A10", ad: "A10-N", tutar: "1000", tarih: "2026-10-01" }, m2Deg("a10d1", "A10-S", "0,01", "2026-10-01"), m2Deg("a10d2", "A10-S", "0,01", "2026-09-18")]);
  // m.7: bağlı tahsilat (T), Şüpheliye Al (S) ve bağsız 50 (N) — altı yazım sırası aynı gün + ertesi gün iki sıra.
  const altı = [["A11", "TSN"], ["A12", "TNS"], ["A13", "STN"], ["A14", "SNT"], ["A15", "NST"], ["A16", "NTS"], ["A17", "TSN+"], ["A18", "N+TS"]];
  for (const [p, order] of altı) {
    const next = order.includes("+");
    const steps = [{ op: "cari", ad: p }, { op: "fatura", cari: p, ad: `${p}-F`, tutar: 2900, tarih: "2026-09-10" }, { op: "borc", cari: p, tutar: 3400, tarih: "2026-09-12" }];
    for (const ch of order.replace("+", "")) {
      if (ch === "T") steps.push({ op: "tahsilat", cari: p, ad: `${p}-T`, tutar: "2876,45", tarih: "2026-09-17", fatura: `${p}-F` });
      if (ch === "S") steps.push({ op: "al", cari: p, ad: `${p}-S`, tutar: 3000, tarih: "2026-09-17" });
      if (ch === "N") steps.push({ op: "tahsilat", cari: p, ad: `${p}-N`, tutar: "50", tarih: next ? "2026-09-18" : "2026-09-17" });
    }
    const low = p.toLowerCase();
    steps.push(m2Deg(`${low}d1`, `${p}-S`, "2950", "2026-09-17"), m2Deg(`${low}d2`, `${p}-S`, "50", "2026-09-17"));
    add(p, `m.7 sıra ${order}`, steps);
  }
  add("A19", "SK-55 (BİLİNEN SINIR — bugünkü davranış)", [
    { op: "cari", ad: "A19" }, { op: "fatura", cari: "A19", ad: "A19-F", tutar: 2900, tarih: "2026-09-10" }, { op: "borc", cari: "A19", tutar: 3400, tarih: "2026-09-12" },
    { op: "tahsilat", cari: "A19", ad: "A19-T", tutar: "2876,45", tarih: "2026-09-17", fatura: "A19-F" }, { op: "tahsilat", cari: "A19", ad: "A19-N", tutar: "50", tarih: "2026-09-17" },
    { op: "al", cari: "A19", ad: "A19-S", tutar: 3000, tarih: "2026-09-17" }, m2Deg("a19d1", "A19-S", "100", "2026-09-18"),
  ]);
  const ikiKayit = p => [
    { op: "cari", ad: p }, { op: "fatura", cari: p, ad: `${p}-F`, tutar: 2900, tarih: "2026-09-10" }, { op: "borc", cari: p, tutar: 3400, tarih: "2026-09-12" },
    { op: "tahsilat", cari: p, ad: `${p}-T`, tutar: "2876,45", tarih: "2026-09-17", fatura: `${p}-F` },
    { op: "al", cari: p, ad: `${p}-S`, tutar: 1500, tarih: "2026-09-17" }, { op: "al", cari: p, ad: `${p}-S2`, tutar: 1500, tarih: "2026-09-17" },
  ];
  add("A20", "m.8 iki kayıt", [...ikiKayit("A20"), m2Deg("a20d1", "A20-S", "1500", "2026-09-17")]);
  add("A21", "m.8 iki kayıt, öbürüne bugün", [...ikiKayit("A21"), m2Deg("a21d1", "A21-S2", "123,56", M2_TODAY), m2Deg("a21d2", "A21-S2", "123,55", M2_TODAY), m2Deg("a21d3", "A21-S", "0,01", "2026-09-17")]);
  add("M9", "m.9 öbür kayıt Şüpheliden Çıkar", [...ikiKayit("M9"), { op: "cikar", id: "m9x", kayit: "M9-S2", tarih: "2026-09-17" }, m2Deg("m9d1", "M9-S", "1500", "2026-09-17")]);
  // m.10: Değersiz 3.000 @17.09 yazıldıktan SONRA bağlı tahsilatın silinmesi / bağının kaldırılması / tarihinin ve tutarının değişmesi.
  const m10 = [["M10A", { op: "sil", hareket: "M10A-T" }], ["M10B", { op: "duzenle", hareket: "M10B-T", invoiceId: "" }], ["M10C", { op: "duzenle", hareket: "M10C-T", date: "2026-09-16" }],
    ["M10D", { op: "duzenle", hareket: "M10D-T", date: "2026-09-20" }], ["M10E", { op: "duzenle", hareket: "M10E-T", amount: "3500" }], ["M10F", { op: "duzenle", hareket: "M10F-T", amount: "1000" }]];
  for (const [p, step] of m10) add(p, `m.10 ${step.op} ${JSON.stringify(step).slice(0, 60)}`, [...m2Base(p), m2Deg(`${p.toLowerCase()}d1`, `${p}-S`, "3000", "2026-09-17"), { ...step, id: `${p.toLowerCase()}x` }]);
  // m.11: Silinenler'den geri yükleme (iki sıra). (a) sil → geri yükle; (b) sil → sonradan bağsız 1.000 → geri yükle (sınır 2.000) → yeni 2.000; (c) bağsız 1.000 Değersiz'den SONRA (avans).
  add("M11A", "m.11 sil → geri yükle", [...m2Base("M11A"), m2Deg("m11ad1", "M11A-S", "3000", "2026-09-17"), { op: "degersizSil", id: "m11ax", kayit: "M11A-S" }, { op: "geriYukle", id: "m11ay", kayit: "M11A-S" }]);
  add("M11B", "m.11 sil → bağsız → geri yükle", [...m2Base("M11B"), m2Deg("m11bd1", "M11B-S", "3000", "2026-09-17"), { op: "degersizSil", id: "m11bx", kayit: "M11B-S" },
    { op: "tahsilat", cari: "M11B", ad: "M11B-N", tutar: "1000", tarih: "2026-10-01" }, { op: "geriYukle", id: "m11by", kayit: "M11B-S" }, m2Deg("m11bd2", "M11B-S", "2000,01", "2026-09-17"), m2Deg("m11bd3", "M11B-S", "2000", "2026-09-17")]);
  add("M11C", "m.11 Değersiz'den sonra bağsız (avans)", [...m2Base("M11C"), m2Deg("m11cd1", "M11C-S", "3000", "2026-09-17"), { op: "tahsilat", id: "m11cn", cari: "M11C", ad: "M11C-N", tutar: "1000", tarih: "2026-10-01" }]);
  add("A26", "Y30-6 S155", [...m2Base("A26"), { op: "al", cari: "A26", ad: "A26-S2", tutar: 500, tarih: "2026-09-25" }, m2Deg("a26d1", "A26-S", "3000", "2026-09-17"), m2Deg("a26d2", "A26-S", "2923,56", "2026-09-17"), m2Deg("a26d3", "A26-S", "2923,55", "2026-09-17")]);
  const sonra = p => [{ op: "cari", ad: p }, { op: "fatura", cari: p, ad: `${p}-F`, tutar: 2900, tarih: "2026-09-10" }, { op: "borc", cari: p, tutar: 3400, tarih: "2026-09-12" },
    { op: "al", cari: p, ad: `${p}-S`, tutar: 3000, tarih: "2026-09-17" }, { op: "tahsilat", cari: p, ad: `${p}-T`, tutar: "2876,45", tarih: "2026-09-20", fatura: `${p}-F` }];
  add("A27", "Y30-2 (1) sonraki günün bağlı payı", [...sonra("A27"), m2Deg("a27d1", "A27-S", "3000,01", "2026-09-18"), m2Deg("a27d2", "A27-S", "3000", "2026-09-18")]);
  add("A28", "Y30-2 (1) bağlıdan sonra", [...sonra("A28"), m2Deg("a28d1", "A28-S", "123,56", "2026-09-21"), m2Deg("a28d2", "A28-S", "123,55", "2026-09-21")]);
  // m.12 (Dönem Kilidi) EN SONDA: kilit bütün şirketi kapsar.
  add("A25", "m.12 Dönem Kilidi", [...m2Base("A25"), { op: "kilit", id: "kilit", tarih: "2026-09-17" }, m2Deg("a25d0", "A25-S", "1", "2026-09-17"), m2Deg("a25d1", "A25-S", "123,56", "2026-09-18"), m2Deg("a25d2", "A25-S", "123,55", "2026-09-18")]);
  return out;
}

const unwrapOf = r => ({ status: r.status, data: r.data && typeof r.data === "object" && "ok" in r.data ? (r.data.ok ? r.data.data : r.data) : r.data, code: r.data?.code ?? r.data?.data?.code, error: r.data?.error });

/**
 * Sınıfları sırayla koşar. client: test/helpers.mjs loginAdmin istemcisi (get/post/put/del). Dönüş: { steps: { id → { status, code, message } }, balances: { cari → TL },
 * records: { kayıt adı → { writtenOffMinor, remainingMinor, stateKey } }, ids }.
 */
export async function runM2Classes(client, classes = m2Classes(), { onStep = null } = {}) {
  const api = {
    get: async url => unwrapOf(await client.get(url)),
    post: async (url, body) => unwrapOf(await client.post(url, body)),
    put: async (url, body) => unwrapOf(await client.put(url, body)),
    del: async url => unwrapOf(await client.del(url)),
  };
  const must = async (label, promise) => {
    const r = await promise;
    if (r.status !== 200) throw new Error(`${label}: ${r.status} ${JSON.stringify(r.data).slice(0, 500)}`);
    return r.data;
  };
  await api.post("/api/workspace/bank/setup/dismiss", {});
  const cari = new Map();
  const doc = new Map();
  const entry = new Map();
  const record = new Map();
  const steps = {};
  const writeOffsOf = async name => {
    const rec = record.get(name);
    const list = await must("liste", api.get(`${ACC}/${rec.party}/doubtful`));
    return list.records.find(item => item.id === rec.id);
  };
  let n = 0;
  for (const klass of classes) {
    for (const step of klass.adimlar) {
      let r = null;
      if (step.op === "cari") {
        n += 1;
        const acc = await must("cari", api.post(ACC, { name: `M2 ${step.ad} Müşteri`, type: "customer", registeredOn: "2026-09-01", phone: `0500 251 ${String(Math.floor(n / 100)).padStart(2, "0")} ${String(n % 100).padStart(2, "0")}` }));
        cari.set(step.ad, acc.id);
        continue;
      }
      const party = cari.get(step.cari) || record.get(step.kayit)?.party || "";
      if (step.op === "fatura") {
        const inv = await must("fatura", api.post("/api/workspace/invoices", { scenario: "service_sale", accountId: party, issueDate: step.tarih, lines: [{ name: "Hizmet", qty: 1, unitPrice: String(step.tutar), vatRate: 0 }], payment: { rest: "open" } }));
        doc.set(step.ad, inv.id);
        continue;
      }
      if (step.op === "borc") {
        await must("borç", api.post(`${ACC}/${party}/entries`, { kind: "debt", amount: String(step.tutar), date: step.tarih, note: "Borç" }));
        continue;
      }
      if (step.op === "tahsilat") {
        const known = new Set(((await must("cari kartı", api.get(`${ACC}/${party}`))).entries || []).map(item => item.id));
        r = await api.post(`${ACC}/${party}/entries`, { kind: "in", amount: step.tutar, date: step.tarih, method: "cash", cashForce: true, similarOk: true, note: step.fatura ? "Bağlı tahsilat" : "Bağsız tahsilat", ...(step.fatura ? { invoiceId: doc.get(step.fatura) } : {}) });
        if (r.status === 200) {
          const rows = r.data.entries || (await must("cari kartı", api.get(`${ACC}/${party}`))).entries || [];
          const row = rows.find(item => (r.data.entryId ? item.id === r.data.entryId : !known.has(item.id) && item.kind === "in"));
          if (!row) throw new Error(`tahsilat ${step.ad}: yanıtta satır yok`);
          entry.set(step.ad, { party, id: row.id, row });
        }
      } else if (step.op === "al") {
        r = await api.post(`${ACC}/${party}/doubtful`, { amount: String(step.tutar), date: step.tarih, reason: "lawsuit" });
        if (r.status === 200) record.set(step.ad, { party, id: r.data.record.id });
      } else if (["degersiz", "cikar", "degersizSil", "geriYukle"].includes(step.op) && !record.get(step.kayit)) {
        r = { status: 0, code: "kayit-yok", error: "kurulumdaki şüpheli kaydı yazılamadı" };
      } else if (step.op === "degersiz") {
        const rec = record.get(step.kayit);
        r = await api.post(`${ACC}/${rec.party}/doubtful/${rec.id}/write-off`, { amount: step.tutar, date: step.tarih });
      } else if (step.op === "cikar") {
        const rec = record.get(step.kayit);
        r = await api.post(`${ACC}/${rec.party}/doubtful/${rec.id}/release`, { date: step.tarih });
      } else if ((step.op === "sil" || step.op === "duzenle") && !entry.get(step.hareket)) {
        r = { status: 0, code: "hareket-yok", error: "kurulumdaki tahsilat yazılamadı" };
      } else if (step.op === "sil") {
        const e = entry.get(step.hareket);
        r = await api.del(`${ACC}/${e.party}/entries/${e.id}?cashForce=1`);
      } else if (step.op === "duzenle") {
        const e = entry.get(step.hareket);
        const body = { kind: "in", amount: step.amount ?? String(e.row.amount).replace(".", ","), date: step.date ?? e.row.date, method: "cash", note: e.row.note || "Tahsilat", invoiceId: Object.hasOwn(step, "invoiceId") ? step.invoiceId : e.row.invoiceId || "", cashForce: true, similarOk: true };
        r = await api.put(`${ACC}/${e.party}/entries/${e.id}`, body);
      } else if (step.op === "degersizSil") {
        const rec = record.get(step.kayit);
        const item = await writeOffsOf(step.kayit);
        const last = item.writeOffs.at(-1);
        r = await api.del(`${ACC}/${rec.party}/doubtful/${rec.id}/write-offs/${last.entryId}`);
        rec.deleted = last.entryId;
      } else if (step.op === "geriYukle") {
        const rec = record.get(step.kayit);
        const trash = await must("Silinenler", api.get("/api/admin/trash"));
        const item = trash.find(row => row.kind === "doubtful-writeoff" && row.ref === rec.deleted);
        r = await api.post("/api/admin/trash/restore", { id: item.id });
      } else if (step.op === "kilit") {
        r = await api.put("/api/admin/period-lock", { lockedUntil: step.tarih });
      } else throw new Error(`bilinmeyen adım ${step.op}`);
      const sid = step.id || (step.op === "tahsilat" ? `t:${step.ad}` : step.op === "al" ? `s:${step.ad}` : "");
      if (sid) steps[sid] = { status: r.status, code: r.status === 200 ? "" : r.code || "", message: r.status === 200 ? "" : String(r.error || r.data?.error || "").slice(0, 400) };
      if (onStep) await onStep({ klass, step, result: r, party, api });
    }
  }
  const balances = {};
  for (const [name, id] of cari) balances[name] = (await must("cari kartı", api.get(`${ACC}/${id}`))).totals.balance;
  const records = {};
  for (const name of record.keys()) {
    const item = await writeOffsOf(name);
    records[name] = item ? { writtenOffMinor: item.writtenOffMinor, remainingMinor: item.remainingMinor, stateKey: item.stateKey } : null;
  }
  return { steps, balances, records, ids: { cari: Object.fromEntries(cari), record: Object.fromEntries([...record].map(([k, v]) => [k, v.id])) } };
}
