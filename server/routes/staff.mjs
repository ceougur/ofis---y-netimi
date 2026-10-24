// Personel Özlük (2.4.4; kullanıcı kararı 21.10.2026 "Personel Raporu penceresine çalışan özlük tablosu"). Personel Raporu penceresinde
// Çalışanlar / Ayrılanlar: çalışan kartı (yalnız "Personel Özeti" görünümü), arama, Toplam Maaş / Kayıtlı Personel / Aktif Çalışan / Ayrılan Personel.
//
// Kurallar:
//  - İşten Ayrılış Tarihi yazılı kart Ayrılanlar'dadır; tarih silinince Çalışanlar'a döner (durum ayrı saklanmaz, tarihten türetilir).
//  - Yaş elle yazılmaz: Doğum Tarihi'nden programın bugününe (config.now) göre hesaplanır. Kullanılan İzinler gün sayısıdır.
//  - TC No 11 hane + denetim haneleri; IBAN TR + 24 hane + mod 97; ayrılış ≥ işe giriş; doğum < işe giriş; doğum ileri tarihli olamaz.
//    Aynı TC No iki kartta olmaz (aynı ADLI iki çalışan olabilir).
//  - Maaş yalnız bilgidir: Kasa, Banka, cari ve Ana Defter'e yazılmaz; "Maaş Bordrosu" (SGK / vergi) kapsam dışı.
//  - KVKK: yetki staff.view (görüntüleme) / staff.manage (düzenleme; görüntülemeyle birlikte), varsayılan yalnız yönetici. İşlem geçmişine kim / ne
//    zaman / hangi ALAN yazılır, DEĞER yazılmaz (ad soyad da yazılmaz; kayıt kimliği yazılır). Günlüğe değer çıkmaz. Canlı olay yalnız görüntüleme
//    yetkisi olanlara gider ve değer taşımaz. Veri şirketin kendi veri dosyasında (002'nin kartları 002'de); yedekle gider, geri yüklemeyle döner;
//    "Tümünü Sıfırla" siler, "Tüm Hareketleri Sil" dokunmaz (kart verisi).
import { HttpError, limited, ok, readJson, text } from "../lib/http.mjs";
import { parseMinor } from "../lib/minor.mjs";
import { jpegInfo } from "../lib/pdf-write.mjs";
import { isValidIban, isValidTckn, normalizeIban } from "../lib/tax-id.mjs";
import { systemClock } from "../lib/clock.mjs";

const BASE = "/api/workspace/staff";
export const STAFF_EDUCATION = Object.freeze(["İlkokul", "Ortaokul", "Lise", "Ön Lisans", "Lisans", "Yüksek Lisans", "Doktora"]);
export const PHOTO_MAX_BYTES = 120 * 1024;
const PHOTO_MAX_SIDE = 1000;
const MAX_LEAVE_DAYS = 3650;
// Alanların ekrandaki adları (işlem geçmişinde değişen alanın ADI; değer yazılmaz).
export const STAFF_FIELDS = Object.freeze({
  fullName: "Ad Soyad",
  birthDate: "Doğum Tarihi",
  tcNo: "TC No",
  address: "Adres",
  position: "Görevi",
  salary: "Maaş",
  bankName: "Banka Adı",
  iban: "IBAN",
  hireDate: "İşe Giriş Tarihi",
  leaveDate: "İşten Ayrılış Tarihi",
  usedLeaveDays: "Kullanılan İzinler",
  email: "Kişisel E-Posta",
  phone: "Telefon",
  education: "Öğrenim Durumu",
  specialty: "Uzmanlık Alanı",
  photo: "Fotoğraf",
});
const COLUMNS = {
  fullName: "full_name", birthDate: "birth_date", tcNo: "tc_no", address: "address", position: "position", salary: "salary_minor", bankName: "bank_name", iban: "iban",
  hireDate: "hire_date", leaveDate: "leave_date", usedLeaveDays: "used_leave_days", email: "email", phone: "phone", education: "education", specialty: "specialty", photo: "photo",
};
const bad = (message, field, code = "staff-invalid") => new HttpError(400, message, { code, field });
const ISO = /^(\d{4})-(\d{2})-(\d{2})$/;

