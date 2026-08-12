import { ANIMAL_CARDS, K_MAX, TOTAL_PAIRS } from './constants.js?v=73';
import { gameState, session } from './state.js?v=76';
import { shuffle, wait } from './utils.js?v=73';
import {
  renderBoard,
  updateCardClasses,
  updateStats,
  showMsg,
  hideMsg,
  clearBoard,
  setNewGameButtonBusy,
  showVictoryAnimation,
  formatDuration,
  addSoloLeaderboardEntry,
  renderLeaderboard,
  showRulesModalIfNeeded
} from './ui.js?v=121';
import { playCardFlip, playShuffle, playMatch, playMiss } from './audio.js?v=75';
import { t } from './i18n.js?v=11';

const VISIBLE_SHUFFLE_SWAPS = [
  [0, 5], [3, 10], [12, 7], [15, 2],
  [1, 8], [6, 14], [4, 11], [9, 13],
  [5, 10], [2, 7], [0, 12], [3, 15]
];

function dispatchSoloProgress(status = gameState.liveStatus || 'playing'){
  if(!gameState.resultId) return;
  gameState.liveStatus = status;
  const now = Date.now();
  document.dispatchEvent(new CustomEvent('solo-progress-update', {
    detail:{
      id:gameState.resultId,
      name:session.currentUser?.nickname || t('common.player'),
      pairs:gameState.matched,
      intentos:gameState.intentos,
      tiempoMs:gameState.startTime ? Math.max(0, now - gameState.startTime) : 0,
      status,
      completed:gameState.matched === TOTAL_PAIRS,
      updatedAt:now
    }
  }));
}

function buildDeck(){
  return shuffle([...ANIMAL_CARDS, ...ANIMAL_CARDS]).map((animal, index) => ({
    id:index,
    animalId:animal.id,
    name:animal.name,
    src:animal.src,
    flipped:true,
    matched:false
  }));
}

async function animateVisibleSwap(a, b, token = gameState.gameToken){
  if(token !== gameState.gameToken) return false;
  const board = document.getElementById('board');
  if(!board) return false;
  const cards = [...board.querySelectorAll('.card-wrap')];
  const elA = cards[a];
  const elB = cards[b];
  if(!elA || !elB || elA === elB) return false;
  playShuffle();

  const firstA = elA.getBoundingClientRect();
  const firstB = elB.getBoundingClientRect();

  const marker = document.createComment('swap-marker');
  board.insertBefore(marker, elA);
  board.insertBefore(elA, elB);
  board.insertBefore(elB, marker);
  board.removeChild(marker);

  const lastA = elA.getBoundingClientRect();
  const lastB = elB.getBoundingClientRect();

  elA.style.transition = 'none';
  elB.style.transition = 'none';
  elA.style.transform = `translate(${firstA.left - lastA.left}px, ${firstA.top - lastA.top}px) scale(1.04)`;
  elB.style.transform = `translate(${firstB.left - lastB.left}px, ${firstB.top - lastB.top}px) scale(1.04)`;
  elA.style.zIndex = '50';
  elB.style.zIndex = '51';

  await wait(35);
  if(token !== gameState.gameToken) return false;

  elA.style.transition = 'transform .66s cubic-bezier(.18,.86,.24,1)';
  elB.style.transition = 'transform .66s cubic-bezier(.18,.86,.24,1)';
  elA.style.transform = 'translate(0, 0) scale(1)';
  elB.style.transform = 'translate(0, 0) scale(1)';

  await wait(700);
  if(token !== gameState.gameToken) return false;

  elA.style.transition = '';
  elB.style.transition = '';
  elA.style.transform = '';
  elB.style.transform = '';
  elA.style.zIndex = '';
  elB.style.zIndex = '';
  return true;
}

async function animateShuffle(token){
  const board = document.getElementById('board');
  if(!board) return false;
  board.classList.add('shuffling');

  try{
    for(const [a, b] of VISIBLE_SHUFFLE_SWAPS){
      if(token !== gameState.gameToken) return false;
      const moved = await animateVisibleSwap(a, b, token);
      if(!moved || token !== gameState.gameToken) return false;
      if(!gameState.cards[a] || !gameState.cards[b]) return false;
      const tmp = gameState.cards[a];
      gameState.cards[a] = gameState.cards[b];
      gameState.cards[b] = tmp;
      await wait(65);
    }

    gameState.cards = gameState.cards.map((card, index) => ({
      ...card,
      id:index,
      flipped:false,
      matched:false
    }));
    renderBoard(flipCard);
    return token === gameState.gameToken;
  }finally{
    board.classList.remove('shuffling');
  }
}

async function prepareGame(){
  if(gameState.starting){
    showMsg(t('msg.preparing'), 'warning');
    return;
  }

  const token = ++gameState.gameToken;
  gameState.playing = false;
  gameState.blocked = true;
  gameState.starting = true;
  gameState.cards = buildDeck();
  gameState.flipped = [];
  gameState.matched = 0;
  gameState.intentos = 0;
  gameState.round = Math.max(1, Number(gameState.round || 1));
  gameState.startTime = 0;
  gameState.endTime = 0;
  gameState.resultRecorded = false;
  gameState.resultId = `${token}-${Date.now()}`;
  gameState.liveStatus = 'preparing';

  setNewGameButtonBusy(true);
  renderBoard(flipCard);
  updateStats();
  dispatchSoloProgress('preparing');
  showRulesModalIfNeeded();
  showMsg(t('msg.memorize'), 'info');

  await wait(5000);
  if(token !== gameState.gameToken) return;

  showMsg(t('msg.hiding'), 'warning');
  gameState.cards.forEach(card => card.flipped = false);
  updateCardClasses();

  await wait(650);
  if(token !== gameState.gameToken) return;

  showMsg(t('msg.shuffling'), 'warning');
  const shuffled = await animateShuffle(token);
  if(!shuffled || token !== gameState.gameToken) return;

  gameState.playing = true;
  gameState.blocked = false;
  gameState.starting = false;
  gameState.startTime = Date.now();
  gameState.liveStatus = 'playing';
  setNewGameButtonBusy(false);
  renderBoard(flipCard);
  updateStats();
  dispatchSoloProgress('playing');
  showMsg(t('msg.play'), 'success');
}

