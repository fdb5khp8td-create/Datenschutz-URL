(()=>{const y=document.getElementById('year');if(y)y.textContent=String(new Date().getFullYear())})();
(()=>{const v=document.getElementById('film-video');if(!v)return;const b=document.querySelector('.film-toggle');
 const narrow=window.matchMedia('(max-width: 680px)');if(narrow.matches&&v.dataset.posterPortrait)v.poster=v.dataset.posterPortrait;
 const set=()=>{if(!b)return;const p=v.paused;b.textContent=p?'Abspielen':'Pause';b.setAttribute('aria-pressed',String(p))};
 if(window.matchMedia('(prefers-reduced-motion: reduce)').matches){v.removeAttribute('autoplay');v.pause()}
 v.addEventListener('play',set);v.addEventListener('pause',set);
 if(b)b.addEventListener('click',()=>{if(v.paused){const r=v.play();if(r&&r.catch)r.catch(()=>{})}else v.pause()});
 set()})();
