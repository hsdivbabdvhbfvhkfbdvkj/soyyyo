const state = {
  device: "android",
  style: "precision",
  dpiByDevice: {
    android: 480,
    ios: 60,
    pc: 800
  }
};

document.addEventListener("gesturestart", (event) => event.preventDefault(), { passive: false });
document.addEventListener("gesturechange", (event) => event.preventDefault(), { passive: false });
document.addEventListener("gestureend", (event) => event.preventDefault(), { passive: false });
document.addEventListener("touchmove", (event) => {
  if (event.touches.length > 1) event.preventDefault();
}, { passive: false });

let keyauthSessionId = "";
let licenseCountdownTimer = "";

function parseKeyAuthExpiration(result) {
  const candidates = [
    result.expires,
    result.expiry,
    result.expiration,
    result.expires_in,
    result.expire,
    result.info && result.info.expires,
    result.info && result.info.expiry,
    result.info && result.info.expiration
  ];

  const subscriptions = Array.isArray(result.subscriptions)
    ? result.subscriptions
    : (result.info && Array.isArray(result.info.subscriptions) ? result.info.subscriptions : []);
  subscriptions.forEach((subscription) => {
    candidates.push(subscription.expiry, subscription.expiration, subscription.expires, subscription.timeleft);
  });
  candidates.push(result.timeleft);

  const now = Date.now();
  for (const candidate of candidates) {
    if (candidate === undefined || candidate === null || candidate === "") continue;

    if (typeof candidate === "number" || /^\d+$/.test(String(candidate))) {
      const value = Number(candidate);
      if (!Number.isFinite(value) || value <= 0) continue;
      return value < 100000000000 ? (value > now / 1000 ? value * 1000 : now + value * 1000) : value;
    }

    const duration = String(candidate).toLowerCase().match(
      /(\d+)\s*(day|days|hour|hours|hr|hrs|minute|minutes|min|mins|second|seconds|sec|week|weeks|month|months|year|years)/
    );
    if (duration) {
      const amount = Number(duration[1]);
      const unit = duration[2];
      const multipliers = {
        second: 1000, seconds: 1000, sec: 1000,
        minute: 60000, minutes: 60000, min: 60000, mins: 60000,
        hour: 3600000, hours: 3600000, hr: 3600000, hrs: 3600000,
        day: 86400000, days: 86400000,
        week: 604800000, weeks: 604800000,
        month: 2592000000, months: 2592000000,
        year: 31536000000, years: 31536000000
      };
      return now + amount * multipliers[unit];
    }

    const parsedDate = Date.parse(String(candidate));
    if (!Number.isNaN(parsedDate)) return parsedDate;
  }

  return null;
}

