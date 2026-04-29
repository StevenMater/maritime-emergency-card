import { zipSync } from "fflate"

const VALID_AREAS = ["netherlands"]
const VALID_LANGS = ["nl", "en", "fr", "de"]

const AREA_LABEL = {
  netherlands: "Netherlands",
}

const LANG_LABEL = {
  nl: "NL",
  en: "EN",
  fr: "FR",
  de: "DE",
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url)

    if (request.method === "OPTIONS") {
      return corsResponse(null, 204, env)
    }

    if (request.method === "GET" && url.pathname === "/admin") {
      return adminPage()
    }

    if (request.method === "POST" && url.pathname === "/check-code") {
      return handleCheckCode(request, env)
    }

    if (request.method === "POST" && url.pathname === "/create-code") {
      return handleCreateCode(request, env)
    }

    if (request.method === "POST" && url.pathname === "/generate-pdf") {
      return handleGeneratePdf(request, env)
    }

    if (request.method === "POST" && url.pathname === "/email-backup") {
      return handleEmailBackup(request, env)
    }

    if (request.method === "POST" && url.pathname === "/admin/emails") {
      return handleListEmails(request, env)
    }

    return corsResponse({ error: "Not found" }, 404, env)
  },
}

// ── /check-code ────────────────────────────────────────────────────
async function handleCheckCode(request, env) {
  const { code } = await request.json().catch(() => ({}))
  if (!code) return corsResponse({ valid: false }, 200, env)

  if (code === env.MASTER_CODE) {
    return corsResponse({ valid: true, uses: "unlimited" }, 200, env)
  }

  const raw = await env.BYPASS_CODES.get(code)
  if (!raw) return corsResponse({ valid: false }, 200, env)

  const { uses_remaining } = JSON.parse(raw)
  return corsResponse({ valid: true, uses: uses_remaining }, 200, env)
}

// ── /create-code ───────────────────────────────────────────────────
async function handleCreateCode(request, env) {
  const { masterCode, uses } = await request.json().catch(() => ({}))

  if (masterCode !== env.MASTER_CODE) {
    return corsResponse({ error: "Forbidden" }, 403, env)
  }

  const code = generateCode()
  await env.BYPASS_CODES.put(code, JSON.stringify({ uses_remaining: uses || 1 }))
  return corsResponse({ code }, 200, env)
}

