// ============ AI-АССИСТЕНТ FChat (Google Gemini) ============
// 
// ИНСТРУКЦИЯ ПО ПОЛУЧЕНИЮ API-КЛЮЧА:
// 1. Перейдите на https://aistudio.google.com/apikey
// 2. Войдите в свой Google-аккаунт
// 3. Нажмите "Create API Key"
// 4. Выберите "Create API key in new project"
// 5. Скопируйте полученный ключ
// 6. Вставьте его ниже вместо YOUR_API_KEY_HERE
//
// Лимиты бесплатного использования:
// - 60 запросов в минуту
// - 1 500 запросов в день
// - Этого более чем достаточно для семейного чата

const GEMINI_API_KEY = 'YOUR_API_KEY_HERE'; // ← ЗАМЕНИТЕ НА СВОЙ КЛЮЧ

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

// Характер ассистента
const AI_PERSONALITY = `Ты — дружелюбный семейный ассистент в чате FChat. 
Твоё имя — Ассистент. Ты помогаешь семье с вопросами, даёшь советы, 
шутишь и поддерживаешь беседу.

Правила поведения:
1. Отвечай кратко и по-русски
2. Будь вежливым и доброжелательным
3. Не используй markdown, только обычный текст
4. Если вопрос не по теме — вежливо откажись отвечать
5. Помни, что ты общаешься с семьёй — будь как добрый родственник`;

// ============ ОТПРАВКА ЗАПРОСА К GEMINI ============
async function askGemini(prompt, messageHistory) {
  try {
    const response = await fetch(
      'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=' + GEMINI_API_KEY,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{
            parts: [{
              text: `${AI_PERSONALITY}

Предыдущие сообщения в чате:
${messageHistory || 'Нет сообщений'}

Новое сообщение от пользователя: ${prompt}

Ответь на это сообщение.`
            }]
          }],
          generationConfig: {
            temperature: 0.7,
            maxOutputTokens: 300,
            topP: 0.8,
            topK: 40
          }
        })
      }
    );
    
    const data = await response.json();
    
    if (data.error) {
      console.error('Gemini API error:', data.error);
      return '🤖 Извините, произошла ошибка. Попробуйте позже.';
    }
    
    return data.candidates?.[0]?.content?.parts?.[0]?.text || '🤖 Я не понял вопрос. Можете перефразировать?';
  } catch (error) {
    console.error('Gemini error:', error);
    return '🤖 Я временно недоступен. Попробуйте через минуту.';
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
    if (m.from !== AI_ASSISTANT_ID) { // Исключаем сообщения ассистента
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
  
  if (GEMINI_API_KEY === 'YOUR_API_KEY_HERE') {
    console.log('⚠️ AI-ассистент не активирован: нужно указать API-ключ Gemini');
    console.log('   Получите ключ на https://aistudio.google.com/apikey');
    console.log('   И вставьте его в js/ai-assistant.js вместо YOUR_API_KEY_HERE');
    return;
  }
  
  const generalPath = 'messages/' + currentFamilyId + '/general';
  
  // Слушаем общий чат
  db.ref(generalPath).on('child_added', async function(snap) {
    const msg = snap.val();
    
    // Пропускаем сообщения ассистента
    if (msg.from === AI_ASSISTANT_ID) return;
    
    // Пропускаем старые сообщения (при загрузке истории)
    if (msg.timestamp < Date.now() - 5000) return;
    
    // Проверяем триггеры
    if (!shouldRespond(msg.text)) return;
    
    console.log('🤖 Ассистент отвечает на запрос:', msg.text?.substring(0, 50));
    
    // Показываем индикатор "печатает"
    db.ref('typing/' + currentFamilyId + '/general/' + AI_ASSISTANT_ID).set(true);
    
    // Получаем контекст
    const history = await getRecentMessages(generalPath, 10);
    
    // Получаем ответ
    const answer = await askGemini(msg.text, history);
    
    // Убираем индикатор печати
    db.ref('typing/' + currentFamilyId + '/general/' + AI_ASSISTANT_ID).remove();
    
    // Отправляем ответ
    await sendAIMessage(generalPath, answer);
  });
  
  // Слушаем личные чаты
  if (currentUser) {
    const privatePath = 'messages/' + currentFamilyId + '/private';
    
    db.ref(privatePath).on('child_added', async function(snap) {
      const chatId = snap.key;
      // Проверяем, участвует ли текущий пользователь в этом чате
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
        const answer = await askGemini(msg.text, history);
        
        db.ref('typing/' + currentFamilyId + '/private_' + chatId + '/' + AI_ASSISTANT_ID).remove();
        
        await sendAIMessage(chatPath, answer);
      });
    });
  }
  
  console.log('✅ AI-ассистент активирован и слушает чат');
}

// ============ РЕГИСТРАЦИЯ АССИСТЕНТА В СЕМЬЕ ============
async function registerAIAssistant() {
  if (!currentFamilyId) return;
  
  // Добавляем ассистента в семью
  await db.ref('families/' + currentFamilyId + '/members/' + AI_ASSISTANT_ID).set({
    role: 'friend',
    joinedAt: firebase.database.ServerValue.TIMESTAMP
  });
  
  // Создаём профиль
  await db.ref('users/' + AI_ASSISTANT_ID).set({
    name: AI_ASSISTANT_NAME,
    emoji: AI_ASSISTANT_EMOJI,
    isAI: true
  });
  
  console.log('✅ AI-ассистент зарегистрирован в семье');
}

// ============ КОМАНДЫ АССИСТЕНТА ============
const COMMANDS = {
  'привет': 'Привет! 👋 Я семейный ассистент. Спросите меня о чём угодно!',
  'что ты умеешь': 'Я могу:\n• Отвечать на вопросы\n• Давать советы\n• Помогать с рецептами\n• Объяснять сложные вещи\n• Поддерживать беседу\nОбращайтесь!',
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

console.log('✅ ai-assistant.js загружен');
console.log('   Для активации:');
console.log('   1. Получите ключ на https://aistudio.google.com/apikey');
console.log('   2. Вставьте ключ в переменную GEMINI_API_KEY');
console.log('   3. В main.js добавьте: setupAIAssistant();');