function formatRemainingTime(milliseconds) {
  const totalSeconds = Math.max(0, Math.floor(milliseconds / 1000));
  const days = Math.floor(totalSeconds / 86400);
  const hours = Math.floor((totalSeconds % 86400) / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  const parts = [];
  if (days) parts.push(`${days}d`);
  if (hours || days) parts.push(`${hours}h`);
  parts.push(`${minutes}m`, `${seconds}s`);
  return parts.join(" ");
}

function startLicenseCountdown(expiresAt) {
  const loginTimer = document.querySelector("#keyauthTime");
  const topTimer = document.querySelector("#licenseCountdown");
  window.clearInterval(licenseCountdownTimer);

  const update = () => {
    const remaining = expiresAt - Date.now();
    if (remaining <= 0) {
      window.clearInterval(licenseCountdownTimer);
      loginTimer.textContent = "La licencia ha expirado.";
      topTimer.textContent = "Licencia expirada";
      return;
    }

    const text = `Tiempo restante: ${formatRemainingTime(remaining)}`;
    loginTimer.textContent = text;
    loginTimer.hidden = false;
    topTimer.textContent = text;
    topTimer.hidden = false;
  };

  update();
  licenseCountdownTimer = window.setInterval(update, 1000);
}

function createDeviceId() {
  if (window.crypto && typeof window.crypto.randomUUID === "function") {
    return window.crypto.randomUUID();
  }

  if (window.crypto && typeof window.crypto.getRandomValues === "function") {
    const bytes = new Uint32Array(4);
    window.crypto.getRandomValues(bytes);
    return Array.from(bytes, (value) => value.toString(16).padStart(8, "0")).join("");
  }

  return `${Date.now().toString(16)}${Math.random().toString(16).slice(2)}`;
}

function getDeviceId() {
  const storageKey = "hypersex_device_id";

  try {
    let deviceId = window.localStorage.getItem(storageKey);
    if (!deviceId) {
      deviceId = createDeviceId();
      window.localStorage.setItem(storageKey, deviceId);
    }
    return deviceId;
  } catch {
    const identity = [
      navigator.userAgent,
      navigator.language,
      String(screen.width),
      String(screen.height),
      String(new Date().getTimezoneOffset())
    ].join("|");
    return btoa(unescape(encodeURIComponent(identity))).replace(/[^a-zA-Z0-9]/g, "").slice(0, 64);
  }
}

const keyauthDeviceId = getDeviceId();

let welcomeAudio;
let welcomePlayer;

function showWelcomePlayer() {
  if (welcomePlayer) {
    welcomePlayer.classList.add("visible");
    return;
  }

  welcomePlayer = document.createElement("div");
  welcomePlayer.className = "welcome-player";
  welcomePlayer.innerHTML = `
    <img class="welcome-player-cover" src="donde-hubo-fuego-cover.jpg" alt="Portada de Donde hubo fuego">
    <div class="welcome-player-info">
      <strong>Donde hubo fuego</strong>
      <span>Anuel AA - audio local</span>
    </div>
    <button class="welcome-player-toggle" type="button" aria-label="Reproducir música">\u25B6</button>
    <button class="welcome-player-close" type="button" aria-label="Cerrar reproductor">\u00D7</button>
  `;
  document.body.appendChild(welcomePlayer);

  const toggle = welcomePlayer.querySelector(".welcome-player-toggle");
  toggle.addEventListener("click", () => {
    if (!welcomeAudio) return;
    if (welcomeAudio.paused) {
      welcomeAudio.play().catch(() => {});
    } else {
      welcomeAudio.pause();
    }
  });

  welcomePlayer.querySelector(".welcome-player-close").addEventListener("click", () => {
    welcomeAudio?.pause();
    if (welcomeAudio) welcomeAudio.currentTime = 0;
    welcomePlayer.classList.remove("visible");
  });
  welcomePlayer.classList.add("visible");
}

function prepareWelcomeMusic() {
  if (welcomeAudio) return welcomeAudio;
  welcomeAudio = new Audio("anuel.mp3");
  welcomeAudio.preload = "auto";
  welcomeAudio.volume = 0.75;
  welcomeAudio.addEventListener("play", () => {
    const toggle = welcomePlayer?.querySelector(".welcome-player-toggle");
    if (!toggle) return;
    toggle.dataset.paused = "false";
    toggle.textContent = "\u23F8";
    toggle.setAttribute("aria-label", "Pausar música");
  });
  const markPaused = () => {
    const toggle = welcomePlayer?.querySelector(".welcome-player-toggle");
    if (!toggle) return;
    toggle.dataset.paused = "true";
    toggle.textContent = "\u25B6";
    toggle.setAttribute("aria-label", "Reanudar música");
  };
  welcomeAudio.addEventListener("pause", markPaused);
  welcomeAudio.addEventListener("ended", markPaused);
  return welcomeAudio;
}

function playWelcomeMusic() {
  const audio = prepareWelcomeMusic();
  showWelcomePlayer();
  audio.currentTime = 0;
  return audio.play();
}

async function initializeKeyAuth() {
  const status = document.querySelector("#keyauthStatus");
  status.textContent = "Conectando...";
  try {
    const response = await fetch("/api/keyauth?action=init", { method: "POST" });
    const result = await response.json();
    if (!result.success || !result.sessionid) throw new Error(result.message || "No se pudo iniciar KeyAuth.");
    keyauthSessionId = result.sessionid;
    status.textContent = "";
    return keyauthSessionId;
  } catch (error) {
    status.textContent = error.message;
    throw error;
  }
}

const profileCountdown = document.querySelector("#licenseCountdown");
const profileCountdownSlot = document.querySelector("#profileCountdownSlot");
if (profileCountdown && profileCountdownSlot) profileCountdownSlot.appendChild(profileCountdown);

const keyauthLock = document.querySelector("#keyauthLock");
const keyauthCard = document.querySelector("#keyauthForm");
const keyauthKeyInput = document.querySelector("#keyauthKey");
const pasteKeyButton = document.querySelector("#pasteKey");
const prefersReducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

pasteKeyButton.addEventListener("click", async () => {
  try {
    keyauthKeyInput.value = (await navigator.clipboard.readText()).trim();
    keyauthKeyInput.focus();
    pasteKeyButton.textContent = "Pegado";
    window.setTimeout(() => { pasteKeyButton.textContent = "Pegar"; }, 1200);
  } catch {
    document.querySelector("#keyauthStatus").textContent = "Pulsa y mantén el campo para pegar manualmente.";
    keyauthKeyInput.focus();
  }
});

if (keyauthLock && keyauthCard && !prefersReducedMotion && window.matchMedia("(hover: hover)").matches) {
  keyauthLock.addEventListener("pointermove", (event) => {
    const bounds = keyauthLock.getBoundingClientRect();
    const x = (event.clientX - bounds.left) / bounds.width - 0.5;
    const y = (event.clientY - bounds.top) / bounds.height - 0.5;
    keyauthCard.style.transform = `rotateX(${3 - y * 6}deg) rotateY(${-3 + x * 7}deg) translateZ(12px)`;
  });
  keyauthLock.addEventListener("pointerleave", () => {
    keyauthCard.style.transform = "rotateX(3deg) rotateY(-3deg) translateZ(0)";
  });
}

document.querySelector("#keyauthForm").addEventListener("submit", async (event) => {
  event.preventDefault();
  prepareWelcomeMusic();
  const musicPlayback = playWelcomeMusic().then(() => true).catch(() => false);
  const status = document.querySelector("#keyauthStatus");
  status.classList.remove("key-in-use");
  status.textContent = "Validando licencia...";
  try {
    const response = await fetch("https://hypersex-licencias.vercel.app/api/licenses?action=validate", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        key: document.querySelector("#keyauthKey").value.trim(),
        hwid: keyauthDeviceId
      })
    });
    const result = await response.json();
    if (!result.success) {
      const rawMessage = String(result.message || "Credenciales o licencia invalidas.");
      const normalized = rawMessage.toLowerCase();
      const keyInUse = /key.*used|used.*key|already.*(session|logged|online)|already.*use|hwid|hardware.*id|otra sesi[oó]n|sesión.*activa/.test(normalized);
      if (keyInUse) {
        status.classList.add("key-in-use");
        throw new Error("KEY EN USO EN OTRO DISPOSITIVO");
      }
      throw new Error(rawMessage);
    }
    const expiresAt = Number(result.expires) || null;
    if (expiresAt) startLicenseCountdown(expiresAt);
    const musicStarted = await musicPlayback;
    if (!musicStarted) {
      const trackInfo = welcomePlayer?.querySelector(".welcome-player-info span");
      if (trackInfo) trackInfo.textContent = "Pulsa reproducir para escuchar";
    }
    document.querySelector("#keyauthLock").classList.add("hidden");
    status.textContent = "";
  } catch (error) {
    welcomeAudio?.pause();
    if (welcomeAudio) welcomeAudio.currentTime = 0;
    welcomePlayer?.remove();
    welcomePlayer = null;
    status.textContent = error.message;
  }
});



const launchGame = document.querySelector("#launchGame");
const launchPlatform = document.querySelector("#launchPlatform");
const downloadDnsProfile = document.querySelector("#downloadDnsProfile");
const dnsStatus = document.querySelector("#dnsStatus");
const emulatorStatus = document.querySelector("#emulatorStatus");

function launchDesktopApp(protocol, statusText) {
  emulatorStatus.textContent = statusText;
  window.location.assign(protocol);
  window.setTimeout(() => {
    emulatorStatus.textContent = document.hidden
      ? "BlueStacks abierto."
      : "Si no abre, verifica que BlueStacks esté instalado en Windows.";
  }, 1800);
}


const styleProfiles = {
  precision: { general: 184, red: 176, x2: 164, x4: 152, sniper: 140, free: 172, label: "Precisión" },
  balanced: { general: 176, red: 168, x2: 160, x4: 156, sniper: 148, free: 164, label: "Equilibrado" },
  aggressive: { general: 192, red: 186, x2: 176, x4: 168, sniper: 156, free: 182, label: "Acelerado" }
};

const pcStyleProfiles = {
  precision: { general: 92, red: 88, x2: 82, x4: 76, sniper: 68, free: 84, label: "Precisión PC" },
  balanced: { general: 104, red: 98, x2: 92, x4: 86, sniper: 78, free: 96, label: "Equilibrado PC" },
  aggressive: { general: 118, red: 112, x2: 106, x4: 98, sniper: 88, free: 108, label: "Acelerado PC" }
};

