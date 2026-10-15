/* A day-first text field and calendar share the existing tracking input. */
(function(g){
 'use strict';
 const states=new WeakMap(),months=['Januari','Februari','Maret','April','Mei','Juni','Juli','Agustus','September','Oktober','November','Desember'],days=['Sen','Sel','Rab','Kam','Jum','Sab','Min'];
 let popup=null,active=null,selected='',focused='',viewYear=0,viewMonth=0;
 const $=id=>document.getElementById(id),pad=n=>String(n).padStart(2,'0');
 function iso(y,m,d){return String(y).padStart(4,'0')+'-'+pad(m)+'-'+pad(d);}
 function parse(value){
  const text=String(value??'').trim();let y,m,d,match;
  if((match=text.match(/^(\d{4})-(\d{2})-(\d{2})$/))){[,y,m,d]=match;}
  else if((match=text.match(/^(\d{1,2})[/.\-](\d{1,2})[/.\-](\d{4})$/))){[,d,m,y]=match;}
  else return '';
  y=Number(y);m=Number(m);d=Number(d);const date=new Date(Date.UTC(y,m-1,d));
  return y>=1000&&y<=9999&&date.getUTCFullYear()===y&&date.getUTCMonth()===m-1&&date.getUTCDate()===d?iso(y,m,d):'';
 }
 function format(value){const date=parse(value);if(!date)return String(value??'');const [y,m,d]=date.split('-');return d+'/'+m+'/'+y;}
 function today(){const parts=new Intl.DateTimeFormat('en-GB',{timeZone:'Asia/Jayapura',year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(new Date()),get=type=>parts.find(p=>p.type===type).value;return get('year')+'-'+get('month')+'-'+get('day');}
 const parts=value=>value.split('-').map(Number);
 const dateLabel=value=>{const [y,m,d]=parts(value);return d+' '+months[m-1]+' '+y;};
 function bounds(input){const state=states.get(input),read=key=>{try{const v=state?.options[key];return parse(typeof v==='function'?v():v||input[key]||'');}catch{return '';}};return {min:read('min'),max:read('max')};}
 const available=(date,b)=>!!date&&(!b.min||date>=b.min)&&(!b.max||date<=b.max);
 function error(input){
  const text=input.value.trim(),date=parse(text),b=bounds(input);if(!text)return '';
  if(!date)return 'Isi tanggal yang valid dengan format DD/MM/YYYY.';
  if(b.min&&date<b.min)return 'Tanggal tidak boleh sebelum '+format(b.min)+'.';
  if(b.max&&date>b.max)return 'Tanggal tidak boleh setelah '+format(b.max)+'.';return '';
 }
 function feedback(input){const message=error(input),hintId=input.getAttribute('aria-describedby')?.split(' ')[0],hint=hintId?$(hintId):null;input.setCustomValidity?.(message);input.setAttribute('aria-invalid',message?'true':'false');if(hint){hint.textContent=message;hint.hidden=!message;}return message;}
 function close(focus=true){const input=active;active=null;if(input)states.get(input)?.button.setAttribute('aria-expanded','false');if(popup?.open)popup.close();if(focus&&input?.isConnected&&!input.disabled)input.focus();}
 function sync(input){const state=states.get(input);if(!state)return;state.button.disabled=!!input.disabled||!!input.readOnly;if(active===input&&(state.button.disabled||!input.isConnected))close(false);}
 function calendar(){
  if(popup)return popup;popup=document.createElement('dialog');popup.id='ga-date30-dialog';popup.className='ga-date30-dialog';popup.setAttribute('aria-labelledby','ga-date30-title');
  popup.innerHTML=`<div class="ga-date30-title"><h2 id="ga-date30-title">Pilih tanggal</h2><button type="button" id="ga-date30-close" aria-label="Tutup kalender">×</button></div><div class="ga-date30-nav"><button type="button" id="ga-date30-prev" aria-label="Bulan sebelumnya">‹</button><div><label class="sr-only" for="ga-date30-month">Bulan</label><select id="ga-date30-month">${months.map((m,i)=>`<option value="${i+1}">${m}</option>`).join('')}</select><label class="sr-only" for="ga-date30-year">Tahun</label><input type="number" id="ga-date30-year" min="1000" max="9999" step="1" inputmode="numeric"></div><button type="button" id="ga-date30-next" aria-label="Bulan berikutnya">›</button></div><p class="sr-only" id="ga-date30-month-label" aria-live="polite"></p><table class="ga-date30-table" aria-labelledby="ga-date30-month-label"><thead><tr>${days.map(day=>`<th scope="col">${day}</th>`).join('')}</tr></thead><tbody id="ga-date30-days"></tbody></table><p class="ga-date30-note" id="ga-date30-note" role="status" hidden></p><div class="ga-date30-footer"><button type="button" id="ga-date30-clear">Kosongkan</button><button type="button" id="ga-date30-today">Hari ini</button></div>`;
  document.body.append(popup);
  popup.addEventListener('close',()=>{if(!popup.open&&active)close(false);});
  popup.addEventListener('cancel',event=>{event.preventDefault();close();});
  popup.addEventListener('click',event=>{if(event.target!==popup)return;const r=popup.getBoundingClientRect();if(event.clientX<r.left||event.clientX>r.right||event.clientY<r.top||event.clientY>r.bottom)close();});
  $('ga-date30-close').addEventListener('click',()=>close());$('ga-date30-prev').addEventListener('click',()=>month(-1));$('ga-date30-next').addEventListener('click',()=>month(1));
  $('ga-date30-month').addEventListener('change',()=>{viewMonth=Number($('ga-date30-month').value);focusInMonth();render();});
  $('ga-date30-year').addEventListener('change',()=>{const year=Number($('ga-date30-year').value);if(!Number.isInteger(year)||year<1000||year>9999){$('ga-date30-year').value=String(viewYear);$('ga-date30-note').textContent='Tahun harus antara 1000 dan 9999.';$('ga-date30-note').hidden=false;return;}viewYear=year;focusInMonth();render();});
  $('ga-date30-today').addEventListener('click',()=>choose(today()));$('ga-date30-clear').addEventListener('click',()=>choose(''));
  $('ga-date30-days').addEventListener('click',event=>{const button=event.target.closest('[data-date30]');if(button&&!button.disabled)choose(button.dataset.date30);});
  $('ga-date30-days').addEventListener('keydown',event=>{
   const button=event.target.closest('[data-date30]');if(!button||event.altKey||event.ctrlKey||event.metaKey)return;
   const supported=['ArrowLeft','ArrowRight','ArrowUp','ArrowDown','Home','End','PageUp','PageDown'];if(!supported.includes(event.key))return;event.preventDefault();
   let [y,m,d]=parts(button.dataset.date30),date=new Date(Date.UTC(y,m-1,d));
   if(event.key==='PageUp'||event.key==='PageDown'){const direction=event.key==='PageUp'?-1:1;if(event.shiftKey)y+=direction;else m+=direction;const first=new Date(Date.UTC(y,m-1,1));y=first.getUTCFullYear();m=first.getUTCMonth()+1;d=Math.min(d,new Date(Date.UTC(y,m,0)).getUTCDate());date=new Date(Date.UTC(y,m-1,d));}
   else{const weekday=(date.getUTCDay()+6)%7,step={ArrowLeft:-1,ArrowRight:1,ArrowUp:-7,ArrowDown:7,Home:-weekday,End:6-weekday}[event.key];date.setUTCDate(date.getUTCDate()+step);}
   let next=iso(date.getUTCFullYear(),date.getUTCMonth()+1,date.getUTCDate());const b=bounds(active);if(!parse(next))return;if(b.min&&next<b.min)next=b.min;if(b.max&&next>b.max)next=b.max;if(!available(next,b))return;focused=next;[viewYear,viewMonth]=parts(next);render();$('ga-date30-day-'+next)?.focus();
  });
  return popup;
 }
 function focusInMonth(){const d=focused?parts(focused)[2]:1;focused=iso(viewYear,viewMonth,Math.min(d,new Date(Date.UTC(viewYear,viewMonth,0)).getUTCDate()));}
 function month(step){const date=new Date(Date.UTC(viewYear,viewMonth-1+step,1)),year=date.getUTCFullYear();if(year<1000||year>9999)return;viewYear=year;viewMonth=date.getUTCMonth()+1;focusInMonth();render();}
 function render(){
  if(!active)return;const b=bounds(active),first=new Date(Date.UTC(viewYear,viewMonth-1,1)),offset=(first.getUTCDay()+6)%7,start=new Date(first);start.setUTCDate(1-offset);const current=today();
  $('ga-date30-month').value=String(viewMonth);$('ga-date30-year').value=String(viewYear);$('ga-date30-month-label').textContent=months[viewMonth-1]+' '+viewYear;
  let html='';for(let row=0;row<6;row++){html+='<tr>';for(let col=0;col<7;col++){const date=new Date(start);date.setUTCDate(start.getUTCDate()+row*7+col);const value=iso(date.getUTCFullYear(),date.getUTCMonth()+1,date.getUTCDate()),valid=!!parse(value)&&available(value,b);html+=`<td><button type="button" id="ga-date30-day-${value}" data-date30="${value}" aria-label="${dateLabel(value)}" aria-pressed="${value===selected}" tabindex="${value===focused&&valid?'0':'-1'}" ${value===current?'aria-current="date"':''} ${date.getUTCMonth()+1!==viewMonth?'data-outside="true"':''} ${valid?'':'disabled'}>${date.getUTCDate()}</button></td>`;}html+='</tr>';}
  $('ga-date30-days').innerHTML=html;$('ga-date30-note').hidden=true;$('ga-date30-clear').disabled=!!active.required;$('ga-date30-today').disabled=!available(current,b);
  $('ga-date30-prev').disabled=viewYear===1000&&viewMonth===1;$('ga-date30-next').disabled=viewYear===9999&&viewMonth===12;
 }
 function place(input){const r=input.getBoundingClientRect(),p=popup.getBoundingClientRect(),margin=8,width=g.innerWidth||document.documentElement.clientWidth,height=g.innerHeight||document.documentElement.clientHeight;popup.style.left=Math.max(margin,Math.min(r.left,width-p.width-margin))+'px';popup.style.top=Math.max(margin,r.bottom+p.height+6<=height-margin?r.bottom+6:r.top-p.height-6)+'px';}
 function open(input){
  sync(input);const state=states.get(input);if(!state||state.button.disabled||!input.isConnected)return;
  if(popup?.open)close(false);calendar();active=input;selected=parse(input.value);const b=bounds(input);focused=selected||today();if(b.min&&focused<b.min)focused=b.min;if(b.max&&focused>b.max)focused=b.max;[viewYear,viewMonth]=parts(focused);render();state.button.setAttribute('aria-expanded','true');popup.showModal();place(input);$('ga-date30-day-'+focused)?.focus();
 }
 function choose(value){
  const input=active;if(!input||input.disabled||input.readOnly||!input.isConnected){close(false);return;}if(value&&!available(value,bounds(input)))return;if(!value&&input.required)return;
  input.value=format(value);close();input.dispatchEvent(new Event('input',{bubbles:true}));input.dispatchEvent(new Event('change',{bubbles:true}));feedback(input);
 }
 function mount(input,options={}){
  if(!input||states.has(input))return;const wrapper=document.createElement('div');wrapper.className='ga-date-field';input.before(wrapper);wrapper.append(input);
  const button=document.createElement('button');button.type='button';button.className='ga-date-button';button.tabIndex=-1;button.setAttribute('aria-label','Pilih tanggal, '+(input.getAttribute('aria-label')||'kalender'));button.setAttribute('aria-haspopup','dialog');button.setAttribute('aria-controls','ga-date30-dialog');button.setAttribute('aria-expanded','false');button.innerHTML='<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="4" y="5" width="16" height="16" rx="2"/><path d="M8 3v4M16 3v4M4 11h16"/></svg>';wrapper.append(button);states.set(input,{button,options});
  input.value=format(input.value);input.removeAttribute('inputmode');input.placeholder='DD/MM/YYYY';input.setAttribute('aria-keyshortcuts','Alt+ArrowDown');input.title='Hari/bulan/tahun · Alt+↓ untuk kalender';
  button.addEventListener('click',()=>open(input));input.addEventListener('keydown',event=>{if(event.altKey&&event.key==='ArrowDown'){event.preventDefault();event.stopPropagation();open(input);}});
  input.addEventListener('blur',()=>{const next=format(input.value);if(next!==input.value){input.value=next;input.dispatchEvent(new Event('input',{bubbles:true}));}feedback(input);});sync(input);
 }
 document.addEventListener('akses:berubah',()=>close(false),true);g.addEventListener('resize',()=>close());g.addEventListener('hashchange',()=>close(false));
 g.TanggalInput=Object.freeze({parse,format,today,mount,sync,close});
})(window);
