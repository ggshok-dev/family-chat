// ============ СОЗДАНИЕ СЕМЬИ ============
async function createFamily(name) {
  try {
    // Проверяем, что пользователь — админ (Папа или Мама)
    if (!isAdmin(getUserRole())) {
      return { success: false, error: 'Только Папа или Мама могут создать семью' };
    }
    
    // Проверяем, не состоит ли уже в семье
    if (currentFamilyId) {
      return { success: false, error: 'Вы уже состоите в семье' };
    }
    
    // Создаём семью
    const familyRef = db.ref('families').push();
    const familyId = familyRef.key;
    const inviteCode = generateInviteCode(name);
    
    const familyData = {
      name: name,
      inviteCode: inviteCode,
      createdBy: currentUser,
      createdAt: firebase.database.ServerValue.TIMESTAMP,
      members: {
        [currentUser]: {
          role: currentUserData.role,
          joinedAt: firebase.database.ServerValue.TIMESTAMP
        }
      }
    };
    
    await familyRef.set(familyData);
    
    // Обновляем данные пользователя
    await db.ref('users/' + currentUser).update({
      familyId: familyId
    });
    
    // Обновляем локальные данные
    currentFamilyId = familyId;
    currentFamilyData = familyData;
    
    // ВОТ ЗДЕСЬ — после того, как currentFamilyId установлен
    await registerAIAssistant();
    
    return { 
      success: true, 
      familyId: familyId, 
      inviteCode: inviteCode 
    };
  } catch (error) {
    console.error('Ошибка создания семьи:', error);
    return { success: false, error: error.message };
  }
}

// ============ ПРИСОЕДИНЕНИЕ К СЕМЬЕ ============
async function joinFamily(inviteCode) {
  try {
    // Проверяем, не состоит ли уже в семье
    if (currentFamilyId) {
      return { success: false, error: 'Вы уже состоите в семье. Сначала покиньте текущую.' };
    }
    
    // Ищем семью по коду приглашения
    const familiesSnap = await db.ref('families')
      .orderByChild('inviteCode')
      .equalTo(inviteCode)
      .once('value');
    
    const families = familiesSnap.val();
    
    if (!families) {
      return { success: false, error: 'Семья с таким кодом не найдена' };
    }
    
    // Берём первую найденную семью
    const familyId = Object.keys(families)[0];
    const familyData = families[familyId];
    
    // Проверяем, не превышен ли лимит участников (опционально)
    // if (Object.keys(familyData.members).length >= 50) {
    //   return { success: false, error: 'Семья заполнена (максимум 50 участников)' };
    // }
    
    // Добавляем пользователя в семью
    await db.ref('families/' + familyId + '/members/' + currentUser).set({
      role: currentUserData.role,
      joinedAt: firebase.database.ServerValue.TIMESTAMP
    });
    
    // Обновляем данные пользователя
    await db.ref('users/' + currentUser).update({
      familyId: familyId
    });
    
    // Обновляем локальные данные
    currentFamilyId = familyId;
    currentFamilyData = familyData;
    currentFamilyData.members[currentUser] = {
      role: currentUserData.role,
      joinedAt: Date.now()
    };
    
    return { success: true, familyName: familyData.name };
  } catch (error) {
    console.error('Ошибка присоединения:', error);
    return { success: false, error: error.message };
  }
}

// ============ ПРИГЛАШЕНИЕ ПОЛЬЗОВАТЕЛЯ ============
async function inviteUser(email, targetRoleId) {
  try {
    // Проверяем права
    if (!hasPermission('canInvite')) {
      return { success: false, error: 'У вас нет прав приглашать пользователей' };
    }
    
    // Проверяем, можно ли пригласить эту роль
    const userRole = getUserRole();
    if (!canInviteRole(userRole, targetRoleId)) {
      return { success: false, error: 'Вы не можете пригласить пользователя с ролью ' + ROLES[targetRoleId]?.name };
    }
    
    // Проверяем, не состоит ли уже в семье
    const userSnap = await db.ref('users')
      .orderByChild('email')
      .equalTo(email)
      .once('value');
    
    const users = userSnap.val();
    
    if (users) {
      const userId = Object.keys(users)[0];
      const userData = users[userId];
      
      if (userData.familyId) {
        return { success: false, error: 'Этот пользователь уже состоит в семье' };
      }
      
      // Отправляем приглашение
      await db.ref('invitations/' + currentFamilyId + '/' + userId).set({
        from: currentUser,
        fromName: currentUserData.name,
        role: targetRoleId,
        sentAt: firebase.database.ServerValue.TIMESTAMP,
        status: 'pending'
      });
      
      return { success: true, message: 'Приглашение отправлено' };
    } else {
      // Пользователь не зарегистрирован — отправляем email (в будущем)
      return { success: false, error: 'Пользователь не зарегистрирован. Попросите его зарегистрироваться.' };
    }
  } catch (error) {
    console.error('Ошибка приглашения:', error);
    return { success: false, error: error.message };
  }
}