const dpiInput = document.querySelector("#dpi");
const dpiValue = document.querySelector("#dpiValue");
const generateButton = document.querySelector("#generate");
const copyButton = document.querySelector("#copy");
const copyStatus = document.querySelector("#copyStatus");
const auxToggle = document.querySelector("#auxToggle");
const auxRange = document.querySelector("#auxRange");
const auxValue = document.querySelector("#auxValue");
const auxStrength = document.querySelector("#auxStrength");
const calibrateAux = document.querySelector("#calibrateAux");
const resetAux = document.querySelector("#resetAux");
const auxStatus = document.querySelector("#auxStatus");

dpiInput.addEventListener("input", () => {
  state.dpiByDevice[state.device] = Number(dpiInput.value);
  dpiValue.textContent = dpiInput.value;
});

document.querySelectorAll("[data-device]").forEach((button) => {
  button.addEventListener("click", () => {
    document.querySelectorAll("[data-device]").forEach((item) => item.classList.remove("selected"));
    document.querySelectorAll("[data-device]").forEach((item) => item.classList.remove("active"));
    button.classList.add(button.dataset.device === "android" ? "active" : "active");
    state.device = button.dataset.device;
    document.body.dataset.device = state.device;
    configureDpiRange();
    downloadDnsProfile.hidden = state.device !== "ios";
    document.querySelector(".emulator-actions").hidden = state.device !== "pc";
    launchGame.querySelector(".launch-copy small").textContent =
      state.device === "pc" ? "EMULADOR PC" : "JUEGO INSTALADO";
    dnsStatus.textContent = "";
    launchPlatform.textContent = state.device === "pc" ? "PC" : state.device === "ios" ? "iOS" : "Android";
    document.querySelector("#systemPlatform").textContent = launchPlatform.textContent;
  });
});

