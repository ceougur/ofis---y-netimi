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
});

export const can = (role, permission) => Boolean(PERMISSIONS[permission]?.includes(role));
export const permissionsFor = role => Object.keys(PERMISSIONS).filter(permission => can(role, permission));
