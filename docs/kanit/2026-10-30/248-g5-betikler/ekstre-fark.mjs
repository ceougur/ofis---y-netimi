// 2.4.8 W3 FARK TESTİ (KANIT KURALI 2 "eski sürümün gerçek kodu"): ANLIK DURUM → Cari Ekstre üreticisi routes/overview.mjs'ten lib/statement-pdf.mjs'e taşındı;
// davranış AYNI olmalı. Eski kod (git archive ile ayrı kopya — ders 23) ve yeni kod AYNI girdiyle (aynı API çağrıları, aynı sabit sahte saat) açılır; ekstrenin
// JSON'u, PDF'i ve Excel'i bayt bayt karşılaştırılır (dönemler: bu ay, geçen ay, elle aralık, boş dönem, tek gün, Tüm Zamanlar; ileri tarihli hareket dahil).
//   node docs/kanit/2026-10-30/248-g5-betikler/ekstre-fark.mjs <eski-kök> <yeni-kök>
// Son satır "N geçti, M kaldı" (geçti = aynı, kaldı = farklı); farklı > 0 → çıkış 1.
import { createHash } from "node:crypto";
import path from "node:path";
import { pathToFileURL } from "node:url";

const [OLD, NEW] = process.argv.slice(2).map(item => path.resolve(item));
if (!OLD || !NEW) throw new Error("kullanım: ekstre-fark.mjs <eski-kök> <yeni-kök>");
const NOW = { time: "2026-11-20T14:30:00+03:00", fixed: true };
const sha = buffer => createHash("sha256").update(buffer).digest("hex").slice(0, 16);

async function collect(root) {
  const helpers = await import(pathToFileURL(path.join(root, "test", "helpers.mjs")).href);
  const server = await helpers.startTestServer({ now: NOW });
  try {
    const api = await helpers.loginAdmin(server);
    server.app.store.setSetting("office.name", "Fark Ticaret");
    const must = async (label, promise) => {
      const res = await promise;
      if (res.status !== 200) throw new Error(`${label}: ${res.status} ${JSON.stringify(res.data).slice(0, 300)}`);
      return res.data.data;
    };
    const a = await must("cari a", api.post("/api/workspace/accounts", { name: "Ayşe Fark Yılmaz", phone: "0532 000 11 22", openingBalance: "1250", registeredOn: "2026-09-01" }));
    const b = await must("cari b", api.post("/api/workspace/accounts", { name: "Tedarikçi Fark Ltd", type: "supplier", openingBalance: "800", registeredOn: "2026-10-05" }));
    const entries = [
      [a, { kind: "debt", amount: "300", date: "2026-10-01", note: "Ekim ayı başı" }],
      [a, { kind: "in", amount: "450,50", date: "2026-10-31", note: "Ay sonu tahsilat" }],
      [a, { kind: "debt", amount: "125,25", date: "2026-11-01", note: "Kasım ilk gün" }],
      [a, { kind: "in", amount: "1000", date: "2026-11-20", note: "Bugün" }],
      [b, { kind: "out", amount: "200", date: "2026-11-02", note: "Ödeme" }],
    ];
    for (const [account, body] of entries) await must(`hareket ${body.note}`, api.post(`/api/workspace/accounts/${account.id}/entries`, body));
    // İleri tarihli hareket (dönem sonundan sonra; program izin veriyorsa).
    const future = await api.post(`/api/workspace/accounts/${a.id}/entries`, { kind: "debt", amount: "77", date: "2026-12-15", note: "İleri tarihli" });
    const out = {};
    const ranges = {
      buAy: "preset=thisMonth",
      gecenAy: "preset=lastMonth",
      bosDonem: "from=2026-06-01&to=2026-06-30",
      tekGun: "from=2026-10-31&to=2026-10-31",
      elle: "from=2026-10-01&to=2026-11-20",
      tumZamanlar: "preset=all",
      buYil: "",
    };
    for (const account of [a, b]) {
      for (const [name, query] of Object.entries(ranges)) {
        const q = `account=${encodeURIComponent(account.id)}${query ? `&${query}` : ""}`;
        const json = await api.get(`/api/workspace/overview/ekstre?${q}`);
        const pdf = await api.raw("GET", `/api/workspace/overview/ekstre.pdf?${q}&download=1`);
        const xlsx = await api.raw("GET", `/api/workspace/overview/ekstre.xlsx?${q}`);
        const key = `${account.name} · ${name}`;
        // Kayıt kimlikleri rastgele UUID (iki koşuda farklı): karşılaştırmadan önce sabitlenir; geri kalan her alan aynı olmalı.
        out[`${key} · JSON`] = JSON.stringify(json.data).replace(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/g, "<uuid>");
        out[`${key} · PDF`] = `${pdf.status} ${pdf.headers.get("content-disposition")} ${sha(pdf.buffer || pdf.data)}`;
        out[`${key} · Excel`] = `${xlsx.status} ${xlsx.headers.get("content-disposition")} ${sha(xlsx.buffer || xlsx.data)}`;
      }
    }
    out["ileri tarihli hareket girildi mi"] = String(future.status);
    return out;
  } finally {
    await server.close();
  }
}

const before = await collect(OLD);
const after = await collect(NEW);
let same = 0;
let differ = 0;
for (const key of Object.keys(before)) {
  if (before[key] === after[key]) same += 1;
  else {
    differ += 1;
    console.log(`FARKLI ${key}\n  eski: ${String(before[key]).slice(0, 300)}\n  yeni: ${String(after[key]).slice(0, 300)}`);
  }
}
for (const key of Object.keys(after)) if (!(key in before)) {
  differ += 1;
  console.log(`YALNIZ YENİDE ${key}`);
}
for (const key of Object.keys(before).filter(item => /PDF|Excel/.test(item)).slice(0, 4)) console.log(`örnek ${key}: ${before[key]}`);
// Kanıt aracı (tools/kanit.mjs) "N geçti, M kaldı" biçimini okur: geçti = aynı, kaldı = farklı.
console.log(`${same} geçti, ${differ} kaldı (aynı ${same}, farklı ${differ})`);
process.exitCode = differ ? 1 : 0;
