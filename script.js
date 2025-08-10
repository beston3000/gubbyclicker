// ================= CONFIG (inlined) =================
const firebaseConfig = {
  apiKey: "AIzaSyAai5V9VTtPnAdMoAhhVe94fobPOY25yf8",
  authDomain: "gubby-clicker.firebaseapp.com",
  projectId: "gubby-clicker",
  storageBucket: "gubby-clicker.firebasestorage.app",
  messagingSenderId: "255072290621",
  appId: "1:255072290621:web:9f80676beac50c0059a754",
  measurementId: "G-R3HFMPH5C4"
};

// initialize firebase (compat)
if (window.firebase && !firebase.apps.length) {
  firebase.initializeApp(firebaseConfig);
}

// ================= STATE =================
const defaultState = {
  name:'Gubby',
  variant:'default.png',
  pos:{x:340,y:220},
  hunger:80, thirst:80, energy:100, alive:true,
  clicks:0, totalClicks:0,
  upgrades:{clickPower:1, autoClicks:0, multipliers:[]},
  backpack:{ food:5, water:5, cola:2 },
  lastUpdated: Date.now()
};
let state = loadLocalState(); // working copy
let user = null, auth = null, db = null;
let currentRoom = null, roomUnsub=null, membersUnsub=null, messagesUnsub=null;
let myId = randomId(), writeTimer=null;
const WRITE_DEBOUNCE_MS = 600;

// price multiplier (jack up prices here)
const PRICE_MULT = 100;

// ================= SHOP DATA (50+ items) =================
const baseShopData = [
  {id:'burger', title:'Burger', price:25, tier:'Basic', desc:'Food +1'},
  {id:'waterbottle', title:'Water Bottle', price:20, tier:'Basic', desc:'Water +1'},
  {id:'ball', title:'Bouncy Ball', price:50, tier:'Basic', desc:'Play toy'},
  {id:'smallbowl', title:'Small Bowl', price:80, tier:'Basic', desc:'Reduces hunger decay'},
  {id:'scented_candle', title:'Scented Candle', price:90, tier:'Basic', desc:'Pleasant aroma'},
  {id:'pillow', title:'Pillow', price:75, tier:'Basic', desc:'Small comfort'},
  {id:'blanket', title:'Blanket', price:120, tier:'Basic', desc:'Cozy'},
  {id:'snackbox', title:'Snack Box', price:180, tier:'Basic', desc:'Mixed snacks'},
  {id:'soda_pack', title:'Cola Pack', price:350, tier:'Basic', desc:'+2 Cola'},
  {id:'plushie', title:'Plushie', price:200, tier:'Basic', desc:'Cute friend'},
  {id:'toy2', title:'Squeaky Toy', price:120, tier:'Basic', desc:'Play toy'},
  {id:'clicker1', title:'Click Power +1', price:200, tier:'Upgrades', desc:'Increase click power'},
  {id:'auto1', title:'Auto-Clicker +1', price:800, tier:'Upgrades', desc:'+1 auto click'},
  {id:'treats', title:'Treats (10)', price:300, tier:'Upgrades', desc:'Bulk snacks'},
  {id:'laser_toy', title:'Laser Toy', price:480, tier:'Upgrades', desc:'Fun and energizing'},
  {id:'bowl2', title:'Silver Bowl', price:400, tier:'Upgrades', desc:'Better food efficiency'},
  {id:'microphone', title:'DJ Microphone', price:480, tier:'Upgrades', desc:'Music multiplier chance'},
  {id:'auto_feeder2', title:'Auto-Feeder Mk II', price:2400, tier:'Upgrades', desc:'+5 auto clicks'},
  {id:'bed', title:'Cozy Bed', price:350, tier:'Upgrades', desc:'Energy recovers faster'},
  {id:'mini_farm', title:'Mini Farm', price:2200, tier:'Quality', desc:'Generates food slowly'},
  {id:'garden', title:'Garden', price:750, tier:'Quality', desc:'Auto grow snacks'},
  {id:'neon_sign', title:'Neon Gubby Sign', price:700, tier:'Quality', desc:'Stylish'},
  {id:'lux_cushion', title:'Luxury Cushion', price:900, tier:'Quality', desc:'Comfort'},
  {id:'fountain', title:'Fountain', price:650, tier:'Quality', desc:'Relaxing water feature'},
  {id:'trainer', title:'Personal Trainer', price:1200, tier:'Quality', desc:'+2 energy during day'},
  {id:'fancy_plate', title:'Fancy Plate', price:1100, tier:'Quality', desc:'Fine dining'},
  {id:'mystic_hat', title:'Mystic Hat', price:1300, tier:'Quality', desc:'Looks mysterious'},
  {id:'zen_garden', title:'Zen Garden', price:1400, tier:'Quality', desc:'Relaxation'},
  {id:'orb', title:'Mystic Orb', price:4200, tier:'Endgame', desc:'Weird energies'},
  {id:'quantum_seed', title:'Quantum Seed', price:5200, tier:'Endgame', desc:'Grows unpredictable snacks'},
  {id:'time_clock', title:'Time Clock', price:12000, tier:'Endgame', desc:'Time-warping clock'},
  {id:'particle_accel', title:'Particle Gubby Accelerator', price:15000, tier:'Endgame', desc:'Speeds up everything'},
  {id:'wormhole_portal', title:'Wormhole Snack Portal', price:22000, tier:'Endgame', desc:'Spawns rare snacks'},
  {id:'blackhole_tank', title:'Black Hole Fish Tank', price:20000, tier:'Endgame', desc:'Attracts cosmic pets'},
  {id:'quantum_accel', title:'Quantum Accelerator', price:30000, tier:'Endgame', desc:'Breaks time for clicks'},
  {id:'immortal_treat', title:'Immortal Treat', price:99999, tier:'Endgame', desc:'Gubby never gets hungry'},
  {id:'gold_spoon', title:'Golden Feeding Spoon', price:2500, tier:'Luxury', desc:'Stylish and effective'},
  {id:'meteor_bed', title:'Meteor Rock Bed', price:3200, tier:'Luxury', desc:'Very comfy'},
  {id:'mansion', title:'Gubby Mansion', price:8000, tier:'Luxury', desc:'Luxury housing'},
  {id:'quantum_fig', title:'Quantum Fish Figurine', price:4200, tier:'Luxury', desc:'Strange properties'},
  {id:'rocket_bed', title:'Rocket Bed', price:7600, tier:'Luxury', desc:'Bed with propulsion'},
  {id:'galaxy_pendant', title:'Galaxy Pendant', price:42000, tier:'Endgame', desc:'Very endgame'},
  {id:'gold_chalice', title:'Gold Chalice', price:5000, tier:'Luxury', desc:'Fancy drinking'},
  {id:'mystic_clock', title:'Mystic Clock', price:2400, tier:'Quality', desc:'Tick tocks nicely'},
  {id:'mini_farm2', title:'Greenhouse', price:4600, tier:'Quality', desc:'Faster farm'},
  {id:'snack_vending', title:'Snack Vending Machine', price:9800, tier:'Luxury', desc:'Auto snacks'},
  {id:'galactic_bowl', title:'Galactic Bowl', price:21000, tier:'Endgame', desc:'Mystic bowl'}
];
const shopData = baseShopData.map(s => ({ ...s, price: Math.max(1, Math.round(s.price * PRICE_MULT)) }));