export async function startSelectedGame(){
  try{
    await prepareGame();
  }catch(error){
    console.warn('MemoraBet solo start failed:', error);
    gameState.starting = false;
    gameState.blocked = false;
    setNewGameButtonBusy(false);
    updateStats();
    showMsg(error?.message || t('msg.startFailed'), 'danger');
  }
}

export function flipCard(id){
  if(!gameState.playing || gameState.blocked) return;
  const token = gameState.gameToken;
  const card = gameState.cards[id];
  if(!card || card.flipped || card.matched || gameState.flipped.length >= 2) return;

  playCardFlip();
  card.flipped = true;
  gameState.flipped.push(id);
  const el = document.querySelector(`.card-wrap[data-id="${id}"]`);
  if(el) el.classList.add('flipped');

  if(gameState.flipped.length !== 2) return;

  gameState.blocked = true;
  gameState.intentos++;
  updateStats();
  dispatchSoloProgress('playing');

  const [a, b] = gameState.flipped.map(index => gameState.cards[index]);
  if(a.animalId === b.animalId){
    playMatch();
    setTimeout(() => {
      if(token !== gameState.gameToken) return;
      a.matched = true;
      b.matched = true;
      a.flipped = false;
      b.flipped = false;
      gameState.matched++;
      gameState.flipped = [];
      gameState.blocked = false;
      renderBoard(flipCard);
      updateStats();
      dispatchSoloProgress('playing');

      if(gameState.matched === TOTAL_PAIRS) endGame();
      else showMsg(t('msg.pairFound'), 'success');
    }, 520);
    return;
  }

  playMiss();
  const wA = document.querySelector(`.card-wrap[data-id="${gameState.flipped[0]}"]`);
  const wB = document.querySelector(`.card-wrap[data-id="${gameState.flipped[1]}"]`);
  wA?.classList.add('wrong');
  wB?.classList.add('wrong');

  setTimeout(() => {
    if(token !== gameState.gameToken) return;
    a.flipped = false;
    b.flipped = false;
    gameState.flipped = [];
    gameState.blocked = false;
    wA?.classList.remove('wrong', 'flipped');
    wB?.classList.remove('wrong', 'flipped');

    if(gameState.intentos >= K_MAX) endGame();
    else{
      dispatchSoloProgress('playing');
      showMsg(t('msg.noPair', { count:K_MAX - gameState.intentos }), 'warning');
    }
  }, 820);
}

export function endGame(){
  if(!gameState.playing && gameState.endTime) return;
  if(gameState.resultRecorded) return;

  gameState.playing = false;
  gameState.blocked = true;
  gameState.starting = false;
  gameState.endTime = Date.now();
  gameState.resultRecorded = true;
  setNewGameButtonBusy(false);

  const completed = gameState.matched === TOTAL_PAIRS;
  const tiempoMs = gameState.startTime ? gameState.endTime - gameState.startTime : 0;
  const savedRanking = addSoloLeaderboardEntry({
    id:gameState.resultId || `${gameState.gameToken}-${gameState.startTime || gameState.endTime}`,
    name:session.currentUser?.nickname || t('common.player'),
    tiempoMs,
    intentos:gameState.intentos,
    pairs:gameState.matched,
    completed,
    completedAt:Date.now()
  });
  dispatchSoloProgress(completed ? 'completed' : 'finished');
  renderLeaderboard(savedRanking);

  if(completed){
    showMsg(t('msg.completed', {
      time:formatDuration(tiempoMs),
      tries:gameState.intentos
    }), 'success');
    showVictoryAnimation({ tiempoMs, intentos:gameState.intentos });
  }else{
    showMsg(t('msg.finished', {
      matched:gameState.matched,
      total:TOTAL_PAIRS
    }), 'danger');
  }

  gameState.round++;
  updateStats();
}

export function resetGame(){
  const shouldMarkLeft = gameState.resultId && !gameState.resultRecorded && (gameState.starting || gameState.playing || gameState.cards.length > 0);
  if(shouldMarkLeft) dispatchSoloProgress('left');
  gameState.gameToken++;
  gameState.playing = false;
  gameState.blocked = false;
  gameState.starting = false;
  gameState.cards = [];
  gameState.flipped = [];
  gameState.matched = 0;
  gameState.intentos = 0;
  gameState.startTime = 0;
  gameState.endTime = 0;
  gameState.resultRecorded = false;
  gameState.resultId = '';
  gameState.liveStatus = 'idle';
  setNewGameButtonBusy(false);
  clearBoard();
  updateStats();
  showMsg(t('msg.reset'), 'info');
}

export function exitGame(){
  resetGame();
  hideMsg();
  showMsg(t('msg.leftGame'), 'info');
}


