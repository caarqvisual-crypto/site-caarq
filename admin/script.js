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
const show = name => screens.forEach(id => { el(id).hidden = id !== name; });
function notice(id, message, success = false) {
  const box = el(id);
  box.textContent = message;
  box.classList.toggle('success', success);
  box.hidden = !message;
}
const roleNames = { admin: 'Administração geral', editor: 'Editoria', loja: 'Gestão da LOCA' };
let latestSession = null;
let isSettingPassword = false;

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
  el('roleTag').textContent = roleNames[membership.role];
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

try {
  const inviteInUrl = location.hash.includes('type=invite') || location.search.includes('type=invite') || location.hash.includes('type=recovery') || location.search.includes('type=recovery');
  const { data: { session } } = await client.auth.getSession();
  if (session && inviteInUrl) { isSettingPassword = true; show('passwordView'); }
  else await checkAccess();
} catch (err) {
  show('loginView');
  notice('loginMessage', 'Não foi possível iniciar a conexão com o Supabase. Verifique sua internet ou tente novamente mais tarde.');
}
