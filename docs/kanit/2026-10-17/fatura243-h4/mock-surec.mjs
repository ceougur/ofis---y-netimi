// Sahte EDM'yi AYRI SÜREÇTE çalıştırır (ölçülen sürecin yükünden bağımsız olay döngüsü); adresi ebeveyne iletir.
// Kullanım: fork(mock-surec.mjs, [<kod kökü>])
const root = process.argv[2];
const { startMockEdm } = await import(`${root}/test/einvoice-mock.mjs`);
const mock = await startMockEdm();
process.send?.({ url: mock.url });
// İkinci bağımsız değişken "min-maks": sahte EDM'nin sürecine aralıklı eşzamanlı iş (yük altındaki sahte sunucu; yuk.mjs lagLoop ile aynı).
if (process.argv[3]) {
  const { lagLoop } = await import("./gecikme.mjs");
  lagLoop(process.argv[3]);
}
process.on("message", message => {
  if (message === "kapat") mock.close().then(() => process.exit(0));
  // { blok: ms, sonra: ms } — "sonra" ms sonra sahte EDM'nin olay döngüsünü "blok" ms bloklar (zorla2.mjs).
  if (message && typeof message === "object" && message.blok) {
    // Blok "check" evresinde (setImmediate): yükteki sunucunun G/Ç geri çağrılarındaki uzun işi gibi. Zamanlayıcı evresinde bloklamak libuv'nin
    // önbelleğe aldığı saat yüzünden boşta zamanlayıcısını aynı turda çalıştırmaz (ilk deneme: zorla2-eski-checkUser.json 5/5 başarılı).
    setTimeout(() => setImmediate(() => {
      const end = Date.now() + message.blok;
      while (Date.now() < end);
    }), message.sonra || 0);
  }
});