// list of tiers to show
const tiers = Array.from(new Set(shopData.map(s=>s.tier)));

// ================= UTIL =================
function el(id){ return document.getElementById(id); }
function randomId(){ return Math.random().toString(36).slice(2,9); }
function saveLocalState(){ try{ state.lastUpdated = Date.now(); localStorage.setItem('gubby_single_local', JSON.stringify(state)); }catch(e){} }
function loadLocalState(){ try{ const raw = localStorage.getItem('gubby_single_local'); if(raw) return JSON.parse(raw);}catch(e){} return JSON.parse(JSON.stringify(defaultState)); }
function clamp(v){ return Math.max(0, Math.min(100, Math.round(v))); }

function applyUI(){
  try{
    el('hungerVal').textContent = Math.round(state.hunger);
    el('thirstVal').textContent = Math.round(state.thirst);
    el('energyVal').textContent = Math.round(state.energy);
    el('hungerFill').style.width = clamp(state.hunger) + '%';
    el('thirstFill').style.width = clamp(state.thirst) + '%';
    el('energyFill').style.width = clamp(state.energy) + '%';
    el('clickCounter') && (el('clickCounter').textContent = state.totalClicks || 0);
    if (el('gubbySprite')) {
      el('gubbySprite').src = 'sprites/variants/' + (state.variant || 'default.png');
      el('gubbySprite').style.pointerEvents = 'auto';
      el('gubbySprite').style.zIndex = 40;
    }
    el('accountInfo').textContent = user ? (user.displayName || user.email) : 'Not signed in';
    el('authArea').textContent = user ? (user.displayName || user.email) : 'Not signed in';
  }catch(e){ console.warn('applyUI failed', e); }
}
applyUI();

