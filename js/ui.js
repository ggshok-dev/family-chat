// ============ ИНТЕРФЕЙС FChat ============

let fontSize = parseInt(localStorage.getItem('fc_font') || '100');
let currentTheme = localStorage.getItem('fc_theme') || 'light';
let notifEnabled = localStorage.getItem('fc_notif') !== 'false';
let soundEnabled = localStorage.getItem('fc_sound') !== 'false';
let autoDeleteHours = parseInt(localStorage.getItem('fc_autoDelete') || '168');
let listenersInitialized = false;
let mediaRecorder = null;
let audioChunks = [];

// ============ РЕНДЕРИНГ ПОЛЬЗОВАТЕЛЕЙ ============
function renderUsers() {
  const container = document.getElementById('usersAvatars');
  if (!container || !currentFamilyData) return;
  
  const members = currentFamilyData.members || {};
  
  Promise.all(
    Object.entries(members).map(async function([userId, memberData]) {
      const userSnap = await db.ref('users/' + userId).once('value');
      const user = userSnap.val() || {};
      return {
        id: userId,
        name: user.name || 'Пользователь',
        emoji: user.emoji || '👤',
        role: memberData.role,
        roleData: ROLES[memberData.role],
        isActive: userId === currentUser
      };
    })
  ).then(function(users) {
    container.innerHTML = users.map(function(u) {
      const av = localStorage.getItem('fc_av_' + u.id);
      return `
        <div class="user-avatar ${u.isActive ? 'active' : ''}" data-user="${u.id}" title="${u.name} (${u.roleData?.name || 'Участник'})">
          <div class="avatar-circle" style="background:${av ? '#f0f0f0' : '#e0e0e0'};">
            ${av ? '<img src="' + av + '" alt="' + u.name + '">' : '<span>' + u.emoji + '</span>'}
            ${u.isActive ? '<div class="online-dot"></div>' : ''}
          </div>
          <span class="avatar-name">${u.name}</span>
          <span style="font-size:0.6rem;opacity:0.7;">${u.roleData?.name || ''}</span>
        </div>
      `;
    }).join('');
    
    container.querySelectorAll('.user-avatar').forEach(function(av) {
      av.addEventListener('click', function() {
        const userId = av.dataset.user;
        if (userId !== currentUser) {
          switchToPrivateChat(userId);
        }
      });
    });
  });
}

// ============ ЭМОДЗИ-ПИКЕР ============
function renderEmojiPicker() {
  const grid = document.getElementById('emojiGrid');
  if (!grid) return;
  grid.innerHTML = EMOJI_LIST.map(function(e) { return '<button class="emoji-item">' + e + '</button>'; }).join('');
  grid.querySelectorAll('.emoji-item').forEach(function(btn) {
    btn.addEventListener('click', function() {
      const msgInput = document.getElementById('msgInput');
      if (msgInput) { msgInput.value += btn.textContent; msgInput.focus(); }
    });
  });
}

// ============ МЕНЮ СООБЩЕНИЯ ============
function showMessageMenu(event, msg) {
  const old = document.querySelector('.context-menu');
  if (old) old.remove();
  const menu = document.createElement('div');
  menu.className = 'context-menu';
  const isTextMessage = msg.type === 'text' || !msg.type;
  menu.innerHTML = `
    <button>💬 Ответить</button>
    ${isTextMessage ? '<button>📋 Копировать</button>' : ''}
    ${isTextMessage && msg.from === currentUser ? '<button>✏️ Редактировать</button>' : ''}
    ${msg.from === currentUser || hasPermission('canDeleteOtherMessages') ? '<button class="danger-btn">🗑️ Удалить</button>' : ''}
    <button style="border-top:1px solid #eee;margin-top:4px;padding-top:8px;">😊 Реакции</button>
  `;
  const x = event.clientX || (event.touches && event.touches[0].clientX) || 100;
  const y = event.clientY || (event.touches && event.touches[0].clientY) || 100;
  menu.style.cssText = 'position:fixed;left:' + Math.min(x, window.innerWidth - 200) + 'px;top:' + Math.min(y, window.innerHeight - 250) + 'px;z-index:9999;';
  document.body.appendChild(menu);
  
  var allButtons = menu.querySelectorAll('button');
  var index = 0;
  allButtons[index].addEventListener('click', function() { menu.remove(); setReply(msg); document.getElementById('msgInput').focus(); }); index++;
  if (isTextMessage && allButtons[index]) { allButtons[index].addEventListener('click', function() { menu.remove(); navigator.clipboard?.writeText(msg.text || ''); showToast('✅ Скопировано!'); }); index++; }
  if (isTextMessage && msg.from === currentUser && allButtons[index]) { allButtons[index].addEventListener('click', function() { menu.remove(); const newText = prompt('Редактировать:', msg.text || ''); if (newText && newText !== msg.text) { db.ref(getChatPath() + '/' + msg.id).update({text: newText, edited: true}); } }); index++; }
  if ((msg.from === currentUser || hasPermission('canDeleteOtherMessages')) && allButtons[index]) { allButtons[index].addEventListener('click', function() { menu.remove(); if (confirm('Удалить?')) { db.ref(getChatPath() + '/' + msg.id).set(null); const el = document.querySelector('[data-id="' + msg.id + '"]'); if (el) { el.style.opacity = '0'; el.style.transition = '0.3s'; setTimeout(function() { el.remove(); }, 300); } processedIds.delete(msg.id); } }); index++; }
  if (allButtons[index]) { allButtons[index].addEventListener('click', function(e) { e.stopPropagation(); menu.remove(); showReactionMenu(event, msg); }); }
  
  setTimeout(function() { var close = function(e) { if (!menu.contains(e.target)) { menu.remove(); document.removeEventListener('click', close); } }; document.addEventListener('click', close); }, 10);
}

