// Zil panelini okuyan ortak yardımcı (ders 20, 39; CI #1071 senaryo-tyk-tur2a-250 'zilde: []' — kök neden test/e2e/zil-yaris-zorla.mjs başında).
// Zil paneli sayfanın BELLEKTEKİ takviminden kurulur ve açıldıktan sonra kendini yenilemez; sayfa takvimini sunucudaki değişiklikten ≥ 0,8 sn sonra, en sık 4 sn'de bir
// yeniler. Bu yüzden panel açılmadan ÖNCE sayfanın takvimi sunucunun GÜNCEL sürümüne yetişene kadar beklenir (sabit süre değil, koşul). Sayfa KENDİ kendine yenilenmelidir —
// yardımcı elle yenileme yapmaz (ders 34: ürünün canlı yenilemesi gizlenmez; yenilenmezse bekleme zaman aşımına düşer ve adım kırmızı olur).
//   api: senaryonun API istemcisi (sayfayla AYNI kullanıcı — sürüm kişinin görebildiği kalem türlerini taşır).
//   Dönüş: paneldeki satırların metinleri.
export async function readBell(page, api, { timeout = 45_000 } = {}) {
  const res = await api.get("/api/workspace/dues");
  if (res.status !== 200) throw new Error(`zil (sunucu): ${res.status}`);
  const server = res.data && typeof res.data === "object" && "ok" in res.data ? res.data.data : res.data;
  if (!server?.version) throw new Error("zil (sunucu): takvimin sürümü okunamadı");
  await page.waitForFunction(version => window.HOF?.dues?.data?.()?.version === version, server.version, { timeout });
  await page.click(".topbar .top-actions > .icon-button");
  await page.waitForSelector(".hof-modal-backdrop.is-visible .hof-alert-list", { timeout: 15_000 });
  const items = await page.evaluate(() => [...document.querySelectorAll(".hof-alert-list li")].map(node => node.textContent.replace(/\s+/g, " ").trim()));
  await page.keyboard.press("Escape");
  await page.waitForSelector(".hof-alert-list", { state: "detached", timeout: 15_000 });
  return items;
}
