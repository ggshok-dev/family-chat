// ============ ЧАТЫ И СООБЩЕНИЯ FChat ============

// Состояние чата
let activeTab = 'general';        // 'general' или 'private'
let privateWith = null;           // UID собеседника в личном чате
let messageListener = null;       // Слушатель сообщений
let processedIds = new Set();     // Кэш обработанных сообщений
let replyToMessage = null;        // Цитируемое сообщение
let typingTimer = null;           // Таймер индикатора печати

// ============ ПУТИ К ЧАТАМ ============
function getChatPath() {
  if (!currentFamilyId) return null;
  
  if (activeTab === 'private' && privateWith) {
    const chatId = getPrivateChatId(currentUser, privateWith);
    return 'messages/' + currentFamilyId + '/private/' + chatId;
  }
  
  return 'messages/' + currentFamilyId + '/general';
}

// ============ ЗАГРУЗКА СООБЩЕНИЙ ============
function loadMessages() {
  if (!currentFamilyId) return;
  
  const chatPath = getChatPath();
  if (!chatPath) return;
  
  // Отключаем старый слушатель
  if (messageListener) {
    db.ref(chatPath).off('child_added', messageListener);
  }
  
  const ref = db.ref(chatPath);
  const chatWindow = document.getElementById('chatWindow');
  if (chatWindow) chatWindow.innerHTML = '';
  processedIds.clear();
  
  // Загружаем последние 100 сообщений
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
    sorted.forEach(function(msg) { showMessage(msg, fragment); });
    if (chatWindow) chatWindow.appendChild(fragment);
    if (chatWindow) chatWindow.scrollTop = chatWindow.scrollHeight;
  });
  
  // Слушаем новые сообщения
  messageListener = ref.on('child_added', function(snap) {
    const msg = Object.assign({id: snap.key}, snap.val());
    if (!processedIds.has(msg.id)) {
      showMessage(msg);
      if (msg.from !== currentUser) {
        notifyNewMessage(msg);
      }
    }
  });
  
  // Слушаем удаление
  ref.on('child_removed', function(snap) {
    const el = document.querySelector('[data-id="' + snap.key + '"]');
    if (el) {
      el.style.opacity = '0';
      el.style.transition = '0.3s';
      setTimeout(function() { el.remove(); }, 300);
    }
    processedIds.delete(snap.key);
  });
  
  // Слушаем изменения
  ref.on('child_changed', function(snap) {
    const msg = Object.assign({id: snap.key}, snap.val());
    const old = document.querySelector('[data-id="' + msg.id + '"]');
    if (old) old.remove();
    processedIds.delete(msg.id);
    showMessage(msg);
  });
}

// ============ ОТПРАВКА СООБЩЕНИЙ ============
function sendText(text, replyTo) {
  if (!currentFamilyId) { alert('Вы не состоите в семье'); return; }
  if (!text.trim()) return;
  
  // Проверяем права на запись
  if (activeTab === 'general' && !hasPermission('canWriteGeneralChat')) {
    alert('У вас нет прав писать в общий чат');
    return;
  }
  
  const msg = {
    from: currentUser,
    fromName: currentUserData?.name || 'Пользователь',
    fromEmoji: currentUserData?.emoji || '👤',
    text: text.trim(),
    timestamp: firebase.database.ServerValue.TIMESTAMP,
    type: 'text'
  };
  
  // Цитирование
  if (replyTo) {
    msg.replyTo = {
      id: replyTo.id,
      text: (replyTo.text || '').substring(0, 200),
      from: replyTo.from,
      fromName: replyTo.fromName || 'Пользователь'
    };
  }
  
  db.ref(getChatPath()).push(msg);
  document.getElementById('msgInput').value = '';
  clearReply();
}

