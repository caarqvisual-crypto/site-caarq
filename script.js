const menuToggle = document.getElementById('menuToggle');
const mainNav = document.getElementById('mainNav');
if (menuToggle && mainNav) {
  menuToggle.addEventListener('click', () => {
    const open = mainNav.classList.toggle('open');
    menuToggle.setAttribute('aria-expanded', String(open));
    menuToggle.innerHTML = open ? '✕ <span>Fechar</span>' : '☰ <span>Menu</span>';
  });
  mainNav.querySelectorAll('a').forEach(link => link.addEventListener('click', () => {
    mainNav.classList.remove('open');
    menuToggle.setAttribute('aria-expanded', 'false');
    menuToggle.innerHTML = '☰ <span>Menu</span>';
  }));
}
const year = document.getElementById('year');
if (year) year.textContent = new Date().getFullYear();


// Prévia dinâmica da gestão atual e das atividades publicadas no site principal.
import {createClient} from 'https://esm.sh/@supabase/supabase-js@2';
const publicDB=createClient('https://aeipjioeqfcuqbacbcym.supabase.co','sb_publishable_isTW4KzTw4bA7m82awH0BA_oG98M7qt',{auth:{persistSession:false,autoRefreshToken:false,detectSessionInUrl:false}});
function make(tag,className,label){const x=document.createElement(tag);if(className)x.className=className;if(label!==undefined)x.textContent=String(label);return x;}
function publicImage(link){try{const u=new URL(link);return u.protocol==='https:'?u.href:null;}catch{return null;}}
function homeCard(title,sub,body,imageUrl){const card=make('article','home-card'),photo=make('div','home-image');const link=publicImage(imageUrl);if(link){const img=make('img');img.src=link;img.alt='';img.loading='lazy';img.referrerPolicy='no-referrer';img.onerror=()=>photo.replaceChildren(make('span','','✳'));photo.append(img);}else photo.append(make('span','','✳'));const info=make('div','home-body');info.append(make('strong','',title));if(sub)info.append(make('small','',sub));if(body)info.append(make('p','',body.length>170?body.slice(0,170)+'…':body));card.append(photo,info);return card;}
async function loadHomeTeam(){const host=document.getElementById('homeTeamCards');try{const {data:gs,error:eg}=await publicDB.from('caarq_gestoes').select('id,nome').eq('publicada',true).eq('atual',true).limit(1);if(eg)throw eg;host.replaceChildren();if(!gs?.length){host.append(make('p','home-status','A gestão atual será apresentada aqui quando for publicada.'));return;}const {data:people,error:ep}=await publicDB.from('caarq_membros').select('nome,cargo,apresentacao,foto_url').eq('gestao_id',gs[0].id).eq('publicado',true).order('ordem',{ascending:true}).limit(3);if(ep)throw ep;if(!people?.length){host.append(make('p','home-status','Os integrantes aparecerão aqui quando seus perfis forem publicados.'));return;}people.forEach(x=>host.append(homeCard(x.nome,x.cargo,x.apresentacao,x.foto_url)));}catch(e){console.error(e);host.replaceChildren(make('p','home-status','Equipe temporariamente indisponível.'));}}
async function loadHomeProjects(){const host=document.getElementById('homeProjectCards');try{const {data,error}=await publicDB.from('caarq_atividades').select('tipo,titulo,descricao,foto_url,data_inicio,situacao').eq('publicado',true).neq('situacao','cancelado').order('criado_em',{ascending:false}).limit(3);if(error)throw error;host.replaceChildren();if(!data?.length){host.append(make('p','home-status','Os próximos projetos e eventos aparecerão aqui após a primeira publicação.'));return;}data.forEach(x=>host.append(homeCard(x.titulo,x.tipo==='evento'?'EVENTO':'PROJETO',x.descricao,x.foto_url)));}catch(e){console.error(e);host.replaceChildren(make('p','home-status','Atividades temporariamente indisponíveis.'));}}
void Promise.all([loadHomeTeam(),loadHomeProjects()]);
