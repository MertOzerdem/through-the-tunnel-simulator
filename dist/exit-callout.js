// Navigation observer only: no feedback into the driver, sensors, or estimators.
// Each trigger uses that model's raw along-track estimate, never its display clamp.
export class ExitCalloutRecorder {
 constructor(exitS,leadFraction=.2){
  if(!Number.isFinite(exitS)||exitS<=0||!Number.isFinite(leadFraction)||leadFraction<=0||leadFraction>=1)throw Error('Invalid exit callout geometry');
  this.exitS=exitS;this.triggerS=exitS*(1-leadFraction);this.leadFraction=leadFraction;
  this.events={truth:null,a:null,c:null,b:null};
 }
 step(row){
  const fired={};
  for(const key of ['truth','a','c','b']){
   const position=key==='truth'?row.s:row[key].s;
   fired[key]=this.events[key]===null&&position>=this.triggerS;
   if(fired[key])this.events[key]={time_s:row.t,estimated_s_m:position,truth_s_m:row.s,truth_remaining_to_exit_m:this.exitS-row.s,position_error_m:position-row.s,after_actual_exit:row.s>=this.exitS};
  }
  return fired;
 }
 summary(calibrationSeconds,entryTime){
  const reference=this.events.truth?.time_s;
  return{exit_s_m:this.exitS,trigger_s_m:this.triggerS,lead_fraction:this.leadFraction,sample_period_s:.1,events:Object.fromEntries(Object.entries(this.events).map(([key,event])=>[key,event?{...event,elapsed_s:event.time_s+calibrationSeconds,seconds_from_tunnel_entry:entryTime===null?null:event.time_s-entryTime,timing_error_s:reference===undefined?null:event.time_s-reference}:null]))};
 }
}
