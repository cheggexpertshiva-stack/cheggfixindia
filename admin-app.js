import { supabase, SUPABASE_CONFIGURED, ADMIN_EMAIL } from './supabase-client.js';

const $ = (selector, root = document) => root.querySelector(selector);
const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];
const app = $('#appView');
const modal = $('#adminModal');
const modalBody = $('#modalBody');
const toastEl = $('#adminToast');
const BUCKET = 'onlyuslabs-media';
const TYPE_META = {
  page: { label: 'Pages', singular: 'page', description: 'Manage core website pages and their published copy.' },
  service: { label: 'Services', singular: 'service', description: 'Manage solution and service descriptions.' },
  industry: { label: 'Industries', singular: 'industry', description: 'Manage industry-specific landing page content.' },
  healthcare: { label: 'Healthcare content', singular: 'healthcare item', description: 'Manage healthcare and hospital automation content.' },
  case_study: { label: 'Case studies', singular: 'case study', description: 'Publish project stories, outcomes and implementation notes.' },
  testimonial: { label: 'Testimonials', singular: 'testimonial', description: 'Manage approved client quotations and attribution.' },
  faq: { label: 'FAQs', singular: 'FAQ', description: 'Manage frequently asked questions and answers.' },
  insight: { label: 'Insights', singular: 'insight', description: 'Publish articles, perspectives and company updates.' }
};
const TITLES = { overview:'Overview', leads:'Enquiries & CRM', pages:'Website pages', services:'Services', industries:'Industries', healthcare:'Healthcare content', case_studies:'Case studies', testimonials:'Testimonials', faqs:'FAQs', insights:'Insights', media:'Media library', seo:'SEO & website settings', admins:'Administrators', security:'Account security', activity:'Activity log' };
const VIEW_TYPES = { pages:'page', services:'service', industries:'industry', healthcare:'healthcare', case_studies:'case_study', testimonials:'testimonial', faqs:'faq', insights:'insight' };
const state = { user:null, role:'', displayName:'', view:'overview', search:'', leads:[], content:[], media:[], settings:{}, admins:[], activity:[], busy:false };

function esc(value='') { return String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c])); }
function slugify(value='') { return String(value).toLowerCase().trim().normalize('NFKD').replace(/[\u0300-\u036f]/g,'').replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,''); }
function dateFmt(value, withTime=false) { if(!value)return '—'; const d=new Date(value); if(Number.isNaN(d.getTime()))return '—'; return new Intl.DateTimeFormat('en',{day:'2-digit',month:'short',year:'numeric',...(withTime?{hour:'2-digit',minute:'2-digit'}:{})}).format(d); }
function moneylessCount(n) { return new Intl.NumberFormat('en').format(n || 0); }
function toast(message, type='success') { toastEl.textContent=message; toastEl.className=`admin-toast show ${type==='error'?'error':''}`; window.clearTimeout(toast._timer); toast._timer=window.setTimeout(()=>toastEl.classList.remove('show'),3600); }
function openModal(title, html) { $('#modalTitle').textContent=title; modalBody.innerHTML=html; modal.classList.add('open'); modal.setAttribute('aria-hidden','false'); document.body.classList.add('modal-open'); }
function closeModal() { modal.classList.remove('open'); modal.setAttribute('aria-hidden','true'); document.body.classList.remove('modal-open'); modalBody.innerHTML=''; }
function emptyState(title, message, symbol='✳') { return `<div class="empty-admin"><span>${symbol}</span><h3>${esc(title)}</h3><p>${esc(message)}</p></div>`; }
function statusPill(status='new') { return `<span class="status-pill ${esc(String(status).toLowerCase())}">${esc(status)}</span>`; }
function pageHeading(kicker,title,description,action='') { return `<div class="admin-page-heading"><div><span class="admin-eyebrow">${esc(kicker)}</span><h1>${esc(title)}</h1><p>${esc(description)}</p></div>${action?`<div class="page-actions">${action}</div>`:''}</div>`; }
function logAction(action, entityType, entityId=null, details={}) { return supabase.from('admin_activity').insert({ action, entity_type:entityType, entity_id:entityId, details, user_email:state.user?.email || '' }); }
function canManageAdmins() { return state.role === 'owner'; }
function canManageCRM() { return ['owner','admin'].includes(state.role); }
function navAllowed(button) { const roles=(button.dataset.role||'').split(',').filter(Boolean); return !roles.length || roles.includes(state.role); }

async function boot() {
  if (!SUPABASE_CONFIGURED || !supabase) { showSetupError('Supabase is not configured. Add the project URL and publishable key, then redeploy.'); return; }
  const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
  if (sessionError || !sessionData?.session) { window.location.replace('/admin/login.html'); return; }
  state.user=sessionData.session.user;
  const { data:isAdmin, error:adminError } = await supabase.rpc('is_onlyus_admin');
  if (adminError) { showSetupError('The database setup has not been completed. Run the included ONLYUSLABS-SUPABASE-SETUP.sql script in Supabase SQL Editor, then reload this page.'); return; }
  if (!isAdmin) { await supabase.auth.signOut(); window.location.replace('/admin/login.html'); return; }
  const { data:profile, error:profileError } = await supabase.from('admin_users').select('email,display_name,role,active').eq('email',state.user.email).maybeSingle();
  if (profileError || !profile?.active) { await supabase.auth.signOut(); window.location.replace('/admin/login.html'); return; }
  state.role=profile.role; state.displayName=profile.display_name || state.user.email;
  $('#sidebarUser').textContent=state.displayName;
  $('#sidebarRole').textContent=state.role.toUpperCase()+' / SECURE SESSION';
  $('#footerSession').textContent='SIGNED IN · '+state.role.toUpperCase();
  $$('#adminNav [data-view]').forEach(btn=>{ if(!navAllowed(btn))btn.hidden=true; });
  document.body.style.visibility='visible';
  $('#adminMenuToggle')?.addEventListener('click',()=>$('#adminSidebar').classList.toggle('open'));
  $('#adminNav').addEventListener('click',event=>{const btn=event.target.closest('[data-view]');if(btn&&!btn.hidden)setView(btn.dataset.view);});
  $('#adminLogout').addEventListener('click',signOut); $('#adminLogoutTop').addEventListener('click',signOut);
  $('#globalSearch').addEventListener('input',event=>{state.search=event.target.value.trim().toLowerCase();renderCurrent();});
  modal.addEventListener('click',event=>{if(event.target.matches('[data-modal-close]'))closeModal();});
  document.addEventListener('keydown',event=>{if(event.key==='Escape')closeModal();});
  await setView('overview');
}
function showSetupError(message) {
  document.body.style.visibility='visible';
  app.innerHTML=`<div style="max-width:760px;margin:50px auto;background:#fff;border:1px solid #e2e6df;padding:28px"><span class="admin-eyebrow">ONLYUSLABS / DATABASE SETUP</span><h1 style="font:700 27px Manrope;margin:12px 0">One setup step remains.</h1><p style="color:#778078;font-size:13px;line-height:1.8">${esc(message)}</p><div class="note-box">Open Supabase → SQL Editor → New query. Paste and run <b>ONLYUSLABS-SUPABASE-SETUP.sql</b> from the downloaded package. This creates the database tables, administrator permissions and media storage bucket.</div><p style="font-size:11px;color:#778078">Your publishable key is safe for browser use. Never add the Supabase secret/service-role key to this website.</p><a class="admin-btn primary" href="/admin/login.html">Return to sign in</a></div>`;
}
async function signOut() { await supabase.auth.signOut(); window.location.replace('/admin/login.html'); }

