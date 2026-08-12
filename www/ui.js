import { K_MAX, TOTAL_PAIRS } from './constants.js?v=73';
import { gameState, session } from './state.js?v=76';
import { escapeHTML } from './utils.js?v=73';
import { t } from './i18n.js?v=10';
import { syncFirebaseLeaderboardEntry } from './firebase-service.js?v=12';

const SOLO_LEADERBOARD_KEY = 'memorabetSoloLeaderboard';
const SOLO_STATS_KEY = 'memorabetSoloStats';
const DEFAULT_AVATAR = 'assets/avatars/avatar-01.png';
const CARD_SKIN_SELECTED_KEY = 'memorabetSelectedCardSkin';
const DEFAULT_CARD_SKIN_ID = 'ucm-statistics';
const CARD_SKINS = [
  { id:DEFAULT_CARD_SKIN_ID, name:'UCM Estadistica', src:'assets/card-backs/ucm-statistics-default.png?v=1', default:true },
  { id:'galaxy', name:'Galaxia dorada', src:'assets/card-backs/skin-galaxy.png?v=2' },
  { id:'arcane', name:'Runas moradas', src:'assets/card-backs/skin-arcane.png?v=2' },
  { id:'forest', name:'Bosque esmeralda', src:'assets/card-backs/skin-forest.png?v=2' },
  { id:'storm', name:'Tormenta azul', src:'assets/card-backs/skin-storm.png?v=2' },
  { id:'royal', name:'Corona negra', src:'assets/card-backs/skin-royal.png?v=2' },
  { id:'inferno', name:'Fuego infernal', src:'assets/card-backs/skin-inferno.png?v=2' },
  { id:'radiant', name:'Luz radiante', src:'assets/card-backs/skin-radiant.png?v=2' },
  { id:'tech', name:'Esmeralda tech', src:'assets/card-backs/skin-tech.png?v=2' },
  { id:'solar', name:'Sol dorado', src:'assets/card-backs/skin-solar.png?v=1' },
  { id:'venom', name:'Veneno esmeralda', src:'assets/card-backs/skin-venom.png?v=1' },
  { id:'frost', name:'Cristal helado', src:'assets/card-backs/skin-frost.png?v=1' },
  { id:'nature', name:'Naturaleza dorada', src:'assets/card-backs/skin-nature.png?v=1' },
  { id:'banana', name:'Banana real', src:'assets/card-backs/skin-banana.png?v=1' }
];

let currentViewName = 'game';
let previousContentViewName = 'game';

function applySelectedAvatar(){
  document.querySelectorAll('[data-avatar-display]').forEach(el => {
    el.style.backgroundImage = `url("${DEFAULT_AVATAR}")`;
  });
}

function getSelectedCardSkin(){
  const selected = localStorage.getItem(CARD_SKIN_SELECTED_KEY) || DEFAULT_CARD_SKIN_ID;
  return CARD_SKINS.find(skin => skin.id === selected) || CARD_SKINS[0];
}

function applySelectedCardSkin(){
  const selected = getSelectedCardSkin();
  if(selected?.src) document.documentElement.style.setProperty('--card-back-skin', `url("${selected.src}")`);
  else document.documentElement.style.removeProperty('--card-back-skin');

  document.querySelectorAll('.skin-card').forEach(card => {
    card.classList.toggle('equipped', card.dataset.skinId === selected.id);
  });
}

function showStoreStatus(text, type = 'success'){
  const status = document.getElementById('store-status');
  if(!status) return;
  status.textContent = text;
  status.className = `store-status visible ${type}`;
}

function renderCardSkinStore(){
  const store = document.getElementById('card-skin-store');
  if(!store) return;

  const selected = getSelectedCardSkin();
  store.innerHTML = CARD_SKINS.map(skin => {
    const isEquipped = selected.id === skin.id;
    return `
      <article class="shop-item skin-card ${isEquipped ? 'equipped' : ''}" data-skin-id="${skin.id}">
        <div class="skin-preview">
          <div class="skin-art ${skin.default ? 'default-skin-preview' : ''}" ${skin.src ? `style="background-image:url('${skin.src}')"` : ''}>
            ${skin.src ? '' : '<span>*</span>'}
          </div>
        </div>
        <div class="skin-info">
          <strong>${escapeHTML(skin.name)}</strong>
          <span>Disponible</span>
        </div>
        <button class="skin-action" type="button" data-skin-action="${skin.id}" ${isEquipped ? 'disabled' : ''}>${isEquipped ? 'En uso' : 'Equipar'}</button>
      </article>
    `;
  }).join('');

  store.querySelectorAll('[data-skin-action]').forEach(button => {
    button.addEventListener('click', () => {
      const skin = CARD_SKINS.find(item => item.id === button.dataset.skinAction);
      if(!skin) return;
      localStorage.setItem(CARD_SKIN_SELECTED_KEY, skin.id);
      applySelectedCardSkin();
      renderCardSkinStore();
      renderBoard();
      showStoreStatus(`${skin.name} equipado.`, 'success');
    });
  });
}

