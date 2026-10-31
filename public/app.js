const API_BASE = `${window.location.origin}/api/v1`;
const TOKEN_KEY = 'brightside_quiz_token';
const ACTIVE_KEY = 'brightside_active_attempt';
const state = {
  token: localStorage.getItem(TOKEN_KEY), user: null, page: 'quizzes', authMode: 'login',
  quiz: null, attempt: null, attemptIndex: 0, answers: {}, result: null,
  timer: null, submitting: false, dialogSubmit: null, searchTimer: null, toastTimer: null,
};
const $ = (selector, root = document) => root.querySelector(selector);
const esc = (value = '') => String(value).replace(/[&<>"']/g, (c) => ({
  '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
}[c]));

class ApiError extends Error {
  constructor(message, status) { super(message); this.status = status; }
}

async function api(path, options = {}) {
  const headers = new Headers(options.headers || {});
  if (options.body) headers.set('Content-Type', 'application/json');
  if (state.token) headers.set('Authorization', `Bearer ${state.token}`);
  let response;
  try { response = await fetch(`${API_BASE}${path}`, { ...options, headers }); }
  catch { throw new ApiError('Cannot connect to the quiz server. Check that the backend is running.', 0); }
  let payload = {};
  try { payload = await response.json(); } catch { /* Keep the HTTP status as the useful error. */ }
  if (!response.ok) {
    const error = new ApiError(payload.error || payload.message || `Request failed (${response.status})`, response.status);
    if (response.status === 401 && state.token) {
      state.token = null;
      localStorage.removeItem(TOKEN_KEY);
      showAuth('Your session expired. Please sign in again.');
    }
    throw error;
  }
  return payload;
}

function notify(message, error = false) {
  const toast = $('#toast');
  clearTimeout(state.toastTimer);
  toast.textContent = message;
  toast.classList.toggle('error', error);
  toast.classList.add('visible');
  state.toastTimer = setTimeout(() => toast.classList.remove('visible'), 3600);
}

function showAuth(message = '') {
  clearInterval(state.timer);
  state.timer = null;
  $('#app-screen').hidden = true;
  $('#auth-screen').hidden = false;
  $('#auth-message').textContent = message;
}

function setAuthMode(mode) {
  state.authMode = mode;
  const register = mode === 'register';
  $('#login-tab').classList.toggle('active', !register);
  $('#register-tab').classList.toggle('active', register);
  $('#login-tab').setAttribute('aria-selected', String(!register));
  $('#register-tab').setAttribute('aria-selected', String(register));
  $('#name-field').hidden = !register;
  $('#auth-name').required = register;
  $('#auth-password').autocomplete = register ? 'new-password' : 'current-password';
  $('#auth-title').textContent = register ? 'Create your account' : 'Welcome back';
  $('#auth-subtitle').textContent = register ? 'Join in and start learning.' : 'Sign in and keep learning.';
  $('#auth-submit').innerHTML = register ? 'Create account <span>→</span>' : 'Sign in <span>→</span>';
  $('#auth-message').textContent = '';
}

const pageInfo = {
  overview: ['YOUR QUIZ STUDIO', 'A good day to learn.', 'A quick look at quizzes and learner progress.'],
  quizzes: ['THE QUIZ COLLECTION', 'Choose your next challenge.', 'Short quizzes, fresh ideas, and a chance to see what sticks.'],
  results: ['YOUR LEARNING TRAIL', 'Look how far you’ve come.', 'Review recent scores and celebrate what you know.'],
  questions: ['BUILD THE QUIZ', 'Questions and answers.', 'Write clear questions and choose the correct answer.'],
  attempts: ['PARTICIPANT RESULTS', 'Quiz attempts.', 'See how participants did on this quiz.'],
  attempt: ['TAKE A MOMENT', '', 'Read each question carefully. Your progress is saved while you play.'],
  result: ['THAT’S A WRAP', 'Your results.', 'Every attempt is a little more practice.'],
};

function navItems() {
  return state.user?.role === 'admin'
    ? [['overview', 'Overview', '◫'], ['quizzes', 'Manage quizzes', '▤']]
    : [['quizzes', 'Explore quizzes', '✳'], ['results', 'My results', '◷']];
}

function setupApp() {
  $('#auth-screen').hidden = true;
  $('#app-screen').hidden = false;
  $('#user-name').textContent = state.user?.name || state.user?.email || '';
  $('#user-avatar').textContent = (state.user?.name || state.user?.email || 'B').trim().charAt(0).toUpperCase();
  $('#role-badge').textContent = state.user?.role === 'admin' ? 'Quiz admin' : 'Participant';
  navigate(state.user?.role === 'admin' ? 'overview' : 'quizzes');
}

function navigate(page) {
  if (state.page === 'attempt' && state.attempt && page !== 'attempt') {
    notify('Submit this attempt before leaving the quiz.', true);
    return;
  }
  if (['overview', 'questions', 'attempts'].includes(page) && state.user?.role !== 'admin') return;
  if (['results', 'attempt', 'result'].includes(page) && state.user?.role === 'admin') return;
  state.page = page;
  const [kicker, title, subtitle] = pageInfo[page] || pageInfo.quizzes;
  $('#page-kicker').textContent = kicker;
  $('#page-title').textContent = page === 'attempt' ? state.quiz?.title || 'Quiz in progress' : title;
  $('#page-subtitle').textContent = subtitle;
  const active = ['questions', 'attempts', 'attempt', 'result'].includes(page) ? 'quizzes' : page;
  $('#main-nav').innerHTML = navItems().map(([id, label, icon]) => `
    <button class="nav-link${active === id ? ' active' : ''}" type="button" data-page="${id}">
      <span class="nav-icon" aria-hidden="true">${icon}</span><span>${label}</span>
    </button>`).join('');
  renderPage();
}