// ============ ОТПРАВКА МЕДИА ============
function sendMedia(type, dataUrl, fileName, fileType) {
  if (!currentFamilyId) { alert('Вы не состоите в семье'); return; }
  
  if (activeTab === 'general' && !hasPermission('canWriteGeneralChat')) {
    alert('У вас нет прав писать в общий чат');
    return;
  }
  
  if (type === 'voice') {
    db.ref(getChatPath()).push({
      from: currentUser,
      fromName: currentUserData?.name || 'Пользователь',
      fromEmoji: currentUserData?.emoji || '👤',
      type: 'voice',
      data: dataUrl,
      timestamp: firebase.database.ServerValue.TIMESTAMP,
      text: '🎤 Голосовое сообщение'
    });
    return;
  }
  
  if (type === 'file') {
    db.ref(getChatPath()).push({
      from: currentUser,
      fromName: currentUserData?.name || 'Пользователь',
      fromEmoji: currentUserData?.emoji || '👤',
      type: 'file',
      data: dataUrl,
      fileName: fileName,
      fileType: fileType,
      timestamp: firebase.database.ServerValue.TIMESTAMP,
      text: '📎 ' + (fileName || 'Файл')
    });
    return;
  }
  
  // Сжатие изображений
  const img = new Image();
  img.onload = function() {
    const canvas = document.createElement('canvas');
    let w = img.width, h = img.height;
    if (w > 1200) { h = h * 1200 / w; w = 1200; }
    canvas.width = w; canvas.height = h;
    canvas.getContext('2d').drawImage(img, 0, 0, w, h);
    
    db.ref(getChatPath()).push({
      from: currentUser,
      fromName: currentUserData?.name || 'Пользователь',
      fromEmoji: currentUserData?.emoji || '👤',
      type: 'image',
      data: canvas.toDataURL('image/jpeg', 0.7),
      timestamp: firebase.database.ServerValue.TIMESTAMP,
      text: '📷 Фото'
    });
  };
  img.src = dataUrl;
}

// ============ ОТОБРАЖЕНИЕ СООБЩЕНИЙ ============
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
  
  const div = document.createElement('div');
  div.className = 'message ' + (isSent ? 'sent' : 'received');
  div.dataset.id = msg.id;

  // Цитирование
  let replyHTML = '';
  if (msg.replyTo) {
    replyHTML = `
      <div class="reply-preview" style="border-left:3px solid #667eea;padding:5px 10px;margin-bottom:5px;background:rgba(102,126,234,0.1);border-radius:4px;font-size:0.85rem;cursor:pointer;" onclick="scrollToMessage('${msg.replyTo.id}')">
        <div style="font-weight:600;color:#667eea;">↳ ${msg.replyTo.fromName || 'Пользователь'}</div>
        <div style="opacity:0.7;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${msg.replyTo.text || 'Сообщение'}</div>
      </div>
    `;
  }
  
  // Контент
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
    (!isSent ? '<div class="msg-sender"><span class="sender-avatar">' + (msg.fromEmoji || '👤') + '</span><strong>' + (msg.fromName || 'Пользователь') + '</strong></div>' : '') +
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
  
  // Меню сообщения
  const menuBtn = div.querySelector('.msg-menu-btn');
  if (menuBtn) {
    menuBtn.addEventListener('click', function(e) {
      e.stopPropagation();
      showMessageMenu(e, msg);
    });
  }
  
  if (fragment) {
    fragment.appendChild(div);
  } else {
    chat.appendChild(div);
    chat.scrollTop = chat.scrollHeight;
  }
}

// ============ ПЕРЕКЛЮЧЕНИЕ ЧАТОВ ============
function switchToGeneralChat() {
  activeTab = 'general';
  privateWith = null;
  document.querySelectorAll('.tab').forEach(function(t) { t.classList.remove('active'); });
  const generalTab = document.querySelector('.tab[data-tab="general"]');
  if (generalTab) generalTab.classList.add('active');
  updatePrivateHeader();
  loadMessages();
}

