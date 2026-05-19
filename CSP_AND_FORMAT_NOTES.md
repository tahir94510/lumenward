# Last Light — CSP ve sayı formatı düzeltmeleri

Bu paket, oyunun mekaniklerini ve zorluk dengesini bozmadan iki teknik/UX düzeltmesi içerir.

## 1. Content Security Policy düzeltmesi

`index.html` içindeki CSP meta etiketi güncellendi.

Değişiklik:
- `script-src-elem` açık biçimde tanımlandı.
- Tarayıcının raporladığı izinli hash eklendi:
  `sha256-ZswfTY7H35rbv8WC7NXBoiC7WNu86vSzCDChNWwZZDM=`
- Inline event handler kullanımını kapalı tutmak için `script-src-attr 'none'` eklendi.
- Ana oyun dosyası hâlâ dış dosya olarak `app.min.js` üzerinden çalışıyor.

## 2. Score / level sayı kısaltması

`app.min.js` içine merkezi `fmtNum()` formatlayıcısı eklendi.

Bu sayede büyük değerler:
- `12000` yerine `12.0K`
- `1250000` yerine `1.3M`
- `2500000000` yerine `2.5B`

şeklinde gösterilir.

Güncellenen alanlar:
- Üst HUD skor kutusu
- Oyun sonu merkez skor yazısı
- Menüdeki BEST göstergesi
- Oyun sonundaki BEST göstergesi
- LEVEL göstergesi
- Oyun sonu yıldız ölçek hesabı

Ham skor ve best değerleri localStorage içinde tam sayı olarak korunur; sadece ekranda görünen metin kısaltılır.
