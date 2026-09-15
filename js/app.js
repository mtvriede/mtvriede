const MONTHS_DE = ['Januar','Februar','März','April','Mai','Juni','Juli','August','September','Oktober','November','Dezember'];
const MONTHS_SHORT = ['Jan','Feb','Mär','Apr','Mai','Jun','Jul','Aug','Sep','Okt','Nov','Dez'];

let data = null;
let currentPage = 'home';
let detailState = null;

function loadData() {
  return fetch('data/content.json')
    .then(r => r.json())
    .then(d => { data = d; });
}

function formatDate(dateStr) {
  const d = new Date(dateStr + 'T00:00:00');
  return `${String(d.getDate()).padStart(2,'0')}.${String(d.getMonth()+1).padStart(2,'0')}.${d.getFullYear()}`;
}

function getDay(dateStr) {
  return new Date(dateStr + 'T00:00:00').getDate();
}

function getMonthShort(dateStr) {
  return MONTHS_SHORT[new Date(dateStr + 'T00:00:00').getMonth()];
}

function getMonthYear(dateStr) {
  const d = new Date(dateStr + 'T00:00:00');
  return `${MONTHS_DE[d.getMonth()]} ${d.getFullYear()}`;
}

function isFuture(dateStr) {
  return new Date(dateStr + 'T23:59:59') >= new Date();
}

function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}

// Navigation
function navigateTo(page) {
  currentPage = page;
  detailState = null;
  document.querySelectorAll('.page-section').forEach(el => el.classList.remove('active'));
  document.querySelectorAll('.nav-item').forEach(el => el.classList.remove('active'));

  const section = document.getElementById('page-' + page);
  if (section) section.classList.add('active');

  const nav = document.querySelector(`[data-page="${page}"]`);
  if (nav) nav.classList.add('active');

  renderPage(page);
  window.scrollTo(0, 0);
}

function showDetail(type, id) {
  detailState = { type, id };
  document.querySelectorAll('.page-section').forEach(el => el.classList.remove('active'));
  const detailEl = document.getElementById('page-detail');
  detailEl.classList.add('active');
  renderDetail(type, id);
  window.scrollTo(0, 0);
}

function goBack() {
  if (detailState) {
    const map = { rule: 'rules', guide: 'guides', event: 'events' };
    navigateTo(map[detailState.type] || 'home');
  } else {
    navigateTo('home');
  }
}

// Render pages
function renderPage(page) {
  switch (page) {
    case 'home': renderHome(); break;
    case 'rules': renderRules(); break;
    case 'events': renderEvents(); break;
    case 'documents': renderDocuments(); break;
    case 'guides': renderGuides(); break;
    case 'quiz': renderQuizStart(); break;
  }
}

