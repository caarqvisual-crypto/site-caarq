import {createClient} from 'https://esm.sh/@supabase/supabase-js@2';
// Chave publicável. A autorização é aplicada pelas políticas RLS do Supabase.
const db=createClient('https://aeipjioeqfcuqbacbcym.supabase.co',
 'sb_publishable_isTW4KzTw4bA7m82awH0BA_oG98M7qt',
 {auth:{persistSession:false,autoRefreshToken:false,detectSessionInUrl:false}});
const $=id=>document.getElementById(id);
const node=(tag,cls,text)=>{const n=document.createElement(tag);if(cls)n.className=cls;if(text!==undefined)n.textContent=String(text);return n;};
const validUrl=value=>{try{const url=new URL(value);return url.protocol==='https:'?url.href:null;}catch{return null;}};
const fmt=date=>{if(!date)return '';const d=new Date(date);return Number.isNaN(+d)?'':new Intl.DateTimeFormat('pt-BR',{day:'numeric',month:'long',year:'numeric',timeZone:'America/Fortaleza'}).format(d);};
let posts=[],visibleCount=9;
$('navButton').addEventListener('click',()=>{const nav=$('navLinks'),open=nav.classList.toggle('open');$('navButton').setAttribute('aria-expanded',String(open));});
$('navLinks').querySelectorAll('a').forEach(a=>a.addEventListener('click',()=>{$('navLinks').classList.remove('open');$('navButton').setAttribute('aria-expanded','false');}));

