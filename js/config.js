// Конфигурация Firebase и константы
const firebaseConfig = {
  apiKey: "AIzaSyAGqZPNEL2eihYYxr0ZJoE-Tedg1cO5cVo",
  authDomain: "fchat-d6879.firebaseapp.com",
  databaseURL: "https://fchat-d6879-default-rtdb.europe-west1.firebasedatabase.app",
  projectId: "fchat-d6879",
  storageBucket: "fchat-d6879.firebasestorage.app",
  messagingSenderId: "1049514912319",
  appId: "1:1049514912319:web:2ec9ca065eca5ac5da668a"
};

firebase.initializeApp(firebaseConfig);
const db = firebase.database();

// Семья
const FAMILY = {
  dad: { id: 'dad', name: 'Папа', emoji: '👨', color: '#4A90E2' },
  mom: { id: 'mom', name: 'Мама', emoji: '👩', color: '#E91E63' },
  sergey: { id: 'sergey', name: 'Сергей', emoji: '👦', color: '#4CAF50' },
  sveta: { id: 'sveta', name: 'Света', emoji: '👧', color: '#FF9800' },
  katya: { id: 'katya', name: 'Катя', emoji: '👧', color: '#9C27B0' }
};

// Эмодзи
const EMOJI_LIST = ['😀','😂','🤣','😃','😄','😅','😆','😉','😊','😋','😎','😍','🥰','😘','😗','😙','😚','🙂','🤗','🤩','🤔','🤨','😐','😑','😶','🙄','😏','😣','😥','😮','🤐','😯','😪','😫','😴','😌','😛','😜','😝','🤤','😒','😓','😔','😕','🙃','🤑','😲','☹️','🙁','😖','😞','😟','😤','😢','😭','😦','😧','😨','😩','🤯','😬','😰','😱','🥵','🥶','😳','🤪','😵','😡','😠','🤬','😷','🤒','🤕','🤢','🤮','😇','🤠','🤡','🥳','🥴','🥺','🤥','🤫','🤭','🧐','🤓','😈','👿','👹','👺','💀','👻','👽','🤖','💩','❤️','🧡','💛','💚','💙','💜','🖤','🤍','🤎','💔','❣️','💕','💞','💓','💗','💖','👍','👎','👏','🙌','🤝','💪','✌️','🤞','👌','🤏','✋','👋','🤚','🖐️','✍️','🙏','👨‍👩‍👧‍👦','🏠','🎉','🎂','🍕','🍔','🌮','🍩','☕','🍰','🎄','🎁','🎈','⭐','🌟','🔥'];