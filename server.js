const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const crypto = require("crypto");
const path = require("path");
const QUESTION_BANK = require("./question-bank");
const database = require("./database");

const app = express();
const server = http.createServer(app);
const io = new Server(server);
const PORT = process.env.PORT || 3000;
app.use(express.static(path.join(__dirname, "public")));

const rooms = new Map();
const ROUND_MS = 20000;
const BETWEEN_MS = 4500;
const MAX_PLAYERS = 8;
const MIN_PLAYERS = 2;




function shuffle(items) {
  const result = [...items];
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}

function createMatchQuestions() {
  const modes = [
    "BUG HUNT", "BUG HUNT",
    "LOGIC BATTLE", "LOGIC BATTLE",
    "SPEED QUIZ", "SPEED QUIZ"
  ];

  const pools = {};
  for (const mode of new Set(modes)) {
    pools[mode] = shuffle(QUESTION_BANK.filter(q => q.mode === mode));
    if (pools[mode].length < 2) {
      throw new Error("Not enough questions for mode: " + mode);
    }
  }

  return modes.map(mode => pools[mode].pop());
}

function code() {
  let s;
  do { s = crypto.randomBytes(3).toString("hex").toUpperCase(); } while (rooms.has(s));
  return s;
}
function cleanQuestion(q) {
  const { correct, explain, ...visible } = q;
  return visible;
}
function publicRoom(room) {
  return {
    code: room.code, status: room.status, hostId: room.hostId,
    players: [...room.players.values()].map(p => ({ id:p.id, name:p.name, score:p.score, connected:p.connected })),
    round: room.round, totalRounds: room.questions.length,
    question: room.questionIndex >= 0 && room.questions[room.questionIndex] ? cleanQuestion(room.questions[room.questionIndex]) : null,
    deadline: room.deadline, answers: room.answers.size
  };
}
function emitRoom(room) { io.to(room.code).emit("room:update", publicRoom(room)); }
function endRound(room) {
  if (room.status !== "question") return;
  clearTimeout(room.timer);
  room.status = "reveal";
  const q = room.questions[room.questionIndex];
  const results = [...room.players.values()].map(p => {
    const a = room.answers.get(p.id);
    const correct = !!a && a.choice === q.correct;
    const bonus = correct ? Math.round(50 * Math.max(0, a.remaining) / ROUND_MS) : 0;
    const earned = correct ? 100 + bonus : 0;
    p.score += earned;

    if (a) {
      p.answeredCount++;
      p.responseTimeMs += ROUND_MS - a.remaining;
    }
    if (correct) p.correctAnswers++;

    const category = q.category || "GENERAL";
    if (a) {
      p.categoryStats[category] ||= { correct:0, total:0 };
      p.categoryStats[category].total++;
      if (correct) p.categoryStats[category].correct++;
    }

    return { id:p.id, name:p.name, correct, earned, score:p.score, choice:a ? a.choice : null };
  });
  io.to(room.code).emit("round:result", {
    correct:q.correct, explain:q.explain, results,
    leaderboard:[...room.players.values()].sort((a,b)=>b.score-a.score).map(p=>({id:p.id,name:p.name,score:p.score}))
  });
  emitRoom(room);
  room.timer = setTimeout(() => nextRound(room), BETWEEN_MS);
}
function nextRound(room) {
  if (room.round >= room.questions.length) {
    room.status = "finished";
    const scores = [...room.players.values()].sort((a,b)=>b.score-a.score);
    const top = scores[0]?.score ?? 0;
    if (!room.savedToDatabase) {
      try {
        database.saveMatch(room.code, scores.map(p => ({
          profileId:p.profileId,
          name:p.name,
          score:p.score,
          correctAnswers:p.correctAnswers,
          answeredCount:p.answeredCount,
          responseTimeMs:p.responseTimeMs,
          categoryStats:p.categoryStats
        })));
        room.savedToDatabase = true;
        console.log(`Match ${room.code} saved to database.`);
      } catch (error) {
        console.error("Could not save match:", error);
        io.to(room.code).emit("notice", "Match results could not be saved.");
      }
    }
    io.to(room.code).emit("game:finished", {
      leaderboard:scores.map(p=>({id:p.id,name:p.name,score:p.score})),
      winners:scores.filter(p=>p.score===top).map(p=>p.name),
      stats:scores.map(p => {
        const categories = Object.entries(p.categoryStats);
        const best = categories
          .filter(([,s]) => s.total > 0)
          .sort((a,b) =>
            (b[1].correct / b[1].total) - (a[1].correct / a[1].total)
            || b[1].total - a[1].total
          )[0];

        return {
          id:p.id,
          correctAnswers:p.correctAnswers,
          answeredCount:p.answeredCount,
          accuracy:p.answeredCount
            ? Math.round(p.correctAnswers / p.answeredCount * 100) : 0,
          averageTime:p.answeredCount
            ? Math.round(p.responseTimeMs / p.answeredCount / 100) / 10 : 0,
          bestCategory:best
            ? `${best[0]} (${Math.round(best[1].correct / best[1].total * 100)}%)`
            : "—"
        };
      })
    });
    emitRoom(room);
    return;
  }
  room.round++;
  room.questionIndex = room.round - 1;
  room.answers = new Map();
  room.status = "question";
  room.deadline = Date.now() + ROUND_MS;
  io.to(room.code).emit("round:start", { question:cleanQuestion(room.questions[room.questionIndex]), round:room.round, totalRounds:room.questions.length, deadline:room.deadline });
  emitRoom(room);
  room.timer = setTimeout(() => endRound(room), ROUND_MS);
}
function removePlayer(socket, room) {
  if (!room) return;
  room.players.delete(socket.id);
  socket.leave(room.code);
  if (room.players.size === 0) {
    clearTimeout(room.timer);
    rooms.delete(room.code);
    return;
  }
  if (room.hostId === socket.id) {
    room.hostId = room.players.keys().next().value;
    io.to(room.code).emit("notice", "The host left. A new host has been assigned.");
  }
  emitRoom(room);
}

