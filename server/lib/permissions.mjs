// Yetki modeli. Sunucu her işlemde buna göre karar verir; arayüz yalnızca görünürlüğü ayarlar.
//
// v2.0.10 (yetki havuzu):
// - Dört yerleşik rol (aşağıdaki matris) silinmez ve değişmez.
// - Yönetici kendi rollerini tanımlar (roles tablosu; lib/access.mjs): ad + havuzdan seçilen yetkiler.
// - Kişiye özel ayar: rolün verdiğine yetki EKLENİR ya da rolün verdiği yetki KALDIRILIR (users.grants_json =
//   {"add": [...], "remove": [...]}). v2.0.7'nin dizi biçimi ([...]) "eklenen" olarak okunur.
// - Yönetimin kendisi (kullanıcılar, sistem, lisans) ve ANLIK DURUM kartı yalnız yönetici rolündedir: özel role ya da
//   kişiye verilemez, yöneticiden alınamaz. Yönetici her zaman tüm yetkilere sahiptir.
export const ROLES = Object.freeze(["admin", "avukat", "personel", "muhasebe"]);
export const ROLE_LABELS = Object.freeze({ admin: "Yönetici", avukat: "Avukat", personel: "Personel", muhasebe: "Muhasebe" });

const ALL = ROLES;
export const PERMISSIONS = Object.freeze({
  "records.create": ALL,
  "records.edit": ALL,
  "records.delete": ["admin", "avukat"],
  // Ana tabloyu Excel/CSV olarak indirme (v2.0.10): önceden herkese açıktı, öyle kalır; yönetici kişiden kaldırabilir.
  "records.export": ALL,
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
  // Satış yapma (v2.0.13, süpermarket simülasyonu): kasiyer ürün kartına ve alışa dokunmadan satış (Kasa, kart,
  // havale ya da veresiye) ve müşteri iadesi girer. Ürün kartı, alış ve fiyat yönetimi stock.manage'de kalır.
  "stock.sell": ["admin", "avukat", "muhasebe"],
  "stock.manage": ["admin", "avukat", "muhasebe"],
  // Çek / Senet (v2.0.7): portföy, tahsil, ciro, ödeme; para ve cari bakiyesine dokunduğu için kasa yetkisiyle aynı hesaplar.
  // Banka ve POS (v2.1.0; docs/BANKA-MODULU-PLAN.md §9.1, K4): Banka penceresi, hesaplar, hareketler, transfer, POS, ekstre ve mutabakat.
  // Bankaya giriş modülün tahsilat yetkisiyle (bugünkü gibi); bankadan çıkış ve banka bağlı hareketin parasını değiştirmek bank.move,
  // silmek / ters kaydetmek bank.cancel ister. Göç (v20, lib/bank/grants.mjs) bugün bankadan çıkış yapabilen özel rol ve kişiye verir.
  "bank.view": ["admin", "avukat", "muhasebe"],
  "bank.reports": ["admin", "avukat", "muhasebe"],
  "bank.accounts": ["admin", "muhasebe"],
  "bank.move": ["admin", "avukat", "muhasebe"],
  "bank.cancel": ["admin", "avukat", "muhasebe"],
  "bank.transfer": ["admin", "avukat", "muhasebe"],
  "bank.pos": ["admin", "muhasebe"],
  "bank.commission": ["admin", "muhasebe"],
  "bank.statement": ["admin", "avukat", "muhasebe"],
  "bank.reconcile": ["admin", "avukat", "muhasebe"],
  "bank.settings": ["admin", "muhasebe"],
  "cheques.view": ["admin", "avukat", "muhasebe"],
  "cheques.manage": ["admin", "avukat", "muhasebe"],
  // Fatura (v2.0.15): satış/alış faturası ve iadeleri stok, cari, Kasa, taksit ve çek/senede aynı anda yazar; kasa
  // yetkisiyle aynı hesaplar. Fatura ayarları (firma bilgisi, seri ve numara, e-dönüşüm, entegratör, varsayılanlar)
  // yönetici ve muhasebededir.
  "invoices.view": ["admin", "avukat", "muhasebe"],
  "invoices.manage": ["admin", "avukat", "muhasebe"],
  "invoices.settings": ["admin", "muhasebe"],
  // Finans raporları (v2.0.7'de "ANLIK DURUM ve raporlar"): Raporlar penceresi — mizan, cari ekstre, nakit akış, tüm
  // raporlar. v2.0.10'dan beri ana ekrandaki ANLIK DURUM kartını AÇMAZ (overview.card); kişiye verilebilir.
  "overview.view": ["admin"],
  // ANLIK DURUM kartı (v2.0.10): yalnız yönetici ekranında (müşteri kararı; tüm sektörlerde).
  "overview.card": ["admin"],
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

// Yalnız yönetici rolünde olan, özel role ya da kişiye verilemeyen yetkiler.
export const ADMIN_ONLY = Object.freeze(["overview.card", "users.manage", "system.manage", "license.manage"]);

// Yetki havuzu (v2.0.10): Yönetim → Kullanıcılar ve Roller ekranı bu sırayla ve bu açıklamalarla gösterir.
export const PERMISSION_GROUPS = Object.freeze([
  {
    id: "records",
    label: "Kayıtlar ve Tablo",
    items: [
      ["records.create", "Yeni Kayıt Ekleme", "Tabloya yeni kişi/satır ekler."],
      ["records.edit", "Kayıt Düzeltme", "Hücreleri değiştirir, satırı düzenler."],
      ["records.delete", "Kayıt Silme", "Satırı siler (Silinenler'den geri alınabilir)."],
      ["records.export", "Tabloyu Dışa Aktarma", "Ana tabloyu Excel ya da CSV olarak indirir."],
      ["notes.write", "Not Yazma", "Kayda not ekler."],
      ["phones.create", "Telefon Ekleme", "Kayda ek telefon numarası ekler."],
      ["liens.create", "Süreli Uyarı / Haciz Ekleme", "Kayda bitiş tarihli uyarı ekler."],
    ],
  },
  {
    id: "documents",
    label: "Belgeler",
    items: [
      ["documents.upload", "Belge Ekleme", "Kayda dosya ekler, görür; kendi eklediğini siler."],
      ["documents.manage", "Başkasının Belgesini Silme", "Başka kullanıcının eklediği belgeyi siler."],
    ],
  },
  {
    id: "cash",
    label: "Tahsilat ve Kasa",
    items: [
      ["payments.create", "Kayda Tahsilat Girme", "Kişi kartından tahsilat girer; tutar Kasa'ya düşer."],
      ["cash.view", "Kasa'yı Görme", "Kasa hareketleri, bakiye ve dökümü."],
      ["cash.manage", "Kasa Yönetimi", "Kasa'ya giriş/çıkış ekler; başkasının hareketini düzeltir, siler."],
    ],
  },
  {
    id: "plans",
    label: "Taksitler",
    items: [
      ["plans.view", "Taksit Kartlarını Görme", "Taksit kartları ve ödeme durumları."],
      ["plans.collect", "Taksit Tahsilatı Girme", "Karttan taksit tahsilatı girer."],
      ["plans.manage", "Taksit Yönetimi", "Kart açar, düzenler, siler; Excel'den ve tablodan aktarır."],
    ],
  },
  {
    id: "bank",
    label: "Banka ve POS",
    items: [
      ["bank.view", "Banka Görüntüleme", "Banka penceresi, hesap bakiyeleri, hareketler ve takvim."],
      ["bank.reports", "Banka Raporları", "Rapor Merkezi'ndeki Banka grubu raporları."],
      ["bank.accounts", "Banka Hesabı Tanımlama ve Açılış", "Hesap açar, açılış bakiyesini girer ve düzeltir; eski hareketleri hesaba aktarır."],
      ["bank.move", "Banka Hareketi Girme ve Bankadan Çıkış", "Masraf, faiz ve diğer hareketler; bankadan her çıkış; banka bağlı hareketin tutarını, tarihini, yolunu ya da hesabını değiştirme."],
      ["bank.cancel", "Banka Hareketi Silme, İptal ve Ters Kayıt", "Banka bağlı hareketi siler, ters kaydeder; açılışı düzeltir."],
      ["bank.transfer", "Transfer Yapma", "Bankalar arası, Kasa ile banka arası, döviz alım satımı ve kredi kullanımı."],
      ["bank.pos", "POS Tanımlama", "POS kartı, valör, bloke ve vergi kipi."],
      ["bank.commission", "Komisyon Oranlarını Değiştirme", "Komisyon oranları ve komisyon faturası taslağı."],
      ["bank.statement", "Ekstre Aktarma", "Banka ekstresi yükler; eşleşmesiz ekstreyi siler."],
      ["bank.reconcile", "Mutabakat Yapma", "Ekstre satırını hareketle eşleştirir, eşleşmeyi kaldırır, ekstreden hareket oluşturur."],
      ["bank.settings", "Banka Ayarları", "Banka ayarları, elle kur, tatiller ve hesap eşlemesi."],
    ],
  },
  {
    id: "accounts",
    label: "Cari",
    items: [
      ["accounts.view", "Carileri Görme", "Cari listesi, bakiyeler ve ekstre."],
      ["accounts.collect", "Cariden Tahsilat Girme", "Cari kartından tahsilat girer."],
      ["accounts.manage", "Cari Yönetimi", "Cari açar, düzenler; borç, alacak ve ödeme girer."],
    ],
  },
  {
    id: "stock",
    label: "Stok",
    items: [
      ["stock.view", "Stoku Görme", "Ürünler, miktarlar ve kritik seviye."],
      ["stock.move", "Stok Hareketi Girme", "Miktar girişi/çıkışı yapar (parasız)."],
      ["stock.sell", "Satış Yapma", "Satış (nakit, kart, havale, veresiye) ve müşteri iadesi girer; ürün kartına ve alışa dokunmaz."],
      ["stock.manage", "Stok Yönetimi", "Ürün kartı açar; Kasa'ya ya da cariye yazan hareket girer."],
    ],
  },
  {
    id: "cheques",
    label: "Çek / Senet",
    items: [
      ["cheques.view", "Çek ve Senetleri Görme", "Portföy, vadeler ve evrak geçmişi."],
      ["cheques.manage", "Çek / Senet İşlemleri", "Evrak girer; tahsil, ciro, ödeme ve karşılıksız işler."],
    ],
  },
  {
    id: "invoices",
    label: "Fatura",
    items: [
      ["invoices.view", "Faturaları Görme", "Satış, alış ve iade faturaları; PDF ve e-Belge (UBL-TR XML)."],
      ["invoices.manage", "Fatura Kesme ve İptal", "Fatura keser, iade alır/verir, iptal eder; stok, cari, Kasa, taksit ve çek/senede yazar."],
      ["invoices.settings", "Fatura Ayarları", "Firma bilgisi, seri ve numaralar, e-Fatura / e-Arşiv, entegratör ve varsayılanlar."],
    ],
  },
  {
    id: "reports",
    label: "Raporlar",
    items: [
      ["overview.view", "Finans Raporları", "Raporlar penceresi: mizan, ekstre, nakit akış, Kasa ve tüm raporlar."],
      ["reports.view", "Tablo ve Personel Raporları", "Vade takip, tablo raporları ve personel performansı."],
      ["audit.view", "İşlem Geçmişi", "Kim, neyi, ne zaman değiştirdi."],
    ],
  },
  {
    id: "tasks",
    label: "Görevler ve Mesajlar",
    items: [
      ["tasks.create", "Görev Atama", "Başka kişilere görev atar."],
      ["tasks.viewAll", "Herkesin Görevlerini Görme", "Tüm ofisin açık ve biten görevleri."],
      ["tasks.complete", "Görev Tamamlama", "Kendisine atanan görevi tamamlar."],
      ["messages.create", "Mesaj Yazma", "Ofis içi sohbet ve kayıt mesajları."],
    ],
  },
  {
    id: "data",
    label: "Veri ve Ayarlar",
    items: [
      ["sources.manage", "Veri Yükleme ve Oturumlar", "Excel / Google Sheets yükler, veri oturumlarını yönetir."],
      ["profile.manage", "Sektör ve Başlıklar", "Sektörü seçer, başlıkları kalemle değiştirir."],
    ],
  },
  {
    id: "admin",
    label: "Yönetim (yalnız yönetici)",
    items: [
      ["overview.card", "ANLIK DURUM Kartı", "Ana ekrandaki canlı özet kartı."],
      ["users.manage", "Kullanıcı ve Rol Yönetimi", "Kullanıcı ekler, siler, yetki verir."],
      ["system.manage", "Sistem, yedek ve güncelleme", "Yedek alır, güncelleme kurar, ofis ayarları."],
      ["license.manage", "Lisans", "Lisansı etkinleştirir ve doğrular."],
    ],
  },
]);
export const PERMISSION_ORDER = Object.freeze(PERMISSION_GROUPS.flatMap(group => group.items.map(([key]) => key)));
const ORDER_INDEX = new Map(PERMISSION_ORDER.map((key, index) => [key, index]));
const ordered = list => [...new Set(list)].filter(key => Object.hasOwn(PERMISSIONS, key)).sort((a, b) => (ORDER_INDEX.get(a) ?? 999) - (ORDER_INDEX.get(b) ?? 999));

export const can = (role, permission) => Boolean(PERMISSIONS[permission]?.includes(role));
export const permissionsFor = role => ordered(Object.keys(PERMISSIONS).filter(permission => can(role, permission)));
// Özel role ya da kişiye verilebilen yetki: havuzda olan ve yönetime özgü olmayan.
export const isGrantable = permission => Object.hasOwn(PERMISSIONS, permission) && !ADMIN_ONLY.includes(permission);
// v2.0.7 uyumu: eski arayüz yalnız bunu açıp kapatıyordu.
export const GRANTABLE = Object.freeze({ "overview.view": "Finans raporları" });

// Kişiye özel ayar. Dizi (v2.0.7) → { add: dizi, remove: [] }. Bilinmeyen ve yönetime özgü yetkiler atılır.
export function parseGrants(value) {
  let raw = value;
  if (typeof raw === "string") {
    try {
      raw = JSON.parse(raw || "{}");
    } catch {
      raw = {};
    }
  }
  if (Array.isArray(raw)) raw = { add: raw, remove: [] };
  const list = items => (Array.isArray(items) ? ordered(items.filter(item => typeof item === "string" && isGrantable(item))) : []);
  const add = list(raw?.add);
  const remove = list(raw?.remove).filter(item => !add.includes(item));
  return { add, remove };
}
export const grantsOf = user => parseGrants(user?.grants_json ?? user?.grantsJson ?? "[]");

// Kişinin etkin yetkileri. customRole: { permissions: [...] } (özel rol; yoksa yerleşik rol matrisi).
export function resolvePermissions(user, customRole = null) {
  if (!user) return [];
  // Yönetici her zaman tüm yetkilere sahiptir; kişiye özel ayar yöneticiye uygulanmaz.
  if (!customRole && user.role === "admin") return ordered(Object.keys(PERMISSIONS));
  const base = customRole ? (customRole.permissions || []).filter(isGrantable) : permissionsFor(user.role).filter(isGrantable);
  const { add, remove } = grantsOf(user);
  const set = new Set([...base, ...add]);
  for (const permission of remove) set.delete(permission);
  return ordered([...set]);
}

// İstek sahibi kullanıcı auth katmanında çözülmüş yetkileriyle gelir (user.perms: Set). Çözülmemiş bir kullanıcı
// satırında (ör. testlerde elle kurulan nesne) yerleşik rol matrisi ve kişiye özel ayar kullanılır.
export const canUser = (user, permission) => {
  if (!user) return false;
  if (user.perms instanceof Set) return user.perms.has(permission);
  return resolvePermissions(user).includes(permission);
};
export const permissionsForUser = user => (user?.perms instanceof Set ? ordered([...user.perms]) : resolvePermissions(user));
