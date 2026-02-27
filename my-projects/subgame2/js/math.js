(() => {
  'use strict';
  const TAU=Math.PI*2;
  const rand=(a,b)=>a+Math.random()*(b-a);
  const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
  const lerp=(a,b,t)=>a+(b-a)*t;
  const now=()=>performance.now()/1000;
  const jitter=(n=1)=>(Math.random()*2-1)*n;
  const angleNorm=(a)=>{while(a>Math.PI)a-=TAU;while(a<-Math.PI)a+=TAU;return a;};
  const lerpAngle=(a,b,t)=>a+angleNorm(b-a)*t;
  const deg2rad=(d)=>d*Math.PI/180;
  window.M={TAU,rand,clamp,lerp,now,jitter,angleNorm,lerpAngle,deg2rad};
})();
