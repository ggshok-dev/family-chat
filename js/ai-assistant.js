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
const AUTH_KEY = 'MDE5ZGVlYzktZTg1Ni03OTNhLTlmZGYtMGRiOWQwM2NkZjVhOjBjNDgzMTJiLTI4OWItNDZmOC04YmUxLTMxNGUzNTIyNzMwYw==';

// API endpoints
const GIGACHAT_API = 'https://gigachat.devices.sberbank.ru/api/v1/chat/completions';
const TOKEN_API = 'https://ngw.devices.sberbank.ru:9443/api/v2/oauth';
const CORS_PROXY = 'https://corsproxy.io/?';

// Токен (обновляется автоматически)
let GIGACHAT_TOKEN = '';

// ============ КОНФИГУРАЦИЯ АССИСТЕНТА ============
const AI_ASSISTANT_ID = 'ai_assistant';
const AI_ASSISTANT_NAME = '🤖 Ассистент';
const AI_ASSISTANT_EMOJI = '🤖';

const TRIGGERS = [
  'ассистент', '🤖', 'помощник', '@бот', '@assistant', '@ai',
  'подскажи', 'расскажи', 'объясни', 'что такое', 'как приготовить',
  'посоветуй', 'помоги', 'напомни', 'переведи', 'посчитай'
];

// ============ ПОЛУЧЕНИЕ ТОКЕНА ============
async function getNewToken() {
  try {
    console.log('🔄 Запрашиваю новый токен GigaChat...');
    
    const response = await fetch(TOKEN_API, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Accept': 'application/json',
        'RqUID': (crypto.randomUUID ? crypto.randomUUID() : Date.now().toString()),
        'Authorization': 'Basic ' + AUTH_KEY
      },
      body: 'scope=GIGACHAT_API_PERS',
      mode: 'cors'
    });
    
    const data = await response.json();
    
    if (data.access_token) {
      GIGACHAT_TOKEN = data.access_token;
      console.log('✅ Новый токен GigaChat получен');
      return true;
    } else {
      console.error('❌ Ошибка получения токена:', data);
      return false;
    }
  } catch (error) {
    console.error('❌ Ошибка получения токена:', error);
    return false;
  }
}

// Обновляем токен каждые 25 минут
setInterval(getNewToken, 25 * 60 * 1000);

// ============ ОТПРАВКА ЗАПРОСА К GigaChat ============
async function askAIAssistant(prompt, messageHistory) {
  try {
    // Если токена нет — получаем
    if (!GIGACHAT_TOKEN) {
      const success = await getNewToken();
      if (!success) return '🤖 Не удалось подключиться к серверу. Попробуйте позже.';
    }
    
    const requestBody = {
      model: 'GigaChat',
      messages: [
        {
          role: 'system',
          content: 'Ты — дружелюбный семейный ассистент в чате FChat. Твоё имя — Ассистент. Ты помогаешь семье с вопросами, даёшь советы, шутишь и поддерживаешь беседу. Правила: 1) Отвечай кратко и по-русски 2) Будь вежливым и доброжелательным 3) Не используй markdown, только обычный текст 4) Используй эмодзи в ответах 5) Помни, что ты общаешься с семьёй'
        },
        {
          role: 'user',
          content: messageHistory 
            ? `История чата:\n${messageHistory}\n\nНовый вопрос: ${prompt}` 
            : prompt
        }
      ],
      temperature: 0.7,
      max_tokens: 300
    };

    console.log('📤 Отправляю запрос к GigaChat...');
    
    const response = await fetch(GIGACHAT_API, {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': 'Bearer ' + GIGACHAT_TOKEN
  },
  body: JSON.stringify(requestBody)
});
    
    const data = await response.json();
    
    // Если токен истёк — получаем новый и пробуем снова
    if (data.error && (data.error.code === 'TokenExpired' || response.status === 401)) {
      console.log('🔄 Токен истёк, получаю новый...');
      await getNewToken();
      return askAIAssistant(prompt, messageHistory);
    }
    
    if (data.error) {
      console.error('❌ Ошибка GigaChat:', data.error);
      return '🤖 Ошибка: ' + (data.error.message || 'сервер временно недоступен');
    }
    
    return data.choices?.[0]?.message?.content || '🤖 Я не понял вопрос. Можете перефразировать?';
    
  } catch (error) {
    console.error('❌ Сетевая ошибка:', error);
    
    // Если сеть недоступна — пробуем ещё раз через 3 секунды
    await new Promise(resolve => setTimeout(resolve, 3000));
    return '🤖 Сервер временно недоступен. Попробуйте через минуту.';
  }
}

// ============ ОТПРАВКА СООБЩЕНИЯ ОТ АССИСТЕНТА ============
async function sendAIMessage(chatPath, text) {
  const msg = {
    from: AI_ASSISTANT_ID,
    fromName: AI_ASSISTANT_NAME,
    fromEmoji: AI_ASSISTANT_EMOJI,
    text: text,
    timestamp: firebase.database.ServerValue.TIMESTAMP,
    type: 'text',
    isAI: true
  };
  
  await db.ref(chatPath).push(msg);
}

