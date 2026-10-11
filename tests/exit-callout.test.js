import test from 'node:test';
import assert from 'node:assert/strict';
import {ExitCalloutRecorder} from '../dist/exit-callout.js';
const row=(t,s,a=s,c=s,b=s)=>({t,s,a:{s:a},c:{s:c},b:{s:b}});
test('Callouts latch independently at the first observed threshold crossing',()=>{
 const r=new ExitCalloutRecorder(1000);
 assert.deepEqual(r.step(row(1,800,901,850,899)),{truth:false,a:true,c:false,b:false});
 assert.deepEqual(r.step(row(2,900,880,900,900)),{truth:true,a:false,c:true,b:true});
 r.step(row(3,1001,1001,1001,1001));
 const s=r.summary(180,.5);assert.equal(s.trigger_s_m,900);assert.equal(s.events.a.time_s,1);assert.equal(s.events.a.timing_error_s,-1);assert.equal(s.events.b.elapsed_s,182);assert.equal(s.events.truth.seconds_from_tunnel_entry,1.5);
});
test('Missing and late callouts remain distinguishable; initial overshoot is recorded',()=>{
 const r=new ExitCalloutRecorder(1000);
 r.step(row(1,950,950,100,100));r.step(row(2,1020,1000,100,950));
 const s=r.summary(0,0);assert.equal(s.events.c,null);assert.equal(s.events.b.after_actual_exit,true);assert.equal(s.events.b.timing_error_s,1);assert.equal(s.events.truth.time_s,1);
});
import {runSimulation} from '../dist/simulation.js';
test('All models record their first 10 Hz crossing of 90% of tunnel length',()=>{
 const a=runSimulation({length:500,profile:'steady'});
 assert.equal(a.summary.exitCallout.exit_s_m,500);assert.equal(a.summary.exitCallout.trigger_s_m,450);
 for(const k of ['truth','a','c','b']){
  const event=a.summary.exitCallout.events[k],fired=a.rows.filter((x,i)=>a.calloutFrames[i][k]);assert.equal(fired.length,1);assert.equal(fired[0].t,event.time_s);
  assert.equal(event.elapsed_s,event.time_s+a.calibration.seconds);
  const first=a.rows.find(x=>(k==='truth'?x.s:x[k].s)>=450);assert.equal(event.time_s,first.t);
 }
});
