/* ==========================================================================
   Komaev Site - Frontend Logic with Supabase Database & Storage Integration
   ========================================================================== */

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
let isSupabaseActive = false;

/* ---------- Toast Notification System ---------- */
let _toastTimer = null;
function showToast(message, type = 'info', duration = 3500) {
  const toast = document.getElementById('toastNotification');
  const msgEl = document.getElementById('toastMessage');
  const iconEl = document.getElementById('toastIcon');
  if (!toast || !msgEl) return;

  clearTimeout(_toastTimer);
  toast.classList.remove('hidden', 'success', 'error');

  let icon = 'ℹ️';
  if (type === 'success') {
    toast.classList.add('success');
    icon = '✅';
  } else if (type === 'error') {
    toast.classList.add('error');
    icon = '❌';
  } else if (type === 'loading') {
    icon = '⏳';
  }

  if (iconEl) iconEl.textContent = icon;
  msgEl.textContent = message;

  if (duration > 0) {
    _toastTimer = setTimeout(() => {
      toast.classList.add('hidden');
    }, duration);
  }
}

function hideToast() {
  const toast = document.getElementById('toastNotification');
  if (toast) toast.classList.add('hidden');
}

/* ---------- Data Loading & Persistence ---------- */
async function loadData() {
  isAdmin = localStorage.getItem('komaev_admin') === 'true';
  document.body.classList.toggle('admin-mode', isAdmin);
  document.getElementById('adminBar')?.classList.toggle('hidden', !isAdmin);

  // Initialize galleries from blank template
  galleries = JSON.parse(JSON.stringify(DEFAULT_GALLERIES));

  // 1. Check Supabase Configuration
  isSupabaseActive = Boolean(window.komaevSupabase && window.komaevSupabase.isConfigured());
  updateSupabaseStatusUI(isSupabaseActive);

  if (isSupabaseActive) {
    try {
      // Load photos from Supabase Database
      const remotePhotos = await window.komaevSupabase.fetchPhotos();
      if (Array.isArray(remotePhotos)) {
        // Reset galleries
        for (let k of Object.keys(DEFAULT_GALLERIES)) galleries[k] = [];
        for (let p of remotePhotos) {
          const galleryKey = p.gallery || 'priem';
          if (!galleries[galleryKey]) galleries[galleryKey] = [];
          galleries[galleryKey].push({
            id: p.id,
            src: p.url,
            caption: p.caption || '',
            storage_path: p.storage_path || '',
            name: p.caption || '',
            order: p.display_order || 0,
            created_at: p.created_at
          });
        }
        renderAllGalleries();
      }

      // Try loading services from Supabase
      const remoteServices = await window.komaevSupabase.fetchServices();
      if (Array.isArray(remoteServices) && remoteServices.length > 0) {
        services = remoteServices;
      } else {
        loadLocalServices();
      }
      renderServices();
      return;
    } catch (err) {
      console.warn('Could not load data from Supabase, falling back to local:', err);
      showToast('Supabase временно недоступен, данные загружены локально', 'error', 4000);
    }
  }

  // Fallback to local storage
  loadLocalData();
  renderServices();
  renderAllGalleries();
}

function loadLocalServices() {
  try {
    const s = localStorage.getItem('komaev_services');
    services = s ? JSON.parse(s) : [...DEFAULT_SERVICES];
  } catch {
    services = [...DEFAULT_SERVICES];
  }
}

function loadLocalData() {
  loadLocalServices();
  try {
    const g = localStorage.getItem('komaev_galleries');
    galleries = g ? JSON.parse(g) : JSON.parse(JSON.stringify(DEFAULT_GALLERIES));
    for (let k of Object.keys(DEFAULT_GALLERIES)) {
      if (!galleries[k]) galleries[k] = [];
    }
  } catch {
    galleries = JSON.parse(JSON.stringify(DEFAULT_GALLERIES));
  }
}

function saveServices() {
  localStorage.setItem('komaev_services', JSON.stringify(services));
}

function saveGalleries() {
  localStorage.setItem('komaev_galleries', JSON.stringify(galleries));
}