// ================= FIREBASE INIT =================
function initFirebase(){
  try{
    if(window.firebase && !db){
      auth = firebase.auth();
      db = firebase.firestore();

      auth.onAuthStateChanged(async u => {
        user = u;
        if(user){
          el('signInBtn').style.display = 'none';
          // load singleplayer server copy if exists
          await loadSingleplayerFromServer().catch(()=>{});
        } else {
          el('signInBtn').style.display = 'inline-block';
          // restore local singleplayer
          state = loadLocalState();
          applyUI();
        }
      });

      // variants listener (optional)
      db.collection('variants').onSnapshot(snap => {
        renderVariants(snap.docs.map(d => ({ id:d.id, ...d.data() })));
      }, ()=>{});

    }
  }catch(e){
    console.error('init firebase failed', e);
  }
}
initFirebase();

// ================= AUTH UI =================
el('signInBtn')?.addEventListener('click', async ()=>{
  try{
    if(!db) initFirebase();
    const provider = new firebase.auth.GoogleAuthProvider();
    await firebase.auth().signInWithPopup(provider);
  }catch(e){ alert('Sign-in failed: ' + (e.message||e)); }
});

// ================= SINGLEPLAYER SERVER SYNC =================
async function loadSingleplayerFromServer(){
  if(!auth || !auth.currentUser) return;
  try{
    const ref = db.collection('users').doc(auth.currentUser.uid).collection('singleplayerState').doc('state');
    const snap = await ref.get();
    if(snap.exists){
      const remote = snap.data();
      // merge remote singleplayer to local carefully
      if(remote.lastUpdated && remote.lastUpdated > (state.lastUpdated || 0)) {
        state = Object.assign({}, state, remote);
      } else {
        // local newer — push local up
        await ref.set(Object.assign({}, state), { merge:true });
      }
      saveLocalState();
      applyUI();
    } else {
      // create server doc from local
      await ref.set(state);
    }
  }catch(e){ console.warn('load singleplayer failed', e); }
}
async function saveSingleplayerToServer(){
  if(!auth || !auth.currentUser) return;
  try{
    const ref = db.collection('users').doc(auth.currentUser.uid).collection('singleplayerState').doc('state');
    state.lastUpdated = Date.now();
    await ref.set(state, { merge:true });
  }catch(e){ console.warn('save singleplayer failed', e); }
}

// ================= ROOM MANAGEMENT =================
function genCode(){
  const letters = 'ABCDEFGHJKLMNPQRSTUVWXYZ';
  let s=''; for(let i=0;i<4;i++) s+=letters[Math.floor(Math.random()*letters.length)];
  return s;
}

async function hostRoom(){
  if(!auth || !auth.currentUser) { alert('Sign in to host'); return; }
  if(currentRoom) return alert('Leave current room first');
  for(let attempt=0; attempt<6; attempt++){
    const code = genCode();
    try{
      const ref = db.collection('rooms').doc(code);
      const snap = await ref.get();
      if(!snap.exists){
        currentRoom = code;
        state.lastUpdated = Date.now();
        await ref.set({ state: state, shopOwned: [], resetVotes: [], hostUid: auth.currentUser.uid, lastUpdated: Date.now() });
        await ref.collection('members').doc(auth.currentUser.uid).set({ uid: auth.currentUser.uid, name: auth.currentUser.displayName||auth.currentUser.email, joinedAt: Date.now() });
        listenRoom(code);
        listenMembers(code);
        applyRoomUI(true, code);
        alert('Hosted room ' + code);
        return;
      }
    }catch(e){ console.warn('host attempt failed', e); }
  }
  alert('Could not create a room — try again.');
}

async function joinRoom(code){
  if(!auth || !auth.currentUser) { alert('Sign in to join'); return; }
  if(currentRoom) return alert('Already in a room');
  code = (code||'').trim().toUpperCase();
  if(!code) return alert('Enter code');
  try{
    const ref = db.collection('rooms').doc(code);
    const snap = await ref.get();
    if(!snap.exists) return alert('Room not found');
    currentRoom = code;
    // mark member
    await ref.collection('members').doc(auth.currentUser.uid).set({ uid: auth.currentUser.uid, name: auth.currentUser.displayName||auth.currentUser.email, joinedAt: Date.now() });
    listenRoom(code);
    listenMembers(code);
    applyRoomUI(true, code);
    alert('Joined ' + code);
  }catch(e){ alert('Join failed: ' + (e.message||e)); }
}

