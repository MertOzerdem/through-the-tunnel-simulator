// Numeric experiment inputs. SI is used by the engine; speed settings are km/h.
export const PARAMETERS=[
 {key:'waveAmplitude',group:'driver',label:'Wavespeed · aralık ±',min:0,max:35,step:1,value:15,unit:'km/h',digits:0,wave:true,help:'Başlangıç hızının çevresinde hedef hız sınırı; 10–130 km/h içinde.'},
 {key:'waveDiffusion',group:'driver',label:'Wavespeed · değişim şiddeti',min:0,max:8,step:.25,value:3,unit:'km/h/√s',digits:2,wave:true,help:'Random walk adımı σ√Δt. Büyüdükçe hedef hız daha hızlı değişir.'},
 {key:'driverSigma',group:'driver',label:'Truth · sürücü sapması σD',min:0,max:3,step:.1,value:1,unit:'m/s',digits:1,help:'Doğal hız sapması. A’nın analitik modeli σD = 1 m/s varsaymaya devam eder.'},
 {key:'noiseScale',group:'sensor',label:'IMU · beyaz gürültü',min:.25,max:4,step:.25,value:1,unit:'×',digits:2,help:'Telefon önayarının ivmeölçer ve gyro gürültüsünü çarpar; Füzyon modelinin R değerini değiştirmez.'},
 {key:'accBiasMg',group:'sensor',label:'İvmeölçer · başlangıç bias σ',min:0,max:30,step:1,value:10,unit:'mg',digits:0,help:'Her telefon eksenine bağımsız sabit bias: σ = mg × 0.00981 m/s².'},
 {key:'driftScale',group:'sensor',label:'IMU · drift şiddeti',min:0,max:5,step:.25,value:1,unit:'×',digits:2,help:'Bias drift genliğini çarpar; Füzyon modelinin qβ değerini değiştirmez.'},
 {key:'gnssSigma',group:'sensor',label:'GNSS · konum σ',min:1,max:15,step:.5,value:3,unit:'m',digits:1,help:'Açık gökyüzü, eksen başına korelasyonlu hata. Girişte 3×; yüksek hata kalite kapısını geçmeyebilir.'},
 {key:'gnssSpeedSigma',group:'sensor',label:'GNSS · Doppler hız σ',min:.05,max:1,step:.05,value:.15,unit:'m/s',digits:2,help:'Beyaz hız gürültüsü ve bildirilen hız doğruluğu; A’nın giriş hızını ve bildirilen hız belirsizliğini de etkiler.'},
 {key:'sigmaU',group:'filter',label:'Füzyon · IMU ölçüm σu',min:.03,max:.5,step:.01,value:.1,unit:'m/s²',digits:2,help:'Filtrenin varsaydığı R = σu². Küçük değer ivme ölçümüne daha çok güven verir.'},
 {key:'qbetaScale',group:'filter',label:'Füzyon · qβ çarpanı',min:.1,max:10,step:.1,value:1,unit:'×',digits:1,help:'Telefon önayarının bias süreç gürültüsünü çarpar. Truth drift’inden bağımsızdır.'},
 {key:'sigmaM',group:'filter',label:'Füzyon · manevra ivmesi σa',min:.5,max:3,step:.1,value:1.5,unit:'m/s²',digits:1,help:'IMM manevra modelinin süreç belirsizliği; truth ivmesini değiştirmez.'},
 {key:'headingSigma',group:'filter',label:'Füzyon · harita yönü σψ',min:.5,max:5,step:.25,value:1.5,unit:'°',digits:2,help:'M5 ölçüm gürültüsü ve G5 belirsiz eğri kontrolünün yön toleransı.'},
 {key:'cSigmaU',group:'cfilter',label:'Kalman · IMU giriş σu',min:.03,max:.5,step:.01,value:.15,unit:'m/s²',digits:2,help:'Tek KF’nin ivme giriş belirsizliği. Füzyon modelinin ayarlarını değiştirmez.'},
 {key:'cQbiasScale',group:'cfilter',label:'Kalman · bias süreç çarpanı',min:.1,max:10,step:.1,value:1,unit:'×',digits:1,help:'qᵦ = 1.5e−5 × çarpan m²/s⁵. Düz tünelde yeni ölçüm yoksa bias öğrenilemez.'}
];
export const parameterDefaults=()=>Object.fromEntries(PARAMETERS.map(p=>[p.key,p.value]));
export function validateParameters(cfg){
 for(const p of PARAMETERS)if(!Number.isFinite(cfg[p.key])||cfg[p.key]<p.min||cfg[p.key]>p.max)throw Error('Geçersiz parametre: '+p.key);
 for(const key of ['useM1','useM5','useM6','useM7','useCZupt'])if(typeof cfg[key]!=='boolean')throw Error('Geçersiz filtre seçimi');
 if(![3.84,6.63,10.83].includes(cfg.nisGate))throw Error('Geçersiz NIS kapısı');
}
