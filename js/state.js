// Состояние приложения
let currentUser = null;
let activeTab = 'general';
let privateWith = null;
let autoDeleteHours = parseInt(localStorage.getItem('fc_autoDelete') || '24');
let notifEnabled = localStorage.getItem('fc_notif') !== 'false';
let soundEnabled = localStorage.getItem('fc_sound') !== 'false';
let secretCode = localStorage.getItem('fc_code') || 'family2024';
let fontSize = parseInt(localStorage.getItem('fc_font') || '100');
let isDarkTheme = localStorage.getItem('fc_theme') === 'dark';
let messageListener = null;
let mediaRecorder = null;
let audioChunks = [];
let processedIds = new Set();
let pendingPinUser = null;

if (!localStorage.getItem('fc_code')) {
  localStorage.setItem('fc_code', 'family2024');
}
