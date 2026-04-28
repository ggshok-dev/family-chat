// Авторизация и ПИН-коды
function getPin(userId) { 
  return localStorage.getItem('fc_pin_' + userId) || null; 
}

function setPin(userId, pin) { 
  localStorage.setItem('fc_pin_' + userId, pin); 
}

function hasPin(userId) { 
  return !!getPin(userId); 
}

function verifyPin(userId, pin) { 
  return getPin(userId) === pin; 
}

function showPinDialog(userId) {
  pendingPinUser = userId;
  const user = FAMILY[userId];
  document.getElementById('pinUserIcon').textContent = user.emoji;
  document.getElementById('pinUserName').textContent = user.name;
  
  if (hasPin(userId)) {
    document.getElementById('pinTitle').textContent = 'Введите ПИН-код';
    document.getElementById('pinDescription').innerHTML = 'Для входа как <strong>' + user.name + '</strong>';
    document.getElementById('pinHint').textContent = 'Введите ваш 4-значный ПИН';
  } else {
    document.getElementById('pinTitle').textContent = 'Создайте ПИН-код';
    document.getElementById('pinDescription').innerHTML = 'Придумайте ПИН для <strong>' + user.name + '</strong>';
    document.getElementById('pinHint').textContent = 'Придумайте 4 цифры и запомните их';
  }
  
  document.getElementById('pinInput').value = '';
  document.getElementById('pinError').classList.remove('show');
  document.getElementById('pinOverlay').style.display = 'flex';
  setTimeout(() => document.getElementById('pinInput').focus(), 100);
}

function hidePinDialog() {
  document.getElementById('pinOverlay').style.display = 'none';
  pendingPinUser = null;
}

function processPin() {
  const pin = document.getElementById('pinInput').value.trim();
  
  if (!pin || pin.length !== 4 || !/^\d{4}$/.test(pin)) {
    document.getElementById('pinError').textContent = 'ПИН должен состоять из 4 цифр';
    document.getElementById('pinError').classList.add('show');
    return;
  }
  
  if (hasPin(pendingPinUser)) {
    if (verifyPin(pendingPinUser, pin)) {
      loginAsUser(pendingPinUser);
      hidePinDialog();
    } else {
      document.getElementById('pinError').textContent = 'Неверный ПИН-код';
      document.getElementById('pinError').classList.add('show');
      document.getElementById('pinInput').value = '';
    }
  } else {
    setPin(pendingPinUser, pin);
    loginAsUser(pendingPinUser);
    hidePinDialog();
    alert('✅ ПИН-код создан!');
  }
}

function loginAsUser(userId) {
  currentUser = userId;
  localStorage.setItem('fc_user', userId);
  renderUsers();
  updatePrivate();
  loadMessages();
  updatePrivateHeader();
  console.log('✅ Вошёл как ' + FAMILY[userId].name);
}