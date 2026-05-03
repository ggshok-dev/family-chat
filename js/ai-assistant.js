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

const GIGACHAT_TOKEN = 'eyJjdHkiOiJqd3QiLCJlbmMiOiJBMjU2Q0JDLUhTNTEyIiwiYWxnIjoiUlNBLU9BRVAtMjU2In0.k9Evwum2I2egft8PSnVtYo35o4WD4WcNGy915WBzk5rGCU8UUfF4oag4UzRqr-P_DfNUCFaXCRjlxMPAyzY7jaaHm2IyEnCtBHgQaBuDavYAHZc08f_8JyiV3oHcJBsh2LRyz63rkmv97YlJGfCL5jWs8EQg-H442f73XeWS8hugp9a_uzpl_8nLCe-eI1tkTkELsfKjxpm7L2yql_sPoeVDyK-RdDT16r_CN5dgihevYbWrFRSHMjBTVZHyvgjSGY-jMbwK7Dg5z-rU1IE3csg6A3M_33-QTaBWe5h1ilvQSrqBogveHzn2--CHtxMIWSnFskNM7sSf3c4JDu5FRA.xf2VbcRaivtIPGLMJeQSeQ.PFaWgayiuSnoWF2wU_igsjyc9QkipOhtbcO7M9dFzjvR8zGpFulxqoPk_1Fl2_8M26_T0vGEAp2GRGYtlQ1ZqTWACp-l9Jkean4hWdP3pXudaUVWdeWRoG9xsW2T1j9BEYDBvDPJ6vDZjYh1duQFn6Lqk-xVqLEojalol9L6SgH3mYn-5sMRwGQvDPrdWYhIzFPj2fhN0BqZjqT2fZNDdpsABqfQHFiVfcqqxWcyVbchTVs559tCNMOHTT4lO6Yu7X3YJwS9zV290W06ToXO52foPU9ISJcBQ1jlhzEzWp5UbCkbK9_lJ2MFu3Lxalc7fxjeavMJDUCfmnrtvgQAp9oXmxWnole934LzcrwYrCXoe7bQA5zjWA22R8UD_lBtnoUcgRIQjSpBb9eGE375uBXqeOdRzwWAe8VUX0xTuu1Z8cUlRYpypRlfWnXDd6ugD2SRXuWdeOoeqUG7xR8IQB0PwUDZj7GF9rcjtqfy-QRZ5guWuNTy5jJOexnkfT1hB_6bJXYNAGDdI7Vm_18xT3vtpPNO94_KQYreoBgouAmw11S85ccdisBtsvWNq1XSYSQyU83PNGJmnDilUnU6NcwB_k5FDgEfHDNcfg4r7jrQ6_JVYzuuN350KAHJUOOBuBfDD_F1EahTAI0IGRElcKKB8g2nRocEldqVshynm-CYIzS-S4xz2cntxFc5k_g-7RTapeBsDTs5gOHQZWWJo00aZar6wbj-644aL_l1t4c';
const GIGACHAT_API = 'https://gigachat.devices.sberbank.ru/api/v1/chat/completions';

// Автоматическое обновление токена (если есть refresh token)
async function refreshGigaChatToken() {
  try {
    const response = await fetch('https://ngw.devices.sberbank.ru:9443/api/v2/oauth', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Authorization': 'Basic ' + btoa('YOUR_CLIENT_ID:YOUR_CLIENT_SECRET')
      },
      body: 'scope=GIGACHAT_API_PERS'
    });
    const data = await response.json();
    if (data.access_token) {
      GIGACHAT_TOKEN = data.access_token;
      console.log('✅ Токен GigaChat обновлён');
    }
  } catch (error) {
    console.error('Ошибка обновления токена:', error);
  }
}

// ============ КОНФИГУРАЦИЯ АССИСТЕНТА ============
const AI_ASSISTANT_ID = 'ai_assistant';
const AI_ASSISTANT_NAME = '🤖 Ассистент';
const AI_ASSISTANT_EMOJI = '🤖';

// Триггеры для обращения к ассистенту
const TRIGGERS = [
  'ассистент', '🤖', 'помощник', '@бот', '@assistant', '@ai',
  'подскажи', 'расскажи', 'объясни', 'что такое', 'как приготовить',
  'посоветуй', 'помоги', 'напомни', 'переведи', 'посчитай'
];

// ============ ОТПРАВКА ЗАПРОСА К GigaChat ============
async function askAIAssistant(prompt, messageHistory) {
  try {
    const requestBody = {
      model: 'GigaChat',
      messages: [
        {
          role: 'system',
          content: 'Ты — дружелюбный семейный ассистент FChat. Отвечай кратко, по-русски, с эмодзи. Не используй markdown.'
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
    
    // ЛОГИРУЕМ ОТВЕТ ДЛЯ ОТЛАДКИ
    console.log('📥 Ответ GigaChat:', data);
    
    if (data.error) {
      console.error('❌ Ошибка GigaChat:', data.error);
      return '🤖 Ошибка: ' + (data.error.message || data.error.code || 'неизвестная ошибка');
    }
    
    if (!data.choices || !data.choices[0]) {
      console.error('❌ Неожиданный формат ответа:', data);
      return '🤖 Получен некорректный ответ от API.';
    }
    
    return data.choices[0].message?.content || '🤖 Пустой ответ от API.';
    
  } catch (error) {
    console.error('❌ Сетевая ошибка:', error);
    return '🤖 Сетевая ошибка: ' + error.message;
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
  
  if (GIGACHAT_TOKEN === 'YOUR_GIGACHAT_TOKEN') {
    console.log('⚠️ AI-ассистент не активирован: нужно указать токен GigaChat');
    console.log('   Получите токен на https://developers.sber.ru/');
    console.log('   И вставьте его в js/ai-assistant.js вместо YOUR_GIGACHAT_TOKEN');
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
console.log('   Для активации:');
console.log('   1. Вставьте токен GigaChat в переменную GIGACHAT_TOKEN');
console.log('   2. В main.js добавьте: setupAIAssistant();');
