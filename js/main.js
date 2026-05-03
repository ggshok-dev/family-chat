// ============ ГЛАВНЫЙ МОДУЛЬ FChat ============

// ============ ЗАПУСК ПРИЛОЖЕНИЯ ============
function initApp() {
  // Применяем сохранённые настройки
  applyStoredSettings();
  
  // Инициализируем интерфейс
  renderEmojiPicker();
  setupUIListeners();
  
  // Загружаем данные, если пользователь в семье
  if (currentFamilyId) {
    renderUsers();
    
    // Показываем общий чат по умолчанию
    switchToGeneralChat();
    
    // AI Ассистент
    if (currentFamilyId) {
    setupAIAssistant();
}

    // Слушаем индикатор печати
    listenTyping();
    
    // Запускаем автоудаление
    startAutoDelete();
  } else {
    // Пользователь не в семье — показываем приглашение
    showFamilySetup();
  }
  
  console.log('✅ FChat запущен');
}

function nextStep(step) {
    // Переключаем шаги
    document.querySelectorAll('.auth-step').forEach(el => el.classList.remove('active'));
    document.getElementById(`step-${step}`).classList.add('active');
    
    // Двигаем прогресс-бар
    const progress = (step / 3) * 100;
    document.getElementById('progress-fill').style.width = `${progress}%`;
}

function finishRegistration() {
    // Собираем данные
    const familyData = {
        familyName: document.getElementById('family-input').value,
        userName: document.getElementById('name-input').value,
        pin: document.getElementById('pin-input').value
    };
    
    console.log("Данные для Firebase:", familyData);
    
    // Эффектное исчезновение формы
    document.getElementById('auth-container').style.opacity = '0';
    setTimeout(() => {
        document.getElementById('auth-container').style.display = 'none';
        // Здесь вызывай свою функцию инициализации чата
    }, 500);
}

// ============ НАСТРОЙКА СЕМЬИ ============
function showFamilySetup() {
  const chatWindow = document.getElementById('chatWindow');
  if (!chatWindow) return;
  
  const isAdminRole = isAdmin(getUserRole());
  
  chatWindow.innerHTML = `
    <div class="empty-chat" style="padding:20px;text-align:center;">
      <div class="empty-icon">🏠</div>
      <h3 style="margin:15px 0;color:#667eea;">Добро пожаловать в FChat!</h3>
      <p style="margin-bottom:20px;">Вы ещё не состоите в семье.</p>
      
      ${isAdminRole ? `
        <button id="createFamilyBtn" class="action-btn primary" style="padding:12px 24px;font-size:1rem;margin:5px;">
          🏠 Создать семью
        </button>
      ` : ''}
      
      <div style="margin:15px 0;">
        <input type="text" id="inviteCodeInput" placeholder="Код приглашения (например: IVAN-1234)" 
               style="padding:10px;border:1px solid #ddd;border-radius:8px;width:80%;text-align:center;font-size:0.9rem;">
        <button id="joinFamilyBtn" class="action-btn primary" style="padding:12px 24px;font-size:1rem;margin-top:10px;">
          🔑 Присоединиться к семье
        </button>
      </div>
    </div>
  `;
  
  // Обработчик создания семьи
  const createBtn = document.getElementById('createFamilyBtn');
  if (createBtn) {
    createBtn.addEventListener('click', async function() {
      const familyName = prompt('Введите название семьи (например: Ивановы):');
      if (!familyName) return;
      
      const result = await createFamily(familyName);
      if (result.success) {
        alert('✅ Семья создана! Код приглашения: ' + result.inviteCode + '\n\nСообщите этот код родственникам.');
        renderUsers();
        switchToGeneralChat();
      } else {
        alert('❌ ' + result.error);
      }
    });
  }
  
  // Обработчик присоединения
  const joinBtn = document.getElementById('joinFamilyBtn');
  if (joinBtn) {
    joinBtn.addEventListener('click', async function() {
      const code = document.getElementById('inviteCodeInput').value.trim();
      if (!code) { alert('Введите код приглашения'); return; }
      
      const result = await joinFamily(code);
      if (result.success) {
        alert('✅ Вы присоединились к семье ' + result.familyName + '!');
        renderUsers();
        switchToGeneralChat();
      } else {
        alert('❌ ' + result.error);
      }
    });
  }
}

// ============ АВТОУДАЛЕНИЕ СООБЩЕНИЙ ============
function startAutoDelete() {
  setInterval(function() {
    if (autoDeleteHours === 0 || !currentFamilyId) return;
    
    db.ref(getChatPath()).once('value').then(function(snap) {
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
      
      if (Object.keys(updates).length > 0) {
        db.ref(getChatPath()).update(updates);
      }
    });
  }, 60000); // Проверка каждую минуту
}

