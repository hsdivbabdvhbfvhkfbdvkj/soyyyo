const crypto = require("crypto");

const REPO_OWNER = process.env.CONFIG_REPO_OWNER || "hsdivbabdvhbfvhkfbdvkj";
const REPO_NAME = process.env.CONFIG_REPO_NAME || "soyyyo";
const STORE_PATH = "licenses.json";
const GITHUB_TOKEN = process.env.GITHUB_TOKEN || process.env.CONFIG_GITHUB_TOKEN;
const ADMIN_USER = process.env.ADMIN_USER?.trim() || "sebastian65";
const ADMIN_PASSWORD = process.env.ADMIN_EDIT_PASSWORD?.trim();
const LICENSE_SECRET = process.env.LICENSE_SECRET?.trim();
const ALLOWED_ORIGINS = new Set(["https://soyyyo.vercel.app", "https://hypersex-licencias.vercel.app"]);

const hash = (value) => crypto.createHash("sha256").update(String(value)).digest("hex");
const keyHash = (key) => hash(String(key).trim().toUpperCase());
const passwordHash = (password) => hash(`${LICENSE_SECRET}:${String(password)}`);
const cleanUser = (value) => String(value || "").trim().toLowerCase().slice(0, 50);
const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

function createKey() {
  const code = Array.from(crypto.randomBytes(12), (value) => alphabet[value % alphabet.length]).join("");
  return `HYPER-${code.slice(0, 4)}-${code.slice(4, 8)}-${code.slice(8, 12)}`;
}

function encryptKey(key) {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", Buffer.from(hash(LICENSE_SECRET), "hex"), iv);
  const encrypted = Buffer.concat([cipher.update(key, "utf8"), cipher.final()]);
  return Buffer.concat([iv, cipher.getAuthTag(), encrypted]).toString("base64");
}

function decryptKey(value) {
  if (!value) return null;
  try {
    const packed = Buffer.from(value, "base64");
    const iv = packed.subarray(0, 12);
    const tag = packed.subarray(12, 28);
    const encrypted = packed.subarray(28);
    const decipher = crypto.createDecipheriv("aes-256-gcm", Buffer.from(hash(LICENSE_SECRET), "hex"), iv);
    decipher.setAuthTag(tag);
    return Buffer.concat([decipher.update(encrypted), decipher.final()]).toString("utf8");
  } catch {
    return null;
  }
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
  if (response.status === 404) return { version: 1, users: [], licenses: [] };
  if (!response.ok) throw new Error("Could not read the license store.");
  const file = await response.json();
  const store = JSON.parse(Buffer.from(file.content.replace(/\n/g, ""), "base64").toString("utf8"));
  store.users ||= [];
  store.licenses ||= [];
  return store;
}

async function writeStore(store, message) {
  const existing = await github(`contents/${STORE_PATH}?ref=main`);
  let sha;
  if (existing.ok) sha = (await existing.json()).sha;
  const response = await github(`contents/${STORE_PATH}`, {
    method: "PUT",
    body: JSON.stringify({
      message,
      content: Buffer.from(JSON.stringify(store, null, 2)).toString("base64"),
      branch: "main",
      ...(sha ? { sha } : {})
    })
  });
  if (!response.ok) throw new Error((await response.json()).message || "Could not save license data.");
}

