(() => {
 const header=document.getElementById('siteHeader');
 const menu=document.getElementById('menuToggle');
 const nav=document.getElementById('mainNav');
 const onScroll=()=>{if(header)header.classList.toggle('scrolled',window.scrollY>24)};
 window.addEventListener('scroll',onScroll,{passive:true});onScroll();
 if(menu&&nav){menu.addEventListener('click',()=>{const open=nav.classList.toggle('open');menu.setAttribute('aria-expanded',String(open));});}
 document.querySelectorAll('a[href^="#"]').forEach(a=>a.addEventListener('click',e=>{const el=document.querySelector(a.getAttribute('href'));if(el){e.preventDefault();el.scrollIntoView({behavior:'smooth'});}}));
})();