export function initCardSkinStore(){
  renderCardSkinStore();
  applySelectedCardSkin();
}

export function renderBoard(onCardClick){
  const board = document.getElementById('board');
  if(!board) return;
  if(!gameState.cards.length){
    board.innerHTML = '';
    setStartPanelVisible(true);
    return;
  }

  const selectedSkin = getSelectedCardSkin();
  const skinMarkup = selectedSkin?.src
    ? `<img class="card-back-img" src="${escapeHTML(selectedSkin.src)}" alt="" draggable="false" />`
    : '';
  setStartPanelVisible(false);
  board.innerHTML = '';

  gameState.cards.forEach(card => {
    const wrap = document.createElement('div');
    wrap.className = 'card-wrap' + ((card.flipped || card.matched) ? ' flipped' : '') + (card.matched ? ' matched' : '');
    wrap.dataset.id = card.id;
    wrap.innerHTML = `
      <div class="card-inner">
        <div class="card-face card-back${skinMarkup ? ' has-skin' : ''}">${skinMarkup}</div>
        <div class="card-face card-front">
          <img class="animal-card-img" src="${escapeHTML(card.src)}" alt="${escapeHTML(card.name)}" />
        </div>
      </div>`;
    if(onCardClick) wrap.addEventListener('click', () => onCardClick(card.id));
    board.appendChild(wrap);
  });
}

export function updateCardClasses(){
  gameState.cards.forEach(card => {
    const wrap = document.querySelector(`.card-wrap[data-id="${card.id}"]`);
    if(!wrap) return;
    wrap.classList.toggle('flipped', card.flipped || card.matched);
    wrap.classList.toggle('matched', card.matched);
  });
}

export function updateStats(){
  const remaining = Math.max(0, K_MAX - gameState.intentos);
  const roundActive = gameState.starting || gameState.playing || gameState.cards.length > 0;
  const controlsActive = roundActive && document.getElementById('start-game-panel')?.classList.contains('hidden');
  const elapsedEnd = gameState.endTime || Date.now();
  const elapsed = gameState.startTime ? elapsedEnd - gameState.startTime : 0;

  document.body.classList.toggle('game-round-active', roundActive);
  document.body.classList.toggle('game-controls-active', controlsActive);
  document.getElementById('player-name').textContent = session.currentUser?.nickname || t('common.player');

  const roundNumber = document.getElementById('round-number');
  const pares = document.getElementById('pares');
  const intentos = document.getElementById('intentos');
  const tiempo = document.getElementById('tiempo');

  if(roundNumber) roundNumber.textContent = String(gameState.round || 1);
  if(pares) pares.textContent = `${gameState.matched} / ${TOTAL_PAIRS}`;
  if(intentos) intentos.textContent = gameState.playing ? String(remaining) : String(K_MAX);
  if(tiempo) tiempo.textContent = formatDuration(elapsed);
  applySelectedAvatar();
  applySelectedCardSkin();
}

export function showMsg(text, type = 'info'){
  const message = document.getElementById('msg');
  if(!message) return;
  message.className = `message visible ${type}`;
  message.innerHTML = text;
}

export function hideMsg(){
  const message = document.getElementById('msg');
  if(!message) return;
  message.className = 'message';
  message.textContent = '';
}

export function setStartPanelVisible(isVisible){
  const panel = document.getElementById('start-game-panel');
  if(panel) panel.classList.toggle('hidden', !isVisible);
}

export function clearBoard(){
  const board = document.getElementById('board');
  if(board) board.innerHTML = '';
  setStartPanelVisible(true);
}

