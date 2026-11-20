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
