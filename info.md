# Teknik notlar ve deney ayrıntıları

README’den taşınan teknik açıklamalar. Bu dosya GitHub repo ana sayfasında otomatik gösterilmez.

## Mülakat deneyleri ve parametreler

Hız birimi seçimi **yalnızca gösterimi** değiştirir: slider çıktı metni, gerçek/kestirilen hızlar, anlık hedef ve hız grafiği birlikte km/h veya m/s olur. Motor SI kullanır; ayar/komut JSON hızları km/h, CSV birimleri sütun başlıklarında sabittir. Birim değişimi koşuyu veya seed’i değiştirmez. Teknik IMU/GNSS parametrelerinin birimleri kendi etiketlerinde sabittir.

| Grup | Kontrol | Aralık / varsayılan | Etkisi |
|---|---|---|---|
| Truth | Wavespeed aralığı | ±0–35 / 15 km/h | Merkez hız etrafındaki hedef hız sınırı |
| Truth | Wavespeed diffusion | 0–8 / 3 km/h/√s | Random walk adımlarının şiddeti |
| Truth | Sürücü σD | 0–3 / 1 m/s | Doğal Gauss–Markov sürücü sapması; A modeli σD=1 varsayar |
| Sensör | IMU beyaz gürültü | 0.25–4 / 1× | Telefon önayarı üzerine fiziksel ivme/gyro white noise |
| Sensör | Başlangıç ivme bias σ | 0–30 / 10 mg | Telefon ekseni başına bağımsız sabit bias |
| Sensör | IMU drift | 0–5 / 1× | İvme random walk ve gyro Gauss–Markov drift genliği |
| Sensör | GNSS konum σ | 1–15 / 3 m | Korelasyonlu konum hatası; girişte 3×, ayrıca mevcut beyaz hata/outlier bileşenleri var |
| Sensör | GNSS Doppler σ | 0.05–1 / 0.15 m/s | Beyaz hız gürültüsü ve bildirilen hız doğruluğu; mevcut korelasyonlu hız hatası korunur |
| B | IMU ölçüm σu | 0.03–0.50 / 0.10 m/s² | R=σu²; fiziksel sensör gürültüsünden bağımsız |
| B | qβ çarpanı | 0.1–10 / 1× | Telefon önayarı bias süreç varyansına çarpan; etkin SI değeri ekranda |
| B | Manevra ivmesi σa | 0.5–3 / 1.5 m/s² | IMM manevra modunun süreç varyansı |
| B | Harita yönü σψ | 0.5–5 / 1.5° | M5 R ve G5 belirsiz yön toleransı |
| B | NIS kapısı | 3.84 / 6.63 / 10.83 | Tek boyutlu χ² için nominal %95 / %99 / %99.9 eşikleri |
| B | M1 / M5 / M6 / M7 | Ayrı açık/kapalı | IMU, harita yönü, ZUPT ve çıkış portalı katkısını ayırma |

Bu teknik parametreler değişince başlangıç hızı ve zamanlanmış canlı hız komutları korunarak **aynı seed ile yeni koşu** oluşur; hareket halindeki hız slider’ı ise mevcut geçmişi koruyarak komut ekler. Varsayılana al butonu teknik parametreleri, NIS eşiğini ve B anahtarlarını sıfırlar; yol, telefon/harita önayarı, merkez hız ve senaryo seçimini korur. M1 elle kapatıldığında kalibrasyon boyunca da kullanılmaz. Açık olsa bile readiness sağlanmazsa devre dışı kalır. M1 kapalıyken B’nin manevra modu kapanır; seyir + seçili kalan güncellemeler devam eder. Truth, sensörler ve B ayarları birbirinden ayrı tutulur. A kendi GNSS giriş hızı, konum güncelleme aralığı, portal ve üç tutarlı fix toparlanma durumunu tutar; B ayarlarının A sonucuna etkisi yoktur. A’nın giriş hız belirsizliği GNSS’in bildirdiği Doppler σ’dan alınır. G8 sonrası B hız kovaryansı da bildirilen Doppler doğruluğunu kullanır.

### Wavespeed matematiği

Bu senaryo sinüs değil, **yansıtmalı sınırlı Brownian random walk hedef hızı**dır. Her 0.1 s çerçevede:

```text
lo = max(10, merkez_hız - aralık)          [km/h]
hi = min(130, merkez_hız + aralık)         [km/h]
proposal = hedef + diffusion * sqrt(0.1) * N(0,1)
hedef_next = reflect(proposal, lo, hi)
```

