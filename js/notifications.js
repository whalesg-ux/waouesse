window.OneSignalDeferred = window.OneSignalDeferred || [];

document.addEventListener("DOMContentLoaded", () => {
  const bouton = document.getElementById("bouton-activer-notifications");
  const messageActif = document.getElementById("message-notifications-actives");
  if (!bouton) return;

  OneSignalDeferred.push(async function (OneSignal) {
    const dejaAbonne = OneSignal.User.PushSubscription.optedIn;
    if (dejaAbonne) {
      bouton.hidden = true;
      if (messageActif) messageActif.hidden = false;
    }

    bouton.addEventListener("click", async () => {
      await OneSignal.Notifications.requestPermission();
      const abonneMaintenant = OneSignal.User.PushSubscription.optedIn;
      if (abonneMaintenant) {
        bouton.hidden = true;
        if (messageActif) messageActif.hidden = false;
      }
    });
  });
});