function setPageActions(markup = '') { $('#page-actions').innerHTML = markup; }
function loadingMarkup() { return '<div class="loading-state">Loading your quiz space…</div>'; }
function emptyMarkup(title, text) { return `<div class="empty-state"><strong>${esc(title)}</strong>${esc(text)}</div>`; }
function formatDate(value) {
  if (!value) return '—';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? '—' : new Intl.DateTimeFormat(undefined, { month: 'short', day: 'numeric', year: 'numeric' }).format(date);
}

function renderPage() {
  clearInterval(state.timer);
  state.timer = null;
  setPageActions('');
  $('#page-body').innerHTML = loadingMarkup();
  if (state.page === 'overview') return loadStatistics();
  if (state.page === 'quizzes') return renderQuizList();
  if (state.page === 'results') return loadMyResults();
  if (state.page === 'questions') return loadQuestions();
  if (state.page === 'attempts') return loadQuizAttempts();
  if (state.page === 'attempt') return renderAttempt();
  if (state.page === 'result') return renderResult();
}

function statCard(label, value, icon) {
  const displayed = typeof value === 'string' ? esc(value) : Number(value || 0).toLocaleString();
  return `<article class="stat-card"><span>${esc(label)}</span><strong>${displayed}</strong><i aria-hidden="true">${icon}</i></article>`;
}

async function loadStatistics() {
  try {
    const { data } = await api('/admin/statistics');
    if (state.page !== 'overview') return;
    const stats = data.statistics;
    $('#page-body').innerHTML = `<div class="stat-grid">
      ${statCard('All quizzes', stats.totalQuizzes, '▤')}${statCard('Published', stats.publishedQuizzes, '↗')}
      ${statCard('Submitted attempts', stats.totalAttempts, '◷')}${statCard('Participants', stats.totalParticipants, '♙')}
      ${statCard('Average score', String(Number(stats.averageScore || 0)) + '%', '◉')}${statCard('Pass rate', String(Number(stats.passRate || 0)) + '%', '✓')}
    </div><section class="panel"><h2>Most attempted quizzes</h2>
      ${stats.mostAttempted?.length ? stats.mostAttempted.map((quiz) => `<div class="leader-row"><span class="leader-label">${esc(quiz.title)}</span><span class="leader-score">${Number(quiz.attemptCount)} attempts · ${Number(quiz.avgScore || 0)}% avg</span></div>`).join('') : emptyMarkup('No attempts yet.', 'Publish a quiz and invite learners to try it.')}
    </section>`;
  } catch (error) { showPageError(error); }
}

function renderQuizList() {
  const admin = state.user?.role === 'admin';
  if (admin) setPageActions('<button type="button" class="button button-primary" data-action="new-quiz">＋ Create quiz</button>');
  $('#page-body').innerHTML = `<div class="toolbar"><label class="searchbox"><span aria-hidden="true">⌕</span><input id="quiz-search" type="search" placeholder="Search quizzes" aria-label="Search quizzes" /></label><div class="toolbar-right">${admin ? '<select id="status-filter" aria-label="Filter by status"><option value="">All statuses</option><option value="draft">Draft</option><option value="published">Published</option><option value="unpublished">Unpublished</option></select>' : ''}<select id="category-filter" aria-label="Filter by category"><option value="">All categories</option></select></div></div><div id="quiz-results" class="quiz-grid">${loadingMarkup()}</div>`;
  loadQuizzes();
}

async function loadQuizzes() {
  const results = $('#quiz-results');
  if (!results) return;
  const query = new URLSearchParams({ page: '1', limit: '100', sortBy: 'createdAt', sortOrder: 'desc' });
  const search = $('#quiz-search')?.value.trim();
  const category = $('#category-filter')?.value;
  const status = $('#status-filter')?.value;
  if (search) query.set('search', search);
  if (category) query.set('category', category);
  if (status) query.set('status', status);
  results.innerHTML = loadingMarkup();
  try {
    const { data } = await api(`/quizzes?${query}`);
    if (state.page !== 'quizzes' || !$('#quiz-results')) return;
    const quizzes = data.quizzes || [];
    const categories = [...new Set(quizzes.map((quiz) => quiz.category || 'General'))].sort((a, b) => a.localeCompare(b));
    const select = $('#category-filter');
    if (select) {
      const selected = select.value;
      select.innerHTML = '<option value="">All categories</option>' + categories.map((item) => `<option value="${esc(item)}">${esc(item)}</option>`).join('');
      select.value = selected;
    }
    if (!quizzes.length) {
      results.className = '';
      results.innerHTML = emptyMarkup('No quizzes found.', state.user?.role === 'admin' ? 'Create a quiz to start building your collection.' : 'Try another search or check back soon.');
      return;
    }
    results.className = 'quiz-grid';
    results.innerHTML = quizzes.map(quizCard).join('');
  } catch (error) { showInlineError(results, error); }
}