Yansıtma iki sınıra uygulanır; clamp gibi sınırda birikme yaratmaz. Aralık=0 veya diffusion=0 hedefi sabit tutar; fiziksel araçta ayrıca σD ile kontrol edilen doğal sürücü sapması olabilir. Gerçek hız bu hedefe 1 kHz kontrolör, nominal +1 / −1.5 m/s² ve jerk ≤2 m/s³ ile yaklaşır. Mevcut sürücü sapması da kontrol ivmesine eklendiğinden +1/−1.5 değerleri mutlak ivme limitleri değildir; jerk sınırı korunur. Random walk için seed+66 bağımsız RNG kullanılır, 180 s kalibrasyon sırasında tüketilmez. Manuel hız komutu kalan Wavespeed profilini geçersiz kılar. Hedefin alt sınırı 10 km/h olduğundan Wavespeed kendi başına tam duruş senaryosu değildir; duruş için mevcut Dur / bekle / devam et seçilir.

### Konuşulacak deneyler

1. Wavespeed aralığını ±25 km/h, diffusion’u 5 yapın; aynı seed ile A/B/C hatalarını ve B manevra olasılığını karşılaştırın.
2. Aynı koşuyu S ve düz tünelde çalıştırın; M5’i kapatarak harita yönünün katkısını ayırın.
3. Truth drift’ini yükseltin, qβ’yı sabit bırakın; sonra sadece qβ’yı değiştirin. Model ile gerçek sensör uyuşmazlığını ve belirsizlik kapsamını tartışın.
4. IMU gürültüsünü yükseltip σu’yu düşük bırakın; sonra σu’yu artırın. Her değişimde aynı seed’i koruyun.
5. Durma senaryosunda M6’yı kapatın; sıfır hız güncellemesinin katkısını gösterin.
6. GNSS konum σ’sını yükseltin ve NIS kapısını değiştirin. Kalite kapısı / NIS reddi ve readiness fallback’i inceleyin. Yüksek GNSS hatası tüm fix’lerin reddedilmesine yol açabilir; bu bilerek görünür bırakılan bir başarısızlık durumudur.

## Kaynak ve denklemler

Kullanıcının verdiği `Through-the-Tunnel_solution.pdf`, Version 1.0, 8 October 2026 ve `Sr. R&D Engineer, Positioning - Case Study (2).pdf` esas alındı. PDF’ler bu arşivde dağıtılmıyor. Son kullanıcı talebi nedeniyle PDF A4’teki iç çıkış ve §2.4.8 dallanma mekanizması kapsam dışıdır; DP/çıkış prompt’u da yoktur.

### Truth ve yol

- `road.js`: 1 m arc-length örnekleri. Parçalı doğrusal curvature (clothoid), sabit eğrilikli arc ve doğrular. Giriş/çıkışta κ=0 ve teğet süreklidir. S iki zıt işaretli curvature lobudur; dış yol tünelin teğetinden devam eder.
- `world.js`: truth 1 kHz, IMU 100 Hz. Longitudinal jerk sınırı 2 m/s³, nominal frenleme 1.5 m/s² ve hızlanma 1 m/s². Hedef hız kontrolüne §4.3’teki `d_dot = a_D - d/60`, `tau_a=3 s`, `sigma_aD=1/sqrt(3*60)` sürücü sapması eklenir. Hız kontrolörü bu yumuşak hedefi yaklaşık 2 s zaman sabitiyle izler; bu nedenle §6.2’nin idealize sürücü limitinin birebir Monte Carlo kopyası değildir.
- Şerit içi salınım: 8 s doğal periyot, damping 0.7, nominal sigma 0.25 m. Süspansiyon pitch’i 0.2°/(m/s²). Sabit telefon montajı üç boyutlu dönüşle modellenir. Vektör sensörlerine ayrı turn-on bias, random walk/Gauss–Markov drift, titreşim/white noise, quantization, clipping ve Earth rotation eklenir.
- İdeal harita varsayılan. Tipik harita 0.3% ölçek hatası, 10 m portal hatası ve 100 m düğümlü yumuşak cross-track hatası içerir. Truth ve map ayrı fonksiyonlardır.
- Her stokastik bileşenin ayrı seeded RNG stream’i vardır. UI’daki seed değiştirme butonunun seçimi dışında Math.random kullanılmaz.

### Sensör duvarı / kalibrasyon

