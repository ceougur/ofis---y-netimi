// "Aydınlatma Metni Hazırla" — 2.4.8 W6 (docs/erp/WHATSAPP-API-PLANI-2.4.8.md §1, §5, §6 W6; kullanıcı kararı 30.10.2026 ~10:45 UTC).
//
// WhatsApp ile hesap ekstresi ve ödeme hatırlatması gönderen firmanın (veri sorumlusu) carilerine vereceği KVKK aydınlatma metni (6698 sayılı Kanun md. 10;
// Aydınlatma Yükümlülüğünün Yerine Getirilmesinde Uyulacak Usul ve Esaslar Hakkında Tebliğ md. 5). Firma bilgileri şirketin kendi ayarından: Fatura Ayarları →
// Firma Bilgisi (invoice.settings seller; unvan yoksa office.name). Eksik bilgi köşeli ayraçlı yer tutucuyla yazılır ve ekranda adıyla söylenir.
//
// BAŞ MİMAR TASLAĞI (sürüm NOTICE_VERSION): metin hukuki görüş değildir; son onay ürün sahibinde (hukukçu gözüyle). Metin değişirse NOTICE_VERSION değişir
// (W4'teki bir kez onay hangi sürümün okunduğunu kaydeder). İçerik plan §5'e dayanır: veri sorumlusu müşteri; Meta'ya (yurt dışı) aktarım — md. 9; durum
// bilgisi DestekOfis'in bağlantı hizmetinden saklanmadan geçer (veri işleyen); PDF Meta'da en çok 30 gün, kesinleşince silinmesi istenir (§11 S3).
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { A4, PdfDocument, loadFont } from "../pdf-write.mjs";

export const NOTICE_VERSION = "2.4.8-taslak-1";
export const NOTICE_TITLE = "WhatsApp ile Gönderilen Bilgilendirme İletileri Hakkında Aydınlatma Metni";
const INVOICE_SETTINGS_KEY = "invoice.settings";

const clean = value => String(value ?? "").replace(/[\u0000-\u001f\u007f]+/g, " ").replace(/\s+/g, " ").trim();
const parse = raw => {
  try {
    const value = JSON.parse(raw || "{}");
    return value && typeof value === "object" && !Array.isArray(value) ? value : {};
  } catch {
    return {};
  }
};
const pad = value => String(value).padStart(2, "0");
const dayText = date => `${pad(date.getDate())}.${pad(date.getMonth() + 1)}.${date.getFullYear()}`;

/** Firma (veri sorumlusu) bilgileri: Fatura Ayarları → Firma Bilgisi; unvan yoksa şirket adı. */
export function noticeFirm(store) {
  const seller = parse(store.setting(INVOICE_SETTINGS_KEY, "{}")).seller || {};
  const name = clean(seller.name) || clean([seller.firstName, seller.familyName].filter(Boolean).join(" ")) || clean(store.setting("office.name", ""));
  const taxNo = clean(seller.taxNo).replace(/\s+/g, "");
  const place = [clean(seller.district), clean(seller.city)].filter(Boolean).join(" / ");
  return {
    name,
    taxNo,
    taxLabel: taxNo.length === 11 ? "TCKN" : "VKN",
    taxOffice: clean(seller.taxOffice),
    mersisNo: clean(seller.mersisNo),
    address: [clean(seller.address), place].filter(Boolean).join(" "),
    phone: clean(seller.phone),
    email: clean(seller.email),
    website: clean(seller.website),
  };
}

// Metinde yer tutucuyla yazılan, eksikse ekranda adıyla söylenen bilgiler (veri sorumlusunun kimliği ve başvuru yolu için gerekli).
const REQUIRED = Object.freeze([
  ["name", "Firma Unvanı", "[Firma unvanı]"],
  ["address", "Adres", "[Firma adresi]"],
  ["email", "E-posta", "[Firma e-posta adresi]"],
  ["taxNo", "VKN / TCKN", ""],
]);

/**
 * buildPrivacyNotice(store, { now }) → { version, draft, title, firm, missing: [{ field, label }], sections: [{ heading, paragraphs, items }], text, date }.
 * sections[].items: madde listesi (["a) …", …] ya da ["Kimlik bilgisi: …", …]); text: düz metin (Kopyala).
 */
