# Through the Tunnel · Simulation Lab

Tarayıcıda çalışan, bağımlılıksız ilk sürüm. Tek araç / tek şerit / çatalsız yol. Üç geometri: düz, tek viraj ve S. Truth, Approach A, Approach B ve Approach C uygulanır. PDF’teki tüm platform/altyapı modüllerinin eksiksiz uygulaması değildir; kapsam tek şeritli ve çatalsız yolda konum kestirimidir; iç çıkış bildirimi dahil değildir.

## Canlı demo

**[Simülatörü tarayıcıda aç](https://mertozerdem.github.io/through-the-tunnel-simulator/)** — kurulum gerektirmez.

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