`Estimators` yalnızca map, ölçüm geçmişinden gelen initial state ve sensör mesajları alır. World veya truth referansı almaz. Truth yalnızca ölçüm üretiminde ve sonrasında hata değerlendirmesinde kullanılır. Önce 180 s GNSS’li açık yol simüle edilir. Ön montaj eksenleri GNSS hız farkları ve ortalama ivmeölçer vektörleriyle öğrenilir (PDF §2.2.3); pitch-rate bias ortalama straight-road gyro’dan Earth rotation çıkarılarak elde edilir. Bu 180 s’nin tamamı görünür koşudan öncedir, ileriye ait truth bilgisi kullanılmaz. Aynı kayıt B’ye kalibre eksenlerle tekrar oynatılarak β ve heading error/bias kovaryansları yakınsatılır. Bu, PDF’teki sürekli online eksen öğreniminin daha küçük bir offline başlangıç uyarlamasıdır.

`Preprocessor`: Eq 2.1–2.2, `u = xhat·f_phone − g Δtheta_gyro` ve raw heading-rate integration. 10 örnek ortalaması 10 Hz filtreye girer. Standstill istatistikleri 100 ham örnekten elde edilir; gerçek hız/ivme bayrağı kullanılmaz.

### A

Eq 2.3 öncesindeki baseline: `s_next = s + v0*dt`; v0, son üç accepted GNSS Doppler hızının ortalaması. Tünelde IMU veya curve update yoktur. Sigma, Eq 6.2:

```text
var_A(t) = sigma_s0² + sigma_v0² t²
 + sigma_D² tau_D [2t − 3tau_D + 4tau_D exp(−t/tau_D) − tau_D exp(−2t/tau_D)]
 + sigma_D² [t − tau_D(1−exp(−t/tau_D))]²
```

Bu model planlı frenleme veya durmanın belirsizliğini içermez. A’nın gerçek hatasının sigma’yı aşması bu senaryolarda beklenir.

### B

`estimator.js`: `x=[s,v,a,beta,epsilon_psi,b_psi]`, iki 6×6 kovaryanslı gerçek IMM-EKF. PDF Eq 2.4:

```text
F = [[1,dt,.5dt²,0,0,0], [0,1,dt,0,0,0], [0,0,phi,0,0,0],
     [0,0,0,1,0,0], [0,0,0,0,1,dt], [0,0,0,0,0,1]]
phi = exp(-dt/tau)
Q = diag(0,0,sigma_a²(1-phi²),q_beta dt,N_g² dt,q_b dt)
```

Cruise tau=3 s, sigma_a²=qdrv/(2tau), qdrv=.0333333. Manoeuvre tau=4 s, sigma_a=1.5 m/s². qbeta tabanı tipik=1.5e-5, iyi=5e-6, gürültülü=6e-5; deney çarpanıyla ölçeklenir. Ng=.007°/s/sqrt(Hz), qb=(.003°/s)²/300. Eq 2.8’deki satırları toplamı 1 olan geçiş matrisi, TC=30 s ve TM=6 s. Eq 2.9–2.13 mixing, prediction, scalar measurements, log-domain likelihood ve combination; Joseph covariance update. Negatif hızlar sıfıra projekte edilir.

- M1: u=a+beta, R=σu², varsayılan .1²; gated değildir.
- M2: GNSS projection, R=6 max(accuracy,3)², açık gökyüzünde 10 s’de bir; recovery’de hemen, alpha=1.
- M3: Doppler speed, R=2 max(sigma_v,.1)², 1 Hz.
- M4: gyro heading minus GNSS course, heading-error state correction.
- M5: gyro heading vs psi_map(s)+epsilon, H=[kappa,0,0,0,1,0], R=σψ², varsayılan (1.5°)²; 100 m aralık. G5, geniş ve nonmonotonic heading aralığında S güncellemesini atlar.
- M6: v=0,a=0,bpsi=omega; raw vector statistics ve `vhat − 2sigma_v < 2` koşulu; hysteresis. Truth standstill bayrağı yoktur.
- M7: sky-return portal, `z=s_out`, `h=s−1.8v`, `R=10²+vhat²*1.1²`, G1 ve yakın portal koşulu.
- G1 NIS varsayılan ≤6.63; kontrol ile 3.84/10.83 seçilebilir; bir modun reddi iki modda da ölçümü reddeder. GNSS accuracy/satellite/cross-track quality gate ve G8 tutarlı üç reddedilmiş fix ile global reinitialization.
- Başlangıç readiness koşulları sağlanmazsa M1 kapatılır, cruise persistence qdrv=.27 ve ZUPT/harita yönü ile devam edilir.
- 0.3 s gecikmeli GNSS, 10 s ring buffer’da validity-time’a uygulanıp ileri tekrar oynatılır. Ekranda geçmiş çizilmez; yalnızca güncel kestirim düzelir.
- GNSS cuttings, complete blackout, lognormal tracking/fix lag ve ilk üç noisy fix modellenir. Dört phase: open / degraded / tunnel / recovery.
- Map ikonları Eq 2.16 ile yumuşatılır; ham state’e göre grafik ve metrik hesaplanır. ±2sigma bandı B’nin ham state’ini temsil eder.

