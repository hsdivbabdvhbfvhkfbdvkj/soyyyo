const KEYAUTH_ENDPOINT = "https://keyauth.win/api/1.2/";

module.exports = async function handler(request, response) {
  response.setHeader("Cache-Control", "no-store");

  if (request.method !== "POST") {
    return response.status(405).json({ success: false, message: "Metodo no permitido." });
  }

  const action = request.query && request.query.action;
  if (action !== "init" && action !== "login") {
    return response.status(400).json({ success: false, message: "Accion no valida." });
  }

  const secret = process.env.KEYAUTH_SECRET;
  if (!secret) {
    return response.status(500).json({ success: false, message: "KEYAUTH_SECRET no configurado." });
  }

  const fields = request.body && typeof request.body === "object"
    ? request.body
    : Object.fromEntries(new URLSearchParams(request.body || ""));

  const body = new URLSearchParams({
    name: process.env.KEYAUTH_NAME || "hypersex",
    ownerid: process.env.KEYAUTH_OWNERID || "YmAfMJLZpB",
    type: action,
    ver: process.env.KEYAUTH_VERSION || "1.0",
    secret,
    ...(action === "login" ? {
      username: String(fields.username || ""),
      pass: String(fields.password || ""),
      sessionid: String(fields.sessionid || "")
    } : {})
  });

  try {
    const keyauthResponse = await fetch(KEYAUTH_ENDPOINT, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: body.toString()
    });
    const text = await keyauthResponse.text();

    try {
      return response.status(keyauthResponse.ok ? 200 : 502).json(JSON.parse(text));
    } catch {
      return response.status(502).json({
        success: false,
        message: text || "Respuesta invalida de KeyAuth."
      });
    }
  } catch (error) {
    return response.status(502).json({
      success: false,
      message: error.message || "No se pudo conectar con KeyAuth."
    });
  }
};
