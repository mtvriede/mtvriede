const STORAGE_KEY = 'mtvriede_sr_data';
const SESSION_KEY = 'mtvriede_admin_session';
const ADMIN_USER = 'admin';
const ADMIN_PASS_HASH = '5f5663856beb047cd36872f0843b29e0aa6b066e9fa8b5f6be155b1e2951063f';

let data = null;
let currentTab = 'rules';

async function hashPassword(password) {
  const encoder = new TextEncoder();
  const data = encoder.encode(password);
  const buffer = await crypto.subtle.digest('SHA-256', data);
  return Array.from(new Uint8Array(buffer)).map(b => b.toString(16).padStart(2, '0')).join('');
}

function isLoggedIn() {
  const session = sessionStorage.getItem(SESSION_KEY);
  return session === 'authenticated';
}

function showAdminApp() {
  document.getElementById('login-screen').style.display = 'none';
  document.getElementById('admin-app').classList.add('visible');
}

function showLoginScreen() {
  document.getElementById('login-screen').style.display = 'flex';
  document.getElementById('admin-app').classList.remove('visible');
}

function logout() {
  sessionStorage.removeItem(SESSION_KEY);
  showLoginScreen();
  document.getElementById('login-user').value = '';
  document.getElementById('login-pass').value = '';
  document.getElementById('login-error').classList.remove('visible');
}

function loadData() {
  const stored = localStorage.getItem(STORAGE_KEY);
  if (stored) {
    data = JSON.parse(stored);
    return migrateData();
  }
  return fetch('data/content.json')
    .then(r => r.json())
    .then(d => {
      data = d;
      saveData();
    });
}

function migrateData() {
  let needsMigration = false;
  if (!data.quiz) {
    needsMigration = true;
  } else if (data.quiz.length > 0 && data.quiz[0].options && data.quiz[0].options.length === 4) {
    needsMigration = true;
  }
  if (needsMigration) {
    return fetch('data/content.json')
      .then(r => r.json())
      .then(defaults => {
        data.quiz = defaults.quiz || [];
        saveData();
      })
      .catch(() => { data.quiz = []; });
  }
  return Promise.resolve();
}

function saveData() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  } catch (e) {
    alert('Speicher voll! Bitte lösche nicht benötigte Dokumente oder Bilder.');
  }
}

function nextId(arr) {
  if (!arr || arr.length === 0) return 1;
  return Math.max(...arr.map(i => i.id || 0)) + 1;
}

function formatDate(dateStr) {
  const d = new Date(dateStr + 'T00:00:00');
  return `${String(d.getDate()).padStart(2,'0')}.${String(d.getMonth()+1).padStart(2,'0')}.${d.getFullYear()}`;
}

function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str || '';
  return div.innerHTML;
}

function showToast(message) {
  const toast = document.getElementById('toast');
  toast.textContent = message;
  toast.classList.add('show');
  setTimeout(() => toast.classList.remove('show'), 2500);
}

// Tabs
function switchTab(tab) {
  currentTab = tab;
  document.querySelectorAll('.admin-tab').forEach(t => t.classList.toggle('active', t.dataset.tab === tab));
  document.querySelectorAll('.admin-section').forEach(s => s.classList.toggle('active', s.id === 'section-' + tab));
  renderCurrentTab();
}

function renderCurrentTab() {
  switch (currentTab) {
    case 'rules': renderRules(); break;
    case 'events': renderEvents(); break;
    case 'documents': renderDocuments(); break;
    case 'guides': renderGuides(); break;
    case 'announcements': renderAnnouncements(); break;
    case 'quiz': renderQuiz(); break;
  }
}

// ====== RULES ======
function renderRules() {
  const container = document.getElementById('rules-list');
  const rules = data.rules || [];
  if (rules.length === 0) {
    container.innerHTML = '<p style="color:var(--text-secondary);text-align:center;padding:20px">Keine Regeln vorhanden.</p>';
    return;
  }
  container.innerHTML = rules.map(r => `
    <div class="admin-list-item">
      <div class="item-info">
        <div class="item-title">${escapeHtml(r.title)}</div>
        <div class="item-meta">${formatDate(r.date)} ${r.isNew ? '<span class="badge badge-info">Neue Regel</span> ' : ''}${r.archived ? '<span class="badge badge-warning">Archiviert</span>' : ''}</div>
      </div>
      <div class="item-actions">
        <button class="btn btn-secondary btn-sm" onclick="editRule(${r.id})">Bearbeiten</button>
        <button class="btn btn-sm ${r.archived ? 'btn-primary' : 'btn-secondary'}" onclick="toggleArchiveRule(${r.id})">${r.archived ? 'Aktivieren' : 'Archivieren'}</button>
        <button class="btn btn-danger btn-sm" onclick="deleteRule(${r.id})">Löschen</button>
      </div>
    </div>
  `).join('');
}

let ruleAttachments = [];

