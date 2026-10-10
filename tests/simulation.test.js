import test from 'node:test';
import assert from 'node:assert/strict';
import {IMM,Estimators,baselineVariance} from '../dist/estimator.js';
import {makeRoad,makeMap} from '../dist/road.js';
import {diag,quadratic,RAD} from '../dist/math.js';
import {runSimulation} from '../dist/simulation.js';

test('A uncertainty reproduces PDF Eq 6.2 reference values',()=>{
 for(const [t,expected] of [[60,42],[120,102],[180,165]])assert.ok(Math.abs(Math.sqrt(baselineVariance(t))-expected)<1);
});
test('IMM prediction follows Eq 2.4 and uses a row-stochastic transition matrix',()=>{
 const f=new IMM([10,20,1,.1,.2,.01],diag([1,1,1,1,1,1]));f.predict();const o=f.output();assert.ok(Math.abs(o.x[0]-12.005)<1e-10);assert.ok(Math.abs(o.x[1]-20.1)<1e-10);assert.ok(Math.abs(o.x[4]-.201)<1e-10);assert.ok(Math.abs(o.mu[0]+o.mu[1]-1)<1e-12);
});
test('Joseph updates stay symmetric positive semidefinite',()=>{
 const f=new IMM();for(let i=0;i<200;i++){f.predict();f.measure('M1',Math.sin(i/17),x=>({h:x[2]+x[3],H:[0,0,1,1,0,0]}),.01,false);for(const m of f.f){for(let a=0;a<6;a++){assert.ok(m.P[a*6+a]>=0);for(let b=0;b<6;b++)assert.ok(Math.abs(m.P[a*6+b]-m.P[b*6+a])<1e-8);}for(let k=0;k<12;k++){const h=Array.from({length:6},(_,j)=>Math.sin(k+j*1.7));assert.ok(quadratic(m.P,h)>-1e-9);}}}
});
test('G1 rejects the same scalar observation in both modes',()=>{const f=new IMM();const before=f.snapshot();assert.equal(f.scalar('M2',10000,0,9),false);assert.deepEqual(f.f,before.f);});
test('Three road types have continuous portal tangents, unit arc length and smooth curvature',()=>{
 for(const type of ['s','curve','straight'])for(const L of [500,2000,5000]){const r=makeRoad(type,L);assert.equal(r.pts.length,L+1);for(const s of [0,L]){assert.ok(Math.abs(r.at(s-.001).psi-r.at(s+.001).psi)<1e-5);assert.ok(Math.abs(r.at(s).k)<1e-12);}for(let i=1;i<r.pts.length;i++){const p=r.pts[i-1],q=r.pts[i];assert.ok(Math.abs(Math.hypot(q.x-p.x,q.y-p.y)-1)<1e-10);assert.ok(Math.abs(q.k-p.k)<.00004);}if(type==='s'){assert.ok(r.pts.some(p=>p.k>0));assert.ok(r.pts.some(p=>p.k<0));}if(type==='straight')assert.ok(r.pts.every(p=>p.k===0));}
});
test('G5 blocks an ambiguous wide S-curve heading update',()=>{
 const road=makeRoad('s',2000),map=makeMap(road,'perfect',1),est=new Estimators(map,{x:[1000,20,0,0,0,0],P:diag([500**2,.01,.01,.0001,RAD**2,(.003*RAD)**2])});est.lastHeading=0;const o=est.step({t:1,u:0,omega:0,psi:map.at(1000).psi,tf:.2,tw:1,sat:0});assert.equal(o.gates.ambiguous,1);
});
test('Seeded replay is deterministic and B follows braking rather than truth position',()=>{
 const a=runSimulation(),b=runSimulation();assert.deepEqual(a,b);assert.ok(a.summary.a.rmse>200);assert.ok(a.summary.b.rmse<a.summary.a.rmse/4);assert.ok(a.calibration.qualifying>=20);assert.ok(a.calibration.replays>0);assert.ok(a.rows.some(r=>r.phase==='tunnel'));assert.equal(a.rows.at(-1).phase,'open');
});
test('Sensor-based standstill freezes B while A keeps coasting',()=>{
 const r=runSimulation({profile:'stop'}),stopped=r.rows.filter(x=>x.v<.1&&x.s>0),detected=stopped.filter(x=>x.b.stationary);assert.ok(stopped.length>300);assert.ok(detected.length/stopped.length>.9);assert.ok(detected.every(x=>x.b.v<.1));assert.ok(stopped.every(x=>x.a.v>15));assert.ok(r.summary.a.peak>1000);
});
test('All geometry/profile combinations remain finite over the configured length range',()=>{
 for(const road of ['s','curve','straight'])for(const length of [500,5000])for(const profile of ['steady','slowdown','stop']){const r=runSimulation({road,length,profile});assert.ok(r.exitTime>r.entryTime);assert.ok(r.rows.at(-1).s>length);for(const row of r.rows){for(const k of ['a','b']){assert.ok(Number.isFinite(row[k].s));assert.ok(Number.isFinite(row[k].sigma));assert.ok(row[k].v>=0);}assert.ok(row.b.mu>=0&&row.b.mu<=1);}}
});
test('Live speed commands preserve the full past and change truth continuously through IMU',()=>{
 const settings={profile:'steady'},before=runSimulation(settings),speedChanges=[{at:30,speed:30},{at:65,speed:110}],after=runSimulation({...settings,speedChanges});
 assert.deepEqual(after.rows.slice(0,300),before.rows.slice(0,300));
 assert.ok(Math.abs(after.rows[300].target-30)<1e-10);assert.ok(Math.abs(after.rows[650].target-110)<1e-10);
 assert.ok(Math.abs(after.rows[300].v-after.rows[299].v)<.2,'speed cannot teleport');
 assert.ok(Math.abs(after.rows[500].v*3.6-30)<5,'driver slows down');
 assert.ok(after.rows[850].v>after.rows[649].v+15,'driver accelerates');
 assert.ok(after.rows[310].u<before.rows[310].u-1,'braking is visible in the physical sensor');
 assert.ok(after.rows[500].a.v>18,'A keeps its last GNSS speed');
 assert.ok(Math.abs(after.rows[500].b.v-after.rows[500].v)<2,'B responds to sensor braking');
 assert.ok(after.exitTime>after.entryTime);assert.deepEqual(after,runSimulation({...settings,speedChanges}));
});
test('A manual speed command replaces the remaining automatic driving profile',()=>{
 const result=runSimulation({profile:'stop',speedChanges:[{at:12,speed:60}]});
 assert.ok(result.rows.slice(120).every(r=>Math.abs(r.target-60)<1e-10));assert.ok(result.exitTime>result.entryTime);
 for(const speedChanges of [[{at:-1,speed:50}],[{at:10,speed:111}],[{at:10,speed:50},{at:9,speed:80}],[{at:.15,speed:50}]])assert.throws(()=>runSimulation({speedChanges}),/Geçersiz hız komutu/);
});

