// ============ АУТЕНТИФИКАЦИЯ FChat ============

let currentUser = null;
let currentUserData = null;
let currentFamilyId = null;
let currentFamilyData = null;

async function registerUser(email, password, name, roleId, emoji) {
  try {
    const userCredential = await auth.createUserWithEmailAndPassword(email, password);
    const userId = userCredential.user.uid;
    await db.ref('users/' + userId).set({
      name: name, email: email, role: roleId,
      emoji: emoji || ROLES[roleId]?.emoji || '👤',
      createdAt: firebase.database.ServerValue.TIMESTAMP
    });
    return { success: true, userId: userId };
  } catch (error) {
    return { success: false, error: getAuthErrorMessage(error.code) };
  }
}

async function loginUser(email, password) {
  try {
    const userCredential = await auth.signInWithEmailAndPassword(email, password);
    return { success: true, userId: userCredential.user.uid };
  } catch (error) {
    return { success: false, error: getAuthErrorMessage(error.code) };
  }
}

async function logoutUser() {
  try {
    await auth.signOut();
    currentUser = null; currentUserData = null;
    currentFamilyId = null; currentFamilyData = null;
    return { success: true };
  } catch (error) {
    return { success: false, error: error.message };
  }
}

auth.onAuthStateChanged(async function(user) {
  if (user) {
    currentUser = user.uid;
    const userSnap = await db.ref('users/' + user.uid).once('value');
    currentUserData = userSnap.val();
    if (!currentUserData) { console.error('Данные не найдены'); return; }
    if (currentUserData.familyId) {
      const familySnap = await db.ref('families/' + currentUserData.familyId).once('value');
      currentFamilyData = familySnap.val();
      currentFamilyId = currentUserData.familyId;
    }
    document.getElementById('secretOverlay').style.display = 'none';
    document.getElementById('mainApp').style.display = 'flex';
    
    // Запрашиваем FCM токен
    if ('Notification' in window && Notification.permission === 'granted') {
      messaging.getToken({ vapidKey: VAPID_KEY }).then(function(token) {
        if (token) { db.ref('users/' + currentUser + '/fcmToken').set(token); }
      }).catch(function() {});
    }
    
    initApp();
    console.log('✅ Вошёл как ' + currentUserData.name);
  } else {
    currentUser = null; currentUserData = null;
    currentFamilyId = null; currentFamilyData = null;
    document.getElementById('secretOverlay').style.display = 'flex';
    document.getElementById('mainApp').style.display = 'none';
  }
});

function hasPermission(permission) {
  if (!currentUserData || !currentUserData.role) return false;
  return getPermissions(currentUserData.role)[permission] === true;
}

function getUserRole() { return currentUserData?.role || 'friend'; }
function getUserLevel() { return ROLES[getUserRole()]?.level || 'friend'; }

function getAuthErrorMessage(code) {
  const messages = {
    'auth/email-already-in-use': 'Этот email уже зарегистрирован',
    'auth/invalid-email': 'Неверный формат email',
    'auth/operation-not-allowed': 'Регистрация отключена',
    'auth/weak-password': 'Пароль должен быть минимум 6 символов',
    'auth/user-disabled': 'Аккаунт заблокирован',
    'auth/user-not-found': 'Пользователь не найден',
    'auth/wrong-password': 'Неверный пароль',
    'auth/invalid-credential': 'Неверный email или пароль',
    'auth/too-many-requests': 'Слишком много попыток. Попробуйте позже'
  };
  return messages[code] || 'Ошибка: ' + code;
}