function showRuleForm(rule) {
  ruleAttachments = rule?.documents ? JSON.parse(JSON.stringify(rule.documents)) : [];
  const overlay = document.getElementById('form-overlay');
  overlay.innerHTML = `
    <div class="form-panel">
      <h3>${rule ? 'Regel bearbeiten' : 'Neue Regel'}</h3>
      <div class="form-group">
        <label>Titel</label>
        <input type="text" id="rule-title" value="${escapeHtml(rule?.title || '')}">
      </div>
      <div class="form-group">
        <label>Untertitel</label>
        <input type="text" id="rule-subtitle" value="${escapeHtml(rule?.subtitle || '')}">
      </div>
      <div class="form-group">
        <label>Gültig ab</label>
        <input type="date" id="rule-date" value="${rule?.date || new Date().toISOString().split('T')[0]}">
      </div>
      <div class="form-group" style="display:flex;align-items:center;gap:8px">
        <input type="checkbox" id="rule-isNew" ${rule?.isNew ? 'checked' : ''} style="width:auto;margin:0">
        <label for="rule-isNew" style="margin:0;text-transform:none;font-size:0.88rem;color:var(--text)">Auf Startseite als „Neue Regel" anzeigen</label>
      </div>
      <div class="form-group">
        <label>Inhalt (HTML)</label>
        <textarea id="rule-content">${rule?.content || ''}</textarea>
      </div>
      <div class="form-group">
        <label>Anhänge (PDF / Links)</label>
        <div id="rule-attachments-list"></div>
        <div style="display:flex;gap:6px;margin-top:8px;flex-wrap:wrap">
          <button type="button" class="btn btn-secondary btn-sm" id="rule-add-pdf">+ Datei verknüpfen</button>
          <button type="button" class="btn btn-secondary btn-sm" id="rule-add-link">+ Link hinzufügen</button>
        </div>
      </div>
      <div class="form-actions">
        <button class="btn btn-secondary" onclick="closeForm()">Abbrechen</button>
        <button class="btn btn-primary" id="rule-save-btn">Speichern</button>
      </div>
    </div>`;
  overlay.classList.add('active');
  renderRuleAttachments();

  document.getElementById('rule-add-link').addEventListener('click', () => {
    const name = prompt('Bezeichnung des Links:');
    if (!name) return;
    const url = prompt('URL (https://...):');
    if (!url) return;
    ruleAttachments.push({ name, url, type: 'link' });
    renderRuleAttachments();
  });

  document.getElementById('rule-add-pdf').addEventListener('click', () => {
    const filename = prompt('Dateiname der PDF im Ordner /dokumente/:');
    if (!filename) return;
    const name = prompt('Bezeichnung:', filename);
    if (!name) return;
    ruleAttachments.push({ name, type: 'file', file: filename });
    renderRuleAttachments();
  });

  document.getElementById('rule-save-btn').addEventListener('click', () => saveRule(rule?.id || 0));
}

function renderRuleAttachments() {
  const container = document.getElementById('rule-attachments-list');
  if (!container) return;
  if (ruleAttachments.length === 0) {
    container.innerHTML = '<p style="font-size:0.8rem;color:var(--text-secondary)">Keine Anhänge</p>';
    return;
  }
  container.innerHTML = ruleAttachments.map((a, i) => `
    <div class="admin-list-item" style="padding:8px 10px;margin-bottom:4px">
      <div class="item-info">
        <div class="item-title" style="font-size:0.82rem">${escapeHtml(a.name)}</div>
        <div class="item-meta">${a.type === 'file' ? 'dokumente/' + escapeHtml(a.file || '') : a.type === 'pdf' ? 'PDF (hochgeladen)' : escapeHtml(a.url || '')}</div>
      </div>
      <button class="btn btn-danger btn-sm" onclick="removeRuleAttachment(${i})">Entfernen</button>
    </div>
  `).join('');
}

function removeRuleAttachment(index) {
  ruleAttachments.splice(index, 1);
  renderRuleAttachments();
}

function editRule(id) {
  const rule = data.rules.find(r => r.id === id);
  if (rule) showRuleForm(rule);
}

function saveRule(id) {
  const title = document.getElementById('rule-title').value.trim();
  const subtitle = document.getElementById('rule-subtitle').value.trim();
  const date = document.getElementById('rule-date').value;
  const content = document.getElementById('rule-content').value;
  const isNew = document.getElementById('rule-isNew').checked;

  if (!title) { showToast('Bitte Titel eingeben'); return; }

  if (id) {
    const rule = data.rules.find(r => r.id === id);
    if (rule) {
      rule.title = title;
      rule.subtitle = subtitle;
      rule.date = date;
      rule.content = content;
      rule.documents = ruleAttachments;
      rule.isNew = isNew;
    }
  } else {
    data.rules.push({
      id: nextId(data.rules),
      title, subtitle, date, content,
      documents: ruleAttachments,
      archived: false,
      isNew: isNew
    });
  }
  saveData();
  closeForm();
  renderRules();
  showToast('Regel gespeichert');
}

function toggleArchiveRule(id) {
  const rule = data.rules.find(r => r.id === id);
  if (rule) {
    rule.archived = !rule.archived;
    saveData();
    renderRules();
    showToast(rule.archived ? 'Regel archiviert' : 'Regel aktiviert');
  }
}