function showReactionMenu(event, msg) {
  const old = document.querySelector('.context-menu');
  if (old) old.remove();
  const menu = document.createElement('div');
  menu.className = 'context-menu';
  menu.innerHTML = '<div style="font-size:0.8rem;color:#999;padding:5px 10px;">Выберите реакцию:</div><div style="display:grid;grid-template-columns:repeat(4,1fr);gap:4px;padding:5px 8px 8px 8px;"><button class="reaction-btn" data-emoji="👍">👍</button><button class="reaction-btn" data-emoji="❤️">❤️</button><button class="reaction-btn" data-emoji="😂">😂</button><button class="reaction-btn" data-emoji="😢">😢</button><button class="reaction-btn" data-emoji="😡">😡</button><button class="reaction-btn" data-emoji="🔥">🔥</button><button class="reaction-btn" data-emoji="🎉">🎉</button><button class="reaction-btn" data-emoji="💯">💯</button></div>';
  menu.style.cssText = 'position:fixed;left:' + Math.min(event.clientX || 100, window.innerWidth - 200) + 'px;top:' + Math.min((event.clientY || 100), window.innerHeight - 200) + 'px;z-index:10000;';
  document.body.appendChild(menu);
  menu.querySelectorAll('.reaction-btn').forEach(function(btn) { btn.addEventListener('click', function(e) { e.stopPropagation(); addReaction(msg, btn.dataset.emoji); menu.remove(); }); });
  setTimeout(function() { var close = function(e) { if (!menu.contains(e.target)) { menu.remove(); document.removeEventListener('click', close); } }; document.addEventListener('click', close); }, 10);
}

function addReaction(msg, emoji) {
  const reactions = msg.reactions || {};
  if (reactions[currentUser] === emoji) { delete reactions[currentUser]; }
  else { reactions[currentUser] = emoji; }
  db.ref(getChatPath() + '/' + msg.id + '/reactions').set(reactions);
}

// ============ ТЕМЫ ============
function switchTheme() {
  const themes = ['light', 'dark-theme', 'green-theme', 'purple-theme'];
  const emojis = ['🌊', '🌙', '🌿', '🍇'];
  const current = document.body.className.match(/dark-theme|green-theme|purple-theme/) || ['light'];
  const idx = themes.indexOf(current[0] === 'light' ? 'light' : current[0]);
  const next = (idx + 1) % themes.length;
  document.body.classList.remove('dark-theme', 'green-theme', 'purple-theme');
  if (themes[next] !== 'light') document.body.classList.add(themes[next]);
  currentTheme = themes[next];
  localStorage.setItem('fc_theme', currentTheme);
  const btn = document.getElementById('themeBtn');
  if (btn) btn.textContent = emojis[next];
}

// ============ НАСТРОЙКИ ============
function applyStoredSettings() {
  const saved = localStorage.getItem('fc_theme') || 'light';
  currentTheme = saved;
  document.body.classList.remove('dark-theme', 'green-theme', 'purple-theme');
  if (saved === 'dark-theme') document.body.classList.add('dark-theme');
  else if (saved === 'green-theme') document.body.classList.add('green-theme');
  else if (saved === 'purple-theme') document.body.classList.add('purple-theme');
  fontSize = parseInt(localStorage.getItem('fc_font') || '100');
  document.documentElement.style.setProperty('--font-scale', fontSize / 100);
  const fv = document.getElementById('fontValue'); if (fv) fv.textContent = fontSize + '%';
  notifEnabled = localStorage.getItem('fc_notif') !== 'false';
  soundEnabled = localStorage.getItem('fc_sound') !== 'false';
  autoDeleteHours = parseInt(localStorage.getItem('fc_autoDelete') || '168');
  const nt = document.getElementById('notifToggle'); if (nt) nt.checked = notifEnabled;
  const st = document.getElementById('soundToggle'); if (st) st.checked = soundEnabled;
  const ad = document.getElementById('autoDelete'); if (ad) ad.value = autoDeleteHours;
  const nb = document.getElementById('notifBtn'); if (nb) nb.textContent = notifEnabled ? '🔔' : '🔕';
  const sb = document.getElementById('soundBtn'); if (sb) sb.textContent = soundEnabled ? '🔊' : '🔇';
  const tb = document.getElementById('themeBtn');
  if (tb) { const emojis = { 'light': '🌊', 'dark-theme': '🌙', 'green-theme': '🌿', 'purple-theme': '🍇' }; tb.textContent = emojis[saved] || '🌊'; }
}