async function appearance(){try{const {data}=await db.from('caarq_aparencia').select('primary_color,accent_color,background_color,text_color,surface_color,font_family,corner_radius').eq('id',1).maybeSingle();if(!data)return;const root=document.documentElement;
for(const [key,css] of [['primary_color','--purple'],['accent_color','--accent'],['background_color','--paper'],['text_color','--ink'],['surface_color','--surface']])if(/^#[0-9a-fA-F]{6}$/.test(data[key]||''))root.style.setProperty(css,data[key]);
if(['Montserrat','Arial','Georgia','Verdana','Trebuchet MS'].includes(data.font_family))root.style.setProperty('--font',`"${data.font_family}",Arial,sans-serif`);
if([0,8,16,24].includes(Number(data.corner_radius)))root.style.setProperty('--radius',`${data.corner_radius}px`);
}catch{ /* Cores padrão mantidas sem impedir leitura das notícias. */}}

async function blogConfig(){try{
 const {data,error}=await db.from('caarq_noticias_config').select('kicker,titulo,destaque,descricao,fundo_url').eq('id',1).maybeSingle();if(error||!data)return;
 const binding={blogHeroKicker:data.kicker,blogHeroStart:data.titulo,blogHeroHighlight:data.destaque,blogHeroDescription:data.descricao};
 for(const [id,text] of Object.entries(binding))if(typeof text==='string'&&text.trim())$(id).textContent=text.trim();
 const image=validUrl(data.fundo_url);if(image){$('blogHeroImage').src=image;$('blogHeroImage').hidden=false;$('blogHeroImage').onerror=()=>{$('blogHeroImage').hidden=true;};}
}catch{ /* A página continua legível com textos padrão. */}}

function photo(url,alt=''){const safe=validUrl(url);if(!safe)return node('div','placeholder','✳');const img=node('img');img.src=safe;img.alt=alt;img.loading='lazy';img.referrerPolicy='no-referrer';img.onerror=()=>img.replaceWith(node('div','placeholder','✳'));return img;}
const href=post=>`?post=${encodeURIComponent(post.id)}`;
function card(p,featured=false){if(featured){const wrap=node('a','featured-card');wrap.href=href(p);const cover=node('div','featured-cover');cover.append(photo(p.capa_url,p.capa_alt||''));const content=node('div','featured-content');content.append(node('span','tag',p.categoria),node('h3','',p.titulo),node('p','',p.resumo||'Leia a publicação completa.'),node('time','',fmt(p.publicado_em)),node('span','read-more','Ler história completa ↗'));wrap.append(cover,content);return wrap;}
const article=node('article','post-card');const a=node('a','post-image');a.href=href(p);a.setAttribute('aria-label',`Ler ${p.titulo}`);a.append(photo(p.capa_url,p.capa_alt||''));const info=node('div','post-body'),detail=node('div','post-details');detail.append(node('span','tag',p.categoria),node('time','',fmt(p.publicado_em)));const title=node('h4','',p.titulo);const titleLink=node('a');titleLink.href=href(p);titleLink.append(title);const summary=node('p','',p.resumo||'Abra para conhecer esta publicação.');const more=node('a','read-more','Continuar lendo ↗');more.href=href(p);info.append(detail,titleLink,summary,more);article.append(a,info);return article;}
function render(){const q=$('search').value.toLocaleLowerCase('pt-BR').trim(),cat=$('category').value;const filtered=posts.filter(p=>(!cat||p.categoria===cat)&&(!q||[p.titulo,p.resumo,p.conteudo,p.autor,p.categoria].join(' ').toLocaleLowerCase('pt-BR').includes(q)));
$('grid').replaceChildren(...filtered.slice(0,visibleCount).map(p=>card(p)));$('more').hidden=filtered.length<=visibleCount;
$('status').hidden=filtered.length>0;$('status').textContent=posts.length===0?'Ainda não há publicações. Em breve, este espaço vai reunir as novidades e memórias do CAARQ.':'Nenhuma publicação encontrada para esta busca.';
$('postCount').textContent=`${posts.length} ${posts.length===1?'publicação':'publicações'}`;}
async function loadFeed(){try{const {data,error}=await db.from('caarq_noticias').select('id,titulo,resumo,conteudo,categoria,autor,capa_url,capa_alt,destaque,publicado_em').eq('publicado',true).lte('publicado_em',new Date().toISOString()).order('publicado_em',{ascending:false}).limit(500);if(error)throw error;
posts=data||[];const categories=[...new Set(posts.map(p=>p.categoria).filter(Boolean))].sort((a,b)=>a.localeCompare(b,'pt-BR'));$('category').replaceChildren(new Option('Todas as categorias',''),...categories.map(x=>new Option(x,x)));
const featured=posts.find(p=>p.destaque);$('featuredSection').hidden=!featured;if(featured)$('featuredCard').replaceChildren(card(featured,true));render();}catch(err){console.error('Erro ao carregar novidades:',err);$('status').hidden=false;$('status').textContent='Não foi possível carregar as publicações. Tente atualizar a página mais tarde.';}}
$('search').addEventListener('input',()=>{visibleCount=9;render()});$('category').addEventListener('change',()=>{visibleCount=9;render()});$('more').addEventListener('click',()=>{visibleCount+=9;render();});

function inlineText(container,text){const regex=/(\*\*[^*\n]+\*\*|\*[^*\n]+\*|\[[^\]\n]+\]\(https:\/\/[^)\s]+\))/g;let last=0;for(const m of text.matchAll(regex)){if(m.index>last)container.append(document.createTextNode(text.slice(last,m.index)));const v=m[0];if(v.startsWith('**'))container.append(node('strong','',v.slice(2,-2)));else if(v.startsWith('*'))container.append(node('em','',v.slice(1,-1)));else{const match=v.match(/^\[([^\]]+)\]\((https:\/\/[^)\s]+)\)$/);const a=node('a','article-inline-link',match[1]);a.href=match[2];a.target='_blank';a.rel='noopener noreferrer';container.append(a);}last=m.index+v.length;}if(last<text.length)container.append(document.createTextNode(text.slice(last)));}
// Renderizador limitado de Markdown, sem innerHTML nem HTML de editores.
function renderBody(content){const host=$('articleBody');host.replaceChildren();const text=(content||'').replace(/\r\n?/g,'\n');let para=[],list=null;
const flush=()=>{if(para.length){const p=node('p');inlineText(p,para.join(' '));host.append(p);para=[];}if(list){host.append(list);list=null;}};
for(const line of text.split('\n')){const value=line.trim();if(!value){flush();continue;}if(value.startsWith('## ')){flush();const h=node('h2');inlineText(h,value.slice(3));host.append(h);continue;}if(value.startsWith('### ')){flush();const h=node('h3');inlineText(h,value.slice(4));host.append(h);continue;}if(/^[-•]\s+/.test(value)){if(para.length)flush();if(!list)list=node('ul');const li=node('li');inlineText(li,value.replace(/^[-•]\s+/,''));list.append(li);continue;}if(list)flush();para.push(value);}flush();}
async function articleView(id){$('hero').hidden=true;$('listing').hidden=true;$('article').hidden=false;try{
// As políticas do banco impedem consultar rascunhos ou publicações agendadas pelo público.
const {data:p,error}=await db.from('caarq_noticias').select('*').eq('id',id).eq('publicado',true).lte('publicado_em',new Date().toISOString()).maybeSingle();if(error)throw error;if(!p){notFound();return;}
document.title=`${p.titulo} | Novidades do CAARQ`;
const meta=document.querySelector('meta[name="description"]');if(meta)meta.content=(p.resumo||p.titulo).slice(0,160);
$('articleMeta').textContent=`${p.categoria}  ·  ${fmt(p.publicado_em)}  ·  ${p.autor||'CAARQ'}`;
$('articleTitle').textContent=p.titulo;$('articleLead').textContent=p.resumo||'';
const src=validUrl(p.capa_url);$('articleCover').hidden=!src;if(src){$('articleImage').src=src;$('articleImage').alt=p.capa_alt||p.titulo;$('articleImageCaption').textContent=p.capa_alt||'';}
renderBody(p.conteudo);const url=validUrl(p.link_externo);$('articleAction').replaceChildren();$('articleAction').hidden=!url;if(url){const a=node('a','',`${p.link_rotulo||'Acessar link'} ↗`);a.href=url;a.target='_blank';a.rel='noopener noreferrer';$('articleAction').append(a);}
const {data:gallery,error:galleryError}=await db.from('caarq_noticias_fotos').select('url,legenda,ordem').eq('noticia_id',p.id).order('ordem',{ascending:true});if(galleryError)throw galleryError;
$('articlePhotos').replaceChildren();const images=(gallery||[]).filter(img=>validUrl(img.url));$('articleGallery').hidden=images.length===0;
for(const pic of images){const button=node('button');button.type='button';button.setAttribute('aria-label',`Ampliar fotografia: ${pic.legenda||p.titulo}`);const figure=node('figure');figure.append(photo(pic.url,pic.legenda||p.titulo),node('figcaption','',pic.legenda));button.append(figure);button.addEventListener('click',()=>{const lightbox=$('lightbox');$('lightboxImage').src=pic.url;$('lightboxImage').alt=pic.legenda||p.titulo;$('lightboxCaption').textContent=pic.legenda||'';if(typeof lightbox.showModal==='function')lightbox.showModal();});$('articlePhotos').append(button);}
}catch(error){console.error('Erro na notícia:',error);notFound();}}
function notFound(){$('articleTitle').textContent='Publicação indisponível';$('articleLead').textContent='Este conteúdo pode ter sido removido, ainda não publicado ou estar agendado.';$('articleBody').replaceChildren();$('articleGallery').hidden=true;$('articleAction').hidden=true;}
$('share').addEventListener('click',async()=>{try{if(navigator.share)await navigator.share({title:$('articleTitle').textContent,url:location.href});else{await navigator.clipboard.writeText(location.href);$('share').textContent='Link copiado ✓';}}catch{/* Cancelar compartilhamento é permitido. */}});
await Promise.all([appearance(),blogConfig()]);const postId=new URLSearchParams(location.search).get('post');if(postId){if(!/^[0-9a-f-]{36}$/i.test(postId)){$('hero').hidden=true;$('listing').hidden=true;$('article').hidden=false;notFound();}else await articleView(postId);}else await loadFeed();
