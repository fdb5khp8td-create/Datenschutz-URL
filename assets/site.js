(()=>{const y=document.getElementById('year');if(y)y.textContent=String(new Date().getFullYear())})();
(()=>{const v=document.getElementById('film');if(!v)return;const fig=v.closest('figure'),b=fig&&fig.querySelector('.film-toggle');
 const reduce=window.matchMedia('(prefers-reduced-motion: reduce)').matches;let userPaused=reduce,visible=true;
 v.muted=true;v.defaultMuted=true;
 const sync=()=>{if(b)b.textContent=v.paused?'Abspielen':'Pause';if(fig)fig.classList.toggle('film-paused',v.paused)};
 const play=()=>{if(userPaused||!visible)return;const p=v.play();if(p&&p.catch)p.catch(()=>sync())};
 if(reduce){v.removeAttribute('autoplay');v.pause()}
 v.addEventListener('play',sync);v.addEventListener('pause',sync);v.addEventListener('canplay',play,{once:true});
 if('IntersectionObserver'in window){new IntersectionObserver(es=>{for(const e of es){visible=e.isIntersecting;if(visible)play();else if(!v.paused)v.pause()}},{threshold:.25}).observe(v)}
 document.addEventListener('visibilitychange',()=>{if(!document.hidden)play()});
 if(b)b.addEventListener('click',()=>{if(v.paused){userPaused=false;play()}else{userPaused=true;v.pause()}});
 play();sync()})();