function initAuthForms() {
  document.getElementById('showRegister').addEventListener('click', function(e) {
    e.preventDefault();
    document.getElementById('loginForm').style.display = 'none';
    document.getElementById('registerForm').style.display = 'block';
    document.getElementById('loginTitle').textContent = 'Регистрация в FChat';
    document.getElementById('errorMsg').classList.remove('show');
    nextRegStep(1);
  });

    const showLoginInRegBtn = document.getElementById('showLoginInReg');
  if (showLoginInRegBtn) {
    showLoginInRegBtn.addEventListener('click', function(e) {
      e.preventDefault();
      document.getElementById('registerForm').style.display = 'none';
      document.getElementById('loginForm').style.display = 'block';
      document.getElementById('loginTitle').textContent = 'Вход в FChat';
      document.getElementById('errorMsg').classList.remove('show');
    });
  }
  
  document.getElementById('showLogin').addEventListener('click', function(e) {
    e.preventDefault();
    document.getElementById('registerForm').style.display = 'none';
    document.getElementById('loginForm').style.display = 'block';
    document.getElementById('loginTitle').textContent = 'Вход в FChat';
    document.getElementById('errorMsg').classList.remove('show');
  });
  
  document.getElementById('loginBtn').addEventListener('click', async function() {
    const email = document.getElementById('loginEmail').value.trim();
    const password = document.getElementById('loginPassword').value;
    if (!email || !password) { showAuthError('Введите email и пароль'); return; }
    const result = await loginUser(email, password);
    if (!result.success) { showAuthError(result.error); }
  });
  
  document.getElementById('registerBtn').addEventListener('click', async function() {
    const name = document.getElementById('regName').value.trim();
    const email = document.getElementById('regEmail').value.trim();
    const password = document.getElementById('regPassword').value;
    const roleId = document.getElementById('regRole').value;
    const emoji = getSelectedEmoji ? getSelectedEmoji() : '👤';
    if (!name) { showAuthError('Введите имя'); return; }
    if (!email) { showAuthError('Введите email'); return; }
    if (!password || password.length < 6) { showAuthError('Пароль должен быть минимум 6 символов'); return; }
    if (!roleId) { showAuthError('Выберите роль в семье'); return; }
    const result = await registerUser(email, password, name, roleId, emoji);
    if (!result.success) { showAuthError(result.error); }
  });
  
  document.getElementById('logoutBtn').addEventListener('click', async function() {
    if (confirm('Выйти из аккаунта?')) { await logoutUser(); }
  });
  
  document.getElementById('changePasswordBtn').addEventListener('click', async function() {
    const oldPassword = prompt('Текущий пароль:');
    if (!oldPassword) return;
    const newPassword = prompt('Новый пароль (мин 6):');
    if (!newPassword || newPassword.length < 6) { alert('Минимум 6 символов'); return; }
    try {
      const user = auth.currentUser;
      const credential = firebase.auth.EmailAuthProvider.credential(user.email, oldPassword);
      await user.reauthenticateWithCredential(credential);
      await user.updatePassword(newPassword);
      alert('✅ Пароль изменён!');
    } catch (error) { alert('Ошибка: ' + getAuthErrorMessage(error.code)); }
  });
}

function showAuthError(msg) {
  const el = document.getElementById('errorMsg');
  el.textContent = msg; el.classList.add('show');
  setTimeout(function() { el.classList.remove('show'); }, 5000);
}

let selectedRegEmoji = '👤';

function initEmojiSelector() {
  const container = document.getElementById('emojiSelector');
  if (!container) return;
  container.innerHTML = AVATAR_EMOJIS.map(function(e) {
    return '<button class="emoji-select-btn" data-emoji="' + e + '" style="font-size:1.5rem;padding:5px;cursor:pointer;border:none;background:none;border-radius:8px;">' + e + '</button>';
  }).join('');
  container.querySelectorAll('.emoji-select-btn').forEach(function(btn) {
    btn.addEventListener('click', function() {
      container.querySelectorAll('.emoji-select-btn').forEach(function(b) { b.style.background = ''; });
      this.style.background = 'rgba(102,126,234,0.3)';
      selectedRegEmoji = this.dataset.emoji;
    });
  });
}

function getSelectedEmoji() { return selectedRegEmoji; }

function nextRegStep(step) {
  document.querySelectorAll('.auth-step').forEach(function(el) {
    el.style.display = 'none'; el.classList.remove('active');
  });
  var stepEl = document.getElementById('regStep' + step);
  if (stepEl) {
    stepEl.style.display = 'block'; stepEl.classList.add('active');
    stepEl.style.animation = 'none'; stepEl.offsetHeight;
    stepEl.style.animation = 'dialogSlideIn 0.5s cubic-bezier(0.16, 1, 0.3, 1)';
  }
  document.querySelectorAll('.step-dot').forEach(function(dot, index) {
    dot.classList.remove('active', 'completed');
    if (index + 1 < step) dot.classList.add('completed');
    if (index + 1 === step) dot.classList.add('active');
  });
}

document.addEventListener('DOMContentLoaded', function() {
  initAuthForms();
  initEmojiSelector();
});

console.log('✅ auth.js загружен');