test('Wavespeed is a deterministic bounded random walk followed with continuous acceleration',()=>{
 const cfg={profile:'wavespeed',speed:80,waveAmplitude:20,waveDiffusion:5,driverSigma:0},r=runSimulation(cfg);
 assert.deepEqual(r,runSimulation(cfg));
 const targets=r.rows.map(x=>x.target),speeds=r.rows.map(x=>x.v*3.6);
 assert.ok(Math.min(...targets)>=60-1e-10&&Math.max(...targets)<=100+1e-10);
 assert.ok(Math.max(...speeds)-Math.min(...speeds)>10,'physical speed varies, not just the displayed target');
 for(let i=1;i<r.rows.length;i++){assert.ok(Math.abs(r.rows[i].truthAcceleration-r.rows[i-1].truthAcceleration)<=.2000001);assert.ok(Math.abs(r.rows[i].v-r.rows[i-1].v)<.2);}
 const zero=runSimulation({...cfg,waveAmplitude:0}),steady=runSimulation({profile:'steady',driverSigma:0});
 assert.deepEqual(zero.rows,steady.rows,'zero amplitude reduces to the same physical cruise');
 const edited=runSimulation({...cfg,speedChanges:[{at:30,speed:50}]});assert.deepEqual(edited.rows.slice(0,300),r.rows.slice(0,300));assert.ok(edited.rows.slice(300).every(x=>Math.abs(x.target-50)<1e-10));
});
test('B tuning and ablation never change truth or Approach A',()=>{
 const base=runSimulation(),variant=runSimulation({useM1:false,useM5:false,useM6:false,useM7:false,sigmaU:.5,qbetaScale:10,sigmaM:3,headingSigma:5,nisGate:3.84});
 assert.equal(base.rows.length,variant.rows.length);assert.equal(variant.calibration.m1Enabled,false);
 for(let i=0;i<base.rows.length;i++){const a=base.rows[i],b=variant.rows[i];assert.equal(a.s,b.s);assert.equal(a.v,b.v);assert.equal(a.target,b.target);assert.deepEqual(a.a,b.a);}
 assert.notDeepEqual(base.summary.b,variant.summary.b);
 const noStop=runSimulation({profile:'stop',useM6:false});assert.ok(noStop.rows.every(x=>!x.b.stationary));
});
test('Sensor settings affect measurements but preserve the seeded physical drive',()=>{
 const a=runSimulation(),b=runSimulation({noiseScale:4,accBiasMg:30,driftScale:5,gnssSigma:8,gnssSpeedSigma:1});
 for(let i=0;i<a.rows.length;i++){assert.equal(a.rows[i].s,b.rows[i].s);assert.equal(a.rows[i].v,b.rows[i].v);}
 assert.notEqual(a.rows[500].u,b.rows[500].u);assert.notDeepEqual(a.summary,b.summary);
});

