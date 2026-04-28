// Работа с чатом
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
  document.getElementById('chatWindow').innerHTML = 
    '<div class="empty-chat"><div class="empty-icon">💬</div><p>Загрузка...</p></div>';
  processedIds.clear();
  
  ref.once('value', function(snap) {
    const msgs = snap.val();
    document.getElementById('chatWindow').innerHTML = '';
    
    if (!msgs) {
      document.getElementById('chatWindow').innerHTML = 
        '<div class="empty-chat"><div class="empty-icon">💬</div><p>Нет сообщений</p></div>';
      return;
    }
    
    const sorted = Object.entries(msgs)
      .map(e => Object.assign({id: e[0]}, e[1]))
      .sort((a, b) => (a.timestamp || 0) - (b.timestamp || 0));
    
    sorted.forEach(msg => showMessage(msg));
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

function sendText(text) {
  if (!currentUser) { 
    alert('Сначала выберите пользователя и введите ПИН-код'); 
    return; 
  }
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

function startAutoDelete() {
  setInterval(function() {
    if (autoDeleteHours === 0 || !currentUser) return;
    db.ref(getChatPath()).once('value').then(snap => {
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

function updatePrivate() {
  const sel = document.getElementById('privateRecipient');
  const others = Object.values(FAMILY).filter(m => m.id !== currentUser);
  sel.innerHTML = '<option value="">Выберите...</option>' +
    others.map(m => `<option value="${m.id}" ${m.id === privateWith ? 'selected' : ''}>${m.emoji} ${m.name}</option>`).join('');
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