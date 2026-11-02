const loginPanel = document.querySelector("#loginPanel");
const dashboard = document.querySelector("#dashboard");
const loginStatus = document.querySelector("#loginStatus");
const licenseRows = document.querySelector("#licenseRows");
const sessionKey = "licenseSession";
let session = JSON.parse(sessionStorage.getItem(sessionKey) || "null");

async function api(action, data = {}) {
  const response = await fetch(`/api/licenses?action=${action}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ ...data, username: session.username, password: session.password })
  });
  const result = await response.json();
  if (!response.ok || result.success === false) throw new Error(result.message || "Error del servidor.");
  return result;
}

async function enter() {
  const username = document.querySelector("#adminUsername").value.trim() || session?.username || "";
  const password = document.querySelector("#adminPassword").value || session?.password || "";
  loginStatus.textContent = "Verificando acceso...";

  try {
    const response = await fetch("/api/licenses?action=login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username, password })
    });
    const result = await response.json();
    if (!response.ok || !result.success) throw new Error(result.message || "Usuario o contraseña incorrectos.");

    session = { username: result.username, password, role: result.role };
    sessionStorage.setItem(sessionKey, JSON.stringify(session));
    loginPanel.hidden = true;
    dashboard.hidden = false;
    document.querySelector("#activeUser").textContent = `${result.role === "admin" ? "ADMIN" : "USUARIO"} · ${result.username}`;

    if (result.role === "admin") {
      await Promise.all([loadLicenses(), loadUsers()]);
    } else {
      document.querySelector("#userManagement").hidden = true;
      const ownerInput = document.querySelector("#owner");
      ownerInput.value = result.username;
      ownerInput.readOnly = true;
      document.querySelector(".page-heading p").textContent = "Consulta y gestiona las keys asociadas a tu cuenta.";
      await loadLicenses();
    }
  } catch (error) {
    session = null;
    sessionStorage.removeItem(sessionKey);
    loginStatus.textContent = error.message;
  }
}

async function loadLicenses() {
  const result = await api("list");
  if (!result.licenses.length) {
    licenseRows.innerHTML = '<tr><td colspan="7">No hay licencias registradas.</td></tr>';
    return;
  }

  licenseRows.innerHTML = result.licenses.map((license) => {
    const expired = license.expiresAt <= Date.now();
    const statusClass = license.revoked ? "banned" : expired ? "expired" : "";
    const statusText = license.revoked ? "Bloqueada" : expired ? "Expirada" : "Activa";
    return `<tr>
      <td><code>${license.id}</code></td>
      <td>${license.key
        ? `<div class="key-cell"><code>${license.key}</code><button data-copy-key="${license.key}" type="button" aria-label="Copiar clave">Copiar</button></div>`
        : '<span class="legacy-key">No recuperable</span>'}</td>
      <td>${license.owner || "—"}</td>
      <td><span class="status ${statusClass}">${statusText}</span></td>
      <td>${license.hwids.length}/1</td>
      <td>${new Date(license.expiresAt).toLocaleString("es")}</td>
      <td><div class="actions">
        <label class="renew-duration" aria-label="Nueva duración">
          <input data-renew-days type="number" min="0" max="36500" value="30"><span>d</span>
          <input data-renew-hours type="number" min="0" max="23" value="0"><span>h</span>
        </label>
        <button data-action="renew" data-hash="${license.hash}" type="button">Aplicar</button>
        <button data-action="revoke" data-hash="${license.hash}" type="button">${license.revoked ? "Reactivar" : "Bloquear"}</button>
        <button class="danger" data-action="delete" data-hash="${license.hash}" type="button">Eliminar</button>
      </div></td>
    </tr>`;
  }).join("");
}

async function loadUsers() {
  const result = await api("users");
  const userList = document.querySelector("#userList");
  userList.innerHTML = result.users.length
    ? `<table><thead><tr><th>Usuario</th><th>Acción</th></tr></thead><tbody>${result.users.map((user) => `<tr><td>${user.username}</td><td><button class="danger" data-delete-user="${user.username}" type="button">Eliminar</button></td></tr>`).join("")}</tbody></table>`
    : '<p style="padding:12px;color:#8795aa">Aún no hay cuentas secundarias.</p>';
}

document.querySelector("#enterAdmin").addEventListener("click", enter);
document.querySelector("#adminPassword").addEventListener("keydown", (event) => {
  if (event.key === "Enter") enter();
});
document.querySelector("#logout").addEventListener("click", () => {
  sessionStorage.removeItem(sessionKey);
  location.reload();
});

document.querySelector("#generate").addEventListener("click", async () => {
  const button = document.querySelector("#generate");
  button.disabled = true;
  try {
    const result = await api("generate", {
      count: document.querySelector("#count").value,
      days: document.querySelector("#days").value,
      hours: document.querySelector("#hours").value,
      owner: document.querySelector("#owner").value
    });
    const output = document.querySelector("#newKeys");
    output.value = result.keys.join("\n");
    output.style.display = "block";
    await loadLicenses();
  } catch (error) {
    alert(error.message);
  } finally {
    button.disabled = false;
  }
});

document.querySelector("#createUser").addEventListener("click", async () => {
  try {
    await api("create-user", {
      newUsername: document.querySelector("#newUsername").value,
      newPassword: document.querySelector("#newUserPassword").value
    });
    document.querySelector("#newUsername").value = "";
    document.querySelector("#newUserPassword").value = "";
    await loadUsers();
  } catch (error) {
    alert(error.message);
  }
});

licenseRows.addEventListener("click", async (event) => {
  const copyButton = event.target.closest("button[data-copy-key]");
  if (copyButton) {
    try {
      await navigator.clipboard.writeText(copyButton.dataset.copyKey);
      copyButton.textContent = "Copiada";
      window.setTimeout(() => { copyButton.textContent = "Copiar"; }, 1200);
    } catch {
      alert("No se pudo acceder al portapapeles.");
    }
    return;
  }
  const button = event.target.closest("button[data-action]");
  if (!button) return;
  if (button.dataset.action === "delete" && !confirm("¿Eliminar esta licencia permanentemente?")) return;
  try {
    const data = { hash: button.dataset.hash };
    if (button.dataset.action === "renew") {
      const row = button.closest("tr");
      data.days = row.querySelector("[data-renew-days]").value;
      data.hours = row.querySelector("[data-renew-hours]").value;
    }
    await api(button.dataset.action, data);
    await loadLicenses();
  } catch (error) {
    alert(error.message);
  }
});

document.querySelector("#userList").addEventListener("click", async (event) => {
  const button = event.target.closest("button[data-delete-user]");
  if (!button || !confirm(`¿Eliminar la cuenta ${button.dataset.deleteUser}?`)) return;
  try {
    await api("delete-user", { username: button.dataset.deleteUser });
    await loadUsers();
  } catch (error) {
    alert(error.message);
  }
});

if (session) {
  document.querySelector("#adminUsername").value = session.username;
  document.querySelector("#adminPassword").value = session.password;
  enter();
}