function switchToPrivateChat(userId) {
  // Проверяем права
  if (!hasPermission('canSeePrivateChats')) {
    alert('У вас нет доступа к личным чатам');
    return;
  }
  
  activeTab = 'private';
  privateWith = userId;
  document.querySelectorAll('.tab').forEach(function(t) { t.classList.remove('active'); });
  const privateTab = document.querySelector('.tab[data-tab="private"]');
  if (privateTab) privateTab.classList.add('active');
  updatePrivateHeader();
  loadMessages();
}

// ============ ЦИТИРОВАНИЕ ============
function setReply(msg) {
  replyToMessage = msg;
  const replyBar = document.getElementById('replyBar') || createReplyBar();
  replyBar.style.display = 'flex';
  replyBar.querySelector('.reply-text').textContent = (msg.text || '📷 Фото').substring(0, 100);
  replyBar.querySelector('.reply-author').textContent = msg.fromName || 'Пользователь';
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

// ============ ИНДИКАТОР ПЕЧАТИ ============
function startTypingIndicator() {
  if (!currentFamilyId || !currentUser) return;
  db.ref('typing/' + currentFamilyId + '/' + getChatPath().replace(/\//g, '_') + '/' + currentUser).set(true);
  clearTimeout(typingTimer);
  typingTimer = setTimeout(function() {
    db.ref('typing/' + currentFamilyId + '/' + getChatPath().replace(/\//g, '_') + '/' + currentUser).remove();
  }, 3000);
}

function listenTyping() {
  const typingPath = 'typing/' + currentFamilyId + '/' + getChatPath().replace(/\//g, '_');
  db.ref(typingPath).on('value', function(snap) {
    const typing = snap.val() || {};
    const users = Object.keys(typing).filter(function(id) { return id !== currentUser; });
    
    const indicator = document.getElementById('typingIndicator') || createTypingIndicator();
    
    if (users.length > 0) {
      // Загружаем имена (упрощённо — показываем количество)
      indicator.textContent = users.length + ' чел. печатает...';
      indicator.style.display = 'block';
    } else {
      indicator.style.display = 'none';
    }
  });
}

function createTypingIndicator() {
  const div = document.createElement('div');
  div.id = 'typingIndicator';
  div.style.cssText = 'padding:5px 15px;color:#999;font-size:0.8rem;font-style:italic;';
  document.getElementById('chatWindow').before(div);
  return div;
}

// ============ ОБНОВЛЕНИЕ ЗАГОЛОВКА ЛИЧНОГО ЧАТА ============
function updatePrivateHeader() {
  const header = document.getElementById('privateChatHeader');
  if (!header) return;
  
  if (activeTab === 'private' && privateWith) {
    // Загружаем имя собеседника
    db.ref('users/' + privateWith).once('value').then(function(snap) {
      const user = snap.val();
      if (user) {
        header.style.display = 'flex';
        header.querySelector('.partner-name').textContent = user.name || 'Пользователь';
      }
    });
  } else {
    header.style.display = 'none';
  }
}

// ============ ПРОКРУТКА К СООБЩЕНИЮ ============
function scrollToMessage(msgId) {
  const el = document.querySelector('[data-id="' + msgId + '"]');
  if (el) {
    el.scrollIntoView({ behavior: 'smooth', block: 'center' });
    el.style.background = 'rgba(102,126,234,0.2)';
    setTimeout(function() { el.style.background = ''; }, 2000);
  }
}

// ============ УВЕДОМЛЕНИЕ О НОВОМ СООБЩЕНИИ ============
function notifyNewMessage(msg) {
  if (document.visibilityState !== 'visible') {
    if (navigator.vibrate) navigator.vibrate([200, 100, 200]);
    
    if ('serviceWorker' in navigator && navigator.serviceWorker.controller) {
      navigator.serviceWorker.ready.then(function(reg) {
        reg.showNotification(msg.fromName || 'FChat', {
          body: msg.text || 'Новое сообщение',
          icon: '/family-chat/icon-192.png',
          vibrate: [200, 100, 200]
        });
      });
    }
  }
}

console.log('✅ chat.js загружен');