function quizCard(quiz) {
  const admin = state.user?.role === 'admin';
  const status = quiz.status || 'published';
  const stats = `<div class="quiz-stats"><span>◷ <b>${Number(quiz.timeLimitMinutes || 0)} min</b></span><span>✳ <b>${Number(quiz.totalQuestions || 0)} questions</b></span><span>◎ <b>${Number(quiz.totalMarks || 0)} pts</b></span></div>`;
  let actions;
  if (admin) {
    actions = `<div class="quiz-actions"><button class="button button-quiet button-small" type="button" data-action="edit-quiz" data-id="${esc(quiz._id)}">Edit</button><button class="button button-quiet button-small" type="button" data-action="manage-questions" data-id="${esc(quiz._id)}">Questions</button><button class="button button-quiet button-small" type="button" data-action="quiz-attempts" data-id="${esc(quiz._id)}">Results</button><button class="button button-soft button-small" type="button" data-action="${status === 'published' ? 'unpublish-quiz' : 'publish-quiz'}" data-id="${esc(quiz._id)}">${status === 'published' ? 'Unpublish' : 'Publish'}</button><button class="button button-danger button-small" type="button" data-action="delete-quiz" data-id="${esc(quiz._id)}">Delete</button></div>`;
  } else {
    actions = `<div class="quiz-actions"><button class="button button-primary button-small" type="button" data-action="start-quiz" data-id="${esc(quiz._id)}">Start quiz <span>→</span></button><button class="button button-quiet button-small" type="button" data-action="leaderboard" data-id="${esc(quiz._id)}" data-title="${esc(quiz.title)}">Leaderboard</button></div>`;
  }
  return `<article class="quiz-card"><p class="quiz-category">${esc(quiz.category || 'General')}</p><h2 class="quiz-title">${esc(quiz.title)}</h2><p class="quiz-description">${esc(quiz.description || 'A little challenge for your curious side.')}</p>${stats}<div class="quiz-footer"><span class="status-tag ${esc(status)}">${esc(status)}</span><span class="table-sub">${Number(quiz.maxAttempts || 1)} attempt${Number(quiz.maxAttempts || 1) === 1 ? '' : 's'}</span></div>${actions}</article>`;
}

async function loadMyResults() {
  try {
    const { data } = await api('/users/me/results?page=1&limit=100');
    if (state.page !== 'results') return;
    const results = data.results || [];
    if (!results.length) { $('#page-body').innerHTML = emptyMarkup('Your story starts here.', 'Take a published quiz and your results will appear here.'); return; }
    $('#page-body').innerHTML = `<div class="quiz-results">${results.map((item) => `<article class="result-card"><div><div class="result-title">${esc(item.quiz?.title || 'Quiz')}</div><div class="result-meta">${formatDate(item.submittedAt)} · ${Number(item.correctCount || 0)} correct of ${Number(item.correctCount || 0) + Number(item.wrongCount || 0) + Number(item.unansweredCount || 0)}</div></div><div><span class="score-value">${Number(item.percentage || 0)}%</span><span class="pass-pill${item.passed ? '' : ' fail'}">${item.passed ? 'Passed' : 'Try again'}</span><button class="button button-quiet button-small" type="button" data-action="result-detail" data-id="${esc(item._id)}">Details</button></div></article>`).join('')}</div>`;
  } catch (error) { showPageError(error); }
}

async function loadQuestions() {
  if (!state.quiz) return navigate('quizzes');
  $('#page-title').textContent = state.quiz.title;
  $('#page-subtitle').textContent = 'Manage the questions, options, and answer key for this quiz.';
  setPageActions('<button class="button button-quiet" type="button" data-action="back-quizzes">← All quizzes</button><button class="button button-primary" type="button" data-action="new-question">＋ Add question</button>');
  try {
    const { data } = await api(`/quizzes/${state.quiz._id}/questions`);
    if (state.page !== 'questions') return;
    const questions = data.questions || [];
    if (!questions.length) { $('#page-body').innerHTML = emptyMarkup('No questions yet.', 'Add at least one question before publishing this quiz.'); return; }
    $('#page-body').innerHTML = `<div class="question-admin-list">${questions.map((question, index) => `<article class="panel question-admin-card"><div class="question-admin-top"><span class="question-index">QUESTION ${index + 1} · ${Number(question.marks || 1)} PT${Number(question.marks || 1) === 1 ? '' : 'S'}</span><span class="question-admin-actions"><button type="button" class="button button-quiet button-small" data-action="edit-question" data-id="${esc(question._id)}">Edit</button><button type="button" class="button button-danger button-small" data-action="delete-question" data-id="${esc(question._id)}">Delete</button></span></div><h2>${esc(question.text)}</h2><div class="admin-options">${(question.options || []).map((option) => `<div class="admin-option${option.isCorrect ? ' correct' : ''}"><span>${option.isCorrect ? '✓' : '○'}</span>${esc(option.text)}${option.isCorrect ? '<b>Correct answer</b>' : ''}</div>`).join('')}</div>${question.explanation ? `<p class="question-explanation">${esc(question.explanation)}</p>` : ''}</article>`).join('')}</div>`;
  } catch (error) { showPageError(error); }
}

