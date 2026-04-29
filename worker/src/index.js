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
    return corsResponse({ error: "PDF generation failed" }, 503, env)
  }

  // ── Write Stripe session to KV (after successful render) ───────
  if (type === "stripe") {
    await env.PAYMENT_SESSIONS.put(session, "1", { expirationTtl: 86400 })
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
  const injected = pageHtml.replace(
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
        options: {
          printBackground: true,
          format: "A4",
          margin: { top: "0", right: "0", bottom: "0", left: "0" },
        },
        waitFor: { selector: "#render-ready" },
      }),
    },
  )

  if (!res.ok) throw new Error(`Browserless error ${res.status}`)
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
      from: "MareSafe <noreply@maresafe.eu>",
      to,
      subject: "MareSafe — your download link",
      html: `<p>Something went wrong generating your PDF. Your payment is safe.</p>
             <p><a href="${retryUrl}">Click here to retry your download</a></p>
             <p>This link is valid for 24 hours.</p>`,
    }),
  }).catch(() => {})
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
    body { font-family: system-ui, sans-serif; max-width: 400px; margin: 60px auto; padding: 0 20px; color: #111; }
    h2 { color: #1b3a5c; }
    label { display: block; font-size: 13px; margin-bottom: 4px; color: #444; }
    input { display: block; width: 100%; box-sizing: border-box; margin-bottom: 12px; padding: 8px 10px; font-size: 14px; border: 1.5px solid #a8c4e0; border-radius: 4px; }
    button { background: #1b3a5c; color: white; border: none; border-radius: 4px; padding: 10px 20px; font-size: 14px; cursor: pointer; width: 100%; }
    button:hover { background: #2c5282; }
    #result { margin-top: 20px; font-size: 22px; font-weight: 700; color: #1e6b3c; letter-spacing: 2px; }
    #error  { margin-top: 20px; font-size: 13px; color: #a93226; }
  </style>
</head>
<body>
  <h2>MareSafe — Code Generator</h2>
  <label>Master code</label>
  <input id="mc" type="password" autocomplete="current-password" />
  <label>Number of uses</label>
  <input id="uses" type="number" value="1" min="1" max="1000" />
  <button onclick="generate()">Generate code</button>
  <div id="result"></div>
  <div id="error"></div>
  <script>
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
