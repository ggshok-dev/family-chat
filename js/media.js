// Отправка медиафайлов
function sendMedia(type, dataUrl) {
  if (!currentUser) { 
    alert('Сначала выберите пользователя и введите ПИН-код'); 
    return; 
  }
  
  // Голосовые сообщения отправляем без сжатия
  if (type === 'voice') {
    const msg = {
      from: currentUser,
      type: 'voice',
      data: dataUrl,
      timestamp: firebase.database.ServerValue.TIMESTAMP,
      text: '🎤 Голосовое'
    };
    if (autoDeleteHours > 0) msg.deleteAt = Date.now() + autoDeleteHours * 3600000;
    db.ref(getChatPath()).push(msg);
    return;
  }
  
  // Сжатие изображений
  const img = new Image();
  img.onload = function() {
    const canvas = document.createElement('canvas');
    let w = img.width, h = img.height;
    if (w > 1200) { h = (h * 1200) / w; w = 1200; }
    canvas.width = w; canvas.height = h;
    canvas.getContext('2d').drawImage(img, 0, 0, w, h);
    const compressed = canvas.toDataURL('image/jpeg', 0.7);
    
    const msg = {
      from: currentUser,
      type: 'image',
      data: compressed,
      timestamp: firebase.database.ServerValue.TIMESTAMP,
      text: '📷 Фото'
    };
    if (autoDeleteHours > 0) msg.deleteAt = Date.now() + autoDeleteHours * 3600000;
    db.ref(getChatPath()).push(msg);
  };
  img.src = dataUrl;
}

// Аватарки
function getAvatar(userId) { 
  return localStorage.getItem('fc_av_' + userId) || null; 
}

function saveAvatar(userId, dataUrl) {
  const img = new Image();
  img.onload = function() {
    const canvas = document.createElement('canvas');
    const size = 200;
    canvas.width = size; canvas.height = size;
    const ctx = canvas.getContext('2d');
    const minSide = Math.min(img.width, img.height);
    const sx = (img.width - minSide) / 2;
    const sy = (img.height - minSide) / 2;
    ctx.fillStyle = '#e0e0e0';
    ctx.fillRect(0, 0, size, size);
    ctx.drawImage(img, sx, sy, minSide, minSide, 0, 0, size, size);
    localStorage.setItem('fc_av_' + userId, canvas.toDataURL('image/jpeg', 0.7));
    renderUsers();
    alert('✅ Аватар обновлён!');
  };
  img.onerror = function() { alert('❌ Не удалось загрузить изображение'); };
  img.src = dataUrl;
}

function resetAvatar(userId) {
  localStorage.removeItem('fc_av_' + userId);
  renderUsers();
  alert('✅ Аватар сброшен');
}