async function loadQuizAttempts() {
  if (!state.quiz) return navigate('quizzes');
  $('#page-title').textContent = state.quiz.title;
  $('#page-subtitle').textContent = 'Review participant scores and submission status.';
  setPageActions('<button class="button button-quiet" type="button" data-action="back-quizzes">← All quizzes</button>');
  try {
    const { data } = await api(`/quizzes/${state.quiz._id}/attempts?page=1&limit=100`);
    if (state.page !== 'attempts') return;
    const attempts = data.attempts || [];
    if (!attempts.length) { $('#page-body').innerHTML = emptyMarkup('No attempts yet.', 'Results will appear here once participants submit this quiz.'); return; }
    $('#page-body').innerHTML = `<div class="table-panel"><table class="data-table"><thead><tr><th>Participant</th><th>Status</th><th>Score</th><th>Correct</th><th>Submitted</th><th></th></tr></thead><tbody>${attempts.map((attempt) => `<tr><td><div class="table-main">${esc(attempt.participant?.name || 'Participant')}</div><div class="table-sub">${esc(attempt.participant?.email || '')}</div></td><td><span class="status-tag ${esc(attempt.status)}">${esc(attempt.status)}</span></td><td>${attempt.status === 'submitted' ? String(Number(attempt.percentage || 0)) + '%' : '—'}</td><td>${attempt.status === 'submitted' ? String(Number(attempt.correctCount || 0)) + ' / ' + String(Number(attempt.questionOrder?.length || 0)) : '—'}</td><td>${formatDate(attempt.submittedAt)}</td><td><button type="button" class="button button-quiet button-small" data-action="admin-attempt-detail" data-id="${esc(attempt._id)}">View</button></td></tr>`).join('')}</tbody></table></div>`;
  } catch (error) { showPageError(error); }
}

function renderAttempt() {
  if (!state.attempt?.questions?.length) return navigate('quizzes');
  const questions = state.attempt.questions;
  const index = Math.min(state.attemptIndex, questions.length - 1);
  state.attemptIndex = index;
  const question = questions[index];
  const chosen = state.answers[question._id] || '';
  setPageActions('<span id="timer-pill" class="timer-pill">◷ <span id="timer-text">--:--</span></span>');
  $('#page-subtitle').textContent = 'Read each question carefully. Your progress is saved while you play.';
  $('#page-body').innerHTML = `<div class="attempt-layout"><section class="attempt-card"><div class="attempt-topline"><span class="question-count">QUESTION ${index + 1} <span class="question-total">/ ${questions.length}</span></span><span>${Number(question.marks || 1)} point${Number(question.marks || 1) === 1 ? '' : 's'}</span></div><h2 class="question-text">${esc(question.text)}</h2><div class="option-list">${(question.options || []).map((option) => `<label class="answer-option${chosen === option._id ? ' selected' : ''}"><input type="radio" name="answer" value="${esc(option._id)}" ${chosen === option._id ? 'checked' : ''} /><span>${esc(option.text)}</span></label>`).join('')}</div><div class="attempt-controls"><button class="button button-quiet" type="button" data-action="previous-question" ${index === 0 ? 'disabled' : ''}>← Previous</button>${index === questions.length - 1 ? '<button class="button button-primary" type="button" data-action="submit-attempt">Submit answers →</button>' : '<button class="button button-primary" type="button" data-action="next-question">Next question →</button>'}</div></section><aside class="question-map"><h3>YOUR PROGRESS</h3><div class="question-dots">${questions.map((item, number) => `<button class="question-dot${number === index ? ' active' : ''}${state.answers[item._id] ? ' answered' : ''}" type="button" data-action="go-question" data-index="${number}" aria-label="Go to question ${number + 1}">${number + 1}</button>`).join('')}</div><p class="inline-note">Your answers are saved as you go.</p></aside></div>`;
  updateTimer();
  if (!state.timer) state.timer = setInterval(updateTimer, 1000);
}

function updateTimer() {
  if (state.page !== 'attempt' || !state.attempt) return;
  const remaining = Math.max(0, new Date(state.attempt.expiresAt).getTime() - Date.now());
  const seconds = Math.ceil(remaining / 1000);
  const timerText = $('#timer-text');
  if (timerText) timerText.textContent = `${String(Math.floor(seconds / 60)).padStart(2, '0')}:${String(seconds % 60).padStart(2, '0')}`;
  $('#timer-pill')?.classList.toggle('warning', seconds <= 60);
  if (remaining <= 0 && !state.submitting) submitAttempt(true);
}

function saveAttempt() {
  if (!state.attempt) return;
  sessionStorage.setItem(ACTIVE_KEY, JSON.stringify({ attemptId: state.attempt.attemptId, quizId: state.attempt.quizId, answers: state.answers, index: state.attemptIndex }));
}

async function startQuiz(quizId) {
  try {
    const started = await api(`/quizzes/${quizId}/attempts`, { method: 'POST' });
    const attempt = started.data.attempt;
    const questionResponse = await api(`/attempts/${attempt._id}/questions`);
    const quizResponse = await api(`/quizzes/${quizId}`);
    state.quiz = quizResponse.data.quiz;
    state.attempt = { ...attempt, attemptId: attempt._id, quizId, expiresAt: questionResponse.data.expiresAt, questions: questionResponse.data.questions };
    let saved = null;
    try { saved = JSON.parse(sessionStorage.getItem(ACTIVE_KEY) || 'null'); } catch { saved = null; }
    const resume = saved?.attemptId === attempt._id;
    state.answers = resume ? (saved.answers || {}) : {};
    state.attemptIndex = resume ? Math.min(saved.index || 0, state.attempt.questions.length - 1) : 0;
    state.submitting = false;
    saveAttempt();
    navigate('attempt');
  } catch (error) { notify(error.message, true); }
}

