import { chromium } from 'playwright';

const browser = await chromium.launch({ headless: false, args: ['--disable-blink-features=AutomationControlled'] });
const page = await browser.newPage();
await page.goto('http://localhost:5123', { waitUntil: 'domcontentloaded' });

console.log("✅ Program açıldı. URL:", page.url());
console.log("📄 Başlık:", await page.title());

// Ekran görüntüsü
await page.screenshot({ path: '/tmp/00-giris.png', fullPage: true });
console.log("📸 Ekran kaydedildi: /tmp/00-giris.png");

// Tarayıcıda 30 saniye kal (insan kullanacak)
console.log("\n⏳ Tarayıcı 30 saniye açık kalacak...");
await new Promise(r => setTimeout(r, 30000));

await browser.close();
console.log("✅ Kapatıldı");
