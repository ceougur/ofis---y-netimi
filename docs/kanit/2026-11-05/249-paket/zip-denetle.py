# 2.4.9 paket kanıtı: güncelleme zip'inin içeriği — client/kilavuz PDF özeti, package.json sürümü, yasak dosya ve gizli desen taraması.
# Kullanım: python3 -I zip-denetle.py <destekofis-guncelleme-<s>.zip>
import zipfile, sys, hashlib, json
z = zipfile.ZipFile(sys.argv[1])
d = z.read('client/kilavuz/DestekOfis-Kullanim-Kilavuzu.pdf')
print('zip içi client/kilavuz PDF sha256', hashlib.sha256(d).hexdigest(), len(d), 'B')
print('zip içi package.json version', json.loads(z.read('package.json'))['version'])
bad = [n for n in z.namelist() if n.endswith(('.env', '.pem', '.sqlite', '.db', '.key')) or n.startswith('test/') or '/test/' in n or 'kanit' in n]
print('yasak uzantı/test/kanıt dosyası:', bad or 'YOK')
hits = {}
for n in z.namelist():
    b = z.read(n)
    for pat in (b'PRIVATE' + b' KEY', b'-----' + b'BEGIN', b'imza-' + b'anahtari', b'GIZLI'):
        if pat in b:
            hits.setdefault(pat.decode(), []).append(n)
print('gizli desen eşleşmeleri:', hits or 'YOK')
