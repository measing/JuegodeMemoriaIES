const LANGUAGE_KEY = 'memorabetLanguage';

export const SUPPORTED_LANGUAGES = [
  { code:'es', label:'Español' },
  { code:'en', label:'English' },
  { code:'pt', label:'Português' },
  { code:'fr', label:'Français' },
  { code:'de', label:'Deutsch' },
  { code:'it', label:'Italiano' }
];

const DICTIONARY = {
  es:{
    'common.player':'Jugador',
    'common.loading':'Preparando partida...',
    'common.close':'Cerrar',
    'nav.play':'Juego',
    'nav.ranking':'Ranking',
    'nav.settings':'Configuracion',
    'settings.title':'Configuracion',
    'settings.audio':'Audio',
    'settings.language':'Idioma',
    'settings.languageLabel':'Idioma del juego',
    'settings.legal':'Legal',
    'settings.legalText':'Solitario UCM es un juego de memoria sin apuestas, pagos ni premios reales.',
    'settings.privacyPolicy':'Politica de privacidad',
    'settings.master':'General',
    'settings.music':'Musica',
    'settings.effects':'Efectos',
    'rules.title':'Reglas del juego',
    'rules.close':'Cerrar reglas',
    'rules.one':'Encuentra todas las parejas de cartas iguales.',
    'rules.two':'Memoriza las cartas, sigue el mezclado y juega antes de quedarte sin intentos.',
    'rules.three':'Si completas los 8 pares, tu tiempo entra al ranking solitario de este dispositivo.',
    'rules.four':'Si reinicias o sales antes de terminar, esa partida no se registra.',
    'rules.dontShow':'No volver a mostrar estas reglas',
    'rules.accept':'Entendido',
    'hud.round':'Ronda:',
    'hud.pairs':'Parejas:',
    'hud.tries':'Intentos',
    'hud.time':'Tiempo',
    'button.start':'Comenzar juego',
    'button.newGame':'Nueva partida',
    'button.reset':'Reiniciar',
    'button.exit':'Salir',
    'ranking.emptySolo':'Aun nadie completa los 8 pares.',
    'ranking.soloTitle':'Ranking solitario',
    'ranking.tries':'{count} intentos',
    'msg.start':'Presiona Comenzar juego para comenzar.',
    'msg.preparing':'Ya se esta preparando una partida. Espera un momento.',
    'msg.memorize':'Memoriza las cartas. Tendras unos segundos antes del mezclado visible.',
    'msg.hiding':'Cartas ocultandose...',
    'msg.shuffling':'Mezclando cartas... sigue el movimiento con la vista.',
    'msg.play':'Ahora si: juega. Si seguiste el movimiento, deberias tener opciones reales.',
    'msg.pairFound':'Par encontrado.',
    'msg.noPair':'Sin par. Intentos restantes: {count}.',
    'msg.completed':'Completaste los 8 pares. Tiempo: {time} · Intentos: {tries}.',
    'msg.finished':'Partida terminada. {matched}/{total} pares.',
    'msg.reset':'Juego reiniciado. Presiona Comenzar juego.',
    'msg.leftGame':'Saliste de la partida.',
    'msg.startFailed':'No se pudo iniciar el juego.',
    'victory.title':'Felicitaciones',
    'victory.found':'Encontraste los 8 pares.',
    'victory.time':'Tiempo',
    'victory.tries':'Intentos'
  },
  en:{
    'common.player':'Player','common.loading':'Preparing game...','common.close':'Close','nav.play':'Game','nav.ranking':'Ranking','nav.settings':'Settings','settings.title':'Settings','settings.audio':'Audio','settings.language':'Language','settings.languageLabel':'Game language','settings.legal':'Legal','settings.legalText':'Solitario UCM is a memory game with no betting, payments, or real prizes.','settings.privacyPolicy':'Privacy policy','settings.master':'Master','settings.music':'Music','settings.effects':'Effects','rules.title':'Game rules','rules.close':'Close rules','rules.one':'Find every matching card pair.','rules.two':'Memorize the cards, follow the shuffle, and play before you run out of tries.','rules.three':'Complete all 8 pairs to enter this device solo ranking.','rules.four':'Restarting or leaving before finishing does not record the game.','rules.dontShow':'Do not show these rules again','rules.accept':'Got it','hud.round':'Round:','hud.pairs':'Pairs:','hud.tries':'Tries','hud.time':'Time','button.start':'Start game','button.newGame':'New game','button.reset':'Restart','button.exit':'Exit','ranking.emptySolo':'Nobody has completed all 8 pairs yet.','ranking.soloTitle':'Solo ranking','ranking.tries':'{count} tries','msg.start':'Press Start game to begin.','msg.preparing':'A game is already being prepared. Wait a moment.','msg.memorize':'Memorize the cards. You have a few seconds before the visible shuffle.','msg.hiding':'Hiding cards...','msg.shuffling':'Shuffling cards... follow the movement.','msg.play':'Now play. If you followed the movement, you should have real options.','msg.pairFound':'Pair found.','msg.noPair':'No pair. Tries left: {count}.','msg.completed':'You completed all 8 pairs. Time: {time} · Tries: {tries}.','msg.finished':'Game over. {matched}/{total} pairs.','msg.reset':'Game restarted. Press Start game.','msg.leftGame':'You left the game.','msg.startFailed':'Could not start the game.','victory.title':'Congratulations','victory.found':'You found all 8 pairs.','victory.time':'Time','victory.tries':'Tries'
  },
  pt:{},
  fr:{},
  de:{},
  it:{}
};