async function leaveRoom(){
  if(!currentRoom) return;
  try{
    const ref = db.collection('rooms').doc(currentRoom);
    if(auth && auth.currentUser) await ref.collection('members').doc(auth.currentUser.uid).delete().catch(()=>{});
    // if host and no members remain, delete room
    if(auth && auth.currentUser){
      const members = await ref.collection('members').limit(1).get();
      if(members.empty) await ref.delete().catch(()=>{});
    }
  }catch(e){ console.warn('leave failed', e); }
  if(roomUnsub){ roomUnsub(); roomUnsub=null; }
  if(membersUnsub){ membersUnsub(); membersUnsub=null; }
  if(messagesUnsub){ messagesUnsub(); messagesUnsub=null; }
  currentRoom = null;
  applyRoomUI(false, '');
  // restore singleplayer state
  if(user) await loadSingleplayerFromServer().catch(()=>{}); else { state = loadLocalState(); applyUI(); }
}

function listenRoom(code){
  if(roomUnsub) roomUnsub();
  const ref = db.collection('rooms').doc(code);
  roomUnsub = ref.onSnapshot(doc => {
    if(!doc.exists){ alert('Room closed'); leaveRoom(); return; }
    const data = doc.data();
    if(!data) return;
    // merge remote state (respect lastUpdated)
    if(data.state) mergeRemoteState(data.state);
    window.__roomCache = data;
    updateResetStatus(data.resetVotes || []);
    renderShopGrid(currentTier);
  }, err => console.warn('room listen err', err));
}

function listenMembers(code){
  if(membersUnsub) membersUnsub();
  const ref = db.collection('rooms').doc(code).collection('members');
  membersUnsub = ref.onSnapshot(snap => {
    const arr=[]; snap.forEach(d=>arr.push(d.data()));
    renderMembers(arr);
  }, err => console.warn('members listen err', err));
}

// ================= MERGE / WRITE SCHEDULING =================
function scheduleWrite(){
  saveLocalState();
  applyUI();
  if(!currentRoom){
    // singleplayer: persist to server if signed in
    if(user) saveSingleplayerToServer().catch(()=>{});
    return;
  }
  if(writeTimer) clearTimeout(writeTimer);
  writeTimer = setTimeout(()=> writeRoomNow(), WRITE_DEBOUNCE_MS);
}

function writeRoomNow(){
  if(!currentRoom) return;
  try{
    const ref = db.collection('rooms').doc(currentRoom);
    state.lastUpdated = Date.now();
    const payload = { state: state, from: myId, lastUpdated: Date.now() };
    ref.set(payload, { merge:true }).catch(e => console.warn('write failed', e));
  }catch(e){ console.warn('writeRoomNow error', e); }
}

function mergeRemoteState(remote){
  if(!remote) return;
  try{
    // If remote has a lastUpdated newer than local, it's authoritative for major fields
    const remoteLast = Number(remote.lastUpdated || 0);
    const localLast = Number(state.lastUpdated || 0);

    // Always prefer highest totalClicks
    if(remote.totalClicks > (state.totalClicks||0)) {
      state.totalClicks = remote.totalClicks;
      state.upgrades = remote.upgrades || state.upgrades;
      state.variant = remote.variant || state.variant;
    }
    // backpack: take max (simple merge strategy)
    state.backpack.food = Math.max(state.backpack.food||0, remote.backpack?.food||0);
    state.backpack.water = Math.max(state.backpack.water||0, remote.backpack?.water||0);
    state.backpack.cola = Math.max(state.backpack.cola||0, remote.backpack?.cola||0);

    // If remote is newer, adopt its alive/gameover and whole bars; else average to smooth
    if(remoteLast > localLast){
      state.hunger = remote.hunger !== undefined ? remote.hunger : state.hunger;
      state.thirst = remote.thirst !== undefined ? remote.thirst : state.thirst;
      state.energy = remote.energy !== undefined ? remote.energy : state.energy;
      state.alive = remote.alive !== undefined ? remote.alive : state.alive;
      state.lastUpdated = remoteLast;
    } else {
      // average bars (less intrusive)
      state.hunger = Math.round((state.hunger + (remote.hunger||state.hunger))/2);
      state.thirst = Math.round((state.thirst + (remote.thirst||state.thirst))/2);
      state.energy = Math.round((state.energy + (remote.energy||state.energy))/2);
      // keep local alive unless remote explicitly says gameover and remote is newer
      if(remote.alive === false && remoteLast > localLast) state.alive = false;
    }
    saveLocalState(); applyUI();
  }catch(e){ console.warn('mergeRemoteState failed', e); }
}