downloadDnsProfile.addEventListener("click", () => {
  const profile = `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>PayloadContent</key>
  <array>
    <dict>
      <key>DNSSettings</key>
      <dict>
        <key>DNSProtocol</key>
        <string>HTTPS</string>
        <key>ServerURL</key>
        <string>https://cloudflare-dns.com/dns-query</string>
      </dict>
      <key>PayloadDescription</key>
      <string>Configura DNS cifrado para Hyper Auxilio.</string>
      <key>PayloadDisplayName</key>
      <string>Hyper Auxilio</string>
      <key>PayloadIdentifier</key>
      <string>com.hypersex.hyperauxilio.dns</string>
      <key>PayloadType</key>
      <string>com.apple.dnsSettings.managed</string>
      <key>PayloadUUID</key>
      <string>58A45ED5-3D18-49B7-9FC9-C7F69F78A21C</string>
      <key>PayloadVersion</key>
      <integer>1</integer>
    </dict>
  </array>
  <key>PayloadDisplayName</key>
  <string>Hyper Auxilio</string>
  <key>PayloadIdentifier</key>
  <string>com.hypersex.hyperauxilio</string>
  <key>PayloadDescription</key>
  <string>Perfil DNS Hyper Auxilio para iOS.</string>
  <key>PayloadOrganization</key>
  <string>HyperSex</string>
  <key>PayloadRemovalDisallowed</key>
  <false/>
  <key>PayloadType</key>
  <string>Configuration</string>
  <key>PayloadUUID</key>
  <string>8A9B1F7C-12E4-4B2A-A5F3-6CD8E01A9247</string>
  <key>PayloadVersion</key>
  <integer>1</integer>
</dict>
</plist>`;

  const blob = new Blob([profile], { type: "application/x-apple-aspen-config" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = "Hyper Auxilio.mobileconfig";
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
  dnsStatus.textContent = "Perfil descargado. Abre Ajustes > General > VPN y gestión de dispositivos para instalarlo.";
});

launchGame.addEventListener("click", () => {
  if (state.device === "ios") {
    window.location.assign("freefire://");
    return;
  }

  if (state.device === "pc") {
    window.location.assign("bluestacks://com.dts.freefireth");
    return;
  }

  window.location.href =
    "intent://launch/#Intent;scheme=freefire;package=com.dts.freefireth;end";
});

function configureDpiRange() {
  if (state.device === "ios") {
    dpiInput.min = "1";
    dpiInput.max = "120";
    dpiInput.step = "1";
  } else if (state.device === "pc") {
    dpiInput.min = "400";
    dpiInput.max = "1600";
    dpiInput.step = "50";
  } else {
    dpiInput.min = "240";
    dpiInput.max = "800";
    dpiInput.step = "20";
  }
  dpiInput.value = String(state.dpiByDevice[state.device]);
  dpiValue.textContent = dpiInput.value;
  document.querySelector("#systemPlatform").textContent =
    state.device === "pc" ? "PC" : state.device === "ios" ? "iOS" : "Android";
  document.querySelector(".system-item:last-child strong").textContent =
    state.device === "pc" ? "1 - 150" : "1 - 200";
  document.querySelector("#profileBadge").textContent =
    `${state.device === "pc" ? "PC" : state.device === "ios" ? "iOS" : "Android"} / ${(state.device === "pc" ? pcStyleProfiles : styleProfiles)[state.style].label}`;
  document.querySelector("#systemProfile").textContent = styleProfiles[state.style].label;
}

auxToggle.addEventListener("click", () => {
  const enabled = auxToggle.classList.toggle("active");
  if (enabled) {
    const activationAudio = new Audio("opcion_activada_audio.mp3");
    activationAudio.volume = 1;
    activationAudio.play().catch(() => {
      auxStatus.textContent = "Auxilio activo. Toca de nuevo para reproducir el sonido.";
    });
  }
  auxToggle.setAttribute("aria-checked", String(enabled));
  auxRange.disabled = !enabled;
  auxStrength.classList.toggle("disabled", !enabled);
  calibrateAux.disabled = !enabled;
  auxStatus.className = enabled ? "aux-status ready" : "aux-status";
  auxStatus.textContent = enabled ? "Auxilio activo en Android e iOS" : "Auxilio desactivado";
});

auxRange.addEventListener("input", () => {
  auxValue.textContent = `${auxRange.value}%`;
});

calibrateAux.addEventListener("click", () => {
  calibrateAux.disabled = true;
  calibrateAux.textContent = "Calibrando...";
  auxStatus.textContent = "Analizando configuración...";

  window.setTimeout(() => {
    calibrateAux.disabled = false;
    calibrateAux.textContent = "Calibrar";
    auxStatus.textContent = `Perfil calibrado al ${auxRange.value}% · DPI conservado: ${dpiInput.value}`;
    renderProfile(getGeneratedProfile());
  }, 700);
});

resetAux.addEventListener("click", () => {
  auxToggle.classList.remove("active");
  auxToggle.setAttribute("aria-checked", "false");
  auxRange.value = "50";
  auxRange.disabled = true;
  auxValue.textContent = "50%";
  auxStrength.classList.add("disabled");
  calibrateAux.disabled = true;
  auxStatus.className = "aux-status";
  auxStatus.textContent = "Valores restablecidos";
});

document.querySelectorAll("[data-style]").forEach((button) => {
  button.addEventListener("click", () => {
    document.querySelectorAll("[data-style]").forEach((item) => item.classList.remove("selected"));
    button.classList.add("selected");
    state.style = button.dataset.style;
    document.querySelector("#profileBadge").textContent =
      `${state.device === "pc" ? "PC" : state.device === "ios" ? "iOS" : "Android"} / ${(state.device === "pc" ? pcStyleProfiles : styleProfiles)[state.style].label}`;
  });
});

function getGeneratedProfile() {
  const base = state.device === "pc" ? pcStyleProfiles[state.style] : styleProfiles[state.style];
  const referenceDpi = state.device === "ios" ? 60 : state.device === "pc" ? 800 : 480;
  const currentDpi = Number(dpiInput.value);
  const ratio = currentDpi / referenceDpi;
  const dpiScale = state.device === "pc" ? 0.12 : 0.16;
  const adjustment = Math.round((ratio - 1) * -1 * (state.device === "pc" ? 30 : 40) * dpiScale / 0.16);
  const minimum = state.device === "pc" ? 1 : 30;
  const maximum = state.device === "pc" ? 150 : 200;

  const clampProfileValue = (value) => Math.max(minimum, Math.min(maximum, value + adjustment));

  return {
    label: `${state.device === "pc" ? "PC" : state.device === "ios" ? "iOS" : "Android"} · ${base.label}`,
    general: clampProfileValue(base.general),
    red: clampProfileValue(base.red),
    x2: clampProfileValue(base.x2),
    x4: clampProfileValue(base.x4),
    sniper: clampProfileValue(base.sniper),
    free: clampProfileValue(base.free)
  };
}

function renderProfile(profile) {
  const fields = [
    ["general", profile.general],
    ["red", profile.red],
    ["x2", profile.x2],
    ["x4", profile.x4],
    ["sniper", profile.sniper],
    ["free", profile.free]
  ];

  fields.forEach(([key, value]) => {
    document.querySelector(`#${key}Value`).textContent = value;
    document.querySelector(`#${key}Bar`).style.width = `${value / 2}%`;
  });

  document.querySelector("#profileBadge").textContent = profile.label;
}

generateButton.addEventListener("click", () => {
  generateButton.querySelector("span:first-child").textContent = "Generando...";
  generateButton.disabled = true;

  window.setTimeout(() => {
    renderProfile(getGeneratedProfile());
    generateButton.disabled = false;
    generateButton.querySelector("span:first-child").textContent = "Generar sensibilidad";
  }, 650);
});

copyButton.addEventListener("click", async () => {
  const profile = getGeneratedProfile();
  const text = [
    `HyperSex | ${profile.label}`,
    `General: ${profile.general}`,
    `Mira roja: ${profile.red}`,
    `2x: ${profile.x2}`,
    `4x: ${profile.x4}`,
    `Sniper: ${profile.sniper}`,
    `Libre: ${profile.free}`,
    `DPI: ${dpiInput.value}`,
    `Auxilio: ${auxToggle.classList.contains("active") ? auxRange.value + "%" : "Desactivado"}`
  ].join("\n");

  try {
    await navigator.clipboard.writeText(text);
    copyStatus.textContent = savedConfig.copiedText;
    window.setTimeout(() => { copyStatus.textContent = ""; }, 2200);
  } catch {
    copyStatus.textContent = savedConfig.errorText;
  }
});

const adminPanel = document.querySelector("#adminPanel");
const adminOverlay = document.querySelector("#adminOverlay");
const defaultConfig = {
  brand: "HYPERSEX",
  eyebrow: "Hypersex tu mejor opcion",
  title: "Encuentra tu sensibilidad perfecta",
  description: "Configura tu dispositivo y genera ajustes pensados para mejorar tu precisión y comodidad.",
  accent: "#d8dde5",
  accentTwo: "#8f96a3",
  background: "#080b12",
  text: "#f5f6fa",
  surface: "#10141f",
  radius: "10px",
  backdrop: "grid",
  font: "modern",
  width: "1180px",
  scale: 100,
  opacity: 88,
  blur: 18,
  spacing: 18,
  layout: "default",
  showPlatforms: true,
  showHeader: true,
  showFooter: true,
  showTip: true,
  line: "#2b3040",
  borderWidth: 1,
  glow: 10,
  shadow: "soft",
  animation: "smooth",
  decoration: "grid",
  livePreview: true,
  loginTitle: "Ingresa tu key",
  loginSubtitle: "Sistema premium de sensibilidad",
  loginButton: "Acceder",
  loginSmall: "HYPERSEX ACCESS",
  loginPosition: "center",
  status: "Compatible Android + iOS",
  generateText: "Generar sensibilidad",
  copyText: "Copiar configuración",
  tipTitle: "Consejo HyperSex",
  tipText: "Prueba el perfil durante 10 minutos y ajusta un punto a la vez hasta encontrar tu punto de comodidad.",
  footerLeft: "HYPERSEX LABS",
  footerRight: "PROFILES / 2026",
  autoYear: "yes",
  showStatus: true,
  showLaunch: true,
  showSensitivity: true,
  showAux: true,
  copiedText: "Configuración copiada",
  errorText: "No se pudo copiar",
  image: "",
  buttons: [],
  sections: []
};

let savedConfig = { ...defaultConfig };

function openAdmin(open) {
  adminPanel.classList.toggle("open", open);
  adminOverlay.classList.toggle("open", open);
  adminPanel.setAttribute("aria-hidden", String(!open));
}

// El acceso protegido se controla mediante el formulario de contraseña.
document.querySelector("#adminClose").addEventListener("click", () => openAdmin(false));
adminOverlay.addEventListener("click", () => openAdmin(false));

const adminLock = document.querySelector("#adminLock");
const adminPassword = document.querySelector("#adminPassword");

const advancedSection = document.querySelector('[data-admin-section="advanced"]');
if (advancedSection) {
  advancedSection.insertAdjacentHTML("beforeend", `
    <div class="license-generator">
      <div class="builder-heading"><small>LICENCIAS PROPIAS</small><strong>Generador de keys</strong></div>
      <label>Keys a crear<input id="licenseCount" type="number" min="1" max="100" value="10"></label>
      <label>Días de duración<input id="licenseDays" type="number" min="1" max="36500" value="30"></label>
      <label>Dispositivos por key<input id="licenseDevices" type="number" min="1" max="10" value="1"></label>
      <button class="secondary-action" id="generateLicenses" type="button">Generar keys</button>
      <textarea id="generatedLicenses" rows="7" readonly placeholder="Las keys generadas aparecerán aquí"></textarea>
      <button class="secondary-action" id="copyLicenses" type="button">Copiar keys</button>
    </div>
  `);
}
const lockStatus = document.querySelector("#lockStatus");

function showAdminLock() {
  adminLock.classList.add("open");
  adminLock.setAttribute("aria-hidden", "false");
  adminPassword.value = "";
  lockStatus.textContent = "";
  adminPassword.focus();
}

document.querySelector("#adminOpen").addEventListener("click", showAdminLock);

document.querySelector("#lockCancel").addEventListener("click", () => {
  adminLock.classList.remove("open");
  adminLock.setAttribute("aria-hidden", "true");
});

document.querySelector("#passwordToggle").addEventListener("click", () => {
  const reveal = adminPassword.type === "password";
  adminPassword.type = reveal ? "text" : "password";
  document.querySelector("#passwordToggle").textContent = reveal ? "Ocultar" : "Ver";
});

document.querySelector("#adminLockForm").addEventListener("submit", (event) => {
  event.preventDefault();
  const enteredPassword = adminPassword.value.normalize("NFKC").trim();
  const acceptedPassword = window.btoa("Hypersex2022@");
  let passwordMatches = false;
  try {
    passwordMatches = window.btoa(enteredPassword) === acceptedPassword;
  } catch {
    passwordMatches = false;
  }
  if (passwordMatches) {
    adminLock.classList.remove("open");
    adminLock.setAttribute("aria-hidden", "true");
    adminPanel.classList.add("open");
    adminPanel.setAttribute("aria-hidden", "false");
    adminOverlay.classList.add("open");
    return;
  }
  lockStatus.textContent = "Contraseña incorrecta";
  adminPassword.select();
});

document.querySelectorAll("[data-admin-tab]").forEach((tab) => {
  tab.addEventListener("click", () => {
    document.querySelectorAll("[data-admin-tab]").forEach((item) => item.classList.remove("active"));
    document.querySelectorAll("[data-admin-section]").forEach((item) => item.classList.remove("active"));
    tab.classList.add("active");
    document.querySelector(`[data-admin-section="${tab.dataset.adminTab}"]`).classList.add("active");
  });
});

const adminLayoutSelect = document.querySelector("#adminLayout");
document.querySelectorAll("[data-interface-layout]").forEach((button) => {
  button.addEventListener("click", () => {
    adminLayoutSelect.value = button.dataset.interfaceLayout;
    adminLayoutSelect.dispatchEvent(new Event("change", { bubbles: true }));
    document.querySelectorAll("[data-interface-layout]").forEach((item) => item.classList.remove("active"));
    button.classList.add("active");
  });
});

function executeButtonAction(action, url) {
  if (action === "url" && url) window.open(url, "_blank", "noopener,noreferrer");
  if (action === "generate") generateButton.click();
  if (action === "copy") copyButton.click();
  if (action === "scroll") document.querySelector(".dashboard").scrollIntoView({ behavior: "smooth" });
  if (action === "alert") window.alert("Acción personalizada ejecutada desde HyperSex.");
}

function renderCustomButtons(buttons) {
  const container = document.querySelector("#customActions");
  const list = document.querySelector("#adminButtonList");
  container.replaceChildren();
  list.replaceChildren();

  buttons.forEach((buttonConfig, index) => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "custom-action";
    button.textContent = buttonConfig.text;
    if (buttonConfig.color) button.style.background = buttonConfig.color;
    button.addEventListener("click", () => executeButtonAction(buttonConfig.action, buttonConfig.url));
    container.appendChild(button);

    const row = document.createElement("div");
    row.className = "admin-added-button";
    const label = document.createElement("span");
    label.textContent = `${buttonConfig.text} · ${buttonConfig.action}`;
    const remove = document.createElement("button");
    remove.type = "button";
    remove.textContent = "Eliminar";
    remove.addEventListener("click", () => {
      savedConfig.buttons.splice(index, 1);
      renderCustomButtons(savedConfig.buttons);
    });
    row.append(label, remove);
    list.appendChild(row);
  });
}

function applyConfig(config) {
  document.querySelector("#keyauthForm h2").textContent = config.loginTitle;
  document.querySelector(".keyauth-subtitle").textContent = config.loginSubtitle;
  document.querySelector("#keyauthForm button[type='submit']").textContent = config.loginButton;
  document.querySelector("#keyauthForm > small").textContent = config.loginSmall;
  document.querySelector(".keyauth-lock").dataset.loginPosition = config.loginPosition;
  document.querySelector("#brandName").textContent = config.brand;
  document.querySelector("#heroEyebrow").textContent = config.eyebrow;
  document.querySelector("#heroTitle").textContent = config.title;
  document.querySelector("#heroDescription").textContent = config.description;
  document.documentElement.style.setProperty("--accent", config.accent);
  document.documentElement.style.setProperty("--accent-2", config.accentTwo);
  document.documentElement.style.setProperty("--radius", config.radius);
  document.documentElement.style.setProperty("--bg", config.background);
  document.documentElement.style.setProperty("--text", config.text);
  document.documentElement.style.setProperty("--surface", config.surface + "9a");
  document.documentElement.style.setProperty("--admin-width", config.width);
  document.documentElement.style.setProperty("--admin-scale", config.scale / 100);
  document.documentElement.style.setProperty("--admin-panel-opacity", config.opacity / 100);
  document.documentElement.style.setProperty("--admin-blur", config.blur + "px");
  document.documentElement.style.setProperty("--admin-spacing", config.spacing + "px");
  document.documentElement.style.setProperty("--line", config.line + "25");
  document.documentElement.style.setProperty("--admin-border", config.borderWidth + "px");
  document.documentElement.style.setProperty("--admin-glow", config.glow + "px");
  document.body.dataset.backdrop = config.backdrop;
  document.body.dataset.font = config.font;
  document.body.dataset.animation = config.animation;
  document.body.dataset.decoration = config.decoration;
  document.querySelectorAll(".panel, .platform, .admin-panel").forEach((item) => {
    item.style.borderWidth = config.borderWidth + "px";
    item.style.boxShadow = config.shadow === "none" ? "none" :
      config.shadow === "strong" ? "0 30px 90px rgba(0,0,0,.65)" :
      "0 24px 70px rgba(0,0,0,.32)";
  });
  document.querySelectorAll(".panel").forEach((item) => {
    item.style.filter = config.glow ? `drop-shadow(0 0 ${config.glow / 4}px var(--accent))` : "none";
  });

  const dashboard = document.querySelector(".dashboard");
  dashboard.classList.toggle("reverse", config.layout === "reverse");
  dashboard.classList.toggle("stack", config.layout === "stack");
  document.querySelector(".platform-switch").classList.toggle("hidden-admin", !config.showPlatforms);
  document.querySelector(".topbar").classList.toggle("hidden-admin", !config.showHeader);
  document.querySelector("footer").classList.toggle("hidden-admin", !config.showFooter);
  document.querySelector(".tip").classList.toggle("hidden-admin", !config.showTip);
  document.querySelector(".status").classList.toggle("hidden-admin", !config.showStatus);
  document.querySelector("#launchGame").classList.toggle("hidden-admin", !config.showLaunch);
  document.querySelector(".result-panel").classList.toggle("hidden-admin", !config.showSensitivity);
  document.querySelector(".aux-panel").classList.toggle("hidden-admin", !config.showAux);
  document.querySelector(".status").lastChild.textContent = config.status;
  document.querySelector("#generate span:first-child").textContent = config.generateText;
  document.querySelector("#copy").textContent = config.copyText;
  document.querySelector(".tip strong").textContent = config.tipTitle;
  document.querySelector(".tip p").textContent = config.tipText;
  const footerSpans = document.querySelectorAll("footer span");
  footerSpans[0].textContent = config.footerLeft;
  footerSpans[1].textContent =
    config.autoYear === "yes" ? `PROFILES / ${new Date().getFullYear()}` : config.footerRight;

  document.querySelector(".hero").querySelectorAll(".hero-image").forEach((item) => item.remove());
  if (config.image) {
    const image = document.createElement("img");
    image.className = "hero-image";
    image.src = config.image;
    image.alt = "";
    document.querySelector(".hero").appendChild(image);
  }
  renderCustomButtons(config.buttons);
  renderCustomSections(config.sections || []);
}

function loadAdminFields(config) {
  document.querySelector("#adminLoginTitle").value = config.loginTitle;
  document.querySelector("#adminLoginSubtitle").value = config.loginSubtitle;
  document.querySelector("#adminLoginButton").value = config.loginButton;
  document.querySelector("#adminLoginSmall").value = config.loginSmall;
  document.querySelector("#adminLoginPosition").value = config.loginPosition;
  document.querySelector("#adminBrand").value = config.brand;
  document.querySelector("#adminEyebrow").value = config.eyebrow;
  document.querySelector("#adminTitle").value = config.title;
  document.querySelector("#adminDescription").value = config.description;
  document.querySelector("#adminAccent").value = config.accent;
  document.querySelector("#adminAccentTwo").value = config.accentTwo;
  document.querySelector("#adminRadius").value = config.radius;
  document.querySelector("#adminBackdrop").value = config.backdrop;
  document.querySelector("#adminBackground").value = config.background;
  document.querySelector("#adminText").value = config.text;
  document.querySelector("#adminSurface").value = config.surface;
  document.querySelector("#adminFont").value = config.font;
  document.querySelector("#adminWidth").value = config.width;
  document.querySelector("#adminScale").value = config.scale;
  document.querySelector("#adminOpacity").value = config.opacity;
  document.querySelector("#adminBlur").value = config.blur;
  document.querySelector("#adminSpacing").value = config.spacing;
  document.querySelector("#adminLayout").value = config.layout;
  document.querySelector("#showPlatforms").checked = config.showPlatforms;
  document.querySelector("#showHeader").checked = config.showHeader;
  document.querySelector("#showFooter").checked = config.showFooter;
  document.querySelector("#showTip").checked = config.showTip;
  document.querySelector("#adminLine").value = config.line;
  document.querySelector("#adminBorderWidth").value = config.borderWidth;
  document.querySelector("#adminGlow").value = config.glow;
  document.querySelector("#adminShadow").value = config.shadow;
  document.querySelector("#adminAnimation").value = config.animation;
  document.querySelector("#adminDecoration").value = config.decoration;
  document.querySelector("#livePreview").checked = config.livePreview;
  document.querySelector("#adminStatus").value = config.status;
  document.querySelector("#adminGenerateText").value = config.generateText;
  document.querySelector("#adminCopyText").value = config.copyText;
  document.querySelector("#adminTipTitle").value = config.tipTitle;
  document.querySelector("#adminTipText").value = config.tipText;
  document.querySelector("#adminFooterLeft").value = config.footerLeft;
  document.querySelector("#adminFooterRight").value = config.footerRight;
  document.querySelector("#adminAutoYear").value = config.autoYear;
  document.querySelector("#showStatus").checked = config.showStatus;
  document.querySelector("#showLaunch").checked = config.showLaunch;
  document.querySelector("#showSensitivity").checked = config.showSensitivity;
  document.querySelector("#showAux").checked = config.showAux;
  document.querySelector("#adminCopiedText").value = config.copiedText;
  document.querySelector("#adminErrorText").value = config.errorText;
  showImagePreview(config.image);
}

function compressImage(file, maxWidth = 1600, quality = 0.78) {
  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.onload = () => {
      const image = new Image();
      image.onload = () => {
        const scale = Math.min(1, maxWidth / image.naturalWidth);
        const canvas = document.createElement("canvas");
        canvas.width = Math.round(image.naturalWidth * scale);
        canvas.height = Math.round(image.naturalHeight * scale);
        canvas.getContext("2d").drawImage(image, 0, 0, canvas.width, canvas.height);
        resolve(canvas.toDataURL("image/jpeg", quality));
      };
      image.onerror = () => resolve(reader.result);
      image.src = reader.result;
    };
    reader.onerror = () => resolve("");
    reader.readAsDataURL(file);
  });
}

