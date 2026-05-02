// ============ КОНФИГУРАЦИЯ FChat ============

// Firebase
const firebaseConfig = {
  apiKey: "AIzaSyAGqZPNEL2eihYYxr0ZJoE-Tedg1cO5cVo",
  authDomain: "fchat-d6879.firebaseapp.com",
  databaseURL: "https://fchat-d6879-default-rtdb.europe-west1.firebasedatabase.app",
  projectId: "fchat-d6879",
  storageBucket: "fchat-d6879.firebasestorage.app",
  messagingSenderId: "1049514912319",
  appId: "1:1049514912319:web:2ec9ca065eca5ac5da668a"
};

// Инициализация Firebase
if (!firebase.apps.length) firebase.initializeApp(firebaseConfig);
const db = firebase.database();
const auth = firebase.auth();

// ============ РОЛИ ПОЛЬЗОВАТЕЛЕЙ ============
const ROLES = {
  // Администраторы (создатели семьи)
  dad:      { id: 'dad',      name: 'Папа',       emoji: '👨',     level: 'admin' },
  mom:      { id: 'mom',      name: 'Мама',       emoji: '👩',     level: 'admin' },
  
  // Старшие родственники
  grandma:  { id: 'grandma',  name: 'Бабушка',    emoji: '👵',     level: 'elder' },
  grandpa:  { id: 'grandpa',  name: 'Дедушка',    emoji: '👴',     level: 'elder' },
  
  // Члены семьи (дети, братья, сёстры)
  son:      { id: 'son',      name: 'Сын',        emoji: '👦',     level: 'member' },
  daughter: { id: 'daughter', name: 'Дочь',       emoji: '👧',     level: 'member' },
  brother:  { id: 'brother',  name: 'Брат',       emoji: '👦',     level: 'member' },
  sister:   { id: 'sister',   name: 'Сестра',     emoji: '👧',     level: 'member' },
  
  // Дальние родственники
  aunt:     { id: 'aunt',     name: 'Тётя',       emoji: '👩‍🦰',   level: 'relative' },
  uncle:    { id: 'uncle',    name: 'Дядя',       emoji: '👨‍🦱',   level: 'relative' },
  nephew:   { id: 'nephew',   name: 'Племянник',  emoji: '🧒',     level: 'relative' },
  niece:    { id: 'niece',    name: 'Племянница', emoji: '👧',     level: 'relative' },
  
  // Друзья (только личные чаты)
  friend:   { id: 'friend',   name: 'Друг',       emoji: '🤝',     level: 'friend' },
  friend_f: { id: 'friend_f', name: 'Подруга',    emoji: '👭',     level: 'friend' }
};

// Уровни доступа
const ACCESS_LEVELS = {
  admin: {
    canSeeGeneralChat: true,
    canWriteGeneralChat: true,
    canSeePrivateChats: true,
    canInvite: true,
    canInviteRoles: ['admin', 'elder', 'member', 'relative', 'friend'],
    canRemoveMembers: true,
    canChangeInviteCode: true,
    canDeleteOtherMessages: true
  },
  elder: {
    canSeeGeneralChat: true,
    canWriteGeneralChat: true,
    canSeePrivateChats: true,
    canInvite: false,
    canInviteRoles: [],
    canRemoveMembers: false,
    canChangeInviteCode: false,
    canDeleteOtherMessages: false
  },
  member: {
    canSeeGeneralChat: true,
    canWriteGeneralChat: true,
    canSeePrivateChats: true,
    canInvite: true,
    canInviteRoles: ['friend'],
    canRemoveMembers: false,
    canChangeInviteCode: false,
    canDeleteOtherMessages: false
  },
  relative: {
    canSeeGeneralChat: true,
    canWriteGeneralChat: true,
    canSeePrivateChats: true,
    canInvite: false,
    canInviteRoles: [],
    canRemoveMembers: false,
    canChangeInviteCode: false,
    canDeleteOtherMessages: false
  },
  friend: {
    canSeeGeneralChat: false,
    canWriteGeneralChat: false,
    canSeePrivateChats: true,
    canInvite: false,
    canInviteRoles: [],
    canRemoveMembers: false,
    canChangeInviteCode: false,
    canDeleteOtherMessages: false
  }
};

