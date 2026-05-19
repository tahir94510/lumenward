# Last Light v35 — Difficulty Balance Update

Bu paket, oyunun çekirdek sistemini bozmadan yalnızca zorluk dengesini iyileştirmek için hazırlandı.

## Değişiklik kapsamı

Sadece `app.min.js` içindeki oynanış denge değerleri güncellendi. Görsel palet, UI, ses sistemi, menü/pause/retry akışları, PWA dosyaları, manifest, ikonlar ve HTML yapısı değiştirilmedi.

## Denge hedefi

- Oyuncu ilk 15-30 saniyede sıkılmasın.
- Orta oyunda ritim ve gerilim oluşsun.
- Geç oyunda baskı artsın ama oyun imkansızlaşmasın.
- Kombo yapmak keyifli kalsın fakat oyuncuyu haksız biçimde boğan ani asteroid dalgaları oluşmasın.
- Hasar aldıktan sonra oyuncuya geri dönüş şansı verilsin.
- Tek vuruşlu, iki vuruşlu ve üç vuruşlu asteroid dağılımı daha doğal ve daha az tekdüze olsun.

## Teknik değişiklikler

- Başlangıç spawn süresi `.18` değerinden `.24` değerine çekildi; oyun hâlâ hızlı başlıyor ama ilk saniyelerde daha okunabilir.
- Ana zorluk skaları yavaşlatıldı: süre ve skor üzerinden artan baskı daha kontrollü hale getirildi.
- Maksimum aktif tehdit kapasitesi ve toplam baskı hesabı yumuşatıldı.
- Geç oyundaki minimum spawn aralığı `.24` yerine `.27` tabanına alındı.
- Ek dalga ihtimali azaltıldı ve dalga gecikmesi artırıldı; ani, haksız sıkışmalar azaltıldı.
- İki/üç vuruşlu asteroid oranları düşürüldü; geç oyunda hâlâ tehdit var ama tek vuruşluk nefes anları korunuyor.
- Üç vuruşlu asteroidlerin sahnede kalma süresi artırıldı; daha adil hedeflenebilir hale getirildi.
- Geç oyundaki asteroid hızı yumuşatıldı; refleksle müdahale edilebilir yapı güçlendirildi.
- Combo süresi biraz uzatıldı; kombo zinciri daha tatmin edici hale getirildi.
- Combo'nun ekstra spawn baskısı azaltıldı; iyi oynayan oyuncu cezalandırılmış gibi hissetmiyor.
- Vuruş sonrası mini freeze ve grace süreleri artırıldı; çok vuruşlu asteroidlerde adalet hissi güçlendirildi.
- Hasar sonrası toparlanma penceresi artırıldı; oyuncunun oyuna geri dönebilme şansı yükseltildi.
- Mouse/touch hit toleransı çok küçük artırıldı; mobil ve hızlı sürükleme hissi iyileştirildi.

## Kontrol

`node --check app.min.js` ile syntax kontrolü yapıldı.
