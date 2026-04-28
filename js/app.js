// Инициализация приложения
function setupListeners() {
  // Секретный код
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
  
  // ПИН
  document.getElementById('pinBtn').addEventListener('click', processPin);
  document.getElementById('pinInput').addEventListener('keydown', function(e) {
    if (e.key === 'Enter') processPin();
  });
  
  document.getElementById('pinOverlay').addEventListener('click', function(e) {
    if (e.target === this) hidePinDialog();
  });
  
  // Отправка сообщений
  document.getElementById('sendBtn').addEventListener('click', function() {
    sendText(document.getElementById('msgInput').value);
  });
  
  document.getElementById('msgInput').addEventListener('keydown', function(e) {
    if (e.key === 'Enter' && !e.shiftKey) { 
      e.preventDefault(); 
      sendText(this.value); 
    }
  });
  
  // Эмодзи
  document.getElementById('emojiBtn').addEventListener('click', function() {
    document.getElementById('emojiPicker').classList.toggle('show');
  });
  
  document.addEventListener('click', function(e) {
    const pk = document.getElementById('emojiPicker');
    const eb = document.getElementById('emojiBtn');
    if (!pk.contains(e.target) && e.target !== eb) pk.classList.remove('show');
  });
  
  // Файлы
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
  
  // Аватар
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
  
  // Микрофон
  document.getElementById('micBtn').addEventListener('click', function() {
    if (!currentUser) { alert('Сначала войдите под своей ролью'); return; }
    const btn = document.getElementById('micBtn');
    
    if (mediaRecorder && mediaRecorder.state === 'recording') {
      mediaRecorder.stop(); 
      btn.classList.remove('recording'); 
      btn.textContent = '🎤'; 
      return;
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
      btn.classList.add('recording'); 
      btn.textContent = '⏹️';
      setTimeout(function() {
        if (mediaRecorder && mediaRecorder.state === 'recording') {
          mediaRecorder.stop(); 
          btn.classList.remove('recording'); 
          btn.textContent = '🎤';
        }
      }, 10000);
    }).catch(function() { alert('Нет доступа к микрофону'); });
  });
  
  // Вкладки
  document.querySelectorAll('.tab').forEach(function(tab) {
    tab.addEventListener('click', function() {
      document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
      tab.classList.add('active');
      activeTab = tab.dataset.tab;
      document.getElementById('privateSel').style.display = activeTab === 'private' ? 'block' : 'none';
      if (activeTab !== 'private') privateWith = null;
      updatePrivate();
      loadMessages();
      updatePrivateHeader();
    });
  });
  
  document.getElementById('privateRecipient').addEventListener('change', function() {
    privateWith = this.value;
    if (privateWith) {
      loadMessages();
      updatePrivateHeader();
    }
  });
  
  // Настройки
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
    if (!newPin || newPin.length !== 4 || !/^\d{4}$/.test(newPin)) { 
      alert('ПИН должен состоять из 4 цифр'); 
      return; 
    }
    setPin(currentUser, newPin);
    alert('✅ ПИН-код изменён!');
  });
  
  document.getElementById('changeCodeBtn').addEventListener('click', function() {
    const old = prompt('Текущий код семьи:');
    if (old !== secretCode) { alert('Неверно'); return; }
    const newCode = prompt('Новый код семьи:');
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
    if (confirm('Удалить все сообщения?')) {
      db.ref(getChatPath()).remove();
      processedIds.clear();
    }
  });
}

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
  
  console.log('✅ FChat запущен');
}
