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
    API_KEY: 'pet_gemini_key',
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

    // Restore API key
    const savedKey = localStorage.getItem(STORAGE.API_KEY) || '';
    $('apiKeyInput').value = savedKey;

    buildUnitSelect();
    bindEvents();
    switchMode('learn');
    selectUnit(1);
    updateBadges();
  }

  // ---- DeepSeek API ----
  function getApiKey() {
    return $('apiKeyInput').value.trim();
  }

  async function callLLM(prompt) {
    const key = getApiKey();
    if (!key) {
      throw new Error('请先在左侧设置中输入 DeepSeek API Key');
    }

    const resp = await fetch('https://api.deepseek.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${key}`,
      },
      body: JSON.stringify({
        model: 'deepseek-chat',
        messages: [{ role: 'user', content: prompt }],
        temperature: 0.7,
        max_tokens: 1024,
      }),
    });

    if (!resp.ok) {
      const err = await resp.json().catch(() => ({}));
      throw new Error(err.error?.message || `API 错误 (${resp.status})`);
    }

    const data = await resp.json();
    return data.choices?.[0]?.message?.content || '无返回内容';
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
    updateEssayTopic();
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
        .map((kw) => `<span class="keyword-tag" data-word="${esc(kw)}">${esc(kw)}</span>`)
        .join('');
      html += buildSection(
        `🏷️ 关键词 (${session.keyWords.length}) <span style="font-weight:normal;font-size:12px;color:var(--text-secondary)">单击=复习 | 双击=AI解释</span>`,
        `<div class="keyword-list">${tags}</div>`,
        null,
        true
      );
    }

    area.innerHTML = html;

    // Bind section collapse
    area.querySelectorAll('.content-section-header').forEach((h) => {
      h.addEventListener('click', () => {
        h.classList.toggle('collapsed');
        h.nextElementSibling.classList.toggle('collapsed');
      });
    });

    // Bind keyword: single click = add to review, double click = AI explain
    area.querySelectorAll('.keyword-tag').forEach((tag) => {
      let clickTimer = null;
      tag.addEventListener('click', () => {
        if (clickTimer) return; // wait for dblclick check
        clickTimer = setTimeout(() => {
          clickTimer = null;
          addToReview(tag.dataset.word, currentUnit, currentSession);
          tag.style.background = '#16a34a';
          tag.style.color = '#fff';
          setTimeout(() => { tag.style.background = ''; tag.style.color = ''; }, 600);
        }, 250);
      });
      tag.addEventListener('dblclick', () => {
        clearTimeout(clickTimer);
        clickTimer = null;
        explainWord(tag.dataset.word);
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
    $('panelEssay').classList.toggle('hidden', mode !== 'essay');

    if (mode === 'errors') renderErrors();
    if (mode === 'essay') updateEssayTopic();
  }

  // ---- Word explanation (AI) ----
  async function explainWord(word) {
    const popup = $('wordPopup');
    const body = $('wordPopupBody');
    $('wordPopupTitle').textContent = word;
    body.innerHTML = '<div class="loading-dots">AI 解释中</div>';
    popup.classList.remove('hidden');

    try {
      const unit = units[currentUnit];
      const prompt = `You are an English teacher helping a Chinese intermediate learner.
Explain the word/phrase "${word}" in the context of BBC Learning English, topic "${unit.title}".

Reply in this format (mix English and Chinese):
1. **Meaning**: English definition + 中文释义
2. **Example**: 2 example sentences
3. **Note**: Any common mistakes or usage tips

Keep it concise (under 150 words).`;

      const result = await callLLM(prompt);
      body.innerHTML = formatMarkdown(result);
    } catch (e) {
      body.innerHTML = `<p style="color:var(--danger)">${esc(e.message)}</p>`;
    }
  }

  // ---- Essay writing (AI) ----
  function updateEssayTopic() {
    const unit = units[currentUnit];
    if (!unit) return;

    // Gather keywords from all sessions for topic inspiration
    const allKeywords = unit.sessions.flatMap((s) => (s.keyWords || []).slice(0, 5));
    const sampleWords = allKeywords.slice(0, 10).join(', ');

    $('essayTopic').innerHTML = `
      <strong>写作话题：${unit.title}</strong><br>
      请用英文写一篇短文（100-200词），可以参考以下关键词：<br>
      <em>${sampleWords}</em>
    `;

    $('essayInput').value = '';
    $('essayFeedback').classList.add('hidden');
    $('btnSubmitEssay').disabled = false;
  }

  async function submitEssay() {
    const text = $('essayInput').value.trim();
    if (!text) return;
    if (text.split(/\s+/).length < 20) {
      alert('请至少写20个单词');
      return;
    }

    const btn = $('btnSubmitEssay');
    btn.disabled = true;
    btn.textContent = '批改中...';

    const feedback = $('essayFeedback');
    feedback.classList.remove('hidden');
    feedback.innerHTML = '<div class="loading-dots">AI 批改中</div>';

    try {
      const unit = units[currentUnit];
      const prompt = `You are an English teacher grading an intermediate student's essay.
Topic: "${unit.title}" (BBC Learning English Intermediate Course)

Student's essay:
"""
${text}
"""

Please provide feedback in this format (use Chinese for explanations, English for examples):

**Score: X/10**

**语法错误 (Grammar)**:
- List specific errors with corrections

**词汇建议 (Vocabulary)**:
- Suggest better word choices

**内容与结构 (Content & Structure)**:
- Comment on organization and ideas

**改进版本 (Improved version)**:
- Rewrite 1-2 key sentences showing improvement

Keep feedback actionable and encouraging. Under 300 words.`;

      const result = await callLLM(prompt);
      feedback.innerHTML = formatMarkdown(result);
    } catch (e) {
      feedback.innerHTML = `<p style="color:var(--danger)">${esc(e.message)}</p>`;
    }

    btn.textContent = '重新批改';
    btn.disabled = false;
  }

  // ---- Simple markdown → HTML ----
  function formatMarkdown(text) {
    return text
      .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
      .replace(/\*(.*?)\*/g, '<em>$1</em>')
      .replace(/`(.*?)`/g, '<code>$1</code>')
      .replace(/^- (.*)/gm, '<li>$1</li>')
      .replace(/(<li>.*<\/li>\n?)+/g, '<ul>$&</ul>')
      .replace(/\n\n/g, '</p><p>')
      .replace(/\n/g, '<br>')
      .replace(/^/, '<p>')
      .replace(/$/, '</p>');
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

    // API key save
    $('apiKeyInput').addEventListener('change', (e) => {
      localStorage.setItem(STORAGE.API_KEY, e.target.value.trim());
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

    // Essay
    $('btnSubmitEssay').addEventListener('click', submitEssay);
    $('essayInput').addEventListener('input', () => {
      $('btnSubmitEssay').disabled = $('essayInput').value.trim().length < 10;
    });

    // Word popup close
    $('wordPopupClose').addEventListener('click', () => {
      $('wordPopup').classList.add('hidden');
    });

    // Keyboard shortcuts
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') {
        $('wordPopup').classList.add('hidden');
        if (!$('flashcardModal').classList.contains('hidden')) closeFlashcard();
      }
      if ($('flashcardModal').classList.contains('hidden')) return;
      if (e.key === ' ' || e.key === 'Enter') { e.preventDefault(); flipCard(); }
      if (e.key === 'ArrowRight' || e.key === 'j') answerCard(true);
      if (e.key === 'ArrowLeft' || e.key === 'k') answerCard(false);
    });
  }

  // ---- Start ----
  document.addEventListener('DOMContentLoaded', init);
})();