function dateInput(value, field) {
  const raw = text(value);
  if (!raw) return "";
  const match = ISO.exec(raw);
  const day = match ? new Date(Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3]))) : null;
  if (!day || day.toISOString().slice(0, 10) !== raw || Number(match[1]) < 1900 || Number(match[1]) > 2200) throw bad(`${STAFF_FIELDS[field]} geçerli bir tarih değil (gün.ay.yıl).`, field);
  return raw;
}

/**
 * Çalışanın durumu TEK YERDE (kullanıcı kararı 22.10.2026): İşten Ayrılış Tarihi yoksa ya da İLERİ tarihliyse (bugün < tarih) çalışan Çalışanlar'dadır
 * — ileri tarihliyse "Ayrılacak" (leaving) işaretiyle, Toplam Maaş ve Aktif Çalışan'da sayılır; ayrılış günü gelince (bugün ≥ tarih) kendiliğinden
 * Ayrılanlar'a geçer. today: programın bugünü (config.now → now.today(), sunucunun yerel günü; Türkiye kurulumunda Türkiye saati).
 */
export function staffStatus(leaveDate, today) {
  if (!leaveDate) return { status: "active", leaving: false };
  if (today && leaveDate > today) return { status: "active", leaving: true };
  return { status: "left", leaving: false };
}

/** Doğum tarihinden bugünkü yaş (tam yıl). today: "YYYY-AA-GG". */
export function ageOf(birthDate, today) {
  if (!birthDate || !today) return null;
  const [by, bm, bd] = birthDate.split("-").map(Number);
  const [ty, tm, td] = today.split("-").map(Number);
  let age = ty - by;
  if (tm < bm || (tm === bm && td < bd)) age -= 1;
  return age >= 0 ? age : null;
}

function photoInput(value) {
  if (value === null || value === "" || value === false) return "";
  const match = /^data:image\/jpeg;base64,([A-Za-z0-9+/=\s]+)$/i.exec(String(value || ""));
  if (!match) throw bad("Fotoğraf JPEG olmalı (ekrandan seçilen resim programca JPEG'e çevrilir).", "photo");
  const raw = Buffer.from(match[1].replace(/\s+/g, ""), "base64");
  if (raw.length > PHOTO_MAX_BYTES) throw bad(`Fotoğraf en çok ${Math.round(PHOTO_MAX_BYTES / 1024)} KB olmalı (şu an ${Math.round(raw.length / 1024)} KB).`, "photo");
  const info = jpegInfo(raw);
  if (!info) throw bad("Fotoğraf okunamadı; geçerli bir resim seçin.", "photo");
  if (info.width > PHOTO_MAX_SIDE || info.height > PHOTO_MAX_SIDE) throw bad(`Fotoğraf en çok ${PHOTO_MAX_SIDE} piksel olmalı (${info.width}×${info.height}).`, "photo");
  return `data:image/jpeg;base64,${raw.toString("base64")}`;
}

/**
 * Formdan gelen alanlar → kayıt değerleri. previous verilirse (düzenleme) gövdede OLMAYAN alan değişmez; boş metin alanı siler.
 * Dönüş: { values: {alan: değer}, today }.
 */