// ── /generate-pdf ──────────────────────────────────────────────────
async function handleGeneratePdf(request, env) {
  const body = await request.json().catch(() => null)
  if (!body) return corsResponse({ error: "Invalid body" }, 400, env)

  const { type, session, code, formData, languages, area } = body

  if (!Array.isArray(languages) || languages.length === 0 ||
      !languages.every((l) => VALID_LANGS.includes(l))) {
    return corsResponse({ error: "Invalid languages" }, 400, env)
  }

  if (!VALID_AREAS.includes(area)) {
    return corsResponse({ error: "Invalid area" }, 400, env)
  }

  // ── Auth ───────────────────────────────────────────────────────
  let stripeEmail = null

  if (type === "stripe") {
    const existing = await env.PAYMENT_SESSIONS.get(session)
    if (existing) return corsResponse({ error: "Session already used" }, 403, env)

    const stripeRes = await fetch(
      `https://api.stripe.com/v1/checkout/sessions/${session}`,
      { headers: { Authorization: `Bearer ${env.STRIPE_SECRET_KEY}` } },
    )
    if (!stripeRes.ok) return corsResponse({ error: "Payment not verified" }, 402, env)

    const stripeSession = await stripeRes.json()
    if (stripeSession.payment_status !== "paid") {
      return corsResponse({ error: "Payment not verified" }, 402, env)
    }
    stripeEmail = stripeSession.customer_details?.email || null

  } else if (type === "code") {
    if (code !== env.MASTER_CODE) {
      const raw = await env.BYPASS_CODES.get(code)
      if (!raw) return corsResponse({ error: "Invalid code" }, 403, env)

      const parsed = JSON.parse(raw)
      if (parsed.uses_remaining <= 0) {
        return corsResponse({ error: "Code exhausted" }, 403, env)
      }

      const newUses = parsed.uses_remaining - 1
      if (newUses === 0) {
        await env.BYPASS_CODES.delete(code)
      } else {
        await env.BYPASS_CODES.put(code, JSON.stringify({ uses_remaining: newUses }))
      }
    }
  } else {
    return corsResponse({ error: "Invalid type" }, 400, env)
  }

  // ── Fetch page HTML once ───────────────────────────────────────
  const pageRes = await fetch(env.CARD_URL)
  if (!pageRes.ok) return corsResponse({ error: "Could not fetch card page" }, 503, env)
  const pageHtml = await pageRes.text()

  // ── Render PDFs in parallel ────────────────────────────────────
  let pdfs
  try {
    pdfs = await Promise.all(
      languages.map((lang) => renderPdf(pageHtml, { ...formData, lang }, env)),
    )
  } catch (err) {
    if (type === "stripe" && stripeEmail) {
      await sendRetryEmail(stripeEmail, session, env)
    }
    return corsResponse({ error: "PDF generation failed", detail: err.message }, 503, env)
  }

  // ── Write Stripe session to KV + save email to D1 ─────────────
  if (type === "stripe") {
    await env.PAYMENT_SESSIONS.put(session, "1", { expirationTtl: 86400 })
    if (stripeEmail) {
      const vesselNameForEmail = formData?.name || ""
      await env.DB.prepare(
        "INSERT OR REPLACE INTO emails (email, vessel_name, created_at) VALUES (?, ?, ?)"
      ).bind(stripeEmail, vesselNameForEmail, new Date().toISOString()).run().catch(() => {})
    }
  }

  // ── ZIP ────────────────────────────────────────────────────────
  const vesselName = formData?.name || "card"
  const areaLabel  = AREA_LABEL[area]

  const files = {}
  for (let i = 0; i < languages.length; i++) {
    const lang = languages[i]
    const filename = `MareSafe - ${vesselName} - ${areaLabel} - ${LANG_LABEL[lang]}.pdf`
    files[filename] = new Uint8Array(pdfs[i])
  }
  const zipped = zipSync(files)

  return new Response(zipped, {
    status: 200,
    headers: {
      ...corsHeaders(env),
      "Content-Type": "application/zip",
      "Content-Disposition": `attachment; filename="MareSafe - ${vesselName} - ${areaLabel}.zip"`,
    },
  })
}

// ── Browserless PDF render ─────────────────────────────────────────
async function renderPdf(pageHtml, cardData, env) {
  const injected = pageHtml
    .replace(
      "<head>",
      `<head><base href="${env.CARD_URL}">`,
    )
    .replace(
      "</head>",
      `<script>window.__CARD_DATA__=${JSON.stringify(cardData)};window.__RENDER_MODE__=true;</script></head>`,
    )

  const res = await fetch(
    `https://chrome.browserless.io/pdf?token=${env.BROWSERLESS_TOKEN}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        html: injected,
        viewport: { width: 794, height: 1123 },
        options: {
          printBackground: true,
          format: "A4",
          margin: { top: "0", right: "0", bottom: "0", left: "0" },
        },
        waitForSelector: { selector: "#render-ready", timeout: 30000 },
      }),
    },
  )

  if (!res.ok) {
    const text = await res.text().catch(() => "")
    throw new Error(`Browserless ${res.status}: ${text}`)
  }
  return res.arrayBuffer()
}

// ── Resend email fallback ──────────────────────────────────────────
async function sendRetryEmail(to, sessionId, env) {
  const retryUrl = `https://www.maresafe.eu/?session=${sessionId}`
  await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${env.RESEND_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: "MareSafe <noreply@contact.maresafe.eu>",
      to,
      subject: "MareSafe — your download link",
      html: `<p>Something went wrong generating your PDF. Your payment is safe.</p>
             <p><a href="${retryUrl}">Click here to retry your download</a></p>
             <p>This link is valid for 24 hours.</p>`,
    }),
  }).catch(() => {})
}

