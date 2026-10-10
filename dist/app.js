import {translate,locale,language,initLanguage} from './i18n.js';
import {PARAMETERS} from './parameters.js';
import {CONFIG} from './simulation.js';
const $=id=>document.getElementById(id),colors={truth:'#219874',a:'#cf8b28',b:'#7765cf',c:'#287fa6'},names={s:'S biçimli tünel',curve:'Tek virajlı tünel',straight:'Düz tünel'};
const modelOrder=['a','c','b'],modelNames={a:'Sabit hız',c:'İvme takibi · Kalman',b:'Gelişmiş sensör füzyonu · IMM-EKF'};
let speedUnit='km/h';
let playbackRows=[];
const playRows=()=>playbackRows;
const playTime=t=>t+(data?.calibration.seconds??0);
let cfg={...CONFIG},data=null,index=0,playing=false,last=0,carry=0,chase=false,worker=null,debounce=null,toastTimer=null,liveContext=null;
const time=t=>`${Math.floor(t/60).toString().padStart(2,'0')}:${Math.floor(t%60).toString().padStart(2,'0')}`;
const number=(v,n=1)=>v.toLocaleString(locale(),{minimumFractionDigits:n,maximumFractionDigits:n});
const speedScale=()=>speedUnit==='m/s'?1:3.6;
const speedText=kmh=>number(kmh/3.6*speedScale(),speedUnit==='m/s'?1:0)+' '+speedUnit;
function syncParameters(){
 for(const p of PARAMETERS){const el=$(p.key);el.value=cfg[p.key];el.disabled=!!p.wave&&cfg.profile!=='wavespeed';fillRange(el);$(p.key+'Value').textContent=number(cfg[p.key],p.digits)+' '+p.unit;}
 for(const key of ['useM1','useM5','useM6','useM7','useCZupt'])$(key).checked=cfg[key];$('nisGate').value=cfg.nisGate;
 const q=(cfg.phone==='good'?5e-6:cfg.phone==='poor'?6e-5:1.5e-5)*cfg.qbetaScale;
 $('qbetaValue').textContent='Etkin qβ = '+q.toExponential(2)+' m²/s⁵';
}
function setupParameters(){
 const groups=[['calibration','Tünel öncesi kalibrasyon'],['driver','Sürücü / Wavespeed'],['sensor','Gerçek sensör parametreleri'],['cfilter','İvme takibi · Kalman'],['filter','Gelişmiş sensör füzyonu · IMM-EKF']];
 $('parameterGroups').innerHTML=groups.map(([group,label])=>`<details class="advanced parameterGroup" id="${group}Parameters" ${group==='calibration'?'open':''}><summary>${label}<span>+</span></summary><div class="advancedbody">${PARAMETERS.filter(p=>p.group===group).map(p=>`<div class="rangefield"><label for="${p.key}">${p.label}<output id="${p.key}Value"></output></label><input type="range" id="${p.key}" min="${p.min}" max="${p.max}" step="${p.step}" value="${p.value}" aria-describedby="${p.key}Help"><p class="parameterHelp" id="${p.key}Help">${p.help}</p></div>`).join('')}${group==='calibration'?'<p id="calibrationInfo" class="parameterHelp"></p><button id="skipCalibration" class="textbutton">Kalibrasyonu geç →</button>':''}${group==='filter'?`<p id="qbetaValue" class="parameterHelp"></p><label class="fieldlabel" for="nisGate">Füzyon · NIS kapısı</label><select id="nisGate"><option value="3.84">95% · 3.84 (sıkı)</option><option value="6.63" selected>99% · 6.63</option><option value="10.83">99.9% · 10.83 (gevşek)</option></select><p class="parameterHelp">Daha büyük eşik daha fazla yeniliği kabul eder; ölçüm kalitesi kontrolleri devam eder.</p><div class="measurementToggles">${[['useM1','M1 · IMU ivmesi'],['useM5','M5 · Harita yönü'],['useM6','M6 · Duruş / ZUPT'],['useM7','M7 · Çıkış portalı']].map(([key,label])=>`<label><input type="checkbox" id="${key}" checked>${label}</label>`).join('')}</div><p class="parameterHelp" id="filterReadiness">M1 başlangıç kalibrasyonuna bağlıdır.</p>`:group==='cfilter'?`<label class="fieldlabel"><input type="checkbox" id="useCZupt" checked> Kalman · Duruş / ZUPT</label><p class="parameterHelp">Düşük tahmini hız + düşük hız belirsizliği + 0.5 s sakin IMU gerekir. Duruşu kaçırabilir; sakin sensör tek başına duruş değildir.</p><p class="parameterHelp" id="cReadiness">Kalman modeli kendi GNSS / IMU geçmişiyle kalibre edilir.</p>`:''}</div></details>`).join('');
 for(const p of PARAMETERS)$(p.key).oninput=()=>{cfg[p.key]=Number($(p.key).value);syncParameters();change({preserveDrive:true});};
 for(const key of ['useM1','useM5','useM6','useM7','useCZupt'])$(key).onchange=()=>{cfg[key]=$(key).checked;change({preserveDrive:true});};
 $('nisGate').onchange=()=>{cfg.nisGate=Number($('nisGate').value);change({preserveDrive:true});};
 $('resetParameters').onclick=()=>{for(const p of PARAMETERS)cfg[p.key]=p.value;for(const key of ['useM1','useM5','useM6','useM7','useCZupt'])cfg[key]=true;cfg.nisGate=6.63;syncParameters();change({preserveDrive:true});};
 $('skipCalibration').onclick=()=>{if(!data)return;setPlaying(false);index=data.calibrationRows.length;render();};
 syncParameters();
}
const signed=v=>(v>=0?'+':'−')+number(Math.abs(v));
function toast(s){$('toast').textContent=s;$('toast').classList.add('visible');clearTimeout(toastTimer);toastTimer=setTimeout(()=>$('toast').classList.remove('visible'),2600);}
function setPlaying(v){playing=v;$('playText').textContent=v?'Duraklat':'Başlat';$('playIcon').textContent=v?'Ⅱ':'▶';last=0;}
function fillRange(el){el.style.setProperty('--fill',`${100*(el.value-el.min)/(el.max-el.min)}%`);}
function speedDisplay(value){$('speed').value=value;fillRange($('speed'));$('speedOut').innerHTML=`${number(value/3.6*speedScale(),speedUnit==='m/s'?1:0)} <small>${speedUnit}</small>`;$('speed').setAttribute('aria-valuetext',speedText(value));}
function busy(live=false){
 setPlaying(false);if(worker){worker.terminate();worker=null;}
 $('loading').classList.remove('hidden');$('loading').querySelector('strong').textContent=live?'Yeni hız uygulanıyor':'Koşu hazırlanıyor';
 $('play').disabled=true;$('timeline').disabled=true;$('reset').disabled=true;$('summaryBtn').disabled=true;
}
function build(options={}){
 const {keepIndex=0,resume=false,live=false}=options;busy(live);carry=0;
 if(!live){index=0;speedDisplay(cfg.speed);$('actualSpeed').textContent='—';}
 $('lengthOut').innerHTML=`${number(cfg.length/1000)} <small>km</small>`;
 $('roadTitle').innerHTML=`${names[cfg.road]} <span>${number(cfg.length/1000)} km</span>`;
 $('geometryLabel').textContent={s:'S tünel',curve:'Tek viraj',straight:'Düz yol'}[cfg.road];
 $('profile').options[1].textContent=`Yavaşla · ${speedText(cfg.speed)} → ${speedText(Math.min(cfg.speed,50))}`;syncParameters();
 $('scenarioHelp').textContent=cfg.speedChanges.length?'Canlı hız komutu, kalan otomatik profilin yerini aldı.':cfg.profile==='wavespeed'?'Hedef hız, seçili aralıkta random walk yapar. Gerçek araç jerk / ivme sınırlarıyla izler.':cfg.profile==='steady'?'Sürücünün hızı hedef çevresinde doğal olarak değişir.':cfg.profile==='stop'?'Tünelin %36’sında frenler; olaydan 65 s sonra tekrar hızlanır.':'Tünelin %36’sında yavaşlar; olaydan 55 s sonra hedefe döner.';
 const nextWorker=new Worker('worker.js',{type:'module'});worker=nextWorker;
 nextWorker.onmessage=e=>{
  if(worker!==nextWorker)return;
  if(e.data.error){$('progressText').textContent=e.data.error;$('loading').querySelector('strong').textContent='Koşu üretilemedi';return;}
  if(e.data.progress!==undefined)$('progressText').textContent=`Araç, sensörler ve filtreler · %${Math.round(e.data.progress*100)}`;
  if(e.data.data){
   data=e.data.data;playbackRows=[...data.calibrationRows,...data.rows];$('calibrationInfo').textContent='Kalibrasyon sonunda: '+number(data.calibration.seconds,1)+' s · uygun hız değişimi: '+number(data.calibration.qualifying,0)+' s · Füzyon: '+(data.calibration.ready?'hazır':'sınırlı')+' · Kalman: '+(data.calibration.c.ready?'hazır':'sınırlı');index=Math.min(keepIndex,playRows().length-1);liveContext=null;
   $('loading').classList.add('hidden');$('play').disabled=false;$('timeline').disabled=false;$('reset').disabled=false;$('summaryBtn').disabled=false;
   $('timeline').max=playRows().length-1;$('endTime').textContent=time(playTime(data.duration));$('outageLabel').textContent=`GNSS kesintisi · ${number(data.exitTime-data.entryTime,0)} s`;
   $('cReadiness').textContent='Kalman kalibrasyonu: '+(data.calibration.c.ready?'hazır':'sınırlı · IMU yerine kıyı')+' · giriş σb '+number(data.calibration.c.sigmaBeta,3)+' m/s²';$('filterReadiness').textContent='Kalibrasyon: '+(data.calibration.ready?'hazır':'sınırlı')+' · M1: '+(data.calibration.m1Enabled?'açık':cfg.useM1?'hazırlık nedeniyle kapalı':'elle kapalı');if(!live){$('changeStatus').className='experimentstatus';$('changeStatus').textContent=cfg.speedChanges.length?'Koşu hazır · kayıtlı canlı hız komutları korunarak yeniden hesaplandı.':'Koşu hazır · aynı seed ile parametrelerin etkisini karşılaştırabilirsin.';}nextWorker.terminate();worker=null;render();if(resume)setPlaying(true);
  }
 };
 nextWorker.onerror=e=>{if(worker!==nextWorker)return;$('progressText').textContent='Hesaplama hatası. Yeni koşu ile tekrar deneyin.';console.error(e.message);};
 nextWorker.postMessage(cfg);
}
function change(options={}){
 clearTimeout(debounce);liveContext=null;if(!options.preserveDrive){cfg.speedChanges=[];cfg.speed=Number($('speed').value);}data=null;index=0;busy();
 $('changeStatus').className='experimentstatus';$('changeStatus').textContent=options.preserveDrive?'Aynı sürüş ve hız komutları · yeni parametrelerle baştan hesaplanıyor.':'Yeni koşu · seçili hız ve uzunluk, aynı seed ile uygulanıyor.';
 debounce=setTimeout(()=>build(),180);
}
document.querySelectorAll('[data-road]').forEach(b=>b.onclick=()=>{cfg.road=b.dataset.road;document.querySelectorAll('[data-road]').forEach(x=>{x.classList.toggle('selected',x===b);x.setAttribute('aria-pressed',x===b);});change();});
$('length').oninput=()=>{cfg.length=Number($('length').value);fillRange($('length'));$('lengthOut').innerHTML=`${number(cfg.length/1000)} <small>km</small>`;change();};fillRange($('length'));fillRange($('speed'));
$('speed').oninput=()=>{
 const speed=Number($('speed').value);speedDisplay(speed);
 if(!data||index===0||playRows()[index].phase==='calibration'){cfg.speed=speed;change();return;}
 if(!liveContext)liveContext={keepIndex:index,resume:playing,live:true};
 const at=Math.round((playRows()[liveContext.keepIndex].t+.1)*10)/10;
 cfg.speedChanges=[...cfg.speedChanges.filter(e=>e.at<at),{at,speed}];
 busy(true);clearTimeout(debounce);
 $('changeStatus').className='experimentstatus manual';$('changeStatus').textContent=`${time(playTime(at))} · hedef ${speedText(speed)}. Araç bu noktadan itibaren uyum sağlar; kalan otomatik profilin yerini alır.`;
 debounce=setTimeout(()=>build({...liveContext}),220);
};
for(const id of ['profile','phone','map'])$(id).onchange=()=>{cfg[id]=$(id).value;if(id==='profile'&&cfg.profile==='wavespeed')$('driverParameters').open=true;change({preserveDrive:id!=='profile'});};
$('seed').onchange=()=>{cfg.seed=Math.max(1,Math.min(999999,Math.round(Number($('seed').value)||42)));$('seed').value=cfg.seed;change({preserveDrive:true});};
$('newSeed').onclick=()=>{cfg.seed=Math.floor(Math.random()*999999)+1;$('seed').value=cfg.seed;change({preserveDrive:true});};
$('freshRun').onclick=change;
$('speedUnit').onchange=()=>{speedUnit=$('speedUnit').value;document.querySelectorAll('[data-speed-unit]').forEach(el=>el.textContent=speedUnit);$('speedMin').textContent=speedText(30);$('speedMax').textContent=speedText(110);speedDisplay(Number($('speed').value));$('profile').options[1].textContent=`Yavaşla · ${speedText(cfg.speed)} → ${speedText(Math.min(cfg.speed,50))}`;if(cfg.speedChanges.length){const c=cfg.speedChanges.at(-1);$('changeStatus').textContent=`${time(c.at)} · hedef ${speedText(c.speed)}. Araç bu noktadan itibaren uyum sağlar; kalan otomatik profilin yerini alır.`;}render();};
$('play').onclick=()=>{if(!data||worker)return;if(index>=playRows().length-1)index=0;setPlaying(!playing);render();};
$('reset').onclick=()=>{setPlaying(false);index=0;carry=0;$('timeline').value=0;render();};
$('timeline').oninput=()=>{setPlaying(false);index=Number($('timeline').value);render();};for(const id of ['showTruth','showA','showB','showC'])$(id).onchange=render;
function view(v){chase=v;$('wholeView').classList.toggle('active',!v);$('chaseView').classList.toggle('active',v);$('wholeView').setAttribute('aria-pressed',!v);$('chaseView').setAttribute('aria-pressed',v);render();}$('wholeView').onclick=()=>view(false);$('chaseView').onclick=()=>view(true);
$('aboutBtn').onclick=()=>$('aboutDialog').showModal();document.querySelectorAll('[data-close]').forEach(b=>b.onclick=()=>$(b.dataset.close).close());document.querySelectorAll('dialog').forEach(d=>d.addEventListener('click',e=>{if(e.target===d){const r=d.getBoundingClientRect();if(e.clientX<r.left||e.clientX>r.right||e.clientY<r.top||e.clientY>r.bottom)d.close();}}));
function surface(id){const canvas=$(id),r=canvas.getBoundingClientRect(),dpr=Math.min(window.devicePixelRatio||1,2);if(canvas.width!==Math.round(r.width*dpr)||canvas.height!==Math.round(r.height*dpr)){canvas.width=Math.round(r.width*dpr);canvas.height=Math.round(r.height*dpr);}const ctx=canvas.getContext('2d');ctx.setTransform(dpr,0,0,dpr,0,0);ctx.clearRect(0,0,r.width,r.height);return{ctx,w:r.width,h:r.height};}
function interp(points,s){let a=0,b=points.length-1;if(s<points[0].s){const p=points[0],d=s-p.s;return{x:p.x+d*Math.cos(p.psi),y:p.y+d*Math.sin(p.psi),psi:p.psi};}if(s>points[b].s){const p=points[b],d=s-p.s;return{x:p.x+d*Math.cos(p.psi),y:p.y+d*Math.sin(p.psi),psi:p.psi};}while(b-a>1){const m=(a+b)>>1;if(points[m].s>s)b=m;else a=m;}const p=points[a],q=points[b],f=(s-p.s)/(q.s-p.s||1);return{x:p.x+(q.x-p.x)*f,y:p.y+(q.y-p.y)*f,psi:p.psi+(q.psi-p.psi)*f};}
function mapDraw(row){const{ctx:c,w,h}=surface('mapCanvas'),L=cfg.length,truth=data.road,mp=data.mapPoints;
 c.fillStyle='#f1f5f1';c.fillRect(0,0,w,h);c.strokeStyle='#e5ece4';c.lineWidth=.6;for(let x=15;x<w;x+=24){c.beginPath();c.moveTo(x,0);c.lineTo(x,h);c.stroke();}for(let y=8;y<h;y+=24){c.beginPath();c.moveTo(0,y);c.lineTo(w,y);c.stroke();}
 const minS=Math.min(-cfg.preTunnelLength-30,row.a.display-80,row.b.display-80,row.c.display-80),maxS=Math.max(L+280,row.a.display+100,row.b.display+100,row.c.display+100),path=[];for(let s=minS;s<=maxS;s+=8)path.push(interp(truth,s));path.push(interp(truth,maxS));let scale,ox,oy;
 if(chase){scale=Math.min(w/650,h/450);const p=interp(truth,row.s);ox=w*.43-p.x*scale;oy=h*.53+p.y*scale;}else{const xs=path.map(p=>p.x),ys=path.map(p=>p.y),xmin=Math.min(...xs),xmax=Math.max(...xs),ymin=Math.min(...ys),ymax=Math.max(...ys);scale=Math.min((w-100)/(xmax-xmin||1),(h-125)/(ymax-ymin||1));ox=(w-(xmax-xmin)*scale)/2-xmin*scale;oy=(h+(ymax-ymin)*scale)/2+ymin*scale+3;}
 const xy=p=>[p.x*scale+ox,-p.y*scale+oy],pos=(s,map=false)=>{const p=interp(map?mp:truth,s),[x,y]=xy(p);return{x,y,psi:p.psi};};
 function route(a,b,stroke,width,dash=[]){c.beginPath();const p=pos(a);c.moveTo(p.x,p.y);for(let s=a+5;s<b;s+=5){const p=pos(s);c.lineTo(p.x,p.y);}const q=pos(b);c.lineTo(q.x,q.y);c.strokeStyle=stroke;c.lineWidth=width;c.lineCap='round';c.lineJoin='round';c.setLineDash(dash);c.stroke();c.setLineDash([]);}
 // One road ribbon, no centre divider: a single traffic lane.
 route(minS,maxS,'#dce6da',32);route(minS,maxS,'#b1c4b1',22);route(minS,maxS,'#e8eee4',1,[3,10]);route(0,L,'#d0dcd0',39);route(0,L,'#62766b',28);route(0,L,'#40594d',21);route(0,L,'#6b8173',1,[1,13]);
 if(row.phase!=='calibration'&&$('showB').checked){const s=row.b.s,sigma=row.b.sigma;const lo=Math.max(minS,s-2*sigma),hi=Math.min(maxS,s+2*sigma);route(lo,hi,'#9c89f155',18);route(lo,hi,'#b1a0ed99',2);}
 function portal(s,label){const p=pos(s);c.save();c.translate(p.x,p.y);c.rotate(-p.psi);c.fillStyle='#829680';c.fillRect(-4,-21,8,42);c.fillStyle='#e0e8dc';c.fillRect(-2,-15,4,30);c.restore();c.font='500 8px "IBM Plex Mono",monospace';c.textAlign='center';c.fillStyle='#7f9685';c.fillText(translate(label),p.x,p.y+39);}
 portal(0,'GİRİŞ');portal(L,'ÇIKIŞ');
 const all=[{key:'a',s:row.a.display,label:'Sabit hız',offset:-42,show:$('showA').checked},{key:'b',s:row.b.display,label:'Füzyon',offset:68,show:$('showB').checked},{key:'c',s:row.c.display,label:'Kalman',offset:40,show:$('showC').checked},{key:'truth',s:row.s,label:'Gerçek',offset:-71,show:$('showTruth').checked}];
 for(const m of all){if(!m.show||(row.phase==='calibration'&&m.key!=='truth'))continue;const p=pos(m.s,m.key!=='truth');if(p.x< -20||p.x>w+20||p.y< -20||p.y>h+20){const x=Math.max(25,Math.min(w-25,p.x)),y=Math.max(60,Math.min(h-50,p.y));c.fillStyle=colors[m.key];c.font='10px "DM Sans",sans-serif';c.textAlign='center';c.fillText(translate(m.label+' ↗ görünüm dışında'),x,y);continue;}
  c.save();c.translate(p.x,p.y);c.rotate(-p.psi);c.shadowBlur=8;c.shadowColor='#16322635';c.fillStyle='white';c.beginPath();c.roundRect(-11,-6,22,12,3);c.fill();c.shadowBlur=0;c.fillStyle=colors[m.key];c.beginPath();c.roundRect(-9,-4,18,8,2);c.fill();c.fillStyle='#ffffffb5';c.fillRect(2,-3,3,6);c.restore();c.beginPath();c.moveTo(p.x,p.y+(m.offset>0?9:-9));c.lineTo(p.x,p.y+m.offset+(m.offset>0?-9:10));c.strokeStyle=colors[m.key]+'77';c.lineWidth=.8;c.stroke();c.font='600 9px "DM Sans",sans-serif';c.textAlign='center';const label=translate(m.label),tw=c.measureText(label).width;c.fillStyle='#f8fbf6ee';c.beginPath();c.roundRect(p.x-tw/2-7,p.y+m.offset-9,tw+14,18,4);c.fill();c.fillStyle=colors[m.key];c.fillText(label,p.x,p.y+m.offset+3);
 }
 const distance=Math.pow(10,Math.floor(Math.log10(60/scale))),d=60/scale/distance>5?5*distance:60/scale/distance>2?2*distance:distance;$('mapScale').textContent=d>=1000?number(d/1000,1)+' km':number(d,0)+' m';$('mapScale').style.width=`${Math.max(20,d*scale)}px`;
}
function chartDraw(id,kind,row){const{ctx:c,w,h}=surface(id),pad={l:43,r:15,t:15,b:27},cw=w-pad.l-pad.r,ch=h-pad.t-pad.b,rows=data.rows,visible=rows.filter(r=>r.t<=row.t),timeMax=data.duration;
 let min,max;if(kind==='error'){const a=rows.filter((_,i)=>i%10===0);min=Math.min(-10,...a.map(r=>Math.min(r.a.s-r.s,r.b.s-r.s,r.c.s-r.s,-2*r.b.sigma)));max=Math.max(10,...a.map(r=>Math.max(r.a.s-r.s,r.b.s-r.s,r.c.s-r.s,2*r.b.sigma)));}else{min=0;max=Math.max(110/3.6*speedScale(),...rows.filter((_,i)=>i%10===0).map(r=>Math.max(r.v,r.a.v,r.b.v,r.c.v,r.target/3.6)*speedScale()))*1.06;}
 const extent=max-min;min-=extent*.05;max+=extent*.05;const x=t=>pad.l+t/timeMax*cw,y=v=>pad.t+(max-v)/(max-min)*ch;
 c.fillStyle='#f7f5fb';c.fillRect(x(data.entryTime),pad.t,x(data.exitTime)-x(data.entryTime),ch);c.font='8px "IBM Plex Mono",monospace';c.textAlign='right';c.fillStyle='#a1b0a6';for(let i=0;i<4;i++){const v=min+(max-min)*i/3,yy=y(v);c.beginPath();c.moveTo(pad.l,yy);c.lineTo(w-pad.r,yy);c.strokeStyle='#e7ede8';c.lineWidth=.7;c.stroke();c.fillText(Math.round(v).toString(),pad.l-9,yy+3);}
 c.textAlign='center';for(let i=0;i<5;i++){const t=timeMax*i/4;c.fillText(time(playTime(t)),x(t),h-9);}if(kind==='error'){c.beginPath();c.moveTo(pad.l,y(0));c.lineTo(w-pad.r,y(0));c.strokeStyle='#b9c8bd';c.setLineDash([3,4]);c.stroke();c.setLineDash([]);}
 // Mark manual interventions on both charts, only once the playhead reaches them.
 for(const command of cfg.speedChanges){if(command.at>row.t+.00001)continue;c.beginPath();c.moveTo(x(command.at),pad.t);c.lineTo(x(command.at),pad.t+ch);c.strokeStyle='#7d948164';c.lineWidth=1;c.setLineDash([2,4]);c.stroke();c.setLineDash([]);}
 const samples=visible.filter((_,i)=>i%3===0||i===visible.length-1);
 c.save();c.beginPath();c.rect(pad.l,pad.t,cw,ch);c.clip();
 if(kind==='error'&&$('showB').checked){c.beginPath();samples.forEach((r,i)=>{const xx=x(r.t),yy=y(2*r.b.sigma);i?c.lineTo(xx,yy):c.moveTo(xx,yy);});[...samples].reverse().forEach(r=>c.lineTo(x(r.t),y(-2*r.b.sigma)));c.closePath();c.fillStyle='#a08cdd22';c.fill();}
 if(kind==='speed'){c.beginPath();samples.forEach((r,i)=>{i?c.lineTo(x(r.t),y(r.target/3.6*speedScale())):c.moveTo(x(r.t),y(r.target/3.6*speedScale()));});c.strokeStyle='#a4b6a9';c.lineWidth=1;c.setLineDash([2,4]);c.stroke();c.setLineDash([]);}
 const keys=kind==='speed'?['truth',...modelOrder]:modelOrder;for(const key of keys){if(!$(key==='truth'?'showTruth':key==='a'?'showA':key==='b'?'showB':'showC').checked)continue;c.beginPath();samples.forEach((r,i)=>{const v=kind==='speed'?(key==='truth'?r.v:r[key].v)*speedScale():r[key].s-r.s;i?c.lineTo(x(r.t),y(v)):c.moveTo(x(r.t),y(v));});c.strokeStyle=colors[key];c.lineWidth=key==='truth'?2:1.6;if(key==='a')c.setLineDash([5,3]);if(key==='c')c.setLineDash([2,3]);c.stroke();c.setLineDash([]);}
 c.beginPath();c.moveTo(x(row.t),pad.t);c.lineTo(x(row.t),h-pad.b);c.strokeStyle='#9faea5';c.lineWidth=.7;c.stroke();c.restore();
}

