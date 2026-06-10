export const requestNotificationPermission = async (): Promise<boolean> => {
  if (!('Notification' in window)) {
    console.log('This browser does not support notifications');
    return false;
  }

  if (Notification.permission === 'granted') {
    return true;
  }

  if (Notification.permission !== 'denied') {
    const permission = await Notification.requestPermission();
    return permission === 'granted';
  }

  return false;
};

export const showVictoryNotification = (levelName: string): void => {
  if (Notification.permission !== 'granted') return;

  try {
    new Notification('🎉 关卡通关！', {
      body: `恭喜你通过了「${levelName}」！`,
      icon: '/favicon.svg',
      badge: '/favicon.svg',
      tag: 'victory',
    });
  } catch (error) {
    console.error('Failed to show notification:', error);
  }
};

export const showDefeatNotification = (levelName: string): void => {
  if (Notification.permission !== 'granted') return;

  try {
    new Notification('💀 战斗失败', {
      body: `在「${levelName}」中战败了，再接再厉！`,
      icon: '/favicon.svg',
      badge: '/favicon.svg',
      tag: 'defeat',
    });
  } catch (error) {
    console.error('Failed to show notification:', error);
  }
};
