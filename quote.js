/* Becker Tools V3.1 – lokaler Angebotsworkflow, kein Slicer */
(()=>{'use strict';
  const $=id=>document.getElementById(id);
  if(!$('panel-quote'))return;
  const K='becker-quote-v3',KPROJECT='becker-quote-projects-v3';
  const euro=n=>Number.isFinite(n)?new Intl.NumberFormat('de-DE',{style:'currency',currency:'EUR'}).format(n):'—';
  const fmt=(n,d=1)=>Number.isFinite(n)?new Intl.NumberFormat('de-DE',{maximumFractionDigits:d}).format(n):'—';
  const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const readNum=id=>Number(String($(id).value).replace(',','.'));
  const vNum=(id,min,max)=>{const raw=$(id).value.trim();if(!raw)throw Error('Bitte alle Zahlenfelder ausfüllen.');const x=Number(raw.replace(',','.'));if(!Number.isFinite(x)||x<min||x>max)throw Error(`${$(''+id).closest('label')?.childNodes[0]?.textContent?.trim()||id}: zulässig ${min}–${max}.`);return x;};
  // Standardwerte sind absichtlich nur ein SCHEMA. Reale Scannerfelder unterscheiden sich nach Konfiguration.
  const autoScans=(w,h,n,overlap=30,direction='x')=>{
    const length=direction==='y'?h:w;
    const width=(length+(n-1)*overlap)/n,step=width-overlap;
    return Array.from({length:n},(_,i)=>direction==='y'?
      {enabled:true,x0:0,x1:w,y0:+(i*step).toFixed(3),y1:+(i*step+width).toFixed(3)}:
      {enabled:true,x0:+(i*step).toFixed(3),x1:+(i*step+width).toFixed(3),y0:0,y1:h});
  };
  const defaults=()=>({
    customer:'',number:`AM-${new Date().getFullYear()}-001`,project:'',notes:'',machine:'500I',material:'AlSi10Mg',
    machines:{'500I':{w:500,h:280,lasers:4,overlap:30,verified:false,scans:autoScans(500,280,4)},'500II':{w:500,h:280,lasers:4,overlap:30,verified:false,scans:autoScans(500,280,4)},'500III':{w:500,h:280,lasers:4,overlap:30,verified:false,scans:autoScans(500,280,4)},'280':{w:280,h:280,lasers:2,overlap:30,verified:false,scans:autoScans(280,280,2)}},
    parts:[],beds:[{id:1,items:[]}],bedId:1,uid:0,
    params:{power:350,speed:1400,hatch:.15,layer:30,eff:65,recoat:12,fixed:60,support:15,maxTime:168,margin:10,gap:5},
    cost:{rate:85,powder:90,density:2.67,loss:5,setup:70,post:12,wb:0,qa:0,shipping:0,risk:5,profit:20},
    offer:{date:new Date().toISOString().slice(0,10),valid:'',lead:'Nach Absprache',terms:'Ab Werk, netto zzgl. MwSt.'}
  });
  const machineNames={'500I':'SLM 500 I','500II':'SLM 500 II','500III':'SLM 500 III','280':'SLM 280'};
  const matDens={'AlSi10Mg':2.67,'A20X':2.8,'Ti-6Al-4V':4.43,'316L':7.99};
  const fields={customer:'qt-customer',number:'qt-number',project:'qt-project',notes:'qt-notes',machine:'qt-machine',material:'qt-material'};
  const paramFields={power:'qt-power',speed:'qt-speed',hatch:'qt-hatch',layer:'qt-layer',eff:'qt-eff',recoat:'qt-recoat',fixed:'qt-fixed',support:'qt-support',maxTime:'qt-max-time',margin:'qt-margin',gap:'qt-gap'};
  const costFields={rate:'qt-rate',powder:'qt-powder',density:'qt-density',loss:'qt-loss',setup:'qt-setup',post:'qt-post',wb:'qt-wb',qa:'qt-qa',shipping:'qt-shipping',risk:'qt-risk',profit:'qt-profit'};
  const offerFields={date:'qt-offer-date',valid:'qt-valid-date',lead:'qt-lead',terms:'qt-terms'};
  let data=defaults(),projects=[],step=0,editing=null,stlTemp=null,selected=null,activeBed=0,dragging=null,lastCalc=null,saveTimer=null;
  const note=(message,error=false)=>{$('qt-global-status').textContent=message;$('qt-global-status').style.color=error?'#ffaebd':'#9ee8d7';};
  const persist=()=>{clearTimeout(saveTimer);saveTimer=setTimeout(()=>{try{localStorage.setItem(K,JSON.stringify(data));}catch(e){note('Speicherplatz erschöpft: Projekt bitte als JSON exportieren.',true);}},220);};
  const load=()=>{try{const d=JSON.parse(localStorage.getItem(K)||'null');if(d&&d.machines&&d.parts&&d.beds){data=d;}}catch(e){}try{const p=JSON.parse(localStorage.getItem(KPROJECT)||'[]');if(Array.isArray(p))projects=p.filter(x=>x&&x.id&&x.snapshot).slice(0,30);}catch(e){}};
  const storeProjects=()=>{try{localStorage.setItem(KPROJECT,JSON.stringify(projects));}catch(e){note('Projektliste zu groß: JSON-Datei exportieren.',true);}};
  const dwn=(str,name,type)=>{const blob=new Blob([str],{type}),url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download=name;document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),20000);};
  const snapshot=()=>JSON.parse(JSON.stringify(data));
  const normalize=()=>{
    const base=defaults();
    if(!data||typeof data!=='object')data=base;
    for(const k of ['machines','params','cost','offer'])data[k]={...base[k],...(data[k]||{})};
    for(const k in base.machines){
      const old=data.machines[k]||{};
      data.machines[k]={...base.machines[k],...old};
      const m=data.machines[k];m.lasers=base.machines[k].lasers;
      if(!Array.isArray(m.scans)||m.scans.length!==m.lasers)m.scans=autoScans(m.w,m.h,m.lasers,30);
      else m.scans=m.scans.map((s,i)=>({...base.machines[k].scans[i],...s}));
      if(typeof m.verified!=='boolean')m.verified=false;
      if(m.direction!=='x'&&m.direction!=='y')m.direction='x';
      if(!Number.isFinite(m.overlap))m.overlap=30;
    }
    if(!Array.isArray(data.parts))data.parts=[];
    if(!Array.isArray(data.beds)||!data.beds.length)data.beds=base.beds;
    data.parts=data.parts.slice(0,80);data.beds=data.beds.slice(0,12).map(b=>({id:b.id||1,items:Array.isArray(b.items)?b.items.slice(0,120):[]}));
    if(!(data.machine in data.machines))data.machine='500I';
    data.uid=Number(data.uid)||0;data.bedId=Number(data.bedId)||1;
  };
  const getBed=()=>data.beds[Math.min(activeBed,data.beds.length-1)]||data.beds[0];
  const findPart=id=>data.parts.find(p=>p.id===id);
  const machine=()=>data.machines[data.machine];
  const positioned=id=>data.beds.reduce((acc,b)=>acc+b.items.filter(i=>i.partId===id).length,0);
  const partsTotal=()=>data.parts.reduce((a,p)=>a+p.qty,0);
  const placedTotal=()=>data.beds.reduce((a,b)=>a+b.items.length,0);
  const materialValid=()=>data.parts.length>0&&data.parts.every(p=>p.qty>=1);
  const putInputs=()=>{
    Object.entries(fields).forEach(([k,id])=>$(id).value=data[k]??'');
    Object.entries(paramFields).forEach(([k,id])=>$(id).value=data.params[k]);
    Object.entries(costFields).forEach(([k,id])=>$(id).value=data.cost[k]);
    Object.entries(offerFields).forEach(([k,id])=>$(id).value=data.offer[k]||'');
    $('qt-bed-w').value=machine().w;$('qt-bed-h').value=machine().h;
    $('qt-machine-label').textContent=machineNames[data.machine];
    scanUI();
    drawAll();
  };
  const scanMessage=()=>{
    const m=machine();const messages=[];
    if(!m.scans.some(s=>s.enabled))messages.push('Kein Laser aktiviert.');
    for(let i=0;i<m.scans.length;i++){
      const s=m.scans[i];
      if(![s.x0,s.x1,s.y0,s.y1].every(Number.isFinite)||s.x0<0||s.y0<0||s.x1>m.w+.001||s.y1>m.h+.001||s.x1<=s.x0||s.y1<=s.y0){
        messages.push(`L${i+1}: Scanbereich muss innerhalb der Platte liegen (X 0–${fmt(m.w)} / Y 0–${fmt(m.h)} mm).`);
      }
    }
    if(!m.verified)messages.push('Scannerfelder noch nicht als geprüft bestätigt: PDF-Angebot gesperrt.');
    return messages;
  };
  const scanUI=()=>{
    const m=machine();
    $('qt-overlap').value=Number.isFinite(m.overlap)?m.overlap:30;
    $('qt-direction').value=m.direction||'x';
    $('qt-scans-verified').checked=!!m.verified;
    $('qt-active-badge').textContent=`${m.scans.filter(s=>s.enabled).length}/${m.lasers} aktiv`;
    $('qt-scan-rows').innerHTML=m.scans.map((s,i)=>`<div class="qt-scanrow">
      <div class="qt-scanhead"><strong>Laser ${i+1}</strong><label><input data-scan-active="${i}" type="checkbox" ${s.enabled?'checked':''}> Aktiv</label></div>
      <div class="qt-scanfields">${[['x0','X von'],['x1','X bis'],['y0','Y von'],['y1','Y bis']].map(([field,label])=>`<label>${label} (mm)<input data-scan-id="${i}" data-scan-field="${field}" type="number" min="0" step="0.1" value="${Number.isFinite(s[field])?s[field]:''}"></label>`).join('')}</div>
    </div>`).join('');
    $('qt-zones-note').textContent=`${m.scans.filter(s=>s.enabled).length} von ${m.lasers} Lasern aktiv · Scannerfelder auf der Bauplatte werden maßstäblich gezeichnet; Überlappungen heller dargestellt.`;
    $('qt-scan-warning').textContent=scanMessage().join(' ')||'✓ Aktive Scannerfelder geprüft. In Überlappungen kann die Belichtungsarbeit auf mehrere Laser aufgeteilt werden.';
    $('qt-scan-warning').className=scanMessage().length?'message warn':'message';
  };
  const markScanUnverified=()=>{machine().verified=false;$('qt-scans-verified').checked=false;};
  const scanStatus=()=>{
    const m=machine();$('qt-active-badge').textContent=`${m.scans.filter(s=>s.enabled).length}/${m.lasers} aktiv`;
    $('qt-zones-note').textContent=`${m.scans.filter(s=>s.enabled).length} von ${m.lasers} Lasern aktiv · ${m.direction==='y'?'Y':'X'} in Reihe, Überlappungen in hellen Flächen.`;
    $('qt-scan-warning').textContent=scanMessage().join(' ')||'✓ Aktive Scannerfelder geprüft.';
    $('qt-scan-warning').className=scanMessage().length?'message warn':'message';
  };
  const applyMaterial=()=>{if(matDens[data.material]){data.cost.density=matDens[data.material];$('qt-density').value=data.cost.density;}};
  const redrawParts=()=>{
    $('qt-part-count').textContent=String(data.parts.length);
    const area=$('qt-parts-list');
    area.innerHTML=data.parts.length?data.parts.map(p=>`<div class="qt-listrow"><header><span>${esc(p.name)}</span><span class="tag">${p.shape?'STL-Kontur':'Rechteck'}</span></header><small>${fmt(p.w)} × ${fmt(p.h)} × ${fmt(p.z)} mm · ${fmt(p.vol,2)} cm³ · ${p.qty} Stück · platziert ${positioned(p.id)}/${p.qty}</small><div class="actions"><button class="btn secondary" type="button" data-edit-part="${p.id}">Bearbeiten</button><button class="btn danger" type="button" data-del-part="${p.id}">Löschen</button></div></div>`).join(''):'<p class="helper">Noch keine Bauteile. Lege ein Rechteck an oder importiere eine STL-Datei.</p>';
    const previous=$('qt-place-part').value;
    $('qt-place-part').replaceChildren();
    data.parts.forEach(p=>{const o=document.createElement('option');o.value=p.id;o.textContent=`${p.name} (${positioned(p.id)}/${p.qty})`;$('qt-place-part').append(o);});
    if(data.parts.some(p=>p.id===previous))$('qt-place-part').value=previous;
  };
  const clearPartForm=()=>{editing=null;stlTemp=null;$('qt-part-name').value='';$('qt-part-qty').value='8';$('qt-part-w').value='50';$('qt-part-h').value='40';$('qt-part-z').value='55';$('qt-part-vol').value='15';$('qt-stl-file').value='';$('qt-stl-info').textContent='Ohne STL wird ein Rechteck verwendet. STL-Dateien werden nur lokal verarbeitet.';$('qt-part-save').textContent='Bauteil hinzufügen';$('qt-part-cancel').hidden=true;$('qt-part-error').textContent='';};
  const savePart=()=>{
    try{
      const name=$('qt-part-name').value.trim();if(!name)throw Error('Bitte eine Bauteilbezeichnung angeben.');
      const qty=vNum('qt-part-qty',1,120),w=vNum('qt-part-w',.1,1000),h=vNum('qt-part-h',.1,1000),z=vNum('qt-part-z',.1,1000),vol=vNum('qt-part-vol',.0001,1e7);
      if(!Number.isInteger(qty))throw Error('Stückzahl muss ganzzahlig sein.');
      const old=editing?findPart(editing):null;
      const id=old?.id||`p${++data.uid}`;
      const shape=stlTemp?.shape||(old?old.shape:null);
      const p={id,name,qty,w,h,z,vol,shape:shape||null,stlName:stlTemp?.name||old?.stlName||null};
      if(old){Object.assign(old,p);}else{if(data.parts.length>=60)throw Error('Maximal 60 Bauteiltypen.');data.parts.push(p);}
      clearPartForm();update(true);note(`${name} ${old?'aktualisiert':'hinzugefügt'}.`);
    }catch(e){$('qt-part-error').textContent=e.message;}
  };
  // STL ist einheitenlos. Wir interpretieren die Koordinaten als Millimeter und die Z-Achse als Baurichtung.
  const parseStl=async file=>{
    if(file.size>22*1024*1024)throw Error('STL über 22 MB: bitte vereinfachen oder Rechteckdaten verwenden.');
    const buffer=await file.arrayBuffer(),view=new DataView(buffer);
    const facets=buffer.byteLength>=84?view.getUint32(80,true):0;
    const binary=facets>0&&84+facets*50===buffer.byteLength;
    let count=binary?facets:0;
    if(binary&&count>320000)throw Error('STL enthält zu viele Dreiecke (max. 320.000).');
    let triangles=[];let minX=Infinity,minY=Infinity,minZ=Infinity,maxX=-Infinity,maxY=-Infinity,maxZ=-Infinity,volumeSigned=0;
    const add=(a,b,c)=>{
      for(const p of [a,b,c]){if(!p.every(Number.isFinite)||p.some(v=>Math.abs(v)>1000000))throw Error('Ungültige STL-Koordinaten.');minX=Math.min(minX,p[0]);maxX=Math.max(maxX,p[0]);minY=Math.min(minY,p[1]);maxY=Math.max(maxY,p[1]);minZ=Math.min(minZ,p[2]);maxZ=Math.max(maxZ,p[2]);}
      volumeSigned+=(a[0]*(b[1]*c[2]-b[2]*c[1])+a[1]*(b[2]*c[0]-b[0]*c[2])+a[2]*(b[0]*c[1]-b[1]*c[0]))/6;
      triangles.push([a[0],a[1],b[0],b[1],c[0],c[1]]);
    };
    if(binary){for(let f=0;f<count;f++){const pos=84+f*50+12;let vs=[];for(let k=0;k<3;k++){const off=pos+k*12;vs.push([view.getFloat32(off,true),view.getFloat32(off+4,true),view.getFloat32(off+8,true)]);}add(...vs);}}
    else{
      const text=new TextDecoder().decode(buffer);const matches=[...text.matchAll(/\bvertex\s+([+\-\d.eE]+)\s+([+\-\d.eE]+)\s+([+\-\d.eE]+)/g)];
      if(!matches.length||matches.length%3!==0)throw Error('Kein gültiges binäres/ASCII-STL gefunden.');
      count=matches.length/3;if(count>320000)throw Error('Zu viele STL-Dreiecke.');
      for(let i=0;i<matches.length;i+=3)add(...matches.slice(i,i+3).map(m=>[Number(m[1]),Number(m[2]),Number(m[3])]));
    }
    if(count<1||!(maxX>minX)||!(maxY>minY)||!(maxZ>minZ))throw Error('STL benötigt räumliche Ausdehnung in X, Y und Z.');
    const w=maxX-minX,h=maxY-minY,z=maxZ-minZ;
    if(w>1000||h>1000||z>1000)throw Error('STL-Abmessungen über 1000 mm. Bitte Einheiten und Ausrichtung prüfen.');
    // Projektion aller Dreiecke in das XY-Bild und Konturenextraktion per Pixelgrenzen.
    const res=Math.min(3,Math.max(.3,220/Math.max(w,h)));
    const sw=Math.max(3,Math.ceil(w*res)+2),sh=Math.max(3,Math.ceil(h*res)+2);
    const canvas=document.createElement('canvas');canvas.width=sw;canvas.height=sh;
    const ctx=canvas.getContext('2d',{willReadFrequently:true});if(!ctx)throw Error('Canvas ist auf diesem Gerät nicht verfügbar.');
    ctx.fillStyle='#fff';
    for(let i=0;i<triangles.length;i++){
      const t=triangles[i];ctx.beginPath();ctx.moveTo((t[0]-minX)*res+1,(t[1]-minY)*res+1);ctx.lineTo((t[2]-minX)*res+1,(t[3]-minY)*res+1);ctx.lineTo((t[4]-minX)*res+1,(t[5]-minY)*res+1);ctx.closePath();ctx.fill();
    }
    triangles=null;
    const pix=ctx.getImageData(0,0,sw,sh).data,filled=new Uint8Array(sw*sh);
    for(let y=0;y<sh;y++)for(let x=0;x<sw;x++)filled[y*sw+x]=pix[(y*sw+x)*4+3]>70?1:0;
    const is=(x,y)=>x>=0&&y>=0&&x<sw&&y<sh&&filled[y*sw+x];
    const edges=new Map(),key=(x,y)=>`${x},${y}`;
    const edge=(ax,ay,bx,by)=>{const k=key(ax,ay);if(!edges.has(k))edges.set(k,[]);edges.get(k).push([bx,by]);};
    for(let y=0;y<sh;y++)for(let x=0;x<sw;x++)if(is(x,y)){
      if(!is(x,y-1))edge(x,y,x+1,y);
      if(!is(x+1,y))edge(x+1,y,x+1,y+1);
      if(!is(x,y+1))edge(x+1,y+1,x,y+1);
      if(!is(x-1,y))edge(x,y+1,x,y);
    }
    const raw=[];let guard=0;
    while(edges.size&&guard<300000){
      const begin=edges.keys().next().value;let cur=begin,loop=[];
      do{
        const options=edges.get(cur);if(!options?.length)break;
        const [x,y]=cur.split(',').map(Number);loop.push([(x-1)/res/w,(y-1)/res/h]);
        const dest=options.pop();if(!options.length)edges.delete(cur);cur=key(...dest);guard++;
      }while(cur!==begin&&guard<300000);
      if(loop.length>=3)raw.push(loop);
    }
    // Winkeländerungen vereinfachen, danach gleichmäßig auf max. 240 Punkte pro Schleife reduzieren.
    const loops=raw.map(loop=>{
      const pts=[];
      for(let i=0;i<loop.length;i++){
        const a=loop[(i-1+loop.length)%loop.length],b=loop[i],c=loop[(i+1)%loop.length];
        if(Math.abs((b[0]-a[0])*(c[1]-b[1])-(b[1]-a[1])*(c[0]-b[0]))>1e-9)pts.push(b);
      }
      const stride=Math.max(1,Math.ceil(pts.length/240));return pts.filter((_,i)=>i%stride===0).map(p=>p.map(v=>Number(v.toFixed(5))));
    }).filter(a=>a.length>=3).sort((a,b)=>b.length-a.length).slice(0,14);
    if(!loops.length)throw Error('Keine 2D-Silhouette erkennbar.');
    const vol=Math.abs(volumeSigned)/1000;
    return {w,h,z,vol:vol>.00001?vol:null,shape:loops,count,res};
  };
  const STLhandler=async ev=>{
    const file=ev.target.files?.[0];if(!file)return;
    $('qt-stl-info').textContent='STL wird lokal ausgewertet …';
    await new Promise(r=>setTimeout(r,20));
    try{
      const p=await parseStl(file);stlTemp={shape:p.shape,name:file.name};
      $('qt-part-name').value=$('qt-part-name').value.trim()||file.name.replace(/\.stl$/i,'').slice(0,75);
      ['w','h','z'].forEach(s=>$('qt-part-'+s).value=p[s].toFixed(2));
      if(p.vol)$('qt-part-vol').value=p.vol.toFixed(4);
      $('qt-stl-info').textContent=`✓ ${file.name} · ${p.count.toLocaleString('de-DE')} Dreiecke · XY-Projektion (~${fmt(1/p.res,2)} mm/Pixel) · ${p.shape.length} Kontur(en). ${p.vol?'CAD-Volumen aus STL geschätzt (bei geschlossenem Netz).':'CAD-Volumen manuell eingeben (nicht geschlossene Geometrie?).'} STL-Einheit mm angenommen.`;
      $('qt-part-error').textContent='';
    }catch(e){stlTemp=null;$('qt-stl-info').textContent='STL konnte nicht verarbeitet werden.';$('qt-part-error').textContent=e.message;}
  };
  const normLoops=p=>p.shape?.length?p.shape:[[[0,0],[1,0],[1,1],[0,1]]];
  const pathOf=p=>normLoops(p).map(loop=>loop.map(([x,y],j)=>`${j?'L':'M'}${fmtSvg(x*p.w)} ${fmtSvg(y*p.h)}`).join(' ')+'Z').join(' ');
  const fmtSvg=n=>Number(n.toFixed(3));
  const pointWorld=(pt,p,item)=>{
    const a=(item.rot||0)*Math.PI/180,dx=pt[0]*p.w-p.w/2,dy=pt[1]*p.h-p.h/2;
    return [item.x+dx*Math.cos(a)-dy*Math.sin(a),item.y+dx*Math.sin(a)+dy*Math.cos(a)];
  };
  const worldLoops=(p,item)=>normLoops(p).map(loop=>loop.map(pt=>pointWorld(pt,p,item)));
  const boxOf=loops=>{let loX=Infinity,loY=Infinity,hiX=-Infinity,hiY=-Infinity;loops.forEach(loop=>loop.forEach(([x,y])=>{loX=Math.min(loX,x);loY=Math.min(loY,y);hiX=Math.max(hiX,x);hiY=Math.max(hiY,y);}));return {loX,hiX,loY,hiY};};
  const pipLoop=(point,poly)=>{let inside=false;for(let i=0,j=poly.length-1;i<poly.length;j=i++){
    const a=poly[i],b=poly[j];if((a[1]>point[1])!==(b[1]>point[1])&&point[0]<(b[0]-a[0])*(point[1]-a[1])/(b[1]-a[1])+a[0])inside=!inside;
  }return inside;};
  const insideAny=(pt,loops)=>loops.reduce((sum,loop)=>sum+(pipLoop(pt,loop)?1:0),0)%2===1;
  const distPointSegmentSq=(p,a,b)=>{const vx=b[0]-a[0],vy=b[1]-a[1],sq=vx*vx+vy*vy;if(!sq)return (p[0]-a[0])**2+(p[1]-a[1])**2;const t=Math.min(1,Math.max(0,((p[0]-a[0])*vx+(p[1]-a[1])*vy)/sq)),dx=p[0]-a[0]-t*vx,dy=p[1]-a[1]-t*vy;return dx*dx+dy*dy;};
  const cross=(a,b,c)=>(b[0]-a[0])*(c[1]-a[1])-(b[1]-a[1])*(c[0]-a[0]);
  const segDistanceSq=(a,b,c,d)=>{
    const ab=cross(a,b,c),ab2=cross(a,b,d),cd=cross(c,d,a),cd2=cross(c,d,b);
    if(((ab>=0&&ab2<=0)||(ab<=0&&ab2>=0))&&((cd>=0&&cd2<=0)||(cd<=0&&cd2>=0)))return 0;
    return Math.min(distPointSegmentSq(a,c,d),distPointSegmentSq(b,c,d),distPointSegmentSq(c,a,b),distPointSegmentSq(d,a,b));
  };
  const closeShapes=(aa,bb,gap)=>{
    const a=boxOf(aa),b=boxOf(bb);
    if(a.hiX+gap<b.loX||b.hiX+gap<a.loX||a.hiY+gap<b.loY||b.hiY+gap<a.loY)return false;
    for(const loopA of aa)for(const loopB of bb){
      for(let i=0;i<loopA.length;i++)for(let j=0;j<loopB.length;j++){
        if(segDistanceSq(loopA[i],loopA[(i+1)%loopA.length],loopB[j],loopB[(j+1)%loopB.length])<Math.max(.000001,gap*gap))return true;
      }
    }
    for(const aLoop of aa)if(aLoop.length&&insideAny(aLoop[0],bb))return true;
    for(const bLoop of bb)if(bLoop.length&&insideAny(bLoop[0],aa))return true;
    return false;
  };
  const validItem=(bed,item)=>{
    const p=findPart(item.partId);if(!p)return false;
    const m=machine(),margin=Number(data.params.margin)||0,gap=Number(data.params.gap)||0;
    const poly=worldLoops(p,item),b=boxOf(poly);
    if(b.loX<margin-1e-5||b.loY<margin-1e-5||b.hiX>m.w-margin+1e-5||b.hiY>m.h-margin+1e-5)return false;
    for(const other of bed.items){if(item.id===other.id)continue;const op=findPart(other.partId);if(op&&closeShapes(poly,worldLoops(op,other),gap))return false;}
    return true;
  };
  const validateLayout=()=>{
    const errors=[];
    if(!materialValid())errors.push('Mindestens ein Bauteil anlegen.');
    let num=0;
    for(const p of data.parts){const n=positioned(p.id);if(p.qty!==n)errors.push(`${p.name}: ${n} von ${p.qty} Stück platziert.`);}
    for(let k=0;k<data.beds.length;k++)for(const item of data.beds[k].items){num++;if(!validItem(data.beds[k],item))errors.push(`Platte ${k+1}: Bauteil außerhalb des Feldes oder mit Abstandsverletzung.`);}
    if(num===0)errors.push('Bauplatte ist leer.');
    if(data.beds.length>12)errors.push('Zu viele Bauplatten.');
    return [...new Set(errors)];
  };
  const addBed=()=>{if(data.beds.length>=12){note('Maximal 12 Bauplatten pro Projekt.',true);return false;}data.beds.push({id:++data.bedId,items:[]});activeBed=data.beds.length-1;return true;};
  const makeItem=(p,x,y,rot=0)=>({id:`i${++data.uid}`,partId:p.id,x,y,rot});
  const tryPlacement=(p,bed,insert=true)=>{
    const margin=data.params.margin,gap=data.params.gap,m=machine();
    if(![margin,gap,m.w,m.h].every(Number.isFinite)||margin<0||gap<0||m.w<20||m.h<20)return null;
    const orientations=p.shape?[0,90]:[0,90];
    for(const rot of orientations){
      const rw=rot===90?p.h:p.w,rh=rot===90?p.w:p.h;
      const stepSize=Math.max(4,Math.min(16,Math.min(rw,rh)/2));
      for(let y=margin+rh/2;y<=m.h-margin-rh/2+0.01;y+=stepSize){
        for(let x=margin+rw/2;x<=m.w-margin-rw/2+0.01;x+=stepSize){
          const candidate={id:'__placement_candidate__',partId:p.id,x,y,rot};
          if(validItem(bed,candidate)&&hasScannerCoverage(p,candidate,7)){const item=makeItem(p,x,y,rot);if(insert)bed.items.push(item);return item;}
        }
      }
    }
    return null;
  };
  const placeOne=()=>{
    const p=findPart($('qt-place-part').value)||data.parts.find(p=>positioned(p.id)<p.qty);
    if(!p){note('Bitte zuerst einen Bauteiltyp anlegen.',true);return;}
    if(positioned(p.id)>=p.qty){note(`Für ${p.name} sind bereits alle ${p.qty} Stück platziert.`,true);return;}
    const b=getBed(),item=tryPlacement(p,b);
    if(item){selected=item.id;update(true);note('Bauteil platziert. Mit dem Finger verschiebbar.');}
    else note('Auf der aktuellen Platte kein freier Platz gefunden. Neue Platte erstellen oder manuell verschieben.',true);
  };
  const packAll=()=>{
    let remaining=0,placed=0;
    const oldBed=activeBed;
    outer:for(const p of data.parts){
      for(let i=positioned(p.id);i<p.qty;i++){
        if(placed>=120){note('Automatik nach 120 platzierten Teilen begrenzt. Rest manuell ergänzen.',true);break outer;}
        let item=null;
        for(let k=0;k<data.beds.length;k++){const bed=data.beds[k];if((item=tryPlacement(p,bed))){activeBed=k;break;}}
        if(!item&&addBed()){item=tryPlacement(p,getBed());if(!item){data.beds.pop();activeBed=Math.min(activeBed,data.beds.length-1);}}
        if(item){selected=item.id;placed++;}else{remaining++;break;}
      }
    }
    if(placed===0)activeBed=oldBed;
    update(true);
    note(`${placed} Teile ergänzt. ${remaining?'Nicht alles passt auf die verfügbaren Platten.':'Bitte alle Platten und Laserzonen prüfen.'}`,remaining>0);
  };
  const setSelectedPos=(x,y)=>{
    const item=getBed().items.find(i=>i.id===selected);if(!item)return;
    if(Number.isFinite(x))item.x=x;if(Number.isFinite(y))item.y=y;
    update(false);
  };
  const rotateSelected=degrees=>{
    const item=getBed().items.find(i=>i.id===selected);if(!item)return;
    item.rot=((item.rot+degrees)%360+360)%360;update(false);
  };
  const svgNS='http://www.w3.org/2000/svg';
  const svgElement=(tag,attrs,parent)=>{const node=document.createElementNS(svgNS,tag);for(const [k,v] of Object.entries(attrs))node.setAttribute(k,String(v));parent.appendChild(node);return node;};
  const drawPlate=()=>{
    const svg=$('qt-svg'),m=machine(),bed=getBed();
    svg.setAttribute('viewBox',`-3 -3 ${m.w+6} ${m.h+6}`);svg.replaceChildren();
    svgElement('rect',{x:0,y:0,width:m.w,height:m.h,rx:1.8,fill:'#122337',stroke:'#7fa9c1','stroke-width':1.7},svg);
    if($('qt-show-zones').value==='yes'){
      const colors=['#3c91c4','#61a887','#a78bd1','#ce9e63'];
      m.scans.forEach((s,i)=>{
        if(![s.x0,s.x1,s.y0,s.y1].every(Number.isFinite)||s.x1<=s.x0||s.y1<=s.y0)return;
        svgElement('rect',{x:s.x0,y:s.y0,width:s.x1-s.x0,height:s.y1-s.y0,fill:colors[i],
          'fill-opacity':s.enabled?.22:.035,stroke:s.enabled?colors[i]:'#7d8590',
          'stroke-opacity':s.enabled?1:.45,'stroke-width':1.2,'stroke-dasharray':s.enabled?'none':'4 4'},svg);
      });
      // Intersections are distinct and intentionally brighter than a single scan area.
      m.scans.forEach((a,i)=>m.scans.slice(i+1).forEach(b=>{
        if(!a.enabled||!b.enabled)return;
        const x=Math.max(a.x0,b.x0),y=Math.max(a.y0,b.y0),w=Math.min(a.x1,b.x1)-x,h=Math.min(a.y1,b.y1)-y;
        if(w>0&&h>0)svgElement('rect',{x,y,width:w,height:h,fill:'#a8eee1','fill-opacity':.27,'pointer-events':'none'},svg);
      }));
      m.scans.forEach((s,i)=>{const x=Math.max(1,s.x0)+3,y=Math.max(0,s.y0)+12;
        if(x>m.w-10||y>m.h-3)return;
        const t=svgElement('text',{x,y,fill:s.enabled?'#e6f5ff':'#98a0ae','font-size':Math.max(9,Math.min(13,m.w/44)),'font-weight':'700'},svg);
        t.textContent=`L${i+1}${s.enabled?'':' ×'}`;
      });
      // Uncovered regions are gridded in red (only when not covered by any active scanner).
      const nx=Math.max(24,Math.round(m.w/8)),ny=Math.max(10,Math.round(m.h/12));
      for(let yy=0;yy<ny;yy++)for(let xx=0;xx<nx;xx++){
        const x=(xx+.5)*m.w/nx,y=(yy+.5)*m.h/ny;
        if(!activeMask(x,y,m))svgElement('rect',{x:xx*m.w/nx,y:yy*m.h/ny,width:m.w/nx+.01,height:m.h/ny+.01,fill:'#dc485e','fill-opacity':.24,'pointer-events':'none'},svg);
      }
    }
    const margin=Math.max(0,Number(data.params.margin)||0);
    if(margin>0&&margin<m.w/2&&margin<m.h/2)svgElement('rect',{x:margin,y:margin,width:m.w-2*margin,height:m.h-2*margin,rx:1,fill:'none',stroke:'#b7d3dd','stroke-dasharray':'5 3','stroke-width':.8},svg);
    bed.items.forEach((i,index)=>{
      const p=findPart(i.partId);if(!p)return;
      const ok=validItem(bed,i),sel=selected===i.id;
      const grp=svgElement('g',{transform:`translate(${fmtSvg(i.x)} ${fmtSvg(i.y)}) rotate(${fmtSvg(i.rot||0)}) translate(${-p.w/2} ${-p.h/2})`,'data-uid':i.id,class:'qt-item',tabindex:0,role:'button','aria-label':`${p.name}, Position ${fmt(i.x)} × ${fmt(i.y)} mm, Winkel ${i.rot} Grad`},svg);
      const d=pathOf(p);svgElement('path',{d,fill:!ok?'#e05e6c':sel?'#e8c574':'#48bea5','fill-opacity':sel?.88:.8,stroke:sel?'#fff5bb':'#b1e5db','stroke-width':sel?2:1.2,'fill-rule':'evenodd'},grp);
      if(p.w>=24&&p.h>=15){const t=svgElement('text',{x:4,y:Math.min(p.h/2+4,15),fill:'#091c2a','font-size':Math.min(11,p.w/6), 'font-weight':'700'},grp);t.textContent=String(index+1);}
      grp.addEventListener('pointerdown',event=>{
        event.preventDefault();selected=i.id;dragging={id:i.id,startX:i.x,startY:i.y,px:event.clientX,py:event.clientY};svg.setPointerCapture?.(event.pointerId);drawPlateSelection();
      });
      grp.addEventListener('keydown',event=>{if(['ArrowUp','ArrowDown','ArrowLeft','ArrowRight'].includes(event.key)){event.preventDefault();selected=i.id;const delta=event.shiftKey?5:1;i.x+=(event.key==='ArrowRight')?delta:(event.key==='ArrowLeft')?-delta:0;i.y+=(event.key==='ArrowDown')?delta:(event.key==='ArrowUp')?-delta:0;update(false);}});
      grp.addEventListener('click',()=>{selected=i.id;update(false);});
    });
    drawPlateSelection();
  };
  const drawPlateSelection=()=>{
    const item=getBed().items.find(i=>i.id===selected),ids=['qt-sel-x','qt-sel-y','qt-rot-l','qt-rot-r','qt-rot-90','qt-remove-item'];
    ids.forEach(id=>$(id).disabled=!item);
    $('qt-sel-x').value=item?Number(item.x.toFixed(2)):'';
    $('qt-sel-y').value=item?Number(item.y.toFixed(2)):'';
    $('qt-svg').querySelectorAll('.qt-item').forEach(node=>{
      const path=node.querySelector('path'),on=node.getAttribute('data-uid')===selected;
      if(!path)return;path.setAttribute('fill',!validItem(getBed(),getBed().items.find(i=>i.id===node.getAttribute('data-uid')))?'#e05e6c':on?'#e8c574':'#48bea5');
      path.setAttribute('stroke',on?'#fff5bb':'#b1e5db');
    });
  };
  const platePointer=event=>{
    if(!dragging)return;
    const item=getBed().items.find(i=>i.id===dragging.id);if(!item)return;
    const ctm=$('qt-svg').getScreenCTM();if(!ctm)return;
    const s=1/ctm.a;if(!Number.isFinite(s))return;
    item.x=Math.round((dragging.startX+(event.clientX-dragging.px)*s)*10)/10;
    item.y=Math.round((dragging.startY+(event.clientY-dragging.py)*s)*10)/10;
    drawPlate();
    const errors=validateLayout();$('qt-layout-status').textContent=errors.length?errors.slice(0,3).join(' '):'Alle Bauteile gültig angeordnet.';
    persist();
  };
  const redrawBedTabs=()=>{
    const row=$('qt-bed-tabs');row.replaceChildren();
    data.beds.forEach((b,i)=>{const bt=document.createElement('button');bt.type='button';bt.textContent=`Platte ${i+1} (${b.items.length})`;bt.classList.toggle('active',activeBed===i);bt.addEventListener('click',()=>{activeBed=i;selected=null;update(false);});row.append(bt);});
    $('qt-remove-bed').disabled=data.beds.length<=1;
    $('qt-layout-status').textContent=(()=>{const e=validateLayout();return e.length?e.slice(0,4).join(' '):'✓ Alle Bauteile platziert und Abstände eingehalten.';})();
    $('qt-layout-status').className=validateLayout().length?'message warn':'message';
  };
  // A point in an overlap is eligible for several scanners. Use a bitmask, not a fixed zone.
  const activeMask=(x,y,m)=>m.scans.reduce((mask,s,i)=>mask|(s.enabled&&x>=s.x0-1e-7&&x<=s.x1+1e-7&&y>=s.y0-1e-7&&y<=s.y1+1e-7?(1<<i):0),0);
  const fractions=(p,item,n=12)=>{
    const m=machine(),fr=new Float64Array(1<<m.lasers),loops=normLoops(p);
    let samples=0;
    for(let row=0;row<n;row++)for(let col=0;col<n;col++){
      const pt=[(col+.5)/n,(row+.5)/n];if(!insideAny(pt,loops))continue;
      const [x,y]=pointWorld(pt,p,item);
      fr[activeMask(x,y,m)]++;samples++;
    }
    if(!samples){const [x,y]=pointWorld([.5,.5],p,item);fr[activeMask(x,y,m)]=1;samples=1;}
    return Array.from(fr,v=>v/samples);
  };
  // Allocate forced work first; then share overlap work with the least-busy eligible scanners.
  // Work is a per-layer volume equivalent, not the actual scanner path or contour timing.
  const distributeMasks=(work,m)=>{
    const loads=Array(m.lasers).fill(0);
    const ones=n=>{let x=n,c=0;while(x){c+=x&1;x>>=1;}return c;};
    const masks=Array.from({length:(1<<m.lasers)-1},(_,i)=>i+1).filter(k=>work[k]>0)
      .sort((a,b)=>ones(a)-ones(b)||a-b);
    for(const mask of masks){
      const eligible=loads.map((_,i)=>i).filter(i=>mask&(1<<i));
      const amount=work[mask];if(eligible.length===1){loads[eligible[0]]+=amount;continue;}
      let lo=Math.min(...eligible.map(i=>loads[i])),hi=Math.max(...eligible.map(i=>loads[i]))+amount;
      for(let k=0;k<38;k++){
        const mid=(lo+hi)/2;
        if(eligible.reduce((s,i)=>s+Math.max(0,mid-loads[i]),0)>amount)hi=mid;else lo=mid;
      }
      let rem=amount;
      eligible.forEach((i,n)=>{const add=n===eligible.length-1?rem:Math.min(rem,Math.max(0,lo-loads[i]));loads[i]+=add;rem-=add;});
    }
    return loads;
  };
  // Auto-Platzierung soll keine Bauteile in unbestrahlbare Bereiche schieben.
  const hasScannerCoverage=(part,item,n=7)=>{
    const loops=normLoops(part),m=machine();let checked=0;
    for(let y=0;y<n;y++)for(let x=0;x<n;x++){
      const uv=[(x+.5)/n,(y+.5)/n];if(!insideAny(uv,loops))continue;
      checked++;
      const [wx,wy]=pointWorld(uv,part,item);
      if(!activeMask(wx,wy,m))return false;
    }
    if(!checked){const [wx,wy]=pointWorld([.5,.5],part,item);return !!activeMask(wx,wy,m);}
    return true;
  };
  const validateNumbers=()=>{
    const p=data.params,c=data.cost,m=machine();
    const tests=[[p.power,.1,100000,'Laserleistung'],[p.speed,.1,100000,'Scangeschwindigkeit'],[p.hatch,.001,20,'Hatchabstand'],[p.layer,1,1000,'Schichtdicke'],[p.eff,1,100,'Effizienz'],[p.recoat,0,10000,'Beschichtungszeit'],[p.fixed,0,100000,'Nebenzeit'],[p.support,0,500,'Support'],[p.maxTime,1,10000,'Zeitgrenze'],[p.margin,0,100,'Randabstand'],[p.gap,0,100,'Bauteilabstand'],[m.w,20,1000,'Plattenbreite'],[m.h,20,1000,'Plattentiefe']];
    for(const [val,min,max,label]of tests)if(!Number.isFinite(val)||val<min||val>max)throw Error(`${label}: bitte ${min}–${max} eingeben.`);
    for(const [key,val]of Object.entries(c))if(!Number.isFinite(val)||val<0||val>1e7)throw Error(`Kosteneinstellung ${key} ist ungültig.`);
    const scanErrors=scanMessage().filter(x=>!x.includes('PDF-Angebot gesperrt'));
    if(scanErrors.length)throw Error(scanErrors[0]);
    if(c.density<.01||c.density>100)throw Error('Dichte ist ungültig.');
    if(data.parts.some(part=>![part.qty,part.vol,part.z,part.w,part.h].every(v=>Number.isFinite(v)&&v>0)))throw Error('Ungültige Bauteildaten.');
  };
  const estimate=()=>{
    validateNumbers();
    const p=data.params,c=data.cost,m=machine();
    const layermm=p.layer/1000;
    const q=p.speed*p.hatch*layermm*3.6*p.eff/100;
    if(!(q>0)||!Number.isFinite(q))throw Error('Volumenstrom kann nicht berechnet werden.');
    const totalParts=new Map(data.parts.map(part=>[part.id,{part,n:0,volume:0,allocated:0,material:0,post:0}]));
    let sumHours=0,scanH=0,coatH=0,volAll=0,jobCount=0,maxJob=0;
    const beds=[];
    for(const [ix,bed]of data.beds.entries()){
      if(!bed.items.length)continue;
      const entities=bed.items.map(item=>({item,p:findPart(item.partId)})).filter(o=>o.p);
      if(!entities.length)continue;
      const layers=Math.max(...entities.map(e=>Math.ceil(e.p.z/layermm)));
      if(layers>25000)throw Error('Zu viele Schichten (max. 25.000): Höhe und Schichtdicke prüfen.');
      const jobs=entities.map(({item,p:part})=>{
        const partLayers=Math.ceil(part.z/layermm),vol=part.vol*(1+p.support/100),fr=fractions(part,item);
        if(fr[0]>.00001)throw Error(`Platte ${ix+1}: ${part.name} befindet sich teilweise außerhalb aktiver Laserfelder (${fmt(fr[0]*100)} % der projizierten Fläche). Position/Scannerfelder prüfen.`);
        return {part,partLayers,vol,fr};
      });
      const distinctHeights=[...new Set([0,...jobs.map(j=>j.partLayers)])].sort((a,b)=>a-b);
      const totalLaserVolume=new Array(m.lasers).fill(0);
      const layerDistribution=[];
      let bedVolume=0,exposureH=0;
      jobs.forEach(j=>{bedVolume+=j.vol;const row=totalParts.get(j.part.id);row.n++;row.volume+=j.vol;});
      for(let s=1;s<distinctHeights.length;s++){
        const bottom=distinctHeights[s-1],top=distinctHeights[s],span=top-bottom;
        const work=new Float64Array(1<<m.lasers);
        jobs.filter(j=>j.partLayers>bottom).forEach(j=>{
          const unit=j.vol/j.partLayers;
          for(let mask=1;mask<work.length;mask++)work[mask]+=unit*j.fr[mask];
        });
        const loads=distributeMasks(work,m),peak=Math.max(...loads);
        exposureH+=peak*span/q;
        loads.forEach((v,i)=>totalLaserVolume[i]+=v*span);
        layerDistribution.push({from:bottom+1,to:top,laserLoad:loads});
      }
      const coat=layers*p.recoat/3600,fix=p.fixed/60,jobH=exposureH+coat+fix;
      const laserHours=totalLaserVolume.map(v=>v/q);
      for(const {p:part}of entities){const row=totalParts.get(part.id);row.allocated+=(jobH*c.rate+c.setup)*((part.vol*(1+p.support/100))/bedVolume);}
      beds.push({num:ix+1,layers,exposureH,coat,fix,jobH,bedVolume,laserHours,laserVolume:totalLaserVolume,layerDistribution,efficiency:exposureH>0?totalLaserVolume.reduce((a,b)=>a+b,0)/(q*exposureH*Math.max(1,m.scans.filter(s=>s.enabled).length))*100:0});
      sumHours+=jobH;scanH+=exposureH;coatH+=coat;volAll+=bedVolume;jobCount++;maxJob=Math.max(maxJob,jobH);
    }
    const totalQty=[...totalParts.values()].reduce((a,b)=>a+b.n,0);
    const powderKg=volAll*c.density/1000*(1+c.loss/100);
    const machineCost=sumHours*c.rate,setupCost=jobCount*c.setup,rawMaterial=powderKg*c.powder;
    const post=totalQty*(c.post+c.wb+c.qa);
    const direct=machineCost+setupCost+rawMaterial+post+c.shipping;
    const withRisk=direct*(1+c.risk/100),net=withRisk*(1+c.profit/100);
    const partLines=[...totalParts.values()].filter(x=>x.n>0).map(row=>{
      const kg=row.volume*c.density/1000*(1+c.loss/100);
      const sharedCost=row.allocated;
      const materialCost=kg*c.powder;
      const directPart=sharedCost+materialCost+row.n*(c.post+c.wb+c.qa)+c.shipping*(row.n/Math.max(1,totalQty));
      const price=directPart*(1+c.risk/100)*(1+c.profit/100);
      return {...row,kg,direct:directPart,price,unit:price/row.n};
    });
    const partsPrice=partLines.reduce((a,b)=>a+b.price,0);
    // Eventuelle Rundungsabweichungen sind nur in der Darstellung zulässig.
    return {beds,totalQty,volAll,powderKg,machineCost,setupCost,rawMaterial,post,direct,withRisk,net,partsPrice,partLines,sumHours,scanH,coatH,maxJob,jobCount,q};
  };
  const lineBar=(label,h,max)=>`<div class="qt-barrow"><span>${esc(label)}</span><div class="qt-bartrack"><b style="width:${max>0?Math.max(0,Math.min(100,h/max*100)):0}%"></b></div><strong>${fmt(h,2)} h</strong></div>`;
  const metrics=(arr)=>arr.map(([label,val,unit])=>`<div class="stat"><div class="name">${esc(label)}</div><div class="qt-kpi">${esc(val)}</div><span class="unit">${esc(unit)}</span></div>`).join('');
  const table=(cols,rows)=>`<div class="qt-scroll"><table class="qt-table"><thead><tr>${cols.map(c=>`<th>${esc(c)}</th>`).join('')}</tr></thead><tbody>${rows.map(r=>`<tr>${r.map(c=>`<td>${esc(c)}</td>`).join('')}</tr>`).join('')}</tbody></table></div>`;
  const paintMetrics=()=>{
    try{
      lastCalc=estimate();const r=lastCalc;
      $('qt-build-overview').innerHTML=metrics([
        ['Aktive Laser',`${machine().scans.filter(s=>s.enabled).length}/${machine().lasers}`,'Scannerfelder in Reihe'],['Bauplatten',String(r.jobCount),'mit Bauteilen'],['Gesamtbauzeit',`${fmt(r.sumHours,2)} h`,'über alle Bauplatten'],['Aufgeschmolzen',`${fmt(r.volAll,2)} cm³`,'mit rechnerischen Supports']
      ]);
      $('qt-build-details').innerHTML=r.beds.length?r.beds.map(b=>`<div class="subcard"><strong>Platte ${b.num}: ${fmt(b.jobH,2)} h</strong> · ${b.layers} Schichten <span class="tag">${fmt(b.efficiency,0)} % Parallel-Wirkungsgrad*</span><div class="qt-bars">${b.laserHours.map((h,i)=>lineBar(`Laser ${i+1}`,h,Math.max(...b.laserHours))).join('')}</div><p class="helper">Belichtung ${fmt(b.exposureH,2)} h · Beschichten ${fmt(b.coat,2)} h · Nebenzeiten ${fmt(b.fix,2)} h. *Volumenäquivalente Parallelauslastung, nicht Maschinen-Telemetrie.</p></div>`).join(''):'<p class="helper">Noch keine Bauteile auf einer Bauplatte platziert.</p>';
      const problems=validateLayout(),over=r.beds.filter(b=>b.jobH>data.params.maxTime);
      $('qt-build-warning').textContent=[...problems,...over.map(b=>`Platte ${b.num}: Bauzeit ${fmt(b.jobH,1)} h über ${data.params.maxTime} h.`)].slice(0,5).join(' ')||'✓ Stückzahlen und Belegung vollständig.';
      $('qt-build-warning').className=problems.length||over.length?'message warn':'message';
      $('qt-cost-overview').innerHTML=metrics([['Direkte Kosten',euro(r.direct),'alle Bauplatten'],['Angebot netto',euro(r.net),'inkl. Risiko + Gewinn'],['Maschinenkosten',euro(r.machineCost),'Bauzeit × Stundensatz'],['Material',euro(r.rawMaterial),'inkl. Verlust']]);
      $('qt-cost-details').innerHTML=table(['Bauteil','Stück','Fertigung + Material + Extras','Angebot / Stück','Summe'],r.partLines.map(p=>[p.part.name,p.n,euro(p.direct),euro(p.unit),euro(p.price)]))+
        table(['Kostenanteil','Betrag'],[['Maschine',euro(r.machineCost)],['Rüsten',euro(r.setupCost)],['Pulver',euro(r.rawMaterial)],['Nacharbeit + WB + QS',euro(r.post)],['Versand',euro(data.cost.shipping)],['Direkte Kosten',euro(r.direct)],['Risikozuschlag inkl.',euro(r.withRisk)],['Gesamt netto',euro(r.net)]]);
      $('qt-cost-warning').textContent=problems.length?'Unvollständige Belegung: noch keine versandfertige Angebotskalkulation.':'Überlappende Scanfelder sind über eine vereinfachte Volumen-/Lastverteilung berücksichtigt; Gemeinkosten nach Bauteilvolumen.';
      $('qt-cost-warning').className=problems.length?'message warn':'message';
    }catch(e){lastCalc=null;for(const id of ['qt-build-overview','qt-build-details','qt-cost-overview','qt-cost-details'])$(id).innerHTML='';$('qt-build-warning').textContent=e.message;$('qt-cost-warning').textContent=e.message;}
    renderOffer();
  };
  const offerReady=()=>{
    const errors=validateLayout();
    if(!lastCalc||!lastCalc.beds.length)errors.push('Kalkulation fehlt.');
    if(!machine().verified)errors.push('Scannerfelder der Maschine nicht geprüft/bestätigt.');
    if(!data.customer.trim())errors.push('Kundenname fehlt.');
    if(!data.number.trim())errors.push('Angebotsnummer fehlt.');
    if(!data.offer.date)errors.push('Angebotsdatum fehlt.');
    if(!data.offer.valid)errors.push('Gültigkeitsdatum fehlt.');
    if(data.offer.valid&&data.offer.date&&data.offer.valid<data.offer.date)errors.push('Gültig-bis-Datum liegt vor dem Angebotsdatum.');
    if(lastCalc&&lastCalc.beds.some(b=>b.jobH>data.params.maxTime))errors.push('Mindestens eine Bauplatte überschreitet die Bauzeitgrenze.');
    return [...new Set(errors)];
  };
  const renderOffer=()=>{
    const r=lastCalc,errors=offerReady();
    $('qt-print').disabled=!!errors.length;
    $('qt-offer-warning').textContent=errors.length?errors.slice(0,6).join(' '):'✓ Angebot kann als PDF ausgegeben werden.';
    $('qt-offer-warning').className=errors.length?'message warn':'message';
    if(!r){$('qt-offer-preview').innerHTML='<p class="helper">Zuerst Bauteildaten, Prozessparameter und Kosten prüfen.</p>';return;}
    $('qt-offer-preview').innerHTML=`<div class="qt-offer-paper" id="qt-offer-document">
      <div class="qt-offer-tag">BECKER LASER MELTING · ANGEBOT</div><h3>${esc(data.number||'Entwurf')}</h3>
      <p><b>Kunde:</b> ${esc(data.customer||'—')}<br><b>Projekt:</b> ${esc(data.project||'—')}<br><b>Datum:</b> ${esc(data.offer.date||'—')} · <b>gültig bis:</b> ${esc(data.offer.valid||'—')}</p>
      <hr style="border:none;border-top:1px solid #c8d4e0;margin:17px 0"><p><b>Verfahren:</b> Laser Powder Bed Fusion (LPBF)<br><b>Material:</b> ${esc(data.material)} · <b>Maschine:</b> ${esc(machineNames[data.machine])}<br><b>Schichtdicke:</b> ${fmt(data.params.layer)} µm · <b>Bauplatten:</b> ${r.jobCount}<br><b>Lieferzeit:</b> ${esc(data.offer.lead||'Nach Absprache')}</p>
      <div class="qt-scroll"><table><thead><tr><th>Position</th><th>Menge</th><th>Einzelpreis netto</th><th>Gesamt netto</th></tr></thead><tbody>
        ${r.partLines.map((row,i)=>`<tr><td>${i+1}. ${esc(row.part.name)}</td><td>${row.n}</td><td>${euro(row.unit)}</td><td>${euro(row.price)}</td></tr>`).join('')}
      </tbody></table></div>
      <div class="qt-offer-grand">Gesamt netto: ${euro(r.net)}</div>
      <p style="margin-top:15px"><b>Lieferbedingungen:</b> ${esc(data.offer.terms)}</p>
      <p><b>Hinweis:</b> Vorbehaltlich technischer Klärung, Fertigbarkeit, Bauteilorientierung, Supportstrategie sowie finaler Baujobsimulation. Es handelt sich um eine Kalkulation auf Basis geschätzter LPBF-Zeiten.</p>
      <p>${esc(data.notes||'')}</p></div>`;
  };
  const printOffer=()=>{
    if(offerReady().length){note('Angebot ist unvollständig. Bitte Warnungen in Schritt 5 prüfen.',true);return;}
    const print=$('qt-offer-print');print.innerHTML=$('qt-offer-document').outerHTML;
    document.body.classList.add('qt-offer-print-mode');
    window.print();
    setTimeout(()=>document.body.classList.remove('qt-offer-print-mode'),1300);
  };
  const redrawProjectList=()=>{
    const select=$('qt-projects-select'),chosen=select.value;select.replaceChildren();
    const placeholder=document.createElement('option');placeholder.value='';placeholder.textContent='– Bitte auswählen –';select.append(placeholder);
    projects.forEach(pr=>{const opt=document.createElement('option');opt.value=pr.id;opt.textContent=`${pr.name} · ${pr.date||''}`;select.append(opt);});select.value=chosen;
  };
  const showStep=i=>{
    step=Math.max(0,Math.min(4,i));
    document.querySelectorAll('[data-qt-step]').forEach(b=>{const on=Number(b.dataset.qtStep)===step;b.classList.toggle('active',on);b.setAttribute('aria-selected',String(on));});
    for(let k=0;k<=4;k++)$('qt-page-'+k).hidden=k!==step;
    $('qt-prev').disabled=step===0;$('qt-next').hidden=step===4;
    $('qt-next').textContent=['Weiter: Bauplatte →','Weiter: Bauzeit →','Weiter: Kosten →','Weiter: Angebot →',''][step];
    if(step===1)drawPlate();
  };
  const drawAll=()=>{
    redrawParts();redrawBedTabs();drawPlate();scanStatus();paintMetrics();showStep(step);redrawProjectList();
  };
  const update=(persistIt=true)=>{drawAll();if(persistIt)persist();};
  const safeQuoteImport=payload=>{
    if(!payload||typeof payload!=='object'||!Array.isArray(payload.parts)||!Array.isArray(payload.beds))throw Error('Keine gültigen Angebotsdaten.');
    const raw=JSON.stringify(payload);if(raw.length>3000000)throw Error('Projektdatei ist zu groß.');
    data=JSON.parse(raw);normalize();activeBed=0;selected=null;editing=null;stlTemp=null;putInputs();persist();
  };
  const API={exportState:()=>({data:snapshot(),projects}),importState:p=>{
    if(!p||typeof p!=='object')throw Error('Angebotsbackup unvollständig.');
    safeQuoteImport(p.data);if(Array.isArray(p.projects)){projects=p.projects.filter(o=>o&&o.snapshot&&o.id).slice(0,30);storeProjects();}redrawProjectList();
  }};
  window.beckerQuote=API;
  const register=()=>{
    Object.entries(fields).forEach(([key,id])=>{
      $(id).addEventListener(key==='machine'||key==='material'?'change':'input',()=>{
        data[key]=$(id).value;
        if(key==='machine'){
          selected=null;activeBed=0;
          $('qt-bed-w').value=machine().w;$('qt-bed-h').value=machine().h;
          $('qt-machine-label').textContent=machineNames[data.machine];
          scanUI();
        }
        if(key==='material')applyMaterial();update();
      });
    });
    Object.entries(paramFields).forEach(([key,id])=>$(id).addEventListener('input',()=>{data.params[key]=$(id).value.trim()?Number($(id).value.replace(',','.')):NaN;update();}));
    Object.entries(costFields).forEach(([key,id])=>$(id).addEventListener('input',()=>{data.cost[key]=$(id).value.trim()?Number($(id).value.replace(',','.')):NaN;update();}));
    Object.entries(offerFields).forEach(([key,id])=>$(id).addEventListener('input',()=>{data.offer[key]=$(id).value;update();}));
    ['qt-bed-w','qt-bed-h'].forEach(id=>$(id).addEventListener('change',()=>{
      const val=readNum(id);if(!Number.isFinite(val)||val<20||val>1000){note('Plattenmaß muss 20–1000 mm betragen.',true);return;}
      const m=machine();m[id==='qt-bed-w'?'w':'h']=val;
      m.scans=autoScans(m.w,m.h,m.lasers,m.overlap,m.direction);markScanUnverified();scanUI();update();
    }));
    $('qt-create-scans').addEventListener('click',()=>{
      const m=machine(),ov=Number($('qt-overlap').value),direction=$('qt-direction').value;
      if(!Number.isFinite(ov)||ov<0||ov>Math.min(direction==='y'?m.h:m.w,400)||(m.lasers-1)*ov>=(direction==='y'?m.h:m.w)*m.lasers){note('Überlappung: bitte gültige Millimeterzahl eingeben.',true);return;}
      m.overlap=ov;m.direction=direction;m.scans=autoScans(m.w,m.h,m.lasers,ov,m.direction);markScanUnverified();scanUI();update();note('Gleichmäßige Beispiel-Scanfelder erzeugt. Bitte an realen Maschinendaten ausrichten.');
    });
    $('qt-scan-rows').addEventListener('change',event=>{
      const target=event.target,idx=Number(target.dataset.scanId??target.dataset.scanActive);
      if(!Number.isInteger(idx)||!machine().scans[idx])return;
      if(target.matches('[data-scan-active]'))machine().scans[idx].enabled=target.checked;
      else if(target.matches('[data-scan-field]')){
        const val=target.value.trim()?Number(target.value.replace(',','.')):NaN;
        machine().scans[idx][target.dataset.scanField]=val;
      }else return;
      markScanUnverified();scanStatus();update();
    });
    $('qt-scans-verified').addEventListener('change',()=>{
      if($('qt-scans-verified').checked){
        const errors=scanMessage().filter(x=>!x.includes('PDF-Angebot gesperrt'));
        if(errors.length){$('qt-scans-verified').checked=false;note(errors[0],true);return;}
      }
      machine().verified=$('qt-scans-verified').checked;update();
    });
    $('qt-overlap').addEventListener('input',()=>{ /* Vorlage: erst mit Button aktivieren */ });
    $('qt-save-scans').addEventListener('click',()=>{
      try{localStorage.setItem('becker-quote-machine-config-v3',JSON.stringify(data.machines));note('Alle Laserkonfigurationen lokal gespeichert. Bitte auch Projekt-/Gesamtbackup exportieren.');}
      catch(e){note('Speichern fehlgeschlagen.',true);}
    });
    $('qt-set-profile').addEventListener('click',()=>{
      try{localStorage.setItem('becker-quote-machine-config-v3',JSON.stringify(data.machines));note('Maschinenprofile auf diesem Gerät gespeichert.');}
      catch(e){note('Speichern fehlgeschlagen.',true);}
    });
    document.querySelectorAll('[data-qt-step]').forEach(b=>b.addEventListener('click',()=>showStep(Number(b.dataset.qtStep))));
    $('qt-prev').addEventListener('click',()=>showStep(step-1));$('qt-next').addEventListener('click',()=>showStep(step+1));
    $('qt-stl-file').addEventListener('change',STLhandler);$('qt-part-save').addEventListener('click',savePart);$('qt-part-cancel').addEventListener('click',clearPartForm);
    $('qt-parts-list').addEventListener('click',event=>{
      const ed=event.target.closest('[data-edit-part]'),del=event.target.closest('[data-del-part]');
      if(ed){const p=findPart(ed.dataset.editPart);if(!p)return;editing=p.id;stlTemp=null;$('qt-part-name').value=p.name;$('qt-part-qty').value=p.qty;$('qt-part-w').value=p.w;$('qt-part-h').value=p.h;$('qt-part-z').value=p.z;$('qt-part-vol').value=p.vol;$('qt-stl-info').textContent=p.stlName?`Bereits vorhandene STL: ${p.stlName} (bei geändertem X/Y wird die Silhouette skaliert).`:'Rechteckmodus';$('qt-part-save').textContent='Änderungen speichern';$('qt-part-cancel').hidden=false;$('qt-part-name').focus();}
      if(del){const p=findPart(del.dataset.delPart);if(!p||!confirm(`Bauteil „${p.name}“ und alle Platzierungen löschen?`))return;data.parts=data.parts.filter(x=>x.id!==p.id);data.beds.forEach(b=>b.items=b.items.filter(i=>i.partId!==p.id));selected=null;clearPartForm();update(true);}
    });
    $('qt-place-one').addEventListener('click',placeOne);$('qt-autopack').addEventListener('click',packAll);
    $('qt-add-bed').addEventListener('click',()=>{if(addBed()){selected=null;update(true);}});
    $('qt-remove-bed').addEventListener('click',()=>{if(data.beds.length<=1)return;if(!confirm('Diese Bauplatte mit allen darauf platzierten Bauteilen löschen?'))return;data.beds.splice(activeBed,1);activeBed=0;selected=null;update(true);});
    $('qt-show-zones').addEventListener('change',drawPlate);
    $('qt-sel-x').addEventListener('change',()=>setSelectedPos(readNum('qt-sel-x'),NaN));
    $('qt-sel-y').addEventListener('change',()=>setSelectedPos(NaN,readNum('qt-sel-y')));
    $('qt-rot-l').addEventListener('click',()=>rotateSelected(-15));$('qt-rot-r').addEventListener('click',()=>rotateSelected(15));$('qt-rot-90').addEventListener('click',()=>rotateSelected(90));
    $('qt-remove-item').addEventListener('click',()=>{getBed().items=getBed().items.filter(i=>i.id!==selected);selected=null;update(true);});
    $('qt-svg').addEventListener('pointermove',platePointer);
    const endDrag=()=>{if(dragging){dragging=null;update(true);}};
    $('qt-svg').addEventListener('pointerup',endDrag);$('qt-svg').addEventListener('pointercancel',endDrag);
    $('qt-from-legacy').addEventListener('click',()=>{
      const get=k=>{const n=document.querySelector(`[data-field="${k}"]`);return n?Number(n.value):null;};
      const map={power:'power',speed:'speed',hatch:'hatch',layer:'layer',eff:'efficiency',recoat:'recoat',fixed:'fixed',support:'support',maxTime:'limit'};
      const costMap={rate:'machineRate',powder:'powderPrice',density:'density',loss:'powderLoss',setup:'setupCost',post:'postCost'};
      for(const [k,old]of Object.entries(map)){const v=get(old);if(Number.isFinite(v))data.params[k]=v;}
      for(const [k,old]of Object.entries(costMap)){const v=get(old);if(Number.isFinite(v))data.cost[k]=v;}
      putInputs();persist();note('Werte aus dem bisherigen Laser- und Kostenrechner übernommen.');
    });
    $('qt-print').addEventListener('click',printOffer);
    $('qt-export-json').addEventListener('click',()=>{dwn(JSON.stringify({format:'BeckerTools-QuoteV3',version:3,exported:new Date().toISOString(),data:snapshot()},null,2),`Becker_Angebot_${data.number||'Entwurf'}.json`,'application/json');note('Projekt-JSON erstellt.');});
    $('qt-export-csv').addEventListener('click',()=>{
      if(!lastCalc){note('Noch keine gültige Kalkulation.',true);return;}
      const rows=[['Angebot',data.number],['Kunde',data.customer],['Maschine',machineNames[data.machine]],['Werkstoff',data.material],[],['Bauteil','Anzahl','Netto je Stück','Gesamt netto']];
      lastCalc.partLines.forEach(r=>rows.push([r.part.name,r.n,r.unit.toFixed(2),r.price.toFixed(2)]));rows.push([],['Netto gesamt',lastCalc.net.toFixed(2)],['Bauzeit h',lastCalc.sumHours.toFixed(3)]);
      const csv='\ufeff'+rows.map(row=>row.map(v=>{let s=String(v??'');if(/^[\s]*[=+@]/.test(s))s="'"+s;return '"'+s.replace(/"/g,'""')+'"';}).join(';')).join('\r\n');
      dwn(csv,`Becker_Kalkulation_${data.number||'Entwurf'}.csv`,'text/csv;charset=utf-8');note('CSV erstellt.');
    });
    $('qt-save-project').addEventListener('click',()=>{
      const id=data.number.trim()||data.project.trim();if(!id){note('Projektname oder Angebotsnummer fehlt.',true);return;}
      const existing=projects.find(p=>p.id===id);
      if(existing&&!confirm(`Projekt „${id}“ überschreiben?`))return;
      const entry={id,name:`${id} · ${data.customer||data.project||'ohne Kunde'}`,date:new Date().toLocaleDateString('de-DE'),snapshot:snapshot()};
      projects=projects.filter(p=>p.id!==id);projects.unshift(entry);projects=projects.slice(0,25);storeProjects();redrawProjectList();$('qt-projects-select').value=id;note('Projekt gespeichert. Für zusätzliche Sicherheit JSON exportieren.');
    });
    $('qt-load-project').addEventListener('click',()=>{
      const ent=projects.find(p=>p.id===$('qt-projects-select').value);if(!ent){note('Bitte ein gespeichertes Projekt auswählen.',true);return;}
      if(!confirm('Aktuellen Entwurf durch gespeichertes Projekt ersetzen?'))return;
      safeQuoteImport(ent.snapshot);note('Projekt geladen.');
    });
    $('qt-delete-project').addEventListener('click',()=>{
      const id=$('qt-projects-select').value;if(!id)return;
      if(!confirm(`Gespeichertes Projekt „${id}“ wirklich löschen?`))return;
      projects=projects.filter(p=>p.id!==id);storeProjects();redrawProjectList();note('Gespeichertes Projekt gelöscht.');
    });
    $('qt-import-project').addEventListener('click',()=>$('qt-import-project-file').click());
    $('qt-import-project-file').addEventListener('change',async event=>{
      const file=event.target.files?.[0];if(!file)return;
      try{
        if(file.size>3000000)throw Error('Projektdatei ist zu groß (max. 3 MB).');
        const payload=JSON.parse(await file.text());
        if(payload.format!=='BeckerTools-QuoteV3'||payload.version!==3||!payload.data)throw Error('Kein Becker Tools V3 Angebotsprojekt.');
        if(!confirm('Aktuellen Entwurf durch die importierten Angebotsdaten ersetzen?'))return;
        safeQuoteImport(payload.data);note('Angebotsprojekt importiert.');
      }catch(e){note(`Import fehlgeschlagen: ${e.message}`,true);}finally{event.target.value='';}
    });
    $('qt-new-project').addEventListener('click',()=>{
      if(!confirm('Neues leeres Projekt beginnen? Aktuellen Stand gegebenenfalls vorher speichern.'))return;
      const m=data.machines;data=defaults();data.machines=m;activeBed=0;selected=null;step=0;clearPartForm();putInputs();persist();note('Neues Projekt angelegt.');
    });
    window.addEventListener('afterprint',()=>document.body.classList.remove('qt-offer-print-mode'));
  };
  load();normalize();
  try{const prefs=JSON.parse(localStorage.getItem('becker-quote-machine-config-v3')||'null');if(prefs&&typeof prefs==='object'&&!localStorage.getItem(K)){for(const id of Object.keys(defaults().machines))if(prefs[id]?.w>20&&prefs[id]?.h>20&&Array.isArray(prefs[id].scans)){data.machines[id]={...data.machines[id],...prefs[id]};}}}catch(e){}
  normalize();
  if(!data.offer.valid){const dt=new Date();dt.setDate(dt.getDate()+30);data.offer.valid=`${dt.getFullYear()}-${String(dt.getMonth()+1).padStart(2,'0')}-${String(dt.getDate()).padStart(2,'0')}`;}
  const printContainer=document.createElement('div');printContainer.id='qt-offer-print';document.body.append(printContainer);
  putInputs();register();showStep(0);
})();