function renderHome() {
  const container = document.getElementById('home-content');
  let html = '';

  // Announcements
  const activeAnnouncements = (data.announcements || []).filter(a => !a.archived);
  if (activeAnnouncements.length > 0) {
    activeAnnouncements.forEach(a => {
      const iconName = a.type === 'warning' ? 'triangleAlert' : 'info';
      const docs = a.documents || [];
      html += `
        <div class="announcement ${a.type}">
          ${icon(iconName, 'announcement-icon')}
          <div class="announcement-body">
            <strong>${escapeHtml(a.title)}</strong>
            <p>${escapeHtml(a.content)}</p>
            ${docs.length > 0 ? `<div class="announcement-docs">${docs.map((d, i) => `
              <a href="#" class="detail-doc-link" style="margin-top:6px;font-size:0.8rem;padding:8px 10px" onclick="event.preventDefault(); openAnnAttachment(${a.id}, ${i})">
                ${icon('download')}
                ${escapeHtml(d.name)}
              </a>`).join('')}</div>` : ''}
            <div class="announcement-date">${formatDate(a.date)}</div>
          </div>
        </div>`;
    });
  }

  // Latest rule
  const activeRules = (data.rules || []).filter(r => !r.archived);
  if (activeRules.length > 0) {
    const latest = activeRules[activeRules.length - 1];
    html += `
      <div class="section-header">
        ${icon('sparkles', 'section-icon')}
        <h3>Neue Regeln</h3>
        <a class="see-all" onclick="navigateTo('rules')">Alle Regeln</a>
      </div>
      <div class="card" onclick="showDetail('rule', ${latest.id})">
        <div class="card-title">${escapeHtml(latest.title)}</div>
        <div class="card-subtitle">${escapeHtml(latest.subtitle)}</div>
        <div class="card-meta">
          ${icon('calendar')}
          <span>Gültig ab ${formatDate(latest.date)}</span>
          <span class="card-arrow">${icon('chevronRight')}</span>
        </div>
      </div>`;
  }

  // Next event
  const futureEvents = (data.events || []).filter(e => isFuture(e.date)).sort((a,b) => a.date.localeCompare(b.date));
  if (futureEvents.length > 0) {
    const next = futureEvents[0];
    html += `
      <div class="section-header">
        ${icon('calendar', 'section-icon')}
        <h3>Nächster Termin</h3>
        <a class="see-all" onclick="navigateTo('events')">Alle Termine</a>
      </div>
      <div class="card" onclick="showDetail('event', ${next.id})">
        <div class="event-card">
          <div class="event-date-badge">
            <div class="day">${getDay(next.date)}</div>
            <div class="month">${getMonthShort(next.date)}</div>
          </div>
          <div class="event-info">
            <div class="card-title">${escapeHtml(next.title)}</div>
            <div class="event-detail">${icon('clock')}<span>${next.time} Uhr</span></div>
            ${next.location ? `<div class="event-detail">${icon('mapPin')}<span>${escapeHtml(next.location)}</span></div>` : ''}
          </div>
        </div>
      </div>`;
  }

  // Popular guides
  const guides = data.guides || [];
  if (guides.length > 0) {
    html += `
      <div class="section-header">
        ${icon('bookOpen', 'section-icon')}
        <h3>Beliebte Anleitungen</h3>
        <a class="see-all" onclick="navigateTo('guides')">Alle Anleitungen</a>
      </div>`;
    guides.slice(0, 3).forEach(g => {
      html += `
        <div class="card" onclick="showDetail('guide', ${g.id})">
          <div class="guide-card">
            <div class="guide-icon">${icon(g.icon || 'bookOpen')}</div>
            <div class="guide-info">
              <div class="card-title">${escapeHtml(g.title)}</div>
              <div class="card-subtitle">${escapeHtml(g.summary)}</div>
            </div>
            <span class="card-arrow">${icon('chevronRight')}</span>
          </div>
        </div>`;
    });
  }

  // Quiz teaser
  const quizQuestions = data.quiz || [];
  if (quizQuestions.length > 0) {
    html += `
      <div class="section-header">
        ${icon('graduationCap', 'section-icon')}
        <h3>Regeltest</h3>
      </div>
      <div class="card" onclick="navigateTo('quiz')">
        <div class="guide-card">
          <div class="guide-icon" style="background:#e6ecf5">${icon('graduationCap')}</div>
          <div class="guide-info">
            <div class="card-title">Teste dein Regelwissen</div>
            <div class="card-subtitle">20 zufällige Fragen – max. 5 Fehler</div>
          </div>
          <span class="card-arrow">${icon('chevronRight')}</span>
        </div>
      </div>`;
  }

  container.innerHTML = html;
}

function renderRules() {
  const container = document.getElementById('rules-content');
  const activeRules = (data.rules || []).filter(r => !r.archived);

  if (activeRules.length === 0) {
    container.innerHTML = `<div class="empty-state">${icon('sparkles')}<p>Keine aktuellen Regeländerungen.</p></div>`;
    return;
  }

  let html = '';
  activeRules.forEach(r => {
    html += `
      <div class="card" onclick="showDetail('rule', ${r.id})">
        <div class="card-title">${escapeHtml(r.title)}</div>
        <div class="card-subtitle">${escapeHtml(r.subtitle)}</div>
        <div class="card-meta">
          ${icon('calendar')}
          <span>Gültig ab ${formatDate(r.date)}</span>
          <span class="card-arrow">${icon('chevronRight')}</span>
        </div>
      </div>`;
  });
  container.innerHTML = html;
}

