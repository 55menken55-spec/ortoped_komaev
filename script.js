/* Komaev site - vanilla JS with localStorage persistence */

const DEFAULT_SERVICES = [
  { id: 's1', title: 'Первичный приём', duration: '15 мин.', price: '4500 RUB', desc: 'Осмотр, плантоскопия, измерение длины ног, рекомендации. Входит диагностика на аппарате.', order: 1 },
  { id: 's2', title: 'Изготовление стелек с 35 размера', duration: '30 мин.', price: '9500 RUB', desc: 'Индивидуальные стельки для взрослых и подростков от 35 размера. Формовка с нагревом на приёме.', order: 2 },
  { id: 's3', title: 'Изготовление стелек до 34 размера', duration: '15 мин.', price: '8500 RUB', desc: 'Детские стельки до 34 размера включительно. Мягкая коррекция с учётом роста.', order: 3 },
  { id: 's4', title: 'Стельки спортивные', duration: '15 мин.', price: '14000 RUB', desc: 'Для бега, футбола, единоборств. Повышенная амортизация и стабилизация.', order: 4 },
  { id: 's5', title: 'Повторный приём', duration: '15 мин.', price: '2500 RUB', desc: 'Контроль динамики, оценка износа стелек, ответы на вопросы.', order: 5 },
  { id: 's6', title: 'Коррекция стелек', duration: '30 мин.', price: '4500 RUB', desc: 'Подклейка клиньев, изменение высоты свода после периода адаптации.', order: 6 },
];

const DEFAULT_GALLERIES = {
  hero: [],
  about: [],
  priem: [],
  konsult: [],
  stelki: [],
  dinamika: [],
  contacts: []
};

let services = [];
let galleries = {};
let isAdmin = false;

function loadData(){
  try{
    const s = localStorage.getItem('komaev_services');
    services = s ? JSON.parse(s) : [...DEFAULT_SERVICES];
  }catch{ services = [...DEFAULT_SERVICES]; }
  try{
    const g = localStorage.getItem('komaev_galleries');
    galleries = g ? JSON.parse(g) : JSON.parse(JSON.stringify(DEFAULT_GALLERIES));
    // ensure keys
    for(let k of Object.keys(DEFAULT_GALLERIES)) if(!galleries[k]) galleries[k]=[];
  }catch{ galleries = JSON.parse(JSON.stringify(DEFAULT_GALLERIES)); }
  isAdmin = localStorage.getItem('komaev_admin') === 'true';
  document.body.classList.toggle('admin-mode', isAdmin);
  document.getElementById('adminBar')?.classList.toggle('hidden', !isAdmin);
}

function saveServices(){ localStorage.setItem('komaev_services', JSON.stringify(services)); }
function saveGalleries(){ localStorage.setItem('komaev_galleries', JSON.stringify(galleries)); }

function renderServices(){
  const grid = document.getElementById('servicesGrid');
  if(!grid) return;
  const sorted = [...services].sort((a,b)=> (a.order||99)-(b.order||99));
  grid.innerHTML = sorted.map(s=>`
    <div class="service-card" data-id="${s.id}">
      <div class="top">
        <div class="num">${String(s.order).padStart(2,'0')}</div>
        <div class="time">${s.duration}</div>
      </div>
      <h3>${escapeHtml(s.title)}</h3>
      <div class="desc">${escapeHtml(s.desc||'')}</div>
      <div class="price">${escapeHtml(s.price)} <span>за приём / пару</span></div>
      ${isAdmin? `<div class="actions">
        <button class="btn btn-small btn-outline" onclick="editService('${s.id}')">Редактировать</button>
        <button class="btn btn-small btn-red" onclick="deleteService('${s.id}')">Удалить</button>
      </div>`:''}
    </div>
  `).join('');
}

function renderGallery(name){
  const containerId = {
    hero:'heroGallery',
    about:'aboutGallery',
    priem:'gallery-priem',
    konsult:'gallery-konsult',
    stelki:'gallery-stelki',
    dinamika:'gallery-dinamika',
    contacts:'gallery-contacts'
  }[name];
  const el = document.getElementById(containerId);
  if(!el) return;
  const items = galleries[name] || [];
  if(items.length===0){
    el.innerHTML = `<div class="ph" style="display:grid;place-items:center;padding:20px;text-align:center;min-height:120px">
      <div><div style="font-weight:800">Нет фото</div><small style="color:#888">${isAdmin? 'Нажмите + Добавить фото' : 'Фото появятся позже'}</small></div>
    </div>`;
    return;
  }
  el.innerHTML = items.map((it, idx)=>`
    <div class="ph" onclick="openPhoto('${name}', ${idx})">
      <img src="${it.src}" alt="${escapeHtml(it.caption||'')}" loading="lazy" decoding="async">
      ${it.caption? `<div class="meta"><span>${escapeHtml(it.caption)}</span></div>`:''}
      ${isAdmin? `<button class="del" onclick="event.stopPropagation(); deletePhoto('${name}', ${idx})">✕</button>`:''}
    </div>
  `).join('');
}

