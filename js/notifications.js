// =========================================================
// notifications.js — Gestionnaire OneSignal Notifications Push
// =========================================================

window.OneSignalDeferred = window.OneSignalDeferred || [];

OneSignalDeferred.push(async function (OneSignal) {
  try {
    // Vérifier le statut d'abonnement actuel
    const dejaAbonne = OneSignal.User?.PushSubscription?.optedIn;

    // Si le visiteur n'est pas encore abonné, lui proposer l'abonnement
    if (!dejaAbonne) {
      setTimeout(async () => {
        try {
          if (OneSignal.Slidedown) {
            await OneSignal.Slidedown.promptPush();
          }
        } catch (e) {
          console.warn("Notice push OneSignal:", e);
        }
      }, 1500);
    }

    // Gestion du bouton manuel (ex: sur telecharger.html)
    const bouton = document.getElementById("bouton-activer-notifications");
    const messageActif = document.getElementById("message-notifications-actives");
    if (bouton) {
      if (dejaAbonne) {
        bouton.hidden = true;
        if (messageActif) messageActif.hidden = false;
      }

      bouton.addEventListener("click", async () => {
        await OneSignal.Notifications.requestPermission();
        if (OneSignal.User?.PushSubscription?.optedIn) {
          bouton.hidden = true;
          if (messageActif) messageActif.hidden = false;
        }
      });
    }
  } catch (err) {
    console.warn("Erreur OneSignal:", err);
  }
});
