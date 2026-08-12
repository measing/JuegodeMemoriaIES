export const session = {
  currentUser: null,
  cachedLeaderboard: [],
  sharedLeaderboard: []
};

export const gameState = {
  playing:false,
  cards:[],
  flipped:[],
  matched:0,
  intentos:0,
  round:1,
  blocked:false,
  starting:false,
  startTime:0,
  endTime:0,
  gameToken:0,
  resultRecorded:false,
  resultId:'',
  liveStatus:'idle'
};

export function resetGameState(){
  gameState.playing = false;
  gameState.cards = [];
  gameState.flipped = [];
  gameState.matched = 0;
  gameState.intentos = 0;
  gameState.round = 1;
  gameState.blocked = false;
  gameState.starting = false;
  gameState.startTime = 0;
  gameState.endTime = 0;
  gameState.gameToken++;
  gameState.resultRecorded = false;
  gameState.resultId = '';
  gameState.liveStatus = 'idle';
}
