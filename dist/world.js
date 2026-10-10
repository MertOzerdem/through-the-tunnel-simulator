import {RAD,RNG,clamp,unit,cross,dot,scale,add,norm} from './math.js';
const G=9.81,EARTH=7.29e-5,LAT=45*RAD;
// Rows transform vehicle vectors into the fixed phone axes.
const cy=Math.cos(23*RAD),sy=Math.sin(23*RAD),cp=Math.cos(12*RAD),sp=Math.sin(12*RAD),cr=Math.cos(-7*RAD),sr=Math.sin(-7*RAD);
const R=[[cy*cp,cy*sp*sr-sy*cr,cy*sp*cr+sy*sr],[sy*cp,sy*sp*sr+cy*cr,sy*sp*cr-cy*sr],[-sp,cp*sr,cp*cr]];
const rotate=v=>R.map(row=>dot(row,v));
export class World{
 constructor(road,cfg){this.road=road;this.cfg=cfg;this.driver=new RNG(cfg.seed+11);this.waveR=new RNG(cfg.seed+66);this.waveTarget=cfg.speed;this.accR=new RNG(cfg.seed+22);this.gyroR=new RNG(cfg.seed+33);this.biasR=new RNG(cfg.seed+44);this.s=0;this.v=cfg.speed/3.6;this.a=0;this.t=0;this.driverSigma=cfg.driverSigma??1;this.d=this.driver.normal()*this.driverSigma;this.ad=this.driver.normal()*this.driverSigma/Math.sqrt(180);this.ac=0;this.lastPitch=0;this.lastYaw=road.at(0).psi;this.wander=0;this.wanderV=0;this.previousWander=0;this.biasA=Array.from({length:3},()=>this.biasR.normal()*(cfg.accBiasMg??10)*.00981);this.biasG=Array.from({length:3},()=>this.biasR.normal()*.5*RAD);this.driftA=[0,0,0];this.driftG=[0,0,0];this.quality=cfg.phone==='good'?.45:cfg.phone==='poor'?2:1;this.stats=[];this.stopStart=null;this.eventStarted=false;this.eventEnd=null;}
 target(warm){const c=this.cfg,base=c.speed/3.6;if(warm){if(this.t<140)return Math.floor(this.t/25)%2?Math.min(base+6,30):Math.max(base-4,8);return base;}
  // Manual speed commands affect only the driver. They never enter either estimator.
  if(this.manualTarget!==undefined)return this.manualTarget;
  if(c.profile==='wavespeed')return this.waveTarget/3.6;
  if(this.s>c.length*.36&&!this.eventStarted&&c.profile!=='steady'){this.eventStarted=true;this.eventEnd=this.t+(c.profile==='stop'?65:55);}
  if(this.eventStarted&&this.t<this.eventEnd)return c.profile==='stop'?0:Math.min(base,50/3.6);
  return base;
 }
 frame(warm=false){
  if(!warm&&this.cfg.profile==='wavespeed'){
   // Reflected Brownian target in km/h, dt=0.1 s. A separate RNG preserves all sensor streams.
   const A=this.cfg.waveAmplitude??15,lo=Math.max(10,this.cfg.speed-A),hi=Math.min(130,this.cfg.speed+A),width=hi-lo;
   const proposal=this.waveTarget+(this.cfg.waveDiffusion??3)*Math.sqrt(.1)*this.waveR.normal();
   if(width>0){const z=((proposal-lo)%(2*width)+2*width)%(2*width);this.waveTarget=lo+(z<=width?z:2*width-z);}else this.waveTarget=lo;
  }
  let fSum=[0,0,0],wSum=[0,0,0],yaw=0,pitch=0;
  for(let sample=0;sample<10;sample++){
   for(let step=0;step<10;step++){const dt=.001;this.ad+=-this.ad/3*dt+Math.sqrt(2/3)*(.0745356)*this.driverSigma*Math.sqrt(dt)*this.driver.normal();this.d+=(this.ad-this.d/60)*dt;const target=this.target(warm),desired=clamp((target-this.v+(target>0?this.d:0))/2,-1.5,1),desiredA=desired+(target>0?this.ad-this.d/60:0);this.lastTarget=target;this.a+=clamp(desiredA-this.a,-2*dt,2*dt);const old=this.v;this.v=Math.max(0,this.v+this.a*dt);if(target===0&&this.v<.025){this.v=0;this.a=0;}this.s+=(old+this.v)*.5*dt;this.t+=dt;}
   const p=this.road.at(warm?-100:this.s),dt=.01;
   // Smooth lane wander, suspension pitch and bank. No lateral state is given to the filters.
   const w0=2*Math.PI/8;this.wanderV+=(-2*.7*w0*this.wanderV-w0*w0*this.wander)*dt+.25*Math.sqrt(4*.7*w0**3*dt)*this.driver.normal()*(this.v>1?1:0);this.wander+=this.wanderV*dt;
   yaw=p.psi+Math.atan2(this.wanderV,Math.max(this.v,3));pitch=.2*RAD*this.a;
   const yawRate=(yaw-this.lastYaw)/dt,pitchRate=(pitch-this.lastPitch)/dt;this.lastYaw=yaw;this.lastPitch=pitch;
   const fv=[this.a+G*Math.sin(pitch),this.v*this.v*p.k,G*Math.cos(pitch)];
   const gv=[0,-pitchRate+EARTH*Math.cos(LAT)*Math.cos(p.psi),yawRate+EARTH*Math.sin(LAT)];
   const fp=rotate(fv),gp=rotate(gv),idle=this.v<.2,noise=this.cfg.noiseScale??1,drift=this.cfg.driftScale??1;
   for(let i=0;i<3;i++){this.driftA[i]+=Math.sqrt(1e-7*dt)*this.biasR.normal()*this.quality*drift;this.driftG[i]+=-this.driftG[i]/300*dt+Math.sqrt(2/300*dt)*(.003*RAD)*this.biasR.normal()*this.quality*drift;fp[i]+=this.biasA[i]+this.driftA[i]+this.accR.normal()*(idle?.025:(i===2?.11:.31))*this.quality*noise;gp[i]+=this.biasG[i]+this.driftG[i]+this.gyroR.normal()*.007*RAD*Math.sqrt(50)*this.quality*noise;}
   // Quantised physical sensor readings.
   for(let i=0;i<3;i++){fp[i]=Math.round(clamp(fp[i],-16*G,16*G)/.0006)*.0006;gp[i]=Math.round(clamp(gp[i],-2000*RAD,2000*RAD)/(.001*RAD))*.001*RAD;fSum[i]+=fp[i]/10;wSum[i]+=gp[i]/10;}
   this.stats.push({f:norm(fp),w:gp});if(this.stats.length>100)this.stats.shift();
  }
  const mean=this.stats.reduce((s,q)=>s+q.f,0)/this.stats.length,wm=[0,0,0];for(const q of this.stats)for(let i=0;i<3;i++)wm[i]+=q.w[i]/this.stats.length;
  const tf=Math.sqrt(this.stats.reduce((s,q)=>s+(q.f-mean)**2,0)/this.stats.length),tw=Math.sqrt(this.stats.reduce((s,q)=>s+q.w.reduce((v,z,i)=>v+(z-wm[i])**2,0),0)/this.stats.length);
  return {t:this.t,s:this.s,v:this.v,a:this.a,yaw,pitch,f:fSum,w:wSum,tf,tw,wander:this.wander};
 }
}
export class Phone{
 constructor(road,map,cfg){this.road=road;this.map=map;this.cfg=cfg;this.r=new RNG(cfg.seed+55);this.posErr=[0,0];this.speedErr=0;this.trackingLag=Math.exp(.715*this.r.normal());this.fixLag=Math.exp(Math.log(2)+.715*this.r.normal());this.portalTime=null;this.recoveryFix=0;}
 event(frame,index){const {s,t,v}=frame,L=this.road.L;let sat=18,degraded=s> -100&&s<0;
  if(s>=0&&s<=L)sat=0;
  if(s>L){if(this.portalTime===null)this.portalTime=t;const elapsed=t-this.portalTime;if(elapsed<this.trackingLag)sat=0;else sat=elapsed<this.trackingLag+this.fixLag?5:16;}
  const e={sat,degraded};if(index%10!==0||sat<6)return e;
  if(this.portalTime!==null&&this.recoveryFix<3){this.recoveryFix++;degraded=true;}
  const sd=(this.cfg.gnssSigma??3)*(degraded?3:1),speedSD=this.cfg.gnssSpeedSigma??.15,phi=Math.exp(-1/30);for(let i=0;i<2;i++)this.posErr[i]=phi*this.posErr[i]+sd*Math.sqrt(1-phi*phi)*this.r.normal();
  const p=this.road.at(s),outlier=this.r.uniform()<(degraded?.1:.01)?(10+40*this.r.uniform())*(this.r.uniform()<.5?-1:1):0;
  this.speedErr=.5*this.speedErr+.05*this.r.normal();
  e.fix={x:p.x+this.posErr[0]+.5*this.r.normal()+outlier,y:p.y+this.posErr[1]+.5*this.r.normal(),v:Math.max(0,v+speedSD*this.r.normal()+this.speedErr),course:frame.yaw+1*RAD*this.r.normal(),accuracy:sd*1.5,speedAccuracy:speedSD,sat,time:t};return e;
 }
}
export function calibrate(frames){let up=[0,0,0],forward=[0,0,0],count=0,gyro=[0,0,0];const windows=[];
 for(let i=0;i<frames.length;i++)for(let j=0;j<3;j++)gyro[j]+=frames[i].w[j]/frames.length;
 for(let i=10;i<frames.length;i++){const e=frames[i],prev=frames[i-10];if(!e.fix||!prev.fix)continue;const dv=e.fix.v-prev.fix.v,mean=[0,0,0];for(let k=i-9;k<=i;k++)for(let j=0;j<3;j++)mean[j]+=frames[k].f[j]/10;windows.push({dv,mean});if(Math.abs(dv)<.3)up=add(up,mean);}
 up=unit(up);
 for(const {dv,mean} of windows)if(Math.abs(dv)>.5){const horiz=add(mean,scale(up,-dot(mean,up)));forward=add(forward,scale(horiz,dv));count++;}
 const yp=unit(cross(up,unit(forward))),xp=unit(cross(yp,up)),btheta=dot(yp,gyro)-EARTH*Math.cos(LAT)*Math.cos(frames.find(f=>f.fix)?.fix.course??0);
 return {up,xp,yp,btheta,qualifying:count};
}
export class Preprocessor{
 constructor(alignment,psi){Object.assign(this,alignment);this.psi=psi;this.deltaPitch=0;}
 step(raw,mapHeading){this.deltaPitch+=-(dot(this.yp,raw.w)-this.btheta-EARTH*Math.cos(LAT)*Math.cos(mapHeading))*.1;const omega=dot(this.up,raw.w);this.psi+=omega*.1;return{t:raw.t,u:dot(this.xp,raw.f)-G*this.deltaPitch,omega,psi:this.psi,tf:raw.tf,tw:raw.tw};}
}