export function staffInput(body, { previous = null, today }) {
  const has = key => Object.hasOwn(body, key);
  const take = (key, fallback = "") => (has(key) ? body[key] : previous ? previous[key] : fallback);
  const values = {};
  values.fullName = limited(String(take("fullName") ?? "").replace(/\s+/g, " "), 120, STAFF_FIELDS.fullName);
  if (!values.fullName) throw bad("Ad Soyad yazılmalı.", "fullName");
  values.birthDate = dateInput(take("birthDate"), "birthDate");
  values.hireDate = dateInput(take("hireDate"), "hireDate");
  values.leaveDate = dateInput(take("leaveDate"), "leaveDate");
  if (values.birthDate && values.birthDate > today) throw bad("Doğum Tarihi bugünden ileri olamaz.", "birthDate");
  if (values.birthDate && values.hireDate && values.birthDate >= values.hireDate) throw bad("İşe Giriş Tarihi Doğum Tarihi'nden sonra olmalı.", "hireDate");
  if (values.leaveDate && values.hireDate && values.leaveDate < values.hireDate) throw bad("İşten Ayrılış Tarihi İşe Giriş Tarihi'nden önce olamaz.", "leaveDate");
  if (values.leaveDate && values.birthDate && values.leaveDate <= values.birthDate) throw bad("İşten Ayrılış Tarihi Doğum Tarihi'nden sonra olmalı.", "leaveDate");
  const tc = String(take("tcNo") ?? "").replace(/\s+/g, "");
  if (tc && !isValidTckn(tc)) throw bad(/^\d{11}$/.test(tc) ? "TC No geçersiz: denetim haneleri tutmuyor." : "TC No 11 haneli olmalı ve 0 ile başlamamalı.", "tcNo");
  values.tcNo = tc;
  const iban = normalizeIban(take("iban") ?? "");
  if (iban && !(/^TR\d{24}$/.test(iban) && isValidIban(iban))) throw bad(/^TR\d{24}$/.test(iban) ? "IBAN geçersiz: denetim haneleri tutmuyor." : "IBAN TR ile başlamalı ve 26 karakter olmalı (TR + 24 rakam).", "iban");
  values.iban = iban;
  // Maaş kuruş olarak saklanır; gövdede yoksa (düzenleme) önceki değer kalır, boş yazılırsa 0 (yazılmadı).
  if (!has("salary")) values.salary = previous ? previous.salary : 0;
  else values.salary = body.salary === "" || body.salary === null || body.salary === undefined ? 0 : parseMinor(body.salary, { label: STAFF_FIELDS.salary, allowZero: true, max: 100_000_000 });
  const days = take("usedLeaveDays", 0);
  const dayText = String(days ?? "").trim();
  const dayCount = dayText === "" ? 0 : Number(dayText.replace(",", "."));
  if (!Number.isInteger(dayCount) || dayCount < 0 || dayCount > MAX_LEAVE_DAYS) throw bad(`Kullanılan İzinler 0 ile ${MAX_LEAVE_DAYS} arasında tam gün sayısı olmalı.`, "usedLeaveDays");
  values.usedLeaveDays = dayCount;
  values.address = limited(take("address"), 500, STAFF_FIELDS.address);
  values.position = limited(take("position"), 120, STAFF_FIELDS.position);
  values.bankName = limited(take("bankName"), 120, STAFF_FIELDS.bankName);
  values.email = limited(take("email"), 200, STAFF_FIELDS.email);
  if (values.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(values.email)) throw bad("Kişisel E-Posta geçerli bir adres değil (ör. ad@ornek.com).", "email");
  values.phone = limited(take("phone"), 40, STAFF_FIELDS.phone);
  if (values.phone && !/^[0-9+()\s.-]{7,40}$/.test(values.phone)) throw bad("Telefon yalnız rakam, boşluk ve + ( ) - içerebilir.", "phone");
  values.education = limited(take("education"), 40, STAFF_FIELDS.education);
  if (values.education && !STAFF_EDUCATION.includes(values.education)) throw bad(`Öğrenim Durumu listeden seçilmeli (${STAFF_EDUCATION.join(", ")}).`, "education");
  values.specialty = limited(take("specialty"), 200, STAFF_FIELDS.specialty);
  values.photo = has("photo") ? photoInput(body.photo) : previous ? previous.photo : "";
  return values;
}

