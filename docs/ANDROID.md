# Android ve Google Play

Oyun Capacitor 8 ile Android'e paketleniyor. Web derlemesi (`dist/`) `android/app/src/main/assets/public` klasörüne kopyalanıyor ve WebView içinde, internete ihtiyaç duymadan çalışıyor. Fontlar ve görseller pakete gömülü.

## Gerekenler
- Node 22, JDK 21
- Android Studio ya da sadece Android SDK (platform 36, build-tools 36). `ANDROID_HOME` ortam değişkeni SDK'yı göstermeli.

## Günlük iş akışı
```bash
npm run cap:sync        # web'i derle, android/ içine kopyala
npm run android:open    # Android Studio'da aç (emülatör / cihazda çalıştır)
npm run android:apk     # debug APK: android/app/build/outputs/apk/debug/
```

Uygulama kimliği `com.kolomp.istanbulmatch`. Play'e ilk yüklemeden sonra bu kimlik **değiştirilemez**. Değiştirmek istiyorsan ilk yüklemeden önce `capacitor.config.ts` ve `android/app/build.gradle` içinde değiştir.

## İkon ve açılış ekranı
- Kaynak dosyalar `assets/src/*.svg` içinde. Hacivat ve Karagöz çizimleri oyundaki SVG sembollerinden alındı, gökyüzü oyun sahnesinden.
- PNG'ler `assets/` klasöründe: `icon-only.png`, `icon-foreground.png`, `icon-background.png`, `splash.png`.
- Android boyutlarını yeniden üretmek için: `npm run android:assets`.

## Yükleme anahtarı (bir kez)
Google Play "Play App Signing" kullanıyor. Sen bir **yükleme anahtarı** üretiyorsun, uygulamayı asıl imzalayan anahtarı Google saklıyor.

```bash
keytool -genkeypair -v -keystore upload-keystore.jks -alias upload \
  -keyalg RSA -keysize 2048 -validity 10000
```

- `.jks` dosyasını ve şifreleri **depoya koyma**. `.gitignore` bunları zaten dışarıda tutuyor. Yedeğini güvenli bir yerde sakla.
- Yerelde derlemek için `android/keystore.properties.example` dosyasını `android/keystore.properties` adıyla kopyala ve doldur.

## İmzalı App Bundle (AAB)
Yerelde:
```bash
npm run android:bundle
# → android/app/build/outputs/bundle/release/app-release.aab
```

GitHub Actions ile: **Actions → "Android release (AAB)" → Run workflow**. Önce şu depo sırlarını tanımla:

| Secret | Değer |
|---|---|
| `UPLOAD_KEYSTORE_BASE64` | `base64 -w0 upload-keystore.jks` çıktısı |
| `UPLOAD_STORE_PASSWORD` | keystore şifresi |
| `UPLOAD_KEY_ALIAS` | `upload` |
| `UPLOAD_KEY_PASSWORD` | anahtar şifresi |

Her yüklemede `android/app/build.gradle` içindeki `versionCode` değerini 1 artır, `versionName` değerini de güncelle.

## Google Play Console kontrol listesi
> Mağaza metinleri (EN + TR), görseller ve form cevapları hazır: **[docs/PLAY_STORE.md](PLAY_STORE.md)**. Gizlilik politikası: `https://istanbulmatch.vercel.app/privacy.html` (`public/privacy.html`).

1. **Uygulama oluştur:** ad "İstanbul Match", varsayılan dil İngilizce (oyunun dili), tür: Oyun → Bulmaca, ücretsiz.
2. **Önce dahili test:** AAB'yi "Internal testing" kanalına yükle ve kendi cihazında dene.
3. **Mağaza kaydı:**
   - Uygulama ikonu 512×512. `assets/icon-only.png` dosyasını 512 px'e küçült.
   - Öne çıkan görsel 1024×500.
   - En az 2 telefon ekran görüntüsü (dikey, örneğin 1080×1920): harita, oyun tahtası, bilgi kartı.
   - Kısa ve uzun açıklama.
