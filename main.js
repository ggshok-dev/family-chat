// Добавить в initApp()
if ('serviceWorker' in navigator && 'PushManager' in window) {
  navigator.serviceWorker.register('/sw.js')
    .then(reg => {
      console.log('✅ SW зарегистрирован');
      askPushPermission(reg);
    });
}

async function askPushPermission(reg) {
  const permission = await Notification.requestPermission();
  if (permission === 'granted') {
    const subscription = await reg.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array('YOUR_VAPID_PUBLIC_KEY')
    });
    // Отправить subscription на ваш сервер или Firebase
  }
}

// VAPID helper (добавить в config.js)
function urlBase64ToUint8Array(base64String) { /* ... */ }
// Делаем функции ввода пин-кода видимыми для кнопок
window.enterDigit = enterDigit;
window.clearPin = clearPin;
window.checkPin = checkPin;