function showImagePreview(source) {
  const preview = document.querySelector("#imagePreview");
  preview.replaceChildren();
  if (!source) {
    preview.textContent = "Sin imagen";
    return;
  }
  const image = document.createElement("img");
  image.src = source;
  preview.appendChild(image);
}

document.querySelector("#adminImage").addEventListener("change", async (event) => {
  const [file] = event.target.files;
  if (!file) return;
  const source = await compressImage(file);
  savedConfig.image = source;
  showImagePreview(source);
});

let pendingSectionImage = "";
document.querySelector("#sectionImage").addEventListener("change", async (event) => {
  const [file] = event.target.files;
  if (!file) return;
  pendingSectionImage = await compressImage(file);
  document.querySelector("#sectionImagePreview").innerHTML = `<img src="${pendingSectionImage}" alt="Vista previa">`;
});

function renderCustomSections(sections) {
  const container = document.querySelector("#customSections");
  const list = document.querySelector("#adminSectionList");
  container.replaceChildren();
  list.replaceChildren();

  sections.forEach((section, index) => {
    const article = document.createElement("article");
    article.className = "custom-section";
    if (section.image) {
      const image = document.createElement("img");
      image.src = section.image;
      image.alt = section.title;
      article.appendChild(image);
    }
    const copy = document.createElement("div");
    copy.innerHTML = `<small>SECCIÓN ${String(index + 1).padStart(2, "0")}</small><h2>${section.title}</h2><p>${section.text}</p>`;
    article.appendChild(copy);
    container.appendChild(article);

    const row = document.createElement("div");
    row.className = "admin-added-button";
    const label = document.createElement("span");
    label.textContent = section.title;
    const remove = document.createElement("button");
    remove.type = "button";
    remove.textContent = "Eliminar";
    remove.addEventListener("click", () => {
      savedConfig.sections.splice(index, 1);
      renderCustomSections(savedConfig.sections);
    });
    row.append(label, remove);
    list.appendChild(row);
  });
}

