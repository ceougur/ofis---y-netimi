// Ders 20 / 51 zorla üretme ön yüklemesi (`node --import`; Ç5-A tur 1c, tur 1d; YALNIZ test/b7-dondurma-yaris-zorla.mjs — bu bir test değildir, ürün kodu DEĞİŞMEZ).
// Programın açılışta başlattığı bekleyen dondurmanın (göç 47'nin eski kurallı koşusu; app.mjs setImmediate → snapshots.runPending) testin adımlarına göre NE ZAMAN bittiği
// ürünün YALNIZ TEST kancasıyla (__testFreezeHook "before-done": dondurma son adımında tutulur) zorlanır; süre / uyku YOK. Kip DONDURMA_YARIS ortam değişkeniyle:
//   ara   (varsayılan): dondurma testin İLK karşılaştırma adımına (ilk arka plan taraması ya da testin kendi runPending çağrısı) kadar bitmez; bekleyen koşu sürerken başlamış
//                       arka plan taraması bitince dondurma tamamlatılır — eski B7 testinin iki taraması anın iki yanına düşer (arka plan "sürüyor"u, satır içi "bitti"yi görür).
//                       Testin kendisi runPending'i çağırırsa (ön koşulu ürünün durumundan kuran test) kapı açılır.
//   tut               : dondurma testin kendi runPending çağrısına ya da kapanışa kadar bitmez (testin bütün okumaları "dondurma sürüyor" anında).
//   bitir             : app.listen, açılışın dondurması BİTMEDEN dönmez (testin bütün okumaları "dondurma bitti" anında).
//   gozlem (tur 1d)   : testin İLK adımı (kendi runPending beklemesi ya da ilk arka plan taraması) dondurma kancada TUTULURKEN gözlenir — adım başlar, sarmalayıcı kancanın
//                       dondurmayı gerçekten tuttuğunu (before-done'a vardığını) olayla bekler, sonra bırakır: runPending'de hemen (test zaten bitişi bekliyor), taramada tarama
//                       bittikten sonra (eski B7'nin iki taraması anın iki yanına düşer). Süre / uyku yok; bırakma testin adımına bağlı.
// Programın açılış çağrısı kanca dosyasındaki işaretle ayrılır (dondurma-yaris-kanca.mjs; tur 1c'nin zamana bağlı ayrımı testin erken çağrısını açılışınki sayıyordu).
// Çıkışta ön koşul satırı: ara → en az bir örnekte ilk karşılaştırma adımında koşu bekliyordu VE sonra bitti; tut → en az bir örnekte kanca dondurmayı tuttu; bitir → en az bir
// örnekte açılışta bekleyen koşu vardı ve listen'dan önce bitti; gozlem → en az bir örnekte testin ilk adımı başladığında kanca dondurmayı GERÇEKTEN tutuyordu, bırakma o adım
// gözlenerek yapıldı VE dondurma sonra bitti.
import { register } from "node:module";

register("./dondurma-yaris-kanca.mjs", import.meta.url);