function renderCalibration(r){
 $('currentTime').textContent=time(playTime(r.t));$('timeline').value=index;fillRange($('timeline'));
 $('truthV').textContent=number(r.v*speedScale());$('actualSpeed').textContent=number(r.v*speedScale());$('truthS').textContent=number(r.s,0)+' m';$('currentTarget').textContent=speedText(r.target);
 for(const k of modelOrder)for(const suffix of ['Error','V','Sigma'])$(k+suffix).textContent='—';
 $('phase').className='phase open';$('phase').textContent='Kalibrasyon sürüşü';
 $('mapNote').textContent='GNSS + IMU kaydı · modeller kalibrasyon tamamlanınca başlar';
 $('modeText').textContent='Kalibrasyon';$('modePercent').textContent='—';$('modeFill').style.width='0%';$('biasText').textContent='β —';$('gateText').textContent='—';$('cState').textContent='Kalibrasyon';$('cBias').textContent='b —';
 const placeholder={display:r.s,s:r.s,sigma:0};mapDraw({...r,a:placeholder,b:placeholder,c:placeholder});
 for(const id of ['errorCanvas','speedCanvas']){const{ctx:c,w,h}=surface(id);c.fillStyle='#7f9685';c.font='12px sans-serif';c.fillText(translate('Kalibrasyon tamamlanınca grafikler başlar'),45,h/2);}
}

