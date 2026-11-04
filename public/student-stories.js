(() => {
  const form=document.getElementById('student-story-form'), moderation=document.getElementById('story-moderation');
  if(!form&&!moderation)return;
  const base=typeof API_URL==='string'?API_URL:location.origin;
  const escape=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  async function api(path,method='GET',body){const res=await fetch(base+'/api/student-stories'+path,{method,headers:{Authorization:'Bearer '+window.BtechSession.read('token'),...(body?{'Content-Type':'application/json'}:{})},...(body?{body:JSON.stringify(body)}:{}),signal:AbortSignal.timeout(20000)});const result=await res.json();if(!res.ok||!result.success)throw new Error(result.error||'Could not save this change. Please retry.');return result.data;}
  if(form){
    const status=document.getElementById('student-story-status'),withdraw=document.getElementById('withdraw-story'),submit=form.querySelector('[type=submit]');
    let ready=false;
    const show=row=>{withdraw.hidden=!row;if(row){form.elements.displayName.value=row.displayName;form.elements.message.value=row.message;form.elements.consent.checked=row.consent;status.textContent=({pending:'Submitted for review. Not public yet.',published:'Selected by the team and published on the homepage.',hidden:'Not currently displayed on the homepage.'})[row.status]+(row.moderationNote?' Team note: '+row.moderationNote:'');}else{status.textContent='No experience submitted yet. Your private messages remain separate.';form.elements.displayName.value=window.BtechSession.read('userName');}};
    submit.disabled=true;
    api('/mine').then(row=>{show(row);ready=true;submit.disabled=false;}).catch(error=>{status.textContent=error.message+' Reload this page to retry.';});
    form.addEventListener('submit',async event=>{event.preventDefault();if(!ready||!form.reportValidity())return;submit.disabled=true;withdraw.disabled=true;try{show(await api('/mine','PUT',{displayName:form.elements.displayName.value,message:form.elements.message.value,consent:form.elements.consent.checked}));}catch(error){status.textContent=error.message;}finally{submit.disabled=false;withdraw.disabled=false;}});
    withdraw.addEventListener('click',async()=>{if(!confirm('Withdraw this experience and remove it from the homepage?'))return;submit.disabled=true;withdraw.disabled=true;try{await api('/mine','DELETE');form.reset();show(null);status.textContent='Your message has been withdrawn and is no longer published.';}catch(error){status.textContent=error.message;}finally{submit.disabled=false;withdraw.disabled=false;}});
  }
  if(moderation){
    const status=document.getElementById('story-admin-status');
    async function refresh(){const rows=await api('/staff');moderation.innerHTML=rows.map(row=>`<article class="story-review" data-story="${escape(row._id)}" data-revision="${row.revision}"><strong>${escape(row.displayName)}</strong><p>Status: ${escape(row.status)} · Consent: ${row.consent?'Yes':'No'}</p><small>Student account: ${escape(row.userId?.name||'Removed account')} · ${escape(row.userId?.email||'')}</small><blockquote>${escape(row.message)}</blockquote><label>Note to student (optional)<textarea maxlength="400">${escape(row.moderationNote)}</textarea></label><button type="button" data-story-action="published">Select for homepage</button><button type="button" data-story-action="hidden">Hide from homepage</button></article>`).join('');status.textContent=rows.length?rows.length+' recent submissions (up to 100). Editing a published message sends it back for review.':'No student experiences submitted yet.';}
    document.getElementById('refresh-stories').addEventListener('click',()=>refresh().catch(e=>{status.textContent=e.message;}));
    moderation.addEventListener('click',async event=>{const button=event.target.closest('[data-story-action]');if(!button)return;const card=button.closest('[data-story]');card.querySelectorAll('button').forEach(b=>{b.disabled=true;});try{await api('/staff/'+card.dataset.story,'PATCH',{status:button.dataset.storyAction,revision:Number(card.dataset.revision),moderationNote:card.querySelector('textarea').value});await refresh();}catch(error){status.textContent=error.message;card.querySelectorAll('button').forEach(b=>{b.disabled=false;});}});
    refresh().catch(error=>{status.textContent=error.message;});
  }
})();
