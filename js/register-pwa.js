if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker
      .register("/sw.js")
      .catch((erreur) => console.warn("Échec d'enregistrement du service worker :", erreur));
  });
}

let evenementInstallation = null;

window.addEventListener("beforeinstallprompt", (event) => {
  event.preventDefault();
  evenementInstallation = event;

  const boutonInstaller = document.getElementById("bouton-installer-app");
  if (boutonInstaller) {
    boutonInstaller.hidden = false;
    boutonInstaller.addEventListener("click", async () => {
      boutonInstaller.hidden = true;
      evenementInstallation.prompt();
      await evenementInstallation.userChoice;
      evenementInstallation = null;
    });
  }
});

window.addEventListener("appinstalled", () => {
  const boutonInstaller = document.getElementById("bouton-installer-app");
  if (boutonInstaller) boutonInstaller.hidden = true;
});