// ============ ЭМОДЗИ ============
const EMOJI_LIST = [
  '😀','😂','🤣','😃','😄','😅','😆','😉','😊','😋','😎','😍','🥰','😘','😗','😙',
  '😚','🙂','🤗','🤩','🤔','🤨','😐','😑','😶','🙄','😏','😣','😥','😮','🤐','😯',
  '😪','😫','😴','😌','😛','😜','😝','🤤','😒','😓','😔','😕','🙃','🤑','😲','☹️',
  '🙁','😖','😞','😟','😤','😢','😭','😦','😧','😨','😩','🤯','😬','😰','😱','🥵',
  '🥶','😳','🤪','😵','😡','😠','🤬','😷','🤒','🤕','🤢','🤮','😇','🤠','🤡','🥳',
  '🥴','🥺','🤥','🤫','🤭','🧐','🤓','😈','👿','👹','👺','💀','👻','👽','🤖','💩',
  '❤️','🧡','💛','💚','💙','💜','🖤','🤍','🤎','💔','❣️','💕','💞','💓','💗','💖',
  '👍','👎','👏','🙌','🤝','💪','✌️','🤞','👌','🤏','✋','👋','🤚','🖐️','✍️','🙏',
  '👨‍👩‍👧‍👦','🏠','🎉','🎂','🍕','🍔','🌮','🍩','☕','🍰','🎄','🎁','🎈','⭐','🌟','🔥'
];

const AVATAR_EMOJIS = [
  '👨','👩','👦','👧','👴','👵','👨‍🦱','👩‍🦰','🤝','👭',
  '👨‍🦳','👩‍🦳','👶','👱','👲','👳','👷','👮','🕵️',
  '👩‍⚕️','👨‍🍳','👩‍🏫','👨‍💻','👩‍🎤','👨‍🚀','🧑','💁',
  '🙋','🤷','🤦','🙆','💆','🧖','🦸','🦹','🧙','🧚','🧛','🧜','🧝'
];

// ============ ТЕМЫ ============
const THEMES = [
  { id: 'light',       name: 'Liquid Glass', emoji: '🌊', class: '' },
  { id: 'dark-theme',  name: 'Dark Night',   emoji: '🌙', class: 'dark-theme' },
  { id: 'green-theme', name: 'Forest',       emoji: '🌿', class: 'green-theme' },
  { id: 'purple-theme',name: 'Royal Purple', emoji: '🍇', class: 'purple-theme' }
];

// ============ НАСТРОЙКИ ПО УМОЛЧАНИЮ ============
const DEFAULT_SETTINGS = {
  fontSize: 100,
  autoDeleteHours: 168,  // Было 24, стало 168 (7 дней)
  notifications: true,
  sound: true,
  theme: 'light'
};

// ============ ВСПОМОГАТЕЛЬНЫЕ ФУНКЦИИ ============

// Получить права для роли
function getPermissions(roleId) {
  const role = ROLES[roleId];
  if (!role) return ACCESS_LEVELS.friend; // По умолчанию — друг
  return ACCESS_LEVELS[role.level] || ACCESS_LEVELS.friend;
}

// Проверить, может ли пользователь приглашать
function canInvite(userRoleId) {
  const perms = getPermissions(userRoleId);
  return perms.canInvite;
}

// Проверить, может ли пользователь пригласить конкретную роль
function canInviteRole(inviterRoleId, targetRoleId) {
  const perms = getPermissions(inviterRoleId);
  return perms.canInviteRoles.includes(targetRoleId);
}

// Проверить, является ли пользователь админом
function isAdmin(roleId) {
  const role = ROLES[roleId];
  return role && role.level === 'admin';
}

// Сгенерировать код приглашения
function generateInviteCode(familyName) {
  const prefix = familyName.replace(/[^A-Z]/gi, '').substring(0, 4).toUpperCase() || 'FAM';
  const number = Math.floor(1000 + Math.random() * 9000);
  return prefix + '-' + number;
}

// Получить ID личного чата
function getPrivateChatId(user1, user2) {
  return [user1, user2].sort().join('_');
}

console.log('✅ config.js загружен');