# Arşiv Kaynak Paketini Birleştirme (DestekOfis 2.5.0)

Bu dosyalar GitHub'a YÜKLENMEZ; yalnız arşiv içindir.

1. Yedi parçayı (DestekOfis-2.5.0-Arsiv-Kaynak.bundle.parca0 … parca6) ve BIRLESTIR.bat'ı aynı klasöre koyun.
2. BIRLESTIR.bat'a çift tıklayın.
3. Pencerede "TAMAM: Özet eşleşti" yazmalı. Oluşan dosya: DestekOfis-2.5.0-Arsiv-Kaynak.bundle (322094191 bayt).
   Beklenen SHA-256: f6e6a34364d75928cd5286ca1a26531870c1a216c422e5619b5e2d97f5212628
4. "Özet TUTMUYOR" yazarsa dosyayı kullanmayın; parçaları yeniden indirin.

Elle birleştirme (komut satırı):
    copy /b DestekOfis-2.5.0-Arsiv-Kaynak.bundle.parca0+DestekOfis-2.5.0-Arsiv-Kaynak.bundle.parca1+DestekOfis-2.5.0-Arsiv-Kaynak.bundle.parca2+DestekOfis-2.5.0-Arsiv-Kaynak.bundle.parca3+DestekOfis-2.5.0-Arsiv-Kaynak.bundle.parca4+DestekOfis-2.5.0-Arsiv-Kaynak.bundle.parca5+DestekOfis-2.5.0-Arsiv-Kaynak.bundle.parca6 DestekOfis-2.5.0-Arsiv-Kaynak.bundle
    certutil -hashfile DestekOfis-2.5.0-Arsiv-Kaynak.bundle SHA256

Kaynak kodu açmak için: git clone DestekOfis-2.5.0-Arsiv-Kaynak.bundle destekofis
