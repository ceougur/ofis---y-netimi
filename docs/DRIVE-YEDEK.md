# Drive'a yedek (2.0.2)

Yönetim → Yedekler → **Drive'a da yedekle**. Her yedek önce bilgisayardaki yedek klasörüne alınır (6 saatte bir, elle ve her veri yüklemesinden önce), sonra bağlanan yere kopyalanır. Kopya başarısız olsa bile yerel yedek alınmıştır; hata yönetim panelinde görünür.

## İki bağlama yolu

1. **Drive / OneDrive / Dropbox masaüstü klasörü (önerilen).** Kullanıcı bilgisayarındaki senkron klasörün yolunu yapıştırır (`G:\Drive'ım\Yedekler`). Program içinde `DestekOfis Yedekleri` klasörünü açar ve her yedeği oraya kopyalar; masaüstü uygulaması buluta taşır. İnternet hesabı, izin, anahtar gerekmez; en fazla 30 kopya tutulur (`backupKeep`).
2. **Google Drive bağlantısı.** Kullanıcı `https://drive.google.com/drive/folders/<id>` bağlantısını yapıştırır ve klasörü *Bağlantıya sahip herkes → Düzenleyen* yapar. Program lisans servisinden bir yükleme oturumu ister (`POST /v1/yedek/oturum`), servis DestekOfis'in **hizmet hesabıyla** Google'dan bir *resumable upload* adresi alır ve programa verir; program dosyayı doğrudan Google'a PUT eder (servis üzerinden geçmez, boyut sınırı yoktur). Hizmet hesabının anahtarı yalnızca Vercel ortam değişkenindedir; programda hiçbir sır yoktur.

Servis bu ucu vermiyorsa program "Drive yükleme servisi bu sürümde etkin değil; Drive masaüstü klasör yolunu kullanın" der.

## Vercel işlevi (destekofis deposu, `web/api/lisans/v1/yedek/oturum.js`)

Ortam değişkeni: `GOOGLE_SERVICE_ACCOUNT_JSON` (hizmet hesabının JSON anahtarı; Drive API açık). Lisans anahtarı Supabase'deki `lisans` şemasıyla doğrulanır (mevcut `check` ile aynı yardımcı).

```js
import { SignJWT, importPKCS8 } from "jose";

const SCOPE = "https://www.googleapis.com/auth/drive.file https://www.googleapis.com/auth/drive";
async function accessToken() {
  const account = JSON.parse(process.env.GOOGLE_SERVICE_ACCOUNT_JSON);
  const key = await importPKCS8(account.private_key, "RS256");
  const now = Math.floor(Date.now() / 1000);
  const assertion = await new SignJWT({ scope: SCOPE }).setProtectedHeader({ alg: "RS256" }).setIssuer(account.client_email).setAudience(account.token_uri).setIssuedAt(now).setExpirationTime(now + 3600).sign(key);
  const response = await fetch(account.token_uri, { method: "POST", headers: { "content-type": "application/x-www-form-urlencoded" }, body: new URLSearchParams({ grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer", assertion }) });
  const json = await response.json();
  if (!response.ok) throw new Error(json.error_description || "Google belirteci alınamadı");
  return json.access_token;
}

export default async function handler(request, response) {
  if (request.method !== "POST") return response.status(405).json({ error: "POST" });
  const { licenseKey, folderId, name, size } = request.body || {};
  if (!(await licenseIsValid(licenseKey))) return response.status(403).json({ error: "Lisans doğrulanamadı." });
  if (!/^[A-Za-z0-9_-]{10,}$/.test(String(folderId || ""))) return response.status(400).json({ error: "Klasör bağlantısı geçersiz." });
  const token = await accessToken();
  // Klasörün içinde "DestekOfis Yedekleri" var mı; yoksa oluştur.
  const list = await fetch(`https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent(`'${folderId}' in parents and name='DestekOfis Yedekleri' and mimeType='application/vnd.google-apps.folder' and trashed=false`)}&fields=files(id)&supportsAllDrives=true`, { headers: { authorization: `Bearer ${token}` } }).then(r => r.json());
  let target = list.files?.[0]?.id;
  if (!target) {
    const created = await fetch("https://www.googleapis.com/drive/v3/files?supportsAllDrives=true", { method: "POST", headers: { authorization: `Bearer ${token}`, "content-type": "application/json" }, body: JSON.stringify({ name: "DestekOfis Yedekleri", mimeType: "application/vnd.google-apps.folder", parents: [folderId] }) }).then(r => r.json());
    if (!created.id) return response.status(502).json({ error: "Drive klasörü açılamadı; bağlantıya sahip herkesin düzenleyebildiğinden emin olun." });
    target = created.id;
  }
  const session = await fetch("https://www.googleapis.com/upload/drive/v3/files?uploadType=resumable&supportsAllDrives=true", { method: "POST", headers: { authorization: `Bearer ${token}`, "content-type": "application/json; charset=UTF-8", "x-upload-content-type": "application/octet-stream", "x-upload-content-length": String(size || 0) }, body: JSON.stringify({ name: String(name || "yedek.sqlite").slice(0, 200), parents: [target] }) });
  const uploadUrl = session.headers.get("location");
  if (!session.ok || !uploadUrl) return response.status(502).json({ error: "Yükleme oturumu açılamadı." });
  return response.status(200).json({ uploadUrl, folderId: target });
}
```

Program tarafı: `server/lib/cloud-backup.mjs` (`uploadViaService`) bu yanıttaki `uploadUrl`'e dosyayı tek PUT ile gönderir; 10 dakika zaman aşımı. Yükleme adresi tek kullanımlıktır ve bir saat geçerlidir.

## Güvenlik

- Kullanıcının Google hesabı programa girilmez; klasör paylaşımı kullanıcının kendi Drive'ında kalır.
- Hizmet hesabı yalnızca "bağlantıya sahip herkes düzenleyebilir" klasörlere yazabilir; okuma yapmaz.
- Lisans anahtarı olmayan istekler reddedilir; oturum başına bir dosya.