// ============ ПРИНЯТЬ ПРИГЛАШЕНИЕ ============
async function acceptInvitation(familyId) {
  try {
    const invitationSnap = await db.ref('invitations/' + familyId + '/' + currentUser).once('value');
    const invitation = invitationSnap.val();
    
    if (!invitation) {
      return { success: false, error: 'Приглашение не найдено' };
    }
    
    // Добавляем в семью
    await db.ref('families/' + familyId + '/members/' + currentUser).set({
      role: invitation.role,
      joinedAt: firebase.database.ServerValue.TIMESTAMP
    });
    
    // Обновляем пользователя
    await db.ref('users/' + currentUser).update({
      familyId: familyId
    });
    
    // Удаляем приглашение
    await db.ref('invitations/' + familyId + '/' + currentUser).remove();
    
    // Обновляем локальные данные
    currentFamilyId = familyId;
    const familySnap = await db.ref('families/' + familyId).once('value');
    currentFamilyData = familySnap.val();
    
    return { success: true };
  } catch (error) {
    console.error('Ошибка принятия приглашения:', error);
    return { success: false, error: error.message };
  }
}

// ============ УДАЛЕНИЕ УЧАСТНИКА ============
async function removeMember(userId) {
  try {
    if (!hasPermission('canRemoveMembers')) {
      return { success: false, error: 'Только администратор может удалять участников' };
    }
    
    // Нельзя удалить себя
    if (userId === currentUser) {
      return { success: false, error: 'Нельзя удалить самого себя' };
    }
    
    // Удаляем из семьи
    await db.ref('families/' + currentFamilyId + '/members/' + userId).remove();
    
    // Удаляем familyId у пользователя
    await db.ref('users/' + userId + '/familyId').remove();
    
    return { success: true };
  } catch (error) {
    console.error('Ошибка удаления:', error);
    return { success: false, error: error.message };
  }
}

// ============ ПОКИНУТЬ СЕМЬЮ ============
async function leaveFamily() {
  try {
    if (!currentFamilyId) {
      return { success: false, error: 'Вы не состоите в семье' };
    }
    
    // Админ не может просто так уйти
    if (isAdmin(getUserRole())) {
      const members = currentFamilyData?.members || {};
      const adminCount = Object.values(members).filter(function(m) {
        return m.role === 'dad' || m.role === 'mom';
      }).length;
      
      if (adminCount <= 1) {
        return { success: false, error: 'Вы единственный администратор. Сначала назначьте другого админа или удалите семью.' };
      }
    }
    
    // Удаляем из семьи
    await db.ref('families/' + currentFamilyId + '/members/' + currentUser).remove();
    
    // Удаляем familyId у пользователя
    await db.ref('users/' + currentUser + '/familyId').remove();
    
    // Очищаем локальные данные
    currentFamilyId = null;
    currentFamilyData = null;
    
    return { success: true };
  } catch (error) {
    console.error('Ошибка выхода из семьи:', error);
    return { success: false, error: error.message };
  }
}

// ============ СМЕНА КОДА ПРИГЛАШЕНИЯ ============
async function changeInviteCode() {
  try {
    if (!hasPermission('canChangeInviteCode')) {
      return { success: false, error: 'Только администратор может менять код приглашения' };
    }
    
    const newCode = generateInviteCode(currentFamilyData.name);
    await db.ref('families/' + currentFamilyId + '/inviteCode').set(newCode);
    currentFamilyData.inviteCode = newCode;
    
    return { success: true, inviteCode: newCode };
  } catch (error) {
    console.error('Ошибка смены кода:', error);
    return { success: false, error: error.message };
  }
}

// ============ ЗАГРУЗКА УЧАСТНИКОВ СЕМЬИ ============
async function loadFamilyMembers() {
  if (!currentFamilyId) return [];
  
  const membersSnap = await db.ref('families/' + currentFamilyId + '/members').once('value');
  const members = membersSnap.val() || {};
  
  // Загружаем данные каждого участника
  const memberIds = Object.keys(members);
  const usersSnap = await db.ref('users').once('value');
  const allUsers = usersSnap.val() || {};
  
  return memberIds.map(function(id) {
    const user = allUsers[id] || {};
    return {
      id: id,
      name: user.name || 'Пользователь',
      emoji: user.emoji || '👤',
      role: members[id].role,
      roleData: ROLES[members[id].role],
      isOnline: id === currentUser // В будущем — настоящий онлайн
    };
  });
}

// ============ ПОЛУЧИТЬ КОД ПРИГЛАШЕНИЯ ============
function getInviteCode() {
  return currentFamilyData?.inviteCode || null;
}

// ============ ПРОВЕРИТЬ, СОСТОИТ ЛИ В СЕМЬЕ ============
function isInFamily() {
  return !!currentFamilyId;
}

// ============ ПОЛУЧИТЬ НАЗВАНИЕ СЕМЬИ ============
function getFamilyName() {
  return currentFamilyData?.name || 'Без семьи';
}

console.log('✅ family.js загружен');
