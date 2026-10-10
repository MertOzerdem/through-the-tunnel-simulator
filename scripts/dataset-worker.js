import {parentPort} from 'node:worker_threads';
import {writeFileSync,renameSync} from 'node:fs';
import {join} from 'node:path';
import {gzipSync} from 'node:zlib';
import {createHash} from 'node:crypto';
import {runSimulation} from '../dist/simulation.js';
const digest=x=>createHash('sha256').update(x).digest('hex');
const MODEL=['a','c','b'];
const number=x=>typeof x==='number'?Number(x.toFixed(9)):x;
const fields=['t_from_calibration_end_s','elapsed_s','truth_s_m','truth_v_mps','truth_a_mps2','target_kmh','phase','satellites','gnss_fix','A_s_m','A_v_mps','A_sigma_m','C_s_m','C_v_mps','C_sigma_m','C_bias_mps2','C_sigma_bias_mps2','C_stationary','C_imu_enabled','C_u_mps2','B_s_m','B_v_mps','B_sigma_m','B_manoeuvre_probability','B_bias_mps2','B_stationary','B_u_mps2','gyro_omega_radps'];
function fingerprint(rows,fn){return digest(JSON.stringify(rows.map(fn)));}
parentPort.on('message',({job,out})=>{
 const started=performance.now();
 try{
  const r=runSimulation(job.config),inside=r.rows.filter(x=>x.s>=0&&x.s<=r.cfg.length),last=r.rows.at(-1),models={};
  if(!inside.length||r.entryTime===null||r.exitTime===null||last.s<=r.cfg.length)throw Error('Incomplete tunnel traversal');
  for(const row of r.rows)for(const k of MODEL)if(![row.t,row.s,row.v,row[k].s,row[k].v,row[k].sigma,row.u,row.omega,row.cU,row.c.beta,row.c.sigmaBeta,row.b.beta].every(Number.isFinite)||row[k].v<0||row[k].sigma<0)throw Error('Invalid numeric output');
  for(const k of MODEL){
   const after=r.rows.filter(x=>x.t>=r.exitTime),stable=after.findIndex((x,i)=>after.slice(i).every(y=>Math.abs(y[k].s-y.s)<=10));
   models[k]={...r.summary[k],speed_rmse_mps:Math.sqrt(inside.reduce((s,x)=>s+(x[k].v-x.v)**2,0)/inside.length),all_estimation_peak_m:Math.max(...r.rows.map(x=>Math.abs(x[k].s-x.s))),exit_abs_error_m:Math.abs(after[0][k].s-after[0].s),final_abs_error_m:r.summary.recovery[k],recovery_to_stable_10m_s:stable<0?null:after[stable].t-r.exitTime,recovery_censored:stable<0,stopped_samples:inside.filter(x=>x.v<.1).length,detected_stopped_samples:k==='a'?0:inside.filter(x=>x.v<.1&&x[k].stationary).length};
  }
  const lines=[fields.join(',')];
  for(const x of r.calibrationRows)lines.push([x.t,x.t+r.calibration.seconds,x.s,x.v,'',x.target,'calibration',...Array(fields.length-7).fill('')].map(number).join(','));
  for(const x of r.rows)lines.push([x.t,x.t+r.calibration.seconds,x.s,x.v,x.truthAcceleration,x.target,x.phase,x.sat,Number(x.gnss),x.a.s,x.a.v,x.a.sigma,x.c.s,x.c.v,x.c.sigma,x.c.beta,x.c.sigmaBeta,Number(x.c.stationary),Number(x.c.imuEnabled),x.cU,x.b.s,x.b.v,x.b.sigma,x.b.mu,x.b.beta,Number(x.b.stationary),x.u,x.omega].map(number).join(','));
  const blob=gzipSync(lines.join('\n')+'\n',{level:6}),relative=`timeseries/${job.run_id}.csv.gz`,path=join(out,relative);writeFileSync(path+'.tmp',blob);renameSync(path+'.tmp',path);
  const result={...job,status:'complete',compute_seconds:(performance.now()-started)/1000,entry_time_s:r.entryTime,exit_time_s:r.exitTime,duration_s:r.duration,calibration:r.calibration,gates:r.endGates,models,samples:r.rows.length,calibration_samples:r.calibrationRows.length,timeseries_file:relative,timeseries_sha256:digest(blob),fingerprints:{truth:fingerprint(r.rows,x=>[x.t,x.s,x.v,x.truthAcceleration,x.target]),a:fingerprint(r.rows,x=>x.a),b:fingerprint(r.rows,x=>x.b),c:fingerprint(r.rows,x=>[x.c,x.cU])}};
  const rp=join(out,'runs',job.run_id+'.json');writeFileSync(rp+'.tmp',JSON.stringify(result));renameSync(rp+'.tmp',rp);parentPort.postMessage({run_id:job.run_id,status:'complete'});
 }catch(error){const result={...job,status:'failed',error:error.stack,compute_seconds:(performance.now()-started)/1000};const rp=join(out,'runs',job.run_id+'.json');writeFileSync(rp+'.tmp',JSON.stringify(result));renameSync(rp+'.tmp',rp);parentPort.postMessage({run_id:job.run_id,status:'failed',error:error.message});}
});
