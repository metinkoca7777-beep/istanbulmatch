# Google Play mağaza kaydı

Play Console'a kopyalanacak metinler, görseller ve form cevapları. Genel Play adımları ve imzalama için `docs/ANDROID.md`, reklam için `docs/ADMOB.md`.

## Görseller (`docs/store/`)

| Dosya | Play Console alanı | Boyut |
|---|---|---|
| `icon-512.png` | App icon | 512×512 |
| `feature-graphic.png` | Feature graphic | 1024×500 |
| `screenshot-1.png` … `screenshot-5.png` | Phone screenshots (bu sırayla) | 1080×1920 |

Ekran görüntüleri oyunun kendisinden alındı (Galata bölümü), üstlerine başlık eklendi. Yeniden üretmek gerekirse oyunda aynı sahneyi açıp 390×844 boyutunda, 3× çözünürlükte görüntü al.

## Uygulama bilgileri

- **Uygulama adı:** İstanbul Match
- **Varsayılan dil:** English (United States), en-US
- **Uygulama mı, oyun mu:** Game
- **Kategori:** Puzzle
- **Ücretsiz / ücretli:** Free
- **Etiketler:** Match 3, Puzzle, Casual, Offline
- **İletişim e-postası:** metinkoca7777@gmail.com (Play'de herkese açık görünür)
- **Web sitesi:** https://istanbulmatch.vercel.app
- **Gizlilik politikası:** https://istanbulmatch.vercel.app/privacy.html

## Mağaza metni: English (varsayılan)

**App name** (en fazla 30 karakter)
```
İstanbul Match: Match 3 Tour
```

**Short description** (en fazla 80 karakter)
```
Match 3 puzzles across real Istanbul with Hacivat & Karagöz. Learn as you play!
```

**Full description**
```
Swap, match and blast your way across Istanbul!

İstanbul Match is a colorful match-3 puzzle adventure on a real map of the city. Travel stop by stop from the Historic Peninsula to the Asian shore, clear every board and unlock the next landmark. Hacivat and Karagöz, the beloved heroes of Turkish shadow theater, cheer you on (and bicker) the whole way.

EXPLORE REAL ISTANBUL
• 12 iconic stops: Sultanahmet, Topkapı Palace, Eminönü, the Grand Bazaar, Süleymaniye, Fener & Balat, Galata, Beyoğlu, Dolmabahçe, Ortaköy, Üsküdar and Kadıköy
• A "Did you know?" fact at every landmark
• Meet a local at each stop: a spice seller, a carpet dealer, a boatman and more

MATCH, BLAST, COMBO
• Match 4 to launch a ferry that clears a whole row or column
• Make a square for a dove, an L or T for fire, and 5 in a row for the crown that clears a whole color
• Swap two specials together for huge combos
• Lift kilims and crack open chests to complete your goals

HANDY BOOSTERS
• Slipper, lightning, broom and dice help you out of tight spots

MADE TO FEEL GOOD
• Smooth animations, juicy effects and a kanun-style soundtrack in the Hicaz makam with darbuka rhythms
• Plays offline, no account needed
• Free to play: rewarded ads are optional and only play when you choose them

Pack your bags. Istanbul is waiting!
```

## Mağaza metni: Türkçe (tr-TR, ek dil)

Play Console → **Store presence → Main store listing → Manage translations → Add your own translation text → Turkish (tr-TR)**.

**Uygulama adı**
```
İstanbul Match: Match 3 Turu
```

**Kısa açıklama**
```
Gerçek İstanbul haritasında match-3 macerası! Hacivat ve Karagöz seninle.
```

**Tam açıklama**
```
Kaydır, eşleştir, patlat: İstanbul'u durak durak gez!

İstanbul Match, gerçek İstanbul haritası üzerinde geçen renkli bir match-3 bulmaca macerası. Tarihi Yarımada'dan Anadolu yakasına kadar her durağın tahtasını temizle, sıradaki mekânın kilidini aç. Gölge oyununun sevilen ikilisi Hacivat ile Karagöz yol boyunca sana tezahürat ediyor (ve tabii ki atışıyor).

GERÇEK İSTANBUL'U KEŞFET
• 12 ikonik durak: Sultanahmet, Topkapı Sarayı, Eminönü, Kapalıçarşı, Süleymaniye, Fener-Balat, Galata, Beyoğlu, Dolmabahçe, Ortaköy, Üsküdar ve Kadıköy
• Her durakta bir "Biliyor muydun?" bilgisi
• Her durakta bir yerel karakter: baharatçı, halıcı, kayıkçı ve daha fazlası

EŞLEŞTİR, PATLAT, KOMBO YAP
• 4'lü eşleşmeyle bütün satırı ya da sütunu temizleyen vapuru çıkar
• Kare yaparsan güvercin, L ya da T yaparsan alev, 5'li yaparsan bir rengin tamamını silen taç senin
• İki özel taşı birleştirip dev kombolar patlat
• Kilimleri kaldır, sandıkları kır, hedefleri tamamla

YARDIMCI GÜÇLENDİRİCİLER
• Terlik, şimşek, süpürge ve zar zor anlarda imdadına yetişir

KEYİFLE OYNA
• Akıcı animasyonlar, bol efekt ve Hicaz makamında kanun tınılı, darbukalı müzik
• İnternetsiz oynanır, hesap gerekmez
• Ücretsiz: ödüllü reklamlar isteğe bağlı, sadece sen seçince açılır

Bavulunu hazırla, İstanbul seni bekliyor!
```

> Oyunun içi İngilizce. Türkçe mağaza metni Türk kullanıcıların sayfayı anlaması için; oyun dili "English" olarak beyan edilmeli.

## App content formları (Policy → App content)

| Form | Cevap |
|---|---|
| **Privacy policy** | `https://istanbulmatch.vercel.app/privacy.html` |
| **Ads** | Yes, my app contains ads |
| **App access** | All functionality is available without special access |
| **Content rating** (IARC anketi) | Kategori: Game. Şiddet, korku, cinsellik, kumar, uyuşturucu, küfür: hepsi **No**. Kullanıcılar arası iletişim ve içerik paylaşımı: **No**. Konum paylaşımı: **No**. Dijital ürün satın alma: **No**. Beklenen sonuç: PEGI 3 / Everyone. |
| **Target audience** | **13–15, 16–17, 18+**. 13 yaş altını seçme: oyun Families politikasına göre ayarlı değil. |
| **News app** | No |
| **Data safety** | Aşağıda |
| **Government app** | No |
| **Financial features** | None |
| **Health** | None |

### Data safety

- **Does your app collect or share any of the required user data types?** Yes (AdMob SDK yüzünden)
- **Is all of the user data collected by your app encrypted in transit?** Yes
- **Do you provide a way for users to request that their data is deleted?** No (oyun kendisi veri toplamıyor; reklam verileri için Google'ın kendi araçları geçerli)

Seçilecek veri türleri (AdMob'un Google tarafından yayımlanan beyanına göre):

| Veri türü | Collected | Shared | Amaç |
|---|---|---|---|
| **Location → Approximate location** (IP'den) | ✓ | ✓ | Advertising or marketing, Analytics, Fraud prevention |
| **App activity → App interactions** | ✓ | ✓ | Advertising or marketing, Analytics |
| **App info and performance → Crash logs, Diagnostics** | ✓ | ✓ | Analytics, Fraud prevention |
| **Device or other IDs** (reklam kimliği) | ✓ | ✓ | Advertising or marketing, Analytics, Fraud prevention |

Her biri için: "processed ephemerally" **No**, "required or optional" **Required**.

Google bu listeyi zaman zaman güncelliyor; göndermeden önce [AdMob data disclosure](https://developers.google.com/admob/android/privacy/play-data-disclosure) sayfasıyla karşılaştır.

## Sürüm (Release)

1. **Testing → Internal testing → Create new release**
2. **App integrity:** "Play App Signing" kullan (varsayılan). İlk AAB'yi yüklediğinde Google, AAB'yi imzalayan anahtarı **yükleme anahtarı** olarak kaydeder.
3. AAB'yi yükle: `app-release.aab`.
4. **Release name:** `1.0.0 (1)`
5. **Release notes (en-US):**
   ```
   First release: 12 stops across Istanbul, from Sultanahmet to Kadıköy.
   ```
   **(tr-TR):**
   ```
   İlk sürüm: Sultanahmet'ten Kadıköy'e 12 durak.
   ```
6. Kendi telefonunda test et. Debug derlemesinde test reklamı, bu sürümde gerçek reklam çıkar: **kendi reklamına tıklama.**
7. Kişisel geliştirici hesabıysan üretime geçmeden önce **Closed testing**'de en az 12 testçiyle 14 gün test şartı var.
8. Sonra **Production → Create new release** ve aynı AAB.

Her yeni yüklemede `android/app/build.gradle` içindeki `versionCode` değerini 1 artır, `versionName` değerini güncelle.

## Yayından sonra

- AdMob → Apps → İstanbul Match → **Link to app store**: Play kaydını bağla.
- `app-ads.txt`: `https://istanbulmatch.vercel.app/app-ads.txt` adresinde yayında. Play Console'daki **Website** alanı `https://istanbulmatch.vercel.app` olmalı; AdMob dosyayı bu adresten okur (doğrulama 24 saate kadar sürebilir).
