# İstanbul Match

Royal Match tarzı, İstanbul'u tanıtan match-3 oyunu. Vite + TypeScript projesi, Android için Capacitor ile paketleniyor. Orijinal tek dosyalık sürüm referans olarak `legacy/tatli-kavga.html` içinde duruyor; oyun mantığı o dosyayla birebir aynı tutuluyor. Görünüm ondan ayrıldı: oyun ekranında koyu ve yarı saydam tahta hücreleri, tek parça üst panel, tahtayı örtmeyen konuşma satırı, tahtanın arkasında durağın mekân silüeti (`#gLand`) ve kaydırma ipucu var.

## Amaç
- Oyuncu gerçek İstanbul haritasında durak durak ilerliyor.
- Rota Tarihi Yarımada'dan başlıyor: Sultanahmet → Topkapı → Eminönü → Kapalıçarşı → Süleymaniye → Fener-Balat. Sonra Galata, Beyoğlu, Dolmabahçe, Ortaköy, Üsküdar ve Kadıköy.
- Her durakta bir "Did you know?" bilgi kartı ve o mekâna ait yerel bir karakter var.
- Oyun dili İngilizce.

## Komutlar
- `npm run dev`: geliştirme sunucusu
- `npm test`: Vitest motor testleri
- `npm run typecheck`
- `npm run build`: `dist/` çıktısı
- `npm run cap:sync`: build alıp `android/` içine kopyalar
- `npm run android:apk`: debug APK
- `npm run android:bundle`: imzalı AAB

Android ve Google Play adımları için `docs/ANDROID.md` dosyasına bak.