function renderEvents() {
  const container = document.getElementById('events-content');
  const futureEvents = (data.events || []).filter(e => isFuture(e.date)).sort((a,b) => a.date.localeCompare(b.date));

  if (futureEvents.length === 0) {
    container.innerHTML = `<div class="empty-state">${icon('calendar')}<p>Keine anstehenden Termine.</p></div>`;
    return;
  }

  let html = '';
  let lastMonth = '';
  futureEvents.forEach(e => {
    const monthYear = getMonthYear(e.date);
    if (monthYear !== lastMonth) {
      html += `<div class="month-divider">${monthYear}</div>`;
      lastMonth = monthYear;
    }
    html += `
      <div class="card" onclick="showDetail('event', ${e.id})">
        <div class="event-card">
          <div class="event-date-badge">
            <div class="day">${getDay(e.date)}</div>
            <div class="month">${getMonthShort(e.date)}</div>
          </div>
          <div class="event-info">
            <div class="card-title">${escapeHtml(e.title)}</div>
            <div class="event-detail">${icon('clock')}<span>${e.time} Uhr</span></div>
            ${e.location ? `<div class="event-detail">${icon('mapPin')}<span>${escapeHtml(e.location)}</span></div>` : ''}
          </div>
        </div>
      </div>`;
  });
  container.innerHTML = html;
}

function renderDocuments() {
  const container = document.getElementById('documents-content');
  const categories = (data.documents && data.documents.categories) || [];

  if (categories.length === 0) {
    container.innerHTML = `<div class="empty-state">${icon('fileText')}<p>Keine Dokumente vorhanden.</p></div>`;
    return;
  }

  const iconMap = {
    'book': 'book',
    'building': 'building',
    'receipt': 'receipt',
    'clipboard': 'clipboard',
    'graduation-cap': 'graduationCap'
  };

  let html = '';
  categories.forEach(cat => {
    const catIcon = iconMap[cat.icon] || 'fileText';
    html += `
      <div class="doc-category" id="doc-cat-${cat.id}">
        <div class="doc-category-header" onclick="toggleDocCategory('${cat.id}')">
          <div class="doc-category-icon">${icon(catIcon)}</div>
          <span class="doc-category-name">${escapeHtml(cat.name)}</span>
          <span class="doc-category-count">${cat.items.length}</span>
          ${icon('chevronRight', 'doc-category-chevron')}
        </div>
        <div class="doc-category-items">
          ${cat.items.map(item => `
            <div class="doc-item" onclick="event.stopPropagation(); openDocument(${item.id})">
              ${icon('filePdf')}
              <span>${escapeHtml(item.title)}</span>
              <span class="card-arrow">${icon('download')}</span>
            </div>
          `).join('')}
        </div>
      </div>`;
  });
  container.innerHTML = html;
}

function toggleDocCategory(catId) {
  const el = document.getElementById('doc-cat-' + catId);
  if (el) el.classList.toggle('open');
}

function openAttachment(att) {
  if (att.file) {
    window.open('dokumente/' + att.file, '_blank');
    return;
  }
  if (att.fileRef) {
    const base64 = loadFile(att.fileRef);
    if (base64) { openPdfBase64(base64); return; }
  }
  if (att.fileData) { openPdfBase64(att.fileData); return; }
  if (att.url && att.url !== '#') { window.open(att.url, '_blank'); return; }
  showToast('Kein Dokument hinterlegt');
}

function openDocument(docId) {
  let doc = null;
  for (const cat of (data.documents.categories || [])) {
    doc = cat.items.find(i => i.id === docId);
    if (doc) break;
  }
  if (!doc) return;
  openAttachment(doc);
}

function renderGuides() {
  const container = document.getElementById('guides-content');
  const guides = data.guides || [];

  if (guides.length === 0) {
    container.innerHTML = `<div class="empty-state">${icon('bookOpen')}<p>Keine Anleitungen vorhanden.</p></div>`;
    return;
  }

  let html = '';
  guides.forEach(g => {
    html += `
      <div class="card" onclick="showDetail('guide', ${g.id})">
        <div class="guide-card">
          <div class="guide-icon">${icon(g.icon || 'bookOpen')}</div>
          <div class="guide-info">
            <div class="card-title">${escapeHtml(g.title)}</div>
            <div class="card-subtitle">${escapeHtml(g.summary)}</div>
          </div>
          <span class="card-arrow">${icon('chevronRight')}</span>
        </div>
      </div>`;
  });
  container.innerHTML = html;
}

