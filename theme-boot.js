/* CAARQ V20 — tema antes da primeira exibição, sem piscar o layout antigo.
   Público e somente leitura. Não contém credenciais secretas. */
(function () {
  'use strict';
  const script = document.currentScript;
  const page = script?.dataset.caarqPage || 'home';
  const root = document.documentElement;
  const prefix = 'caarq:v20:';
  const urlBase = 'https://aeipjioeqfcuqbacbcym.supabase.co/rest/v1/';
  // Esta é a chave PUBLICÁVEL que o site já utiliza (nunca a service_role).
  const apiKey = 'sb_publishable_isTW4KzTw4bA7m82awH0BA_oG98M7qt';
  const hex = c => /^#[0-9a-fA-F]{6}$/.test(c || '');
  const safeHttps = value => {
    try { const u = new URL(value); return u.protocol === 'https:' ? u.href : null; }
    catch { return null; }
  };
  const pick = (obj, key, fallback) => hex(obj?.[key]) ? obj[key] : fallback;
  const shade = (color, factor) => '#' + [1,3,5].map(i => Math.min(255,Math.max(0,Math.round(parseInt(color.slice(i,i+2),16)*factor))).toString(16).padStart(2,'0')).join('');
  function fromCache(name) {
    try { const value = JSON.parse(localStorage.getItem(prefix + name) || 'null'); return value && typeof value === 'object' ? value : null; }
    catch { return null; }
  }
  function toCache(name, value) {
    try { if (value && typeof value === 'object') localStorage.setItem(prefix + name, JSON.stringify(value)); }
    catch { /* Alguns navegadores bloqueiam armazenamento local; a página continua funcionando. */ }
  }
  function readyDOM() {
    return new Promise(resolve => {
      if (document.readyState !== 'loading') return resolve();
      const update = () => {
        if (document.readyState === 'loading') return;
        document.removeEventListener('readystatechange', update);
        resolve();
      };
      document.addEventListener('readystatechange', update);
    });
  }

  const overlay = document.createElement('style');
  overlay.id = 'caarq-v20-initial-paint';
  overlay.textContent = `html.caarq-theme-loading body{visibility:hidden!important}
    html.caarq-theme-loading::after{content:'✳  Preparando o CAARQ…';position:fixed;inset:0;display:grid;place-items:center;z-index:2147483647;background:#40194f;color:#fff;font:700 16px Montserrat,Arial,sans-serif;letter-spacing:.02em}
    @media(prefers-reduced-motion:reduce){html.caarq-theme-loading::after{animation:none}}`;
  document.head.append(overlay);
  root.classList.add('caarq-theme-loading');
  const old = {appearance:fromCache('appearance'),blog:fromCache('blog'),loca:fromCache('loca')};
  const needsBlog = page === 'news';
  const needsLoca = page === 'loca';
  let revealed = false;
  function reveal() {
    if (revealed) return;
    revealed = true;
    root.classList.remove('caarq-theme-loading');
  }

  function applyAppearance(data) {
    if (!data) return;
    const primary = pick(data, 'primary_color', '#40194f');
    const accent = pick(data, 'accent_color', '#ffd02f');
    const background = pick(data, 'background_color', '#fffdf9');
    const surface = pick(data, 'surface_color', '#ffffff');
    const ink = pick(data, 'text_color', '#281d2e');
    const font = ['Montserrat','Arial','Georgia','Verdana','Trebuchet MS'].includes(data.font_family) ? data.font_family : 'Montserrat';
    const radius = [0,8,16,24].includes(Number(data.corner_radius)) ? Number(data.corner_radius) : 8;
    const css = root.style;
    css.setProperty('--purple',primary);
    css.setProperty('--purple-dark',shade(primary,.68));
    css.setProperty('--purple-deep',shade(primary,.66));
    css.setProperty('--purple-mid',shade(primary,1.25));
    css.setProperty('--violet',shade(primary,1.25));
    css.setProperty('--yellow',accent);
    css.setProperty('--accent',accent);
    css.setProperty('--paper',background);
    css.setProperty('--cream',background);
    css.setProperty('--site-surface',surface);
    css.setProperty('--surface',surface);
    css.setProperty('--ink',ink);
    css.setProperty('--plum',ink);
    css.setProperty('--site-ink',ink);
    css.setProperty('--site-text',ink);
    css.setProperty('--font',`"${font}",Arial,sans-serif`);
    css.setProperty('--radius',radius+'px');
    css.setProperty('--site-radius',radius+'px');
    if (page === 'admin') css.setProperty('--purple2',shade(primary,1.13));
    if (document.body && page !== 'loca') document.body.style.fontFamily=`"${font}",Arial,sans-serif`;

    let extra=document.getElementById('caarq-v20-appearance');
    if (!extra) { extra=document.createElement('style');extra.id='caarq-v20-appearance';document.head.append(extra); }
    if (page === 'home') extra.textContent='body{color:var(--site-ink,var(--ink))!important;background:var(--paper)!important}.portal-card,.about-card,.document-card,.feature-card,.info-card,.person-card,.history-card,.project-card,.event-card{background:var(--site-surface)!important;border-radius:var(--site-radius)!important}.portal-card p,.portal-card small,.person-bio{color:var(--site-ink)!important}';
    else if (page === 'members') extra.textContent='.current-section,.history-section{background:var(--paper)!important}.person-card,.history-card,.og-group-header{background:var(--site-surface)!important;border-radius:var(--site-radius)!important}.person-info h3,.og-group-header h3{color:var(--purple)!important}.person-bio{color:var(--site-text)!important}';

    if (page === 'home') {
      const fields={homeKicker:'hero_kicker',homeTitleFirst:'hero_first',homeTitleAccent:'hero_highlight',homeTitleLast:'hero_last',homeDescription:'hero_description'};
      for (const [id,key] of Object.entries(fields)) {
        const e=document.getElementById(id);
        if (e && typeof data[key]==='string' && data[key].trim()) e.textContent=data[key];
      }
      const banner=safeHttps(data.banner_url);
      const hero=document.querySelector('.hero');
      let image=document.getElementById('homeBannerImage');
      if (banner && hero) {
        if (!image) { image=document.createElement('img');image.id='homeBannerImage';image.className='hero-custom-photo';image.alt='';image.decoding='async';hero.prepend(image); }
        if (image.getAttribute('src')!==banner)image.src=banner;
      } else if (image) image.remove();
    }
    const logo=safeHttps(data.logo_url);
    if (logo && page !== 'loca') {
      const selectors=page==='home'?'.brand img,.doc-logo':page==='admin'?'.admin-real-logo':'.brand img,.hero-logo img,.hero-symbol>img,.end-layout img';
      for (const image of document.querySelectorAll(selectors)) {
        if (image.getAttribute('src')===logo)continue;
        const defaultUrl=page==='home'?'logo-caarq.png':'../logo-caarq.png';
        image.onerror=()=>{image.onerror=null;image.src=defaultUrl;};
        image.src=logo;
      }
    }
  }
  function applyBlog(data) {
    if (!data || page!=='news') return;
    const fields={blogHeroKicker:'kicker',blogHeroStart:'titulo',blogHeroHighlight:'destaque',blogHeroDescription:'descricao'};
    for (const [id,key] of Object.entries(fields)) {
      const target=document.getElementById(id);
      if (target && typeof data[key]==='string' && data[key].trim()) target.textContent=data[key].trim();
    }
    const image=document.getElementById('blogHeroImage');
    const url=safeHttps(data.fundo_url);
    if(image){if(url){image.src=url;image.hidden=false;}else{image.hidden=true;image.removeAttribute('src');}}
  }
  function applyLoca(data) {
    if (!data || page!=='loca') return;
    const title=document.getElementById('shopTitle');
    const desc=document.getElementById('shopDescription');
    if (title && data.titulo) title.textContent=data.titulo;
    if (desc && data.subtitulo) desc.textContent=data.subtitulo;
    const banner=document.getElementById('heroBanner');
    const url=safeHttps(data.banner_url);
    if (banner && url) banner.src=url;
  }
  function applyAll(a,b,l) {
    applyAppearance(a);
    applyBlog(b);
    applyLoca(l);
  }

  const abort=new AbortController();
  const abortTimeout=setTimeout(()=>abort.abort(),4600);
  async function query(path) {
    try {
      const response=await fetch(urlBase+path,{
        headers:{apikey:apiKey,Accept:'application/json'},signal:abort.signal,cache:'no-store'
      });
      if (!response.ok) return null;
      const arr=await response.json();
      return Array.isArray(arr)?(arr[0] || null):null;
    } catch { return null; }
  }
  const appearancePromise=query('caarq_aparencia?select=*&id=eq.1').then(data=>{
    if (data) toCache('appearance',data);
    return data || old.appearance;
  });
  const blogPromise=needsBlog?query('caarq_noticias_config?select=*&id=eq.1').then(data=>{
    if(data)toCache('blog',data);
    return data || old.blog;
  }):Promise.resolve(null);
  const locaPromise=needsLoca?query('caarq_loca_config?select=titulo,subtitulo,banner_url&id=eq.1').then(data=>{
    if(data)toCache('loca',data);
    return data || old.loca;
  }):Promise.resolve(null);
  const network=Promise.all([appearancePromise,blogPromise,locaPromise]);
  // A consulta é iniciada imediatamente no HEAD; o conteúdo só aparece depois da aplicação.
  // Sempre confirmar a versão atual no Supabase: um cache antigo nunca é mostrado.
  Promise.all([readyDOM(),network]).then(([,values])=>{
    applyAll(...values);
    reveal();
  }).catch(reveal);
  network.finally(()=>clearTimeout(abortTimeout));
  // Em qualquer falha extrema, nunca deixar a página invisível.
  setTimeout(reveal,5400);
})();
