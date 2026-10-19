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
/* Statistik (Plausible, ohne Cookies): Klicks auf Elemente mit data-track */
(()=>{const t=(n,p)=>{try{window.plausible&&window.plausible(n,p?{props:p}:undefined)}catch(e){}};window.wbTrack=t;
 document.addEventListener('click',e=>{const a=e.target.closest&&e.target.closest('[data-track]');if(!a)return;
  const sec=a.closest('section,header,footer');t(a.dataset.track,{Ort:sec?(sec.id||sec.className.split(' ')[0]):'seite'})});
 const v=document.getElementById('film');if(v){let sent=false;v.addEventListener('playing',()=>{if(!sent){sent=true;t('Video gestartet')}})}
 const k=document.getElementById('kaufen');if(k&&'IntersectionObserver'in window){const o=new IntersectionObserver(es=>{if(es.some(e=>e.isIntersecting)){t('Kaufbereich gesehen');o.disconnect()}},{threshold:.4});o.observe(k)}})();

/* Shopify-Shop (Buy Button). Zum Aktivieren die drei Werte eintragen. */
const WB_SHOP={
  domain:'',          // z. B. 'workbadge.myshopify.com'
  token:'',           // Storefront-Zugriffstoken aus dem Buy-Button-Kanal
  productId:''        // Produkt-ID (Zahl) des WorkBadge-Produkts
};
(()=>{const node=document.getElementById('shop-product');if(!node||!WB_SHOP.domain||!WB_SHOP.token||!WB_SHOP.productId)return;
 const show=on=>document.querySelectorAll('[data-shop-on]').forEach(n=>n.hidden=!on)||document.querySelectorAll('[data-shop-off]').forEach(n=>n.hidden=on);
 const s=document.createElement('script');s.async=true;s.src='https://sdks.shopifycdn.com/buy-button/latest/buy-button-storefront.min.js';
 s.onload=()=>{try{const client=ShopifyBuy.buildClient({domain:WB_SHOP.domain,storefrontAccessToken:WB_SHOP.token});
  const font={'font-family':'Inter, -apple-system, BlinkMacSystemFont, Segoe UI, Arial, sans-serif'};
  const btn={...font,'font-weight':'800','font-size':'15px','padding-top':'16px','padding-bottom':'16px','border-radius':'14px','background-color':'#9bf1d0','color':'#0a2d21',':hover':{'background-color':'#b6fce1','color':'#0a2d21'},':focus':{'background-color':'#b6fce1'}};
  ShopifyBuy.UI.onReady(client).then(ui=>{ui.createComponent('product',{id:WB_SHOP.productId,node,moneyFormat:'{{amount_with_comma_separator}} €',
   options:{
    product:{layout:'vertical',width:'100%',contents:{img:true,title:true,price:true,options:true,quantity:true,quantityIncrement:true,quantityDecrement:true,button:true,description:false},
     text:{button:'In den Warenkorb',outOfStock:'Ausverkauft',unavailable:'Nicht verfügbar'},
     styles:{product:{...font,'max-width':'100%','text-align':'left'},title:{...font,'color':'#f2f8f6','font-size':'24px','font-weight':'800'},price:{...font,'color':'#9bf1d0','font-size':'22px','font-weight':'800'},compareAt:{'color':'#88a29e'},button:{...btn,'width':'100%'},quantityInput:{'font-size':'16px','padding-top':'16px','padding-bottom':'16px','background-color':'#0f1b1c','color':'#f2f8f6','border-color':'#2a443f'},quantityButton:{'color':'#f2f8f6','background-color':'#0f1b1c','border-color':'#2a443f'},img:{'border-radius':'16px'}},
     events:{addVariantToCart:()=>window.wbTrack&&window.wbTrack('In den Warenkorb')}},
    productSet:{},modalProduct:{},
    option:{styles:{label:{'color':'#adc2be'},select:{'background-color':'#0f1b1c','color':'#f2f8f6','border-color':'#2a443f'}}},
    cart:{text:{title:'Warenkorb',empty:'Dein Warenkorb ist leer.',button:'Zur Kasse',total:'Zwischensumme',notice:'Versand und Rabattcodes werden an der Kasse berechnet.',noteDescription:'Anmerkung zur Bestellung'},popup:false,
     styles:{button:btn,cart:{'background-color':'#0f1b1c'},title:{'color':'#f2f8f6'},header:{'color':'#f2f8f6'},lineItems:{'color':'#f2f8f6'},subtotalText:{'color':'#f2f8f6'},subtotal:{'color':'#f2f8f6'},notice:{'color':'#adc2be'},currency:{'color':'#adc2be'},close:{'color':'#f2f8f6',':hover':{'color':'#9bf1d0'}},empty:{'color':'#adc2be'},footer:{'background-color':'#0f1b1c'}},
     events:{openCheckout:()=>window.wbTrack&&window.wbTrack('Zur Kasse')}},
    lineItem:{styles:{variantTitle:{'color':'#adc2be'},title:{'color':'#f2f8f6'},price:{'color':'#f2f8f6'},quantity:{'color':'#f2f8f6'},quantityIncrement:{'color':'#f2f8f6','border-color':'#2a443f'},quantityDecrement:{'color':'#f2f8f6','border-color':'#2a443f'},quantityInput:{'color':'#f2f8f6','border-color':'#2a443f'}}},
    toggle:{styles:{toggle:{...font,'background-color':'#9bf1d0',':hover':{'background-color':'#b6fce1'}},count:{'color':'#0a2d21'},iconPath:{'fill':'#0a2d21'}}}
   }});show(true)}).catch(()=>show(false))}catch(e){show(false)}};
 s.onerror=()=>show(false);document.head.appendChild(s)})();
