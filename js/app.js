/* ============================================
   PET English Study Tool
   Features: PET exercises, word network, essay grading, error tracking
   ============================================ */
(function () {
  'use strict';

  // ---- State ----
  let units = {};
  let currentUnit = '1';
  let currentSession = null;
  let currentMode = 'learn';
  let flashcards = [];
  let flashcardIdx = 0;
  let flashcardFlipped = false;
  let exerciseState = { answered: 0, correct: 0 };
  let reviewExerciseState = { answered: 0, correct: 0 };
  let selectedEssayTopic = '';

  const STORAGE = {
    ERRORS: 'pet_errors',
    REVIEW: 'pet_review_due',
    API_KEY: 'pet_deepseek_key',
    LLM_CACHE: 'pet_llm_cache',
  };

  // ---- DOM refs ----
  const $ = (s) => document.getElementById(s);
  const $$ = (s) => document.querySelectorAll(s);

  // ---- LLM Cache (7-day expiry) ----
  function getCachedLLM(key, type) {
    try {
      const cache = JSON.parse(localStorage.getItem(STORAGE.LLM_CACHE) || '{}');
      const entry = cache[`${key}::${type}`];
      if (entry && Date.now() - entry.ts < 7 * 24 * 3600 * 1000) return entry.data;
    } catch (e) { /* ignore */ }
    return null;
  }

  function setCachedLLM(key, type, data) {
    try {
      const cache = JSON.parse(localStorage.getItem(STORAGE.LLM_CACHE) || '{}');
      cache[`${key}::${type}`] = { data, ts: Date.now() };
      localStorage.setItem(STORAGE.LLM_CACHE, JSON.stringify(cache));
    } catch (e) { /* ignore */ }
  }

  // ---- Pronunciation (Web Speech API) ----
  function speakText(text) {
    if (!window.speechSynthesis) return;
    speechSynthesis.cancel();
    const utt = new SpeechSynthesisUtterance(text);
    utt.lang = 'en-US';
    utt.rate = 0.9;
    speechSynthesis.speak(utt);
  }

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

    const DEFAULT_KEY = 'sk-8105a3dbce7947ee89d53b819777cabe';
    const savedKey = localStorage.getItem(STORAGE.API_KEY) || DEFAULT_KEY;
    $('apiKeyInput').value = savedKey;
    localStorage.setItem(STORAGE.API_KEY, savedKey);

    buildUnitSelect();
    bindEvents();
    switchMode('learn');
    selectUnit(1);
    updateBadges();
  }

  // ---- DeepSeek API (with system + user message support) ----
  function getApiKey() {
    return $('apiKeyInput').value.trim();
  }

  async function callLLM(systemMsg, userMsg) {
    const key = getApiKey();
    if (!key) throw new Error('请先在左侧设置中输入 DeepSeek API Key');

    const messages = [];
    if (systemMsg) messages.push({ role: 'system', content: systemMsg });
    messages.push({ role: 'user', content: userMsg });

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 60000);

    try {
      const resp = await fetch('https://api.deepseek.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${key}`,
        },
        signal: controller.signal,
        body: JSON.stringify({
          model: 'deepseek-chat',
          messages,
          temperature: 0.7,
          max_tokens: 2048,
        }),
      });

      clearTimeout(timeoutId);

      if (!resp.ok) {
        const err = await resp.json().catch(() => ({}));
        throw new Error(err.error?.message || `API 错误 (${resp.status})`);
      }

      const data = await resp.json();
      return data.choices?.[0]?.message?.content || '无返回内容';
    } catch (e) {
      clearTimeout(timeoutId);
      if (e.name === 'AbortError') throw new Error('API 请求超时 (60秒)，请重试');
      throw e;
    }
  }

  // ---- HTML to plain text ----
  function htmlToText(html) {
    if (!html) return '';
    const div = document.createElement('div');
    div.innerHTML = html;
    return div.textContent || div.innerText || '';
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
    $('actionBar').classList.add('hidden');
    $('exerciseArea').classList.add('hidden');
    $('aiFlashcardArea').classList.add('hidden');
    $('lectureArea').classList.add('hidden');
    updateEssayTopics();
  }

  // ---- Session tabs ----
  function renderSessionTabs() {
    const unit = units[currentUnit];
    const tabs = $('sessionTabs');
    tabs.innerHTML = '';

    unit.sessions.forEach((s) => {
      const btn = document.createElement('button');
      btn.className = 'session-tab';
      btn.innerHTML = `<span class="tab-title">S${s.id}: ${s.title}</span><span class="tab-type">${s.typeLabel}</span>`;
      btn.onclick = () => selectSession(s.id);
      tabs.appendChild(btn);
    });
  }

  function selectSession(id) {
    currentSession = id;
    $$('.session-tab').forEach((t, i) => {
      t.classList.toggle('active', i === id - 1);
    });
    $('exerciseArea').classList.add('hidden');
    $('aiFlashcardArea').classList.add('hidden');
    $('lectureArea').classList.add('hidden');
    renderContent();
    $('actionBar').classList.remove('hidden');
  }

  function getSession() {
    const unit = units[currentUnit];
    return unit ? unit.sessions.find((s) => s.id === currentSession) : null;
  }

  // ---- Content rendering ----
  function renderContent() {
    const session = getSession();
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

    // Transcript (collapsed by default)
    if (session.transcript) {
      html += buildSection('📝 Transcript', session.transcript, 'transcript', true);
    }

    area.innerHTML = html;

    // Bind section collapse
    area.querySelectorAll('.content-section-header').forEach((h) => {
      h.addEventListener('click', () => {
        h.classList.toggle('collapsed');
        h.nextElementSibling.classList.toggle('collapsed');
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
    if (mode === 'essay') updateEssayTopics();
  }

  // ================================================================
  //  PET EXERCISES — Type-specific prompts per spec
  // ================================================================
  const EXERCISE_PROMPTS = {
    vocabulary: {
      system: `你是PET考试出题专家。请按PET Reading Part 5（Multiple-choice cloze）风格出题。

Part 5题型：给出一段3-5句的短文，其中有一个空格，从4个拼写或意思相近的词中选最合适的。考查词汇在语境中的搭配和用法。

示例（好的题目）：
题目：The report was written by a group of ______ researchers who spent three years on the project.
A. hard-working  B. hard working  C. hardly-working  D. hardly working
答案：A
解析：adjective+现在分词构成的复合形容词在名词前要用连字符。hardly是"几乎不"，语义不对。B缺少连字符，在名词前不规范。

绝对禁止：❌直接问词义 ❌词汇配对 ❌没有语境的孤立题目
必须：✅完整语境 ✅考查理解运用 ✅合理迷惑选项 ✅选项长度相近 ✅中文解析

返回纯JSON数组，不要markdown代码块。5道题。
格式:[{"question":"含语境和空格____的完整题目","options":["A. ...","B. ...","C. ...","D. ..."],"answer":"A","explanation":"中文解析"}]`,
      user: (title, text) => `根据以下词汇规则出5道PET Part 5风格选词填空题：\n主题：${title}\n${text}`,
    },
    grammar: {
      system: `你是PET考试出题专家。请出语法情境选择题。

每道题给一个完整的情境句或2-3句小语境，空格处需要填入正确的语法形式。选项是同一动词的不同时态形式。

示例：
题目：Look at those dark clouds! I think it ______ soon.
A. rains  B. is going to rain  C. has rained  D. rained
答案：B
解析：根据"dark clouds"这个现在能看到的证据，用be going to表示预测。

绝对禁止：❌直接问词义 ❌词汇配对 ❌没有语境
必须：✅完整语境 ✅考查理解运用 ✅合理迷惑选项 ✅中文解析

返回纯JSON数组，不要markdown代码块。5道题。
格式:[{"question":"含____的完整情境题目","options":["A. ...","B. ...","C. ...","D. ..."],"answer":"A","explanation":"中文解析"}]`,
      user: (title, text) => `根据以下语法规则出5道PET风格语法选择题：\n${text}`,
    },
    reading: {
      system: `你是PET考试出题专家。请按PET Reading Part 3风格出题。

Part 3题型：基于文章出5道理解题，4选项。考查细节理解、推断、作者观点、信息综合、主旨。

出题规则：
- 第1题关于文章开头或背景
- 中间3题考具体细节（换个说法，不是原文照搬）
- 最后1题关于整体主旨
- 干扰选项：包含文中的词但曲解意思；部分正确但不完整；看似合理但未提及

绝对禁止：❌直接问词义 ❌词汇配对 ❌没有语境
必须：✅完整语境 ✅考查理解运用 ✅合理迷惑选项 ✅中文解析

返回纯JSON数组，不要markdown代码块。5道题。
格式:[{"question":"题目","options":["A. ...","B. ...","C. ...","D. ..."],"answer":"A","explanation":"中文解析"}]`,
      user: (title, text) => `根据以下文章内容出5道PET Reading Part 3风格阅读理解题：\n文章主题：${title}\n文章词汇：${text}`,
    },
    listening: {
      system: `你是PET考试出题专家。请出实用英语情境选择题。

每道题描述一个具体的生活场景，让学生选择最恰当的表达。4个选项都是合理的英语句子，但只有1个最适合当前情境。

示例：
题目：You are at a market and you think the price of a jacket is too high. You want the seller to lower the price. What would you say?
A. "I'll take it for that price, thanks."
B. "Could you knock a bit off? That's quite expensive."
C. "I haven't got any money on me right now."
D. "That's a real bargain, I'll buy two!"
答案：B
解析：B用了砍价常用表达"knock off"，语气礼貌。A是接受价格，C说没钱不是砍价，D说便宜要买两个跟题意矛盾。

绝对禁止：❌直接问词义 ❌词汇配对 ❌没有语境
必须：✅完整语境 ✅考查理解运用 ✅合理迷惑选项 ✅中文解析

返回纯JSON数组，不要markdown代码块。5道题。
格式:[{"question":"完整情境描述","options":["A. ...","B. ...","C. ...","D. ..."],"answer":"A","explanation":"中文解析"}]`,
      user: (title, text) => `根据以下实用英语表达出5道PET风格情境选择题：\n主题：${title}\n表达和词汇：${text}`,
    },
  };

  function parseJsonResponse(result) {
    try {
      const cleaned = result.replace(/```json?\s*/g, '').replace(/```\s*/g, '').trim();
      return JSON.parse(cleaned);
    } catch {
      const match = result.match(/[\[{][\s\S]*[\]}]/);
      if (match) return JSON.parse(match[0]);
      throw new Error('无法解析AI返回数据');
    }
  }

  async function generateExercises() {
    const session = getSession();
    if (!session) return;

    const btn = $('btnExercises');
    btn.disabled = true;
    btn.textContent = '生成中...';

    const area = $('exerciseArea');
    area.classList.remove('hidden');
    $('exerciseList').innerHTML = '<div class="loading-dots">AI 正在生成PET练习题</div>';
    $('exerciseScore').textContent = '';
    exerciseState = { answered: 0, correct: 0 };

    try {
      const cacheKey = `u${currentUnit}_s${currentSession}`;

      // Check cache first
      const cached = getCachedLLM(cacheKey, 'exercises');
      if (cached) {
        renderExercises(cached, 'exerciseList', 'exerciseScore', exerciseState);
        btn.disabled = false;
        btn.textContent = '🎯 PET练习题';
        return;
      }

      const type = session.type || 'vocabulary';
      const promptConfig = EXERCISE_PROMPTS[type] || EXERCISE_PROMPTS.vocabulary;

      const contentText = htmlToText(session.content || '').slice(0, 1500);
      const transcriptText = htmlToText(session.transcript || '').slice(0, 1500);
      const keywordsText = (session.keyWords || []).slice(0, 20).join(', ');
      const vocabText = contentText || transcriptText || keywordsText;

      const result = await callLLM(
        promptConfig.system,
        promptConfig.user(session.title, vocabText)
      );

      const exercises = parseJsonResponse(result);
      setCachedLLM(cacheKey, 'exercises', exercises);
      renderExercises(exercises, 'exerciseList', 'exerciseScore', exerciseState);
    } catch (e) {
      $('exerciseList').innerHTML = `<p style="color:var(--danger)">${esc(e.message)}</p>`;
    }

    btn.disabled = false;
    btn.textContent = '🎯 PET练习题';
  }

  function renderExercises(exercises, listId, scoreId, state) {
    const list = $(listId);
    list.innerHTML = '';

    exercises.forEach((q, idx) => {
      const div = document.createElement('div');
      div.className = 'exercise-item';
      div.innerHTML = `
        <div class="exercise-question">${idx + 1}. ${esc(q.question)}</div>
        <div class="exercise-options">
          ${q.options.map((opt, oi) => `<button class="exercise-option" data-q="${idx}" data-o="${oi}">${esc(opt)}</button>`).join('')}
        </div>
        <div class="exercise-explanation" id="expl_${listId}_${idx}">${esc(q.explanation || '')}</div>
      `;
      list.appendChild(div);

      // Bind option clicks
      div.querySelectorAll('.exercise-option').forEach((btn) => {
        btn.addEventListener('click', () => {
          checkExerciseAnswer(q, btn, div, idx, listId, scoreId, state);
        });
      });
    });
  }

  function checkExerciseAnswer(q, btn, container, idx, listId, scoreId, state) {
    // Prevent re-answering
    if (container.querySelector('.exercise-option.correct') || container.querySelector('.exercise-option.wrong')) return;

    const selected = btn.textContent.trim();
    const correctLetter = q.answer.trim().charAt(0); // "A", "B", "C", "D"
    const options = container.querySelectorAll('.exercise-option');

    // Find correct option
    options.forEach((opt) => {
      opt.classList.add('disabled');
      const optLetter = opt.textContent.trim().charAt(0);
      if (optLetter === correctLetter) {
        opt.classList.add('correct');
      }
    });

    const selectedLetter = selected.charAt(0);
    const isCorrect = selectedLetter === correctLetter;

    if (!isCorrect) {
      btn.classList.add('wrong');
      // Record error
      recordExerciseError(q);
    }

    state.answered++;
    if (isCorrect) state.correct++;

    // Show explanation
    const expl = $(`expl_${listId}_${idx}`);
    if (expl) expl.classList.add('show');

    // Update score
    $(scoreId).textContent = `${state.correct}/${state.answered} 正确`;
  }

  // ================================================================
  //  WORD NETWORK — SVG visualization
  // ================================================================
  async function generateWordNetwork(word, svgId, exId) {
    if (!word || !word.trim()) return;
    word = word.trim();
    svgId = svgId || 'aiFcWordnetSvg';
    exId = exId || 'aiFcWordnetExample';

    $(svgId).innerHTML = '<div class="loading-dots" style="padding:20px;text-align:center">词汇网络加载中</div>';
    $(exId).classList.add('hidden');

    try {
      const cached = getCachedLLM(word.toLowerCase(), 'wordnet');
      if (cached) {
        renderWordNetworkSVG(cached, svgId, exId);
        return;
      }

      const systemMsg = `你是英语词汇专家。为给定的英语单词生成词汇联想网络。返回纯JSON，不要markdown代码块。格式：
{
  "center": "查询的单词",
  "cn": "中文释义",
  "synonyms": [{"word":"同义词1","cn":"中文"},{"word":"同义词2","cn":"中文"}],
  "antonyms": [{"word":"反义词1","cn":"中文"}],
  "family": [{"word":"词族词1","cn":"中文","relation":"名词形式"},{"word":"词族词2","cn":"中文","relation":"形容词形式"}],
  "collocations": [{"phrase":"常用搭配1","cn":"中文"},{"phrase":"常用搭配2","cn":"中文"}],
  "example": "一个包含该词的例句",
  "example_cn": "例句中文翻译"
}
每个分类最多给4个词/短语。适合PET/FCE(B1-B2)水平理解。`;

      const result = await callLLM(systemMsg, `请为单词 "${word}" 生成词汇联想网络。`);
      const data = parseJsonResponse(result);
      setCachedLLM(word.toLowerCase(), 'wordnet', data);
      renderWordNetworkSVG(data, svgId, exId);
    } catch (e) {
      $(svgId).innerHTML = `<p style="color:var(--danger);padding:20px">${esc(e.message)}</p>`;
    }
  }

  function renderWordNetworkSVG(data, svgId, exId) {
    svgId = svgId || 'aiFcWordnetSvg';
    exId = exId || 'aiFcWordnetExample';
    const W = 700, H = 360;
    const cx = 350, cy = 180;
    const colors = {
      center: '#2f6b4f',
      synonyms: '#2563eb',
      antonyms: '#dc2626',
      family: '#ea580c',
      collocations: '#7c3aed',
    };

    let svg = `<svg viewBox="0 0 ${W} ${H}" xmlns="http://www.w3.org/2000/svg" style="font-family:-apple-system,sans-serif">`;

    // Helper: draw a node (rounded rect with text)
    function drawNode(x, y, word, cn, color, isCenter) {
      const fontSize = isCenter ? 14 : 12;
      const cnSize = isCenter ? 11 : 10;
      const pw = isCenter ? 20 : 12;
      const ph = isCenter ? 14 : 10;
      const textLen = Math.max(word.length * (fontSize * 0.6), (cn || '').length * cnSize) + pw * 2;
      const rw = Math.min(Math.max(textLen, 60), 160);
      const rh = cn ? (fontSize + cnSize + ph * 2 + 4) : (fontSize + ph * 2);
      const rx = x - rw / 2;
      const ry = y - rh / 2;

      svg += `<rect x="${rx}" y="${ry}" width="${rw}" height="${rh}" rx="8" fill="${color}" opacity="${isCenter ? 1 : 0.9}"/>`;
      svg += `<text x="${x}" y="${y - (cn ? 4 : 0)}" text-anchor="middle" dominant-baseline="middle" fill="white" font-size="${fontSize}" font-weight="${isCenter ? 700 : 500}">${escSvg(word)}</text>`;
      if (cn) {
        svg += `<text x="${x}" y="${y + fontSize - 2}" text-anchor="middle" dominant-baseline="middle" fill="white" font-size="${cnSize}" opacity="0.85">${escSvg(cn)}</text>`;
      }
      return { x, y, rw, rh };
    }

    // Helper: draw connecting line
    function drawLine(x1, y1, x2, y2, color) {
      svg += `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="${color}" stroke-width="1.5" opacity="0.4"/>`;
    }

    function escSvg(s) {
      return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
    }

    // Layout groups
    const groups = [
      { key: 'synonyms', items: data.synonyms || [], label: '同义词', dir: 'up', color: colors.synonyms },
      { key: 'antonyms', items: data.antonyms || [], label: '反义词', dir: 'down', color: colors.antonyms },
      { key: 'family', items: data.family || [], label: '词族', dir: 'left', color: colors.family },
      { key: 'collocations', items: data.collocations || [], label: '搭配', dir: 'right', color: colors.collocations },
    ];

    // Draw group labels
    svg += `<text x="${cx}" y="16" text-anchor="middle" fill="${colors.synonyms}" font-size="11" font-weight="600">同义词 Synonyms</text>`;
    svg += `<text x="${cx}" y="${H - 6}" text-anchor="middle" fill="${colors.antonyms}" font-size="11" font-weight="600">反义词 Antonyms</text>`;
    svg += `<text x="60" y="${cy - 70}" text-anchor="middle" fill="${colors.family}" font-size="11" font-weight="600">词族 Family</text>`;
    svg += `<text x="${W - 60}" y="${cy - 70}" text-anchor="middle" fill="${colors.collocations}" font-size="11" font-weight="600">搭配 Collocations</text>`;

    // Draw lines first (below nodes)
    groups.forEach((g) => {
      const n = g.items.length;
      if (n === 0) return;
      g.items.forEach((item, i) => {
        const pos = getNodePos(g.dir, i, n, cx, cy, W, H);
        drawLine(cx, cy, pos.x, pos.y, g.color);
      });
    });

    // Draw center node
    drawNode(cx, cy, data.center || '?', data.cn || '', colors.center, true);

    // Draw group nodes
    groups.forEach((g) => {
      g.items.forEach((item, i) => {
        const pos = getNodePos(g.dir, i, g.items.length, cx, cy, W, H);
        const word = item.word || item.phrase || '';
        const cn = item.cn || '';
        drawNode(pos.x, pos.y, word, cn, g.color, false);
      });
    });

    svg += '</svg>';
    $(svgId).innerHTML = svg;

    // Show example
    if (data.example) {
      const exEl = $(exId);
      exEl.innerHTML = `<strong>例句:</strong> ${esc(data.example)}<br><span style="color:var(--text-secondary)">${esc(data.example_cn || '')}</span>`;
      exEl.classList.remove('hidden');
    }
  }

  function getNodePos(dir, idx, total, cx, cy, W, H) {
    const spread = (i, n, range, center) => center + (n === 1 ? 0 : (i / (n - 1) - 0.5) * range);

    switch (dir) {
      case 'up':
        return { x: spread(idx, total, 400, cx), y: 50 };
      case 'down':
        return { x: spread(idx, total, 400, cx), y: H - 40 };
      case 'left':
        return { x: 80, y: spread(idx, total, 160, cy + 10) };
      case 'right':
        return { x: W - 80, y: spread(idx, total, 160, cy + 10) };
      default:
        return { x: cx, y: cy };
    }
  }

  // ================================================================
  //  AI LECTURE
  // ================================================================
  async function generateLecture() {
    const session = getSession();
    if (!session) return;

    const btn = $('btnLecture');
    btn.disabled = true;
    btn.textContent = '生成中...';

    const area = $('lectureArea');
    area.classList.remove('hidden');
    $('lectureContent').innerHTML = '<div class="loading-dots">AI 正在生成讲解</div>';

    try {
      const cacheKey = `u${currentUnit}_s${currentSession}`;

      const cached = getCachedLLM(cacheKey, 'lecture');
      if (cached) {
        $('lectureContent').innerHTML = formatMarkdown(cached);
        btn.disabled = false;
        btn.textContent = '📚 AI讲解';
        return;
      }

      const contentText = htmlToText(session.content || '').slice(0, 2000);
      const transcriptText = htmlToText(session.transcript || '').slice(0, 1000);
      const text = contentText || transcriptText;

      const systemMsg = `你是一位有经验的英语老师，正在给中国初中生讲解BBC Learning English的课程内容。请用中文讲解，穿插英文例句。讲解要生动有趣，重点突出，适合B1水平。`;
      const userMsg = `请为以下课程内容做一个10分钟的讲解：\n\n主题：${session.title}\n类型：${session.typeLabel}\n\n内容摘要：\n${text}`;

      const result = await callLLM(systemMsg, userMsg);
      setCachedLLM(cacheKey, 'lecture', result);
      $('lectureContent').innerHTML = formatMarkdown(result);
    } catch (e) {
      $('lectureContent').innerHTML = `<p style="color:var(--danger)">${esc(e.message)}</p>`;
    }

    btn.disabled = false;
    btn.textContent = '📚 AI讲解';
  }

  // ================================================================
  //  WORD EXPLANATION (popup)
  // ================================================================
  async function explainWord(word) {
    const popup = $('wordPopup');
    const body = $('wordPopupBody');
    $('wordPopupTitle').innerHTML = `${esc(word)} <button class="fc-speak-btn" id="popupSpeakBtn" style="margin-left:8px;vertical-align:middle">🔊</button>`;
    body.innerHTML = '<div class="loading-dots">AI 解释中</div>';
    popup.classList.remove('hidden');

    // Bind speak button
    setTimeout(() => {
      const btn = $('popupSpeakBtn');
      if (btn) btn.addEventListener('click', () => speakText(word));
    }, 0);

    try {
      // Check cache
      const cached = getCachedLLM(word.toLowerCase(), 'explain');
      if (cached) {
        body.innerHTML = formatMarkdown(cached);
        return;
      }

      const unit = units[currentUnit];
      const systemMsg = '你是英语词汇教学专家，正在给中国初中生解释单词。请用中英混合的方式解释，简洁明了。';
      const userMsg = `请解释单词/短语 "${word}"（来自BBC Learning English课程 "${unit.title}"）：
1. **释义**: 英文定义 + 中文意思
2. **例句**: 2个例句
3. **注意**: 常见错误或用法提示
控制在150词以内。`;

      const result = await callLLM(systemMsg, userMsg);
      setCachedLLM(word.toLowerCase(), 'explain', result);
      body.innerHTML = formatMarkdown(result);
    } catch (e) {
      body.innerHTML = `<p style="color:var(--danger)">${esc(e.message)}</p>`;
    }
  }

  // ================================================================
  //  AI FLASHCARDS — Generated with Chinese definitions
  // ================================================================
  async function generateAIFlashcards() {
    const session = getSession();
    if (!session) return;

    const btn = $('btnFlashcards');
    btn.disabled = true;
    btn.textContent = '生成中...';

    const area = $('aiFlashcardArea');
    area.classList.remove('hidden');
    $('aiFcCard').innerHTML = '<div class="loading-dots">AI 正在从课程内容提取PET/FCE词汇并生成闪卡</div>';
    $('aiFcWordnetSvg').innerHTML = '';
    $('aiFcWordnetExample').classList.add('hidden');

    try {
      const cacheKey = `u${currentUnit}_s${currentSession}`;

      // Check cache
      const cached = getCachedLLM(cacheKey, 'flashcards_v2');
      if (cached) {
        initInlineFlashcards(cached);
        btn.disabled = false;
        btn.textContent = '🃏 AI闪卡';
        return;
      }

      // Extract content for LLM
      const contentText = htmlToText(session.content || '').slice(0, 2000);
      const transcriptText = htmlToText(session.transcript || '').slice(0, 1500);
      const text = contentText || transcriptText;

      const systemMsg = `你是英语教学专家，专注PET/FCE考试词汇。分析以下BBC Learning English课程内容，提取10-15个PET/FCE考试级别(B1-B2)的重要词汇或短语。

要求：
- 难度不低于PET(B1)水平，优先FCE(B2)级别
- 排除基础词汇（数字、简单日常词如twenty-two, Monday, hello等）
- 优先选择：多义词、高频搭配、学术词汇、常见考点
- 每个词给出中文释义和实用例句

返回纯JSON数组，不要markdown代码块。格式：
[{"word":"词汇","cn":"中文释义","example_en":"English example","example_cn":"例句翻译"}]`;

      const userMsg = `课程主题：${session.title}\n类型：${session.typeLabel}\n\n课程内容：\n${text}`;
      const result = await callLLM(systemMsg, userMsg);
      const cards = parseJsonResponse(result);

      setCachedLLM(cacheKey, 'flashcards_v2', cards);
      initInlineFlashcards(cards);
    } catch (e) {
      $('aiFcCard').innerHTML = `<p style="color:var(--danger)">${esc(e.message)}</p>`;
    }

    btn.disabled = false;
    btn.textContent = '🃏 AI闪卡';
  }

  function initInlineFlashcards(cards) {
    if (!cards || cards.length === 0) return;

    flashcards = cards.map((c) => ({
      word: c.word,
      cn: c.cn,
      example_en: c.example_en,
      example_cn: c.example_cn,
    }));
    flashcardIdx = 0;
    flashcardFlipped = false;
    showInlineFlashcard();
  }

  function showInlineFlashcard() {
    if (flashcardIdx < 0) flashcardIdx = 0;
    if (flashcardIdx >= flashcards.length) flashcardIdx = flashcards.length - 1;

    const card = flashcards[flashcardIdx];
    $('aiFcCount').textContent = `${flashcardIdx + 1} / ${flashcards.length}`;
    flashcardFlipped = false;

    // Front: word + speak button
    $('aiFcCard').innerHTML = `
      <div class="ai-fc-front">
        <div class="fc-word">${esc(card.word)}</div>
        <button class="fc-speak-btn" id="inlineSpeakBtn">🔊</button>
      </div>
    `;

    setTimeout(() => {
      const btn = $('inlineSpeakBtn');
      if (btn) btn.addEventListener('click', () => speakText(card.word));
    }, 0);

    // Auto-load word network for this word
    generateWordNetwork(card.word, 'aiFcWordnetSvg', 'aiFcWordnetExample');
  }

  function flipInlineCard() {
    if (!flashcards.length) return;
    const card = flashcards[flashcardIdx];
    flashcardFlipped = !flashcardFlipped;

    if (flashcardFlipped) {
      $('aiFcCard').innerHTML = `
        <div class="ai-fc-back">
          <div class="fc-cn">${esc(card.cn || '')}</div>
          <div class="fc-example">${esc(card.example_en || '')}</div>
          <div class="fc-example-cn">${esc(card.example_cn || '')}</div>
        </div>
      `;
    } else {
      $('aiFcCard').innerHTML = `
        <div class="ai-fc-front">
          <div class="fc-word">${esc(card.word)}</div>
          <button class="fc-speak-btn" id="inlineSpeakBtn">🔊</button>
        </div>
      `;
      setTimeout(() => {
        const btn = $('inlineSpeakBtn');
        if (btn) btn.addEventListener('click', () => speakText(card.word));
      }, 0);
    }
  }

  // ================================================================
  //  ESSAY WRITING — PET Writing rubric
  // ================================================================
  function updateEssayTopics() {
    const unit = units[currentUnit];
    if (!unit) return;

    const title = unit.title.replace(/^Unit \d+:\s*/, '');
    const topics = [
      `Write an email to your friend about ${title.toLowerCase()} you experienced recently.`,
      `Write a short article about ${title.toLowerCase()} in your country for a school magazine.`,
      `Write a message to a friend suggesting you learn about ${title.toLowerCase()} together.`,
    ];

    const el = $('essayTopics');
    el.innerHTML = topics.map((t) =>
      `<button class="essay-topic-btn" data-topic="${esc(t)}">${esc(t)}</button>`
    ).join('') + '<button class="essay-topic-btn" data-topic="free">自由写作（Free topic）</button>';

    el.querySelectorAll('.essay-topic-btn').forEach((btn) => {
      btn.addEventListener('click', () => {
        el.querySelectorAll('.essay-topic-btn').forEach((b) => b.classList.remove('active'));
        btn.classList.add('active');
        selectedEssayTopic = btn.dataset.topic === 'free' ? 'Free topic' : btn.dataset.topic;
        $('essaySelectedTopic').textContent = selectedEssayTopic;
        $('essaySelectedTopic').classList.remove('hidden');
      });
    });

    selectedEssayTopic = '';
    $('essaySelectedTopic').classList.add('hidden');
    $('essayInput').value = '';
    $('essayFeedback').classList.add('hidden');
    $('btnSubmitEssay').disabled = true;
    $('wordCount').textContent = '0 词';
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
      const systemMsg = `你是剑桥PET考试的写作评分专家。请用中文批改以下学生作文。

请按以下格式输出：

## 总分：X / 20

## 四项评分
- Content（内容）：X/5 — 简评
- Communicative Achievement（交际达成）：X/5 — 简评
- Organisation（组织结构）：X/5 — 简评
- Language（语言）：X/5 — 简评

## 语法和拼写错误
逐个列出错误，标明原文 → 修正，并简要解释原因。

## 亮点
指出写得好的地方，鼓励孩子。

## 修改范文
给出一篇修改后的范文，保留学生的原始思路但改进语言和结构。用**加粗**标出主要修改处。`;

      const topic = selectedEssayTopic || 'Free topic';
      const userMsg = `写作主题：${topic}\n学生作文：\n${text}`;

      const result = await callLLM(systemMsg, userMsg);
      feedback.innerHTML = formatMarkdown(result);
    } catch (e) {
      feedback.innerHTML = `<p style="color:var(--danger)">${esc(e.message)}</p>`;
    }

    btn.textContent = '🤖 重新批改';
    btn.disabled = false;
  }

  // ================================================================
  //  ERROR TRACKING — Exercise-based
  // ================================================================
  function getErrors() {
    return JSON.parse(localStorage.getItem(STORAGE.ERRORS) || '[]');
  }
  function saveErrors(list) {
    localStorage.setItem(STORAGE.ERRORS, JSON.stringify(list));
    updateBadges();
  }

  function recordExerciseError(q) {
    const list = getErrors();
    const session = getSession();
    list.push({
      id: 'err_' + Date.now(),
      question: q.question,
      options: q.options,
      userAnswer: q.userAnswer || '',
      correctAnswer: q.answer,
      explanation: q.explanation || '',
      session: session ? session.title : '',
      type: session ? session.type : '',
      time: Date.now(),
    });
    saveErrors(list);
  }

  function renderErrors() {
    const list = getErrors();
    const statsEl = $('errorStats');
    const listEl = $('errorList');

    if (list.length === 0) {
      statsEl.innerHTML = '';
      listEl.innerHTML = '<div class="empty-state"><div class="empty-icon">✅</div><p>暂无错题记录</p></div>';
      $('reviewExerciseArea').classList.add('hidden');
      return;
    }

    // Stats
    const bySession = {};
    list.forEach((e) => {
      const key = e.session || '未知';
      bySession[key] = (bySession[key] || 0) + 1;
    });

    statsEl.innerHTML = `
      <div class="stat-card"><div class="stat-num">${list.length}</div><div class="stat-label">总错题</div></div>
      ${Object.entries(bySession).map(([k, v]) =>
        `<div class="stat-card"><div class="stat-num">${v}</div><div class="stat-label">${esc(k)}</div></div>`
      ).join('')}
    `;

    // Error list (newest first)
    const sorted = [...list].reverse();
    listEl.innerHTML = sorted.map((e) => `
      <div class="error-card">
        <div class="error-card-header">
          <span>${esc(e.session || '')} · ${esc(e.type || '')}</span>
          <span>${new Date(e.time).toLocaleDateString()}</span>
        </div>
        <div class="error-card-question">${esc(e.question)}</div>
        <div class="error-card-answers">
          <span class="correct-answer">正确: ${esc(e.correctAnswer)}</span>
        </div>
        <div class="error-card-detail">${esc(e.explanation)}</div>
      </div>
    `).join('');
  }

  async function generateReviewExercises() {
    const errors = getErrors();
    if (errors.length === 0) {
      alert('暂无错题记录');
      return;
    }

    const btn = $('btnReviewErrors');
    btn.disabled = true;
    btn.textContent = '生成中...';

    const area = $('reviewExerciseArea');
    area.classList.remove('hidden');
    $('reviewExerciseList').innerHTML = '<div class="loading-dots">AI 正在分析薄弱点并生成复习题</div>';
    $('reviewExerciseScore').textContent = '';
    reviewExerciseState = { answered: 0, correct: 0 };

    try {
      const errorSummary = errors.slice(-10).map((e, i) =>
        `${i + 1}. 题目：${e.question} | 正确：${e.correctAnswer} | 解析：${e.explanation}`
      ).join('\n');

      const systemMsg = `你是PET考试专家。根据学生的错题记录，分析薄弱点，生成5道针对性练习题。
严格遵循PET真题出题风格。
返回纯JSON数组，不要markdown代码块。格式:[{"question":"题目","options":["A. ...","B. ...","C. ...","D. ..."],"answer":"A","explanation":"中文解析，说明为什么这个知识点重要"}]`;

      const userMsg = `以下是学生的错题记录：\n${errorSummary}\n请分析这些错误的共同薄弱点，生成5道新的针对性练习题。`;

      const result = await callLLM(systemMsg, userMsg);

      let exercises;
      try {
        const cleaned = result.replace(/```json?\s*/g, '').replace(/```\s*/g, '').trim();
        exercises = JSON.parse(cleaned);
      } catch {
        const match = result.match(/\[[\s\S]*\]/);
        if (match) exercises = JSON.parse(match[0]);
        else throw new Error('无法解析练习题数据');
      }

      renderExercises(exercises, 'reviewExerciseList', 'reviewExerciseScore', reviewExerciseState);
    } catch (e) {
      $('reviewExerciseList').innerHTML = `<p style="color:var(--danger)">${esc(e.message)}</p>`;
    }

    btn.disabled = false;
    btn.textContent = '🤖 AI生成复习题';
  }

  // ---- Markdown → HTML (enhanced) ----
  function formatMarkdown(text) {
    return text
      .replace(/## (.*)/g, '<h3>$1</h3>')
      .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
      .replace(/\*(.*?)\*/g, '<em>$1</em>')
      .replace(/`(.*?)`/g, '<code>$1</code>')
      .replace(/^- (.*)/gm, '<li>$1</li>')
      .replace(/(<li>[\s\S]*?<\/li>)/g, function (match) {
        if (!match.startsWith('<ul>')) return '<ul>' + match + '</ul>';
        return match;
      })
      .replace(/<\/ul>\s*<ul>/g, '')
      .replace(/→/g, '→')
      .replace(/\n\n/g, '</p><p>')
      .replace(/\n/g, '<br>')
      .replace(/^/, '<p>')
      .replace(/$/, '</p>')
      .replace(/<p><h3>/g, '<h3>')
      .replace(/<\/h3><\/p>/g, '</h3>')
      .replace(/<p><ul>/g, '<ul>')
      .replace(/<\/ul><\/p>/g, '</ul>');
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
    list.push({ word, unitId, sessionId, added: Date.now() });
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
    flashcardIdx++;
    showFlashcard();
  }

  function closeFlashcard() {
    $('flashcardModal').classList.add('hidden');
    updateBadges();
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

    // Action buttons
    $('btnExercises').addEventListener('click', generateExercises);
    $('btnFlashcards').addEventListener('click', generateAIFlashcards);
    $('btnLecture').addEventListener('click', generateLecture);

    // Inline flashcard navigation
    $('aiFcFlip').addEventListener('click', flipInlineCard);
    $('aiFcCard').addEventListener('click', flipInlineCard);
    $('aiFcPrev').addEventListener('click', () => {
      if (flashcardIdx > 0) { flashcardIdx--; showInlineFlashcard(); }
    });
    $('aiFcNext').addEventListener('click', () => {
      if (flashcardIdx < flashcards.length - 1) { flashcardIdx++; showInlineFlashcard(); }
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

    // Error page
    $('btnClearErrors').addEventListener('click', () => {
      if (confirm('确定清空所有错题记录？')) {
        saveErrors([]);
        renderErrors();
      }
    });
    $('btnReviewErrors').addEventListener('click', generateReviewExercises);

    // Essay
    $('btnSubmitEssay').addEventListener('click', submitEssay);
    $('essayInput').addEventListener('input', () => {
      const text = $('essayInput').value.trim();
      const count = text ? text.split(/\s+/).filter(Boolean).length : 0;
      $('wordCount').textContent = `${count} 词`;
      $('btnSubmitEssay').disabled = count < 10;
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