### C · 1D IMU + tek Kalman filtresi

`simple-kf.js`: bağımsız doğrusal KF, `x=[s,v,b]`. A/B kodu ve sonuçları korunur. Ortak montaj kalibrasyonu yalnız geçmişteki ham IMU/GNSS’ten gelir. C kendi `Preprocessor`, kovaryans, GNSS geçmişi, readiness ve 0.3 s GNSS gecikme/replay tamponunu tutar. B’nin durumunu, beta’sını veya ayarlarını okumaz. C’ye truth hızı/konumu, sürücü hedefi, stop bayrağı veya çıkış zamanı verilmez.

```text
s_next = s + v dt + 0.5 (u - b) dt²
v_next = v + (u - b) dt
b_next = b + random_walk
F = [[1,dt,-0.5dt²], [0,1,-dt], [0,0,1]]
G = [0.5dt², dt, 0]ᵀ
Q_acc = sigma_u² G Gᵀ
Q_bias = q_b [[dt⁵/20,dt⁴/8,-dt³/6],
              [dt⁴/8,dt³/3,-dt²/2],
              [-dt³/6,-dt²/2,dt]]
```

10 Hz; varsayılan σu=0.15 m/s², q_b=1.5e-5 m²/s⁵. İvme giriş belirsizliği, 0.1 s aralığındaki ortalama ivmenin standart sapmasıdır. Bias random walk kovaryansı sürekli modelin tam integrali ve çapraz terimleriyle kullanılır. Joseph ölçüm güncellemesi; ileri sürüş sınırında negatif hız ve geriye konum artışı sıfıra projekte edilir. Bu sınır, tespit edilmiş duruş anlamına gelmez. Kovaryans bu sınırda yeniden daraltılmaz.

180 s açık gökyüzü kaydı GNSS hızıyla bias’ı öğrenir. Giriş readiness: σv≤0.3 m/s, σb≤0.03 m/s² ve en az 20 qualifying kalibrasyon örneği. Sağlanmazsa IMU kapalı kıyı modeli ve daha geniş süreç belirsizliğiyle devam eder; sonraki fix tek başına IMU’yu yeniden açmaz. Bias’ı durum olarak tutmak, yardımsız tünelde onu gözleyebilmek anlamına gelmez.

- GNSS hız: 1 Hz, R=2 max(0.1, speedAccuracy)². GNSS konum: açık gökyüzünde 10 s’de bir, R=6 max(accuracy,3)²; recovery’de her fix, α=1. NIS sabit 6.63; B NIS kontrolünden bağımsızdır.
- GNSS kalite kontrolleri: açıkta accuracy≤20 m, degraded≤10 m, recovery≤15 m; sat≥6; cross-track≤max(3 accuracy,10). Üç tutarlı reddedilmiş recovery fix’i global yeniden başlatabilir. Bu ölçüm/GNSS mekanizması C’ye aittir.
- İsteğe bağlı ZUPT: en az 5 ardışık 10 Hz karede tf<0.08 m/s², tw<0.3°/s, tahmini v<0.5 m/s ve σv<0.5 m/s. Ölçüm v=0, R=0.05². Yeni hareket, ivme veya gyro artışı duruşu sonlandırır. Sezici muhafazakârdır: bias/hız kayması büyüyünce gerçek duruş kaçabilir. Sakin IMU, sabit hızlı hareketi tek başına duruştan ayıramaz.
- IMM, heading/curvature ölçümü ve portal düzeltmesi yoktur. Harita yalnız along-track koordinatı ekrana taşır ve GNSS’i rotaya izdüşürür. Yol üstünde görünmek boyuna hatayı düzeltmez.
- İki ayrı slider: `cSigmaU` (0.03–0.5 m/s²), `cQbiasScale` (0.1–10×). `useCZupt` yalnız C’yi etkiler. Birim seçimi, harita/legend, grafikler, canlı hız komutları, özet ve CSV/JSON C’yi içerir.

