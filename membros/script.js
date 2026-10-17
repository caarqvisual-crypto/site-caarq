import {createClient} from 'https://esm.sh/@supabase/supabase-js@2';

// Somente chave publicável. A segurança dos dados é garantida pelas políticas RLS.
const client=createClient(
  'https://aeipjioeqfcuqbacbcym.supabase.co',
  'sb_publishable_isTW4KzTw4bA7m82awH0BA_oG98M7qt',
  {auth:{persistSession:false,autoRefreshToken:false,detectSessionInUrl:false}}
);
const $=id=>document.getElementById(id);
function element(tag,cls,txt){const e=document.createElement(tag);if(cls)e.className=cls;if(txt!==undefined)e.textContent=String(txt);return e;}
function safePhoto(link){try{const u=new URL(link);return u.protocol==='https:' ? u.href : null;}catch{return null;}}
function period(g){const first=g.ano_inicio??'Período não informado';if(g.ano_fim)return `${first} — ${g.ano_fim}`;return g.atual ? `${first} — presente`:String(first);}
function personCard(m){
 const card=element('article','person-card');
 const button=element('button','person-open');button.type='button';button.setAttribute('aria-label',`Conhecer ${m.nome}, ${m.cargo}`);
 const imageWrap=element('div','person-photo-wrap');
 const valid=safePhoto(m.foto_url);
 const placeholder=()=>{imageWrap.replaceChildren(element('div','person-placeholder',(m.nome||'?').trim().slice(0,1).toLocaleUpperCase('pt-BR')));};
 if(valid){const img=document.createElement('img');img.className='person-photo';img.src=valid;img.alt=`Foto de ${m.nome}`;img.loading='lazy';img.referrerPolicy='no-referrer';img.onerror=placeholder;imageWrap.append(img);}
 else placeholder();
 const content=element('div','person-info');content.append(element('h3','',m.nome),element('p','person-role',m.cargo));
 content.append(element('span','person-more','Conhecer integrante ↗'));
 button.append(imageWrap,content);button.addEventListener('click',()=>showMember(m));card.append(button);return card;
}
function showMember(m){
 const content=$('memberDialogContent');content.replaceChildren();
 const valid=safePhoto(m.foto_url);
 if(valid){const photo=document.createElement('img');photo.src=valid;photo.alt=`Fotografia de ${m.nome}`;photo.referrerPolicy='no-referrer';photo.className='member-dialog-photo';content.append(photo);}
 else content.append(element('div','member-dialog-placeholder',(m.nome||'?').slice(0,1).toUpperCase()));
 content.append(element('h2','',m.nome),element('p','member-dialog-role',m.cargo));
 const coordination=(window.__caarqGroups||[]).find(c=>c.id===m.coordenacao_id);
 if(coordination)content.append(element('p','member-dialog-sector',coordination.nome));
 if(m.apresentacao){content.append(element('h3','','Sobre a pessoa'),element('p','member-dialog-copy',m.apresentacao));}
 if(m.atribuicoes){content.append(element('h3','','O que faz no CAARQ?'),element('p','member-dialog-copy',m.atribuicoes));}
 const dialog=$('memberDialog');if(!dialog.open)dialog.showModal();
}
$('closeMemberDialog').addEventListener('click',()=>$('memberDialog').close());
$('memberDialog').addEventListener('click',e=>{if(e.target===$('memberDialog'))$('memberDialog').close();});
function membersGrid(people){const grid=element('div','people-grid');for(const m of people)grid.append(personCard(m));return grid;}
function renderOrganogram(target,people,sections,gestaoId){
 target.replaceChildren();
 if(!people.length){target.append(element('p','status','Ainda não há integrantes publicados nesta gestão.'));return;}
 const sorted=sections.filter(s=>s.gestao_id===gestaoId&&s.publicado).sort((a,b)=>a.nivel-b.nivel||a.ordem-b.ordem||a.nome.localeCompare(b.nome,'pt-BR'));
 const grouped=new Set();
 for(const group of sorted){
  const selected=people.filter(m=>m.coordenacao_id===group.id);
  const wrap=element('section','organogram-group');wrap.style.setProperty('--og-level',String(Math.min(3,Math.max(0,group.nivel||0))));
  const header=element('div','og-group-header');header.append(element('h3','',group.nome));
  if(group.descricao)header.append(element('p','',group.descricao));
  wrap.append(header);
  if(selected.length)wrap.append(membersGrid(selected));
  else wrap.append(element('p','og-empty','Aguardando a apresentação dos integrantes.'));
  target.append(wrap);selected.forEach(m=>grouped.add(m.id));
 }
 const unassigned=people.filter(m=>!grouped.has(m.id));
 if(unassigned.length){
  const wrap=element('section','organogram-group');const heading=element('div','og-group-header');heading.append(element('h3','','Integrantes da gestão'));
  wrap.append(heading,membersGrid(unassigned));target.append(wrap);
 }
}
function renderArchive(gestao,people,sections){
 const box=element('article','history-card');
 const toggle=element('button','history-toggle');toggle.type='button';toggle.setAttribute('aria-expanded','false');
 const bodyId='arquivo-'+gestao.id.replace(/[^a-z0-9-]/gi,'');toggle.setAttribute('aria-controls',bodyId);
 const mark=element('span','history-mark','✳');
 const caption=element('span','');caption.append(element('span','history-name',gestao.nome),element('span','history-range',period(gestao)));
 toggle.append(mark,caption,element('span','history-arrow','+'));
 const body=element('div','history-body');body.id=bodyId;body.hidden=true;
 const grid=element('div','organogram');renderOrganogram(grid,people,sections,gestao.id);body.append(grid);
 toggle.addEventListener('click',()=>{body.hidden=!body.hidden;toggle.setAttribute('aria-expanded',String(!body.hidden));box.classList.toggle('open',!body.hidden);});
 box.append(toggle,body);return box;
}
async function load(){
 try{
  const [gs,ms,cs]=await Promise.all([
   client.from('caarq_gestoes').select('id,nome,ano_inicio,ano_fim,atual').eq('publicada',true).order('ano_inicio',{ascending:false}),
   client.from('caarq_membros').select('id,gestao_id,nome,cargo,coordenacao_id,apresentacao,atribuicoes,foto_url,ordem').eq('publicado',true).order('ordem',{ascending:true}).order('nome',{ascending:true}),
   client.from('caarq_organograma_setores').select('id,gestao_id,nome,descricao,nivel,ordem,publicado').eq('publicado',true).order('nivel',{ascending:true}).order('ordem',{ascending:true})
  ]);
  for(const q of [gs,ms,cs])if(q.error)throw q.error;
  const gestoes=gs.data||[],members=ms.data||[],sectors=cs.data||[];
  window.__caarqGroups=sectors;
  const current=gestoes.find(g=>g.atual);
  $('liveNotice').hidden=true;
  if(current){
   const meta=$('currentMeta');meta.replaceChildren(element('span','','GESTÃO ATUAL'),element('strong','',current.nome),element('span','',period(current)));meta.hidden=false;
   renderOrganogram($('currentMembers'),members.filter(m=>m.gestao_id===current.id),sectors,current.id);
  } else $('currentMembers').replaceChildren(element('p','status','A gestão atual ainda não foi publicada pelo CAARQ.'));
  const history=$('historyList');history.replaceChildren();
  const earlier=gestoes.filter(g=>!current||g.id!==current.id);
  if(!earlier.length)history.append(element('p','status','O histórico de gestões aparecerá aqui conforme os registros forem publicados.'));
  else for(const g of earlier)history.append(renderArchive(g,members.filter(m=>m.gestao_id===g.id),sectors));
 }catch(err){
  console.error('Falha ao carregar a equipe pública',err);
  const status=$('liveNotice');status.hidden=false;status.className='status error';status.textContent='Não foi possível carregar a equipe agora. Tente atualizar a página em alguns instantes.';
  $('historyList').replaceChildren(element('p','status','Histórico temporariamente indisponível.'));
 }
}
load();

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
  let st=document.getElementById('caarq-v17-team-style');
  if(!st){st=document.createElement('style');st.id='caarq-v17-team-style';document.head.append(st);}
  st.textContent=`.current-section,.history-section{background:var(--paper)!important} .person-card,.history-card,.og-group-header{background:var(--site-surface,#fff)!important;border-radius:var(--site-radius)!important} .person-info h3,.og-group-header h3{color:var(--purple)!important} .person-bio{color:var(--site-text,var(--plum))!important}`;
  const logo=appearanceImageUrl(data.logo_url);
  if(logo){
   for(const img of document.querySelectorAll('.brand img,.hero-symbol>img,.end-layout img')){
    img.onerror=()=>{img.onerror=null;img.src='../logo-caarq.png';};img.src=logo;
   }
  }
 }catch(error){/* sem conexão mantém o visual publicado */}
}
void applySharedAppearance();