export function setNewGameButtonBusy(isBusy, text = t('common.loading')){
  const buttons = [
    document.getElementById('btn-start-center'),
    document.getElementById('btn-new')
  ].filter(Boolean);

  buttons.forEach(button => {
    button.disabled = !!isBusy;
    button.classList.toggle('btn-disabled', !!isBusy);
    button.textContent = isBusy ? text : (button.id === 'btn-start-center' ? t('button.start') : t('button.newGame'));
  });
}

export function formatDuration(ms){
  const totalSeconds = Math.max(0, Math.floor(ms / 1000));
  const minutes = Math.floor(totalSeconds / 60).toString().padStart(2, '0');
  const seconds = (totalSeconds % 60).toString().padStart(2, '0');
  return `${minutes}:${seconds}`;
}

export function getSoloLeaderboard(){
  try{
    const saved = JSON.parse(localStorage.getItem(SOLO_LEADERBOARD_KEY) || '[]');
    return Array.isArray(saved) ? saved : [];
  }catch{
    return [];
  }
}

function normalizeSoloGameResult(item){
  if(!Number.isFinite(Number(item?.tiempoMs)) || !Number.isFinite(Number(item?.intentos))) return null;
  const completedAt = Number(item.completedAt) || Date.now();
  const pairs = Math.max(0, Math.min(TOTAL_PAIRS, Math.round(Number(item?.pairs ?? item?.pares ?? item?.matchedPairs ?? TOTAL_PAIRS))));
  return {
    ...item,
    id:String(item.id || `${completedAt}-${Number(item.intentos)}-${Number(item.tiempoMs)}`).replace(/[.#$/[\]]/g, '-'),
    name:String(item.name || session.currentUser?.nickname || t('common.player')).slice(0, 48),
    tiempoMs:Number(item.tiempoMs),
    intentos:Number(item.intentos),
    pairs,
    completed:Boolean(item.completed ?? pairs === TOTAL_PAIRS),
    completedAt,
    source:'solo'
  };
}

function normalizeSoloLeaderboard(ranking){
  return (Array.isArray(ranking) ? ranking : [])
    .map(normalizeSoloGameResult)
    .filter(Boolean)
    .sort((a, b) => Number(b.pairs || 0) - Number(a.pairs || 0) || Number(a.intentos) - Number(b.intentos) || Number(a.tiempoMs) - Number(b.tiempoMs))
    .slice(0, 20);
}

function deriveSoloStats(ranking = getSoloLeaderboard()){
  const normalized = normalizeSoloLeaderboard(ranking);
  const totalPairs = normalized.reduce((sum, entry) => sum + getCompletedPairCount(entry), 0);
  const best = normalized.reduce((max, entry) => Math.max(max, getCompletedPairCount(entry)), 0);
  const updatedAt = normalized.reduce((max, entry) => Math.max(max, Number(entry.completedAt || 0)), 0);
  return {
    games:normalized.length,
    totalPairs,
    best,
    averagePairs:normalized.length ? totalPairs / normalized.length : 0,
    updatedAt,
    resultIds:normalized.map(entry => entry.id).slice(0, 100)
  };
}

function normalizeSoloStats(stats = {}, fallbackRanking){
  const derived = deriveSoloStats(fallbackRanking);
  const games = Math.max(0, Math.round(Number(stats.games ?? stats.completedGames ?? 0)));
  const totalPairs = Math.max(0, Number(stats.totalPairs ?? 0));
  const best = Math.max(0, Math.min(TOTAL_PAIRS, Number(stats.best ?? 0)));
  const normalized = {
    games,
    totalPairs,
    best,
    averagePairs:games ? totalPairs / games : 0,
    updatedAt:Number(stats.updatedAt || 0),
    resultIds:Array.isArray(stats.resultIds) ? stats.resultIds.map(String).slice(0, 100) : []
  };

  if(derived.games > normalized.games || (!normalized.games && derived.games)){
    return derived;
  }

  return normalized;
}

export function getSoloStats(fallbackRanking = getSoloLeaderboard()){
  try{
    const saved = JSON.parse(localStorage.getItem(SOLO_STATS_KEY) || '{}');
    return normalizeSoloStats(saved, fallbackRanking);
  }catch{
    return deriveSoloStats(fallbackRanking);
  }
}

export function replaceSoloStats(stats, shouldRender = true){
  const normalized = normalizeSoloStats(stats);
  localStorage.setItem(SOLO_STATS_KEY, JSON.stringify(normalized));
  if(shouldRender) renderMobileProfile();
  return normalized;
}

function addSoloStatsEntry(entry){
  const normalizedEntry = normalizeSoloGameResult(entry);
  if(!normalizedEntry) return getSoloStats();
  const current = getSoloStats();
  if(current.resultIds.includes(normalizedEntry.id)) return current;

  const pairs = getCompletedPairCount(normalizedEntry);
  const next = {
    games:current.games + 1,
    totalPairs:current.totalPairs + pairs,
    best:Math.max(current.best, pairs),
    updatedAt:Math.max(Number(current.updatedAt || 0), Number(normalizedEntry.completedAt || Date.now())),
    resultIds:[normalizedEntry.id, ...current.resultIds].slice(0, 100)
  };
  next.averagePairs = next.games ? next.totalPairs / next.games : 0;
  localStorage.setItem(SOLO_STATS_KEY, JSON.stringify(next));
  return next;
}

export function replaceSoloLeaderboard(ranking, shouldRender = true){
  const normalized = normalizeSoloLeaderboard(ranking);
  localStorage.setItem(SOLO_LEADERBOARD_KEY, JSON.stringify(normalized));
  session.cachedLeaderboard = normalized;
  if(shouldRender) renderLeaderboard(normalized);
  renderMobileProfile(normalized);
  return normalized;
}

export function setSharedLeaderboard(ranking, shouldRender = true){
  const normalized = normalizeSoloLeaderboard(ranking);
  session.sharedLeaderboard = normalized;
  if(shouldRender) renderLeaderboard(normalized);
  return normalized;
}

export function addSoloLeaderboardEntry(entry){
  const completedAt = Number(entry?.completedAt) || Date.now();
  const savedEntry = normalizeSoloGameResult({
    ...entry,
    id:String(entry?.id || `${completedAt}-${Number(entry?.intentos || 0)}-${Number(entry?.tiempoMs || 0)}`).replace(/[.#$/[\]]/g, '-'),
    completedAt,
    source:'solo'
  });
  if(!savedEntry) return getSoloLeaderboard();
  const stats = addSoloStatsEntry(savedEntry);
  const ranking = replaceSoloLeaderboard([...getSoloLeaderboard(), savedEntry], false);

  syncFirebaseLeaderboardEntry(savedEntry).catch(() => {});
  renderLeaderboard(ranking);
  renderMobileProfile();
  document.dispatchEvent(new CustomEvent('solo-result-recorded', { detail:{ entry:savedEntry, ranking, stats } }));
  return ranking;
}

export function renderLeaderboard(ranking = session.sharedLeaderboard?.length ? session.sharedLeaderboard : getSoloLeaderboard()){
  const list = document.getElementById('leaderboard-list');
  if(!list) return;

  session.cachedLeaderboard = ranking;
  if(!ranking.length){
    list.innerHTML = `<p class="empty">Aun no hay partidas registradas.</p>`;
    return;
  }

  const normalized = normalizeSoloLeaderboard(ranking);

  list.innerHTML = `
    <section class="ranking-section ranking-section-solo">
      <h2>${escapeHTML(t('ranking.soloTitle'))}</h2>
      ${normalized.map((item, index) => `
        <div class="ranking-item">
          <div class="entry-avatar ranking-avatar"><span>${index + 1}</span></div>
          <div>
            <div class="ranking-name">#${index + 1} ${escapeHTML(item.name || t('common.player'))}</div>
            <div class="ranking-meta">${Number(item.pairs || 0)}/${TOTAL_PAIRS} pares &middot; ${escapeHTML(t('ranking.tries', { count:Number(item.intentos || 0) }))} &middot; ${formatDuration(Number(item.tiempoMs || 0))}</div>
          </div>
          <div class="ranking-prize">${Number(item.pairs || 0)}/${TOTAL_PAIRS}</div>
        </div>
      `).join('')}
    </section>
  `;
}

function getCompletedPairCount(entry){
  const explicitPairs = Number(entry?.pairs ?? entry?.pares ?? entry?.matchedPairs);
  return Number.isFinite(explicitPairs) ? Math.max(0, Math.min(TOTAL_PAIRS, explicitPairs)) : TOTAL_PAIRS;
}

export function renderMobileProfile(ranking = session.cachedLeaderboard?.length ? session.cachedLeaderboard : getSoloLeaderboard()){
  const name = session.currentUser?.nickname || t('common.player');
  const stats = getSoloStats(ranking);
  const completedGames = Number(stats.games || 0);
  const averagePairs = Number(stats.averagePairs || 0);

  const nameEl = document.getElementById('profile-panel-name');
  const gamesEl = document.getElementById('profile-completed-games');
  const averageEl = document.getElementById('profile-average-pairs');
  const emptyEl = document.getElementById('profile-empty-state');
  const loginEl = document.querySelector('.profile-login-action');

  if(nameEl) nameEl.textContent = name;
  if(gamesEl) gamesEl.textContent = String(completedGames);
  if(averageEl) averageEl.textContent = completedGames ? averagePairs.toFixed(1).replace('.', ',') : '0';
  if(emptyEl) emptyEl.hidden = completedGames > 0;
  if(loginEl) loginEl.hidden = !!session.firebaseUser;
}

export function showVictoryAnimation({ tiempoMs, intentos }){
  const old = document.getElementById('victory-overlay');
  if(old) old.remove();

  const overlay = document.createElement('div');
  overlay.id = 'victory-overlay';
  overlay.className = 'victory-overlay';
  overlay.innerHTML = `
    <div class="confetti-layer">${Array.from({ length:42 }, (_, index) => `<span style="--i:${index}">*</span>`).join('')}</div>
    <div class="victory-box">
      <div class="victory-trophy">&#127942;</div>
      <h2>${escapeHTML(t('victory.title'))}</h2>
      <p>${escapeHTML(t('victory.found'))}</p>
      <div class="victory-details">
        <span>${escapeHTML(t('victory.time'))}: <strong>${formatDuration(tiempoMs)}</strong></span>
        <span>${escapeHTML(t('victory.tries'))}: <strong>${intentos}</strong></span>
      </div>
      <button class="btn btn-green" id="victory-close">${escapeHTML(t('common.close'))}</button>
    </div>`;
  document.body.appendChild(overlay);
  document.getElementById('victory-close')?.addEventListener('click', () => overlay.remove());
  setTimeout(() => overlay.classList.add('show'), 20);
}

function getActiveViewName(){
  return document.querySelector('.screen-view.active')?.dataset.view || currentViewName || 'game';
}

export function showView(viewName){
  const target = viewName || 'game';
  const previous = getActiveViewName();
  if(target === 'settings' && previous && previous !== 'settings'){
    previousContentViewName = previous;
  }else if(target !== 'settings'){
    previousContentViewName = target;
  }

  document.querySelectorAll('.screen-view').forEach(view => {
    view.classList.toggle('active', view.dataset.view === target);
  });

  document.querySelectorAll('[data-view-target]').forEach(button => {
    const isActive = button.dataset.viewTarget === target;
    button.classList.toggle('active', isActive);
    if(isActive) button.setAttribute('aria-current', 'page');
    else button.removeAttribute('aria-current');
  });

  if(target === 'ranking') renderLeaderboard();
  if(target === 'store') renderCardSkinStore();
  if(target === 'profile') renderMobileProfile();
  currentViewName = target;
}

export function toggleSettingsView(){
  const active = getActiveViewName();
  if(active === 'settings'){
    showView(previousContentViewName || 'game');
    return;
  }
  showView('settings');
}

export function initViewNavigation(){
  document.querySelectorAll('[data-view-target]').forEach(button => {
    button.addEventListener('click', () => showView(button.dataset.viewTarget));
  });
  document.querySelectorAll('[data-settings-toggle]').forEach(button => {
    button.addEventListener('click', toggleSettingsView);
  });
}

export function initRulesModal(){
  const button = document.getElementById('rules-accept');
  const modal = document.getElementById('rules-modal');
  if(!button || !modal) return;

  button.addEventListener('click', () => {
    localStorage.setItem('memorabetRulesAccepted', 'true');
    modal.classList.remove('visible');
    modal.setAttribute('aria-hidden', 'true');
  });
}

export function showRulesModalIfNeeded(){
  const modal = document.getElementById('rules-modal');
  if(!modal) return;
  if(localStorage.getItem('memorabetRulesAccepted') === 'true') return;
  modal.classList.add('visible');
  modal.setAttribute('aria-hidden', 'false');
}
