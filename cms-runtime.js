import { supabase, SUPABASE_CONFIGURED } from './supabase-client.js';

const path = window.location.pathname.endsWith('/') ? window.location.pathname : `${window.location.pathname}/`;
const slug = path.replace(/^\/+|\/+$/g,'').split('/').pop() || 'home';
const escUrl = value => String(value||'').trim();
function metaTag(name, content, property=false) {
  if(!content)return;const selector=property?`meta[property="${name}"]`:`meta[name="${name}"]`;
  let el=document.querySelector(selector);if(!el){el=document.createElement('meta');if(property)el.setAttribute('property',name);else el.setAttribute('name',name);document.head.appendChild(el);}el.setAttribute('content',content);
}
function addParagraphContent(main,item) {
  if(!item.body&&!item.featured_image_url)return;
  const section=document.createElement('section');section.className='section-pad cms-runtime-section';
  const inner=document.createElement('div');inner.className='cms-runtime-inner';
  if(item.featured_image_url){const img=document.createElement('img');img.src=safeHttpUrl(item.featured_image_url);img.alt=item.title||'ONLYUSLABS';img.loading='lazy';img.className='cms-runtime-image';inner.appendChild(img);}
  if(item.body){const body=document.createElement('div');body.className='cms-runtime-copy';String(item.body).split(/\n\s*\n/).map(x=>x.trim()).filter(Boolean).forEach(text=>{const p=document.createElement('p');p.textContent=text;body.appendChild(p);});inner.appendChild(body);}
  section.appendChild(inner);main.appendChild(section);
}
function safeInternalRoute(value) { const route=String(value||''); return route.startsWith('/') && !route.startsWith('//') ? route : ''; }
function safeHttpUrl(value) { const url=String(value||''); return /^https?:\/\//i.test(url) ? url : ''; }
function addListing(main,items,heading) {
  if(!items?.length)return;
  const section=document.createElement('section');section.className='section-pad cms-runtime-listing';
  const h2=document.createElement('h2');h2.textContent=heading;section.appendChild(h2);
  const grid=document.createElement('div');grid.className='cms-runtime-grid';
  items.forEach(item=>{const card=document.createElement('article');card.className='cms-runtime-card';if(item.featured_image_url){const img=document.createElement('img');img.src=safeHttpUrl(item.featured_image_url);img.alt=item.title||'';img.loading='lazy';card.appendChild(img);}const tag=document.createElement('span');tag.textContent=item.category||item.content_type.replace('_',' ');const title=document.createElement('h3');title.textContent=item.title;const excerpt=document.createElement('p');excerpt.textContent=item.excerpt||'';card.append(tag,title,excerpt);if(item.body){const detail=document.createElement('p');detail.textContent=item.body;card.appendChild(detail);}if(safeInternalRoute(item.route)){const a=document.createElement('a');a.href=safeInternalRoute(item.route);a.textContent='Explore ↗';card.appendChild(a);}grid.appendChild(card);});
  section.appendChild(grid);main.appendChild(section);
}
async function run() {
  if(!SUPABASE_CONFIGURED||!supabase)return;
  const main=document.querySelector('main');if(!main)return;
  try {
    const {data:settingsData}=await supabase.from('site_settings').select('settings').eq('id','global').maybeSingle();
    const settings=settingsData?.settings||{};
    if(settings.company_name){const footerBrand=document.querySelector('.footer-brand-block .brand-word');if(footerBrand)footerBrand.textContent=settings.company_name;}
    if(settings.contact_email){document.querySelectorAll('.footer-email').forEach(el=>{el.textContent=settings.contact_email;});const emailMethod=document.querySelector('.contact-method');if(emailMethod&&emailMethod.children[1]){const a=document.createElement('a');a.href=`mailto:${settings.contact_email}`;a.textContent=settings.contact_email;emailMethod.children[1].replaceWith(a);}}
    if(settings.phone){const phoneLink=document.querySelector('.contact-method a[href^="https://wa.me/"]');if(phoneLink)phoneLink.textContent=`${settings.phone} ↗`;}
    if(settings.whatsapp){document.querySelectorAll('a[href*="wa.me/"]').forEach(a=>{const u=new URL(a.href);u.pathname='/'+String(settings.whatsapp).replace(/\D/g,'');a.href=u.toString();});}
    const {data:item}=await supabase.from('content_items').select('*').eq('route',path).eq('status','published').limit(1).maybeSingle();
    if(item){if(item.title){const h1=main.querySelector('h1');if(h1)h1.textContent=item.title;document.title=item.seo_title||`${item.title} — ${settings.company_name||'ONLYUSLABS'}`;}if(item.excerpt){const lead=main.querySelector('h1')?.parentElement?.querySelector('p')||main.querySelector('p');if(lead)lead.textContent=item.excerpt;}if(item.seo_description)metaTag('description',item.seo_description);if(item.seo_keywords)metaTag('keywords',item.seo_keywords);if(item.seo_title)metaTag('og:title',item.seo_title,true);if(item.seo_description)metaTag('og:description',item.seo_description,true);addParagraphContent(main,item);}
    const collections={
      '/insights/':{type:'insight',heading:'Latest insights'},
      '/case-studies/':{type:'case_study',heading:'Published case studies'},
      '/solutions/':{type:'service',heading:'Explore our services'},
      '/industries/':{type:'industry',heading:'Explore industries'},
      '/healthcare/':{type:'healthcare',heading:'Healthcare automation resources'}
    };
    if(collections[path]){const c=collections[path];const {data:items}=await supabase.from('content_items').select('content_type,title,route,excerpt,body,category,featured_image_url').eq('content_type',c.type).eq('status','published').order('sort_order',{ascending:true}).order('published_at',{ascending:false}).limit(30);addListing(main,items,c.heading);}
    if(path==='/' || path==='/contact/'){const [{data:testimonials},{data:faqs}]=await Promise.all([supabase.from('content_items').select('content_type,title,route,excerpt,body,category,featured_image_url').eq('content_type','testimonial').eq('status','published').order('sort_order',{ascending:true}).limit(12),supabase.from('content_items').select('content_type,title,route,excerpt,body,category,featured_image_url').eq('content_type','faq').eq('status','published').order('sort_order',{ascending:true}).limit(12)]);if(testimonials?.length)addListing(main,testimonials,'What clients value');if(faqs?.length)addListing(main,faqs,'Frequently asked questions');}
  } catch(error) { console.warn('ONLYUSLABS CMS runtime:',error); }
}
run();
