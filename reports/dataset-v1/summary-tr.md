# Tünel simülatörü — veri seti ve kontrol raporu

**3,180 koşu tamamlandı.** Hesaplama hatası: 0; eksik koşu: 0; bağımsızlık kontrolü: 4,260; ihlal: 0.

## Deney tasarımı

240 geliştirme referansı; 1.800 sayısal alt/üst değer taraması; 300 açık/kapalı kontrolü; 540 telefon, harita, NIS, hız ve tünel uzunluğu taraması; 120 ayrı seed doğrulama referansı; 180 birleşik zor koşul. Geliştirme seedleri 1001–1020, doğrulama seedleri 9001–9010. Parametreler doğrulama sonuçlarına göre ayarlanmadı.

Üç yol ve dört sürüş profilinin referansları var. Parametreler tek tek değiştirilir; varsayılan değer aynı seed/yol/profil referansından alınır. Wavespeed parametreleri Wavespeed profilinde, duruş anahtarları duruş profilinde, diğer taramalar yavaşlama profilinde sınanır. Tüm etkileşimlerin Kartezyen çarpımı taranmaz.

## Geliştirme referansları — koşu başına tünel RMSE

| Model | Medyan (m) | P90 (m) | En kötü (m) |
|---|---|---|---|
| Sabit hız | 158.24 | 1041.42 | 1192.66 |
| İvme takibi · Kalman | 49.31 | 135.38 | 416.24 |
| Gelişmiş füzyon · IMM-EKF | 15.99 | 43.27 | 105.30 |

## Ayrı seed doğrulaması — koşu başına tünel RMSE

| Model | Medyan (m) | P90 (m) | En kötü (m) |
|---|---|---|---|
| Sabit hız | 237.08 | 1074.27 | 1157.06 |
| İvme takibi · Kalman | 36.21 | 186.87 | 780.12 |
| Gelişmiş füzyon · IMM-EKF | 20.59 | 42.83 | 161.48 |

## Sürüşe göre geliştirme referansları

| Sürüş | Sabit hız medyan RMSE | Kalman medyan RMSE | IMM-EKF medyan RMSE |
|---|---|---|---|
| steady | 25.26 m | 35.18 m | 9.93 m |
| slowdown | 266.88 m | 58.07 m | 15.88 m |
| stop | 1001.97 m | 67.95 m | 24.71 m |
| wavespeed | 52.47 m | 36.63 m | 17.98 m |

Bu tablolar tek koşuların metriklerini özetler; zaman örnekleri havuzlanmaz. Kalman her koşulda sabit hızdan iyi olmak zorunda değildir.

## Öne çıkan kontrol bulgusu

Kalman ZUPT anahtarını kapatmak 60 geliştirme duruş koşusunun hiçbirinde çıktıyı değiştirmedi. Bu koşullarda 27,099 gerçek duruş örneğinin 0 tanesi Kalman tarafından duruş olarak işaretlendi; IMM-EKF aynı örneklerin 27,027 tanesini işaretledi. Bu, Kalman duruş koşullarının bu senaryolarda tetiklenmediğini gösterir. Filtrenin sentetik düşük hız/düşük belirsizlik birim testleri geçiyor; buna rağmen mevcut fiziksel sürüşlerde ZUPT faydası gözlenmedi. Bu bulgu ayrıca incelenmeli; algoritmayı bu veri üretimi sırasında değiştirmedik.

## Kontrollerin gözlenen etkisi

Aşağıdaki sayılar, aynı seedli referanstan farklı tahmin çıktısı üreten koşu sayısıdır. Aynı çıktı, kontrolün bozuk olduğunu tek başına göstermez: olay gerçekleşmemiş veya ölçüm kapıdan geçmemiş olabilir. Kontrol testi, sonuç etkisi ve başarı ayrı değerlendirilmelidir.

