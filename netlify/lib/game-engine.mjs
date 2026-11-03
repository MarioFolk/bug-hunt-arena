import QUESTION_BANK from './question-bank.cjs';

export const ROUND_MS = 20_000;
export const BETWEEN_MS = 4_500;
export const MAX_PLAYERS = 8;
export const MIN_PLAYERS = 2;
const MODES = ['BUG HUNT', 'LOGIC BATTLE', 'SPEED QUIZ'];

export function emptyState() {
  return { rooms: {}, players: {}, matches: [] };
}

function shuffle(items) {
  const result = [...items];
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}

export function createMatchQuestions() {
  const pools = Object.fromEntries(MODES.map(mode => [mode, shuffle(QUESTION_BANK.filter(q => q.mode === mode))]));
  for (const mode of MODES) {
    if (!pools[mode] || pools[mode].length < 2) throw new Error(`Not enough questions for ${mode}`);
  }
  return [
    pools['BUG HUNT'].pop(), pools['BUG HUNT'].pop(),
    pools['LOGIC BATTLE'].pop(), pools['LOGIC BATTLE'].pop(),
    pools['SPEED QUIZ'].pop(), pools['SPEED QUIZ'].pop()
  ];
}

function cleanQuestion(q) {
  if (!q) return null;
  const { correct, explain, ...visible } = q;
  return visible;
}

function publicRoom(room, playerId) {
  const q = room.questions[room.questionIndex];
  return {
    code: room.code,
    status: room.status,
    hostId: room.hostId,
    players: Object.values(room.players).map(p => ({ id: p.id, name: p.name, score: p.score, connected: p.connected })),
    round: room.round,
    totalRounds: room.questions.length,
    question: room.status === 'reveal' ? cleanQuestion(q) : cleanQuestion(q),
    deadline: room.deadline,
    answers: Object.keys(room.answers).length,
    myAnswered: Boolean(room.answers[playerId]),
    myResult: room.status === 'reveal' ? room.roundResults?.find(x => x.id === playerId) ?? null : null,
    roundResult: room.status === 'reveal' ? room.roundResult : null,
    final: room.status === 'finished' ? room.final : null
  };
}

function categorySummary(categoryStats) {
  return Object.entries(categoryStats || {}).map(([category, s]) => ({
    category, correct: s.correct, total: s.total,
    accuracy: s.total ? Math.round(100 * s.correct / s.total) : 0
  })).sort((a, b) => b.accuracy - a.accuracy || b.total - a.total);
}

function makeProfile(p) {
  return {
    display_name: p.display_name,
    matches_played: p.matches_played,
    wins: p.wins,
    total_score: p.total_score,
    total_correct: p.total_correct,
    total_answered: p.total_answered,
    accuracy: p.total_answered ? Math.round(100 * p.total_correct / p.total_answered) : 0,
    averageTime: p.total_answered ? Math.round(p.total_response_time_ms / p.total_answered / 100) / 10 : 0,
    categories: categorySummary(p.categoryStats),
    history: p.history.slice(0, 20)
  };
}

function recordMatch(state, room, now) {
  const scores = Object.values(room.players).sort((a, b) => b.score - a.score);
  const highest = scores[0]?.score ?? 0;
  const playedAt = new Date(now).toISOString();
  const match = { roomCode: room.code, playedAt, playerCount: scores.length };
  state.matches.unshift(match);
  state.matches = state.matches.slice(0, 200);
  for (const p of scores) {
    const profile = state.players[p.profileId] ?? {
      display_name: p.name, matches_played: 0, wins: 0, total_score: 0,
      total_correct: 0, total_answered: 0, total_response_time_ms: 0,
      categoryStats: {}, history: []
    };
    profile.display_name = p.name;
    profile.matches_played++;
    profile.wins += p.score === highest ? 1 : 0;
    profile.total_score += p.score;
    profile.total_correct += p.correctAnswers;
    profile.total_answered += p.answeredCount;
    profile.total_response_time_ms += p.responseTimeMs;
    for (const [category, stats] of Object.entries(p.categoryStats)) {
      profile.categoryStats[category] ??= { correct: 0, total: 0 };
      profile.categoryStats[category].correct += stats.correct;
      profile.categoryStats[category].total += stats.total;
    }
    const placement = p.score === highest ? 1 : 1 + scores.filter(other => other.score > p.score).length;
    profile.history.unshift({ played_at: playedAt, score: p.score, placement, correct_answers: p.correctAnswers, answered_count: p.answeredCount });
    profile.history = profile.history.slice(0, 20);
    state.players[p.profileId] = profile;
  }
  room.final = {
    leaderboard: scores.map(p => ({ id: p.id, name: p.name, score: p.score })),
    winners: scores.filter(p => p.score === highest).map(p => p.name),
    stats: scores.map(p => {
      const cats = Object.entries(p.categoryStats).filter(([, s]) => s.total > 0)
        .sort((a, b) => b[1].correct / b[1].total - a[1].correct / a[1].total || b[1].total - a[1].total);
      return {
        id: p.id, correctAnswers: p.correctAnswers, answeredCount: p.answeredCount,
        accuracy: p.answeredCount ? Math.round(p.correctAnswers / p.answeredCount * 100) : 0,
        averageTime: p.answeredCount ? Math.round(p.responseTimeMs / p.answeredCount / 100) / 10 : 0,
        bestCategory: cats[0] ? `${cats[0][0]} (${Math.round(cats[0][1].correct / cats[0][1].total * 100)}%)` : '—'
      };
    })
  };
  room.savedToDatabase = true;
}