export function buildPrivacyNotice(store, { now = new Date() } = {}) {
  const firm = noticeFirm(store);
  const missing = REQUIRED.filter(([field]) => !firm[field]).map(([field, label]) => ({ field, label }));
  const shown = field => firm[field] || REQUIRED.find(([key]) => key === field)?.[2] || "";
  const name = shown("name");
  const identity = [
    `Unvan: ${name}`,
    `Adres: ${shown("address")}`,
    firm.taxNo ? `${firm.taxLabel}: ${firm.taxNo}${firm.taxOffice ? ` · Vergi Dairesi: ${firm.taxOffice}` : ""}` : "",
    firm.mersisNo ? `MERSİS No: ${firm.mersisNo}` : "",
    firm.phone ? `Telefon: ${firm.phone}` : "",
    `E-posta: ${shown("email")}`,
    firm.website ? `İnternet Sitesi: ${firm.website}` : "",
  ].filter(Boolean);
  const date = dayText(now);
  const sections = [
    {
      heading: "1. Veri Sorumlusu",
      paragraphs: [
        `${name} (“Şirketimiz”), 6698 sayılı Kişisel Verilerin Korunması Kanunu (“KVKK”) kapsamında veri sorumlusudur. Bu metin, cari hesap ilişkimiz çerçevesinde size WhatsApp üzerinden gönderdiğimiz hesap ekstresi ve ödeme hatırlatması iletileri sırasında işlenen kişisel verileriniz hakkında KVKK'nın 10. maddesi uyarınca bilgi vermek amacıyla hazırlanmıştır.`,
      ],
      items: identity,
    },
    {
      heading: "2. İşlenen Kişisel Verileriniz",
      paragraphs: [],
      items: [
        "Kimlik bilgisi: adınız ve soyadınız ya da unvanınız.",
        "İletişim bilgisi: cep telefonu numaranız.",
        "Müşteri işlem ve finans bilgisi: cari hesap bakiyeniz, hesap ekstresindeki hareketler (tarih, açıklama, tutar), vade tarihi ve ödeme tutarı.",
        "İleti bilgisi: iletinin gönderim zamanı ile size ulaşıp ulaşmadığına, okunup okunmadığına ya da iletilemediğine ilişkin durum bilgisi.",
      ],
    },
    {
      heading: "3. Kişisel Verilerin İşlenme Amaçları",
      paragraphs: [
        "Kişisel verileriniz; cari hesabınızın durumu hakkında sizi bilgilendirmek, dönem hesap ekstrenizi size iletmek, vadesi gelen ya da geçen ödemelerinizi hatırlatmak, iletinin size ulaşıp ulaşmadığını izlemek ve alacak takibi ile hesap mutabakatı süreçlerini yürütmek amaçlarıyla işlenir.",
        "Bu iletiler yalnız bilgilendirme amaçlıdır; reklam, kampanya ya da tanıtım içermez.",
      ],
      items: [],
    },
    {
      heading: "4. Toplama Yöntemi ve Hukuki Sebep",
      paragraphs: [
        "Kişisel verileriniz, aramızdaki ticari ilişki kapsamında sizin tarafınızdan iletilen ya da işlemleriniz sırasında oluşan bilgilerden, ön muhasebe programımız aracılığıyla kısmen otomatik yollarla toplanır.",
        "Bu veriler KVKK'nın 5. maddesinin ikinci fıkrasının (c) bendi (bir sözleşmenin kurulması veya ifasıyla doğrudan doğruya ilgili olması kaydıyla, sözleşmenin taraflarına ait kişisel verilerin işlenmesinin gerekli olması) ve (f) bendi (ilgili kişinin temel hak ve özgürlüklerine zarar vermemek kaydıyla, veri sorumlusunun meşru menfaatleri için veri işlenmesinin zorunlu olması) hukuki sebeplerine dayanılarak işlenir.",
      ],
      items: [],
    },
    {
      heading: "5. Kişisel Verilerin Aktarılması",
      paragraphs: [
        "İletiler, Meta Platforms, Inc. ve bağlı şirketlerinin sunduğu WhatsApp Business Platformu (Cloud API) üzerinden gönderilir. Bu nedenle adınız, telefon numaranız, iletideki bakiye ve vade bilgileri ile ekstre PDF dosyası, iletinin size ulaştırılması amacıyla bu hizmet sağlayıcısının yurt dışındaki sunucularına aktarılır. Bu aktarım, KVKK'nın 9. maddesinde yurt dışına aktarım için öngörülen şartlar çerçevesinde gerçekleştirilir.",
        "İletilerin size ulaşıp ulaşmadığına ilişkin durum bilgisi (telefon numaranız, iletinin durumu ve varsa hata nedeni), Şirketimizin kullandığı DestekOfis programının sağlayıcısının bağlantı hizmeti (Cloudflare, Inc. altyapısı) üzerinden saklanmadan Şirketimizin programına iletilir; program sağlayıcısı bu işlemde veri işleyen sıfatıyla hareket eder.",
        "Kişisel verileriniz ayrıca, talep hâlinde ve mevzuatın gerektirdiği ölçüde yetkili kamu kurum ve kuruluşlarına aktarılabilir.",
      ],
      items: [],
    },
    {
      heading: "6. Saklama Süresi",
      paragraphs: [
        "Cari hesap ve ekstre bilgileriniz, ticari defter ve belgelerin saklanmasına ilişkin mevzuatta öngörülen süre boyunca (Türk Ticaret Kanunu'nun 82. maddesi uyarınca on yıl) saklanır. İletinin gönderim kaydı (zaman ve durum bilgisi) programımızda cari hesap kaydınızla birlikte tutulur.",
        "Ekstre PDF dosyası WhatsApp altyapısında iletim için en çok 30 gün tutulur; iletim sonuçlandığında programımız dosyanın silinmesini ister. Saklama süresi dolan veriler silinir, yok edilir ya da anonim hâle getirilir.",
      ],
      items: [],
    },
    {
      heading: "7. Haklarınız",
      paragraphs: ["KVKK'nın 11. maddesi uyarınca Şirketimize başvurarak:"],
      items: [
        "a) Kişisel verilerinizin işlenip işlenmediğini öğrenme,",
        "b) Kişisel verileriniz işlenmişse buna ilişkin bilgi talep etme,",
        "c) Kişisel verilerinizin işlenme amacını ve bunların amacına uygun kullanılıp kullanılmadığını öğrenme,",
        "ç) Yurt içinde veya yurt dışında kişisel verilerinizin aktarıldığı üçüncü kişileri bilme,",
        "d) Kişisel verilerinizin eksik veya yanlış işlenmiş olması hâlinde bunların düzeltilmesini isteme,",
        "e) KVKK'nın 7. maddesinde öngörülen şartlar çerçevesinde kişisel verilerinizin silinmesini veya yok edilmesini isteme,",
        "f) (d) ve (e) bentleri uyarınca yapılan işlemlerin, kişisel verilerinizin aktarıldığı üçüncü kişilere bildirilmesini isteme,",
        "g) İşlenen verilerin münhasıran otomatik sistemler vasıtasıyla analiz edilmesi suretiyle aleyhinize bir sonucun ortaya çıkmasına itiraz etme,",
        "ğ) Kişisel verilerinizin kanuna aykırı olarak işlenmesi sebebiyle zarara uğramanız hâlinde zararın giderilmesini talep etme",
      ],
      after: [
        "haklarına sahipsiniz. WhatsApp üzerinden bilgilendirme iletisi almak istemiyorsanız bunu aşağıdaki başvuru yollarından biriyle ya da telefonla bize bildirmeniz yeterlidir; bu durumda size WhatsApp ile ileti gönderilmez.",
      ],
    },
    {
      heading: "8. Başvuru Yolu",
      paragraphs: [
        `Haklarınıza ilişkin taleplerinizi, Veri Sorumlusuna Başvuru Usul ve Esasları Hakkında Tebliğ uyarınca; yazılı olarak ${shown("address")} adresine bizzat başvurarak ya da noter aracılığıyla, kayıtlı elektronik posta (KEP) adresi, güvenli elektronik imza, mobil imza ya da Şirketimize daha önce bildirdiğiniz ve sistemimizde kayıtlı bulunan elektronik posta adresinizi kullanmak suretiyle ${shown("email")} adresine iletebilirsiniz.`,
        "Başvurunuzda adınız, soyadınız ve başvuru yazılı ise imzanız; Türkiye Cumhuriyeti vatandaşları için T.C. kimlik numaranız, yabancılar için uyruğunuz ve pasaport numaranız ya da varsa kimlik numaranız; tebligata esas yerleşim yeri ya da iş yeri adresiniz; varsa bildirime esas elektronik posta adresiniz, telefon numaranız ve talep konunuz bulunmalıdır.",
        "Başvurunuz, talebin niteliğine göre en kısa sürede ve en geç otuz gün içinde ücretsiz olarak sonuçlandırılır; işlemin ayrıca bir maliyet gerektirmesi hâlinde Kişisel Verileri Koruma Kurulunca belirlenen tarifedeki ücret alınabilir.",
      ],
      items: [],
    },
  ];
  const closing = `Bu metin ${date} tarihinde hazırlanmıştır.`;
  const lines = [NOTICE_TITLE, ""];
  for (const section of sections) {
    lines.push(section.heading);
    for (const paragraph of section.paragraphs) lines.push(paragraph);
    for (const item of section.items) lines.push(/^[a-zçğ]\) /.test(item) ? item : `- ${item}`);
    for (const paragraph of section.after || []) lines.push(paragraph);
    lines.push("");
  }
  lines.push(closing);
  return { version: NOTICE_VERSION, draft: true, title: NOTICE_TITLE, firm, missing, sections, closing, date, text: lines.join("\n"), pdfName: noticePdfName(firm) };
}

