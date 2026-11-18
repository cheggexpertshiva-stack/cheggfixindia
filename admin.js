(() => {
 const menu=document.getElementById('adminMenuToggle'),side=document.getElementById('adminSidebar');
 if(menu&&side)menu.addEventListener('click',()=>side.classList.toggle('open'));
 const modal=document.getElementById('leadModal');
 if(modal&&Array.isArray(window.ONLYUS_LEADS)){
  const close=()=>modal.classList.remove('open');
  document.querySelectorAll('[data-lead]').forEach(btn=>btn.addEventListener('click',()=>{
   const item=window.ONLYUS_LEADS.find(x=>String(x.id)===btn.dataset.lead);if(!item)return;
   document.getElementById('modalName').textContent=item.name+' · #'+item.id;
   const detail=(label,value,full=false)=>`<div class="${full?'full':''}"><span>${label}</span><strong>${String(value||'—').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]))}</strong></div>`;
   document.getElementById('modalDetails').innerHTML=detail('EMAIL',item.email)+detail('COMPANY',item.company)+detail('INDUSTRY',item.industry)+detail('SERVICE',item.service)+detail('MESSAGE',item.message,true);
   document.getElementById('modalId').value=item.id;document.getElementById('modalStatus').value=item.status;document.getElementById('modalNotes').value=item.internal_notes||'';
   const assigned=document.getElementById('modalAssigned');if(assigned)assigned.value=item.assigned_to||'';
   const follow=document.getElementById('modalFollow');if(follow)follow.value=item.follow_up_at?String(item.follow_up_at).replace(' ','T').slice(0,16):'';
   modal.classList.add('open');
  }));
  document.getElementById('modalClose')?.addEventListener('click',close);
  modal.addEventListener('click',e=>{if(e.target===modal)close()});
 }
})();
