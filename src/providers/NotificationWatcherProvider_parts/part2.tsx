      // 5. Bedtime Reminders
      const sleepLog = getStoredSleepLog(todayDateStr);
      if (sleepLog.enableBedtimeReminders && sleepLog.bedtimeReminders && sleepLog.bedtimeReminders.length > 0) {
        if (sleepLog.bedtimeReminders.includes(currentTimeStr)) {
          const cacheKey = `${todayDateStr}_bedtime_${currentTimeStr}`;
          if (!sentNotificationsRef.current.has(cacheKey)) {
            sentNotificationsRef.current.add(cacheKey);

            sendNativeNotification({
              title: "😴 Préparation au Sommeil",
              body: `C'est l'heure de te préparer pour ton coucher prévu à ${sleepLog.bedtime || "23:00"} !`,
              tag: `bedtime-${currentTimeStr}`,
            });
          }
        }
      }
    };

    // Run initial check and then every 20 seconds
    checkAndDispatchReminders();
    const interval = setInterval(checkAndDispatchReminders, 20000);

    return () => clearInterval(interval);
  }, []);

  return <>{children}</>;
}