async function setView(view) {
  if(view==='leads'&&!canManageCRM())return;
  if(view==='admins'&&!canManageAdmins())return;
  if(view==='seo'&&!['owner','admin'].includes(state.role))return;
  state.view=view; state.search=''; $('#globalSearch').value=''; $('#viewTitle').textContent=TITLES[view]||'Overview';
  $$('#adminNav [data-view]').forEach(btn=>btn.classList.toggle('active',btn.dataset.view===view));
  $('#adminSidebar').classList.remove('open'); app.innerHTML='<div class="loading-state"><span class="loader"></span><p>Loading workspace data…</p></div>';
  try {
    if(view==='overview') await loadDashboard();
    else if(view==='leads') { const {data,error}=await supabase.from('leads').select('*').order('created_at',{ascending:false}).limit(500); if(error)throw error; state.leads=data||[]; renderLeads(); }
    else if(VIEW_TYPES[view]) { const {data,error}=await supabase.from('content_items').select('*').eq('content_type',VIEW_TYPES[view]).order('sort_order',{ascending:true}).order('created_at',{ascending:false}); if(error)throw error; state.content=data||[]; renderContent(); }
    else if(view==='media') { const {data,error}=await supabase.from('media_assets').select('*').order('created_at',{ascending:false}); if(error)throw error; state.media=data||[]; renderMedia(); }
    else if(view==='seo') { await loadSettings(); renderSettings(); }
    else if(view==='admins') { const {data,error}=await supabase.from('admin_users').select('*').order('created_at',{ascending:true}); if(error)throw error; state.admins=data||[]; renderAdmins(); }
    else if(view==='security') renderSecurity();
    else if(view==='activity') { const {data,error}=await supabase.from('admin_activity').select('*').order('created_at',{ascending:false}).limit(200); if(error)throw error; state.activity=data||[]; renderActivity(); }
  } catch(error) { console.error(error); app.innerHTML=`<div class="admin-panel"><span class="admin-eyebrow">DATA CONNECTION</span><h2>Could not load this section.</h2><p style="font-size:12px;color:#778078">${esc(error.message||'Unknown database error')}</p><button class="admin-btn" id="retryView">Try again</button></div>`; $('#retryView')?.addEventListener('click',()=>setView(view)); }
}
async function loadDashboard() {
  const leadPromise = canManageCRM()
    ? supabase.from('leads').select('id,name,email,company,industry,service,status,created_at,follow_up_at',{count:'exact'}).order('created_at',{ascending:false}).limit(500)
    : Promise.resolve({data:[],error:null,count:0});
  const [{data:leads,error:lerr,count:leadCount},{data:content,error:cerr,count:contentCount},{data:media,error:merr,count:mediaCount}] = await Promise.all([
    leadPromise,
    supabase.from('content_items').select('id,status,content_type',{count:'exact'}),
    supabase.from('media_assets').select('id',{count:'exact',head:true})
  ]);
  if(lerr)throw lerr;if(cerr)throw cerr;if(merr)throw merr;
  state.leads=leads||[];state.content=content||[];
  const newCount=state.leads.filter(x=>x.status==='new').length;
  const qualified=state.leads.filter(x=>x.status==='qualified'||x.status==='proposal').length;
  const won=state.leads.filter(x=>x.status==='won').length;
  const monthLabels=[];const monthCounts=[];const now=new Date();
  for(let i=5;i>=0;i--){const d=new Date(now.getFullYear(),now.getMonth()-i,1);const label=d.toLocaleDateString('en',{month:'short'});monthLabels.push(label);monthCounts.push(state.leads.filter(x=>{const c=new Date(x.created_at);return c.getFullYear()===d.getFullYear()&&c.getMonth()===d.getMonth();}).length);}
  const max=Math.max(1,...monthCounts);
  const chart=monthLabels.map((label,i)=>`<div class="mini-chart-col"><b class="mini-chart-value">${monthCounts[i]}</b><div class="mini-chart-track"><i style="height:${Math.max(3,monthCounts[i]/max*100)}%"></i></div><span>${label}</span></div>`).join('');
  const industries={};state.leads.forEach(x=>{if(x.industry)industries[x.industry]=(industries[x.industry]||0)+1;});
  const industryRows=Object.entries(industries).sort((a,b)=>b[1]-a[1]).slice(0,6).map(([name,count])=>`<div><span>${esc(name)}</span><b>${count}</b></div>`).join('')||'<p style="font-size:10px;color:#879187">Industry data will appear when enquiries arrive.</p>';
  const recent=state.leads.slice(0,6).map(x=>`<tr><td><strong>${esc(x.name)}</strong><small>${esc(x.company||x.email)}</small></td><td>${esc(x.industry||'—')}</td><td>${statusPill(x.status)}</td><td>${dateFmt(x.created_at)}</td><td><button class="table-action" data-action="edit-lead" data-id="${x.id}">Open</button></td></tr>`).join('');
  const published=(content||[]).filter(x=>x.status==='published').length;
  app.innerHTML=`${pageHeading('BUSINESS / AT A GLANCE','Welcome to your workspace.','A live view of website enquiries, published content and operational activity.')}
  <div class="metric-grid"><article class="metric-card"><span class="metric-label">TOTAL ENQUIRIES</span><strong>${canManageCRM()?moneylessCount(leadCount):'—'}</strong><small>${canManageCRM()?'All website enquiries':'CRM access is restricted'}</small><span class="metric-symbol">✉</span></article><article class="metric-card"><span class="metric-label">NEW ENQUIRIES</span><strong>${canManageCRM()?moneylessCount(newCount):'—'}</strong><small>${canManageCRM()?'Awaiting first response':'CRM access is restricted'}</small><span class="metric-symbol">◷</span></article><article class="metric-card"><span class="metric-label">QUALIFIED / PROPOSAL</span><strong>${canManageCRM()?moneylessCount(qualified):'—'}</strong><small>${canManageCRM()?'Active opportunities':'CRM access is restricted'}</small><span class="metric-symbol">◇</span></article><article class="metric-card"><span class="metric-label">WON ENQUIRIES</span><strong>${canManageCRM()?moneylessCount(won):'—'}</strong><small>${canManageCRM()?'Converted opportunities':'CRM access is restricted'}</small><span class="metric-symbol">↗</span></article></div>
  <div class="admin-two-col"><section class="admin-panel"><div class="panel-head"><div><span class="admin-eyebrow">ENQUIRY MOMENTUM</span><h2>Monthly activity</h2><p>New enquiries by month · last six months</p></div></div><div class="mini-chart">${chart}</div></section><section class="admin-panel"><div class="panel-head"><div><span class="admin-eyebrow">INDUSTRY MIX</span><h2>Enquiries by industry</h2></div></div><div class="industry-stats">${industryRows}</div></section></div>
  <div class="admin-two-col"><section class="admin-panel"><div class="panel-head"><div><span class="admin-eyebrow">LATEST ACTIVITY</span><h2>Recent enquiries</h2></div>${canManageCRM()?'<button class="admin-btn small" data-go="leads">Open CRM ↗</button>':''}</div>${canManageCRM()?(recent?`<div class="admin-table-wrap"><table class="admin-table"><thead><tr><th>CONTACT</th><th>INDUSTRY</th><th>STATUS</th><th>RECEIVED</th><th></th></tr></thead><tbody>${recent}</tbody></table></div>`:emptyState('Your next conversation starts here.','New website enquiries will appear here when the contact form is connected.')):emptyState('CRM access is restricted','Your current role can manage content and media, but not customer enquiries.','⌑')}</section><section class="admin-panel"><div class="panel-head"><div><span class="admin-eyebrow">CONTENT CONTROL</span><h2>Website content</h2></div></div><div class="industry-stats"><div><span>All content records</span><b>${moneylessCount(contentCount)}</b></div><div><span>Published records</span><b>${moneylessCount(published)}</b></div><div><span>Media assets</span><b>${moneylessCount(mediaCount)}</b></div></div><div class="note-box">Use the content sections to draft, publish and manage page copy, service descriptions, industry content, healthcare resources, case studies, testimonials, FAQs and insights.</div></section></div>`;
  app.onclick=dashboardClick;
}
function dashboardClick(event){const go=event.target.closest('[data-go]');if(go){setView(go.dataset.go);return;}const edit=event.target.closest('[data-action="edit-lead"]');if(edit){const lead=state.leads.find(x=>x.id===edit.dataset.id);if(lead)openLeadEditor(lead);}}

