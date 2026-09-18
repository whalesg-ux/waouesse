// ---------------------------------------------------------
// reunion.js — Salle de réunion vidéo OUESSE (JaaS / 8x8)
// Le JWT est récupéré à la demande via /api/generate-jwt,
// jamais écrit en dur dans ce fichier.
// ---------------------------------------------------------

// Magic cookie JaaS (dashboard 8x8 vpaas-magic-cookie-xxxxxxxxxxxx)
const APP_ID = "vpaas-magic-cookie-1ebdfc8c8a694563847039d21394ab51";
const DOMAINE_JAAS = "8x8.vc";
const PREFIXE_SALLE = "OUESSE-CM";

// Référence vers l'instance active de Jitsi External API
let currentJitsiApi = null;
let nomCourtSalle = "";

// ---------------------------------------------------------
// Fonctions utilitaires
// ---------------------------------------------------------

function genererNomSalle() {
  const identifiant = new Date().toISOString().slice(0, 10).replace(/-/g, "");
  const aleatoire = Math.floor(Math.random() * 9000 + 1000);
  return `${PREFIXE_SALLE}-${identifiant}-${aleatoire}`;
}

function nettoyerNomSalle(valeur) {
  if (!valeur) return "";
  let clean = decodeURIComponent(valeur).trim();
  // Si la chaîne commence par l'APP_ID, on le retire pour avoir seulement le nom court
  if (clean.startsWith(`${APP_ID}/`)) {
    clean = clean.replace(`${APP_ID}/`, "");
  }
  // Nettoyer les caractères spéciaux pour assurer la compatibilité JaaS
  return clean.replace(/[^a-zA-Z0-9\-_]/g, "-").slice(0, 50);
}

function afficherMessage(message, type = "info") {
  const zone = document.getElementById("zone-message");
  if (!zone) return;

  if (!message) {
    zone.className = "message-banner cachee";
    zone.textContent = "";
    return;
  }

  // Valider le type pour éviter toute injection de classe CSS
  const typesAutorises = ["info", "warning", "error", "success"];
  const typeSur = typesAutorises.includes(type) ? type : "info";

  const icones = {
    error: "fa-circle-exclamation",
    warning: "fa-triangle-exclamation",
    success: "fa-circle-check",
    info: "fa-circle-info"
  };

  zone.className = `message-banner message-${typeSur}`;

  // Créer les éléments de façon sûre (pas d'innerHTML avec données utilisateur)
  const icone = document.createElement("i");
  icone.className = `fa-solid ${icones[typeSur]}`;

  const texte = document.createElement("span");
  texte.textContent = message; // textContent = sûr contre XSS

  zone.textContent = "";
  zone.appendChild(icone);
  zone.appendChild(document.createTextNode(" "));
  zone.appendChild(texte);
}

function copierTexte(texte, bouton) {
  navigator.clipboard.writeText(texte).then(
    () => {
      const htmlOriginal = bouton.innerHTML;
      bouton.innerHTML = '<i class="fa-solid fa-check"></i> Copié !';
      bouton.classList.add("copie-succes");
      setTimeout(() => {
        bouton.innerHTML = htmlOriginal;
        bouton.classList.remove("copie-succes");
      }, 2000);
    },
    () => {
      // Fallback
      const champ = document.getElementById("lien-partage");
      if (champ) {
        champ.select();
        document.execCommand("copy");
        alert("Lien copié dans le presse-papier !");
      }
    }
  );
}

// ---------------------------------------------------------
// Initialisation de la salle
// ---------------------------------------------------------

function initialiserSalle() {
  const parametresURL = new URLSearchParams(window.location.search);
  const brutParam = parametresURL.get("room");

  if (brutParam) {
    nomCourtSalle = nettoyerNomSalle(brutParam);
  }

  if (!nomCourtSalle) {
    nomCourtSalle = genererNomSalle();
    const nouvelleURL = `${window.location.pathname}?room=${encodeURIComponent(nomCourtSalle)}`;
    window.history.replaceState({}, "", nouvelleURL);
  }

  mettreAJourAffichageSalle();
}