document.querySelector("#addSection").addEventListener("click", () => {
  const title = document.querySelector("#sectionTitle").value.trim();
  const text = document.querySelector("#sectionText").value.trim();
  if (!title && !text && !pendingSectionImage) return;
  savedConfig.sections.push({ title: title || "Nueva sección", text, image: pendingSectionImage });
  renderCustomSections(savedConfig.sections);
  document.querySelector("#sectionTitle").value = "";
  document.querySelector("#sectionText").value = "";
  document.querySelector("#sectionImage").value = "";
  document.querySelector("#sectionImagePreview").textContent = "Sin imagen";
  pendingSectionImage = "";
});

document.querySelector("#addButton").addEventListener("click", () => {
  const text = document.querySelector("#buttonText").value.trim();
  if (!text) return;
  savedConfig.buttons.push({
    text,
    action: document.querySelector("#buttonAction").value,
    url: document.querySelector("#buttonUrl").value.trim(),
    color: document.querySelector("#buttonColor").value
  });
  renderCustomButtons(savedConfig.buttons);
  document.querySelector("#buttonText").value = "";
});

document.querySelector("#adminSave").addEventListener("click", () => {
  savedConfig = {
    ...savedConfig,
    brand: document.querySelector("#adminBrand").value.trim() || defaultConfig.brand,
    eyebrow: document.querySelector("#adminEyebrow").value.trim() || defaultConfig.eyebrow,
    title: document.querySelector("#adminTitle").value.trim() || defaultConfig.title,
    description: document.querySelector("#adminDescription").value.trim() || defaultConfig.description,
    accent: document.querySelector("#adminAccent").value,
    accentTwo: document.querySelector("#adminAccentTwo").value,
    radius: document.querySelector("#adminRadius").value,
    backdrop: document.querySelector("#adminBackdrop").value,
    background: document.querySelector("#adminBackground").value,
    text: document.querySelector("#adminText").value,
    surface: document.querySelector("#adminSurface").value,
    font: document.querySelector("#adminFont").value,
    width: document.querySelector("#adminWidth").value,
    scale: Number(document.querySelector("#adminScale").value),
    opacity: Number(document.querySelector("#adminOpacity").value),
    blur: Number(document.querySelector("#adminBlur").value),
    spacing: Number(document.querySelector("#adminSpacing").value),
    layout: document.querySelector("#adminLayout").value,
    showPlatforms: document.querySelector("#showPlatforms").checked,
    showHeader: document.querySelector("#showHeader").checked,
    showFooter: document.querySelector("#showFooter").checked,
    showTip: document.querySelector("#showTip").checked,
    line: document.querySelector("#adminLine").value,
    borderWidth: Number(document.querySelector("#adminBorderWidth").value),
    glow: Number(document.querySelector("#adminGlow").value),
    shadow: document.querySelector("#adminShadow").value,
    animation: document.querySelector("#adminAnimation").value,
    decoration: document.querySelector("#adminDecoration").value,
    livePreview: document.querySelector("#livePreview").checked,
    loginTitle: document.querySelector("#adminLoginTitle").value.trim() || defaultConfig.loginTitle,
    loginSubtitle: document.querySelector("#adminLoginSubtitle").value.trim() || defaultConfig.loginSubtitle,
    loginButton: document.querySelector("#adminLoginButton").value.trim() || defaultConfig.loginButton,
    loginSmall: document.querySelector("#adminLoginSmall").value.trim() || defaultConfig.loginSmall,
    loginPosition: document.querySelector("#adminLoginPosition").value,
    status: document.querySelector("#adminStatus").value.trim(),
    generateText: document.querySelector("#adminGenerateText").value.trim(),
    copyText: document.querySelector("#adminCopyText").value.trim(),
    tipTitle: document.querySelector("#adminTipTitle").value.trim(),
    tipText: document.querySelector("#adminTipText").value.trim(),
    footerLeft: document.querySelector("#adminFooterLeft").value.trim(),
    footerRight: document.querySelector("#adminFooterRight").value.trim(),
    autoYear: document.querySelector("#adminAutoYear").value,
    showStatus: document.querySelector("#showStatus").checked,
    showLaunch: document.querySelector("#showLaunch").checked,
    showSensitivity: document.querySelector("#showSensitivity").checked,
    showAux: document.querySelector("#showAux").checked,
    copiedText: document.querySelector("#adminCopiedText").value.trim(),
    errorText: document.querySelector("#adminErrorText").value.trim()
  };
  try {
    const cleanConfig = JSON.parse(JSON.stringify(savedConfig));
    localStorage.setItem("hypersex-admin-config", JSON.stringify(cleanConfig));
    applyConfig(savedConfig);
    openAdmin(false);
    window.alert("Diseño guardado correctamente.");
  } catch (error) {
    console.error("No se pudo guardar el diseño:", error);
    window.alert("No se pudo guardar en este navegador. La configuración contiene datos demasiado grandes.");
  }
});

