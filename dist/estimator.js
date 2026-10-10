import {RAD,clamp,wrap,dot,diag,eye,mul,transpose,mv,quadratic} from './math.js';
const DT=.1,N=6;
export const DEFAULTS={qdrv:.0333333333,qbeta:1.5e-5,sigmaU:.10,tauC:3,tauM:4,sigmaM:1.5,TC:30,TM:6,m1:true,mapHeading:true,zupt:true,portal:true,headingSigma:1.5*RAD,nisGate:6.63};
const copy=f=>({x:[...f.x],P:[...f.P]});
export class IMM{
 constructor(x=[0,22,0,0,0,0],P=diag([25,.09,1,.09,(3*RAD)**2,(.5*RAD)**2]),cfg={}){this.cfg={...DEFAULTS,...cfg};this.f=[{x:[...x],P:[...P]},{x:[...x],P:[...P]}];this.mu=[.9,.1];this.gates={accepted:0,rejected:0,ambiguous:0};this.lastGate='—';}
 snapshot(){return{f:this.f.map(copy),mu:[...this.mu],gates:{...this.gates},lastGate:this.lastGate};}
 restore(s){this.f=s.f.map(copy);this.mu=[...s.mu];this.gates={...s.gates};this.lastGate=s.lastGate;}
 output(){const x=Array(N).fill(0),P=Array(N*N).fill(0);for(let j=0;j<2;j++)for(let k=0;k<N;k++)x[k]+=this.mu[j]*this.f[j].x[k];for(let j=0;j<2;j++)for(let a=0;a<N;a++)for(let b=0;b<N;b++)P[a*N+b]+=this.mu[j]*(this.f[j].P[a*N+b]+(this.f[j].x[a]-x[a])*(this.f[j].x[b]-x[b]));return{x,P,mu:[...this.mu]};}
 predict(){const c=this.cfg,T=[[1-DT/c.TC,DT/c.TC],[DT/c.TM,1-DT/c.TM]],prior=[0,0];const old=this.f.map(copy),next=[];
  for(let j=0;j<2;j++){prior[j]=T[0][j]*this.mu[0]+T[1][j]*this.mu[1];const w=this.mu.map((p,i)=>T[i][j]*p/prior[j]),x=Array(N).fill(0),P=Array(N*N).fill(0);for(let i=0;i<2;i++)for(let k=0;k<N;k++)x[k]+=w[i]*old[i].x[k];for(let i=0;i<2;i++)for(let a=0;a<N;a++)for(let b=0;b<N;b++)P[a*N+b]+=w[i]*(old[i].P[a*N+b]+(old[i].x[a]-x[a])*(old[i].x[b]-x[b]));
   const phi=Math.exp(-DT/(j===0?c.tauC:c.tauM)),F=eye(N);F[1]=DT;F[2]=.5*DT*DT;F[8]=DT;F[14]=phi;F[29]=DT;const Q=[0,0,(j===0?c.qdrv/(2*c.tauC):c.sigmaM**2)*(1-phi*phi),c.qbeta*DT,(.007*RAD)**2*DT,(.003*RAD)**2/300*DT];const pp=mul(mul(F,P),transpose(F));for(let a=0;a<N;a++)pp[a*N+a]+=Q[a];next.push({x:mv(F,x),P:pp});
  }this.f=next;this.mu=c.m1?prior:[1,0];
 }
 measure(id,z,model,R,gated=true,angle=false){const v=this.f.map(f=>{const {h,H}=model(f.x);const nu=angle?wrap(z-h):z-h,S=quadratic(f.P,H)+R;return{nu,S,H};});
  if(gated&&v.some(q=>q.nu*q.nu/q.S>this.cfg.nisGate)){this.gates.rejected++;this.lastGate=id+' reddedildi';return false;}
  const logs=[];for(let j=0;j<2;j++){const f=this.f[j],q=v[j],K=mv(f.P,q.H).map(x=>x/q.S),A=eye(N);for(let a=0;a<N;a++){f.x[a]+=K[a]*q.nu;for(let b=0;b<N;b++)A[a*N+b]-=K[a]*q.H[b];}const pp=mul(mul(A,f.P),transpose(A));for(let a=0;a<N;a++)for(let b=0;b<N;b++)pp[a*N+b]+=K[a]*R*K[b];f.P=pp;f.x[1]=Math.max(0,f.x[1]);logs.push(Math.log(Math.max(this.mu[j],1e-300))-.5*(Math.log(2*Math.PI*q.S)+q.nu*q.nu/q.S));}
  const max=Math.max(...logs),p=logs.map(x=>Math.exp(x-max)),sum=p[0]+p[1];this.mu=p.map(x=>x/sum);this.gates.accepted++;this.lastGate=id+' kabul';return true;
 }
 scalar(id,z,index,R,gated=true){return this.measure(id,z,x=>({h:x[index],H:Array.from({length:6},(_,i)=>i===index?1:0)}),R,gated);}
 resetPosition(s,v,R,sigmaV=.15){for(const f of this.f){f.x[0]=s;f.x[1]=v;for(let i=0;i<6;i++){f.P[i]=f.P[i*6]=0;f.P[6+i]=f.P[i*6+1]=0;}f.P[0]=R;f.P[7]=2*sigmaV**2;}}
}
export function baselineVariance(t,s0=4,v0=.15,sigmaD=1,tau=60){const e=Math.exp(-t/tau);return s0*s0+v0*v0*t*t+sigmaD*sigmaD*tau*(2*t-3*tau+4*tau*e-tau*e*e)+sigmaD*sigmaD*(t-tau*(1-e))**2;}
export class Estimators{
 constructor(map,initial,cfg){this.map=map;this.b=new IMM(initial.x,initial.P,cfg);this.a={s:initial.x[0],v:initial.x[1],sigma:Math.sqrt(initial.P[0]),t:0,s0:Math.sqrt(initial.P[0]),v0:Math.sqrt(initial.P[7]),phase:'open',speeds:[],started:false,lastPosition:-1e6,portalApplied:false,good:0};this.phase='open';this.speeds=[];this.lastHeading=initial.x[0];this.lastPosition=-1e6;this.fail=[];this.good=0;this.portalApplied=false;this.stationary=false;this.started=false;this.dispA=this.a.s;this.dispB=this.a.s;this.snaps={a:0,b:0};}
 snapshot(){return{cfg:{...this.b.cfg},b:this.b.snapshot(),a:{...this.a},phase:this.phase,speeds:[...this.speeds],lastHeading:this.lastHeading,lastPosition:this.lastPosition,fail:this.fail.map(x=>({...x})),good:this.good,portalApplied:this.portalApplied,stationary:this.stationary,started:this.started,dispA:this.dispA,dispB:this.dispB,snaps:{...this.snaps}};}
 restore(s){const b=s.b;Object.assign(this,structuredClone({...s,b:undefined}));this.b=new IMM([],[],this.cfg);this.b.restore(b);}
 step(e){const map=this.map,prev=this.phase;this.cfg=this.b.cfg;let out=this.b.output();
  if(e.sat===0)this.phase='tunnel';else if(e.sat>=4&&prev==='tunnel')this.phase='recovery';else if(e.degraded&&prev==='open')this.phase='degraded';
  this.advanceA(e);
  this.b.predict();out=this.b.output();
  const motion=out.x[1]-2*Math.sqrt(out.P[7])<2,quiet=e.tf<.08&&e.tw<.3*RAD;
  if(this.b.cfg.zupt&&!this.stationary&&quiet&&motion)this.stationary=true;
  if(this.stationary&&(e.tf>.12||e.tw>.45*RAD||Math.abs(e.u-out.x[3])>.3))this.stationary=false;
  if(this.stationary){this.b.scalar('M6 v',0,1,.05**2,false);this.b.scalar('M6 a',0,2,.05**2,false);this.b.scalar('M6 ω',e.omega,5,(.02*RAD)**2,false);}
  if(this.b.cfg.m1)this.b.measure('M1',e.u,x=>({h:x[2]+x[3],H:[0,0,1,1,0,0]}),this.b.cfg.sigmaU**2,false);
  out=this.b.output();if(this.b.cfg.mapHeading&&out.x[1]>3&&out.x[0]-this.lastHeading>=100){this.lastHeading=out.x[0];const s=out.x[0],sigma=Math.sqrt(out.P[0]),angles=Array.from({length:25},(_,i)=>map.at(s-3*sigma+6*sigma*i/24).psi);let up=false,down=false;for(let i=1;i<angles.length;i++){const d=wrap(angles[i]-angles[i-1]);if(d>1e-6)up=true;if(d< -1e-6)down=true;}
   if(up&&down&&Math.max(...angles)-Math.min(...angles)>2*this.b.cfg.headingSigma){this.b.gates.ambiguous++;this.b.lastGate='G5: belirsiz S eğrisi';}
   else this.b.measure('M5',e.psi,x=>{const p=map.at(x[0]);return{h:p.psi+x[4],H:[p.k,0,0,0,1,0]};},this.b.cfg.headingSigma**2,true,true);
  }
  if(this.phase==='recovery'&&!this.portalApplied){this.portalApplied=true;out=this.b.output();if(this.b.cfg.portal&&Math.abs(out.x[0]-map.out)<3*Math.sqrt(out.P[0])+150){const R=100+out.x[1]**2*1.1**2;this.b.measure('M7',map.out,x=>({h:x[0]-1.8*x[1],H:[1,-1.8,0,0,0,0]}),R);}}
  if(e.fix&&this.phase!=='tunnel')this.gnss(e.fix,e);
  out=this.b.output();const smooth=(disp,s,v,key)=>{const err=s-disp;if(Math.abs(err)>100){this.snaps[key]++;return s;}return disp+(v+clamp(err/1.5,-.8*v,25))*DT;};this.dispA=smooth(this.dispA,this.a.s,this.a.v,'a');this.dispB=smooth(this.dispB,out.x[0],out.x[1],'b');return{a:{...this.a,display:this.dispA},b:{s:out.x[0],v:out.x[1],a:out.x[2],beta:out.x[3],sigma:Math.sqrt(out.P[0]),sigmaV:Math.sqrt(out.P[7]),mu:out.mu[1],display:this.dispB,stationary:this.stationary},phase:this.phase,gates:{...this.b.gates},lastGate:this.b.lastGate};
 }
 advanceA(e){
  const a=this.a,map=this.map,prev=a.phase;
  if(e.sat===0)a.phase='tunnel';else if(e.sat>=4&&prev==='tunnel')a.phase='recovery';else if(e.degraded&&prev==='open')a.phase='degraded';
  if((a.phase==='tunnel'||a.phase==='degraded')&&!a.started){if(a.speeds.length)a.v=a.speeds.reduce((x,y)=>x+y,0)/a.speeds.length;a.s0=a.sigma;a.v0=a.lastSpeedSigma??.15;a.t=0;a.started=true;}
  a.s+=a.v*DT;if(a.started){a.t+=DT;a.sigma=Math.sqrt(baselineVariance(a.t,a.s0,a.v0));}
  if(a.phase==='recovery'&&!a.portalApplied){a.portalApplied=true;const R=100+a.v**2*1.1**2,S=a.sigma**2+R,nu=map.out-(a.s-1.8*a.v);if(nu*nu/S<=6.63){a.s+=a.sigma**2/S*nu;a.sigma=Math.sqrt(a.sigma**2*R/S);a.s0=a.sigma;a.t=0;}}
  const f=e.fix;if(!f||a.phase==='tunnel')return;
  const recovery=a.phase==='recovery',proj=recovery?map.project(f):map.project(f,a.s,Math.max(3*a.sigma,50)),limit=recovery?15:a.phase==='degraded'?10:20;
  if(f.accuracy>limit||f.sat<6||proj.cross>Math.max(3*f.accuracy,10)){a.good=0;return;}
  a.speeds=[...a.speeds,f.v].slice(-3);a.lastSpeedSigma=f.speedAccuracy;const R=Math.max(f.accuracy,3)**2;
  if(recovery){
   // Reacquisition requires three mutually consistent fixes, independent of B's innovations.
   const consistent=!a.lastFix||Math.abs(proj.s-(a.lastFix.s+a.lastFix.v*(e.t-a.lastFix.t)))<2*Math.sqrt(2*R);
   a.good=consistent?a.good+1:1;a.lastFix={s:proj.s,v:f.v,t:e.t};
   a.s=proj.s;a.v=f.v;a.sigma=Math.sqrt(R);a.t=0;a.s0=a.sigma;a.started=false;
   if(a.good>=3){a.phase='open';a.portalApplied=false;}return;
  }
  a.v=f.v;if(e.t-a.lastPosition>=10){const nu=proj.s-a.s,S=a.sigma**2+6*R;if(nu*nu/S<=6.63){a.s=proj.s;a.lastPosition=e.t;}}a.sigma=Math.sqrt(R);
 }
 gnss(f,e){const map=this.map,out=this.b.output(),recovery=this.phase==='recovery',proj=map.project(f,recovery?out.x[0]:out.x[0],recovery?3000:Math.max(3*Math.sqrt(out.P[0]),50)),limit=recovery?15:this.phase==='degraded'?10:20;
  if(f.accuracy>limit||f.sat<6||proj.cross>Math.max(3*f.accuracy,10)){this.good=0;return;}
  if(f.v>1)this.b.scalar('M3',f.v,1,2*Math.max(.1,f.speedAccuracy)**2);
  if(f.v>5)this.b.measure('M4',wrap(e.psi-f.course),x=>({h:x[4],H:[0,0,0,0,1,0]}),(1*RAD)**2,true,true);
  const R=Math.max(f.accuracy,3)**2,nu=proj.s-out.x[0],S=out.P[0]+R;
  if(recovery||e.t-this.lastPosition>=10){const accepted=this.b.scalar('M2',proj.s,0,(recovery?1:6)*R);if(accepted){this.lastPosition=e.t;this.fail=[];this.good++;}else{this.good=0;this.fail.push({s:proj.s,t:e.t,v:f.v,R});if(this.fail.length>3)this.fail.shift();}
   if(this.fail.length===3){const latest=this.fail.at(-1),positions=this.fail.map(q=>q.s+q.v*(latest.t-q.t));if(Math.max(...positions)-Math.min(...positions)<2*Math.sqrt(2*R)){this.b.resetPosition(positions.reduce((a,b)=>a+b)/3,f.v,R,f.speedAccuracy);this.fail=[];this.good=1;this.b.lastGate='G8 yeniden başlatma';}}
  }
  if(recovery&&this.good>=3){this.phase='open';this.portalApplied=false;}
 }
}
