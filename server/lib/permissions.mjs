// Rol bazlı yetki matrisi. Sunucu her işlemde buna göre karar verir; arayüz yalnızca görünürlüğü ayarlar.
export const ROLES = Object.freeze(["admin", "avukat", "personel", "muhasebe"]);
export const ROLE_LABELS = Object.freeze({ admin: "Yönetici", avukat: "Avukat", personel: "Personel", muhasebe: "Muhasebe" });

const ALL = ROLES;
export const PERMISSIONS = Object.freeze({
  "records.create": ALL,
  "records.edit": ALL,
  "records.delete": ["admin", "avukat"],
  "notes.write": ALL,
  "phones.create": ALL,
  "payments.create": ALL,
  "liens.create": ALL,
  // Kayda belge ekleme (v2.0.1): herkes ekler ve görür; kendi eklediğini siler. Başkasının eklediğini silmek
  // yönetici ve ikinci rol (avukat) yetkisidir.
  "documents.upload": ALL,
  "documents.manage": ["admin", "avukat"],
  // Kasa (v2.0.1): tahsilat ve ödeme hareketleri, güncel kasa durumu. Başkasının girdiği tahsilatı düzeltmek veya
  // silmek de kasa yetkisidir; herkes kendi girdiği tahsilatı düzeltebilir.
  "cash.view": ["admin", "avukat", "muhasebe"],
  "cash.manage": ["admin", "avukat", "muhasebe"],
  // Taksitler (v2.0.4): herkes kartları görür ve tahsilat girer; kart açma/düzenleme/silme, grup tanımı ve Excel'den
  // yükleme kasa yetkisiyle aynı hesaplarda. Başkasının girdiği hareketi düzeltmek/silmek de yönetim yetkisidir.
  "plans.view": ALL,
  "plans.collect": ALL,
  "plans.manage": ["admin", "avukat", "muhasebe"],
  // Cari (v2.0.6): herkes carileri görür ve tahsilat girer; cari açma/düzenleme/silme, borç/alacak/ödeme girişi,
  // Excel'den yükleme ve toplu taksitlendirme (plans.manage) kasa yetkisiyle aynı hesaplarda.
  "accounts.view": ALL,
  "accounts.collect": ALL,
  "accounts.manage": ["admin", "avukat", "muhasebe"],
  // Stok (v2.0.6): herkes stoku görür ve miktar hareketi (giriş/çıkış) girer; ürün kartı, Excel'den yükleme ve
  // Kasa'ya ya da cariye para yazan hareketler yönetim yetkisidir.
  "stock.view": ALL,
  "stock.move": ALL,
  "stock.manage": ["admin", "avukat", "muhasebe"],
  // Çek / Senet (v2.0.7): portföy, tahsil, ciro, ödeme; para ve cari bakiyesine dokunduğu için kasa yetkisiyle aynı hesaplar.
  "cheques.view": ["admin", "avukat", "muhasebe"],
  "cheques.manage": ["admin", "avukat", "muhasebe"],
  // ANLIK DURUM kokpiti ve raporları (v2.0.7): kasa, alacak/borç, mizan ve nakit akışı. Yalnız yönetici; başka kişiye
  // yönetici Yönetim → Kullanıcılar'dan tek tek verir (kişiye özel ek yetki, GRANTABLE).
  "overview.view": ["admin"],
  // Görev atama, herkesin görevleri ve performans raporu (KPI) yalnızca avukat ve yönetici içindir;
  // personel ve muhasebe kendilerine atanan görevleri görür ve tamamlar.
  "tasks.create": ["admin", "avukat"],
  "tasks.viewAll": ["admin", "avukat"],
  "tasks.complete": ALL,
  "messages.create": ALL,
  "reports.view": ["admin", "avukat"],
  "audit.view": ["admin", "avukat"],
  "sources.manage": ["admin"],
  // Sektör seçimi ve kalemle başlık değiştirme (v1.6.0).
  "profile.manage": ["admin"],
  "users.manage": ["admin"],
  "system.manage": ["admin"],
  // Lisans etkinleştirme ve doğrulama (v2.0.0).
  "license.manage": ["admin"],
});

export const can = (role, permission) => Boolean(PERMISSIONS[permission]?.includes(role));
export const permissionsFor = role => Object.keys(PERMISSIONS).filter(permission => can(role, permission));

// Kişiye özel verilebilen ek yetkiler (v2.0.7). Rolün yetkisine eklenir; rolün yetkisini daraltmaz.
export const GRANTABLE = Object.freeze({ "overview.view": "ANLIK DURUM ve raporlar" });
export function grantsOf(user) {
  try {
    const value = JSON.parse(user?.grants_json ?? user?.grantsJson ?? "[]");
    return Array.isArray(value) ? value.filter(permission => Object.hasOwn(GRANTABLE, permission)) : [];
  } catch {
    return [];
  }
}
export const canUser = (user, permission) => Boolean(user) && (can(user.role, permission) || grantsOf(user).includes(permission));
export const permissionsForUser = user => [...new Set([...permissionsFor(user.role), ...grantsOf(user)])];