function finishRound(room, now) {
  if (room.status !== 'question') return false;
  const q = room.questions[room.questionIndex];
  const results = Object.values(room.players).map(p => {
    const answer = room.answers[p.id];
    const correct = Boolean(answer && answer.choice === q.correct);
    const bonus = correct ? Math.round(50 * Math.max(0, answer.remaining) / ROUND_MS) : 0;
    const earned = correct ? 100 + bonus : 0;
    p.score += earned;
    if (answer) {
      p.answeredCount++;
      p.responseTimeMs += ROUND_MS - answer.remaining;
    }
    if (correct) p.correctAnswers++;
    const category = q.category || 'GENERAL';
    if (answer) {
      p.categoryStats[category] ??= { correct: 0, total: 0 };
      p.categoryStats[category].total++;
      if (correct) p.categoryStats[category].correct++;
    }
    return { id: p.id, name: p.name, correct, earned, score: p.score, choice: answer ? answer.choice : null };
  });
  room.roundResults = results;
  room.roundResult = {
    correct: q.correct, explain: q.explain,
    results: [...results].sort((a, b) => b.earned - a.earned || b.score - a.score)
  };
  room.status = 'reveal';
  room.revealUntil = now + BETWEEN_MS;
  return true;
}

function startNextRound(state, room, now) {
  if (room.round >= room.questions.length) {
    room.status = 'finished';
    room.finishedAt = now;
    recordMatch(state, room, now);
    return;
  }
  room.round++;
  room.questionIndex = room.round - 1;
  room.answers = {};
  room.status = 'question';
  room.deadline = now + ROUND_MS;
  room.revealUntil = null;
  room.roundResults = null;
  room.roundResult = null;
}

function advanceDue(state, room, now) {
  if (room.status === 'question' && now >= room.deadline) return finishRound(room, now);
  if (room.status === 'reveal' && now >= room.revealUntil) {
    startNextRound(state, room, now);
    return true;
  }
  return false;
}

function validProfileId(id) {
  return typeof id === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(id);
}
function makePlayer(id, profileId, name) {
  return { id, profileId, name, score: 0, correctAnswers: 0, answeredCount: 0, responseTimeMs: 0, categoryStats: {}, connected: true };
}
function roomCode(state) {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let value;
  do { value = Array.from({ length: 6 }, () => chars[Math.floor(Math.random() * chars.length)]).join(''); }
  while (state.rooms[value]);
  return value;
}
function responseError(error) { return { error }; }

