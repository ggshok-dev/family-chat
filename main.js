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
  
  if (!firebase.apps.length) firebase.initializeApp(firebaseConfig);
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
  let typingTimer = null;
  let replyToMessage = null;
  
  if (!localStorage.getItem('fc_theme')) {
    localStorage.setItem('fc_theme', 'light');
  }
  
  const pinsRef = db.ref('pins');
  
  // ============ ПИН-КОДЫ ============
  function getPin(userId) { return localStorage.getItem('fc_pin_' + userId) || null; }
  function setPin(userId, pin) { localStorage.setItem('fc_pin_' + userId, pin); pinsRef.child(userId).set(pin); }
  function hasPin(userId) { return !!getPin(userId); }
  function verifyPin(userId, pin) { return getPin(userId) === pin; }
  
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
    document.title = unreadCount > 0 ? '(' + unreadCount + ') ' + lastMessagePreview : 'FChat';
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
      if (pinHint) pinHint.textContent = 'После создания ПИН эта роль будет закреплена за вами';
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
      if (pinError) { pinError.textContent = 'ПИН должен состоять из 4 цифр'; pinError.classList.add('show'); }
      return;
    }
    
    pinsRef.child(pendingPinUser).once('value').then(function(snap) {
      const existingPin = snap.val();
      if (existingPin) {
        if (existingPin === pin) {
          localStorage.setItem('fc_pin_' + pendingPinUser, pin);
          if (!lockedUser) { lockedUser = pendingPinUser; localStorage.setItem('fc_locked_user', lockedUser); }
          loginAsUser(pendingPinUser);
          hidePinDialog();
        } else {
          if (pinError) { pinError.textContent = 'Неверный ПИН-код или роль уже занята'; pinError.classList.add('show'); }
          if (pinInput) pinInput.value = '';
        }
      } else {
        pinsRef.child(pendingPinUser).set(pin).then(function() {
          localStorage.setItem('fc_pin_' + pendingPinUser, pin);
          lockedUser = pendingPinUser;
          localStorage.setItem('fc_locked_user', lockedUser);
          loginAsUser(pendingPinUser);
          hidePinDialog();
          alert('✅ ПИН-код создан!');
        });
      }
    });
  }
  
  function loginAsUser(userId) {
    currentUser = userId;
    localStorage.setItem('fc_user', userId);
    const savedPrivate = localStorage.getItem('fc_private_' + userId);
    if (savedPrivate && FAMILY[savedPrivate]) privateWith = savedPrivate;
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
      if (url) { localStorage.setItem('fc_av_' + userId, url); renderUsers(); }
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
        
        return `
          <div class="user-avatar ${isActive ? 'active' : ''} ${isLocked ? 'locked' : ''}" data-user="${m.id}">
            <div class="avatar-circle" style="background:${av ? '#f0f0f0' : m.color + '20'};">
              ${av ? '<img src="' + av + '" alt="' + m.name + '">' : '<span class="default-emoji">' + m.emoji + '</span>'}
              ${isActive ? '<div class="online-dot"></div>' : ''}
            </div>
            <span class="avatar-name">${m.name}</span>
          </div>
        `;
      }).join('');
      
      container.querySelectorAll('.user-avatar').forEach(function(av) {
        av.addEventListener('click', function() {
          const userId = av.dataset.user;
          if (userId !== currentUser && currentUser) { switchToPrivateChat(userId); return; }
          if (userId === currentUser) return;
          if (!currentUser) showPinDialog(userId);
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
    grid.innerHTML = EMOJI_LIST.map(function(e) { return '<button class="emoji-item">' + e + '</button>'; }).join('');
    grid.querySelectorAll('.emoji-item').forEach(function(btn) {
      btn.addEventListener('click', function() {
        const msgInput = document.getElementById('msgInput');
        if (msgInput) { msgInput.value += btn.textContent; msgInput.focus(); }
      });
    });
  }
  
  function getDateLabel(timestamp) {
    const now = new Date();
    const msgDate = new Date(timestamp);
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const yesterday = new Date(today - 86400000);
    const msgDay = new Date(msgDate.getFullYear(), msgDate.getMonth(), msgDate.getDate());
    if (msgDay.getTime() === today.getTime()) return 'Сегодня';
    if (msgDay.getTime() === yesterday.getTime()) return 'Вчера';
    return msgDate.toLocaleDateString('ru-RU', { day: 'numeric', month: 'long', year: 'numeric' });
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
    
    // Разделитель дат
    const dateLabel = getDateLabel(msg.timestamp);
    const separators = chat.querySelectorAll('.date-separator');
    let lastLabel = '';
    if (separators.length > 0) {
      lastLabel = separators[separators.length - 1].textContent;
    }
    if (lastLabel !== dateLabel) {
      const separator = document.createElement('div');
      separator.className = 'date-separator';
      separator.textContent = dateLabel;
      chat.appendChild(separator);
    }
    
    const div = document.createElement('div');
    div.className = 'message ' + (isSent ? 'sent' : 'received');
    div.dataset.id = msg.id;

    // Отображение цитируемого сообщения
    let replyHTML = '';
    if (msg.replyTo) {
    const replySender = FAMILY[msg.replyTo.from]?.name || 'Кто-то';
    const replyText = (msg.replyTo.text || '').substring(0, 100);
    replyHTML = `
        <div class="reply-preview" style="border-left:3px solid #667eea;padding:5px 10px;margin-bottom:5px;background:rgba(102,126,234,0.1);border-radius:4px;font-size:0.85rem;cursor:pointer;" onclick="scrollToMessage('${msg.replyTo.id}')">
            <div style="font-weight:600;color:#667eea;">${replySender}</div>
            <div style="opacity:0.7;">${replyText}</div>
        </div>
    `;
}
    
    let content = '';
    if (msg.type === 'image') {
      content = `<img src="${msg.data}" class="media-img" alt="Фото" loading="lazy" onclick="window.openImageViewer('${msg.data.replace(/'/g, "\\'")}')">`;
    } else if (msg.type === 'voice') {
      content = `<audio controls class="media-audio" src="${msg.data}"></audio>`;
    } else if (msg.type === 'file') {
      content = `<div style="display:flex;align-items:center;gap:8px;padding:8px;background:rgba(255,255,255,0.1);border-radius:8px;">
        <span style="font-size:1.5rem;">📎</span>
        <a href="${msg.data}" download="${msg.fileName}" style="color:#667eea;text-decoration:none;" target="_blank">${msg.fileName || 'Файл'}</a>
      </div>`;
    } else {
      content = msg.text || '';
    }
    
    const time = new Date(msg.timestamp).toLocaleTimeString('ru-RU', {hour:'2-digit', minute:'2-digit'});
    
    div.innerHTML = 
      replyHTML +
      (!isSent ? '<div class="msg-sender"><span class="sender-avatar">' + 
        (senderAv ? '<img src="' + senderAv + '">' : '<span>' + sender.emoji + '</span>') + 
        '</span><strong>' + sender.name + '</strong></div>' : '') +
      '<div class="bubble">' + content + 
        '<div class="msg-time"><span>' + time + '</span>' + 
        '<span class="msg-menu-btn" style="cursor:pointer;opacity:0.5;padding:2px 6px;">⋮</span>' + 
      '</div></div>';
    
    // Реакции
    if (msg.reactions) {
      const reactionsDiv = document.createElement('div');
      reactionsDiv.style.cssText = 'font-size:0.8rem;margin-top:4px;';
      reactionsDiv.textContent = Object.values(msg.reactions).join(' ');
      div.querySelector('.bubble').appendChild(reactionsDiv);
    }
    
    const menuBtn = div.querySelector('.msg-menu-btn');
    if (menuBtn) {
      menuBtn.addEventListener('click', function(e) {
        e.stopPropagation();
        showMenu(e, msg);
      });
    }
    
    if (fragment) fragment.appendChild(div);
    else { chat.appendChild(div); chat.scrollTop = chat.scrollHeight; }
    
    if (msg.from !== currentUser && document.visibilityState !== 'visible') {
      unreadCount++;
      updateUnreadBadge(msg);
    }
  }
  
  function addReaction(msg, emoji) {
    const reactions = msg.reactions || {};
    reactions[currentUser] = emoji;
    db.ref(getChatPath() + '/' + msg.id + '/reactions').set(reactions);
  }
  
  function showMenu(event, msg) {
    const old = document.querySelector('.context-menu');
    if (old) old.remove();
    
    const menu = document.createElement('div');
    menu.className = 'context-menu';
    
    const isTextMessage = msg.type === 'text' || !msg.type;
    
    menu.innerHTML = `
      <div style="display:flex;gap:4px;padding:8px;border-bottom:1px solid #eee;">
        <button class="reaction-btn" data-emoji="👍">👍</button>
        <button class="reaction-btn" data-emoji="❤️">❤️</button>
        <button class="reaction-btn" data-emoji="😂">😂</button>
        <button class="reaction-btn" data-emoji="😢">😢</button>
        <button class="reaction-btn" data-emoji="😡">😡</button>
        <button class="reaction-btn" data-emoji="🔥">🔥</button>
      </div>
      <button>💬 Ответить</button>
      ${isTextMessage ? '<button>📋 Копировать текст</button>' : ''}
      ${isTextMessage && msg.from === currentUser ? '<button>✏️ Редактировать</button>' : ''}
      ${msg.from === currentUser ? '<button class="danger-btn">🗑️ Удалить</button>' : ''}
    `;
    
    const x = event.clientX || (event.touches && event.touches[0].clientX) || 100;
    const y = event.clientY || (event.touches && event.touches[0].clientY) || 100;
    
    const menuWidth = 220;
    const menuHeight = 300;
    let left = x;
    let top = y;
    
    if (x + menuWidth > window.innerWidth) left = window.innerWidth - menuWidth - 10;
    if (y + menuHeight > window.innerHeight) top = y - menuHeight;
    if (left < 10) left = 10;
    if (top < 10) top = 10;
    
    menu.style.cssText = 'position:fixed;left:' + left + 'px;top:' + top + 'px;z-index:9999;';
    document.body.appendChild(menu);
    
    // Реакции
    menu.querySelectorAll('.reaction-btn').forEach(function(btn) {
      btn.addEventListener('click', function(e) {
        e.stopPropagation();
        addReaction(msg, btn.dataset.emoji);
        menu.remove();
      });
    });
    
    // Ответить (цитирование)
buttons[btnIndex].addEventListener('click', function() {
    menu.remove();
    setReply(msg);
    document.getElementById('msgInput').focus();
});
btnIndex++;
    
    // Копировать (только текст)
    if (isTextMessage) {
      buttons[btnIndex].addEventListener('click', function() {
        menu.remove();
        navigator.clipboard?.writeText(msg.text || '');
        const toast = document.createElement('div');
        toast.textContent = '✅ Скопировано!';
        toast.style.cssText = 'position:fixed;bottom:20px;left:50%;transform:translateX(-50%);background:#333;color:white;padding:10px 20px;border-radius:20px;z-index:9999;';
        document.body.appendChild(toast);
        setTimeout(function() { toast.remove(); }, 1500);
      });
      btnIndex++;
    }
    
    // Редактировать (только свой текст)
    if (isTextMessage && msg.from === currentUser) {
      buttons[btnIndex].addEventListener('click', function() {
        menu.remove();
        var newText = prompt('Редактировать:', msg.text || '');
        if (newText && newText !== msg.text) db.ref(getChatPath() + '/' + msg.id).update({text: newText, edited: true});
      });
      btnIndex++;
    }
    
    // Удалить (только свои сообщения)
    if (msg.from === currentUser) {
      buttons[btnIndex].addEventListener('click', function() {
        menu.remove();
        if (confirm('Удалить сообщение?')) {
          db.ref(getChatPath() + '/' + msg.id).set(null);
          var el = document.querySelector('[data-id="' + msg.id + '"]');
          if (el) { el.style.opacity = '0'; el.style.transition = '0.3s'; setTimeout(function() { el.remove(); }, 300); }
          processedIds.delete(msg.id);
        }
      });
    }
    
    setTimeout(function() {
      var close = function(e) { if (!menu.contains(e.target)) { menu.remove(); document.removeEventListener('click', close); } };
      document.addEventListener('click', close);
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
    if (messageListener) db.ref(getChatPath()).off('child_added', messageListener);
    const ref = db.ref(getChatPath());
    const chatWindow = document.getElementById('chatWindow');
    if (chatWindow) chatWindow.innerHTML = '';
    processedIds.clear();
    
    ref.orderByChild('timestamp').limitToLast(100).once('value', function(snap) {
      const msgs = snap.val();
      if (chatWindow) chatWindow.innerHTML = '';
      if (!msgs) { if (chatWindow) chatWindow.innerHTML = '<div class="empty-chat"><div class="empty-icon">💬</div><p>Нет сообщений</p></div>'; return; }
      const sorted = Object.entries(msgs).map(function(e) { return Object.assign({id: e[0]}, e[1]); }).sort(function(a, b) { return (a.timestamp || 0) - (b.timestamp || 0); });
      const fragment = document.createDocumentFragment();
      sorted.forEach(function(msg) { showMessage(msg, fragment); });
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
  
  // ============ УВЕДОМЛЕНИЯ ============
  function notify(title, body) {
    if (!notifEnabled) return;
    if (navigator.vibrate) navigator.vibrate([200, 100, 200]);
    if (document.visibilityState !== 'visible') {
      if ('Notification' in window && Notification.permission === 'granted') {
        new Notification(title, { body: body, icon: 'icon-192.png', tag: 'fchat', vibrate: [200, 100, 200] });
      }
    }
    playSound();
  }
  
  function playSound() {
    if (!soundEnabled) return;
    try {
      const ctx = new (window.AudioContext || window.webkitAudioContext)();
      const osc = ctx.createOscillator(); const gain = ctx.createGain();
      osc.connect(gain); gain.connect(ctx.destination);
      osc.frequency.value = 800; gain.gain.value = 0.1;
      osc.start(); gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.3);
      osc.stop(ctx.currentTime + 0.3);
    } catch(e) {}
  }
  
  function requestNotif() {
    if ('Notification' in window && Notification.permission === 'default') Notification.requestPermission();
  }

  function setReply(msg) {
    replyToMessage = msg;
    
    // Показываем панель цитирования
    const replyBar = document.getElementById('replyBar') || createReplyBar();
    replyBar.style.display = 'flex';
    replyBar.querySelector('.reply-text').textContent = (msg.text || '📷 Фото').substring(0, 100);
    replyBar.querySelector('.reply-author').textContent = FAMILY[msg.from]?.name || 'Кто-то';
}

function clearReply() {
    replyToMessage = null;
    const replyBar = document.getElementById('replyBar');
    if (replyBar) replyBar.style.display = 'none';
}

function createReplyBar() {
    const bar = document.createElement('div');
    bar.id = 'replyBar';
    bar.style.cssText = 'display:none;padding:8px 15px;background:rgba(102,126,234,0.2);border-left:3px solid #667eea;margin-bottom:5px;align-items:center;gap:10px;';
    bar.innerHTML = `
        <div style="flex:1;">
            <div class="reply-author" style="font-weight:600;font-size:0.85rem;color:#667eea;"></div>
            <div class="reply-text" style="font-size:0.8rem;opacity:0.7;"></div>
        </div>
        <button id="cancelReply" style="background:none;border:none;color:#ff4444;cursor:pointer;font-size:1.2rem;">✕</button>
    `;
    
    document.getElementById('input-panel-container')?.insertBefore(bar, document.querySelector('.input-row'));
    
    bar.querySelector('#cancelReply').addEventListener('click', clearReply);
    return bar;
}
  // ============ ОТПРАВКА ============
  function sendText(text, replyTo) {
    if (!currentUser) { alert('Сначала войдите'); return; }
    if (!text.trim()) return;
    
    const msg = { 
      from: currentUser, 
      text: text.trim(), 
      timestamp: firebase.database.ServerValue.TIMESTAMP, 
      type: 'text' 
    };
    
    // Добавляем информацию о цитируемом сообщении
    if (replyTo) {
      msg.replyTo = {
        id: replyTo.id,
        text: replyTo.text || '📷 Фото',
        from: replyTo.from,
        fromName: FAMILY[replyTo.from]?.name || 'Кто-то'
      };
    }
    
    if (autoDeleteHours > 0) msg.deleteAt = Date.now() + autoDeleteHours * 3600000;
    db.ref(getChatPath()).push(msg);
    const msgInput = document.getElementById('msgInput');
    if (msgInput) msgInput.value = '';
    
    // Сбрасываем цитирование
    clearReply();
}
  
  // ============ ОБРАБОТЧИКИ ============
  function setupListeners() {
    if (listenersInitialized) return;
    listenersInitialized = true;
    
    document.addEventListener('visibilitychange', function() {
      if (document.visibilityState === 'visible') { unreadCount = 0; updateUnreadBadge(); }
    });
    
    document.getElementById('sendBtn').addEventListener('click', function() {
    sendText(document.getElementById('msgInput').value, replyToMessage);
});

    //Прокрутка к сообщению
    function scrollToMessage(msgId) {
    const el = document.querySelector('[data-id="' + msgId + '"]');
    if (el) {
        el.scrollIntoView({ behavior: 'smooth', block: 'center' });
        el.style.background = 'rgba(102,126,234,0.2)';
        setTimeout(() => el.style.background = '', 2000);
    }
}
    
    // Индикатор печати
    document.getElementById('msgInput').addEventListener('input', function() {
      if (!currentUser) return;
      db.ref('typing/' + getChatPath() + '/' + currentUser).set(true);
      clearTimeout(typingTimer);
      typingTimer = setTimeout(function() { db.ref('typing/' + getChatPath() + '/' + currentUser).remove(); }, 2000);
    });
    
    function listenTyping() {
      db.ref('typing/' + getChatPath()).on('value', function(snap) {
        const typing = snap.val() || {};
        const users = Object.keys(typing).filter(function(id) { return id !== currentUser; });
        const indicator = document.getElementById('typingIndicator') || (function() {
          const div = document.createElement('div');
          div.id = 'typingIndicator';
          div.style.cssText = 'padding:5px 15px;color:#999;font-size:0.8rem;';
          document.getElementById('chatWindow').before(div);
          return div;
        })();
        indicator.textContent = users.length > 0 ? users.map(function(id) { return FAMILY[id]?.name || 'Кто-то'; }).join(', ') + ' печатает...' : '';
      });
    }
    listenTyping();
    
    document.getElementById('emojiBtn').addEventListener('click', function() { document.getElementById('emojiPicker').classList.toggle('show'); });
    document.addEventListener('click', function(e) { const pk = document.getElementById('emojiPicker'), eb = document.getElementById('emojiBtn'); if (pk && eb && !pk.contains(e.target) && e.target !== eb) pk.classList.remove('show'); });
    
    document.getElementById('attachBtn').addEventListener('click', function() { if (!currentUser) { alert('Войдите'); return; } document.getElementById('fileInput').click(); });
    document.getElementById('fileInput').addEventListener('change', function(e) {
      const files = e.target.files;
      if (!files.length) return;
      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        const reader = new FileReader();
        if (file.type.startsWith('image/')) {
          reader.onload = function(ev) { sendMedia('image', ev.target.result); };
        } else {
          reader.onload = function(ev) { sendMedia('file', ev.target.result, file.name, file.type); };
        }
        reader.readAsDataURL(file);
      }
      e.target.value = '';
    });
    
    document.getElementById('avatarBtn').addEventListener('click', function() { if (!currentUser) { alert('Войдите'); return; } document.getElementById('avatarInput').click(); });
    document.getElementById('avatarResetBtn').addEventListener('click', function() { if (!currentUser) return; if (confirm('Сбросить?')) resetAvatar(currentUser); });
    document.getElementById('avatarInput').addEventListener('change', function(e) {
      const file = e.target.files[0];
      if (file && file.type.startsWith('image/')) { const r = new FileReader(); r.onload = function(ev) { saveAvatar(currentUser, ev.target.result); }; r.readAsDataURL(file); }
      e.target.value = '';
    });
    
    document.getElementById('micBtn').addEventListener('click', function() {
      if (!currentUser) { alert('Войдите'); return; }
      const btn = document.getElementById('micBtn');
      if (mediaRecorder && mediaRecorder.state === 'recording') { mediaRecorder.stop(); btn.classList.remove('recording'); btn.textContent = '🎤'; return; }
      navigator.mediaDevices.getUserMedia({audio: true}).then(function(stream) {
        mediaRecorder = new MediaRecorder(stream);
        audioChunks = [];
        mediaRecorder.ondataavailable = function(e) { audioChunks.push(e.data); };
        mediaRecorder.onstop = function() {
          const blob = new Blob(audioChunks, {type: 'audio/webm'});
          const r = new FileReader(); r.onload = function(ev) { sendMedia('voice', ev.target.result); }; r.readAsDataURL(blob);
          stream.getTracks().forEach(function(t) { t.stop(); });
        };
        mediaRecorder.start(); btn.classList.add('recording'); btn.textContent = '⏹️';
        setTimeout(function() { if (mediaRecorder && mediaRecorder.state === 'recording') { mediaRecorder.stop(); btn.classList.remove('recording'); btn.textContent = '🎤'; } }, 30000);
      }).catch(function() { alert('Нет микрофона'); });
    });
    
    // Вкладки
    document.querySelectorAll('.tab').forEach(function(tab) {
      tab.addEventListener('click', function() {
        document.querySelectorAll('.tab').forEach(function(t) { t.classList.remove('active'); });
        tab.classList.add('active');
        const newTab = tab.dataset.tab;
        if (newTab === 'private') {
          if (!privateWith) {
            const saved = localStorage.getItem('fc_private_' + currentUser);
            privateWith = (saved && FAMILY[saved]) ? saved : Object.values(FAMILY).filter(function(m) { return m.id !== currentUser; })[0]?.id || null;
          }
        } else {
          privateWith = null;
        }
        activeTab = newTab;
        updatePrivate();
        loadMessages();
        updatePrivateHeader();
      });
    });
    
    document.getElementById('settingsBtn').addEventListener('click', function() { document.getElementById('settingsPanel').classList.toggle('show'); });
    document.getElementById('themeBtn').addEventListener('click', function() {
      isDarkTheme = !isDarkTheme;
      document.body.classList.toggle('dark-theme', isDarkTheme);
      this.textContent = isDarkTheme ? '☀️' : '🌙';
      localStorage.setItem('fc_theme', isDarkTheme ? 'dark' : 'light');
    });
    
    document.getElementById('notifBtn').addEventListener('click', function() {
      notifEnabled = !notifEnabled; localStorage.setItem('fc_notif', notifEnabled);
      this.textContent = notifEnabled ? '🔔' : '🔕';
      const nt = document.getElementById('notifToggle'); if (nt) nt.checked = notifEnabled;
      if (notifEnabled) requestNotif();
    });
    
    document.getElementById('soundBtn').addEventListener('click', function() {
      soundEnabled = !soundEnabled; localStorage.setItem('fc_sound', soundEnabled);
      this.textContent = soundEnabled ? '🔊' : '🔇';
      const st = document.getElementById('soundToggle'); if (st) st.checked = soundEnabled;
    });
    
    document.getElementById('notifToggle').addEventListener('change', function() {
      notifEnabled = this.checked; localStorage.setItem('fc_notif', notifEnabled);
      document.getElementById('notifBtn').textContent = notifEnabled ? '🔔' : '🔕';
    });
    
    document.getElementById('soundToggle').addEventListener('change', function() {
      soundEnabled = this.checked; localStorage.setItem('fc_sound', soundEnabled);
      document.getElementById('soundBtn').textContent = soundEnabled ? '🔊' : '🔇';
    });
    
    document.getElementById('autoDelete').addEventListener('change', function() { autoDeleteHours = parseInt(this.value); localStorage.setItem('fc_autoDelete', autoDeleteHours); });
    
    function applyFontSize() {
      document.documentElement.style.setProperty('--font-scale', fontSize / 100);
      document.getElementById('fontValue').textContent = fontSize + '%';
      localStorage.setItem('fc_font', fontSize);
    }
    document.getElementById('fontUp').addEventListener('click', function() { if (fontSize < 150) { fontSize += 10; applyFontSize(); } });
    document.getElementById('fontDown').addEventListener('click', function() { if (fontSize > 80) { fontSize -= 10; applyFontSize(); } });
    
    document.getElementById('changePinBtn').addEventListener('click', function() {
      if (!currentUser) { alert('Войдите'); return; }
      const oldPin = prompt('Текущий ПИН:'); if (!oldPin || !verifyPin(currentUser, oldPin)) { alert('Неверно'); return; }
      const newPin = prompt('Новый 4-значный ПИН:'); if (!newPin || newPin.length !== 4 || !/^\d{4}$/.test(newPin)) { alert('4 цифры!'); return; }
      setPin(currentUser, newPin); alert('✅ ПИН изменён!');
    });
    
    document.getElementById('changeCodeBtn').addEventListener('click', function() {
      if (!currentUser) { alert('Войдите'); return; }
      if (currentUser !== 'dad' && currentUser !== 'mom') { alert('Только Папа или Мама'); return; }
      const pin = prompt('Ваш ПИН:'); if (!pin || !verifyPin(currentUser, pin)) { alert('Неверно'); return; }
      const old = prompt('Текущий код:'); if (old !== secretCode) { alert('Неверно'); return; }
      const newCode = prompt('Новый код (мин 4):'); if (newCode && newCode.length >= 4) { secretCode = newCode; localStorage.setItem('fc_code', newCode); alert('✅ Код изменён!'); }
    });
    
    document.getElementById('cacheBtn').addEventListener('click', function() { if (confirm('Перезагрузить?')) location.reload(); });
    document.getElementById('clearBtn').addEventListener('click', function() {
      if (!currentUser) return;
      if (confirm('Удалить всё?')) { db.ref(getChatPath()).set(null); processedIds.clear(); loadMessages(); }
    });
  }
  
  function applyStoredSettings() {
    isDarkTheme = localStorage.getItem('fc_theme') === 'dark';
    if (isDarkTheme) document.body.classList.add('dark-theme');
    const themeBtn = document.getElementById('themeBtn'); if (themeBtn) themeBtn.textContent = isDarkTheme ? '☀️' : '🌙';
    document.documentElement.style.setProperty('--font-scale', fontSize / 100);
    const fv = document.getElementById('fontValue'); if (fv) fv.textContent = fontSize + '%';
    const nt = document.getElementById('notifToggle'); if (nt) nt.checked = notifEnabled;
    const st = document.getElementById('soundToggle'); if (st) st.checked = soundEnabled;
    const ad = document.getElementById('autoDelete'); if (ad) ad.value = autoDeleteHours;
    document.getElementById('notifBtn').textContent = notifEnabled ? '🔔' : '🔕';
    document.getElementById('soundBtn').textContent = soundEnabled ? '🔊' : '🔇';
  }
  
  // ============ ПРОСМОТРЩИК ФОТО (зум от точки касания) ============
window.openImageViewer = function(src) {
  const allImages = [];
  document.querySelectorAll('.media-img').forEach(img => { if (img.src) allImages.push(img.src); });
  let currentIndex = allImages.indexOf(src);
  const old = document.querySelector('.image-viewer');
  if (old) old.remove();
  
  const viewer = document.createElement('div');
  viewer.className = 'image-viewer';
  viewer.style.cssText = 'position:fixed;top:0;left:0;width:100%;height:100%;background:rgba(0,0,0,0.95);z-index:10000;overflow:hidden;touch-action:none;';
  
  const imgContainer = document.createElement('div');
  imgContainer.style.cssText = 'width:100%;height:100%;display:flex;align-items:center;justify-content:center;';
  
  const img = document.createElement('img');
  img.src = src;
  img.style.cssText = 'max-width:90%;max-height:90%;object-fit:contain;transform-origin:0 0;';
  
  let scale = 1, translateX = 0, translateY = 0;
  let lastDist = 0, lastScale = 1;
  let isDragging = false, dragStartX = 0, dragStartY = 0;
  let lastTap = 0;
  
  function updateTransform() {
    img.style.transform = `translate(${translateX}px, ${translateY}px) scale(${scale})`;
  }
  
  // Пинч-зум от точки касания
  img.addEventListener('touchstart', function(e) {
    if (e.touches.length === 2) {
      isDragging = false;
      lastDist = Math.hypot(e.touches[0].clientX - e.touches[1].clientX, e.touches[0].clientY - e.touches[1].clientY);
      lastScale = scale;
      
      // Центр между пальцами
      const cx = (e.touches[0].clientX + e.touches[1].clientX) / 2;
      const cy = (e.touches[0].clientY + e.touches[1].clientY) / 2;
      
      // Сохраняем точку зума
      img.dataset.zoomX = cx;
      img.dataset.zoomY = cy;
    } else if (e.touches.length === 1 && scale > 1) {
      isDragging = true;
      dragStartX = e.touches[0].clientX - translateX;
      dragStartY = e.touches[0].clientY - translateY;
    }
  });
  
  img.addEventListener('touchmove', function(e) {
    if (e.touches.length === 2) {
      e.preventDefault();
      const newDist = Math.hypot(e.touches[0].clientX - e.touches[1].clientX, e.touches[0].clientY - e.touches[1].clientY);
      const newScale = lastScale * (newDist / lastDist);
      scale = Math.min(5, Math.max(0.5, newScale));
      updateTransform();
    } else if (isDragging && e.touches.length === 1 && scale > 1) {
      e.preventDefault();
      translateX = e.touches[0].clientX - dragStartX;
      translateY = e.touches[0].clientY - dragStartY;
      updateTransform();
    } else if (e.touches.length === 1 && scale === 1) {
      // Свайп для перелистывания
      img.style.transform = `translateX(${e.touches[0].clientX - (dragStartX + translateX)}px)`;
    }
  });
  
  img.addEventListener('touchend', function(e) {
    if (e.touches.length === 0) {
      // Свайп
      if (scale === 1) {
        const diff = parseFloat(img.style.transform.replace('translateX(','').replace('px)','')) || 0;
        if (diff < -100 && currentIndex < allImages.length - 1) { currentIndex++; img.src = allImages[currentIndex]; updateCounter(); }
        else if (diff > 100 && currentIndex > 0) { currentIndex--; img.src = allImages[currentIndex]; updateCounter(); }
        img.style.transform = '';
      }
      isDragging = false;
    }
  });
  
  // Двойной тап
  img.addEventListener('click', function(e) {
    const now = Date.now();
    if (now - lastTap < 300) {
      e.preventDefault();
      if (scale > 1) {
        scale = 1; translateX = 0; translateY = 0;
      } else {
        scale = 2.5;
        // Зум к точке тапа
        const rect = img.getBoundingClientRect();
        translateX = -(e.clientX - rect.left) * (scale - 1);
        translateY = -(e.clientY - rect.top) * (scale - 1);
      }
      updateTransform();
    }
    lastTap = now;
  });
  
  imgContainer.appendChild(img);
  viewer.appendChild(imgContainer);
  
  const counter = document.createElement('div');
  counter.style.cssText = 'position:absolute;top:20px;left:50%;transform:translateX(-50%);color:white;background:rgba(0,0,0,0.5);padding:5px 15px;border-radius:20px;z-index:10001;';
  viewer.appendChild(counter);
  function updateCounter() { counter.textContent = (currentIndex + 1) + ' / ' + allImages.length; }
  updateCounter();
  
  if (currentIndex > 0) {
    const prev = document.createElement('button');
    prev.innerHTML = '‹';
    prev.style.cssText = 'position:absolute;left:10px;top:50%;transform:translateY(-50%);color:white;background:rgba(255,255,255,0.2);border:none;border-radius:50%;width:50px;height:50px;font-size:2rem;cursor:pointer;z-index:10001;';
    prev.onclick = function(e) { e.stopPropagation(); currentIndex--; img.src = allImages[currentIndex]; updateCounter(); scale = 1; translateX = 0; translateY = 0; updateTransform(); };
    viewer.appendChild(prev);
  }
  
  if (currentIndex < allImages.length - 1) {
    const next = document.createElement('button');
    next.innerHTML = '›';
    next.style.cssText = 'position:absolute;right:10px;top:50%;transform:translateY(-50%);color:white;background:rgba(255,255,255,0.2);border:none;border-radius:50%;width:50px;height:50px;font-size:2rem;cursor:pointer;z-index:10001;';
    next.onclick = function(e) { e.stopPropagation(); currentIndex++; img.src = allImages[currentIndex]; updateCounter(); scale = 1; translateX = 0; translateY = 0; updateTransform(); };
    viewer.appendChild(next);
  }
  
  const close = document.createElement('button');
  close.textContent = '✕';
  close.style.cssText = 'position:absolute;top:20px;right:20px;padding:10px;background:rgba(255,255,255,0.2);color:white;border:none;border-radius:8px;cursor:pointer;z-index:10001;';
  close.onclick = function() { viewer.remove(); };
  viewer.appendChild(close);
  
  viewer.addEventListener('click', function(e) { if (e.target === viewer) viewer.remove(); });
  document.body.appendChild(viewer);
};
  
  // ============ АВТОУДАЛЕНИЕ ============
  function startAutoDelete() {
    setInterval(function() {
      if (autoDeleteHours === 0 || !currentUser) return;
      db.ref(getChatPath()).once('value').then(function(snap) {
        const msgs = snap.val(); if (!msgs) return;
        const now = Date.now(), updates = {};
        for (const [id, msg] of Object.entries(msgs)) { if (msg.deleteAt && msg.deleteAt <= now) { updates[id] = null; processedIds.delete(id); } }
        if (Object.keys(updates).length > 0) db.ref(getChatPath()).update(updates);
      });
    }, 30000);
  }
  
  // ============ СЕКРЕТНЫЙ КОД ============
  document.getElementById('secretBtn').addEventListener('click', function() {
    if (document.getElementById('secretInput').value === secretCode) {
      document.getElementById('secretOverlay').style.display = 'none';
      document.getElementById('mainApp').style.display = 'flex';
      initApp();
    } else {
      document.getElementById('errorMsg').classList.add('show');
      document.getElementById('secretInput').value = '';
      document.getElementById('secretInput').focus();
    }
  });
  document.getElementById('secretInput').addEventListener('keydown', function(e) { if (e.key === 'Enter') document.getElementById('secretBtn').click(); });
  document.getElementById('secretInput').focus();
  
  // ============ ПИН ============
  document.getElementById('pinBtn').addEventListener('click', processPin);
  document.getElementById('pinInput').addEventListener('keydown', function(e) { if (e.key === 'Enter') processPin(); });
  document.getElementById('pinOverlay').addEventListener('click', function(e) { if (e.target === this) hidePinDialog(); });
  
  function updatePrivate() {
    const sel = document.getElementById('privateRecipient');
    if (!sel || !currentUser) return;
    const others = Object.values(FAMILY).filter(function(m) { return m.id !== currentUser; });
    sel.innerHTML = '<option value="">Выберите...</option>' + others.map(function(m) { return '<option value="' + m.id + '" ' + (m.id === privateWith ? 'selected' : '') + '>' + m.emoji + ' ' + m.name + '</option>'; }).join('');
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
      if (savedPrivate && FAMILY[savedPrivate]) { privateWith = savedPrivate; updatePrivate(); }
    }
    if (lockedUser && hasPin(lockedUser)) showPinDialog(lockedUser);
    else {
      const cw = document.getElementById('chatWindow');
      if (cw) cw.innerHTML = '<div class="empty-chat"><div class="empty-icon">🔒</div><p>Выберите роль и создайте ПИН-код</p></div>';
    }
    console.log('✅ FChat запущен');
  }
  
  setInterval(function() { if (processedIds.size > 100) processedIds.clear(); }, 300000);
  console.log('📱 FChat готов');
})();