io.on("connection", socket => {
  socket.on("leaderboard:get", (data, cb) => {
    try {
      const players = database.getLeaderboard(20);
      cb?.({players});
    } catch (error) {
      console.error("Could not load global leaderboard:", error);
      cb?.({error:"Could not load global leaderboard."});
    }
  });

  socket.on("profile:get", ({profileId}, cb) => {
    if (typeof profileId !== "string" ||
        !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(profileId)) {
      return cb?.({error:"Invalid player profile."});
    }

    try {
      const profile = database.getProfile(profileId);
      if (!profile) return cb?.({error:"No match history found for this profile yet."});
      cb?.({profile});
    } catch (error) {
      console.error("Could not load player profile:", error);
      cb?.({error:"Could not load player profile."});
    }
  });

  socket.on("room:create", ({name,profileId}, cb) => {
    if (typeof profileId !== "string" || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(profileId)) {
      return cb?.({error:"Invalid player profile. Refresh the page and try again."});
    }
    const playerName = String(name || "").trim().slice(0,18);
    if (!playerName) return cb?.({error:"Enter a player name."});
    const roomCode = code();
    const room = { code:roomCode, hostId:socket.id, players:new Map(), status:"lobby", round:0, questionIndex:-1, questions:[], answers:new Map(), deadline:null, timer:null, savedToDatabase:false };
    room.players.set(socket.id, {id:socket.id,profileId,name:playerName,score:0,correctAnswers:0,answeredCount:0,responseTimeMs:0,categoryStats:{},connected:true});
    rooms.set(roomCode, room);
    socket.join(roomCode);
    cb?.({code:roomCode});
    emitRoom(room);
  });

  socket.on("room:join", ({code:roomCode,name,profileId}, cb) => {
    if (typeof profileId !== "string" || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(profileId)) {
      return cb?.({error:"Invalid player profile. Refresh the page and try again."});
    }
    const room = rooms.get(String(roomCode || "").trim().toUpperCase());
    const playerName = String(name || "").trim().slice(0,18);
    if (!playerName) return cb?.({error:"Enter a player name."});
    if (!room) return cb?.({error:"Room not found. Check the code and try again."});
    if (room.status !== "lobby") return cb?.({error:"This game has already started."});
    if (room.players.size >= MAX_PLAYERS) return cb?.({error:"This room is full (8 players maximum)."});
    room.players.set(socket.id, {id:socket.id,profileId,name:playerName,score:0,correctAnswers:0,answeredCount:0,responseTimeMs:0,categoryStats:{},connected:true});
    socket.join(room.code);
    cb?.({code:room.code});
    emitRoom(room);
  });

  socket.on("game:start", (_payload, cb) => {
    const room = [...rooms.values()].find(r => r.players.has(socket.id));
    if (!room) return cb?.({error:"You are not in a room."});
    if (room.hostId !== socket.id) return cb?.({error:"Only the host can start the game."});
    if (room.status !== "lobby") return cb?.({error:"The game has already started."});
    if (room.players.size < MIN_PLAYERS) return cb?.({error:"At least 2 players are required."});
    room.questions = createMatchQuestions();
    cb?.({ok:true});
    nextRound(room);
  });

  socket.on("answer:submit", ({choice}, cb) => {
    const room = [...rooms.values()].find(r => r.players.has(socket.id));
    if (!room || room.status !== "question") return cb?.({error:"There is no active question."});
    if (room.answers.has(socket.id)) return cb?.({error:"Your answer has already been locked."});
    if (!Number.isInteger(choice) || choice < 0 || choice > 3) return cb?.({error:"Invalid answer."});
    const remaining = Math.max(0, room.deadline - Date.now());
    room.answers.set(socket.id, {choice, remaining});
    cb?.({ok:true});
    io.to(room.code).emit("answers:count", {count:room.answers.size,total:room.players.size});
    if (room.answers.size === room.players.size) endRound(room);
  });

  socket.on("room:leave", () => {
    const room = [...rooms.values()].find(r => r.players.has(socket.id));
    removePlayer(socket, room);
  });

  socket.on("disconnect", () => {
    const room = [...rooms.values()].find(r => r.players.has(socket.id));
    if (room) {
      const player = room.players.get(socket.id);
      player.connected = false;
      // Keep the seat and score for the current game; a disconnect does not pause everyone.
      emitRoom(room);
      if (room.status === "lobby") {
        room.players.delete(socket.id);
        if (room.hostId === socket.id && room.players.size) room.hostId = room.players.keys().next().value;
        emitRoom(room);
      }
    }
  });
});

server.listen(PORT, () => console.log(`Bug Hunt Arena running at http://localhost:${PORT}`));
