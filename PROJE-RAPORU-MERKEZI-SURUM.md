# Hukuk Ofisi Merkezi Server/Client Sürümü
## Proje ve Mimari Raporu

**Sürüm:** 1.0.0 merkezi ağ prototipi  
**Tarih:** 23 Eylül 2026  
**Dağıtım modeli:** Bir Windows server bilgisayarı + aynı ofis ağındaki web istemcileri

## 1. Amaç

Bu sürüm, önceki yerel Electron tesliminin dosya takip arayüzünü koruyarak çalışma alanını tek bir ofis sunucusuna taşır. Server bilgisayarda Node.js tabanlı merkezi servis ve SQLite veritabanı çalışır. Diğer bilgisayarlar Chrome veya Edge üzerinden aynı sunucu adresine bağlanır. Böylece tüm kullanıcılar aynı dosya, görev, not, telefon, tahsilat, haciz ve audit kayıtlarını görür.

Mevcut orijinal ZIP ve PDF teslimi değiştirilmemiştir. Merkezi sürüm `hukuk-ofisi-merkezi-v1` klasöründe ayrı oluşturulmuştur. Bu ayrım, önceki çalışır teslimi korumak ve geri dönüşü güvenceye almak için bilinçli yapılmıştır.

## 2. Mimari

| Katman | Merkezi sürümdeki karşılığı | Sorumluluk |
|---|---|---|
| İstemci | `client/` içindeki mevcut React bundle ve UX dosyaları | Arama, tablo, detay ve operasyon ekranı |
| Kimlik | `server/server.mjs` içindeki cookie oturumu | Kullanıcı girişi, rol ve oturum süresi |
| API | Node.js HTTP sunucusu | Tüm client isteklerini merkezi iş mantığına yönlendirme |
| Veritabanı | `data/hukuk-ofisi.sqlite` | Aynı anda gelen istekleri transaction mantığıyla saklama |
| Audit | `audit_events` tablosu | Kullanıcı, zaman, işlem ve payload geçmişi |
| Yedekleme | `backups/` ve `tools/backup.mjs` | Son 30 yedeği saklama |
| Ağ | `HOST=0.0.0.0`, varsayılan TCP `5123` | Özel ofis ağı üzerinden client erişimi |

SQLite doğrudan client bilgisayarlarına paylaşılmaz; yalnızca server prosesi dosyaya erişir. Client’lar yalnızca HTTP API kullanır. Bu, ağ paylaşımında JSON/SQLite dosyasının bozulması riskini ortadan kaldırır.

## 3. Kimlik ve yetki

İlk açılışta varsayılan yönetici hesabı oluşturulur:

- Kullanıcı adı: `admin`
- İlk parola: `Ofis2026!`
- Rol: `admin`

İlk girişten sonra parola değiştirilmelidir. Roller `admin`, `avukat`, `personel` ve `muhasebe` olarak tanımlanmıştır. Bu sürümde tüm giriş yapmış kullanıcılar dosya operasyonu yapabilir; kullanıcı oluşturma, rol değiştirme ve pasifleştirme API’leri yalnızca admin’e açıktır. Bir sonraki ürün fazında ekran bazlı yetki matrisi ayrıca uygulanmalıdır.

Parolalar düz metin saklanmaz. Salt ve scrypt tabanlı hash tutulur. Oturum token’ı yalnızca HttpOnly cookie içinde taşınır ve veritabanında SHA-256 hash’i saklanır. Varsayılan oturum süresi yedi gündür.

## 4. Merkezi veri modeli

Aşağıdaki tablolar temel çalışma alanını oluşturur:

- `users`: kullanıcı ve rol bilgileri.
- `sessions`: oturum token hash’leri ve süreleri.
- `records`: kaynak veya yerel dosya kayıtları.
- `overrides`: dış Excel/Sheets kaynağını değiştirmeden yapılan hücre düzeltmeleri.
- `deleted_records`: dış kaydı fiziksel silmeden gizleme işaretleri.
- `notes`, `phones`, `payments`, `liens`: dosya operasyonları.
- `tasks`, `messages`: iş akışı ve kullanıcı iletişimi.
- `audit_events`: tüm önemli mutasyonların değişiklik geçmişi.

Hücre override işlemlerinde sürüm numarası kullanılır. İstemci eski sürüm gönderirse API `409 Conflict` döndürür; bu, bir kullanıcının diğerinin son değişikliğini sessizce ezmesini önler.

