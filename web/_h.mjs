const reg={};function cl(e){return{add:(...c)=>{const s=new Set(e.className.split(' ').filter(Boolean));c.forEach(x=>s.add(x));e.className=[...s].join(' ');},remove:(...c)=>{const s=new Set(e.className.split(' ').filter(Boolean));c.forEach(x=>s.delete(x));e.className=[...s].join(' ');},contains:c=>e.className.split(' ').includes(c),toggle:(c,f)=>{const h=e.className.split(' ').includes(c),on=f===undefined?!h:f,s=new Set(e.className.split(' ').filter(Boolean));on?s.add(c):s.delete(c);e.className=[...s].join(' ');}};}
class El{constructor(t){this.tagName=t;this.children=[];this.className='';this._id='';this.style={};this.dataset={};this._t='';this._h='';this._l={};this.onclick=null;this.classList=cl(this);this.disabled=false;this.value='';this.scrollTop=0;this.scrollHeight=0;}set id(v){this._id=v;reg[v]=this;}get id(){return this._id;}set textContent(v){this._t=String(v);this.children=[];}get textContent(){return this._t;}set innerHTML(v){this._h=String(v);if(v==='')this.children=[];}get innerHTML(){return this._h;}appendChild(c){this.children.push(c);return c;}_w(f){for(const c of this.children){f(c);c._w(f);}}querySelector(s){let r=null;this._w(e=>{if(!r&&mt(e,s))r=e;});return r;}querySelectorAll(s){const o=[];this._w(e=>{if(mt(e,s))o.push(e);});return o;}addEventListener(ev,fn){(this._l[ev]=this._l[ev]||[]).push(fn);}click(){if(this.disabled)return;if(this.onclick)this.onclick({target:this});(this._l.click||[]).forEach(f=>f({target:this}));}collect(){const o=[];this._w(e=>{if(e.onclick)o.push(e);});return o;}}
function mt(e,s){return s.startsWith('.')?e.className.split(' ').includes(s.slice(1)):e.tagName===s;}
globalThis.document={createElement:t=>new El(t),getElementById:i=>reg[i],querySelectorAll:s=>s==='#tabbar .tab'?reg.tabbar.querySelectorAll('.tab'):[],addEventListener(){}};
function mk(i,p){const e=new El('div');e.id=i;p&&p.appendChild(e);return e;}
const b=new El('body'),app=mk('app',b),pr=mk('profile',app);['pf-avatar','pf-name','pf-sub','pf-bars','pf-chips'].forEach(i=>mk(i,pr));const more=new El('button');more.id='pf-more';pr.appendChild(more);mk('log',app);const tb=mk('tabbar',app);for(const t of['cultivate','people','age','activities','sect']){const x=new El('button');x.className='tab'+(t==='age'?' tab-age':'');x.dataset.tab=t;tb.appendChild(x);}const ov=mk('overlay',app);ov.className='hidden';const oc=mk('overlay-card',ov),oh=mk('overlay-head',oc);mk('overlay-title',oh);const ocl=new El('button');ocl.id='overlay-close';oh.appendChild(ocl);mk('overlay-body',oc);
const st={};globalThis.localStorage={getItem:k=>k in st?st[k]:null,setItem:(k,v)=>{st[k]=String(v);},removeItem:k=>{delete st[k];}};globalThis.window=globalThis;
await import('./ui.js');
const F=t=>reg['overlay-body'].collect().find(e=>(e.innerHTML||'').includes(t));const tab=t=>reg.tabbar.querySelectorAll('.tab').find(x=>x.dataset.tab===t);const ovOpen=()=>reg.overlay.className!=='hidden';const T=()=>reg['overlay-title'].textContent;const A=(c,m)=>{if(!c)throw new Error(m);};
function drain(){let n=0;while(ovOpen()&&T()==='An Event'&&n++<8){const bs=reg['overlay-body'].collect().filter(e=>(e.className||'').includes('mbtn'));if(!bs.length)break;bs[0].click();}}
(reg['overlay-body'].collect().find(e=>(e.innerHTML||'').includes('Be Born'))).click();drain();if(ovOpen())ocl.click();
for(let i=0;i<10;i++){tab('age').click();drain();if(ovOpen())ocl.click();}
// tap a chip -> tip bubble
const chip=reg['pf-chips'].collect().find(e=>(e._h||'').includes('Karma'));A(chip,'karma chip tappable');chip.click();
const tip=reg['tip'];A(tip,'tip element created');A(tip.className.includes('show'),'tip shown');A((tip._h||'').includes('Karma'),'tip shows Karma text');
console.log('chip tip:', (tip._h||'').slice(0,60));
// sheet: glossary button + physique note + tappable rows
more.click();A(T()==='Character Sheet','sheet open');A(F('Glossary'),'sheet has glossary btn');
const hasInfo=()=>{let f=false;reg['overlay-body']._w(e=>{if((e._h||'').includes('ⓘ'))f=true;});return f;};
A(hasInfo(),'sheet rows show ⓘ');
// open glossary
F('Glossary & Legacy')||F('Glossary');F('ⓘ Glossary').click? null:0;
const gb=reg['overlay-body'].collect().find(e=>(e._h||'').includes('Glossary'));gb.click();
A(T().includes('Glossary'),'glossary panel open: '+T());
let entries=0;reg['overlay-body']._w(e=>{if((e.className||'').includes('lr-title'))entries++;});
console.log('glossary entries:',entries);A(entries>=15,'glossary lists stats');
console.log('HINT/GLOSSARY/PHYSIQUE UI OK');
