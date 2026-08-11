const SOUND_ENABLED_KEY = 'memorabetSoundEnabled';
const MUSIC_ENABLED_KEY = 'memorabetMusicEnabled';
const MASTER_VOLUME_KEY = 'memorabetMasterVolume';
const MUSIC_VOLUME_KEY = 'memorabetMusicVolume';
const EFFECTS_VOLUME_KEY = 'memorabetEffectsVolume';
const AUDIO_DEFAULTS_VERSION_KEY = 'memorabetAudioDefaultsVersion';
const AUDIO_DEFAULTS_VERSION = '2';
const DEFAULT_VOLUME = 0.5;
const MUSIC_TRACKS = [
  'assets/sounds/casino-vip-7.mp3',
  'assets/sounds/we-will-empty-this-casino.mp3',
  'assets/sounds/casino-vip-1.mp3'
];

let audioCtx;
let masterGain;
let musicGain;
let effectsGain;
let musicAudio = null;
let currentMusicIndex = -1;
let rivalFoundAudio = null;
let audioBoundToLifecycle = false;
let pausedByBackground = false;

function clampVolume(value, fallback){
  const number = Number(value);
  if(!Number.isFinite(number)) return fallback;
  return Math.min(1, Math.max(0, number));
}

function getVolume(key, fallback){
  return clampVolume(localStorage.getItem(key), fallback);
}

function setVolume(key, value){
  localStorage.setItem(key, String(clampVolume(value, 1)));
  applyVolumes();
  updateVolumeControls();
}

function applyVolumes(){
  const master = getVolume(MASTER_VOLUME_KEY, DEFAULT_VOLUME);
  const music = getVolume(MUSIC_VOLUME_KEY, DEFAULT_VOLUME);
  const effects = getVolume(EFFECTS_VOLUME_KEY, DEFAULT_VOLUME);
  if(masterGain) masterGain.gain.value = isSoundEnabled() ? master : 0;
  if(musicGain) musicGain.gain.value = music;
  if(effectsGain) effectsGain.gain.value = effects;
  if(musicAudio) musicAudio.volume = isSoundEnabled() && isMusicEnabled() ? master * music : 0;
}

function getCtx(){
  if(!audioCtx){
    audioCtx = new (window.AudioContext || window.webkitAudioContext)();

    masterGain = audioCtx.createGain();
    masterGain.connect(audioCtx.destination);

    musicGain = audioCtx.createGain();
    musicGain.connect(masterGain);

    effectsGain = audioCtx.createGain();
    effectsGain.connect(masterGain);

    applyVolumes();
  }
  return audioCtx;
}

function isEnabled(key, fallback = true){
  const saved = localStorage.getItem(key);
  return saved === null ? fallback : saved === 'true';
}

function setEnabled(key, value){
  localStorage.setItem(key, String(value));
  applyVolumes();
}

export function isSoundEnabled(){
  return isEnabled(SOUND_ENABLED_KEY, true);
}

export function isMusicEnabled(){
  return isEnabled(MUSIC_ENABLED_KEY, true);
}

export async function unlockAudio(){
  const ctx = getCtx();
  if(ctx.state === 'suspended') await ctx.resume();
  if(isMusicEnabled() && isSoundEnabled()) startMusic();
}

function tone({ freq, duration, type = 'sine', volume = 0.16, delay = 0, destination = null, respectSound = true }){
  if(respectSound && !isSoundEnabled()) return;
  const ctx = getCtx();
  const output = destination || effectsGain;
  const start = ctx.currentTime + delay;
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();

  osc.type = type;
  osc.frequency.setValueAtTime(freq, start);
  gain.gain.setValueAtTime(0.0001, start);
  gain.gain.exponentialRampToValueAtTime(volume, start + 0.012);
  gain.gain.exponentialRampToValueAtTime(0.0001, start + duration);

  osc.connect(gain);
  gain.connect(output);
  osc.start(start);
  osc.stop(start + duration + 0.03);
}