Sabit kalıntı ivme sapması `delta_s≈0.5 b t²` büyür. C’nin A’dan her koşulda iyi olması beklenmez; uzun sabit hızlı tünelde A daha iyi olabilir. Varsayılan dur-kalk kaydında C’nin muhafazakâr ZUPT’yi kaçırması ve hatanın büyümesi görünür bir sınırlamadır. Daha büyük q_b ölçüm yerine geçmez. Ortak ön işlemdeki tutum/pitch hataları da C’nin bu basit bias modeliyle tamamen giderilmez. ±2σ koşullu model belirsizliğidir, bütün model hatalarını kapsama garantisi değildir.

## Bilinçli sınırlar

Bu ilk sürüm yatay 2-D road geometry, sabit tutucu ve phone-only ölçümlere odaklanır. Adaptif qdrv/qbeta/innovation learning, tam online 2-state pitch-bias learner, mount knock monitor, gerçek platform API emülasyonu, sensor clock jitter/dropouts, detaylı thermal drift, height/grade profile, barometre, beacon, vehicle speed, traffic IDM, Monte Carlo UI, branch logic ve callout scheduler dahil değildir. Veri indirme ekranında single-run sonuçlar açıkça belirtilir; istatistiksel timing/recovery başarı iddiası yapılmaz. Özellikle uzun düz yolda slow speed drift ve bias ayrılamaz; coverage tek bir koşuda dürüst kovaryans kanıtı değildir.

## Doğrulama

23 sayısal test: Eq 6.2 bilinen sayılar, IMM propagation ve Markov normalization, Joseph symmetry/PSD, ortak NIS gate, portal heading/curvature continuity, 1 m arc length, G5 ambiguous S rejection, bit-for-bit seed replay, canlı hız komutundan önceki tüm örneklerin birebir korunması, jerk ile sürekli hız tepkisi, sensör üzerinden frenleme takibi, otomatik profilin manuel komutla değiştirilmesi, geçersiz komutların reddi, sensor-based standstill ve 500/5000 m × 3 yol × 3 sürüş profili sayısal sağlamlığı. Ek kontroller: Wavespeed determinism/sınırlar/jerk, sıfır aralık limiti, canlı komutla geçmişin korunması, tüm B ayarlarından truth ve A’nın bağımsızlığı, dört güncellemenin ayrı ablation testi, tüm teknik parametrelerin iki uç değerinde sonlu hesaplama ve 5 km düşük hızlı/gürültülü stres senaryosu. Tarayıcıda yalnızca masaüstü: Wavespeed, slider değişimleri, M1 anahtarı, birim dönüşümü, playback, scrub ve tek dosya Worker kontrol edilir.

C doğrulaması: sabit ivme ve b·t² hatası, GNSS’ten bias öğrenme, Joseph PSD, snapshot/replay, muhafazakâr ZUPT/kapama, kötü GNSS reddi ve tutarlı recovery, tüm yol/profillerde sonluluk, C↔B ayar bağımsızlığı ve yedi C öncesi koşunun SHA-256 referansıyla Truth/A/B örneklerinin ve özetlerinin birebir korunması. Eski referanslar `tests/fixtures/legacy-results.json` içindedir.

## Dosyalar

`dist/` deploy edilebilir statik uygulama; `tests/` sayısal kontroller. Build framework veya üçüncü parti simülasyon/filtre kütüphanesi kullanılmaz. Sayısal çekirdek UI’dan bağımsızdır ve Node ile headless kullanılabilir.

## AI kullanımı

Bu uygulama Codex ile, kullanıcının sağladığı çözüm belgesinden üretildi. Kapsamı kullanıcı tek şerit, çatalsız üç geometri ve A/B olarak daralttı; sonrasında bağımsız bir C (1D IMU + tek KF) istedi. Uygulamada GNSS gecikmesi replay, ölçüm kapıları ve truth/sensor ayrımı özellikle doğrulandı. Sadeleştirmeler yukarıda açıkça listelenmiştir; gerçek telefon verisiyle kalibrasyon ve consistency doğrulaması yapılmamıştır.

## Interface language

English is the default. Use the EN / TR selector at the top to switch languages without resetting the current simulation or settings. Turkish text is preserved. JSON exports include the selected display language.