function updateSupabaseStatusUI(connected) {
  const badge = document.getElementById('supabaseStatusBadge');
  const footerStatus = document.getElementById('footerDbStatus');
  const hint = document.getElementById('adminBarHint');

  if (badge) {
    if (connected) {
      badge.textContent = '🟢 Supabase: подключен';
      badge.className = 'badge-status status-connected';
      badge.title = 'Фото и данные сохраняются в базу данных Supabase';
    } else {
      badge.textContent = '⚪ Supabase: не подключен';
      badge.className = 'badge-status status-local';
      badge.title = 'Фото сохраняются локально в браузере. Нажмите «База данных Supabase» для подключения';
    }
  }

  if (footerStatus) {
    footerStatus.textContent = connected
      ? 'База данных: Supabase Database & Storage (онлайн)'
      : 'Локальный режим (localStorage браузера). Подключите Supabase в админке.';
  }

  if (hint) {
    hint.textContent = connected
      ? 'Фото загружаются в облачную базу данных Supabase и хранятся на сервере для всех посетителей.'
      : 'Фото добавляются кнопками в каждом разделе. Для облачного сохранения подключите базу данных Supabase.';
  }
}

/* ---------- Rendering UI ---------- */
function renderServices() {
  const grid = document.getElementById('servicesGrid');
  if (!grid) return;
  const sorted = [...services].sort((a, b) => (a.order || 99) - (b.order || 99));
  grid.innerHTML = sorted.map(s => `
    <div class="service-card" data-id="${s.id}">
      <div class="top">
        <div class="num">${String(s.order).padStart(2, '0')}</div>
        <div class="time">${escapeHtml(s.duration)}</div>
      </div>
      <h3>${escapeHtml(s.title)}</h3>
      <div class="desc">${escapeHtml(s.desc || '')}</div>
      <div class="price">${escapeHtml(s.price)} <span>за приём / пару</span></div>
      ${isAdmin ? `<div class="actions">
        <button class="btn btn-small btn-outline" onclick="editService('${s.id}')">Редактировать</button>
        <button class="btn btn-small btn-red" onclick="deleteService('${s.id}')">Удалить</button>
      </div>` : ''}
    </div>
  `).join('');
}

function renderGallery(name) {
  const containerId = {
    hero: 'heroGallery',
    about: 'aboutGallery',
    priem: 'gallery-priem',
    konsult: 'gallery-konsult',
    stelki: 'gallery-stelki',
    dinamika: 'gallery-dinamika',
    contacts: 'gallery-contacts'
  }[name];
  const el = document.getElementById(containerId);
  if (!el) return;
  const items = galleries[name] || [];
  if (items.length === 0) {
    el.innerHTML = `<div class="ph" style="display:grid;place-items:center;padding:20px;text-align:center;min-height:120px">
      <div><div style="font-weight:800">Нет фото</div><small style="color:#888">${isAdmin ? 'Нажмите + Добавить фото' : 'Фото появятся позже'}</small></div>
    </div>`;
    return;
  }
  el.innerHTML = items.map((it, idx) => `
    <div class="ph" onclick="openPhoto('${name}', ${idx})">
      <img src="${it.src}" alt="${escapeHtml(it.caption || '')}" loading="lazy" decoding="async">
      ${it.caption ? `<div class="meta"><span>${escapeHtml(it.caption)}</span></div>` : ''}
      ${isAdmin ? `<button class="del" onclick="event.stopPropagation(); deletePhoto('${name}', ${idx})" title="Удалить фото">✕</button>` : ''}
    </div>
  `).join('');
}

function renderAllGalleries() {
  ['hero', 'about', 'priem', 'konsult', 'stelki', 'dinamika', 'contacts'].forEach(renderGallery);
}

