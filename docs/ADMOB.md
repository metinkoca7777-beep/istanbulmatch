# AdMob kurulumu (İstanbul Match)

Oyunda reklam kodu hazır. Bu rehber, gerçek reklam gösterip para kazanmak için **AdMob tarafında** yapman gerekenleri sırayla anlatıyor. Kimlikler projeye girildi (5. adım).

Toplam süre: hesap açma ve ilk ayarlar için ~30–45 dakika. Ödeme ve vergi bilgilerinin onayı birkaç gün sürebilir.

---

## 0. Bilmen gerekenler

- **Şu an test reklamları gösteriliyor.** Kodda Google'ın resmi test kimlikleri var; gerçek para kazandırmaz ama hesabı da riske atmaz.
- **Kendi reklamına asla tıklama, kendi gerçek reklamını tekrar tekrar izleme.** Google bunu geçersiz trafik sayar ve hesabı kapatabilir. Kendi telefonunu "test cihazı" yap (6. adım).
- Oyunda iki reklam birimi kullanılıyor:
  - **Rewarded (ödüllü):** kaybedince +5 hamle, güçlendirici bitince +1.
  - **Interstitial (geçiş):** bölüm aralarında, seyrek.
- Kurallar kodda sabit, AdMob panelinden değişmez: `src/platform/adPolicy.ts`.

---

## 1. AdMob hesabı aç

