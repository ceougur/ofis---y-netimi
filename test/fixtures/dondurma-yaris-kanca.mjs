// Ders 20 / 51 zorlama yardımcısı (Ç5-A tur 1c; YALNIZ test/b7-dondurma-yaris-zorla.mjs ön yüklemesinin yükleyici kancası — ürün kodu DEĞİŞMEZ): server/app.mjs
// kaynağının SONUNA, createApp'i sarmalayan birkaç satır eklenir. Sarmalayıcı yalnız ön yükleme (test/fixtures/dondurma-yaris-zorla-yukle.mjs) globalThis'e zorlama
// nesnesini koyduysa çalışır; yoksa createApp aynen. Ek: createApp(overrides) → açılışta bekleyen dondurmayı "before-done" adımında TUTAN __testFreezeHook (ürünün
// kendi YALNIZ TEST kancası, app.mjs:552) + örneğin sarmalanması (zorlama nesnesinin wrap'i).
const APPENDIX = `
;{
  const __zorlaOrig = createApp;
  createApp = function (overrides = {}) {
    const zorla = globalThis.__dondurmaYarisZorla;
    // Kendi dondurma kancasını veren test (ön koşulu kendisi kuran) zorlanmaz: iki kanca birbirini bekleyip kilitlenirdi.
    if (!zorla || overrides.__testFreezeHook) return __zorlaOrig(overrides);
    const gate = zorla.gate();
    const app = __zorlaOrig({ ...overrides, __testFreezeHook: overrides.__testFreezeHook || gate.hook });
    zorla.wrap(app, gate);
    return app;
  };
}
`;

// Ç5-A tur 1d (İş C): programın AÇILIŞ çağrısı (app.mjs `setImmediate(() => context.ledger.snapshots.runPending()…)`) işaretlenir — ürünün runPending'i bağımsız değişken almaz,
// işaret yalnız sarmalayıcının okuduğu fazladan bağımsız değişkendir. Önceki ayrım ("sarmalayıcının setImmediate'i koşana kadarki çağrılar açılışındır") YANLIŞTI: test,
// bootVersion'ın listen'ı çözülünce runPending'i programın setImmediate'inden ÖNCE çağırabiliyor (12.11'de yeniden üretildi: çağrı yığınında önce test, sonra app.mjs
// Immediate) → testin çağrısı açılışınki sayılıyor, kanca bırakılmıyor, test ve kanca birbirini bekliyordu. Çağrı yeri bulunamazsa zorlama SESSİZCE bozulmaz: yükleme düşer.
const OPENING_CALL = "context.ledger.snapshots.runPending().catch(";
const OPENING_MARKED = "context.ledger.snapshots.runPending({ __acilisCagrisi: true }).catch(";

export async function load(url, context, nextLoad) {
  const result = await nextLoad(url, context);
  if (!/\/server\/app\.mjs$/.test(url)) return result;
  const source = typeof result.source === "string" ? result.source : Buffer.from(result.source).toString("utf8");
  const calls = source.split(OPENING_CALL).length - 1;
  if (calls !== 1) throw new Error(`dondurma yarışı zorlaması: app.mjs'te açılışın runPending çağrısı ${calls} kez bulundu (1 beklenir) — zorlama bu kodla kullanılamaz`);
  return { ...result, source: `${source.replace(OPENING_CALL, OPENING_MARKED)}${APPENDIX}`, shortCircuit: true };
}