4. **İçerik derecelendirmesi anketi:** şiddet yok, kumar yok, kullanıcı etkileşimi yok. Muhtemelen "Herkes / PEGI 3" çıkar.
5. **Hedef kitle:** **13+** seç. Oyunda AdMob reklamları var; 13 yaş altını hedeflemek "Families" politikasını ve sertifikalı reklam ayarlarını gerektirir. Kod da buna göre ayarlı: `tagForChildDirectedTreatment: false`, içerik derecesi en fazla "PG".
6. **Reklam beyanı:** "App content → Ads" bölümünde **"Evet, uygulamada reklam var"** seçilmeli. Mağaza sayfasında "Reklam içerir" etiketi görünür.
7. **Veri güvenliği formu:** Oyunun kendisi veri toplamıyor; ilerleme yalnızca cihazda tutuluyor. AdMob SDK ise şunları topluyor ve Google'a gönderiyor:
   - **Cihaz veya diğer kimlikler** (reklam kimliği): reklam veya pazarlama, analiz, dolandırıcılık önleme amacıyla. Google ile paylaşılıyor.
   - **Uygulama etkileşimleri / tanılama:** reklam ve analiz amacıyla.
   - Google'ın güncel listesi: AdMob için "Data disclosure" sayfası (developers.google.com/admob/android/privacy/play-data-disclosure). Formu bu listeye göre doldur.
8. **Gizlilik politikası URL'si:** artık zorunlu. Politikada AdMob'un reklam kimliği kullandığı ve Google'ın gizlilik politikasına bağlantı yer almalı. Basit bir sayfa yeterli (GitHub Pages olabilir).
8. **Hedef API seviyesi:** `targetSdkVersion 36`. Play bu şartı her yıl yükseltiyor; Console yükleme sırasında uyarı verirse `android/variables.gradle` içinden yükselt.
9. **Yeni kişisel geliştirici hesabıysan:** üretime çıkmadan önce en az 12 test kullanıcısıyla 14 gün kapalı test şartı var. Bunu takvimine ekle.

## Reklamlar (AdMob)

> Adım adım AdMob hesabı, reklam birimleri, GDPR mesajı, test cihazı, app-ads.txt ve ödeme kurulumu: **[docs/ADMOB.md](ADMOB.md)**.

Oyunda iki tür reklam var; banner yok.

| Tür | Nerede | Kural |
|---|---|---|
| **Ödüllü** (oyuncu seçer) | Kaybedince "▶ AD +5 moves"; güçlendirici bitince "▶ AD +1" | Ödül yalnızca reklam sonuna kadar izlenince verilir. Güçlendirici dolumu günde en fazla 5. Reklam yüklenemezse +5 hamle yine verilir (eski davranış). |
| **Geçiş** (interstitial) | Kazanma/kaybetme kartından çıkarken | İlk 4 bölüm denemesinde hiç yok. En fazla 3 bölüm sonunda bir, en az 3 dakika arayla, ödüllü reklamdan sonraki 90 saniyede yok. |

Kurallar `src/platform/adPolicy.ts` dosyasında ve testli (`tests/adPolicy.test.ts`). Reklam katmanı `src/platform/ads.ts` dosyasında. Tarayıcıda (demo) gerçek reklam yerine etiketli bir önizleme ekranı açılıyor.

**Onay (GDPR/KVKK):** Uygulama açılışında Google UMP onay formu gösteriliyor (Avrupa/İngiltere kullanıcılarına). Gerekiyorsa duraklatma kartında "Privacy settings" bağlantısı çıkıyor. AdMob panelinde **Privacy & messaging → GDPR mesajı** oluşturulmalı, yoksa form görünmez.

### Reklam kimlikleri
Gerçek kimlikler bağlı: `npm run android:bundle` (Play derlemesi) gerçek reklam gösterir, debug derlemeleri Google'ın test reklamlarını. Ayrıntı: [ADMOB.md, 5. adım](ADMOB.md).

Kimlikleri sıfırdan kurmak gerekirse:
1. [admob.google.com](https://admob.google.com) üzerinde hesap aç → **Apps → Add app** (Android, Google Play'de henüz yoksa "No" seç).
2. İki reklam birimi oluştur: **Rewarded** ve **Interstitial**.
3. Kimlikleri ver:
   - Birim kimlikleri `.env.release` dosyasında, uygulama kimliği `android/app/build.gradle` içinde `ADMOB_RELEASE_APP_ID`.
4. Gerçek kimliklerle **kendi reklamlarına tıklama**: hesap kapatılabilir. Kendi cihazını AdMob'da test cihazı olarak ekle.
5. Play'de yayınladıktan sonra AdMob'da uygulamayı mağaza kaydına bağla ve `app-ads.txt` dosyasını geliştirici web sitene koy.

## Lisans notu
Taş, özel taş ve güçlendirici görselleri Microsoft Fluent Emoji 3D'den (MIT). Telif notu `index.html` ve `src/assets/images.ts` dosyalarında. Mağaza açıklamasına ya da oyun içi bir "Hakkında" ekranına da eklemek iyi olur.
