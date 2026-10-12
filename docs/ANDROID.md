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

Uygulama kimliği `com.kolomp.tatlikavga`. Play'e ilk yüklemeden sonra bu kimlik **değiştirilemez**. Değiştirmek istiyorsan ilk yüklemeden önce `capacitor.config.ts` ve `android/app/build.gradle` içinde değiştir.

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
1. **Uygulama oluştur:** ad "Tatlı Kavga", varsayılan dil İngilizce (oyunun dili), tür: Oyun → Bulmaca, ücretsiz.
2. **Önce dahili test:** AAB'yi "Internal testing" kanalına yükle ve kendi cihazında dene.
3. **Mağaza kaydı:**
   - Uygulama ikonu 512×512. `assets/icon-only.png` dosyasını 512 px'e küçült.
   - Öne çıkan görsel 1024×500.
   - En az 2 telefon ekran görüntüsü (dikey, örneğin 1080×1920): harita, oyun tahtası, bilgi kartı.
   - Kısa ve uzun açıklama.
4. **İçerik derecelendirmesi anketi:** şiddet yok, kumar yok, kullanıcı etkileşimi yok. Muhtemelen "Herkes / PEGI 3" çıkar.
5. **Hedef kitle:** çocuklara yönelikse (13 yaş altı) "Families" politikası devreye girer. Oyunda reklam ve veri toplama olmadığı için uyumlu, ama ilk sürümde "13+" seçmek inceleme sürecini kısaltır.
6. **Veri güvenliği formu:** oyun hiçbir veri toplamıyor ya da paylaşmıyor. İlerleme yalnızca cihazda (`localStorage`) tutuluyor. Cevap: "Veri toplanmıyor".
7. **Gizlilik politikası URL'si:** veri toplanmasa bile oyunlarda isteniyor. Basit bir sayfa yeterli (GitHub Pages olabilir).
8. **Hedef API seviyesi:** `targetSdkVersion 36`. Play bu şartı her yıl yükseltiyor; Console yükleme sırasında uyarı verirse `android/variables.gradle` içinden yükselt.
9. **Yeni kişisel geliştirici hesabıysan:** üretime çıkmadan önce en az 12 test kullanıcısıyla 14 gün kapalı test şartı var. Bunu takvimine ekle.

## Lisans notu
Taş, özel taş ve güçlendirici görselleri Microsoft Fluent Emoji 3D'den (MIT). Telif notu `index.html` ve `src/assets/images.ts` dosyalarında. Mağaza açıklamasına ya da oyun içi bir "Hakkında" ekranına da eklemek iyi olur.
