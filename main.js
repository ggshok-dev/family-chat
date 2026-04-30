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
  let lastMessagePreview = '';
  
  if (!localStorage.getItem('fc_theme')) {
    localStorage.setItem('fc_theme', 'light');
  }
  
  const pinsRef = db.ref('pins');
  
  // ============ ПИН-КОДЫ (синхронизированные через Firebase) ============
  function getPin(userId) {
    const localPin = localStorage.getItem('fc_pin_' + userId);
    if (localPin) return localPin;
    return null;
  }
  
  function setPin(userId, pin) {
    localStorage.setItem('fc_pin_' + userId, pin);
    pinsRef.child(userId).set(pin);
  }
  
  function hasPin(userId) {
    return !!getPin(userId);
  }
  
  function verifyPin(userId, pin) {
    return getPin(userId) === pin;
  }
  
  function loadPinsFromFirebase() {
    pinsRef.once('value').then(function(snap) {
      const pins = snap.val();
      if (pins) {
        Object.entries(pins).forEach(function([userId, pin]) {
          if (!localStorage.getItem('fc_pin_' + userId)) {
            localStorage.setItem('fc_pin_' + userId, pin);
          }
        });
        renderUsers();
      }
    });
  }
  
  function updateUnreadBadge(msg) {
    if (msg) {
      const sender = FAMILY[msg.from] || {name: 'Кто-то'};
      lastMessagePreview = sender.name + ': ' + (msg.text || '📷 Фото');
    }
    
    if (unreadCount > 0) {
      document.title = '(' + unreadCount + ') ' + lastMessagePreview;
    } else {
      document.title = 'FChat — Семейный мессенджер';
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
      if (pinHint) pinHint.textContent = '⚠️ После создания ПИН эта роль будет закреплена за вами на всех устройствах';
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
    
    pinsRef.child(pendingPinUser).once('value').then(function(snap) {
      const existingPin = snap.val();
      
      if (existingPin) {
        if (existingPin === pin) {
          localStorage.setItem('fc_pin_' + pendingPinUser, pin);
          if (!lockedUser) {
            lockedUser = pendingPinUser;
            localStorage.setItem('fc_locked_user', lockedUser);
          }
          loginAsUser(pendingPinUser);
          hidePinDialog();
        } else {
          if (pinError) {
            pinError.textContent = 'Неверный ПИН-код или роль уже занята другим членом семьи';
            pinError.classList.add('show');
          }
          if (pinInput) pinInput.value = '';
        }
      } else {
        pinsRef.child(pendingPinUser).set(pin).then(function() {
          localStorage.setItem('fc_pin_' + pendingPinUser, pin);
          lockedUser = pendingPinUser;
          localStorage.setItem('fc_locked_user', lockedUser);
          loginAsUser(pendingPinUser);
          hidePinDialog();
          alert('✅ ПИН-код создан! Эта роль закреплена за вами на всех устройствах.');
        });
      }
    });
  }
  
  function loginAsUser(userId) {
    currentUser = userId;
    localStorage.setItem('fc_user', userId);
    
    const savedPrivateWith = localStorage.getItem('fc_private_' + userId);
    if (savedPrivateWith && FAMILY[savedPrivateWith]) {
      privateWith = savedPrivateWith;
    }
    
    activeTab = 'general';
    document.querySelectorAll('.tab').forEach(function(t) { t.classList.remove('active'); });
    const generalTab = document.querySelector('.tab[data-tab="general"]');
    if (generalTab) generalTab.classList.add('active');
    
    renderUsers();
    updatePrivate();
    loadMessages();
    updatePrivateHeader();
  }
  
  // ============ АВАТАРКИ ============
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
    
    pinsRef.once('value').then(function(snap) {
      const pins = snap.val() || {};
      
      container.innerHTML = Object.values(FAMILY).map(function(m) {
        const av = getAvatar(m.id);
        const isActive = m.id === currentUser;
        const isLocked = pins[m.id] && m.id !== currentUser;
        
        let title = '';
        if (isActive) title = 'Это вы';
        else if (isLocked) title = 'Занято (' + m.name + ')';
        else if (!pins[m.id]) title = 'Нажмите, чтобы выбрать эту роль';
        
        return `
          <div class="user-avatar ${isActive ? 'active' : ''} ${isLocked ? 'locked' : ''}" 
               data-user="${m.id}" title="${title}">
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
    });
  }
  
  function switchToPrivateChat(userId) {
    activeTab = 'private';
    privateWith = userId;
    
    localStorage.setItem('fc_private_' + currentUser, userId);
    
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
  
  function showMessage(msg, fragment) {
    if (processedIds.has(msg.id)) return;
    processedIds.add(msg.id);

    const chat = fragment || document.getElementById('chatWindow');
    if (!chat) return;
    
    if (!fragment) {
      const empty = chat.querySelector('.empty-chat');
      if (empty) empty.remove();
    }
    
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
    
    let chatIndicator = '';
    if (!isSent) {
      if (activeTab === 'general') {
        chatIndicator = ' <span style="font-size:0.65rem;opacity:0.6;">📢 общий</span>';
      } else {
        chatIndicator = ' <span style="font-size:0.65rem;opacity:0.6;">🔒 личный</span>';
      }
    }
    
    const time = new Date(msg.timestamp).toLocaleTimeString('ru-RU', {hour:'2-digit', minute:'2-digit'});
    
    div.innerHTML = 
      (!isSent ? '<div class="msg-sender"><span class="sender-avatar">' + 
        (senderAv ? '<img src="' + senderAv + '">' : '<span>' + sender.emoji + '</span>') + 
        '</span><strong>' + sender.name + '</strong>' + chatIndicator + '</div>' : '') +
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
    
    if (fragment) {
      fragment.appendChild(div);
    } else {
      chat.appendChild(div);
      chat.scrollTop = chat.scrollHeight;
    }
    
    if (msg.from !== currentUser && document.visibilityState !== 'visible') {
      unreadCount++;
      updateUnreadBadge(msg);
    }
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
    
    // Оптимизированное удаление
    menu.querySelectorAll('button')[2].addEventListener('click', function() {
      menu.remove();
      if (confirm('Удалить сообщение?')) {
        const msgPath = getChatPath() + '/' + msg.id;
        
        db.ref(msgPath).set(null)
          .then(function() {
            const el = document.querySelector('[data-id="' + msg.id + '"]');
            if (el) {
              el.style.opacity = '0';
              el.style.transform = 'scale(0.8)';
              el.style.transition = '0.3s';
              setTimeout(function() { el.remove(); }, 300);
            }
            processedIds.delete(msg.id);
          });
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
  
  // Оптимизированная загрузка сообщений
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
    
    // Загружаем только последние 100 сообщений для производительности
    ref.orderByChild('timestamp').limitToLast(100).once('value', function(snap) {
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
      
      const fragment = document.createDocumentFragment();
      sorted.forEach(function(msg) { 
        showMessage(msg, fragment);
      });
      if (chatWindow) chatWindow.appendChild(fragment);
    });
    
    messageListener = ref.on('child_added', function(snap) {
      const msg = Object.assign({id: snap.key}, snap.val());
      if (!processedIds.has(msg.id)) {
        showMessage(msg);
        if (msg.from !== currentUser) {
          const sender = FAMILY[msg.from] || {name: 'Кто-то'};
          notify(sender.emoji + ' ' + sender.name, (msg.text || '📷 Фото'));
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
    
    if (navigator.vibrate) {
      navigator.vibrate([200, 100, 200]);
    }
    
    const header = document.querySelector('.header');
    if (header) {
      header.style.animation = 'flash 0.5s ease 3';
      setTimeout(function() { header.style.animation = ''; }, 1500);
    }
    
    if (document.visibilityState !== 'visible') {
      if ('Notification' in window && Notification.permission === 'granted') {
        new Notification(title, {
          body: body,
          icon: 'icon-192.png',
          tag: 'fchat',
          vibrate: [200, 100, 200, 100, 200]
        });
      }
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
    
    // Вкладки — простая и надёжная версия
document.querySelectorAll('.tab').forEach(function(tab) {
  tab.addEventListener('click', function() {
    // Убираем активный класс со всех вкладок
    document.querySelectorAll('.tab').forEach(function(t) { 
      t.classList.remove('active'); 
    });
    
    // Делаем активной нажатую вкладку
    tab.classList.add('active');
    
    // Меняем тип чата
    activeTab = tab.dataset.tab;
    
    // Если перешли на общий чат
    if (activeTab === 'general') {
      privateWith = null;
      const privateSel = document.getElementById('privateSel');
    if (privateSel) privateSel.style.display = 'none';
      updatePrivateHeader();
      loadMessages();
    }
    
    // Если перешли на личный чат
    if (activeTab === 'private') {
      // Если собеседник не выбран — выбираем последнего
      if (!privateWith) {
        const saved = localStorage.getItem('fc_private_' + currentUser);
        if (saved && FAMILY[saved]) {
          privateWith = saved;
        } else {
          // Первый доступный собеседник
          const others = Object.values(FAMILY).filter(function(m) { 
            return m.id !== currentUser; 
          });
          if (others.length > 0) privateWith = others[0].id;
        }
      }
      
          const privateSel = document.getElementById('privateSel');
          if (privateSel) privateSel.style.display = 'block';
  
          updatePrivate();
          updatePrivateHeader();
          loadMessages();
          }
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
    
    document.getElementById('notifBtn').addEventListener('click', function() {
      notifEnabled = !notifEnabled;
      localStorage.setItem('fc_notif', notifEnabled);
      this.textContent = notifEnabled ? '🔔' : '🔕';
      const notifToggle = document.getElementById('notifToggle');
      if (notifToggle) notifToggle.checked = notifEnabled;
      if (notifEnabled) requestNotif();
    });
    
    document.getElementById('soundBtn').addEventListener('click', function() {
      soundEnabled = !soundEnabled;
      localStorage.setItem('fc_sound', soundEnabled);
      this.textContent = soundEnabled ? '🔊' : '🔇';
      const soundToggle = document.getElementById('soundToggle');
      if (soundToggle) soundToggle.checked = soundEnabled;
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
      if (!pin || !verifyPin(currentUser, pin)) { alert('Неверный ПИН-код'); return; }
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
    
    // Оптимизированная очистка чата
    document.getElementById('clearBtn').addEventListener('click', function() {
      if (!currentUser) return;
      if (confirm('Удалить все сообщения в этом чате?')) {
        const chatPath = getChatPath();
        
        db.ref(chatPath).set(null)
          .then(function() {
            processedIds.clear();
            const chatWindow = document.getElementById('chatWindow');
            if (chatWindow) chatWindow.innerHTML = '';
            loadMessages();
          })
          .catch(function(error) {
            console.error('Ошибка очистки:', error);
          });
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
    const notifBtn = document.getElementById('notifBtn');
    if (notifBtn) notifBtn.textContent = notifEnabled ? '🔔' : '🔕';
    
    const soundToggle = document.getElementById('soundToggle');
    if (soundToggle) soundToggle.checked = soundEnabled;
    const soundBtn = document.getElementById('soundBtn');
    if (soundBtn) soundBtn.textContent = soundEnabled ? '🔊' : '🔇';
    
    const autoDelete = document.getElementById('autoDelete');
    if (autoDelete) autoDelete.value = autoDeleteHours;
  }
  
  // ============ ПРОСМОТРЩИК ФОТО ============
  window.openImageViewer = function(src) {
    const allImages = [];
    document.querySelectorAll('.media-img').forEach(function(img) {
      if (img.src) allImages.push(img.src);
    });
    
    const currentIndex = allImages.indexOf(src);
    
    const old = document.querySelector('.image-viewer');
    if (old) old.remove();
    
    const viewer = document.createElement('div');
    viewer.className = 'image-viewer';
    viewer.style.cssText = 'position:fixed;top:0;left:0;width:100%;height:100%;background:rgba(0,0,0,0.95);display:flex;align-items:center;justify-content:center;z-index:10000;overflow:hidden;';
    
    const imgContainer = document.createElement('div');
    imgContainer.style.cssText = 'position:relative;width:100%;height:100%;display:flex;align-items:center;justify-content:center;';
    
    const img = document.createElement('img');
    img.src = src;
    img.style.cssText = 'max-width:90%;max-height:90%;object-fit:contain;transition:transform 0.1s;cursor:grab;user-select:none;-webkit-user-select:none;';
    
    let scale = 1;
    let translateX = 0;
    let translateY = 0;
    let isDragging = false;
    let startX = 0;
    let startY = 0;
    let startTranslateX = 0;
    let startTranslateY = 0;
    
    function updateTransform() {
      img.style.transform = 'translate(' + translateX + 'px, ' + translateY + 'px) scale(' + scale + ')';
      img.style.cursor = scale > 1 ? (isDragging ? 'grabbing' : 'grab') : 'zoom-in';
    }
    
    img.addEventListener('mousedown', function(e) {
      if (scale > 1) {
        isDragging = true;
        startX = e.clientX;
        startY = e.clientY;
        startTranslateX = translateX;
        startTranslateY = translateY;
        img.style.cursor = 'grabbing';
        e.preventDefault();
      }
    });
    
    window.addEventListener('mousemove', function(e) {
      if (isDragging) {
        translateX = startTranslateX + (e.clientX - startX);
        translateY = startTranslateY + (e.clientY - startY);
        updateTransform();
      }
    });
    
    window.addEventListener('mouseup', function() {
      isDragging = false;
      img.style.cursor = scale > 1 ? 'grab' : 'zoom-in';
    });
    
    img.addEventListener('touchstart', function(e) {
      if (e.touches.length === 1 && scale > 1) {
        isDragging = true;
        startX = e.touches[0].clientX;
        startY = e.touches[0].clientY;
        startTranslateX = translateX;
        startTranslateY = translateY;
      }
    });
    
    img.addEventListener('touchmove', function(e) {
      if (isDragging && e.touches.length === 1 && scale > 1) {
        e.preventDefault();
        translateX = startTranslateX + (e.touches[0].clientX - startX);
        translateY = startTranslateY + (e.touches[0].clientY - startY);
        updateTransform();
      }
    });
    
    img.addEventListener('touchend', function() {
      isDragging = false;
    });
    
    let lastDistance = 0;
    let pinchStartScale = 1;
    
    img.addEventListener('touchstart', function(e) {
      if (e.touches.length === 2) {
        isDragging = false;
        lastDistance = Math.hypot(
          e.touches[0].clientX - e.touches[1].clientX,
          e.touches[0].clientY - e.touches[1].clientY
        );
        pinchStartScale = scale;
      }
    });
    
    img.addEventListener('touchmove', function(e) {
      if (e.touches.length === 2) {
        e.preventDefault();
        const newDistance = Math.hypot(
          e.touches[0].clientX - e.touches[1].clientX,
          e.touches[0].clientY - e.touches[1].clientY
        );
        scale = pinchStartScale * (newDistance / lastDistance);
        scale = Math.min(Math.max(0.5, scale), 5);
        updateTransform();
      }
    });
    
    viewer.addEventListener('wheel', function(e) {
      e.preventDefault();
      const delta = e.deltaY > 0 ? 0.9 : 1.1;
      scale *= delta;
      scale = Math.min(Math.max(0.5, scale), 5);
      updateTransform();
    });
    
    img.addEventListener('dblclick', function(e) {
      e.preventDefault();
      if (scale > 1) {
        scale = 1;
        translateX = 0;
        translateY = 0;
      } else {
        scale = 2.5;
      }
      updateTransform();
    });
    
    let lastTap = 0;
    img.addEventListener('click', function(e) {
      const now = Date.now();
      if (now - lastTap < 300) {
        e.preventDefault();
        if (scale > 1) {
          scale = 1;
          translateX = 0;
          translateY = 0;
        } else {
          scale = 2.5;
        }
        updateTransform();
      }
      lastTap = now;
    });
    
    imgContainer.appendChild(img);
    viewer.appendChild(imgContainer);
    
    if (allImages.length > 1) {
      const counter = document.createElement('div');
      counter.textContent = (currentIndex + 1) + ' / ' + allImages.length;
      counter.style.cssText = 'position:absolute;top:20px;left:50%;transform:translateX(-50%);color:white;font-size:1rem;background:rgba(0,0,0,0.5);padding:5px 15px;border-radius:20px;z-index:10001;';
      viewer.appendChild(counter);
      
      if (currentIndex > 0) {
        const prevBtn = document.createElement('button');
        prevBtn.innerHTML = '‹';
        prevBtn.style.cssText = 'position:absolute;left:10px;top:50%;transform:translateY(-50%);background:rgba(255,255,255,0.2);color:white;border:none;border-radius:50%;width:50px;height:50px;font-size:2rem;cursor:pointer;z-index:10001;display:flex;align-items:center;justify-content:center;';
        prevBtn.onclick = function(e) { e.stopPropagation(); viewer.remove(); window.openImageViewer(allImages[currentIndex - 1]); };
        viewer.appendChild(prevBtn);
      }
      
      if (currentIndex < allImages.length - 1) {
        const nextBtn = document.createElement('button');
        nextBtn.innerHTML = '›';
        nextBtn.style.cssText = 'position:absolute;right:10px;top:50%;transform:translateY(-50%);background:rgba(255,255,255,0.2);color:white;border:none;border-radius:50%;width:50px;height:50px;font-size:2rem;cursor:pointer;z-index:10001;display:flex;align-items:center;justify-content:center;';
        nextBtn.onclick = function(e) { e.stopPropagation(); viewer.remove(); window.openImageViewer(allImages[currentIndex + 1]); };
        viewer.appendChild(nextBtn);
      }
    }
    
    const controls = document.createElement('div');
    controls.style.cssText = 'position:absolute;bottom:30px;left:50%;transform:translateX(-50%);display:flex;gap:10px;z-index:10001;';
    
    const buttons = [
      { text: '💾', action: function() { const a = document.createElement('a'); a.href = src; a.download = 'photo_' + Date.now() + '.jpg'; a.click(); } },
      { text: '🔍+', action: function() { scale = Math.min(5, scale + 0.5); updateTransform(); } },
      { text: '🔍-', action: function() { scale = Math.max(0.5, scale - 0.5); updateTransform(); } },
      { text: '↺', action: function() { scale = 1; translateX = 0; translateY = 0; updateTransform(); } }
    ];
    
    buttons.forEach(function(btn) {
      const button = document.createElement('button');
      button.textContent = btn.text;
      button.style.cssText = 'padding:12px;background:rgba(255,255,255,0.2);color:white;border:none;border-radius:50%;cursor:pointer;font-size:1.2rem;width:45px;height:45px;display:flex;align-items:center;justify-content:center;';
      button.onclick = function(e) { e.stopPropagation(); btn.action(); };
      controls.appendChild(button);
    });
    
    viewer.appendChild(controls);
    
    const closeBtn = document.createElement('button');
    closeBtn.textContent = '✕';
    closeBtn.style.cssText = 'position:absolute;top:20px;right:20px;padding:10px 16px;background:rgba(255,255,255,0.2);color:white;border:none;border-radius:8px;cursor:pointer;font-size:1.2rem;z-index:10001;';
    closeBtn.onclick = function(e) { e.stopPropagation(); viewer.remove(); };
    viewer.appendChild(closeBtn);
    
    viewer.addEventListener('click', function(e) {
      if (e.target === viewer) viewer.remove();
    });
    
    document.body.appendChild(viewer);
    
    function escHandler(e) {
      if (e.key === 'Escape') {
        viewer.remove();
        window.removeEventListener('keydown', escHandler);
      }
    }
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
    
    loadPinsFromFirebase();
    
    const savedUser = localStorage.getItem('fc_user');
    if (savedUser && FAMILY[savedUser]) {
      const savedPrivate = localStorage.getItem('fc_private_' + savedUser);
      if (savedPrivate && FAMILY[savedPrivate]) {
        privateWith = savedPrivate;
        updatePrivate();
      }
    }
    
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
    console.log('✅ FChat запущен (оптимизированная версия)');
  }

  // Очистка кэша каждые 5 минут
  setInterval(function() {
    if (processedIds.size > 100) {
      processedIds.clear();
      console.log('🧹 Кэш сообщений очищен');
    }
  }, 300000);

  console.log('📱 FChat готов к работе');
})();
