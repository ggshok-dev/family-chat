// Уведомления и звуки
function notify(title, body) {
  if (!notifEnabled) return;
  
  if (document.visibilityState === 'visible') { 
    playSound(); 
    return; 
  }
  
  if ('Notification' in window && Notification.permission === 'granted') {
    new Notification(title, {body: body, icon: '👨‍👩‍👧‍👦', tag: 'fc'});
  }
  
  playSound();
}

function playSound() {
  if (!soundEnabled) return;
  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain); 
    gain.connect(ctx.destination);
    osc.frequency.value = 800; 
    gain.gain.value = 0.1;
    osc.start(); 
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.3);
    osc.stop(ctx.currentTime + 0.3);
  } catch(e) {}
}

function requestNotif() {
  if ('Notification' in window && Notification.permission === 'default') {
    Notification.requestPermission();
  }
}