function render(){if(!data)return;$('skipCalibration').disabled=index>=data.calibrationRows.length;const r=playRows()[index];if(r.phase==='calibration'){renderCalibration(r);return;}$('currentTime').textContent=time(playTime(r.t));$('timeline').value=index;fillRange($('timeline'));$('truthV').textContent=number(r.v*speedScale());$('actualSpeed').textContent=number(r.v*speedScale());$('currentTarget').textContent=speedText(r.target);if(!liveContext){const command=cfg.speedChanges.filter(e=>e.at<=Math.round(r.t*10)/10).at(-1);speedDisplay(command?.speed??cfg.speed);}$('truthS').textContent=number(r.s,0)+' m';for(const key of ['a','b','c']){$(key+'Error').textContent=signed(r[key].s-r.s);$(key+'V').textContent=number(r[key].v*speedScale())+' '+speedUnit;$(key+'Sigma').textContent='σ '+number(r[key].sigma)+' m';}
 const phases={open:'Açık gökyüzü',degraded:'GNSS zayıflıyor',tunnel:'GNSS kesintisi',recovery:'GNSS toparlanıyor'};$('phase').className='phase '+r.phase;$('phase').innerHTML=`<span></span>${phases[r.phase]}`;
 $('mapNote').textContent=r.phase==='tunnel'?'Uydu yok · Sabit hız → İvme takibi → Sensör füzyonu':r.phase==='recovery'?'GNSS geri döndü · ilk fix’ler doğrulanıyor':r.s>cfg.length?'GNSS aktif · kestirimler düzeltiliyor':'GNSS aktif · tünele yaklaşılıyor';
 $('modeText').textContent=r.b.stationary?'Standstill':r.s>=0&&!data.calibration.m1Enabled?'M1 kapalı':r.b.mu>.5?'Manevra':'Seyir';$('modeFill').style.width=(r.b.mu*100)+'%';$('modePercent').textContent='Manevra %'+Math.round(r.b.mu*100);$('biasText').textContent='β '+number(r.b.beta,3)+' m/s²';$('gateText').textContent=r.lastGate;$('cState').textContent=!r.c.imuEnabled?'Kalibrasyon sınırlı · kıyı':r.c.stationary?'Duruş / ZUPT':'IMU ile ilerleme';$('cBias').textContent='b '+number(r.c.beta,3)+' m/s²';mapDraw(r);chartDraw('errorCanvas','error',r);chartDraw('speedCanvas','speed',r);
}
function showSummary(open=true){if(!data)return;const s=data.summary,commands=cfg.speedChanges.length?'<p><b>Canlı hız komutları</b><br>'+cfg.speedChanges.map(e=>`${time(playTime(e.at))} → ${speedText(e.speed)}`).join(' · ')+'</p>':'';
 const metrics=[['Konum RMSE','rmse',' m',1],['En büyük |hata|','peak',' m',1],['|hata| ≤ 50 m','within50','%',100],['±2σ içinde kalma','coverage','%',100]];
 $('summaryBody').innerHTML=`<p>${names[cfg.road]} · ${number(cfg.length/1000)} km · seed ${cfg.seed}<br>Ölçümler yalnızca truth aracın tünel içinde olduğu süreye aittir. Bu, ${data.rows.length} örnekli tek bir koşudur.</p>${commands}<table><thead><tr><th>Metrik</th>${modelOrder.map(k=>`<th>${modelNames[k]}</th>`).join('')}</tr></thead><tbody>${metrics.map(([label,key,unit,mult])=>`<tr><td>${label}</td>${modelOrder.map(k=>`<td>${number(s[k][key]*mult)}${unit}</td>`).join('')}</tr>`).join('')}</tbody></table><p class="summarynote">Sabit hız modelinin analitik belirsizliği planlı frenleme/durma senaryosunu içermez. Füzyon ve Kalman modellerinin raporladığı belirsizlik tek koşuda doğrulanmış sayılmaz. Kalman modelinde harita yönü / eğrilik ve portal düzeltmesi yoktur; yol üzerinde görünmek boyuna hatayı düzeltmez. Kalman modelinin muhafazakâr duruş sezicisi, hız/bias kayması büyürse gerçek duruşu kaçırabilir.</p><p>GNSS kalibrasyonu: ${number(data.calibration.seconds,1)} s · uygun hız değişimi: ${number(data.calibration.qualifying,0)} s<br>Füzyon hazırlığı: ${data.calibration.ready?'hazır':'sınırlı'} · Kalman hazırlığı: ${data.calibration.c.ready?'hazır':'sınırlı'}<br>Kalman giriş bias σ: ${number(data.calibration.c.sigmaBeta,3)} m/s²<br>Füzyon ölçüm kapıları: ${data.endGates.accepted} kabul, ${data.endGates.rejected} ret, ${data.endGates.ambiguous} G5 atlama.</p><div class="downloadrow"><button id="csvDownload">CSV indir ↓</button><button id="jsonDownload">Senaryo JSON ↓</button></div>`;
 $('csvDownload').onclick=()=>{const fields=['t_s','truth_s_m','truth_v_mps','truth_a_mps2','target_speed_kmh','A_s_m','A_v_mps','A_sigma_m','C_s_m','C_v_mps','C_sigma_m','C_bias_mps2','C_sigma_bias_mps2','C_stationary','C_imu_enabled','C_imu_u_mps2','B_s_m','B_v_mps','B_sigma_m','B_manoeuvre_probability','imu_u_mps2','gyro_omega_radps','satellites','phase'];const csv=[fields.join(','),...data.rows.map(r=>[r.t,r.s,r.v,r.truthAcceleration,r.target,r.a.s,r.a.v,r.a.sigma,r.c.s,r.c.v,r.c.sigma,r.c.beta,r.c.sigmaBeta,r.c.stationary,r.c.imuEnabled,r.cU,r.b.s,r.b.v,r.b.sigma,r.b.mu,r.u,r.omega,r.sat,r.phase].join(','))].join('\n');download(csv,'tunnel-run-'+cfg.seed+'.csv','text/csv');};
 $('jsonDownload').onclick=()=>download(JSON.stringify({config:cfg,models:{order:modelOrder,names:Object.fromEntries(modelOrder.map(k=>[k,translate(modelNames[k])]))},display:{speedUnit,language},summary:data.summary,calibration:data.calibration},null,2),'tunnel-scenario-'+cfg.seed+'.json','application/json');if(open)$('summaryDialog').showModal();}