function noise({ duration = 0.08, volume = 0.08, delay = 0 } = {}){
  if(!isSoundEnabled()) return;
  const ctx = getCtx();
  const start = ctx.currentTime + delay;
  const bufferSize = Math.max(1, Math.floor(ctx.sampleRate * duration));
  const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
  const data = buffer.getChannelData(0);
  for(let i = 0; i < bufferSize; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / bufferSize);

  const source = ctx.createBufferSource();
  const gain = ctx.createGain();
  const filter = ctx.createBiquadFilter();
  filter.type = 'highpass';
  filter.frequency.value = 900;
  gain.gain.setValueAtTime(volume, start);
  gain.gain.exponentialRampToValueAtTime(0.0001, start + duration);

  source.buffer = buffer;
  source.connect(filter);
  filter.connect(gain);
  gain.connect(effectsGain);
  source.start(start);
}

export function playCardFlip(){
  tone({ freq:430, duration:0.055, type:'triangle', volume:0.11 });
  tone({ freq:680, duration:0.075, type:'triangle', volume:0.08, delay:0.035 });
}

export function playShuffle(){
  noise({ duration:0.07, volume:0.065 });
  tone({ freq:210 + Math.random() * 90, duration:0.05, type:'sawtooth', volume:0.035 });
}

export function playMatch(){
  tone({ freq:520, duration:0.09, type:'sine', volume:0.13 });
  tone({ freq:700, duration:0.10, type:'sine', volume:0.12, delay:0.075 });
  tone({ freq:940, duration:0.14, type:'triangle', volume:0.12, delay:0.16 });
}

export function playMiss(){
  tone({ freq:190, duration:0.16, type:'sawtooth', volume:0.11 });
  tone({ freq:135, duration:0.18, type:'sawtooth', volume:0.09, delay:0.12 });
}

export function playButtonClick(){
  tone({ freq:620, duration:0.045, type:'triangle', volume:0.075 });
  tone({ freq:980, duration:0.055, type:'sine', volume:0.055, delay:0.035 });
}

export function playRivalFound(){
  if(!isSoundEnabled()) return;
  if(!rivalFoundAudio) rivalFoundAudio = new Audio('assets/sounds/rival-found.mp3');
  rivalFoundAudio.pause();
  rivalFoundAudio.currentTime = 0;
  rivalFoundAudio.volume = getVolume(MASTER_VOLUME_KEY, DEFAULT_VOLUME) * getVolume(EFFECTS_VOLUME_KEY, DEFAULT_VOLUME);
  rivalFoundAudio.play().catch(() => {});
}

function pickMusicTrackIndex(){
  if(MUSIC_TRACKS.length <= 1) return 0;
  let next = currentMusicIndex;
  while(next === currentMusicIndex){
    next = Math.floor(Math.random() * MUSIC_TRACKS.length);
  }
  return next;
}

function startMusic(){
  if(!isMusicEnabled() || !isSoundEnabled()) return;
  if(document.hidden) return;
  if(musicAudio && !musicAudio.paused) return;
  if(musicAudio && musicAudio.paused){
    applyVolumes();
    musicAudio.play().catch(() => {});
    return;
  }

  currentMusicIndex = pickMusicTrackIndex();
  musicAudio = new Audio(MUSIC_TRACKS[currentMusicIndex]);
  musicAudio.preload = 'auto';
  musicAudio.addEventListener('ended', () => {
    musicAudio = null;
    startMusic();
  }, { once:true });
  applyVolumes();
  musicAudio.play().catch(() => {});
}

function stopMusic(){
  if(musicAudio){
    musicAudio.pause();
    musicAudio.currentTime = 0;
    musicAudio = null;
  }
}

function pauseAudioForBackground(){
  pausedByBackground = Boolean(musicAudio && !musicAudio.paused);
  if(musicAudio) musicAudio.pause();
  if(rivalFoundAudio) rivalFoundAudio.pause();
  if(audioCtx?.state === 'running') audioCtx.suspend().catch(() => {});
}

async function resumeAudioFromBackground(){
  if(document.hidden) return;
  if(audioCtx?.state === 'suspended') await audioCtx.resume().catch(() => {});
  if(pausedByBackground && isSoundEnabled() && isMusicEnabled()) startMusic();
  pausedByBackground = false;
}

function handleAudioLifecycle(){
  if(document.hidden) pauseAudioForBackground();
  else resumeAudioFromBackground();
}

function bindAudioLifecycle(){
  if(audioBoundToLifecycle) return;
  audioBoundToLifecycle = true;
  document.addEventListener('visibilitychange', handleAudioLifecycle);
  window.addEventListener('pagehide', pauseAudioForBackground);
  window.addEventListener('blur', pauseAudioForBackground);
  window.addEventListener('focus', resumeAudioFromBackground);
  document.addEventListener('freeze', pauseAudioForBackground);
}

