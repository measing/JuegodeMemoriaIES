import { session } from './state.js?v=74';
import { escapeHTML } from './utils.js?v=73';

const FIREBASE_CDN_VERSION = '12.17.1';
const USER_RANKING_LIMIT = 20;
const GLOBAL_RANKING_LIMIT = 8;
const GLOBAL_RANKING_PATH = 'publicSoloLeaderboard';

const firebaseConfig = {
  apiKey: "AIzaSyBlS57whvjjsE3TLCYIP04zbemXealon6Q",
  authDomain: "juegodememoriaies.firebaseapp.com",
  databaseURL: "https://juegodememoriaies-default-rtdb.firebaseio.com",
  projectId: "juegodememoriaies",
  storageBucket: "juegodememoriaies.firebasestorage.app",
  messagingSenderId: "1023595443151",
  appId: "1:1023595443151:web:587d1a8c490b50143b18ba"
};

const firebaseState = {
  app:null,
  auth:null,
  db:null,
  authApi:null,
  dbApi:null,
  currentUser:null,
  unsubscribeRanking:null,
  unsubscribeGlobalRanking:null,
  cloudLeaderboard:[],
  globalLeaderboard:[],
  ready:false,
  initError:null,
  authMode:'choice',
  guestMode:false,
  callbacks:{
    getLocalLeaderboard:() => [],
    replaceLocalLeaderboard:() => {}
  }
};

function byBestScore(a, b){
  return Number(a.intentos) - Number(b.intentos) || Number(a.tiempoMs) - Number(b.tiempoMs);
}

function byGlobalScore(a, b){
  return Number(b.pairs || 0) - Number(a.pairs || 0)
    || Number(a.intentos || 999) - Number(b.intentos || 999)
    || Number(a.tiempoMs || Number.MAX_SAFE_INTEGER) - Number(b.tiempoMs || Number.MAX_SAFE_INTEGER)
    || Number(b.updatedAt || 0) - Number(a.updatedAt || 0);
}

function formatDuration(ms){
  const totalSeconds = Math.max(0, Math.floor(Number(ms || 0) / 1000));
  const minutes = Math.floor(totalSeconds / 60).toString().padStart(2, '0');
  const seconds = (totalSeconds % 60).toString().padStart(2, '0');
  return `${minutes}:${seconds}`;
}

