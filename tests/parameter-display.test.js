import test from 'node:test';
import assert from 'node:assert/strict';
import {physicalParameterReadings} from '../dist/parameters.js';
import {CONFIG} from '../dist/simulation.js';

const values=(key,cfg=CONFIG)=>physicalParameterReadings(key,cfg).map(r=>r.value);
const near=(actual,expected)=>assert.ok(Math.abs(actual-expected)<1e-12,`${actual} ≠ ${expected}`);

test('white noise shows raw per-axis 100 Hz sample sigma, including idle noise',()=>{
 const [xy,z,idle,gyro]=values('noiseScale');
 near(xy,.31);near(z,.11);near(idle,.025);near(gyro,.04949747468305833);
 for(const [phone,factor] of [['good',.45],['typical',1],['poor',2]]){
  values('noiseScale',{...CONFIG,phone,noiseScale:4}).forEach((v,i)=>near(v,[xy,z,idle,gyro][i]*factor*4));
 }
});

test('drift displays random walk amplitude rather than process variance',()=>{
 const [acc,gyro]=values('driftScale');near(acc*acc,1e-7);near(gyro,.003);
 assert.deepEqual(values('driftScale',{...CONFIG,driftScale:0}),[0,0]);
 const scaled=values('driftScale',{...CONFIG,phone:'poor',driftScale:5});
 near(scaled[0],acc*10);near(scaled[1],.03);
});

test('fusion q follows phone preset; Kalman q remains independent',()=>{
 for(const [phone,base] of [['good',5e-6],['typical',1.5e-5],['poor',6e-5]]){
  for(const scale of [.1,1,10]){
   const cfg={...CONFIG,phone,qbetaScale:scale,cQbiasScale:scale};
   near(values('qbetaScale',cfg)[0],base*scale);
   near(values('cQbiasScale',cfg)[0],1.5e-5*scale);
  }
 }
});

test('physical display leaves stored scenario parameters intact',()=>{
 const cfg={...CONFIG},snapshot=JSON.stringify(cfg);
 for(const key of ['noiseScale','driftScale','qbetaScale','cQbiasScale']){
  assert.ok(physicalParameterReadings(key,cfg).every(r=>r.unit!=='×'));
 }
 assert.equal(physicalParameterReadings('gnssSigma',cfg),null);
 assert.equal(JSON.stringify(cfg),snapshot);
});