DICTIONARY.pt = { ...DICTIONARY.en, 'nav.play':'Jogo', 'nav.settings':'Configuracao', 'settings.title':'Configuracao', 'button.start':'Comecar jogo' };
DICTIONARY.fr = { ...DICTIONARY.en, 'nav.play':'Jeu', 'nav.settings':'Configuration', 'settings.title':'Configuration', 'button.start':'Commencer' };
DICTIONARY.de = { ...DICTIONARY.en, 'nav.play':'Spiel', 'nav.settings':'Einstellungen', 'settings.title':'Einstellungen', 'button.start':'Spiel starten' };
DICTIONARY.it = { ...DICTIONARY.en, 'nav.play':'Gioco', 'nav.settings':'Impostazioni', 'settings.title':'Impostazioni', 'button.start':'Inizia gioco' };

function dictionaryFor(lang){
  return DICTIONARY[lang] || DICTIONARY.es;
}

export function getLanguage(){
  const saved = localStorage.getItem(LANGUAGE_KEY);
  return SUPPORTED_LANGUAGES.some(item => item.code === saved) ? saved : 'es';
}

export function t(key, params = {}){
  const lang = getLanguage();
  const value = dictionaryFor(lang)[key] ?? DICTIONARY.es[key] ?? key;
  return String(value).replace(/\{(\w+)\}/g, (_, name) => params[name] ?? '');
}

function setText(selector, key){
  document.querySelectorAll(selector).forEach(el => {
    el.textContent = t(key);
  });
}

function setAttr(selector, attr, key){
  document.querySelectorAll(selector).forEach(el => {
    el.setAttribute(attr, t(key));
  });
}

export function translatePage(){
  const lang = getLanguage();
  document.documentElement.lang = lang;

  setText('[data-view-target="game"] .menu-label', 'nav.play');
  setText('[data-view-target="ranking"] .menu-label', 'nav.ranking');
  setText('[data-view-target="settings"] .menu-label', 'nav.settings');
  setText('#settings-title', 'settings.title');
  setText('#settings-audio-heading', 'settings.audio');
  setText('#settings-language-heading', 'settings.language');
  setText('#settings-language-label', 'settings.languageLabel');
  setText('#settings-legal-heading', 'settings.legal');
  setText('#settings-legal-text', 'settings.legalText');
  setText('#settings-privacy-link', 'settings.privacyPolicy');
  setText('#volume-master-text', 'settings.master');
  setText('#volume-music-text', 'settings.music');
  setText('#volume-effects-text', 'settings.effects');
  setAttr('#btn-change-user', 'aria-label', 'settings.title');
  setText('#rules-modal h2', 'rules.title');
  setAttr('#rules-accept', 'aria-label', 'rules.close');
  const ruleRows = document.querySelectorAll('#rules-modal .rule-row p');
  ['rules.one', 'rules.two', 'rules.three', 'rules.four'].forEach((key, index) => {
    if(ruleRows[index]) ruleRows[index].textContent = t(key);
  });
  setText('.dont-show-row span', 'rules.dontShow');
  setText('.rules-accept', 'rules.accept');
  setText('.top-hud .hud-cell:nth-child(1) span', 'hud.round');
  setText('.top-hud .hud-cell:nth-child(2) span', 'hud.pairs');
  setText('.bottom-hud .bottom-stat:nth-child(1) span', 'hud.tries');
  setText('.bottom-hud .bottom-stat:nth-child(2) span', 'hud.time');
  setText('#btn-start-center', 'button.start');
  setText('#btn-new', 'button.newGame');
  setText('#btn-reset', 'button.reset');
  setText('#btn-exit', 'button.exit');
  setText('#ranking-view .view-heading h1', 'ranking.soloTitle');

  const languageSelect = document.getElementById('language-select');
  if(languageSelect) languageSelect.value = lang;
}

export function setLanguage(lang){
  const next = SUPPORTED_LANGUAGES.some(item => item.code === lang) ? lang : 'es';
  localStorage.setItem(LANGUAGE_KEY, next);
  translatePage();
  document.dispatchEvent(new CustomEvent('memorabet-language-change', { detail:{ language:next } }));
}

export function initI18n(){
  const select = document.getElementById('language-select');
  if(select){
    select.innerHTML = SUPPORTED_LANGUAGES.map(item => `<option value="${item.code}">${item.label}</option>`).join('');
    select.value = getLanguage();
    select.addEventListener('change', () => setLanguage(select.value));
  }
  translatePage();
}