// ================= SHOP UI & BUY (multi & singleplayer) =================
let currentTier = tiers[0] || 'Basic';
el('shopOpenBtn').addEventListener('click', ()=> { openShop(); });

function openShop(){
  el('shopModal').style.display = 'flex';
  setTimeout(()=> el('shopBox').classList.add('show'), 10);
  renderShopGrid(currentTier);
}
el('closeShop').addEventListener('click', ()=> { el('shopBox').classList.remove('show'); setTimeout(()=> el('shopModal').style.display='none',180); });

function renderShopGrid(tier){
  const grid = el('shopGrid'); if(!grid) return;
  grid.innerHTML = '';
  // determine owned items (room or singleplayer)
  let owned = [];
  if(currentRoom && window.__roomCache) owned = window.__roomCache.shopOwned || [];
  else {
    // read singleplayer owned from localStorage or server
    const raw = localStorage.getItem('gubby_single_owned'); if(raw){ try{ owned = JSON.parse(raw); }catch(e){} }
  }
  shopData.filter(s=>s.tier===tier).forEach(item => {
    const card = document.createElement('div'); card.className='shop-card';
    const isOwned = owned.includes(item.id);
    card.innerHTML = `<div style="display:flex;justify-content:space-between"><div><strong>${item.title}</strong><div class="small">${item.desc}</div></div><div style="text-align:right"><div class="small">${item.price.toLocaleString()} ✨</div></div></div>
      <div style="display:flex;justify-content:space-between;align-items:center;margin-top:8px"><div class="small">${item.id}</div><div><button class="btn small ${isOwned?'ghost':''}" ${isOwned?'disabled':''}>${isOwned?'Owned':'Buy'}</button></div></div>`;
    const btn = card.querySelector('button');
    btn.addEventListener('click', ()=> buyItem(item));
    grid.appendChild(card);
  });
}

async function buyItem(item){
  try{
    if(!item || !item.id) return;
    if(!currentRoom){
      // SINGLEPLAYER buy
      if(state.totalClicks < item.price) return alert('Not enough clicks in your singleplayer save.');
      state.totalClicks -= item.price;
      // apply item effects (some examples)
      if(item.id === 'burger') state.backpack.food = (state.backpack.food||0)+1;
      if(item.id === 'waterbottle') state.backpack.water = (state.backpack.water||0)+1;
      if(item.id === 'clicker1') state.upgrades.clickPower = (state.upgrades.clickPower||1)+1;
      saveLocalState(); applyUI();
      // record owned locally
      try{
        const raw = localStorage.getItem('gubby_single_owned'); const arr = raw?JSON.parse(raw):[]; if(!arr.includes(item.id)) arr.push(item.id); localStorage.setItem('gubby_single_owned', JSON.stringify(arr));
        alert('Purchased (singleplayer): ' + item.title);
      }catch(e){ console.warn('record single owned failed', e); alert('Purchased locally'); }
      renderShopGrid(currentTier);
      return;
    }

    // MULTIPLAYER buy with transaction
    if(!user) return alert('Sign in to buy in multiplayer.');
    const roomRef = db.collection('rooms').doc(currentRoom);
    await db.runTransaction(async tx => {
      const snap = await tx.get(roomRef);
      if(!snap.exists) throw new Error('Room missing');
      const data = snap.data();
      const owned = data.shopOwned || [];
      if(owned.includes(item.id)) throw new Error('Already owned');
      const roomState = data.state || {};
      const totalClicks = Number(roomState.totalClicks || 0);
      if(totalClicks < item.price) throw new Error('Not enough room clicks');
      const newOwned = owned.concat([item.id]);
      const newState = Object.assign({}, roomState);
      newState.totalClicks = totalClicks - item.price;
      // apply item effects server-side for consistency
      if(item.id === 'burger') newState.backpack = Object.assign({}, newState.backpack || {}, { food: (newState.backpack?.food||0)+1 });
      if(item.id === 'waterbottle') newState.backpack = Object.assign({}, newState.backpack || {}, { water: (newState.backpack?.water||0)+1 });
      if(item.id === 'clicker1') newState.upgrades = Object.assign({}, newState.upgrades || {}, { clickPower: (newState.upgrades?.clickPower||1)+1 });
      if(item.id === 'auto1') newState.upgrades = Object.assign({}, newState.upgrades || {}, { autoClicks: (newState.upgrades?.autoClicks||0)+1 });
      newState.lastUpdated = Date.now();
      tx.update(roomRef, { shopOwned: newOwned, state: newState, lastUpdated: Date.now() });
    });
    alert('Purchased ' + item.title);
    // local reflect will come from room snapshot listener
  }catch(e){
    console.warn('purchase failed', e);
    alert('Purchase failed: ' + (e.message || e));
  }
}

