// 2.5.0 Ç3 tur 2 (docs/erp/C3-DONDURMA-TASARIM.md §18): PUT /api/admin/period-lock kilitli dönemin defterinin dondurulmasını BEKLEMEZ — kilit + bekleyen koşu (tek işlem)
// yazılınca yanıt verir, dondurma sunucuda arkada sürer. Kilitten hemen sonra donmuş defteri (kapsam, satırlar, koşu başlığı, kapının izi) okuyan ya da veri dosyasına dışarıdan
// dokunan test önce dondurmanın BİTMESİNİ bekler. Koşul (ekranın yoklamasıyla aynı): GET /api/workspace/ledger/lock → freeze.active değil (süren iş yok: dondurma, bayat satır
// temizliği, kilit izi). freeze.pending kalırsa koşu kendi hatasıyla durmuştur; bekleyen bunu sonuç olarak döndürür (test kendisi denetler).
// query: başka şirket için "hofCompany=…" gibi sorgu (test/donmus-defter-yasam-250.test.mjs).
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));

/** Dondurma işi bitene kadar bekler; son kilit görünümünü (lockedUntil, frozenThrough, freeze) döndürür. Süre aşılırsa hata (sessiz geçiş yok). */
export async function waitForFreeze(client, { query = "", timeoutMs = 120000, stepMs = 25 } = {}) {
  const url = `/api/workspace/ledger/lock${query ? `?${query}` : ""}`;
  const deadline = Date.now() + timeoutMs;
  let view = null;
  for (;;) {
    const response = await client.get(url);
    if (response.status !== 200) throw new Error(`kilit görünümü ${response.status}: ${JSON.stringify(response.data).slice(0, 300)}`);
    view = response.data.data;
    if (!view.freeze?.active) return view;
    if (Date.now() > deadline) throw new Error(`dondurma ${timeoutMs} ms'de bitmedi: ${JSON.stringify(view.freeze)}`);
    await sleep(stepMs);
  }
}

/** Kilidi koyar ve dondurmanın bitmesini bekler. Dönüş: { put: PUT yanıtının verisi, view: son kilit görünümü }. PUT 200 değilse hata. */
export async function lockAndWait(client, lockedUntil, { query = "", body = {}, timeoutMs = 120000 } = {}) {
  const response = await client.put(`/api/admin/period-lock${query ? `?${query}` : ""}`, { lockedUntil, ...body });
  if (response.status !== 200) throw new Error(`kilit ${lockedUntil || "kaldır"}: ${response.status} ${JSON.stringify(response.data).slice(0, 300)}`);
  const view = await waitForFreeze(client, { query, timeoutMs });
  return { put: response.data.data, view };
}