function deleteRule(id) {
  if (!confirm('Regel wirklich löschen?')) return;
  data.rules = data.rules.filter(r => r.id !== id);
  saveData();
  renderRules();
  showToast('Regel gelöscht');
}

// ====== EVENTS ======
function renderEvents() {
  const container = document.getElementById('events-list');
  const events = (data.events || []).sort((a,b) => a.date.localeCompare(b.date));
  if (events.length === 0) {
    container.innerHTML = '<p style="color:var(--text-secondary);text-align:center;padding:20px">Keine Termine vorhanden.</p>';
    return;
  }
  container.innerHTML = events.map(e => `
    <div class="admin-list-item">
      <div class="item-info">
        <div class="item-title">${escapeHtml(e.title)}</div>
        <div class="item-meta">${formatDate(e.date)} · ${e.time} Uhr${e.location ? ' · ' + escapeHtml(e.location) : ''}</div>
      </div>
      <div class="item-actions">
        <button class="btn btn-secondary btn-sm" onclick="editEvent(${e.id})">Bearbeiten</button>
        <button class="btn btn-danger btn-sm" onclick="deleteEvent(${e.id})">Löschen</button>
      </div>
    </div>
  `).join('');
}

function showEventForm(event) {
  const overlay = document.getElementById('form-overlay');
  overlay.innerHTML = `
    <div class="form-panel">
      <h3>${event ? 'Termin bearbeiten' : 'Neuer Termin'}</h3>
      <div class="form-group">
        <label>Titel</label>
        <input type="text" id="event-title" value="${escapeHtml(event?.title || '')}">
      </div>
      <div class="form-group">
        <label>Datum</label>
        <input type="date" id="event-date" value="${event?.date || ''}">
      </div>
      <div class="form-group">
        <label>Uhrzeit</label>
        <input type="time" id="event-time" value="${event?.time || '19:00'}">
      </div>
      <div class="form-group">
        <label>Ort</label>
        <input type="text" id="event-location" value="${escapeHtml(event?.location || '')}">
      </div>
      <div class="form-group">
        <label>Beschreibung</label>
        <textarea id="event-description" style="min-height:80px">${escapeHtml(event?.description || '')}</textarea>
      </div>
      <div class="form-group">
        <label>Ansprechpartner</label>
        <input type="text" id="event-contact" value="${escapeHtml(event?.contact || '')}">
      </div>
      <div class="form-actions">
        <button class="btn btn-secondary" onclick="closeForm()">Abbrechen</button>
        <button class="btn btn-primary" onclick="saveEvent(${event?.id || 0})">Speichern</button>
      </div>
    </div>`;
  overlay.classList.add('active');
}

function editEvent(id) {
  const ev = data.events.find(e => e.id === id);
  if (ev) showEventForm(ev);
}

function saveEvent(id) {
  const title = document.getElementById('event-title').value.trim();
  const date = document.getElementById('event-date').value;
  const time = document.getElementById('event-time').value;
  const location = document.getElementById('event-location').value.trim();
  const description = document.getElementById('event-description').value.trim();
  const contact = document.getElementById('event-contact').value.trim();

  if (!title || !date) { showToast('Titel und Datum sind erforderlich'); return; }

  if (id) {
    const ev = data.events.find(e => e.id === id);
    if (ev) {
      ev.title = title; ev.date = date; ev.time = time;
      ev.location = location; ev.description = description; ev.contact = contact;
    }
  } else {
    data.events.push({
      id: nextId(data.events),
      title, date, time, location, description, contact
    });
  }
  saveData();
  closeForm();
  renderEvents();
  showToast('Termin gespeichert');
}

function deleteEvent(id) {
  if (!confirm('Termin wirklich löschen?')) return;
  data.events = data.events.filter(e => e.id !== id);
  saveData();
  renderEvents();
  showToast('Termin gelöscht');
}

// ====== DOCUMENTS ======
function renderDocuments() {
  const container = document.getElementById('documents-list');
  const categories = (data.documents && data.documents.categories) || [];

  let html = '';
  categories.forEach(cat => {
    html += `<div style="margin-bottom:16px">
      <div style="font-weight:600;font-size:0.9rem;margin-bottom:8px;color:var(--primary)">${escapeHtml(cat.name)}</div>`;
    cat.items.forEach(item => {
      const hasDoc = item.file || item.fileRef || item.fileData;
      const source = item.file ? 'dokumente/' + item.file : hasDoc ? 'PDF hinterlegt' : (item.url && item.url !== '#' ? 'Link: ' + item.url : 'Kein Dokument');
      html += `
        <div class="admin-list-item">
          <div class="item-info">
            <div class="item-title">${escapeHtml(item.title)}</div>
            <div class="item-meta">${hasDoc ? '<span class="badge badge-info">PDF</span> ' : ''}${escapeHtml(source)}</div>
          </div>
          <div class="item-actions">
            <button class="btn btn-secondary btn-sm" onclick="editDocument('${cat.id}', ${item.id})">Bearbeiten</button>
            <button class="btn btn-danger btn-sm" onclick="deleteDocument('${cat.id}', ${item.id})">Löschen</button>
          </div>
        </div>`;
    });
    html += '</div>';
  });
  container.innerHTML = html;
}

