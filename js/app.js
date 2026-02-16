/* ============================================
   PET English Study Tool
   ============================================ */
(function () {
  'use strict';

  // ---- State ----
  let units = {};
  let currentUnit = 1;
  let currentSession = null;
  let currentMode = 'learn';
  let flashcards = [];
  let flashcardIdx = 0;
  let flashcardFlipped = false;

  const STORAGE = {
    ERRORS: 'pet_errors',
    REVIEW: 'pet_review_due',
  };

  // ---- DOM refs ----
  const $ = (s) => document.getElementById(s);
  const $$ = (s) => document.querySelectorAll(s);

  // ---- Init ----
  async function init() {
    try {
      const resp = await fetch('data/units.json');
      units = await resp.json();
    } catch (e) {
      console.error('Failed to load units.json', e);
      $('contentArea').innerHTML = '<div class="empty-state"><p>数据加载失败</p></div>';
      return;
    }

    buildUnitSelect();
    bindEvents();
    switchMode('learn');
    selectUnit(1);
    updateBadges();
  }

  // ---- Unit select ----
  function buildUnitSelect() {
    const sel = $('unitSelect');
    sel.innerHTML = '';
    for (const [id, unit] of Object.entries(units)) {
      const opt = document.createElement('option');
      opt.value = id;
      opt.textContent = unit.title;
      sel.appendChild(opt);
    }
  }

  function selectUnit(n) {
    currentUnit = String(n);
    currentSession = null;
    $('unitSelect').value = currentUnit;

    const unit = units[currentUnit];
    $('topbarTitle').textContent = unit.title;

    renderSessionTabs();
    $('contentArea').innerHTML = '<div class="empty-state"><div class="empty-icon">📚</div><p>选择一个 Session 开始学习</p></div>';
  }

  // ---- Session tabs ----
  function renderSessionTabs() {
    const unit = units[currentUnit];
    const tabs = $('sessionTabs');
    tabs.innerHTML = '';

    unit.sessions.forEach((s) => {
      const btn = document.createElement('button');
      btn.className = 'session-tab';
      btn.innerHTML = `<span class="tab-title">Session ${s.id}: ${s.title}</span><span class="tab-type">${s.typeLabel}</span>`;
      btn.onclick = () => selectSession(s.id);
      tabs.appendChild(btn);
    });
  }

  function selectSession(id) {
    currentSession = id;

    // Highlight tab
    $$('.session-tab').forEach((t, i) => {
      t.classList.toggle('active', i === id - 1);
    });

    renderContent();
  }

  // ---- Content rendering ----
  function renderContent() {
    const unit = units[currentUnit];
    const session = unit.sessions.find((s) => s.id === currentSession);
    if (!session) return;

    const area = $('contentArea');
    let html = '';

    // Audio player
    if (session.audioUrl) {
      html += `
        <div class="audio-player">
          <span class="audio-label">🔊 音频</span>
          <audio controls preload="none" src="${session.audioUrl}"></audio>
        </div>`;
    }

    // Transcript
    if (session.transcript) {
      html += buildSection('📝 Transcript', session.transcript, 'transcript');
    }

    // Content
    if (session.content) {
      html += buildSection('📖 教学内容', session.content, 'content-html');
    }

    // Keywords
    if (session.keyWords && session.keyWords.length > 0) {
      const tags = session.keyWords
        .map((kw) => `<span class="keyword-tag" title="点击添加到复习">${esc(kw)}</span>`)
        .join('');
      html += buildSection(`🏷️ 关键词 (${session.keyWords.length})`, `<div class="keyword-list">${tags}</div>`, null, true);
    }

    area.innerHTML = html;

    // Bind section collapse
    area.querySelectorAll('.content-section-header').forEach((h) => {
      h.addEventListener('click', () => {
        h.classList.toggle('collapsed');
        h.nextElementSibling.classList.toggle('collapsed');
      });
    });

    // Bind keyword click → add to review
    area.querySelectorAll('.keyword-tag').forEach((tag) => {
      tag.addEventListener('click', () => {
        addToReview(tag.textContent, currentUnit, currentSession);
        tag.style.background = '#16a34a';
        tag.style.color = '#fff';
        setTimeout(() => { tag.style.background = ''; tag.style.color = ''; }, 600);
      });
    });
  }

  function buildSection(title, content, cls, startCollapsed) {
    const bodyClass = cls ? `content-section-body ${cls}` : 'content-section-body';
    const headerClass = startCollapsed ? 'content-section-header collapsed' : 'content-section-header';
    const bodyCollapsed = startCollapsed ? 'collapsed' : '';
    return `
      <div class="content-section">
        <div class="${headerClass}">${title}</div>
        <div class="${bodyClass} ${bodyCollapsed}">${content}</div>
      </div>`;
  }

  function esc(s) {
    const d = document.createElement('div');
    d.textContent = s;
    return d.innerHTML;
  }

  // ---- Mode switching ----
  function switchMode(mode) {
    currentMode = mode;

    $$('.mode-btn').forEach((b) => b.classList.toggle('active', b.dataset.mode === mode));

    $('panelLearn').classList.toggle('hidden', mode !== 'learn');
    $('panelReview').classList.toggle('hidden', mode !== 'review');
    $('panelErrors').classList.toggle('hidden', mode !== 'errors');

    if (mode === 'errors') renderErrors();
  }

  // ---- Review / Flashcard system ----
  function getReviewList() {
    return JSON.parse(localStorage.getItem(STORAGE.REVIEW) || '[]');
  }
  function saveReviewList(list) {
    localStorage.setItem(STORAGE.REVIEW, JSON.stringify(list));
    updateBadges();
  }

  function addToReview(word, unitId, sessionId) {
    const list = getReviewList();
    if (list.find((r) => r.word === word)) return;
    list.push({ word, unitId, sessionId, added: Date.now(), errors: 0 });
    saveReviewList(list);
  }

  function startReview(scope) {
    let list = getReviewList();
    if (scope === 'unit') {
      list = list.filter((r) => String(r.unitId) === String(currentUnit));
    }
    if (list.length === 0) {
      // If no saved words, use current unit keywords
      const unit = units[currentUnit];
      list = [];
      unit.sessions.forEach((s) => {
        (s.keyWords || []).forEach((kw) => {
          if (!list.find((r) => r.word === kw)) {
            list.push({ word: kw, unitId: currentUnit, sessionId: s.id });
          }
        });
      });
    }
    if (list.length === 0) return;

    // Shuffle
    for (let i = list.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [list[i], list[j]] = [list[j], list[i]];
    }

    flashcards = list;
    flashcardIdx = 0;
    showFlashcard();
    $('flashcardModal').classList.remove('hidden');
  }

  function showFlashcard() {
    if (flashcardIdx >= flashcards.length) {
      closeFlashcard();
      return;
    }
    const card = flashcards[flashcardIdx];
    $('flashcardCount').textContent = `${flashcardIdx + 1} / ${flashcards.length}`;
    $('flashcardFront').textContent = card.word;
    $('flashcardBack').textContent = `Unit ${card.unitId}, Session ${card.sessionId}`;
    $('flashcardBack').classList.add('hidden');
    $('flashcardFront').classList.remove('hidden');
    flashcardFlipped = false;
  }

  function flipCard() {
    flashcardFlipped = !flashcardFlipped;
    $('flashcardFront').classList.toggle('hidden', flashcardFlipped);
    $('flashcardBack').classList.toggle('hidden', !flashcardFlipped);
  }

  function answerCard(correct) {
    if (!correct) {
      recordError(flashcards[flashcardIdx]);
    }
    flashcardIdx++;
    showFlashcard();
  }

  function closeFlashcard() {
    $('flashcardModal').classList.add('hidden');
    updateBadges();
  }

  // ---- Error tracking ----
  function getErrors() {
    return JSON.parse(localStorage.getItem(STORAGE.ERRORS) || '[]');
  }
  function saveErrors(list) {
    localStorage.setItem(STORAGE.ERRORS, JSON.stringify(list));
    updateBadges();
  }

  function recordError(card) {
    const list = getErrors();
    const existing = list.find((e) => e.word === card.word);
    if (existing) {
      existing.count++;
      existing.lastTime = Date.now();
    } else {
      list.push({
        word: card.word,
        unitId: card.unitId,
        sessionId: card.sessionId,
        count: 1,
        lastTime: Date.now(),
      });
    }
    saveErrors(list);
  }

  function renderErrors() {
    const list = getErrors();
    const el = $('errorList');

    if (list.length === 0) {
      el.innerHTML = '<div class="empty-state"><div class="empty-icon">✅</div><p>暂无错题记录</p></div>';
      return;
    }

    // Sort by count desc
    list.sort((a, b) => b.count - a.count);

    el.innerHTML = list
      .map(
        (e) => `
        <div class="error-card">
          <div class="error-card-header">
            <span>Unit ${e.unitId} Session ${e.sessionId}</span>
            <span>错误 ${e.count} 次</span>
          </div>
          <div class="error-card-word">${esc(e.word)}</div>
          <div class="error-card-detail">最近: ${new Date(e.lastTime).toLocaleDateString()}</div>
        </div>`
      )
      .join('');
  }

  // ---- Badges ----
  function updateBadges() {
    const reviewCount = getReviewList().length;
    const errorCount = getErrors().length;

    const rb = $('reviewBadge');
    rb.textContent = reviewCount;
    rb.hidden = reviewCount === 0;

    const eb = $('errorBadge');
    eb.textContent = errorCount;
    eb.hidden = errorCount === 0;
  }

  // ---- Event binding ----
  function bindEvents() {
    // Sidebar toggle
    $('sidebarToggle').addEventListener('click', () => {
      $('sidebar').classList.toggle('collapsed');
    });

    // Unit select
    $('unitSelect').addEventListener('change', (e) => {
      selectUnit(e.target.value);
    });

    // Mode buttons
    $$('.mode-btn').forEach((btn) => {
      btn.addEventListener('click', () => switchMode(btn.dataset.mode));
    });

    // Review buttons
    $('btnReviewAll').addEventListener('click', () => startReview('all'));
    $('btnReviewUnit').addEventListener('click', () => startReview('unit'));

    // Flashcard controls
    $('btnFlip').addEventListener('click', flipCard);
    $('flashcard').addEventListener('click', flipCard);
    $('btnRight').addEventListener('click', () => answerCard(true));
    $('btnWrong').addEventListener('click', () => answerCard(false));
    $('flashcardClose').addEventListener('click', closeFlashcard);
    $('flashcardModal').addEventListener('click', (e) => {
      if (e.target === $('flashcardModal')) closeFlashcard();
    });

    // Clear errors
    $('btnClearErrors').addEventListener('click', () => {
      if (confirm('确定清空所有错题记录？')) {
        saveErrors([]);
        renderErrors();
      }
    });

    // Keyboard shortcuts
    document.addEventListener('keydown', (e) => {
      if ($('flashcardModal').classList.contains('hidden')) return;
      if (e.key === ' ' || e.key === 'Enter') { e.preventDefault(); flipCard(); }
      if (e.key === 'ArrowRight' || e.key === 'j') answerCard(true);
      if (e.key === 'ArrowLeft' || e.key === 'k') answerCard(false);
      if (e.key === 'Escape') closeFlashcard();
    });
  }

  // ---- Start ----
  document.addEventListener('DOMContentLoaded', init);
})();