// ── /email-backup ──────────────────────────────────────────────────
async function handleEmailBackup(request, env) {
  const body = await request.json().catch(() => null)
  if (!body) return corsResponse({ error: "Invalid body" }, 400, env)

  const { email, formData } = body
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return corsResponse({ error: "Invalid email" }, 400, env)
  }

  const vesselName = formData?.name || ""
  const createdAt  = new Date().toISOString()
  const filename   = `MareSafe - ${vesselName || "backup"}.json`
  const jsonBytes  = new TextEncoder().encode(JSON.stringify(formData, null, 2))
  const base64     = btoa(String.fromCharCode(...jsonBytes))

  // Store email in D1
  await env.DB.prepare(
    "INSERT OR REPLACE INTO emails (email, vessel_name, created_at) VALUES (?, ?, ?)"
  ).bind(email, vesselName, createdAt).run()

  // Send backup via Resend
  const resendRes = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${env.RESEND_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: "MareSafe <noreply@contact.maresafe.eu>",
      to: email,
      subject: `MareSafe — backup of ${vesselName || "your vessel"}`,
      html: `<p>Hi,</p>
             <p>Attached is a JSON backup of your MareSafe emergency card for <strong>${vesselName || "your vessel"}</strong>.</p>
             <p>To restore it, open <a href="https://www.maresafe.eu">maresafe.eu</a> and use the import option.</p>
             <p>— MareSafe</p>`,
      attachments: [{ filename, content: base64 }],
    }),
  })

  if (!resendRes.ok) return corsResponse({ error: "Failed to send email" }, 503, env)
  return corsResponse({ ok: true }, 200, env)
}

// ── /admin/emails ──────────────────────────────────────────────────
async function handleListEmails(request, env) {
  const { masterCode } = await request.json().catch(() => ({}))
  if (masterCode !== env.MASTER_CODE) {
    return corsResponse({ error: "Forbidden" }, 403, env)
  }

  const { results } = await env.DB.prepare(
    "SELECT email, vessel_name, created_at FROM emails ORDER BY created_at DESC LIMIT 500"
  ).all()

  return corsResponse({ emails: results }, 200, env)
}