const themes = {
  hyper: { accent: "#d8dde5", accentTwo: "#8f96a3", background: "#080b12", surface: "#10141f", text: "#f5f6fa" },
  cyan: { accent: "#19d3c5", accentTwo: "#3b82f6", background: "#071019", surface: "#0d1b28", text: "#ecfeff" },
  gold: { accent: "#d9a441", accentTwo: "#f97316", background: "#0e0b07", surface: "#18140e", text: "#fff8e8" },
  light: { accent: "#7c3aed", accentTwo: "#ec4899", background: "#f1f3f8", surface: "#ffffff", text: "#17151f" }
};

document.querySelectorAll("[data-theme]").forEach((button) => {
  button.addEventListener("click", () => {
    const theme = themes[button.dataset.theme];
    document.querySelector("#adminAccent").value = theme.accent;
    document.querySelector("#adminAccentTwo").value = theme.accentTwo;
    document.querySelector("#adminBackground").value = theme.background;
    document.querySelector("#adminSurface").value = theme.surface;
    document.querySelector("#adminText").value = theme.text;
    if (document.querySelector("#livePreview").checked) {
      document.documentElement.style.setProperty("--accent", theme.accent);
      document.documentElement.style.setProperty("--accent-2", theme.accentTwo);
      document.documentElement.style.setProperty("--bg", theme.background);
      document.documentElement.style.setProperty("--surface", theme.surface + "9a");
      document.documentElement.style.setProperty("--text", theme.text);
    }
  });
});