function renderDetail(type, id) {
  const container = document.getElementById('detail-content');
  let html = '';

  if (type === 'rule') {
    const rule = data.rules.find(r => r.id === id);
    if (!rule) { goBack(); return; }
    html = `
      <button class="detail-back" onclick="goBack()">${icon('chevronLeft')} Zurück</button>
      <div class="detail-title">${escapeHtml(rule.title)}</div>
      <div class="detail-date">Gültig ab ${formatDate(rule.date)}</div>
      <div class="detail-content">${rule.content}</div>
      ${rule.documents && rule.documents.length > 0 ? `
        <div class="detail-documents">
          <h4>Dokumente</h4>
          ${rule.documents.map((d, i) => `
            <a class="detail-doc-link" href="#" onclick="event.preventDefault(); openRuleAttachment(${rule.id}, ${i})">
              ${icon('download')}
              ${escapeHtml(d.name)}
            </a>
          `).join('')}
        </div>` : ''}`;
  }

  if (type === 'guide') {
    const guide = data.guides.find(g => g.id === id);
    if (!guide) { goBack(); return; }
    html = `
      <button class="detail-back" onclick="goBack()">${icon('chevronLeft')} Zurück</button>
      <div class="detail-title">${escapeHtml(guide.title)}</div>
      <div class="detail-content">${guide.content}</div>`;
  }

  if (type === 'event') {
    const ev = data.events.find(e => e.id === id);
    if (!ev) { goBack(); return; }
    html = `
      <button class="detail-back" onclick="goBack()">${icon('chevronLeft')} Zurück</button>
      <div class="detail-title">${escapeHtml(ev.title)}</div>
      <div class="detail-date">${formatDate(ev.date)} · ${ev.time} Uhr</div>
      <div class="detail-content">
        ${ev.location ? `<div class="event-detail" style="margin-bottom:8px">${icon('mapPin')}<span>${escapeHtml(ev.location)}</span></div>` : ''}
        ${ev.description ? `<p>${escapeHtml(ev.description)}</p>` : ''}
        ${ev.contact ? `<p><strong>Ansprechpartner:</strong> ${escapeHtml(ev.contact)}</p>` : ''}
      </div>`;
  }

  container.innerHTML = html;
}

// ====== QUIZ / REGELTEST ======
const QUIZ_COUNT = 20;
const QUIZ_MAX_ERRORS = 5;
let quizQuestions = [];
let quizAnswers = [];
let quizCurrent = 0;
let quizFinished = false;