function escapeHtml(str) {
  if (!str) return '';
  return String(str).replace(/[&<>"']/g, m => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[m]));
}

/* ---------- Admin: Services Modal ---------- */
function openServiceModal(id = null) {
  if (document.getElementById('serviceModal').classList.contains('hidden')) lockScroll();
  document.getElementById('serviceModal').classList.remove('hidden');
  if (id) {
    const s = services.find(x => x.id === id);
    if (!s) return;
    document.getElementById('modalTitle').textContent = 'Редактировать услугу';
    document.getElementById('svcId').value = s.id;
    document.getElementById('svcTitle').value = s.title;
    document.getElementById('svcDuration').value = s.duration;
    document.getElementById('svcPrice').value = s.price;
    document.getElementById('svcDesc').value = s.desc || '';
    document.getElementById('svcOrder').value = s.order;
  } else {
    document.getElementById('modalTitle').textContent = 'Добавить услугу';
    document.getElementById('svcId').value = '';
    document.getElementById('svcTitle').value = '';
    document.getElementById('svcDuration').value = '';
    document.getElementById('svcPrice').value = '';
    document.getElementById('svcDesc').value = '';
    document.getElementById('svcOrder').value = services.length + 1;
  }
}

function closeServiceModal() {
  const m = document.getElementById('serviceModal');
  if (m && !m.classList.contains('hidden')) unlockScroll();
  m?.classList.add('hidden');
}

function editService(id) {
  openServiceModal(id);
}

async function saveService() {
  const id = document.getElementById('svcId').value || 's' + Date.now();
  const title = document.getElementById('svcTitle').value.trim();
  if (!title) { alert('Введите название'); return; }
  const duration = document.getElementById('svcDuration').value.trim() || '15 мин.';
  const price = document.getElementById('svcPrice').value.trim() || '0 RUB';
  const desc = document.getElementById('svcDesc').value.trim();
  const order = parseInt(document.getElementById('svcOrder').value) || 99;
  const existingIdx = services.findIndex(s => s.id === id);
  const obj = { id, title, duration, price, desc, order };

  if (existingIdx >= 0) services[existingIdx] = obj;
  else services.push(obj);

  saveServices();
  renderServices();
  closeServiceModal();

  if (isSupabaseActive && window.komaevSupabase) {
    try {
      await window.komaevSupabase.saveService(obj);
      showToast('Услуга сохранена в базе данных', 'success');
    } catch (e) {
      console.warn('Could not sync service to Supabase:', e);
      showToast('Услуга сохранена локально, но НЕ синхронизирована в Supabase. Откройте «⚡ База данных Supabase» и нажмите «Сохранить и проверить».', 'error', 8000);
    }
  } else {
    showToast('Услуга сохранена локально', 'info');
  }
}

async function deleteService(id) {
  if (!confirm('Удалить услугу?')) return;
  services = services.filter(s => s.id !== id);
  saveServices();
  renderServices();

  if (isSupabaseActive && window.komaevSupabase) {
    try {
      await window.komaevSupabase.deleteService(id);
      showToast('Услуга удалена из базы данных', 'success');
    } catch (e) {
      console.warn('Could not delete service from Supabase:', e);
      showToast('Услуга удалена локально, но НЕ в Supabase. Проверьте подключение в «⚡ База данных Supabase».', 'error', 7000);
    }
  }
}

/* ---------- Admin: Photos Upload & Delete with Supabase ---------- */
async function handleUpload(e, galleryName) {
  const files = e.target.files;
  if (!files || !files.length) return;

  const fileList = Array.from(files);

  // If Supabase is active, upload to cloud storage & database
  if (isSupabaseActive && window.komaevSupabase) {
    showToast(`Загрузка 1 из ${fileList.length} в Supabase...`, 'loading', 0);
    let uploadedCount = 0;
    let failedCount = 0;

    for (let i = 0; i < fileList.length; i++) {
      const file = fileList[i];
      showToast(`Загрузка ${i + 1} из ${fileList.length} в Supabase...`, 'loading', 0);

      try {
        const order = (galleries[galleryName] || []).length + 1;
        const record = await window.komaevSupabase.uploadPhoto(file, galleryName, '', order);

        if (!galleries[galleryName]) galleries[galleryName] = [];
        galleries[galleryName].push({
          id: record.id,
          src: record.url,
          storage_path: record.storage_path,
          caption: record.caption || file.name.replace(/\.[^/.]+$/, ''),
          name: file.name,
          order: record.display_order || order
        });
        uploadedCount++;
        renderGallery(galleryName);
      } catch (err) {
        console.error('Failed to upload file to Supabase:', file.name, err);
        failedCount++;
      }
    }

    e.target.value = '';

    if (failedCount === 0) {
      showToast(`✅ ${uploadedCount} фото успешно сохранено в Supabase!`, 'success', 3500);
    } else {
      showToast(`Загружено: ${uploadedCount}, ошибок: ${failedCount}. Проверьте бакет и политики RLS.`, 'error', 5000);
    }
    return;
  }

  // Fallback: Local storage upload (dataURL)
  showToast('Сохранение фото локально...', 'loading', 0);
  const promises = fileList.map(file => {
    return new Promise(res => {
      const reader = new FileReader();
      reader.onload = ev => res({
        src: ev.target.result,
        caption: file.name.replace(/\.[^/.]+$/, ''),
        name: file.name
      });
      reader.readAsDataURL(file);
    });
  });

  try {
    const results = await Promise.all(promises);
    galleries[galleryName] = [...(galleries[galleryName] || []), ...results];
    saveGalleries();
    renderGallery(galleryName);
    e.target.value = '';
    showToast('⚠️ Фото сохранены локально в браузере. Подключите Supabase для сохранения на сервере.', 'info', 4500);
  } catch (err) {
    console.error('Local upload failed:', err);
    showToast('Ошибка локального сохранения фото', 'error');
  }
}

async function deletePhoto(galleryName, idx) {
  if (!confirm('Удалить это фото?')) return;
  const item = (galleries[galleryName] || [])[idx];
  if (!item) return;

  if (isSupabaseActive && window.komaevSupabase && (item.id || item.storage_path)) {
    showToast('Удаление фото из Supabase...', 'loading', 0);
    try {
      await window.komaevSupabase.deletePhoto(item.id, item.storage_path);
      galleries[galleryName].splice(idx, 1);
      renderGallery(galleryName);
      showToast('Фото удалено из Supabase', 'success', 2500);
      return;
    } catch (err) {
      console.error('Failed to delete photo from Supabase:', err);
      showToast('Ошибка удаления из Supabase', 'error');
    }
  }

  // Local delete
  galleries[galleryName].splice(idx, 1);
  saveGalleries();
  renderGallery(galleryName);
  showToast('Фото удалено', 'info', 2000);
}

/* ---------- Supabase Admin Settings Modal ---------- */
function countLocalDataUrls() {
  let count = 0;
  for (let k of Object.keys(galleries)) {
    for (let it of (galleries[k] || [])) {
      if (it && it.src && it.src.startsWith('data:')) count++;
    }
  }
  return count;
}

function openSupabaseModal() {
  if (document.getElementById('supabaseModal').classList.contains('hidden')) lockScroll();
  document.getElementById('supabaseModal').classList.remove('hidden');

  const cfg = window.komaevSupabase ? window.komaevSupabase.getConfig() : {};
  document.getElementById('sbUrl').value = cfg.url || '';
  document.getElementById('sbAnonKey').value = cfg.anonKey || '';
  document.getElementById('sbBucket').value = cfg.bucket || 'photos';

  // Render SQL in instructions box
  const sqlBox = document.getElementById('sqlScriptBlock');
  if (sqlBox && window.SUPABASE_SQL_SETUP) {
    sqlBox.textContent = window.SUPABASE_SQL_SETUP;
  }

  // Check if there are local photos that can be migrated
  const localCount = countLocalDataUrls();
  const migrateBlock = document.getElementById('sbMigrateBlock');
  const countSpan = document.getElementById('localPhotoCount');
  if (migrateBlock && countSpan) {
    if (localCount > 0 && isSupabaseActive) {
      countSpan.textContent = localCount;
      migrateBlock.classList.remove('hidden');
    } else {
      migrateBlock.classList.add('hidden');
    }
  }

  // Services sync block: show whenever Supabase is active
  updateServicesSyncBlock();

  // Clear status box
  const statusBox = document.getElementById('sbStatusBox');
  if (statusBox) statusBox.classList.add('hidden');
}

function closeSupabaseModal() {
  const m = document.getElementById('supabaseModal');
  if (m && !m.classList.contains('hidden')) unlockScroll();
  m?.classList.add('hidden');
}

function toggleAnonKeyVisibility() {
  const input = document.getElementById('sbAnonKey');
  if (!input) return;
  input.type = input.type === 'password' ? 'text' : 'password';
}

async function saveAndTestSupabase() {
  const url = document.getElementById('sbUrl').value.trim();
  const anonKey = document.getElementById('sbAnonKey').value.trim();
  const bucket = document.getElementById('sbBucket').value.trim() || 'photos';
  const saveBtn = document.getElementById('sbSaveBtn');
  const statusBox = document.getElementById('sbStatusBox');

  if (!url || !anonKey) {
    showSbStatus('Пожалуйста, укажите Supabase Project URL и Anon Key', false);
    return;
  }

  if (saveBtn) {
    saveBtn.disabled = true;
    saveBtn.textContent = 'Проверка соединения...';
  }

  showSbStatus('Тестирование подключения к базе данных и Storage...', 'info');

  try {
    const testResult = await window.komaevSupabase.testConnection({ url, anonKey, bucket });

    if (testResult.ok) {
      window.komaevSupabase.saveConfig(url, anonKey, bucket);
      isSupabaseActive = true;
      updateSupabaseStatusUI(true);
      showSbStatus(testResult.message, true);
      showToast('✅ Supabase успешно подключен!', 'success');

      // Reload data from newly connected Supabase
      await loadData();

      // Check migration
      const localCount = countLocalDataUrls();
      const migrateBlock = document.getElementById('sbMigrateBlock');
      const countSpan = document.getElementById('localPhotoCount');
      if (migrateBlock && countSpan && localCount > 0) {
        countSpan.textContent = localCount;
        migrateBlock.classList.remove('hidden');
      }

      // Show services sync block
      updateServicesSyncBlock();
    } else {
      showSbStatus(testResult.message, false);
    }
  } catch (err) {
    showSbStatus(`Ошибка при проверке подключения: ${err.message}`, false);
  } finally {
    if (saveBtn) {
      saveBtn.disabled = false;
      saveBtn.textContent = 'Сохранить и проверить';
    }
  }
}

function showSbStatus(msg, isSuccess) {
  const box = document.getElementById('sbStatusBox');
  if (!box) return;
  box.classList.remove('hidden', 'status-success', 'status-error');
  if (isSuccess === true) {
    box.classList.add('status-success');
  } else if (isSuccess === false) {
    box.classList.add('status-error');
  }
  box.textContent = msg;
}

function disconnectSupabase() {
  if (!confirm('Отключить подключение к Supabase и вернуться в локальный режим?')) return;
  window.komaevSupabase.clearConfig();
  isSupabaseActive = false;
  updateSupabaseStatusUI(false);
  showToast('Supabase отключен, включен локальный режим', 'info');
  document.getElementById('sbStatusBox')?.classList.add('hidden');
  document.getElementById('sbMigrateBlock')?.classList.add('hidden');
  document.getElementById('sbServicesBlock')?.classList.add('hidden');
  loadData();
}

function copySqlScript(btn) {
  if (!window.SUPABASE_SQL_SETUP) return;
  navigator.clipboard.writeText(window.SUPABASE_SQL_SETUP).then(() => {
    const orig = btn ? btn.textContent : 'Скопировать SQL';
    if (btn) btn.textContent = 'Скопировано! ✅';
    setTimeout(() => { if (btn) btn.textContent = orig; }, 2000);
  }).catch(() => {
    alert('Не удалось скопировать автоматически. Пожалуйста, выделите текст в окне и нажмите Ctrl+C');
  });
}

function dataURLtoBlob(dataurl) {
  const arr = dataurl.split(',');
  const mime = arr[0].match(/:(.*?);/)[1];
  const bstr = atob(arr[1]);
  let n = bstr.length;
  const u8arr = new Uint8Array(n);
  while (n--) {
    u8arr[n] = bstr.charCodeAt(n);
  }
  return new Blob([u8arr], { type: mime });
}

async function runMigration() {
  if (!isSupabaseActive) {
    alert('Сначала подключите Supabase');
    return;
  }

  const tasks = [];
  for (let k of Object.keys(galleries)) {
    (galleries[k] || []).forEach((it, idx) => {
      if (it && it.src && it.src.startsWith('data:')) {
        tasks.push({ gallery: k, item: it, idx });
      }
    });
  }

  if (tasks.length === 0) {
    alert('Локальных фото в формате dataURL не найдено');
    return;
  }

  if (!confirm(`Найдено ${tasks.length} локальных фото. Выгрузить их в Supabase Storage и базу данных?`)) return;

  showToast(`Миграция 1 из ${tasks.length} в Supabase...`, 'loading', 0);

  let successCount = 0;
  for (let i = 0; i < tasks.length; i++) {
    const { gallery, item } = tasks[i];
    showToast(`Перенос ${i + 1} из ${tasks.length} в Supabase...`, 'loading', 0);

    try {
      const blob = dataURLtoBlob(item.src);
      const ext = blob.type === 'image/png' ? 'png' : 'jpg';
      const safeName = (item.name || `photo_${i + 1}`).replace(/\.[^/.]+$/, '') + '.' + ext;
      const file = new File([blob], safeName, { type: blob.type || 'image/jpeg' });
      await window.komaevSupabase.uploadPhoto(file, gallery, item.caption || '', i + 1);
      successCount++;
    } catch (err) {
      console.warn('Failed migrating item:', item, err);
    }
  }

  // Clear local gallery cache so they reload from Supabase cleanly
  localStorage.removeItem('komaev_galleries');
  await loadData();

  document.getElementById('sbMigrateBlock')?.classList.add('hidden');
  showToast(`✅ Миграция завершена! Перенесено ${successCount} фото в Supabase.`, 'success', 4500);
}

/* ---------- Services sync with Supabase ---------- */
function updateServicesSyncBlock() {
  const block = document.getElementById('sbServicesBlock');
  const countSpan = document.getElementById('localServicesCount');
  if (!block || !countSpan) return;
  if (isSupabaseActive && Array.isArray(services) && services.length > 0) {
    countSpan.textContent = services.length;
    block.classList.remove('hidden');
  } else {
    block.classList.add('hidden');
  }
}

async function pushServicesToCloud() {
  if (!isSupabaseActive || !window.komaevSupabase) {
    alert('Сначала подключите Supabase');
    return;
  }
  if (!Array.isArray(services) || services.length === 0) {
    alert('Нет услуг для выгрузки');
    return;
  }
  if (!confirm(`Выгрузить ${services.length} услуг в базу данных Supabase? Текущий прайс станет общим для всех устройств.`)) return;

  showToast('Выгрузка услуг в Supabase...', 'loading', 0);
  let okCount = 0;
  let failCount = 0;
  for (const s of services) {
    try {
      await window.komaevSupabase.saveService(s);
      okCount++;
    } catch (err) {
      console.warn('Failed to push service to Supabase:', s, err);
      failCount++;
    }
  }

  if (failCount === 0) {
    // Re-read from cloud to confirm sync
    try {
      const remote = await window.komaevSupabase.fetchServices();
      if (Array.isArray(remote) && remote.length > 0) {
        services = remote;
        saveServices();
        renderServices();
      }
    } catch (e) {
      console.warn('Could not re-read services from Supabase:', e);
    }
    showToast(`✅ ${okCount} услуг выгружено в Supabase! Цены теперь общие для всех устройств.`, 'success', 4500);
  } else {
    showToast(`Выгружено: ${okCount}, ошибок: ${failCount}. Проверьте, что таблица «services» создана — запустите SQL-скрипт из инструкции ниже.`, 'error', 7000);
  }
}

/* ---------- Photo Modal Viewer ---------- */
function openPhoto(galleryName, idx) {
  const item = (galleries[galleryName] || [])[idx];
  if (!item) return;
  const img = document.getElementById('photoModalImg');
  const caption = document.getElementById('photoModalCaption');
  if (img) img.src = item.src;
  if (caption) caption.textContent = item.caption || '';
  lockScroll();
  document.getElementById('photoModal').classList.remove('hidden');
}

function closePhotoModal() {
  const m = document.getElementById('photoModal');
  if (m && !m.classList.contains('hidden')) unlockScroll();
  m?.classList.add('hidden');
}

/* ---------- Admin Mode Toggle & Console API ---------- */
function enableAdmin() {
  localStorage.setItem('komaev_admin', 'true');
  location.reload();
}

function disableAdmin() {
  localStorage.removeItem('komaev_admin');
  location.reload();
}

function adminLogin(pwd) {
  if (pwd && pwd !== 'komaev2024' && pwd !== 'admin') {
    console.warn('Подсказка: пароль по умолчанию komaev2024 или admin, но сейчас пускаю без пароля для теста');
  }
  enableAdmin();
}

function admin() {
  enableAdmin();
}

function showAdminHelp() {
  alert(`Как войти в режим администратора:

1. Откройте сайт и нажмите F12 (вкладка Console)
2. Введите команду: admin()  и нажмите Enter
3. Страница перезагрузится и появится панель админки сверху

Функции в панели:
- «+ Услуга» — добавить услугу и цену
- «⚡ База данных Supabase» — подключение базы данных Supabase и облачного хранилища для загрузки фотографий
- Загрузка фото прямо в разделах сайта («+ Добавить фото»)
- Удаление фото (крестик на фото)
- «Сбросить» — вернуть стандартные данные

Выйти из админки: кнопка «Выйти из админки» или команда disableAdmin()
`);
}

function resetData() {
  if (!confirm('Сбросить все услуги и фото к изначальным?')) return;
  localStorage.removeItem('komaev_services');
  localStorage.removeItem('komaev_galleries');
  location.reload();
}

/* ---------- Mobile: scroll lock, burger menu, modal handling ---------- */
let _scrollY = 0;
let _lockCount = 0;

function lockScroll() {
  if (_lockCount === 0) {
    _scrollY = window.scrollY || window.pageYOffset || 0;
    document.body.style.top = `-${_scrollY}px`;
    document.body.classList.add('no-scroll');
  }
  _lockCount++;
}

function unlockScroll() {
  _lockCount = Math.max(0, _lockCount - 1);
  if (_lockCount === 0 && document.body.classList.contains('no-scroll')) {
    document.body.classList.remove('no-scroll');
    document.body.style.top = '';
    window.scrollTo(0, _scrollY);
  }
}

const burgerBtn = document.getElementById('burger');
const mobileMenu = document.getElementById('mobileMenu');

function setMenu(open) {
  if (!burgerBtn || !mobileMenu) return;
  mobileMenu.classList.toggle('open', open);
  burgerBtn.setAttribute('aria-expanded', open ? 'true' : 'false');
  burgerBtn.setAttribute('aria-label', open ? 'Закрыть меню' : 'Открыть меню');
  mobileMenu.setAttribute('aria-hidden', open ? 'false' : 'true');
  if (open) lockScroll(); else unlockScroll();
}

burgerBtn?.addEventListener('click', () => {
  setMenu(!mobileMenu.classList.contains('open'));
});

mobileMenu?.addEventListener('click', (e) => {
  const link = e.target.closest('a');
  if (link) setMenu(false);
});

const mobileQuery = window.matchMedia('(max-width:1000px)');
if (mobileQuery.addEventListener) {
  mobileQuery.addEventListener('change', onBreakpoint);
} else if (mobileQuery.addListener) {
  mobileQuery.addListener(onBreakpoint);
}
function onBreakpoint(e) { if (!e.matches) setMenu(false); }

/* Escape closes menu / modals */
document.addEventListener('keydown', (e) => {
  if (e.key !== 'Escape') return;
  if (!document.getElementById('photoModal')?.classList.contains('hidden')) { closePhotoModal(); return; }
  if (!document.getElementById('serviceModal')?.classList.contains('hidden')) { closeServiceModal(); return; }
  if (!document.getElementById('supabaseModal')?.classList.contains('hidden')) { closeSupabaseModal(); return; }
  if (mobileMenu?.classList.contains('open')) setMenu(false);
});

/* Swipe down / tap outside to dismiss the photo viewer */
(function () {
  const modal = document.getElementById('photoModal');
  if (!modal) return;
  let startY = null;
  modal.addEventListener('touchstart', (e) => { startY = e.touches[0].clientY; }, { passive: true });
  modal.addEventListener('touchend', (e) => {
    if (startY === null) return;
    const dy = e.changedTouches[0].clientY - startY;
    if (dy > 80) closePhotoModal();
    startY = null;
  }, { passive: true });
})();

/* ---------- Initialize Application ---------- */
loadData();

// Expose functions globally
window.enableAdmin = enableAdmin;
window.disableAdmin = disableAdmin;
window.adminLogin = adminLogin;
window.admin = admin;
window.openServiceModal = openServiceModal;
window.closeServiceModal = closeServiceModal;
window.openSupabaseModal = openSupabaseModal;
window.closeSupabaseModal = closeSupabaseModal;
window.saveAndTestSupabase = saveAndTestSupabase;
window.disconnectSupabase = disconnectSupabase;
window.toggleAnonKeyVisibility = toggleAnonKeyVisibility;
window.copySqlScript = copySqlScript;
window.runMigration = runMigration;
window.pushServicesToCloud = pushServicesToCloud;
window.editService = editService;
window.saveService = saveService;
window.deleteService = deleteService;
window.handleUpload = handleUpload;
window.deletePhoto = deletePhoto;
window.openPhoto = openPhoto;
window.closePhotoModal = closePhotoModal;
window.showAdminHelp = showAdminHelp;
window.resetData = resetData;
window.showToast = showToast;
window.hideToast = hideToast;

console.log('%cКомаев — админка', 'color:white;background:#E30613;padding:8px 14px;border-radius:8px;font-weight:800;font-size:14px');
console.log('Введите admin() чтобы включить режим администратора. Подробнее — showAdminHelp()');
