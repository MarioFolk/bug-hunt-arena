import test from 'node:test';
import assert from 'node:assert/strict';
import { applyAction, emptyState, ROUND_MS, BETWEEN_MS } from '../netlify/lib/game-engine.mjs';

const idA = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const idB = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
const profileA = '11111111-1111-4111-8111-111111111111';
const profileB = '22222222-2222-4222-8222-222222222222';
let generated = 0;
const makeId = () => `player-${++generated}`;
function act(state, body, now) { return applyAction(state, body, now, makeId); }

test('two players can complete a full six-round match and get a winner', () => {
  const state = emptyState();
  let now = 1_800_000_000_000;
  const created = act(state, { action: 'create', name: 'Alpha', profileId: profileA }, now).result;
  assert.ok(created.room.code);
  const code = created.room.code;
  const playerA = created.playerId;
  const joined = act(state, { action: 'join', name: 'Beta', profileId: profileB, code }, now).result;
  assert.equal(joined.room.players.length, 2);
  const playerB = joined.playerId;

  let started = act(state, { action: 'start', code, playerId: playerA }, now).result;
  assert.equal(started.room.status, 'question');
  assert.equal(started.room.round, 1);

  for (let round = 1; round <= 6; round++) {
    const internalQuestion = state.rooms[code].questions[state.rooms[code].questionIndex];
    assert.equal(internalQuestion.options.length, 4);
    // The answer key must not be present in the live question sent to clients.
    const live = act(state, { action: 'poll', code, playerId: playerA }, now).result.room;
    assert.equal(Object.hasOwn(live.question, 'correct'), false);
    const answerA = act(state, { action: 'answer', code, playerId: playerA, choice: internalQuestion.correct }, now).result;
    assert.equal(answerA.room.answers, 1);
    const answerB = act(state, { action: 'answer', code, playerId: playerB, choice: internalQuestion.correct }, now).result;
    assert.equal(answerB.room.status, 'reveal');
    assert.equal(answerB.room.roundResult.correct, internalQuestion.correct);
    assert.equal(answerB.room.myResult.correct, true);
    assert.equal(answerB.room.myResult.earned, 150);
    now += BETWEEN_MS + 1;
    const advanced = act(state, { action: 'poll', code, playerId: playerA }, now).result.room;
    if (round < 6) {
      assert.equal(advanced.status, 'question');
      assert.equal(advanced.round, round + 1);
    } else {
      assert.equal(advanced.status, 'finished');
      assert.equal(advanced.final.leaderboard.length, 2);
      assert.deepEqual(advanced.final.winners.sort(), ['Alpha', 'Beta']);
      assert.equal(state.players[profileA].matches_played, 1);
      assert.equal(state.players[profileB].matches_played, 1);
      assert.equal(state.players[profileA].total_answered, 6);
      assert.equal(state.players[profileA].total_correct, 6);
    }
  }
});

test('host-only start, one answer per player, and invalid choices are rejected', () => {
  const state = emptyState();
  const created = act(state, { action: 'create', name: 'Alpha', profileId: profileA }, 1000).result;
  const code = created.room.code;
  const host = created.playerId;
  const guest = act(state, { action: 'join', name: 'Beta', profileId: profileB, code }, 1000).result.playerId;
  assert.match(act(state, { action: 'start', code, playerId: guest }, 1000).result.error, /Only the host/);
  assert.equal(act(state, { action: 'start', code, playerId: host }, 1000).result.room.status, 'question');
  assert.equal(act(state, { action: 'answer', code, playerId: host, choice: 8 }, 1100).result.error, 'Invalid answer.');
  const correct = state.rooms[code].questions[0].correct;
  assert.equal(act(state, { action: 'answer', code, playerId: host, choice: correct }, 1200).result.room.answers, 1);
  assert.equal(act(state, { action: 'answer', code, playerId: host, choice: correct }, 1300).result.error, 'Your answer has already been locked.');
});

test('profile and leaderboard are generated from persisted match stats', () => {
  const state = emptyState();
  const created = act(state, { action: 'create', name: 'Alpha', profileId: profileA }, 1000).result;
  const code = created.room.code;
  const host = created.playerId;
  const guest = act(state, { action: 'join', name: 'Beta', profileId: profileB, code }, 1000).result.playerId;
  act(state, { action: 'start', code, playerId: host }, 1000);
  for (let round = 0; round < 6; round++) {
    const q = state.rooms[code].questions[state.rooms[code].questionIndex];
    act(state, { action: 'answer', code, playerId: host, choice: q.correct }, 1100 + round * 10);
    act(state, { action: 'answer', code, playerId: guest, choice: (q.correct + 1) % 4 }, 1200 + round * 10);
    const now = 1200 + round * 10 + BETWEEN_MS + 1;
    act(state, { action: 'poll', code, playerId: host }, now);
  }
  const profile = act(state, { action: 'profile', profileId: profileA }, 10_000).result.profile;
  assert.equal(profile.matches_played, 1);
  assert.equal(profile.total_answered, 6);
  assert.equal(profile.total_correct, 6);
  assert.equal(profile.history.length, 1);
  const leaderboard = act(state, { action: 'leaderboard' }, 10_000).result.players;
  assert.equal(leaderboard[0].display_name, 'Alpha');
  assert.equal(leaderboard[0].wins, 1);
});

test('three-round two-player acceptance smoke test reaches the final winner screen', () => {
  const state = emptyState();
  let now = 1_800_100_000_000;
  const created = act(state, { action: 'create', name: 'Host', profileId: profileA }, now).result;
  const code = created.room.code;
  const host = created.playerId;
  const guest = act(state, { action: 'join', name: 'Guest', profileId: profileB, code }, now).result.playerId;
  act(state, { action: 'start', code, playerId: host }, now);
  // Use three of the real curated questions for the requested shorter acceptance run.
  state.rooms[code].questions = state.rooms[code].questions.slice(0, 3);
  for (let round = 0; round < 3; round++) {
    const q = state.rooms[code].questions[state.rooms[code].questionIndex];
    act(state, { action: 'answer', code, playerId: host, choice: q.correct }, now + 100);
    const reveal = act(state, { action: 'answer', code, playerId: guest, choice: q.correct }, now + 100).result.room;
    assert.equal(reveal.status, 'reveal');
    now += 100 + BETWEEN_MS + 1;
    const next = act(state, { action: 'poll', code, playerId: host }, now).result.room;
    if (round < 2) assert.equal(next.status, 'question');
    else {
      assert.equal(next.status, 'finished');
      assert.equal(next.final.leaderboard.length, 2);
      assert.equal(next.final.winners.length, 2);
      assert.equal(state.players[profileA].matches_played, 1);
      assert.equal(state.players[profileB].matches_played, 1);
    }
  }
});