$('summaryBtn').onclick=()=>showSummary();
function download(text,name,type){const url=URL.createObjectURL(new Blob([text],{type})),a=document.createElement('a');a.href=url;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);toast('İndirme hazırlandı');}
window.addEventListener('resize',render);
document.addEventListener('keydown',e=>{if(e.code==='Space'&&!['INPUT','SELECT','BUTTON'].includes(document.activeElement.tagName)&&!document.querySelector('dialog[open]')){e.preventDefault();$('play').click();}});
function tick(now){if(playing&&data){if(last){carry+=(now-last)/1000*Number($('rate').value)*10;const steps=Math.floor(carry);if(steps){carry-=steps;index=Math.min(index+steps,playRows().length-1);render();if(index===playRows().length-1){setPlaying(false);toast('Koşu tamamlandı · sonuçlar Koşu özeti’nde');}}}last=now;}requestAnimationFrame(tick);}requestAnimationFrame(tick);setupParameters();initLanguage(()=>{
 syncParameters();$('playText').textContent=playing?'Duraklat':'Başlat';
 $('speedMin').textContent=speedText(30);$('speedMax').textContent=speedText(110);speedDisplay(Number($('speed').value));
 $('lengthOut').innerHTML=`${number(cfg.length/1000)} <small>km</small>`;
 $('roadTitle').innerHTML=`${names[cfg.road]} <span>${number(cfg.length/1000)} km</span>`;
 $('profile').options[1].textContent=`Yavaşla · ${speedText(cfg.speed)} → ${speedText(Math.min(cfg.speed,50))}`;
 render();if($('summaryDialog').open&&data)showSummary(false);
});build();
