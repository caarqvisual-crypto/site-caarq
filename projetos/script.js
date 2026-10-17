import {createClient} from 'https://esm.sh/@supabase/supabase-js@2';
const client=createClient('https://aeipjioeqfcuqbacbcym.supabase.co','sb_publishable_isTW4KzTw4bA7m82awH0BA_oG98M7qt',{auth:{persistSession:false,autoRefreshToken:false,detectSessionInUrl:false}});
const $=id=>document.getElementById(id),create=(tag,className,text)=>{const el=document.createElement(tag);if(className)el.className=className;if(text!==undefined)el.textContent=text;return el;};
const fmtDate=value=>value?new Date(value+'T12:00:00').toLocaleDateString('pt-BR',{day:'2-digit',month:'short',year:'numeric'}):'Data a definir';
const safeImage=value=>{try{const u=new URL(value);return u.protocol==='https:'?u.href:null}catch{return null}};
const statusText={planejado:'Planejado',em_andamento:'Em andamento',concluido:'Concluído',cancelado:'Cancelado'};
const monthName=new Intl.DateTimeFormat('pt-BR',{month:'long',year:'numeric'});
let activities=[],month=new Date(new Date().getFullYear(),new Date().getMonth(),1);
function card(activity){const article=create('article','card'),cover=create('div','cover');const image=safeImage(activity.foto_url);if(image){const img=create('img');img.loading='lazy';img.src=image;img.alt='';img.referrerPolicy='no-referrer';img.onerror=()=>{cover.replaceChildren(create('span','','✳'));};cover.append(img)}else cover.append(create('span','','✳'));
const content=create('div','card-body');content.append(create('span','tag',`${activity.tipo==='evento'?'EVENTO':'PROJETO'} · ${statusText[activity.situacao]||'ATIVIDADE'}`),create('h3','',activity.titulo));if(activity.descricao)content.append(create('p','',activity.descricao));const meta=create('div','card-meta');if(activity.data_inicio)meta.append(create('span','',`📅 ${fmtDate(activity.data_inicio)}${activity.data_fim&&activity.data_fim!==activity.data_inicio?' até '+fmtDate(activity.data_fim):''}`));if(activity.local_evento)meta.append(create('span','',`📍 ${activity.local_evento}`));if(activity.responsaveis)meta.append(create('span','',`Responsáveis: ${activity.responsaveis}`));content.append(meta);article.append(cover,content);return article;}
function fillCards(id,items,empty){const host=$(id);host.replaceChildren();if(!items.length){host.append(create('p','status',empty));return;}items.forEach(item=>host.append(card(item)));}
function drawCalendar(){const y=month.getFullYear(),m=month.getMonth(),first=new Date(y,m,1),days=new Date(y,m+1,0).getDate(),offset=first.getDay();$('monthTitle').textContent=monthName.format(month);const host=$('calendarGrid');host.replaceChildren();for(const name of ['Dom','Seg','Ter','Qua','Qui','Sex','Sáb'])host.append(create('div','calendar-weekday',name));for(let i=0;i<offset;i++)host.append(create('div','calendar-day out',''));
const monthEvents=activities.filter(a=>a.data_inicio&&a.tipo==='evento'&&a.situacao!=='cancelado'&&a.data_inicio.slice(0,7)===`${y}-${String(m+1).padStart(2,'0')}`);
for(let d=1;d<=days;d++){const date=`${y}-${String(m+1).padStart(2,'0')}-${String(d).padStart(2,'0')}`,events=monthEvents.filter(a=>a.data_inicio===date),isToday=new Date().toDateString()===new Date(y,m,d).toDateString();const cell=create('div',`calendar-day${events.length?' has-event':''}${isToday?' today':''}`,String(d));if(events.length){cell.title=events.map(e=>e.titulo).join(' · ');cell.append(create('b','',`${events.length} ✳`))}host.append(cell)}
const upcoming=$('monthEvents');upcoming.replaceChildren();if(!monthEvents.length){upcoming.append(create('p','status','Ainda não há eventos publicados neste mês.'));return;}monthEvents.sort((a,b)=>a.data_inicio.localeCompare(b.data_inicio)).forEach(a=>{const item=create('div','event-row');item.append(create('strong','',fmtDate(a.data_inicio)));const info=create('div','',a.titulo);if(a.horario||a.local_evento)info.append(create('small','',[a.horario,a.local_evento].filter(Boolean).join(' · ')));item.append(info);upcoming.append(item)});}
$('prevMonth').addEventListener('click',()=>{month=new Date(month.getFullYear(),month.getMonth()-1,1);drawCalendar()});$('nextMonth').addEventListener('click',()=>{month=new Date(month.getFullYear(),month.getMonth()+1,1);drawCalendar()});
try{const {data,error}=await client.from('caarq_atividades').select('id,tipo,titulo,descricao,foto_url,data_inicio,data_fim,horario,local_evento,responsaveis,situacao').eq('publicado',true).order('data_inicio',{ascending:false,nullsFirst:false});if(error)throw error;activities=data||[];fillCards('projectsList',activities.filter(a=>a.tipo==='projeto'&&a.situacao!=='concluido'&&a.situacao!=='cancelado'),'Nenhum projeto em andamento foi publicado ainda.');fillCards('completedList',activities.filter(a=>a.tipo==='projeto'&&a.situacao==='concluido'),'As ações concluídas aparecerão aqui conforme forem publicadas.');drawCalendar();}catch(err){console.error('Erro ao consultar projetos públicos',err);fillCards('projectsList',[],'Não foi possível carregar os projetos agora.');fillCards('completedList',[],'Histórico temporariamente indisponível.');drawCalendar();}


