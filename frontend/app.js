// Voice-to-voice UI for the multi-AI agent.
// Uses the browser's Web Speech API for STT + TTS.

const $ = (id) => document.getElementById(id);
const transcriptEl = $("transcript");
const statusEl = $("status");
const micBtn = $("mic");
const micLabel = $("mic-label");
const modelSel = $("model");
const voiceSel = $("voice");
const autospeak = $("autospeak");
const textForm = $("text-form");
const textInput = $("text-input");

let history = [];
let recognizing = false;
let recognition = null;
let voices = [];
let userStoppedManually = false;

// ---------- UI helpers ----------
function addMsg(role, text) {
  const div = document.createElement("div");
  div.className = "msg " + role;
  div.textContent = text;
  transcriptEl.appendChild(div);
  transcriptEl.scrollTop = transcriptEl.scrollHeight;
  return div;
}
function setStatus(text, isErr = false) {
  statusEl.textContent = text;
  statusEl.classList.toggle("err", !!isErr);
}

// ---------- TTS ----------
function loadVoices() {
  voices = speechSynthesis.getVoices();
  voiceSel.innerHTML = "";
  const preferred = voices.filter((v) => v.lang && v.lang.startsWith("en"));
  const list = preferred.length ? preferred : voices;
  list.forEach((v, i) => {
    const opt = document.createElement("option");
    opt.value = voices.indexOf(v);
    opt.textContent = `${v.name} (${v.lang})${v.default ? " — default" : ""}`;
    voiceSel.appendChild(opt);
  });
}
if ("speechSynthesis" in window) {
  loadVoices();
  speechSynthesis.onvoiceschanged = loadVoices;
}

function speak(text) {
  if (!("speechSynthesis" in window)) return;
  if (!autospeak.checked) return;
  speechSynthesis.cancel();
  const u = new SpeechSynthesisUtterance(text);
  const idx = parseInt(voiceSel.value, 10);
  if (!Number.isNaN(idx) && voices[idx]) u.voice = voices[idx];
  u.rate = 1.0;
  u.pitch = 1.0;
  speechSynthesis.speak(u);
}

// ---------- STT ----------
function initRecognition() {
  const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
  if (!SR) {
    micBtn.disabled = true;
    micLabel.textContent = "Voice input not supported in this browser";
    setStatus("Your browser does not support the Web Speech API. Try Chrome or Edge on desktop.", true);
    return null;
  }
  const r = new SR();
  r.lang = "en-US";
  r.continuous = false;
  r.interimResults = true;

  let finalText = "";

  r.onstart = () => {
    recognizing = true;
    finalText = "";
    micBtn.classList.add("recording");
    micLabel.textContent = "Listening…";
    setStatus("Listening…");
  };
  r.onresult = (ev) => {
    let interim = "";
    for (let i = ev.resultIndex; i < ev.results.length; i++) {
      const res = ev.results[i];
      if (res.isFinal) finalText += res[0].transcript;
      else interim += res[0].transcript;
    }
    setStatus(`Heard: ${(finalText + interim).trim()}`);
  };
  r.onerror = (ev) => {
    setStatus(`Mic error: ${ev.error}`, true);
  };
  r.onend = () => {
    recognizing = false;
    micBtn.classList.remove("recording");
    micLabel.textContent = "Hold to talk";
    const said = finalText.trim();
    finalText = "";
    if (said && userStoppedManually) {
      sendMessage(said);
    }
    userStoppedManually = false;
  };
  return r;
}
recognition = initRecognition();

function startListening() {
  if (!recognition || recognizing) return;
  userStoppedManually = false;
  try { recognition.start(); } catch (_) {}
}
function stopListening() {
  if (!recognition || !recognizing) return;
  userStoppedManually = true;
  try { recognition.stop(); } catch (_) {}
}

// Push-to-talk: mouse + touch
micBtn.addEventListener("mousedown", startListening);
micBtn.addEventListener("mouseup", stopListening);
micBtn.addEventListener("mouseleave", () => { if (recognizing) stopListening(); });
micBtn.addEventListener("touchstart", (e) => { e.preventDefault(); startListening(); }, { passive: false });
micBtn.addEventListener("touchend",   (e) => { e.preventDefault(); stopListening();  }, { passive: false });

// Spacebar hold-to-talk (when not typing)
document.addEventListener("keydown", (e) => {
  if (e.code === "Space" && document.activeElement !== textInput && !e.repeat) {
    e.preventDefault();
    startListening();
  }
});
document.addEventListener("keyup", (e) => {
  if (e.code === "Space" && document.activeElement !== textInput) {
    e.preventDefault();
    stopListening();
  }
});

// ---------- Chat ----------
async function sendMessage(text) {
  addMsg("user", text);
  setStatus("Thinking…");
  try {
    const res = await fetch("/api/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        message: text,
        model: modelSel.value,
        history: history,
      }),
    });
    if (!res.ok) {
      const err = await res.text();
      throw new Error(err || `HTTP ${res.status}`);
    }
    const data = await res.json();
    history = data.history || history;
    addMsg("bot", data.reply);
    setStatus(`Ready. (${data.model})`);
    speak(data.reply);
  } catch (err) {
    addMsg("system", `Error: ${err.message}`);
    setStatus(err.message, true);
  }
}

textForm.addEventListener("submit", (e) => {
  e.preventDefault();
  const t = textInput.value.trim();
  if (!t) return;
  textInput.value = "";
  sendMessage(t);
});

// ---------- Startup ----------
(async () => {
  try {
    const r = await fetch("/api/health");
    const j = await r.json();
    const on = Object.entries(j.providers).filter(([, v]) => v).map(([k]) => k);
    const off = Object.entries(j.providers).filter(([, v]) => !v).map(([k]) => k);
    const parts = [];
    if (on.length) parts.push(`Enabled: ${on.join(", ")}`);
    if (off.length) parts.push(`Missing keys: ${off.join(", ")}`);
    setStatus(parts.join(" · ") || "Ready.");
  } catch {
    setStatus("Backend not reachable yet.", true);
  }
})();
