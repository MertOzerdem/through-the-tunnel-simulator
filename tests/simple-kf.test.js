import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {readFileSync} from 'node:fs';
import {SimpleKF} from '../dist/simple-kf.js';
import {diag,quadratic} from '../dist/math.js';
import {runSimulation} from '../dist/simulation.js';
const map={project:f=>({s:f.s,cross:0})};

test('C reproduces constant-acceleration kinematics and quadratic residual-bias drift',()=>{
 const f=new SimpleKF(map,0,20);f.x[2]=.02;
 for(let i=0;i<1000;i++)f.predict(.12);
 assert.ok(Math.abs(f.x[0]-2500)<1e-7);assert.ok(Math.abs(f.x[1]-30)<1e-9);
 const drift=new SimpleKF(map,0,20);
 for(let i=0;i<1000;i++)drift.predict(.02);
 assert.ok(Math.abs(drift.x[0]-2000-.5*.02*100**2)<1e-7);
 assert.equal(drift.x[2],0,'prediction alone cannot observe accelerometer bias');
 assert.ok(drift.output().sigma>100,'uncertainty grows without aiding');
});

test('C learns accelerometer bias from GNSS speed and keeps Joseph covariance positive semidefinite',()=>{
 const f=new SimpleKF(map,0,20);let s=0,v=20;
 for(let i=0;i<1500;i++){
  const a=.2*Math.sin(i/40);s+=v*.1+.5*a*.01;v+=a*.1;
  const e={t:i*.1,u:a+.18,tf:.2,tw:.1,sat:18,degraded:false};
  if(i%10===0)e.fix={s,v,accuracy:3,speedAccuracy:.05,sat:18};
  f.step(e);
  for(let j=0;j<3;j++)for(let k=0;k<3;k++)assert.ok(Math.abs(f.P[j*3+k]-f.P[k*3+j])<1e-9);
  for(let k=0;k<8;k++)assert.ok(quadratic(f.P,[Math.sin(k),Math.cos(k),Math.sin(2*k)])>=-1e-10);
 }
 assert.ok(Math.abs(f.x[2]-.18)<.005);
 assert.ok(Math.abs(f.x[1]-v)<.03);
 const saved=f.snapshot(),output=f.step({t:151,u:.2,tf:.2,tw:.1,sat:0});
 f.restore(saved);assert.deepEqual(f.step({t:151,u:.2,tf:.2,tw:.1,sat:0}),output);
});

test('C ZUPT requires low estimated speed and five quiet samples, and can be disabled',()=>{
 for(const [v,enabled,expected] of [[.1,true,true],[20,true,false],[.1,false,false]]){
  const f=new SimpleKF(map,0,v,{zupt:enabled});f.P=diag([1,.01,.0001]);
  for(let i=0;i<4;i++){f.step({t:i*.1,u:0,tf:0,tw:0,sat:0});assert.equal(f.stationary,false);}
  f.step({t:.4,u:0,tf:0,tw:0,sat:0});assert.equal(f.stationary,expected);
  f.step({t:.5,u:1,tf:.2,tw:0,sat:0});assert.equal(f.stationary,false);
 }
 const uncertain=new SimpleKF(map,0,.1);uncertain.P=diag([1,4,.0001]);
 for(let i=0;i<20;i++)uncertain.step({t:i*.1,u:0,tf:0,tw:0,sat:0});
 assert.equal(uncertain.stationary,false,'quiet IMU with uncertain velocity must not force a stop');
});

test('C reacquisition rejects outliers and recovers with consistent GNSS rather than portal information',()=>{
 const f=new SimpleKF(map,0,20);f.phase='tunnel';f.P=diag([1,.01,.0001]);
 const e={u:0,tf:.2,tw:.1,sat:18,degraded:false};
 f.step({...e,t:1,fix:{s:1000,v:20,accuracy:3,speedAccuracy:.1,sat:18}});
 assert.ok(f.x[0]<10);assert.equal(f.phase,'recovery');
 for(let i=2;i<=4;i++)f.step({...e,t:i,fix:{s:400+20*i,v:20,accuracy:3,speedAccuracy:.1,sat:18}});
 assert.equal(f.phase,'open');assert.ok(f.x[0]>470);
});

test('Adding C preserves every pre-existing Truth/A/B sample and summary in seven reference runs',()=>{
 const fixtures=JSON.parse(readFileSync(new URL('./fixtures/legacy-results.json',import.meta.url)));
 for(const {settings,sha256} of fixtures){
  const r=runSimulation(settings),rows=r.rows.map(({c,cU,...legacy})=>legacy);
  const {c,...calibration}=r.calibration,summary={a:r.summary.a,b:r.summary.b,recovery:{a:r.summary.recovery.a,b:r.summary.recovery.b}};
  assert.equal(createHash('sha256').update(JSON.stringify({rows,summary,calibration})).digest('hex'),sha256,JSON.stringify(settings));
 }
});

test('C settings never alter Truth/A/B and B settings never alter C',()=>{
 const a=runSimulation({profile:'wavespeed'}),c=runSimulation({profile:'wavespeed',cSigmaU:.5,cQbiasScale:10,useCZupt:false});
 for(let i=0;i<a.rows.length;i++){const {c:ca,cU:ua,...ra}=a.rows[i],{c:cb,cU:ub,...rb}=c.rows[i];assert.deepEqual(ra,rb);}
 assert.notDeepEqual(a.summary.c,c.summary.c);
 const b=runSimulation({profile:'wavespeed',sigmaU:.5,qbetaScale:10,sigmaM:3,headingSigma:5,nisGate:3.84,useM1:false,useM5:false,useM6:false,useM7:false});
 for(let i=0;i<a.rows.length;i++){assert.deepEqual(a.rows[i].c,b.rows[i].c);assert.equal(a.rows[i].cU,b.rows[i].cU);}
 assert.deepEqual(a.calibration.c,b.calibration.c);
});

test('C follows sensor braking, stays finite for all roads/profiles and exposes failed calibration',()=>{
 for(const road of ['s','curve','straight'])for(const profile of ['steady','slowdown','stop','wavespeed']){
  const r=runSimulation({road,profile,length:500});
  assert.ok(r.rows.every(x=>[x.c.s,x.c.v,x.c.beta,x.c.sigma,x.c.sigmaV,x.c.sigmaBeta,x.cU].every(Number.isFinite)));
  assert.ok(r.rows.every(x=>x.c.v>=0&&x.c.sigma>=0));assert.ok(r.rows.at(-1).c.phase==='open');
 }
 const r=runSimulation({profile:'steady',speedChanges:[{at:30,speed:30}]});
 assert.ok(r.rows[500].c.v<r.rows[299].c.v-10,'C responds to the physical braking input');
 const failed=runSimulation({gnssSigma:15,length:500});
 assert.equal(failed.calibration.c.ready,false);assert.ok(failed.rows.every(x=>!x.c.imuEnabled));
});
