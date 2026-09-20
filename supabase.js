/* ==========================================================================
   Supabase Database & Storage Integration for Ortoped Komaev
   ========================================================================== */

/**
 * Default Supabase Configuration:
 * You can specify project credentials directly here in the code,
 * or configure them dynamically through the Admin panel on the site.
 */
window.SUPABASE_CONFIG = {
  url: '',       // e.g. 'https://xyzcompany.supabase.co'
  anonKey: '',   // Public Anon Key (starts with eyJ...)
  bucket: 'photos' // Storage bucket name (default: photos)
};

// SQL script template provided to admin for 1-click database setup
window.SUPABASE_SQL_SETUP = `-- 1. Таблица для фотографий
create table if not exists public.photos (
    id uuid default gen_random_uuid() primary key,
    gallery text not null, -- 'hero', 'about', 'priem', 'konsult', 'stelki', 'dinamika', 'contacts'
    url text not null,
    storage_path text default '',
    caption text default '',
    display_order integer default 0,
    created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- 2. Включаем Row Level Security (RLS)
alter table public.photos enable row level security;

-- 3. Политики безопасности для таблицы photos
drop policy if exists "allow_public_select_photos" on public.photos;
create policy "allow_public_select_photos" on public.photos for select using (true);

drop policy if exists "allow_public_insert_photos" on public.photos;
create policy "allow_public_insert_photos" on public.photos for insert with check (true);

drop policy if exists "allow_public_delete_photos" on public.photos;
create policy "allow_public_delete_photos" on public.photos for delete using (true);

drop policy if exists "allow_public_update_photos" on public.photos;
create policy "allow_public_update_photos" on public.photos for update using (true);

-- 4. Политики для Storage бакета 'photos'
-- ВАЖНО: предварительно создайте бакет 'photos' в Storage с галочкой Public bucket!
drop policy if exists "allow_public_read_storage" on storage.objects;
create policy "allow_public_read_storage" on storage.objects for select using (bucket_id = 'photos');

drop policy if exists "allow_public_insert_storage" on storage.objects;
create policy "allow_public_insert_storage" on storage.objects for insert with check (bucket_id = 'photos');

drop policy if exists "allow_public_delete_storage" on storage.objects;
create policy "allow_public_delete_storage" on storage.objects for delete using (bucket_id = 'photos');

-- 5. (Опционально) Таблица для синхронизации услуг и цен
create table if not exists public.services (
    id text primary key,
    title text not null,
    duration text default '15 мин.',
    price text default '0 RUB',
    description text default '',
    display_order integer default 0,
    created_at timestamp with time zone default timezone('utc'::text, now()) not null
);
alter table public.services enable row level security;

drop policy if exists "allow_public_select_services" on public.services;
create policy "allow_public_select_services" on public.services for select using (true);

drop policy if exists "allow_public_all_services" on public.services;
create policy "allow_public_all_services" on public.services for all using (true);`;

class KomaevSupabaseManager {
  constructor() {
    this._client = null;
  }

