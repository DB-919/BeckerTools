/* Becker Tools V2.1 — Originalfunktion der Wärmezeit-PWA, angepasst als natives Becker-Tools-Modul.
   Keine externen Bibliotheken, keine Ofensteuerung. Lokale Speicherung und Backup. */
(() => {
  'use strict';
  const $ = id => document.getElementById(id);
  const PREFIX='becker.waermezeit.v1';
  const SAMPLE=[
    {action:'Aufheizen',temp:300,h:1,m:30},
    {action:'Halten',temp:300,h:1,m:0},
    {action:'Aufheizen',temp:450,h:0,m:45},
    {action:'Halten',temp:450,h:1,m:0},
    {action:'Aufheizen',temp:505,h:0,m:45},
    {action:'Halten',temp:505,h:1,m:0}
  ];
  const ACTIONS=['Aufheizen','Halten','Abkühlen','Warten','Sonstiges'];
  const clone=x=>JSON.parse(JSON.stringify(x));
  const pad=n=>String(n).padStart(2,'0');
  const nowDate=()=>new Date();
  const localDate=d=>`${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}`;
  const localTime=d=>`${pad(d.getHours())}:${pad(d.getMinutes())}`;
  const dateDisplay=d=>d?new Intl.DateTimeFormat('de-DE',{day:'2-digit',month:'2-digit',year:'numeric',hour:'2-digit',minute:'2-digit'}).format(d):'–';
  const shortDisplay=d=>d?new Intl.DateTimeFormat('de-DE',{day:'2-digit',month:'2-digit',hour:'2-digit',minute:'2-digit'}).format(d):'–';
  const hm=n=>`${pad(Math.floor(Math.max(0,n)/60))}:${pad(Math.floor(Math.max(0,n)%60))}`;
  const clock=ms=>{let seconds=Math.max(0,Math.floor(ms/1000));const days=Math.floor(seconds/86400);seconds%=86400;const hours=Math.floor(seconds/3600);seconds%=3600;const mins=Math.floor(seconds/60);seconds%=60;return (days?`${days} T `:'')+`${pad(hours)}:${pad(mins)}:${pad(seconds)}`;};
  const msg=t=>{ $('wz-status').textContent=t||''; };
  const safeStep=src=>{
    const s=src&&typeof src==='object'?src:{};
    const whole=(v,max)=>{const n=Number(v);return Number.isFinite(n)?Math.min(max,Math.max(0,Math.floor(n))):0;};
    const rawtemp=s.temp==null?'':String(s.temp).trim().replace(',','.');
    const n=Number(rawtemp);
    return {action:ACTIONS.includes(s.action)?s.action:'Halten',temp:rawtemp!==''&&Number.isFinite(n)&&n>=-273&&n<=2000?String(n):'',h:whole(s.h,9999),m:whole(s.m,59)};
  };
  const safeSteps=arr=>Array.isArray(arr)?arr.slice(0,100).map(safeStep):clone(SAMPLE);
  const safePrograms=source=>{
    const result=Object.create(null);
    if(!source||typeof source!=='object'||Array.isArray(source))return result;
    for(const [key,value] of Object.entries(source).slice(0,50)){
      if(!key.trim()||key.length>60||!Array.isArray(value))continue;
      result[key]=safeSteps(value);
    }
    return result;
  };
  let mode='end',steps=clone(SAMPLE),programs=Object.create(null),times={start:null,end:null,total:0};
  let saveFailed=false;
  function combine(dateStr,timeStr){
    if(!/^\d{4}-\d{2}-\d{2}$/.test(dateStr||'')||!/^\d{2}:\d{2}$/.test(timeStr||''))return null;
    const [y,mo,day]=dateStr.split('-').map(Number),[h,m]=timeStr.split(':').map(Number);
    if(y<1900||y>2200||mo<1||mo>12||day<1||day>31||h>23||m>59)return null;
    const d=new Date(y,mo-1,day,h,m,0,0);
    return d.getFullYear()===y&&d.getMonth()===mo-1&&d.getDate()===day&&d.getHours()===h&&d.getMinutes()===m?d:null;
  }
  function defaultDates(){
    const today=nowDate(),tomorrow=new Date(today);
    tomorrow.setDate(today.getDate()+1);tomorrow.setHours(10,0,0,0);
    $('wz-end-date').value=localDate(tomorrow);$('wz-end-time').value='10:00';
    $('wz-start-date').value=localDate(today);$('wz-start-time').value=localTime(today);
  }
  function load(){
    defaultDates();
    try{
      const raw=localStorage.getItem(PREFIX+'.state')||localStorage.getItem('waermezeit.state');
      const old=JSON.parse(raw||'null');
      if(old&&typeof old==='object'){
        mode=old.mode==='start'?'start':'end';steps=safeSteps(old.steps);
        if(combine(old.endDate,old.endTime)){$('wz-end-date').value=old.endDate;$('wz-end-time').value=old.endTime;}
        if(combine(old.startDate,old.startTime)){$('wz-start-date').value=old.startDate;$('wz-start-time').value=old.startTime;}
      }
      const rawPrograms=localStorage.getItem(PREFIX+'.programs')||localStorage.getItem('waermezeit.programs');
      programs=safePrograms(JSON.parse(rawPrograms||'{}'));
    }catch(e){msg('Gespeicherte Wärmezeit-Daten konnten nicht vollständig eingelesen werden.');}
  }
  function stateData(){return {
    mode,steps:clone(steps),
    endDate:$('wz-end-date').value,endTime:$('wz-end-time').value,
    startDate:$('wz-start-date').value,startTime:$('wz-start-time').value
  };}
  function persist(){
    try{
      localStorage.setItem(PREFIX+'.state',JSON.stringify(stateData()));
      localStorage.setItem(PREFIX+'.programs',JSON.stringify(programs));
      if(saveFailed){msg('Lokale Speicherung wieder verfügbar.');saveFailed=false;}
    }catch(e){saveFailed=true;msg('Lokales Speichern nicht verfügbar. Bitte JSON-Backup unter Profile verwenden.');}
  }
  function renderPrograms(select=''){
    const dropdown=$('wz-programs'),previous=select||dropdown.value;
    dropdown.replaceChildren();const placeholder=document.createElement('option');placeholder.value='';placeholder.textContent='Programm auswählen…';dropdown.append(placeholder);
    for(const name of Object.keys(programs).sort((a,b)=>a.localeCompare(b,'de'))){
      const opt=document.createElement('option');opt.value=name;opt.textContent=name;dropdown.append(opt);
    }
    if(Object.hasOwn(programs,previous))dropdown.value=previous;
  }
  function setMode(m,save=true){
    mode=m==='start'?'start':'end';
    $('wz-mode-end').setAttribute('aria-pressed',String(mode==='end'));
    $('wz-mode-start').setAttribute('aria-pressed',String(mode==='start'));
    $('wz-end-block').hidden=mode!=='end';
    $('wz-start-block').hidden=mode!=='start';
    if(save)persist();calc();
  }
  function renderSteps(){
    const host=$('wz-steps');host.replaceChildren();
    steps.forEach((step,i)=>{
      const wrap=document.createElement('div');wrap.className='wz-step';
      const header=document.createElement('div');header.className='wz-step-head';
      const title=document.createElement('strong');title.textContent=`Schritt ${i+1}`;
      const controls=document.createElement('div');controls.className='wz-small-actions';
      const mk=(label,desc,type,disabled,fn)=>{const b=document.createElement('button');b.type='button';b.className='btn '+(type||'secondary');b.textContent=label;b.setAttribute('aria-label',desc);b.disabled=disabled;b.addEventListener('click',fn);return b;};
      controls.append(
        mk('↑',`Schritt ${i+1} nach oben`,'secondary',i===0,()=>move(i,-1)),
        mk('↓',`Schritt ${i+1} nach unten`,'secondary',i===steps.length-1,()=>move(i,1)),
        mk('×',`Schritt ${i+1} löschen`,'danger',false,()=>{steps.splice(i,1);persist();renderSteps();calc();})
      );
      header.append(title,controls);wrap.append(header);
      const fields=document.createElement('div');fields.className='wz-step-fields';
      const actionLabel=document.createElement('label');actionLabel.textContent='Aktion';const select=document.createElement('select');
      select.setAttribute('aria-label',`Aktion Schritt ${i+1}`);
      for(const action of ACTIONS){const op=document.createElement('option');op.value=action;op.textContent=action;select.append(op);}select.value=step.action;
      actionLabel.append(select);fields.append(actionLabel);
      const tempLabel=document.createElement('label');tempLabel.textContent='Temperatur (°C)';const temp=document.createElement('input');
      Object.assign(temp,{type:'number',inputMode:'decimal',step:'any',value:step.temp});temp.min='-273';temp.max='2000';temp.setAttribute('aria-label',`Temperatur Schritt ${i+1}`);
      tempLabel.append(temp);fields.append(tempLabel);wrap.append(fields);
      const duration=document.createElement('div');duration.className='wz-step-hours';
      const number=(name,val,max)=>{const label=document.createElement('label');label.textContent=name;const input=document.createElement('input');input.type='number';input.inputMode='numeric';input.min='0';input.max=String(max);input.step='1';input.value=String(val);input.setAttribute('aria-label',`${name} Schritt ${i+1}`);label.append(input);duration.append(label);return input;};
      const hours=number('Stunden',step.h,9999),mins=number('Minuten',step.m,59);wrap.append(duration);
      select.addEventListener('change',()=>{step.action=select.value;persist();calc();});
      temp.addEventListener('change',()=>{step.temp=safeStep({...step,temp:temp.value}).temp;temp.value=step.temp;persist();calc();});
      const durationChange=(input,field,max)=>{
        const val=Number(input.value);step[field]=Number.isFinite(val)?Math.max(0,Math.min(max,Math.trunc(val))):0;
        input.value=step[field];persist();calc();
      };
      hours.addEventListener('input',()=>{
        const val=Number(hours.value);step.h=Number.isFinite(val)?Math.max(0,Math.min(9999,Math.trunc(val))):0;persist();calc();
      });
      mins.addEventListener('input',()=>{
        const val=Number(mins.value);step.m=Number.isFinite(val)?Math.max(0,Math.min(59,Math.trunc(val))):0;persist();calc();
      });
      hours.addEventListener('change',()=>durationChange(hours,'h',9999));
      mins.addEventListener('change',()=>durationChange(mins,'m',59));
      host.append(wrap);
    });
  }
  function move(i,n){const j=i+n;if(j<0||j>=steps.length)return;[steps[i],steps[j]]=[steps[j],steps[i]];persist();renderSteps();calc();}
  function calc(){
    const total=steps.reduce((sum,s)=>sum+s.h*60+s.m,0);
    let start=null,end=null;
    if(mode==='end'){
      end=combine($('wz-end-date').value,$('wz-end-time').value);
      if(end)start=new Date(end.getTime()-total*60000);
    }else{
      start=combine($('wz-start-date').value,$('wz-start-time').value);
      if(start)end=new Date(start.getTime()+total*60000);
    }
    times={start,end,total};
    $('wz-total').textContent=hm(total)+' h';$('wz-count').textContent=String(steps.length);
    $('wz-start-out').textContent=dateDisplay(start);$('wz-end-out').textContent=dateDisplay(end);
    const host=$('wz-timeline');host.replaceChildren();
    if(start&&steps.length){
      let cursor=start;
      steps.forEach((step,i)=>{
        const duration=step.h*60+step.m,to=new Date(cursor.getTime()+duration*60000);
        const row=document.createElement('div');row.className='wz-line';
        const clockCol=document.createElement('div');clockCol.className='wz-clock';clockCol.textContent=`${shortDisplay(cursor)} – ${shortDisplay(to)}`;
        const label=document.createElement('div');label.textContent=`${i+1}. ${step.action}${step.temp!==''?' · '+step.temp+' °C':''}`;
        const timeCol=document.createElement('div');timeCol.className='wz-line-time';timeCol.textContent=hm(duration)+' h';
        row.append(clockCol,label,timeCol);host.append(row);cursor=to;
      });
    }else{
      const p=document.createElement('p');p.className='helper';p.textContent=!start?'Bitte ein gültiges Start- oder Zieldatum eingeben.':'Noch keine Schritte eingetragen.';host.append(p);
    }
    tick();
  }
  function tick(){
    const {start,end}=times,now=Date.now();
    const out=$('wz-wait'),label=$('wz-wait-label');
    if(!start){label.textContent='Noch kein gültiger Zeitplan';out.textContent='--:--:--';return;}
    if(now<start.getTime()){
      label.textContent='Wartezeit bis Start';out.textContent=clock(start.getTime()-now);
    }else if(end&&now<end.getTime()){
      label.textContent='Prozess läuft – Restzeit';out.textContent=clock(end.getTime()-now);
    }else{
      label.textContent='Prozessende ist vergangen seit';out.textContent=clock(now-(end||start).getTime());
    }
  }
  function saveProgram(){
    const name=prompt('Name des Wärmezeit-Programms:');if(name===null)return;
    const key=name.trim();if(!key||key.length>60){msg('Bitte einen Programmnamen mit maximal 60 Zeichen eingeben.');return;}
    if(Object.hasOwn(programs,key)&&!confirm(`Programm „${key}“ überschreiben?`))return;
    if(!Object.hasOwn(programs,key)&&Object.keys(programs).length>=50){msg('Maximal 50 Programme speicherbar.');return;}
    programs[key]=clone(steps);persist();renderPrograms(key);msg(`Programm „${key}“ gespeichert.`);
  }
  function deleteProgram(){
    const key=$('wz-programs').value;if(!key){msg('Bitte zuerst ein Programm auswählen.');return;}
    if(!confirm(`Programm „${key}“ endgültig löschen?`))return;
    delete programs[key];persist();renderPrograms();msg(`Programm „${key}“ gelöscht.`);
  }
  function loadProgram(){
    const key=$('wz-programs').value;if(!key||!Object.hasOwn(programs,key))return;
    steps=clone(programs[key]);persist();renderSteps();calc();msg(`Programm „${key}“ geladen.`);
  }
  const dt=d=>`${d.getUTCFullYear()}${pad(d.getUTCMonth()+1)}${pad(d.getUTCDate())}T${pad(d.getUTCHours())}${pad(d.getUTCMinutes())}${pad(d.getUTCSeconds())}Z`;
  const escICS=s=>String(s).replace(/\\/g,'\\\\').replace(/\r?\n/g,'\\n').replace(/;/g,'\\;').replace(/,/g,'\\,');
  function downloadICS(){
    if(!times.start||!times.end||times.total<=0){msg('Bitte einen gültigen Zeitplan mit einer Dauer größer 0 erstellen.');return;}
    const descr=steps.map((s,i)=>`${i+1}. ${s.action}${s.temp!==''?' '+s.temp+' °C':''} · ${hm(s.h*60+s.m)} h`).join('\n');
    const lines=['BEGIN:VCALENDAR','VERSION:2.0','PRODID:-//Becker Tools Waermezeit//DE','CALSCALE:GREGORIAN',
      'BEGIN:VEVENT',`UID:${Date.now()}-${Math.floor(Math.random()*1000000)}@becker-tools`,`DTSTAMP:${dt(nowDate())}`,
      `DTSTART:${dt(times.start)}`,`DTEND:${dt(times.end)}`,'SUMMARY:Wärmebehandlung · Wärmezeit',`DESCRIPTION:${escICS(descr)}`,
      'BEGIN:VALARM','TRIGGER:-PT10M','ACTION:DISPLAY','DESCRIPTION:Wärmebehandlung startet in 10 Minuten',
      'END:VALARM','END:VEVENT','END:VCALENDAR'];
    const blob=new Blob([lines.join('\r\n')+'\r\n'],{type:'text/calendar;charset=utf-8'});
    const url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download='Becker_Waermezeit_Prozess.ics';
    document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),15000);
    msg('Kalenderdatei erzeugt. In Apple Kalender importieren, um die Erinnerung einzurichten.');
  }
  function sendToTimer(){
    if(!times.start||!times.end||times.total<=0){msg('Bitte zuerst einen gültigen Prozessplan erstellen.');return;}
    const remaining=Date.now()<times.start.getTime()?times.total*60000:times.end.getTime()-Date.now();
    const seconds=Math.ceil(remaining/1000);
    if(seconds<=0){msg('Das geplante Prozessende liegt bereits in der Vergangenheit.');return;}
    if(seconds>999*3600+59*60+59){msg('Für den Timer sind maximal 999 Stunden, 59 Minuten, 59 Sekunden möglich.');return;}
    if(!$('timer-hours')||!$('timer-mode')){msg('Timer-Modul nicht verfügbar.');return;}
    if(!$('timer-pause').disabled){
      if(!confirm('Der bisherige Timer läuft. Wirklich stoppen und mit der Wärmezeit-Restdauer ersetzen?'))return;
      $('timer-pause').click();
    }
    $('timer-mode').value='countdown';
    $('timer-label').value='Wärmezeit · '+(Date.now()<times.start.getTime()?'Prozessdauer':'Restlaufzeit');
    $('timer-hours').value=Math.floor(seconds/3600);
    $('timer-minutes').value=Math.floor((seconds%3600)/60);
    $('timer-seconds').value=seconds%60;
    $('timer-seconds').dispatchEvent(new Event('change',{bubbles:true}));
    $('tab-timer').click();
    msg('Dauer in Timer übernommen. Zum Starten „Start“ tippen.');
  }
  function exportState(){return {state:stateData(),programs:clone(programs)};}
  function importState(data){
    if(!data||typeof data!=='object'||!data.state||typeof data.state!=='object')return;
    const x=data.state;
    mode=x.mode==='start'?'start':'end';steps=safeSteps(x.steps);programs=safePrograms(data.programs);
    defaultDates();
    if(combine(x.endDate,x.endTime)){$('wz-end-date').value=x.endDate;$('wz-end-time').value=x.endTime;}
    if(combine(x.startDate,x.startTime)){$('wz-start-date').value=x.startDate;$('wz-start-time').value=x.startTime;}
    renderPrograms();renderSteps();setMode(mode,false);persist();calc();msg('Wärmezeit-Daten aus dem Backup übernommen.');
  }
  function init(){
    load();renderPrograms();renderSteps();setMode(mode,false);
    $('wz-mode-end').addEventListener('click',()=>setMode('end'));
    $('wz-mode-start').addEventListener('click',()=>setMode('start'));
    for(const id of ['wz-end-date','wz-end-time','wz-start-date','wz-start-time'])$(id).addEventListener('change',()=>{persist();calc();});
    $('wz-add').addEventListener('click',()=>{
      if(steps.length>=100){msg('Maximal 100 Schritte pro Prozessplan möglich.');return;}
      const last=steps.at(-1)||{};steps.push({action:'Halten',temp:last.temp??'',h:1,m:0});persist();renderSteps();calc();
    });
    $('wz-preset').addEventListener('click',()=>{steps=clone(SAMPLE);persist();renderSteps();calc();msg('Beispielprogramm geladen – keine freigegebene Wärmebehandlungsvorschrift.');});
    $('wz-clear').addEventListener('click',()=>{if(!confirm('Alle Prozessschritte aus der aktuellen Planung löschen?'))return;steps=[];persist();renderSteps();calc();});
    $('wz-save').addEventListener('click',saveProgram);
    $('wz-delete').addEventListener('click',deleteProgram);
    $('wz-programs').addEventListener('change',loadProgram);
    $('wz-ics').addEventListener('click',downloadICS);
    $('wz-to-timer').addEventListener('click',sendToTimer);
    $('wz-to-wb').addEventListener('click',()=>$('tab-wb').click());
    window.beckerWaermezeit={exportState,importState,getCalculated:()=>({...times})};
    // Save original Wärmezeit-Daten beim ersten Laden unter dem Becker-Tools-Key.
    persist();calc();setInterval(tick,1000);document.addEventListener('visibilitychange',tick);
  }
  if($('panel-waermezeit'))init();
})();