function renderLeads() {
  const filtered=state.leads.filter(x=>[x.name,x.email,x.company,x.industry,x.service,x.status].join(' ').toLowerCase().includes(state.search));
  const rows=filtered.map(x=>`<tr><td><strong>${esc(x.name)}</strong><small>${esc(x.email)}</small></td><td>${esc(x.company||'—')}</td><td>${esc(x.industry||'—')}</td><td>${statusPill(x.status)}</td><td>${dateFmt(x.created_at)}</td><td><div class="table-actions"><button class="table-action" data-action="edit-lead" data-id="${x.id}">Manage</button></div></td></tr>`).join('');
  app.innerHTML=`${pageHeading('CUSTOMER RELATIONSHIPS / CRM','Enquiries & pipeline','Review incoming enquiries, assign ownership, record notes and track each opportunity through to conversion.')}
  <div class="metric-grid"><article class="metric-card"><span class="metric-label">ALL ENQUIRIES</span><strong>${state.leads.length}</strong><small>Loaded records</small></article><article class="metric-card"><span class="metric-label">NEW</span><strong>${state.leads.filter(x=>x.status==='new').length}</strong><small>Awaiting contact</small></article><article class="metric-card"><span class="metric-label">QUALIFIED</span><strong>${state.leads.filter(x=>x.status==='qualified').length}</strong><small>Sales-ready</small></article><article class="metric-card"><span class="metric-label">WON</span><strong>${state.leads.filter(x=>x.status==='won').length}</strong><small>Converted</small></article></div>
  <div class="table-toolbar"><div><span class="admin-eyebrow">LIVE CRM RECORDS</span><p style="margin:4px 0 0;font-size:10px;color:#879187">${filtered.length} matching enquiries</p></div><div class="table-filters"><select id="leadStatusFilter"><option value="">All statuses</option>${['new','contacted','qualified','proposal','won','lost'].map(s=>`<option value="${s}">${s[0].toUpperCase()+s.slice(1)}</option>`).join('')}</select><button class="admin-btn" id="refreshLeads">↻ Refresh</button></div></div>
  <div class="admin-table-wrap"><table class="admin-table"><thead><tr><th>CONTACT</th><th>ORGANISATION</th><th>INDUSTRY</th><th>STATUS</th><th>RECEIVED</th><th>ACTION</th></tr></thead><tbody>${rows||`<tr><td colspan="6">${emptyState('No enquiries found','New website enquiries will appear here. Check the public contact form integration.')}</td></tr>`}</tbody></table></div>`;
  $('#leadStatusFilter').addEventListener('change',e=>{const val=e.target.value;$$('.admin-table tbody tr').forEach(row=>{const pill=$('.status-pill',row);row.hidden=!!val&&pill?.textContent.toLowerCase()!==val;});});
  $('#refreshLeads').addEventListener('click',()=>setView('leads'));
  app.onclick=event=>{const btn=event.target.closest('[data-action="edit-lead"]');if(btn){const lead=state.leads.find(x=>x.id===btn.dataset.id);if(lead)openLeadEditor(lead);}};
}
function openLeadEditor(lead) {
  const dt=lead.follow_up_at?new Date(lead.follow_up_at).toISOString().slice(0,16):'';
  openModal('Enquiry · '+(lead.name||'Contact'),`<form id="leadEditorForm"><div class="editor-grid">
    <div class="cms-field"><span>CONTACT NAME</span><input value="${esc(lead.name)}" disabled></div><div class="cms-field"><span>BUSINESS EMAIL</span><input value="${esc(lead.email)}" disabled></div>
    <div class="cms-field"><span>COMPANY</span><input value="${esc(lead.company)}" disabled></div><div class="cms-field"><span>INDUSTRY</span><input value="${esc(lead.industry)}" disabled></div>
    <div class="cms-field"><span>SERVICE INTEREST</span><input value="${esc(lead.service)}" disabled></div><div class="cms-field"><span>RECEIVED</span><input value="${dateFmt(lead.created_at,true)}" disabled></div>
    <div class="cms-field"><span>PIPELINE STATUS</span><select name="status">${['new','contacted','qualified','proposal','won','lost'].map(s=>`<option value="${s}" ${lead.status===s?'selected':''}>${s[0].toUpperCase()+s.slice(1)}</option>`).join('')}</select></div>
    <div class="cms-field"><span>ASSIGNED TO</span><input name="assigned_to" value="${esc(lead.assigned_to||'')}" placeholder="Name or team"></div>
    <div class="cms-field wide"><span>FOLLOW-UP DATE</span><input type="datetime-local" name="follow_up_at" value="${dt}"></div>
    <div class="cms-field wide"><span>ENQUIRY MESSAGE</span><textarea rows="4" disabled>${esc(lead.message)}</textarea></div>
    <div class="cms-field wide"><span>INTERNAL NOTES</span><textarea name="internal_notes" rows="4" placeholder="Add private CRM notes…">${esc(lead.internal_notes||'')}</textarea></div>
  </div><div class="editor-actions"><button class="admin-btn danger" type="button" id="deleteLead">Delete enquiry</button><div><button class="admin-btn" type="button" data-modal-close>Cancel</button><button class="admin-btn primary" type="submit">Save changes</button></div></div></form>`);
  $('#leadEditorForm').addEventListener('submit',async e=>{e.preventDefault();const f=new FormData(e.currentTarget);const payload={status:f.get('status'),assigned_to:f.get('assigned_to')||null,follow_up_at:f.get('follow_up_at')?new Date(f.get('follow_up_at')).toISOString():null,internal_notes:f.get('internal_notes')||null};const {error}=await supabase.from('leads').update(payload).eq('id',lead.id);if(error){toast(error.message,'error');return;}await logAction('updated','lead',lead.id,{status:payload.status});closeModal();toast('Enquiry updated.');await setView(state.view);});
  $('#deleteLead').addEventListener('click',async()=>{if(!confirm('Permanently delete this enquiry?'))return;const {error}=await supabase.from('leads').delete().eq('id',lead.id);if(error){toast(error.message,'error');return;}await logAction('deleted','lead',lead.id);closeModal();toast('Enquiry deleted.');await setView('leads');});
}