  /**
   * Returns current active configuration (localStorage takes priority over hardcoded defaults)
   */
  getConfig() {
    try {
      const saved = localStorage.getItem('komaev_supabase_config');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed && parsed.url && parsed.anonKey) {
          return {
            url: parsed.url.trim().replace(/\/+$/, ''),
            anonKey: parsed.anonKey.trim(),
            bucket: (parsed.bucket || 'photos').trim()
          };
        }
      }
    } catch (e) {
      console.warn('Error reading stored Supabase config:', e);
    }

    const fallback = window.SUPABASE_CONFIG || {};
    return {
      url: (fallback.url || '').trim().replace(/\/+$/, ''),
      anonKey: (fallback.anonKey || '').trim(),
      bucket: (fallback.bucket || 'photos').trim()
    };
  }

  saveConfig(url, anonKey, bucket = 'photos') {
    const cleanUrl = (url || '').trim().replace(/\/+$/, '');
    const cleanKey = (anonKey || '').trim();
    const cleanBucket = (bucket || 'photos').trim() || 'photos';
    const cfg = { url: cleanUrl, anonKey: cleanKey, bucket: cleanBucket };
    localStorage.setItem('komaev_supabase_config', JSON.stringify(cfg));
    this._client = null;
    return cfg;
  }

  clearConfig() {
    localStorage.removeItem('komaev_supabase_config');
    this._client = null;
  }

  isConfigured() {
    const cfg = this.getConfig();
    return Boolean(cfg.url && cfg.anonKey && cfg.url.startsWith('http'));
  }

  /**
   * Returns initialized Supabase JS client if available via CDN, or null
   */
  getClient() {
    const cfg = this.getConfig();
    if (!cfg.url || !cfg.anonKey) return null;
    if (this._client && this._client._cfgUrl === cfg.url && this._client._cfgKey === cfg.anonKey) {
      return this._client;
    }
    if (window.supabase && typeof window.supabase.createClient === 'function') {
      try {
        this._client = window.supabase.createClient(cfg.url, cfg.anonKey);
        this._client._cfgUrl = cfg.url;
        this._client._cfgKey = cfg.anonKey;
        return this._client;
      } catch (err) {
        console.warn('Could not initialize Supabase SDK client:', err);
      }
    }
    return null;
  }

  _getHeaders(cfg, extra = {}) {
    return {
      'apikey': cfg.anonKey,
      'Authorization': `Bearer ${cfg.anonKey}`,
      'Accept': 'application/json',
      ...extra
    };
  }

  /**
   * Tests connection to Supabase database table 'photos' and storage bucket
   */
  async testConnection(customConfig = null) {
    const cfg = customConfig ? {
      url: (customConfig.url || '').trim().replace(/\/+$/, ''),
      anonKey: (customConfig.anonKey || '').trim(),
      bucket: (customConfig.bucket || 'photos').trim() || 'photos'
    } : this.getConfig();

    if (!cfg.url || !cfg.anonKey) {
      return { ok: false, message: 'Пожалуйста, заполните Project URL и Anon Key.' };
    }

    if (!cfg.url.startsWith('https://') && !cfg.url.startsWith('http://')) {
      return { ok: false, message: 'Project URL должен начинаться с https://' };
    }

    let dbOk = false;
    let dbDetails = '';
    try {
      const res = await fetch(`${cfg.url}/rest/v1/photos?select=id&limit=1`, {
        method: 'GET',
        headers: this._getHeaders(cfg)
      });
      if (res.ok) {
        dbOk = true;
      } else {
        const txt = await res.text();
        if (res.status === 404 || txt.includes('relation "public.photos" does not exist') || txt.includes('does not exist')) {
          dbDetails = 'Таблица «photos» не найдена. Запустите SQL-скрипт в Supabase SQL Editor.';
        } else if (res.status === 401 || res.status === 403) {
          dbDetails = 'Ошибка доступа (401/403). Проверьте правильность Anon Key и политики RLS.';
        } else {
          dbDetails = `Ошибка HTTP ${res.status}: ${txt.slice(0, 100)}`;
        }
      }
    } catch (err) {
      dbDetails = `Ошибка соединения: ${err.message}`;
    }

    let storageOk = false;
    let storageDetails = '';
    try {
      const res = await fetch(`${cfg.url}/storage/v1/bucket/${cfg.bucket}`, {
        method: 'GET',
        headers: this._getHeaders(cfg)
      });
      if (res.ok) {
        storageOk = true;
      } else {
        const txt = await res.text();
        if (res.status === 404 || txt.includes('not found') || txt.includes('The resource was not found')) {
          storageDetails = `Бакет «${cfg.bucket}» не найден. Создайте его в разделе Storage → New bucket.`;
        } else {
          storageDetails = `Ошибка HTTP ${res.status}: ${txt.slice(0, 100)}`;
        }
      }
    } catch (err) {
      storageDetails = `Ошибка соединения: ${err.message}`;
    }

    if (dbOk && storageOk) {
      return {
        ok: true,
        dbOk: true,
        storageOk: true,
        message: '✅ Подключение успешно! База данных (таблица «photos») и хранилище файлов (бакет «' + cfg.bucket + '») полностью готовы к работе.'
      };
    }

    let report = 'Подключение частично не готово:\n';
    if (dbOk) {
      report += '• База данных: ✅ таблица «photos» найдена и доступна\n';
    } else {
      report += `• База данных: ❌ ${dbDetails}\n`;
    }
    if (storageOk) {
      report += `• Хранилище: ✅ бакет «${cfg.bucket}» доступен\n`;
    } else {
      report += `• Хранилище: ⚠️ ${storageDetails}\n`;
    }
    report += '\nПожалуйста, проверьте шаги в инструкции ниже.';

    return {
      ok: false,
      dbOk,
      storageOk,
      message: report
    };
  }

  /**
   * Fetches all photos from Supabase 'photos' table
   */
  async fetchPhotos() {
    if (!this.isConfigured()) return null;
    const cfg = this.getConfig();
    const client = this.getClient();

    if (client) {
      const { data, error } = await client
        .from('photos')
        .select('*')
        .order('display_order', { ascending: true })
        .order('created_at', { ascending: true });
      if (error) throw error;
      return data;
    }

    const res = await fetch(`${cfg.url}/rest/v1/photos?select=*&order=display_order.asc,created_at.asc`, {
      method: 'GET',
      headers: this._getHeaders(cfg)
    });
    if (!res.ok) {
      const errTxt = await res.text();
      throw new Error(`Ошибка загрузки фото из Supabase: ${res.status} ${errTxt}`);
    }
    return await res.json();
  }

  /**
   * Uploads a file (or Blob) to Supabase Storage and creates a record in the 'photos' table
   */
  async uploadPhoto(file, gallery, caption = '', displayOrder = 0) {
    if (!this.isConfigured()) throw new Error('Supabase не настроен');
    const cfg = this.getConfig();
    const bucket = cfg.bucket || 'photos';

    // Build safe and unique storage path
    const ext = (file.name ? file.name.split('.').pop() : 'jpg').toLowerCase().replace(/[^a-z0-9]/g, '') || 'jpg';
    const rawName = (file.name || 'photo').replace(/\.[^/.]+$/, '');
    const cleanName = rawName.replace(/[^a-zA-Z0-9а-яА-ЯёЁ_-]/g, '_').slice(0, 30);
    const storagePath = `${gallery}/${Date.now()}_${Math.random().toString(36).slice(2, 6)}_${cleanName}.${ext}`;

    let publicUrl = '';
    const client = this.getClient();

    if (client) {
      const { error: uploadError } = await client.storage
        .from(bucket)
        .upload(storagePath, file, {
          contentType: file.type || 'image/jpeg',
          upsert: true
        });
      if (uploadError) throw uploadError;

      const { data: pubData } = client.storage.from(bucket).getPublicUrl(storagePath);
      publicUrl = pubData.publicUrl;
    } else {
      // Direct REST upload
      const uploadRes = await fetch(`${cfg.url}/storage/v1/object/${bucket}/${encodeURI(storagePath)}`, {
        method: 'POST',
        headers: {
          'apikey': cfg.anonKey,
          'Authorization': `Bearer ${cfg.anonKey}`,
          'Content-Type': file.type || 'image/jpeg',
          'x-upsert': 'true'
        },
        body: file
      });
      if (!uploadRes.ok) {
        const txt = await uploadRes.text();
        throw new Error(`Ошибка загрузки в бакет Supabase Storage: ${uploadRes.status} ${txt}`);
      }
      publicUrl = `${cfg.url}/storage/v1/object/public/${bucket}/${encodeURI(storagePath)}`;
    }

    // Insert DB record
    const photoRecord = {
      gallery,
      url: publicUrl,
      storage_path: storagePath,
      caption: caption || rawName,
      display_order: displayOrder,
      created_at: new Date().toISOString()
    };

    if (client) {
      const { data, error } = await client.from('photos').insert([photoRecord]).select();
      if (error) throw error;
      return (data && data[0]) ? data[0] : photoRecord;
    }

    const insertRes = await fetch(`${cfg.url}/rest/v1/photos`, {
      method: 'POST',
      headers: this._getHeaders(cfg, {
        'Content-Type': 'application/json',
        'Prefer': 'return=representation'
      }),
      body: JSON.stringify(photoRecord)
    });
    if (!insertRes.ok) {
      const txt = await insertRes.text();
      throw new Error(`Ошибка сохранения в таблицу photos: ${insertRes.status} ${txt}`);
    }
    const inserted = await insertRes.json();
    return (inserted && inserted[0]) ? inserted[0] : photoRecord;
  }

  /**
   * Deletes a photo from both Supabase Database and Storage
   */
  async deletePhoto(photoId, storagePath) {
    if (!this.isConfigured()) return;
    const cfg = this.getConfig();
    const bucket = cfg.bucket || 'photos';
    const client = this.getClient();

    // 1. Delete from database
    if (photoId) {
      try {
        if (client) {
          const { error } = await client.from('photos').delete().eq('id', photoId);
          if (error) console.warn('Supabase DB delete error:', error);
        } else {
          await fetch(`${cfg.url}/rest/v1/photos?id=eq.${photoId}`, {
            method: 'DELETE',
            headers: this._getHeaders(cfg)
          });
        }
      } catch (e) {
        console.warn('Error deleting photo from DB:', e);
      }
    }

    // 2. Delete file from Storage
    if (storagePath) {
      try {
        if (client) {
          const { error } = await client.storage.from(bucket).remove([storagePath]);
          if (error) console.warn('Supabase Storage remove error:', error);
        } else {
          await fetch(`${cfg.url}/storage/v1/object/${bucket}`, {
            method: 'DELETE',
            headers: this._getHeaders(cfg, { 'Content-Type': 'application/json' }),
            body: JSON.stringify({ prefixes: [storagePath] })
          });
        }
      } catch (e) {
        console.warn('Error deleting photo from Storage:', e);
      }
    }
  }

  /**
   * Optional services sync: fetches services from Supabase if table exists
   */
  async fetchServices() {
    if (!this.isConfigured()) return null;
    const cfg = this.getConfig();
    const client = this.getClient();

    try {
      if (client) {
        const { data, error } = await client.from('services').select('*').order('display_order', { ascending: true });
        if (error) return null;
        return data.map(s => ({
          id: s.id,
          title: s.title,
          duration: s.duration || '15 мин.',
          price: s.price || '0 RUB',
          desc: s.description || s.desc || '',
          order: s.display_order ?? s.order ?? 1
        }));
      }

      const res = await fetch(`${cfg.url}/rest/v1/services?select=*&order=display_order.asc`, {
        method: 'GET',
        headers: this._getHeaders(cfg)
      });
      if (!res.ok) return null;
      const data = await res.json();
      return data.map(s => ({
        id: s.id,
        title: s.title,
        duration: s.duration || '15 мин.',
        price: s.price || '0 RUB',
        desc: s.description || s.desc || '',
        order: s.display_order ?? s.order ?? 1
      }));
    } catch {
      return null;
    }
  }

  /**
   * Upsert a service in Supabase
   */
  async saveService(service) {
    if (!this.isConfigured()) return;
    const cfg = this.getConfig();
    const client = this.getClient();
    const payload = {
      id: service.id,
      title: service.title,
      duration: service.duration,
      price: service.price,
      description: service.desc || '',
      display_order: service.order || 1
    };

    try {
      if (client) {
        await client.from('services').upsert(payload, { onConflict: 'id' });
      } else {
        await fetch(`${cfg.url}/rest/v1/services`, {
          method: 'POST',
          headers: this._getHeaders(cfg, {
            'Content-Type': 'application/json',
            'Prefer': 'resolution=merge-duplicates'
          }),
          body: JSON.stringify(payload)
        });
      }
    } catch (e) {
      console.warn('Could not save service to Supabase:', e);
    }
  }

  /**
   * Delete a service from Supabase
   */
  async deleteService(serviceId) {
    if (!this.isConfigured() || !serviceId) return;
    const cfg = this.getConfig();
    const client = this.getClient();
    try {
      if (client) {
        await client.from('services').delete().eq('id', serviceId);
      } else {
        await fetch(`${cfg.url}/rest/v1/services?id=eq.${serviceId}`, {
          method: 'DELETE',
          headers: this._getHeaders(cfg)
        });
      }
    } catch (e) {
      console.warn('Could not delete service from Supabase:', e);
    }
  }
}

// Global instance
window.komaevSupabase = new KomaevSupabaseManager();
