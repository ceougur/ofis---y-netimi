// T9 ÖLÇEK (2.4.8 son aday) — sahte Meta Graph'ı AYRI SÜREÇTE çalıştırır (ölçülen programın belleği / olay döngüsü sahte Meta'nın kayıtlarını taşımasın).
// Sahte Meta: test/whatsapp-sahte-graph.mjs (programı yazan elden; kâhin DEĞİL — burada yalnız karşı uç). Yalnız 127.0.0.1 (ders 30: gerçek Meta yok).
// IPC: { tur: "ayarla", yama } · { tur: "yeni" } → son çağrıdan beri kabul edilen iletiler [{ wamid, to, opaque }] · { tur: "abonelik" } → son kanca kaydı ·
//      { tur: "sayac" } → { gonderilen, medya, silinen }. Bellek: istek günlüğü ve PDF baytları her 2 sn'de boşaltılır (kimlikler kalır: DELETE/ileti denetimi aynı).
// Kullanım: fork(bu dosya, [tier, wamidOnEki]) — wamid ön eki her koşuda benzersiz (art arda süreçlerde aynı wamid'in iki işe düşmemesi için).
import { startFakeGraph } from "../whatsapp-sahte-graph.mjs";
import { PNID, PROGRAM_TEMPLATES, TOKEN, WABA } from "../whatsapp-248-ortak.mjs";

const [tier = "TIER_250", onEk = "T9"] = process.argv.slice(2);
const fake = await startFakeGraph({ token: TOKEN, phoneNumberId: PNID, wabaId: WABA });
fake.state.templates.push(...PROGRAM_TEMPLATES());
fake.state.tier = tier;
let okunan = 0;
let toplam = 0;
// wamid biçimi programa görünmez (yalnız eşitlik); benzersizlik için sahte sunucunun sayacına ön ek verilemediğinden iletiler kaydedilirken yeniden adlandırılmaz:
// sahte sunucu "wamid.SAHTE<sayaç>" üretir → sayaç başlangıcı ön ekten türetilen büyük bir sayıya alınır.
fake.state.sent = Number.parseInt(onEk, 36) % 9_000_000 * 100_000;
const temizle = setInterval(() => {
  fake.requests.length = 0;
  for (const item of fake.state.media.values()) item.data = null;
  fake.state.deleted.length = 0;
  if (fake.state.messages.length > 50_000 && okunan === fake.state.messages.length) {
    fake.state.messages.length = 0;
    okunan = 0;
  }
}, 2000);
temizle.unref();
process.on("message", async mesaj => {
  const yanit = deger => process.send({ kimlik: mesaj.kimlik, deger });
  if (mesaj.tur === "ayarla") {
    // IPC JSON taşır: düzenli ifadeler metin olarak gelir.
    const yama = { ...mesaj.yama };
    for (const k of ["dropAfter", "hang"]) if (typeof yama[k] === "string") yama[k] = new RegExp(yama[k]);
    Object.assign(fake.state, yama);
    return yanit(true);
  }
  if (mesaj.tur === "yeni") {
    const liste = fake.state.messages.slice(okunan).map(item => ({ wamid: item.wamid, to: item.to, opaque: item.opaque }));
    okunan = fake.state.messages.length;
    toplam += liste.length;
    // Okunmuş iletiler hemen atılır (ilk geçmiş üretiminde sahte Meta süreci ~66.000 iletiden sonra yığın sınırında düştü — test düzeneği, ürün değil).
    fake.state.messages.splice(0, okunan);
    okunan = 0;
    return yanit(liste);
  }
  if (mesaj.tur === "abonelik") return yanit(fake.state.subscriptions.at(-1) || null);
  if (mesaj.tur === "sayac") return yanit({ gonderilen: toplam + (fake.state.messages.length - okunan), medya: fake.state.media.size, rss: process.memoryUsage().rss });
  if (mesaj.tur === "kapat") {
    clearInterval(temizle);
    await fake.close();
    yanit(true);
    process.exit(0);
  }
  return yanit(null);
});
process.send({ hazir: true, url: fake.url });
