// ---------------------------------------------------------
// reunion.js — Salle de réunion vidéo OUESSE (Jitsi Meet)
// Aucune base de données, aucun compte requis.
// ---------------------------------------------------------

const PREFIXE_SALLE = "OUESSE-CM";

// 1) Déterminer le nom de la salle à partir de l'URL (?room=...)
const parametresURL = new URLSearchParams(window.location.search);
let nomSalle = parametresURL.get("room");

if (!nomSalle) {
  // Aucune salle dans le lien : on en crée une nouvelle et on met
  // à jour l'URL pour que le lien devienne partageable.
  const identifiant = new Date().toISOString().slice(0, 10).replace(/-/g, "");
  nomSalle = `${PREFIXE_SALLE}-${identifiant}-${Math.floor(Math.random() * 900 + 100)}`;
  const nouvelleURL = `${window.location.pathname}?room=${nomSalle}`;
  window.history.replaceState({}, "", nouvelleURL);
}

// 2) Afficher la salle et le lien à partager
document.getElementById("nom-salle-affiche").textContent = nomSalle;
document.getElementById("lien-partage").value = window.location.href;

document.getElementById("btn-copier").addEventListener("click", () => {
  const champLien = document.getElementById("lien-partage");
  champLien.select();
  navigator.clipboard.writeText(champLien.value).then(() => {
    const bouton = document.getElementById("btn-copier");
    const texteOriginal = bouton.textContent;
    bouton.textContent = "Copié !";
    setTimeout(() => (bouton.textContent = texteOriginal), 1500);
  });
});

// 3) Au clic sur "Rejoindre la réunion" : lancer Jitsi
document.getElementById("btn-rejoindre").addEventListener("click", demarrerReunion);
document.getElementById("nom-participant").addEventListener("keydown", (e) => {
  if (e.key === "Enter") demarrerReunion();
});

function demarrerReunion() {
  const champNom = document.getElementById("nom-participant");
  const nomAffiche = champNom.value.trim() || "Participant OUESSE";

  document.getElementById("ecran-demarrage").classList.add("cachee");
  document.getElementById("ecran-reunion").classList.remove("cachee");

  const options = {
    roomName: nomSalle,
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
      ],
    },
  };

  const api = new JitsiMeetExternalAPI("meet.jit.si", options);

  // Quand quelqu'un raccroche, retour à l'écran de démarrage
  api.addEventListener("readyToClose", () => {
    document.getElementById("ecran-reunion").classList.add("cachee");
    document.getElementById("ecran-demarrage").classList.remove("cachee");
    document.getElementById("conteneur-jitsi").innerHTML = "";
  });
}
