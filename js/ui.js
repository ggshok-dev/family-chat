// Рендеринг интерфейса
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
          ${av ? 
            '<img src="' + av + '" alt="' + m.name + '">' : 
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
  grid.innerHTML = EMOJI_LIST.map(e => 
    '<button class="emoji-item">' + e + '</button>'
  ).join('');
  
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
    (!isSent ? 
      '<div class="msg-sender"><span class="sender-avatar">' + 
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
    document.addEventListener('click', function close() { 
      menu.remove(); 
      document.removeEventListener('click', close); 
    });
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

function applyStoredSettings() {
  if (isDarkTheme) {
    document.body.classList.add('dark-theme');
    document.getElementById('themeBtn').textContent = '☀️';
  }
  
  document.documentElement.style.setProperty('--font-scale', fontSize / 100);
  const fv = document.getElementById('fontValue');
  if (fv) fv.textContent = fontSize + '%';
  
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