// Numeric experiment inputs. SI is used by the engine; speed settings are km/h.
export const PARAMETERS=[
 {key:'preTunnelLength',group:'calibration',label:'Tünel öncesi açık yol',min:250,max:6000,step:50,value:4200,unit:'m',digits:0,help:'Kalibrasyon için hızlanma ve frenleme uygulanır; son 200 m giriş yaklaşımıdır. Süre gerçek hızdan hesaplanır.'},
 {key:'waveAmplitude',group:'driver',label:'Wavespeed · aralık ±',min:0,max:35,step:1,value:15,unit:'km/h',digits:0,wave:true,help:'Başlangıç hızının çevresinde hedef hız sınırı; 10–130 km/h içinde.'},
 {key:'waveDiffusion',group:'driver',label:'Wavespeed · değişim şiddeti',min:0,max:8,step:.25,value:3,unit:'km/h/√s',digits:2,wave:true,help:'Random walk adımı σ√Δt. Büyüdükçe hedef hız daha hızlı değişir.'},
 {key:'driverSigma',group:'driver',label:'Truth · sürücü sapması σD',min:0,max:3,step:.1,value:1,unit:'m/s',digits:1,help:'Doğal hız sapması. A’nın analitik modeli σD = 1 m/s varsaymaya devam eder.'},
 {key:'noiseScale',group:'sensor',label:'IMU · beyaz gürültü σ',min:.25,max:4,step:.25,value:1,unit:'×',digits:2,help:'100 Hz ham telefon örneklerinde eksen başına beyaz gürültü standart sapması. Duruşta tüm ivmeölçer eksenleri aynı σ değerini kullanır; filtre R’si ayrı ayarlanır.'},
 {key:'accBiasMg',group:'sensor',label:'İvmeölçer · başlangıç bias σ',min:0,max:30,step:1,value:10,unit:'mg',digits:0,help:'Her telefon eksenine bağımsız sabit bias: σ = mg × 0.00981 m/s².'},
 {key:'driftScale',group:'sensor',label:'IMU · bias drift’i',min:0,max:5,step:.25,value:1,unit:'×',digits:2,help:'İvme bias’ı random walk genliğiyle büyür. Gyro bias’ı 300 s zaman sabitli Gauss–Markov sürecidir; gösterilen σ durağan dağılıma aittir. Bunlar anlık bias ölçümleri değildir.'},
 {key:'gnssSigma',group:'sensor',label:'GNSS · konum σ',min:1,max:15,step:.5,value:3,unit:'m',digits:1,help:'Açık gökyüzü, eksen başına korelasyonlu hata. Girişte 3×; yüksek hata kalite kapısını geçmeyebilir.'},
 {key:'gnssSpeedSigma',group:'sensor',label:'GNSS · Doppler hız σ',min:.05,max:1,step:.05,value:.15,unit:'m/s',digits:2,help:'Beyaz hız gürültüsü ve bildirilen hız doğruluğu; A’nın giriş hızını ve bildirilen hız belirsizliğini de etkiler.'},
 {key:'sigmaU',group:'filter',label:'Füzyon · IMU ölçüm σu',min:.03,max:.5,step:.01,value:.1,unit:'m/s²',digits:2,help:'Filtrenin varsaydığı R = σu². Küçük değer ivme ölçümüne daha çok güven verir.'},
 {key:'qbetaScale',group:'filter',label:'Füzyon · bias süreç gürültüsü qβ',min:.1,max:10,step:.1,value:1,unit:'×',digits:1,help:'Filtrenin bias süreç gürültüsü yoğunluğu. Bias kovaryansına her adımda qβ × Δt eklenir. Telefon seçimine göre güncellenir; gerçek sensör drift’inden bağımsızdır.'},
 {key:'sigmaM',group:'filter',label:'Füzyon · manevra ivmesi σa',min:.5,max:3,step:.1,value:1.5,unit:'m/s²',digits:1,help:'IMM manevra modelinin süreç belirsizliği; truth ivmesini değiştirmez.'},
 {key:'headingSigma',group:'filter',label:'Füzyon · harita yönü σψ',min:.5,max:5,step:.25,value:1.5,unit:'°',digits:2,help:'M5 ölçüm gürültüsü ve G5 belirsiz eğri kontrolünün yön toleransı.'},
 {key:'cSigmaU',group:'cfilter',label:'Kalman · IMU giriş σu',min:.03,max:.5,step:.01,value:.15,unit:'m/s²',digits:2,help:'Tek KF’nin ivme giriş belirsizliği. Füzyon modelinin ayarlarını değiştirmez.'},
 {key:'cQbiasScale',group:'cfilter',label:'Kalman · bias süreç gürültüsü qᵦ',min:.1,max:10,step:.1,value:1,unit:'×',digits:1,help:'Kalman filtresinin bias süreç gürültüsü yoğunluğu. Bias kovaryansına her adımda qᵦ × Δt eklenir. Düz tünelde yeni ölçüm yoksa bias öğrenilemez.'}
];
export const parameterDefaults=()=>Object.fromEntries(PARAMETERS.map(p=>[p.key,p.value]));
// Physical values used by World (100 Hz phone samples) and the two filters.
// Keep scale keys in stored scenarios so existing recordings remain compatible.
export function physicalParameterReadings(key,cfg){
 const quality=cfg.phone==='good'?.45:cfg.phone==='poor'?2:1;
 const noise=quality*cfg.noiseScale,drift=quality*cfg.driftScale;
 switch(key){
  case 'noiseScale':return [
   {label:'İvmeölçer X/Y · σ',value:.31*noise,unit:'m/s²',digits:3},
   {label:'İvmeölçer Z · σ',value:.11*noise,unit:'m/s²',digits:3},
   {label:'Duruşta · σ',value:.025*noise,unit:'m/s²',digits:3},
   {label:'Jiroskop · σ',value:.007*Math.sqrt(50)*noise,unit:'°/s',digits:4}
  ];
  case 'driftScale':return [
   {label:'İvme bias random walk',value:Math.sqrt(1e-7)*drift,unit:'m/s²/√s',scientific:true},
   {label:'Gyro bias · durağan σ',value:.003*drift,unit:'°/s',digits:5}
  ];
  case 'qbetaScale':return [{label:'qβ',value:(cfg.phone==='good'?5e-6:cfg.phone==='poor'?6e-5:1.5e-5)*cfg.qbetaScale,unit:'m²/s⁵',scientific:true}];
  case 'cQbiasScale':return [{label:'qᵦ',value:1.5e-5*cfg.cQbiasScale,unit:'m²/s⁵',scientific:true}];
  default:return null;
 }
}
export function validateParameters(cfg){
 for(const p of PARAMETERS)if(!Number.isFinite(cfg[p.key])||cfg[p.key]<p.min||cfg[p.key]>p.max)throw Error('Geçersiz parametre: '+p.key);
 for(const key of ['useM1','useM5','useM6','useM7','useCZupt'])if(typeof cfg[key]!=='boolean')throw Error('Geçersiz filtre seçimi');
 if(![3.84,6.63,10.83].includes(cfg.nisGate))throw Error('Geçersiz NIS kapısı');
}