function ensureAudioDefaults(){
  if(localStorage.getItem(AUDIO_DEFAULTS_VERSION_KEY) === AUDIO_DEFAULTS_VERSION) return;
  localStorage.setItem(MASTER_VOLUME_KEY, String(DEFAULT_VOLUME));
  localStorage.setItem(MUSIC_VOLUME_KEY, String(DEFAULT_VOLUME));
  localStorage.setItem(EFFECTS_VOLUME_KEY, String(DEFAULT_VOLUME));
  localStorage.setItem(SOUND_ENABLED_KEY, 'true');
  localStorage.setItem(MUSIC_ENABLED_KEY, 'true');
  localStorage.setItem(AUDIO_DEFAULTS_VERSION_KEY, AUDIO_DEFAULTS_VERSION);
}

function updateSoundButtons(){
  const musicBtn = document.getElementById('btn-music');
  const soundBtn = document.getElementById('btn-sound');
  const soundOn = isSoundEnabled();
  const musicOn = isMusicEnabled();

  if(soundBtn){
    soundBtn.textContent = soundOn ? '🔊' : '🔇';
    soundBtn.classList.toggle('active', soundOn);
    soundBtn.setAttribute('aria-pressed', String(soundOn));
  }
  if(musicBtn){
    musicBtn.textContent = musicOn ? '♫' : '♪';
    musicBtn.classList.toggle('active', musicOn);
    musicBtn.setAttribute('aria-pressed', String(musicOn));
  }
}

function updateVolumeControls(){
  const controls = [
    ['volume-master', 'volume-master-value', MASTER_VOLUME_KEY, DEFAULT_VOLUME],
    ['volume-music', 'volume-music-value', MUSIC_VOLUME_KEY, DEFAULT_VOLUME],
    ['volume-effects', 'volume-effects-value', EFFECTS_VOLUME_KEY, DEFAULT_VOLUME]
  ];

  controls.forEach(([inputId, valueId, key, fallback]) => {
    const input = document.getElementById(inputId);
    const output = document.getElementById(valueId);
    const percent = Math.round(getVolume(key, fallback) * 100);
    if(input) input.value = String(percent);
    if(output) output.textContent = `${percent}%`;
  });
}

function bindVolumeControl(inputId, key, fallback){
  const input = document.getElementById(inputId);
  if(!input) return;
  input.value = String(Math.round(getVolume(key, fallback) * 100));
  input.addEventListener('input', async () => {
    await unlockAudio();
    setVolume(key, Number(input.value) / 100);
  });
}

function bindButtonSounds(){
  document.addEventListener('click', event => {
    const button = event.target instanceof Element ? event.target.closest('button') : null;
    if(!button || button.disabled || button.classList.contains('btn-disabled')) return;
    playButtonClick();
  });
}

export function initAudioControls(){
  ensureAudioDefaults();
  updateSoundButtons();
  updateVolumeControls();
  bindAudioLifecycle();

  document.addEventListener('pointerdown', unlockAudio, { once:true });
  document.addEventListener('keydown', unlockAudio, { once:true });
  bindButtonSounds();

  bindVolumeControl('volume-master', MASTER_VOLUME_KEY, DEFAULT_VOLUME);
  bindVolumeControl('volume-music', MUSIC_VOLUME_KEY, DEFAULT_VOLUME);
  bindVolumeControl('volume-effects', EFFECTS_VOLUME_KEY, DEFAULT_VOLUME);

  document.getElementById('btn-sound')?.addEventListener('click', async () => {
    await unlockAudio();
    setEnabled(SOUND_ENABLED_KEY, !isSoundEnabled());
    if(!isSoundEnabled()) stopMusic();
    else if(isMusicEnabled()) startMusic();
    updateSoundButtons();
    updateVolumeControls();
  });

  document.getElementById('btn-music')?.addEventListener('click', async () => {
    await unlockAudio();
    setEnabled(MUSIC_ENABLED_KEY, !isMusicEnabled());
    if(isMusicEnabled()) startMusic();
    else stopMusic();
    updateSoundButtons();
  });

  if(isMusicEnabled()) startMusic();
}
