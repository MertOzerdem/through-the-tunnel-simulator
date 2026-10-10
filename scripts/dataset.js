#!/usr/bin/env node
import {Worker} from 'node:worker_threads';
import {readFileSync,writeFileSync,mkdirSync,existsSync,renameSync,copyFileSync} from 'node:fs';
import {resolve,join} from 'node:path';
import {fileURLToPath} from 'node:url';
import {execFileSync} from 'node:child_process';
import {createPlan,canonical,hash} from './dataset-plan.js';
import {report} from './dataset-report.js';
const root=fileURLToPath(new URL('../',import.meta.url));
const args=process.argv.slice(2),arg=(name,fallback)=>{const i=args.indexOf(name);return i<0?fallback:args[i+1];};
if(args.includes('--help')){console.log('node scripts/dataset.js --out PATH [--workers 4] [--limit N] [--report-only]\nResume uses matching plan/engine hashes and verifies every completed time-series checksum. Failed or corrupt runs are retried.');process.exit(0);}
const out=resolve(arg('--out',join(root,'data/tunnel-dataset-v1'))),workers=Number(arg('--workers','4')),limit=Number(arg('--limit','Infinity'));
if(!Number.isInteger(workers)||workers<1||workers>16||!(limit>0))throw Error('Invalid workers or limit');
const full=createPlan(),plan={...full,runs:full.runs.slice(0,limit)},engineFiles=['parameters.js','math.js','road.js','estimator.js','simple-kf.js','world.js','simulation.js'];
const sourceFiles=[...engineFiles.map(x=>'dist/'+x),'scripts/dataset.js','scripts/dataset-plan.js','scripts/dataset-worker.js','scripts/dataset-report.js'];
const sourceHashes=Object.fromEntries(sourceFiles.map(f=>[f,hash(readFileSync(join(root,f)))])),signature=hash(canonical({sourceHashes,plan}));
for(const dir of [out,join(out,'runs'),join(out,'timeseries')])mkdirSync(dir,{recursive:true});
const manifestPath=join(out,'manifest.json');
if(existsSync(manifestPath)&&JSON.parse(readFileSync(manifestPath)).signature!==signature)throw Error('Existing dataset belongs to another plan or source revision. Use a different output directory.');
if(!existsSync(manifestPath)){
 let commit='unknown';try{commit=execFileSync('git',['rev-parse','HEAD'],{cwd:root,encoding:'utf8'}).trim();}catch{}
 writeFileSync(manifestPath,JSON.stringify({schema_version:1,signature,sourceHashes,git_commit:commit,node:process.version,platform:process.platform,arch:process.arch,created_at:new Date().toISOString(),workers,full_plan_runs:full.runs.length,selected_runs:plan.runs.length,partial:plan.runs.length!==full.runs.length},null,2));
 writeFileSync(join(out,'plan.json'),JSON.stringify(plan,null,2));
 for(const f of sourceFiles){const path=join(out,'source',f);mkdirSync(resolve(path,'..'),{recursive:true});copyFileSync(join(root,f),path);}
}
const pending=[];let skipped=0;
for(const job of plan.runs){try{const r=JSON.parse(readFileSync(join(out,'runs',job.run_id+'.json')));if(r.status==='complete'&&canonical(r.config)===canonical(job.config)&&hash(readFileSync(join(out,r.timeseries_file)))===r.timeseries_sha256){skipped++;continue;}}catch{}pending.push(job);}
console.log(JSON.stringify({planned:plan.runs.length,resumed:skipped,pending:pending.length,workers,out}));
if(args.includes('--report-only')&&pending.length)throw Error('Cannot report an incomplete or corrupt dataset; resume generation first.');
const started=performance.now();let cursor=0,done=skipped,failed=0;
if(!args.includes('--report-only')&&pending.length)await Promise.all(Array.from({length:Math.min(workers,pending.length)},()=>new Promise((resolve,reject)=>{
 const worker=new Worker(new URL('./dataset-worker.js',import.meta.url));let stopping=false;
 function dispatch(){if(cursor>=pending.length){stopping=true;worker.terminate().then(resolve);return;}worker.postMessage({job:pending[cursor++],out});}
 worker.on('message',m=>{done++;if(m.status==='failed'){failed++;console.error('FAILED',m.run_id,m.error);}if(done%50===0||done===plan.runs.length)console.log(JSON.stringify({done,total:plan.runs.length,failed,elapsed_s:+((performance.now()-started)/1000).toFixed(1)}));dispatch();});
 worker.on('error',reject);worker.on('exit',code=>{if(!stopping)reject(Error('Worker exited unexpectedly: '+code));});dispatch();
})));
const counts=report(out,plan),lines=[];
for(const job of plan.runs){const path=join(out,'runs',job.run_id+'.json');if(!existsSync(path))continue;lines.push(`${hash(readFileSync(path))}  runs/${job.run_id}.json`);const r=JSON.parse(readFileSync(path));if(r.status==='complete')lines.push(`${r.timeseries_sha256}  ${r.timeseries_file}`);}
for(const file of sourceFiles)lines.push(`${hash(readFileSync(join(out,'source',file)))}  source/${file}`);
for(const name of ['manifest.json','plan.json','metrics.csv','paired_comparisons.csv','aggregates.csv','effects.csv','checks.csv','failures.csv','status.json','REPORT.md'])lines.push(`${hash(readFileSync(join(out,name)))}  ${name}`);
writeFileSync(join(out,'checksums.sha256.tmp'),lines.join('\n')+'\n');renameSync(join(out,'checksums.sha256.tmp'),join(out,'checksums.sha256'));
console.log(JSON.stringify({...counts,elapsed_s:(performance.now()-started)/1000}));
if(counts.failed||counts.missing||counts.invariant_failures)process.exitCode=1;
