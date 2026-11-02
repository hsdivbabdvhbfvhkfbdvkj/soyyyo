const crypto = require("crypto");

const REPO_OWNER = process.env.CONFIG_REPO_OWNER || "hsdivbabdvhbfvhkfbdvkj";
const REPO_NAME = process.env.CONFIG_REPO_NAME || "soyyyo";
const STORE_PATH = "licenses.json";
const GITHUB_TOKEN = process.env.GITHUB_TOKEN || process.env.CONFIG_GITHUB_TOKEN;
const ADMIN_PASSWORD = process.env.ADMIN_EDIT_PASSWORD?.trim();
const LICENSE_SECRET = process.env.LICENSE_SECRET?.trim();

function hashKey(key) {
  return crypto.createHash("sha256").update(String(key).trim().toUpperCase()).digest("hex");
}

function randomCode(length = 16) {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  const bytes = crypto.randomBytes(length);
  return Array.from(bytes, (value) => alphabet[value % alphabet.length]).join("");
}

function createKey() {
  const groups = [randomCode(4), randomCode(4), randomCode(4)];
  return `HYPER-${groups.join("-")}`;
}

async function github(path, options = {}) {
  return fetch(`https://api.github.com/repos/${REPO_OWNER}/${REPO_NAME}/${path}`, {
    ...options,
    headers: {
      Accept: "application/vnd.github+json",
      Authorization: `Bearer ${GITHUB_TOKEN}`,
      "X-GitHub-Api-Version": "2022-11-28",
      "Content-Type": "application/json",
      ...(options.headers || {})
    }
  });
}

async function readStore() {
  const response = await github(`contents/${STORE_PATH}?ref=main`);
  if (response.status === 404) return { version: 1, licenses: [] };
  if (!response.ok) throw new Error("No se pudo leer el almacenamiento de licencias.");
  const file = await response.json();
  return JSON.parse(Buffer.from(file.content.replace(/\n/g, ""), "base64").toString("utf8"));
}

async function writeStore(store, shaMessage = "Update licenses") {
  const existing = await github(`contents/${STORE_PATH}?ref=main`);
  let sha;
  if (existing.ok) sha = (await existing.json()).sha;
  const response = await github(`contents/${STORE_PATH}`, {
    method: "PUT",
    body: JSON.stringify({
      message: shaMessage,
      content: Buffer.from(JSON.stringify(store, null, 2)).toString("base64"),
      branch: "main",
      ...(sha ? { sha } : {})
    })
  });
  if (!response.ok) throw new Error((await response.json()).message || "No se pudo guardar la licencia.");
}

module.exports = async function handler(request, response) {
  response.setHeader("Cache-Control", "no-store");

  const action = request.query?.action;
  const body = typeof request.body === "string" ? Object.fromEntries(new URLSearchParams(request.body)) : request.body || {};

  if (request.method !== "POST") {
    return response.status(405).json({ success: false, message: "Método no permitido." });
  }
  if (!action || !["generate", "validate", "list", "revoke", "renew", "delete"].includes(action)) {
    return response.status(400).json({ success: false, message: "Acción inválida." });
  }
  if (!LICENSE_SECRET) {
    return response.status(503).json({ success: false, message: "LICENSE_SECRET no está configurado." });
  }

  try {
    const adminActions = ["generate", "list", "revoke", "renew", "delete"];
    if (adminActions.includes(action)) {
      if (!GITHUB_TOKEN || !ADMIN_PASSWORD || String(request.headers["x-admin-password"] || "") !== ADMIN_PASSWORD) {
        return response.status(403).json({ success: false, message: "Acceso administrativo inválido." });
      }
    }

    if (action === "generate") {
      if (!GITHUB_TOKEN || !ADMIN_PASSWORD) {
        return response.status(503).json({ success: false, message: "Generador no configurado en el servidor." });
      }
      if (String(request.headers["x-admin-password"] || "") !== ADMIN_PASSWORD) {
        return response.status(403).json({ success: false, message: "Contraseña de administrador incorrecta." });
      }

      const count = Math.max(1, Math.min(100, Number(body.count) || 1));
      const days = Math.max(1, Math.min(36500, Number(body.days) || 30));
      const store = await readStore();
      const generated = [];
      const expiresAt = Date.now() + days * 86400000;

      while (generated.length < count) {
        const key = createKey();
        if (store.licenses.some((item) => item.hash === hashKey(key))) continue;
        store.licenses.push({
          hash: hashKey(key),
          createdAt: Date.now(),
          expiresAt,
          maxDevices: Math.max(1, Math.min(10, Number(body.devices) || 1)),
          hwids: []
        });
        generated.push(key);
      }

      await writeStore(store, `Generate ${count} licenses`);
      return response.status(200).json({ success: true, keys: generated, expiresAt });
    }

    if (["list", "revoke", "renew", "delete"].includes(action)) {
      const store = await readStore();
      if (action === "list") return response.status(200).json({ success: true, licenses: store.licenses.map((item) => ({ hash: item.hash, id: item.hash.slice(0, 8).toUpperCase(), expiresAt: item.expiresAt, maxDevices: item.maxDevices || 1, hwids: item.hwids || [], revoked: Boolean(item.revoked) })) });
      const record = store.licenses.find((item) => item.hash === String(body.hash || ""));
      if (!record) return response.status(404).json({ success: false, message: "Licencia no encontrada." });
      if (action === "revoke") record.revoked = !record.revoked;
      if (action === "renew") record.expiresAt = Date.now() + 30 * 86400000;
      if (action === "delete") store.licenses = store.licenses.filter((item) => item.hash !== record.hash);
      await writeStore(store, `${action} license ${record.hash.slice(0, 8)}`);
      return response.status(200).json({ success: true });
    }

    const key = String(body.key || "").trim().toUpperCase();
    const hwid = String(body.hwid || "").trim();
    if (!key || !hwid) {
      return response.status(400).json({ success: false, message: "Key o HWID ausente." });
    }

    const store = await readStore();
    const record = store.licenses.find((item) => item.hash === hashKey(key));
    if (!record) return response.status(404).json({ success: false, message: "Licencia inválida." });
    if (record.revoked) return response.status(403).json({ success: false, message: "Licencia revocada." });
    if (record.expiresAt <= Date.now()) return response.status(403).json({ success: false, message: "Licencia expirada." });

    const registered = Array.isArray(record.hwids) ? record.hwids : [];
    if (!registered.includes(hwid) && registered.length >= (record.maxDevices || 1)) {
      return response.status(403).json({ success: false, message: "KEY EN USO EN OTRO DISPOSITIVO" });
    }
    if (!registered.includes(hwid)) {
      registered.push(hwid);
      record.hwids = registered;
      await writeStore(store, "Register license device");
    }

    const signature = crypto.createHmac("sha256", LICENSE_SECRET)
      .update(`${hashKey(key)}:${hwid}:${record.expiresAt}`)
      .digest("hex");
    return response.status(200).json({ success: true, expires: record.expiresAt, signature });
  } catch (error) {
    return response.status(502).json({ success: false, message: error.message || "Error del servidor de licencias." });
  }
};
