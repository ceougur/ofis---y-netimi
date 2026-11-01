// İŞ Z (2.4.8) — "ofisteki BAŞKA kullanıcı": AYRI SÜREÇTE (ölçülen programın olay döngüsünden bağımsız) programa kendi oturumuyla bağlanır ve ölçüm penceresi
// boyunca her 200 ms'de bir cari listesini ister; her isteğin süresini kaydeder. Program kilitliyse bu istekler kilit bitene dek bekler → en uzun süre ≈ kilit.
// IPC: { tur: "basla" } → pencereyi açar, { tur: "dur" } → { n, enCokMs, p50Ms, hata } döner. Kullanım: fork(bu dosya, [taban adres, kullanıcı, parola, şirket kimliği])
const [BASE, KULLANICI, PAROLA, SIRKET] = process.argv.slice(2);
let cerez = "";
const iste = async (method, yol, govde) => {
  const r = await fetch(`${BASE}${yol}`, { method, headers: { "content-type": "application/json", ...(cerez ? { cookie: cerez } : {}) }, body: govde ? JSON.stringify(govde) : undefined });
  const c = r.headers.get("set-cookie");
  if (c) cerez = c.split(";")[0];
  await r.arrayBuffer();
  return r.status;
};
const giris = await iste("POST", "/api/auth/login", { username: KULLANICI, password: PAROLA });
let acik = false;
let sureler = [];
let hata = 0;
const dongu = async () => {
  while (acik) {
    const t = performance.now();
    try {
      const s = await iste("GET", `/api/workspace/accounts?status=all&limit=50&hofCompany=${encodeURIComponent(SIRKET)}`);
      if (s !== 200) hata += 1;
    } catch {
      hata += 1;
    }
    sureler.push(performance.now() - t);
    await new Promise(r => setTimeout(r, 200));
  }
};
let calisan = null;
process.on("message", async m => {
  if (m.tur === "basla") {
    sureler = [];
    hata = 0;
    acik = true;
    calisan = dongu();
    process.send({ kimlik: m.kimlik, deger: true });
  } else if (m.tur === "dur") {
    acik = false;
    await calisan;
    const s = sureler.slice().sort((a, b) => a - b);
    process.send({ kimlik: m.kimlik, deger: { n: s.length, enCokMs: s.length ? Math.round(s.at(-1)) : null, p50Ms: s.length ? Math.round(s[Math.floor(s.length / 2)]) : null, hata } });
  } else if (m.tur === "kapat") process.exit(0);
});
process.send({ hazir: true, giris });
