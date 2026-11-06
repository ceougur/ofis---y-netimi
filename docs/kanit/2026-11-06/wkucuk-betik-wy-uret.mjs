// WY yeniden üretim betiği (ders 6, 20): Yol 2'de imzasız bildirimin bugün ne döndüğü ve sonuçları SAYILARLA. Kullanım: node wy-uret.mjs <depo kökü>
// Depo kökündeki GERÇEK program + kapıcı + sahte Meta (test/whatsapp-wy-ortak.mjs düzeneği). Çıktı: senaryo başına JSON satırı + "# SONUC".
import path from "node:path";
import { pathToFileURL } from "node:url";

const ROOT = path.resolve(process.argv[2]);
const { ADMIN_PASSWORD, failed, hideFile, kurulum, st } = await import(pathToFileURL(path.join(ROOT, "test/whatsapp-wy-ortak.mjs")).href);
const HOUR = 3_600_000;
const out = [];
async function senaryo(ad, fn) {
  try {
    out.push({ ad, ...(await fn()) });
  } catch (error) {
    out.push({ ad, hata: String(error?.message || error).slice(0, 300) });
  }
  console.log(JSON.stringify(out.at(-1)));
}
const removeCompany = s => s.api.raw("DELETE", `/api/companies/${s.company.id}`, { body: JSON.stringify({ confirm: s.company.code, password: ADMIN_PASSWORD }), headers: { "content-type": "application/json" } });

await senaryo("A Yol 2 · geri yükleme sürüyor · imzasız delivered (sahte), sonra imzalı failed (gerçek)", async () => {
  const s = await kurulum();
  try {
    const { batchId, job, accountId } = await s.sent("Burak Kaya", "0533 444 55 66");
    s.busy(true);
    const r1 = await s.post([st(s, job.wamid, "delivered")]);
    const r1b = await s.post([st(s, job.wamid, "delivered")]); // Meta'nın yinelemesi (503 sonrası)
    s.busy(false);
    const sahte = { yanit: r1.status, yineleme: r1b.status, defterTeslim: s.deliveries(job.id), buAy: await s.buAy(), kisi: (await s.skip(accountId))[0] };
    const r2 = await s.post([failed(s, job.wamid)], { signed: true });
    return { sahteImzasiz: sahte, gercekImzaliFailed: { yanit: r2.status, isDurumu: (await s.job(batchId)).state, defterTeslimEdilemedi: s.failures(job.id), kisi: (await s.skip(accountId))[0], buAy: await s.buAy() } };
  } finally {
    await s.close();
  }
});
await senaryo("B Yol 2 · şirket silindi · imzasız delivered + failed", async () => {
  const s = await kurulum();
  try {
    const { job } = await s.sent("Can Yıldız", "0533 444 55 68");
    await removeCompany(s);
    const d = await s.post([st(s, job.wamid, "delivered")]);
    const f = await s.post([failed(s, job.wamid)]);
    return { deliveredYanit: d.status, failedYanit: f.status, defterTeslim: s.deliveries(job.id), defterTeslimEdilemedi: s.failures(job.id) };
  } finally {
    await s.close();
  }
});
await senaryo("C Yol 2 · veri dosyası yok · imzasız failed (sahte)", async () => {
  const s = await kurulum();
  try {
    const { job, accountId } = await s.sent("Deniz Ak", "0533 444 55 69");
    await s.server.app.context.closeCompany(s.company.id);
    const putBack = hideFile(s.server.app.config.dataDir);
    const f = await s.post([failed(s, job.wamid)]);
    putBack();
    return { yanit: f.status, defterTeslimEdilemedi: s.failures(job.id), kisiDosyaGelince: (await s.skip(accountId))[0] };
  } finally {
    await s.close();
  }
});
for (const sahte of [false, true]) {
  await senaryo(`D Yol 2 · bildirim yolu işareti (hookSeen) · sahte imzasız POST ${sahte ? "VAR" : "YOK"} · Meta'dan gerçek bildirim hiç gelmedi · TTL 3 gün + 1 sa sonra`, async () => {
    const s = await kurulum();
    try {
      for (const tpl of s.fake.state.templates) if (tpl.name.startsWith("destekofis_")) tpl.message_send_ttl_seconds = 259_200;
      const { batchId, accountId } = await s.sent("Ece Su", "0533 444 55 70");
      const yanit = sahte ? (await s.post([st(s, "wamid.BILINMEYEN", "sent")])).status : null;
      s.clock.advance(74 * HOUR);
      await s.server.app.whatsapp.scheduler.drain();
      return { sahteYanit: yanit, isDurumu: (await s.job(batchId)).state, kisi: (await s.skip(accountId))[0] };
    } finally {
      await s.close();
    }
  });
}
console.log(`# SONUC ${JSON.stringify(out)}`);