test('Each B measurement switch independently removes its update',()=>{
 for(const [key,id] of [['m1','M1'],['mapHeading','M5'],['zupt','M6 v'],['portal','M7']]){
  const observed=[];
  for(const enabled of [true,false]){
   const map=makeMap(makeRoad('straight',2000),'perfect',42),s=key==='portal'?2000:200;
   const est=new Estimators(map,{x:[s,key==='zupt'?0:20,0,0,0,0],P:diag([25,.01,.1,.0001,.0001,.0001])},{[key]:enabled});
   if(key==='portal')est.phase='tunnel';if(key==='mapHeading')est.lastHeading=s-101;const ids=[],original=est.b.measure.bind(est.b);est.b.measure=(id,...args)=>{ids.push(id);return original(id,...args);};
   est.step({t:1,u:0,omega:0,psi:0,tf:key==='zupt'?0:1,tw:key==='zupt'?0:1,sat:key==='portal'?5:0});observed.push(ids.includes(id));
  }
  assert.deepEqual(observed,[true,false],key);
 }
});
test('Exposed numeric ranges stay finite at every endpoint and reject invalid inputs',async()=>{
 const {PARAMETERS}=await import('../dist/parameters.js');
 for(const p of PARAMETERS)for(const value of [p.min,p.max]){
  const r=runSimulation({profile:'wavespeed',length:500,[p.key]:value});assert.ok(r.exitTime>r.entryTime,p.key);
  for(const row of r.rows)assert.ok([row.s,row.v,row.b.s,row.b.sigma,row.b.beta].every(Number.isFinite),p.key);
 }
 const stress=runSimulation({profile:'wavespeed',road:'straight',length:5000,speed:30,waveAmplitude:35,waveDiffusion:8,driverSigma:3,noiseScale:4,accBiasMg:30,driftScale:5,gnssSigma:15,gnssSpeedSigma:1,qbetaScale:10});
 assert.ok(stress.exitTime>stress.entryTime);assert.ok(stress.rows.every(r=>[r.b.s,r.b.sigma,r.b.v].every(Number.isFinite)));
 assert.throws(()=>runSimulation({noiseScale:NaN}),/Geçersiz parametre/);assert.throws(()=>runSimulation({useM5:0}),/Geçersiz filtre/);assert.throws(()=>runSimulation({nisGate:0}),/Geçersiz NIS/);
});