function showDocumentForm(catId, doc) {
  const categories = data.documents.categories || [];
  const overlay = document.getElementById('form-overlay');
  overlay.innerHTML = `
    <div class="form-panel">
      <h3>${doc ? 'Dokument bearbeiten' : 'Neues Dokument'}</h3>
      <div class="form-group">
        <label>Kategorie</label>
        <select id="doc-category">
          ${categories.map(c => `<option value="${c.id}" ${c.id === catId ? 'selected' : ''}>${escapeHtml(c.name)}</option>`).join('')}
        </select>
      </div>
      <div class="form-group">
        <label>Titel</label>
        <input type="text" id="doc-title" value="${escapeHtml(doc?.title || '')}">
      </div>
      <div class="form-group">
        <label>PDF-Datei (Dateiname im Ordner /dokumente/)</label>
        <input type="text" id="doc-file" placeholder="z.B. regelwerk.pdf" value="${escapeHtml(doc?.file || '')}">
        <p style="font-size:0.72rem;color:var(--text-secondary);margin-top:3px">Die PDF muss im Ordner <strong>/dokumente/</strong> auf dem Server liegen.</p>
      </div>
      <div class="form-group">
        <label>Oder: Externer Link (URL)</label>
        <input type="url" id="doc-url" placeholder="https://..." value="${escapeHtml(doc?.url && doc.url !== '#' ? doc.url : '')}">
        <p style="font-size:0.72rem;color:var(--text-secondary);margin-top:3px">Falls keine Datei angegeben, öffnet sich dieser Link.</p>
      </div>
      <div class="form-actions">
        <button class="btn btn-secondary" onclick="closeForm()">Abbrechen</button>
        <button class="btn btn-primary" id="doc-save-btn">Speichern</button>
      </div>
    </div>`;
  overlay.classList.add('active');
  document.getElementById('doc-save-btn').addEventListener('click', () => saveDocument(catId || '', doc?.id || 0));
}

function editDocument(catId, docId) {
  const cat = data.documents.categories.find(c => c.id === catId);
  const doc = cat?.items.find(i => i.id === docId);
  if (doc) showDocumentForm(catId, doc);
}

function saveDocument(origCatId, docId) {
  const catId = document.getElementById('doc-category').value;
  const title = document.getElementById('doc-title').value.trim();
  const file = document.getElementById('doc-file').value.trim();
  const url = document.getElementById('doc-url').value.trim();

  if (!title) { showToast('Bitte Titel eingeben'); return; }

  let existingDoc = null;
  if (docId) {
    for (const cat of data.documents.categories) {
      const idx = cat.items.findIndex(i => i.id === docId);
      if (idx !== -1) {
        existingDoc = cat.items[idx];
        if (cat.id !== catId) {
          cat.items.splice(idx, 1);
          existingDoc = null;
        }
        break;
      }
    }
  }

  if (existingDoc) {
    existingDoc.title = title;
    existingDoc.file = file;
    existingDoc.url = url || '#';
  } else {
    const targetCat = data.documents.categories.find(c => c.id === catId);
    if (targetCat) {
      const allItems = data.documents.categories.flatMap(c => c.items);
      targetCat.items.push({
        id: docId || nextId(allItems),
        title, file,
        url: url || '#'
      });
    }
  }

  saveData();
  closeForm();
  renderDocuments();
  showToast('Dokument gespeichert');
}

function deleteDocument(catId, docId) {
  if (!confirm('Dokument wirklich löschen?')) return;
  const cat = data.documents.categories.find(c => c.id === catId);
  if (cat) {
    cat.items = cat.items.filter(i => i.id !== docId);
    saveData();
    renderDocuments();
    showToast('Dokument gelöscht');
  }
}

// ====== GUIDES ======
function renderGuides() {
  const container = document.getElementById('guides-list');
  const guides = data.guides || [];
  if (guides.length === 0) {
    container.innerHTML = '<p style="color:var(--text-secondary);text-align:center;padding:20px">Keine Anleitungen vorhanden.</p>';
    return;
  }
  container.innerHTML = guides.map(g => `
    <div class="admin-list-item">
      <div class="item-info">
        <div class="item-title">${escapeHtml(g.title)}</div>
        <div class="item-meta">${escapeHtml(g.summary)}</div>
      </div>
      <div class="item-actions">
        <button class="btn btn-secondary btn-sm" onclick="editGuide(${g.id})">Bearbeiten</button>
        <button class="btn btn-danger btn-sm" onclick="deleteGuide(${g.id})">Löschen</button>
      </div>
    </div>
  `).join('');
}

let guideBlocks = [];

