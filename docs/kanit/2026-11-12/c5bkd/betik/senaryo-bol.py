"""Senaryo dosyasını iki commit'e böler. `c`: tam hâli not defterine saklar, dosyayı "E13 var, zil yardımcısı ESKİ" hâline getirir (madde 3 commit'i).
`tam`: saklanan tam hâli geri yazar (madde 4 commit'i). Çalışma ağacının kökünden."""
import shutil, sys

PATH = "test/e2e/senaryo-tyk-tur2a-250.mjs"
KEEP = "/tmp/claude-0/-home-user/de5e1cbf-7e68-5683-b7bb-f27655eaed4f/scratchpad/c5bkd-betik/senaryo-tam.mjs"
NEW = '''// Zil (Ç5-B kapanış düzeltme turu, CI #1071 'zilde: []'): panel sayfanın BELLEKTEKİ takviminden kurulur; sayfa takvimi sunucudaki değişiklikten ≥ 0,8 sn sonra, en sık 4 sn'de
// bir yeniler. Eski yardımcı paneli hemen açıp 300 ms sonra okuyordu — API ile yazımdan hemen sonra (E7, E11, E12) sayfa henüz yenilenmemişse yeni kalem panelde yoktu
// (sunucunun yanıtında VARDI; zorla: test/e2e/zil-yaris-zorla.mjs). Yeni yardımcı sayfanın takvimi sunucunun güncel sürümüne yetişene kadar bekler (test/e2e/zil-oku.mjs).
const bell = () => readBell(page, api);
'''
OLD = '''const bell = async () => {
  await page.click(".topbar .top-actions > .icon-button");
  await page.waitForSelector(".hof-alert-list");
  await page.waitForTimeout(300);
  const items = await page.evaluate(() => [...document.querySelectorAll(".hof-alert-list li")].map(node => node.textContent.replace(/\\s+/g, " ").trim()));
  await page.keyboard.press("Escape");
  await page.waitForTimeout(300);
  return items;
};
'''
IMPORT = 'import { readBell } from "./zil-oku.mjs";\n'
if sys.argv[1] == "c":
    shutil.copy(PATH, KEEP)
    s = open(PATH, encoding="utf-8").read()
    assert s.count(NEW) == 1 and s.count(IMPORT) == 1
    open(PATH, "w", encoding="utf-8").write(s.replace(NEW, OLD).replace(IMPORT, ""))
    print("madde 3 hâli yazıldı (zil yardımcısı eski)")
else:
    shutil.copy(KEEP, PATH)
    print("tam hâl geri yazıldı")
