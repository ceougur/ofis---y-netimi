// Kişi adlarının karşılaştırılması, çakışma denetimi ve adla kişi bulma.
// Görevler, sohbet ve işlem geçmişi kişiyi adıyla gösterir; bu yüzden iki hesap aynı adı taşıyamaz (aksi hâlde
// biri kendini diğerinin adıyla gösterebilir, adla atanmış görevleri görebilirdi).

// Büyük/küçük harf (Türkçe kurallarıyla), baştaki/sondaki ve çoklu boşluklar ile Unicode yazım farkları yok sayılır.
export const foldName = value => String(value ?? "").normalize("NFC").trim().replace(/\s+/g, " ").toLocaleLowerCase("tr-TR");

// Görünen ad başka bir kullanıcının görünen adı veya kullanıcı adıyla; kullanıcı adı başka bir kullanıcının görünen
// adıyla çakışıyorsa bir açıklama döndürür, çakışma yoksa null. Pasif hesaplar da sayılır (yeniden etkinleştirilebilir).
export function nameConflict(store, { name = null, username = null, exceptId = null } = {}) {
  const wantedName = foldName(name);
  const wantedUsername = foldName(username);
  if (!wantedName && !wantedUsername) return null;
  for (const user of store.all("SELECT id, username, display_name FROM users")) {
    if (user.id === exceptId) continue;
    if (wantedName && (foldName(user.display_name) === wantedName || foldName(user.username) === wantedName)) {
      return "Bu ad başka bir kullanıcıda kayıtlı (pasif hesaplar dahil). Karışmaması için ayırt edici bir ek yazın, ör. soyadının baş harfi.";
    }
    if (wantedUsername && foldName(user.display_name) === wantedUsername) {
      return "Bu kullanıcı adı başka bir kişinin görünen adıyla aynı. Farklı bir kullanıcı adı seçin.";
    }
  }
  return null;
}

// Serbest yazılmış bir adı (ör. görevdeki "Atanacak kişi") tek bir kullanıcıya bağlar. Önce görünen ad (aktif
// hesaplar öncelikli), yoksa kullanıcı adı eşleşmesine bakılır; birden çok aday varsa kimse seçilmez.
export function resolveUserByName(store, value) {
  const wanted = foldName(value);
  if (!wanted) return null;
  const users = store.all("SELECT id, username, display_name, active FROM users");
  const single = list => (list.length === 1 ? list[0] : null);
  const byName = users.filter(user => foldName(user.display_name) === wanted);
  if (byName.length) return single(byName.filter(user => user.active).length ? byName.filter(user => user.active) : byName);
  return single(users.filter(user => foldName(user.username) === wanted));
}

// 2.5.0 S223 = A (kullanıcı 20.11.2026): kişi eşleştiren içe aktarmalarda (cari Excel / Sheets, taksit Excel / Sheets, çek / senet içe aktarma,
// Tablodan Aktar) cari adı foldName ile (Türkçe büyük / küçük harf, boşluk, Unicode biçimi) karşılaştırılır. Ad → kimlik haritası yükleme başına
// BİR KEZ, ilk sorulduğunda kurulur (load: [{ id, name }]; ders 47: satır başına tablo taraması yok); yüklemede açılan ya da adı değişen kayıt add
// ile eklenir (harita kurulmadan önceki add gereksizdir: kurulurken güncel tablo okunur). ids(name) aynı katlanmış adın kimlikleri — geri alınmış
// iç işlemde açılmış ya da sonradan adı değişmiş kayıt da olabilir; çağıran güncel satırı okuyup adı yeniden denetler.
// foldPersonName: foldName'in AYNI sonucu (test/s223-turkce-ad-eslesme-250.test.mjs bütün Unicode kod noktalarında denetler), yalnız hızlı —
// toLocaleLowerCase("tr-TR") 100 bin adda ~0,25 sn; Türkçe kuralın farkı yalnız I → ı ve İ → i (NFC 'I' + U+0307'yi İ'ye birleştirir), gerisi
// yerel ayarsız toLowerCase ile aynı. foldName değişmez (kullanıcı / rol adı yolları onu kullanır).
const TURKISH_I = /[Iİ]/g;
const SPACE_RUN = /\s\s|[^\S ]/;
export const foldPersonName = value => {
  const trimmed = String(value ?? "").normalize("NFC").trim();
  const spaced = SPACE_RUN.test(trimmed) ? trimmed.replace(/\s+/g, " ") : trimmed;
  return (spaced.includes("I") || spaced.includes("İ") ? spaced.replace(TURKISH_I, letter => (letter === "I" ? "ı" : "i")) : spaced).toLowerCase();
};
export function foldedNameIndex(load) {
  let map = null;
  const put = (id, name) => {
    const key = foldPersonName(name);
    if (!key) return;
    let ids = map.get(key);
    if (!ids) map.set(key, (ids = new Set()));
    ids.add(id);
  };
  const ready = () => {
    if (!map) {
      map = new Map();
      for (const row of load()) put(row.id, row.name);
    }
    return map;
  };
  return {
    add(id, name) {
      if (map && id) put(id, name);
    },
    ids(name) {
      const key = foldPersonName(name);
      return key ? [...(ready().get(key) || [])] : [];
    },
  };
}

