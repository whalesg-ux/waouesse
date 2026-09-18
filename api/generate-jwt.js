// ---------------------------------------------------------
// api/generate-jwt.js — Serverless function Vercel pour 8x8 JaaS
// Génère un jeton JWT RS256 signé pour la visioconférence JaaS.
// ---------------------------------------------------------

const crypto = require("crypto");

// Domaines autorisés pour les appels CORS
const ORIGINES_AUTORISEES = [
  "https://ouesse.com",
  "https://www.ouesse.com"
];

// Sanitise une chaîne de caractères (empêche l'injection)
function sanitiser(valeur, longueurMax = 100) {
  if (typeof valeur !== "string") return "";
  return valeur
    .trim()
    .slice(0, longueurMax)
    .replace(/[<>"'`]/g, "");
}

// Valide le nom de salle : uniquement alphanumériques, tirets, underscores
function estNomSalleValide(salle) {
  return typeof salle === "string" && /^[a-zA-Z0-9\-_]{2,60}$/.test(salle);
}

// Encode en base64url standard (sans padding '=')
function base64UrlEncode(strOrBuffer) {
  const buf = Buffer.isBuffer(strOrBuffer) ? strOrBuffer : Buffer.from(strOrBuffer, "utf8");
  return buf
    .toString("base64")
    .replace(/=/g, "")
    .replace(/\+/g, "-")
    .replace(/\//g, "_");
}

module.exports = async function handler(req, res) {
  const estProduction =
    process.env.VERCEL_ENV === "production" ||
    process.env.NODE_ENV === "production";

  // --- En-têtes de sécurité globaux ---
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("X-Frame-Options", "DENY");
  res.setHeader("Referrer-Policy", "strict-origin-when-cross-origin");

  // --- CORS strict : autoriser uniquement ouesse.com (et localhost en dev) ---
  const origine = req.headers["origin"] || "";
  const origineAutorisee =
    ORIGINES_AUTORISEES.includes(origine) ||
    (!estProduction &&
      (origine.startsWith("http://localhost") ||
        origine.startsWith("http://127.0.0.1")));

  if (origineAutorisee) {
    res.setHeader("Access-Control-Allow-Origin", origine);
    res.setHeader("Vary", "Origin");
  } else if (origine) {
    return res.status(403).json({ error: "Accès refusé." });
  }

  res.setHeader("Access-Control-Allow-Credentials", "true");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") {
    return res.status(204).end();
  }

  if (req.method !== "POST") {
    return res.status(405).json({ error: "Méthode non autorisée." });
  }

  try {
    const body = req.body || {};
    // email inclus pour le profil JWT (optionnel)
    const { nomSalle, nomAffiche, email, isModerator } = body;

    // --- Validation et sanitisation des entrées ---
    let salle = sanitiser(nomSalle, 60);
    if (salle.includes("/")) {
      salle = salle.split("/").pop();
    }
    if (!estNomSalleValide(salle)) {
      return res.status(400).json({ error: "Nom de salle invalide.", code: "INVALID_ROOM" });
    }

    const userDisplayName = sanitiser(nomAffiche, 60) || "Participant Ouèssè";
    const userEmail = sanitiser(typeof email === "string" ? email : "", 120);

    const appId = process.env.JAAS_APP_ID || "vpaas-magic-cookie-1ebdfc8c8a694563847039d21394ab51";
    const apiKey = process.env.JAAS_API_KEY;
    let privateKey = process.env.JAAS_PRIVATE_KEY;

    // Si les clés secrètes ne sont pas encore renseignées dans Vercel
    if (!privateKey || !apiKey) {
      const msg = !estProduction
        ? "JAAS_PRIVATE_KEY et/ou JAAS_API_KEY manquants dans les variables d'environnement Vercel."
        : "Service temporairement indisponible.";
      return res.status(503).json({
        error: "Configuration serveur incomplète.",
        message: msg,
        code: "JAAS_CONFIG_MISSING"
      });
    }

    // Gestion de la clé encodée en base64 (pour éviter les problèmes de saut de ligne)
    if (!privateKey.includes("BEGIN RSA PRIVATE KEY") && !privateKey.includes("BEGIN PRIVATE KEY")) {
      try {
        const decoded = Buffer.from(privateKey, "base64").toString("utf8");
        if (decoded.includes("PRIVATE KEY")) {
          privateKey = decoded;
        }
      } catch (_) { }
    }

    // Remplacer les retours à la ligne échappés (\n → saut de ligne réel)
    privateKey = privateKey.replace(/\\n/g, "\n");

    const header = {
      alg: "RS256",
      typ: "JWT",
      kid: apiKey
    };

    const nowInSeconds = Math.floor(Date.now() / 1000);
    const payload = {
      aud: "jitsi",
      iss: "chat",
      sub: appId,
      room: salle,
      iat: nowInSeconds,
      nbf: nowInSeconds - 10,
      exp: nowInSeconds + 4 * 3600, // Valide 4 heures
      context: {
        user: {
          name: userDisplayName,
          email: userEmail,
          avatar: "https://res.cloudinary.com/nyke7lhc/image/upload/v1784319943/logo_copie_kzzyfd.webp",
          moderator: Boolean(isModerator)
        },
        features: {
          livestreaming: true,
          recording: true,
          transcription: true,
          "outbound-call": false
        }
      }
    };

    const encodedHeader = base64UrlEncode(JSON.stringify(header));
    const encodedPayload = base64UrlEncode(JSON.stringify(payload));
    const message = `${encodedHeader}.${encodedPayload}`;

    // Signature RSA-SHA256 avec le module natif crypto de Node.js
    const signer = crypto.createSign("RSA-SHA256");
    signer.update(message);
    signer.end();
    const signature = signer.sign(privateKey, "base64");
    const encodedSignature = signature
      .replace(/=/g, "")
      .replace(/\+/g, "-")
      .replace(/\//g, "_");

    const token = `${message}.${encodedSignature}`;

    return res.status(200).json({
      token,
      room: salle,
      appId,
      expiresIn: 4 * 3600
    });
  } catch (err) {
    console.error("Erreur génération JWT JaaS :", err);
    const msgErreur = estProduction
      ? "Erreur interne du serveur."
      : err.message;
    return res.status(500).json({
      error: "Erreur de génération du jeton.",
      message: msgErreur
    });
  }
};
