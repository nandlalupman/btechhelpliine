(() => {
  'use strict';
  const keys = ['token','role','userName','userEmail'];
  const read = key => { try { return localStorage.getItem(key) || ''; } catch { return ''; } };
  const clear = () => { for (const key of keys) try { localStorage.removeItem(key); } catch {} navigation(); };
  const destination = role => role === 'admin' ? '/admin' : role === 'counsellor' ? '/counsellor' : '/dashboard';
  const safeNext = value => {
    try { const target=new URL(value,location.origin); return value?.startsWith('/')&&!value.startsWith('//')&&target.origin===location.origin&&!/^\/(?:login|register|forgot-password|reset-password)(?:\/|\.|$)/.test(target.pathname) ? target.pathname+target.search+target.hash : ''; } catch { return ''; }
  };
  const loginUrl = path => '/login' + (safeNext(path) ? '?next='+encodeURIComponent(safeNext(path)) : '');
  async function validate(base = location.origin) {
    const token=read('token'); if(!token) return null;
    const response=await fetch(base+'/api/user/me',{headers:{Authorization:'Bearer '+token},signal:AbortSignal.timeout(15000)});
    if(response.status===401||response.status===403){clear();return null;}
    if(!response.ok) throw new Error('Account service is temporarily unavailable. Retry in a moment; your saved work has been kept.');
    const result=await response.json(); if(!result.success||!result.data)throw new Error('Could not check your account. Please retry.');
    for(const [key,value] of Object.entries({role:result.data.role,userName:result.data.name,userEmail:result.data.email}))try{localStorage.setItem(key,value);}catch{}
    return result.data;
  }
  function showIssue(message) {
    let notice=document.getElementById('session-notice');
    if(!notice){notice=document.createElement('div');notice.id='session-notice';notice.setAttribute('role','alert');notice.style.cssText='padding:16px 24px;background:#fff4df;color:#744719;font:14px/1.6 Arial,sans-serif;position:relative;z-index:100';document.body.prepend(notice);}
    notice.replaceChildren(document.createTextNode(message+' '));
    const retry=document.createElement('button');retry.type='button';retry.textContent='Retry';retry.addEventListener('click',()=>location.reload());notice.append(retry);
  }
  async function protect(role,base) {
    try { const user=await validate(base); if(!user){location.replace(loginUrl(location.pathname+location.search));return null;} if(!(Array.isArray(role)?role:[role]).includes(user.role)){location.replace(destination(user.role));return null;} return user; }
    catch(error){showIssue(error.message);return null;}
  }
  window.BtechSession={read,clear,validate,protect,destination,safeNext,loginUrl};
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',navigation);else navigation();
  function navigation(){
    document.querySelectorAll('a.login-link').forEach(link=>{link.href=read('token')?destination(read('role')):loginUrl(location.pathname+location.search);link.textContent=read('token')?'Dashboard':'Log in';});
    if(!read('token')&&!/^\/(login|register|forgot-password|reset-password)(\.|\/|$)/.test(location.pathname))document.querySelectorAll('a[href="/login"]').forEach(link=>{link.href=loginUrl(location.pathname+location.search);});
  }
})();
