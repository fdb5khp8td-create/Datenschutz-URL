/* WorkBadge · Startanimation der App (1:1 nach LaunchAnimation.swift) und App-Vorschau im iPhone. */
(function(){
const phone=document.getElementById('appPhone');
if(!phone)return;
const screen=phone.querySelector('.ph-screen'),app=phone.querySelector('.ph-app'),canvas=phone.querySelector('.ph-launch');
const replay=document.getElementById('appReplay');
const ctx=canvas.getContext('2d');
const W=390,H=844;                       // logische iPhone-Größe wie in der App
const reduce=matchMedia('(prefers-reduced-motion: reduce)').matches;

// ---- Skalierung des iPhones -------------------------------------------------
function fit(){const s=screen.clientWidth/W;screen.style.setProperty('--s',s);
 const dpr=Math.min(devicePixelRatio||1,2);canvas.width=Math.round(W*s*dpr);canvas.height=Math.round(H*s*dpr);
 canvas.style.width=W*s+'px';canvas.style.height=H*s+'px';ctx.setTransform(s*dpr,0,0,s*dpr,0,0);draw(lastPose);}
// ---- Farben (BrandPalette) --------------------------------------------------
const C={launch:'rgb(20,86,74)',top:'rgb(18,110,92)',bottom:'rgb(22,63,57)',shadow:'rgb(9,48,43)',card:'rgb(247,245,227)',
 clip:'rgb(184,214,190)',slot:'rgb(35,93,76)',face:'rgb(241,174,79)',features:'rgb(35,66,57)',headline:'rgb(37,91,74)',
 text:'rgb(147,169,150)',rule:'rgb(214,221,202)',ink:'rgb(28,40,37)'};
// ---- Kurven ----------------------------------------------------------------
const clamp=v=>Math.min(1,Math.max(0,v));
const prog=(t,a,b)=>b>a?clamp((t-a)/(b-a)):(t>=b?1:0);
const eOutC=v=>{const r=1-clamp(v);return 1-r*r*r;};
const eIO=v=>{const x=clamp(v);return x*x*(3-2*x);};
const eOutB=(v,o=1.4)=>{const x=clamp(v)-1;return 1+(o+1)*x*x*x+o*x*x;};
const flashAt=t=>0.9*eIO(prog(t,.46,.53))*(1-eIO(prog(t,.58,.68)));
const PLAN={full:{rs:1.4,rd:.55},gentle:{rs:.7,rd:.4}};
function pose(t,plan){
 const p=PLAN[plan],end=p.rs+p.rd,leave=prog(t,p.rs,end);
 if(plan==='gentle')return{backdrop:1,cardOpacity:1,cardScale:1,cardOffset:0,cardTilt:0,shadow:1,clipOffset:0,clipOpacity:1,flash:0,face:1,eyes:1,smile:1,lines:[1,1,1,1],wordmark:1,tagline:1,reveal:0,overlay:1-eIO(leave),done:t>=end,revealing:t>=p.rs};
 const o={};o.backdrop=eIO(prog(t,0,.35));
 const arrive=prog(t,.05,.5);
 o.cardOpacity=eOutC(prog(t,.05,.25));o.cardScale=.78+.22*eOutB(arrive);o.cardOffset=40*(1-eOutC(arrive));
 o.cardTilt=-5*(1-eOutC(prog(t,.05,.55)));o.shadow=1;
 o.clipOpacity=eOutC(prog(t,.2,.3));o.clipOffset=-60*(1-eOutB(prog(t,.2,.52),2.2));
 o.flash=flashAt(t);o.face=eOutB(prog(t,.64,.92));o.eyes=eOutB(prog(t,.8,.92),2);o.smile=eIO(prog(t,.84,1.04));
 o.lines=[[.70,.98],[.78,1.06],[.86,1.14],[.92,1.22]].map(w=>eOutC(prog(t,w[0],w[1])));
 const words=1-eIO(prog(t,p.rs-.05,p.rs+.15));
 o.wordmark=eOutC(prog(t,.9,1.22))*words;o.tagline=eOutC(prog(t,1.0,1.32))*words;
 o.reveal=leave*leave;o.cardOpacity*=1-eIO(prog(leave,.05,.5));o.shadow=1-eIO(prog(leave,0,.2));
 o.overlay=1;o.done=t>=end;o.revealing=t>=p.rs;return o;
}
// ---- Bühne (LaunchStage) -----------------------------------------------------
const CARD={w:718,h:503,r:91};
const cardW=Math.min(250,Math.max(120,W*.58)),unit=cardW/CARD.w,cx=W/2,cy=H*.46;
const wordY=cy+(CARD.h/2+32)*unit+46,tagY=wordY+34;
const maxZoom=(()=>{const hw=CARD.w/2*unit,hh=CARD.h/2*unit;return Math.max(Math.max(cx,W-cx)/hw,Math.max(cy,H-cy)/hh)*1.45+.5;})();
const zoomOf=r=>Math.pow(maxZoom,clamp(r));
// ---- Zeichnen --------------------------------------------------------------
function rr(c,x,y,w,h,r){r=Math.min(r,w/2,h/2);c.beginPath();c.moveTo(x+r,y);c.arcTo(x+w,y,x+w,y+h,r);c.arcTo(x+w,y+h,x,y+h,r);c.arcTo(x,y+h,x,y,r);c.arcTo(x,y,x+w,y,r);c.closePath();}
const layer=document.createElement('canvas'),lctx=layer.getContext('2d');
function drawCard(c,o,zoom){
 c.save();c.translate(cx,cy+o.cardOffset*unit);c.rotate(o.cardTilt*Math.PI/180);const s=unit*o.cardScale*zoom;c.scale(s,s);
 if(o.shadow>.001){c.globalAlpha=o.shadow;c.fillStyle=C.shadow;rr(c,-359+8,-251.5+32,718,503,CARD.r);c.fill();c.globalAlpha=1;}
 c.fillStyle=C.card;rr(c,-359,-251.5,718,503,CARD.r);c.fill();
 if(o.flash>.001){c.globalAlpha=o.flash;c.fillStyle=C.ink;rr(c,-333,-225.5,666,451,70);c.fill();c.globalAlpha=1;}
 if(o.face>.001){const r=139*o.face;c.fillStyle=C.face;c.beginPath();c.arc(-162,-32.5,r,0,Math.PI*2);c.fill();}
 if(o.eyes>.001){c.fillStyle=C.features;const w=22*o.eyes,h=26*o.eyes;[-207,-111].forEach(x=>{c.beginPath();c.ellipse(x,-80.5,w/2,h/2,0,0,Math.PI*2);c.fill();});}
 if(o.smile>.001){c.strokeStyle=C.features;c.lineWidth=8;c.lineCap='round';c.beginPath();const n=Math.max(1,Math.round(32*o.smile));
  for(let i=0;i<=n;i++){const a=(18+144*(i/32))*Math.PI/180;const x=-163+61*Math.cos(a),y=-32+52.5*Math.sin(a);i?c.lineTo(x,y):c.moveTo(x,y);}c.stroke();}
 const bars=[[34,-122.5,259,31,15.5,C.headline],[34,-62.5,204,23,11.5,C.text],[34,-11.5,240,23,11.5,C.text],[-295,163.5,590,10,5,C.rule]];
 bars.forEach((b,i)=>{const a=o.lines[i];if(a<=.001)return;c.globalAlpha=Math.min(1,a*3);c.fillStyle=b[5];rr(c,b[0],b[1],b[3]+(b[2]-b[3])*Math.min(1,a),b[3],b[4]);c.fill();c.globalAlpha=1;});
 if(o.clipOpacity>.001){c.globalAlpha=o.clipOpacity;const d=o.clipOffset;c.fillStyle=C.clip;rr(c,-77,-294.5+d,154,90,35);c.fill();c.fillStyle=C.slot;rr(c,-41,-270.5+d,82,21,10);c.fill();c.globalAlpha=1;}
 c.restore();
}
let lastPose=null;
function draw(o){
 if(!o)return;ctx.clearRect(0,0,W,H);
 ctx.save();ctx.globalAlpha=o.overlay;
 // Hintergrund mit wachsendem, schildförmigem Fenster
 ctx.fillStyle=C.launch;ctx.fillRect(0,0,W,H);
 if(o.backdrop>0){const g=ctx.createLinearGradient(0,0,W,H);g.addColorStop(0,C.top);g.addColorStop(1,C.bottom);ctx.globalAlpha=o.overlay*o.backdrop;ctx.fillStyle=g;ctx.fillRect(0,0,W,H);ctx.globalAlpha=o.overlay;}
 const zoom=zoomOf(o.reveal);
 if(o.reveal>0){ctx.globalCompositeOperation='destination-out';const w=(CARD.w-8)*unit*zoom,h=(CARD.h-8)*unit*zoom;rr(ctx,cx-w/2,cy-h/2,w,h,(CARD.r-4)*unit*zoom);ctx.fill();ctx.globalCompositeOperation='source-over';}
 // Schild als eigene Ebene, damit sich überlappende Teile bei Transparenz nicht aufhellen
 if(o.cardOpacity>.001){
  const dpr=canvas.width/W;if(layer.width!==canvas.width||layer.height!==canvas.height){layer.width=canvas.width;layer.height=canvas.height;}
  lctx.setTransform(1,0,0,1,0,0);lctx.clearRect(0,0,layer.width,layer.height);lctx.setTransform(dpr,0,0,dpr,0,0);drawCard(lctx,o,zoom);
  ctx.save();ctx.setTransform(1,0,0,1,0,0);ctx.globalAlpha=o.overlay*o.cardOpacity;ctx.drawImage(layer,0,0);ctx.restore();
 }
 ctx.textAlign='center';ctx.textBaseline='middle';
 if(o.wordmark>.001){ctx.globalAlpha=o.overlay*o.wordmark;ctx.fillStyle=C.card;ctx.font='700 34px ui-rounded,"SF Pro Rounded","Nunito",Inter,system-ui,sans-serif';ctx.fillText('WorkBadge',cx,wordY+14*(1-o.wordmark));}
 if(o.tagline>.001){ctx.globalAlpha=o.overlay*o.tagline*.75;ctx.fillStyle=C.card;ctx.font='500 15px ui-rounded,"SF Pro Rounded","Nunito",Inter,system-ui,sans-serif';ctx.fillText('Dein E-Ink-Namensschild',cx,tagY+10*(1-o.tagline));}
 ctx.restore();
}
// ---- Ablauf ----------------------------------------------------------------
let raf=0,t0=0,skip=0,plan=reduce?'gentle':'full',running=false;
function frame(now){
 const t=(now-t0)/1000+skip,o=pose(t,plan);lastPose=o;draw(o);
 phone.classList.toggle('is-revealing',o.revealing);
 if(o.done){running=false;phone.classList.add('is-open');canvas.style.visibility='hidden';tour();return;}
 raf=requestAnimationFrame(frame);
}
function play(){
 cancelAnimationFrame(raf);stopTour();app.scrollTop=0;skip=0;running=true;
 phone.classList.remove('is-open','is-revealing');canvas.style.visibility='visible';
 t0=performance.now()+80;raf=requestAnimationFrame(frame);
}
// Tippen während der Animation springt zum Öffnen (wie in der App)
screen.addEventListener('click',()=>{if(!running)return;const t=(performance.now()-t0)/1000+skip,rs=PLAN[plan].rs;if(t<rs)skip+=rs-t;});
replay&&replay.addEventListener('click',play);

// ---- kurzer Rundgang durch die App nach dem Start ---------------------------
let tourRaf=0,tourStop=false;
function stopTour(){tourStop=true;cancelAnimationFrame(tourRaf);}
['wheel','touchstart','pointerdown','keydown'].forEach(ev=>app.addEventListener(ev,stopTour,{passive:true}));
function tour(){
 if(reduce)return;tourStop=false;const target=app.querySelector('.ph-games');if(!target)return;
 const goal=Math.min(target.offsetTop-12,app.scrollHeight-app.clientHeight),start=performance.now()+1300,dur=2600;
 (function step(now){if(tourStop)return;const k=clamp((now-start)/dur);app.scrollTop=goal*eIO(k);if(k<1)tourRaf=requestAnimationFrame(step);})(performance.now());
}

// ---- Start, wenn das iPhone ins Bild kommt -----------------------------------
new ResizeObserver(fit).observe(screen);fit();
lastPose=pose(0,plan);draw(lastPose);
let played=false;
function maybe(){if(played)return;const r=phone.getBoundingClientRect();if(r.top<innerHeight*.75&&r.bottom>innerHeight*.2){played=true;play();}}
if('IntersectionObserver' in window){const io=new IntersectionObserver(es=>{if(es.some(e=>e.isIntersecting)){maybe();}},{threshold:[.35,.6]});io.observe(phone);}
addEventListener('scroll',maybe,{passive:true});maybe();
})();
