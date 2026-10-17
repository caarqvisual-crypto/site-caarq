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
const roleNames = { admin: 'Administração geral', editor: 'Editoria', loja: 'Integrante autorizado' };
let latestSession = null;
let isSettingPassword = false;
let currentRole = null;
let currentPermissions = {pode_membros:false,pode_projetos:false,pode_aparencia:false,pode_loca:false,pode_criar_grupos:false,trocar_senha:false};
const canEditMembers = () => currentRole === 'admin' || currentPermissions.pode_membros;
const canEditProjects = () => currentRole === 'admin' || currentPermissions.pode_projetos;
const canEditAppearance = () => currentRole === 'admin' || currentPermissions.pode_aparencia;


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
  const {data:access,error:accessError} = await client.from('caarq_acessos')
    .select('pode_membros,pode_projetos,pode_aparencia,pode_loca,pode_criar_grupos,trocar_senha')
    .eq('user_id',user.id).maybeSingle();
  if (accessError || !access) {
    show('deniedView');
    el('deniedText').textContent = 'Falta concluir a versão 10 no Supabase. Peça à administração geral para verificar a migração de acessos.';
    return;
  }
  currentPermissions = access;
  if (access.trocar_senha) {
    isSettingPassword = true;
    show('passwordView');
    el('passwordTitle').textContent = 'Troque sua senha provisória';
    notice('passwordMessage','Crie uma senha nova com pelo menos 12 caracteres, incluindo letras e números.');
    return;
  }
  el('roleTag').textContent = roleNames[membership.role];
  el('membersTile').hidden = !canEditMembers();
  el('appearanceTile').hidden = !canEditAppearance();
  el('projectsTile').hidden = !canEditProjects();
  el('accessTile').hidden = currentRole !== 'admin';
  if (canEditMembers()) await loadData();
  el('accountEmail').textContent = user.email || 'Membro autorizado';
  show('dashboardView');
  void chatActivate(user);
  void loadOwnProfile(user);
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
  if (password.length < 12 || !/[a-zA-Z]/.test(password) || !/[0-9]/.test(password)) {
    notice('passwordMessage','Use ao menos 12 caracteres, com letras e números.'); return;
  }
  el('savePasswordButton').disabled = true;
  try {
    if (currentPermissions.trocar_senha) {
      const {data,error} = await client.functions.invoke('caarq-acessos',{
        body:{action:'change_password',password}
      });
      if (error || !data?.ok) throw new Error(data?.error || 'Falha no serviço de troca de senha.');
    } else {
      const {error} = await client.auth.updateUser({password});
      if (error) throw error;
    }
    notice('passwordMessage','Senha alterada! Abrindo seu painel…',true);
    currentPermissions.trocar_senha=false;
    isSettingPassword=false;
    history.replaceState(null, '', location.pathname);
    el('newPassword').value='';
    await checkAccess();
  } catch (error) {
    notice('passwordMessage',error.message||'Não foi possível trocar a senha. Contate a administração geral.');
  } finally { el('savePasswordButton').disabled=false; }
});

