export const RAD=Math.PI/180;
export const clamp=(x,a,b)=>Math.max(a,Math.min(b,x));
export const wrap=x=>Math.atan2(Math.sin(x),Math.cos(x));
export const dot=(a,b)=>a.reduce((s,v,i)=>s+v*b[i],0);
export const norm=a=>Math.sqrt(dot(a,a));
export const unit=a=>a.map(x=>x/(norm(a)||1));
export const cross=(a,b)=>[a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]];
export const add=(a,b)=>a.map((v,i)=>v+b[i]);
export const scale=(a,k)=>a.map(v=>v*k);
export const eye=n=>Array.from({length:n*n},(_,i)=>i%(n+1)===0?1:0);
export const diag=a=>a.flatMap((v,i)=>a.map((_,j)=>i===j?v:0));
export const transpose=(a,n=6)=>a.map((_,i)=>a[(i%n)*n+Math.floor(i/n)]);
export function mul(a,b,n=6){const c=Array(n*n).fill(0);for(let i=0;i<n;i++)for(let k=0;k<n;k++){const x=a[i*n+k];if(x)for(let j=0;j<n;j++)c[i*n+j]+=x*b[k*n+j];}return c;}
export const mv=(a,x)=>x.map((_,i)=>dot(a.slice(i*x.length,(i+1)*x.length),x));
export function quadratic(P,h){return dot(h,mv(P,h));}
export class RNG{
 constructor(seed=1){this.state=seed>>>0;this.spare=null;}
 uniform(){let t=this.state+=0x6D2B79F5;t=Math.imul(t^(t>>>15),t|1);t^=t+Math.imul(t^(t>>>7),t|61);return((t^(t>>>14))>>>0)/4294967296;}
 normal(){if(this.spare!==null){const z=this.spare;this.spare=null;return z;}const r=Math.sqrt(-2*Math.log(Math.max(this.uniform(),1e-12))),a=2*Math.PI*this.uniform();this.spare=r*Math.sin(a);return r*Math.cos(a);}
}
export function cdf(x){const z=Math.abs(x),t=1/(1+.2316419*z),d=.3989422804014327*Math.exp(-z*z/2);const p=1-d*t*(.319381530+t*(-.356563782+t*(1.781477937+t*(-1.821255978+t*1.330274429))));return x<0?1-p:p;}