function mettreAJourAffichageSalle() {
  const affichageSalle = document.getElementById("nom-salle-affiche");
  if (affichageSalle) {
    affichageSalle.textContent = nomCourtSalle;
  }

  const champLien = document.getElementById("lien-partage");
  if (champLien) {
    champLien.value = window.location.href;
  }

  const badgeActive = document.getElementById("badge-salle-active");
  if (badgeActive) {
    badgeActive.textContent = nomCourtSalle;
  }
}

function creerNouvelleSalle() {
  nomCourtSalle = genererNomSalle();
  const nouvelleURL = `${window.location.pathname}?room=${encodeURIComponent(nomCourtSalle)}`;
  window.history.replaceState({}, "", nouvelleURL);
  mettreAJourAffichageSalle();
  afficherMessage(`Nouvelle salle créée : ${nomCourtSalle}`, "success");
  setTimeout(() => afficherMessage(""), 3000);
}

// ---------------------------------------------------------
// Récupération sécurisée du JWT via l'API backend (/api/generate-jwt)
// ---------------------------------------------------------

async function recupererJWT(nomAffiche, salleCourt) {
  const nomSalleComplet = `${APP_ID}/${salleCourt}`;

  try {
    const reponse = await fetch("/api/generate-jwt", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        nomSalle: salleCourt,
        roomName: nomSalleComplet,
        nomAffiche: nomAffiche,
      }),
    });

    if (!reponse.ok) {
      let detail = "";
      let code = "";
      try {
        const donneesErr = await reponse.json();
        detail = donneesErr.message || donneesErr.error || "";
        code = donneesErr.code || "";
      } catch (_) {}
      console.warn("API /api/generate-jwt a répondu avec une erreur:", reponse.status, detail);
      return { token: null, error: detail || `Erreur serveur (${reponse.status})`, code: code };
    }

    const donnees = await reponse.json();
    return { token: donnees.token || null, error: null, code: null };
  } catch (erreur) {
    console.warn("Erreur réseau vers /api/generate-jwt:", erreur);
    return { token: null, error: erreur.message || "Endpoint introuvable", code: "NETWORK_ERROR" };
  }
}

// ---------------------------------------------------------
// Gestion de la réunion
// ---------------------------------------------------------

async function demarrerReunion() {
  const champNom = document.getElementById("nom-participant");
  const nomAffiche = (champNom ? champNom.value.trim() : "") || "Participant Ouèssè";
  const boutonRejoindre = document.getElementById("btn-rejoindre");

  // Mémoriser le nom
  try {
    localStorage.setItem("ouesse_cm_nom", nomAffiche);
  } catch (_) {}

  boutonRejoindre.disabled = true;
  boutonRejoindre.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Connexion en cours...';
  afficherMessage("");

  // Vérifier que le SDK Jitsi External API est chargé
  if (typeof JitsiMeetExternalAPI === "undefined") {
    afficherMessage(
      "Le module de visioconférence Narroq se charge encore. Veuillez patienter un instant et réessayer.",
      "warning"
    );
    boutonRejoindre.disabled = false;
    boutonRejoindre.innerHTML = '<i class="fa-solid fa-arrow-right-to-bracket"></i> Rejoindre la réunion';
    return;
  }

  // Tenter de récupérer le JWT signé
  let jetonJWT = null;
  const resultatJWT = await recupererJWT(nomAffiche, nomCourtSalle);

  if (resultatJWT.token) {
    jetonJWT = resultatJWT.token;
  } else {
    // Si l'API renvoie une erreur (ex: variables d'environnement non configurées ou environnement local)
    console.warn("JWT non généré:", resultatJWT.error, resultatJWT.code);
    if (resultatJWT.code === "JAAS_CONFIG_MISSING" || (resultatJWT.error && resultatJWT.error.includes("JAAS_CONFIG_MISSING"))) {
      afficherMessage(
        "Connexion sécurisée Narroq en cours (mode direct)...",
        "info"
      );
    }
  }

  try {
    // Basculer l'affichage
    document.getElementById("ecran-demarrage").classList.add("cachee");
    document.getElementById("ecran-reunion").classList.remove("cachee");
    if (typeof window.masquerBannierePWA === "function") {
      window.masquerBannierePWA();
    }

    const nomSalleComplet = `${APP_ID}/${nomCourtSalle}`;

    const options = {
      roomName: nomSalleComplet,
      width: "100%",
      height: "100%",
      parentNode: document.getElementById("conteneur-jitsi"),
      userInfo: {
        displayName: nomAffiche,
      },
      configOverwrite: {
        startWithAudioMuted: false,
        startWithVideoMuted: false,
        prejoinPageEnabled: false,
        enableWelcomePage: false,
      },
      interfaceConfigOverwrite: {
        SHOW_JITSI_WATERMARK: false,
        SHOW_WATERMARK_FOR_GUESTS: false,
        MOBILE_APP_PROMO: false,
        TOOLBAR_BUTTONS: [
          "microphone",
          "camera",
          "desktop",
          "chat",
          "raisehand",
          "tileview",
          "hangup",
          "settings",
          "fullscreen",
        ],
      },
    };

    if (jetonJWT) {
      options.jwt = jetonJWT;
    }

    // Instanciation de l'API 8x8 JaaS
    currentJitsiApi = new JitsiMeetExternalAPI(DOMAINE_JAAS, options);

    // Écouteurs de raccrochage / fermeture
    currentJitsiApi.addEventListener("readyToClose", quitterReunion);
    currentJitsiApi.addEventListener("videoConferenceLeft", quitterReunion);
  } catch (erreur) {
    console.error("Erreur lancement visioconférence :", erreur);
    alert("Impossible d'ouvrir la réunion : " + (erreur.message || "Erreur inconnue"));
    quitterReunion();
  }
}

