import {RAD,diag,eye,mul,transpose,mv,quadratic,clamp} from './math.js';

// C: one linear filter, x = [along-track distance, speed, accelerometer bias].
// No truth, driver commands, B state, heading/curvature updates or portal fixes.
export class SimpleKF{
 constructor(map,s,v,cfg={}){
  this.map=map;this.cfg={sigmaU:.15,qBias:1.5e-5,zupt:true,...cfg};
  this.x=[s,v,0];this.P=diag([25,.3**2,.3**2]);this.phase='open';
  this.imuEnabled=true;this.stationary=false;this.quietCount=0;this.lastPosition=-1e6;
  this.good=0;this.failed=[];this.display=s;this.gates={accepted:0,rejected:0};
 }
 snapshot(){return structuredClone({x:this.x,P:this.P,phase:this.phase,imuEnabled:this.imuEnabled,stationary:this.stationary,quietCount:this.quietCount,lastPosition:this.lastPosition,good:this.good,failed:this.failed,display:this.display,gates:this.gates});}
 restore(s){Object.assign(this,structuredClone(s));}
 output(){return{s:this.x[0],v:this.x[1],beta:this.x[2],sigma:Math.sqrt(Math.max(0,this.P[0])),sigmaV:Math.sqrt(Math.max(0,this.P[4])),sigmaBeta:Math.sqrt(Math.max(0,this.P[8])),stationary:this.stationary,imuEnabled:this.imuEnabled,display:this.display,phase:this.phase};}
 predict(u,dt=.1){
  const enabled=this.imuEnabled,F=[1,dt,enabled?-.5*dt*dt:0,0,1,enabled?-dt:0,0,0,1],G=[.5*dt*dt,dt,0];
  const x=mv(F,this.x);if(enabled){x[0]+=G[0]*u;x[1]+=G[1]*u;}
  // Forward-only vehicle model; clipping does not declare a detected stop.
  x[0]=Math.max(this.x[0],x[0]);x[1]=Math.max(0,x[1]);this.x=x;
  const P=mul(mul(F,this.P,3),transpose(F,3),3),variance=(enabled?this.cfg.sigmaU:1)**2;
  for(let i=0;i<3;i++)for(let j=0;j<3;j++)P[i*3+j]+=G[i]*G[j]*variance;
  // Exact continuous bias-random-walk covariance, including its s/v cross terms.
  const Q=enabled?[dt**5/20,dt**4/8,-(dt**3)/6,dt**4/8,dt**3/3,-(dt**2)/2,-(dt**3)/6,-(dt**2)/2,dt]:[0,0,0,0,0,0,0,0,dt];
  this.P=P.map((p,i)=>p+this.cfg.qBias*Q[i]);
 }
 measure(z,index,R,gated=true){
  const H=[0,0,0];H[index]=1;const nu=z-this.x[index],S=quadratic(this.P,H)+R;
  if(gated&&nu*nu/S>6.63){this.gates.rejected++;return false;}
  const K=mv(this.P,H).map(p=>p/S),A=eye(3);
  for(let i=0;i<3;i++){this.x[i]+=K[i]*nu;for(let j=0;j<3;j++)A[i*3+j]-=K[i]*H[j];}
  const P=mul(mul(A,this.P,3),transpose(A,3),3);
  this.P=P.map((p,i)=>p+K[Math.floor(i/3)]*R*K[i%3]);this.x[1]=Math.max(0,this.x[1]);this.gates.accepted++;return true;
 }
 gnss(f,e){
  const recovery=this.phase==='recovery',p=this.map.project(f,this.x[0],recovery?1e6:Math.max(3*Math.sqrt(this.P[0]),50));
  if(f.accuracy>(recovery?15:this.phase==='degraded'?10:20)||f.sat<6||p.cross>Math.max(3*f.accuracy,10)){this.good=0;this.failed=[];return;}
  this.measure(f.v,1,2*Math.max(.1,f.speedAccuracy)**2);
  if(!recovery&&e.t-this.lastPosition<10)return;
  const R=Math.max(f.accuracy,3)**2;
  if(this.measure(p.s,0,(recovery?1:6)*R)){
   this.lastPosition=e.t;this.failed=[];this.good++;
  }else if(recovery){
   this.good=0;this.failed.push({s:p.s,t:e.t,v:f.v,R});this.failed=this.failed.slice(-3);
   if(this.failed.length===3){
    const q=this.failed.at(-1),positions=this.failed.map(p=>p.s+p.v*(q.t-p.t));
    if(Math.max(...positions)-Math.min(...positions)<2*Math.sqrt(2*R)){
     this.x[0]=positions.reduce((a,b)=>a+b)/3;this.x[1]=f.v;
     this.P=diag([R,2*Math.max(.1,f.speedAccuracy)**2,Math.max(this.P[8],.03**2)]);
     this.failed=[];this.good=3;this.lastPosition=e.t;
    }
   }
  }
  if(recovery&&this.good>=3){this.phase='open';}
 }
 step(e){
  if(e.sat===0)this.phase='tunnel';else if(e.sat>=4&&this.phase==='tunnel'){this.phase='recovery';this.good=0;this.failed=[];}else if(e.degraded&&this.phase==='open')this.phase='degraded';
  this.predict(e.u);
  const quiet=e.tf<.08&&e.tw<.3*RAD,slow=this.x[1]<.5&&Math.sqrt(this.P[4])<.5;
  if(this.stationary&&(!this.cfg.zupt||e.tf>.12||e.tw>.45*RAD||Math.abs(e.u-this.x[2])>.3))this.stationary=false;
  this.quietCount=this.cfg.zupt&&quiet&&slow?this.quietCount+1:0;
  if(this.quietCount>=5)this.stationary=true;
  if(this.stationary)this.measure(0,1,.05**2,false);
  if(e.fix&&this.phase!=='tunnel')this.gnss(e.fix,e);
  const error=this.x[0]-this.display;
  this.display=Math.abs(error)>100?this.x[0]:this.display+(this.x[1]+clamp(error/1.5,-.8*this.x[1],25))*.1;
  return this.output();
 }
}