/** PDF dosya adı (sunucu Content-Disposition'ı ve istemcinin download özniteliği aynı adı kullanır). */
export function noticePdfName(firm) {
  const name = String(firm?.name || "").replace(/[\\/:*?"<>|]+/g, " ").replace(/\s+/g, " ").trim().slice(0, 80);
  return `KVKK Aydınlatma Metni (WhatsApp)${name ? ` ${name}` : ""}.pdf`;
}

const FONT_DIR = join(dirname(fileURLToPath(import.meta.url)), "..", "..", "assets", "fonts");
let fonts = null;
const loadFonts = () => {
  fonts ||= { regular: loadFont(join(FONT_DIR, "LiberationSans-Regular.ttf")), bold: loadFont(join(FONT_DIR, "LiberationSans-Bold.ttf")) };
  return fonts;
};

/** Aydınlatma metninin PDF'i (A4 dikey; başlık, bölüm başlıkları kalın, madde listesi asılı girintili; sayfa altı sayfa numarası). */
export function privacyNoticePdf(notice, { now = new Date() } = {}) {
  const doc = new PdfDocument({ fonts: loadFonts(), size: A4, title: notice.title, author: notice.firm.name || "", subject: "KVKK aydınlatma metni" });
  const M = 50;
  const W = A4.width - M * 2;
  const bottom = A4.height - 56;
  const ink = "#111827";
  const muted = "#6b7280";
  const pages = [];
  let page = null;
  let top = 0;
  const newPage = () => {
    page = doc.addPage();
    pages.push(page);
    top = M;
  };
  const ensure = height => {
    if (top + height > bottom) newPage();
  };
  const block = (value, { font = "regular", size = 9.5, indent = 0, gap = 4, color = ink, hang = "" } = {}) => {
    const lead = 1.35 * size;
    const width = W - indent - (hang ? 14 : 0);
    const wrapped = doc.wrap(value, width, font, size);
    wrapped.forEach((line, index) => {
      ensure(lead);
      if (hang && index === 0) page.text(M + indent, top, hang, { font, size, color });
      page.text(M + indent + (hang ? 14 : 0), top, line, { font, size, color });
      top += lead;
    });
    top += gap;
  };
  newPage();
  block(notice.title, { font: "bold", size: 14, gap: 4 });
  if (notice.firm.name) block(notice.firm.name, { size: 10, color: muted, gap: 14 });
  for (const section of notice.sections) {
    ensure(40);
    block(section.heading, { font: "bold", size: 11, gap: 4 });
    for (const paragraph of section.paragraphs) block(paragraph, { gap: 6 });
    for (const item of section.items) {
      const listed = /^([a-zçğ]\)) (.*)$/.exec(item);
      block(listed ? listed[2] : item, { indent: 8, hang: listed ? listed[1] : "•", gap: 2 });
    }
    for (const paragraph of section.after || []) block(paragraph, { gap: 6 });
    top += 6;
  }
  block(notice.closing, { size: 9, color: muted, gap: 0 });
  pages.forEach((item, index) => item.text(M, A4.height - 36, `Sayfa ${index + 1} / ${pages.length}`, { size: 8, color: muted, align: "right", width: W }));
  return doc.toBuffer({ now });
}
