"use strict";

// Sesler, Web Audio API'nin geleceğe planlanmış zaman damgalarıyla üretilir.
// setInterval yalnızca planlayıcıyı tetikler; vuruşun asıl zamanını belirlemez.
const $ = (selector) => document.querySelector(selector);
const elements = {
  bpmInput: $("#bpmInput"), bpmSlider: $("#bpmSlider"),
  decrease: $("#decrease"), increase: $("#increase"),
  toggle: $("#toggle"), playIcon: $("#playIcon"), playLabel: $("#playLabel"),
  tap: $("#tap"), status: $("#status"),
  meter: $("#meterSelect"), subdivision: $("#subdivisionSelect"),
  accent: $("#accentEnabled"), volume: $("#volumeSlider"),
  volumeValue: $("#volumeValue"), beatDots: $("#beatDots"),
  beatDescription: $("#beatDescription"), beatProgress: $("#beatProgress"),
};

const settings = { bpm: 100, meter: 4, subdivision: 1, accent: true, volume: 0.7 };
const STORAGE_KEY = "ritim-metronom-settings-v1";

function saveSettings() {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(settings)); } catch (_) { /* Depolama kapalıysa sürdür. */ }
}

function restoreSettings() {
  let saved;
  try { saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || "null"); } catch (_) { return; }
  if (!saved || typeof saved !== "object") return;

  if (Number.isFinite(saved.bpm)) settings.bpm = clampBpm(saved.bpm);
  if ([2, 3, 4, 5, 7].includes(saved.meter)) settings.meter = saved.meter;
  if ([1, 2, 3, 4].includes(saved.subdivision)) settings.subdivision = saved.subdivision;
  if (typeof saved.accent === "boolean") settings.accent = saved.accent;
  if (Number.isFinite(saved.volume) && saved.volume >= 0 && saved.volume <= 1) settings.volume = saved.volume;

  elements.meter.value = String(settings.meter);
  elements.subdivision.value = String(settings.subdivision);
  elements.accent.checked = settings.accent;
  elements.volume.value = String(Math.round(settings.volume * 100));
}

let audioContext = null;
let masterGain = null;
let playing = false;
let schedulerTimer = null;
let animationId = null;
let nextNoteTime = 0;
let beatIndex = 0;
let subdivisionIndex = 0;
let activeBeat = -1;
let lastBeatTime = 0;
let visualEvents = [];
let tapTimes = [];

const LOOKAHEAD_MS = 25;
const SCHEDULE_AHEAD_SECONDS = 0.12;

function clampBpm(bpm) {
  return Math.min(240, Math.max(30, Math.round(bpm)));
}

function setBpm(bpm) {
  if (!Number.isFinite(Number(bpm))) return;
  settings.bpm = clampBpm(Number(bpm));
  elements.bpmInput.value = String(settings.bpm);
  elements.bpmSlider.value = String(settings.bpm);
  saveSettings();
  document.querySelectorAll("[data-bpm]").forEach((button) => {
    button.classList.toggle("selected", Number(button.dataset.bpm) === settings.bpm);
  });
}

function drawDots() {
  elements.beatDots.replaceChildren();
  for (let i = 0; i < settings.meter; i += 1) {
    const dot = document.createElement("div");
    dot.className = `beat-dot${i === 0 && settings.accent ? " first" : ""}`;
    dot.textContent = String(i + 1);
    elements.beatDots.append(dot);
  }
  elements.beatDescription.textContent = `${settings.meter}/4 · ${settings.accent ? "1. vuruş güçlü" : "Eşit vuruşlar"}`;
  paintActiveDot();
}

function paintActiveDot() {
  [...elements.beatDots.children].forEach((dot, i) => {
    dot.classList.toggle("active", playing && i === activeBeat);
  });
}

function updateVolume() {
  settings.volume = Number(elements.volume.value) / 100;
  elements.volumeValue.textContent = `${elements.volume.value}%`;
  saveSettings();
  if (audioContext && masterGain && playing) {
    masterGain.gain.setTargetAtTime(settings.volume, audioContext.currentTime, 0.01);
  }
}

function ensureAudio() {
  if (audioContext) return;
  const AudioContextClass = window.AudioContext || window.webkitAudioContext;
  if (!AudioContextClass) throw new Error("Tarayıcınız Web Audio API'yi desteklemiyor.");
  audioContext = new AudioContextClass();
  masterGain = audioContext.createGain();
  masterGain.gain.value = settings.volume;
  masterGain.connect(audioContext.destination);
}

function playClick(time, type) {
  // 1. vuruş: güçlü/yüksek, diğer ana vuruşlar: normal, ara notalar: hafif.
  const frequency = type === "accent" ? 1760 : type === "beat" ? 1180 : 820;
  const level = type === "accent" ? 0.62 : type === "beat" ? 0.42 : 0.18;
  const duration = type === "sub" ? 0.035 : 0.053;
  const osc = audioContext.createOscillator();
  const envelope = audioContext.createGain();
  osc.type = "triangle";
  osc.frequency.setValueAtTime(frequency, time);
  osc.frequency.exponentialRampToValueAtTime(frequency * 0.63, time + duration);
  envelope.gain.setValueAtTime(0.0001, time);
  envelope.gain.exponentialRampToValueAtTime(level, time + 0.002);
  envelope.gain.exponentialRampToValueAtTime(0.0001, time + duration);
  osc.connect(envelope);
  envelope.connect(masterGain);
  osc.start(time);
  osc.stop(time + duration + 0.004);
  osc.onended = () => { osc.disconnect(); envelope.disconnect(); };
}

