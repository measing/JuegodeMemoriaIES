import { startSelectedGame, resetGame, exitGame } from './game.js?v=109';
import { session } from './state.js?v=76';
import { updateStats, renderLeaderboard, renderMobileProfile, getSoloLeaderboard, replaceSoloLeaderboard, setSharedLeaderboard, getSoloStats, replaceSoloStats, initRulesModal, initViewNavigation, toggleSettingsView, initCardSkinStore } from './ui.js?v=121';
import { initAudioControls } from './audio.js?v=75';
import { initI18n, translatePage } from './i18n.js?v=11';
import { initFirebaseIntegration } from './firebase-service.js?v=15';

window.__memorabetMainLoaded = true;

function initMobileLoadingScreen(){
  const screen = document.getElementById('mobile-loading-screen');
  if(!screen) return;

  const isMobile = matchMedia('(max-width:720px), (hover:none) and (pointer:coarse)').matches;
  if(!isMobile){
    screen.classList.add('done');
    return;
  }

  const fill = document.getElementById('mobile-loading-fill');
  const percent = document.getElementById('mobile-loading-percent');
  const text = document.getElementById('mobile-loading-text');
  const phrases = ['Barajando cartas...', 'Preparando la mesa...', 'Cargando juego...', 'Listo para jugar...'];
  let progress = 0;
  let phraseIndex = 0;
  const startedAt = performance.now();
  document.body.classList.add('mobile-loading-active');

  const setProgress = value => {
    progress = Math.max(progress, Math.min(100, value));
    if(fill) fill.style.width = `${progress}%`;
    if(percent) percent.textContent = `${Math.round(progress)}%`;
    const nextPhrase = Math.min(phrases.length - 1, Math.floor(progress / 28));
    if(text && nextPhrase !== phraseIndex){
      phraseIndex = nextPhrase;
      text.textContent = phrases[phraseIndex];
    }
  };

  const timer = setInterval(() => {
    const cap = document.readyState === 'complete' ? 100 : 92;
    setProgress(Math.min(cap, progress + Math.random() * 9 + 4));
  }, 160);

  const finish = () => {
    const waitMs = Math.max(0, 1200 - (performance.now() - startedAt));
    window.setTimeout(() => {
      clearInterval(timer);
      setProgress(100);
      window.setTimeout(() => {
        screen.classList.add('done');
        document.body.classList.remove('mobile-loading-active');
      }, 320);
    }, waitMs);
  };

  if(document.readyState === 'complete') finish();
  else window.addEventListener('load', finish, { once:true });
}

function initMobileAppSupport(){
  const setAppHeight = () => {
    document.documentElement.style.setProperty('--app-height', `${window.innerHeight}px`);
  };

  setAppHeight();
  window.addEventListener('resize', setAppHeight);
  window.visualViewport?.addEventListener('resize', setAppHeight);

  const updateInputMode = () => {
    document.documentElement.classList.toggle('touch-device', matchMedia('(hover: none), (pointer: coarse)').matches);
  };
  updateInputMode();
  matchMedia('(hover: none), (pointer: coarse)').addEventListener?.('change', updateInputMode);

  document.addEventListener('pointerup', event => {
    if(event.target instanceof HTMLElement && event.target.matches('button')){
      event.target.blur();
    }
  });
}

function registerServiceWorker(){
  if(!('serviceWorker' in navigator) || location.protocol === 'file:') return;
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('./service-worker.js').catch(() => {});
  });
}

function bindEvents(){
  document.getElementById('btn-change-user')?.addEventListener('click', toggleSettingsView);
  document.getElementById('btn-start-center')?.addEventListener('click', startSelectedGame);
  document.getElementById('btn-new')?.addEventListener('click', startSelectedGame);
  document.getElementById('btn-reset')?.addEventListener('click', resetGame);
  document.getElementById('btn-exit')?.addEventListener('click', exitGame);
}

initMobileLoadingScreen();
initMobileAppSupport();
registerServiceWorker();
bindEvents();
initRulesModal();
initViewNavigation();
initCardSkinStore();
initAudioControls();
initI18n();

session.currentUser = { nickname:'Modo solitario' };
updateStats();
renderLeaderboard();
renderMobileProfile();
initFirebaseIntegration({
  getLocalLeaderboard:getSoloLeaderboard,
  replaceLocalLeaderboard:ranking => replaceSoloLeaderboard(ranking, true),
  setSharedLeaderboard:(ranking, shouldRender) => setSharedLeaderboard(ranking, shouldRender),
  getLocalStats:getSoloStats,
  replaceLocalStats:stats => replaceSoloStats(stats, true)
});

document.addEventListener('firebase-auth-change', () => {
  updateStats();
  renderLeaderboard();
  renderMobileProfile();
});

document.addEventListener('memorabet-language-change', () => {
  translatePage();
  updateStats();
  renderLeaderboard();
});

setInterval(updateStats, 1000);

