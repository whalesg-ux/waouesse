function estDejaInstallee() {
  return (
    window.matchMedia("(display-mode: standalone)").matches ||
    window.navigator.standalone === true
  );
}

function detecterPlateforme() {
  const ua = navigator.userAgent || "";
  if (/iphone|ipad|ipod/i.test(ua)) return "iphone";
  if (/android/i.test(ua)) return "android";
  return "autre";
}

document.addEventListener("DOMContentLoaded", () => {
  if (estDejaInstallee()) {
    const msg = document.getElementById("message-deja-installee");
    if (msg) msg.hidden = false;
    return;
  }

  const plateforme = detecterPlateforme();
  const idBloc = {
    iphone: "bloc-iphone",
    android: "bloc-android",
    autre: "bloc-autre",
  }[plateforme];

  const bloc = document.getElementById(idBloc);
  if (bloc) {
    bloc.hidden = false;
  }
});