1. [admob.google.com](https://admob.google.com) adresine Google hesabınla gir (Play Console'u açtığın hesap olması iyi olur).
2. Ülke: **Türkiye**, saat dilimi: **İstanbul**, para birimi: **TRY** ya da **USD**. Para birimi sonradan değiştirilemez.
3. Şartları kabul et. Hesap açılınca sağ üstte **Yayıncı kimliğin** görünür: `pub-xxxxxxxxxxxxxxxx`. Bunu not al; 9. adımda lazım.

---

## 2. Uygulamayı ekle

1. Sol menü **Apps → Add app**.
2. Platform: **Android**.
3. "Is the app listed on a supported app store?" sorusu:
   - Oyun henüz Play'de yoksa **No**. AdMob bunu "unpublished" (yayınlanmamış) uygulama olarak ekler. Play'e çıkınca 8. adımda mağazaya bağlarsın.
   - Play'de zaten yayındaysa **Yes**. Ardından "İstanbul Match"i ara ve seç.
4. App name: **İstanbul Match**.
5. "User metrics" açık kalsın.
6. **Add app** düğmesine bas. Çıkan ekranda **App ID** görünür:
   ```
   ca-app-pub-xxxxxxxxxxxxxxxx~yyyyyyyyyy
   ```
   Bu **ADMOB_APP_ID**. Dikkat: içinde **~** (tilde) var.

---

## 3. Reklam birimlerini oluştur

Uygulamanın sayfasında **Ad units → Add ad unit**:

### a) Rewarded
1. **Rewarded** seç.
2. Ad unit name: `rewarded_main`.
3. Reward settings:
   - Reward amount: `1`
   - Reward item: `bonus`. Kod bu değerleri okumuyor; ödülü oyun kendisi veriyor.
4. **Create ad unit**. Kimliği kopyala:
   ```
   ca-app-pub-xxxxxxxxxxxxxxxx/1111111111
   ```
   Bu **ADMOB_REWARDED_ID**. Dikkat: içinde **/** var.

### b) Interstitial
1. **Interstitial** seç.
2. Ad unit name: `interstitial_main`.
3. Ad type: hem **Image** hem **Video** açık kalsın.
4. **Create ad unit**. Kimliği kopyala. Bu **ADMOB_INTERSTITIAL_ID**.

> Yeni birimlerin reklam vermeye başlaması birkaç saat sürebilir. İlk başta "no fill" normaldir.

---

## 4. Gizlilik onay mesajı (GDPR) — zorunlu

Avrupa ve İngiltere'deki oyunculara reklamdan önce onay sorulmalı. Kod Google'ın onay formunu (UMP) zaten çağırıyor, ama formun içeriğini AdMob panelinde sen oluşturmalısın. **Oluşturmazsan form çıkmaz ve AB'de reklam gösterilmez.**

1. Sol menü **Privacy & messaging**.
2. **European regulations** kartında **Create message**.
3. Apps: **İstanbul Match**.
4. Languages: **English**. Oyun dili İngilizce; istersen Almanca ve Fransızca da ekle.
5. User consent options: **Consent** ve **Manage options**. Varsayılan seçim; "Do not consent" düğmesini de eklemek kullanıcı dostu olur.
6. Targeting: **Countries subject to GDPR (EEA and UK)**.
7. Privacy policy URL: 7. adımdaki sayfa. Önce onu yayınla, sonra buraya yaz.
8. **Publish**.

Opsiyonel: **US state regulations** mesajı (ABD eyalet yasaları) için de aynı ekrandan bir mesaj oluşturabilirsin.

**Türkiye notu:** Türkiye AB'de olmadığı için Türk oyunculara bu form **görünmez**. KVKK açısından gizlilik politikasında reklam ve reklam kimliği kullanımını açıklaman yeterli (7. adım).

Oyunda karşılığı: onay gerektiren ülkelerde duraklatma kartında **"Privacy settings"** bağlantısı çıkar. Oyuncu onayını oradan değiştirebilir.

---

## 5. Kimlikler projede (yapıldı)

İstanbul Match'in gerçek kimlikleri depoya işlendi. Bunlar uygulamanın içinde zaten herkese açık; şifre değiller.

| Ne | Kimlik | Dosya |
|---|---|---|
| App ID | `ca-app-pub-4357371903036713~2270042242` | `android/app/build.gradle` (release) |
| Rewarded (`IM_Rewarded`) | `ca-app-pub-4357371903036713/3078807017` | `.env.release` |
| Interstitial (`IM_Interstitial`) | `ca-app-pub-4357371903036713/1260212902` | `.env.release` |

Hangi derleme neyi kullanıyor:
- **`npm run android:bundle`** ve GitHub'daki **"Android release (AAB)"**: gerçek kimlikler. Play'e giden derleme budur.
- **`npm run android:apk`**, **`npm run cap:sync`**, Android Studio'dan debug çalıştırma: Google'ın test kimlikleri. Geliştirirken yanlışlıkla kendi reklamına tıklayıp hesabı riske atmazsın.
- **Web (Vercel)**: reklam yok.

Kimlik değişirse `.env.release` dosyasını ve `build.gradle` içindeki `ADMOB_RELEASE_APP_ID` değerini güncelle. Uygulama kimliğini geçici olarak `ADMOB_APP_ID` ortam değişkeni ya da Gradle özelliğiyle de ezebilirsin.

---

## 6. Kendi telefonunu test cihazı yap

Gerçek kimliklerle denerken kendi telefonunda **test reklamı** görmen gerekir; yoksa hesap riske girer.

1. Telefonu USB ile bağla. Geliştirici seçenekleri ve USB hata ayıklama açık olsun.
2. Uygulamayı gerçek kimliklerle derleyip yükle ve aç. Bir reklam tetikle: bir bölümü kaybet ve "+5 moves"a bas.
3. Bilgisayarda şu komutu çalıştır:
   ```
   adb logcat | grep -i "setTestDeviceIds"
   ```
   Şuna benzer bir satır çıkar:
   ```
   Use RequestConfiguration.Builder().setTestDeviceIds(Arrays.asList("33BE2250B43518CCDA7DE426D04EE231"))
   ```
4. Tırnak içindeki kodu `.env` dosyasına yaz: `VITE_ADMOB_TEST_DEVICES=33BE2250B43518CCDA7DE426D04EE231`. Birden fazla telefon varsa virgülle ayır.
5. Yeniden derle. Artık bu telefonda reklamların köşesinde **"Test Ad"** etiketi görünür.

> Mağazaya gidecek derlemede `VITE_ADMOB_TEST_DEVICES` boş da olabilir, dolu da; sadece listedeki cihazları etkiler.

---

## 7. Gizlilik politikası sayfası — zorunlu

Reklam olduğu için hem Google Play hem AdMob gizlilik politikası istiyor. İçinde en az şunlar olmalı:
- Oyunun ilerlemeyi sadece cihazda sakladığı, kişisel hesap ya da veri toplamadığı.
- Reklamların **Google AdMob** ile gösterildiği; AdMob'un **reklam kimliği** ve cihaz bilgisi kullandığı.
- Google'ın politikasına bağlantı: `https://policies.google.com/technologies/partner-sites`
- Avrupa'daki kullanıcıların onayı oyundaki "Privacy settings" bağlantısından değiştirebileceği.
- İletişim e-postası.

Sayfayı kendi alan adında yayınla (örneğin `https://kolomp.com/istanbul-match/privacy`) ya da GitHub Pages kullan. Bu URL'yi 4. adımdaki GDPR mesajına ve Play Console'a gir.

---

## 8. Play Console tarafı

1. **App content → Ads → "Yes, my app contains ads"**.
2. **App content → Target audience:** **13+**. Kod da buna göre ayarlı: çocuklara yönelik değil, reklam içerik derecesi en fazla PG.
3. **App content → Data safety:** AdMob SDK'nın topladığını beyan et:
   - **Device or other IDs**: Advertising/marketing, Analytics, Fraud prevention; "Shared" (Google ile).
   - **App activity → App interactions** ve **App info and performance → Diagnostics**: Advertising, Analytics.
   - "Data is encrypted in transit": **Yes**.
   - Güncel liste için Google'ın sayfası: [AdMob Play data disclosure](https://developers.google.com/admob/android/privacy/play-data-disclosure).
4. **Store listing → Contact details → Website:** geliştirici web siteni yaz (9. adım için şart).
5. Oyun Play'de yayınlanınca AdMob'da uygulama sayfasına gir. **App settings → Add store / Link** ile Play kaydına bağla. AdMob uygulamayı otomatik inceler ("App review"); onay gelene kadar reklam sınırlı gösterilebilir.

---

## 9. app-ads.txt (gelir için önemli)

Reklam verenler, uygulamanın gerçekten sana ait olduğunu bu dosyayla doğruluyor. Dosya yoksa gelir düşer.

1. AdMob → **Apps → View all apps → app-ads.txt** sekmesi. Sana özel satırı kopyala; şuna benzer:
   ```
   google.com, pub-xxxxxxxxxxxxxxxx, DIRECT, f08c47fec0942fa0
   ```
2. Bu satırla `app-ads.txt` adlı bir dosya oluştur. Play mağaza kaydındaki web sitesinin **kök dizinine** koy:
   `https://kolomp.com/app-ads.txt`
3. Tarayıcıda bu adresi açınca satır görünmeli.
4. AdMob dosyayı 24 saat içinde tarar. Durumu app-ads.txt sekmesinde "Found" olarak görürsün.

---

## 10. Ödeme bilgileri

AdMob → **Payments**:
1. Ödeme profili: ad, adres, vergi bilgisi (Türkiye'de bireysel ya da şirket).
2. Banka hesabı (IBAN) ekle. Google doğrulama için küçük bir test ödemesi gönderebilir.
3. Kazanç ödeme eşiğine ulaşınca ay sonunda ödeme yapılır.

---

## Kontrol listesi

- [ ] AdMob hesabı açıldı, yayıncı kimliği not alındı.
- [ ] Uygulama eklendi, **App ID** (`~` içeren) alındı.
- [ ] **Rewarded** ve **Interstitial** birimleri oluşturuldu.
- [ ] GDPR mesajı oluşturulup yayınlandı.
- [ ] Gizlilik politikası sayfası yayında.
- [x] Üç kimlik projeye girildi (`.env.release`, `build.gradle`).
- [ ] Kendi telefonun test cihazı olarak eklendi, "Test Ad" etiketi görüldü.
- [ ] Play Console: reklam beyanı, 13+, veri güvenliği, web sitesi.
- [ ] Play'de yayından sonra AdMob'da mağaza bağlantısı yapıldı.
- [ ] `app-ads.txt` web sitesinde, AdMob'da "Found".
- [ ] Ödeme bilgileri girildi.

## Sorun giderme

**Teşhis satırı:** oyunda duraklat (⏸), açılan kartın üstündeki **"Tea break"** başlığına 5 kez dokun. Kartın altında reklam durumunu gösteren küçük bir satır çıkar, örneğin:
`native · live units · ready=true · rewarded=none · rewarded load failed 3: No fill.`

| Satırda | Anlamı |
|---|---|
| `failed 3` / `No fill` | Kod doğru çalışıyor, AdMob reklam göndermiyor. Yeni hesap ya da uygulama henüz onaylanmamış (AdMob → Apps → durum "Requires review" / "Limited ad serving"), uygulama Play kaydına bağlanmamış ya da ödeme bilgileri eksik. Telefonunu test cihazı olarak eklersen (6. adım) test reklamları hemen gelir. |
| `failed 0` / `Internal error` | Uygulama kimliği ile birim kimlikleri farklı hesaplardan, ya da kimlik yanlış yazılmış. |
| `failed 2` / `Network` | İnternet yok. |
| `consent …: ads not allowed` | GDPR onayı verilmedi ya da AdMob'da GDPR mesajı yayınlanmamış. |
| `init failed` | AdMob SDK başlatılamadı; satırdaki mesajı bana gönder. |
| `test units` | Debug derlemesi kurulu; Play'den indirilen sürümde `live units` yazmalı. |

Reklam hiç gelmese de oyuncu engellenmez: "+5 moves" ve güçlendirici dolumu (günlük sınır içinde) yine verilir.

| Belirti | Olası sebep |
|---|---|
| Hiç reklam çıkmıyor, "+5 moves" yine de hamle veriyor | Normal davranış: reklam yüklenemeyince oyuncu cezalandırılmıyor. Yeni birimler birkaç saat sürebilir; uygulama "unpublished" ya da inceleme bekliyor olabilir; internet yok. |
| AB'den test ederken reklam yok | GDPR mesajı yayınlanmamış, ya da kullanıcı onay vermemiş. |
| Uygulama açılışta çöküyor | Manifestteki uygulama kimliği geçersiz. `ADMOB_APP_ID`'nin `~` içeren **App ID** olduğundan emin ol, `/` içeren birim kimliği değil. |
| Kendi telefonunda gerçek reklam görüyorsun | Test cihazı eklenmemiş (6. adım). Reklama tıklama. |
