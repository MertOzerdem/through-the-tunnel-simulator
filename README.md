# Through the Tunnel · Simulation Lab

Tarayıcıda çalışan, bağımlılıksız ilk sürüm. Tek araç / tek şerit / çatalsız yol. Üç geometri: düz, tek viraj ve S. Truth, Approach A, Approach B ve Approach C uygulanır. PDF’teki tüm platform/altyapı modüllerinin eksiksiz uygulaması değildir; aşağıdaki sınırlar bilinçli olarak açık tutulmuştur.

## Çalıştırma

`Tunnel-Simulator.html` tek dosyalık sürümünü doğrudan modern bir tarayıcıda açabilirsiniz. İçerik ve hesaplama Worker’ı dosyaya gömülüdür; sunucu veya kurulum gerekmez. Modüler geliştirme sürümü için aşağıdaki adımları kullanın.

Python 3 ile proje dizininde:

```sh
python3 -m http.server 4173 --directory dist
```

http://localhost:4173 adresini açın. ES modülleri ve Worker nedeniyle index.html dosyasını file:// ile açmayın. Kurulum veya build adımı yoktur. Yazı tipleri Google Fonts’tan isteğe bağlı yüklenir; ağ yoksa sistem yazı tipleri kullanılır.

Testler Node.js 18+ ile:

```sh
node --test tests/*.test.js
```

## Görünen model adları

Arayüzde gösterim sırası: Gerçek araç → Sabit hız (A) → İvme takibi · Kalman (C) → Gelişmiş sensör füzyonu · IMM-EKF (B). Kartlar, grafik çizim sırası, legend ve özet aynı sıradadır. Sayısal motor, renkler ve A/B/C veri anahtarları korunur; CSV sütunları A/C/B sırasındadır, JSON model adlarını ve sırasını ayrıca taşır. Sıra karmaşıklık artışını anlatır; her koşuda aynı hata sıralamasını garanti etmez.

## Kullanım

Masaüstü uygulamasıdır (minimum yerleşim genişliği 1120 px). Mobil optimizasyon yapılmaz. Hız ve tünel uzunluğu slider’ları üstteki “Deneme kontrolleri” panelindedir; panel sayfayla birlikte kayar.

- **Hedef hız, 30–110 km/h:** Başlangıçta seçildiğinde yeni koşunun seyir hızını belirler. Zaman ilerledikten sonra değiştirilirse mevcut konum ve geçmiş korunur; araç jerk/ivme sınırlarıyla yavaşlar veya hızlanır. Gerçek hız hedefin yanında gösterilir. Canlı komut, o andan sonraki otomatik yavaşlama/durma profilinin yerini alır.
- **Tünel uzunluğu, 500–5000 m:** Geometriyi yeniden ölçekler; aynı seed ve slider’da seçili hızla zaman sıfırdan başlayan yeni koşu üretir. Yol tipi ve sürüş profili değişiklikleri de hız komutlarını temizleyerek yeni koşu üretir. Telefon, harita, seed ve teknik parametre değişiklikleri başlangıç hızı ve zamanlanmış canlı hız komutlarını koruyarak aynı deneyin yeni koşusunu üretir.
- **Yeni koşu:** Canlı komutları siler, seçili hız ve otomatik sürüş profiliyle başa döner. **Başa dön (↺):** Aynı kaydı, canlı hız komutları dahil, yeniden izlemek içindir.

Başlat/Duraklat, 1×–32× oynatma ve zaman çizelgesinden geri/ileri inceleme desteklenir. Hız komutu oynatma sırasında verildiyse hesaplama tamamlanınca oynatma kaldığı andan devam eder; duraklatılmışken verildiyse duraklatılmış kalır. Geçmiş bir ana dönüp yeni hız verilirse bu andaki ve daha sonraki eski komutlar değiştirilir. Ek parametreler soldaki Sürücü / Wavespeed, Gerçek sensör parametreleri ve B · filtre varsayımları gruplarındadır. Aracı izle görünümü truth aracı takip eder. Legend üzerinden araçlar ve grafik çizgileri gizlenebilir.

Hız değişiklikleri `{at: saniye, speed: km/h}` olayları olarak tutulur. Web Worker aynı başlangıç, seed ve önceki komutlarla koşuyu yeniden hesaplar; yeni komut bir sonraki 10 Hz çerçevesinde uygulanır. Bu, görünür geçmişi değiştirmeden canlı müdahaleyi mümkün kılar. Hedef hız yalnızca truth sürücü kontrolörüne verilir; A/B bu komutu veya truth konumunu almaz. Filtreler değişimi fiziksel sensör/GNSS kayıtlarından takip eder. Kalibrasyon geçmişi de değişmez. Slider değişikliğinde kısa bir hesaplama beklemesi olabilir.

Grafiklerde dikey kesikli çizgiler canlı komut zamanlarını, hız grafiğindeki gri kesikli çizgi hedef hızı gösterir. Koşu özeti bütün tünel geçişine ait RMSE, en büyük hata, ±50 m içinde kalma ve raporlanan ±2σ kapsamını verir; canlı komut zamanlarını da listeler. CSV ham kestirim, sensör kanalları, `truth_a_mps2` ve `target_speed_kmh` sütunlarını içerir; senaryo JSON’u komutlar dahil ayarları ve özeti saklar.

**Mülakat için kısa deneme:** Seyir profilinde 80 km/h ve 2 km seçin. Tünelde 30. saniyeye gelin; hedefi 40 km/h yapın. Yaklaşık 20 s sonra A’nın eski hızda ilerlemesini, B’nin frenlemeyi sensörlerden izlemesini tartışın. Sonra hedefi 100 km/h yapıp manevra olasılığını inceleyin. Aynı denemeyi 5 km düz tünelde ve S tünelde, aynı seed ile karşılaştırın.

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