document.querySelector("#importConfigButton").addEventListener("click", () => document.querySelector("#importConfig").click());

document.querySelector("#exportConfig").addEventListener("click", () => {
  const blob = new Blob([JSON.stringify(savedConfig, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = "hypersex-config.json";
  link.click();
  URL.revokeObjectURL(url);
});

document.querySelector("#importConfig").addEventListener("change", (event) => {
  const [file] = event.target.files;
  if (!file) return;
  const reader = new FileReader();
  reader.addEventListener("load", () => {
    try {
      savedConfig = { ...defaultConfig, ...JSON.parse(reader.result) };
      loadAdminFields(savedConfig);
      applyConfig(savedConfig);
      localStorage.setItem("hypersex-admin-config", JSON.stringify(savedConfig));
    } catch {
      window.alert("El archivo de configuración no es válido.");
    }
  });
  reader.readAsText(file);
});

const ipaInput = document.querySelector("#importIpa");
const ipaStatus = document.querySelector("#ipaStatus");
const ipaGallery = document.querySelector("#ipaGallery");

function findZipEnd(buffer) {
  const bytes = new Uint8Array(buffer);
  const start = Math.max(0, bytes.length - 65557);
  for (let index = bytes.length - 22; index >= start; index -= 1) {
    if (bytes[index] === 0x50 && bytes[index + 1] === 0x4b &&
        bytes[index + 2] === 0x05 && bytes[index + 3] === 0x06) return index;
  }
  return -1;
}

async function inflateZipPart(buffer, method) {
  if (method === 0) return buffer;
  if (method !== 8 || !("DecompressionStream" in window)) return null;
  const stream = new Blob([buffer]).stream().pipeThrough(new DecompressionStream("deflate-raw"));
  return new Response(stream).arrayBuffer();
}

async function readIpaImages(file) {
  const source = await file.arrayBuffer();
  const view = new DataView(source);
  const endOffset = findZipEnd(source);
  if (endOffset < 0) throw new Error("El archivo IPA no contiene un paquete ZIP válido.");

  const entriesOffset = view.getUint32(endOffset + 16, true);
  const entryCount = view.getUint16(endOffset + 10, true);
  const images = [];

  let offset = entriesOffset;
  for (let index = 0; index < entryCount; index += 1) {
    if (view.getUint32(offset, false) !== 0x02014b50) break;
    const method = view.getUint16(offset + 10, true);
    const compressedSize = view.getUint32(offset + 20, true);
    const uncompressedSize = view.getUint32(offset + 24, true);
    const nameSize = view.getUint16(offset + 28, true);
    const extraSize = view.getUint16(offset + 30, true);
    const commentSize = view.getUint16(offset + 32, true);
    const localOffset = view.getUint32(offset + 42, true);
    const nameBytes = new Uint8Array(source, offset + 46, nameSize);
    const name = new TextDecoder().decode(nameBytes);

    if (/\.(png|jpe?g|webp)$/i.test(name) && uncompressedSize <= 8 * 1024 * 1024) {
      const localNameSize = view.getUint16(localOffset + 26, true);
      const localExtraSize = view.getUint16(localOffset + 28, true);
      const dataOffset = localOffset + 30 + localNameSize + localExtraSize;
      const compressed = source.slice(dataOffset, dataOffset + compressedSize);
      const inflated = await inflateZipPart(compressed, method);
      if (inflated && inflated.byteLength === uncompressedSize) {
        const extension = name.split(".").pop().toLowerCase();
        const type = extension === "jpg" || extension === "jpeg" ? "image/jpeg" :
          extension === "png" ? "image/png" : "image/webp";
        images.push({ name, blob: new Blob([inflated], { type }) });
        if (images.length >= 24) break;
      }
    }
    offset += 46 + nameSize + extraSize + commentSize;
  }
  return images;
}

function blobToDataUrl(blob) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

document.querySelector("#scanIpa").addEventListener("click", async () => {
  const [file] = ipaInput.files;
  if (!file) {
    ipaStatus.textContent = "Selecciona primero un archivo .ipa.";
    return;
  }

  ipaStatus.textContent = "Leyendo imágenes...";
  ipaGallery.replaceChildren();
  try {
    const images = await readIpaImages(file);
    if (!images.length) {
      ipaStatus.textContent = "No se encontraron imágenes PNG, JPG o WEBP dentro del paquete.";
      return;
    }
    ipaStatus.textContent = `${images.length} imagen(es) encontrada(s). Selecciona una para usarla.`;
    for (const image of images) {
      const url = URL.createObjectURL(image.blob);
      const button = document.createElement("button");
      button.type = "button";
      button.title = image.name;
      const preview = document.createElement("img");
      preview.src = url;
      preview.alt = "";
      button.appendChild(preview);
      button.addEventListener("click", async () => {
        ipaGallery.querySelectorAll("button").forEach((item) => item.classList.remove("selected"));
        button.classList.add("selected");
        savedConfig.image = await blobToDataUrl(image.blob);
        showImagePreview(savedConfig.image);
        applyConfig(savedConfig);
        ipaStatus.textContent = "Imagen aplicada al diseño.";
      });
      ipaGallery.appendChild(button);
    }
  } catch (error) {
    ipaStatus.textContent = error.message || "No se pudo leer el archivo.";
  }
});

document.querySelector("#adminReset").addEventListener("click", () => {
  savedConfig = { ...defaultConfig, buttons: [] };
  localStorage.removeItem("hypersex-admin-config");
  loadAdminFields(savedConfig);
  applyConfig(savedConfig);
});

try {
  savedConfig = {
    ...defaultConfig,
    ...JSON.parse(localStorage.getItem("hypersex-admin-config") || "{}"),
    buttons: JSON.parse(localStorage.getItem("hypersex-admin-config") || "{}").buttons || [],
    sections: JSON.parse(localStorage.getItem("hypersex-admin-config") || "{}").sections || []
  };
} catch {
  savedConfig = { ...defaultConfig, buttons: [], sections: [] };
}
loadAdminFields(savedConfig);
applyConfig(savedConfig);
