import {parameterDefaults,validateParameters} from './parameters.js';
import {RAD,diag} from './math.js';
import {makeRoad,makeMap} from './road.js';
import {World,Phone,calibrate,Preprocessor} from './world.js';
import {Estimators} from './estimator.js';
export const CONFIG={road:'s',length:2000,speed:80,profile:'slowdown',phone:'typical',map:'perfect',seed:42,speedChanges:[],...parameterDefaults(),useM1:true,useM5:true,useM6:true,useM7:true,nisGate:6.63};
// Only sensor messages cross this boundary. Truth never enters Estimators.
class ReplayHarness{
 constructor(est){this.est=est;this.buffer=[];this.queue=[];this.index=0;this.replays=0;}
 step(input){const i=this.index++,fix=input.fix;delete input.fix;if(fix)this.queue.push({due:i+3,at:i,fix});const row={i,input:{...input},before:this.est.snapshot()};this.buffer.push(row);let output=this.est.step(row.input);
  while(this.queue.length&&this.queue[0].due<=i){const f=this.queue.shift(),at=this.buffer.findIndex(x=>x.i===f.at);if(at<0)continue;this.buffer[at].input.fix=f.fix;this.est.restore(this.buffer[at].before);for(let j=at;j<this.buffer.length;j++){this.buffer[j].before=this.est.snapshot();output=this.est.step(this.buffer[j].input);}this.replays++;}
  if(this.buffer.length>100)this.buffer.shift();return output;
 }
}
export function runSimulation(settings={},progress=()=>{}){
 const cfg={...CONFIG,...settings};if(!['s','curve','straight'].includes(cfg.road)||!Number.isInteger(cfg.length)||cfg.length<500||cfg.length>5000||!Number.isFinite(cfg.speed)||cfg.speed<30||cfg.speed>110)throw Error('Geçersiz senaryo');
 if(!Array.isArray(cfg.speedChanges)||cfg.speedChanges.some((e,i)=>!Number.isFinite(e.at)||e.at<0||Math.abs(e.at*10-Math.round(e.at*10))>1e-6||!Number.isFinite(e.speed)||e.speed<30||e.speed>110||(i>0&&e.at<=cfg.speedChanges[i-1].at)))throw Error('Geçersiz hız komutu');
 validateParameters(cfg);if(!['steady','slowdown','stop','wavespeed'].includes(cfg.profile)||!['good','typical','poor'].includes(cfg.phone)||!['perfect','typical'].includes(cfg.map))throw Error('Geçersiz önayar');
 const commands=cfg.speedChanges.map(e=>({tick:Math.round(e.at*10),speed:e.speed}));let commandIndex=0;
 const road=makeRoad(cfg.road,cfg.length),map=makeMap(road,cfg.map,cfg.seed),world=new World(road,cfg),warm=[];
 progress(.05);for(let i=0;i<1800;i++)warm.push(world.frame(true));const origin=world.s+200;for(const f of warm)f.s-=origin;
 const phone=new Phone(road,map,cfg),calFrames=warm.map((raw,i)=>{const e=phone.event(raw,i);return{f:raw.f,w:raw.w,...e};});
 const alignment=calibrate(calFrames),first=calFrames[0].fix,firstS=map.project(first).s;
 // Calibration uses exclusively the 180 s pre-tunnel sensor history, never a truth pose.
 const pre=new Preprocessor(alignment,first.course),est=new Estimators(map,{x:[firstS,first.v,0,0,0,0],P:diag([25,.3**2,1,.3**2,(3*RAD)**2,(.5*RAD)**2])},{m1:cfg.useM1,qbeta:(cfg.phone==='good'?5e-6:cfg.phone==='poor'?6e-5:1.5e-5)*cfg.qbetaScale,sigmaU:cfg.sigmaU,sigmaM:cfg.sigmaM,headingSigma:cfg.headingSigma*RAD,nisGate:cfg.nisGate,mapHeading:cfg.useM5,zupt:cfg.useM6,portal:cfg.useM7}),harness=new ReplayHarness(est);
 let result;for(let i=0;i<warm.length;i++){const raw=warm[i],e=pre.step({...raw,t:raw.t-180},map.at(est.b.output().x[0]).psi),sensor=calFrames[i];result=harness.step({...e,sat:sensor.sat,degraded:sensor.degraded,fix:sensor.fix});}
 const entryCov=est.b.output().P,readiness=result.b.sigmaV<=.2&&Math.sqrt(entryCov[21])<=.02&&Math.sqrt(entryCov[28])<=1*RAD&&Math.sqrt(entryCov[35])<=.01*RAD&&alignment.qualifying>=20;
 const m1Enabled=readiness&&cfg.useM1;
 if(!m1Enabled){est.b.cfg.m1=false;est.b.cfg.qdrv=.27;}
 world.s=-200;world.t=0;world.eventStarted=false;world.eventEnd=null;phone.portalTime=null;phone.recoveryFix=0;phone.posErr=[0,0];
 // Warm-up GNSS latency is cleared at the presentation boundary by consuming its final 3 queued ticks.
 harness.queue=[];harness.buffer=[];
 const slowest=Math.min(cfg.profile==='wavespeed'?Math.max(10,cfg.speed-cfg.waveAmplitude):cfg.speed,...commands.map(e=>e.speed)),rows=[],maxSeconds=cfg.length/(slowest/3.6)*2+240;let entryTime=null,exitTime=null;
 progress(.25);
 for(let i=0;i<Math.ceil(maxSeconds*10);i++){
  // Command at t applies to the next 10 Hz frame. Recomputing preserves every earlier sample.
  while(commandIndex<commands.length&&commands[commandIndex].tick<=i)world.manualTarget=commands[commandIndex++].speed/3.6;
  const raw=world.frame(),e=pre.step(raw,map.at(est.b.output().x[0]).psi),sensor=phone.event(raw,i);result=harness.step({...e,...sensor});
  if(raw.s>=0&&entryTime===null)entryTime=raw.t;if(raw.s>=cfg.length&&exitTime===null)exitTime=raw.t;
  rows.push({t:raw.t,s:raw.s,v:raw.v,truthAcceleration:raw.a,yaw:raw.yaw,target:world.lastTarget*3.6,...result,u:e.u,omega:e.omega,sat:sensor.sat,gnss:!!sensor.fix});
  if(i%300===0)progress(.25+.7*Math.min(1,raw.s/cfg.length));
  if(exitTime!==null&&raw.t>exitTime+18)break;
 }
 const inside=rows.filter(r=>r.s>=0&&r.s<=cfg.length),summary={};
 for(const key of ['a','b']){const errors=inside.map(r=>r[key].s-r.s),squares=errors.map(e=>e*e);summary[key]={rmse:Math.sqrt(squares.reduce((a,b)=>a+b,0)/errors.length),peak:Math.max(...errors.map(Math.abs)),coverage:inside.filter(r=>Math.abs(r[key].s-r.s)<=2*r[key].sigma).length/inside.length,within50:errors.filter(e=>Math.abs(e)<=50).length/errors.length};}
 const final=rows.at(-1);summary.recovery={a:Math.abs(final.a.s-final.s),b:Math.abs(final.b.s-final.s)};
 progress(1);return{cfg,rows,summary,entryTime,exitTime,duration:final.t,road:road.pts.filter((_,i)=>i%4===0||i===cfg.length),mapPoints:Array.from({length:Math.floor((cfg.length+500)/4)+1},(_,i)=>map.at(-250+i*4)),calibration:{seconds:180,qualifying:alignment.qualifying,ready:readiness,m1Enabled,sigmaBeta:Math.sqrt(entryCov[21]),replays:harness.replays},endGates:final.gates};
}