// ============ ПРОСМОТРЩИК ФОТО ============
window.openImageViewer = function(src) {
  const allImages = [];
  document.querySelectorAll('.media-img').forEach(function(img) {
    if (img.src) allImages.push(img.src);
  });
  
  let currentIndex = allImages.indexOf(src);
  const old = document.querySelector('.image-viewer');
  if (old) old.remove();
  
  const viewer = document.createElement('div');
  viewer.className = 'image-viewer';
  viewer.style.cssText = 'position:fixed;top:0;left:0;width:100%;height:100%;background:rgba(0,0,0,0.95);z-index:10000;overflow:hidden;touch-action:none;';
  
  const img = document.createElement('img');
  img.src = src;
  img.style.cssText = 'max-width:90%;max-height:90%;object-fit:contain;position:absolute;top:50%;left:50%;transform:translate(-50%,-50%);';
  
  let scale = 1, panX = 0, panY = 0;
  let isPanning = false, panStartX = 0, panStartY = 0, panStartPanX = 0, panStartPanY = 0;
  let isZooming = false, lastDist = 0, lastScale = 1;
  let isSwiping = false, swipeStartX = 0;
  
  function updateImage() {
    img.style.transform = 'translate(calc(-50% + ' + panX + 'px), calc(-50% + ' + panY + 'px)) scale(' + scale + ')';
  }
  
  img.addEventListener('touchstart', function(e) {
    if (e.touches.length === 2) {
      isZooming = true; isPanning = false; isSwiping = false;
      lastDist = Math.hypot(e.touches[0].clientX - e.touches[1].clientX, e.touches[0].clientY - e.touches[1].clientY);
      lastScale = scale;
    } else if (e.touches.length === 1) {
      if (scale > 1) {
        isPanning = true; isZooming = false; isSwiping = false;
        panStartX = e.touches[0].clientX; panStartY = e.touches[0].clientY;
        panStartPanX = panX; panStartPanY = panY;
      } else {
        isSwiping = true; isZooming = false; isPanning = false;
        swipeStartX = e.touches[0].clientX;
      }
    }
  });
  
  img.addEventListener('touchmove', function(e) {
    e.preventDefault();
    if (isZooming && e.touches.length === 2) {
      const dist = Math.hypot(e.touches[0].clientX - e.touches[1].clientX, e.touches[0].clientY - e.touches[1].clientY);
      scale = lastScale * (dist / lastDist);
      scale = Math.min(5, Math.max(0.5, scale));
      updateImage();
    } else if (isPanning && e.touches.length === 1 && scale > 1) {
      panX = panStartPanX + (e.touches[0].clientX - panStartX);
      panY = panStartPanY + (e.touches[0].clientY - panStartY);
      updateImage();
    } else if (isSwiping && e.touches.length === 1 && scale === 1) {
      panX = e.touches[0].clientX - swipeStartX;
      updateImage();
    }
  });
  
  img.addEventListener('touchend', function() {
    if (isSwiping && scale === 1) {
      const diff = panX;
      if (diff < -80 && currentIndex < allImages.length - 1) {
        currentIndex++; img.src = allImages[currentIndex]; updateCounter();
      } else if (diff > 80 && currentIndex > 0) {
        currentIndex--; img.src = allImages[currentIndex]; updateCounter();
      }
      panX = 0; panY = 0; updateImage();
    }
    isSwiping = false; isPanning = false; isZooming = false;
  });
  
  let lastTap = 0;
  img.addEventListener('click', function(e) {
    const now = Date.now();
    if (now - lastTap < 300) {
      e.preventDefault();
      if (scale > 1) { scale = 1; panX = 0; panY = 0; }
      else { scale = 2.5; }
      updateImage();
    }
    lastTap = now;
  });
  
  viewer.appendChild(img);
  
  // Счётчик
  const counter = document.createElement('div');
  counter.style.cssText = 'position:fixed;top:20px;left:50%;transform:translateX(-50%);color:white;background:rgba(0,0,0,0.5);padding:5px 15px;border-radius:20px;z-index:10001;font-size:1rem;';
  viewer.appendChild(counter);
  function updateCounter() { counter.textContent = (currentIndex + 1) + ' / ' + allImages.length; }
  updateCounter();
  
  // Стрелки
  if (currentIndex > 0) {
    const prev = document.createElement('button');
    prev.innerHTML = '‹';
    prev.style.cssText = 'position:fixed;left:10px;top:50%;transform:translateY(-50%);color:white;background:rgba(255,255,255,0.15);border:none;border-radius:50%;width:50px;height:50px;font-size:2rem;cursor:pointer;z-index:10001;';
    prev.onclick = function(e) { e.stopPropagation(); currentIndex--; img.src = allImages[currentIndex]; updateCounter(); scale = 1; panX = 0; panY = 0; updateImage(); };
    viewer.appendChild(prev);
  }
  
  if (currentIndex < allImages.length - 1) {
    const next = document.createElement('button');
    next.innerHTML = '›';
    next.style.cssText = 'position:fixed;right:10px;top:50%;transform:translateY(-50%);color:white;background:rgba(255,255,255,0.15);border:none;border-radius:50%;width:50px;height:50px;font-size:2rem;cursor:pointer;z-index:10001;';
    next.onclick = function(e) { e.stopPropagation(); currentIndex++; img.src = allImages[currentIndex]; updateCounter(); scale = 1; panX = 0; panY = 0; updateImage(); };
    viewer.appendChild(next);
  }
  
  // Кнопка закрыть
  const closeBtn = document.createElement('button');
  closeBtn.textContent = '✕';
  closeBtn.style.cssText = 'position:fixed;top:20px;right:20px;padding:10px 16px;background:rgba(255,255,255,0.15);color:white;border:none;border-radius:8px;cursor:pointer;z-index:10001;font-size:1.2rem;';
  closeBtn.onclick = function() { viewer.remove(); };
  viewer.appendChild(closeBtn);
  
  viewer.addEventListener('click', function(e) { if (e.target === viewer) viewer.remove(); });
  document.body.appendChild(viewer);
  
  function escHandler(e) {
    if (e.key === 'Escape') { viewer.remove(); window.removeEventListener('keydown', escHandler); }
  }
  window.addEventListener('keydown', escHandler);
};

// ============ ЗАПУСК ============
// Ждём загрузки DOM
document.addEventListener('DOMContentLoaded', function() {
  console.log('📱 FChat готов к работе');
  
  // Очистка кэша каждые 5 минут
  setInterval(function() {
    if (processedIds.size > 100) processedIds.clear();
  }, 300000);
});
