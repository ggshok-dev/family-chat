// Firebase
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
  dad: { id: 'dad', name: 'Папа', emoji: '👨' },
  mom: { id: 'mom', name: 'Мама', emoji: '👩' },
  sergey: { id: 'sergey', name: 'Сергей', emoji: '👦' },
  sveta: { id: 'sveta', name: 'Света', emoji: '👧' },
  katya: { id: 'katya', name: 'Катя', emoji: '👧' }
};

let currentUser = null;
const SECRET_CODE = 'family2024';

// Секретный код
document.getElementById('secretBtn').addEventListener('click', () => {
  const code = document.getElementById('secretInput').value;
  if (code === SECRET_CODE) {
    document.getElementById('secretScreen').style.display = 'none';
    document.getElementById('chatScreen').style.display = 'flex';
    document.getElementById('chatScreen').style.flexDirection = 'column';
    showUsers();
  } else {
    document.getElementById('errorMsg').style.display = 'block';
    document.getElementById('secretInput').value = '';
  }
});

document.getElementById('secretInput').addEventListener('keydown', (e) => {
  if (e.key === 'Enter') document.getElementById('secretBtn').click();
});

// Показ пользователей
function showUsers() {
  const container = document.getElementById('users');
  container.innerHTML = Object.values(FAMILY).map(u => 
    `<div class="user ${u.id === currentUser ? 'active' : ''}" data-id="${u.id}">
      ${u.emoji} ${u.name}
    </div>`
  ).join('');
  
  document.querySelectorAll('.user').forEach(el => {
    el.addEventListener('click', () => {
      const userId = el.dataset.id;
      if (userId === currentUser) return;
      
      const pin = localStorage.getItem('pin_' + userId);
      if (pin) {
        const entered = prompt('ПИН для ' + FAMILY[userId].name + ':');
        if (entered !== pin) return alert('Неверный ПИН');
      } else {
        const newPin = prompt('Придумайте 4-значный ПИН для ' + FAMILY[userId].name + ':');
        if (!newPin || newPin.length !== 4) return;
        localStorage.setItem('pin_' + userId, newPin);
      }
      
      currentUser = userId;
      document.getElementById('currentUserName').textContent = FAMILY[userId].name;
      showUsers();
      loadMessages();
    });
  });
}

// Загрузка сообщений
function loadMessages() {
  const chat = document.getElementById('chat');
  const ref = db.ref('messages');
  
  ref.off('child_added');
  chat.innerHTML = '<p style="text-align:center;color:#999;">Загрузка...</p>';
  
  ref.once('value', snap => {
    chat.innerHTML = '';
    const msgs = snap.val();
    if (!msgs) {
      chat.innerHTML = '<p style="text-align:center;color:#999;">Нет сообщений</p>';
      return;
    }
    Object.entries(msgs).sort((a,b) => a[1].time - b[1].time).forEach(([id, msg]) => {
      showMessage({id, ...msg});
    });
  });
  
  ref.on('child_added', snap => {
    showMessage({id: snap.key, ...snap.val()});
  });
}

function showMessage(msg) {
  const chat = document.getElementById('chat');
  const div = document.createElement('div');
  div.className = `msg ${msg.from === currentUser ? 'sent' : 'received'}`;
  const sender = FAMILY[msg.from] || {name: 'Кто-то'};
  div.innerHTML = `<strong>${sender.emoji} ${sender.name}</strong><br>${msg.text}`;
  chat.appendChild(div);
  chat.scrollTop = chat.scrollHeight;
}

// Отправка
document.getElementById('sendBtn').addEventListener('click', () => {
  const input = document.getElementById('msgInput');
  const text = input.value.trim();
  if (!text || !currentUser) return;
  
  db.ref('messages').push({
    from: currentUser,
    text: text,
    time: Date.now()
  });
  input.value = '';
});

document.getElementById('msgInput').addEventListener('keydown', (e) => {
  if (e.key === 'Enter') document.getElementById('sendBtn').click();
});
