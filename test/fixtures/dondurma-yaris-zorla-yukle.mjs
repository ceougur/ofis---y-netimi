// Ders 20 / 51 zorla üretme ön yüklemesi (`node --import`; Ç5-A tur 1c; YALNIZ test/b7-dondurma-yaris-zorla.mjs — bu bir test değildir, ürün kodu DEĞİŞMEZ).
// Programın açılışta başlattığı bekleyen dondurmanın (göç 47'nin eski kurallı koşusu; app.mjs setImmediate → snapshots.runPending) testin adımlarına göre NE ZAMAN bittiği
// ürünün YALNIZ TEST kancasıyla (__testFreezeHook "before-done": dondurma son adımında tutulur) zorlanır; süre / uyku YOK. Kip DONDURMA_YARIS ortam değişkeniyle:
//   ara   (varsayılan): dondurma testin İLK karşılaştırma adımına (ilk arka plan taraması ya da testin kendi runPending çağrısı) kadar bitmez; bekleyen koşu sürerken başlamış
//                       arka plan taraması bitince dondurma tamamlatılır — eski B7 testinin iki taraması anın iki yanına düşer (arka plan "sürüyor"u, satır içi "bitti"yi görür).
//                       Testin kendisi runPending'i çağırırsa (ön koşulu ürünün durumundan kuran test) kapı açılır.
//   tut               : dondurma testin kendi runPending çağrısına ya da kapanışa kadar bitmez (testin bütün okumaları "dondurma sürüyor" anında).
//   bitir             : app.listen, açılışın dondurması BİTMEDEN dönmez (testin bütün okumaları "dondurma bitti" anında).
// Çıkışta ön koşul satırı: ara → en az bir örnekte ilk karşılaştırma adımında koşu bekliyordu VE sonra bitti; tut → en az bir örnekte kanca dondurmayı tuttu; bitir → en az bir
// örnekte açılışta bekleyen koşu vardı ve listen'dan önce bitti.
import { register } from "node:module";

register("./dondurma-yaris-kanca.mjs", import.meta.url);

const MODE = ["ara", "tut", "bitir"].includes(process.env.DONDURMA_YARIS) ? process.env.DONDURMA_YARIS : "ara";
const seen = [];
globalThis.__dondurmaYarisZorla = {
  gate() {
    let release = () => {};
    const opened = new Promise(resolve => {
      release = resolve;
    });
    const gate = {
      held: false,
      released: MODE === "bitir",
      release() {
        gate.released = true;
        release();
      },
      hook: {
        // Yalnız İLK dondurma (açılışın bekleyen koşusu) tutulur; testin sonraki kilit değişikliklerinin dondurmaları kendi akışında koşar.
        async fn(phase) {
          if (phase !== "before-done" || gate.released || gate.held) return;
          gate.held = true;
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
    const record = { pendingAtOpen: Boolean(snaps.state().pending), pendingAtFirstStep: null, doneAfter: false, doneBeforeListen: false, held: () => gate.held };
    seen.push(record);
    // Programın kendi açılış çağrısı (app.mjs setImmediate) bundan ÖNCE kuyruğa girdi; bu setImmediate ondan sonra koşar → sonraki her çağrı testindir.
    let opening = true;
    setImmediate(() => {
      opening = false;
    });
    const firstStep = () => {
      if (record.pendingAtFirstStep === null) record.pendingAtFirstStep = Boolean(snaps.state().pending);
    };
    const runPending = snaps.runPending;
    snaps.runPending = async (...args) => {
      if (opening) return runPending(...args);
      firstStep();
      gate.release();
      const out = await runPending(...args);
      if (!snaps.state().pending) record.doneAfter = true;
      return out;
    };
    const scanInBackground = integrity.scanInBackground;
    integrity.scanInBackground = async (...args) => {
      firstStep();
      const pendingAtStart = Boolean(snaps.state().pending);
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

process.on("exit", () => {
  const happened = MODE === "ara" ? seen.some(record => record.pendingAtFirstStep === true && record.doneAfter) : MODE === "tut" ? seen.some(record => record.held()) : seen.some(record => record.doneBeforeListen);
  const detail = seen.map(record => `açılışta bekliyor ${record.pendingAtOpen} · ilk adımda bekliyor ${record.pendingAtFirstStep} · kanca tuttu ${record.held()} · sonra bitti ${record.doneAfter} · listen'dan önce bitti ${record.doneBeforeListen}`).join(" | ");
  process.stdout.write(`\n[dondurma yarışı] kip ${MODE} · ${seen.length} örnek (${detail || "yok"}): ön koşul ${happened ? "GERÇEKLEŞTİ" : "GERÇEKLEŞMEDİ"}\n`);
});
