(function(g){
'use strict';const key='ga-portal-theme',root=document.documentElement;const moon='<svg class="theme-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" aria-hidden="true"><path d="M20 15.5A8 8 0 0 1 8.5 4 8.2 8.2 0 1 0 20 15.5Z"/></svg>',sun='<svg class="theme-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" aria-hidden="true"><circle cx="12" cy="12" r="3.5"/><path d="M12 2v3m0 14v3M2 12h3m14 0h3M5 5l2 2m10 10 2 2M5 19l2-2M17 7l2-2"/></svg>';
let stored='';try{stored=localStorage.getItem(key)||'';}catch{}
const media=g.matchMedia?.('(prefers-color-scheme: dark)');
function apply(theme){const dark=theme==='dark';root.dataset.theme=dark?'dark':'light';root.style.colorScheme=dark?'dark':'light';document.body?.classList.toggle('dark',dark);document.querySelector('meta[name="theme-color"]')?.setAttribute('content',dark?'#181e25':'#f3f5f7');document.querySelectorAll('[data-theme-toggle],#themeToggle').forEach(b=>{b.innerHTML=dark?sun:moon;b.setAttribute('aria-pressed',String(dark));b.setAttribute('aria-label',dark?'Gunakan mode terang':'Gunakan mode gelap');b.title=dark?'Gunakan mode terang':'Gunakan mode gelap';});}
function set(theme){stored=theme;try{localStorage.setItem(key,theme);}catch{}apply(theme);}
apply(stored|| (media?.matches?'dark':'light'));
document.addEventListener('DOMContentLoaded',()=>{apply(root.dataset.theme);document.querySelectorAll('[data-theme-toggle],#themeToggle').forEach(b=>b.addEventListener('click',()=>set(root.dataset.theme==='dark'?'light':'dark')));requestAnimationFrame(()=>requestAnimationFrame(()=>root.classList.add('theme-ready')));});
g.addEventListener('storage',event=>{if(event.key===key){stored=event.newValue||'';apply(stored||(media?.matches?'dark':'light'));}});
media?.addEventListener?.('change',()=>{if(!stored)apply(media.matches?'dark':'light');});
g.GATema=Object.freeze({set,get value(){return root.dataset.theme;}});
})(window);