// ================= CHAT (messages subcollection) =================
el('chatOpenBtn').addEventListener('click', openChat);
el('chatSend').addEventListener('click', sendChatMessage);
el('closeChat').addEventListener('click', closeChat);
el('chatClear').addEventListener('click', async ()=>{
  if(!currentRoom) return alert('Join a room');
  if(!confirm('Clear chat for everyone?')) return;
  try{
    const msgsRef = db.collection('rooms').doc(currentRoom).collection('messages');
    const snap = await msgsRef.get();
    const batch = db.batch();
    snap.forEach(d => batch.delete(d.ref));
    await batch.commit();
    alert('Chat cleared');
  }catch(e){ console.warn('clear chat failed', e); alert('Clear failed: ' + (e.message||e)); }
});

function openChat(){
  if(!currentRoom) return alert('Join a room to chat');
  el('chatModal').style.display = 'flex'; setTimeout(()=> el('chatBox').classList.add('show'), 10);
  el('chatRoomLabel').textContent = currentRoom ? 'Room ' + currentRoom : '';
  listenMessages(currentRoom);
}
function closeChat(){
  if(messagesUnsub){ messagesUnsub(); messagesUnsub=null; }
  el('chatBox').classList.remove('show'); setTimeout(()=> el('chatModal').style.display='none',180);
}

function listenMessages(code){
  if(messagesUnsub) messagesUnsub();
  const msgsRef = db.collection('rooms').doc(code).collection('messages').orderBy('createdAt','asc').limit(500);
  messagesUnsub = msgsRef.onSnapshot(snap => {
    const container = el('chatMessages'); if(!container) return; container.innerHTML = '';
    snap.forEach(doc => {
      const m = doc.data();
      const div = document.createElement('div');
      div.style.marginBottom = '8px';
      div.innerHTML = `<div style="font-weight:700">${escapeHtml(m.name||m.uid)}</div><div class="small">${escapeHtml(m.text)}</div><div style="font-size:11px;color:var(--muted)">${new Date(m.createdAt).toLocaleTimeString()}</div>`;
      container.appendChild(div);
    });
    container.scrollTop = container.scrollHeight;
  }, err => {
    console.warn('messages listen err', err);
    alert('Chat listen error: ' + (err.message||err));
  });
}

async function sendChatMessage(){
  if(!currentRoom) return alert('Join a room first');
  if(!user) return alert('Sign in to chat');
  const text = (el('chatInput').value || '').trim();
  if(!text) return;
  try{
    await db.collection('rooms').doc(currentRoom).collection('messages').add({ uid: auth.currentUser.uid, name: auth.currentUser.displayName || auth.currentUser.email || 'You', text, createdAt: Date.now() });
    el('chatInput').value = '';
  }catch(e){
    console.warn('send chat failed', e);
    alert('Send chat failed: ' + (e.message||e) + '\nCheck Firestore rules.');
  }
}

// ================= RESET (unanimous) =================
el('resetBtn').addEventListener('click', ()=> {
  if(!currentRoom) return alert('Join a room first');
  if(!auth || !auth.currentUser) return alert('Sign in to request reset');
  if(!confirm('Request a room reset? All members must agree.')) return;
  requestResetVote();
});

async function requestResetVote(){
  const roomRef = db.collection('rooms').doc(currentRoom);
  try{
    await db.runTransaction(async tx => {
      const snap = await tx.get(roomRef);
      if(!snap.exists) throw new Error('Room missing');
      const data = snap.data();
      const resetSet = new Set(data.resetVotes || []);
      resetSet.add(auth.currentUser.uid);
      const membersSnap = await roomRef.collection('members').get();
      const memberIds = []; membersSnap.forEach(m => memberIds.push(m.id));
      if(memberIds.length === 0){
        tx.update(roomRef, { state: defaultState, resetVotes: [], shopOwned: [], lastUpdated: Date.now() });
      } else if(memberIds.every(id => resetSet.has(id))){
        tx.update(roomRef, { state: defaultState, resetVotes: [], shopOwned: [], lastUpdated: Date.now() });
      } else {
        tx.update(roomRef, { resetVotes: Array.from(resetSet), lastUpdated: Date.now() });
      }
    });
    // after tx, if reset performed, clear messages
    const doc = await roomRef.get();
    const dataAfter = doc.data();
    if(dataAfter && Array.isArray(dataAfter.resetVotes) && dataAfter.resetVotes.length === 0){
      // delete messages
      try{
        const msgsRef = roomRef.collection('messages');
        const snap = await msgsRef.get();
        if(!snap.empty){
          const batchArray = [];
          let batch = db.batch(), ops = 0;
          snap.forEach(d => { batch.delete(d.ref); ops++; if(ops===500){ batchArray.push(batch); batch = db.batch(); ops=0; } });
          batchArray.push(batch);
          for(const b of batchArray) await b.commit();
        }
      }catch(e){ console.warn('post-reset message deletion failed', e); }
    }
    alert('Your vote recorded. Reset happens when all members agree.');
  }catch(e){
    console.warn('reset tx failed', e);
    alert('Reset failed: ' + (e.message||e));
  }
}