| Kontrol | Seviye | Sabit hız | Kalman | IMM-EKF |
|---|---|---|---|---|
| accBiasMg | high | 0/60 | 60/60 | 60/60 |
| accBiasMg | low | 0/60 | 60/60 | 60/60 |
| cQbiasScale | high | 0/60 | 60/60 | 0/60 |
| cQbiasScale | low | 0/60 | 60/60 | 0/60 |
| cSigmaU | high | 0/60 | 60/60 | 0/60 |
| cSigmaU | low | 0/60 | 60/60 | 0/60 |
| driftScale | high | 0/60 | 60/60 | 60/60 |
| driftScale | low | 0/60 | 60/60 | 60/60 |
| driverSigma | high | 60/60 | 60/60 | 60/60 |
| driverSigma | low | 60/60 | 60/60 | 60/60 |
| gnssSigma | high | 60/60 | 60/60 | 60/60 |
| gnssSigma | low | 60/60 | 60/60 | 60/60 |
| gnssSpeedSigma | high | 60/60 | 60/60 | 60/60 |
| gnssSpeedSigma | low | 60/60 | 60/60 | 60/60 |
| headingSigma | high | 0/60 | 0/60 | 60/60 |
| headingSigma | low | 0/60 | 0/60 | 60/60 |
| length | 500 | 60/60 | 60/60 | 60/60 |
| length | 5000 | 60/60 | 60/60 | 60/60 |
| map | typical | 60/60 | 60/60 | 60/60 |
| nisGate | 10.83 | 0/60 | 0/60 | 52/60 |
| nisGate | 3.84 | 0/60 | 0/60 | 60/60 |
| noiseScale | high | 0/60 | 60/60 | 60/60 |
| noiseScale | low | 0/60 | 60/60 | 60/60 |
| phone | good | 0/60 | 60/60 | 60/60 |
| phone | poor | 0/60 | 60/60 | 60/60 |
| preTunnelLength | high | 60/60 | 60/60 | 60/60 |
| preTunnelLength | low | 60/60 | 60/60 | 60/60 |
| qbetaScale | high | 0/60 | 0/60 | 60/60 |
| qbetaScale | low | 0/60 | 0/60 | 60/60 |
| sigmaM | high | 0/60 | 0/60 | 60/60 |
| sigmaM | low | 0/60 | 0/60 | 60/60 |
| sigmaU | high | 0/60 | 0/60 | 60/60 |
| sigmaU | low | 0/60 | 0/60 | 60/60 |
| speed | 110 | 60/60 | 60/60 | 60/60 |
| speed | 30 | 60/60 | 60/60 | 60/60 |
| useCZupt | off | 0/60 | 0/60 | 0/60 |
| useM1 | off | 0/60 | 0/60 | 60/60 |
| useM5 | off | 0/60 | 0/60 | 60/60 |
| useM6 | off | 0/60 | 0/60 | 60/60 |
| useM7 | off | 0/60 | 0/60 | 60/60 |
| waveAmplitude | high | 60/60 | 60/60 | 60/60 |
| waveAmplitude | low | 60/60 | 60/60 | 60/60 |
| waveDiffusion | high | 60/60 | 60/60 | 60/60 |
| waveDiffusion | low | 60/60 | 60/60 | 60/60 |

## En belirgin eşleştirilmiş etkiler

ΔRMSE = varyant − referans. Pozitif değer hata artışıdır. Ortalamalar aynı seed/yol/profil eşleşmelerinden hesaplanır; %95 aralıklar seed kümeleriyle 2.000 bootstrap tekrarından gelir. Çoklu karşılaştırma düzeltmesi yapılmadı; bulgular keşif amaçlıdır.

### İvme takibi · Kalman

| Kontrol | Seviye | Ortalama ΔRMSE (m) | %95 aralık (m) |
|---|---|---|---|
| gnssSigma | high | +416.05 | [+307.14, +526.45] |
| speed | 30 | +324.03 | [+243.62, +412.46] |
| length | 5000 | +313.59 | [+232.78, +398.64] |
| gnssSpeedSigma | high | +197.13 | [+165.03, +225.74] |
| cQbiasScale | high | +196.36 | [+165.19, +223.35] |

### Gelişmiş füzyon · IMM-EKF