async function resumeAttempt(saved) {
  try {
    const response = await api(`/attempts/${saved.attemptId}/questions`);
    const quizResponse = await api(`/quizzes/${saved.quizId}`);
    state.quiz = quizResponse.data.quiz;
    state.attempt = { ...response.data, attemptId: saved.attemptId, quizId: saved.quizId, questions: response.data.questions };
    state.answers = saved.answers || {};
    state.attemptIndex = Math.min(saved.index || 0, response.data.questions.length - 1);
    state.submitting = false;
    navigate('attempt');
  } catch (error) {
    sessionStorage.removeItem(ACTIVE_KEY);
    if (error.status !== 401) notify('Your saved quiz attempt is no longer active.');
    navigate(state.user?.role === 'admin' ? 'overview' : 'quizzes');
  }
}

async function submitAttempt(fromTimer = false) {
  if (!state.attempt || state.submitting) return;
  if (!fromTimer && !window.confirm('Submit your answers now? You cannot change them afterward.')) return;
  state.submitting = true;
  clearInterval(state.timer);
  state.timer = null;
  const answers = state.attempt.questions.map((question) => ({ questionId: question._id, selectedOptionId: state.answers[question._id] || null }));
  try {
    const { data } = await api(`/attempts/${state.attempt.attemptId}/submit`, { method: 'POST', body: JSON.stringify({ answers }) });
    const quizId = state.attempt.quizId;
    const quizTitle = state.quiz?.title || 'Quiz';
    sessionStorage.removeItem(ACTIVE_KEY);
    state.result = { result: data.result, quizId, quizTitle, questions: [] };
    state.attempt = null;
    try {
      const response = await api(`/quizzes/${quizId}/questions`);
      state.result.questions = response.data.questions || [];
    } catch { /* The score summary remains available without question review. */ }
    state.submitting = false;
    navigate('result');
  } catch (error) {
    state.submitting = false;
    if (fromTimer || /expired|time limit/i.test(error.message)) {
      sessionStorage.removeItem(ACTIVE_KEY);
      state.attempt = null;
      notify('Time is up. This attempt has expired.', true);
      navigate('quizzes');
    } else { notify(error.message, true); renderAttempt(); }
  }
}

function renderResult() {
  const context = state.result;
  const result = context?.result;
  if (!result) return navigate(state.user?.role === 'admin' ? 'overview' : 'quizzes');
  $('#page-title').textContent = result.passed ? 'Look at you go.' : 'Good practice.';
  $('#page-subtitle').textContent = context.quizTitle;
  setPageActions('<button class="button button-quiet" type="button" data-action="return-to-quizzes">← Back to quizzes</button>');
  $('#page-body').innerHTML = `<section class="result-hero"><div class="result-symbol">${result.passed ? '✦' : '↗'}</div><h2>${result.passed ? 'You passed!' : 'Keep learning.'}</h2><p>${result.passed ? 'That knowledge is yours.' : 'You needed ' + Number(state.quiz?.passingScore || 0) + '% to pass. Give it another go when you’re ready.'}</p><div class="result-score">${Number(result.percentage || 0)}<span>%</span></div><div class="result-breakdown"><span><strong>${Number(result.scoredMarks || 0)}</strong> / ${Number(result.totalMarks || 0)} points</span><span><strong>${Number(result.correctCount || 0)}</strong> correct</span><span><strong>${Number(result.wrongCount || 0)}</strong> missed</span><span><strong>${Number(result.unansweredCount || 0)}</strong> skipped</span></div><div class="result-actions"><button type="button" class="button button-primary" data-action="return-to-quizzes">Explore quizzes</button><button type="button" class="button button-quiet" data-action="leaderboard" data-id="${esc(context.quizId)}" data-title="${esc(context.quizTitle)}">View leaderboard</button></div></section>${renderReview(context)}`;
}

function renderReview(context) {
  if (!context?.questions?.length || !context.result?.answers?.length) return '';
  const answerMap = new Map(context.result.answers.map((answer) => [String(answer.question), answer]));
  const rows = context.questions.map((question, index) => {
    const answer = answerMap.get(String(question._id));
    if (!answer) return '';
    const selected = (question.options || []).find((option) => option._id === answer.selectedOption);
    return `<div class="review-row"><span class="review-icon ${answer.isCorrect ? 'correct' : 'incorrect'}">${answer.isCorrect ? '✓' : '×'}</span><div><strong>${index + 1}. ${esc(question.text)}</strong><p>${selected ? 'Your answer: ' + esc(selected.text) : 'You skipped this one.'}</p></div></div>`;
  }).join('');
  return rows ? `<section class="review-panel"><h2>Your answers</h2>${rows}<p class="inline-note">Correct choices are not shown in participant review.</p></section>` : '';
}

function dialogMarkup(title, subtitle, body, submitText = 'Save') {
  return `<header class="dialog-head"><div><h2>${esc(title)}</h2><p>${esc(subtitle)}</p></div><button type="button" class="close-dialog" data-close-dialog aria-label="Close">×</button></header><form id="dialog-form" class="dialog-form">${body}<p id="dialog-error" class="dialog-error" role="status"></p><div class="dialog-footer"><button class="button button-quiet" type="button" data-close-dialog>Cancel</button><button class="button button-primary" type="submit">${esc(submitText)}</button></div></form>`;
}
function openDialog(title, subtitle, body, submitText, onSubmit) {
  $('#dialog-content').innerHTML = dialogMarkup(title, subtitle, body, submitText);
  state.dialogSubmit = onSubmit;
  $('#dialog').showModal();
}
function closeDialog() { $('#dialog').close(); state.dialogSubmit = null; }
function field(name, label, value = '', type = 'text', options = {}) {
  const full = options.full ? ' full' : '';
  if (type === 'textarea') return `<label class="field${full}"><span>${esc(label)}</span><textarea name="${esc(name)}" maxlength="${options.maxlength || 5000}" ${options.required ? 'required' : ''} placeholder="${esc(options.placeholder || '')}">${esc(value)}</textarea></label>`;
  return `<label class="field${full}"><span>${esc(label)}</span><input name="${esc(name)}" type="${esc(type)}" value="${esc(value)}" ${options.required ? 'required' : ''} ${options.min !== undefined ? `min="${options.min}"` : ''} ${options.max !== undefined ? `max="${options.max}"` : ''} ${options.maxlength ? `maxlength="${options.maxlength}"` : ''} placeholder="${esc(options.placeholder || '')}" /></label>`;
}

