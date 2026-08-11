import { session } from './state.js?v=74';
import { escapeHTML } from './utils.js?v=73';

const FIREBASE_CDN_VERSION = '12.17.1';
const USER_RANKING_LIMIT = 20;

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
  cloudLeaderboard:[],
  ready:false,
  initError:null,
  callbacks:{
    getLocalLeaderboard:() => [],
    replaceLocalLeaderboard:() => {}
  }
};

function byBestScore(a, b){
  return Number(a.intentos) - Number(b.intentos) || Number(a.tiempoMs) - Number(b.tiempoMs);
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

function setStatus(message, type = 'info'){
  const status = document.getElementById('firebase-auth-status');
  if(!status) return;
  status.textContent = message;
  status.className = `firebase-auth-status ${type}`;
}

function setAuthBusy(isBusy){
  document.querySelectorAll('[data-firebase-auth-action]').forEach(button => {
    button.disabled = !!isBusy;
    button.classList.toggle('btn-disabled', !!isBusy);
  });
}

function renderAuthState(){
  const signedOut = document.getElementById('firebase-auth-panel');
  const signedIn = document.getElementById('firebase-user-panel');
  const userLabel = document.getElementById('firebase-user-label');
  const user = firebaseState.currentUser;

  if(signedOut) signedOut.hidden = !!user;
  if(signedIn) signedIn.hidden = !user;
  if(userLabel){
    userLabel.textContent = user
      ? (user.displayName || user.email || 'Usuario conectado')
      : 'Sin sesion';
  }
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

async function syncLocalRankingToCloud(){
  if(!firebaseState.ready || !firebaseState.currentUser) return;
  const local = firebaseState.callbacks.getLocalLeaderboard();
  const merged = mergeRankings(firebaseState.cloudLeaderboard, local);
  firebaseState.cloudLeaderboard = merged;
  firebaseState.callbacks.replaceLocalLeaderboard(merged);
  await writeUserRanking(merged);
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
    session.currentUser = { nickname:user.displayName || user.email || 'Jugador' };
    setStatus('Sesion iniciada. Ranking sincronizado con tu usuario.', 'success');
    renderAuthState();
    watchUserRanking();
    await syncLocalRankingToCloud().catch(error => setStatus(friendlyFirebaseError(error), 'danger'));
  }else{
    if(firebaseState.unsubscribeRanking){
      firebaseState.unsubscribeRanking();
      firebaseState.unsubscribeRanking = null;
    }
    firebaseState.cloudLeaderboard = [];
    session.currentUser = { nickname:'Modo solitario' };
    setStatus(firebaseState.ready ? 'Sin sesion. El ranking queda guardado localmente.' : 'Firebase no disponible. Juego local activo.', firebaseState.ready ? 'info' : 'warning');
    renderAuthState();
  }

  document.dispatchEvent(new CustomEvent('firebase-auth-change', { detail:{ user:session.firebaseUser } }));
}

async function createEmailAccount(){
  const email = document.getElementById('firebase-email')?.value.trim();
  const password = document.getElementById('firebase-password')?.value;
  const displayName = document.getElementById('firebase-display-name')?.value.trim();
  if(!email || !password) throw new Error('Ingresa correo y contrasena.');
  const { createUserWithEmailAndPassword, updateProfile } = firebaseState.authApi;
  const credential = await createUserWithEmailAndPassword(firebaseState.auth, email, password);
  if(displayName) await updateProfile(credential.user, { displayName });
  await handleAuthUser(firebaseState.auth.currentUser);
}

async function signInWithEmail(){
  const email = document.getElementById('firebase-email')?.value.trim();
  const password = document.getElementById('firebase-password')?.value;
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

async function runAuthAction(action){
  if(!firebaseState.ready){
    setStatus('Firebase no esta disponible. Revisa la red y vuelve a intentar.', 'warning');
    return;
  }
  setAuthBusy(true);
  try{
    if(action === 'create') await createEmailAccount();
    if(action === 'login') await signInWithEmail();
    if(action === 'google') await signInWithGoogle();
    if(action === 'logout') await signOutUser();
  }catch(error){
    setStatus(friendlyFirebaseError(error), 'danger');
  }finally{
    setAuthBusy(false);
  }
}

function bindAuthUI(){
  document.querySelectorAll('[data-firebase-auth-action]').forEach(button => {
    button.addEventListener('click', () => runAuthAction(button.dataset.firebaseAuthAction));
  });
  renderAuthState();
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
    authMod.onAuthStateChanged(firebaseState.auth, user => {
      handleAuthUser(user).catch(error => setStatus(friendlyFirebaseError(error), 'danger'));
    });
    setStatus('Firebase listo. Puedes iniciar sesion para sincronizar ranking.', 'success');
  }catch(error){
    firebaseState.initError = error;
    firebaseState.ready = false;
    session.firebaseReady = false;
    setStatus('Firebase no disponible. El juego y ranking local siguen activos.', 'warning');
  }
}

export function syncFirebaseLeaderboardEntry(entry){
  const normalized = normalizeEntry(entry);
  if(!normalized || !firebaseState.ready || !firebaseState.currentUser) return Promise.resolve(false);

  const merged = mergeRankings(firebaseState.cloudLeaderboard, firebaseState.callbacks.getLocalLeaderboard(), [normalized]);
  firebaseState.cloudLeaderboard = merged;
  return writeUserRanking(merged)
    .then(() => true)
    .catch(error => {
      setStatus(friendlyFirebaseError(error), 'danger');
      return false;
    });
}

export function getFirebaseUserLabel(){
  const user = firebaseState.currentUser;
  return user ? escapeHTML(user.displayName || user.email || 'Jugador conectado') : '';
}