export function applyAction(state, body, now = Date.now(), makeId = () => cryptoRandomId()) {
  if (!body || typeof body !== 'object' || Array.isArray(body)) return { result: responseError('Invalid request.'), changed: false };
  const action = body.action;
  if (action === 'leaderboard') {
    const players = Object.values(state.players).map(p => ({
      display_name: p.display_name, matches_played: p.matches_played, wins: p.wins,
      total_score: p.total_score, total_correct: p.total_correct, total_answered: p.total_answered,
      accuracy: p.total_answered ? Math.round(100 * p.total_correct / p.total_answered) : 0
    })).sort((a, b) => b.wins - a.wins || b.total_score - a.total_score).slice(0, 20);
    return { result: { players }, changed: false };
  }
  if (action === 'profile') {
    if (!validProfileId(body.profileId)) return { result: responseError('Invalid player profile.'), changed: false };
    const p = state.players[body.profileId];
    return { result: p ? { profile: makeProfile(p) } : responseError('No match history found for this profile yet.'), changed: false };
  }
  if (action === 'create') {
    if (!validProfileId(body.profileId)) return { result: responseError('Invalid player profile. Refresh the page and try again.'), changed: false };
    const name = String(body.name ?? '').trim().slice(0, 18);
    if (!name) return { result: responseError('Enter a player name.'), changed: false };
    for (const [oldCode, oldRoom] of Object.entries(state.rooms)) {
      const age = now - (oldRoom.createdAt || now);
      const finishedAge = now - (oldRoom.finishedAt || now);
      if (age > 12 * 60 * 60 * 1000 || (oldRoom.status === 'finished' && finishedAge > 60 * 60 * 1000)) {
        delete state.rooms[oldCode];
      }
    }
    const code = roomCode(state);
    const playerId = makeId();
    const room = { code, hostId: playerId, players: { [playerId]: makePlayer(playerId, body.profileId, name) }, status: 'lobby', round: 0, questionIndex: -1, questions: [], answers: {}, deadline: null, revealUntil: null, roundResults: null, roundResult: null, final: null, savedToDatabase: false, createdAt: now };
    state.rooms[code] = room;
    return { result: { room: publicRoom(room, playerId), playerId }, changed: true };
  }
  if (action === 'join') {
    if (!validProfileId(body.profileId)) return { result: responseError('Invalid player profile. Refresh the page and try again.'), changed: false };
    const code = String(body.code ?? '').trim().toUpperCase();
    const room = state.rooms[code];
    const name = String(body.name ?? '').trim().slice(0, 18);
    if (!name) return { result: responseError('Enter a player name.'), changed: false };
    if (!room || room.status !== 'lobby') return { result: responseError('Room not found or the game has already started.'), changed: false };
    if (Object.keys(room.players).length >= MAX_PLAYERS) return { result: responseError('This room is full (8 players maximum).'), changed: false };
    const playerId = makeId();
    room.players[playerId] = makePlayer(playerId, body.profileId, name);
    return { result: { room: publicRoom(room, playerId), playerId }, changed: true };
  }
  if (action === 'poll' || action === 'start' || action === 'answer' || action === 'leave') {
    const code = String(body.code ?? '').trim().toUpperCase();
    const room = state.rooms[code];
    if (!room) return { result: responseError('Room not found. The match may have expired.'), changed: false };
    const playerId = String(body.playerId ?? '');
    const player = room.players[playerId];
    if (!player) return { result: responseError('You are no longer in this room. Return home and join again.'), changed: false };
    let changed = advanceDue(state, room, now);
    if (action === 'start') {
      if (room.hostId !== playerId) return { result: responseError('Only the host can start the game.'), changed };
      if (room.status !== 'lobby') return { result: responseError('The game has already started.'), changed };
      if (Object.keys(room.players).length < MIN_PLAYERS) return { result: responseError('At least 2 players are required.'), changed };
      room.questions = createMatchQuestions();
      startNextRound(state, room, now);
      changed = true;
    } else if (action === 'answer') {
      if (room.status !== 'question') return { result: responseError('There is no active question.'), changed };
      if (room.answers[playerId]) return { result: responseError('Your answer has already been locked.'), changed };
      const choice = body.choice;
      if (!Number.isInteger(choice) || choice < 0 || choice > 3) return { result: responseError('Invalid answer.'), changed };
      room.answers[playerId] = { choice, remaining: Math.max(0, room.deadline - now) };
      changed = true;
      if (Object.keys(room.answers).length === Object.keys(room.players).length) changed = finishRound(room, now) || changed;
    } else if (action === 'leave') {
      delete room.players[playerId];
      delete room.answers[playerId];
      if (room.hostId === playerId) room.hostId = Object.keys(room.players)[0] ?? null;
      if (!Object.keys(room.players).length) delete state.rooms[code];
      else if (room.status === 'question' && Object.keys(room.answers).length === Object.keys(room.players).length) finishRound(room, now);
      return { result: { ok: true }, changed: true };
    }
    const currentRoom = state.rooms[code];
    if (!currentRoom) return { result: { ok: true }, changed: true };
    return { result: { room: publicRoom(currentRoom, playerId) }, changed };
  }
  return { result: responseError('Unknown action.'), changed: false };
}

function cryptoRandomId() {
  // UUID v4 generation using Web Crypto, available in Netlify's Node runtime.
  return globalThis.crypto.randomUUID();
}