const MODES = ["ara", "tut", "bitir", "gozlem"];
const MODE = MODES.includes(process.env.DONDURMA_YARIS) ? process.env.DONDURMA_YARIS : "ara";
const seen = [];
globalThis.__dondurmaYarisZorla = {
  gate() {
    let release = () => {};
    const opened = new Promise(resolve => {
      release = resolve;
    });
    let reach = () => {};
    const reached = new Promise(resolve => {
      reach = resolve;
    });
    const gate = {
      held: false,
      released: MODE === "bitir",
      reached,
      release() {
        gate.released = true;
        release();
      },
      hook: {
        // Yalnız İLK dondurma (açılışın bekleyen koşusu) tutulur; testin sonraki kilit değişikliklerinin dondurmaları kendi akışında koşar.
        async fn(phase) {
          if (phase !== "before-done" || gate.released || gate.held) return;
          gate.held = true;
          reach();
          await opened;
        },
      },
    };
    return gate;
  },
  wrap(app, gate) {
    const snaps = app.ledger?.snapshots;
    const integrity = app.integrity;
    if (!snaps?.runPending || !integrity?.scanInBackground) return;
    const record = { pendingAtOpen: Boolean(snaps.state().pending), pendingAtFirstStep: null, firstStep: "", heldAtFirstStep: null, releasedByStep: false, doneAfter: false, doneBeforeListen: false, held: () => gate.held };
    seen.push(record);
    const firstStep = kind => {
      if (record.pendingAtFirstStep !== null) return false;
      record.pendingAtFirstStep = Boolean(snaps.state().pending);
      record.firstStep = kind;
      return true;
    };
    const runPending = snaps.runPending;
    // gozlem: testin adımı sürerken kancanın dondurmayı GERÇEKTEN tuttuğu olayla beklenir (adımın kendi dondurma beklemesiyle yarışır: dondurma before-done'a varmadan düşerse
    // ya da hiç koşu yoksa beklenmez — asılma yok). Dönüş: kanca o an tutuyor muydu.
    const observeHeld = async waiting => {
      if (gate.released) return false;
      await Promise.race([gate.reached, waiting]);
      return gate.held && !gate.released && Boolean(snaps.state().pending);
    };
    snaps.runPending = async (...args) => {
      // Programın kendi açılış çağrısı (kanca dosyasının işareti): aynen.
      if (args[0]?.__acilisCagrisi) return runPending();
      const first = firstStep("runPending");
      if (MODE === "gozlem" && first && record.pendingAtFirstStep) {
        const waiting = runPending(...args);
        record.heldAtFirstStep = await observeHeld(waiting.then(() => {}, () => {}));
        record.releasedByStep = record.heldAtFirstStep;
        gate.release();
        const out = await waiting;
        if (!snaps.state().pending) record.doneAfter = true;
        return out;
      }
      gate.release();
      const out = await runPending(...args);
      if (!snaps.state().pending) record.doneAfter = true;
      return out;
    };
    const scanInBackground = integrity.scanInBackground;
    integrity.scanInBackground = async (...args) => {
      const first = firstStep("scan");
      const pendingAtStart = Boolean(snaps.state().pending);
      if (MODE === "gozlem" && first && pendingAtStart) {
        const waiting = runPending();
        record.heldAtFirstStep = await observeHeld(waiting.then(() => {}, () => {}));
        const out = await scanInBackground(...args);
        record.releasedByStep = record.heldAtFirstStep;
        gate.release();
        await waiting;
        if (!snaps.state().pending) record.doneAfter = true;
        return out;
      }
      const out = await scanInBackground(...args);
      if (pendingAtStart && MODE === "ara") {
        gate.release();
        await runPending();
        if (!snaps.state().pending) record.doneAfter = true;
      }
      return out;
    };
    if (MODE === "bitir" && typeof app.listen === "function") {
      const listen = app.listen;
      app.listen = async (...args) => {
        const address = await listen(...args);
        if (snaps.state().pending) await runPending();
        record.doneBeforeListen = record.pendingAtOpen && !snaps.state().pending;
        return address;
      };
    }
    const close = app.close;
    app.close = async (...args) => {
      gate.release();
      return close(...args);
    };
  },
};

const happenedOf = record => {
  if (MODE === "ara") return record.pendingAtFirstStep === true && record.doneAfter;
  if (MODE === "tut") return record.held();
  if (MODE === "bitir") return record.doneBeforeListen;
  return record.heldAtFirstStep === true && record.releasedByStep && record.doneAfter;
};
process.on("exit", () => {
  const happened = seen.some(happenedOf);
  const detail = seen.map(record => `açılışta bekliyor ${record.pendingAtOpen} · ilk adım ${record.firstStep || "yok"} · ilk adımda bekliyor ${record.pendingAtFirstStep} · ilk adımda kanca tutuyordu ${record.heldAtFirstStep} · bırakma adımla ${record.releasedByStep} · kanca tuttu ${record.held()} · sonra bitti ${record.doneAfter} · listen'dan önce bitti ${record.doneBeforeListen}`).join(" | ");
  process.stdout.write(`\n[dondurma yarışı] kip ${MODE} · ${seen.length} örnek (${detail || "yok"}): ön koşul ${happened ? "GERÇEKLEŞTİ" : "GERÇEKLEŞMEDİ"}\n`);
});
