import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,readFileSync,writeFileSync,statSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {execFileSync} from 'node:child_process';
import {gunzipSync} from 'node:zlib';
import {createPlan,hash} from '../scripts/dataset-plan.js';
import {PARAMETERS} from '../dist/parameters.js';
import {quantile,clusterCI} from '../scripts/dataset-report.js';

test('Experiment plan covers every numeric endpoint and resolves paired references without seed leakage',()=>{
 const p=createPlan(),ids=new Set(p.runs.map(x=>x.run_id));assert.equal(p.runs.length,3180);assert.equal(ids.size,3180);
 assert.equal(p.runs.filter(x=>x.stage==='reference'&&x.split==='development').length,240);
 assert.ok(p.runs.every(x=>ids.has(x.baseline_id)));
 assert.ok(p.seeds.every(x=>!p.validationSeeds.includes(x)));
 for(const v of PARAMETERS)for(const [level,value] of [['low',v.min],['high',v.max]]){const rows=p.runs.filter(x=>x.factor===v.key&&x.level===level);assert.equal(rows.length,60);assert.ok(rows.every(x=>x.config[v.key]===value));}
});
test('Report quantiles and seed-cluster intervals have defined constant-data behaviour',()=>{
 assert.equal(quantile([0,10],.9),9);assert.deepEqual(clusterCI(Array.from({length:20},(_,seed)=>({seed,delta_rmse_m:3}))),[3,3]);
});
test('Batch output has valid time-series columns, resumes intact runs, repairs corruption and rejects another signature',()=>{
 const out=mkdtempSync(join(tmpdir(),'tunnel-dataset-test-'));const command=()=>execFileSync(process.execPath,['scripts/dataset.js','--out',out,'--workers','1','--limit','2'],{encoding:'utf8',stdio:['ignore','pipe','pipe']});
 try{
  command();const status=JSON.parse(readFileSync(join(out,'status.json')));assert.equal(status.completed,2);assert.equal(status.missing,0);
  const p=JSON.parse(readFileSync(join(out,'plan.json'))),path=join(out,'runs',p.runs[0].run_id+'.json'),r=JSON.parse(readFileSync(path)),series=join(out,r.timeseries_file),lines=gunzipSync(readFileSync(series)).toString().trim().split('\n'),width=lines[0].split(',').length;
  assert.equal(lines.length,r.samples+r.calibration_samples+1);assert.ok(lines.every(x=>x.split(',').length===width));assert.equal(hash(readFileSync(series)),r.timeseries_sha256);
  const before=statSync(path).mtimeMs;assert.match(command(),/"resumed":2/);assert.equal(statSync(path).mtimeMs,before);
  writeFileSync(series,'broken');assert.match(command(),/"pending":1/);assert.equal(hash(readFileSync(series)),JSON.parse(readFileSync(path)).timeseries_sha256);
  const manifest=join(out,'manifest.json'),m=JSON.parse(readFileSync(manifest));writeFileSync(manifest,JSON.stringify({...m,signature:'wrong'}));assert.throws(command);
 }finally{rmSync(out,{recursive:true,force:true});}
});
