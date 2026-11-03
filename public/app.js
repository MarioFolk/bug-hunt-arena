const socket = io();
function getProfileId(){
  let id = localStorage.getItem("bha-profile-id");
  if (!id) {
    id = crypto.randomUUID();
    localStorage.setItem("bha-profile-id", id);
  }
  return id;
}
const profileId = getProfileId();
const $ = id => document.getElementById(id);
let myId = null, room = null, myChoice = null, timerInterval = null, latestQuestion = null;
const views = ["home","profile","leaderboard","lobby","game","reveal","finished"];
function show(id){views.forEach(v=>$(v).classList.toggle("active",v===id));window.scrollTo(0,0)}
function toast(msg){$("toast").textContent=msg;$("toast").classList.add("show");setTimeout(()=>$("toast").classList.remove("show"),2200)}
function err(id,msg){$(id).textContent=msg||""}
function emitAck(event,data){return new Promise(resolve=>socket.emit(event,data,resolve))}
function currentPlayer(){return room?.players.find(p=>p.id===myId)}
function renderProfile(p){
  const history = p.history || [];
  const categories = p.categories || [];
  const dateFormat = value => {
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? "—" :
      date.toLocaleDateString(undefined,{year:"numeric",month:"short",day:"numeric"});
  };

  $("profile-content").innerHTML = `
    <div class="panel profile-panel">
      <div class="panel-kicker">PLAYER</div>
      <h2>${escapeHtml(p.display_name)}</h2>
      <div class="stats-grid profile-stats">
        <div class="stat-item"><strong>${p.matches_played}</strong><span>MATCHES PLAYED</span></div>
        <div class="stat-item"><strong>${p.wins}</strong><span>WINS</span></div>
        <div class="stat-item"><strong>${p.total_score}</strong><span>TOTAL SCORE</span></div>
        <div class="stat-item"><strong>${p.accuracy}%</strong><span>ACCURACY</span></div>
        <div class="stat-item"><strong>${p.total_correct}/${p.total_answered}</strong><span>CORRECT ANSWERS</span></div>
        <div class="stat-item"><strong>${p.averageTime}s</strong><span>AVG. RESPONSE TIME</span></div>
      </div>
    </div>
    <div class="panel profile-panel">
      <div class="panel-kicker">SKILL BREAKDOWN</div>
      <h2>Category statistics</h2>
      ${categories.length ? categories.map(c => `
        <div class="profile-category">
          <div><b>${escapeHtml(c.category)}</b><span>${c.correct}/${c.total} · ${c.accuracy}%</span></div>
          <div class="profile-bar"><span style="width:${Math.max(0,Math.min(100,Number(c.accuracy)||0))}%"></span></div>
        </div>`).join("") : '<p class="profile-empty">No category statistics yet.</p>'}
    </div>
    <div class="panel profile-panel">
      <div class="panel-kicker">RECENT ACTIVITY</div>
      <h2>Match history</h2>
      ${history.length ? `<div class="profile-history">
        ${history.map(m => `
          <div class="profile-history-row">
            <span>${dateFormat(m.played_at)}</span>
            <b>${m.score} PTS</b>
            <span>${m.correct_answers}/${m.answered_count} correct</span>
            <strong>${m.placement === 1 ? "1st" : `#${m.placement}`}</strong>
          </div>`).join("")}
      </div>` : '<p class="profile-empty">No matches played yet.</p>'}
    </div>`;
}
function renderLeaderboard(players){
  const rows = players || [];

  $("leaderboard-content").innerHTML = rows.length ? `
    <div class="panel profile-panel">
      <div class="panel-kicker">HALL OF FAME</div>
      <div class="leaderboard-table">
        <div class="leaderboard-row leaderboard-header">
          <span>RANK</span>
          <span>PLAYER</span>
          <span>SCORE</span>
          <span>MATCHES</span>
          <span>WINS</span>
          <span>ACCURACY</span>
        </div>
        ${rows.map((p,i) => `
          <div class="leaderboard-row">
            <span class="leaderboard-rank">${i + 1}</span>
            <b class="leaderboard-name">${escapeHtml(p.display_name)}</b>
            <strong>${p.total_score}</strong>
            <span>${p.matches_played}</span>
            <span>${p.wins}</span>
            <span>${p.accuracy}%</span>
          </div>
        `).join("")}
      </div>
    </div>
  ` : '<div class="panel profile-panel profile-empty">No players in the leaderboard yet. Play a match to get started!</div>';
}

function renderPlayers(){
  if(!room)return;
  $("player-count").textContent=`${room.players.length}/8`;
  $("player-list").innerHTML=room.players.map((p,i)=>`<div class="player-item"><span class="player-avatar">${escapeHtml(p.name.slice(0,1).toUpperCase())}</span><span>${escapeHtml(p.name)}</span>${p.id===room.hostId?'<span class="host-tag">HOST</span>':''}</div>`).join("");
  $("game-players").innerHTML=room.players.map(p=>`<span class="game-player ${p.id===myId&&myChoice!==null?'done':''}">${escapeHtml(p.name)} · ${p.score}</span>`).join("");
  $("my-score").textContent=currentPlayer()?.score??0;
}
function escapeHtml(s){return String(s).replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]))}
function setRoom(r){room=r;if(!r)return;$("room-code-display").textContent=r.code;renderPlayers();if(r.status==="lobby")show("lobby")}
$("create-form").addEventListener("submit",async e=>{e.preventDefault();err("home-error","");const res=await emitAck("room:create",{name:$("create-name").value,profileId});if(res?.error)return err("home-error",res.error);myId=socket.id});
$("join-form").addEventListener("submit",async e=>{e.preventDefault();err("home-error","");const res=await emitAck("room:join",{name:$("join-name").value,code:$("room-code").value,profileId});if(res?.error)return err("home-error",res.error);myId=socket.id});
$("room-code").addEventListener("input",e=>e.target.value=e.target.value.toUpperCase().replace(/[^A-Z0-9]/g,""));
$("copy-code").addEventListener("click",async()=>{try{await navigator.clipboard.writeText(room.code);toast("Room code copied.")}catch{toast("Room code: "+room.code)}});
$("start-game").addEventListener("click",async()=>{err("lobby-error","");const res=await emitAck("game:start",{});if(res?.error)err("lobby-error",res.error)});
$("leave-room").addEventListener("click",()=>{socket.emit("room:leave");room=null;show("home")});
$("play-again").addEventListener("click",()=>{room=null;show("home")});
$("open-profile").addEventListener("click",async()=>{
  show("profile");
  $("profile-content").innerHTML='<div class="panel profile-panel">Loading player profile...</div>';
  const res = await emitAck("profile:get",{profileId});
  if (res?.error) {
    $("profile-content").innerHTML=`<div class="panel profile-panel profile-empty">${escapeHtml(res.error)}</div>`;
    return;
  }
  renderProfile(res.profile);
});
$("profile-back").addEventListener("click",()=>show("home"));

$("open-leaderboard").addEventListener("click",async()=>{
  show("leaderboard");
  $("leaderboard-content").innerHTML='<div class="panel profile-panel">Loading leaderboard...</div>';

  const res = await emitAck("leaderboard:get",{});

  if (res?.error) {
    $("leaderboard-content").innerHTML=`<div class="panel profile-panel profile-empty">${escapeHtml(res.error)}</div>`;
    return;
  }

  renderLeaderboard(res.players);
});

$("leaderboard-back").addEventListener("click",()=>show("home"));
socket.on("connect",()=>{myId=socket.id});
socket.on("room:update",r=>{setRoom(r);if(r.status==="question"&&latestQuestion){renderPlayers()}});
socket.on("notice",toast);
socket.on("round:start",data=>{
  latestQuestion=data.question;myChoice=null;show("game");
  $("round-label").textContent=`ROUND ${String(data.round).padStart(2,"0")} / ${String(data.totalRounds || 6).padStart(2,"0")}`;
  $("mode-label").textContent=data.question.mode;$("category").textContent=data.question.category || "GENERAL";$("difficulty").textContent=data.question.level;
  $("question-text").textContent=data.question.prompt;$("question-code").textContent=data.question.code||"";
  $("answered-count").textContent=`0 / ${room?.players.length||0} ANSWERED`;
  $("answer-status").textContent="SELECT YOUR ANSWER TO LOCK IT IN";
  $("options").innerHTML=data.question.options.map((o,i)=>`<button class="option-btn" data-choice="${i}"><span class="option-key">${"ABCD"[i]}</span><span>${escapeHtml(o)}</span></button>`).join("");
  $("options").querySelectorAll("button").forEach(btn=>btn.addEventListener("click",()=>submitAnswer(Number(btn.dataset.choice))));
  startTimer(data.deadline);renderPlayers();
});
async function submitAnswer(choice){
  if(myChoice!==null)return;
  myChoice=choice;
  $("options").querySelectorAll("button").forEach((b,i)=>{b.disabled=true;if(i===choice)b.classList.add("selected")});
  $("answer-status").textContent="ANSWER LOCKED · WAITING FOR THE ARENA";
  const res=await emitAck("answer:submit",{choice});if(res?.error){$("answer-status").textContent=res.error}
}
function startTimer(deadline){
  clearInterval(timerInterval);
  const tick=()=>{const left=Math.max(0,deadline-Date.now());$("timer").textContent=(left/1000).toFixed(1);$("progress").style.width=(left/20000*100)+"%";if(left<=5000)$("timer").style.color="var(--red)";else $("timer").style.color="var(--lime)";if(left<=0)clearInterval(timerInterval)};
  tick();timerInterval=setInterval(tick,100);
}
socket.on("answers:count",d=>$("answered-count").textContent=`${d.count} / ${d.total} ANSWERED`);
socket.on("round:result",data=>{
  clearInterval(timerInterval);show("reveal");
  const mine=data.results.find(r=>r.id===myId);
  $("reveal-title").textContent=mine?.correct?"NICE WORK.":"ROUND COMPLETE.";
  const letters = ["A", "B", "C", "D"];
  const options = latestQuestion?.options || [];
  $("your-answer").textContent = mine?.choice === null || mine?.choice === undefined
    ? "No answer"
    : `${letters[mine.choice]} — ${options[mine.choice]}`;
  $("correct-answer").textContent = `${letters[data.correct]} — ${options[data.correct]}`;
  $("earned-points").textContent = `+${mine?.earned ?? 0} PTS`;
  $("explanation").textContent=data.explain;
  $("round-results").innerHTML=data.results.sort((a,b)=>b.earned-a.earned||b.score-a.score).map((r,i)=>`<div class="result-row"><span class="result-rank">${String(i+1).padStart(2,"0")}</span><b>${escapeHtml(r.name)}</b><span class="result-status ${r.correct?'good':''}">${r.correct?'CORRECT':'NO POINTS'}</span><span class="result-points">+${r.earned}</span></div>`).join("");
});
socket.on("game:finished",data=>{
  show("finished");
  const mine=data.winners.includes(currentPlayer()?.name);
  $("winner-title").innerHTML=data.winners.length>1?"SHARED <span>VICTORY!</span>":`${escapeHtml(data.winners[0]||"NO ONE")}<span> WINS!</span>`;
  $("winner-subtitle").textContent=data.winners.length>1?"A shared victory. Equal score, equal glory.":`${data.winners[0]} is the Bug Hunter Champion.`;
  $("final-results").innerHTML=data.leaderboard.map((p,i)=>`<div class="final-row"><span class="final-rank">${["①","②","③"][i]||String(i+1).padStart(2,"0")}</span><span class="final-name">${escapeHtml(p.name)} ${p.id===myId?"(YOU)":""}</span><span class="final-score">${p.score} PTS</span></div>`).join("");

  const stats = data.stats?.find(p => p.id === myId);
  $("personal-stats").innerHTML = stats ? `
    <div class="stats-heading">YOUR MATCH STATISTICS</div>
    <div class="stats-grid">
      <div class="stat-item"><strong>${stats.correctAnswers}/${stats.answeredCount}</strong><span>CORRECT ANSWERS</span></div>
      <div class="stat-item"><strong>${stats.accuracy}%</strong><span>ACCURACY</span></div>
      <div class="stat-item"><strong>${stats.averageTime}s</strong><span>AVG. RESPONSE TIME</span></div>
      <div class="stat-item"><strong>${escapeHtml(stats.bestCategory)}</strong><span>BEST CATEGORY</span></div>
    </div>` : "";
});
socket.on("disconnect",()=>toast("Connection lost. Refresh to reconnect."));