async function updateResetStatus(votes){
  if(!currentRoom) { el('resetStatus').textContent = ''; return; }
  try{
    const membersSnap = await db.collection('rooms').doc(currentRoom).collection('members').get();
    const count = membersSnap.size;
    el('resetStatus').textContent = `${(votes||[]).length} / ${count} agreed`;
  }catch(e){ el('resetStatus').textContent = `${(votes||[]).length} votes`; }
}

// ================= MEMBERS UI =================
function renderMembers(arr){
  const wrap = el('members'); if(!wrap) return; wrap.innerHTML = '';
  arr.forEach(m=>{
    const d = document.createElement('div'); d.className='small'; d.style.padding='6px'; d.style.borderRadius='6px'; d.style.border='1px solid rgba(12,40,80,0.04)'; d.textContent = m.name || m.uid;
    wrap.appendChild(d);
  });
}

// ================= MOVEMENT / DECAY / LOOP =================
// Ensure clicks never softlock: wrap in try/catch and ensure state defaults
function ensureState(){
  if(!state) state = JSON.parse(JSON.stringify(defaultState));
  if(typeof state.alive === 'undefined') state.alive = true;
  if(typeof state.hunger !== 'number') state.hunger = defaultState.hunger;
  if(typeof state.thirst !== 'number') state.thirst = defaultState.thirst;
  if(typeof state.energy !== 'number') state.energy = defaultState.energy;
  if(!state.backpack) state.backpack = JSON.parse(JSON.stringify(defaultState.backpack));
  if(!state.upgrades) state.upgrades = JSON.parse(JSON.stringify(defaultState.upgrades));
}
ensureState();

el('gubbySprite').addEventListener('click', ()=> {
  try{
    ensureState();
    // if dead, prompt to restart locally (prevents softlock)
    if(!state.alive){
      if(confirm('Gubby is not alive. Restart locally?')) {
        state = JSON.parse(JSON.stringify(defaultState));
        state.lastUpdated = Date.now();
        scheduleWrite();
        applyUI();
      }
      return;
    }
    const mult = (state.upgrades.multipliers || []).reduce((a,b)=>a*b,1) || 1;
    const power = (state.upgrades.clickPower || 1) * mult;
    state.clicks += power; state.totalClicks += power;
    state.hunger = Math.max(0, state.hunger - 0.1);
    state.thirst = Math.max(0, state.thirst - 0.2);
    playClickSound();
    scheduleWrite();
  }catch(e){ console.warn('click handler failed', e); }
});

function playClickSound(){
  try{
    new Audio('sounds/merp.mp3').play().catch(()=>{});
  }catch(e){}
}

el('feedBtn').addEventListener('click', ()=> { if(state.backpack.food>0){ state.backpack.food--; state.hunger = Math.min(100, state.hunger+25); scheduleWrite(); } else alert('No food');});
el('waterBtn').addEventListener('click', ()=> { if(state.backpack.water>0){ state.backpack.water--; state.thirst = Math.min(100, state.thirst+25); scheduleWrite(); } else alert('No water');});
el('colaBtn').addEventListener('click', ()=> { if(state.backpack.cola>0){ state.backpack.cola--; state.energy = Math.min(100, state.energy+50); scheduleWrite(); } else alert('No cola');});
el('playBtn').addEventListener('click', ()=> { state.energy = Math.min(100, state.energy+8); scheduleWrite(); });

