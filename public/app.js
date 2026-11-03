function getProfileId() {
  let id = localStorage.getItem('bha-profile-id');
  if (!id) {
    id = crypto.randomUUID();
    localStorage.setItem('bha-profile-id', id);
  }
  return id;
}
const profileId = getProfileId();
const $ = id => document.getElementById(id);
let myId = sessionStorage.getItem('bha-player-id');
let room = null;
let roomCode = sessionStorage.getItem('bha-room-code');
let myChoice = null;
let timerInterval = null;
let pollInterval = null;
let latestRound = 0;
let latestView = '';
let pollBusy = false;
const views = ['home', 'profile', 'leaderboard', 'lobby', 'game', 'reveal', 'finished'];

function show(id) {
  views.forEach(view => $(view).classList.toggle('active', view === id));
  window.scrollTo(0, 0);
}
function toast(message) {
  $('toast').textContent = message;
  $('toast').classList.add('show');
  setTimeout(() => $('toast').classList.remove('show'), 2200);
}
function err(id, message) { $(id).textContent = message || ''; }
function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}
async function api(action, payload = {}) {
  const response = await fetch('/.netlify/functions/game', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ action, ...payload })
  });
  let data;
  try { data = await response.json(); }
  catch { throw new Error('Server returned an invalid response.'); }
  if (!response.ok && !data?.error) throw new Error('Request failed.');
  return data;
}
function currentPlayer() { return room?.players.find(player => player.id === myId); }
function saveSession(code, playerId) {
  roomCode = code;
  myId = playerId;
  sessionStorage.setItem('bha-room-code', code);
  sessionStorage.setItem('bha-player-id', playerId);
  startPolling();
}
function clearSession() {
  roomCode = null;
  myId = null;
  room = null;
  sessionStorage.removeItem('bha-room-code');
  sessionStorage.removeItem('bha-player-id');
  stopPolling();
}
function stopPolling() { if (pollInterval) clearInterval(pollInterval); pollInterval = null; }
function startPolling() {
  stopPolling();
  pollRoom();
  pollInterval = setInterval(pollRoom, 900);
}
async function pollRoom() {
  if (!roomCode || !myId || pollBusy) return;
  pollBusy = true;
  try {
    const data = await api('poll', { code: roomCode, playerId: myId });
    if (data.error) {
      stopPolling();
      toast(data.error);
      clearSession();
      show('home');
      return;
    }
    if (data.room) applyRoom(data.room);
  } catch (error) {
    console.warn(error);
  } finally {
    pollBusy = false;
  }
}
function applyRoom(nextRoom) {
  room = nextRoom;
  $('room-code-display').textContent = room.code;
  renderPlayers();
  if (room.status === 'lobby') {
    if (latestView !== 'lobby') show('lobby');
    latestView = 'lobby';
  } else if (room.status === 'question') {
    const changedRound = latestRound !== room.round || latestView !== 'game';
    latestView = 'game';
    if (changedRound) { renderQuestion(room); show('game'); }
    else renderPlayers();
  } else if (room.status === 'reveal') {
    const changedRound = latestRound !== room.round || latestView !== 'reveal';
    latestView = 'reveal';
    if (changedRound) { renderReveal(room); show('reveal'); }
  } else if (room.status === 'finished') {
    if (latestView !== 'finished') renderFinished(room);
    latestView = 'finished';
    show('finished');
    stopPolling();
  }
}
function renderPlayers() {
  if (!room) return;
  $('player-count').textContent = `${room.players.length}/8`;
  $('player-list').innerHTML = room.players.map(player => `<div class="player-item"><span class="player-avatar">${escapeHtml(player.name.slice(0, 1).toUpperCase())}</span><span>${escapeHtml(player.name)}</span>${player.id === room.hostId ? '<span class="host-tag">HOST</span>' : ''}</div>`).join('');
  $('game-players').innerHTML = room.players.map(player => `<span class="game-player ${player.id === myId && myChoice !== null ? 'done' : ''}">${escapeHtml(player.name)} · ${player.score}</span>`).join('');
  $('my-score').textContent = currentPlayer()?.score ?? 0;
  $('answered-count').textContent = `${room.answers} / ${room.players.length} ANSWERED`;
}
function renderQuestion(data) {
  latestRound = data.round;
  myChoice = data.myAnswered ? -1 : null;
  const q = data.question;
  $('round-label').textContent = `ROUND ${String(data.round).padStart(2, '0')} / ${String(data.totalRounds).padStart(2, '0')}`;
  $('mode-label').textContent = q.mode;
  $('category').textContent = q.category || 'GENERAL';
  $('difficulty').textContent = q.level;
  $('question-text').textContent = q.prompt;
  $('question-code').textContent = q.code || '';
  $('answer-status').textContent = data.myAnswered ? 'ANSWER LOCKED · WAITING FOR THE ARENA' : 'SELECT YOUR ANSWER TO LOCK IT IN';
  $('options').innerHTML = q.options.map((option, index) => `<button class="option-btn" data-choice="${index}"><span class="option-key">${'ABCD'[index]}</span><span>${escapeHtml(option)}</span></button>`).join('');
  $('options').querySelectorAll('button').forEach(button => {
    if (data.myAnswered) button.disabled = true;
    button.addEventListener('click', () => submitAnswer(Number(button.dataset.choice)));
  });
  startTimer(data.deadline);
  renderPlayers();
}
function startTimer(deadline) {
  clearInterval(timerInterval);
  const tick = () => {
    const left = Math.max(0, deadline - Date.now());
    $('timer').textContent = (left / 1000).toFixed(1);
    $('progress').style.width = `${left / 20000 * 100}%`;
    $('timer').style.color = left <= 5000 ? 'var(--red)' : 'var(--lime)';
    if (left <= 0) clearInterval(timerInterval);
  };
  tick();
  timerInterval = setInterval(tick, 100);
}
async function submitAnswer(choice) {
  if (myChoice !== null || !room) return;
  myChoice = choice;
  $('options').querySelectorAll('button').forEach((button, index) => {
    button.disabled = true;
    if (index === choice) button.classList.add('selected');
  });
  $('answer-status').textContent = 'ANSWER LOCKED · WAITING FOR THE ARENA';
  try {
    const data = await api('answer', { code: roomCode, playerId: myId, choice });
    if (data.error) $('answer-status').textContent = data.error;
    else if (data.room) applyRoom(data.room);
  } catch (error) { $('answer-status').textContent = error.message; }
}
function renderReveal(data) {
  clearInterval(timerInterval);
  const result = data.roundResult;
  const mine = data.myResult;
  const q = data.question;
  $('reveal-title').textContent = mine?.correct ? 'NICE WORK.' : 'ROUND COMPLETE.';
  $('your-answer').textContent = mine?.choice === null || mine?.choice === undefined ? 'No answer' : `${'ABCD'[mine.choice]} — ${q.options[mine.choice]}`;
  $('correct-answer').textContent = `${'ABCD'[result.correct]} — ${q.options[result.correct]}`;
  $('earned-points').textContent = `+${mine?.earned ?? 0} PTS`;
  $('explanation').textContent = result.explain;
  $('round-results').innerHTML = result.results.map((player, index) => `<div class="result-row"><span class="result-rank">${String(index + 1).padStart(2, '0')}</span><b>${escapeHtml(player.name)}</b><span class="result-status ${player.correct ? 'good' : ''}">${player.correct ? 'CORRECT' : 'NO POINTS'}</span><span class="result-points">+${player.earned}</span></div>`).join('');
}
function renderFinished(data) {
  clearInterval(timerInterval);
  const final = data.final;
  $('winner-title').innerHTML = final.winners.length > 1 ? 'SHARED <span>VICTORY!</span>' : `${escapeHtml(final.winners[0] || 'NO ONE')}<span> WINS!</span>`;
  $('winner-subtitle').textContent = final.winners.length > 1 ? 'A shared victory. Equal score, equal glory.' : `${final.winners[0]} is the Bug Hunter Champion.`;
  $('final-results').innerHTML = final.leaderboard.map((player, index) => `<div class="final-row"><span class="final-rank">${['①', '②', '③'][index] || String(index + 1).padStart(2, '0')}</span><span class="final-name">${escapeHtml(player.name)} ${player.id === myId ? '(YOU)' : ''}</span><span class="final-score">${player.score} PTS</span></div>`).join('');
  const stats = final.stats.find(player => player.id === myId);
  $('personal-stats').innerHTML = stats ? `<div class="stats-heading">YOUR MATCH STATISTICS</div><div class="stats-grid"><div class="stat-item"><strong>${stats.correctAnswers}/${stats.answeredCount}</strong><span>CORRECT ANSWERS</span></div><div class="stat-item"><strong>${stats.accuracy}%</strong><span>ACCURACY</span></div><div class="stat-item"><strong>${stats.averageTime}s</strong><span>AVG. RESPONSE TIME</span></div><div class="stat-item"><strong>${escapeHtml(stats.bestCategory)}</strong><span>BEST CATEGORY</span></div></div>` : '';
}
function dateFormat(value) {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? '—' : date.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
}
function renderProfile(p) {
  const history = p.history || [];
  const categories = p.categories || [];
  $('profile-content').innerHTML = `<div class="panel profile-panel"><div class="panel-kicker">PLAYER</div><h2>${escapeHtml(p.display_name)}</h2><div class="stats-grid profile-stats"><div class="stat-item"><strong>${p.matches_played}</strong><span>MATCHES PLAYED</span></div><div class="stat-item"><strong>${p.wins}</strong><span>WINS</span></div><div class="stat-item"><strong>${p.total_score}</strong><span>TOTAL SCORE</span></div><div class="stat-item"><strong>${p.accuracy}%</strong><span>ACCURACY</span></div><div class="stat-item"><strong>${p.total_correct}/${p.total_answered}</strong><span>CORRECT ANSWERS</span></div><div class="stat-item"><strong>${p.averageTime}s</strong><span>AVG. RESPONSE TIME</span></div></div></div><div class="panel profile-panel"><div class="panel-kicker">SKILL BREAKDOWN</div><h2>Category statistics</h2>${categories.length ? categories.map(category => `<div class="profile-category"><div><b>${escapeHtml(category.category)}</b><span>${category.correct}/${category.total} · ${category.accuracy}%</span></div><div class="profile-bar"><span style="width:${Math.max(0, Math.min(100, Number(category.accuracy) || 0))}%"></span></div></div>`).join('') : '<p class="profile-empty">No category statistics yet.</p>'}</div><div class="panel profile-panel"><div class="panel-kicker">RECENT ACTIVITY</div><h2>Match history</h2>${history.length ? `<div class="profile-history">${history.map(match => `<div class="profile-history-row"><span>${dateFormat(match.played_at)}</span><b>${match.score} PTS</b><span>${match.correct_answers}/${match.answered_count} correct</span><strong>${match.placement === 1 ? '1st' : `#${match.placement}`}</strong></div>`).join('')}</div>` : '<p class="profile-empty">No matches played yet.</p>'}</div>`;
}
function renderLeaderboard(players) {
  $('leaderboard-content').innerHTML = players.length ? `<div class="panel profile-panel"><div class="panel-kicker">HALL OF FAME</div><div class="leaderboard-table"><div class="leaderboard-row leaderboard-header"><span>RANK</span><span>PLAYER</span><span>SCORE</span><span>MATCHES</span><span>WINS</span><span>ACCURACY</span></div>${players.map((player, index) => `<div class="leaderboard-row"><span class="leaderboard-rank">${index + 1}</span><b class="leaderboard-name">${escapeHtml(player.display_name)}</b><strong>${player.total_score}</strong><span>${player.matches_played}</span><span>${player.wins}</span><span>${player.accuracy}%</span></div>`).join('')}</div></div>` : '<div class="panel profile-panel profile-empty">No players in the leaderboard yet. Play a match to get started!</div>';
}

$('create-form').addEventListener('submit', async event => {
  event.preventDefault(); err('home-error', '');
  try {
    const data = await api('create', { name: $('create-name').value, profileId });
    if (data.error) return err('home-error', data.error);
    saveSession(data.room.code, data.playerId); applyRoom(data.room);
  } catch (error) { err('home-error', error.message); }
});
$('join-form').addEventListener('submit', async event => {
  event.preventDefault(); err('home-error', '');
  try {
    const data = await api('join', { name: $('join-name').value, code: $('room-code').value, profileId });
    if (data.error) return err('home-error', data.error);
    saveSession(data.room.code, data.playerId); applyRoom(data.room);
  } catch (error) { err('home-error', error.message); }
});
$('room-code').addEventListener('input', event => { event.target.value = event.target.value.toUpperCase().replace(/[^A-Z0-9]/g, ''); });
$('copy-code').addEventListener('click', async () => {
  if (!room) return;
  try { await navigator.clipboard.writeText(room.code); toast('Room code copied.'); }
  catch { toast(`Room code: ${room.code}`); }
});
$('start-game').addEventListener('click', async () => {
  err('lobby-error', '');
  try {
    const data = await api('start', { code: roomCode, playerId: myId });
    if (data.error) return err('lobby-error', data.error);
    if (data.room) applyRoom(data.room);
  } catch (error) { err('lobby-error', error.message); }
});
$('leave-room').addEventListener('click', async () => {
  try { await api('leave', { code: roomCode, playerId: myId }); } catch (error) { console.warn(error); }
  clearSession(); latestRound = 0; latestView = ''; myChoice = null; show('home');
});
$('play-again').addEventListener('click', () => { clearSession(); latestRound = 0; latestView = ''; myChoice = null; show('home'); });
$('open-profile').addEventListener('click', async () => {
  show('profile'); $('profile-content').innerHTML = '<div class="panel profile-panel">Loading player profile...</div>';
  try { const data = await api('profile', { profileId }); if (data.error) $('profile-content').innerHTML = `<div class="panel profile-panel profile-empty">${escapeHtml(data.error)}</div>`; else renderProfile(data.profile); }
  catch (error) { $('profile-content').innerHTML = `<div class="panel profile-panel profile-empty">${escapeHtml(error.message)}</div>`; }
});
$('profile-back').addEventListener('click', () => show('home'));
$('open-leaderboard').addEventListener('click', async () => {
  show('leaderboard'); $('leaderboard-content').innerHTML = '<div class="panel profile-panel">Loading leaderboard...</div>';
  try { const data = await api('leaderboard'); renderLeaderboard(data.players || []); }
  catch (error) { $('leaderboard-content').innerHTML = `<div class="panel profile-panel profile-empty">${escapeHtml(error.message)}</div>`; }
});
$('leaderboard-back').addEventListener('click', () => show('home'));

if (roomCode && myId) startPolling();
