// ============ РАСПОЗНАВАНИЕ ТЕКСТА С ФОТО (OCR) ============

// Состояние распознавания
let isOCRProcessing = false;

// Распознавание текста
async function extractTextFromImage(imageData) {
  if (isOCRProcessing) return null;
  isOCRProcessing = true;
  
  showToast('🔍 Распознаю текст...');
  
  try {
    const result = await Tesseract.recognize(imageData, 'rus+eng', {
      logger: function(info) {
        if (info.status === 'recognizing text') {
          const percent = Math.round(info.progress * 100);
          showToast('🔍 Распознавание: ' + percent + '%');
        }
      }
    });
    
    isOCRProcessing = false;
    return result.data.text.trim();
  } catch (error) {
    console.error('OCR error:', error);
    isOCRProcessing = false;
    showToast('❌ Ошибка распознавания');
    return null;
  }
}

// Обработка фото с распознаванием текста
async function processImageWithOCR(file) {
  return new Promise(function(resolve) {
    const reader = new FileReader();
    
    reader.onload = async function(ev) {
      const imageData = ev.target.result;
      
      // 1. Сначала отправляем фото в чат (чтобы не ждать)
      sendMedia('image', imageData);
      
      // 2. Параллельно запускаем распознавание текста
      const text = await extractTextFromImage(imageData);
      
      // 3. Если текст найден — спрашиваем, отправить ли его
      if (text && text.length > 5) {
        const preview = text.length > 150 ? text.substring(0, 150) + '...' : text;
        
        // Создаём всплывающее окно с предложением
        const dialog = document.createElement('div');
        dialog.style.cssText = 'position:fixed;bottom:80px;left:50%;transform:translateX(-50%);background:rgba(0,0,0,0.9);color:white;padding:15px 20px;border-radius:15px;z-index:10000;max-width:90%;width:400px;box-shadow:0 8px 30px rgba(0,0,0,0.3);animation:dialogSlideIn 0.3s ease;';
        dialog.innerHTML = `
          <div style="font-weight:600;margin-bottom:8px;">📝 Распознанный текст:</div>
          <div style="max-height:100px;overflow-y:auto;margin-bottom:10px;font-size:0.9rem;opacity:0.9;">${preview}</div>
          <div style="display:flex;gap:8px;">
            <button id="sendOCRText" style="flex:1;padding:10px;background:#667eea;color:white;border:none;border-radius:8px;cursor:pointer;font-weight:600;">Отправить текст</button>
            <button id="closeOCRDialog" style="flex:1;padding:10px;background:rgba(255,255,255,0.2);color:white;border:none;border-radius:8px;cursor:pointer;">Закрыть</button>
          </div>
        `;
        
        document.body.appendChild(dialog);
        
        document.getElementById('sendOCRText').addEventListener('click', function() {
          dialog.remove();
          sendText(text);
        });
        
        document.getElementById('closeOCRDialog').addEventListener('click', function() {
          dialog.remove();
        });
        
        // Автоматически закрыть через 15 секунд
        setTimeout(function() {
          if (dialog.parentNode) dialog.remove();
        }, 15000);
      }
      
      resolve();
    };
    
    reader.readAsDataURL(file);
  });
}

// Встроенное распознавание (без отправки фото)
async function quickOCR(file) {
  return new Promise(function(resolve) {
    const reader = new FileReader();
    reader.onload = async function(ev) {
      const text = await extractTextFromImage(ev.target.result);
      resolve(text);
    };
    reader.readAsDataURL(file);
  });
}

console.log('✅ ocr.js загружен');