function scheduleNote() {
  const mainBeat = subdivisionIndex === 0;
  const strong = mainBeat && beatIndex === 0 && settings.accent;
  playClick(nextNoteTime, strong ? "accent" : mainBeat ? "beat" : "sub");
  if (mainBeat) visualEvents.push({ time: nextNoteTime, beat: beatIndex });

  nextNoteTime += 60 / settings.bpm / settings.subdivision;
  subdivisionIndex += 1;
  if (subdivisionIndex >= settings.subdivision) {
    subdivisionIndex = 0;
    beatIndex = (beatIndex + 1) % settings.meter;
  }
}

function scheduler() {
  if (!playing || !audioContext) return;
  // Görünür olmayan sekmede zamanlayıcı duraklamışsa geçmiş notaları telafi etmeyiz.
  if (nextNoteTime < audioContext.currentTime - 0.15) {
    nextNoteTime = audioContext.currentTime + 0.04;
    subdivisionIndex = 0;
    visualEvents = [];
  }
  while (nextNoteTime < audioContext.currentTime + SCHEDULE_AHEAD_SECONDS) {
    scheduleNote();
  }
}

function animate() {
  if (!playing || !audioContext) return;
  const now = audioContext.currentTime;
  while (visualEvents.length && visualEvents[0].time <= now + 0.012) {
    const note = visualEvents.shift();
    activeBeat = note.beat;
    lastBeatTime = note.time;
    paintActiveDot();
  }
  const secondsPerBeat = 60 / settings.bpm;
  const progress = Math.min(1, Math.max(0, (now - lastBeatTime) / secondsPerBeat));
  elements.beatProgress.style.width = `${(progress * 100).toFixed(1)}%`;
  animationId = requestAnimationFrame(animate);
}

async function start() {
  if (playing) return;
  try {
    ensureAudio();
    await audioContext.resume();
  } catch (error) {
    elements.status.textContent = `Ses başlatılamadı: ${error.message}`;
    return;
  }
  playing = true;
  masterGain.gain.cancelScheduledValues(audioContext.currentTime);
  masterGain.gain.setTargetAtTime(settings.volume, audioContext.currentTime, 0.01);
  beatIndex = 0;
  subdivisionIndex = 0;
  activeBeat = -1;
  lastBeatTime = audioContext.currentTime;
  visualEvents = [];
  nextNoteTime = audioContext.currentTime + 0.06;
  elements.toggle.classList.add("playing");
  elements.toggle.setAttribute("aria-pressed", "true");
  elements.playIcon.textContent = "■";
  elements.playLabel.textContent = "Durdur";
  elements.status.classList.add("playing");
  elements.status.innerHTML = '<span class="status-light"></span> Çalıyor';
  scheduler();
  schedulerTimer = window.setInterval(scheduler, LOOKAHEAD_MS);
  animationId = requestAnimationFrame(animate);
}

function stop() {
  playing = false;
  clearInterval(schedulerTimer);
  cancelAnimationFrame(animationId);
  if (audioContext && masterGain) {
    masterGain.gain.cancelScheduledValues(audioContext.currentTime);
    masterGain.gain.setTargetAtTime(0, audioContext.currentTime, 0.005);
  }
  visualEvents = [];
  activeBeat = -1;
  paintActiveDot();
  elements.beatProgress.style.width = "0%";
  elements.toggle.classList.remove("playing");
  elements.toggle.setAttribute("aria-pressed", "false");
  elements.playIcon.textContent = "▶";
  elements.playLabel.textContent = "Başlat";
  elements.status.classList.remove("playing");
  elements.status.innerHTML = '<span class="status-light"></span> Hazır';
}

function toggle() { if (playing) stop(); else void start(); }

function tapTempo() {
  const now = performance.now();
  if (tapTimes.length && now - tapTimes[tapTimes.length - 1] > 2200) tapTimes = [];
  tapTimes.push(now);
  if (tapTimes.length > 7) tapTimes.shift();
  if (tapTimes.length < 2) return;
  const intervals = tapTimes.slice(1).map((t, i) => t - tapTimes[i]);
  const avg = intervals.reduce((sum, ms) => sum + ms, 0) / intervals.length;
  setBpm(60000 / avg);
}

elements.bpmSlider.addEventListener("input", (event) => setBpm(event.target.value));
elements.bpmInput.addEventListener("change", (event) => setBpm(event.target.value || settings.bpm));
elements.decrease.addEventListener("click", () => setBpm(settings.bpm - 1));
elements.increase.addEventListener("click", () => setBpm(settings.bpm + 1));
document.querySelectorAll("[data-bpm]").forEach((button) => {
  button.addEventListener("click", () => setBpm(button.dataset.bpm));
});
elements.meter.addEventListener("change", (event) => {
  settings.meter = Number(event.target.value);
  beatIndex %= settings.meter;
  drawDots();
  saveSettings();
});
elements.subdivision.addEventListener("change", (event) => {
  settings.subdivision = Number(event.target.value);
  subdivisionIndex = 0;
  saveSettings();
});
elements.accent.addEventListener("change", (event) => {
  settings.accent = event.target.checked;
  drawDots();
  saveSettings();
});
elements.volume.addEventListener("input", updateVolume);
elements.toggle.addEventListener("click", toggle);
elements.tap.addEventListener("click", tapTempo);
document.addEventListener("keydown", (event) => {
  if (event.repeat || event.ctrlKey || event.metaKey || event.altKey) return;
  const tag = event.target.tagName;
  if (["INPUT", "SELECT", "BUTTON", "TEXTAREA"].includes(tag)) return;
  if (event.code === "Space") { event.preventDefault(); toggle(); }
  else if (event.key.toLowerCase() === "t") { event.preventDefault(); tapTempo(); }
});

restoreSettings();
setBpm(settings.bpm);
drawDots();
updateVolume();