// V6 — compartilha a identidade visual escolhida no CAARQ Admin.
function validAppearanceColor(c){return /^#[0-9a-fA-F]{6}$/.test(c||'');}
function shade(c,factor){return '#'+[1,3,5].map(i=>Math.max(0,Math.min(255,Math.round(parseInt(c.slice(i,i+2),16)*factor))).toString(16).padStart(2,'0')).join('');}
function appearanceImageUrl(value){try{const u=new URL(value);return u.protocol==='https:'?u.href:null;}catch{return null;}}
async function applySharedAppearance(){
 try{
  const {data,error}=await client.from('caarq_aparencia').select('primary_color,accent_color,background_color,surface_color,text_color,font_family,corner_radius,logo_url').eq('id',1).maybeSingle();
  if(error||!data)return;
  const root=document.documentElement;
  if(validAppearanceColor(data.primary_color)){
   root.style.setProperty('--purple',data.primary_color);
   root.style.setProperty('--purple-deep',shade(data.primary_color,.66));
   root.style.setProperty('--violet',shade(data.primary_color,1.25));
  }
  if(validAppearanceColor(data.accent_color))root.style.setProperty('--yellow',data.accent_color);
  const available=['Montserrat','Arial','Georgia','Verdana','Trebuchet MS'];
  const font=available.includes(data.font_family)?data.font_family:'Montserrat';
  document.body.style.fontFamily=`"${font}",Arial,sans-serif`;
  if(validAppearanceColor(data.background_color)){root.style.setProperty('--paper',data.background_color);root.style.setProperty('--cream',data.background_color);}
  if(validAppearanceColor(data.text_color)){root.style.setProperty('--plum',data.text_color);root.style.setProperty('--site-text',data.text_color);}
  if(validAppearanceColor(data.surface_color))root.style.setProperty('--site-surface',data.surface_color);
  const radius=[0,8,16,24].includes(Number(data.corner_radius))?Number(data.corner_radius):8;
  root.style.setProperty('--site-radius',radius+'px');
  const logo=appearanceImageUrl(data.logo_url);
  if(logo){
   for(const img of document.querySelectorAll('.brand img,.hero-logo img')){
    img.onerror=()=>{img.onerror=null;img.src='../logo-caarq.png';};img.src=logo;
   }
  }
 }catch(error){/* sem conexão mantém o visual publicado */}
}
void applySharedAppearance();