function normalizeEntry(entry){
  const tiempoMs = Number(entry?.tiempoMs);
  const intentos = Number(entry?.intentos);
  if(!Number.isFinite(tiempoMs) || !Number.isFinite(intentos)) return null;

  const completedAt = Number(entry?.completedAt) || Date.now();
  return {
    id:String(entry?.id || `${completedAt}-${intentos}-${tiempoMs}`).replace(/[.#$/[\]]/g, '-'),
    name:String(entry?.name || firebaseState.currentUser?.displayName || firebaseState.currentUser?.email || 'Jugador').slice(0, 48),
    tiempoMs,
    intentos,
    completedAt,
    source:'solo'
  };
}

function normalizeRanking(value){
  const rawEntries = Array.isArray(value) ? value : Object.values(value || {});
  return rawEntries
    .map(normalizeEntry)
    .filter(Boolean)
    .sort(byBestScore)
    .slice(0, USER_RANKING_LIMIT);
}

function safeAlias(value){
  const raw = String(value || 'Jugador').split('@')[0].replace(/[^a-zA-Z0-9 _.-]/g, '').trim();
  return (raw || 'Jugador').slice(0, 24);
}

function normalizeGlobalEntry(entry){
  const tiempoMs = Number(entry?.tiempoMs);
  const intentos = Number(entry?.intentos);
  const pairs = Number(entry?.pairs);
  if(!Number.isFinite(tiempoMs) || !Number.isFinite(intentos) || !Number.isFinite(pairs)) return null;
  return {
    alias:safeAlias(entry?.alias),
    pairs:Math.max(0, Math.min(8, Math.round(pairs))),
    tiempoMs:Math.max(0, tiempoMs),
    intentos:Math.max(1, intentos),
    score:Number(entry?.score || 0),
    updatedAt:Number(entry?.updatedAt || entry?.completedAt || 0)
  };
}

function normalizeGlobalRanking(value){
  const rawEntries = Array.isArray(value) ? value : Object.values(value || {});
  return rawEntries
    .map(normalizeGlobalEntry)
    .filter(Boolean)
    .sort(byGlobalScore)
    .slice(0, GLOBAL_RANKING_LIMIT);
}

function mergeRankings(...rankings){
  const byId = new Map();
  rankings.flat().forEach(entry => {
    const normalized = normalizeEntry(entry);
    if(!normalized) return;
    byId.set(normalized.id, normalized);
  });
  return [...byId.values()].sort(byBestScore).slice(0, USER_RANKING_LIMIT);
}

function rankingToDatabaseValue(ranking){
  return Object.fromEntries(
    normalizeRanking(ranking).map(entry => [entry.id, entry])
  );
}

function currentUserRankingPath(){
  const uid = firebaseState.currentUser?.uid;
  return uid ? `users/${uid}/soloLeaderboard` : '';
}

function currentGlobalRankingPath(){
  const uid = firebaseState.currentUser?.uid;
  return uid ? `${GLOBAL_RANKING_PATH}/${uid}` : '';
}

function setStatus(message, type = 'info'){
  const status = document.getElementById('firebase-auth-status');
  if(!status) return;
  status.textContent = message;
  status.className = `firebase-auth-status ${type}`;
}

function setLiveStatus(message){
  const status = document.getElementById('live-ranking-status');
  if(status) status.textContent = message;
}

function renderLiveLeaderboard(ranking = firebaseState.globalLeaderboard, isLocal = false){
  const list = document.getElementById('live-global-ranking-list');
  if(!list) return;
  const normalized = normalizeGlobalRanking(ranking);
  firebaseState.globalLeaderboard = normalized;
  if(!normalized.length){
    list.innerHTML = '<li class="live-ranking-empty">Sin resultados todavia.</li>';
    setLiveStatus(isLocal ? 'Ranking local de este navegador.' : 'Esperando resultados de Firebase.');
    return;
  }
  list.innerHTML = normalized.map((entry, index) => `
    <li class="live-ranking-row">
      <span class="live-ranking-pos">${index + 1}</span>
      <span class="live-ranking-name">${escapeHTML(entry.alias)}</span>
      <span class="live-ranking-score">${entry.pairs}/8</span>
      <small>${formatDuration(entry.tiempoMs)} · ${Number(entry.intentos)} int.</small>
    </li>
  `).join('');
  setLiveStatus(isLocal ? 'Modo local hasta conectar Firebase.' : 'Actualizado desde Firebase.');
}

function renderLocalLiveFallback(){
  const local = firebaseState.callbacks.getLocalLeaderboard()
    .map(item => ({
      alias:safeAlias(item?.name || session.currentUser?.nickname || 'Jugador'),
      pairs:8,
      tiempoMs:Number(item?.tiempoMs || 0),
      intentos:Number(item?.intentos || 0),
      score:8000 - Number(item?.intentos || 0) * 10,
      updatedAt:Number(item?.completedAt || 0)
    }));
  renderLiveLeaderboard(local, true);
}

function setAuthError(message = ''){
  const error = document.getElementById('nickname-error');
  if(error) error.textContent = message;
}

function setAuthBusy(isBusy){
  document.querySelectorAll('[data-firebase-auth-action]').forEach(button => {
    button.disabled = !!isBusy;
    button.classList.toggle('btn-disabled', !!isBusy);
  });
  const submit = document.getElementById('auth-submit');
  if(submit){
    submit.disabled = !!isBusy;
    submit.classList.toggle('btn-disabled', !!isBusy);
  }
}

function renderAuthState(){
  const user = firebaseState.currentUser;
  const label = user ? (user.displayName || user.email || 'Jugador conectado') : '';
  const profileName = document.getElementById('solo-profile-name');
  const profileStatus = document.getElementById('solo-profile-status');
  const playerAwards = document.querySelector('.player-awards');
  const sidebarLogin = document.getElementById('btn-sidebar-login');
  const settingsAccount = document.getElementById('settings-account-section');
  const settingsAccountName = document.getElementById('settings-account-name');
  const guest = firebaseState.guestMode && !user;

  document.body.classList.toggle('account-connected', !!user);
  document.body.classList.toggle('guest-mode', guest);
  document.documentElement.classList.toggle('account-connected', !!user);
  document.documentElement.classList.toggle('guest-mode', guest);
  if(profileName) profileName.textContent = label || (guest ? 'Invitado solitario' : 'Jugador solitario');
  if(profileStatus){
    profileStatus.textContent = user ? '' : (guest ? 'Invitado' : 'Modo local');
    profileStatus.hidden = !!user;
  }
  if(playerAwards) playerAwards.textContent = user ? 'Ranking solitario sincronizado' : 'Ranking local de juego solitario';
  if(sidebarLogin) sidebarLogin.hidden = !!user;
  if(settingsAccount) settingsAccount.hidden = !user;
  if(settingsAccountName) settingsAccountName.textContent = label || 'Jugador';
}

function friendlyFirebaseError(error){
  const code = String(error?.code || '');
  if(code.includes('auth/operation-not-allowed')){
    return 'Ese proveedor no esta habilitado. Activa Email/Password o Google en Firebase Console.';
  }
  if(code.includes('auth/unauthorized-domain')){
    return 'Dominio no autorizado. Agrega localhost, 127.0.0.1 y el dominio final en Firebase Authentication.';
  }
  if(code.includes('auth/popup-closed-by-user')){
    return 'La ventana de Google se cerro antes de completar el inicio de sesion.';
  }
  if(code.includes('auth/popup-blocked')){
    return 'El navegador bloqueo la ventana emergente de Google.';
  }
  if(code.includes('auth/email-already-in-use')) return 'Ese correo ya tiene cuenta. Usa Iniciar sesion.';
  if(code.includes('auth/invalid-credential') || code.includes('auth/wrong-password')) return 'Correo o contrasena incorrectos.';
  if(code.includes('auth/invalid-email')) return 'Correo invalido.';
  if(code.includes('auth/weak-password')) return 'La contrasena debe tener al menos 6 caracteres.';
  if(code.includes('PERMISSION_DENIED')) return 'Firebase rechazo la escritura. Revisa las reglas de Realtime Database.';
  return error?.message || 'Firebase no esta disponible. El juego local sigue activo.';
}

function setAuthMode(mode = 'choice'){
  firebaseState.authMode = mode;
  const isChoice = mode === 'choice';
  const isCreate = mode === 'create';
  const isLogin = mode === 'login';
  const tabs = document.getElementById('auth-tabs');
  const loginTab = document.getElementById('tab-login');
  const registerTab = document.getElementById('tab-register');
  const back = document.getElementById('auth-back');
  const nickname = document.getElementById('auth-nickname');
  const email = document.getElementById('auth-email');
  const password = document.getElementById('auth-password');
  const submit = document.getElementById('auth-submit');
  const copy = document.getElementById('auth-copy');

  if(tabs){
    tabs.style.display = isChoice ? 'grid' : 'none';
    tabs.classList.toggle('choice-mode', isChoice);
  }
  loginTab?.classList.toggle('active', isLogin);
  registerTab?.classList.toggle('active', isCreate);
  if(back) back.style.display = isChoice ? 'none' : 'inline-flex';
  if(nickname) nickname.style.display = isCreate ? 'block' : 'none';
  if(email) email.style.display = isChoice ? 'none' : 'block';
  if(password) password.style.display = isChoice ? 'none' : 'block';
  if(submit){
    submit.style.display = isChoice ? 'none' : 'flex';
    submit.textContent = isCreate ? 'Crear cuenta' : 'Iniciar sesion';
  }
  if(copy){
    if(isCreate) copy.textContent = 'Crea una cuenta para sincronizar tu ranking solitario.';
    else if(isLogin) copy.textContent = 'Ingresa con tu correo para recuperar tu ranking solitario.';
    else copy.textContent = 'Guarda tu ranking solitario y recuperalo cuando vuelvas a jugar.';
  }
  setAuthError('');
}

function showAuthModal(mode = 'choice'){
  const modal = document.getElementById('auth-modal');
  if(!modal) return;
  document.body.classList.add('auth-modal-open');
  modal.style.display = 'flex';
  modal.setAttribute('aria-hidden', 'false');
  setAuthMode(mode);
  window.setTimeout(() => {
    const target = mode === 'choice'
      ? document.getElementById('tab-login')
      : mode === 'create'
      ? document.getElementById('auth-nickname')
      : document.getElementById('auth-email');
    target?.focus();
  }, 40);
}

function hideAuthModal(){
  if(!firebaseState.currentUser && !firebaseState.guestMode) return;
  const modal = document.getElementById('auth-modal');
  if(!modal) return;
  document.body.classList.remove('auth-modal-open');
  modal.style.display = 'none';
  modal.setAttribute('aria-hidden', 'true');
  setAuthError('');
}

function enterGuestMode(){
  firebaseState.guestMode = true;
  session.firebaseUser = null;
  session.currentUser = { nickname:'Invitado solitario', isGuest:true };
  hideAuthModal();
  renderAuthState();
  document.dispatchEvent(new CustomEvent('firebase-auth-change', { detail:{ user:null, guest:true } }));
}

function getAuthFields(){
  return {
    email:document.getElementById('auth-email')?.value.trim() || '',
    password:document.getElementById('auth-password')?.value || '',
    displayName:document.getElementById('auth-nickname')?.value.trim() || ''
  };
}

async function loadFirebaseModules(){
  const [appMod, authMod, dbMod] = await Promise.all([
    import(`https://www.gstatic.com/firebasejs/${FIREBASE_CDN_VERSION}/firebase-app.js`),
    import(`https://www.gstatic.com/firebasejs/${FIREBASE_CDN_VERSION}/firebase-auth.js`),
    import(`https://www.gstatic.com/firebasejs/${FIREBASE_CDN_VERSION}/firebase-database.js`)
  ]);
  return { appMod, authMod, dbMod };
}

async function writeUserRanking(ranking){
  if(!firebaseState.ready || !firebaseState.currentUser) return;
  const path = currentUserRankingPath();
  if(!path) return;
  const { ref, set } = firebaseState.dbApi;
  await set(ref(firebaseState.db, path), rankingToDatabaseValue(ranking));
}

async function writeGlobalBestEntry(bestEntry){
  if(!firebaseState.ready || !firebaseState.currentUser || !bestEntry) return;
  const normalized = normalizeEntry(bestEntry);
  if(!normalized) return;
  const path = currentGlobalRankingPath();
  if(!path) return;
  const alias = safeAlias(firebaseState.currentUser.displayName || firebaseState.currentUser.email || normalized.name);
  const publicEntry = {
    alias,
    pairs:8,
    tiempoMs:Number(normalized.tiempoMs),
    intentos:Number(normalized.intentos),
    score:Math.max(0, 8000 - Number(normalized.intentos) * 100 - Math.floor(Number(normalized.tiempoMs) / 1000)),
    updatedAt:Number(normalized.completedAt || Date.now())
  };
  const { ref, set } = firebaseState.dbApi;
  await set(ref(firebaseState.db, path), publicEntry);
}

async function syncLocalRankingToCloud(){
  if(!firebaseState.ready || !firebaseState.currentUser) return;
  const local = firebaseState.callbacks.getLocalLeaderboard();
  const merged = mergeRankings(firebaseState.cloudLeaderboard, local);
  firebaseState.cloudLeaderboard = merged;
  firebaseState.callbacks.replaceLocalLeaderboard(merged);
  await writeUserRanking(merged);
  await writeGlobalBestEntry(merged[0]).catch(error => setLiveStatus(friendlyFirebaseError(error)));
}

function watchGlobalRanking(){
  if(firebaseState.unsubscribeGlobalRanking){
    firebaseState.unsubscribeGlobalRanking();
    firebaseState.unsubscribeGlobalRanking = null;
  }
  if(!firebaseState.ready) return;
  const { ref, onValue } = firebaseState.dbApi;
  firebaseState.unsubscribeGlobalRanking = onValue(ref(firebaseState.db, GLOBAL_RANKING_PATH), snapshot => {
    renderLiveLeaderboard(normalizeGlobalRanking(snapshot.val()), false);
  }, error => {
    setLiveStatus(friendlyFirebaseError(error));
    renderLocalLiveFallback();
  });
}

function watchUserRanking(){
  if(firebaseState.unsubscribeRanking){
    firebaseState.unsubscribeRanking();
    firebaseState.unsubscribeRanking = null;
  }

  const path = currentUserRankingPath();
  if(!path) return;

  const { ref, onValue } = firebaseState.dbApi;
  firebaseState.unsubscribeRanking = onValue(ref(firebaseState.db, path), snapshot => {
    const remote = normalizeRanking(snapshot.val());
    const local = firebaseState.callbacks.getLocalLeaderboard();
    const merged = mergeRankings(remote, local);
    firebaseState.cloudLeaderboard = merged;
    firebaseState.callbacks.replaceLocalLeaderboard(merged);
    if(JSON.stringify(remote) !== JSON.stringify(merged)){
      writeUserRanking(merged).catch(error => setStatus(friendlyFirebaseError(error), 'danger'));
    }
  }, error => {
    setStatus(friendlyFirebaseError(error), 'danger');
  });
}

async function handleAuthUser(user){
  firebaseState.currentUser = user || null;
  session.firebaseUser = user ? {
    uid:user.uid,
    email:user.email || '',
    displayName:user.displayName || ''
  } : null;

  if(user){
    firebaseState.guestMode = false;
    session.currentUser = { nickname:user.displayName || user.email || 'Jugador' };
    setStatus('Sesion iniciada. Ranking sincronizado con tu usuario.', 'success');
    setAuthError('');
    hideAuthModal();
    renderAuthState();
    watchUserRanking();
    await syncLocalRankingToCloud().catch(error => setStatus(friendlyFirebaseError(error), 'danger'));
  }else{
    if(firebaseState.unsubscribeRanking){
      firebaseState.unsubscribeRanking();
      firebaseState.unsubscribeRanking = null;
    }
    firebaseState.cloudLeaderboard = [];
    session.currentUser = firebaseState.guestMode
      ? { nickname:'Invitado solitario', isGuest:true }
      : { nickname:'Modo solitario' };
    setStatus(firebaseState.ready ? 'Sin sesion. El ranking queda guardado localmente.' : 'Firebase no disponible. Juego local activo.', firebaseState.ready ? 'info' : 'warning');
    renderAuthState();
    if(!firebaseState.guestMode) window.setTimeout(() => showAuthModal('choice'), 80);
  }

  document.dispatchEvent(new CustomEvent('firebase-auth-change', { detail:{ user:session.firebaseUser } }));
}

async function createEmailAccount(){
  const { email, password, displayName } = getAuthFields();
  if(!email || !password) throw new Error('Ingresa correo y contrasena.');
  if(displayName && (displayName.length < 3 || displayName.length > 24)) throw new Error('El nombre debe tener entre 3 y 24 caracteres.');
  const { createUserWithEmailAndPassword, updateProfile } = firebaseState.authApi;
  const credential = await createUserWithEmailAndPassword(firebaseState.auth, email, password);
  if(displayName) await updateProfile(credential.user, { displayName });
  await handleAuthUser(firebaseState.auth.currentUser);
}

async function signInWithEmail(){
  const { email, password } = getAuthFields();
  if(!email || !password) throw new Error('Ingresa correo y contrasena.');
  const { signInWithEmailAndPassword } = firebaseState.authApi;
  await signInWithEmailAndPassword(firebaseState.auth, email, password);
}

async function signInWithGoogle(){
  const { GoogleAuthProvider, signInWithPopup } = firebaseState.authApi;
  const provider = new GoogleAuthProvider();
  await signInWithPopup(firebaseState.auth, provider);
}

async function signOutUser(){
  const { signOut } = firebaseState.authApi;
  await signOut(firebaseState.auth);
}

function bindLiveRankingUI(){
  const toggle = document.getElementById('live-ranking-toggle');
  if(!toggle) return;
  toggle.addEventListener('click', () => {
    const isOpen = !document.body.classList.contains('live-ranking-open');
    document.body.classList.toggle('live-ranking-open', isOpen);
    toggle.setAttribute('aria-expanded', String(isOpen));
  });
}

async function runAuthAction(action){
  if(action === 'google' && document.getElementById('auth-modal')?.style.display !== 'flex'){
    showAuthModal('choice');
  }
  if(!firebaseState.ready){
    setStatus('Firebase no esta disponible. Revisa la red y vuelve a intentar.', 'warning');
    setAuthError('Firebase no esta disponible. Puedes volver al juego local.');
    return;
  }
  setAuthBusy(true);
  try{
    if(action === 'create') await createEmailAccount();
    if(action === 'login') await signInWithEmail();
    if(action === 'google') await signInWithGoogle();
    if(action === 'logout' || action === 'switch'){
      firebaseState.guestMode = false;
      await signOutUser();
      showAuthModal('choice');
    }
  }catch(error){
    const message = friendlyFirebaseError(error);
    setStatus(message, 'danger');
    setAuthError(message);
  }finally{
    setAuthBusy(false);
  }
}

function bindAuthUI(){
  bindLiveRankingUI();
  document.querySelectorAll('[data-firebase-auth-action]').forEach(button => {
    button.addEventListener('click', () => runAuthAction(button.dataset.firebaseAuthAction));
  });
  document.querySelectorAll('[data-firebase-auth-open]').forEach(button => {
    button.addEventListener('click', () => showAuthModal(button.dataset.firebaseAuthOpen || 'choice'));
  });
  document.querySelectorAll('[data-firebase-auth-mode]').forEach(button => {
    button.addEventListener('click', () => setAuthMode(button.dataset.firebaseAuthMode || 'choice'));
  });
  document.getElementById('auth-submit')?.addEventListener('click', () => {
    runAuthAction(firebaseState.authMode === 'create' ? 'create' : 'login');
  });
  document.getElementById('auth-back')?.addEventListener('click', () => setAuthMode('choice'));
  document.getElementById('auth-guest')?.addEventListener('click', enterGuestMode);
  document.getElementById('auth-close')?.addEventListener('click', enterGuestMode);
  document.getElementById('auth-modal')?.addEventListener('click', event => {
    if(event.target?.id === 'auth-modal') hideAuthModal();
  });
  document.addEventListener('keydown', event => {
    if(event.key === 'Escape' && document.getElementById('auth-modal')?.style.display === 'flex') hideAuthModal();
  });
  setAuthMode('choice');
  renderAuthState();
  renderLocalLiveFallback();
  showAuthModal('choice');
}

export async function initFirebaseIntegration(callbacks = {}){
  firebaseState.callbacks = { ...firebaseState.callbacks, ...callbacks };
  bindAuthUI();
  setStatus('Conectando con Firebase...', 'info');

  try{
    const { appMod, authMod, dbMod } = await loadFirebaseModules();
    firebaseState.app = appMod.initializeApp(firebaseConfig);
    firebaseState.auth = authMod.getAuth(firebaseState.app);
    firebaseState.db = dbMod.getDatabase(firebaseState.app);
    firebaseState.authApi = authMod;
    firebaseState.dbApi = dbMod;
    firebaseState.ready = true;
    session.firebaseReady = true;
    watchGlobalRanking();
    authMod.onAuthStateChanged(firebaseState.auth, user => {
      handleAuthUser(user).catch(error => setStatus(friendlyFirebaseError(error), 'danger'));
    });
    setStatus('Firebase listo. Puedes iniciar sesion para sincronizar ranking.', 'success');
  }catch(error){
    firebaseState.initError = error;
    firebaseState.ready = false;
    session.firebaseReady = false;
    setStatus('Firebase no disponible. El juego y ranking local siguen activos.', 'warning');
    showAuthModal('choice');
    setAuthError('Firebase no esta disponible. Puedes jugar como invitado e intentarlo despues.');
  }
}

export function syncFirebaseLeaderboardEntry(entry){
  const normalized = normalizeEntry(entry);
  if(!normalized || !firebaseState.ready || !firebaseState.currentUser) return Promise.resolve(false);

  const merged = mergeRankings(firebaseState.cloudLeaderboard, firebaseState.callbacks.getLocalLeaderboard(), [normalized]);
  firebaseState.cloudLeaderboard = merged;
  return writeUserRanking(merged)
    .then(() => writeGlobalBestEntry(merged[0]))
    .then(() => true)
    .catch(error => {
      setStatus(friendlyFirebaseError(error), 'danger');
      setLiveStatus(friendlyFirebaseError(error));
      return false;
    });
}

export function getFirebaseUserLabel(){
  const user = firebaseState.currentUser;
  return user ? escapeHTML(user.displayName || user.email || 'Jugador conectado') : '';
}