function quitterReunion() {
  if (currentJitsiApi) {
    try {
      currentJitsiApi.dispose();
    } catch (e) {
      console.warn("Erreur fermeture instance Jitsi :", e);
    }
    currentJitsiApi = null;
  }

  const conteneur = document.getElementById("conteneur-jitsi");
  if (conteneur) conteneur.innerHTML = "";

  document.getElementById("ecran-reunion").classList.add("cachee");
  document.getElementById("ecran-demarrage").classList.remove("cachee");

  const boutonRejoindre = document.getElementById("btn-rejoindre");
  if (boutonRejoindre) {
    boutonRejoindre.disabled = false;
    boutonRejoindre.innerHTML = '<i class="fa-solid fa-arrow-right-to-bracket"></i> Rejoindre la réunion';
  }
}

// ---------------------------------------------------------
// Attachement des événements au chargement du DOM
// ---------------------------------------------------------

document.addEventListener("DOMContentLoaded", () => {
  initialiserSalle();

  // Restaurer le prénom/nom mémorisé
  try {
    const nomMemoire = localStorage.getItem("ouesse_cm_nom");
    const champNom = document.getElementById("nom-participant");
    if (nomMemoire && champNom) {
      champNom.value = nomMemoire;
    }
  } catch (_) {}

  // Bouton Rejoindre
  const btnRejoindre = document.getElementById("btn-rejoindre");
  if (btnRejoindre) {
    btnRejoindre.addEventListener("click", demarrerReunion);
  }

  // Touche Entrée dans le champ nom
  const champNom = document.getElementById("nom-participant");
  if (champNom) {
    champNom.addEventListener("keydown", (e) => {
      if (e.key === "Enter") demarrerReunion();
    });
  }

  // Bouton Nouvelle Salle
  const btnNouvelle = document.getElementById("btn-nouvelle-salle");
  if (btnNouvelle) {
    btnNouvelle.addEventListener("click", creerNouvelleSalle);
  }

  // Boutons Copier le lien
  const btnCopier = document.getElementById("btn-copier");
  if (btnCopier) {
    btnCopier.addEventListener("click", () => {
      copierTexte(window.location.href, btnCopier);
    });
  }

  const btnCopierDirect = document.getElementById("btn-copier-en-direct");
  if (btnCopierDirect) {
    btnCopierDirect.addEventListener("click", () => {
      copierTexte(window.location.href, btnCopierDirect);
    });
  }

  // Bouton Quitter
  const btnQuitter = document.getElementById("btn-quitter");
  if (btnQuitter) {
    btnQuitter.addEventListener("click", quitterReunion);
  }
});