function parseGuideContentToBlocks(html) {
  if (!html) return [{ type: 'text', content: '' }];
  const blocks = [];
  const imgRegex = /<img[^>]+src="([^"]*)"[^>]*>/g;
  let lastIndex = 0;
  let match;
  while ((match = imgRegex.exec(html)) !== null) {
    const before = html.substring(lastIndex, match.index).trim();
    if (before) blocks.push({ type: 'text', content: before });
    blocks.push({ type: 'image', data: match[1] });
    lastIndex = match.index + match[0].length;
  }
  const rest = html.substring(lastIndex).trim();
  if (rest || blocks.length === 0) blocks.push({ type: 'text', content: rest });
  return blocks;
}

function blocksToHtml() {
  return guideBlocks.map(b => {
    if (b.type === 'image') return `<img src="${b.data}" style="max-width:100%;border-radius:8px;margin:12px 0">`;
    return b.content;
  }).join('\n');
}

function renderGuideBlocks() {
  const container = document.getElementById('guide-blocks');
  if (!container) return;
  container.innerHTML = guideBlocks.map((b, i) => {
    if (b.type === 'image') {
      return `
        <div class="guide-block" data-index="${i}">
          <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:4px">
            <span style="font-size:0.75rem;font-weight:600;color:var(--text-secondary)">BILD</span>
            <div style="display:flex;gap:4px">
              ${i > 0 ? `<button class="btn btn-secondary btn-sm" onclick="moveGuideBlock(${i},-1)">&#8593;</button>` : ''}
              ${i < guideBlocks.length - 1 ? `<button class="btn btn-secondary btn-sm" onclick="moveGuideBlock(${i},1)">&#8595;</button>` : ''}
              <button class="btn btn-danger btn-sm" onclick="removeGuideBlock(${i})">Entfernen</button>
            </div>
          </div>
          <img src="${b.data}" style="max-width:100%;border-radius:6px;max-height:200px;object-fit:contain">
        </div>`;
    }
    return `
      <div class="guide-block" data-index="${i}">
        <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:4px">
          <span style="font-size:0.75rem;font-weight:600;color:var(--text-secondary)">TEXT</span>
          <div style="display:flex;gap:4px">
            ${i > 0 ? `<button class="btn btn-secondary btn-sm" onclick="moveGuideBlock(${i},-1)">&#8593;</button>` : ''}
            ${i < guideBlocks.length - 1 ? `<button class="btn btn-secondary btn-sm" onclick="moveGuideBlock(${i},1)">&#8595;</button>` : ''}
            ${guideBlocks.length > 1 ? `<button class="btn btn-danger btn-sm" onclick="removeGuideBlock(${i})">Entfernen</button>` : ''}
          </div>
        </div>
        <textarea class="guide-block-text" data-index="${i}" style="width:100%;min-height:100px;padding:10px 12px;border:1px solid var(--border);border-radius:var(--radius-sm);font-size:0.9rem;font-family:inherit;resize:vertical">${b.content}</textarea>
      </div>`;
  }).join('');

  container.querySelectorAll('.guide-block-text').forEach(ta => {
    ta.addEventListener('input', () => {
      guideBlocks[parseInt(ta.dataset.index)].content = ta.value;
    });
  });
}

function moveGuideBlock(index, dir) {
  const target = index + dir;
  if (target < 0 || target >= guideBlocks.length) return;
  [guideBlocks[index], guideBlocks[target]] = [guideBlocks[target], guideBlocks[index]];
  renderGuideBlocks();
}

function removeGuideBlock(index) {
  guideBlocks.splice(index, 1);
  if (guideBlocks.length === 0) guideBlocks.push({ type: 'text', content: '' });
  renderGuideBlocks();
}

function showGuideForm(guide) {
  guideBlocks = parseGuideContentToBlocks(guide?.content || '');
  const iconOptions = ['rotateLeft','filePen','coins','house','laptop','bookOpen','clock','clipboard'];
  const overlay = document.getElementById('form-overlay');
  overlay.innerHTML = `
    <div class="form-panel">
      <h3>${guide ? 'Anleitung bearbeiten' : 'Neue Anleitung'}</h3>
      <div class="form-group">
        <label>Titel</label>
        <input type="text" id="guide-title" value="${escapeHtml(guide?.title || '')}">
      </div>
      <div class="form-group">
        <label>Zusammenfassung</label>
        <input type="text" id="guide-summary" value="${escapeHtml(guide?.summary || '')}">
      </div>
      <div class="form-group">
        <label>Icon</label>
        <select id="guide-icon">
          ${iconOptions.map(i => `<option value="${i}" ${guide?.icon === i ? 'selected' : ''}>${i}</option>`).join('')}
        </select>
      </div>
      <div class="form-group">
        <label>Inhalt</label>
        <div id="guide-blocks"></div>
        <div style="display:flex;gap:6px;margin-top:8px;flex-wrap:wrap">
          <button type="button" class="btn btn-secondary btn-sm" id="guide-add-text">+ Textblock</button>
          <button type="button" class="btn btn-secondary btn-sm" id="guide-add-image">+ Bild hinzufügen</button>
        </div>
      </div>
      <div class="form-actions">
        <button class="btn btn-secondary" onclick="closeForm()">Abbrechen</button>
        <button class="btn btn-primary" id="guide-save-btn">Speichern</button>
      </div>
    </div>`;
  overlay.classList.add('active');
  renderGuideBlocks();

  document.getElementById('guide-add-text').addEventListener('click', () => {
    guideBlocks.push({ type: 'text', content: '' });
    renderGuideBlocks();
  });

  document.getElementById('guide-add-image').addEventListener('click', () => {
    const filename = prompt('Dateiname des Bildes im Ordner /bilder/:');
    if (!filename) return;
    guideBlocks.push({ type: 'image', data: 'bilder/' + filename });
    renderGuideBlocks();
  });

  document.getElementById('guide-save-btn').addEventListener('click', () => saveGuide(guide?.id || 0));
}

function editGuide(id) {
  const guide = data.guides.find(g => g.id === id);
  if (guide) showGuideForm(guide);
}

function saveGuide(id) {
  const title = document.getElementById('guide-title').value.trim();
  const summary = document.getElementById('guide-summary').value.trim();
  const iconVal = document.getElementById('guide-icon').value;
  const content = blocksToHtml();

  if (!title) { showToast('Bitte Titel eingeben'); return; }

  if (id) {
    const guide = data.guides.find(g => g.id === id);
    if (guide) {
      guide.title = title; guide.summary = summary;
      guide.icon = iconVal; guide.content = content;
    }
  } else {
    data.guides.push({
      id: nextId(data.guides),
      title, summary, icon: iconVal, content
    });
  }
  saveData();
  closeForm();
  renderGuides();
  showToast('Anleitung gespeichert');
}

function deleteGuide(id) {
  if (!confirm('Anleitung wirklich löschen?')) return;
  data.guides = data.guides.filter(g => g.id !== id);
  saveData();
  renderGuides();
  showToast('Anleitung gelöscht');
}

// ====== ANNOUNCEMENTS ======
function renderAnnouncements() {
  const container = document.getElementById('announcements-list');
  const announcements = data.announcements || [];
  if (announcements.length === 0) {
    container.innerHTML = '<p style="color:var(--text-secondary);text-align:center;padding:20px">Keine Meldungen vorhanden.</p>';
    return;
  }
  container.innerHTML = announcements.map(a => `
    <div class="admin-list-item">
      <div class="item-info">
        <div class="item-title">
          <span class="badge ${a.type === 'warning' ? 'badge-warning' : 'badge-info'}">${a.type === 'warning' ? 'Wichtig' : 'Info'}</span>
          ${escapeHtml(a.title)}
        </div>
        <div class="item-meta">${formatDate(a.date)} ${a.archived ? '· Archiviert' : ''}</div>
      </div>
      <div class="item-actions">
        <button class="btn btn-secondary btn-sm" onclick="editAnnouncement(${a.id})">Bearbeiten</button>
        <button class="btn btn-sm ${a.archived ? 'btn-primary' : 'btn-secondary'}" onclick="toggleArchiveAnnouncement(${a.id})">${a.archived ? 'Aktivieren' : 'Archivieren'}</button>
        <button class="btn btn-danger btn-sm" onclick="deleteAnnouncement(${a.id})">Löschen</button>
      </div>
    </div>
  `).join('');
}

let annAttachments = [];

function showAnnouncementForm(ann) {
  annAttachments = ann?.documents ? JSON.parse(JSON.stringify(ann.documents)) : [];
  const overlay = document.getElementById('form-overlay');
  overlay.innerHTML = `
    <div class="form-panel">
      <h3>${ann ? 'Meldung bearbeiten' : 'Neue Meldung'}</h3>
      <div class="form-group">
        <label>Typ</label>
        <select id="ann-type">
          <option value="info" ${ann?.type === 'info' ? 'selected' : ''}>Information</option>
          <option value="warning" ${ann?.type === 'warning' ? 'selected' : ''}>Wichtig</option>
        </select>
      </div>
      <div class="form-group">
        <label>Titel</label>
        <input type="text" id="ann-title" value="${escapeHtml(ann?.title || '')}">
      </div>
      <div class="form-group">
        <label>Inhalt</label>
        <textarea id="ann-content" style="min-height:100px">${escapeHtml(ann?.content || '')}</textarea>
      </div>
      <div class="form-group">
        <label>Datum</label>
        <input type="date" id="ann-date" value="${ann?.date || new Date().toISOString().split('T')[0]}">
      </div>
      <div class="form-group">
        <label>Anhänge (PDF / Links)</label>
        <div id="ann-attachments-list"></div>
        <div style="display:flex;gap:6px;margin-top:8px;flex-wrap:wrap">
          <button type="button" class="btn btn-secondary btn-sm" id="ann-add-pdf">+ Datei verknüpfen</button>
          <button type="button" class="btn btn-secondary btn-sm" id="ann-add-link">+ Link hinzufügen</button>
        </div>
      </div>
      <div class="form-actions">
        <button class="btn btn-secondary" onclick="closeForm()">Abbrechen</button>
        <button class="btn btn-primary" id="ann-save-btn">Speichern</button>
      </div>
    </div>`;
  overlay.classList.add('active');
  renderAnnAttachments();

  document.getElementById('ann-add-link').addEventListener('click', () => {
    const name = prompt('Bezeichnung des Links:');
    if (!name) return;
    const url = prompt('URL (https://...):');
    if (!url) return;
    annAttachments.push({ name, url, type: 'link' });
    renderAnnAttachments();
  });

  document.getElementById('ann-add-pdf').addEventListener('click', () => {
    const filename = prompt('Dateiname der PDF im Ordner /dokumente/:');
    if (!filename) return;
    const name = prompt('Bezeichnung:', filename);
    if (!name) return;
    annAttachments.push({ name, type: 'file', file: filename });
    renderAnnAttachments();
  });

  document.getElementById('ann-save-btn').addEventListener('click', () => saveAnnouncement(ann?.id || 0));
}

function renderAnnAttachments() {
  const container = document.getElementById('ann-attachments-list');
  if (!container) return;
  if (annAttachments.length === 0) {
    container.innerHTML = '<p style="font-size:0.8rem;color:var(--text-secondary)">Keine Anhänge</p>';
    return;
  }
  container.innerHTML = annAttachments.map((a, i) => `
    <div class="admin-list-item" style="padding:8px 10px;margin-bottom:4px">
      <div class="item-info">
        <div class="item-title" style="font-size:0.82rem">${escapeHtml(a.name)}</div>
        <div class="item-meta">${a.type === 'file' ? 'dokumente/' + escapeHtml(a.file || '') : a.type === 'pdf' ? 'PDF (hochgeladen)' : escapeHtml(a.url || '')}</div>
      </div>
      <button class="btn btn-danger btn-sm" onclick="removeAnnAttachment(${i})">Entfernen</button>
    </div>
  `).join('');
}

function removeAnnAttachment(index) {
  annAttachments.splice(index, 1);
  renderAnnAttachments();
}

function editAnnouncement(id) {
  const ann = data.announcements.find(a => a.id === id);
  if (ann) showAnnouncementForm(ann);
}

function saveAnnouncement(id) {
  const type = document.getElementById('ann-type').value;
  const title = document.getElementById('ann-title').value.trim();
  const content = document.getElementById('ann-content').value.trim();
  const date = document.getElementById('ann-date').value;

  if (!title || !content) { showToast('Titel und Inhalt sind erforderlich'); return; }

  if (id) {
    const ann = data.announcements.find(a => a.id === id);
    if (ann) {
      ann.type = type; ann.title = title;
      ann.content = content; ann.date = date;
      ann.documents = annAttachments;
    }
  } else {
    data.announcements.push({
      id: nextId(data.announcements),
      type, title, content, date, archived: false,
      documents: annAttachments
    });
  }
  saveData();
  closeForm();
  renderAnnouncements();
  showToast('Meldung gespeichert');
}

function toggleArchiveAnnouncement(id) {
  const ann = data.announcements.find(a => a.id === id);
  if (ann) {
    ann.archived = !ann.archived;
    saveData();
    renderAnnouncements();
    showToast(ann.archived ? 'Meldung archiviert' : 'Meldung aktiviert');
  }
}

function deleteAnnouncement(id) {
  if (!confirm('Meldung wirklich löschen?')) return;
  data.announcements = data.announcements.filter(a => a.id !== id);
  saveData();
  renderAnnouncements();
  showToast('Meldung gelöscht');
}

// ====== QUIZ ======
function renderQuiz() {
  const container = document.getElementById('quiz-list');
  const questions = data.quiz || [];
  if (questions.length === 0) {
    container.innerHTML = '<p style="color:var(--text-secondary);text-align:center;padding:20px">Keine Fragen vorhanden.</p>';
    return;
  }
  container.innerHTML = `<p style="font-size:0.82rem;color:var(--text-secondary);margin-bottom:12px">${questions.length} Fragen insgesamt</p>` +
    questions.map((q, i) => `
    <div class="admin-list-item">
      <div class="item-info">
        <div class="item-title" style="font-size:0.85rem">${i + 1}. ${escapeHtml(q.q)}</div>
        <div class="item-meta">Richtige Antwort: ${escapeHtml(q.options[q.answer] || '?')}</div>
      </div>
      <div class="item-actions">
        <button class="btn btn-secondary btn-sm" onclick="editQuizQuestion(${q.id})">Bearbeiten</button>
        <button class="btn btn-danger btn-sm" onclick="deleteQuizQuestion(${q.id})">Löschen</button>
      </div>
    </div>
  `).join('');
}

function showQuizForm(question) {
  const overlay = document.getElementById('form-overlay');
  overlay.innerHTML = `
    <div class="form-panel">
      <h3>${question ? 'Frage bearbeiten' : 'Neue Frage'}</h3>
      <div class="form-group">
        <label>Frage</label>
        <textarea id="quiz-q" style="min-height:80px">${escapeHtml(question?.q || '')}</textarea>
      </div>
      <div class="form-group">
        <label>Antwort A</label>
        <input type="text" id="quiz-opt-0" value="${escapeHtml(question?.options?.[0] || '')}">
      </div>
      <div class="form-group">
        <label>Antwort B</label>
        <input type="text" id="quiz-opt-1" value="${escapeHtml(question?.options?.[1] || '')}">
      </div>
      <div class="form-group">
        <label>Antwort C</label>
        <input type="text" id="quiz-opt-2" value="${escapeHtml(question?.options?.[2] || '')}">
      </div>
      <div class="form-group">
        <label>Richtige Antwort</label>
        <select id="quiz-answer">
          <option value="0" ${question?.answer === 0 ? 'selected' : ''}>A</option>
          <option value="1" ${question?.answer === 1 ? 'selected' : ''}>B</option>
          <option value="2" ${question?.answer === 2 ? 'selected' : ''}>C</option>
        </select>
      </div>
      <div class="form-actions">
        <button class="btn btn-secondary" onclick="closeForm()">Abbrechen</button>
        <button class="btn btn-primary" id="quiz-save-btn">Speichern</button>
      </div>
    </div>`;
  overlay.classList.add('active');
  document.getElementById('quiz-save-btn').addEventListener('click', () => saveQuizQuestion(question?.id || 0));
}

function editQuizQuestion(id) {
  const q = (data.quiz || []).find(q => q.id === id);
  if (q) showQuizForm(q);
}

function saveQuizQuestion(id) {
  const q = document.getElementById('quiz-q').value.trim();
  const options = [
    document.getElementById('quiz-opt-0').value.trim(),
    document.getElementById('quiz-opt-1').value.trim(),
    document.getElementById('quiz-opt-2').value.trim()
  ];
  const answer = parseInt(document.getElementById('quiz-answer').value);

  if (!q) { showToast('Bitte Frage eingeben'); return; }
  if (options.some(o => !o)) { showToast('Bitte alle 3 Antworten ausfüllen'); return; }

  if (!data.quiz) data.quiz = [];

  if (id) {
    const existing = data.quiz.find(x => x.id === id);
    if (existing) {
      existing.q = q; existing.options = options; existing.answer = answer;
    }
  } else {
    data.quiz.push({ id: nextId(data.quiz), q, options, answer });
  }
  saveData();
  closeForm();
  renderQuiz();
  showToast('Frage gespeichert');
}

function deleteQuizQuestion(id) {
  if (!confirm('Frage wirklich löschen?')) return;
  data.quiz = (data.quiz || []).filter(q => q.id !== id);
  saveData();
  renderQuiz();
  showToast('Frage gelöscht');
}

// ====== EXPORT ======
function exportData() {
  const json = JSON.stringify(data, null, 2);
  const blob = new Blob([json], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'content.json';
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
  showToast('content.json exportiert – ersetze die Datei im Projekt und pushe zu GitHub');
}

// ====== SHARED ======
function closeForm() {
  document.getElementById('form-overlay').classList.remove('active');
}

function resetData() {
  if (!confirm('Alle Daten zurücksetzen? Dies lädt die Standarddaten neu.')) return;
  localStorage.removeItem(STORAGE_KEY);
  location.reload();
}

function initAdminApp() {
  loadData().then(() => {
    document.querySelectorAll('.admin-tab').forEach(tab => {
      tab.addEventListener('click', () => switchTab(tab.dataset.tab));
    });

    document.getElementById('add-rule').addEventListener('click', () => showRuleForm(null));
    document.getElementById('add-event').addEventListener('click', () => showEventForm(null));
    document.getElementById('add-document').addEventListener('click', () => showDocumentForm(null, null));
    document.getElementById('add-guide').addEventListener('click', () => showGuideForm(null));
    document.getElementById('add-announcement').addEventListener('click', () => showAnnouncementForm(null));
    document.getElementById('add-quiz').addEventListener('click', () => showQuizForm(null));
    document.getElementById('export-data').addEventListener('click', exportData);
    document.getElementById('reset-data').addEventListener('click', resetData);
    document.getElementById('logout-btn').addEventListener('click', logout);

    document.getElementById('form-overlay').addEventListener('click', (e) => {
      if (e.target === e.currentTarget) closeForm();
    });

    switchTab('rules');
  });
}

// Init
document.addEventListener('DOMContentLoaded', () => {
  // Login form
  document.getElementById('login-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const user = document.getElementById('login-user').value.trim();
    const pass = document.getElementById('login-pass').value;
    const passHash = await hashPassword(pass);

    if (user === ADMIN_USER && passHash === ADMIN_PASS_HASH) {
      sessionStorage.setItem(SESSION_KEY, 'authenticated');
      document.getElementById('login-error').classList.remove('visible');
      showAdminApp();
      initAdminApp();
    } else {
      document.getElementById('login-error').classList.add('visible');
      document.getElementById('login-pass').value = '';
      document.getElementById('login-pass').focus();
    }
  });

  // Auto-login if session exists
  if (isLoggedIn()) {
    showAdminApp();
    initAdminApp();
  }
});
