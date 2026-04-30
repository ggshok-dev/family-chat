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
  let secretCode = 'family2026';
  localStorage.setItem('fc_code', 'family2026');
  let fontSize = parseInt(localStorage.getItem('fc_font') || '100');
  let isDarkTheme = localStorage.getItem('fc_theme') === 'dark';
  let messageListener = null;
  let mediaRecorder = null;
  let audioChunks = [];
  let processedIds = new Set();
  let pendingPinUser = null;
  let listenersInitialized = false;
  let lockedUser = localStorage.getItem('fc_locked_user') || null;
  let unreadCount = 0;
  
  if (!localStorage.getItem('fc_theme')) {
    localStorage.setItem('fc_theme', 'light');
  }
  
  function getPin(userId) { return localStorage.getItem('fc_pin_' + userId) || null; }
  function setPin(userId, pin) { localStorage.setItem('fc_pin_' + userId, pin); }
  function hasPin(userId) { return !!getPin(userId); }
  function verifyPin(userId, pin) { return getPin(userId) === pin; }
  
  function updateUnreadBadge() {
    if (unreadCount > 0) {
      document.title = '(' + unreadCount + ') FChat';
    } else {
      document.title = 'FChat';
    }
  }
  
  function showPinDialog(userId) {
    if (!userId || !FAMILY[userId]) return;
    pendingPinUser = userId;
    const user = FAMILY[userId];
    
    const pinUserIcon = document.getElementById('pinUserIcon');
    const pinUserName = document.getElementById('pinUserName');
    const pinTitle = document.getElementById('pinTitle');
    const pinDescription = document.getElementById('pinDescription');
    const pinHint = document.getElementById('pinHint');
    
    if (pinUserIcon) pinUserIcon.textContent = user.emoji;
    if (pinUserName) pinUserName.textContent = user.name;
    
    if (hasPin(userId)) {
      if (pinTitle) pinTitle.textContent = 'Введите ПИН-код';
      if (pinDescription) pinDescription.innerHTML = 'Для входа как <strong>' + user.name + '</strong>';
      if (pinHint) pinHint.textContent = 'Введите ваш 4-значный ПИН';
    } else {
      if (pinTitle) pinTitle.textContent = 'Создайте ПИН-код';
      if (pinDescription) pinDescription.innerHTML = 'Придумайте ПИН для <strong>' + user.name + '</strong>';
      if (pinHint) pinHint.textContent = '⚠️ После создания ПИН эта роль будет закреплена за вами';
    }
    
    const pinInput = document.getElementById('pinInput');
    if (pinInput) pinInput.value = '';
    
    const pinError = document.getElementById('pinError');
    if (pinError) pinError.classList.remove('show');
    
    const pinOverlay = document.getElementById('pinOverlay');
    if (pinOverlay) pinOverlay.style.display = 'flex';
    
    setTimeout(function() { if (pinInput) pinInput.focus(); }, 100);
  }

  function hidePinDialog() {
    const pinOverlay = document.getElementById('pinOverlay');
    if (pinOverlay) pinOverlay.style.display = 'none';
    pendingPinUser = null;
  }
  
  function processPin() {
    if (!pendingPinUser) return;
    
    const pinInput = document.getElementById('pinInput');
    const pinError = document.getElementById('pinError');
    const pin = pinInput ? pinInput.value.trim() : '';
    
    if (!pin || pin.length !== 4 || !/^\d{4}$/.test(pin)) {
      if (pinError) {
        pinError.textContent = 'ПИН должен состоять из 4 цифр';
        pinError.classList.add('show');
      }
      return;
    }
    
    if (hasPin(pendingPinUser)) {
      if (verifyPin(pendingPinUser, pin)) {
        if (!lockedUser) {
          lockedUser = pendingPinUser;
          localStorage.setItem('fc_locked_user', lockedUser);
        }
        loginAsUser(pendingPinUser);
        hidePinDialog();
      } else {
        if (pinError) {
          pinError.textContent = 'Неверный ПИН-код';
          pinError.classList.add('show');
        }
        if (pinInput) pinInput.value = '';
      }
    } else {
      setPin(pendingPinUser, pin);
      lockedUser = pendingPinUser;
      localStorage.setItem('fc_locked_user', lockedUser);
      loginAsUser(pendingPinUser);
      hidePinDialog();
      alert('✅ ПИН-код создан! Эта роль закреплена за вами.');
    }
  }
  
  function loginAsUser(userId) {
    currentUser = userId;
    localStorage.setItem('fc_user', userId);
    renderUsers();
    loadMessages();
    updatePrivateHeader();
  }
  
  // ============ СИНХРОНИЗИРОВАННЫЕ АВАТАРКИ ============
  function getAvatar(userId) {
    const local = localStorage.getItem('fc_av_' + userId);
    if (local) return local;
    
    db.ref('avatars/' + userId).once('value').then(function(snap) {
      const url = snap.val();
      if (url) {
        localStorage.setItem('fc_av_' + userId, url);
        renderUsers();
      }
    });
    
    return null;
  }
  
  function saveAvatar(userId, dataUrl) {
    localStorage.setItem('fc_av_' + userId, dataUrl);
    db.ref('avatars/' + userId).set(dataUrl);
    renderUsers();
    alert('✅ Аватар обновлён!');
  }
  
  function resetAvatar(userId) {
    localStorage.removeItem('fc_av_' + userId);
    db.ref('avatars/' + userId).remove();
    renderUsers();
    alert('✅ Аватар сброшен');
  }
  
  function renderUsers() {
    const container = document.getElementById('usersAvatars');
    if (!container) return;
    
    container.innerHTML = Object.values(FAMILY).map(function(m) {
      const av = getAvatar(m.id);
      const isActive = m.id === currentUser;
      const isLocked = lockedUser && m.id !== lockedUser;
      
      return `
        <div class="user-avatar ${isActive ? 'active' : ''} ${isLocked ? 'locked' : ''}" 
             data-user="${m.id}" title="${isActive ? 'Это вы' : 'Нажмите для личного чата'}">
          <div class="avatar-circle" style="background:${av ? '#f0f0f0' : m.color + '20'};">
            ${av ? '<img src="' + av + '" alt="' + m.name + '">' : '<span class="default-emoji">' + m.emoji + '</span>'}
          </div>
          <span class="avatar-name">${m.name}</span>
        </div>
      `;
    }).join('');
    
    container.querySelectorAll('.user-avatar').forEach(function(av) {
      av.addEventListener('click', function() {
        const userId = av.dataset.user;
        
        if (userId !== currentUser && currentUser) {
          switchToPrivateChat(userId);
          return;
        }
        
        if (userId === currentUser) return;
        
        if (!currentUser) {
          showPinDialog(userId);
        }
      });
    });
  }
  
  function switchToPrivateChat(userId) {
    activeTab = 'private';
    privateWith = userId;
    
    document.querySelectorAll('.tab').forEach(function(t) { t.classList.remove('active'); });
    const privateTab = document.querySelector('.tab[data-tab="private"]');
    if (privateTab) privateTab.classList.add('active');
    
    updatePrivateHeader();
    loadMessages();
  }
  
  function renderEmoji() {
    const grid = document.getElementById('emojiGrid');
    if (!grid) return;
    
    grid.innerHTML = EMOJI_LIST.map(function(e) {
      return '<button class="emoji-item">' + e + '</button>';
    }).join('');
    
    grid.querySelectorAll('.emoji-item').forEach(function(btn) {
      btn.addEventListener('click', function() {
        const msgInput = document.getElementById('msgInput');
        if (msgInput) {
          msgInput.value += btn.textContent;
          msgInput.focus();
        }
      });
    });
  }
  
  function showMessage(msg) {
    if (processedIds.has(msg.id)) return;
    processedIds.add(msg.id);

    if (msg.from !== currentUser && document.visibilityState !== 'visible') {
      unreadCount++;
      updateUnreadBadge();
    }

    const chat = document.getElementById('chatWindow');
    if (!chat) return;
    
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
      content = `<img src="${msg.data}" class="media-img" alt="Фото" loading="lazy" onclick="window.openImageViewer('${msg.data.replace(/'/g, "\\'")}')">`;
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
      const menuBtn = div.querySelector('.msg-menu-btn');
      if (menuBtn) {
        menuBtn.addEventListener('click', function(e) {
          e.stopPropagation();
          showMenu(e, msg);
        });
      }
    }
    
    chat.appendChild(div);
    chat.scrollTop = chat.scrollHeight;
  }
  
  function showMenu(event, msg) {
    const old = document.querySelector('.context-menu');
    if (old) old.remove();
    
    const menu = document.createElement('div');
    menu.className = 'context-menu';
    menu.innerHTML = `
      <button>📋 Копировать</button>
      <button>✏️ Редактировать</button>
      <button class="danger-btn">🗑️ Удалить</button>
    `;
    
    const x = event.clientX || (event.touches && event.touches[0].clientX) || 100;
    const y = event.clientY || (event.touches && event.touches[0].clientY) || 100;
    
    menu.style.position = 'fixed';
    menu.style.left = Math.min(x, window.innerWidth - 180) + 'px';
    menu.style.top = Math.min(y, window.innerHeight - 120) + 'px';
    menu.style.zIndex = '9999';
    
    document.body.appendChild(menu);
    
    menu.querySelectorAll('button')[0].addEventListener('click', function() {
      menu.remove();
      const text = msg.text || '';
      if (navigator.clipboard) {
        navigator.clipboard.writeText(text).then(() => {
          const toast = document.createElement('div');
          toast.textContent = '✅ Скопировано!';
          toast.style.cssText = 'position:fixed;bottom:20px;left:50%;transform:translateX(-50%);background:#333;color:white;padding:10px 20px;border-radius:20px;z-index:9999;font-size:0.9rem;';
          document.body.appendChild(toast);
          setTimeout(() => toast.remove(), 1500);
        });
      }
    });
    
    menu.querySelectorAll('button')[1].addEventListener('click', function() {
      menu.remove();
      const newText = prompt('Редактировать сообщение:', msg.text || '');
      if (newText && newText !== msg.text) {
        db.ref(getChatPath() + '/' + msg.id).update({
          text: newText,
          edited: true
        });
      }
    });
    
    menu.querySelectorAll('button')[2].addEventListener('click', function() {
      menu.remove();
      if (confirm('Удалить сообщение?')) {
        db.ref(getChatPath() + '/' + msg.id).remove();
        const el = document.querySelector('[data-id="' + msg.id + '"]');
        if (el) el.remove();
        processedIds.delete(msg.id);
      }
    });
    
    setTimeout(() => {
      const closeMenu = function(e) {
        if (!menu.contains(e.target)) {
          menu.remove();
          document.removeEventListener('click', closeMenu);
          document.removeEventListener('touchend', closeMenu);
        }
      };
      document.addEventListener('click', closeMenu);
      document.addEventListener('touchend', closeMenu);
    }, 10);
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
    
    if (messageListener) {
      db.ref(getChatPath()).off('child_added', messageListener);
    }
    
    const ref = db.ref(getChatPath());
    const chatWindow = document.getElementById('chatWindow');
    if (chatWindow) {
      chatWindow.innerHTML = '<div class="empty-chat"><div class="empty-icon">💬</div><p>Загрузка...</p></div>';
    }
    processedIds.clear();
    
    ref.once('value', function(snap) {
      const msgs = snap.val();
      if (chatWindow) chatWindow.innerHTML = '';
      if (!msgs) {
        if (chatWindow) {
          chatWindow.innerHTML = '<div class="empty-chat"><div class="empty-icon">💬</div><p>Нет сообщений</p></div>';
        }
        return;
      }
      const sorted = Object.entries(msgs)
        .map(function(e) { return Object.assign({id: e[0]}, e[1]); })
        .sort(function(a, b) { return (a.timestamp || 0) - (b.timestamp || 0); });
      sorted.forEach(function(msg) { showMessage(msg); });
    });
    
    messageListener = ref.on('child_added', function(snap) {
      const msg = Object.assign({id: snap.key}, snap.val());
      if (!processedIds.has(msg.id)) {
        showMessage(msg);
        if (msg.from !== currentUser) {
          const sender = FAMILY[msg.from] || {name: 'Кто-то'};
          notify(sender.emoji + ' ' + sender.name, msg.text || 'Новое сообщение');
        }
      }
    });
    
    ref.on('child_changed', function(snap) {
      const msg = Object.assign({id: snap.key}, snap.val());
      const old = document.querySelector('[data-id="' + msg.id + '"]');
      if (old) old.remove();
      processedIds.delete(msg.id);
      showMessage(msg);
    });
    
    ref.on('child_removed', function(snap) {
      const el = document.querySelector('[data-id="' + snap.key + '"]');
      if (el) el.remove();
      processedIds.delete(snap.key);
    });
  }
  
  function updatePrivateHeader() {
    const header = document.getElementById('privateChatHeader');
    if (!header) return;
    
    if (activeTab === 'private' && privateWith && currentUser) {
      const partner = FAMILY[privateWith];
      if (partner) {
        header.style.display = 'flex';
        const partnerEmoji = header.querySelector('.partner-emoji');
        const partnerName = header.querySelector('.partner-name');
        if (partnerEmoji) partnerEmoji.textContent = partner.emoji;
        if (partnerName) partnerName.textContent = partner.name;
      }
    } else {
      header.style.display = 'none';
    }
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
  
  // ============ ОТПРАВКА ============
  function sendText(text) {
    if (!currentUser) { alert('Сначала войдите под своей ролью'); return; }
    if (!text.trim()) return;
    
    const msg = {
      from: currentUser,
      text: text.trim(),
      timestamp: firebase.database.ServerValue.TIMESTAMP,
      type: 'text'
    };
    if (autoDeleteHours > 0) msg.deleteAt = Date.now() + autoDeleteHours * 3600000;
    db.ref(getChatPath()).push(msg);
    const msgInput = document.getElementById('msgInput');
    if (msgInput) msgInput.value = '';
  }
  
  function sendMedia(type, dataUrl) {
    if (!currentUser) { alert('Сначала войдите под своей ролью'); return; }
    
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
  
  // ============ ОБРАБОТЧИКИ ============
  function setupListeners() {
    if (listenersInitialized) return;
    listenersInitialized = true;
    
    // Сброс счётчика непрочитанных при возвращении в чат
    document.addEventListener('visibilitychange', function() {
      if (document.visibilityState === 'visible') {
        unreadCount = 0;
        updateUnreadBadge();
      }
    });
    
    document.getElementById('sendBtn').addEventListener('click', function() {
      sendText(document.getElementById('msgInput').value);
    });
    
    document.getElementById('msgInput').addEventListener('keydown', function(e) {
      if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendText(this.value); }
    });
    
    document.getElementById('emojiBtn').addEventListener('click', function() {
      document.getElementById('emojiPicker').classList.toggle('show');
    });
    
    document.addEventListener('click', function(e) {
      const pk = document.getElementById('emojiPicker');
      const eb = document.getElementById('emojiBtn');
      if (pk && eb && !pk.contains(e.target) && e.target !== eb) pk.classList.remove('show');
    });
    
    document.getElementById('attachBtn').addEventListener('click', function() {
      if (!currentUser) { alert('Сначала войдите под своей ролью'); return; }
      document.getElementById('fileInput').click();
    });
    
    document.getElementById('fileInput').addEventListener('change', function(e) {
      const file = e.target.files[0];
      if (file && file.type.startsWith('image/')) {
        const reader = new FileReader();
        reader.onload = function(ev) { sendMedia('image', ev.target.result); };
        reader.readAsDataURL(file);
      }
      e.target.value = '';
    });
    
    document.getElementById('avatarBtn').addEventListener('click', function() {
      if (!currentUser) { alert('Сначала войдите под своей ролью'); return; }
      document.getElementById('avatarInput').click();
    });
    
    document.getElementById('avatarResetBtn').addEventListener('click', function() {
      if (!currentUser) { alert('Сначала войдите под своей ролью'); return; }
      if (confirm('Сбросить аватар на стандартный?')) resetAvatar(currentUser);
    });
    
    document.getElementById('avatarInput').addEventListener('change', function(e) {
      const file = e.target.files[0];
      if (file && file.type.startsWith('image/')) {
        const reader = new FileReader();
        reader.onload = function(ev) { saveAvatar(currentUser, ev.target.result); };
        reader.readAsDataURL(file);
      }
      e.target.value = '';
    });
    
    document.getElementById('micBtn').addEventListener('click', function() {
      if (!currentUser) { alert('Сначала войдите под своей ролью'); return; }
      const btn = document.getElementById('micBtn');
      if (mediaRecorder && mediaRecorder.state === 'recording') {
        mediaRecorder.stop(); btn.classList.remove('recording'); btn.textContent = '🎤'; return;
      }
      navigator.mediaDevices.getUserMedia({audio: true}).then(function(stream) {
        mediaRecorder = new MediaRecorder(stream);
        audioChunks = [];
        mediaRecorder.ondataavailable = function(e) { audioChunks.push(e.data); };
        mediaRecorder.onstop = function() {
          const blob = new Blob(audioChunks, {type: 'audio/webm'});
          const reader = new FileReader();
          reader.onload = function(ev) { sendMedia('voice', ev.target.result); };
          reader.readAsDataURL(blob);
          stream.getTracks().forEach(function(t) { t.stop(); });
        };
        mediaRecorder.start();
        btn.classList.add('recording'); btn.textContent = '⏹️';
        setTimeout(function() {
          if (mediaRecorder && mediaRecorder.state === 'recording') {
            mediaRecorder.stop(); btn.classList.remove('recording'); btn.textContent = '🎤';
          }
        }, 30000);
      }).catch(function() { alert('Нет доступа к микрофону'); });
    });
    
    document.querySelectorAll('.tab').forEach(function(tab) {
      tab.addEventListener('click', function() {
        document.querySelectorAll('.tab').forEach(function(t) { t.classList.remove('active'); });
        tab.classList.add('active');
        activeTab = tab.dataset.tab;
        if (activeTab !== 'private') privateWith = null;
        updatePrivate();
        loadMessages();
        updatePrivateHeader();
      });
    });
    
    document.getElementById('settingsBtn').addEventListener('click', function() {
      document.getElementById('settingsPanel').classList.toggle('show');
    });
    
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
    
    function applyFontSize() {
      document.documentElement.style.setProperty('--font-scale', fontSize / 100);
      document.getElementById('fontValue').textContent = fontSize + '%';
      localStorage.setItem('fc_font', fontSize);
    }
    
    document.getElementById('fontUp').addEventListener('click', function() {
      if (fontSize < 150) { fontSize += 10; applyFontSize(); }
    });
    
    document.getElementById('fontDown').addEventListener('click', function() {
      if (fontSize > 80) { fontSize -= 10; applyFontSize(); }
    });
    
    document.getElementById('changePinBtn').addEventListener('click', function() {
      if (!currentUser) { alert('Сначала войдите под своей ролью'); return; }
      const oldPin = prompt('Введите текущий ПИН:');
      if (!oldPin || !verifyPin(currentUser, oldPin)) { alert('Неверный ПИН'); return; }
      const newPin = prompt('Введите новый 4-значный ПИН:');
      if (!newPin || newPin.length !== 4 || !/^\d{4}$/.test(newPin)) { alert('ПИН должен состоять из 4 цифр'); return; }
      setPin(currentUser, newPin);
      alert('✅ ПИН-код изменён!');
    });
    
    document.getElementById('changeCodeBtn').addEventListener('click', function() {
      if (!currentUser) { alert('Сначала войдите под своей ролью'); return; }
      
      if (currentUser !== 'dad' && currentUser !== 'mom') {
        alert('Только Папа или Мама могут изменить код семьи');
        return;
      }
      
      const pin = prompt('Введите ваш ПИН-код для подтверждения:');
      if (!pin || !verifyPin(currentUser, pin)) {
        alert('Неверный ПИН-код');
        return;
      }
      
      const old = prompt('Текущий код семьи:');
      if (old !== secretCode) { alert('Неверный текущий код'); return; }
      
      const newCode = prompt('Новый код семьи (минимум 4 символа):');
      if (newCode && newCode.length >= 4) {
        secretCode = newCode;
        localStorage.setItem('fc_code', secretCode);
        alert('✅ Код семьи изменён!');
      }
    });
    
    document.getElementById('cacheBtn').addEventListener('click', function() {
      if (confirm('Перезагрузить страницу?')) location.reload();
    });
    
    document.getElementById('clearBtn').addEventListener('click', function() {
      if (!currentUser) return;
      if (confirm('Удалить все сообщения в этом чате?')) {
        db.ref(getChatPath()).remove();
        processedIds.clear();
        const chatWindow = document.getElementById('chatWindow');
        if (chatWindow) {
          chatWindow.innerHTML = `
            <div class="empty-chat">
              <div class="empty-icon">💬</div>
              <p>Нет сообщений</p>
            </div>
          `;
        }
      }
    });
  }
  
  function applyStoredSettings() {
    isDarkTheme = localStorage.getItem('fc_theme') === 'dark';
    if (isDarkTheme) {
      document.body.classList.add('dark-theme');
      const themeBtn = document.getElementById('themeBtn');
      if (themeBtn) themeBtn.textContent = '☀️';
    }
    
    document.documentElement.style.setProperty('--font-scale', fontSize / 100);
    const fv = document.getElementById('fontValue');
    if (fv) fv.textContent = fontSize + '%';
    
    const notifToggle = document.getElementById('notifToggle');
    if (notifToggle) notifToggle.checked = notifEnabled;
    
    const soundToggle = document.getElementById('soundToggle');
    if (soundToggle) soundToggle.checked = soundEnabled;
    
    const autoDelete = document.getElementById('autoDelete');
    if (autoDelete) autoDelete.value = autoDeleteHours;
    
    const notifBtn = document.getElementById('notifBtn');
    if (notifBtn) notifBtn.textContent = notifEnabled ? '🔔' : '🔕';
    
    const soundBtn = document.getElementById('soundBtn');
    if (soundBtn) soundBtn.textContent = soundEnabled ? '🔊' : '🔇';
  }
  
  // ============ ПРОСМОТРЩИК ФОТО ============
  window.openImageViewer = function(src) {
    const old = document.querySelector('.image-viewer');
    if (old) old.remove();
    
    const viewer = document.createElement('div');
    viewer.className = 'image-viewer';
    Object.assign(viewer.style, {
      position: 'fixed', top: '0', left: '0', width: '100%', height: '100%',
      background: 'rgba(0,0,0,0.95)', display: 'flex', alignItems: 'center',
      justifyContent: 'center', zIndex: '10000', cursor: 'zoom-out'
    });
    
    const img = document.createElement('img');
    img.src = src;
    Object.assign(img.style, {
      maxWidth: '90%', maxHeight: '90%', objectFit: 'contain',
      transition: 'transform 0.2s', cursor: 'grab'
    });
    
    let scale = 1, translateX = 0, translateY = 0;
    
    img.addEventListener('wheel', function(e) {
      e.preventDefault();
      scale += e.deltaY * -0.01;
      scale = Math.min(Math.max(0.5, scale), 5);
      img.style.transform = `scale(${scale}) translate(${translateX}px, ${translateY}px)`;
    });
    
    viewer.appendChild(img);
    
    const closeBtn = document.createElement('button');
    closeBtn.textContent = '✕';
    Object.assign(closeBtn.style, {
      position: 'absolute', top: '20px', right: '20px',
      padding: '10px 16px', background: 'rgba(255,255,255,0.2)',
      color: 'white', border: 'none', borderRadius: '8px',
      cursor: 'pointer', fontSize: '1.2rem', zIndex: '10001'
    });
    closeBtn.onclick = () => viewer.remove();
    viewer.appendChild(closeBtn);
    
    viewer.addEventListener('click', function(e) {
      if (e.target === viewer) viewer.remove();
    });
    
    document.body.appendChild(viewer);
    
    const escHandler = function(e) {
      if (e.key === 'Escape') {
        viewer.remove();
        window.removeEventListener('keydown', escHandler);
      }
    };
    window.addEventListener('keydown', escHandler);
  };

  // ============ АВТОУДАЛЕНИЕ ============
  function startAutoDelete() {
    setInterval(function() {
      if (autoDeleteHours === 0 || !currentUser) return;
      db.ref(getChatPath()).once('value').then(function(snap) {
        const msgs = snap.val();
        if (!msgs) return;
        const now = Date.now();
        const updates = {};
        for (const [id, msg] of Object.entries(msgs)) {
          if (msg.deleteAt && msg.deleteAt <= now) {
            updates[id] = null;
            processedIds.delete(id);
          }
        }
        if (Object.keys(updates).length > 0) db.ref(getChatPath()).update(updates);
      });
    }, 30000);
  }

  // ============ СЕКРЕТНЫЙ КОД ============
  document.getElementById('secretBtn').addEventListener('click', function() {
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

  document.getElementById('secretInput').addEventListener('keydown', function(e) {
    if (e.key === 'Enter') document.getElementById('secretBtn').click();
  });

  document.getElementById('secretInput').focus();

  // ============ ПИН-ОБРАБОТЧИКИ ============
  document.getElementById('pinBtn').addEventListener('click', processPin);
  document.getElementById('pinInput').addEventListener('keydown', function(e) {
    if (e.key === 'Enter') processPin();
  });
  document.getElementById('pinOverlay').addEventListener('click', function(e) {
    if (e.target === this) hidePinDialog();
  });

  function updatePrivate() {
    const sel = document.getElementById('privateRecipient');
    if (!sel || !currentUser) return;
    const others = Object.values(FAMILY).filter(function(m) { return m.id !== currentUser; });
    sel.innerHTML = '<option value="">Выберите...</option>' +
      others.map(function(m) { 
        return '<option value="' + m.id + '" ' + (m.id === privateWith ? 'selected' : '') + '>' + m.emoji + ' ' + m.name + '</option>'; 
      }).join('');
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
    
    if (lockedUser && hasPin(lockedUser)) {
      showPinDialog(lockedUser);
    } else {
      const chatWindow = document.getElementById('chatWindow');
      if (chatWindow) {
        chatWindow.innerHTML = `
          <div class="empty-chat">
            <div class="empty-icon">🔒</div>
            <p>Выберите свою роль и создайте ПИН-код</p>
          </div>
        `;
      }
    }
    console.log('✅ FChat запущен');
  }

  console.log('📱 FChat готов к работе');
})();