export function registerStaffRoutes(router, { auth, store, audit, events, access, now = systemClock }) {
  const today = () => (typeof now.today === "function" ? now.today() : new Date().toISOString().slice(0, 10));
  const viewer = req => auth.requirePermission(req, "staff.view");
  const editor = req => {
    const user = auth.requirePermission(req, "staff.manage");
    auth.requirePermission(req, "staff.view");
    return user;
  };
  const rowOf = row => ({
    fullName: row.full_name, birthDate: row.birth_date, tcNo: row.tc_no, address: row.address, position: row.position, salary: row.salary_minor, bankName: row.bank_name, iban: row.iban,
    hireDate: row.hire_date, leaveDate: row.leave_date, usedLeaveDays: row.used_leave_days, email: row.email, phone: row.phone, education: row.education, specialty: row.specialty, photo: row.photo,
  });
  const publicOf = (row, day, { photo = false } = {}) => {
    const item = rowOf(row);
    return {
      id: row.id,
      ...item,
      photo: photo ? item.photo : undefined,
      salaryMinor: row.salary_minor,
      salary: undefined,
      age: ageOf(row.birth_date, day),
      ...staffStatus(row.leave_date, day),
      hasPhoto: Boolean(row.photo),
      createdAt: row.created_at,
      updatedAt: row.updated_at || row.created_at,
    };
  };
  const find = (id, { message = "Personel kartı bulunamadı. Silinmiş olabilir." } = {}) => {
    const row = store.get("SELECT * FROM staff_members WHERE id = ?", text(id).slice(0, 80));
    if (!row) throw new HttpError(404, message, { code: "staff-missing" });
    return row;
  };
  const duplicateTc = (tcNo, exceptId = "") => {
    if (!tcNo) return;
    const other = store.get("SELECT id FROM staff_members WHERE tc_no = ? AND id <> ?", tcNo, exceptId);
    if (other) throw new HttpError(409, "Bu TC No ile kayıtlı başka bir personel kartı var. Aynı kişiyi yeniden işe aldıysanız eski kartındaki İşten Ayrılış Tarihi'ni silin.", { code: "staff-duplicate-tc", field: "tcNo" });
  };
  // Canlı olay: yalnız görüntüleme yetkisi olanlara, değer taşımadan (açık Personel Raporu pencereleri listeyi yeniden okur).
  const changed = user => {
    if (!events) return;
    const users = store.all("SELECT id, role, role_key, grants_json FROM users WHERE active = 1 AND deleted_at IS NULL").filter(member => access?.can(member, "staff.view")).map(member => member.id);
    events.publish("workspace.changed", { kind: "staff", actorId: user.id, actorName: user.display_name }, { except: user.id, users });
  };
  const write = values => Object.keys(COLUMNS).map(key => [COLUMNS[key], values[key]]);

  router.get(BASE, async ({ req, res }) => {
    const user = viewer(req);
    const day = today();
    const items = store.all("SELECT * FROM staff_members ORDER BY full_name COLLATE NOCASE, created_at").map(row => publicOf(row, day));
    const active = items.filter(item => item.status === "active");
    ok(res, {
      today: day,
      items,
      totals: {
        registered: items.length,
        active: active.length,
        left: items.length - active.length,
        // Toplam Maaş: aktif çalışanların aylık maaşları (ayrılanlar sayılmaz).
        salaryMinor: active.reduce((sum, item) => sum + item.salaryMinor, 0),
      },
      education: STAFF_EDUCATION,
      fields: STAFF_FIELDS,
      canManage: user.perms instanceof Set ? user.perms.has("staff.manage") : Boolean(access?.can(user, "staff.manage")),
    });
  });

  router.get(`${BASE}/:id`, async ({ req, res, params }) => {
    viewer(req);
    ok(res, publicOf(find(params.id), today(), { photo: true }));
  });

  router.post(BASE, async ({ req, res }) => {
    const user = editor(req);
    const body = await readJson(req, { limit: 400_000 });
    const values = staffInput(body || {}, { today: today() });
    duplicateTc(values.tcNo);
    const id = auth.newId("staff");
    const at = now().toISOString();
    const pairs = write(values);
    store.run(`INSERT INTO staff_members (id, ${pairs.map(([column]) => column).join(", ")}, created_by, created_at) VALUES (?, ${pairs.map(() => "?").join(", ")}, ?, ?)`, id, ...pairs.map(([, value]) => value), user.id, at);
    // KVKK: yalnız doldurulan alanların ADLARI.
    const filled = Object.keys(STAFF_FIELDS).filter(key => (key === "salary" || key === "usedLeaveDays" ? values[key] > 0 : Boolean(values[key])));
    audit(user, "staff.created", id, { fields: filled.map(key => STAFF_FIELDS[key]) });
    changed(user);
    ok(res, publicOf(find(id), today(), { photo: true }));
  });

  router.put(`${BASE}/:id`, async ({ req, res, params }) => {
    const user = editor(req);
    const gone = { message: "Bu personel kartı siz düzenlerken silinmiş; değişiklikler kaydedilmedi. Pencereyi kapatın; kart gerekiyorsa Yeni Personel ile yeniden ekleyin." };
    find(params.id, gone);
    const body = await readJson(req, { limit: 400_000 });
    // 2.4.4 (eleştirmen E5): iyimser eşzamanlılık — cari formundaki kalıp (routes/accounts.mjs "account-stale"). Ekran formu bütün alanları ve
    // açıldığı andaki sürümü (updatedAt) gönderir; arada başka biri kaydettiyse 409: ikinci kaydeden ilkinin değişikliğini (ör. maaş) sessizce geri
    // almaz. Satır gövde okunduktan SONRA okunur (okuma sırasında gelen yazım da görülür); denetim ile yazım arasında bekleme yok. Sürüm
    // göndermeyen kısmi çağrılar yalnız gönderdikleri alanı değiştirir, eskisi gibi yazar. KVKK: iletide ve yanıtta alan değeri yok.
    const row = find(params.id, gone);
    const version = row.updated_at || row.created_at;
    if (body?.updatedAt && body.updatedAt !== version) throw new HttpError(409, "Bu personel kartını siz açtıktan sonra başka biri değiştirdi; değişiklikleriniz kaydedilmedi. Kartı yeniden açıp tekrar kaydedin.", { code: "staff-stale", updatedAt: version });
    const previous = rowOf(row);
    const values = staffInput(body || {}, { previous, today: today() });
    duplicateTc(values.tcNo, row.id);
    const changedKeys = Object.keys(STAFF_FIELDS).filter(key => values[key] !== previous[key]);
    if (changedKeys.length) {
      const pairs = write(values);
      // Sürüm her yazımda ilerler: saat aynı milisaniyede (ya da sahte saat geri alınmışsa) önceki sürümden büyük olmayan damga vermez.
      const stamp = now().toISOString();
      const at = stamp > version ? stamp : new Date(Date.parse(version) + 1).toISOString();
      store.run(`UPDATE staff_members SET ${pairs.map(([column]) => `${column} = ?`).join(", ")}, updated_by = ?, updated_at = ? WHERE id = ?`, ...pairs.map(([, value]) => value), user.id, at, row.id);
      audit(user, "staff.updated", row.id, { fields: changedKeys.map(key => STAFF_FIELDS[key]) });
      changed(user);
    }
    const next = find(row.id);
    const day = today();
    const before = staffStatus(previous.leaveDate, day);
    const after = publicOf(next, day, { photo: true });
    // moved: kayıtla durum değiştiyse "left" (Ayrılanlar'a geçti), "active" (Çalışanlar'a döndü), "leaving" (Ayrılacak olarak işaretlendi).
    const moved = before.status !== after.status ? after.status : after.leaving && !before.leaving ? "leaving" : "";
    ok(res, { ...after, changed: changedKeys.map(key => STAFF_FIELDS[key]), moved });
  });

  router.delete(`${BASE}/:id`, async ({ req, res, params }) => {
    const user = editor(req);
    const row = find(params.id);
    store.run("DELETE FROM staff_members WHERE id = ?", row.id);
    audit(user, "staff.deleted", row.id, {});
    changed(user);
    ok(res, { id: row.id, deleted: true });
  });
}
