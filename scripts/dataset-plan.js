import {createHash} from 'node:crypto';
import {CONFIG} from '../dist/simulation.js';
import {PARAMETERS} from '../dist/parameters.js';
export const PLAN_VERSION='1.0.0';
export const canonical=x=>JSON.stringify(x,(_,v)=>v&&typeof v==='object'&&!Array.isArray(v)?Object.fromEntries(Object.entries(v).sort(([a],[b])=>a.localeCompare(b))):v);
export const hash=x=>createHash('sha256').update(x).digest('hex');
export function createPlan(){
 const roads=['s','curve','straight'],profiles=['steady','slowdown','stop','wavespeed'],seeds=Array.from({length:20},(_,i)=>1001+i),validationSeeds=Array.from({length:10},(_,i)=>9001+i),runs=[];
 const id=config=>hash(canonical(config)).slice(0,16);
 function add(stage,split,road,profile,seed,changes={},factor='reference',level='default'){
  const config={...CONFIG,road,profile,seed,...changes},baselineConfig={...CONFIG,road,profile,seed};
  runs.push({run_id:id(config),baseline_id:id(baselineConfig),stage,split,factor,level,config});
 }
 for(const seed of seeds)for(const road of roads)for(const profile of profiles)add('reference','development',road,profile,seed);
 for(const p of PARAMETERS)for(const [level,value] of [['low',p.min],['high',p.max]])for(const seed of seeds)for(const road of roads)add('numeric','development',road,p.wave?'wavespeed':'slowdown',seed,{[p.key]:value},p.key,level);
 for(const key of ['useM1','useM5','useM6','useM7','useCZupt'])for(const seed of seeds)for(const road of roads)add('switch','development',road,['useM6','useCZupt'].includes(key)?'stop':'slowdown',seed,{[key]:false},key,'off');
 for(const [key,values] of [['phone',['good','poor']],['map',['typical']],['nisGate',[3.84,10.83]],['speed',[30,110]],['length',[500,5000]]])for(const value of values)for(const seed of seeds)for(const road of roads)add('selection','development',road,'slowdown',seed,{[key]:value},key,String(value));
 for(const seed of validationSeeds)for(const road of roads)for(const profile of profiles)add('reference','validation',road,profile,seed);
 const stresses=[
  ['short_noisy','slowdown',{preTunnelLength:250,phone:'poor',noiseScale:4,gnssSigma:15,gnssSpeedSigma:1}],
  ['long_bias','steady',{length:5000,accBiasMg:30,driftScale:5,phone:'poor'}],
  ['uncertain_stop','stop',{length:5000,preTunnelLength:1000,gnssSpeedSigma:1,noiseScale:4}],
  ['slow_waves','wavespeed',{length:5000,speed:30,waveAmplitude:35,waveDiffusion:8,driverSigma:3}],
  ['map_error','slowdown',{length:5000,map:'typical',headingSigma:.5,gnssSigma:8}],
  ['overconfident','wavespeed',{length:5000,noiseScale:4,driftScale:5,sigmaU:.03,cSigmaU:.03,qbetaScale:.1,cQbiasScale:.1}]
 ];
 for(const [name,profile,changes] of stresses)for(const seed of validationSeeds)for(const road of roads)add('stress','validation',road,profile,seed,changes,name,'combined');
 if(new Set(runs.map(r=>r.run_id)).size!==runs.length)throw Error('Duplicate scenario in plan');
 return {version:PLAN_VERSION,seeds,validationSeeds,runs};
}
