/* Becker Tools V2.0 — neue mobile Module, ohne externe Bibliotheken */
(()=>{
'use strict';
const $=id=>document.getElementById(id);
const key='becker-tools-ext-v2';
const F=(n,d=2)=>Number.isFinite(n)?new Intl.NumberFormat('de-DE',{maximumFractionDigits:d}).format(n):'—';
const N=(id,min=-Infinity,max=Infinity)=>{const value=$(id)?.value.trim().replace(',','.');const n=value===''?NaN:Number(value);return Number.isFinite(n)&&n>=min&&n<=max?n:NaN;};
const S=(id,content)=>{const el=$(id);if(el)el.textContent=content;};
const enc=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const vals=(fields)=>Object.fromEntries(fields.map(id=>[id,$(id)?.value??'']));
const setVals=(o,fields)=>{for(const id of fields){if(typeof o?.[id]==='string'||typeof o?.[id]==='number')$(id).value=o[id];}};
const download=(s,name,type='text/csv;charset=utf-8')=>{const a=document.createElement('a'),url=URL.createObjectURL(new Blob([s],{type}));a.href=url;a.download=name;document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),20000);};
const csv=(rows)=>'\ufeff'+rows.map(row=>row.map(v=>'"'+String(v??'').replace(/"/g,'""')+'"').join(';')).join('\r\n');
const D=()=>new Date().toISOString().slice(0,10);
const nval=(value)=>{if(value==null)return NaN;let x=String(value).trim().replace(/\s/g,'');if(!x)return NaN;if(x.includes(',')&&x.includes('.')){x=x.lastIndexOf(',')>x.lastIndexOf('.')?x.replace(/\./g,'').replace(',','.'):x.replace(/,/g,'');}else x=x.replace(',','.');return /^[-+]?\d+(?:\.\d+)?$/.test(x)?Number(x):NaN;};
const extraFields=['plate-machine','plate-rotate','plate-x','plate-y','plate-part-x','plate-part-y','plate-z','plate-gap','plate-margin','mat-select','mat-volume','mat-density','mat-loss','opt-ved','opt-power','opt-hatch','opt-layer'];
const defaultMaterials=[{name:'AlSi10Mg',density:2.67,price:90,default:true},{name:'A20X',density:2.80,price:0,default:true},{name:'Ti-6Al-4V',density:4.43,price:0,default:true},{name:'316L / 1.4404',density:7.99,price:0,default:true}];
const model={compares:[],materials:[],fields:{},wbProjects:[],wbConfigs:{},wbTemplates:{},currentProject:'Testprojekt',timer:null};
try{const saved=JSON.parse(localStorage.getItem(key)||'null');if(saved&&typeof saved==='object'){
 model.compares=Array.isArray(saved.compares)?saved.compares.slice(0,4):[];
 model.materials=Array.isArray(saved.materials)?saved.materials.filter(x=>x&&typeof x.name==='string').slice(0,40):[];
 model.fields=saved.fields||{};model.wbProjects=Array.isArray(saved.wbProjects)?saved.wbProjects.slice(0,45):[];
 model.wbConfigs=saved.wbConfigs||{};model.wbTemplates=saved.wbTemplates||{};
 if(typeof saved.currentProject==='string')model.currentProject=saved.currentProject;
 model.timer=saved.timer||null;
}}catch(e){}
const persist=()=>{model.fields=vals(extraFields);try{localStorage.setItem(key,JSON.stringify(model));}catch(e){S('mat-status','Lokaler Speicher voll oder nicht verfügbar: bitte JSON-Backup verwenden.');}};
setVals(model.fields,extraFields);
const field=(name,value,label,step='any')=>`<label>${label}<input type="number" data-ck="${name}" step="${step}" value="${enc(value)}" inputmode="decimal"></label>`;
const formula=c=>{const p=nval(c.power),v=nval(c.speed),h=nval(c.hatch),t=nval(c.layer)/1000;if(![p,v,h,t].every(x=>Number.isFinite(x)&&x>0))return null;return {ev:p/(v*h*t),rate:v*h*t*3.6,line:p/v};};
// PARAMETERVERGLEICH
if(!model.compares.length)model.compares=[
 {name:'Beispiel A',power:350,speed:1400,hatch:0.15,layer:30},
 {name:'Beispiel B',power:350,speed:1200,hatch:0.15,layer:30}
];
const mainLaser=()=>Object.fromEntries(['power','speed','hatch','layer'].map(k=>[k,document.querySelector(`[data-field="${k}"]`).value]));
function drawCompare(){
 const wrap=$('compare-rows');wrap.replaceChildren();
 model.compares.forEach((c,i)=>{
  const box=document.createElement('article');box.className='record';
  box.innerHTML=`<div class="record-header"><span>Satz ${i+1}</span><div><button type="button" class="btn secondary" data-cmp="use">Laser laden</button> <button type="button" class="btn danger" data-cmp="remove">✕</button></div></div><label>Profilname<input type="text" data-cmp-field="name" maxlength="40" value="${enc(c.name)}"></label><div class="grid" style="margin-top:8px">${field('power',c.power,'Leistung (W)')}${field('speed',c.speed,'Geschwindigkeit (mm/s)')}${field('hatch',c.hatch,'Hatch (mm)')}${field('layer',c.layer,'Schichtdicke (µm)')}</div>`;
  box.querySelectorAll('input').forEach(input=>input.addEventListener('input',()=>{const name=input.dataset.cmpField||input.dataset.ck;model.compares[i][name]=input.value;updateCompare();persist();}));
  box.querySelector('[data-cmp="remove"]').addEventListener('click',()=>{model.compares.splice(i,1);drawCompare();persist();});
  box.querySelector('[data-cmp="use"]').addEventListener('click',()=>{
   const computed=formula(c);if(!computed){S('compare-message','Bitte gültige positive Werte verwenden.');return;}
   for(const k of ['power','speed','hatch','layer']){const el=document.querySelector(`[data-field="${k}"]`);el.value=c[k];el.dispatchEvent(new Event('input',{bubbles:true}));}
   $('tab-laser').click();
  });wrap.append(box);
 });updateCompare();
}
function updateCompare(){
 const tb=$('compare-table').querySelector('tbody');tb.replaceChildren();const items=[];
 model.compares.forEach((c,i)=>{const f=formula(c);const tr=document.createElement('tr');const a=[c.name||`Satz ${i+1}`,f?F(f.ev,2):'—',f?F(f.rate,2):'—',f?F(f.line,3):'—'];for(const text of a){const td=document.createElement('td');td.textContent=text;tr.append(td);}tb.append(tr);if(f)items.push({...f,name:c.name||`Satz ${i+1}`});});
 const svg=$('compare-chart');svg.replaceChildren();
 const NS='http://www.w3.org/2000/svg';const make=(tag,attrs,text)=>{const el=document.createElementNS(NS,tag);Object.entries(attrs).forEach(([k,v])=>el.setAttribute(k,v));if(text!=null)el.textContent=text;svg.append(el);return el;};
 if(!items.length){make('text',{x:20,y:44,fill:'#baccdf'},'Bitte einen gültigen Parametersatz eingeben.');return;}
 const maxV=Math.max(...items.map(x=>x.ev)),maxQ=Math.max(...items.map(x=>x.rate));
 make('line',{x1:54,x2:636,y1:206,y2:206,stroke:'#456079','stroke-width':1});
 const dx=550/items.length;
 items.forEach((r,i)=>{
  const start=65+i*dx,bw=Math.min(45,dx*.28), h1=Math.max(2,r.ev/maxV*153),h2=Math.max(2,r.rate/maxQ*153);
  make('rect',{x:start,y:206-h1,width:bw,height:h1,rx:3,fill:'#62bbf8'});
  make('rect',{x:start+bw+8,y:206-h2,width:bw,height:h2,rx:3,fill:'#4bd4ad'});
  make('text',{x:start+bw,y:226,'text-anchor':'middle',fill:'#c4d9ea','font-size':12},r.name.slice(0,14));
 });
 make('text',{x:8,y:17,fill:'#a9c6db','font-size':12},`Eᵥ max. ${F(maxV,1)} J/mm³`);
 make('text',{x:8,y:245,fill:'#a9c6db','font-size':12},`Q max. ${F(maxQ,2)} cm³/h`);
}
$('cmp-add').addEventListener('click',()=>{if(model.compares.length>=4){S('compare-message','Maximal vier Sätze möglich.');return;}model.compares.push({name:`Satz ${model.compares.length+1}`,...mainLaser()});S('compare-message','');drawCompare();persist();});
$('cmp-from-main').addEventListener('click',()=>{if(model.compares.length>=4){model.compares[0]={name:'Aktuelle Laserwerte',...mainLaser()};}else model.compares.push({name:'Aktuelle Laserwerte',...mainLaser()});drawCompare();persist();});
function optCalc(){
 const ev=N('opt-ved',.001,100000),p=N('opt-power',.001,100000),h=N('opt-hatch',.001,30),layer=N('opt-layer',.1,2000);const speed=p/(ev*h*(layer/1000)),rate=speed*h*(layer/1000)*3.6;
 const ok=[ev,p,h,layer,speed,rate].every(x=>Number.isFinite(x)&&x>0&&x<1e8);
 S('opt-speed',ok?F(speed,1):'—');S('opt-rate',ok?F(rate,2):'—');S('opt-error',ok?'':'Bitte gültige Werte eingeben.');return ok?{power:p,speed,hatch:h,layer}:null;
}
for(const id of ['opt-ved','opt-power','opt-hatch','opt-layer'])$(id).addEventListener('input',()=>{optCalc();persist();});
$('opt-transfer').addEventListener('click',()=>{const calc=optCalc();if(!calc)return;for(const [k,v] of Object.entries(calc)){const i=document.querySelector(`[data-field="${k}"]`);i.value=String(v);i.dispatchEvent(new Event('input',{bubbles:true}));}$('tab-laser').click();});
drawCompare();optCalc();
// BAUPLATTE
const plateFields=['plate-machine','plate-rotate','plate-x','plate-y','plate-part-x','plate-part-y','plate-z','plate-gap','plate-margin'];
let plateResult=null;
function calculatePlate(){
 const W=N('plate-x',1,10000),H=N('plate-y',1,10000),w=N('plate-part-x',.1,10000),h=N('plate-part-y',.1,10000),z=N('plate-z',.1,10000),g=N('plate-gap',0,1000),m=N('plate-margin',0,10000);
 const valid=[W,H,w,h,z,g,m].every(Number.isFinite)&&2*m<W&&2*m<H;
 if(!valid){plateResult=null;['plate-count','plate-layout','plate-fill','plate-free'].forEach(id=>S(id,'—'));S('plate-error','Bitte gültige Maße und einen Rand kleiner als die halbe Plattenbreite/-höhe eingeben.');$('plate-chart').replaceChildren();return;}
 const orientations=[['0',w,h],['90',h,w]].filter(x=>$('plate-rotate').value==='auto'||$('plate-rotate').value===x[0]);
 const possibilities=orientations.map(([r,a,b])=>{const nx=Math.max(0,Math.floor((W-2*m+g)/(a+g))),ny=Math.max(0,Math.floor((H-2*m+g)/(b+g)));return {r,a,b,nx,ny,count:nx*ny};});
 possibilities.sort((a,b)=>b.count-a.count);const best=possibilities[0];
 plateResult={...best,W,H,z,g,m,fill:100*best.count*w*h/(W*H)};
 S('plate-error',best.count?'':'Das Bauteil passt mit dem gewählten Abstand nicht auf die Bauplatte.');
 S('plate-count',F(best.count,0));S('plate-layout',`${best.nx} × ${best.ny}`);S('plate-fill',F(plateResult.fill,1)+' %');S('plate-free',F(W*H-best.count*w*h,0));
 const svg=$('plate-chart');svg.replaceChildren();const NS='http://www.w3.org/2000/svg';const add=(tag,attrs,label)=>{const n=document.createElementNS(NS,tag);for(const [k,v] of Object.entries(attrs))n.setAttribute(k,v);if(label)n.textContent=label;svg.append(n);};
 const scale=Math.min(590/W,340/H),x=35+(590-W*scale)/2,y=18+(340-H*scale)/2;
 add('rect',{x,y,width:W*scale,height:H*scale,rx:3,class:'bed'});
 // Bei sehr vielen Elementen zur Vermeidung langer Renderzeiten Raster-Skizze begrenzen.
 if(best.count<=700){for(let col=0;col<best.nx;col++)for(let row=0;row<best.ny;row++)add('rect',{x:x+(m+col*(best.a+g))*scale,y:y+(m+row*(best.b+g))*scale,width:best.a*scale,height:best.b*scale,class:'item'});}
 else add('text',{x:50,y:50},'Mehr als 700 Teile – grafische Einzeldarstellung reduziert.');
 add('text',{x:35,y:383},`${F(W,0)} × ${F(H,0)} mm · ${best.r}° · ${best.count} Stück`);
}
plateFields.forEach(id=>$(id).addEventListener('input',()=>{calculatePlate();persist();}));
$('plate-machine').addEventListener('change',()=>{if($('plate-machine').value!=='custom'){const v=$('plate-machine').value==='SLM500'?[500,280]:[280,280];$('plate-x').value=v[0];$('plate-y').value=v[1];}calculatePlate();persist();});
$('plate-apply').addEventListener('click',()=>{if(!plateResult||!plateResult.count)return;for(const [k,v] of [['pieces',plateResult.count],['height',plateResult.z]]){const el=document.querySelector(`[data-field="${k}"]`);el.value=v;el.dispatchEvent(new Event('input',{bubbles:true}));}$('tab-time').click();});
calculatePlate();
// MATERIALDATENBANK
const materials=()=>[...defaultMaterials,...model.materials];
function matDraw(){
 const sel=$('mat-select'),prev=sel.value||model.fields['mat-select'];sel.replaceChildren();materials().forEach(m=>{const o=document.createElement('option');o.value=m.name;o.textContent=m.name;sel.append(o);});
 if(materials().some(m=>m.name===prev))sel.value=prev;else sel.value='AlSi10Mg';
 const list=$('mat-saved-list');list.replaceChildren();
 model.materials.forEach((m,i)=>{const row=document.createElement('div');row.className='saved-item';const caption=document.createElement('div');caption.className='name';caption.textContent=`${m.name} · ${F(m.density,3)} g/cm³`;const del=document.createElement('button');del.type='button';del.className='delete';del.textContent='Löschen';del.addEventListener('click',()=>{if(!confirm(`Material ${m.name} entfernen?`))return;model.materials.splice(i,1);matDraw();matCalc();persist();});row.append(caption,del);list.append(row);});
}
function matCalc(){const density=N('mat-density',.001,100),volume=N('mat-volume',0,1e12),loss=N('mat-loss',0,500);const ok=[density,volume,loss].every(Number.isFinite);S('mat-grams',ok?F(volume*density,2):'—');S('mat-kg',ok?F(volume*density*(1+loss/100)/1000,4):'—');S('mat-error',ok?'':'Bitte gültige Volumen-, Dichte- und Pulververlustwerte eingeben.');}
function matChoose(){const mat=materials().find(m=>m.name===$('mat-select').value);if(mat)$('mat-density').value=mat.density;matCalc();persist();}
$('mat-select').addEventListener('change',matChoose);
for(const id of ['mat-volume','mat-density','mat-loss'])$(id).addEventListener('input',()=>{matCalc();persist();});
$('mat-save').addEventListener('click',()=>{
 const name=$('mat-new-name').value.trim(),density=N('mat-new-density',.01,50),price=N('mat-new-price',0,1e7);
 if(!name||!Number.isFinite(density)||!Number.isFinite(price)){S('mat-status','Bitte Namen, gültige Dichte und Pulverpreis angeben.');return;}
 if(defaultMaterials.some(m=>m.name.toLowerCase()===name.toLowerCase())){S('mat-status','Standardmaterial kann nicht überschrieben werden. Für eigene Werte neuen Namen nutzen.');return;}
 const ix=model.materials.findIndex(m=>m.name.toLowerCase()===name.toLowerCase());if(ix<0&&model.materials.length>=40){S('mat-status','Maximal 40 eigene Materialien.');return;}
 if(ix>=0)model.materials.splice(ix,1);
 model.materials.push({name,density,price});matDraw();$('mat-select').value=name;matChoose();S('mat-status',`Material ${name} gespeichert.`);persist();
});
$('mat-apply').addEventListener('click',()=>{
 const mat=materials().find(m=>m.name===$('mat-select').value),density=N('mat-density',.001,100);if(!mat||!Number.isFinite(density))return;
 const s=document.querySelector('[data-field="material"]');const known={AlSi10Mg:'AlSi10Mg',A20X:'A20X','Ti-6Al-4V':'Ti64','316L / 1.4404':'316L'};s.value=known[mat.name]||'custom';
 for(const [name,v] of [['density',density],['powderPrice',mat.price]]){const a=document.querySelector(`[data-field="${name}"]`);a.value=v;a.dispatchEvent(new Event('change',{bubbles:true}));}
 s.value=known[mat.name]&&density===mat.density?known[mat.name]:'custom';$('tab-cost').click();
});
$('mat-export').addEventListener('click',()=>download(csv([['Material','Dichte (g/cm³)','Pulverpreis (€/kg)'],...materials().map(m=>[m.name,m.density,m.price])]),`Becker_Materialien_${D()}.csv`));
matDraw();if(!model.fields['mat-select'])matChoose();else matCalc();
// TIMER + STOPPUHR
const timerFields=['timer-mode','timer-label','timer-hours','timer-minutes','timer-seconds'];
let timer=model.timer&&typeof model.timer==='object'?model.timer:{mode:'countdown',label:'Arbeits-Timer',duration:1800000,remaining:1800000,elapsed:0,startedAt:null,running:false,done:false,laps:[]};
let soundContext=null;
const timeText=ms=>{const secs=Math.max(0,Math.floor(ms/1000)),h=Math.floor(secs/3600),m=Math.floor(secs%3600/60),s=secs%60;return `${String(h).padStart(2,'0')}:${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')}`;};
const sound=()=>{try{if(!soundContext){const A=window.AudioContext||window.webkitAudioContext;if(A)soundContext=new A();}if(soundContext?.state==='suspended')soundContext.resume().catch(()=>{});}catch(e){}};
function beep(){try{if(!soundContext||soundContext.state!=='running')return;const now=soundContext.currentTime;for(let i=0;i<3;i++){const osc=soundContext.createOscillator(),gain=soundContext.createGain();osc.type='sine';osc.frequency.value=750;gain.gain.setValueAtTime(.001,now+i*.3);gain.gain.exponentialRampToValueAtTime(.16,now+i*.3+.025);gain.gain.exponentialRampToValueAtTime(.001,now+i*.3+.2);osc.connect(gain);gain.connect(soundContext.destination);osc.start(now+i*.3);osc.stop(now+i*.3+.21);}}catch(e){}}
function currentTimer(){if(!timer.running||!Number.isFinite(timer.startedAt))return timer.mode==='countdown'?timer.remaining:timer.elapsed;const diff=Math.max(0,Date.now()-timer.startedAt);return timer.mode==='countdown'?Math.max(0,timer.remaining-diff):timer.elapsed+diff;}
function timerSave(){model.timer=timer;persist();}
function timerUI(){
 const left=currentTimer();S('timer-view',timeText(left));S('timer-current-label',timer.label||'Timer');
 let status=timer.done?'Abgelaufen':timer.running?'Läuft':timer.paused?'Pausiert':'Bereit';S('timer-state',status);
 $('timer-start').textContent=timer.running?'Läuft':timer.paused?'Fortsetzen':'Start';$('timer-start').disabled=timer.running;
 $('timer-pause').disabled=!timer.running;
 $('timer-lap').hidden=timer.mode!=='stopwatch';$('timer-lap').disabled=!timer.running;
 const laps=$('timer-laps');laps.replaceChildren();(timer.laps||[]).slice(-10).forEach(x=>{const li=document.createElement('li');li.textContent=timeText(x);laps.prepend(li);});
}
function timerTick(){if(timer.running&&timer.mode==='countdown'&&currentTimer()<=0){timer.running=false;timer.remaining=0;timer.startedAt=null;timer.done=true;timerSave();beep();}timerUI();}
function readTimer(){const h=N('timer-hours',0,999),m=N('timer-minutes',0,59),s=N('timer-seconds',0,59);if(![h,m,s].every(x=>Number.isInteger(x)))return NaN;return (h*3600+m*60+s)*1000;}
function timerInputsToState(){if(timer.running)return;const duration=readTimer();if(!Number.isFinite(duration)){S('timer-error','Bitte ganze Werte mit Minuten und Sekunden von 0 bis 59 eingeben.');return;}timer={mode:$('timer-mode').value,label:$('timer-label').value.trim()||'Timer',duration,remaining:duration,elapsed:0,startedAt:null,running:false,done:false,paused:false,laps:[]};S('timer-error','');timerSave();timerUI();}
function timerFill(ms){const secs=Math.floor(ms/1000);$('timer-hours').value=Math.floor(secs/3600);$('timer-minutes').value=Math.floor(secs%3600/60);$('timer-seconds').value=secs%60;timerInputsToState();}
if(timer){$('timer-mode').value=timer.mode==='stopwatch'?'stopwatch':'countdown';$('timer-label').value=timer.label||'Arbeits-Timer';const secs=Math.floor((timer.duration||1800000)/1000);$('timer-hours').value=Math.floor(secs/3600);$('timer-minutes').value=Math.floor(secs%3600/60);$('timer-seconds').value=secs%60;}
for(const id of timerFields)$(id).addEventListener('change',timerInputsToState);
for(const b of document.querySelectorAll('[data-preset]'))b.addEventListener('click',()=>{if(timer.running){S('timer-error','Timer zuerst anhalten, um eine neue Dauer zu wählen.');return;}timerFill(Number(b.dataset.preset)*1000);});
$('timer-start').addEventListener('click',()=>{if(timer.running)return;const duration=readTimer();if(!Number.isFinite(duration)||timer.mode==='countdown'&&!timer.paused&&duration<=0){S('timer-error','Bitte eine Dauer über 0 Sekunden wählen.');return;}sound();if(timer.done){timer.done=false;timer.remaining=timer.duration;}timer.mode=$('timer-mode').value;timer.label=$('timer-label').value.trim()||'Timer';timer.startedAt=Date.now();timer.running=true;timer.paused=false;timerSave();S('timer-error','');timerUI();});
$('timer-pause').addEventListener('click',()=>{if(!timer.running)return;const v=currentTimer();if(timer.mode==='countdown')timer.remaining=v;else timer.elapsed=v;timer.running=false;timer.startedAt=null;timer.paused=true;timerSave();timerUI();});
$('timer-reset').addEventListener('click',()=>{timer.running=false;timer.startedAt=null;timer.paused=false;timer.done=false;timer.remaining=readTimer()||timer.duration;timer.elapsed=0;timer.laps=[];timerSave();timerUI();});
$('timer-lap').addEventListener('click',()=>{if(timer.running&&timer.mode==='stopwatch'){timer.laps.push(currentTimer());timer.laps=timer.laps.slice(-20);timerSave();timerUI();}});
setInterval(timerTick,300);document.addEventListener('visibilitychange',()=>{timerTick();if(document.hidden)timerSave();});timerUI();
// WÄRMEBEHANDLUNG: Projektverwaltung, CSV-Import, Kanäle, Plateaus, Diagramm, Druckbericht
const NS='http://www.w3.org/2000/svg';
const stageDefaults=proc=>proc==='aging'?[{enabled:true,target:160,minus:5,plus:5,hold:240}]:[
 {enabled:true,target:530,minus:5,plus:5,hold:120},
 {enabled:false,target:520,minus:5,plus:5,hold:60},
 {enabled:false,target:500,minus:5,plus:5,hold:60}];
const newConfig=proc=>({timeUnit:'sec',channel:0,axis:'min',startTemp:0,show:[0],stages:stageDefaults(proc)});
const wbKey=(p=wbProject,proc=wbProc)=>`${p}::${proc}`;
let wbProject=model.currentProject||'Testprojekt',wbProc='solution',wbTrace=null,wbBusy=false;
let databasePromise=null;
const volatileTraces=new Map();
function dbOpen(){
 if(databasePromise)return databasePromise;
 databasePromise=new Promise(resolve=>{
  let finished=false;const finish=db=>{if(!finished){finished=true;clearTimeout(timeout);resolve(db);}};
  const timeout=setTimeout(()=>finish(null),1800);
  if(!('indexedDB' in window)){finish(null);return;}
  try{const request=indexedDB.open('BeckerToolsV2',1);request.onupgradeneeded=()=>{if(!request.result.objectStoreNames.contains('traces'))request.result.createObjectStore('traces',{keyPath:'key'});};request.onsuccess=()=>finish(request.result);request.onerror=()=>finish(null);}catch(e){finish(null);}
 });return databasePromise;
}
async function dbRead(key){if(volatileTraces.has(key))return volatileTraces.get(key);const db=await dbOpen();if(!db)return null;return new Promise(resolve=>{try{const tx=db.transaction('traces','readonly'),req=tx.objectStore('traces').get(key);req.onsuccess=()=>resolve(req.result||null);req.onerror=()=>resolve(null);}catch(e){resolve(null);}});}
async function dbWrite(data){volatileTraces.set(data.key,data);const db=await dbOpen();if(!db)return false;return new Promise(resolve=>{try{const tx=db.transaction('traces','readwrite');tx.objectStore('traces').put(data);tx.oncomplete=()=>resolve(true);tx.onerror=()=>resolve(false);}catch(e){resolve(false);}});}
async function dbDelete(key){volatileTraces.delete(key);const db=await dbOpen();if(!db)return;return new Promise(resolve=>{try{const tx=db.transaction('traces','readwrite');tx.objectStore('traces').delete(key);tx.oncomplete=()=>resolve();tx.onerror=()=>resolve();}catch(e){resolve();}});}
function wbConf(p=wbProject,proc=wbProc){const c=model.wbConfigs[wbKey(p,proc)];return c&&typeof c==='object'&&Array.isArray(c.stages)?c:newConfig(proc);}
function wbDrawProjects(){const list=$('wb-project-list');list.replaceChildren();for(const name of model.wbProjects){const o=document.createElement('option');o.value=name;list.append(o);}}
function drawStages(stages){const wrap=$('wb-steps');wrap.replaceChildren();stages.forEach((st,i)=>{
 const row=document.createElement('div');row.className='wb-program';row.dataset.step=String(i);
 row.innerHTML=`<div class="record-header"><label class="inline-check"><input type="checkbox" data-s="enabled" ${st.enabled?'checked':''}> Stufe ${i+1} aktiv</label><span class="tag">${i===0&&wbProc==='aging'?'Warmauslagerung':'Lösungsglühen'}</span></div>
 <div class="grid">${field('target',st.target,'Soll (°C)')}${field('minus',st.minus,'Toleranz − (°C)')}${field('plus',st.plus,'Toleranz + (°C)')}${field('hold',st.hold,'Haltezeit (min)')}</div>`;
 row.querySelectorAll('input').forEach(inp=>inp.addEventListener('input',()=>{saveWBConfig();wbEvaluate();}));wrap.append(row);
 });}
function wbStagesFromUI(){return Array.from($('wb-steps').querySelectorAll('[data-step]')).map(node=>({enabled:node.querySelector('[data-s="enabled"]').checked,
 target:nval(node.querySelector('[data-ck="target"]').value),minus:nval(node.querySelector('[data-ck="minus"]').value),plus:nval(node.querySelector('[data-ck="plus"]').value),hold:nval(node.querySelector('[data-ck="hold"]').value)}));}
function wbReadConfig(){return {timeUnit:$('wb-time-unit').value,channel:Number($('wb-channel').value)||0,axis:$('wb-axis').value,startTemp:N('wb-start-temp',-100,1200),show:Array.from($('wb-channel-list').querySelectorAll('input:checked')).map(el=>Number(el.value)),stages:wbStagesFromUI()};}
function saveWBConfig(){if(wbBusy)return;const config=wbReadConfig();model.wbConfigs[wbKey()]=config;persist();}
function wbDrawChannels(){const select=$('wb-channel'),checks=$('wb-channel-list'),c=wbConf();select.replaceChildren();checks.replaceChildren();
 if(!wbTrace){const op=document.createElement('option');op.value='0';op.textContent='— keine Messdatei —';select.append(op);return;}
 wbTrace.channels.forEach((name,i)=>{const op=document.createElement('option');op.value=i;op.textContent=name;select.append(op);
 const item=document.createElement('label');item.className='inline-check';item.innerHTML=`<input type="checkbox" value="${i}" ${c.show?.includes(i)?'checked':''}> ${enc(name)} im Diagramm anzeigen`;
 item.querySelector('input').addEventListener('change',()=>{saveWBConfig();wbEvaluate();});checks.append(item);
 });
 select.value=String(Math.min(Math.max(0,c.channel||0),wbTrace.channels.length-1));
 if(!checks.querySelector('input:checked'))checks.querySelector('input').checked=true;
}
async function wbLoad(){wbBusy=true;const traceKey=wbKey();wbTrace=null;$('wb-demo').disabled=true;$('wb-file').disabled=true;S('wb-file-status','Projekt wird geladen …');const c=wbConf();$('wb-project-name').value=wbProject;$('wb-process').value=wbProc;
 $('wb-time-unit').value=['sec','min','hour'].includes(c.timeUnit)?c.timeUnit:'sec';$('wb-axis').value=c.axis==='hour'?'hour':'min';$('wb-start-temp').value=Number.isFinite(c.startTemp)?c.startTemp:0;
 drawStages(c.stages.slice(0,wbProc==='aging'?1:3));
 const fetched=await dbRead(traceKey);if(traceKey!==wbKey()){wbBusy=false;$('wb-demo').disabled=false;$('wb-file').disabled=false;return;}wbTrace=fetched;
 wbDrawChannels();S('wb-project-info',`Projekt: ${wbProject} · ${wbProc==='solution'?'Lösungsglühen':'Warmauslagerung'}`);
 S('wb-file-status',wbTrace?`${wbTrace.name} · ${F(wbTrace.points.length,0)} Zeitpunkte · ${wbTrace.channels.join(', ')}`:'Noch keine Messdaten für diesen Teilprozess geladen.');
 wbBusy=false;$('wb-demo').disabled=false;$('wb-file').disabled=false;wbEvaluate();}
function wbNotice(t,bad=false){const n=$('wb-message');n.className=`message ${bad?'error':'info'}`;n.textContent=t;}
function parserRows(text,delim){const lines=text.replace(/^\ufeff/,'').split(/\r\n|\n|\r/);const rows=[];
 for(const line of lines){if(!line.trim())continue;const row=[],current={value:'',quoted:false};for(let i=0;i<line.length;i++){const ch=line[i];if(ch==='"'){if(current.quoted&&line[i+1]==='"'){current.value+='"';i++;}else current.quoted=!current.quoted;}else if(ch===delim&&!current.quoted){row.push(current.value.trim());current.value='';}else current.value+=ch;}
 row.push(current.value.trim());rows.push(row);if(rows.length>85000)throw Error('Messdatei enthält zu viele Zeilen (maximal 85.000).');
 }return rows;
}
function parsedTime(s,unit){const str=String(s??'').trim();if(!str)return NaN;
 // ISO-Datum / deutsches Datum mit Uhrzeit
 const de=str.match(/^(\d{1,2})[.\-/](\d{1,2})[.\-/](\d{2,4})[ T]+(\d{1,2}):(\d{2})(?::(\d{2})(?:[.,](\d+))?)?$/);
 if(de){let year=Number(de[3]);if(year<100)year+=year>=70?1900:2000;return new Date(year,Number(de[2])-1,Number(de[1]),Number(de[4]),Number(de[5]),Number(de[6]||0)).getTime()/60000;}
 if(/^\d{4}-\d{2}-\d{2}[ T]/.test(str)){const x=Date.parse(str.replace(' ','T'));if(Number.isFinite(x))return x/60000;}
 const hh=str.match(/^(\d{1,3}):(\d{2})(?::(\d{2})(?:[.,](\d+))?)?$/);
 if(hh)return Number(hh[1])*60+Number(hh[2])+(Number(hh[3]||0)+(Number('0.'+(hh[4]||'0'))))/60;
 const n=nval(str);return Number.isFinite(n)?n*(unit==='sec'?1/60:unit==='hour'?60:1):NaN;
}
function parseMeasurements(text,unit){
 const candidates=text.split(/\r\n|\n|\r/).filter(x=>x.trim()).slice(0,12),score=d=>candidates.reduce((a,line)=>a+(line.split(d).length-1),0);
 const d=[';','\t',','].sort((a,b)=>score(b)-score(a))[0];if(!score(d))throw Error('Keine Spaltentrennung gefunden (erwartet CSV / TSV).');
 const rows=parserRows(text,d);if(rows.length<3)throw Error('Zu wenige Messwerte.');
 let index=-1,startColumn=1,timeColumn=0,combined=false,header=null;
 for(let i=0;i<Math.min(rows.length,25);i++){
  const row=rows[i];if(row.length<2)continue;
  const dateFirst=/^\d{1,2}[.\-/]\d{1,2}[.\-/]\d{2,4}$/.test(row[0]||'');
  const dateAndTime=dateFirst&&/^\d{1,2}:\d{2}/.test(row[1]||'');
  const time=dateAndTime?parsedTime(`${row[0]} ${row[1]}`,unit):parsedTime(row[0],unit);
  const base=dateAndTime?2:1;
  if(Number.isFinite(time)&&row.slice(base).some(x=>Number.isFinite(nval(x)))){index=i;startColumn=base;combined=dateAndTime;header=i>0?rows[i-1]:null;break;}
 }
 if(index<0)throw Error('Zeitspalte oder numerische Temperaturkanäle nicht erkannt. Prüfe das CSV-Format.');
 const first=rows[index];let columns=[];for(let c=startColumn;c<first.length&&columns.length<12;c++)if(Number.isFinite(nval(first[c])))columns.push(c);
 if(!columns.length)throw Error('Keine numerischen Temperaturspalten erkannt.');
 const channels=columns.map((c,i)=>header&&header[c]&&!Number.isFinite(nval(header[c]))?String(header[c]).slice(0,35):`CH${i+1}`);
 const points=[];let offset=null,rollover=0,last=0,bad=0;
 for(let i=index;i<rows.length;i++){
  const row=rows[i];if(row.length<=columns[0])continue;
  let tm=parsedTime(combined?`${row[0]} ${row[1]}`:row[timeColumn],unit);if(!Number.isFinite(tm)){bad++;continue;}
  if(offset===null)offset=tm;
  // HH:mm:ss kann ohne Datum über Mitternacht laufen
  if(!combined&&/^\d{1,2}:\d{2}/.test(row[0]||'')&&tm+rollover<last-500)rollover+=1440;
  tm+=rollover;const relative=tm-offset;
  if(relative<last-.01){bad++;continue;}
  const measures=columns.map(col=>nval(row[col]));if(!measures.some(n=>Number.isFinite(n)&&n>-200&&n<2000))continue;
  points.push([Math.max(0,relative),...measures.map(n=>Number.isFinite(n)&&n>=-200&&n<=2000?n:null)]);last=relative;
 }
 if(points.length<3||points[points.length-1][0]===0)throw Error('Zu wenige zeitlich aufsteigende Messpunkte.');
 return {channels,points,invalidLines:bad};
}
async function wbHandleImport(file){
 if(!file)return;if(file.size>10*1024*1024){wbNotice('Maximal 10 MB je CSV-Datei.',true);return;}
 wbNotice('Messdaten werden eingelesen …');
 try{const text=await file.text();const parsed=parseMeasurements(text,$('wb-time-unit').value);
  const record={key:wbKey(),name:file.name,channels:parsed.channels,points:parsed.points,imported:new Date().toISOString()};
  const stored=await dbWrite(record);wbTrace=record;
  // Neuer Kanal-Satz: Anzeige standardmäßig CH1
  const c=wbReadConfig();c.channel=0;c.show=[0];model.wbConfigs[wbKey()]=c;persist();wbDrawChannels();wbEvaluate();
  S('wb-file-status',`${file.name} · ${F(record.points.length,0)} Messpunkte · ${record.channels.join(', ')}${stored?'':' · nur bis zum Schließen zwischengespeichert (IndexedDB nicht verfügbar)'}`);
  wbNotice(`Import abgeschlossen. ${parsed.invalidLines} ungültige Zeitzeilen übersprungen.`);
 }catch(e){wbNotice(`Import fehlgeschlagen: ${e.message}`,true);}
}
$('wb-file').addEventListener('change',async e=>{await wbHandleImport(e.target.files?.[0]);e.target.value='';});
$('wb-project-open').addEventListener('click',async()=>{const name=$('wb-project-name').value.trim();if(!name||name.length>65||/[\n\r]/.test(name)){wbNotice('Bitte einen Projektnamen mit maximal 65 Zeichen eingeben.',true);return;}
 saveWBConfig();wbProject=name;model.currentProject=name;if(!model.wbProjects.includes(name))model.wbProjects.unshift(name);model.wbProjects=model.wbProjects.slice(0,45);persist();wbDrawProjects();await wbLoad();});
$('wb-project-delete').addEventListener('click',async()=>{if(!confirm(`Projekt „${wbProject}“ mit ALLEN WB-Messdaten und Einstellungen löschen?`))return;
 for(const p of ['solution','aging']){delete model.wbConfigs[wbKey(wbProject,p)];await dbDelete(wbKey(wbProject,p));}
 model.wbProjects=model.wbProjects.filter(p=>p!==wbProject);wbProject=model.wbProjects[0]||'Testprojekt';model.currentProject=wbProject;persist();wbDrawProjects();await wbLoad();wbNotice('Projekt gelöscht.');});
$('wb-process').addEventListener('change',async e=>{if(wbBusy)return;const selected=e.target.value;saveWBConfig();wbProc=selected;await wbLoad();});
$('wb-save').addEventListener('click',()=>{saveWBConfig();wbNotice('Programm- und Anzeigeeinstellungen gespeichert.');});
$('wb-clear-file').addEventListener('click',async()=>{if(!wbTrace)return;if(!confirm(`Messdaten zu ${wbProc==='solution'?'Lösungsglühen':'Warmauslagerung'} entfernen?`))return;await dbDelete(wbKey());wbTrace=null;wbDrawChannels();S('wb-file-status','Keine Messdatei geladen.');wbEvaluate();});
$('wb-template-save').addEventListener('click',()=>{const name=prompt('Name der Wärmebehandlungsvorlage:');if(!name?.trim())return;const n=name.trim().slice(0,50);model.wbTemplates[`${wbProc}::${n}`]=wbStagesFromUI();persist();wbNotice(`Vorlage „${n}“ gespeichert.`);});
$('wb-to-timer').addEventListener('click',()=>{
 const stages=wbStagesFromUI();const ix=stages.findIndex(s=>s.enabled&&Number.isFinite(s.hold)&&s.hold>0);
 if(ix<0){wbNotice('Bitte zuerst eine aktive Stufe mit positiver Haltezeit einstellen.',true);return;}
 const minutes=stages[ix].hold;if(minutes>59999){wbNotice('Die Haltezeit überschreitet den Timerbereich (999 Stunden).',true);return;}
 if(timer.running&&!confirm('Laufenden Timer durch die WB-Haltezeit ersetzen?'))return;
 timer.running=false;timer.paused=false;timer.startedAt=null;
 $('timer-mode').value='countdown';$('timer-label').value=`${wbProc==='solution'?'Lösungsglühen':'Warmauslagerung'} · Stufe ${ix+1}`;
 timerFill(Math.round(minutes*60000));$('tab-timer').click();
});
$('wb-template-load').addEventListener('click',()=>{const templates=Object.keys(model.wbTemplates).filter(k=>k.startsWith(wbProc+'::'));if(!templates.length){wbNotice('Für diesen Teilprozess sind keine Vorlagen gespeichert.');return;}
 const choices=templates.map(k=>k.split('::').slice(1).join('::'));const name=prompt(`Vorlage auswählen:\n${choices.join('\n')}`,choices[0]);if(!name)return;const stages=model.wbTemplates[`${wbProc}::${name}`];if(!stages){wbNotice('Vorlage nicht gefunden.',true);return;}drawStages(stages);saveWBConfig();wbEvaluate();});
for(const id of ['wb-axis','wb-start-temp','wb-channel','wb-time-unit'])$(id).addEventListener('change',()=>{saveWBConfig();wbEvaluate();});
function generateExample(proc){const points=[];for(let t=0;t<=530;t++){
 let a,b;if(proc==='aging'){a=t<55?25+(160-25)*t/55:t<=345?160+1.25*Math.sin(t/12):160-(t-345)*.8;b=a+2.3*Math.cos(t/23);}
 else{a=t<135?20+510*t/135:t<330?530+1.3*Math.sin(t/15):Math.max(25,530-(t-330)*2.7);b=a+2.2*Math.sin(t/18);}
 points.push([t,Number(a.toFixed(3)),Number(b.toFixed(3))]);}
 return {key:wbKey(),name:`BEISPIEL · ${proc==='solution'?'Lösungsglühen':'Warmauslagerung'} (synthetisch)`,points,channels:['CH1 Ofen','CH2 Bauteil'],imported:new Date().toISOString()};
}
$('wb-demo').addEventListener('click',async()=>{if(wbTrace&&!confirm('Aktuelle Messdaten für diesen Teilprozess durch eine simulierte Beispielkurve ersetzen?'))return;
 const r=generateExample(wbProc);await dbWrite(r);wbTrace=r;model.wbConfigs[wbKey()]={...wbConf(),channel:0,show:[0,1]};persist();wbDrawChannels();S('wb-file-status',r.name+' · keine echten Messdaten');wbEvaluate();});
// Plateaubewertung, ab Vorstufenende, längste zusammenhängende Temperaturfolge innerhalb des Bandes.
function evalStages(trace,config){const out=[];if(!trace?.points?.length)return out;
 const channel=Math.min(trace.channels.length-1,Math.max(0,Number(config.channel)||0));const pts=trace.points;let cursor=0;
 for(let i=0;i<(config.stages||[]).length;i++){
  const st=config.stages[i];if(!st?.enabled){out.push({i,enabled:false});continue;}
  const valid=[st.target,st.plus,st.minus,st.hold].every(Number.isFinite)&&st.minus>=0&&st.plus>=0&&st.hold>0&&st.target>=-100&&st.target<=1600;
  if(!valid){out.push({i,enabled:true,invalid:true});continue;}
  const low=st.target-st.minus,high=st.target+st.plus;let best=null,start=-1;
  const select=(end)=>{if(start<0)return;const diff=pts[end][0]-pts[start][0];if(!best||diff>best.minutes)best={from:start,to:end,minutes:diff};start=-1;};
  for(let j=cursor;j<pts.length;j++){
   const v=pts[j][channel+1],hit=Number.isFinite(v)&&v>=low&&v<=high;
   if(hit){if(start<0)start=j;}else if(start>=0)select(j-1);
  }
  if(start>=0)select(pts.length-1);
  if(best){cursor=best.to+1;let min=Infinity,max=-Infinity;for(let j=best.from;j<=best.to;j++){const n=pts[j][channel+1];if(n<min)min=n;if(n>max)max=n;}
   out.push({i,enabled:true,ok:best.minutes>=st.hold,minutes:best.minutes,start:pts[best.from][0],end:pts[best.to][0],min,max,target:st.target,low,high,hold:st.hold});
  }else out.push({i,enabled:true,ok:false,minutes:0,target:st.target,low,high,hold:st.hold});
 }
 return out;
}
function wbPlot(svg,trace,config){
 svg.replaceChildren();svg.setAttribute('viewBox','0 0 720 330');const add=(tag,props={},content)=>{const el=document.createElementNS(NS,tag);Object.entries(props).forEach(([k,v])=>el.setAttribute(k,v));if(content!=null)el.textContent=content;svg.append(el);return el;};
 if(!trace?.points?.length){add('text',{x:20,y:40,fill:'#aec5da'},'Noch keine Messkurve geladen.');return null;}
 const traces=trace.points,show=(config.show?.length?config.show:[config.channel||0]).filter(x=>Number.isInteger(x)&&x>=0&&x<trace.channels.length);
 const channel=Math.min(trace.channels.length-1,Math.max(0,Number(config.channel)||0));
 let start=0;if(config.startTemp>0){const ix=traces.findIndex(p=>Number.isFinite(p[channel+1])&&p[channel+1]>=config.startTemp);if(ix>=0)start=ix;}
 let end=traces.length-1;if(start>=end)start=0;
 const visible=traces.slice(start);const x0=visible[0][0],x1=visible[visible.length-1][0];
 const enabledStages=(config.stages||[]).filter(s=>s.enabled&&Number.isFinite(s.target)&&Number.isFinite(s.minus)&&Number.isFinite(s.plus)&&s.minus>=0&&s.plus>=0);
 let rawMin=Infinity,rawMax=-Infinity;for(const idx of show){for(let j=0;j<visible.length;j+=Math.max(1,Math.floor(visible.length/9000))){const v=visible[j][idx+1];if(Number.isFinite(v)){rawMin=Math.min(rawMin,v);rawMax=Math.max(rawMax,v);}}}
 for(const s of enabledStages){rawMin=Math.min(rawMin,s.target-s.minus);rawMax=Math.max(rawMax,s.target+s.plus);}
 if(!Number.isFinite(rawMin)||!Number.isFinite(rawMax))return null;
 let ymin=Math.floor((rawMin-8)/10)*10,ymax=Math.ceil((rawMax+8)/10)*10;if(ymax<=ymin)ymax=ymin+10;
 add('rect',{x:0,y:0,width:720,height:330,fill:'#102033'});
 const left=56,top=18,width=632,height=260,px=x=>left+(x-x0)/(x1-x0||1)*width,py=y=>top+height-(y-ymin)/(ymax-ymin)*height;
 for(let i=0;i<=4;i++){const y=top+i*height/4,value=ymax-i*(ymax-ymin)/4;add('line',{x1:left,x2:left+width,y1:y,y2:y,stroke:'#2c4257','stroke-width':1});add('text',{x:50,y:y+4,'text-anchor':'end',fill:'#bdd0df','font-size':11},F(value,0));}
 const ticks=5;for(let i=0;i<=ticks;i++){const x=left+i*width/ticks;add('line',{x1:x,x2:x,y1:top+height,y2:top+height+5,stroke:'#7494ad'});
 const value=x0+i*(x1-x0)/ticks;add('text',{x,y:top+height+19,'text-anchor':'middle',fill:'#b7ccde','font-size':11},F(config.axis==='hour'?value/60:value,1));}
 add('text',{x:left+width/2,y:322,'text-anchor':'middle',fill:'#c1d1df','font-size':12},config.axis==='hour'?'Zeit (h)':'Zeit (min)');
 add('text',{x:3,y:12,fill:'#d0e4ef','font-size':12},'°C');
 const bands=['#c99aec','#ffc978','#8bd7c3'];enabledStages.forEach((st,i)=>{const bot=Math.max(top,Math.min(top+height,py(st.target-st.minus))),upper=Math.max(top,Math.min(top+height,py(st.target+st.plus)));const y=Math.min(bot,upper),h=Math.abs(bot-upper);
 add('rect',{x:left,y,width,height:h,fill:bands[i%bands.length],'fill-opacity':'.12'});
 add('line',{x1:left,y1:y,x2:left+width,y2:y,stroke:bands[i%bands.length],'stroke-dasharray':'4 4','stroke-width':1});
 add('line',{x1:left,y1:y+h,x2:left+width,y2:y+h,stroke:bands[i%bands.length],'stroke-dasharray':'4 4','stroke-width':1});
 });
 const colors=['#64c4fc','#55dfba','#ffbf76','#b8a4ff','#ff8ca3','#cfe376','#8bcfe1','#a0b6ce'];
 for(const k of show){const step=Math.max(1,Math.ceil(visible.length/1500));const selected=[];for(let i=0;i<visible.length;i+=step)selected.push(visible[i]);if(selected[selected.length-1]!==visible[visible.length-1])selected.push(visible[visible.length-1]);
 let d='',open=false;for(const row of selected){const y=row[k+1];if(!Number.isFinite(y)){open=false;continue;}d+=(open?'L':'M')+px(row[0]).toFixed(2)+' '+py(y).toFixed(2)+' ';open=true;}
 add('path',{d,fill:'none',stroke:colors[k%colors.length],'stroke-width':k===channel?2.7:1.7,'stroke-linejoin':'round'});
 }
 const stageResults=evalStages(trace,config);
 stageResults.filter(r=>r.enabled&&r.start!=null).forEach((r,i)=>{for(const time of [r.start,r.end]){if(time<x0||time>x1)continue;const x=px(time);add('line',{x1:x,x2:x,y1:top,y2:top+height,stroke:'#a8e8d0','stroke-dasharray':'5 5','stroke-opacity':'.65'});} });
 return {x0,x1,channel,plot:{left,top,width,height},show};
}
let wbGraphCurrent=null;
function wbEvaluate(){if(wbBusy)return;
 const trace=wbTrace,config=wbReadConfig(),svg=$('wb-chart'),legend=$('wb-legend'),summary=$('wb-summary');
 legend.replaceChildren();summary.replaceChildren();
 wbGraphCurrent=wbPlot(svg,trace,config);
 if(!trace){for(const id of ['wb-duration','wb-points','wb-min','wb-max'])S(id,'—');S('wb-chart-tap','Messdatei importieren oder Beispielkurve laden.');return;}
 let vmin=Infinity,vmax=-Infinity;for(const row of trace.points){const n=row[config.channel+1];if(Number.isFinite(n)){vmin=Math.min(vmin,n);vmax=Math.max(vmax,n);}}S('wb-duration',F(trace.points[trace.points.length-1][0]/60,2));S('wb-points',F(trace.points.length,0));S('wb-min',F(vmin,1));S('wb-max',F(vmax,1));
 const colors=['#64c4fc','#55dfba','#ffbf76','#b8a4ff','#ff8ca3','#cfe376','#8bcfe1','#a0b6ce'];for(const k of wbGraphCurrent?.show||[]){const s=document.createElement('span');const dot=document.createElement('i');dot.className='swatch';dot.style.background=colors[k%colors.length];s.append(dot,document.createTextNode(trace.channels[k]));legend.append(s);}
 const stages=evalStages(trace,config);let ok=0,nok=0;
 for(const r of stages){const el=document.createElement('div');el.className='wb-status '+(!r.enabled?'off':r.ok?'ok':'fail');
  if(!r.enabled)el.innerHTML=`<strong>Stufe ${r.i+1}: inaktiv</strong>Keine Bewertung.`;
  else if(r.invalid)el.innerHTML=`<strong>Stufe ${r.i+1}: ungültige Einstellungen</strong>Soll, Toleranzen oder Haltezeit korrigieren.`;
  else{r.ok?ok++:nok++;el.innerHTML=`<strong>Stufe ${r.i+1}: ${r.ok?'i.O.':'n.i.O.'}</strong><span>${F(r.minutes,1)} / ${F(r.hold,1)} min · Soll ${F(r.target,1)} °C (${F(r.low,1)} bis ${F(r.high,1)} °C)</span>${r.start==null?' · Band nicht erreicht':`<br>Beginn ${F(r.start,1)} min · Ende ${F(r.end,1)} min · Ist ${F(r.min,1)}–${F(r.max,1)} °C`}`;}
  summary.append(el);
 }
 wbNotice(nok?`${nok} aktive Stufe(n) n.i.O. · ${ok} i.O. · Kanal ${trace.channels[config.channel]}`:`${ok} aktive Stufe(n) i.O. · Kanal ${trace.channels[config.channel]}. Bewertung nach längster ununterbrochener Haltephase.` ,Boolean(nok));
}
$('wb-chart').addEventListener('pointerdown',event=>{if(!wbTrace||!wbGraphCurrent)return;const el=$('wb-chart'),bounds=el.getBoundingClientRect(),x=(event.clientX-bounds.left)/bounds.width*720;
 const g=wbGraphCurrent;if(x<g.plot.left||x>g.plot.left+g.plot.width)return;
 const min=g.x0+(x-g.plot.left)/g.plot.width*(g.x1-g.x0);let low=0,high=wbTrace.points.length-1;
 while(low<high){const m=(low+high)>>1;if(wbTrace.points[m][0]<min)low=m+1;else high=m;}
 const row=wbTrace.points[low],channel=g.channel;S('wb-chart-tap',`t = ${F(row[0],1)} min · ${wbTrace.channels[channel]} = ${F(row[channel+1],1)} °C`);
});
$('wb-csv').addEventListener('click',()=>{if(!wbTrace){wbNotice('Keine Messdaten vorhanden.',true);return;}const rows=[['Becker Tools WB V2.1','Auswertung'],['Projekt',wbProject],['Prozess',wbProc],['Datei',wbTrace.name],[],['Stufe','Bewertung','Soll °C','Untergrenze °C','Obergrenze °C','Sollzeit min','Istzeit min','Beginn min','Ende min']];
 const stages=evalStages(wbTrace,wbReadConfig());for(const r of stages)rows.push([r.i+1,!r.enabled?'inaktiv':r.invalid?'ungültig':r.ok?'i.O.':'n.i.O.',r.target??'',r.low??'',r.high??'',r.hold??'',r.minutes??'',r.start??'',r.end??'']);
 download(csv(rows),`Becker_WB_${wbProject.replace(/[^\w-]/g,'_')}_${wbProc}_${D()}.csv`);
});
function printSection(label,trace,cfg){const section=document.createElement('section');section.className='print-section';const heading=document.createElement('h1');heading.textContent=`Becker Tools · WB-Bericht · ${label}`;section.append(heading);
 const meta=document.createElement('p');meta.textContent=`Projekt: ${wbProject} · Datei: ${trace?.name||'keine Messdatei'} · Stand: ${new Date().toLocaleString('de-DE')}`;section.append(meta);
 if(!trace){const note=document.createElement('p');note.textContent='Für diesen Teilprozess sind keine Messdaten hinterlegt.';section.append(note);return section;}
 const chart=document.createElementNS(NS,'svg');chart.setAttribute('viewBox','0 0 720 330');chart.setAttribute('width','720');chart.setAttribute('height','330');chart.style.background='#edf2f6';chart.style.border='1px solid #bbb';wbPlot(chart,trace,cfg);section.append(chart);
 const line=document.createElement('p');line.textContent=`Aufzeichnung: ${F(trace.points[trace.points.length-1][0]/60,2)} h · Punkte: ${F(trace.points.length,0)} · Kanal: ${trace.channels[cfg.channel]||trace.channels[0]}`;section.append(line);
 for(const result of evalStages(trace,cfg)){const div=document.createElement('div');div.className='print-row';div.textContent=`Stufe ${result.i+1}: ${!result.enabled?'inaktiv':result.invalid?'ungültig':result.ok?'i.O.':'n.i.O.'} · Soll ${F(result.target,1)} °C · Haltezeit ${F(result.minutes,1)} / ${F(result.hold,1)} min · Band ${F(result.low,1)}–${F(result.high,1)} °C`;section.append(div);}
 const caveat=document.createElement('p');caveat.style.fontSize='9pt';caveat.textContent='Automatische, vereinfachte Bewertung der längsten ununterbrochenen Haltephase. Freigabe nur nach fachlicher Prüfung des vollständigen Prozesses und der Messung.';section.append(caveat);return section;
}
$('wb-report').addEventListener('click',async()=>{
 saveWBConfig();const root=$('wb-print-report');root.replaceChildren();
 for(const [proc,name] of [['solution','Lösungsglühen'],['aging','Warmauslagerung']]){const t=await dbRead(wbKey(wbProject,proc));const cfg=wbConf(wbProject,proc);root.append(printSection(name,t,cfg));}
 document.body.classList.add('wb-report');setTimeout(()=>window.print(),80);setTimeout(()=>document.body.classList.remove('wb-report'),15000);
});
window.addEventListener('afterprint',()=>document.body.classList.remove('wb-report'));
// EXPORT / IMPORT aller Zusatzmodule einschl. WB-Messkurven
async function exportState(){saveWBConfig();const traces=[];for(const p of model.wbProjects){for(const proc of ['solution','aging']){const t=await dbRead(wbKey(p,proc));if(t)traces.push(t);}}
 const state={...model,wbTraces:traces};
 if(window.beckerWaermezeit)state.waermezeit=window.beckerWaermezeit.exportState();
 return state;
}
async function importState(state){if(!state||typeof state!=='object')return;
 if(Array.isArray(state.compares))model.compares=state.compares.slice(0,4);
 if(Array.isArray(state.materials))model.materials=state.materials.filter(x=>x&&typeof x.name==='string').slice(0,40);
 if(state.fields&&typeof state.fields==='object')model.fields=state.fields;
 if(Array.isArray(state.wbProjects))model.wbProjects=state.wbProjects.slice(0,45);
 if(state.wbConfigs&&typeof state.wbConfigs==='object')model.wbConfigs=state.wbConfigs;
 if(state.wbTemplates&&typeof state.wbTemplates==='object')model.wbTemplates=state.wbTemplates;
 if(typeof state.currentProject==='string')model.currentProject=state.currentProject;
 if(Array.isArray(state.wbTraces)){for(const item of state.wbTraces){if(item&&typeof item.key==='string'&&Array.isArray(item.points)&&Array.isArray(item.channels)&&item.points.length<=85000)await dbWrite(item);}}
 // Timer nach Import sicherheitshalber stoppen; keine stille Hintergrundfortsetzung.
 if(state.waermezeit && window.beckerWaermezeit)window.beckerWaermezeit.importState(state.waermezeit);
 if(state.timer&&typeof state.timer==='object'){timer={...state.timer,running:false,startedAt:null,paused:true};model.timer=timer;
 $('timer-mode').value=timer.mode==='stopwatch'?'stopwatch':'countdown';$('timer-label').value=timer.label||'Arbeits-Timer';const secs=Math.floor((timer.duration||0)/1000);$('timer-hours').value=Math.floor(secs/3600);$('timer-minutes').value=Math.floor(secs%3600/60);$('timer-seconds').value=secs%60;}
 persist();setVals(model.fields,extraFields);drawCompare();calculatePlate();matDraw();matCalc();optCalc();wbProject=model.currentProject||'Testprojekt';wbProc='solution';wbDrawProjects();await wbLoad();timerUI();
}
window.beckerExtras={exportState,importState};
if(!model.wbProjects.includes(wbProject))model.wbProjects.unshift(wbProject);
wbDrawProjects();wbLoad();
})();
