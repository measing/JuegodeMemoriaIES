import { K_MAX, TOTAL_PAIRS } from './constants.js?v=73';
import { gameState, session } from './state.js?v=74';
import { escapeHTML } from './utils.js?v=73';
import { t } from './i18n.js?v=8';
import { syncFirebaseLeaderboardEntry } from './firebase-service.js?v=1';

const SOLO_LEADERBOARD_KEY = 'memorabetSoloLeaderboard';
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

function normalizeSoloLeaderboard(ranking){
  return (Array.isArray(ranking) ? ranking : [])
    .filter(item => Number.isFinite(Number(item?.tiempoMs)) && Number.isFinite(Number(item?.intentos)))
    .map(item => {
      const completedAt = Number(item.completedAt) || Date.now();
      return {
        ...item,
        id:String(item.id || `${completedAt}-${Number(item.intentos)}-${Number(item.tiempoMs)}`).replace(/[.#$/[\]]/g, '-'),
        name:String(item.name || session.currentUser?.nickname || t('common.player')).slice(0, 48),
        tiempoMs:Number(item.tiempoMs),
        intentos:Number(item.intentos),
        completedAt,
        source:'solo'
      };
    })
    .sort((a, b) => Number(a.intentos) - Number(b.intentos) || Number(a.tiempoMs) - Number(b.tiempoMs))
    .slice(0, 20);
}

export function replaceSoloLeaderboard(ranking, shouldRender = true){
  const normalized = normalizeSoloLeaderboard(ranking);
  localStorage.setItem(SOLO_LEADERBOARD_KEY, JSON.stringify(normalized));
  session.cachedLeaderboard = normalized;
  if(shouldRender) renderLeaderboard(normalized);
  return normalized;
}

export function addSoloLeaderboardEntry(entry){
  const completedAt = Number(entry?.completedAt) || Date.now();
  const savedEntry = {
    ...entry,
    id:String(entry?.id || `${completedAt}-${Number(entry?.intentos || 0)}-${Number(entry?.tiempoMs || 0)}`).replace(/[.#$/[\]]/g, '-'),
    completedAt,
    source:'solo'
  };
  const ranking = replaceSoloLeaderboard([...getSoloLeaderboard(), savedEntry], false);

  syncFirebaseLeaderboardEntry(savedEntry).catch(() => {});
  return ranking;
}

export function renderLeaderboard(ranking = getSoloLeaderboard()){
  const list = document.getElementById('leaderboard-list');
  if(!list) return;

  session.cachedLeaderboard = ranking;
  if(!ranking.length){
    list.innerHTML = `<p class="empty">${escapeHTML(t('ranking.emptySolo'))}</p>`;
    return;
  }

  list.innerHTML = `
    <section class="ranking-section ranking-section-solo">
      <h2>${escapeHTML(t('ranking.soloTitle'))}</h2>
      ${ranking.map((item, index) => `
        <div class="ranking-item">
          <div class="entry-avatar ranking-avatar"><span>${index + 1}</span></div>
          <div>
            <div class="ranking-name">#${index + 1} ${escapeHTML(item.name || t('common.player'))}</div>
            <div class="ranking-meta">${formatDuration(Number(item.tiempoMs || 0))} &middot; ${escapeHTML(t('ranking.tries', { count:Number(item.intentos || 0) }))}</div>
          </div>
          <div class="ranking-prize">${formatDuration(Number(item.tiempoMs || 0))}</div>
        </div>
      `).join('')}
    </section>
  `;
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

export function showView(viewName){
  const target = viewName || 'game';
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
}

export function initViewNavigation(){
  document.querySelectorAll('[data-view-target]').forEach(button => {
    button.addEventListener('click', () => showView(button.dataset.viewTarget));
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