## 5. Kaynak dosya stratejisi

Excel/CSV ve Google Sheets, dış kaynak olarak korunur. Kaynak dosyanın dışarıdan değiştirilmemesi mevcut ürün kararının devamıdır. Yeni operasyonlar merkezi veritabanında tutulur. Böylece aynı dosyada çalışan kullanıcılar tek bir çalışma alanını görür.

Bu teslimde önceki bilgisayardaki gizli `.hukuk-ofisi-data/workspace.json` dosyası bulunmadığı için otomatik geçmiş aktarımı yapılmamıştır. Eski operasyon geçmişi aktarılacaksa ayrıca kontrollü bir migration aracı hazırlanmalıdır; rastgele dosya kopyalama önerilmez.

## 6. Yedekleme ve kurtarma

Sunucu her altı saatte bir SQLite veritabanı yedeği üretir. Manuel yedek için proje klasöründe:

```text
npm run backup
```

komutu kullanılabilir. Son 30 yedek tutulur. `backups/` klasörü ayrıca harici disk veya güvenli ağ yedeğine düzenli kopyalanmalıdır. Server diski arızalanırsa aynı klasör tek başına yeterli sayılmamalıdır.

Kurtarma sırasında server durdurulur, seçilen `.sqlite` yedeği `data/hukuk-ofisi.sqlite` adıyla geri kopyalanır ve server yeniden başlatılır.

## 7. Ağ güvenliği

Ağ erişimi bu sürümün bilinçli özelliğidir; önceki `127.0.0.1` sınırı kaldırılmıştır. `install-server.ps1`, Windows’un yalnızca Private ağ profilinde TCP `5123` giriş kuralı açar. Windows ağ profili Public ise kuralı genişletmek yerine ağ profilini ve ofis yönlendirici izolasyonunu düzeltmek gerekir.

Bu ilk merkezi sürüm HTTP ile çalışır ve yalnızca güvenilir ofis LAN’ında kullanılmalıdır. İnternet üzerinden port yönlendirmesi yapılmamalıdır. İnternet veya VPN erişimi gerekecekse HTTPS sertifikası, reverse proxy, daha sıkı rol politikası ve rate limit eklenmelidir.

## 8. Doğrulama kapsamı

Kontrol edilen temel senaryolar:

- Node.js söz dizimi ve sunucunun başlatılması.
- İlk admin hesabının oluşturulması.
- Login, `auth/me`, logout ve cookie oturumu.
- Merkezi state yükleme.
- Aynı API üzerinden kayıt, override, not, telefon, tahsilat, haciz, görev ve mesaj oluşturma.
- Override sürüm uyuşmazlığında `409` koruması.
- Admin kullanıcı endpoint’lerinin admin olmayan kullanıcıya kapatılması.
- Statik React bundle’ının server üzerinden servis edilmesi.
- Manuel SQLite yedekleme.

## 9. Bilinen sınırlar ve sonraki faz

Bu sürüm, merkezi server/client mimarisini ve mevcut kullanıcı deneyimini çalışır hale getiren ilk merkezi pakettir. Üretim öncesi şu geliştirmeler önerilir:

1. Ekran ve işlem bazlı rol yetkileri.
2. HTTPS veya şirket içi reverse proxy.
3. Import/migration sihirbazı.
4. Google Sheets token ve kaynak yenileme yönetimi.
5. Gerçek otomatik senkronizasyon zamanlayıcısı.
6. Çakışma ekranı ve gerçek zamanlı güncelleme için SSE/WebSocket.
7. Harici disk veya NAS’a şifreli yedek kopyası.
8. Windows servis kurulumu ve servis hesabı.
9. Merkezi PostgreSQL seçeneği; çok büyük ofislerde SQLite yerine PostgreSQL’e geçiş.
10. Playwright tabanlı tarayıcı regresyon testleri.

## 10. Çalışır sürümü koruma kararı

Orijinal `hukuk-ofisi-windows-kategorili-final-2026-09-23-phone-rollback.zip` dosyasına, PDF teslimine ve önceki analiz raporuna dokunulmamıştır. Yeni merkezi sürüm ayrı klasörde geliştirilmiş ve ayrı ZIP olarak paketlenecektir. Bu sayede merkezi sürümde sorun çıkarsa önceki çalışır teslim korunur.