// ── Admin page ─────────────────────────────────────────────────────
function adminPage() {
  const html = `<!doctype html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>MareSafe Admin</title>
  <style>
    body { font-family: system-ui, sans-serif; max-width: 540px; margin: 60px auto; padding: 0 20px; color: #111; }
    h2 { color: #1b3a5c; }
    label { display: block; font-size: 13px; margin-bottom: 4px; color: #444; }
    input { display: block; width: 100%; box-sizing: border-box; margin-bottom: 12px; padding: 8px 10px; font-size: 14px; border: 1.5px solid #a8c4e0; border-radius: 4px; }
    .tabs { display: flex; gap: 8px; margin-bottom: 24px; }
    .tab { padding: 8px 18px; border: 1.5px solid #a8c4e0; border-radius: 4px; cursor: pointer; font-size: 14px; background: white; }
    .tab.active { background: #1b3a5c; color: white; border-color: #1b3a5c; }
    .panel { display: none; }
    .panel.active { display: block; }
    button.action { background: #1b3a5c; color: white; border: none; border-radius: 4px; padding: 10px 20px; font-size: 14px; cursor: pointer; width: 100%; }
    button.action:hover { background: #2c5282; }
    #result { margin-top: 20px; font-size: 22px; font-weight: 700; color: #1e6b3c; letter-spacing: 2px; }
    #error  { margin-top: 20px; font-size: 13px; color: #a93226; }
    table { width: 100%; border-collapse: collapse; font-size: 13px; margin-top: 16px; }
    th { text-align: left; padding: 6px 8px; background: #f0f4f8; border-bottom: 2px solid #a8c4e0; }
    td { padding: 6px 8px; border-bottom: 1px solid #e8eef4; }
    #email-count { font-size: 13px; color: #555; margin-top: 8px; }
  </style>
</head>
<body>
  <h2>MareSafe Admin</h2>
  <div class="tabs">
    <button class="tab active" onclick="showTab('codes')">Codes</button>
    <button class="tab" onclick="showTab('emails')">Emails</button>
  </div>

  <div id="panel-codes" class="panel active">
    <label>Master code</label>
    <input id="mc" type="password" autocomplete="current-password" />
    <label>Number of uses</label>
    <input id="uses" type="number" value="1" min="1" max="1000" />
    <button class="action" onclick="generate()">Generate code</button>
    <div id="result"></div>
    <div id="error"></div>
  </div>

  <div id="panel-emails" class="panel">
    <label>Master code</label>
    <input id="mc2" type="password" autocomplete="current-password" />
    <button class="action" onclick="loadEmails()">Load emails</button>
    <div id="email-count"></div>
    <table id="email-table" style="display:none">
      <thead><tr><th>Email</th><th>Vessel</th><th>Date</th></tr></thead>
      <tbody id="email-rows"></tbody>
    </table>
    <div id="email-error"></div>
  </div>

  <script>
    function showTab(name) {
      document.querySelectorAll(".tab").forEach((t, i) => t.classList.toggle("active", ["codes","emails"][i] === name))
      document.querySelectorAll(".panel").forEach(p => p.classList.remove("active"))
      document.getElementById("panel-" + name).classList.add("active")
    }

    async function generate() {
      document.getElementById("result").textContent = ""
      document.getElementById("error").textContent  = ""
      const res = await fetch("/create-code", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          masterCode: document.getElementById("mc").value,
          uses: parseInt(document.getElementById("uses").value) || 1,
        }),
      })
      const data = await res.json()
      if (res.ok) document.getElementById("result").textContent = data.code
      else document.getElementById("error").textContent = data.error || "Something went wrong."
    }

    async function loadEmails() {
      document.getElementById("email-error").textContent = ""
      document.getElementById("email-table").style.display = "none"
      const res = await fetch("/admin/emails", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ masterCode: document.getElementById("mc2").value }),
      })
      const data = await res.json()
      if (!res.ok) { document.getElementById("email-error").textContent = data.error || "Failed."; return }
      const tbody = document.getElementById("email-rows")
      tbody.innerHTML = data.emails.map(e =>
        \`<tr><td>\${e.email}</td><td>\${e.vessel_name || "—"}</td><td>\${e.created_at?.slice(0,10) || "—"}</td></tr>\`
      ).join("")
      document.getElementById("email-count").textContent = data.emails.length + " contacts"
      document.getElementById("email-table").style.display = data.emails.length ? "" : "none"
    }
  </script>
</body>
</html>`

  return new Response(html, {
    headers: { "Content-Type": "text/html; charset=UTF-8" },
  })
}

// ── Helpers ────────────────────────────────────────────────────────
function generateCode() {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"
  const rand = (n) =>
    Array.from(crypto.getRandomValues(new Uint8Array(n)))
      .map((b) => chars[b % chars.length])
      .join("")
  return `${rand(4)}-${rand(4)}`
}

function corsHeaders(env) {
  return {
    "Access-Control-Allow-Origin": env.ALLOWED_ORIGIN || "*",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
  }
}

function corsResponse(body, status, env) {
  const headers = { ...corsHeaders(env), "Content-Type": "application/json" }
  return new Response(body ? JSON.stringify(body) : null, { status, headers })
}
