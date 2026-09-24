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
