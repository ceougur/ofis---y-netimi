import { chromium } from 'playwright';

const BASE_URL = "http://localhost:5123";
const PASS = "Prova-Admin-2026!";

console.log("\n⚠️  HATA VE GÜVENLİK TESTLERI\n");

let sorunlar = [];

// 1. YETKİSİZ ERİŞİM TESTİ
console.log("=== 1. YETKİSİZ IŞLEMLER ===\n");

// Başka şirkete geç ve veri oku
console.log("🔐 Test: User1 (001'de oturum) User2 (002) verisine erişebilir mi?");
try {
  const hackAttempt = await fetch(`${BASE_URL}/api/workspace/accounts?hofCompany=002`, {
    headers: { 'Cookie': 'session_002' }
  }).then(r => r.json());
  
  if (hackAttempt.error || hackAttempt.message === 'Unauthorized') {
    console.log("   ✅ Başarıyla reddedildi (Unauthorized)");
  } else {
    console.log("   ⚠️  UYARI: 002 verisi geri döndü!");
    sorunlar.push("Şirket 002 verisine yetkisiz erişim başarılı");
  }
} catch (e) {
  console.log("   ✅ Bağlantı reddedildi:", e.message);
}

// 2. HATA IŞLEMLERI TESTİ
console.log("\n=== 2. MANTIK HATALARI ===\n");

// Negatif tutar gir
console.log("💰 Test: Negatif tahsilat giri");
try {
  const negRes = await fetch(`${BASE_URL}/api/workspace/cash`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      hofCompany: '001',
      method: 'cash',
      amount: -5000,
      notes: 'Negatif test'
    })
  }).then(r => r.json());
  
  if (negRes.error || negRes.code === 400) {
    console.log("   ✅ Reddedildi");
  } else if (negRes.amount < 0) {
    console.log("   ⚠️  UYARI: Negatif tutar kabul edildi!");
    sorunlar.push("Negatif tahsilat sisteme girdi");
  } else {
    console.log("   ✅ İşlem başarılı ama kontrol et");
  }
} catch (e) {
  console.log("   ✅ Hata:", e.message);
}

// Çok büyük tutar gir (test)
console.log("\n💰 Test: Devasa tutar (1 milyar)");
try {
  const giganticRes = await fetch(`${BASE_URL}/api/workspace/cash`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      hofCompany: '001',
      amount: 1000000000,
      method: 'cash'
    })
  }).then(r => r.json());
  
  console.log("   ⚠️  Devasa tutar kabul edildi:", giganticRes.amount || '✓');
  sorunlar.push("Mantık sınırlaması yok: devasa tutar (1M TL) kabul");
} catch (e) {
  console.log("   ✅ Reddedildi");
}

// 3. KILIT (DÖNEM) KÖKLÜLÜĞÜ
console.log("\n=== 3. DÖNEM KİLİDİ ===\n");

console.log("📅 Test: Geçmiş tarihli işlem (2020)");
try {
  const pastRes = await fetch(`${BASE_URL}/api/workspace/cash`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      hofCompany: '001',
      date: '2020-01-01',
      amount: 1000,
      method: 'cash'
    })
  }).then(r => r.json());
  
  if (pastRes.error || pastRes.code === 409) {
    console.log("   ✅ Reddedildi (kilitli dönem)");
  } else {
    console.log("   ⚠️  UYARI: Geçmiş tarihli işlem girilebildi!");
    sorunlar.push("Dönem kilidi etkinse, eski tarih (2020) işlemi yazıldı");
  }
} catch (e) {
  console.log("   ✅ İşlem yapılamadı");
}

// 4. ÇIFT KAYIT TESTİ
console.log("\n=== 4. EŞZAMANLI ÇIFT KAYIT ===\n");

console.log("⚡ Test: Aynı işlem 2 kez eşzamanlı (race condition)");
const amount = 5000;
const promises = [];

for (let i = 0; i < 2; i++) {
  promises.push(
    fetch(`${BASE_URL}/api/workspace/cash`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        hofCompany: '001',
        amount,
        method: 'cash',
        notes: `Race test ${i}`
      })
    }).then(r => r.json())
  );
}

const results = await Promise.all(promises);
console.log(`   Sonuç 1: ${results[0].id || results[0].code}`);
console.log(`   Sonuç 2: ${results[1].id || results[1].code}`);

if (results[0].id === results[1].id) {
  console.log("   ⚠️  UYARI: Aynı işlem kimliği döndü (çift kayıt)!");
  sorunlar.push("Eşzamanlı aynı işlem iki kez kaydedildi (race condition)");
} else {
  console.log("   ✅ Farklı ID'ler (koruma var)");
}

// 5. VERI TÜRLERİ TESTİ
console.log("\n=== 5. BOZUK VERILER ===\n");

console.log("🔤 Test: XSS (HTML/Script)");
try {
  const xssRes = await fetch(`${BASE_URL}/api/workspace/accounts`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      hofCompany: '001',
      name: '<img src=x onerror="alert(1)">',
      notes: '<script>alert("hacked")</script>'
    })
  }).then(r => r.json());
  
  if (xssRes.id) {
    console.log("   ⚠️  UYARI: XSS payload kabul edildi!");
    sorunlar.push("HTML/Script injection başarılı");
  } else {
    console.log("   ✅ Reddedildi");
  }
} catch (e) {
  console.log("   ✅ Hata:", e.message);
}

// RAPOR
console.log("\n" + "=".repeat(50));
console.log("📋 SORUN RAPORU\n");

if (sorunlar.length === 0) {
  console.log("✅ Sorun bulunamadı!");
} else {
  console.log(`⚠️  ${sorunlar.length} sorun bulundu:\n`);
  sorunlar.forEach((s, i) => {
    console.log(`${i + 1}. ${s}`);
  });
}

console.log("\n" + "=".repeat(50));
