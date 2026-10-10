import {clamp,RAD,RNG} from './math.js';
// Piecewise-linear curvature = straight / clothoid / circular arc.
function lobe(u,a,b,ramp){if(u<=a||u>=b)return 0;return Math.min(1,(u-a)/ramp,(b-u)/ramp);}
export function makeRoad(type,L){
 const k=u=>type==='straight'?0:type==='curve'?Math.min(1/500,1.8/L)*lobe(u,.12,.88,.16):Math.min(1/400,2.5/L)*(lobe(u,.03,.5,.16)-lobe(u,.5,.97,.16));
 const start=type==='s'?-Math.min(1/400,2.5/L)*L*.31/2:type==='curve'?-.45:0;
 const pts=[{s:0,x:0,y:0,psi:start,k:k(0)}];
 for(let s=1;s<=L;s++){const p=pts[s-1],km=k((s-.5)/L),psi=p.psi+km;pts.push({s,x:p.x+Math.cos(p.psi+km/2),y:p.y+Math.sin(p.psi+km/2),psi,k:k(s/L)});}
 const at=s=>{if(s<0){const p=pts[0];return {...p,s,x:p.x+s*Math.cos(p.psi),y:p.y+s*Math.sin(p.psi),k:0};}if(s>L){const p=pts[L],d=s-L;return {...p,s,x:p.x+d*Math.cos(p.psi),y:p.y+d*Math.sin(p.psi),k:0};}const i=Math.floor(s),p=pts[i],q=pts[Math.min(i+1,L)],f=s-i;return {s,x:p.x+f*(q.x-p.x),y:p.y+f*(q.y-p.y),psi:p.psi+f*(q.psi-p.psi),k:p.k+f*(q.k-p.k)};};
 return {type,L,pts,at};
}
export function makeMap(road,preset,seed){
 const r=new RNG(seed+901),typical=preset==='typical',lengthScale=typical?1+.003*r.normal():1;
 const knots=Array.from({length:Math.ceil((road.L+12000)/100)+5},()=>typical?1.5*r.normal():0);
 function offset(s){const u=(s+6000)/100,i=clamp(Math.floor(u),0,knots.length-2),f=clamp(u-i,0,1),h=f*f*(3-2*f);return knots[i]*(1-h)+knots[i+1]*h;}
 function point(s){const p=road.at(s/lengthScale),e=offset(s);return{x:p.x-Math.sin(p.psi)*e,y:p.y+Math.cos(p.psi)*e};}
 function heading(s){const p=point(s-.5),q=point(s+.5);return Math.atan2(q.y-p.y,q.x-p.x);}
 function at(s){return {...point(s),s,psi:heading(s),k:Math.atan2(Math.sin(heading(s+1)-heading(s-1)),Math.cos(heading(s+1)-heading(s-1)))/2};}
 function project(p,center=0,radius=1e6){const lo=Math.max(-6000,center-radius),hi=Math.min(road.L+6000,center+radius);let best=lo,d=Infinity;for(let s=lo;s<=hi;s+=5){const q=point(s),v=(p.x-q.x)**2+(p.y-q.y)**2;if(v<d){d=v;best=s;}}let a=Math.max(lo,best-6),b=Math.min(hi,best+6);for(let i=0;i<18;i++){const c=a+(b-a)/3,e=b-(b-a)/3,pc=point(c),pe=point(e);if((p.x-pc.x)**2+(p.y-pc.y)**2<(p.x-pe.x)**2+(p.y-pe.y)**2)b=e;else a=c;}const s=(a+b)/2,q=point(s);return{s,cross:Math.hypot(p.x-q.x,p.y-q.y)};}
 return{L:road.L*lengthScale,in:typical?10*r.normal():0,out:road.L*lengthScale+(typical?10*r.normal():0),at,project,typical,lengthScale,headingNoise:1.5*RAD};
}