module.exports = async function handler(request, response) {
  response.setHeader("Cache-Control", "no-store");
  const origin = request.headers.origin;
  if (ALLOWED_ORIGINS.has(origin)) {
    response.setHeader("Access-Control-Allow-Origin", origin);
    response.setHeader("Vary", "Origin");
  }
  response.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  response.setHeader("Access-Control-Allow-Headers", "Content-Type");
  if (request.method === "OPTIONS") return response.status(204).end();
  if (request.method !== "POST") return response.status(405).json({ success: false, message: "Method not allowed." });

  const body = typeof request.body === "string"
    ? Object.fromEntries(new URLSearchParams(request.body))
    : request.body || {};
  const action = request.query?.action;
  const actions = ["login", "validate", "generate", "list", "revoke", "renew", "delete", "users", "create-user", "delete-user"];
  if (!actions.includes(action)) return response.status(400).json({ success: false, message: "Invalid action." });
  if (!LICENSE_SECRET || !ADMIN_PASSWORD) return response.status(503).json({ success: false, message: "License authentication is not configured." });

  try {
    const store = await readStore();
    const username = cleanUser(body.username);
    const admin = username === ADMIN_USER.toLowerCase() && String(body.password || "") === ADMIN_PASSWORD;
    const associatedUser = store.users.find((item) => cleanUser(item.username) === username && item.passwordHash === passwordHash(body.password) && !item.disabled);

    if (action === "login") {
      if (admin) return response.status(200).json({ success: true, role: "admin", username: ADMIN_USER });
      if (associatedUser) return response.status(200).json({ success: true, role: "user", username });
      return response.status(403).json({ success: false, message: "Incorrect username or password." });
    }

    if (action !== "validate" && !admin && !associatedUser) {
      return response.status(403).json({ success: false, message: "Invalid account access." });
    }
    if (!admin && ["users", "create-user", "delete-user"].includes(action)) {
      return response.status(403).json({ success: false, message: "Only the administrator can manage accounts." });
    }
    if (!GITHUB_TOKEN) return response.status(503).json({ success: false, message: "GITHUB_TOKEN is not configured." });

    if (action === "users") {
      return response.status(200).json({ success: true, users: store.users.map(({ passwordHash: _secret, ...user }) => user) });
    }

    if (action === "create-user") {
      const newUsername = cleanUser(body.newUsername);
      const newPassword = String(body.newPassword || "");
      if (newUsername.length < 3 || newPassword.length < 8) {
        return response.status(400).json({ success: false, message: "Username must have 3 characters and password 8 characters." });
      }
      if (newUsername === ADMIN_USER.toLowerCase() || store.users.some((user) => cleanUser(user.username) === newUsername)) {
        return response.status(409).json({ success: false, message: "That username already exists." });
      }
      store.users.push({ username: newUsername, passwordHash: passwordHash(newPassword), createdAt: Date.now(), disabled: false });
      await writeStore(store, `Create user ${newUsername}`);
      return response.status(200).json({ success: true, username: newUsername });
    }

    if (action === "delete-user") {
      store.users = store.users.filter((user) => cleanUser(user.username) !== cleanUser(body.username));
      await writeStore(store, `Delete user ${body.username}`);
      return response.status(200).json({ success: true });
    }

    if (action === "generate") {
      const count = Math.max(1, Math.min(10000, Number(body.count) || 1));
      const days = Math.max(0, Math.min(36500, Number(body.days ?? 30) || 0));
      const hours = Math.max(0, Math.min(23, Number(body.hours) || 0));
      const duration = days * 86400000 + hours * 3600000;
      if (duration < 3600000) return response.status(400).json({ success: false, message: "Duration must be at least one hour." });
      const requestedOwner = String(body.owner || username).trim().slice(0, 80);
      const owner = admin ? requestedOwner : username;
      const expiresAt = Date.now() + duration;
      const keys = [];
      while (keys.length < count) {
        const key = createKey();
        if (store.licenses.some((license) => license.hash === keyHash(key))) continue;
        store.licenses.push({
          hash: keyHash(key),
          encryptedKey: encryptKey(key),
          owner,
          createdAt: Date.now(),
          expiresAt,
          maxDevices: 1,
          hwids: [],
          revoked: false
        });
        keys.push(key);
      }
      await writeStore(store, `Generate ${count} licenses`);
      return response.status(200).json({ success: true, keys, expiresAt });
    }

    if (["list", "revoke", "renew", "delete"].includes(action)) {
      if (action === "list") {
        const visibleLicenses = admin
          ? store.licenses
          : store.licenses.filter((license) => cleanUser(license.owner) === username);
        return response.status(200).json({
          success: true,
          licenses: visibleLicenses.map((license) => ({
            hash: license.hash,
            id: license.hash.slice(0, 8).toUpperCase(),
            key: decryptKey(license.encryptedKey),
            owner: license.owner || "",
            expiresAt: license.expiresAt,
            maxDevices: 1,
            hwids: license.hwids || [],
            revoked: Boolean(license.revoked)
          }))
        });
      }
      const license = store.licenses.find((item) => item.hash === String(body.hash || ""));
      if (!license) return response.status(404).json({ success: false, message: "License not found." });
      if (!admin && cleanUser(license.owner) !== username) return response.status(404).json({ success: false, message: "License not found." });
      if (action === "revoke") license.revoked = !license.revoked;
      if (action === "renew") {
        const days = Math.max(0, Math.min(36500, Number(body.days ?? 30) || 0));
        const hours = Math.max(0, Math.min(23, Number(body.hours) || 0));
        const duration = days * 86400000 + hours * 3600000;
        if (duration < 3600000) return response.status(400).json({ success: false, message: "Duration must be at least one hour." });
        license.expiresAt = Date.now() + duration;
      }
      if (action === "delete") store.licenses = store.licenses.filter((item) => item.hash !== license.hash);
      await writeStore(store, `${action} license ${license.hash.slice(0, 8)}`);
      return response.status(200).json({ success: true });
    }

    const key = String(body.key || "").trim().toUpperCase();
    const hwid = String(body.hwid || "").trim();
    if (!key || !hwid) return response.status(400).json({ success: false, message: "Key or HWID is missing." });
    const license = store.licenses.find((item) => item.hash === keyHash(key));
    if (!license) return response.status(404).json({ success: false, message: "Invalid license." });
    if (license.revoked) return response.status(403).json({ success: false, message: "License blocked." });
    if (license.expiresAt <= Date.now()) return response.status(403).json({ success: false, message: "License expired." });
    license.hwids ||= [];
    if (license.hwids.length && license.hwids[0] !== hwid) {
      return response.status(403).json({ success: false, message: "KEY EN USO EN OTRO DISPOSITIVO" });
    }
    if (!license.hwids.includes(hwid)) {
      license.hwids.push(hwid);
      await writeStore(store, "Register license device");
    }
    return response.status(200).json({ success: true, expires: license.expiresAt });
  } catch (error) {
    return response.status(502).json({ success: false, message: error.message || "License server error." });
  }
};