function wander(){
  try{
    if(!state.alive) return;
    const margin = 80;
    const newX = Math.random()*(560 - margin*2) + margin;
    const newY = Math.random()*(360 - margin*2) + margin;
    // compute dist based on previous pos
    const dx = (state.pos?.x || newX) - newX;
    const dy = (state.pos?.y || newY) - newY;
    const dist = Math.sqrt(dx*dx + dy*dy);
    const energyLoss = Math.max(1, Math.round(dist/60));
    state.pos.x = newX; state.pos.y = newY;
    state.energy = Math.max(0, state.energy - energyLoss);
    el('gubbySprite').style.left = newX + 'px'; el('gubbySprite').style.top = newY + 'px';
    scheduleWrite();
  }catch(e){ console.warn('wander failed', e); }
}
setInterval(wander, 3000);

setInterval(()=>{
  try{
    if(!state.alive) return;
    state.hunger = Math.max(0, state.hunger - (state.upgrades?.hungerDecayMod || 1));
    state.thirst = Math.max(0, state.thirst - (state.upgrades?.thirstDecayMod || 1.2));
    const hour = (new Date()).getHours();
    if(hour>=22||hour<7) state.energy = Math.min(100, state.energy + (state.upgrades?.energyGain||2)); else state.energy = Math.max(0, state.energy - 0.5);
    if(state.hunger === 0 || state.thirst === 0) state.energy = Math.max(0, state.energy - 2);
    if(state.upgrades.autoClicks > 0) { state.clicks += state.upgrades.autoClicks; state.totalClicks += state.upgrades.autoClicks; }
    if(state.energy <= 0 || state.hunger <= 0 || state.thirst <= 0){
      state.alive = false; scheduleWrite(); showGameOver();
    }
    scheduleWrite();
  }catch(e){ console.warn('decay loop failed', e); }
}, 10000);

// ================= GAME OVER UI =================
function showGameOver(){ alert('Game Over — Gubby is out of health. Restart locally or ask room to reset.'); }

// ================= VARIANTS (render basic list) =================
function renderVariants(items){
  // minimal: place for future attribute popup expansion
}

// ================= HELPERS =================
function escapeHtml(s){ return (s||'').toString().replace(/[&<>"']/g, c=>({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;' })[c]); }

// ================= UI BINDINGS =================
el('hostBtn').addEventListener('click', ()=> { initFirebase(); hostRoom(); });
el('joinBtn').addEventListener('click', ()=> { el('joinModal').style.display='flex'; setTimeout(()=> el('joinBox').classList.add('show'),10); });
el('joinCancel').addEventListener('click', ()=> { el('joinBox').classList.remove('show'); setTimeout(()=> el('joinModal').style.display='none',180); });
el('joinConfirm').addEventListener('click', ()=> { const code = el('joinCode').value.trim(); el('joinBox').classList.remove('show'); setTimeout(()=> el('joinModal').style.display='none',180); if(code) joinRoom(code); });
el('leaveRoom').addEventListener('click', ()=> { if(confirm('Leave room?')) leaveRoom(); });
el('copyRoom').addEventListener('click', ()=> { if(!currentRoom) return; navigator.clipboard?.writeText(currentRoom).then(()=>alert('Copied'), ()=>alert('Copy failed')); });

el('chatOpenBtn').addEventListener('click', ()=> { if(!currentRoom) return alert('Join a room to chat'); openChat(); });
el('shopOpenBtn').addEventListener('click', openShop);

// ================= ROOM UI APPLY =================
function applyRoomUI(connected, code){
  if(connected){
    document.body.classList.add('room-mode');
    el('connectionStatus').textContent = 'Connected';
    el('roomCode').textContent = code;
    el('copyRoom').style.display = 'inline-block';
    el('leaveRoom').style.display = 'inline-block';
    el('chatOpenBtn').style.display = 'inline-block';
    currentRoom = code;
    renderShopGrid(currentTier);
  } else {
    document.body.classList.remove('room-mode');
    el('connectionStatus').textContent = 'Not connected';
    el('roomCode').textContent = '';
    el('copyRoom').style.display = 'none';
    el('leaveRoom').style.display = 'none';
    el('chatOpenBtn').style.display = 'none';
    currentRoom = null;
  }
}

// ================= MESSAGES CLEANUP ON UNLOAD =================
window.addEventListener('beforeunload', async ()=>{
  try{
    if(currentRoom && db && auth && auth.currentUser){
      await db.collection('rooms').doc(currentRoom).collection('members').doc(auth.currentUser.uid).delete().catch(()=>{});
      const members = await db.collection('rooms').doc(currentRoom).collection('members').limit(1).get();
      if(members.empty) await db.collection('rooms').doc(currentRoom).delete().catch(()=>{});
    }
  }catch(e){}
});

// small initial UI
applyUI();

// expose for debugging
window.GubbyClicker = { state, saveLocalState, loadLocalState, openShop, hostRoom, joinRoom, leaveRoom };