// ============ ПОЛУЧЕНИЕ ПОСЛЕДНИХ СООБЩЕНИЙ ============
async function getRecentMessages(chatPath, limit) {
  const snap = await db.ref(chatPath)
    .orderByChild('timestamp')
    .limitToLast(limit || 10)
    .once('value');
  
  const messages = [];
  snap.forEach(function(s) {
    const m = s.val();
    if (m.from !== AI_ASSISTANT_ID) {
      messages.push((m.fromName || 'Кто-то') + ': ' + (m.text || ''));
    }
  });
  
  return messages.join('\n');
}

// ============ ПРОВЕРКА ТРИГГЕРОВ ============
function shouldRespond(text) {
  const lowerText = (text || '').toLowerCase();
  return TRIGGERS.some(function(trigger) {
    return lowerText.includes(trigger);
  });
}

// ============ НАСТРОЙКА АССИСТЕНТА ============
function setupAIAssistant() {
  if (!currentFamilyId) {
    console.log('❌ Нельзя активировать ассистента: нет семьи');
    return;
  }
  
  // Получаем первый токен
  getNewToken().then(function(success) {
    if (!success) {
      console.log('⚠️ Не удалось получить токен. Ассистент не активирован.');
      return;
    }
    
    const generalPath = 'messages/' + currentFamilyId + '/general';
    
    // Слушаем общий чат
    db.ref(generalPath).on('child_added', async function(snap) {
      const msg = snap.val();
      
      if (msg.from === AI_ASSISTANT_ID) return;
      if (msg.timestamp < Date.now() - 5000) return;
      if (!shouldRespond(msg.text)) return;
      
      console.log('🤖 Ассистент отвечает на запрос:', msg.text?.substring(0, 50));
      
      db.ref('typing/' + currentFamilyId + '/general/' + AI_ASSISTANT_ID).set(true);
      
      const history = await getRecentMessages(generalPath, 10);
      const answer = await askAIAssistant(msg.text, history);
      
      db.ref('typing/' + currentFamilyId + '/general/' + AI_ASSISTANT_ID).remove();
      
      await sendAIMessage(generalPath, answer);
    });
    
    // Слушаем личные чаты
    if (currentUser) {
      const privatePath = 'messages/' + currentFamilyId + '/private';
      
      db.ref(privatePath).on('child_added', async function(snap) {
        const chatId = snap.key;
        if (!chatId.includes(currentUser)) return;
        
        const chatPath = privatePath + '/' + chatId;
        
        db.ref(chatPath).on('child_added', async function(msgSnap) {
          const msg = msgSnap.val();
          
          if (msg.from === AI_ASSISTANT_ID) return;
          if (msg.timestamp < Date.now() - 5000) return;
          if (!shouldRespond(msg.text)) return;
          
          console.log('🤖 Ассистент отвечает в личном чате');
          
          db.ref('typing/' + currentFamilyId + '/private_' + chatId + '/' + AI_ASSISTANT_ID).set(true);
          
          const history = await getRecentMessages(chatPath, 5);
          const answer = await askAIAssistant(msg.text, history);
          
          db.ref('typing/' + currentFamilyId + '/private_' + chatId + '/' + AI_ASSISTANT_ID).remove();
          
          await sendAIMessage(chatPath, answer);
        });
      });
    }
    
    console.log('✅ AI-ассистент (GigaChat) активирован и слушает чат');
  });
}

// ============ РЕГИСТРАЦИЯ АССИСТЕНТА В СЕМЬЕ ============
async function registerAIAssistant() {
  if (!currentFamilyId) return;
  
  await db.ref('families/' + currentFamilyId + '/members/' + AI_ASSISTANT_ID).set({
    role: 'friend',
    joinedAt: firebase.database.ServerValue.TIMESTAMP
  });
  
  await db.ref('users/' + AI_ASSISTANT_ID).set({
    name: AI_ASSISTANT_NAME,
    emoji: AI_ASSISTANT_EMOJI,
    isAI: true
  });
  
  console.log('✅ AI-ассистент зарегистрирован в семье');
}

// ============ КОМАНДЫ АССИСТЕНТА ============
const COMMANDS = {
  'привет': 'Привет! 👋 Я семейный ассистент на базе GigaChat. Спросите меня о чём угодно!',
  'что ты умеешь': 'Я могу:\n• Отвечать на вопросы\n• Давать советы\n• Помогать с рецептами\n• Объяснять сложные вещи\n• Поддерживать беседу\n• И многое другое!\nОбращайтесь!',
  'спасибо': 'Всегда пожалуйста! 😊',
  'пока': 'До встречи! 👋'
};

function getCommandResponse(text) {
  const lowerText = (text || '').toLowerCase().trim();
  for (const [command, response] of Object.entries(COMMANDS)) {
    if (lowerText === command) return response;
  }
  return null;
}

console.log('✅ ai-assistant.js загружен (GigaChat)');
