export const requestNotificationPermission = async () => {
  if (!("Notification" in window)) return false;
  if (Notification.permission !== "default") {
    return Notification.permission === "granted";
  }
  const permission = await Notification.requestPermission();
  return permission === "granted";
};

export const sendNotification = (title: string, body: string) => {
  if (!("Notification" in window) || Notification.permission !== "granted") return;
  
  new Notification(title, {
    body,
    icon: "/favicon.svg", // Fallback icon
  });
};

export const scheduleReminder = (title: string, body: string, timeStr: string) => {
  // Try to parse HH:MM or H:MM AM/PM
  let hours = 0;
  let minutes = 0;

  try {
    const timeMatch = timeStr.match(/(\d+):(\d+)\s*(AM|PM)?/i);
    if (!timeMatch) return;

    hours = parseInt(timeMatch[1], 10);
    minutes = parseInt(timeMatch[2], 10);
    const ampm = timeMatch[3]?.toUpperCase();

    if (ampm === 'PM' && hours < 12) hours += 12;
    if (ampm === 'AM' && hours === 12) hours = 0;
  } catch (e) {
    console.error('Failed to parse time:', timeStr);
    return;
  }
  
  const check = () => {
    const now = new Date();
    if (now.getHours() === hours && now.getMinutes() === minutes) {
      sendNotification(title, body);
    }
  };

  // Run check every minute
  setInterval(check, 60000);
};
