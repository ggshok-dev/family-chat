// ============ AI-АССИСТЕНТ FChat (GigaChat от Сбера) ============
//
// ИНСТРУКЦИЯ ПО ПОЛУЧЕНИЮ ТОКЕНА:
// 1. Перейдите на https://developers.sber.ru/
// 2. Войдите через Сбер ID
// 3. Создайте проект и выберите GigaChat API
// 4. В разделе "Авторизация" создайте токен
// 5. Вставьте его ниже вместо YOUR_GIGACHAT_TOKEN
//
// Бесплатные лимиты:
// - Достаточно для семейного чата
// - Токен нужно обновлять раз в сутки (автоматически)
// ============ AI-АССИСТЕНТ FChat (GigaChat от Сбера) ============
//
// Автоматическое обновление токена каждые 25 минут
// CORS-прокси для обхода ограничений браузера

// Данные авторизации
// ============ AI-АССИСТЕНТ FChat (GigaChat от Сбера) ============
// Прямые запросы к API без прокси

const AUTH_KEY = 'MDE5ZGVlYzktZTg1Ni03OTNhLTlmZGYtMGRiOWQwM2NkZjVhOjBjNDgzMTJiLTI4OWItNDZmOC04YmUxLTMxNGUzNTIyNzMwYw==';

const GIGACHAT_API = 'https://gigachat.devices.sberbank.ru/api/v1/chat/completions';
const TOKEN_API = 'https://ngw.devices.sberbank.ru:9443/api/v2/oauth';

let GIGACHAT_TOKEN = '';

const AI_ASSISTANT_ID = 'ai_assistant';
const AI_ASSISTANT_NAME = '🤖 Ассистент';
const AI_ASSISTANT_EMOJI = '🤖';

const TRIGGERS = [
  'ассистент', '🤖', 'помощник', '@бот', '@assistant', '@ai',
  'подскажи', 'расскажи', 'объясни', 'что такое', 'как приготовить',
  'посоветуй', 'помоги', 'напомни', 'переведи', 'посчитай'
];

async function getNewToken() {
  try {
    console.log('🔄 Запрашиваю токен GigaChat...');
    
    const response = await fetch(TOKEN_API, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Accept': 'application/json',
        'RqUID': (crypto.randomUUID ? crypto.randomUUID() : Date.now().toString()),
        'Authorization': 'Basic ' + AUTH_KEY
      },
      body: 'scope=GIGACHAT_API_PERS'
    });
    
    const data = await response.json();
    
    if (data.access_token) {
      GIGACHAT_TOKEN = data.access_token;
      console.log('✅ Токен GigaChat получен');
      return true;
    } else {
      console.error('❌ Ошибка токена:', data);
      return false;
    }
  } catch (error) {
    console.error('❌ Сетевая ошибка:', error.message);
    return false;
  }
}

setInterval(getNewToken, 25 * 60 * 1000);

async function askAIAssistant(prompt, history) {
  try {
    if (!GIGACHAT_TOKEN) {
      const ok = await getNewToken();
      if (!ok) return '🤖 Не удалось подключиться к серверу.';
    }
    
    const response = await fetch(GIGACHAT_API, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer ' + GIGACHAT_TOKEN
      },
      body: JSON.stringify({
        model: 'GigaChat',
        messages: [
          { role: 'system', content: 'Ты — семейный ассистент FChat. Отвечай кратко, по-русски, с эмодзи.' },
          { role: 'user', content: history ? `История:\n${history}\n\nВопрос: ${prompt}` : prompt }
        ],
        temperature: 0.7,
        max_tokens: 300
      })
    });
    
    const data = await response.json();
    
    if (data.error?.code === 'TokenExpired') {
      await getNewToken();
      return askAIAssistant(prompt, history);
    }
    
    return data.choices?.[0]?.message?.content || '🤖 Не понял вопрос.';
  } catch (error) {
    return '🤖 Ошибка: ' + error.message;
  }
}

async function sendAIMessage(path, text) {
  await db.ref(path).push({
    from: AI_ASSISTANT_ID,
    fromName: AI_ASSISTANT_NAME,
    fromEmoji: AI_ASSISTANT_EMOJI,
    text: text,
    timestamp: firebase.database.ServerValue.TIMESTAMP,
    type: 'text',
    isAI: true
  });
}

async function getRecentMessages(path, limit) {
  const snap = await db.ref(path).orderByChild('timestamp').limitToLast(limit || 10).once('value');
  const msgs = [];
  snap.forEach(s => { const m = s.val(); if (m.from !== AI_ASSISTANT_ID) msgs.push((m.fromName||'Кто-то') + ': ' + (m.text||'')); });
  return msgs.join('\n');
}

function shouldRespond(text) {
  return TRIGGERS.some(t => (text||'').toLowerCase().includes(t));
}

function setupAIAssistant() {
  if (!currentFamilyId) return;
  
  getNewToken().then(ok => {
    if (!ok) { console.log('⚠️ Токен не получен'); return; }
    
    const path = 'messages/' + currentFamilyId + '/general';
    db.ref(path).on('child_added', async snap => {
      const msg = snap.val();
      if (msg.from === AI_ASSISTANT_ID || msg.timestamp < Date.now() - 5000 || !shouldRespond(msg.text)) return;
      
      db.ref('typing/' + currentFamilyId + '/general/' + AI_ASSISTANT_ID).set(true);
      const history = await getRecentMessages(path, 10);
      const answer = await askAIAssistant(msg.text, history);
      db.ref('typing/' + currentFamilyId + '/general/' + AI_ASSISTANT_ID).remove();
      await sendAIMessage(path, answer);
    });
    
    console.log('✅ AI-ассистент активирован');
  });
}

async function registerAIAssistant() {
  if (!currentFamilyId) return;
  await db.ref('families/' + currentFamilyId + '/members/' + AI_ASSISTANT_ID).set({ role: 'friend', joinedAt: firebase.database.ServerValue.TIMESTAMP });
  await db.ref('users/' + AI_ASSISTANT_ID).set({ name: AI_ASSISTANT_NAME, emoji: AI_ASSISTANT_EMOJI, isAI: true });
}

console.log('✅ ai-assistant.js загружен (GigaChat прямые запросы)');
