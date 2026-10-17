import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

// Chave publicável do projeto: pode aparecer no JavaScript público.
// A segurança é controlada pelas regras RLS no Supabase.
const SUPABASE_URL = 'https://aeipjioeqfcuqbacbcym.supabase.co';
const SUPABASE_PUBLISHABLE_KEY = 'sb_publishable_isTW4KzTw4bA7m82awH0BA_oG98M7qt';
const client = createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
  auth: { autoRefreshToken: true, persistSession: true, detectSessionInUrl: true }
});

const el = id => document.getElementById(id);
const screens = ['loading', 'loginView', 'passwordView', 'deniedView', 'dashboardView'];
const show = name => { screens.forEach(id => { el(id).hidden = id !== name; }); document.body.classList.toggle('dashboard-active', name === 'dashboardView'); };
function notice(id, message, success = false) {
  const box = el(id);
  box.textContent = message;
  box.classList.toggle('success', success);
  box.hidden = !message;
}
const roleNames = { admin: 'Administração geral', editor: 'Editoria', loja: 'Gestão da LOCA' };
let latestSession = null;
let isSettingPassword = false;
let currentRole = null;

async function checkAccess() {
  if (isSettingPassword) return;
  show('loading');
  const { data: { user }, error: userError } = await client.auth.getUser();
  if (userError || !user) { show('loginView'); return; }
  const { data: membership, error: memberError } = await client
    .from('caarq_admins')
    .select('role, is_active')
    .eq('user_id', user.id)
    .maybeSingle();
  if (memberError) {
    show('deniedView');
    el('deniedText').textContent = 'O painel ainda não está configurado no banco de dados ou houve uma falha de permissão. Peça à administração geral para concluir a configuração.';
    return;
  }
  if (!membership || !membership.is_active || !roleNames[membership.role]) {
    show('deniedView');
    el('deniedText').textContent = 'Seu login existe, mas ainda não foi autorizado para administrar o CAARQ. Peça à administração geral para liberar seu acesso.';
    return;
  }
  currentRole = membership.role;
  el('roleTag').textContent = roleNames[membership.role];
  el('membersTile').hidden = !['admin', 'editor'].includes(currentRole);
  el('appearanceTile').hidden = currentRole !== 'admin';
  el('projectsTile').hidden = !['admin', 'editor'].includes(currentRole);
  if (['admin', 'editor'].includes(currentRole)) await loadData();
  el('accountEmail').textContent = user.email || 'Membro autorizado';
  show('dashboardView');
}

el('togglePassword').addEventListener('click', () => {
  const input = el('password');
  const next = input.type === 'password' ? 'text' : 'password';
  input.type = next;
  el('togglePassword').textContent = next === 'text' ? 'Ocultar' : 'Mostrar';
});

el('loginForm').addEventListener('submit', async event => {
  event.preventDefault();
  notice('loginMessage', '');
  const email = el('email').value.trim();
  const password = el('password').value;
  if (!email || !password) { notice('loginMessage', 'Preencha o e-mail e a senha.'); return; }
  const button = el('loginButton');
  button.disabled = true;
  button.firstChild.textContent = 'Verificando acesso… ';
  try {
    const { error } = await client.auth.signInWithPassword({ email, password });
    if (error) { notice('loginMessage', 'Não foi possível entrar. Confira o e-mail e a senha ou solicite acesso à administração.'); return; }
    await checkAccess();
  } catch (err) {
    notice('loginMessage', 'Erro de conexão. Confira sua internet e tente novamente.');
  } finally {
    button.disabled = false;
    button.firstChild.textContent = 'Entrar no painel ';
  }
});

