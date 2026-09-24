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
  "tasks.create": ALL,
  "tasks.complete": ALL,
  "messages.create": ALL,
  "reports.view": ["admin", "avukat", "muhasebe"],
  "audit.view": ["admin", "avukat"],
  "sources.manage": ["admin", "avukat"],
  "users.manage": ["admin"],
  "system.manage": ["admin"],
});

export const can = (role, permission) => Boolean(PERMISSIONS[permission]?.includes(role));
export const permissionsFor = role => Object.keys(PERMISSIONS).filter(permission => can(role, permission));