async function logout() {
  await chatDeactivate();
  currentRole = null;
  currentPermissions={pode_membros:false,pode_projetos:false,pode_aparencia:false,pode_loca:false,pode_criar_grupos:false,trocar_senha:false};
  el('accessManager').hidden = true;
  el('membersManager').hidden = true;
  el('projectsManager').hidden = true;
  el('appearanceManager').hidden = true;
  el('profileManager').hidden = true;
  el('notificationCenter').hidden = true;
  ownProfile = null;
  el('accountAvatar').replaceChildren(document.createTextNode('✦'));
  el('accountAlias').textContent = 'Meu perfil';
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
const isEditor = () => canEditMembers();
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
      client.from('caarq_membros').select('id,gestao_id,nome,cargo,coordenacao,apresentacao,foto_url,ordem,publicado,criado_em').order('ordem',{ascending:true}).order('nome',{ascending:true})
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
    desc.append(node('strong','record-title',m.nome),node('div','record-sub',`${m.cargo}${m.coordenacao ? ' · Coordenação: ' + m.coordenacao : ''} · ${g?.nome||'Gestão não identificada'}`));
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
  el('membroCoordenacao').value=m.coordenacao||'';
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
  el('accessManager').hidden=true;el('membersManager').hidden=false;
  el('appearanceManager').hidden=true;
  el('projectsManager').hidden=true;
  el('profileManager').hidden=true;
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
  const changes={gestao_id:el('membroGestao').value,nome:el('membroNome').value.trim(),cargo:el('membroCargo').value.trim(),coordenacao:el('membroCoordenacao').value.trim()||null,apresentacao:el('membroBio').value.trim()||null,foto_url:url||null,ordem:Number(el('membroOrdem').value)||0,publicado:el('membroPublicado').checked};
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
    if(!canEditProjects())return;const {error}=await client.from('caarq_atividades').update({publicado:!a.publicado,atualizado_em:new Date().toISOString()}).eq('id',a.id);
    if(error)activityFeedback('Não foi possível alterar a publicação.');else{await loadActivities();activityFeedback('Visibilidade atualizada!',true);}
  }));
  const del=action('Excluir',async()=>{
    if(!canEditProjects()||!confirm(`Excluir definitivamente “${a.titulo}”? Essa ação não pode ser desfeita.`))return;
    const {error}=await client.from('caarq_atividades').delete().eq('id',a.id);
    if(error)activityFeedback('Não foi possível excluir a atividade.');else{await loadActivities();activityFeedback('Registro excluído.',true);}
  });del.classList.add('action-danger');actions.append(del);item.append(info,actions);host.append(item);
  }
}
async function loadActivities(){if(!canEditProjects())return;try{const {data,error}=await client.from('caarq_atividades').select('*').order('criado_em',{ascending:false});if(error)throw error;activities=data||[];activitiesLoaded=true;activityRender();}catch(error){console.error('Erro ao carregar atividades',error);activityFeedback('Não foi possível carregar atividades. Confirme se o SQL de projetos foi executado no Supabase.');}}
el('openProjects').addEventListener('click',async()=>{if(!canEditProjects())return;el('membersManager').hidden=true;el('appearanceManager').hidden=true;el('profileManager').hidden=true;el('accessManager').hidden=true;el('projectsManager').hidden=false;if(!activitiesLoaded)await loadActivities();el('projectsManager').scrollIntoView({behavior:'smooth',block:'start'});});
el('closeProjects').addEventListener('click',()=>{el('projectsManager').hidden=true;el('dashboardView').scrollIntoView({behavior:'smooth',block:'start'});});
el('clearActivity').addEventListener('click',activityFormClear);
el('activityFilter').addEventListener('change',activityRender);
el('projectForm').addEventListener('submit',async event=>{
 event.preventDefault();if(!canEditProjects())return;activityFeedback('');const from=el('activityStart').value,to=el('activityEnd').value;
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
 if(!canEditAppearance())return;
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
 if(!canEditAppearance())return;
 el('membersManager').hidden=true;el('projectsManager').hidden=true;el('profileManager').hidden=true;el('accessManager').hidden=true;el('appearanceManager').hidden=false;
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
 e.preventDefault();if(!canEditAppearance()||!appearanceLoaded)return;
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
 if(!canEditAppearance()||!appearanceLoaded||!confirm('Restaurar todas as cores, textos e imagens padrão do CAARQ?'))return;
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



// V9 — Meu Perfil: dados de exibição independentes das funções administrativas.
// O Supabase exige autenticação ativa e RLS de proprietário para escrita/leitura.
let ownProfile = null;
let ownProfileUser = null;
let profilePreviewObjectUrl = null;
let profileStoredPhotoUrl = null;
let profileSaving = false;
function profileNotice(message,success=false){ notice('profileFeedback',message,success); }
function profileImage(target, url){
  target.replaceChildren();
  if (!url) { target.textContent='✦'; return; }
  const img = document.createElement('img');
  img.src=url;img.alt='Foto do seu perfil';img.loading='lazy';
  img.addEventListener('error',()=>{ if(img.parentNode===target)target.replaceChildren(document.createTextNode('✦')); });
  target.appendChild(img);
}
function clearProfilePreviewObject(){
 if(profilePreviewObjectUrl){ URL.revokeObjectURL(profilePreviewObjectUrl); profilePreviewObjectUrl=null; }
}
function profileCard(){
 const name=ownProfile?.nome_exibicao?.trim()||ownProfile?.apelido?.trim()||'Meu perfil CAARQ';
 el('accountAlias').textContent=name;
 el('profilePreviewName').textContent=name;
 el('profilePreviewEmail').textContent=ownProfileUser?.email||'Conta autorizada';
 el('profileRoleLabel').textContent=roleNames[currentRole]||'Membro do CAARQ';
 profileImage(el('accountAvatar'),profileStoredPhotoUrl);
 if(!profilePreviewObjectUrl)profileImage(el('profileAvatar'),profileStoredPhotoUrl);
}
function fillOwnProfileForm(){
 el('profileName').value=ownProfile?.nome_exibicao||'';
 el('profileNickname').value=ownProfile?.apelido||'';
 el('profileBio').value=ownProfile?.biografia||'';
 el('profilePhoto').value='';
 el('profileRemovePhoto').checked=false;
 clearProfilePreviewObject();
 profileCard();
}
async function loadOwnProfile(user){
 try{
  if(!currentRole)return;
  ownProfileUser=user||(await client.auth.getUser()).data.user;
  if(!ownProfileUser)return;
  const {data,error}=await client.from('caarq_perfis').select('user_id,nome_exibicao,apelido,biografia,foto_caminho').eq('user_id',ownProfileUser.id).maybeSingle();
  if(error)throw error;
  ownProfile=data||null;
  profileStoredPhotoUrl=null;
  if(ownProfile?.foto_caminho){
   const {data:link,error:linkError}=await client.storage.from('caarq-perfis').createSignedUrl(ownProfile.foto_caminho,3600);
   if(!linkError)profileStoredPhotoUrl=link.signedUrl;
  }
  fillOwnProfileForm();
  profileNotice('');
 }catch(error){
  console.error('Erro ao carregar meu perfil',error);
  profileNotice('O perfil ainda não pôde ser carregado. Confira se executou o SQL da versão 9 no Supabase.');
 }
}
el('openProfile').addEventListener('click',async()=>{
 if(!currentRole)return;
 el('membersManager').hidden=true;el('projectsManager').hidden=true;el('appearanceManager').hidden=true;
 el('accessManager').hidden=true;el('profileManager').hidden=false;
 await loadOwnProfile();
 el('profileManager').scrollIntoView({behavior:'smooth',block:'start'});
});
el('closeProfile').addEventListener('click',()=>{
 el('profileManager').hidden=true;
 clearProfilePreviewObject();
 el('dashboardView').scrollIntoView({behavior:'smooth',block:'start'});
});
el('profileName').addEventListener('input',()=>{
 el('profilePreviewName').textContent=el('profileName').value.trim()||el('profileNickname').value.trim()||'Meu perfil CAARQ';
});
el('profileNickname').addEventListener('input',()=>{
 el('profilePreviewName').textContent=el('profileName').value.trim()||el('profileNickname').value.trim()||'Meu perfil CAARQ';
});
el('profilePhoto').addEventListener('change',()=>{
 clearProfilePreviewObject();
 const file=el('profilePhoto').files?.[0];
 if(file){
  profilePreviewObjectUrl=URL.createObjectURL(file);
  profileImage(el('profileAvatar'),profilePreviewObjectUrl);
  el('profileRemovePhoto').checked=false;
 }else profileImage(el('profileAvatar'),profileStoredPhotoUrl);
});
el('profileRemovePhoto').addEventListener('change',()=>{
 if(el('profileRemovePhoto').checked){
  el('profilePhoto').value='';clearProfilePreviewObject();profileImage(el('profileAvatar'),null);
 }else profileImage(el('profileAvatar'),profileStoredPhotoUrl);
});
el('reloadProfile').addEventListener('click',async()=>{
 profileNotice('');await loadOwnProfile();
});
el('profileForm').addEventListener('submit',async e=>{
 e.preventDefault();
 if(profileSaving||!currentRole)return;
 profileNotice('');
 const {data:{user},error:userError}=await client.auth.getUser();
 if(userError||!user){profileNotice('Sua sessão expirou. Entre novamente.');return;}
 const nome=el('profileName').value.trim();
 const apelido=el('profileNickname').value.trim();
 const bio=el('profileBio').value.trim();
 if((nome&&nome.length>90)||(apelido&&apelido.length>40)||bio.length>400){profileNotice('Algum campo ultrapassou o limite permitido.');return;}
 const file=el('profilePhoto').files?.[0];
 if(file&&(file.size>2*1024*1024||!['image/png','image/jpeg','image/webp'].includes(file.type))){profileNotice('Escolha PNG, JPG ou WebP com até 2 MB.');return;}
 profileSaving=true;
 el('saveProfile').disabled=true;
 el('saveProfile').textContent='Salvando…';
 let uploadedPath=null;
 const oldPath=ownProfile?.foto_caminho||null;
 try{
  let photoPath=el('profileRemovePhoto').checked?null:oldPath;
  if(file){
   const ext={'image/png':'png','image/jpeg':'jpg','image/webp':'webp'}[file.type];
   uploadedPath=`${user.id}/${crypto.randomUUID()}.${ext}`;
   const {error:uploadError}=await client.storage.from('caarq-perfis').upload(uploadedPath,file,{contentType:file.type,upsert:false,cacheControl:'3600'});
   if(uploadError)throw uploadError;
   photoPath=uploadedPath;
  }
  const values={user_id:user.id,nome_exibicao:nome||null,apelido:apelido||null,biografia:bio||null,foto_caminho:photoPath,atualizado_em:new Date().toISOString()};
  const {error}=await client.from('caarq_perfis').upsert(values,{onConflict:'user_id'});
  if(error)throw error;
  if(oldPath&&oldPath!==photoPath){
   // Limpeza do arquivo antigo, se ainda pertencer à própria conta.
   void client.storage.from('caarq-perfis').remove([oldPath]);
  }
  uploadedPath=null;
  await loadOwnProfile(user);
  profileNotice('Perfil salvo! Sua foto e seu apelido já aparecem no painel.',true);
 }catch(error){
  console.error('Salvar perfil',error);
  if(uploadedPath)await client.storage.from('caarq-perfis').remove([uploadedPath]);
  profileNotice('Não foi possível salvar o perfil. Confira a conexão e o SQL da versão 9.');
 }finally{
  profileSaving=false;
  el('saveProfile').disabled=false;
  el('saveProfile').textContent='Salvar meu perfil ↗';
 }
});


// V10 · Contas e permissões: a chave secreta nunca é enviada ao navegador.
const accessRoles = {
  pode_membros: 'Integrantes e gestões',
  pode_projetos: 'Projetos e calendário',
  pode_aparencia: 'Aparência do site',
  pode_loca: 'Loja LOCA (em construção)',
  pode_criar_grupos: 'Pode criar grupos no chat',
};
const accessFields = Object.keys(accessRoles);
let accessLoading = false;
let accessPass = '';
function accessMsg(message,success=false){ notice('accessFeedback',message,success); }
function hideTempPassword(){
  accessPass='';el('temporaryPasswordValue').textContent='';el('temporaryPasswordBox').hidden=true;
}
function showTempPassword(password){
  hideTempPassword();accessPass=password;
  el('temporaryPasswordValue').textContent=password;
  el('temporaryPasswordBox').hidden=false;
  el('temporaryPasswordBox').scrollIntoView({behavior:'smooth',block:'nearest'});
}
function userPermsFromForm(prefix){
  if(prefix==='new')return {
    pode_membros:el('newPermMembers').checked,
    pode_projetos:el('newPermProjects').checked,
    pode_aparencia:el('newPermAppearance').checked,
    pode_loca:el('newPermLoca').checked,
    pode_criar_grupos:el('newPermGroups').checked,
  };
  return accessFields.reduce((acc,key)=>({...acc,[key]:el(prefix+'-'+key)?.checked===true}),{});
}
async function callAccess(body){
  const {data,error} = await client.functions.invoke('caarq-acessos',{body});
  if (error || data?.error) {
    let detail=data?.error;
    if (!detail && error?.context?.json) {
      try { detail=(await error.context.json())?.error; } catch {}
    }
    throw new Error(detail||'Serviço indisponível. Confira se a função caarq-acessos foi implantada no Supabase.');
  }
  return data;
}
async function loadAccounts(){
  if(currentRole!=='admin'||accessLoading)return;
  accessLoading=true;accessMsg('');
  el('accessList').replaceChildren(node('p','empty-records','Carregando contas…'));
  try{
    const result=await callAccess({action:'list'});
    renderAccounts(result.users||[]);
  }catch(error){
    accessMsg(error.message);
    el('accessList').replaceChildren(node('p','empty-records','Não foi possível carregar as contas.'));
  }finally{accessLoading=false;}
}
function renderAccounts(users){
  const container=el('accessList');container.replaceChildren();
  if(!users.length){container.append(node('p','empty-records','Nenhuma conta cadastrada.'));return;}
  for(const user of users){
    const card=node('article','access-record');
    const head=node('div','access-record-top');
    const person=node('div','access-person');
    const avatar=node('div','access-person-icon',(user.nome||'?').charAt(0).toUpperCase());
    const desc=node('div');
    desc.append(node('strong','',user.nome||'Membro'),node('small','',user.email||'E-mail não disponível'));
    person.append(avatar,desc);
    const status=node('span','access-state '+(user.role==='admin'?'admin':user.active?'':'inactive'),
      user.role==='admin'?'Administração geral':user.active?'Ativo':'Acesso suspenso');
    head.append(person,status);card.append(head);
    if(user.role==='admin'){
      card.append(node('p','bottom-note','A conta da Administração Geral é protegida e não pode ser alterada aqui.'));
      container.append(card);continue;
    }
    const nameLabel=node('label','','Nome no cadastro');
    const nameInput=node('input');nameInput.value=user.nome||'';nameInput.maxLength=120;nameInput.minLength=2;
    card.append(nameLabel,nameInput);
    const group=node('fieldset','permissions-set');
    group.append(node('legend','','O que pode editar'));
    const flags={};
    for(const [key,title] of Object.entries(accessRoles)){
      const row=node('label');const checkbox=document.createElement('input');checkbox.type='checkbox';
      checkbox.checked=user[key]===true;flags[key]=checkbox;
      row.append(checkbox,document.createTextNode(title));group.append(row);
    }
    card.append(group);
    const actions=node('div','access-row');
    const save=action('Salvar permissões',async()=>{
      save.disabled=true;accessMsg('');
      try{
        const name=nameInput.value.trim();
        await callAccess({action:'update',user_id:user.user_id,name,active:user.active,
          permissions:Object.fromEntries(accessFields.map(k=>[k,flags[k].checked]))});
        accessMsg(`Permissões de ${name} atualizadas!`,true);
        await loadAccounts();
      }catch(error){accessMsg(error.message);}
      finally{save.disabled=false;}
    });save.className='primary';
    const toggle=action(user.active?'Suspender acesso':'Reativar acesso',async()=>{
      if(!confirm(`${user.active?'Suspender':'Reativar'} o acesso de ${user.nome}?`))return;
      toggle.disabled=true;
      try{
        await callAccess({action:'update',user_id:user.user_id,name:nameInput.value.trim(),active:!user.active,
          permissions:Object.fromEntries(accessFields.map(k=>[k,flags[k].checked]))});
        accessMsg('Situação do acesso atualizada!',true);await loadAccounts();
      }catch(error){accessMsg(error.message);}
      finally{toggle.disabled=false;}
    });if(user.active)toggle.className='warn';
    const reset=action('Nova senha provisória',async()=>{
      if(!confirm(`Gerar uma nova senha provisória para ${user.nome}? A senha anterior deixará de funcionar.`))return;
      reset.disabled=true;hideTempPassword();
      try{
        const result=await callAccess({action:'reset',user_id:user.user_id});
        if(!result?.provisional_password)throw new Error('A senha não foi devolvida pelo serviço.');
        showTempPassword(result.provisional_password);
        accessMsg(`Nova senha de ${user.nome} gerada. Copie e entregue de forma privada.`,true);
        await loadAccounts();
      }catch(error){accessMsg(error.message);}
      finally{reset.disabled=false;}
    });
    actions.append(save,toggle,reset);card.append(actions);
    container.append(card);
  }
}
el('openAccess').addEventListener('click',async()=>{
  if(currentRole!=='admin')return;
  el('membersManager').hidden=true;el('projectsManager').hidden=true;
  el('appearanceManager').hidden=true;el('profileManager').hidden=true;
  el('accessManager').hidden=false;
  await loadAccounts();
  el('accessManager').scrollIntoView({behavior:'smooth',block:'start'});
});
el('closeAccess').addEventListener('click',()=>{
  el('accessManager').hidden=true;hideTempPassword();
  el('dashboardView').scrollIntoView({behavior:'smooth',block:'start'});
});
el('refreshAccess').addEventListener('click',loadAccounts);
el('copyTemporaryPassword').addEventListener('click',async()=>{
  if(!accessPass)return;
  try{await navigator.clipboard.writeText(accessPass);accessMsg('Senha copiada. Entregue somente ao titular da conta.',true);}
  catch{accessMsg('Não foi possível copiar automaticamente. Selecione e copie a senha exibida.');}
});
el('dismissTemporaryPassword').addEventListener('click',hideTempPassword);
el('accessCreateForm').addEventListener('submit',async e=>{
  e.preventDefault();if(currentRole!=='admin')return;
  const name=el('accessNewName').value.trim();const email=el('accessNewEmail').value.trim();
  if(name.length<2||!el('accessNewEmail').checkValidity()){accessMsg('Informe o nome e e-mail válidos.');return;}
  if(!confirm(`Criar uma conta para ${name} (${email})? Confira se o endereço pertence à pessoa correta.`))return;
  const button=el('createAccessButton');button.disabled=true;hideTempPassword();accessMsg('');
  try{
    const result=await callAccess({action:'create',name,email,permissions:userPermsFromForm('new')});
    if(!result?.provisional_password)throw new Error('A conta foi criada, mas a senha não foi retornada. Consulte a lista antes de tentar novamente.');
    showTempPassword(result.provisional_password);
    accessMsg('Conta criada! Entregue a senha provisória diretamente à pessoa. Ela deverá trocá-la no primeiro acesso.',true);
    el('accessCreateForm').reset();
    await loadAccounts();
  }catch(error){accessMsg(error.message);}
  finally{button.disabled=false;}
});

// CAARQ V11 — chat privado (Postgres RLS + Supabase Realtime)
// Nunca coloque uma chave service_role neste arquivo público.
let chatUser = null;
let chatMemberId = null;
let chatIsAdmin = false;
let chatContacts = [];
let chatProfiles = new Map();
let chatPresence = new Map();
let chatPhotoUrls = new Map();
let chatChannel = null;
let chatTicker = null;
let chatHeartbeat = null;
let chatInFlight = false;
let chatLastSignature = '';
let chatActivationSerial = 0;
const chatOnlineNow = id => {
  const info = chatPresence.get(id);
  return !!info?.online && (Date.now() - new Date(info.visto_em).getTime()) < 120000;
};
function chatMessage(text, success=false){notice('chatFeedback',text,success);}
function chatAvatar(container, url, initial='✦') {
  container.replaceChildren();
  if (!url) { container.textContent=initial || '✦'; return; }
  const pic=document.createElement('img'); pic.src=url; pic.alt=''; pic.loading='lazy';
  pic.onerror=()=>{container.replaceChildren(document.createTextNode(initial || '✦'));};
  container.append(pic);
}
function chatTime(value){
  const date=new Date(value);
  return Number.isFinite(date.getTime()) ? date.toLocaleTimeString('pt-BR',{hour:'2-digit',minute:'2-digit'}) : '';
}
function chatName(userId){
  if(userId===chatUser?.id) return 'Você';
  const profile=chatProfiles.get(userId);
  const account=chatContacts.find(x=>x.user_id===userId);
  return profile?.apelido?.trim() || profile?.nome_exibicao?.trim() || account?.nome?.trim() || 'Integrante do CAARQ';
}
function chatHideOtherSections(){
  ['membersManager','projectsManager','appearanceManager','profileManager','accessManager','notificationCenter'].forEach(id=>{if(el(id))el(id).hidden=true;});
}
async function chatSetPresence(online){
  if(!chatUser) return;
  try {
    const {error}=await client.from('caarq_presenca')
      .upsert({user_id:chatUser.id,online:!!online},{onConflict:'user_id'});
    if(error) console.warn('Presença não registrada:',error.message);
  } catch(error) {console.warn('Falha de rede na presença:',error?.message);}
}
async function chatActivate(user){
  if(!user || !currentRole) return;
  if(chatUser?.id===user.id && chatHeartbeat) return;
  const serial=++chatActivationSerial;
  chatUser=user;
  chatIsAdmin=(currentRole==='admin');
  chatMemberId=null;
  el('chatSidebar').hidden=!chatIsAdmin;
  el('chatIntro').textContent=chatIsAdmin
    ? 'Escolha um integrante para conversar. Só a Administração Geral e o titular da conversa têm acesso às mensagens.'
    : 'Este chat é exclusivo entre você e a Administração Geral. Outros integrantes não conseguem ler suas mensagens.';
  el('chatDraft').placeholder=chatIsAdmin?'Escreva sua resposta para o integrante…':'Escreva para a Administração Geral…';
  if(chatHeartbeat)clearInterval(chatHeartbeat);
  if(chatTicker)clearInterval(chatTicker);
  await chatSetPresence(document.visibilityState==='visible');
  if(serial!==chatActivationSerial)return;
  chatHeartbeat=setInterval(()=>{if(chatUser&&document.visibilityState==='visible')void chatSetPresence(true);},30000);
  chatTicker=setInterval(()=>{
    if(el('chatManager').hidden || document.visibilityState!=='visible')return;
    void chatRefreshCurrent(false);
    if(chatIsAdmin)void chatLoadPresence();
  },16000);
  void chatV12Activate();
}
async function chatDeactivate(){
  await chatV12Deactivate();
  ++chatActivationSerial;
  if(chatTicker){clearInterval(chatTicker);chatTicker=null;}
  if(chatHeartbeat){clearInterval(chatHeartbeat);chatHeartbeat=null;}
  if(chatChannel){await client.removeChannel(chatChannel);chatChannel=null;}
  if(chatUser)await chatSetPresence(false);
  chatUser=null;chatMemberId=null;chatContacts=[];
  chatProfiles.clear();chatPresence.clear();chatPhotoUrls.clear();
  chatLastSignature='';
  el('chatManager').hidden=true;
  el('notificationCenter').hidden=true;
}
async function chatLoadContacts(){
  if(!chatUser || !chatIsAdmin)return;
  const container=el('chatContactList');
  try {
    const {data,error}=await client.from('caarq_acessos')
      .select('user_id,nome,trocar_senha').order('nome',{ascending:true});
    if(error)throw error;
    chatContacts=(data||[]).filter(x=>x.user_id!==chatUser.id);
    const ids=chatContacts.map(x=>x.user_id);
    chatProfiles.clear();
    if(ids.length){
      const result=await client.from('caarq_perfis').select('user_id,nome_exibicao,apelido,foto_caminho').in('user_id',ids);
      if(result.error) console.warn('Perfis não disponíveis:',result.error.message);
      for(const p of result.data||[])chatProfiles.set(p.user_id,p);
    }
    chatPhotoUrls.clear();
    for(const p of chatProfiles.values()){
      if(!p.foto_caminho)continue;
      try{
        const {data:link,error:linkError}=await client.storage.from('caarq-perfis')
          .createSignedUrl(p.foto_caminho,600);
        if(!linkError&&link?.signedUrl)chatPhotoUrls.set(p.user_id,link.signedUrl);
      }catch{}
    }
    await chatLoadPresence();
    chatRenderContacts();
  }catch(error){
    container.replaceChildren();const p=document.createElement('p');p.className='chat-empty';
    p.textContent='Não foi possível carregar as contas. Confira o SQL da versão 11.';container.append(p);
    chatMessage(error?.message||'Falha ao carregar contatos.');
  }
}
async function chatLoadPresence(){
  if(!chatIsAdmin || !chatUser)return;
  const ids=chatContacts.map(x=>x.user_id);
  if(!ids.length){chatPresence.clear();return;}
  const {data,error}=await client.from('caarq_presenca').select('user_id,online,visto_em').in('user_id',ids);
  if(!error){chatPresence=new Map((data||[]).map(p=>[p.user_id,p]));chatRenderContacts();chatUpdatePeerHeader();}
}
function chatRenderContacts(){
  if(!chatIsAdmin || !chatUser)return;
  const box=el('chatContactList');box.replaceChildren();
  if(!chatContacts.length){const p=document.createElement('p');p.className='chat-empty';p.textContent='Ainda não há outros membros com login no CAARQ Admin.';box.append(p);return;}
  for(const account of chatContacts){
    const b=document.createElement('button');b.type='button';
    b.className='chat-contact'+(account.user_id===chatMemberId?' selected':'');
    b.setAttribute('aria-pressed',String(account.user_id===chatMemberId));
    const wrap=document.createElement('span');wrap.className='chat-contact-photo';
    chatAvatar(wrap,chatPhotoUrls.get(account.user_id),chatName(account.user_id).slice(0,1).toUpperCase());
    const dot=document.createElement('span');dot.className='chat-presence-dot '+(chatOnlineNow(account.user_id)?'is-online':'is-away');
    dot.title=chatOnlineNow(account.user_id)?'Online agora':'Offline ou ausente';wrap.append(dot);
    const words=document.createElement('span');words.className='chat-contact-name';
    words.append(document.createTextNode(chatName(account.user_id)));
    const status=document.createElement('small');status.textContent=account.trocar_senha?'Aguardando troca de senha':chatOnlineNow(account.user_id)?'Online':'Offline ou ausente';words.append(status);
    b.append(wrap,words);
    const unread=chatV12UnreadCount('direta',account.user_id);
    if(unread)b.append(chatV12Badge(unread));
    b.addEventListener('click',()=>void chatSelectMember(account.user_id));
    box.append(b);
  }
}
function chatUpdatePeerHeader(){
  if(!chatUser)return;
  if(!chatIsAdmin){
    el('chatPeerName').textContent='Administração Geral';
    el('chatPeerPresence').textContent='Conversa privada • CAARQ';
    chatAvatar(el('chatPeerAvatar'),null,'✦');
    el('chatPeerDot').className='chat-presence-dot is-away';
    return;
  }
  if(!chatMemberId){
    el('chatPeerName').textContent='Selecione um integrante';
    el('chatPeerPresence').textContent='Sua caixa de entrada privada';
    chatAvatar(el('chatPeerAvatar'),null,'✦');
    el('chatPeerDot').className='chat-presence-dot is-away';
    return;
  }
  const name=chatName(chatMemberId);
  const online=chatOnlineNow(chatMemberId);
  el('chatPeerName').textContent=name;
  el('chatPeerPresence').textContent=online?'Online agora':'Offline ou ausente';
  chatAvatar(el('chatPeerAvatar'),chatPhotoUrls.get(chatMemberId),name.slice(0,1).toUpperCase());
  el('chatPeerDot').className='chat-presence-dot '+(online?'is-online':'is-away');
}
async function chatSelectMember(id){
  if(!chatUser || (chatIsAdmin && !chatContacts.some(x=>x.user_id===id)))return;
  chatMemberId=id;chatLastSignature='';
  chatRenderContacts();chatUpdatePeerHeader();
  el('chatDraft').disabled=false;el('chatSend').disabled=false;
  await chatSubscribeSelected();
  await chatLoadMessages(true);
}
async function chatSubscribeSelected(){
  if(chatChannel){await client.removeChannel(chatChannel);chatChannel=null;}
  if(!chatMemberId)return;
  const selected=chatMemberId;
  chatChannel=client.channel('caarq-chat-'+selected+'-'+Date.now())
    .on('postgres_changes',{
      event:'INSERT',schema:'public',table:'caarq_chat_mensagens',filter:'membro_id=eq.'+selected
    },()=>{if(selected===chatMemberId&&!el('chatManager').hidden)void chatLoadMessages(false);})
    .subscribe();
}
async function chatLoadMessages(scrollEnd=false){
  if(!chatUser||!chatMemberId || chatInFlight)return;
  const selected=chatMemberId;
  chatInFlight=true;
  const list=el('chatMessageList');
  try{
    const {data,error}=await client.from('caarq_chat_mensagens')
      .select('id,membro_id,remetente_id,conteudo,enviada_em')
      .eq('membro_id',selected).order('enviada_em',{ascending:false}).limit(120);
    if(error)throw error;
    if(selected!==chatMemberId)return;
    const messages=(data||[]).reverse();
    const signature=messages.map(x=>x.id).join('|');
    if(signature===chatLastSignature && !scrollEnd){void chatV12MarkRead('direta',selected);return;}
    const atBottom=list.scrollTop+list.clientHeight >= list.scrollHeight-65;
    chatLastSignature=signature;
    list.replaceChildren();
    if(!messages.length){const empty=document.createElement('p');empty.className='chat-empty';
      empty.textContent='Esta conversa ainda não tem mensagens. Escreva para começar!';list.append(empty);return;}
    for(const message of messages){
      const bubble=document.createElement('div');
      bubble.className='chat-bubble'+(message.remetente_id===chatUser.id?' mine':'');
      const content=document.createElement('div');content.textContent=message.conteudo;
      content.style.whiteSpace='pre-wrap';
      const info=document.createElement('small');
      info.textContent=(message.remetente_id===chatUser.id?'Você':chatIsAdmin?chatName(selected):'Administração Geral')+' · '+chatTime(message.enviada_em);
      bubble.append(content,info);list.append(bubble);
    }
    if(atBottom || scrollEnd || !list.dataset.seen){list.scrollTop=list.scrollHeight;}
    list.dataset.seen='true';
    void chatV12MarkRead('direta',selected);
  }catch(error){chatMessage('Não foi possível carregar as mensagens: '+(error?.message||'falha de rede'));}
  finally{chatInFlight=false;}
}
async function chatRefreshCurrent(scrollEnd=false){
  if(!chatMemberId)return;
  await chatLoadMessages(scrollEnd);
}
async function chatOpenPanel(tab='direta', destinationId=null){
  if(!chatUser)return;
  chatHideOtherSections();el('chatManager').hidden=false;
  chatMessage('');
  el('chatDraft').disabled=chatIsAdmin&&!chatMemberId;
  el('chatSend').disabled=chatIsAdmin&&!chatMemberId;
  if(chatIsAdmin){
    chatMemberId=null;chatLastSignature='';chatUpdatePeerHeader();
    el('chatMessageList').replaceChildren();
    const empty=document.createElement('p');empty.className='chat-empty';empty.textContent='Selecione um integrante na caixa de entrada.';el('chatMessageList').append(empty);
    await chatLoadContacts();
  }else if(tab==='direta') await chatSelectMember(chatUser.id);
  if(tab==='sala'){
    await chatV12OpenGroupTab();
    if(destinationId)await chatV12SelectRoom(destinationId);
  }else{
    chatV12SwitchTab('direta');
    if(chatIsAdmin && destinationId)await chatSelectMember(destinationId);
  }
  el('chatManager').scrollIntoView({behavior:'smooth',block:'start'});
}
el('openChat').addEventListener('click',()=>void chatOpenPanel());

el('closeChat').addEventListener('click',()=>{
  el('chatManager').hidden=true;
  el('dashboardView').scrollIntoView({behavior:'smooth',block:'start'});
});
el('chatReloadContacts').addEventListener('click',()=>void chatLoadContacts());
el('chatReloadMessages').addEventListener('click',()=>void chatRefreshCurrent(true));
el('chatDraft').addEventListener('keydown',event=>{
  if(event.key==='Enter'&&!event.shiftKey&&!event.isComposing){event.preventDefault();el('chatForm').requestSubmit();}
});
el('chatForm').addEventListener('submit',async event=>{
  event.preventDefault();
  const content=el('chatDraft').value.trim();
  const selected=chatMemberId;
  if(!chatUser||!selected||!content || content.length>2000){chatMessage('Escolha uma conversa e escreva até 2.000 caracteres.');return;}
  const button=el('chatSend');button.disabled=true;chatMessage('');
  try{
    // Criar conversa, se ainda não existir. Nunca permitir outro participante no chat do membro.
    const {data:existing,error:readError}=await client.from('caarq_chat_conversas')
      .select('membro_id').eq('membro_id',selected).maybeSingle();
    if(readError)throw readError;
    if(!existing){
      const created=await client.from('caarq_chat_conversas').insert({membro_id:selected});
      if(created.error && created.error.code!=='23505')throw created.error;
    }
    const {error}=await client.from('caarq_chat_mensagens')
      .insert({membro_id:selected,remetente_id:chatUser.id,conteudo:content});
    if(error)throw error;
    el('chatDraft').value='';
    await chatLoadMessages(true);
  }catch(error){chatMessage('Não foi possível enviar: '+(error?.message||'confira sua conexão e a configuração do chat.'));}
  finally{button.disabled=false;}
});
document.addEventListener('visibilitychange',()=>{
  if(!chatUser)return;
  void chatSetPresence(document.visibilityState==='visible');
  if(document.visibilityState==='visible'&&!el('chatManager').hidden){
    void chatRefreshCurrent();if(chatIsAdmin)void chatLoadPresence();
  }
});
// Ao entrar em outro editor, fechar apenas a visualização do chat, sem apagar a conversa.
for(const id of ['openProfile','openMembers','openProjects','openAppearance','openAccess','openNotifications','openNotificationsTop']){
  el(id)?.addEventListener('click',()=>{el('chatManager').hidden=true;},{capture:true});
}


// Atualização V13: trocar para outra ferramenta fecha somente a Central de Notificações.
for(const id of ['openProfile','openMembers','openProjects','openAppearance','openAccess']){
  el(id)?.addEventListener('click',()=>{el('notificationCenter').hidden=true;},{capture:true});
}

// CAARQ V12.1 — permissão individual para criação de grupos
// CAARQ V12 — salas privadas, chat geral, grupos e notificações de mensagens não lidas.
// As permissões reais são verificadas pelo Postgres/RLS e funções SECURITY DEFINER.
let chatV12Rooms=[];
let chatV12SelectedRoom=null;
let chatV12Unread=new Map();
let chatV12RoomNames=new Map();
let chatV12LastRoomSignature='';
let chatV12RoomLoading=false;
let chatV12UnreadLoading=false;
let chatV12UnreadTimer=null;
let chatV12NotificationChannel=null;
let chatV12ReadTimes=new Map();
let chatV12ContactsLoaded=false;
let chatV13Candidates=[];
const chatCanCreateGroups=()=>chatIsAdmin||currentPermissions.pode_criar_grupos===true;
const chatCanManageGroup=room=>room?.tipo==='grupo' && (chatIsAdmin ||
  (chatCanCreateGroups() && room.criada_por===chatUser?.id));
const chatV12Key=(type,id)=>type+':'+id;
const chatV12UnreadCount=(type,id)=>chatV12Unread.get(chatV12Key(type,id))||0;
function chatV12Badge(count){
  const node=document.createElement('span');
  node.className='chat-badge contact-unread';node.textContent=count>99?'99+':String(count);
  node.setAttribute('aria-label',count+' mensagens não lidas');
  return node;
}
function chatV12UpdateBadge(){
  const count=[...chatV12Unread.values()].reduce((a,b)=>a+b,0);
  const badge=el('chatUnreadBadge');
  badge.hidden=!count;
  badge.textContent=count>99?'99+':String(count);
  el('chatTile').setAttribute('aria-label', count?count+' mensagens não lidas':'Mensagens');
  notificationUpdateTotal(count);
  if(!el('notificationCenter').hidden) notificationRender();
  if(chatIsAdmin)chatRenderContacts();
  chatV12RenderRooms();
}
async function chatV12LoadUnread(){
  if(!chatUser||chatV12UnreadLoading)return;
  chatV12UnreadLoading=true;
  try{
    const {data,error}=await client.rpc('caarq_chat_nao_lidas');
    if(error)throw error;
    chatV12Unread=new Map((data||[]).map(x=>[chatV12Key(x.tipo==='direta'?'direta':'sala',x.destino_id),Math.max(0,Number(x.quantidade)||0)]));
    chatV12UpdateBadge();
  }catch(err){console.warn('Não foi possível carregar notificações:',err.message);}
  finally{chatV12UnreadLoading=false;}
}
async function chatV12MarkRead(type,id){
  if(!chatUser||!id||document.visibilityState!=='visible'||el('chatManager').hidden)return;
  const onScreen=(type==='direta'&&!el('chatPrivateView').hidden)||(type==='sala'&&!el('chatGroupView').hidden);
  if(!onScreen)return;
  const key=chatV12Key(type,id),last=chatV12ReadTimes.get(key)||0;
  if(Date.now()-last<7500)return;
  chatV12ReadTimes.set(key,Date.now());
  try{
    const {error}=await client.from('caarq_chat_leituras').upsert({
      tipo:type,destino_id:id,user_id:chatUser.id,lida_ate:new Date().toISOString()
    },{onConflict:'tipo,destino_id,user_id'});
    if(error)throw error;
    if(chatV12Unread.has(key)){
      chatV12Unread.delete(key);chatV12UpdateBadge();
    }
  }catch(err){console.warn('Não foi possível marcar conversa como lida:',err.message);}
}
function chatV12SwitchTab(tab){
  const isRoom=tab==='sala';
  el('chatPrivateView').hidden=isRoom;
  el('chatGroupView').hidden=!isRoom;
  el('chatPrivateTab').classList.toggle('selected',!isRoom);
  el('chatGroupTab').classList.toggle('selected',isRoom);
  el('chatPrivateTab').setAttribute('aria-selected',String(!isRoom));
  el('chatGroupTab').setAttribute('aria-selected',String(isRoom));
  if(isRoom){
    void chatV12LoadRooms().then(()=>{
      if(chatV12SelectedRoom)void chatV12LoadRoomMessages(true);
    });
  }else if(chatMemberId){void chatLoadMessages(true);}
  void chatV12LoadUnread();
}
function chatV12Checkboxes(containerId,selected=[]){
  const holder=el(containerId);holder.replaceChildren();
  const candidates=chatIsAdmin?chatContacts:chatV13Candidates;
  if(!candidates.length){
    const p=document.createElement('p');p.className='chat-empty';
    p.textContent='Nenhum integrante disponível.';holder.append(p);return;
  }
  for(const member of candidates){
    if(member.trocar_senha)continue;
    const label=document.createElement('label');
    const input=document.createElement('input');input.type='checkbox';input.value=member.user_id;
    input.checked=selected.includes(member.user_id);
    const span=document.createElement('span');span.textContent=chatIsAdmin?chatName(member.user_id):member.nome||'Integrante';
    label.append(input,span);holder.append(label);
  }
}
function chatV12SelectedCheckboxes(holderId){
  return [...el(holderId).querySelectorAll('input[type=checkbox]:checked')].map(i=>i.value);
}
async function chatV12LoadRooms(){
  if(!chatUser)return;
  const {data,error}=await client.from('caarq_chat_salas').select('id,tipo,nome,criada_por,criada_em')
   .order('tipo',{ascending:true}).order('criada_em',{ascending:true});
  if(error){chatMessage('Não foi possível carregar as salas: '+error.message);return;}
  chatV12Rooms=(data||[]).sort((a,b)=>a.tipo==='geral'?-1:b.tipo==='geral'?1:a.nome.localeCompare(b.nome,'pt-BR'));
  if(chatV12SelectedRoom&&!chatV12Rooms.some(x=>x.id===chatV12SelectedRoom.id)){
    chatV12SelectedRoom=null;
    chatV12RoomHeader();
    el('chatRoomMessages').replaceChildren();
    const p=document.createElement('p');p.className='chat-empty';p.textContent='Você não participa mais desta sala.';
    el('chatRoomMessages').append(p);
  }
  chatV12RenderRooms();
}
function chatV12RenderRooms(){
  const list=el('chatRoomList');list.replaceChildren();
  if(!chatV12Rooms.length){
    const p=document.createElement('p');p.className='chat-empty';p.textContent='Nenhuma sala disponível.';list.append(p);return;
  }
  for(const room of chatV12Rooms){
    const button=document.createElement('button');button.type='button';
    button.className='chat-contact'+(chatV12SelectedRoom?.id===room.id?' selected':'');
    button.setAttribute('aria-pressed',String(chatV12SelectedRoom?.id===room.id));
    const avatar=document.createElement('span');avatar.className='chat-contact-photo';
    avatar.textContent=room.tipo==='geral'?'📣':'👥';
    const words=document.createElement('span');words.className='chat-contact-name';
    words.append(document.createTextNode(room.nome));
    const small=document.createElement('small');small.textContent=room.tipo==='geral'?'Todos os membros autorizados':'Grupo de integrantes';words.append(small);
    button.append(avatar,words);
    const count=chatV12UnreadCount('sala',room.id);
    if(count)button.append(chatV12Badge(count));
    button.addEventListener('click',()=>void chatV12SelectRoom(room.id));
    list.append(button);
  }
}
function chatV12RoomHeader(){
  const room=chatV12SelectedRoom;
  el('chatRoomName').textContent=room?.nome||'Escolha uma sala';
  el('chatRoomAvatar').textContent=room?.tipo==='geral'?'📣':room?'👥':'✳';
  el('chatRoomDescription').textContent=room?.tipo==='geral'
    ?'Visível a todos os integrantes com acesso ativo'
    :room?'Somente participantes convidados e Administração Geral':'Escolha uma conversa';
  el('chatRoomDraft').disabled=!room;el('chatRoomSend').disabled=!room;
  el('chatManageGroup').hidden=!chatCanManageGroup(room);
  el('chatMentionAll').hidden=!chatIsAdmin||room?.tipo!=='geral';
  el('chatGroupManagePanel').hidden=true;
}
async function chatV12SelectRoom(id){
  const room=chatV12Rooms.find(x=>x.id===id);
  if(!room)return;
  chatV12SelectedRoom=room;chatV12LastRoomSignature='';
  chatV12RoomHeader();chatV12RenderRooms();
  await chatV12LoadRoomPeople(room.id);
  await chatV12LoadRoomMessages(true);
}
async function chatV12LoadRoomPeople(roomId){
  chatV12RoomNames.clear();
  const {data,error}=await client.rpc('caarq_chat_integrantes_da_sala',{p_sala_id:roomId});
  if(!error){for(const p of data||[])chatV12RoomNames.set(p.user_id,p.nome);}
}
async function chatV12LoadRoomMessages(scrollEnd=false){
  if(!chatUser||!chatV12SelectedRoom||chatV12RoomLoading)return;
  const roomId=chatV12SelectedRoom.id;
  chatV12RoomLoading=true;
  const list=el('chatRoomMessages');
  try{
    const {data,error}=await client.from('caarq_chat_sala_mensagens')
      .select('id,sala_id,remetente_id,conteudo,enviada_em')
      .eq('sala_id',roomId).order('enviada_em',{ascending:false}).limit(150);
    if(error)throw error;
    if(chatV12SelectedRoom?.id!==roomId)return;
    const messages=(data||[]).reverse();
    const signature=messages.map(x=>x.id).join('|');
    if(signature===chatV12LastRoomSignature&&!scrollEnd){
      void chatV12MarkRead('sala',roomId);return;
    }
    const nearBottom=list.scrollTop+list.clientHeight>=list.scrollHeight-75;
    chatV12LastRoomSignature=signature;
    list.replaceChildren();
    if(!messages.length){
      const p=document.createElement('p');p.className='chat-empty';p.textContent='Ainda não há mensagens. Comece a conversa!';list.append(p);
    }
    for(const msg of messages){
      const bubble=document.createElement('div');
      const mine=msg.remetente_id===chatUser.id;
      const mention=/(^|\W)@todos(\W|$)/i.test(msg.conteudo);
      bubble.className='chat-bubble'+(mine?' mine':'')+(mention?' chat-room-bubble-mention':'');
      const text=document.createElement('div');text.textContent=msg.conteudo;text.style.whiteSpace='pre-wrap';
      const meta=document.createElement('small');
      meta.textContent=(mine?'Você':chatV12RoomNames.get(msg.remetente_id)||'Integrante')+' · '+chatTime(msg.enviada_em);
      bubble.append(text,meta);list.append(bubble);
    }
    if(nearBottom||scrollEnd||!list.dataset.seen)list.scrollTop=list.scrollHeight;
    list.dataset.seen='true';
    void chatV12MarkRead('sala',roomId);
  }catch(err){chatMessage('Não foi possível carregar mensagens do grupo: '+err.message);}
  finally{chatV12RoomLoading=false;}
}
async function chatV12Activate(){
  if(!chatUser)return;
  chatV12SelectedRoom=null;chatV12Rooms=[];chatV12Unread.clear();
  el('chatGroupCreate').hidden=!chatCanCreateGroups();
  el('chatUnreadBadge').hidden=true;
  if(chatV12UnreadTimer)clearInterval(chatV12UnreadTimer);
  chatV12UnreadTimer=setInterval(()=>{
    if(chatUser&&document.visibilityState==='visible'){
      void chatV12LoadUnread();
      if(!el('chatGroupView').hidden&&!el('chatManager').hidden&&chatV12SelectedRoom){
        void chatV12LoadRoomMessages();
      }
    }
  },12000);
  if(chatV12NotificationChannel){await client.removeChannel(chatV12NotificationChannel);chatV12NotificationChannel=null;}
  chatV12NotificationChannel=client.channel('caarq-v12-notify-'+chatUser.id+'-'+Date.now())
    .on('postgres_changes',{event:'INSERT',schema:'public',table:'caarq_chat_mensagens'},()=>{
      void chatV12LoadUnread();
      if(!el('chatManager').hidden&&!el('chatPrivateView').hidden&&chatMemberId)void chatLoadMessages();
    })
    .on('postgres_changes',{event:'INSERT',schema:'public',table:'caarq_chat_sala_mensagens'},()=>{
      void chatV12LoadUnread();
      if(!el('chatManager').hidden&&!el('chatGroupView').hidden&&chatV12SelectedRoom)void chatV12LoadRoomMessages();
    }).subscribe();
  await chatV12LoadUnread();
}
async function chatV12Deactivate(){
  if(chatV12UnreadTimer){clearInterval(chatV12UnreadTimer);chatV12UnreadTimer=null;}
  if(chatV12NotificationChannel){await client.removeChannel(chatV12NotificationChannel);chatV12NotificationChannel=null;}
  chatV12Unread.clear();chatV12Rooms=[];chatV12SelectedRoom=null;chatV12ReadTimes.clear();chatV13Candidates=[];
  el('chatUnreadBadge').hidden=true;
}
async function chatV12OpenGroupTab(){
  if(!chatUser)return;
  if(chatCanCreateGroups()){
    if(chatIsAdmin){
      if(!chatContacts.length)await chatLoadContacts();
    }else{
      const {data,error}=await client.rpc('caarq_chat_candidatos_grupo');
      if(error){chatMessage('Não foi possível carregar integrantes: '+error.message);return;}
      chatV13Candidates=(data||[]).filter(x=>x.user_id!==chatUser.id);
    }
    chatV12Checkboxes('chatNewGroupMembers');
  }
  chatV12SwitchTab('sala');
}
el('chatPrivateTab').addEventListener('click',()=>chatV12SwitchTab('direta'));
el('chatGroupTab').addEventListener('click',()=>void chatV12OpenGroupTab());
el('chatReloadRooms').addEventListener('click',()=>void chatV12LoadRooms());
el('chatReloadRoomMessages').addEventListener('click',()=>void chatV12LoadRoomMessages(true));
el('chatMentionAll').addEventListener('click',()=>{
  if(!chatIsAdmin||chatV12SelectedRoom?.tipo!=='geral')return;
  const input=el('chatRoomDraft');
  input.value=(input.value.trim()?input.value.trim()+' ':'')+'@todos ';
  input.focus();
});
el('chatRoomDraft').addEventListener('keydown',event=>{
  if(event.key==='Enter'&&!event.shiftKey&&!event.isComposing){event.preventDefault();el('chatRoomForm').requestSubmit();}
});
el('chatRoomForm').addEventListener('submit',async event=>{
  event.preventDefault();const room=chatV12SelectedRoom;const content=el('chatRoomDraft').value.trim();
  if(!chatUser||!room||!content||content.length>2000)return;
  const button=el('chatRoomSend');button.disabled=true;chatMessage('');
  try{
    const {error}=await client.from('caarq_chat_sala_mensagens').insert({sala_id:room.id,remetente_id:chatUser.id,conteudo:content});
    if(error)throw error;
    el('chatRoomDraft').value='';
    await chatV12LoadRoomMessages(true);
    await chatV12LoadUnread();
  }catch(err){chatMessage('Não foi possível enviar para a sala: '+(err.message||'erro de conexão'));}
  finally{button.disabled=false;}
});
el('chatCreateGroupForm').addEventListener('submit',async event=>{
  event.preventDefault();if(!chatCanCreateGroups()||!chatUser)return;
  const name=el('chatNewGroupName').value.trim();const people=chatV12SelectedCheckboxes('chatNewGroupMembers');
  if(name.length<3||people.length<1){chatMessage('Informe o nome e selecione ao menos um integrante.');return;}
  const button=el('chatCreateGroupButton');button.disabled=true;chatMessage('');
  try{
    const {data,error}=await client.rpc('caarq_chat_criar_grupo',{p_nome:name,p_membros:people});
    if(error)throw error;
    el('chatNewGroupName').value='';
    chatV12Checkboxes('chatNewGroupMembers');
    await chatV12LoadRooms();
    await chatV12SelectRoom(data);
    chatMessage('Grupo criado com sucesso. Somente integrantes convidados podem participar.',true);
  }catch(err){chatMessage('Não foi possível criar o grupo: '+err.message);}
  finally{button.disabled=false;}
});
el('chatManageGroup').addEventListener('click',async()=>{
  if(!chatCanManageGroup(chatV12SelectedRoom))return;
  chatMessage('');
  const {data,error}=await client.from('caarq_chat_participantes').select('user_id').eq('sala_id',chatV12SelectedRoom.id);
  if(error){chatMessage('Falha ao consultar participantes: '+error.message);return;}
  chatV12Checkboxes('chatGroupMemberChoices',(data||[]).map(p=>p.user_id));
  el('chatGroupManagePanel').hidden=false;
});
el('chatCancelGroupMembers').addEventListener('click',()=>{el('chatGroupManagePanel').hidden=true;});
el('chatSaveGroupMembers').addEventListener('click',async()=>{
  if(!chatCanManageGroup(chatV12SelectedRoom))return;
  const id=chatV12SelectedRoom.id,ids=chatV12SelectedCheckboxes('chatGroupMemberChoices');
  if(!ids.length){chatMessage('O grupo precisa ter ao menos um integrante.');return;}
  const button=el('chatSaveGroupMembers');button.disabled=true;
  try{
    const {error}=await client.rpc('caarq_chat_definir_participantes',{p_sala_id:id,p_membros:ids});
    if(error)throw error;
    el('chatGroupManagePanel').hidden=true;
    chatMessage('Participantes atualizados com sucesso.',true);
    await chatV12LoadRoomPeople(id);
  }catch(err){chatMessage('Não foi possível atualizar participantes: '+err.message);}
  finally{button.disabled=false;}
});
document.addEventListener('visibilitychange',()=>{
  if(chatUser&&document.visibilityState==='visible')void chatV12LoadUnread();
});


// CAARQ V13 — central única para notificações de mensagens do próprio login.
// Consulta SOMENTE as contagens já autorizadas pelo RPC caarq_chat_nao_lidas,
// sem guardar mensagens em localStorage e sem criar permissões novas.
let notificationFilter='todas';
function notificationUpdateTotal(count){
  for(const id of ['notificationTopBadge','notificationTileBadge']){
    const badge=el(id); if(!badge)continue;
    badge.hidden=count===0;badge.textContent=count>99?'99+':String(count);
  }
  const bell=el('openNotificationsTop');
  if(bell)bell.setAttribute('aria-label',count?`Notificações: ${count} mensagens não lidas`:'Abrir Central de Notificações');
  const status=el('notificationTotalText');
  if(status)status.textContent=count===0?'Nenhuma mensagem pendente':`${count} mensagem${count===1?'':'ns'} não lida${count===1?'':'s'}`;
}
function notificationRender(){
  const list=el('notificationList');if(!list)return;
  list.replaceChildren();
  const notifications=[];
  for(const [key,count] of chatV12Unread){
    if(count<=0)continue;
    const boundary=key.indexOf(':');if(boundary<1)continue;
    const type=key.slice(0,boundary),id=key.slice(boundary+1);
    if(type!=='direta'&&type!=='sala')continue;
    if(notificationFilter!=='todas'&&type!==notificationFilter)continue;
    const room=type==='sala'?chatV12Rooms.find(r=>r.id===id):null;
    const name=type==='direta'
      ?(chatIsAdmin?chatName(id):'Administração Geral')
      :(room?.nome||'Chat geral ou grupo');
    notifications.push({id,type,count,name,roomType:room?.tipo||null});
  }
  notifications.sort((a,b)=>b.count-a.count||a.name.localeCompare(b.name,'pt-BR'));
  if(!notifications.length){
    const empty=document.createElement('div');empty.className='notification-empty';
    const ico=document.createElement('span');ico.className='notification-empty-icon';ico.textContent='✓';
    const title=document.createElement('strong');title.textContent=notificationFilter==='todas'?'Tudo em dia!':'Nenhuma mensagem nesta categoria';
    const detail=document.createElement('p');detail.textContent='Quando chegarem mensagens novas, você verá um aviso aqui.';
    empty.append(ico,title,detail);list.append(empty);return;
  }
  for(const n of notifications){
    const b=document.createElement('button');b.type='button';b.className='notification-entry';
    const icon=document.createElement('span');icon.className='notification-entry-icon';
    icon.textContent=n.type==='direta'?'✉':n.roomType==='geral'?'📣':'👥';
    const info=document.createElement('span');info.className='notification-entry-info';
    const title=document.createElement('strong');title.textContent=n.name;
    const detail=document.createElement('small');detail.textContent=(n.type==='direta'?'Conversa privada':n.roomType==='geral'?'Chat geral':'Conversa em grupo')+' · Clique para ler';
    info.append(title,detail);
    const qty=document.createElement('span');qty.className='notification-entry-count';qty.textContent=n.count>99?'99+':String(n.count);
    b.append(icon,info,qty);
    b.addEventListener('click',()=>void chatOpenPanel(n.type==='sala'?'sala':'direta',n.id));
    list.append(b);
  }
}
async function notificationOpen(){
  if(!chatUser)return;
  chatHideOtherSections();el('chatManager').hidden=true;
  el('notificationCenter').hidden=false;
  el('notificationCenter').scrollIntoView({behavior:'smooth',block:'start'});
  el('notificationTotalText').textContent='Atualizando notificações…';
  await Promise.all([
    chatV12LoadRooms(),
    chatIsAdmin && !chatContacts.length ? chatLoadContacts() : Promise.resolve()
  ]);
  // Um RPC já autorizado calcula as mensagens não lidas para esta conta.
  await chatV12LoadUnread();
  notificationUpdateTotal([...chatV12Unread.values()].reduce((sum,value)=>sum+value,0));
  notificationRender();
}
for(const id of ['openNotifications','openNotificationsTop']){
  el(id).addEventListener('click',()=>void notificationOpen());
}
el('closeNotifications').addEventListener('click',()=>{
  el('notificationCenter').hidden=true;
  el('dashboardView').scrollIntoView({behavior:'smooth',block:'start'});
});
el('refreshNotifications').addEventListener('click',()=>void notificationOpen());
for(const button of document.querySelectorAll('[data-notification-filter]')){
  button.addEventListener('click',()=>{
    notificationFilter=button.dataset.notificationFilter;
    for(const elFilter of document.querySelectorAll('[data-notification-filter]')){
      const active=elFilter.dataset.notificationFilter===notificationFilter;
      elFilter.classList.toggle('selected',active);
      elFilter.setAttribute('aria-pressed',String(active));
    }
    notificationRender();
  });
}

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