function showToast(message) {
  const toast = document.createElement('div');
  toast.textContent = message;
  toast.style.cssText = 'position:fixed;bottom:20px;left:50%;transform:translateX(-50%);background:#333;color:white;padding:10px 20px;border-radius:20px;z-index:9999;font-size:0.9rem;';
  document.body.appendChild(toast);
  setTimeout(function() { toast.remove(); }, 2000);
}

function getAvatar(userId) { return localStorage.getItem('fc_av_' + userId) || null; }
function saveAvatar(userId, dataUrl) { localStorage.setItem('fc_av_' + userId, dataUrl); db.ref('users/' + userId + '/avatar').set(dataUrl); renderUsers(); }
function resetAvatar(userId) { localStorage.removeItem('fc_av_' + userId); db.ref('users/' + userId + '/avatar').remove(); renderUsers(); }

// ============ ГЛАВНАЯ ФУНКЦИЯ ИНИЦИАЛИЗАЦИИ ============
function setupUIListeners() {
  if (listenersInitialized) return;
  listenersInitialized = true;
  
  document.getElementById('sendBtn').addEventListener('click', function() { sendText(document.getElementById('msgInput').value, replyToMessage); });
  document.getElementById('msgInput').addEventListener('keydown', function(e) { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendText(this.value, replyToMessage); } });
  document.getElementById('msgInput').addEventListener('input', function() { startTypingIndicator(); });
  document.getElementById('emojiBtn').addEventListener('click', function() { document.getElementById('emojiPicker').classList.toggle('show'); });
  document.addEventListener('click', function(e) { const pk = document.getElementById('emojiPicker'), eb = document.getElementById('emojiBtn'); if (pk && eb && !pk.contains(e.target) && e.target !== eb) { pk.classList.remove('show'); } });
  
  document.querySelectorAll('.tab').forEach(function(tab) { tab.addEventListener('click', function() { if (tab.dataset.tab === 'general') { switchToGeneralChat(); } else { if (privateWith) { switchToPrivateChat(privateWith); } } }); });
  document.getElementById('settingsBtn').addEventListener('click', function() { document.getElementById('settingsPanel').classList.toggle('show'); });
  document.getElementById('themeBtn').addEventListener('click', switchTheme);
  
  // Кнопка уведомлений
  document.getElementById('notifBtn').addEventListener('click', function() {
    notifEnabled = !notifEnabled; localStorage.setItem('fc_notif', notifEnabled);
    this.textContent = notifEnabled ? '🔔' : '🔕';
    const nt = document.getElementById('notifToggle'); if (nt) nt.checked = notifEnabled;
  });
  
  // Кнопка звука
  document.getElementById('soundBtn').addEventListener('click', function() {
    soundEnabled = !soundEnabled; localStorage.setItem('fc_sound', soundEnabled);
    this.textContent = soundEnabled ? '🔊' : '🔇';
    const st = document.getElementById('soundToggle'); if (st) st.checked = soundEnabled;
  });
  
  // СИНХРОНИЗАЦИЯ ПОЛЗУНКОВ С КНОПКАМИ
  document.getElementById('notifToggle').addEventListener('change', function() {
    notifEnabled = this.checked; localStorage.setItem('fc_notif', notifEnabled);
    document.getElementById('notifBtn').textContent = notifEnabled ? '🔔' : '🔕';
  });
  document.getElementById('soundToggle').addEventListener('change', function() {
    soundEnabled = this.checked; localStorage.setItem('fc_sound', soundEnabled);
    document.getElementById('soundBtn').textContent = soundEnabled ? '🔊' : '🔇';
  });
  
  // Шрифт
  document.getElementById('fontUp').addEventListener('click', function() { if (fontSize < 150) { fontSize += 10; updateFontSize(); } });
  document.getElementById('fontDown').addEventListener('click', function() { if (fontSize > 80) { fontSize -= 10; updateFontSize(); } });
  
  // Файлы
  document.getElementById('attachBtn').addEventListener('click', function() { document.getElementById('fileInput').click(); });
  document.getElementById('fileInput').addEventListener('change', function(e) { const files = e.target.files; for (let i = 0; i < files.length; i++) { const file = files[i]; const reader = new FileReader(); if (file.type.startsWith('image/')) { reader.onload = function(ev) { sendMedia('image', ev.target.result); }; } else { reader.onload = function(ev) { sendMedia('file', ev.target.result, file.name, file.type); }; } reader.readAsDataURL(file); } e.target.value = ''; });
  
  // Аватар
  document.getElementById('avatarBtn').addEventListener('click', function() { document.getElementById('avatarInput').click(); });
  document.getElementById('avatarInput').addEventListener('change', function(e) { const file = e.target.files[0]; if (file && file.type.startsWith('image/')) { const reader = new FileReader(); reader.onload = function(ev) { saveAvatar(currentUser, ev.target.result); }; reader.readAsDataURL(file); } e.target.value = ''; });
  document.getElementById('avatarResetBtn').addEventListener('click', function() { if (confirm('Сбросить аватар?')) resetAvatar(currentUser); });
  
  // Микрофон
  document.getElementById('micBtn').addEventListener('click', function() {
    const btn = document.getElementById('micBtn');
    if (mediaRecorder && mediaRecorder.state === 'recording') { mediaRecorder.stop(); btn.classList.remove('recording'); btn.textContent = '🎤'; return; }
    navigator.mediaDevices.getUserMedia({audio: true}).then(function(stream) { mediaRecorder = new MediaRecorder(stream); audioChunks = []; mediaRecorder.ondataavailable = function(e) { audioChunks.push(e.data); }; mediaRecorder.onstop = function() { const blob = new Blob(audioChunks, {type: 'audio/webm'}); const reader = new FileReader(); reader.onload = function(ev) { sendMedia('voice', ev.target.result); }; reader.readAsDataURL(blob); stream.getTracks().forEach(function(t) { t.stop(); }); }; mediaRecorder.start(); btn.classList.add('recording'); btn.textContent = '⏹️'; setTimeout(function() { if (mediaRecorder && mediaRecorder.state === 'recording') { mediaRecorder.stop(); btn.classList.remove('recording'); btn.textContent = '🎤'; } }, 30000); }).catch(function() { alert('Нет доступа к микрофону'); });
  });
  
  // Автоудаление
  document.getElementById('autoDelete').addEventListener('change', function() { autoDeleteHours = parseInt(this.value); localStorage.setItem('fc_autoDelete', autoDeleteHours); });
  
  // Очистка чата
  document.getElementById('clearBtn').addEventListener('click', function() { if (confirm('Удалить все сообщения?')) { db.ref(getChatPath()).set(null); processedIds.clear(); loadMessages(); } });
  
  // Кэш
  document.getElementById('cacheBtn').addEventListener('click', function() { if (confirm('Перезагрузить?')) location.reload(); });
  
  // Пригласить в семью
  const inviteBtn = document.getElementById('inviteMemberBtn');
  if (inviteBtn) { inviteBtn.addEventListener('click', function() { const email = prompt('Email приглашаемого:'); if (email) alert('📧 Приглашение для ' + email + '\n(Функция в разработке)'); }); }
  
  // Код приглашения
  const codeBtn = document.getElementById('showInviteCodeBtn');
  if (codeBtn) { codeBtn.addEventListener('click', function() { const code = getInviteCode(); alert(code ? '📋 Код: ' + code : 'Нет кода'); }); }
  
  // Сменить ПИН
  const pinBtn = document.getElementById('changePinBtn');
  if (pinBtn) { pinBtn.addEventListener('click', function() { const old = prompt('Текущий ПИН:'); if (!old || !verifyPin(old)) { alert('Неверно'); return; } const newPin = prompt('Новый ПИН (4 цифры):'); if (newPin && newPin.length === 4 && /^\d{4}$/.test(newPin)) { setPin(newPin); alert('✅ ПИН изменён!'); } }); }
  
  document.addEventListener('visibilitychange', function() { if (document.visibilityState === 'visible') { document.title = 'FChat'; } });
}

function updateFontSize() { document.documentElement.style.setProperty('--font-scale', fontSize / 100); document.getElementById('fontValue').textContent = fontSize + '%'; localStorage.setItem('fc_font', fontSize); }
function playSound() { if (!soundEnabled) return; try { const ctx = new (window.AudioContext || window.webkitAudioContext)(); const osc = ctx.createOscillator(); const gain = ctx.createGain(); osc.connect(gain); gain.connect(ctx.destination); osc.frequency.value = 800; gain.gain.value = 0.1; osc.start(); gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.3); osc.stop(ctx.currentTime + 0.3); } catch(e) {} }

console.log('✅ ui.js загружен');
