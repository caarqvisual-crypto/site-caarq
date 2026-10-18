import {createClient} from 'https://esm.sh/@supabase/supabase-js@2';
const client=createClient('https://aeipjioeqfcuqbacbcym.supabase.co','sb_publishable_isTW4KzTw4bA7m82awH0BA_oG98M7qt',{
 auth:{persistSession:false,autoRefreshToken:false,detectSessionInUrl:false}
});
const el=id=>document.getElementById(id);
let products=[];let photos=[];let storeConfig=null;let chosenCategory='Todos';
const fmtPrice=value=>value===null||value===undefined?'Preço sob consulta':new Intl.NumberFormat('pt-BR',{style:'currency',currency:'BRL'}).format(value/100);
const statusLabel={disponivel:'Disponível',sob_encomenda:'Sob encomenda',esgotado:'Esgotado'};
function safeImage(url){return typeof url==='string'&&(url.startsWith('https://')||url.startsWith('/'))?url:null;}
function safeExternal(url){
 if(!url)return null;
 try{const u=new URL(url);return ['http:','https:'].includes(u.protocol)?u.href:null;}catch{return null;}
}
function n(tag,cls,text){const e=document.createElement(tag);if(cls)e.className=cls;if(text!==undefined)e.textContent=text;return e;}
const allPhotos=product=>photos.filter(p=>p.produto_id===product.id).sort((a,b)=>a.ordem-b.ordem);
function buildCategories(){
 const host=el('categoryFilters');host.replaceChildren();
 const all=['Todos',...new Set(products.map(p=>p.categoria))];
 if(!all.includes(chosenCategory))chosenCategory='Todos';
 for(const c of all){
  const btn=n('button',c===chosenCategory?'selected':'',c);btn.type='button';btn.dataset.category=c;
  btn.addEventListener('click',()=>{chosenCategory=c;buildCategories();renderProducts();});host.append(btn);
 }
}
function makeCard(product){
 const card=n('article','product-card');
 const visual=n('div','product-image');
 const first=allPhotos(product)[0];
 if(first&&safeImage(first.url)){
  const img=n('img');img.src=first.url;img.alt=first.legenda||`Foto de ${product.nome}`;img.loading='lazy';visual.append(img);
 }else visual.append(n('span','fallback','▣'));
 if(product.destaque)visual.append(n('span','featured-chip','✳ Destaque'));
 const body=n('div','product-content');
 const meta=n('div','product-meta',product.categoria);
 const title=n('h3','product-title',product.nome);
 const price=n('strong','product-price',fmtPrice(product.preco_centavos));
 const desc=n('p','product-desc',product.descricao||'Conheça mais detalhes deste produto.');
 const bottom=n('div','product-foot');
 const available=n('span','availability '+(product.status==='esgotado'?'sold-out':''),statusLabel[product.status]||product.status);
 const open=n('button','view-product','Ver detalhes ↗');open.type='button';open.addEventListener('click',()=>openProduct(product));
 bottom.append(available,open);body.append(meta,title,price,desc);
 if(storeConfig?.retirada_visivel!==false)body.append(n('p','product-pickup-note',storeConfig?.retirada_resumo||'Retirada presencial no CAARQ, ao lado da nova biblioteca.'));
 body.append(bottom);card.append(visual,body);return card;
}
function renderProducts(){
 const term=el('searchInput').value.trim().toLocaleLowerCase('pt-BR');
 const list=products.filter(p=>(chosenCategory==='Todos'||p.categoria===chosenCategory)&&
  `${p.nome} ${p.descricao} ${p.categoria}`.toLocaleLowerCase('pt-BR').includes(term));
 const host=el('productGrid');host.replaceChildren();
 if(!list.length){
  const empty=n('div','empty-catalog');empty.append(n('div','empty-icon','▣'));
  empty.append(n('h3','',products.length?'Nenhum produto encontrado.':'Vem coisa boa por aí!'));
  empty.append(n('p','',products.length?'Tente outro termo ou categoria.':'A equipe da LOCA está preparando o catálogo. Volte em breve para conferir nossos produtos!'));
  host.append(empty);el('catalogStatus').textContent='';return;
 }
 for(const product of list)host.append(makeCard(product));
 el('catalogStatus').textContent=`${list.length} produto${list.length===1?'':'s'} no catálogo`;
}
function openProduct(product){
 const dialog=el('productDialog');
 el('dialogCategory').textContent=product.categoria;
 el('dialogTitle').textContent=product.nome;
 el('dialogPrice').textContent=fmtPrice(product.preco_centavos);
 el('dialogAvailability').textContent=statusLabel[product.status]||product.status;
 el('dialogDescription').textContent=product.descricao||'Mais informações disponíveis com o Centro Acadêmico.';
 el('dialogStock').textContent=product.estoque===null?'':`Estoque informado: ${product.estoque}`;
 const pickup=el('dialogPickup');pickup.hidden=storeConfig?.retirada_visivel===false;
 if(!pickup.hidden)el('dialogPickupSummary').textContent=storeConfig?.retirada_resumo||'Retirada presencial no CAARQ, ao lado da nova biblioteca.';
 const orderUrl=safeExternal(product.link_pedido)||safeExternal(storeConfig?.link_formulario);
 const order=el('dialogOrder');
 order.hidden=!orderUrl||product.status==='esgotado';
 el('dialogNoOrder').hidden=!order.hidden;
 if(!order.hidden){order.href=orderUrl;order.textContent=storeConfig?.texto_botao||'Fazer encomenda ↗';}
 const gallery=el('dialogMainPhoto');const thumbnails=el('dialogThumbnails');gallery.replaceChildren();thumbnails.replaceChildren();
 const candidates=allPhotos(product).filter(p=>safeImage(p.url));
 if(!candidates.length)gallery.append(n('span','','Sem foto cadastrada'));
 else{
  const setPhoto=(url,alt)=>{
   gallery.replaceChildren();const image=n('img');image.src=url;image.alt=alt||product.nome;gallery.append(image);
   [...thumbnails.children].forEach(btn=>btn.classList.toggle('active',btn.dataset.photo===url));
  };
  for(const [i,f] of candidates.entries()){
   const btn=n('button',i===0?'active':'');btn.type='button';btn.dataset.photo=f.url;
   btn.setAttribute('aria-label',`Mostrar foto ${i+1} de ${product.nome}`);
   const img=n('img');img.src=f.url;img.alt=f.legenda||`Foto ${i+1}`;btn.append(img);
   btn.addEventListener('click',()=>setPhoto(f.url,f.legenda));thumbnails.append(btn);
  }
  setPhoto(candidates[0].url,candidates[0].legenda);
 }
 dialog.showModal();
}
el('dialogClose').addEventListener('click',()=>el('productDialog').close());
el('dialogPickupLink').addEventListener('click',()=>el('productDialog').close());
el('productDialog').addEventListener('click',ev=>{if(ev.target===el('productDialog'))el('productDialog').close();});
el('searchInput').addEventListener('input',renderProducts);
el('copyrightYear').textContent=new Date().getFullYear();
function renderPickup(config){
 const visible=config?.retirada_visivel!==false;
 el('retirada').hidden=!visible;
 el('introPickupLink').hidden=!visible;
 if(!visible)return;
 const fill=(id,key,fallback='')=>{el(id).textContent=config?.[key]||fallback;};
 fill('pickupTitle','retirada_titulo','Onde retirar seu pedido?');
 fill('pickupDescription','retirada_texto','Retire seu pedido presencialmente e venha conhecer o CAARQ!');
 fill('pickupPlace','retirada_local','Centro Acadêmico de Arquivologia (CAARQ)');
 fill('pickupReference','retirada_referencia','Ao lado da nova biblioteca · UEPB Campus V');
 fill('pickupGuidance','retirada_orientacoes','Combine o horário de retirada com a equipe do CAARQ.');
 fill('pickupHours','retirada_horario');
 el('pickupHours').hidden=!config?.retirada_horario;
 const links=[['pickupContact','retirada_contato_link','retirada_contato_rotulo','Falar com o C.A. ↗'],['pickupMap','retirada_mapa_link','retirada_mapa_rotulo','Ver localização ↗']];
 for(const [id,key,label,fallback] of links){
  const btn=el(id),url=safeExternal(config?.[key]);btn.hidden=!url;
  if(url){btn.href=url;btn.textContent=(config?.[label]||fallback).replace(/↗\s*$/,'').trim()+' ↗';}
 }
 const img=safeImage(config?.retirada_foto_url);
 el('pickupImageWrap').hidden=!img;
 el('pickupFallback').hidden=!!img;
 if(img){el('pickupImage').src=img;el('pickupImage').alt=config?.retirada_foto_alt||'Entrada e corredor da sala do Centro Acadêmico de Arquivologia';fill('pickupCaption','retirada_foto_legenda','Nossa sala · CAARQ');}
}
renderPickup(null);
el('mobileNavButton').addEventListener('click',()=>{
 const opened=el('mainNav').classList.toggle('open');el('mobileNavButton').setAttribute('aria-expanded',String(opened));
});
(async()=>{
 try{
  const [p,f,c,t]=await Promise.all([
   client.from('caarq_loca_produtos').select('*').eq('publicado',true).order('destaque',{ascending:false}).order('ordem',{ascending:true}).order('criado_em',{ascending:false}),
   client.from('caarq_loca_fotos').select('id,produto_id,url,legenda,ordem').order('ordem',{ascending:true}),
   client.from('caarq_loca_config').select('*').eq('id',1).maybeSingle(),
   client.from('caarq_aparencia').select('primary_color,accent_color').eq('id',1).maybeSingle()
  ]);
  if(p.error||f.error||c.error)throw Error();
  products=p.data||[];photos=f.data||[];storeConfig=c.data;
  renderPickup(storeConfig);
  if(storeConfig){
   el('shopTitle').textContent=storeConfig.titulo||'Bem-vindos à LOCA!';
   el('shopDescription').textContent=storeConfig.subtitulo||'';
   const banner=safeImage(storeConfig.banner_url);if(banner)el('heroBanner').src=banner;
   const link=safeExternal(storeConfig.link_formulario);const btn=el('mainOrderButton');
   btn.hidden=!link;if(link){btn.href=link;btn.textContent=`${storeConfig.texto_botao||'Fazer encomenda'} ↗`;}
  }
  // A LOCA pode acompanhar as cores do tema oficial do CAARQ.
  if(!t.error&&t.data){
   if(/^#[0-9a-fA-F]{6}$/.test(t.data.primary_color||''))document.documentElement.style.setProperty('--purple',t.data.primary_color);
   if(/^#[0-9a-fA-F]{6}$/.test(t.data.accent_color||''))document.documentElement.style.setProperty('--yellow',t.data.accent_color);
  }
  buildCategories();renderProducts();
 }catch(error){el('catalogStatus').textContent='Não foi possível carregar o catálogo agora. Tente novamente mais tarde.';}
})();
