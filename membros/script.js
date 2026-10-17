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
  const imageWrap=element('div','person-photo-wrap');
  const valid=safePhoto(m.foto_url);
  const placeholder=()=>{imageWrap.replaceChildren(element('div','person-placeholder',(m.nome||'?').trim().slice(0,1).toLocaleUpperCase('pt-BR')));imageWrap.append(element('span','person-icon','CAARQ ✳'));};
  if(valid){const img=document.createElement('img');img.className='person-photo';img.src=valid;img.alt=`Foto de ${m.nome}`;img.loading='lazy';img.referrerPolicy='no-referrer';img.onerror=placeholder;imageWrap.append(img,element('span','person-icon','CAARQ ✳'));}
  else placeholder();
  const content=element('div','person-info');content.append(element('h3','',m.nome),element('p','person-role',m.cargo));
  if(m.coordenacao)content.append(element('p','person-coordenacao','Coordenação: '+m.coordenacao));
  if(m.apresentacao)content.append(element('p','person-bio',m.apresentacao));
  card.append(imageWrap,content);return card;
}
function renderGroup(target,list,emptyMessage){
  target.replaceChildren();
  if(!list.length){target.append(element('p','status',emptyMessage));return;}
  for(const m of list)target.append(personCard(m));
}
function renderArchive(gestao,people){
  const box=element('article','history-card');
  const toggle=element('button','history-toggle');toggle.type='button';toggle.setAttribute('aria-expanded','false');
  const bodyId='arquivo-'+gestao.id.replace(/[^a-z0-9-]/gi,'');toggle.setAttribute('aria-controls',bodyId);
  const mark=element('span','history-mark','✳');
  const caption=element('span','');caption.append(element('span','history-name',gestao.nome),element('span','history-range',period(gestao)));
  toggle.append(mark,caption,element('span','history-arrow','+'));
  const body=element('div','history-body');body.id=bodyId;body.hidden=true;
  const grid=element('div','people-grid');renderGroup(grid,people,'Não há integrantes publicados nesta gestão.');body.append(grid);
  toggle.addEventListener('click',()=>{body.hidden=!body.hidden;toggle.setAttribute('aria-expanded',String(!body.hidden));box.classList.toggle('open',!body.hidden);});
  box.append(toggle,body);return box;
}
async function load(){
  try{
    // Solicita explicitamente apenas gestões e integrantes publicados, sem login.
    const [gs,ms]=await Promise.all([
      client.from('caarq_gestoes').select('id,nome,ano_inicio,ano_fim,atual').eq('publicada',true).order('ano_inicio',{ascending:false}),
      client.from('caarq_membros').select('id,gestao_id,nome,cargo,coordenacao,apresentacao,foto_url,ordem').eq('publicado',true).order('ordem',{ascending:true}).order('nome',{ascending:true})
    ]);
    if(gs.error)throw gs.error;if(ms.error)throw ms.error;
    const gestoes=gs.data||[],members=ms.data||[];
    const current=gestoes.find(g=>g.atual);
    $('liveNotice').hidden=true;
    if(current){
      const meta=$('currentMeta');meta.replaceChildren(element('span','','GESTÃO ATUAL'),element('strong','',current.nome),element('span','',period(current)));meta.hidden=false;
      renderGroup($('currentMembers'),members.filter(m=>m.gestao_id===current.id),'Ainda não há integrantes publicados nesta gestão. Quando a administração ativar a publicação, eles aparecerão aqui.');
    }else renderGroup($('currentMembers'),[],'A gestão atual ainda não foi publicada pelo CAARQ. Volte em breve!');
    const history=$('historyList');history.replaceChildren();
    const earlier=gestoes.filter(g=>!current||g.id!==current.id);
    if(!earlier.length){history.append(element('p','status','O histórico de gestões aparecerá aqui conforme os registros forem publicados.'));}
    else for(const g of earlier)history.append(renderArchive(g,members.filter(m=>m.gestao_id===g.id)));
  }catch(err){
    console.error('Falha ao carregar equipe pública',err);
    const status=$('liveNotice');status.className='status error';status.textContent='Não foi possível carregar a equipe agora. Tente atualizar a página em alguns instantes.';
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
  const {data,error}=await client.from('caarq_aparencia').select('primary_color,accent_color,logo_url').eq('id',1).maybeSingle();
  if(error||!data)return;
  const root=document.documentElement;
  if(validAppearanceColor(data.primary_color)){
   root.style.setProperty('--purple',data.primary_color);
   root.style.setProperty('--purple-deep',shade(data.primary_color,.66));
   root.style.setProperty('--violet',shade(data.primary_color,1.25));
  }
  if(validAppearanceColor(data.accent_color))root.style.setProperty('--yellow',data.accent_color);
  const logo=appearanceImageUrl(data.logo_url);
  if(logo){
   for(const img of document.querySelectorAll('.brand img,.hero-symbol>img,.end-layout img')){
    img.onerror=()=>{img.onerror=null;img.src='../logo-caarq.png';};img.src=logo;
   }
  }
 }catch(error){/* sem conexão mantém o visual publicado */}
}
void applySharedAppearance();
