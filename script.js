import { initializeApp } from "https://www.gstatic.com/firebasejs/9.6.1/firebase-app.js";
import { getAuth, onAuthStateChanged, signInWithEmailAndPassword, createUserWithEmailAndPassword, signOut, GoogleAuthProvider, signInWithPopup } from "https://www.gstatic.com/firebasejs/9.6.1/firebase-auth.js";
import { getFirestore, doc, setDoc, getDoc, updateDoc, increment, serverTimestamp, onSnapshot, collection, getDocs } from "https://www.gstatic.com/firebasejs/9.6.1/firebase-firestore.js";

// Wait for the DOM to be fully loaded before running the script
document.addEventListener('DOMContentLoaded', () => {

    // 1. --- YOUR FIREBASE CONFIGURATION ---
    const firebaseConfig = {
        apiKey: "AIzaSyAai5V9VTtPnAdMoAhhVe94fobPOY25yf8",
        authDomain: "gubby-clicker.firebaseapp.com",
        projectId: "gubby-clicker",
        storageBucket: "gubby-clicker.appspot.com",
        messagingSenderId: "255072290621",
        appId: "1:255072290621:web:9f80676beac50c0059a754",
        measurementId: "G-R3HFMPH5C4"
    };

    // 2. --- INITIALIZE FIREBASE & GET SERVICES ---
    const app = initializeApp(firebaseConfig);
    const auth = getAuth(app);
    const db = getFirestore(app);
    const googleProvider = new GoogleAuthProvider();

    // 3. --- DOM ELEMENT REFERENCES ---
    const authContainer = document.getElementById('auth-container');
    const loginForm = document.getElementById('login-form');
    const signupForm = document.getElementById('signup-form');
    const roomSelection = document.getElementById('room-selection');
    const gameScreen = document.getElementById('game-screen');
    const canvas = document.getElementById('game-canvas');
    const ctx = canvas.getContext('2d');

    // Buttons
    const loginBtn = document.getElementById('login-btn');
    const signupBtn = document.getElementById('signup-btn');
    const googleLoginBtn = document.getElementById('google-login-btn');
    const logoutBtn = document.getElementById('logout-btn');
    const createRoomBtn = document.getElementById('create-room-btn');
    const joinRoomBtn = document.getElementById('join-room-btn');
    const shopBtn = document.getElementById('shop-btn');
    const adminBtn = document.getElementById('admin-panel-btn');
    const addVariantBtn = document.getElementById('add-variant-btn');

    // Stats
    const moneyStat = document.getElementById('money-stat');
    const hungerStat = document.getElementById('hunger-stat');
    const thirstStat = document.getElementById('thirst-stat');
    const energyStat = document.getElementById('energy-stat');
    const gubbyNameDisplay = document.getElementById('gubby-name-display');
    const roomCodeDisplay = document.getElementById('room-code-display');
    
    // Modals
    const nameModal = document.getElementById('name-modal');
    const shopModal = document.getElementById('shop-modal');
    const adminModal = document.getElementById('admin-panel-modal');

    // 4. --- GAME STATE & CONSTANTS ---
    let currentUser = null;
    let currentRoomId = null;
    let unsubscribeFromRoom = null; // To stop listening to room updates on logout
    let gubby = {
        x: 100, y: 100,
        width: 128, height: 128,
        vx: 1, vy: 1,
        img: new Image(),
        isSleeping: false,
        isDead: false
    };
    gubby.img.src = 'sprites/variants/default.png'; // Default sprite

    const GAME_TICK_RATE = 2000; // Deplete stats every 2 seconds
    const DAY_NIGHT_DURATION = 60000; // 1 minute day, 1 minute night
    let lastTickTime = 0;
    let timeOfDay = 0; // 0 to DAY_NIGHT_DURATION*2
    let isDay = true;
    let gameLoopId = null; // To store the requestAnimationFrame ID

    // --- HELPER FUNCTIONS ---
    function toggleAuthForms() {
        loginForm.classList.toggle('hidden');
        signupForm.classList.toggle('hidden');
    }
    function openModal(modalId) { document.getElementById(modalId).style.display = 'flex'; }
    function closeModal(modalId) { document.getElementById(modalId).style.display = 'none'; }
    
    function generateRoomCode() {
        return Math.random().toString(36).substring(2, 7).toUpperCase();
    }

    // 5. --- AUTHENTICATION LOGIC ---
    onAuthStateChanged(auth, async (user) => {
        if (user) {
            currentUser = user;
            authContainer.classList.add('hidden');
            roomSelection.classList.remove('hidden');
            gameScreen.classList.add('hidden'); // Hide game until room is joined
            
            await checkAdminStatus(user.uid);
        } else {
            currentUser = null;
            authContainer.classList.remove('hidden');
            loginForm.classList.remove('hidden');
            signupForm.classList.add('hidden');
            roomSelection.classList.add('hidden');
            gameScreen.classList.add('hidden');
            if (unsubscribeFromRoom) unsubscribeFromRoom();
            if(gameLoopId) cancelAnimationFrame(gameLoopId);
        }
    });

    loginBtn.addEventListener('click', () => {
        const email = document.getElementById('login-email').value;
        const password = document.getElementById('login-password').value;
        signInWithEmailAndPassword(auth, email, password)
            .catch(err => document.getElementById('login-error').textContent = err.message);
    });

    signupBtn.addEventListener('click', () => {
        const email = document.getElementById('signup-email').value;
        const password = document.getElementById('signup-password').value;
        createUserWithEmailAndPassword(auth, email, password)
            .then(userCredential => {
                const userDocRef = doc(db, "users", userCredential.user.uid);
                return setDoc(userDocRef, {
                    email: userCredential.user.email,
                    privileges: 'normal',
                    createdAt: serverTimestamp()
                });
            })
            .catch(err => document.getElementById('signup-error').textContent = err.message);
    });

    googleLoginBtn.addEventListener('click', () => {
        signInWithPopup(auth, googleProvider)
            .then((result) => {
                const user = result.user;
                const userDocRef = doc(db, "users", user.uid);
                getDoc(userDocRef).then(docSnap => {
                    if (!docSnap.exists()) {
                        setDoc(userDocRef, {
                            email: user.email,
                            displayName: user.displayName,
                            privileges: 'normal',
                            createdAt: serverTimestamp()
                        });
                    }
                });
            }).catch((error) => {
                document.getElementById('login-error').textContent = error.message;
            });
    });
    
    logoutBtn.addEventListener('click', () => {
        signOut(auth);
    });

    async function checkAdminStatus(uid) {
        const userDocRef = doc(db, "users", uid);
        const userDoc = await getDoc(userDocRef);
        if (userDoc.exists() && userDoc.data().privileges === 'admin') {
            adminBtn.classList.remove('hidden');
        } else {
            adminBtn.classList.add('hidden');
        }
    }

    // 6. --- ROOM MANAGEMENT ---
    createRoomBtn.addEventListener('click', async () => {
        const roomId = generateRoomCode();
        const roomRef = doc(db, 'rooms', roomId);
        const defaultRoomState = {
            ownerId: currentUser.uid,
            money: 0,
            gubbyName: 'Gubby',
            hunger: 100,
            thirst: 100,
            energy: 100,
            currentVariant: 'default.png',
            upgrades: {
                clickMultiplier: 1,
            },
            lastTick: serverTimestamp(),
            createdAt: serverTimestamp()
        };
        await setDoc(roomRef, defaultRoomState);
        joinRoom(roomId);
    });

    joinRoomBtn.addEventListener('click', () => {
        const roomId = document.getElementById('room-code-input').value.toUpperCase();
        if(roomId) joinRoom(roomId);
    });

    async function joinRoom(roomId) {
        const roomRef = doc(db, 'rooms', roomId);
        const roomDoc = await getDoc(roomRef);

        if (roomDoc.exists()) {
            currentRoomId = roomId;
            roomSelection.classList.add('hidden');
            gameScreen.classList.remove('hidden');
            roomCodeDisplay.textContent = roomId;
            
            if (roomDoc.data().gubbyName === 'Gubby') {
                openModal('name-modal');
            }

            listenToRoomUpdates(roomId);
            startGameLoop();
        } else {
            document.getElementById('room-error').textContent = "Room not found.";
        }
    }
    
    document.getElementById('save-name-btn').addEventListener('click', () => {
        const newName = document.getElementById('gubby-name-input').value;
        if (newName && currentRoomId) {
            const roomRef = doc(db, 'rooms', currentRoomId);
            updateDoc(roomRef, { gubbyName: newName });
            closeModal('name-modal');
        }
    });

    // 7. --- REALTIME DATABASE LISTENER ---
    function listenToRoomUpdates(roomId) {
        const roomRef = doc(db, 'rooms', roomId);
        if (unsubscribeFromRoom) unsubscribeFromRoom();

        unsubscribeFromRoom = onSnapshot(roomRef, (doc) => {
            const data = doc.data();
            if (!data) return;

            moneyStat.textContent = data.money;
            hungerStat.textContent = Math.round(data.hunger);
            thirstStat.textContent = Math.round(data.thirst);
            energyStat.textContent = Math.round(data.energy);
            gubbyNameDisplay.textContent = data.gubbyName;
            
            gubby.isDead = data.hunger <= 0 || data.thirst <= 0;
            gubby.img.src = gubby.isDead ? 'sprites/dead.png' : `sprites/variants/${data.currentVariant}`;
        });
    }
    
    function updateFirestoreState(field, value) {
        if (!currentRoomId) return;
        const roomRef = doc(db, 'rooms', currentRoomId);
        updateDoc(roomRef, { [field]: value })
            .catch(err => console.error("Error updating state:", err));
    }
    
    function incrementFirestoreState(field, amount) {
         if (!currentRoomId) return;
        const roomRef = doc(db, 'rooms', currentRoomId);
        updateDoc(roomRef, { [field]: increment(amount) })
            .catch(err => console.error("Error incrementing state:", err));
    }

    // 8. --- CANVAS & GAME LOOP ---
    function resizeCanvas() {
        canvas.width = canvas.offsetWidth;
        canvas.height = canvas.offsetHeight;
    }

    function startGameLoop() {
        resizeCanvas();
        window.addEventListener('resize', resizeCanvas);
        lastTickTime = performance.now();
        gameLoopId = requestAnimationFrame(gameLoop);
    }

    function gameLoop(timestamp) {
        if (!currentRoomId) return;

        const deltaTime = timestamp - lastTickTime;
        lastTickTime = timestamp;

        updateGameLogic(deltaTime);
        updateGubbyMovement();
        render();

        gameLoopId = requestAnimationFrame(gameLoop);
    }
    
    async function updateGameLogic(deltaTime) {
        timeOfDay = (timeOfDay + deltaTime) % (DAY_NIGHT_DURATION * 2);
        const wasDay = isDay;
        isDay = timeOfDay < DAY_NIGHT_DURATION;
        
        if(wasDay !== isDay) {
            gubby.isSleeping = !isDay;
            document.getElementById('day-night-overlay').style.opacity = isDay ? '0' : '0.4';
        }
        
        const roomRef = doc(db, 'rooms', currentRoomId);
        const roomDoc = await getDoc(roomRef);
        if (!roomDoc.exists()) return;
        const data = roomDoc.data();

        if (data.ownerId === currentUser.uid) {
            const now = Date.now();
            const lastTick = data.lastTick.toDate().getTime();
            const ticksPassed = Math.floor((now - lastTick) / GAME_TICK_RATE);

            if (ticksPassed > 0) {
                if (!gubby.isDead) {
                    const hungerLoss = ticksPassed * 1;
                    const thirstLoss = ticksPassed * 1.5;
                    const energyChange = gubby.isSleeping ? ticksPassed * 2 : ticksPassed * -0.5;
                    
                    updateDoc(roomRef, {
                        hunger: increment(-hungerLoss),
                        thirst: increment(-thirstLoss),
                        energy: increment(energyChange),
                        lastTick: serverTimestamp()
                    });
                }
            }
        }
    }
    
    function updateGubbyMovement() {
        if (gubby.isDead || gubby.isSleeping) return;

        gubby.x += gubby.vx;
        gubby.y += gubby.vy;

        if (gubby.x <= 0 || gubby.x + gubby.width >= canvas.width) gubby.vx *= -1;
        if (gubby.y <= 0 || gubby.y + gubby.height >= canvas.height) gubby.vy *= -1;
    }

    function render() {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        ctx.fillStyle = '#8c6d52';
        ctx.fillRect(0, canvas.height - 20, canvas.width, 20);

        ctx.drawImage(gubby.img, gubby.x, gubby.y, gubby.width, gubby.height);
    }

    // 9. --- GAME ACTIONS & CONTROLS ---
    canvas.addEventListener('click', async (event) => {
        if (gubby.isDead || gubby.isSleeping) return;

        const rect = canvas.getBoundingClientRect();
        const x = event.clientX - rect.left;
        const y = event.clientY - rect.top;

        if (x >= gubby.x && x <= gubby.x + gubby.width &&
            y >= gubby.y && y <= gubby.y + gubby.height) {
            const roomRef = doc(db, 'rooms', currentRoomId);
            const roomDoc = await getDoc(roomRef);
            const clickPower = roomDoc.data().upgrades.clickMultiplier || 1;
            incrementFirestoreState('money', clickPower);
        }
    });
    
    document.getElementById('feed-btn').addEventListener('click', () => {
         incrementFirestoreState('money', -10);
         incrementFirestoreState('hunger', 20);
         incrementFirestoreState('energy', 5);
    });

    document.getElementById('water-btn').addEventListener('click', () => {
         incrementFirestoreState('money', -5);
         incrementFirestoreState('thirst', 25);
    });
    
    // 10. --- SHOP & ADMIN LOGIC ---
    shopBtn.addEventListener('click', async () => {
        const variantsCollectionRef = collection(db, 'variants');
        const snapshot = await getDocs(variantsCollectionRef);
        const variantsGrid = document.getElementById('variants-grid');
        variantsGrid.innerHTML = '';
        
        snapshot.forEach(doc => {
            const variant = doc.data();
            const item = document.createElement('div');
            item.className = 'shop-item';
            
            const img = document.createElement('img');
            img.src = `sprites/variants/${variant.filename}`;
            img.alt = variant.name;
            
            const name = document.createElement('h4');
            name.textContent = variant.name;
            
            const desc = document.createElement('p');
            desc.textContent = variant.description;
            
            const mult = document.createElement('p');
            mult.textContent = `Multiplier: x${variant.multiplier}`;
            
            const buyBtn = document.createElement('button');
            buyBtn.textContent = `Buy (💰${variant.price})`;
            buyBtn.addEventListener('click', () => buyVariant(doc.id, variant.price));
            
            item.append(img, name, desc, mult, buyBtn);
            variantsGrid.appendChild(item);
        });
        
        openModal('shop-modal');
    });
    
    // Make buyVariant globally accessible
    window.buyVariant = async function(variantId, price) {
        const roomRef = doc(db, 'rooms', currentRoomId);
        const roomDoc = await getDoc(roomRef);
        if (roomDoc.data().money >= price) {
            const variantRef = doc(db, 'variants', variantId);
            const variantDoc = await getDoc(variantRef);
            const variantData = variantDoc.data();
            
            updateDoc(roomRef, {
                money: increment(-price),
                currentVariant: variantData.filename,
                'upgrades.clickMultiplier': variantData.multiplier
            });

            alert(`You bought ${variantData.name}!`);
            closeModal('shop-modal');
        } else {
            alert("Not enough money!");
        }
    }
    
    adminBtn.addEventListener('click', () => openModal('admin-panel-modal'));
    
    addVariantBtn.addEventListener('click', async () => {
        const name = document.getElementById('variant-name').value;
        const filename = document.getElementById('variant-filename').value;
        const price = parseInt(document.getElementById('variant-price').value);
        const multiplier = parseFloat(document.getElementById('variant-multiplier').value);
        const description = document.getElementById('variant-description').value;
        
        if(!name || !filename || !price || !multiplier) {
            document.getElementById('admin-error').textContent = "All fields are required.";
            return;
        }
        
        try {
            const newVariantRef = doc(collection(db, 'variants'));
            await setDoc(newVariantRef, {
                name, filename, price, multiplier, description
            });
            alert('Variant added successfully!');
            closeModal('admin-panel-modal');
        } catch(err) {
            console.error("Admin error:", err);
            document.getElementById('admin-error').textContent = "You do not have permission or an error occurred.";
        }
    });

    // Add event listeners for elements that used onclick
    document.querySelectorAll('.toggle-link').forEach(link => {
        link.addEventListener('click', toggleAuthForms);
    });
    document.querySelectorAll('.close-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const modalId = e.target.dataset.modalId;
            if (modalId) {
                closeModal(modalId);
            }
        });
    });
});
