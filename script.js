const state = {
  device: "android",
  style: "precision"
};

let keyauthSessionId = "";

async function initializeKeyAuth() {
  const status = document.querySelector("#keyauthStatus");
  status.textContent = "Conectando...";
  try {
    const response = await fetch("/api/keyauth?action=init", { method: "POST" });
    const result = await response.json();
    if (!result.success || !result.sessionid) throw new Error(result.message || "No se pudo iniciar KeyAuth.");
    keyauthSessionId = result.sessionid;
    status.textContent = "";
  } catch (error) {
    status.textContent = error.message;
  }
}

document.querySelector("#keyauthForm").addEventListener("submit", async (event) => {
  event.preventDefault();
  const status = document.querySelector("#keyauthStatus");
  status.textContent = "Validando licencia...";
  try {
    if (!keyauthSessionId) await initializeKeyAuth();
    const response = await fetch("/api/keyauth?action=login", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        username: document.querySelector("#keyauthUsername").value,
        password: document.querySelector("#keyauthPassword").value,
        sessionid: keyauthSessionId
      })
    });
    const result = await response.json();
    if (!result.success) throw new Error(result.message || "Credenciales o licencia invalidas.");
    document.querySelector("#keyauthLock").classList.add("hidden");
    status.textContent = "";
  } catch (error) {
    status.textContent = error.message;
  }
});

initializeKeyAuth();

const launchGame = document.querySelector("#launchGame");
const launchPlatform = document.querySelector("#launchPlatform");
const downloadDnsProfile = document.querySelector("#downloadDnsProfile");
const dnsStatus = document.querySelector("#dnsStatus");

const styleProfiles = {
  precision: { general: 184, red: 176, x2: 164, x4: 152, sniper: 140, free: 172, label: "Precisión" },
  balanced: { general: 176, red: 168, x2: 160, x4: 156, sniper: 148, free: 164, label: "Equilibrado" },
  aggressive: { general: 192, red: 186, x2: 176, x4: 168, sniper: 156, free: 182, label: "Acelerado" }
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
  dpiValue.textContent = dpiInput.value;
});

document.querySelectorAll("[data-device]").forEach((button) => {
  button.addEventListener("click", () => {
    document.querySelectorAll("[data-device]").forEach((item) => item.classList.remove("selected"));
    document.querySelectorAll("[data-device]").forEach((item) => item.classList.remove("active"));
    button.classList.add(button.dataset.device === "android" ? "active" : "active");
    state.device = button.dataset.device;
    configureDpiRange();
    downloadDnsProfile.hidden = state.device !== "ios";
    dnsStatus.textContent = "";
    launchPlatform.textContent = state.device === "ios" ? "iOS" : "Android";
    document.querySelector("#systemPlatform").textContent = state.device === "ios" ? "iOS" : "Android";
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

  window.location.href =
    "intent://launch/#Intent;scheme=freefire;package=com.dts.freefireth;end";
});

function configureDpiRange() {
  if (state.device === "ios") {
    dpiInput.min = "1";
    dpiInput.max = "120";
    dpiInput.step = "1";
    dpiInput.value = "60";
  } else {
    dpiInput.min = "240";
    dpiInput.max = "800";
    dpiInput.step = "20";
    dpiInput.value = "480";
  }
  dpiValue.textContent = dpiInput.value;
  document.querySelector("#profileBadge").textContent =
    `${state.device === "ios" ? "iOS" : "Android"} / ${styleProfiles[state.style].label}`;
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
    auxStatus.textContent = `Perfil calibrado al ${auxRange.value}%`;
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
      `${state.device === "ios" ? "iOS" : "Android"} / ${styleProfiles[state.style].label}`;
  });
});

function getGeneratedProfile() {
  const base = styleProfiles[state.style];
  const referenceDpi = state.device === "ios" ? 60 : 480;
  const dpiStep = state.device === "ios" ? 15 : 80;
  const dpiFactor = Math.round((Number(dpiInput.value) - referenceDpi) / dpiStep);
  const deviceFactor = state.device === "ios" ? -2 : 0;
  const adjustment = dpiFactor + deviceFactor;

  return {
    label: base.label,
    general: Math.max(30, Math.min(200, base.general + adjustment * 2)),
    red: Math.max(30, Math.min(200, base.red + adjustment * 2)),
    x2: Math.max(30, Math.min(200, base.x2 + adjustment * 2)),
    x4: Math.max(30, Math.min(200, base.x4 + adjustment * 2)),
    sniper: Math.max(30, Math.min(200, base.sniper + adjustment * 2)),
    free: Math.max(30, Math.min(200, base.free + adjustment * 2))
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
  eyebrow: "CONTROL CENTER",
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
  buttons: []
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

function executeButtonAction(action) {
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
    button.addEventListener("click", () => executeButtonAction(buttonConfig.action));
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
}

function loadAdminFields(config) {
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

document.querySelector("#adminImage").addEventListener("change", (event) => {
  const [file] = event.target.files;
  if (!file) return;
  const reader = new FileReader();
  reader.addEventListener("load", () => {
    savedConfig.image = reader.result;
    showImagePreview(reader.result);
  });
  reader.readAsDataURL(file);
});

document.querySelector("#addButton").addEventListener("click", () => {
  const text = document.querySelector("#buttonText").value.trim();
  if (!text) return;
  savedConfig.buttons.push({
    text,
    action: document.querySelector("#buttonAction").value
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
  localStorage.setItem("hypersex-admin-config", JSON.stringify(savedConfig));
  applyConfig(savedConfig);
  openAdmin(false);
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
  savedConfig = { ...defaultConfig, ...JSON.parse(localStorage.getItem("hypersex-admin-config")) };
} catch {
  savedConfig = { ...defaultConfig };
}
loadAdminFields(savedConfig);
applyConfig(savedConfig);