el('passwordForm').addEventListener('submit', async event => {
  event.preventDefault();
  const password = el('newPassword').value;
  if (password.length < 8) { notice('passwordMessage','Use uma senha com pelo menos 8 caracteres.'); return; }
  el('savePasswordButton').disabled = true;
  const { error } = await client.auth.updateUser({ password });
  el('savePasswordButton').disabled = false;
  if (error) { notice('passwordMessage','Não foi possível salvar a senha. Abra novamente o link do convite ou peça um novo convite.'); return; }
  notice('passwordMessage','Senha criada. Verificando suas permissões…', true);
  isSettingPassword = false;
  history.replaceState(null, '', location.pathname);
  await checkAccess();
});

async function logout() {
  currentRole = null;
  el('membersManager').hidden = true;
  el('projectsManager').hidden = true;
  el('appearanceManager').hidden = true;
  show('loading');
  await client.auth.signOut();
  show('loginView');
  el('password').value = '';
}
el('logoutButton').addEventListener('click', logout);
el('deniedLogout').addEventListener('click', logout);

client.auth.onAuthStateChange((event, session) => {
  latestSession = session;
  const inviteInUrl = location.hash.includes('type=invite') || location.search.includes('type=invite') || location.hash.includes('type=recovery') || location.search.includes('type=recovery');
  if ((event === 'PASSWORD_RECOVERY' || inviteInUrl) && session) {
    isSettingPassword = true;
    show('passwordView');
  }
});



