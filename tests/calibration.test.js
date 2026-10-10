import test from 'node:test';
import assert from 'node:assert/strict';
import {runSimulation} from '../dist/simulation.js';

test('The visible approach is measured physical travel with a continuous 10 Hz boundary',()=>{
 const r=runSimulation({preTunnelLength:4200});const a=r.calibrationRows;
 assert.ok(Math.abs(r.calibration.seconds-180)<5);
 assert.equal(a.length,r.calibration.seconds*10);
 assert.ok(Math.abs(a[0].s+4200)<4);assert.ok(Math.abs(a.at(-1).s+200)<1e-8);
 for(let i=1;i<a.length;i++){
  assert.ok(Math.abs(a[i].t-a[i-1].t-.1)<1e-8);
  assert.ok(Math.abs(a[i].s-a[i-1].s-(a[i].v+a[i-1].v)*.05)<.001);
 }
 assert.ok(Math.abs(r.rows[0].v-a.at(-1).v)<.2);
 assert.ok(Math.abs(r.rows[0].s-a.at(-1).s-(r.rows[0].v+a.at(-1).v)*.05)<.001);
 assert.ok(a.every(x=>x.phase==='calibration'&&!('a' in x)&&!('b' in x)&&!('c' in x)),'future-calibrated estimates must not be exposed as online approach estimates');
 assert.deepEqual(r,runSimulation({preTunnelLength:4200}));
});

test('Short approach disables unready IMU channels; duration depends on actual speed',()=>{
 const short=runSimulation({preTunnelLength:250}),long=runSimulation({preTunnelLength:4200});
 assert.ok(short.calibration.seconds<long.calibration.seconds);
 assert.equal(short.calibration.ready,false);assert.equal(short.calibration.c.ready,false);
 assert.equal(short.calibration.m1Enabled,false);assert.ok(short.rows.every(r=>!r.c.imuEnabled));
 assert.equal(long.calibration.ready,true);assert.equal(long.calibration.c.ready,true);
 const slow=runSimulation({preTunnelLength:1000,speed:30}),fast=runSimulation({preTunnelLength:1000,speed:110});
 assert.ok(slow.calibration.seconds>fast.calibration.seconds);
 for(const r of [short,long,slow,fast])assert.ok(r.rows.every(r=>[r.b.s,r.b.v,r.b.sigma,r.c.s,r.c.v,r.c.sigma].every(Number.isFinite)));
});
