const Database = require("better-sqlite3");
const fs = require("fs");
const path = require("path");

const dataDir = path.join(__dirname, "data");
fs.mkdirSync(dataDir, { recursive: true });

const db = new Database(path.join(dataDir, "bug-hunt-arena.db"));

db.pragma("journal_mode = WAL");
db.pragma("foreign_keys = ON");

db.exec(`
  CREATE TABLE IF NOT EXISTS players (
    player_id TEXT PRIMARY KEY,
    display_name TEXT NOT NULL,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    matches_played INTEGER NOT NULL DEFAULT 0,
    wins INTEGER NOT NULL DEFAULT 0,
    total_score INTEGER NOT NULL DEFAULT 0,
    total_correct INTEGER NOT NULL DEFAULT 0,
    total_answered INTEGER NOT NULL DEFAULT 0,
    total_response_time_ms INTEGER NOT NULL DEFAULT 0
  );

  CREATE TABLE IF NOT EXISTS matches (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    room_code TEXT NOT NULL,
    played_at TEXT NOT NULL,
    player_count INTEGER NOT NULL
  );

  CREATE TABLE IF NOT EXISTS match_players (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    match_id INTEGER NOT NULL,
    player_id TEXT NOT NULL,
    player_name TEXT NOT NULL,
    score INTEGER NOT NULL,
    correct_answers INTEGER NOT NULL,
    answered_count INTEGER NOT NULL,
    response_time_ms INTEGER NOT NULL,
    placement INTEGER NOT NULL,
    FOREIGN KEY (match_id) REFERENCES matches(id),
    FOREIGN KEY (player_id) REFERENCES players(player_id)
  );

  CREATE TABLE IF NOT EXISTS player_categories (
    player_id TEXT NOT NULL,
    category TEXT NOT NULL,
    correct INTEGER NOT NULL DEFAULT 0,
    total INTEGER NOT NULL DEFAULT 0,
    PRIMARY KEY (player_id, category),
    FOREIGN KEY (player_id) REFERENCES players(player_id)
  );

  CREATE INDEX IF NOT EXISTS idx_match_players_player
  ON match_players(player_id);
`);

const upsertPlayer = db.prepare(`
  INSERT INTO players (player_id, display_name, created_at, updated_at)
  VALUES (@playerId, @name, @now, @now)
  ON CONFLICT(player_id) DO UPDATE SET
    display_name = excluded.display_name,
    updated_at = excluded.updated_at
`);

const insertMatch = db.prepare(`
  INSERT INTO matches (room_code, played_at, player_count)
  VALUES (?, ?, ?)
`);

const insertMatchPlayer = db.prepare(`
  INSERT INTO match_players
  (match_id, player_id, player_name, score, correct_answers,
   answered_count, response_time_ms, placement)
  VALUES (@matchId, @playerId, @name, @score, @correctAnswers,
          @answeredCount, @responseTimeMs, @placement)
`);

const updateStats = db.prepare(`
  UPDATE players SET
    matches_played = matches_played + 1,
    wins = wins + @win,
    total_score = total_score + @score,
    total_correct = total_correct + @correct,
    total_answered = total_answered + @answered,
    total_response_time_ms = total_response_time_ms + @time,
    updated_at = @now
  WHERE player_id = @playerId
`);

const updateCategory = db.prepare(`
  INSERT INTO player_categories (player_id, category, correct, total)
  VALUES (@playerId, @category, @correct, @total)
  ON CONFLICT(player_id, category) DO UPDATE SET
    correct = correct + excluded.correct,
    total = total + excluded.total
`);

const saveMatchTransaction = db.transaction((roomCode, players) => {
  const now = new Date().toISOString();

  const match = insertMatch.run(roomCode, now, players.length);
  const matchId = match.lastInsertRowid;
  const highestScore = Math.max(...players.map(p => p.score));

  for (const p of players) {
    upsertPlayer.run({
      playerId: p.profileId,
      name: p.name,
      now
    });

    const placement = p.score === highestScore
      ? 1
      : 1 + players.filter(other => other.score > p.score).length;

    insertMatchPlayer.run({
      matchId,
      playerId: p.profileId,
      name: p.name,
      score: p.score,
      correctAnswers: p.correctAnswers,
      answeredCount: p.answeredCount,
      responseTimeMs: p.responseTimeMs,
      placement
    });

    updateStats.run({
      playerId: p.profileId,
      win: p.score === highestScore ? 1 : 0,
      score: p.score,
      correct: p.correctAnswers,
      answered: p.answeredCount,
      time: p.responseTimeMs,
      now
    });

    for (const [category, stats] of Object.entries(p.categoryStats || {})) {
      updateCategory.run({
        playerId: p.profileId,
        category,
        correct: stats.correct,
        total: stats.total
      });
    }
  }

  return matchId;
});

function saveMatch(roomCode, players) {
  if (!Array.isArray(players) || players.length < 1) {
    throw new Error("Cannot save an empty match.");
  }
  for (const p of players) {
    if (!p.profileId || !p.name) {
      throw new Error("A player is missing profile ID or name.");
    }
  }
  return saveMatchTransaction(roomCode, players);
}

function getProfile(playerId) {
  const player = db.prepare(`
    SELECT * FROM players WHERE player_id = ?
  `).get(playerId);

  if (!player) return null;

  const categories = db.prepare(`
    SELECT category, correct, total,
      ROUND(100.0 * correct / NULLIF(total, 0)) AS accuracy
    FROM player_categories
    WHERE player_id = ?
    ORDER BY accuracy DESC, total DESC
  `).all(playerId);

  const history = db.prepare(`
    SELECT m.played_at, mp.score, mp.placement,
      mp.correct_answers, mp.answered_count
    FROM match_players mp
    JOIN matches m ON m.id = mp.match_id
    WHERE mp.player_id = ?
    ORDER BY m.id DESC
    LIMIT 20
  `).all(playerId);

  return {
    ...player,
    accuracy: player.total_answered
      ? Math.round(100 * player.total_correct / player.total_answered)
      : 0,
    averageTime: player.total_answered
      ? Math.round(player.total_response_time_ms / player.total_answered / 100) / 10
      : 0,
    categories,
    history
  };
}

function getLeaderboard(limit = 20) {
  return db.prepare(`
    SELECT player_id, display_name, matches_played, wins,
      total_score, total_correct, total_answered,
      CASE WHEN total_answered > 0
        THEN ROUND(100.0 * total_correct / total_answered)
        ELSE 0 END AS accuracy
    FROM players
    ORDER BY wins DESC, total_score DESC
    LIMIT ?
  `).all(limit);
}

module.exports = { db, saveMatch, getProfile, getLeaderboard };