| Kontrol | Seviye | Ortalama ΔRMSE (m) | %95 aralık (m) |
|---|---|---|---|
| gnssSigma | high | +1480.38 | [+1230.19, +1723.10] |
| useM1 | off | +703.00 | [+629.96, +776.12] |
| speed | 110 | +168.07 | [+81.36, +257.62] |
| phone | poor | +101.93 | [+93.29, +109.47] |
| qbetaScale | high | +101.24 | [+92.30, +109.13] |

## Dikkat edilmesi gerekenler

- Kalibrasyon uzunluğunu değiştirmek sürüş/sensör geçmişini de değiştirir. Aynı seed, farklı uzunluklarda aynı fiziksel kayıt demek değildir. 180 saniye yeterlilik garantisi değildir; hazırlık eşikleri belirleyicidir.
- R/Q, IMU gürültüsü ve bias etkileri hazırlık kapıları nedeniyle doğrusal veya tek yönde olmak zorunda değildir.
- Kartlardaki tüm süreç tepe hatası ile tünel içi tepe hata ayrı sütunlardır.
- Toparlanma ölçüsü fiziksel çıkıştan itibaren, kayıt sonuna kadar hatanın 10 m altında kaldığı ilk örnektir. Boş değer yaklaşık 18 saniyelik çıkış sonrası pencerede sağlanmadığını belirtir; sıfır değildir.
- Birleşik stres koşulları bireysel nedenleri ayırmaz. Sentetik sonuçlar gerçek telefon doğruluğunu kanıtlamaz.
- GUI dil/oynatma ayarları sayısal motora girmez; bu tarama sayısal değişkenleri kapsar. Canlı hız komutlarının geçmişi koruma davranışı mevcut otomatik testlerde sınanır; bu veri setinde ayrı bir canlı komut taraması yoktur.

## Yeniden incelenmesi gereken en yüksek hatalı koşular

| Run ID | Model | Aşama | Yol / sürüş | RMSE (m) |
|---|---|---|---|---|
| cd12dd87665e2e7a | b | stress | straight / wavespeed | 7984.61 |
| ed384dee3e987342 | c | stress | curve / wavespeed | 7714.89 |
| 0f3bcab87502cd69 | c | stress | s / wavespeed | 7707.37 |
| cd12dd87665e2e7a | c | stress | straight / wavespeed | 7667.94 |
| 0f3bcab87502cd69 | b | stress | s / wavespeed | 7313.88 |
| 14d49557646c5f56 | b | stress | straight / wavespeed | 7125.94 |
| ed384dee3e987342 | b | stress | curve / wavespeed | 6905.54 |
| f13f8b2724ef56f1 | b | stress | straight / wavespeed | 6684.51 |
| 04591b2d0bf88d1e | b | stress | straight / wavespeed | 6425.72 |
| 591bbe2773aeede4 | b | stress | straight / wavespeed | 6179.61 |

## Dosyalar ve yeniden üretim

Kod revizyonu: `0d9d67c9492d1333405e3faa10f9d15497d4a08b`. `manifest.json` kaynak checksumlarını ve runtime sürümünü içerir; `source/` tam üretim kaynaklarını saklar. `plan.json` bütün koşulların ayarlarını içerir. `runs/<id>.json` tam hassasiyetli metrikler ve ayarlardır.

`metrics.csv`: model başına sonuçlar; `paired_comparisons.csv`: referans farkları; `aggregates.csv`: yol/sürüş grupları; `effects.csv`: etki ve aralıklar; `checks.csv`: bağımsızlık denetimleri; `control-audit.csv`: kontrol özeti.

`timeseries/*.csv.gz` 10 Hz motor çıktılarını dokuz ondalığa yuvarlanmış olarak içerir. Tam ham 100 Hz üç eksenli IMU kaydı değildir. Kalibrasyon bölümünde tahmin alanları boş bırakılır. Zaman sıfırı kalibrasyon sonudur; `elapsed_s` kalibrasyonu da içerir.

```sh
node scripts/dataset.js --out ./data/tunnel-dataset-v1 --workers 4
```
Aynı komut doğrulanmış tamamlanan koşuları atlayarak devam eder. Başka plan/kod için başka klasör gerekir.
