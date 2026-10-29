/* WorkBadge · 3D-Ansicht. Läuft komplett im Browser; alle Dateien kommen von workbadge.de. */
(function(){
const root=document.getElementById('badge3d');
if(!root)return;
const stage=root.querySelector('.b3d-stage'),status=root.querySelector('.b3d-status');
let started=false;

function loadScript(src){return new Promise((ok,fail)=>{const s=document.createElement('script');s.src=src;s.onload=ok;s.onerror=()=>fail(new Error('Skript nicht geladen'));document.head.appendChild(s);});}

async function start(){
 if(started)return;started=true;
 try{
  await loadScript('/assets/3d/three-offline.js');
  const T=window.THREE,{OrbitControls}=window.THREEControls;
  const renderer=new T.WebGLRenderer({antialias:true,alpha:true,powerPreference:'high-performance'});
  renderer.setPixelRatio(Math.min(devicePixelRatio,2));renderer.setClearColor(0x000000,0);
  renderer.outputColorSpace=T.SRGBColorSpace;renderer.toneMapping=T.ACESFilmicToneMapping;renderer.toneMappingExposure=1.0;
  stage.appendChild(renderer.domElement);
  renderer.domElement.setAttribute('aria-label','WorkBadge in 3D – mit Maus oder Finger drehen');renderer.domElement.tabIndex=0;

  const scene=new T.Scene();
  const camera=new T.OrthographicCamera(-55,55,40,-40,.1,1000);
  const controls=new OrbitControls(camera,renderer.domElement);
  controls.enableDamping=true;renderer.domElement.style.touchAction='pan-y';controls.dampingFactor=.12;controls.enablePan=false;
  controls.minZoom=.85;controls.maxZoom=1.3;controls.minPolarAngle=Math.PI*.2;controls.maxPolarAngle=Math.PI*.8;controls.autoRotateSpeed=1.1;

  const env=new window.THREEEnvironment.RoomEnvironment(),pmrem=new T.PMREMGenerator(renderer);
  scene.environment=pmrem.fromScene(env,.035).texture;scene.environmentIntensity=.6;env.dispose();pmrem.dispose();
  scene.add(new T.HemisphereLight(0xffffff,0x31504a,.55));
  const key=new T.DirectionalLight(0xfff9ef,2.3);key.position.set(-45,90,85);scene.add(key);
  const fill=new T.DirectionalLight(0xdff7ef,.8);fill.position.set(85,25,-65);scene.add(fill);
  const rim=new T.DirectionalLight(0xffffff,1.0);rim.position.set(-80,12,-85);scene.add(rim);

  const buf=await (await fetch('/assets/3d/workbadge.glb')).arrayBuffer();
  const gltf=await new window.THREELoader.GLTFLoader().parseAsync(buf,'');
  const product=new T.Group();product.add(gltf.scene);gltf.scene.scale.setScalar(1000);scene.add(product);

  let screen=null;
  gltf.scene.traverse(o=>{
   if(!o.isMesh)return;
   if(o.name.indexOf('E-Ink-Anzeige')>-1||(o.material&&o.material.map)){
    screen=o;o.material=new T.MeshBasicMaterial({map:o.material.map,toneMapped:false});return;
   }
   if(!o.material.map)o.geometry=window.THREEUtils.toCreasedNormals(o.geometry,Math.PI*.22);
   o.material.side=T.DoubleSide;o.material.envMapIntensity=.6;
   if(/Schraubenschlitz/.test(o.name)){o.material.polygonOffset=true;o.material.polygonOffsetFactor=-2;o.material.polygonOffsetUnits=-2;o.renderOrder=2;}
  });

  const loader=new T.TextureLoader(),maps={};
  await Promise.all(['status','name','focus'].map(async n=>{const t=await loader.loadAsync('/assets/3d/display-'+n+'.png');t.colorSpace=T.SRGBColorSpace;t.flipY=false;t.anisotropy=renderer.capabilities.getMaxAnisotropy();maps[n]=t;}));

  const views={front:{pos:[0,0,145],target:[0,0,-5],flip:false},angle:{pos:[65,40,120],target:[0,-1,-5],flip:false},back:{pos:[28,26,140],target:[0,0,-5],flip:true}};
  const FRAME=78;
  function size(){const w=stage.clientWidth,h=stage.clientHeight;if(!w||!h)return;renderer.setSize(w,h,false);
   const a=w/h,hh=Math.max(FRAME,94/a);camera.top=hh/2;camera.bottom=-hh/2;camera.left=-hh*a/2;camera.right=hh*a/2;camera.updateProjectionMatrix();}
  function setView(v){const s=views[v];if(!s)return;product.rotation.set(s.flip?Math.PI:0,0,0);product.position.set(0,0,s.flip?-10:0);camera.position.set(...s.pos);camera.zoom=1;controls.target.set(...s.target);camera.lookAt(controls.target);controls.update();
   root.querySelectorAll('[data-view]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.view===v)));size();}
  function setDisplay(n){if(!screen||!maps[n])return;screen.material.map=maps[n];screen.material.needsUpdate=true;
   root.querySelectorAll('[data-display]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.display===n)));}

  root.querySelectorAll('[data-view]').forEach(b=>b.addEventListener('click',()=>{controls.autoRotate=false;rot.setAttribute('aria-pressed','false');setView(b.dataset.view);}));
  root.querySelectorAll('[data-display]').forEach(b=>b.addEventListener('click',()=>{setDisplay(b.dataset.display);}));
  const rot=root.querySelector('.b3d-rotate');
  rot.addEventListener('click',()=>{controls.autoRotate=!controls.autoRotate;rot.setAttribute('aria-pressed',String(controls.autoRotate));});
  renderer.domElement.addEventListener('keydown',e=>{if(!['ArrowLeft','ArrowRight','ArrowUp','ArrowDown'].includes(e.key))return;e.preventDefault();
   const off=camera.position.clone().sub(controls.target),s=new T.Spherical().setFromVector3(off);
   if(e.key==='ArrowLeft')s.theta-=.13;if(e.key==='ArrowRight')s.theta+=.13;if(e.key==='ArrowUp')s.phi-=.1;if(e.key==='ArrowDown')s.phi+=.1;
   s.phi=Math.max(.05,Math.min(Math.PI-.05,s.phi));camera.position.copy(controls.target).add(new T.Vector3().setFromSpherical(s));controls.update();});
  new ResizeObserver(size).observe(stage);

  setView('angle');setDisplay('status');
  controls.autoRotate=!matchMedia('(prefers-reduced-motion: reduce)').matches;rot.setAttribute('aria-pressed',String(controls.autoRotate));
  ['pointerdown','wheel'].forEach(ev=>renderer.domElement.addEventListener(ev,()=>{controls.autoRotate=false;rot.setAttribute('aria-pressed','false');},{passive:true}));

  let visible=true;new IntersectionObserver(es=>{visible=es[0].isIntersecting;}).observe(stage);
  (function loop(){requestAnimationFrame(loop);if(!visible)return;controls.update();renderer.render(scene,camera);})();
  root.classList.add('is-ready');status.remove();
 }catch(err){status.textContent='Die 3D-Ansicht konnte in diesem Browser nicht geladen werden.';console.error(err);}
}

if('IntersectionObserver' in window){
 const io=new IntersectionObserver(es=>{if(es.some(e=>e.isIntersecting)){io.disconnect();start();}},{rootMargin:'400px 0px'});io.observe(root);
}else start();
})();