## Proje yapısı
- **`index.html`:** ekranların HTML iskeleti. Hacivat ve Karagöz SVG `<symbol>` olarak burada çizili (`#hacivat`, `#karagoz`), oyun sahnesinin arka planı da burada.
- **`src/styles/main.css`:** tema "Osmanlı gecesi" (lacivert #13245c, altın #f5c04a, turkuaz #24b8c6, nar kırmızısı).
- **`src/engine/`:** oyun motoru. Saf TypeScript, DOM'a bağlı değil.
  - `board.ts`: `Board` sınıfı ve kurallar. `findGroups`, `findMove`, `applyGravity` (sandık altına çapraz dolum dahil), `shuffle`, `groupSpecial`, `placeFor`.
  - `game.ts`: `Game` sınıfı ve tur akışı. `clearGroups`, `detonate`, `cascade`, `trySwap`, `combo`, güçlendiriciler, kazanma/kaybetme.
    - Dış dünyaya (süre, animasyonun oturması, ses, konuşma) sadece `GameHooks` üzerinden erişir.
    - Rastgelelik constructor'a veriliyor, böylece testlerde sabit tohum kullanılabiliyor.
  - `goals.ts`: hedef hesapları.
  - `save.ts`: kayıt. `localStorage` anahtarı `tatli-kavga-v1` (oyunun eski adından kalma), oyuncu ilerlemesi kaybolmasın diye değiştirilmemeli. Yıldız ve ödül kuralları da burada.
  - `types.ts`: ortak tipler.
- **`src/data/levels.ts`:** `LEVELS`, 12 bölüm. Her bölümde şu alanlar var:
  - mekân bilgisi: `name`, `district`, `icon`, `sub`, `fact`
  - haritadaki konum: `pt`, `badge`
  - karakter ve diyalog: `npc`, `talk`
  - oyun ayarı: `moves`, `colors`, `goals`, `map`
- **`src/data/dialogue.ts`:** Hacivat ve Karagöz replikleri.
- **`map` yerleşimi:** 8×8. Karakterlerin anlamı:
  - `.` boş hücre
  - `k` tek kat kilim, `K` çift kat kilim
  - `s` sandık (1 can), `S` sandık (2 can)
- **`src/map/`:** harita ekranı.
  - `mapdata.json`: ilçe poligonları. OpenStreetMap tabanlı, 1000×884 SVG koordinatında.
  - `landmarks.ts`: rozetlerdeki SVG mekân çizimleri.
  - `buildMap.ts`: harita SVG'sini üretir.
  - `mapScreen.ts`: harita ekranı ve mekân kartı.
- **`src/render/`:** canvas çizimi.
  - `sprites.ts`: taş, kilim ve sandık çizimleri ile sprite önbelleği.
  - `boardView.ts`: tahta çizimi, animasyon, parçacıklar ve efektler: parlayan ışınlar, şok halkaları, kıvılcımlar, şimşek.
- **`src/ui/collect.ts`:** hedefe sayılan taş, üst paneldeki hedefine uçuyor (`GameHooks.collect`).
- **`src/ui/confetti.ts`:** kazanınca konfeti.
- **`src/ui/`:** DOM katmanı.
  - `app.ts`: motoru ekrana bağlar; ekranlar, modallar, girdi ve render döngüsü.
  - `talk.ts`: konuşma balonu.
  - `hud.ts`, `modal.ts`, `dom.ts`.
- **`src/audio/`:** ses.
  - `mixer.ts`: tek AudioContext. Efekt ve müzik kanalları, yankı, sıkıştırıcı ve sınırlayıcı burada. Uygulama arka plana geçince ses duruyor.
  - `sfx.ts`: kayıtlı efektler, `src/assets/sfx/*.ogg`. Hepsi Kenney'den, CC0 lisanslı; kaynak listesi `CREDITS.md` dosyasında. Oyun olayına göre efekt seçiliyor; perde hafifçe değişiyor, art arda çalma sınırlanıyor.
  - `music.ts`: fon müziği dosya değil, anlık sentezleniyor. Hicaz makamında kanun benzeri ezgi, dem sesi ve Maksum usulü darbuka; darbuka sadece oyun ekranında çalıyor.
  - Ses ve müzik ayrı ayrı açılıp kapanıyor. Ayar `save.sound` ve `save.music` alanlarında; düğmeler haritanın üstünde ve duraklatma kartında.
- **`src/platform/ads.ts`, `adPolicy.ts`:** AdMob reklamları. Ödüllü reklam: kaybedince +5 hamle, biten güçlendiriciye +1. Seyrek geçiş reklamı; banner yok. Sıklık kuralları `adPolicy.ts` dosyasında ve testli. Google test kimlikleri varsayılan; AdMob hesap kurulumu adım adım `docs/ADMOB.md` dosyasında.
- **`src/platform/native.ts`:** Capacitor tarafı. Titreşim (Haptics), durum çubuğu, splash, Android geri tuşu, arka plana geçince otomatik duraklatma.
- **`src/assets/img/*.png`:** görseller (Microsoft Fluent Emoji 3D, MIT lisansı). `src/assets/images.ts` bunları anahtar adıyla yüklüyor.
  - Taşlar: `t0` Paşa, `t1` Hilal, `t2` Lale, `t3` Dansöz, `t4` Padişah, `t5` Cin.
  - Özel taşlar:
    - vapur (`ferry`): 4'lü eşleşme, satır ya da sütun temizler
    - güvercin (`dove`): 2×2
    - alev (`fire`): L ya da T şekli
    - taç (`crown`): 5'li eşleşme, aynı renkteki tüm taşları siler
  - Güçlendiriciler: terlik (`slipper`), şimşek (`bolt`), süpürge (`broom`), zar (`die`).
  - Yerel karakterler: `n_*` portreleri.
- **Fontlar:** Baloo 2 ve Lilita One, `@fontsource` ile pakete gömülü. Çevrimdışı da aynı görünüyor.
- **`android/`:** Capacitor Android projesi. `assets/` içinde ikon ve splash kaynakları var.

## Bilinen eksikler / sıradaki işler
- Yeniçeri, semazen ve gerçek dansöz için aynı 3D stilde stok görsel gerekiyor; Fluent setinde yoklar.
- Her durağın oyun içi arka planı o mekânın manzarası olmalı.
- Fon müziği sentezleniyor; ileride gerçek enstrüman kaydıyla (ney, kanun, darbuka) değiştirilebilir.

## Test
- Motor testleri `tests/` altında, Vitest ile yazıldı ve sabit tohumla çalışıyor. Kapsam: eşleşme kuralları, yerçekimi, kombolar, güçlendiriciler, kazanma/kaybetme, kayıt ve bölüm verisi.
- Davranış değişikliği yaparken `legacy/tatli-kavga.html` ile karşılaştır.