function renderAllGalleries(){
  ['hero','about','priem','konsult','stelki','dinamika','contacts'].forEach(renderGallery);
}

function escapeHtml(str){
  if(!str) return '';
  return str.replace(/[&<>"']/g, m=>({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));
}

/* Admin - Services */
function openServiceModal(id=null){
  if(document.getElementById('serviceModal').classList.contains('hidden')) lockScroll();
  document.getElementById('serviceModal').classList.remove('hidden');
  if(id){
    const s = services.find(x=>x.id===id);
    if(!s) return;
    document.getElementById('modalTitle').textContent='Редактировать услугу';
    document.getElementById('svcId').value=s.id;
    document.getElementById('svcTitle').value=s.title;
    document.getElementById('svcDuration').value=s.duration;
    document.getElementById('svcPrice').value=s.price;
    document.getElementById('svcDesc').value=s.desc||'';
    document.getElementById('svcOrder').value=s.order;
  }else{
    document.getElementById('modalTitle').textContent='Добавить услугу';
    document.getElementById('svcId').value='';
    document.getElementById('svcTitle').value='';
    document.getElementById('svcDuration').value='';
    document.getElementById('svcPrice').value='';
    document.getElementById('svcDesc').value='';
    document.getElementById('svcOrder').value=services.length+1;
  }
}
function closeServiceModal(){
  const m = document.getElementById('serviceModal');
  if(m && !m.classList.contains('hidden')) unlockScroll();
  m?.classList.add('hidden');
}
function editService(id){ openServiceModal(id); }
function saveService(){
  const id = document.getElementById('svcId').value || 's'+Date.now();
  const title = document.getElementById('svcTitle').value.trim();
  if(!title){ alert('Введите название'); return; }
  const duration = document.getElementById('svcDuration').value.trim() || '15 мин.';
  const price = document.getElementById('svcPrice').value.trim() || '0 RUB';
  const desc = document.getElementById('svcDesc').value.trim();
  const order = parseInt(document.getElementById('svcOrder').value) || 99;
  const existingIdx = services.findIndex(s=>s.id===id);
  const obj = { id, title, duration, price, desc, order };
  if(existingIdx>=0) services[existingIdx]=obj; else services.push(obj);
  saveServices();
  renderServices();
  closeServiceModal();
}
function deleteService(id){
  if(!confirm('Удалить услугу?')) return;
  services = services.filter(s=>s.id!==id);
  saveServices();
  renderServices();
}

/* Admin - Photos */
function handleUpload(e, galleryName){
  const files = e.target.files;
  if(!files || !files.length) return;
  const promises = Array.from(files).map(file=>{
    return new Promise(res=>{
      const reader = new FileReader();
      reader.onload = ev=> res({ src: ev.target.result, caption: file.name.replace(/\.[^/.]+$/, ''), name: file.name });
      reader.readAsDataURL(file);
    });
  });
  Promise.all(promises).then(results=>{
    galleries[galleryName] = [...(galleries[galleryName]||[]), ...results];
    saveGalleries();
    renderGallery(galleryName);
    // clear input
    e.target.value='';
  });
}
function deletePhoto(galleryName, idx){
  if(!confirm('Удалить фото?')) return;
  galleries[galleryName].splice(idx,1);
  saveGalleries();
  renderGallery(galleryName);
}

/* Photo modal */
function openPhoto(galleryName, idx){
  const item = galleries[galleryName][idx];
  if(!item) return;
  document.getElementById('photoModalImg').src = item.src;
  document.getElementById('photoModalCaption').textContent = item.caption||'';
  lockScroll();
  document.getElementById('photoModal').classList.remove('hidden');
}
function closePhotoModal(){
  const m = document.getElementById('photoModal');
  if(m && !m.classList.contains('hidden')) unlockScroll();
  m?.classList.add('hidden');
}

/* Admin toggle via console */
function enableAdmin(){
  localStorage.setItem('komaev_admin','true');
  location.reload();
}
function disableAdmin(){
  localStorage.removeItem('komaev_admin');
  location.reload();
}
function adminLogin(pwd){
  // simple protection: if you want password, set it here. For now any call enables.
  // You can change to require password: if(pwd!=='komaev2024') return alert('Неверный пароль');
  if(pwd && pwd!=='komaev2024' && pwd!=='admin'){
    console.warn('Подсказка: пароль по умолчанию komaev2024 или admin, но сейчас пускаю без пароля для теста');
  }
  enableAdmin();
}
function admin(){ enableAdmin(); }

function showAdminHelp(){
  alert(`Как войти в режим администратора (через консоль):

1. Откройте сайт и нажмите F12 (или Ctrl+Shift+J / Cmd+Option+J)
2. Перейдите во вкладку Console
3. Введите команду: admin()  или  enableAdmin()  и нажмите Enter
4. Страница перезагрузится и появится черная панель админки сверху

Для выхода: нажмите "Выйти из админки" или в консоли disableAdmin()

Пароль (если спросит): komaev2024

В админке вы можете:
- Добавлять/редактировать/удалять услуги и цены
- Добавлять фото в разделы: Приём, Консультация, Стельки, Динамика
- Удалять фото (крестик на фото)
- Сбросить всё к дефолту

Данные сохраняются в localStorage браузера.
`);
}

function resetData(){
  if(!confirm('Сбросить все услуги и фото к изначальным?')) return;
  localStorage.removeItem('komaev_services');
  localStorage.removeItem('komaev_galleries');
  location.reload();
}

/* ---------- Mobile: scroll lock, burger menu, modal handling ---------- */
let _scrollY = 0;
let _lockCount = 0;

function lockScroll(){
  if(_lockCount === 0){
    _scrollY = window.scrollY || window.pageYOffset || 0;
    document.body.style.top = `-${_scrollY}px`;
    document.body.classList.add('no-scroll');
  }
  _lockCount++;
}
function unlockScroll(){
  _lockCount = Math.max(0, _lockCount - 1);
  if(_lockCount === 0 && document.body.classList.contains('no-scroll')){
    document.body.classList.remove('no-scroll');
    document.body.style.top = '';
    window.scrollTo(0, _scrollY);
  }
}

const burgerBtn = document.getElementById('burger');
const mobileMenu = document.getElementById('mobileMenu');

function setMenu(open){
  if(!burgerBtn || !mobileMenu) return;
  mobileMenu.classList.toggle('open', open);
  burgerBtn.setAttribute('aria-expanded', open ? 'true' : 'false');
  burgerBtn.setAttribute('aria-label', open ? 'Закрыть меню' : 'Открыть меню');
  mobileMenu.setAttribute('aria-hidden', open ? 'false' : 'true');
  if(open) lockScroll(); else unlockScroll();
}

burgerBtn?.addEventListener('click', ()=>{
  setMenu(!mobileMenu.classList.contains('open'));
});

/* close the menu after tapping any link inside it */
mobileMenu?.addEventListener('click', (e)=>{
  const link = e.target.closest('a');
  if(link) setMenu(false);
});

/* close the menu when the screen grows past the mobile breakpoint */
const mobileQuery = window.matchMedia('(max-width:1000px)');
(mobileQuery.addEventListener ? mobileQuery.addEventListener('change', onBreakpoint) : mobileQuery.addListener(onBreakpoint));
function onBreakpoint(e){ if(!e.matches) setMenu(false); }

/* Escape closes menu / modals */
document.addEventListener('keydown', (e)=>{
  if(e.key !== 'Escape') return;
  if(!document.getElementById('photoModal')?.classList.contains('hidden')){ closePhotoModal(); return; }
  if(!document.getElementById('serviceModal')?.classList.contains('hidden')){ closeServiceModal(); return; }
  if(mobileMenu?.classList.contains('open')) setMenu(false);
});

/* Swipe down / tap outside to dismiss the photo viewer */
(function(){
  const modal = document.getElementById('photoModal');
  if(!modal) return;
  let startY = null;
  modal.addEventListener('touchstart', (e)=>{ startY = e.touches[0].clientY; }, {passive:true});
  modal.addEventListener('touchend', (e)=>{
    if(startY === null) return;
    const dy = e.changedTouches[0].clientY - startY;
    if(dy > 80) closePhotoModal();
    startY = null;
  }, {passive:true});
})();

/* Init */
loadData();
renderServices();
renderAllGalleries();

// expose to console
window.enableAdmin = enableAdmin;
window.disableAdmin = disableAdmin;
window.adminLogin = adminLogin;
window.admin = admin;
window.openServiceModal = openServiceModal;
window.closeServiceModal = closeServiceModal;
window.editService = editService;
window.saveService = saveService;
window.deleteService = deleteService;
window.handleUpload = handleUpload;
window.deletePhoto = deletePhoto;
window.openPhoto = openPhoto;
window.closePhotoModal = closePhotoModal;
window.showAdminHelp = showAdminHelp;
window.resetData = resetData;

console.log('%cКомаев — админка','color:white;background:#E30613;padding:8px 14px;border-radius:8px;font-weight:800;font-size:14px');
console.log('Введите admin() чтобы включить режим администратора. Подробнее — showAdminHelp()');
