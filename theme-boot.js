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
  // Contraste calculado sobre a cor REAL de cada fundo; evita texto branco sobre cartões claros.
  const luminance = color => {
    const rgb = [1,3,5].map(i=>parseInt(color.slice(i,i+2),16)/255)
      .map(v=>v<=.04045?v/12.92:Math.pow((v+.055)/1.055,2.4));
    return rgb[0]*.2126 + rgb[1]*.7152 + rgb[2]*.0722;
  };
  const ratio = (a,b) => {
    const x=luminance(a), y=luminance(b);
    return (Math.max(x,y)+.05)/(Math.min(x,y)+.05);
  };
  const legible = (bg,choice,min=4.5) => {
    if (ratio(bg,choice)>=min) return choice;
    return ratio(bg,'#ffffff')>=ratio(bg,'#24172b') ? '#ffffff' : '#24172b';
  };

  // O favicon SEMPRE representa a identidade oficial, não a logo temática do Admin.
  function setOfficialFavicon() {
    const original = new URL(page==='home'?'logo-caarq.png':'../logo-caarq.png',document.baseURI);
    original.searchParams.set('favicon','213');
    const icons = [...document.querySelectorAll('link[rel~="icon"]')];
    let link=icons[0];
    if(!link){link=document.createElement('link');document.head.append(link);}
    link.rel='icon';link.type='image/png';link.href=original.href;
    for (const duplicate of icons.slice(1)) duplicate.remove();
  }
  setOfficialFavicon();

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
    const onPage = legible(background,ink);
    const onSurface = legible(surface,ink);
    const onPrimary = legible(primary,'#ffffff');
    const titleOnPage = ratio(primary,background)>=4.5 ? primary : onPage;
    const accentOnPage = ratio(accent,background)>=3 ? accent : titleOnPage;
    // Com a paleta clássica, preservar o aspecto original das seções.
    const customizedColors = primary.toLowerCase()!=='#40194f'
      || accent.toLowerCase()!=='#ffd02f'
      || background.toLowerCase()!=='#fffdf9'
      || surface.toLowerCase()!=='#ffffff'
      || ink.toLowerCase()!=='#281d2e';

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
    css.setProperty('--theme-on-page',onPage);
    css.setProperty('--theme-on-surface',onSurface);
    css.setProperty('--theme-on-primary',onPrimary);
    css.setProperty('--theme-title-on-page',titleOnPage);
    css.setProperty('--theme-accent-on-page',accentOnPage);

    if (page === 'admin') css.setProperty('--purple2',shade(primary,1.13));
    if (document.body) document.body.style.fontFamily=`"${font}",Arial,sans-serif`;

    let extra=document.getElementById('caarq-v20-appearance');
    if (!extra) { extra=document.createElement('style');extra.id='caarq-v20-appearance';document.head.append(extra); }
    // O CSS antigo usa fontes e cantos fixos em diversos componentes.
    // As regras abaixo só alteram aparência, sem tocar nas estruturas e eventos das páginas.
    const globalThemeCSS = `
      body, button, input, select, textarea, h1, h2, h3, h4, h5, h6 {
        font-family:var(--font)!important;
      }
      :where(.button,.button-yellow,.nav-cta,.menu-toggle,.portal-card,.news-card,
        .value-card,.feature-card,.about-card,.document-card,.info-card,.person-card,
        .history-card,.project-card,.event-card,.contact-panel,.ombudsman-card,
        .shop-card,.news-feature,.primary-button,.logout-button,.form-control,
        .og-group-header,.product-card,.shop-product,.tile,.card,.theme-preview) {
        border-radius:var(--site-radius)!important;
      }
    `;
    const pageThemeCSS = page === 'home' ? `
      body{color:var(--site-ink,var(--ink))!important;background-color:var(--paper)!important}
      .hero,.announcement,.value-purple,.visual-purple,.contact-panel{
        background-color:var(--purple)!important;
      }
      .manifesto,.site-footer{background-color:var(--purple-dark)!important}
      .hero h1 em{color:var(--yellow)!important}
      .portal-card,.about-card,.document-card,.feature-card,.info-card,
      .person-card,.history-card,.project-card,.event-card{
        background-color:var(--site-surface)!important;
      }
      .portal-card p,.portal-card small,.person-bio{color:var(--site-ink)!important}
      .portal-card-admin{background-color:var(--purple)!important;border-color:var(--purple)!important}
      .portal-card-admin strong,.portal-card-admin .portal-arrow{color:#fff!important}
      .portal-card:not(.portal-card-admin) strong,
      .portal-card:not(.portal-card-admin) .portal-arrow{color:var(--purple)!important}
    ` : page === 'members' ? `
      .current-section,.history-section{background:var(--paper)!important}
      .person-card,.history-card,.og-group-header{background:var(--site-surface)!important}
      .person-info h3,.og-group-header h3{color:var(--purple)!important}
      .person-bio{color:var(--site-text)!important}
    ` : '';
    // V21.3: corrigir a galeria dos cards, que deixava fotografias invadirem o texto.
    const layoutFix = page === 'home' ? `
      .home-card .home-image {
        position:relative!important;height:180px!important;min-height:180px!important;
        max-height:180px!important;overflow:hidden!important;isolation:isolate!important;
        display:grid!important;place-items:center!important;
        background:var(--purple)!important;color:var(--yellow)!important;
      }
      .home-card .home-image img {
        position:absolute!important;inset:0!important;display:block!important;
        width:100%!important;height:100%!important;max-height:100%!important;
        object-fit:cover!important;object-position:center!important;
      }
      .home-card .home-image>span {
        position:absolute;inset:0;display:grid;place-items:center;
      }
      .home-card .home-body {position:relative;z-index:1;min-width:0}
      .home-card .home-body strong,.home-card .home-body small,
      .home-card .home-body p {overflow-wrap:anywhere}
      #equipe,#projetos-resumo {scroll-margin-top:115px}
    ` : '';
    // Cores personalizadas podem ter texto branco e fundo verde/escuro.
    // As seções claras antigas ficavam lilás/creme, causando texto invisível.
    // A correção mantém a identidade clássica inalterada quando escolhida no Admin.
    const customContrastFix = page === 'home' && customizedColors ? `
      .home-team,.home-projects {
        background:var(--paper)!important;color:var(--theme-on-page)!important;
      }
      .home-team .section-heading h2,.home-projects .section-heading h2,
      .news .section-heading h2,.shop-copy h2,.about-heading h2,
      .ombudsman-intro h2 {color:var(--theme-title-on-page)!important}
      .home-team .section-heading h2 span,.home-projects .section-heading h2 span,
      .news .section-heading h2 span,.shop-copy h2 span,
      .about-heading h2 span,.ombudsman-intro h2 span {
        color:var(--theme-accent-on-page)!important;
      }
      .home-team .heading-side,.home-projects .heading-side,
      .news .heading-side,.home-team .kicker,.home-projects .kicker,
      .news .kicker,.shop-copy .kicker,.about-heading .kicker,
      .ombudsman-intro .kicker,.shop-copy>p:not(.kicker),
      .about-copy p,.about-copy p strong,.about-aside-note,
      .ombudsman-intro>p:not(.kicker),.ombudsman-hint {
        color:var(--theme-on-page)!important;
      }
      .home-card {
        background:var(--site-surface)!important;color:var(--theme-on-surface)!important;
        border-radius:var(--site-radius)!important;
      }
      .home-card .home-body strong,.home-card .home-body small,
      .home-card .home-body p {color:var(--theme-on-surface)!important}
      .home-more {
        background:var(--purple)!important;color:var(--theme-on-primary)!important;
        border-radius:var(--site-radius)!important;
      }
      .home-status {background:var(--site-surface)!important;color:var(--theme-on-surface)!important}
      .shop .shop-copy>p,.shop .shop-copy .kicker {color:var(--theme-on-page)!important}
      .about-section .section-index,.about-section .about-heading .kicker,
      .about-section .about-asterisk {color:var(--theme-on-page)!important}
      .news .section-heading {color:var(--theme-on-page)!important}
    ` : '';
    extra.textContent=globalThemeCSS+pageThemeCSS+layoutFix+customContrastFix;

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