// Editor de equipe pública: mudanças gravadas exclusivamente no Supabase,
// com as políticas RLS como barreira real de autorização.
let gestoes = [];
let membros = [];
let recordsLoaded = false;
const isEditor = () => currentRole === 'admin' || currentRole === 'editor';
function feedback(message, success=false) {
  notice('memberFeedback', message, success);
}
function node(tag, className, value) {
  const n = document.createElement(tag);
  if (className) n.className = className;
  if (value !== undefined) n.textContent = String(value);
  return n;
}
function action(label, fn) {
  const b = node('button', '', label);
  b.type = 'button';
  b.addEventListener('click', fn);
  return b;
}
function badge(label, extra='') {return node('span','record-tag '+extra,label);}
function formatRange(g) {
  const a = g.ano_inicio ?? '—';
  const b = g.ano_fim ?? (g.atual ? 'presente' : '—');
  return `${a}–${b}`;
}
function selectOptions(select, items, initialLabel, withAll=false) {
  const saved = select.value;
  select.replaceChildren();
  const first = document.createElement('option');
  first.value = '';
  first.textContent = initialLabel;
  select.append(first);
  for (const g of items) {
    const opt = document.createElement('option');
    opt.value = g.id;
    opt.textContent = `${g.nome} (${formatRange(g)})`;
    select.append(opt);
  }
  if (items.some(g => g.id === saved)) select.value = saved;
}
async function loadData() {
  if (!isEditor()) return;
  feedback('');
  try {
    const [g,m] = await Promise.all([
      client.from('caarq_gestoes').select('id,nome,ano_inicio,ano_fim,atual,publicada,criado_em').order('ano_inicio',{ascending:false}),
      client.from('caarq_membros').select('id,gestao_id,nome,cargo,apresentacao,foto_url,ordem,publicado,criado_em').order('ordem',{ascending:true}).order('nome',{ascending:true})
    ]);
    if (g.error) throw g.error;
    if (m.error) throw m.error;
    gestoes = g.data || [];
    membros = m.data || [];
    recordsLoaded = true;
    renderGestaoList();
    selectOptions(el('membroGestao'),gestoes,'Selecione uma gestão');
    selectOptions(el('filterGestao'),gestoes,'Todas as gestões');
    renderMembroList();
  } catch(error) {
    feedback('Não foi possível carregar as informações. Confira as permissões das tabelas no Supabase.');
  }
}
function renderGestaoList() {
  const list = el('gestoesList'); list.replaceChildren();
  if (!gestoes.length) { list.append(node('p','empty-records','Ainda não há gestões cadastradas. Preencha o formulário acima para criar a primeira.')); return; }
  for (const g of gestoes) {
    const item=node('div','record'); const desc=node('div','record-detail');
    desc.append(node('strong','record-title',g.nome),node('div','record-sub',formatRange(g)));
    const tags=node('div','record-tags');
    if (g.atual) tags.append(badge('Gestão atual','current'));
    tags.append(badge(g.publicada?'Visível no site':'Não publicada',g.publicada?'published':''));
    desc.append(tags);
    const commands=node('div','record-actions');
    commands.append(action('Editar',()=>editGestao(g)),action('Ver membros',()=>{
      el('filterGestao').value=g.id;renderMembroList();el('membroForm').scrollIntoView({behavior:'smooth',block:'start'});
    }));
    item.append(desc,commands);list.append(item);
  }
}
function renderMembroList() {
  const list=el('membrosList');list.replaceChildren();
  const chosen=el('filterGestao').value;
  const shown=membros.filter(m=>!chosen||m.gestao_id===chosen);
  if (!shown.length){list.append(node('p','empty-records','Nenhum integrante cadastrado para esta seleção.'));return;}
  for(const m of shown){
    const g=gestoes.find(x=>x.id===m.gestao_id);
    const item=node('div','record member-record');
    let photo;
    if(m.foto_url && /^https:\/\//i.test(m.foto_url)){
      photo=document.createElement('img');photo.className='member-photo';photo.alt='';photo.loading='lazy';photo.referrerPolicy='no-referrer';photo.src=m.foto_url;
    }else{photo=node('div','member-photo member-photo-placeholder',(m.nome||'?').slice(0,1).toUpperCase());}
    const desc=node('div','record-detail');
    desc.append(node('strong','record-title',m.nome),node('div','record-sub',`${m.cargo} · ${g?.nome||'Gestão não identificada'}`));
    const tags=node('div','record-tags');tags.append(badge(m.publicado?'Exibir no site':'Oculto',m.publicado?'published':''));desc.append(tags);
    const commands=node('div','record-actions');
    commands.append(action('Editar',()=>editMembro(m)),action(m.publicado?'Ocultar':'Publicar',()=>toggleMembro(m)));
    item.append(photo,desc,commands);list.append(item);
  }
}
function editGestao(g){
  el('gestaoId').value=g.id;
  el('gestaoNome').value=g.nome;
  el('gestaoInicio').value=g.ano_inicio??'';
  el('gestaoFim').value=g.ano_fim??'';
  el('gestaoAtual').checked=Boolean(g.atual);
  el('gestaoPublicada').checked=Boolean(g.publicada);
  el('gestaoForm').scrollIntoView({behavior:'smooth',block:'start'});
}
function editMembro(m){
  el('membroId').value=m.id;
  el('membroGestao').value=m.gestao_id;
  el('membroNome').value=m.nome;
  el('membroCargo').value=m.cargo;
  el('membroBio').value=m.apresentacao||'';
  el('membroFoto').value=m.foto_url||'';
  el('membroOrdem').value=m.ordem??0;
  el('membroPublicado').checked=Boolean(m.publicado);
  el('membroForm').scrollIntoView({behavior:'smooth',block:'start'});
}
function clearGestao(){el('gestaoForm').reset();el('gestaoId').value='';}
function clearMembro(){el('membroForm').reset();el('membroId').value='';}
el('openMembers').addEventListener('click',async()=>{
  if(!isEditor())return;
  el('membersManager').hidden=false;
  el('appearanceManager').hidden=true;
  el('projectsManager').hidden=true;
  if(!recordsLoaded)await loadData();
  el('membersManager').scrollIntoView({behavior:'smooth',block:'start'});
});
el('closeMembers').addEventListener('click',()=>{
  el('membersManager').hidden=true;el('dashboardView').scrollIntoView({behavior:'smooth',block:'start'});
});
el('cancelGestao').addEventListener('click',clearGestao);
el('cancelMembro').addEventListener('click',clearMembro);
el('filterGestao').addEventListener('change',renderMembroList);
el('gestaoForm').addEventListener('submit',async event=>{
  event.preventDefault();if(!isEditor())return;
  const id=el('gestaoId').value;
  const inicio=el('gestaoInicio').value;
  const fim=el('gestaoFim').value;
  if(inicio && fim && Number(fim)<Number(inicio)){feedback('O ano de término não pode ser anterior ao de início.');return;}
  const changes={nome:el('gestaoNome').value.trim(),ano_inicio:inicio?Number(inicio):null,ano_fim:fim?Number(fim):null,atual:el('gestaoAtual').checked,publicada:el('gestaoPublicada').checked};
  if(!changes.nome){feedback('Preencha o nome da gestão.');return;}
  const btn=el('saveGestao');btn.disabled=true;
  try{
    // Primeiro salva a gestão; em seguida desmarca a anterior se for nova atual.
    const q=id?client.from('caarq_gestoes').update(changes).eq('id',id):client.from('caarq_gestoes').insert(changes);
    const {error}=await q;
    if(error)throw error;
    if(changes.atual){
      const {data:newCurrent,error:lookupError}=await client.from('caarq_gestoes').select('id').eq('nome',changes.nome).eq('atual',true).order('criado_em',{ascending:false}).limit(1);
      if(lookupError)throw lookupError;
      const ownId=id||newCurrent?.[0]?.id;
      if(ownId){const {error:clearError}=await client.from('caarq_gestoes').update({atual:false}).neq('id',ownId).eq('atual',true);if(clearError)throw clearError;}
    }
    clearGestao();await loadData();feedback('Gestão salva! Você pode cadastrar os integrantes abaixo.',true);
  }catch(error){feedback('Não foi possível salvar a gestão. Confira a conexão e as permissões.');}
  finally{btn.disabled=false;}
});
el('membroForm').addEventListener('submit',async event=>{
  event.preventDefault();if(!isEditor())return;
  const id=el('membroId').value;
  const url=el('membroFoto').value.trim();
  if(url && !/^https:\/\//i.test(url)){feedback('Use um link de foto que comece com https://.');return;}
  const changes={gestao_id:el('membroGestao').value,nome:el('membroNome').value.trim(),cargo:el('membroCargo').value.trim(),apresentacao:el('membroBio').value.trim()||null,foto_url:url||null,ordem:Number(el('membroOrdem').value)||0,publicado:el('membroPublicado').checked};
  if(!changes.gestao_id||!changes.nome||!changes.cargo){feedback('Selecione a gestão e informe nome e cargo.');return;}
  const btn=el('saveMembro');btn.disabled=true;
  try{
    const q=id?client.from('caarq_membros').update(changes).eq('id',id):client.from('caarq_membros').insert(changes);
    const {error}=await q;if(error)throw error;
    clearMembro();await loadData();feedback('Integrante salvo! O perfil fica disponível para a futura página pública, conforme o status de publicação.',true);
  }catch(error){feedback('Não foi possível salvar o integrante. Confira os campos e as permissões do Supabase.');}
  finally{btn.disabled=false;}
});
async function toggleMembro(m){
  if(!isEditor())return;
  try{
    const {error}=await client.from('caarq_membros').update({publicado:!m.publicado}).eq('id',m.id);
    if(error)throw error;
    await loadData();feedback(m.publicado?'Integrante ocultado. O cadastro foi preservado.':'Integrante marcado para publicação.',true);
  }catch(err){feedback('Não foi possível alterar a visibilidade deste integrante.');}
}


// Atividades públicas: projetos em andamento/concluídos e eventos do calendário.
let activities=[];let activitiesLoaded=false;
const activityStatusNames={planejado:'Planejado',em_andamento:'Em andamento',concluido:'Concluído',cancelado:'Cancelado'};
function activityFeedback(msg,success=false){notice('projectFeedback',msg,success);}
function activityFormClear(){el('projectForm').reset();el('activityId').value='';}
function activityEdit(a){
  el('activityId').value=a.id;el('activityType').value=a.tipo;el('activityTitle').value=a.titulo;
  el('activityStatus').value=a.situacao;el('activityResponsible').value=a.responsaveis||'';
  el('activityStart').value=a.data_inicio||'';el('activityEnd').value=a.data_fim||'';
  el('activityTime').value=a.horario||'';el('activityLocation').value=a.local_evento||'';
  el('activityDescription').value=a.descricao||'';el('activityPhoto').value=a.foto_url||'';
  el('activityFile').value='';el('activityPublished').checked=Boolean(a.publicado);
  el('projectForm').scrollIntoView({behavior:'smooth',block:'start'});
}
function activityRender(){const host=el('activitiesList');host.replaceChildren();const filter=el('activityFilter').value;
  const shown=activities.filter(a=>filter==='todos'||(filter==='concluido'?a.situacao==='concluido':a.tipo===filter));
  if(!shown.length){host.append(node('p','empty-records','Nenhuma atividade cadastrada com este filtro.'));return;}
  for(const a of shown){const item=node('div','record'),info=node('div','record-detail');info.append(node('strong','record-title',a.titulo));
  info.append(node('div','record-sub',[a.tipo==='evento'?'Evento':'Projeto',a.data_inicio?new Date(a.data_inicio+'T12:00:00').toLocaleDateString('pt-BR'):'Data não definida',a.responsaveis||''].filter(Boolean).join(' · ')));
  const tags=node('div','record-tags');tags.append(badge(activityStatusNames[a.situacao]||a.situacao),badge(a.publicado?'Publicado':'Rascunho',a.publicado?'published':''));info.append(tags);
  const actions=node('div','record-actions');actions.append(action('Editar',()=>activityEdit(a)),action(a.publicado?'Ocultar':'Publicar',async()=>{
    if(!isEditor())return;const {error}=await client.from('caarq_atividades').update({publicado:!a.publicado,atualizado_em:new Date().toISOString()}).eq('id',a.id);
    if(error)activityFeedback('Não foi possível alterar a publicação.');else{await loadActivities();activityFeedback('Visibilidade atualizada!',true);}
  }));
  const del=action('Excluir',async()=>{
    if(!isEditor()||!confirm(`Excluir definitivamente “${a.titulo}”? Essa ação não pode ser desfeita.`))return;
    const {error}=await client.from('caarq_atividades').delete().eq('id',a.id);
    if(error)activityFeedback('Não foi possível excluir a atividade.');else{await loadActivities();activityFeedback('Registro excluído.',true);}
  });del.classList.add('action-danger');actions.append(del);item.append(info,actions);host.append(item);
  }
}
async function loadActivities(){if(!isEditor())return;try{const {data,error}=await client.from('caarq_atividades').select('*').order('criado_em',{ascending:false});if(error)throw error;activities=data||[];activitiesLoaded=true;activityRender();}catch(error){console.error('Erro ao carregar atividades',error);activityFeedback('Não foi possível carregar atividades. Confirme se o SQL de projetos foi executado no Supabase.');}}
el('openProjects').addEventListener('click',async()=>{if(!isEditor())return;el('membersManager').hidden=true;el('appearanceManager').hidden=true;el('projectsManager').hidden=false;if(!activitiesLoaded)await loadActivities();el('projectsManager').scrollIntoView({behavior:'smooth',block:'start'});});
el('closeProjects').addEventListener('click',()=>{el('projectsManager').hidden=true;el('dashboardView').scrollIntoView({behavior:'smooth',block:'start'});});
el('clearActivity').addEventListener('click',activityFormClear);
el('activityFilter').addEventListener('change',activityRender);
el('projectForm').addEventListener('submit',async event=>{
 event.preventDefault();if(!isEditor())return;activityFeedback('');const from=el('activityStart').value,to=el('activityEnd').value;
 if(from&&to&&to<from){activityFeedback('A data de término não pode ser anterior ao início.');return;}
 const file=el('activityFile').files?.[0];
 if(file&&(!['image/jpeg','image/png','image/webp'].includes(file.type)||file.size>5*1024*1024)){activityFeedback('Escolha uma imagem JPEG, PNG ou WebP de até 5 MB.');return;}
 let photo=el('activityPhoto').value.trim();if(photo&&!/^https:\/\//i.test(photo)){activityFeedback('O link da foto precisa começar com https://.');return;}
 const save=el('saveActivity');save.disabled=true;save.textContent='Salvando…';
 try{
   if(file){const ext={"image/jpeg":"jpg","image/png":"png","image/webp":"webp"}[file.type];const key=`atividades/${crypto.randomUUID()}.${ext}`;
     const {error:uploadError}=await client.storage.from('caarq-imagens').upload(key,file,{contentType:file.type,upsert:false,cacheControl:'3600'});
     if(uploadError)throw uploadError;
     photo=client.storage.from('caarq-imagens').getPublicUrl(key).data.publicUrl;
   }
   const changes={tipo:el('activityType').value,titulo:el('activityTitle').value.trim(),descricao:el('activityDescription').value.trim()||null,
     foto_url:photo||null,data_inicio:from||null,data_fim:to||null,horario:el('activityTime').value.trim()||null,local_evento:el('activityLocation').value.trim()||null,
     responsaveis:el('activityResponsible').value.trim()||null,situacao:el('activityStatus').value,publicado:el('activityPublished').checked,atualizado_em:new Date().toISOString()};
   if(changes.titulo.length<3){activityFeedback('Dê um nome com pelo menos 3 caracteres.');return;}
   const id=el('activityId').value;
   const q=id?client.from('caarq_atividades').update(changes).eq('id',id):client.from('caarq_atividades').insert(changes);
   const {error}=await q;if(error)throw error;
   activityFormClear();await loadActivities();activityFeedback('Atividade salva! Se publicada, já pode aparecer no site.',true);
 }catch(error){console.error('Erro ao salvar atividade',error);activityFeedback('Não foi possível salvar. Confira os dados e as permissões do Supabase.');}
 finally{save.disabled=false;save.textContent='Salvar atividade ↗';}
});


// V6 — Gerenciamento da aparência. Somente a Administração Geral tem permissão
// de gravar esta tabela; a RLS do Supabase garante isso também no servidor.
const appearanceDefaults={
 primary_color:'#40194f',accent_color:'#ffd02f',hero_kicker:'Memória · Acesso · Participação',
 hero_first:'Guardar memórias.',hero_highlight:'Transformar',hero_last:'futuros.',
 hero_description:'Somos o Centro Acadêmico de Arquivologia da UEPB, Campus V. Um espaço de representação estudantil, diálogo e construção coletiva.',
 logo_url:null,banner_url:null
};
let appearanceLoaded=false;
let appearanceSaved={...appearanceDefaults};
const validHex=value=>/^#[0-9a-fA-F]{6}$/.test(value||'');
const validHttps=value=>{try{const u=new URL(value);return u.protocol==='https:'&&u.href.length<=2000;}catch{return false;}};
function appearanceFeedback(message,success=false){notice('appearanceFeedback',message,success);}
function appearanceBrightness(hex){const channels=[1,3,5].map(n=>parseInt(hex.slice(n,n+2),16)/255).map(c=>c<=.04045?c/12.92:((c+.055)/1.055)**2.4);return .2126*channels[0]+.7152*channels[1]+.0722*channels[2];}
function contrast(first,second){const a=appearanceBrightness(first),b=appearanceBrightness(second);return (Math.max(a,b)+.05)/(Math.min(a,b)+.05);}
function appearanceFill(a){
 el('themePrimary').value=validHex(a.primary_color)?a.primary_color:appearanceDefaults.primary_color;
 el('themeAccent').value=validHex(a.accent_color)?a.accent_color:appearanceDefaults.accent_color;
 el('themeKicker').value=a.hero_kicker??appearanceDefaults.hero_kicker;
 el('themeFirst').value=a.hero_first??appearanceDefaults.hero_first;
 el('themeAccentText').value=a.hero_highlight??appearanceDefaults.hero_highlight;
 el('themeLast').value=a.hero_last??appearanceDefaults.hero_last;
 el('themeDescription').value=a.hero_description??appearanceDefaults.hero_description;
 el('themeLogoUrl').value=a.logo_url||'';
 el('themeBannerUrl').value=a.banner_url||'';
 el('themeLogoFile').value='';el('themeBannerFile').value='';
 el('themeRemoveBanner').checked=false;
 appearancePreview();
}
function appearancePreview(){
 const primary=el('themePrimary').value,accent=el('themeAccent').value;
 const preview=el('themePreview');
 if(validHex(primary))preview.style.background=primary;
 if(validHex(accent))preview.style.setProperty('--preview-accent',accent);
 const fields={themePreviewKicker:'themeKicker',themePreviewFirst:'themeFirst',themePreviewAccent:'themeAccentText',themePreviewLast:'themeLast',themePreviewDescription:'themeDescription'};
 for(const [id,source] of Object.entries(fields))el(id).textContent=el(source).value||' '; 
 const logo=el('themeLogoUrl').value||appearanceSaved.logo_url;
 el('themePreviewLogo').src=validHttps(logo)?logo:'../logo-caarq.png';
}
async function loadAppearance(){
 if(currentRole!=='admin')return;
 appearanceFeedback('');
 try{
  const {data,error}=await client.from('caarq_aparencia').select('*').eq('id',1).maybeSingle();
  if(error)throw error;
  if(!data)throw new Error('Configuração não encontrada.');
  appearanceSaved={...appearanceDefaults,...data};appearanceLoaded=true;
  appearanceFill(appearanceSaved);
 }catch(error){console.error('Configuração de aparência',error);appearanceFeedback('Ainda não foi possível carregar a aparência. Execute o arquivo SQL da versão 6 no Supabase e tente novamente.');}
}
el('openAppearance').addEventListener('click',async()=>{
 if(currentRole!=='admin')return;
 el('membersManager').hidden=true;el('projectsManager').hidden=true;el('appearanceManager').hidden=false;
 await loadAppearance();
 el('appearanceManager').scrollIntoView({behavior:'smooth',block:'start'});
});
el('closeAppearance').addEventListener('click',()=>{el('appearanceManager').hidden=true;el('dashboardView').scrollIntoView({behavior:'smooth',block:'start'});});
for(const id of ['themePrimary','themeAccent','themeKicker','themeFirst','themeAccentText','themeLast','themeDescription','themeLogoUrl'])el(id).addEventListener('input',appearancePreview);
for(const b of document.querySelectorAll('.theme-preset'))b.addEventListener('click',()=>{el('themePrimary').value=b.dataset.primary;el('themeAccent').value=b.dataset.accent;appearancePreview();});
function acceptedThemeFile(file){return !file||(file.size<=5*1024*1024&&['image/png','image/jpeg','image/webp'].includes(file.type));}
async function uploadThemeFile(file,type){
 const ext={'image/png':'png','image/jpeg':'jpg','image/webp':'webp'}[file.type];
 const key=`aparencia/${type}-${crypto.randomUUID()}.${ext}`;
 const {error}=await client.storage.from('caarq-imagens').upload(key,file,{contentType:file.type,upsert:false,cacheControl:'3600'});
 if(error)throw error;
 return client.storage.from('caarq-imagens').getPublicUrl(key).data.publicUrl;
}
async function saveAppearanceData(changes,uploadedFiles){
 const b=el('saveAppearance');b.disabled=true;b.textContent='Publicando…';
 try{
  if(uploadedFiles?.logo)changes.logo_url=await uploadThemeFile(uploadedFiles.logo,'logo');
  if(uploadedFiles?.banner)changes.banner_url=await uploadThemeFile(uploadedFiles.banner,'banner');
  const {data,error}=await client.from('caarq_aparencia').update({...changes,atualizado_em:new Date().toISOString()}).eq('id',1).select().single();
  if(error)throw error;
  appearanceSaved={...appearanceDefaults,...data};appearanceFill(appearanceSaved);
  appearanceFeedback('Aparência publicada! Atualize a página inicial do CAARQ para conferir.',true);
 }catch(error){console.error('Salvar aparência',error);appearanceFeedback('Não foi possível salvar a aparência. Confira sua autorização e o SQL da versão 6.');}
 finally{b.disabled=false;b.textContent='Publicar aparência ↗';}
}
el('appearanceForm').addEventListener('submit',async e=>{
 e.preventDefault();if(currentRole!=='admin'||!appearanceLoaded)return;
 appearanceFeedback('');
 const color=el('themePrimary').value,accent=el('themeAccent').value;
 if(!validHex(color)||!validHex(accent)||contrast(color,'#ffffff')<4.5||contrast(accent,color)<3){appearanceFeedback('Escolha um tom principal escuro o suficiente para texto branco e uma cor de destaque com contraste. Tente uma das combinações prontas.');return;}
 const textKeys={hero_kicker:'themeKicker',hero_first:'themeFirst',hero_highlight:'themeAccentText',hero_last:'themeLast',hero_description:'themeDescription'};
 const changes={primary_color:color,accent_color:accent};
 for(const [key,id] of Object.entries(textKeys)){const t=el(id).value.trim();if(!t){appearanceFeedback('Preencha todos os textos do banner.');return;}changes[key]=t;}
 const logo=el('themeLogoUrl').value.trim(),banner=el('themeBannerUrl').value.trim();
 if((logo&&!validHttps(logo))||(banner&&!validHttps(banner))){appearanceFeedback('Os links das imagens devem começar com https://.');return;}
 changes.logo_url=logo||appearanceSaved.logo_url||null;
 changes.banner_url=el('themeRemoveBanner').checked?null:(banner||appearanceSaved.banner_url||null);
 const files={logo:el('themeLogoFile').files?.[0],banner:el('themeBannerFile').files?.[0]};
 if(!acceptedThemeFile(files.logo)||!acceptedThemeFile(files.banner)){appearanceFeedback('Escolha arquivos PNG, JPEG ou WebP de até 5 MB.');return;}
 if(el('themeRemoveBanner').checked)files.banner=null;
 await saveAppearanceData(changes,files);
});
el('resetAppearance').addEventListener('click',async()=>{
 if(currentRole!=='admin'||!appearanceLoaded||!confirm('Restaurar todas as cores, textos e imagens padrão do CAARQ?'))return;
 await saveAppearanceData({...appearanceDefaults},null);
});

// A logo atualizada também aparece na entrada e no painel.
async function loadAdminBrand(){
 try{
  const {data,error}=await client.from('caarq_aparencia').select('logo_url,primary_color,accent_color').eq('id',1).maybeSingle();
  if(error||!data)return;
  if(validHex(data.primary_color))document.documentElement.style.setProperty('--purple',data.primary_color);
  if(validHex(data.accent_color))document.documentElement.style.setProperty('--yellow',data.accent_color);
  if(data.logo_url&&validHttps(data.logo_url)){
    const logo=document.querySelector('.admin-real-logo');if(logo){logo.onerror=()=>{logo.onerror=null;logo.src='../logo-caarq.png';};logo.src=data.logo_url;}
  }
 }catch(error){/* Mantém tema clássico. */}
}
void loadAdminBrand();


// Iniciar autenticação SOMENTE após declarar todos os editores e eventos.
try {
  const inviteInUrl = location.hash.includes('type=invite') || location.search.includes('type=invite') || location.hash.includes('type=recovery') || location.search.includes('type=recovery');
  const { data: { session } } = await client.auth.getSession();
  if (session && inviteInUrl) { isSettingPassword = true; show('passwordView'); }
  else await checkAccess();
} catch (err) {
  show('loginView');
  notice('loginMessage', 'Não foi possível iniciar a conexão com o Supabase. Verifique sua internet ou tente novamente mais tarde.');
}

