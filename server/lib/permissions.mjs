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