## Adjustable calibration road

The pre-tunnel open-road slider spans 250–6,000 m (default 4,200 m). The final 200 m is the entrance approach; the preceding physical drive replaces the fixed hidden 180 s warm-up. At default speed and seed it records about 181 s of GNSS/IMU data with acceleration and braking for excitation. Actual duration depends on speed and driver motion. Readiness uses the existing covariance and excitation checks, not a duration threshold; longer calibration does not guarantee smaller tunnel errors.

Calibration playback shows ground truth only. Filters initialise by replaying the completed calibration recording; no retrospectively calibrated estimates are shown as online results during that recording. Skip calibration jumps playback forward without removing training data. Insufficient calibration disables fusion M1 and Kalman IMU input. Summary errors still cover only the tunnel. CSV time zero remains the end of the calibration recording; displayed elapsed time also includes calibration. During calibration, changing target speed starts a new run. The original seven numerical references are checked at their equivalent 180 s approach distances.

Each estimate card shows Peak |error|: the largest absolute along-track error since estimation began, up to the current playback time (including open-road approach and recovery). Rewinding restores the historical peak; calibration has no estimate and displays a dash. The run summary remains tunnel-only.

Calibration playback automatically runs at 128×, then restores the selected normal playback rate at the calibration boundary. This changes presentation timing only; every physical sensor sample and filter update is still computed.

## Headless dataset generation (v2)

Requires Node.js 24 and no npm dependencies. Run from the repository root:

```sh
node scripts/dataset.js --out ./data/tunnel-dataset-v2 --workers 4
```

The event-free plan has **12,900 unique runs**, each configuration repeated with **50 distinct paired seeds (1001-1050)**:

- 300 references: 2 base drives (Cruise = `steady`, Wavespeed) × 3 roads × 50 seeds.
- 600 calibration-length variants, analysed separately.
- 7,800 other numeric low/high variants. Wave range/diffusion are only applicable to Wavespeed.
- 1,500 switch-off variants. Stop switches here are event-free negative controls.
- 2,700 phone/map/NIS/speed/tunnel-length variants.

Each variant changes one setting and points to its own **same road / base drive / seed** reference. Default levels reuse the reference rather than compute duplicates. There are no planned slowdown/stop profiles or combined stress cases in this first stage. Natural Cruise speed variation and Wavespeed dynamics remain unchanged. The existing calibration excitation protocol is fixed; changing target speed also changes the actual calibration duration. Controlled braking and stop-event parameterisation is a later stage, not implemented or included in these data.

Results are always stratified by road **and** base drive; no pooled “best model” score is produced. `aggregates.csv` includes median/P90 RMSE, tunnel peak, readiness fraction, and ready-only errors. `effects.csv` adds absolute baseline/variant results, seed-paired differences, 2,000-resample bootstrap mean-difference intervals and paired-both-ready diagnostics. Unready runs remain in the principal metrics. Ready subsets are diagnostic and may be selected differently; they are not a causal comparison by themselves. These 50 seeds are an exploratory study, not a held-out validation claim.

Filter-only pairs verify identical raw recordings via SHA-256 over **every quantised 100 Hz three-axis IMU sample and every GNSS message**, including calibration. Observer hooks are passive and do not change vehicle or filter computations. Model-dependent preprocessing can yield different derived `u` despite identical raw sensor recordings; sensor, driving and calibration changes are matched-seed scenarios and need not share the recording. Raw 100 Hz samples are hashed, not stored; compressed time series retain the existing 10 Hz derived fields.

Open `results.html` for the portable Turkish report. Its profile, road, model and parameter selectors show each group's own reference. `REPORT.md` contains the full separated tables, caveats and terminology. `plan.json` stores actual parameter values; per-run JSON stores full-precision metrics, raw-recording hashes and time-series checksums. Source snapshots and `checksums.sha256` support reproduction. GUI playback is bypassed; simulation error uses the filter estimate, not the smoothed screen marker.

Repeat the same command to resume. Completed runs are verified by SHA-256; failed/corrupt runs are retried. A different plan or code version requires a new directory. Smoke tests use a separate `--limit 2` directory. `--report-only` regenerates reports after integrity checks. Do not reuse v1's output directory; old raw data and archived reports remain intact. `scripts/dataset-summary.py` is v1-only; v2 reports are built by the runner automatically.

Data are synthetic and excluded from Git. They do not prove real-phone accuracy or cover every parameter interaction.
