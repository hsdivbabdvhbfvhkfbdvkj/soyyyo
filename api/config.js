const REPO_OWNER = process.env.CONFIG_REPO_OWNER || "hsdivbabdvhbfvhkfbdvkj";
const REPO_NAME = process.env.CONFIG_REPO_NAME || "soyyyo";
const CONFIG_PATH = "public-config.json";
const GITHUB_TOKEN = process.env.GITHUB_TOKEN || process.env.CONFIG_GITHUB_TOKEN;
const ADMIN_PASSWORD = process.env.ADMIN_EDIT_PASSWORD || "Hypersex2022@";

async function githubRequest(path, options = {}) {
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

module.exports = async function handler(request, response) {
  response.setHeader("Cache-Control", "no-store");

  if (request.method === "GET") {
    try {
      const result = await githubRequest(`contents/${CONFIG_PATH}?ref=main`);
      if (result.status === 404) {
        return response.status(200).json({ success: true, config: {} });
      }
      if (!result.ok) throw new Error(`GitHub respondió ${result.status}`);
      const file = await result.json();
      const content = Buffer.from(file.content.replace(/\n/g, ""), "base64").toString("utf8");
      return response.status(200).json({ success: true, config: JSON.parse(content) });
    } catch (error) {
      return response.status(200).json({ success: true, config: {} });
    }
  }

  if (request.method !== "POST") {
    return response.status(405).json({ success: false, message: "Método no permitido." });
  }

  if (!GITHUB_TOKEN) {
    return response.status(503).json({
      success: false,
      message: "CONFIG_GITHUB_TOKEN no está configurado en Vercel."
    });
  }

  if (String(request.headers["x-admin-password"] || "") !== ADMIN_PASSWORD) {
    return response.status(403).json({ success: false, message: "Contraseña de administrador incorrecta." });
  }

  const config = request.body?.config;
  if (!config || typeof config !== "object" || Array.isArray(config)) {
    return response.status(400).json({ success: false, message: "Configuración inválida." });
  }

  try {
    const existingResponse = await githubRequest(`contents/${CONFIG_PATH}?ref=main`);
    let sha;
    if (existingResponse.ok) sha = (await existingResponse.json()).sha;

    const content = Buffer.from(JSON.stringify(config, null, 2)).toString("base64");
    const updateResponse = await githubRequest(`contents/${CONFIG_PATH}`, {
      method: "PUT",
      body: JSON.stringify({
        message: "Update public site configuration",
        content,
        branch: "main",
        ...(sha ? { sha } : {})
      })
    });
    const update = await updateResponse.json();
    if (!updateResponse.ok) throw new Error(update.message || `GitHub respondió ${updateResponse.status}`);

    return response.status(200).json({ success: true, message: "Diseño publicado para todos." });
  } catch (error) {
    return response.status(502).json({ success: false, message: error.message });
  }
};
