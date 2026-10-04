import { chromium } from 'playwright';

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1920, height: 1080 } });

console.log("🚀 Program açılıyor...");
await page.goto('http://localhost:5123', { waitUntil: 'domcontentloaded', timeout: 30000 });

await page.screenshot({ path: '/tmp/01-login.png', fullPage: true });
console.log("📸 Oturum açma sayfası: /tmp/01-login.png");

// Default giriş kontrolü (Admin / parola)
const adminInput = await page.$('input[name="adminPassword"]');
if (adminInput) {
  console.log("🔑 Parola girişi bulundu. Admin parolası gir...");
  await adminInput.fill('admin123'); // Default
  await page.click('button:has-text("Giriş Yap")');
  await page.waitForNavigation({ waitUntil: 'domcontentloaded' });
}

await page.screenshot({ path: '/tmp/02-after-login.png', fullPage: true });
console.log("✅ Giriş yapıldı: /tmp/02-after-login.png");

// Şirket sayısı kontrol
const mainTitle = await page.locator('h1, h2').first().textContent();
console.log("📋 Ana sayfada görünen başlık:", mainTitle);

await browser.close();
console.log("✅ Test tamamlandı");