function quizForm(quiz = null) {
  const check = (name, label, value) => `<label><input type="checkbox" name="${name}" ${value ? 'checked' : ''} />${label}</label>`;
  const body = field('title', 'Quiz title', quiz?.title || '', 'text', { required: true, maxlength: 300, full: true })
    + field('category', 'Category', quiz?.category || 'General', 'text', { maxlength: 100 })
    + field('timeLimitMinutes', 'Time limit (minutes)', quiz?.timeLimitMinutes ?? 30, 'number', { min: 1, max: 600 })
    + field('passingScore', 'Passing score (%)', quiz?.passingScore ?? 50, 'number', { min: 0, max: 100 })
    + field('maxAttempts', 'Attempts allowed', quiz?.maxAttempts ?? 1, 'number', { min: 1, max: 100 })
    + field('negativeMarkingPenalty', 'Wrong answer penalty (0–1)', quiz?.negativeMarkingPenalty ?? 0.25, 'number', { min: 0, max: 1 })
    + field('description', 'Description', quiz?.description || '', 'textarea', { full: true, maxlength: 5000 })
    + `<div class="check-row full">${check('negativeMarking', 'Negative marking', quiz?.negativeMarking)}${check('shuffleQuestions', 'Shuffle questions', quiz?.shuffleQuestions)}${check('shuffleOptions', 'Shuffle options', quiz?.shuffleOptions)}</div>`;
  openDialog(quiz ? 'Edit quiz' : 'Create a quiz', quiz ? 'Adjust the quiz details and settings.' : 'Set the basics. You can add questions next.', body, quiz ? 'Save changes' : 'Create quiz', async (form) => {
    const values = new FormData(form);
    const payload = {
      title: values.get('title').trim(), category: values.get('category').trim() || 'General', description: values.get('description').trim(),
      timeLimitMinutes: Number(values.get('timeLimitMinutes')), passingScore: Number(values.get('passingScore')),
      maxAttempts: Number(values.get('maxAttempts')), negativeMarkingPenalty: Number(values.get('negativeMarkingPenalty')),
      negativeMarking: values.has('negativeMarking'), shuffleQuestions: values.has('shuffleQuestions'), shuffleOptions: values.has('shuffleOptions'),
    };
    await api(quiz ? `/quizzes/${quiz._id}` : '/quizzes', { method: quiz ? 'PATCH' : 'POST', body: JSON.stringify(payload) });
    closeDialog(); notify(quiz ? 'Quiz updated.' : 'Quiz created. Add questions before publishing.'); loadQuizzes();
  });
}

function optionRow(option = {}, index = 0, correctIndex = 0) {
  return `<div class="option-edit-row"><input name="optionText" type="text" maxlength="1000" required placeholder="Answer option ${index + 1}" value="${esc(option.text || '')}" /><label class="correct-choice"><input type="radio" name="correctIndex" value="${index}" ${index === correctIndex ? 'checked' : ''} /> Correct</label><button type="button" data-action="remove-option" aria-label="Remove option">×</button></div>`;
}
function questionForm(question = null) {
  const options = question?.options?.length ? question.options : [{ text: '' }, { text: '' }, { text: '' }, { text: '' }];
  const correctIndex = question ? Math.max(0, options.findIndex((item) => item.isCorrect)) : 0;
  const body = field('text', 'Question', question?.text || '', 'textarea', { full: true, required: true, maxlength: 5000 })
    + `<div class="field full"><span>Answer options <small>Select the correct answer</small></span><div id="option-editor" class="option-editor">${options.map((item, index) => optionRow(item, index, correctIndex)).join('')}</div><button type="button" class="button button-quiet button-small add-option" data-action="add-option">＋ Add option</button></div>`
    + field('marks', 'Points', question?.marks ?? 1, 'number', { min: 1, max: 100 })
    + field('order', 'Display order', question?.order ?? 0, 'number', { min: 0 })
    + field('explanation', 'Explanation (shown after submission)', question?.explanation || '', 'textarea', { full: true, maxlength: 2000 });
  openDialog(question ? 'Edit question' : 'Add a question', 'Add between two and six answer options.', body, question ? 'Save question' : 'Add question', async (form) => {
    const values = new FormData(form);
    const texts = values.getAll('optionText').map((text) => text.trim());
    if (texts.length < 2 || texts.length > 6) throw new Error('A question needs between two and six options.');
    const correct = Number(values.get('correctIndex'));
    if (!Number.isInteger(correct) || correct < 0 || correct >= texts.length) throw new Error('Choose the correct option.');
    const payload = { text: values.get('text').trim(), options: texts.map((text, index) => ({ text, isCorrect: index === correct })), marks: Number(values.get('marks')), order: Number(values.get('order')), explanation: values.get('explanation').trim() };
    const path = question ? `/quizzes/${state.quiz._id}/questions/${question._id}` : `/quizzes/${state.quiz._id}/questions`;
    await api(path, { method: question ? 'PATCH' : 'POST', body: JSON.stringify(payload) });
    closeDialog(); notify(question ? 'Question updated.' : 'Question added.'); loadQuestions();
  });
}