function renderContent() {
  const type=VIEW_TYPES[state.view];const meta=TYPE_META[type];const filtered=state.content.filter(x=>[x.title,x.slug,x.route,x.excerpt,x.category,x.status].join(' ').toLowerCase().includes(state.search));
  const rows=filtered.map(x=>`<tr><td><strong>${esc(x.title)}</strong><small>${esc(x.category||x.slug||'')}</small></td><td><span class="inline-code">${esc(x.route||('/'+(x.slug||'')+'/'))}</span></td><td>${statusPill(x.status)}</td><td>${dateFmt(x.updated_at||x.created_at)}</td><td><div class="table-actions"><button class="table-action" data-action="edit-content" data-id="${x.id}">Edit</button><button class="table-action" data-action="delete-content" data-id="${x.id}">Delete</button></div></td></tr>`).join('');
  app.innerHTML=`${pageHeading('WEBSITE / CONTENT MANAGEMENT',meta.label,meta.description,`<button class="admin-btn primary" id="addContent">＋ Add ${esc(meta.singular)}</button>`)}
  <div class="table-toolbar"><div><span class="admin-eyebrow">CONTENT LIBRARY</span><p style="margin:4px 0 0;font-size:10px;color:#879187">${filtered.length} records · ${state.content.filter(x=>x.status==='published').length} published</p></div><div class="table-filters"><select id="contentStatusFilter"><option value="">All statuses</option><option value="published">Published</option><option value="draft">Draft</option><option value="archived">Archived</option></select><button class="admin-btn" id="refreshContent">↻ Refresh</button></div></div>
  <div class="admin-table-wrap"><table class="admin-table"><thead><tr><th>TITLE / CATEGORY</th><th>PUBLIC ROUTE</th><th>STATUS</th><th>LAST UPDATED</th><th>ACTIONS</th></tr></thead><tbody>${rows||`<tr><td colspan="5">${emptyState('No '+meta.label.toLowerCase()+' yet','Create your first record to start managing this content type.')}</td></tr>`}</tbody></table></div>
  <div class="note-box">Publishing a record makes it available to the public website CMS runtime when its public route is set. Keep records in Draft until the copy and SEO fields are ready.</div>`;
  $('#addContent').addEventListener('click',()=>openContentEditor(null,type));$('#refreshContent').addEventListener('click',()=>setView(state.view));
  $('#contentStatusFilter').addEventListener('change',e=>{const val=e.target.value;$$('.admin-table tbody tr').forEach(row=>{const pill=$('.status-pill',row);row.hidden=!!val&&pill?.textContent.toLowerCase()!==val;});});
  app.onclick=async event=>{const edit=event.target.closest('[data-action="edit-content"]');const del=event.target.closest('[data-action="delete-content"]');if(edit){const item=state.content.find(x=>x.id===edit.dataset.id);if(item)openContentEditor(item,type);}if(del){const item=state.content.find(x=>x.id===del.dataset.id);if(item&&confirm(`Delete “${item.title}”?`)){const {error}=await supabase.from('content_items').delete().eq('id',item.id);if(error){toast(error.message,'error');return;}await logAction('deleted',type,item.id,{title:item.title});toast('Content deleted.');await setView(state.view);}}};
}
function openContentEditor(item,type) {
  const meta=TYPE_META[type];const value=item||{title:'',slug:'',route:'',excerpt:'',body:'',category:'',author:'',featured_image_url:'',seo_title:'',seo_description:'',seo_keywords:'',status:'draft',sort_order:0,data:{}};
  const json=JSON.stringify(value.data||{},null,2);
  openModal((item?'Edit ':'Create ')+meta.singular,`<form id="contentEditorForm"><div class="editor-grid">
    <label class="cms-field wide"><span>TITLE / HEADING</span><input name="title" required maxlength="180" value="${esc(value.title)}" placeholder="Enter a clear title"></label>
    <label class="cms-field"><span>URL SLUG</span><input name="slug" required maxlength="180" value="${esc(value.slug)}" placeholder="example-page"></label>
    <label class="cms-field"><span>PUBLIC ROUTE</span><input name="route" maxlength="220" value="${esc(value.route||'')}" placeholder="/solutions/example/"><small class="field-hint">Use the exact website path, including the leading and trailing slash.</small></label>
    <label class="cms-field wide"><span>SHORT DESCRIPTION / EXCERPT</span><textarea name="excerpt" rows="2" maxlength="500">${esc(value.excerpt||'')}</textarea></label>
    <label class="cms-field wide"><span>BODY CONTENT</span><textarea name="body" rows="8" placeholder="Write the page or article content. Separate paragraphs with a blank line.">${esc(value.body||'')}</textarea><small class="field-hint">Plain text is supported. The public CMS runtime displays this as safe paragraphs.</small></label>
    <label class="cms-field"><span>CATEGORY / INDUSTRY</span><input name="category" value="${esc(value.category||'')}"></label>
    <label class="cms-field"><span>AUTHOR / ATTRIBUTION</span><input name="author" value="${esc(value.author||'')}"></label>
    <label class="cms-field wide"><span>FEATURED IMAGE URL</span><input name="featured_image_url" value="${esc(value.featured_image_url||'')}" placeholder="Paste a Media Library public URL"></label>
    <label class="cms-field"><span>SEO TITLE</span><input name="seo_title" maxlength="180" value="${esc(value.seo_title||'')}"></label>
    <label class="cms-field"><span>SEO KEYWORDS</span><input name="seo_keywords" value="${esc(value.seo_keywords||'')}"></label>
    <label class="cms-field wide"><span>SEO META DESCRIPTION</span><textarea name="seo_description" rows="2" maxlength="320">${esc(value.seo_description||'')}</textarea></label>
    <label class="cms-field"><span>PUBLICATION STATUS</span><select name="status"><option value="draft" ${value.status==='draft'?'selected':''}>Draft</option><option value="published" ${value.status==='published'?'selected':''}>Published</option><option value="archived" ${value.status==='archived'?'selected':''}>Archived</option></select></label>
    <label class="cms-field"><span>SORT ORDER</span><input name="sort_order" type="number" value="${Number(value.sort_order)||0}"></label>
    <label class="cms-field wide"><span>ADDITIONAL DATA (JSON)</span><textarea name="extra_json" rows="3">${esc(json)}</textarea><small class="field-hint">Optional structured details, for example testimonial company and role.</small></label>
  </div><div class="editor-actions"><span class="field-hint">${item?`Created ${dateFmt(item.created_at)} · ID ${esc(item.id.slice(0,8))}`:'New content record'}</span><div><button class="admin-btn" type="button" data-modal-close>Cancel</button><button class="admin-btn primary" type="submit">Save ${meta.singular}</button></div></div></form>`);
  const form=$('#contentEditorForm');
  form.elements.title.addEventListener('input',()=>{if(!item||!form.elements.slug.dataset.touched){form.elements.slug.value=slugify(form.elements.title.value);}});
  form.elements.slug.addEventListener('input',()=>{form.elements.slug.dataset.touched='1';});
  form.addEventListener('submit',async e=>{e.preventDefault();const f=new FormData(form);let data={};try{data=JSON.parse(f.get('extra_json')||'{}');if(!data||Array.isArray(data)||typeof data!=='object')throw new Error('Additional data must be a JSON object.');}catch(err){toast('Additional data JSON is invalid: '+err.message,'error');return;}
    const status=f.get('status');const route=String(f.get('route')||'').trim();if(route && (!route.startsWith('/') || route.startsWith('//') || route.includes('javascript:'))){toast('Public route must be an internal website path beginning with /','error');return;}const imageUrl=String(f.get('featured_image_url')||'').trim();if(imageUrl && !/^https?:\/\//i.test(imageUrl)){toast('Featured image URL must begin with https:// or http://','error');return;}const payload={content_type:type,title:f.get('title').trim(),slug:slugify(f.get('slug')),route:route||null,excerpt:f.get('excerpt')||null,body:f.get('body')||null,category:f.get('category')||null,author:f.get('author')||null,featured_image_url:imageUrl||null,seo_title:f.get('seo_title')||null,seo_description:f.get('seo_description')||null,seo_keywords:f.get('seo_keywords')||null,status,sort_order:Number(f.get('sort_order'))||0,data,published_at:status==='published'?(item?.published_at||new Date().toISOString()):null};
    if(!payload.slug){toast('Please enter a valid URL slug.','error');return;}
    const query=item?supabase.from('content_items').update(payload).eq('id',item.id):supabase.from('content_items').insert(payload);
    const {data:result,error}=await query.select().single();if(error){toast(error.message,'error');return;}await logAction(item?'updated':'created',type,result.id,{title:payload.title,status});closeModal();toast(meta.singular[0].toUpperCase()+meta.singular.slice(1)+' saved.');await setView(state.view);
  });
}

function renderMedia() {
  const filtered=state.media.filter(x=>[x.file_name,x.alt_text,x.mime_type].join(' ').toLowerCase().includes(state.search));
  const cards=filtered.map(x=>`<article class="media-item"><div class="media-preview">${x.mime_type?.startsWith('image/')?`<img src="${esc(x.public_url)}" alt="${esc(x.alt_text||x.file_name)}" loading="lazy">`:'<span style="font-size:30px;color:#829989">▤</span>'}</div><strong>${esc(x.file_name)}</strong><small>${esc(x.alt_text||'No alt text')} · ${Math.max(1,Math.round((x.size_bytes||0)/1024))} KB</small><div class="table-actions"><button class="table-action" data-action="copy-media" data-url="${esc(x.public_url)}">Copy URL</button><button class="table-action" data-action="edit-media" data-id="${x.id}">Alt text</button><button class="table-action" data-action="delete-media" data-id="${x.id}">Delete</button></div></article>`).join('');
  app.innerHTML=`${pageHeading('ASSETS / WEBSITE MEDIA','Media library','Upload, organise and reuse images and documents across ONLYUSLABS content.')}
  <form id="uploadForm" class="upload-zone"><div><strong style="font:600 13px Manrope">Add a media asset</strong><p>Files are stored in the private project’s public media bucket. Avoid uploading confidential or patient information.</p></div><div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap"><input name="file" type="file" accept="image/*,.pdf,.svg,.webp" required><input name="alt_text" type="text" placeholder="Alt text (optional)" style="border:1px solid #dce1da;padding:9px;max-width:180px;font-size:10px"><button class="admin-btn primary" type="submit">Upload file ↗</button></div></form>
  <div class="table-toolbar"><div><span class="admin-eyebrow">ASSET COLLECTION</span><p style="margin:4px 0 0;font-size:10px;color:#879187">${filtered.length} assets</p></div><button class="admin-btn" id="refreshMedia">↻ Refresh</button></div>
  ${cards?`<div class="media-grid">${cards}</div>`:emptyState('Your media library is empty','Upload your first image, document or brand asset.')}`;
  $('#uploadForm').addEventListener('submit',uploadMedia);$('#refreshMedia').addEventListener('click',()=>setView('media'));
  app.onclick=async event=>{const copy=event.target.closest('[data-action="copy-media"]');const edit=event.target.closest('[data-action="edit-media"]');const del=event.target.closest('[data-action="delete-media"]');if(copy){try{await navigator.clipboard.writeText(copy.dataset.url);toast('Public URL copied.');}catch{toast('Clipboard access is unavailable.','error');}}if(edit){const item=state.media.find(x=>x.id===edit.dataset.id);if(item)openMediaEditor(item);}if(del){const item=state.media.find(x=>x.id===del.dataset.id);if(item&&confirm(`Delete ${item.file_name} from the media library?`)){const {error:storageError}=await supabase.storage.from(BUCKET).remove([item.storage_path]);if(storageError){toast(storageError.message,'error');return;}const {error}=await supabase.from('media_assets').delete().eq('id',item.id);if(error){toast(error.message,'error');return;}await logAction('deleted','media',item.id,{file_name:item.file_name});toast('Media asset deleted.');await setView('media');}}};
}
function openMediaEditor(item){openModal('Edit media details',`<form id="mediaEditorForm"><label class="cms-field"><span>FILE NAME</span><input value="${esc(item.file_name)}" disabled></label><label class="cms-field"><span>ALT TEXT</span><input name="alt_text" maxlength=300 value="${esc(item.alt_text||'')}" placeholder="Describe the image for accessibility and search"></label><div class="editor-actions"><span class="field-hint">Use concise, descriptive alt text.</span><div><button class="admin-btn" type="button" data-modal-close>Cancel</button><button class="admin-btn primary" type="submit">Save details</button></div></div></form>`);$('#mediaEditorForm').addEventListener('submit',async e=>{e.preventDefault();const alt_text=new FormData(e.currentTarget).get('alt_text')||null;const {error}=await supabase.from('media_assets').update({alt_text}).eq('id',item.id);if(error){toast(error.message,'error');return;}await logAction('updated','media',item.id,{alt_text});closeModal();toast('Media details updated.');await setView('media');});}

async function uploadMedia(event) {
  event.preventDefault();const form=event.currentTarget;const file=form.elements.file.files[0];if(!file)return;
  if(file.size>15*1024*1024){toast('Please choose a file smaller than 15 MB.','error');return;}
  const safeName=slugify(file.name.replace(/\.[^.]+$/,''))+(file.name.match(/\.[^.]+$/)?.[0].toLowerCase()||'');const path=`${new Date().getFullYear()}/${Date.now()}-${safeName}`;
  const button=form.querySelector('button[type="submit"]');button.disabled=true;button.textContent='Uploading…';
  const {error:uploadError}=await supabase.storage.from(BUCKET).upload(path,file,{cacheControl:'3600',upsert:false,contentType:file.type||'application/octet-stream'});
  if(uploadError){button.disabled=false;button.textContent='Upload file ↗';toast(uploadError.message,'error');return;}
  const {data:urlData}=supabase.storage.from(BUCKET).getPublicUrl(path);const payload={file_name:file.name,storage_path:path,public_url:urlData.publicUrl,mime_type:file.type||'application/octet-stream',size_bytes:file.size,alt_text:form.elements.alt_text.value||null};
  const {data,error}=await supabase.from('media_assets').insert(payload).select().single();
  if(error){await supabase.storage.from(BUCKET).remove([path]);button.disabled=false;button.textContent='Upload file ↗';toast(error.message,'error');return;}
  await logAction('uploaded','media',data.id,{file_name:file.name});toast('File uploaded to the media library.');await setView('media');
}

async function loadSettings(){const {data,error}=await supabase.from('site_settings').select('*').eq('id','global').maybeSingle();if(error)throw error;state.settings=data?.settings||{};}
function renderSettings(){const s=state.settings;app.innerHTML=`${pageHeading('CONFIGURATION / BRAND CONTROL','SEO & website settings','Control your default search metadata, public contact details and brand links. These settings are available to the public website runtime.')}
  <form id="settingsForm"><div class="settings-layout"><section class="settings-card"><span class="admin-eyebrow">BRAND & CONTACT</span><h3>Business information</h3>
    ${settingField('company_name','Company name',s.company_name||'ONLYUSLABS')}${settingField('tagline','Tagline',s.tagline||'Intelligence Behind Better Business.')}${settingField('contact_email','Business email',s.contact_email||'','email')}${settingField('phone','Phone number',s.phone||'+91 77803 67903')}${settingField('whatsapp','WhatsApp number (digits only)',s.whatsapp||'917780367903')}${settingField('address','Business address',s.address||'')}
  </section><section class="settings-card"><span class="admin-eyebrow">SEARCH / SOCIAL</span><h3>Default SEO metadata</h3>
    ${settingField('default_seo_title','Default SEO title',s.default_seo_title||'ONLYUSLABS — Intelligence Behind Better Business')}${settingArea('default_seo_description','Default meta description',s.default_seo_description||'ONLYUSLABS designs intelligent automation systems that connect people, processes and technology.')}${settingField('default_seo_keywords','Default keywords',s.default_seo_keywords||'AI automation, business automation, intelligent business technology')}${settingField('og_image_url','Default social share image URL',s.og_image_url||'')}
  </section><section class="settings-card"><span class="admin-eyebrow">SOCIAL PRESENCE</span><h3>Social links</h3>${settingField('linkedin_url','LinkedIn URL',s.linkedin_url||'')}${settingField('instagram_url','Instagram URL',s.instagram_url||'')}${settingField('facebook_url','Facebook URL',s.facebook_url||'')}${settingField('x_url','X / Twitter URL',s.x_url||'')}
  </section><section class="settings-card"><span class="admin-eyebrow">SITE PREFERENCES</span><h3>Publishing defaults</h3><label class="cms-field"><span>PUBLIC WEBSITE SETTINGS</span><select name="is_public"><option value="true">Public website can read these settings</option><option value="false">Keep settings private</option></select></label><div class="note-box">Do not store API secrets, passwords, service-role keys, payment credentials or confidential customer information in website settings.</div></section></div><div class="editor-actions" style="margin-top:16px"><span class="field-hint">Changes are saved to Supabase.</span><button class="admin-btn primary" type="submit">Save website settings</button></div></form>`;
  $('#settingsForm').elements.is_public.value='true';$('#settingsForm').addEventListener('submit',saveSettings);
}
function settingField(name,label,value,type='text'){return `<label class="cms-field"><span>${esc(label)}</span><input name="${esc(name)}" type="${esc(type)}" value="${esc(value)}"></label>`;}
function settingArea(name,label,value){return `<label class="cms-field"><span>${esc(label)}</span><textarea name="${esc(name)}" rows="4">${esc(value)}</textarea></label>`;}
async function saveSettings(event){event.preventDefault();const f=new FormData(event.currentTarget);const keys=['company_name','tagline','contact_email','phone','whatsapp','address','default_seo_title','default_seo_description','default_seo_keywords','og_image_url','linkedin_url','instagram_url','facebook_url','x_url'];const settings={};keys.forEach(k=>settings[k]=String(f.get(k)||'').trim());const {error}=await supabase.from('site_settings').upsert({id:'global',settings,is_public:f.get('is_public')==='true',updated_at:new Date().toISOString()});if(error){toast(error.message,'error');return;}state.settings=settings;await logAction('updated','site_settings','global');toast('Website settings saved.');}

function renderAdmins(){const rows=state.admins.map(x=>`<tr><td><strong>${esc(x.display_name||x.email)}</strong><small>${esc(x.email)}</small></td><td>${statusPill(x.role)}</td><td>${statusPill(x.active?'active':'inactive')}</td><td>${dateFmt(x.created_at)}</td><td><div class="table-actions">${x.role==='owner'?'<span style="font-size:9px;color:#8b968d">Primary owner</span>':`<button class="table-action" data-action="toggle-admin" data-email="${esc(x.email)}" data-active="${x.active}">${x.active?'Deactivate':'Activate'}</button><button class="table-action" data-action="remove-admin" data-email="${esc(x.email)}">Remove</button>`}</div></td></tr>`).join('');
  app.innerHTML=`${pageHeading('ACCESS CONTROL / TEAM','Administrators','Manage who is authorised to access the ONLYUSLABS workspace.',`<button class="admin-btn primary" id="addAdmin">＋ Add administrator</button>`)}<div class="note-box warning">Adding an email here grants application access only after that person also has a Supabase Auth user. Create or invite their account in Supabase → Authentication → Users. Never share the owner password.</div><div class="admin-table-wrap"><table class="admin-table"><thead><tr><th>ADMINISTRATOR</th><th>ROLE</th><th>ACCESS</th><th>ADDED</th><th>ACTIONS</th></tr></thead><tbody>${rows}</tbody></table></div><div class="settings-card" style="margin-top:15px"><span class="admin-eyebrow">ROLE DEFINITIONS</span><p style="font-size:10px;color:#748076;line-height:1.8;margin-bottom:0"><b>Owner:</b> full access, including administrator management. <b>Admin:</b> CRM, content, media and settings. <b>Editor:</b> content and media management; no CRM or settings access.</p></div>`;
  $('#addAdmin').addEventListener('click',()=>openAdminEditor());
  app.onclick=async event=>{const toggle=event.target.closest('[data-action="toggle-admin"]');const remove=event.target.closest('[data-action="remove-admin"]');if(toggle){const active=toggle.dataset.active!=='true';const {error}=await supabase.from('admin_users').update({active}).eq('email',toggle.dataset.email);if(error){toast(error.message,'error');return;}await logAction(active?'activated':'deactivated','admin_user',toggle.dataset.email);toast('Administrator access updated.');await setView('admins');}if(remove&&confirm(`Remove access for ${remove.dataset.email}?`)){const {error}=await supabase.from('admin_users').delete().eq('email',remove.dataset.email);if(error){toast(error.message,'error');return;}await logAction('removed','admin_user',remove.dataset.email);toast('Administrator removed.');await setView('admins');}};
}
function openAdminEditor(){openModal('Add administrator',`<form id="adminEditorForm"><div class="editor-grid"><label class="cms-field wide"><span>EMAIL ADDRESS</span><input name="email" type="email" required placeholder="colleague@company.com"></label><label class="cms-field"><span>DISPLAY NAME</span><input name="display_name" placeholder="Team member"></label><label class="cms-field"><span>ROLE</span><select name="role"><option value="admin">Admin — CRM, content & settings</option><option value="editor">Editor — content & media only</option></select></label></div><div class="note-box warning">Before this person can sign in, create their user in Supabase Authentication. The account email must match exactly.</div><div class="editor-actions"><span></span><div><button class="admin-btn" type="button" data-modal-close>Cancel</button><button class="admin-btn primary" type="submit">Add access</button></div></div></form>`);$('#adminEditorForm').addEventListener('submit',async e=>{e.preventDefault();const f=new FormData(e.currentTarget);const email=String(f.get('email')).trim().toLowerCase();const {error}=await supabase.from('admin_users').insert({email,display_name:f.get('display_name')||email,role:f.get('role'),active:true});if(error){toast(error.message,'error');return;}await logAction('added','admin_user',email,{role:f.get('role')});closeModal();toast('Administrator access added. Create their Supabase Auth user before they sign in.');await setView('admins');});}

function renderSecurity(){app.innerHTML=`${pageHeading('ACCOUNT / SECURITY','Account security','Manage your current sign-in password and review important security settings.')}
  <div class="settings-layout"><section class="settings-card"><span class="admin-eyebrow">SIGNED-IN ACCOUNT</span><h3>Administrator identity</h3><div class="industry-stats"><div><span>Email</span><b style="font-size:10px">${esc(state.user.email)}</b></div><div><span>Role</span><b>${esc(state.role.toUpperCase())}</b></div><div><span>Last sign in</span><b>${dateFmt(state.user.last_sign_in_at,true)}</b></div></div><div class="note-box">For stronger protection, enable multi-factor authentication (MFA) for this user in Supabase Authentication settings.</div></section><section class="settings-card"><span class="admin-eyebrow">PASSWORD MANAGEMENT</span><h3>Change password</h3><form id="passwordForm"><label class="cms-field"><span>NEW PASSWORD</span><input name="password" type="password" minlength="12" autocomplete="new-password" required><small class="field-hint">Use at least 12 characters with a mix of words, numbers and symbols.</small></label><label class="cms-field"><span>CONFIRM NEW PASSWORD</span><input name="confirm" type="password" minlength="12" autocomplete="new-password" required></label><button class="admin-btn primary" type="submit">Update password</button></form></section></div>`;
  $('#passwordForm').addEventListener('submit',async e=>{e.preventDefault();const f=new FormData(e.currentTarget);if(f.get('password')!==f.get('confirm')){toast('The passwords do not match.','error');return;}const {error}=await supabase.auth.updateUser({password:f.get('password')});if(error){toast(error.message,'error');return;}await logAction('changed','account_password');e.currentTarget.reset();toast('Password updated successfully.');});
}
function renderActivity(){const filtered=state.activity.filter(x=>[x.action,x.entity_type,x.user_email,JSON.stringify(x.details||{})].join(' ').toLowerCase().includes(state.search));const rows=filtered.map(x=>`<tr><td><strong>${esc(x.action)}</strong><small>${esc(x.entity_type||'system')}</small></td><td>${esc(x.user_email||'—')}</td><td>${esc(x.details?.title||x.details?.file_name||x.entity_id||'—')}</td><td>${dateFmt(x.created_at,true)}</td></tr>`).join('');app.innerHTML=`${pageHeading('AUDIT / OPERATIONS','Activity log','A record of administrator actions across enquiries, content, settings, media and access control.')}<div class="table-toolbar"><div><span class="admin-eyebrow">LATEST 200 EVENTS</span><p style="margin:4px 0 0;font-size:10px;color:#879187">${filtered.length} matching events</p></div><button class="admin-btn" id="refreshActivity">↻ Refresh</button></div><div class="admin-table-wrap"><table class="admin-table"><thead><tr><th>ACTION</th><th>USER</th><th>DETAIL</th><th>DATE / TIME</th></tr></thead><tbody>${rows||`<tr><td colspan="4">${emptyState('No activity recorded','Changes made in this admin workspace will be logged here.')}</td></tr>`}</tbody></table></div>`;$('#refreshActivity').addEventListener('click',()=>setView('activity'));}

function renderCurrent(){if(state.view==='leads')renderLeads();else if(VIEW_TYPES[state.view])renderContent();else if(state.view==='media')renderMedia();else if(state.view==='activity')renderActivity();}

boot();
