// =========================================================
// register-pwa.js — Enregistrement Service Worker &
// Notice d'installation de l'application PWA (Ouèssè)
// =========================================================

// 1) Enregistrement du Service Worker
if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker
      .register("/sw.js")
      .catch((erreur) => console.warn("Échec d'enregistrement du service worker :", erreur));
  });
}

// 2) Détection du mode d'installation
function estAppInstallee() {
  return (
    window.matchMedia("(display-mode: standalone)").matches ||
    window.navigator.standalone === true ||
    document.referrer.includes("android-app://")
  );
}

let evenementInstallation = null;
let banniereElement = null;

// Masquer la bannière (utilisé notamment quand une réunion vidéo démarre)
window.masquerBannierePWA = function () {
  if (banniereElement) {
    banniereElement.style.display = "none";
  }
};

// 3) Création et affichage de la notice / bannière d'installation PWA
function injecterStylesBanniere() {
  if (document.getElementById("pwa-banner-styles")) return;

  const style = document.createElement("style");
  style.id = "pwa-banner-styles";
  style.textContent = `
    .pwa-notice-toast {
      position: fixed;
      bottom: 20px;
      left: 50%;
      transform: translateX(-50%) translateY(120%);
      width: calc(100% - 32px);
      max-width: 460px;
      background: #ffffff;
      border-radius: 14px;
      box-shadow: 0 12px 35px rgba(0, 0, 0, 0.18), 0 2px 8px rgba(11, 107, 68, 0.12);
      border: 1px solid rgba(11, 107, 68, 0.18);
      padding: 12px 16px;
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 12px;
      z-index: 99999;
      font-family: 'Poppins', -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
      transition: transform 0.4s cubic-bezier(0.175, 0.885, 0.32, 1.275), opacity 0.3s ease;
      opacity: 0;
    }
    .pwa-notice-toast.active {
      transform: translateX(-50%) translateY(0);
      opacity: 1;
    }
    .pwa-notice-gauche {
      display: flex;
      align-items: center;
      gap: 12px;
      min-width: 0;
    }
    .pwa-notice-logo {
      width: 44px;
      height: 44px;
      border-radius: 10px;
      background: #0b6b44;
      display: flex;
      align-items: center;
      justify-content: center;
      flex-shrink: 0;
      overflow: hidden;
      box-shadow: 0 2px 6px rgba(11, 107, 68, 0.25);
    }
    .pwa-notice-logo img {
      width: 100%;
      height: 100%;
      object-fit: cover;
    }
    .pwa-notice-textes {
      display: flex;
      flex-direction: column;
      line-height: 1.3;
      min-width: 0;
    }
    .pwa-notice-titre {
      font-size: 0.88rem;
      font-weight: 700;
      color: #0b6b44;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }
    .pwa-notice-desc {
      font-size: 0.75rem;
      color: #555555;
      margin-top: 2px;
    }
    .pwa-notice-actions {
      display: flex;
      align-items: center;
      gap: 6px;
      flex-shrink: 0;
    }
    .pwa-btn-installer {
      background: linear-gradient(135deg, #0b6b44 0%, #07472c 100%);
      color: #ffffff;
      border: none;
      border-radius: 8px;
      padding: 8px 12px;
      font-size: 0.8rem;
      font-weight: 600;
      cursor: pointer;
      display: flex;
      align-items: center;
      gap: 5px;
      text-decoration: none;
      transition: transform 0.15s, opacity 0.2s;
      white-space: nowrap;
    }
    .pwa-btn-installer:hover {
      opacity: 0.95;
      transform: scale(1.02);
    }
    .pwa-btn-fermer {
      background: transparent;
      border: none;
      color: #888888;
      font-size: 1.1rem;
      width: 28px;
      height: 28px;
      border-radius: 50%;
      cursor: pointer;
      display: flex;
      align-items: center;
      justify-content: center;
      transition: background 0.2s, color 0.2s;
    }
    .pwa-btn-fermer:hover {
      background: #f0f0f0;
      color: #222222;
    }
    @media (max-width: 480px) {
      .pwa-notice-toast {
        bottom: 12px;
        padding: 10px 12px;
        gap: 8px;
      }
      .pwa-notice-logo {
        width: 38px;
        height: 38px;
      }
      .pwa-notice-titre {
        font-size: 0.82rem;
      }
      .pwa-notice-desc {
        display: none;
      }
      .pwa-btn-installer {
        padding: 7px 10px;
        font-size: 0.76rem;
      }
    }
  `;
  document.head.appendChild(style);
}