function shuffle(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function renderQuizStart() {
  const container = document.getElementById('quiz-content');
  const allQuestions = data.quiz || [];
  const count = Math.min(QUIZ_COUNT, allQuestions.length);

  container.innerHTML = `
    <div style="text-align:center;padding:32px 0 24px">
      ${icon('graduationCap', 'section-icon')}
      <h2 class="page-title" style="margin:12px 0 8px">Regeltest</h2>
      <p style="color:var(--text-secondary);font-size:0.9rem;max-width:400px;margin:0 auto 24px">
        Teste dein Wissen! Es werden zufällig <strong>${count} Fragen</strong> ausgewählt.
        Du darfst maximal <strong>${QUIZ_MAX_ERRORS} Fehler</strong> machen, um zu bestehen.
      </p>
      ${allQuestions.length === 0
        ? '<p style="color:var(--text-secondary)">Keine Fragen vorhanden.</p>'
        : `<button class="btn btn-primary" style="font-size:1rem;padding:14px 32px" onclick="startQuiz()">Test starten</button>`
      }
    </div>`;
}

function startQuiz() {
  const allQuestions = data.quiz || [];
  quizQuestions = shuffle(allQuestions).slice(0, QUIZ_COUNT);
  quizAnswers = new Array(quizQuestions.length).fill(-1);
  quizCurrent = 0;
  quizFinished = false;
  renderQuizQuestion();
}

function renderQuizQuestion() {
  const container = document.getElementById('quiz-content');
  const q = quizQuestions[quizCurrent];
  const total = quizQuestions.length;
  const answered = quizAnswers[quizCurrent];
  const progress = Math.round(((quizCurrent) / total) * 100);

  container.innerHTML = `
    <div class="quiz-progress">
      <div class="quiz-progress-bar" style="width:${progress}%"></div>
    </div>
    <div class="quiz-header">
      <span class="quiz-counter">Frage ${quizCurrent + 1} von ${total}</span>
    </div>
    <div class="quiz-question">${escapeHtml(q.q)}</div>
    <div class="quiz-options">
      ${q.options.map((opt, i) => {
        let cls = 'quiz-option';
        if (answered !== -1) {
          if (i === q.answer) cls += ' correct';
          else if (i === answered && i !== q.answer) cls += ' wrong';
          else cls += ' disabled';
        }
        return `<button class="${cls}" ${answered !== -1 ? 'disabled' : ''} onclick="selectAnswer(${i})">${escapeHtml(opt)}</button>`;
      }).join('')}
    </div>
    ${answered !== -1 ? `
      <div style="text-align:center;margin-top:20px">
        <button class="btn btn-primary" style="padding:12px 28px" onclick="${quizCurrent < total - 1 ? 'nextQuestion()' : 'showQuizResult()'}">
          ${quizCurrent < total - 1 ? 'Nächste Frage' : 'Ergebnis anzeigen'}
        </button>
      </div>
    ` : ''}`;
}

function selectAnswer(index) {
  if (quizAnswers[quizCurrent] !== -1) return;
  quizAnswers[quizCurrent] = index;
  renderQuizQuestion();
}

function nextQuestion() {
  quizCurrent++;
  renderQuizQuestion();
  window.scrollTo(0, 0);
}

function showQuizResult() {
  const container = document.getElementById('quiz-content');
  const total = quizQuestions.length;
  let correct = 0;
  quizQuestions.forEach((q, i) => {
    if (quizAnswers[i] === q.answer) correct++;
  });
  const errors = total - correct;
  const passed = errors <= QUIZ_MAX_ERRORS;
  const percent = Math.round((correct / total) * 100);

  container.innerHTML = `
    <div style="text-align:center;padding:32px 0 16px">
      <div class="quiz-result-icon ${passed ? 'passed' : 'failed'}">
        ${passed ? icon('graduationCap') : icon('x')}
      </div>
      <h2 class="page-title" style="margin:16px 0 8px">${passed ? 'Bestanden!' : 'Nicht bestanden'}</h2>
      <p style="color:var(--text-secondary);font-size:0.95rem;margin-bottom:24px">
        ${correct} von ${total} richtig (${percent}%) &middot; ${errors} Fehler
      </p>
      <div class="quiz-result-bar">
        <div class="quiz-result-fill ${passed ? 'passed' : 'failed'}" style="width:${percent}%"></div>
      </div>
      <p style="font-size:0.82rem;color:var(--text-secondary);margin:12px 0 24px">
        Erlaubte Fehler: ${QUIZ_MAX_ERRORS} &middot; Deine Fehler: ${errors}
      </p>
    </div>
    <h3 style="font-size:0.85rem;font-weight:600;text-transform:uppercase;letter-spacing:0.5px;color:var(--text-secondary);margin-bottom:12px">Auswertung</h3>
    ${quizQuestions.map((q, i) => {
      const wasCorrect = quizAnswers[i] === q.answer;
      return `
        <div class="quiz-review-item ${wasCorrect ? 'correct' : 'wrong'}">
          <div class="quiz-review-num">${i + 1}</div>
          <div class="quiz-review-body">
            <div class="quiz-review-q">${escapeHtml(q.q)}</div>
            ${!wasCorrect ? `
              <div class="quiz-review-answer wrong">Deine Antwort: ${escapeHtml(q.options[quizAnswers[i]] || '–')}</div>
              <div class="quiz-review-answer correct">Richtig: ${escapeHtml(q.options[q.answer])}</div>
            ` : `
              <div class="quiz-review-answer correct">Richtig: ${escapeHtml(q.options[q.answer])}</div>
            `}
          </div>
        </div>`;
    }).join('')}
    <div style="text-align:center;padding:20px 0 32px">
      <button class="btn btn-primary" style="padding:12px 28px" onclick="startQuiz()">Neuer Versuch</button>
      <button class="btn btn-secondary" style="padding:12px 28px;margin-left:8px" onclick="renderQuizStart()">Zurück</button>
    </div>`;
  window.scrollTo(0, 0);
}

function openAnnAttachment(annId, index) {
  const ann = data.announcements.find(a => a.id === annId);
  if (!ann || !ann.documents || !ann.documents[index]) return;
  openAttachment(ann.documents[index]);
}

function openRuleAttachment(ruleId, index) {
  const rule = data.rules.find(r => r.id === ruleId);
  if (!rule || !rule.documents || !rule.documents[index]) return;
  openAttachment(rule.documents[index]);
}

// Show toast
function showToast(message) {
  const toast = document.getElementById('toast');
  if (!toast) return;
  toast.textContent = message;
  toast.classList.add('show');
  setTimeout(() => toast.classList.remove('show'), 2500);
}

// Init
document.addEventListener('DOMContentLoaded', () => {
  loadData().then(() => {
    navigateTo('home');
  });

  // Nav click handlers
  document.querySelectorAll('.nav-item').forEach(btn => {
    btn.addEventListener('click', () => {
      navigateTo(btn.dataset.page);
    });
  });
});