function simpleDialog(title, subtitle, content) {
  $('#dialog-content').innerHTML = `<header class="dialog-head"><div><h2>${esc(title)}</h2><p>${esc(subtitle)}</p></div><button type="button" class="close-dialog" data-close-dialog aria-label="Close">×</button></header>${content}<div class="dialog-footer solo"><button class="button button-primary" type="button" data-close-dialog>Done</button></div>`;
  state.dialogSubmit = null;
  $('#dialog').showModal();
}
async function openLeaderboard(id, title) {
  try {
    const { data } = await api(`/quizzes/${id}/leaderboard?limit=10`);
    const entries = data.leaderboard || [];
    const content = entries.length ? `<div class="leaderboard-list">${entries.map((item) => `<div class="leader-row"><span class="leader-rank">${Number(item.rank)}</span><div class="leader-person"><strong>${esc(item.participant)}</strong><small>${formatDate(item.submittedAt)}</small></div><span class="leader-score">${Number(item.percentage)}%</span></div>`).join('')}</div>` : emptyMarkup('No scores yet.', 'Be the first to take this quiz.');
    simpleDialog('Leaderboard', title, content);
  } catch (error) { notify(error.message, true); }
}
async function openAttemptDetail(id, admin = false) {
  try {
    const { data } = await api(`/attempts/${id}`);
    const attempt = data.attempt;
    const content = `<div class="detail-score"><strong>${Number(attempt.percentage || 0)}%</strong><span>${attempt.passed ? 'Passed' : 'Not passed'} · ${Number(attempt.scoredMarks || 0)} / ${Number(attempt.totalMarks || 0)} points</span></div><div class="detail-stats"><span>${Number(attempt.correctCount || 0)} correct</span><span>${Number(attempt.wrongCount || 0)} incorrect</span><span>${Number(attempt.unansweredCount || 0)} unanswered</span></div>${admin ? `<p class="inline-note">Participant: ${esc(attempt.participant?.name || 'Participant')} · ${esc(attempt.participant?.email || '')}</p>` : ''}`;
    simpleDialog('Attempt details', attempt.quiz?.title || state.quiz?.title || 'Quiz result', content);
  } catch (error) { notify(error.message, true); }
}

async function mutateQuiz(action, id) {
  if (action === 'delete-quiz' && !window.confirm('Delete this quiz? This is only possible when it has no attempts.')) return;
  const path = action === 'publish-quiz' ? `/quizzes/${id}/publish` : action === 'unpublish-quiz' ? `/quizzes/${id}/unpublish` : `/quizzes/${id}`;
  try {
    await api(path, { method: action === 'delete-quiz' ? 'DELETE' : 'PATCH' });
    notify(action === 'delete-quiz' ? 'Quiz deleted.' : action === 'publish-quiz' ? 'Quiz published.' : 'Quiz unpublished.');
    loadQuizzes();
  } catch (error) { notify(error.message, true); }
}

async function submitDialog(event) {
  if (event.target.id !== 'dialog-form' || !state.dialogSubmit) return;
  event.preventDefault();
  const form = event.target;
  const button = $('button[type="submit"]', form);
  const label = button.textContent;
  button.disabled = true; button.textContent = 'Saving…'; $('#dialog-error').textContent = '';
  try { await state.dialogSubmit(form); }
  catch (error) { $('#dialog-error').textContent = error.message; }
  finally { if (form.isConnected) { button.disabled = false; button.textContent = label; } }
}

async function submitAuth(event) {
  event.preventDefault();
  const register = state.authMode === 'register';
  const button = $('#auth-submit');
  const payload = { email: $('#auth-email').value.trim(), password: $('#auth-password').value };
  if (register) payload.name = $('#auth-name').value.trim();
  button.disabled = true; button.textContent = register ? 'Creating account…' : 'Signing in…'; $('#auth-message').textContent = '';
  try {
    const { data } = await api(`/auth/${state.authMode}`, { method: 'POST', body: JSON.stringify(payload) });
    state.token = data.token; state.user = data.user; localStorage.setItem(TOKEN_KEY, state.token); setupApp();
    const saved = sessionStorage.getItem(ACTIVE_KEY);
    if (saved && state.user.role !== 'admin') {
      try { await resumeAttempt(JSON.parse(saved)); } catch { sessionStorage.removeItem(ACTIVE_KEY); }
    }
  } catch (error) { $('#auth-message').textContent = error.message; }
  finally { button.disabled = false; button.innerHTML = register ? 'Create account <span>→</span>' : 'Sign in <span>→</span>'; }
}

function debounce(callback) { clearTimeout(state.searchTimer); state.searchTimer = setTimeout(callback, 250); }
function addOption() {
  const editor = $('#option-editor');
  if (!editor || editor.children.length >= 6) return notify('A question can have at most six options.', true);
  const selected = [...editor.querySelectorAll('input[type="radio"]')].findIndex((radio) => radio.checked);
  const template = document.createElement('template');
  template.innerHTML = optionRow({}, editor.children.length, Math.max(0, selected)).trim();
  editor.append(template.content.firstElementChild);
  renumberOptions();
}
function removeOption(button) {
  const editor = $('#option-editor');
  if (!editor || editor.children.length <= 2) return notify('Keep at least two answer options.', true);
  const removedCorrect = $('input[type="radio"]', button.closest('.option-edit-row'))?.checked;
  button.closest('.option-edit-row').remove();
  renumberOptions(removedCorrect);
}
function renumberOptions(chooseFirst = false) {
  const rows = [...($('#option-editor')?.querySelectorAll('.option-edit-row') || [])];
  const checkedIndex = rows.findIndex((row) => $('input[type="radio"]', row).checked);
  rows.forEach((row, index) => {
    $('input[type="text"]', row).placeholder = `Answer option ${index + 1}`;
    const radio = $('input[type="radio"]', row);
    radio.value = String(index);
    radio.checked = chooseFirst ? index === 0 : index === checkedIndex;
  });
}

