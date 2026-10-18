/* CAARQ V21 — aviso público de manutenção. Não é bloqueio de servidor.
   Usado apenas nas páginas públicas, nunca no /admin/. */
(function(){
  'use strict';
  const script=document.currentScript;
  const root=document.documentElement;
  const siteRoot=new URL('./',script.src).href;
  const rest='https://aeipjioeqfcuqbacbcym.supabase.co/rest/v1/caarq_manutencao?select=ativo&id=eq.1';
  const key='sb_publishable_isTW4KzTw4bA7m82awH0BA_oG98M7qt';
  const css=document.createElement('style');
  css.id='caarq-v21-maintenance-style';
  css.textContent=`html.caarq-maintenance-check body{visibility:hidden!important}
    html.caarq-maintenance-check::after{content:'✳  Preparando o CAARQ…';position:fixed;inset:0;z-index:2147483647;display:grid;place-items:center;background:#40194f;color:white;font:700 16px Montserrat,Arial,sans-serif}`;
  document.head.append(css);
  root.classList.add('caarq-maintenance-check');
  let running=false, lastCheck=0;
  let navigating=false;
  function reveal(){root.classList.remove('caarq-maintenance-check');}
  async function check(){
    if(running)return;
    running=true;
    const ac=new AbortController();
    const timeout=setTimeout(()=>ac.abort(),6000);
    try{
      const result=await fetch(rest,{headers:{apikey:key, 'Cache-Control':'no-cache'},cache:'no-store',signal:ac.signal});
      if(!result.ok)throw new Error('status '+result.status);
      const rows=await result.json();
      if(Array.isArray(rows) && rows[0]?.ativo===true){
        navigating=true;
        root.classList.add('caarq-maintenance-check');
        location.replace(new URL('manutencao/',siteRoot).href);
        return;
      }
    }catch(error){
      // Disponibilidade: não derrubar todo o site se o Supabase ficar fora do ar.
      console.warn('CAARQ: não foi possível consultar o modo manutenção.',error);
    }finally{
      clearTimeout(timeout);running=false;lastCheck=Date.now();if(!navigating)reveal();
    }
  }
  void check();
  // Reavaliar em abas longamente abertas, sem exigir atualização manual.
  setInterval(()=>{if(!document.hidden)void check();},60000);
  document.addEventListener('visibilitychange',()=>{
    if(!document.hidden && Date.now()-lastCheck>10000)void check();
  });
  window.addEventListener('pageshow',event=>{
    if(event.persisted)void check();
  });
})();
