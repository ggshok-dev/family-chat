(function() {
  // ============ FIREBASE ============
  const firebaseConfig = {
    apiKey: "AIzaSyAGqZPNEL2eihYYxr0ZJoE-Tedg1cO5cVo",
    authDomain: "fchat-d6879.firebaseapp.com",
    databaseURL: "https://fchat-d6879-default-rtdb.europe-west1.firebasedatabase.app",
    projectId: "fchat-d6879",
    storageBucket: "fchat-d6879.firebasestorage.app",
    messagingSenderId: "1049514912319",
    appId: "1:1049514912319:web:2ec9ca065eca5ac5da668a"
  };
  
  firebase.initializeApp(firebaseConfig);
  const db = firebase.database();
  
  // ============ КОНСТАНТЫ ============
  const FAMILY = {
    dad: { id: 'dad', name: 'Папа', emoji: '👨', color: '#4A90E2' },
    mom: { id: 'mom', name: 'Мама', emoji: '👩', color: '#E91E63' },
    sergey: { id: 'sergey', name: 'Сергей', emoji: '👦', color: '#4CAF50' },
    sveta: { id: 'sveta', name: 'Света', emoji: '👧', color: '#FF9800' },
    katya: { id: 'katya', name: 'Катя', emoji: '👧', color: '#9C27B0' }
  };
  
  const EMOJI_LIST = ['😀','😂','🤣','😃','😄','😅','😆','😉','😊','😋','😎','😍','🥰','😘','😗','😙','😚','🙂','🤗','🤩','🤔','🤨','😐','😑','😶','🙄','😏','😣','😥','😮','🤐','😯','😪','😫','😴','😌','😛','😜','😝','🤤','😒','😓','😔','😕','🙃','🤑','😲','☹️','🙁','😖','😞','😟','😤','😢','😭','😦','😧','😨','😩','🤯','😬','😰','😱','🥵','🥶','😳','🤪','😵','😡','😠','🤬','😷','🤒','🤕','🤢','🤮','😇','🤠','🤡','🥳','🥴','🥺','🤥','🤫','🤭','🧐','🤓','😈','👿','👹','👺','💀','👻','👽','🤖','💩','❤️','🧡','💛','💚','💙','💜','🖤','🤍','🤎','💔','❣️','💕','💞','💓','💗','💖','👍','👎','👏','🙌','🤝','💪','✌️','🤞','👌','🤏','✋','👋','🤚','🖐️','✍️','🙏','👨‍👩‍👧‍👦','🏠','🎉','🎂','🍕','🍔','🌮','🍩','☕','🍰','🎄','🎁','🎈','⭐','🌟','🔥'];
  
  // ============ СОСТОЯНИЕ ============
  let currentUser = null;
  let activeTab = 'general';
  let privateWith = null;
  let autoDeleteHours = parseInt(localStorage.getItem('fc_autoDelete') || '24');
  let notifEnabled = localStorage.getItem('fc_notif') !== 'false';
  let soundEnabled = localStorage.getItem('fc_sound') !== 'false';
  let secretCode = localStorage.getItem('fc_code') || 'family2024';
  let fontSize = parseInt(localStorage.getItem('fc_font') || '100');
  let isDarkTheme = localStorage.getItem('fc_theme') === 'dark';
  let messageListener = null;
  let mediaRecorder = null;
  let audioChunks = [];
  let processedIds = new Set();
  let pendingPinUser = null;
  
  if (!localStorage.getItem('fc_code')) {
    localStorage.setItem('fc_code', 'family2024');
  }
  
  // ============ ПИН-КОДЫ ============
  function getPin(userId) { return localStorage.getItem('fc_pin_' + userId) || null; }
  function setPin(userId, pin) { localStorage.setItem('fc_pin_' + userId, pin); }
  function hasPin(userId) { return !!getPin(userId); }
  function verifyPin(userId, pin) { return getPin(userId) === pin; }
  
  function showPinDialog(userId) {
    pendingPinUser = userId;
    const user = FAMILY[userId];
    document.getElementById('pinUserIcon').textContent = user.emoji;
    document.getElementById('pinUserName').textContent = user.name;
    if (hasPin(userId)) {
      document.getElementById('pinTitle').textContent = 'Введите ПИН-код';
      document.getElementById('pinDescription').innerHTML = 'Для входа как <strong>' + user.name + '</strong>';
      document.getElementById('pinHint').textContent = 'Введите ваш 4-значный ПИН';
    } else {
      document.getElementById('pinTitle').textContent = 'Создайте ПИН-код';
      document.getElementById('pinDescription').innerHTML = 'Придумайте ПИН для <strong>' + user.name + '</strong>';
      document.getElementById('pinHint').textContent = 'Придумайте 4 цифры и запомните их';
    }
    document.getElementById('pinInput').value = '';
    document.getElementById('pinError').classList.remove('show');
    document.getElementById('pinOverlay').style.display = 'flex';
    setTimeout(() => document.getElementById('pinInput').focus(), 100);
  }
  
  function hidePinDialog() {
    document.getElementById('pinOverlay').style.display = 'none';
    pendingPinUser = null;
  }
  
  function processPin() {
    const pin = document.getElementById('pinInput').value.trim();
    if (!pin || pin.length !== 4 || !/^\d{4}$/.test(pin)) {
      document.getElementById('pinError').textContent = 'ПИН должен состоять из 4 цифр';
      document.getElementById('pinError').classList.add('show');
      return;
    }
    if (hasPin(pendingPinUser)) {
      if (verifyPin(pendingPinUser, pin)) {
        loginAsUser(pendingPinUser);
        hidePinDialog();
      } else {
        document.getElementById('pinError').textContent = 'Неверный ПИН-код';
        document.getElementById('pinError').classList.add('show');
        document.getElementById('pinInput').value = '';
      }
    } else {
      setPin(pendingPinUser, pin);
      loginAsUser(pendingPinUser);
      hidePinDialog();
      alert('✅ ПИН-код создан!');
    }
  }
  
  function loginAsUser(userId) {
    currentUser = userId;
    localStorage.setItem('fc_user', userId);
    renderUsers();
    updatePrivate();
    loadMessages();
    updatePrivateHeader();
  }
  
  // ============ АВАТАРКИ ============
  function getAvatar(userId) { return localStorage.getItem('fc_av_' + userId) || null; }
  
  function saveAvatar(userId, dataUrl) {
    const img = new Image();
    img.onload = function() {
      const canvas = document.createElement('canvas');
      const size = 200;
      canvas.width = size; canvas.height = size;
      const ctx = canvas.getContext('2d');
      const minSide = Math.min(img.width, img.height);
      const sx = (img.width - minSide) / 2;
      const sy = (img.height - minSide) / 2;
      ctx.fillStyle = '#e0e0e0';
      ctx.fillRect(0, 0, size, size);
      ctx.drawImage(img, sx, sy, minSide, minSide, 0, 0, size, size);
      localStorage.setItem('fc_av_' + userId, canvas.toDataURL('image/jpeg', 0.7));
      renderUsers();
      alert('✅ Аватар обновлён!');
    };
    img.onerror = function() { alert('❌ Не удалось загрузить изображение'); };
    img.src = dataUrl;
  }
  
  function resetAvatar(userId) {
    localStorage.removeItem('fc_av_' + userId);
    renderUsers();
    alert('✅ Аватар сброшен');
  }
  
  // ============ РЕНДЕРИНГ ============
  function renderUsers() {
    const container = document.getElementById('usersAvatars');
    container.innerHTML = Object.values(FAMILY).map(m => {
      const av = getAvatar(m.id);
      const isActive = m.id === currentUser;
      const isLocked = !isActive && hasPin(m.id);
      return `
        <div class="user-avatar ${isActive ? 'active' : ''} ${isLocked ? 'locked' : ''}" 
             data-user="${m.id}">
          <div class="avatar-circle" style="background:${av ? '#f0f0f0' : m.color + '20'};">
            ${av ? '<img src="' + av + '" alt="' + m.name + '">' : 
              '<span class="default-emoji">' + m.emoji + '</span>'}
          </div>
          <span class="avatar-name">${m.name}</span>
        </div>
      `;
    }).join('');
    
    container.querySelectorAll('.user-avatar').forEach(av => {
      av.addEventListener('click', function() {
        const userId = av.dataset.user;
        if (userId === currentUser) return;
        if (currentUser && activeTab === 'general' && hasPin(userId)) {
          if (confirm('Перейти в личный чат с ' + FAMILY[userId].name + '?')) {
            switchToPrivateChat(userId);
            return;
          }
        }
        showPinDialog(userId);
      });
    });
  }
  
  function renderEmoji() {
    const grid = document.getElementById('emojiGrid');
    grid.innerHTML = EMOJI_LIST.map(e => '<button class="emoji-item">' + e + '</button>').join('');
    grid.querySelectorAll('.emoji-item').forEach(btn => {
      btn.addEventListener('click', function() {
        document.getElementById('msgInput').value += btn.textContent;
        document.getElementById('msgInput').focus();
      });
    });
  }
  
  function showMessage(msg) {
    if (processedIds.has(msg.id)) return;
    processedIds.add(msg.id);
    
    const chat = document.getElementById('chatWindow');
    const empty = chat.querySelector('.empty-chat');
    if (empty) empty.remove();
    
    const isSent = msg.from === currentUser;
    const sender = FAMILY[msg.from] || { name: 'Кто-то', emoji: '👤' };
    const senderAv = getAvatar(msg.from);
    
    const div = document.createElement('div');
    div.className = 'message ' + (isSent ? 'sent' : 'received');
    div.dataset.id = msg.id;
    
    let content = '';
    if (msg.type === 'image') {
      content = `<img src="${msg.data}" class="media-img" alt="Фото" loading="lazy" 
                  onclick="if(this.requestFullscreen){this.requestFullscreen()}else{window.open(this.src)}">`;
    } else if (msg.type === 'voice') {
      content = `<audio controls class="media-audio" src="${msg.data}"></audio>`;
    } else {
      content = msg.text || '';
    }
    
    const time = new Date(msg.timestamp).toLocaleTimeString('ru-RU', {hour:'2-digit', minute:'2-digit'});
    
    div.innerHTML = 
      (!isSent ? '<div class="msg-sender"><span class="sender-avatar">' + 
        (senderAv ? '<img src="' + senderAv + '">' : '<span>' + sender.emoji + '</span>') + 
        '</span>' + sender.name + '</div>' : '') +
      '<div class="bubble">' + content + 
        '<div class="msg-time"><span>' + time + '</span>' + 
        (isSent ? '<span class="msg-menu-btn">⋮</span>' : '') + 
      '</div></div>';
    
    if (isSent) {
      div.querySelector('.msg-menu-btn').addEventListener('click', function(e) {
        e.stopPropagation();
        showMenu(e, msg);
      });
    }
    
    chat.appendChild(div);
    chat.scrollTop = chat.scrollHeight;
  }
  
  function showMenu(event, msg) {
    const old = document.querySelector('.context-menu');
    if (old) old.remove();
    
    const menu = document.createElement('div');
    menu.className = 'context-menu';
    menu.innerHTML = '<button>✏️ Редактировать</button><button class="danger-btn">🗑️ Удалить</button>';
    menu.style.left = Math.min(event.clientX, window.innerWidth - 150) + 'px';
    menu.style.top = event.clientY + 'px';
    document.body.appendChild(menu);
    
    menu.querySelectorAll('button')[0].addEventListener('click', function() {
      menu.remove();
      const text = prompt('Новый текст:', msg.text || '');
      if (text && text !== msg.text) {
        db.ref(getChatPath() + '/' + msg.id).update({text: text, edited: true});
      }
    });
    
    menu.querySelectorAll('button')[1].addEventListener('click', function() {
      menu.remove();
      if (confirm('Удалить сообщение?')) {
        db.ref(getChatPath() + '/' + msg.id).remove();
        processedIds.delete(msg.id);
      }
    });
    
    setTimeout(() => {
      document.addEventListener('click', function close() { menu.remove(); document.removeEventListener('click', close); });
    }, 0);
  }
  
  function updatePrivateHeader() {
    const header = document.getElementById('privateChatHeader');
    if (!header) return;
    
    if (activeTab === 'private' && privateWith && currentUser) {
      const partner = FAMILY[privateWith];
      if (partner) {
        header.style.display = 'flex';
        header.querySelector('.partner-emoji').textContent = partner.emoji;
        header.querySelector('.partner-name').textContent = partner.name;
      }
    } else {
      header.style.display = 'none';
    }
  }
  
  // ============ ЧАТ ============
  function getChatPath() {
    if (!currentUser) return 'general';
    if (activeTab === 'private' && privateWith) {
      const users = [currentUser, privateWith].sort();
      return 'private/' + users[0] + '_' + users[1];
    }
    return 'general';
  }
  
  function loadMessages() {
    if (!currentUser) return;
    if (messageListener) db.ref(getChatPath()).off('child_added', messageListener);
    
    const ref = db.ref(getChatPath());
    document.getElementById('chatWindow').innerHTML = '<div class="empty-chat"><div class="empty-icon">💬</div><p>Загрузка...</p></div>';
    processedIds.clear();
    
    ref.once('value', snap => {
      const msgs = snap.val();
      document.getElementById('chatWindow').innerHTML = '';
      if (!msgs) {
        document.getElementById('chatWindow').innerHTML = '<div class="empty-chat"><div class="empty-icon">💬</div><p>Нет сообщений</p></div>';
        return;
      }
      Object.entries(msgs)
        .map(e => Object.assign({id: e[0]}, e[1]))
        .sort((a, b) => (a.timestamp || 0) - (b.timestamp || 0))
        .forEach(msg => showMessage(msg));
    });
    
    messageListener = ref.on('child_added', snap => {
      const msg = Object.assign({id: snap.key}, snap.val());
      if (!processedIds.has(msg.id)) {
        showMessage(msg);
        if (msg.from !== currentUser) {
          const sender = FAMILY[msg.from] || {name: 'Кто-то'};
          notify(sender.emoji + ' ' + sender.name, msg.text || 'Новое сообщение');
        }
      }
    });
    
    ref.on('child_changed', snap => {
      const msg = Object.assign({id: snap.key}, snap.val());
      const old = document.querySelector('[data-id="' + msg.id + '"]');
      if (old) old.remove();
      processedIds.delete(msg.id);
      showMessage(msg);
    });
    
    ref.on('child_removed', snap => {
      const el = document.querySelector('[data-id="' + snap.key + '"]');
      if (el) el.remove();
      processedIds.delete(snap.key);
    });
  }
  
  function sendText(text) {
    if (!currentUser) { alert('Сначала выберите пользователя и введите ПИН-код'); return; }
    if (!text.trim()) return;
    
    const msg = {
      from: currentUser,
      text: text.trim(),
      timestamp: firebase.database.ServerValue.TIMESTAMP,
      type: 'text'
    };
    if (autoDeleteHours > 0) msg.deleteAt = Date.now() + autoDeleteHours * 3600000;
    db.ref(getChatPath()).push(msg);
    document.getElementById('msgInput').value = '';
  }
  
  function sendMedia(type, dataUrl) {
    if (!currentUser) { alert('Сначала выберите пользователя и введите ПИН-код'); return; }
    
    if (type === 'voice') {
      const msg = {
        from: currentUser, type: 'voice', data: dataUrl,
        timestamp: firebase.database.ServerValue.TIMESTAMP, text: '🎤 Голосовое'
      };
      if (autoDeleteHours > 0) msg.deleteAt = Date.now() + autoDeleteHours * 3600000;
      db.ref(getChatPath()).push(msg);
      return;
    }
    
    const img = new Image();
    img.onload = function() {
      const canvas = document.createElement('canvas');
      let w = img.width, h = img.height;
      if (w > 1200) { h = (h * 1200) / w; w = 1200; }
      canvas.width = w; canvas.height = h;
      canvas.getContext('2d').drawImage(img, 0, 0, w, h);
      
      const msg = {
        from: currentUser, type: 'image', data: canvas.toDataURL('image/jpeg', 0.7),
        timestamp: firebase.database.ServerValue.TIMESTAMP, text: '📷 Фото'
      };
      if (autoDeleteHours > 0) msg.deleteAt = Date.now() + autoDeleteHours * 3600000;
      db.ref(getChatPath()).push(msg);
    };
    img.src = dataUrl;
  }
  
  function switchToPrivateChat(userId) {
    activeTab = 'private';
    privateWith = userId;
    document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
    document.querySelector('.tab[data-tab="private"]').classList.add('active');
    document.getElementById('privateSel').style.display = 'block';
    updatePrivate();
    loadMessages();
    updatePrivateHeader();
  }
  
  function updatePrivate() {
    const sel = document.getElementById('privateRecipient');
    const others = Object.values(FAMILY).filter(m => m.id !== currentUser);
    sel.innerHTML = '<option value="">Выберите...</option>' +
      others.map(m => `<option value="${m.id}" ${m.id === privateWith ? 'selected' : ''}>${m.emoji} ${m.name}</option>`).join('');
  }
  
  // ============ УВЕДОМЛЕНИЯ ============
  function notify(title, body) {
    if (!notifEnabled) return;
    if (document.visibilityState === 'visible') { playSound(); return; }
    if ('Notification' in window && Notification.permission === 'granted') {
      new Notification(title, {body: body, icon: '👨‍👩‍👧‍👦', tag: 'fc'});
    }
    playSound();
  }
  
  function playSound() {
    if (!soundEnabled) return;
    try {
      const ctx = new (window.AudioContext || window.webkitAudioContext)();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain); gain.connect(ctx.destination);
      osc.frequency.value = 800; gain.gain.value = 0.1;
      osc.start(); gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.3);
      osc.stop(ctx.currentTime + 0.3);
    } catch(e) {}
  }
  
  function requestNotif() {
    if ('Notification' in window && Notification.permission === 'default') Notification.requestPermission();
  }
  
  // ============ АВТОУДАЛЕНИЕ ============
  function startAutoDelete() {
    setInterval(() => {
      if (autoDeleteHours === 0 || !currentUser) return;
      db.ref(getChatPath()).once('value').then(snap => {
        const msgs = snap.val();
        if (!msgs) return;
        const now = Date.now();
        const updates = {};
        for (const [id, msg] of Object.entries(msgs)) {
          if (msg.deleteAt && msg.deleteAt <= now) { updates[id] = null; processedIds.delete(id); }
        }
        if (Object.keys(updates).length > 0) db.ref(getChatPath()).update(updates);
      });
    }, 30000);
  }
  
  // ============ НАСТРОЙКИ ============
  function applyStoredSettings() {
    if (isDarkTheme) {
      document.body.classList.add('dark-theme');
      document.getElementById('themeBtn').textContent = '☀️';
    }
    document.documentElement.style.setProperty('--font-scale', fontSize / 100);
    document.getElementById('fontValue').textContent = fontSize + '%';
    document.getElementById('notifToggle').checked = notifEnabled;
    document.getElementById('soundToggle').checked = soundEnabled;
    document.getElementById('autoDelete').value = autoDeleteHours;
    document.getElementById('notifBtn').textContent = notifEnabled ? '🔔' : '🔕';
    document.getElementById('soundBtn').textContent = soundEnabled ? '🔊' : '🔇';
  }
  
  function applyFontSize() {
    document.documentElement.style.setProperty('--font-scale', fontSize / 100);
    document.getElementById('fontValue').textContent = fontSize + '%';
    localStorage.setItem('fc_font', fontSize);
  }
  
  // ============ ОБРАБОТЧИКИ ============
  function setupListeners() {
    // Секретный код
    document.getElementById('secretBtn').addEventListener('click', () => {
      const input = document.getElementById('secretInput').value;
      if (input === secretCode) {
        document.getElementById('secretOverlay').style.display = 'none';
        document.getElementById('mainApp').style.display = 'flex';
        initApp();
      } else {
        document.getElementById('errorMsg').classList.add('show');
        document.getElementById('secretInput').value = '';
        document.getElementById('secretInput').focus();
      }
    });
    
    document.getElementById('secretInput').addEventListener('keydown', e => {
      if (e.key === 'Enter') document.getElementById('secretBtn').click();
    });
    
    document.getElementById('secretInput').focus();
    
    // ПИН
    document.getElementById('pinBtn').addEventListener('click', processPin);
    document.getElementById('pinInput').addEventListener('keydown', e => { if (e.key === 'Enter') processPin(); });
    document.getElementById('pinOverlay').addEventListener('click', e => { if (e.target === e.currentTarget) hidePinDialog(); });
    
    // Отправка
    document.getElementById('sendBtn').addEventListener('click', () => sendText(document.getElementById('msgInput').value));
    document.getElementById('msgInput').addEventListener('keydown', e => {
      if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendText(e.target.value); }
    });
    
    // Эмодзи
    document.getElementById('emojiBtn').addEventListener('click', () => document.getElementById('emojiPicker').classList.toggle('show'));
    document.addEventListener('click', e => {
      const pk = document.getElementById('emojiPicker'), eb = document.getElementById('emojiBtn');
      if (!pk.contains(e.target) && e.target !== eb) pk.classList.remove('show');
    });
    
    // Файлы
    document.getElementById('attachBtn').addEventListener('click', () => {
      if (!currentUser) { alert('Сначала войдите'); return; }
      document.getElementById('fileInput').click();
    });
    document.getElementById('fileInput').addEventListener('change', e => {
      const file = e.target.files[0];
      if (file && file.type.startsWith('image/')) {
        const reader = new FileReader();
        reader.onload = ev => sendMedia('image', ev.target.result);
        reader.readAsDataURL(file);
      }
      e.target.value = '';
    });
    
    // Аватар
    document.getElementById('avatarBtn').addEventListener('click', () => {
      if (!currentUser) { alert('Сначала войдите'); return; }
      document.getElementById('avatarInput').click();
    });
    document.getElementById('avatarResetBtn').addEventListener('click', () => {
      if (!currentUser) return;
      if (confirm('Сбросить аватар?')) resetAvatar(currentUser);
    });
    document.getElementById('avatarInput').addEventListener('change', e => {
      const file = e.target.files[0];
      if (file && file.type.startsWith('image/')) {
        const reader = new FileReader();
        reader.onload = ev => saveAvatar(currentUser, ev.target.result);
        reader.readAsDataURL(file);
      }
      e.target.value = '';
    });
    
    // Микрофон
    document.getElementById('micBtn').addEventListener('click', () => {
      if (!currentUser) { alert('Сначала войдите'); return; }
      const btn = document.getElementById('micBtn');
      
      if (mediaRecorder && mediaRecorder.state === 'recording') {
        mediaRecorder.stop(); btn.classList.remove('recording'); btn.textContent = '🎤'; return;
      }
      
      navigator.mediaDevices.getUserMedia({audio: true}).then(stream => {
        mediaRecorder = new MediaRecorder(stream);
        audioChunks = [];
        mediaRecorder.ondataavailable = e => audioChunks.push(e.data);
        mediaRecorder.onstop = () => {
          const blob = new Blob(audioChunks, {type: 'audio/webm'});
          const reader = new FileReader();
          reader.onload = ev => sendMedia('voice', ev.target.result);
          reader.readAsDataURL(blob);
          stream.getTracks().forEach(t => t.stop());
        };
        mediaRecorder.start();
        btn.classList.add('recording'); btn.textContent = '⏹️';
        setTimeout(() => {
          if (mediaRecorder && mediaRecorder.state === 'recording') {
            mediaRecorder.stop(); btn.classList.remove('recording'); btn.textContent = '🎤';
          }
        }, 10000);
      }).catch(() => alert('Нет доступа к микрофону'));
    });
    
    // Вкладки
    document.querySelectorAll('.tab').forEach(tab => {
      tab.addEventListener('click', function() {
        document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
        this.classList.add('active');
        activeTab = this.dataset.tab;
        document.getElementById('privateSel').style.display = activeTab === 'private' ? 'block' : 'none';
        if (activeTab !== 'private') privateWith = null;
        updatePrivate();
        loadMessages();
        updatePrivateHeader();
      });
    });
    
    document.getElementById('privateRecipient').addEventListener('change', function() {
      privateWith = this.value;
      if (privateWith) { loadMessages(); updatePrivateHeader(); }
    });
    
    // Настройки
    document.getElementById('settingsBtn').addEventListener('click', () => document.getElementById('settingsPanel').classList.toggle('show'));
    
    document.getElementById('themeBtn').addEventListener('click', function() {
      isDarkTheme = !isDarkTheme;
      document.body.classList.toggle('dark-theme', isDarkTheme);
      this.textContent = isDarkTheme ? '☀️' : '🌙';
      localStorage.setItem('fc_theme', isDarkTheme ? 'dark' : 'light');
    });
    
    document.getElementById('notifToggle').addEventListener('change', function() {
      notifEnabled = this.checked;
      localStorage.setItem('fc_notif', notifEnabled);
      document.getElementById('notifBtn').textContent = notifEnabled ? '🔔' : '🔕';
      if (notifEnabled) requestNotif();
    });
    
    document.getElementById('soundToggle').addEventListener('change', function() {
      soundEnabled = this.checked;
      localStorage.setItem('fc_sound', soundEnabled);
      document.getElementById('soundBtn').textContent = soundEnabled ? '🔊' : '🔇';
    });
    
    document.getElementById('autoDelete').addEventListener('change', function() {
      autoDeleteHours = parseInt(this.value);
      localStorage.setItem('fc_autoDelete', autoDeleteHours);
    });
    
    document.getElementById('fontUp').addEventListener('click', () => { if (fontSize < 150) { fontSize += 10; applyFontSize(); } });
    document.getElementById('fontDown').addEventListener('click', () => { if (fontSize > 80) { fontSize -= 10; applyFontSize(); } });
    
    document.getElementById('changePinBtn').addEventListener('click', () => {
      if (!currentUser) { alert('Сначала войдите'); return; }
      const oldPin = prompt('Текущий ПИН:');
      if (!oldPin || !verifyPin(currentUser, oldPin)) { alert('Неверно'); return; }
      const newPin = prompt('Новый 4-значный ПИН:');
      if (!newPin || newPin.length !== 4 || !/^\d{4}$/.test(newPin)) { alert('4 цифры!'); return; }
      setPin(currentUser, newPin);
      alert('✅ Готово!');
    });
    
    document.getElementById('changeCodeBtn').addEventListener('click', () => {
      const old = prompt('Текущий код семьи:');
      if (old !== secretCode) { alert('Неверно'); return; }
      const newCode = prompt('Новый код:');
      if (newCode && newCode.length >= 4) {
        secretCode = newCode;
        localStorage.setItem('fc_code', secretCode);
        alert('✅ Код изменён!');
      }
    });
    
    document.getElementById('cacheBtn').addEventListener('click', () => {
      if (confirm('Перезагрузить?')) location.reload();
    });
    
    document.getElementById('clearBtn').addEventListener('click', () => {
      if (!currentUser) return;
      if (confirm('Удалить все сообщения?')) {
        db.ref(getChatPath()).remove();
        processedIds.clear();
      }
    });
  }
  
  // ============ ЗАПУСК ============
  function initApp() {
    applyStoredSettings();
    renderEmoji();
    renderUsers();
    setupListeners();
    startAutoDelete();
    requestNotif();
    updatePrivateHeader();
    
    const savedUser = localStorage.getItem('fc_user');
    if (savedUser && FAMILY[savedUser]) {
      showPinDialog(savedUser);
    } else {
      document.getElementById('chatWindow').innerHTML = `
        <div class="empty-chat">
          <div class="empty-icon">🔒</div>
          <p>Выберите пользователя и введите ПИН-код</p>
        </div>
      `;
    }
  }
  
  console.log('✅ FChat загружен');
})();