function afficherNoticePWA() {
  if (estAppInstallee()) return;
  if (sessionStorage.getItem("ouesse_pwa_notice_fermee") === "1") return;
  if (document.getElementById("pwa-notice-toast")) return;

  injecterStylesBanniere();

  banniereElement = document.createElement("div");
  banniereElement.id = "pwa-notice-toast";
  banniereElement.className = "pwa-notice-toast";
  banniereElement.setAttribute("role", "dialog");
  banniereElement.setAttribute("aria-label", "Installer l'application Ouèssè");

  banniereElement.innerHTML = `
    <div class="pwa-notice-gauche">
      <div class="pwa-notice-logo">
        <img src="https://res.cloudinary.com/nyke7lhc/image/upload/v1784319943/logo_copie_kzzyfd.webp" alt="Logo Ouèssè" width="44" height="44" />
      </div>
      <div class="pwa-notice-textes">
        <span class="pwa-notice-titre">Installer l'application Ouèssè</span>
        <span class="pwa-notice-desc">Accès rapide aux réunions et actualités</span>
      </div>
    </div>
    <div class="pwa-notice-actions">
      <button type="button" id="pwa-notice-btn-install" class="pwa-btn-installer">
        📲 Installer
      </button>
      <button type="button" id="pwa-notice-btn-close" class="pwa-btn-fermer" title="Fermer">✕</button>
    </div>
  `;

  document.body.appendChild(banniereElement);

  // Animation d'apparition douce après 1.5 seconde
  setTimeout(() => {
    if (banniereElement) banniereElement.classList.add("active");
  }, 1200);

  // Clic sur Installer
  const btnInstaller = document.getElementById("pwa-notice-btn-install");
  if (btnInstaller) {
    btnInstaller.addEventListener("click", async () => {
      if (evenementInstallation) {
        evenementInstallation.prompt();
        const resultat = await evenementInstallation.userChoice;
        if (resultat && resultat.outcome === "accepted") {
          fermerNoticePWA();
        }
        evenementInstallation = null;
      } else {
        // Sur iOS Safari ou navigateurs sans support direct de beforeinstallprompt
        window.location.href = "/telecharger.html";
      }
    });
  }

  // Clic sur Fermer
  const btnFermer = document.getElementById("pwa-notice-btn-close");
  if (btnFermer) {
    btnFermer.addEventListener("click", fermerNoticePWA);
  }
}

function fermerNoticePWA() {
  if (!banniereElement) return;
  banniereElement.classList.remove("active");
  sessionStorage.setItem("ouesse_pwa_notice_fermee", "1");
  setTimeout(() => {
    if (banniereElement && banniereElement.parentNode) {
      banniereElement.parentNode.removeChild(banniereElement);
      banniereElement = null;
    }
  }, 400);
}

// 4) Événement d'installation natif
window.addEventListener("beforeinstallprompt", (event) => {
  event.preventDefault();
  evenementInstallation = event;

  // Bouton personnalisé sur telecharger.html s'il existe
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

  // Afficher la notice générale
  afficherNoticePWA();
});

// Déclenchement automatique même si beforeinstallprompt tarde ou sur iOS
document.addEventListener("DOMContentLoaded", () => {
  // Petit délai pour laisser la page se stabiliser
  setTimeout(() => {
    if (!estAppInstallee()) {
      afficherNoticePWA();
    }
  }, 2000);
});

window.addEventListener("appinstalled", () => {
  fermerNoticePWA();
  const boutonInstaller = document.getElementById("bouton-installer-app");
  if (boutonInstaller) boutonInstaller.hidden = true;
});