function bindEvents() {
  $('#login-tab').addEventListener('click', () => setAuthMode('login'));
  $('#register-tab').addEventListener('click', () => setAuthMode('register'));
  $('#auth-form').addEventListener('submit', submitAuth);
  $('#logout-button').addEventListener('click', () => {
    clearInterval(state.timer); state.timer = null; state.token = null; state.user = null; state.attempt = null;
    localStorage.removeItem(TOKEN_KEY); $('#auth-form').reset(); setAuthMode('login'); showAuth();
  });
  $('#main-nav').addEventListener('click', (event) => { const button = event.target.closest('[data-page]'); if (button) navigate(button.dataset.page); });
  $('#page-actions').addEventListener('click', (event) => {
    if (event.target.closest('[data-action="new-quiz"]')) quizForm();
    if (event.target.closest('[data-action="new-question"]')) questionForm();
    if (event.target.closest('[data-action="back-quizzes"],[data-action="return-to-quizzes"]')) navigate('quizzes');
  });
  $('#page-body').addEventListener('click', async (event) => {
    const button = event.target.closest('[data-action]');
    if (!button) return;
    const { action, id } = button.dataset;
    if (action === 'edit-quiz') { try { const { data } = await api(`/quizzes/${id}`); quizForm(data.quiz); } catch (error) { notify(error.message, true); } }
    if (['publish-quiz', 'unpublish-quiz', 'delete-quiz'].includes(action)) mutateQuiz(action, id);
    if (action === 'manage-questions' || action === 'quiz-attempts') {
      try { const { data } = await api(`/quizzes/${id}`); state.quiz = data.quiz; navigate(action === 'manage-questions' ? 'questions' : 'attempts'); }
      catch (error) { notify(error.message, true); }
    }
    if (action === 'edit-question') { try { const { data } = await api(`/quizzes/${state.quiz._id}/questions/${id}`); questionForm(data.question); } catch (error) { notify(error.message, true); } }
    if (action === 'delete-question' && window.confirm('Delete this question?')) {
      try { await api(`/quizzes/${state.quiz._id}/questions/${id}`, { method: 'DELETE' }); notify('Question deleted.'); loadQuestions(); }
      catch (error) { notify(error.message, true); }
    }
    if (action === 'start-quiz') startQuiz(id);
    if (action === 'leaderboard') openLeaderboard(id, button.dataset.title || 'Quiz leaderboard');
    if (action === 'result-detail') openAttemptDetail(id);
    if (action === 'admin-attempt-detail') openAttemptDetail(id, true);
    if (action === 'previous-question') { state.attemptIndex = Math.max(0, state.attemptIndex - 1); saveAttempt(); renderAttempt(); }
    if (action === 'next-question') { state.attemptIndex = Math.min(state.attempt.questions.length - 1, state.attemptIndex + 1); saveAttempt(); renderAttempt(); }
    if (action === 'go-question') { state.attemptIndex = Number(button.dataset.index); saveAttempt(); renderAttempt(); }
    if (action === 'submit-attempt') submitAttempt(false);
  });
  $('#page-body').addEventListener('change', (event) => {
    if (event.target.name === 'answer' && state.attempt) {
      const question = state.attempt.questions[state.attemptIndex];
      state.answers[question._id] = event.target.value;
      saveAttempt(); renderAttempt();
    }
  });
  $('#page-body').addEventListener('input', (event) => { if (event.target.id === 'quiz-search') debounce(loadQuizzes); });
  $('#page-body').addEventListener('change', (event) => {
    if (event.target.id === 'status-filter' || event.target.id === 'category-filter') loadQuizzes();
  });
  $('#dialog-content').addEventListener('submit', submitDialog);
  $('#dialog-content').addEventListener('click', (event) => {
    if (event.target.closest('[data-close-dialog]')) closeDialog();
    if (event.target.closest('[data-action="add-option"]')) addOption();
    if (event.target.closest('[data-action="remove-option"]')) removeOption(event.target.closest('[data-action="remove-option"]'));
  });
  $('#dialog').addEventListener('click', (event) => { if (event.target === $('#dialog')) closeDialog(); });
}

async function restoreSession() {
  if (!state.token) { showAuth(); return; }
  try {
    const { data } = await api('/auth/me');
    state.user = data.user; setupApp();
    const saved = sessionStorage.getItem(ACTIVE_KEY);
    if (saved && state.user.role !== 'admin') {
      try { await resumeAttempt(JSON.parse(saved)); } catch { sessionStorage.removeItem(ACTIVE_KEY); }
    }
  } catch (error) {
    state.token = null; localStorage.removeItem(TOKEN_KEY);
    showAuth(error.status === 401 ? 'Your session expired. Please sign in again.' : error.message);
  }
}
function start() { bindEvents(); setAuthMode('login'); restoreSession(); }
start();