// 2.5.0 S231 (çek / senet içe aktarmasının HIZI; davranış S223 = A ile AYNEN): adları önceden bilinen yükleme için foldedNameIndex'in eşdeğeri.
// ÖLÇÜLEN NEDEN (5.484 caride, 'hepsi yeni ad' çek 500): foldedNameIndex bütün carileri SATIR satır okuyup (~3 ms) her adı AYRI katlıyor (~2,3 ms) ve
// hepsini haritaya koyuyordu (~1,5 ms) — NOCASE'in bulamadığı ilk satırda, her yüklemede. Burada: adlar TEK metin olarak okunur (loadJoined():
// { n, bad, s } — s = "kimlik\u0001ad" öğeleri "\u0000" ile birleşik, n öğe sayısı, bad adında "\u0000" / "\u0001" geçen öğe sayısı), metin TEK seferde
// katlanır (foldJoinedNames) ve haritaya YALNIZ aranan adların (wanted) katlanmış adıyla aynı olanlar girer. Aranan kümede olmayan ad sorulursa, metin
// beklenen biçimde değilse (bad > 0, öğe sayısı tutmuyor) fallback (foldedNameIndex) kullanılır — sonuç her durumda foldedNameIndex'inkiyle aynı kimlikler.
// foldJoinedNames: foldPersonName'in adımları (NFC, boşluk, I / İ, küçük harf) bütün metne; "\u0000" ve "\u0001" NFC'de birleşmez, boşluk değildir,
// büyük / küçük harfi yoktur ve son sigma kuralında sınır sayılır → her öğenin ad kısmı foldPersonName(ad) ile aynı (test/s231-cek-hiz-esdegerlik-250).
const JOINED_START_SPACE = /\u0001 /g;
const JOINED_END_SPACE = / (?=\u0000|$)/g;
export const foldJoinedNames = joined => {
  const spaced = String(joined ?? "").normalize("NFC").replace(/\s+/g, " ").replace(JOINED_START_SPACE, "\u0001").replace(JOINED_END_SPACE, "");
  return (spaced.includes("I") || spaced.includes("İ") ? spaced.replace(TURKISH_I, letter => (letter === "I" ? "ı" : "i")) : spaced).toLowerCase();
};
export function foldedNameLookup(wanted, loadJoined, fallback) {
  const keys = new Set();
  for (const name of wanted) {
    const key = foldPersonName(name);
    if (key) keys.add(key);
  }
  let map = null;
  const ready = () => {
    if (map !== null) return map;
    const { n = 0, bad = 0, s = "" } = loadJoined() || {};
    if (!n) return (map = new Map());
    const raw = bad ? [] : String(s).split("\u0000");
    const folded = raw.length === n ? foldJoinedNames(s).split("\u0000") : [];
    if (folded.length !== n) return (map = false);
    map = new Map();
    for (let i = 0; i < n; i += 1) {
      const cut = raw[i].indexOf("\u0001");
      if (cut < 0 || folded[i].indexOf("\u0001") !== cut) return (map = false);
      const key = folded[i].slice(cut + 1);
      if (!key || !keys.has(key)) continue;
      let ids = map.get(key);
      if (!ids) map.set(key, (ids = new Set()));
      ids.add(raw[i].slice(0, cut));
    }
    return map;
  };
  return {
    add(id, name) {
      fallback.add(id, name);
      const key = foldPersonName(name);
      if (map && id && keys.has(key)) {
        let ids = map.get(key);
        if (!ids) map.set(key, (ids = new Set()));
        ids.add(id);
      }
    },
    ids(name) {
      const key = foldPersonName(name);
      if (!key) return [];
      const found = keys.has(key) ? ready() : false;
      return found ? [...(found.get(key) || [])] : fallback.ids(name);
    },
  };
}
