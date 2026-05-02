// ══ CONFIG ══════════════════════════════════════════════════════════
const STRIPE_TEST_MODE    = false
const STRIPE_LIVE_LINK    = "https://buy.stripe.com/cNi4gzachcuR5vN0Ao97G00"
const STRIPE_TEST_LINK    = "https://buy.stripe.com/test_cNi4gzachcuR5vN0Ao97G00"
const STRIPE_PAYMENT_LINK = STRIPE_TEST_MODE ? STRIPE_TEST_LINK : STRIPE_LIVE_LINK
const WORKER_BASE         = "https://maresafe-worker.maresafe.workers.dev"
const PDF_WORKER_URL      = `${WORKER_BASE}/generate-pdf`
const CHECK_CODE_URL      = `${WORKER_BASE}/check-code`
const EMAIL_BACKUP_URL    = `${WORKER_BASE}/email-backup`

// ══ CONTACTS ════════════════════════════════════════════════════════
const MAX_CONTACTS = 9
const CONTACT_ROWS = 9
const DIAL_CODES = [
  { code: "+31", flag: "🇳🇱", label: "NL" },
  { code: "+32", flag: "🇧🇪", label: "BE" },
  { code: "+49", flag: "🇩🇪", label: "DE" },
  { code: "+33", flag: "🇫🇷", label: "FR" },
  { code: "+44", flag: "🇬🇧", label: "GB" },
  { code: "+1", flag: "🇺🇸", label: "US" },
  { code: "+45", flag: "🇩🇰", label: "DK" },
  { code: "+47", flag: "🇳🇴", label: "NO" },
  { code: "+46", flag: "🇸🇪", label: "SE" },
]
const DEFAULT_DIAL_CODE = "+31"
let contacts = [{ label: "", dialCode: DEFAULT_DIAL_CODE, number: "" }]

let _numericWarnTimer = null
function decimalOnly(input) {
  const before = input.value
  const hasInvalidChar = /[^\d.,]/.test(before)
  let v = before.replace(/[^\d.,]/g, "")
  const sepIdx = v.search(/[.,]/)
  if (sepIdx !== -1) {
    const decimals = v.slice(sepIdx + 1).replace(/[.,]/g, "")
    v = v.slice(0, sepIdx + 1) + decimals.slice(0, 2)
  }
  input.value = v
  if (hasInvalidChar) {
    clearTimeout(_numericWarnTimer)
    const warn = document.getElementById("numeric-warn")
    warn.textContent = T[currentLang].digits_only
    const rect = input.getBoundingClientRect()
    warn.style.top = rect.bottom + 6 + "px"
    warn.style.left = rect.left + "px"
    warn.classList.add("visible")
    _numericWarnTimer = setTimeout(() => warn.classList.remove("visible"), 1500)
  }
}

function numericOnly(input) {
  const before = input.value
  input.value = before.replace(/\D/g, "")
  if (input.value !== before) {
    clearTimeout(_numericWarnTimer)
    const warn = document.getElementById("numeric-warn")
    warn.textContent = T[currentLang].digits_only
    const rect = input.getBoundingClientRect()
    warn.style.top = rect.bottom + 6 + "px"
    warn.style.left = rect.left + "px"
    warn.classList.add("visible")
    _numericWarnTimer = setTimeout(() => warn.classList.remove("visible"), 1500)
  }
}

function dialOptions(selected) {
  return DIAL_CODES.map(
    ({ code, flag }) =>
      `<option value="${code}"${code === selected ? " selected" : ""}>${flag} ${code}</option>`,
  ).join("")
}

function makeInput({
  type = "text",
  id,
  value = "",
  placeholder = "",
  maxlength,
  onChange = "update()",
  dialCode,
  number,
  dialId,
  numberId,
}) {
  const v = value || ""
  const ml = maxlength ? ` maxlength="${maxlength}"` : ""
  const ph = placeholder ? ` placeholder="${placeholder}"` : ""

  if (type === "measurement") {
    return `<div class="inp-wrap inp-wrap--m"><input class="inp" type="text" inputmode="decimal" id="${id}" value="${v}"${ph} oninput="${onChange}"><span class="inp-badge">m</span></div>`
  }
  if (type === "number") {
    return `<input class="inp" type="text" inputmode="numeric" id="${id}" value="${v}"${ml} oninput="numericOnly(this);${onChange}">`
  }
  if (type === "phone") {
    const dc = dialCode || DEFAULT_DIAL_CODE
    const did = dialId || id + "-code"
    const nid = numberId || id + "-number"
    return `<div class="inp-wrap inp-wrap--phone"><select class="inp dial-sel" id="${did}" onchange="${onChange}">${dialOptions(dc)}</select><input class="inp" type="text" inputmode="numeric" id="${nid}" value="${number || ""}" maxlength="15" oninput="numericOnly(this);${onChange}"></div>`
  }
  return `<input class="inp" type="text" id="${id}" value="${v}"${ph}${ml} oninput="${onChange}">`
}

function renderContactEditor() {
  const el = document.getElementById("contact-rows")
  el.innerHTML = ""

  contacts.forEach((c, i) => {
    const dc = c.dialCode || DEFAULT_DIAL_CODE
    const row = document.createElement("div")
    row.className = "contact-row"
    row.innerHTML = `
      <input class="inp contact-inp" value="${c.label}" maxlength="20" placeholder="${T[currentLang].contact_label_placeholder}" oninput="contacts[${i}].label=this.value;update()">
      <div class="inp-wrap inp-wrap--phone" style="flex:1"><select class="inp dial-sel" onchange="contacts[${i}].dialCode=this.value;update()">${dialOptions(dc)}</select><input class="inp" value="${c.number || ""}" maxlength="15" inputmode="numeric" placeholder="${T[currentLang].contact_phone_placeholder}" oninput="numericOnly(this);contacts[${i}].number=this.value;update()"></div>
      <button class="del-btn" onclick="removeContact(${i})">×</button>`
    el.appendChild(row)
  })

  const addBtn = document.querySelector(".add-btn")
  addBtn.textContent = T[currentLang].btn_add_contact
}

function addContact() {
  const hasEmpty = contacts.some((c) => !c.label && !c.number)
  if (contacts.length >= MAX_CONTACTS || hasEmpty) return
  contacts.push({ label: "", dialCode: DEFAULT_DIAL_CODE, number: "" })
  renderContactEditor()
  update()
}
function removeContact(i) {
  if (contacts.length <= 1) {
    contacts[0] = { label: "", dialCode: DEFAULT_DIAL_CODE, number: "" }
  } else {
    contacts.splice(i, 1)
  }
  renderContactEditor()
  update()
}

// ══ PROTOCOLS ═══════════════════════════════════════════════════════
function buildProtocols() {
  ;["fire", "mob"].forEach((type) => {
    const tbl = document.getElementById(`${type}-rows`)
    tbl.innerHTML = ""
    T[currentLang][type].forEach((step, i) => {
      const tr = document.createElement("tr")
      tr.innerHTML = `<td><div class="step-cell"><span class="nr-badge${type === "mob" ? " mob" : ""}">${i + 1}</span>${step}</div></td>`
      tbl.appendChild(tr)
    })
  })
}

// ══ SOUND SIGNALS ════════════════════════════════════════════════════
const SIGNAL_PATTERNS = [
  ["L"],
  ["L", "L", "L", "L", "L", "L"],
  ["XS", "XS", "XS", "XS", "XS", "XS"],
  ["S", "L"],
  ["S"],
  ["S", "S"],
  ["S", "S", "S"],
  ["L", "L", "L"],
  ["L", "S"],
  ["L", "S", "S"],
  ["L", "L", "S"],
  ["L", "L", "S", "S"],
  ["L", "L", "L", "S"],
  ["L", "L", "L", "S", "S"],
]

function buildSignals() {
  const grid = document.getElementById("signal-grid")
  grid.innerHTML = ""
  T[currentLang].signals.forEach((desc, i) => {
    const rowI = Math.floor(i / 2)
    const div = document.createElement("div")
    div.className = `sound-row ${rowI % 2 === 0 ? "alt" : "wht"}`
    const pat = document.createElement("div")
    pat.className = "sound-pattern"
    SIGNAL_PATTERNS[i].forEach((p) => {
      const el = document.createElement("span")
      el.className = p === "L" ? "g-L" : p === "S" ? "g-S" : "g-XS"
      pat.appendChild(el)
    })
    const d = document.createElement("span")
    d.className = "sound-desc"
    d.textContent = desc
    div.appendChild(pat)
    div.appendChild(d)
    grid.appendChild(div)
  })
}

// ══ FORMATTERS ════════════════════════════════════════════════════════
function formatMMSI(v) {
  const d = (v || "").replace(/\D/g, "")
  if (d.length !== 9) return v || "—"
  return `${d.slice(0, 3)} ${d.slice(3, 6)} ${d.slice(6)}`
}
function formatENI(v) {
  const d = (v || "").replace(/\D/g, "")
  if (d.length !== 8) return v || "—"
  return `${d.slice(0, 4)} ${d.slice(4)}`
}
function formatATIS(v) {
  const d = (v || "").replace(/\D/g, "")
  if (d.length === 9) return `${d.slice(0, 3)} ${d.slice(3, 6)} ${d.slice(6)}`
  if (d.length === 10) return `${d.slice(0, 4)} ${d.slice(4, 7)} ${d.slice(7)}`
  return v || "—"
}
// Dutch 2-digit NDCs (area codes without leading 0, 7-digit subscriber)
const NL_2DIGIT_NDC = new Set([
  10, 13, 15, 20, 23, 24, 26, 30, 33, 35, 36, 38, 40, 43, 45, 46, 50, 53, 55,
  58, 70, 71, 72, 73, 74, 75, 76, 77, 78, 79,
])
const BADGE = {
  emergency: { color: "var(--red)",    key: "pill_emergency" },
  urgent:    { color: "var(--orange)", key: "pill_urgent"    },
  medical:   { color: "var(--green)",  key: "pill_medical"   },
  info:      { color: "var(--mid)",    key: "pill_info"      },
}
function badge(type) {
  const { color, key } = BADGE[type]
  return `<span class="pill" style="background:${color}" data-i18n="${key}">${T[currentLang][key]}</span>`
}

function formatPhone(dialCode, number) {
  const n = (number || "").trim()
  if (!n) return "—"
  const dc = dialCode || DEFAULT_DIAL_CODE
  if (dc !== "+31") return `${dc} ${n.replace(/^0+/, "")}`
  // Dutch formatting
  const d = n.replace(/\D/g, "")
  if (!d) return n
  if (d.length !== 10 || !d.startsWith("0")) return `${dc} ${n}`
  if (d.startsWith("06"))
    return `+31 6 ${d.slice(2, 4)} ${d.slice(4, 6)} ${d.slice(6, 8)} ${d.slice(8)}`
  if (/^0[89]0/.test(d)) return `${dc} ${n}`
  if (/^0(8[4-9])/.test(d)) {
    const ndc = d.slice(1, 3),
      sub = d.slice(3)
    return `+31 ${ndc} ${sub.slice(0, 3)} ${sub.slice(3)}`
  }
  const nsn = d.slice(1)
  const ndc2 = parseInt(nsn.slice(0, 2), 10)
  if (NL_2DIGIT_NDC.has(ndc2)) {
    const sub = nsn.slice(2)
    return `+31 ${nsn.slice(0, 2)} ${sub.slice(0, 3)} ${sub.slice(3, 5)} ${sub.slice(5)}`
  }
  const sub = nsn.slice(3)
  return `+31 ${nsn.slice(0, 3)} ${sub.slice(0, 2)} ${sub.slice(2, 4)} ${sub.slice(4)}`
}

// ══ UPDATE ═══════════════════════════════════════════════════════════
function update() {
  const t = T[currentLang]
  const name = document.getElementById("f-name").value
  const type = document.getElementById("f-type").value
  const eni = document.getElementById("f-eni").value
  const length = document.getElementById("f-length").value
  const width = document.getElementById("f-width").value
  const draft = document.getElementById("f-draft").value
  const airdraft = document.getElementById("f-airdraft").value
  const altLength = document.getElementById("f-alt-length").value
  const altAirdraft = document.getElementById("f-alt-airdraft").value
  const callsign = document.getElementById("f-callsign").value
  const atis = document.getElementById("f-atis").value
  const mmsi = document.getElementById("f-mmsi").value
  const insName = document.getElementById("f-insurer-name").value
  const policy = document.getElementById("f-policy").value
  const insEmergCode = document.getElementById("f-insurer-emergency-code").value
  const insEmergNum = document.getElementById(
    "f-insurer-emergency-number",
  ).value
  const insOffCode = document.getElementById("f-insurer-office-code").value
  const insOffNum = document.getElementById("f-insurer-office-number").value

  const fmt = (v) => {
    const n = parseFloat(String(v).replace(",", "."))
    return isNaN(n) ? "0,00" : n.toFixed(2).replace(".", ",")
  }
  const dash = (v) => v || "—"
  document.getElementById("r-name").textContent = dash(name)
  document.getElementById("r-type").textContent = dash(type)
  document.getElementById("r-eni").textContent = formatENI(eni)
  document.getElementById("r-length").textContent = fmt(length)
  document.getElementById("r-width").textContent = fmt(width)
  document.getElementById("r-draft").textContent = fmt(draft)
  document.getElementById("r-airdraft").textContent = fmt(airdraft)
  const fmtOpt = (v) => {
    const n = parseFloat(String(v).replace(",", "."))
    return v && v.trim() && !isNaN(n) && n > 0 ? n.toFixed(2).replace(".", ",") : null
  }
  const altLengthFmt = fmtOpt(altLength)
  const altAirdraftFmt = fmtOpt(altAirdraft)
  const showAltLen = !!altLengthFmt
  document.getElementById("r-alt-length-sep").style.display = showAltLen ? "" : "none"
  document.getElementById("r-alt-length-inline").style.display = showAltLen ? "" : "none"
  document.getElementById("r-alt-length").textContent = altLengthFmt || "—"
  const showAltAir = !!altAirdraftFmt
  document.getElementById("r-alt-airdraft-sep").style.display = showAltAir ? "" : "none"
  document.getElementById("r-alt-airdraft-inline").style.display = showAltAir ? "" : "none"
  document.getElementById("r-alt-airdraft").textContent = altAirdraftFmt || "—"
  document.getElementById("r-callsign").textContent = dash(callsign)
  document.getElementById("r-atis").textContent = formatATIS(atis)
  document.getElementById("r-mmsi").textContent = formatMMSI(mmsi)

  // Contacts — always CONTACT_ROWS rows
  const tbl = document.getElementById("r-contacts")
  while (tbl.rows.length > 0) tbl.deleteRow(0)
  for (let i = 0; i < CONTACT_ROWS; i++) {
    const c = contacts[i]
    const tr = tbl.insertRow()
    tr.style.background = i % 2 === 0 ? "var(--alt)" : "white"
    if (c?.label || c?.number) {
      tr.innerHTML = `<td class="c50" style="font-weight:700">${c.label}</td><td class="c50 right">${formatPhone(c.dialCode, c.number)}</td>`
    } else {
      tr.innerHTML = `<td class="c50"></td><td class="c50 right"></td>`
    }
  }

  // Add-contact button state
  const addBtn = document.querySelector(".add-btn")
  const hasEmpty = contacts.some((c) => !c.label && !c.number)
  addBtn.disabled = contacts.length >= MAX_CONTACTS || hasEmpty

  // Insurer
  document.getElementById("r-insurer-name").textContent = dash(insName)
  document.getElementById("r-policy").textContent = dash(policy)
  document.getElementById("r-insurer-emergency").textContent = formatPhone(
    insEmergCode,
    insEmergNum,
  )
  document.getElementById("r-insurer-office").textContent = formatPhone(
    insOffCode,
    insOffNum,
  )

  // Emergency calls
  ;[
    "m-name",
    "m-name2",
    "m-name3",
    "m-name4",
    "p-name",
    "p-name2",
    "p-name3",
    "p-name4",
  ].forEach((id) => (document.getElementById(id).textContent = dash(name)))
  const phonetic = callsign ? toPhonetic(callsign) : "—"
  ;["m-callsign1", "m-callsign2", "p-callsign1", "p-callsign2"].forEach(
    (id) => (document.getElementById(id).textContent = phonetic),
  )

  // Title + footer
  document.getElementById("card-title").textContent = t.card_title
  const vesselNameEl = document.getElementById("vessel-name")
  vesselNameEl.textContent = name ? name.toUpperCase() : ""
  vesselNameEl.style.display = name ? "" : "none"
  document.getElementById("location-display").textContent =
    t.location_label + ": " + t.location_name + " " + t.location_flag

  // Enable/disable save button based on whether any data has been entered
  const hasData = [
    name,
    type,
    eni,
    callsign,
    atis,
    mmsi,
    document.getElementById("f-insurer-name").value,
    ...contacts.map((c) => c.label + (c.number || "")),
  ].some((v) => v && v.trim() !== "")
  const saveBtn = document.getElementById("btn-email-backup")
  saveBtn.disabled = !hasData
  saveBtn.style.opacity = hasData ? "1" : "0.4"
  saveBtn.style.cursor = hasData ? "pointer" : "not-allowed"
  const now = new Date()
  const date = now.toLocaleDateString(
    currentLang === "nl" ? "nl-NL" : currentLang,
    { day: "numeric", month: "long", year: "numeric" },
  )
  document.getElementById("card-footer").textContent = t.footer_text.replace(
    "{date}",
    date,
  )
  const dateISO = now.toISOString().slice(0, 10)
  document.title = [
    "MareSafe",
    name || null,
    dateISO,
    currentLang.toUpperCase(),
  ]
    .filter(Boolean)
    .join(" - ")

  saveToStorage()
}

// ══ STORAGE ═══════════════════════════════════════════════════════════
const CURRENT_VERSION = 20
const STORAGE_KEY = "maritieme_noodkaart"

function getFormData() {
  return {
    _maresafe: true,
    version: CURRENT_VERSION,
    lang: currentLang,
    name: document.getElementById("f-name").value,
    type: document.getElementById("f-type").value,
    eni: document.getElementById("f-eni").value,
    length: document.getElementById("f-length").value,
    width: document.getElementById("f-width").value,
    draft: document.getElementById("f-draft").value,
    airDraft: document.getElementById("f-airdraft").value,
    altLength: document.getElementById("f-alt-length").value,
    altAirDraft: document.getElementById("f-alt-airdraft").value,
    callSign: document.getElementById("f-callsign").value,
    atis: document.getElementById("f-atis").value,
    mmsi: document.getElementById("f-mmsi").value,
    insurerName: document.getElementById("f-insurer-name").value,
    policyNumber: document.getElementById("f-policy").value,
    insurerEmergencyDialCode: document.getElementById(
      "f-insurer-emergency-code",
    ).value,
    insurerEmergencyNumber: document.getElementById(
      "f-insurer-emergency-number",
    ).value,
    insurerOfficeDialCode: document.getElementById("f-insurer-office-code")
      .value,
    insurerOfficeNumber: document.getElementById("f-insurer-office-number")
      .value,
    contacts: contacts.filter((c) => c.label || c.number),
  }
}

function migrateData(d) {
  const version = d.version || 1
  if (version >= CURRENT_VERSION) return { data: d, outdated: false }

  function splitLegacyPhone(raw) {
    const s = (raw || "").trim()
    if (!s) return { dialCode: DEFAULT_DIAL_CODE, number: "" }
    for (const { code } of DIAL_CODES) {
      if (s.startsWith(code)) {
        return { dialCode: code, number: s.slice(code.length).trim() }
      }
    }
    return { dialCode: DEFAULT_DIAL_CODE, number: s }
  }

  function toContact(c) {
    if (c.dialCode !== undefined) return c
    const split = splitLegacyPhone(c.phone || "")
    return {
      label: c.label || "",
      dialCode: split.dialCode,
      number: split.number,
    }
  }

  const m = {
    version: CURRENT_VERSION,
    lang: d.lang || "nl",
    name: d.name || d.naam || "",
    type: d.type || "",
    eni: d.eni || "",
    length: d.length || d.lengte || "",
    width: d.width || d.breedte || "",
    draft: d.draft || d.diepgang || "",
    airDraft: d.airDraft || d.kruip || "",
    callSign: d.callSign || d.roep || "",
    atis: d.atis || "",
    mmsi: d.mmsi || "",
    insurerName: d.insurerName || d.verzNaam || "",
    policyNumber: d.policyNumber || d.verzPolis || "",
  }

  const emerg = splitLegacyPhone(
    d.insurerEmergencyPhone || d.insurerEmergencyNumber || d.verzNood || "",
  )
  const off = splitLegacyPhone(
    d.insurerOfficePhone || d.insurerOfficeNumber || d.verzKantoor || "",
  )
  m.insurerEmergencyDialCode = d.insurerEmergencyDialCode || emerg.dialCode
  m.insurerEmergencyNumber =
    d.insurerEmergencyNumber !== undefined
      ? d.insurerEmergencyNumber
      : emerg.number
  m.insurerOfficeDialCode = d.insurerOfficeDialCode || off.dialCode
  m.insurerOfficeNumber =
    d.insurerOfficeNumber !== undefined ? d.insurerOfficeNumber : off.number

  let rawContacts = []
  if (version < 7) {
    rawContacts = [
      ...(d.fixedCrew || d.fixed || []),
      ...(d.extraCrew || d.extras || []),
    ].map((c) => ({
      label: c.name || c.naam || "",
      phone: c.phone || c.tel || "",
    }))
  } else if (version < 8) {
    const fixed = d.fixedContact || { label: "", phone: "" }
    const extras = d.extraContacts || []
    rawContacts = [fixed, ...extras].filter((c) => c.label || c.phone)
  } else {
    rawContacts = (d.contacts || []).filter(
      (c) => c.label || c.phone || c.number,
    )
  }
  m.contacts = rawContacts.map(toContact)

  return { data: m, outdated: true }
}

function showBanner(titleKey, bodyKey) {
  const t = T[currentLang]
  document.getElementById("vw-title").textContent = t[titleKey]
  document.getElementById("vw-body").textContent = t[bodyKey]
  document.getElementById("version-warning").style.display = "flex"
}

function showVersionWarning() {
  showBanner("vw_title", "vw_body")
}

const KNOWN_FIELDS = ["name", "naam", "mmsi", "callSign", "roep", "contacts", "insurerName", "verzNaam", "lang", "version"]

function applyFormData(d) {
  const isMarked = d._maresafe === true
  const isLegacy = KNOWN_FIELDS.some((k) => k in d)
  if (!isMarked && !isLegacy) throw new Error("invalid")

  const { data, outdated } = migrateData(d)

  if (data.lang && T[data.lang]) currentLang = data.lang
  const s = (id, v) => {
    const el = document.getElementById(id)
    if (el && v !== undefined) el.value = v
  }
  s("f-name", data.name)
  s("f-type", data.type)
  s("f-eni", data.eni)
  s("f-length", data.length)
  s("f-width", data.width)
  s("f-draft", data.draft)
  s("f-airdraft", data.airDraft)
  s("f-alt-length", data.altLength)
  s("f-alt-airdraft", data.altAirDraft)
  s("f-callsign", data.callSign)
  s("f-atis", data.atis)
  s("f-mmsi", data.mmsi)
  s("f-insurer-name", data.insurerName)
  s("f-policy", data.policyNumber)
  s(
    "f-insurer-emergency-code",
    data.insurerEmergencyDialCode || DEFAULT_DIAL_CODE,
  )
  s("f-insurer-emergency-number", data.insurerEmergencyNumber || "")
  s("f-insurer-office-code", data.insurerOfficeDialCode || DEFAULT_DIAL_CODE)
  s("f-insurer-office-number", data.insurerOfficeNumber || "")
  const loaded = Array.isArray(data.contacts)
    ? data.contacts
        .filter((c) => c.label || c.number || c.phone)
        .map((c) =>
          c.dialCode !== undefined
            ? c
            : {
                label: c.label || "",
                dialCode: DEFAULT_DIAL_CODE,
                number: c.phone || "",
              },
        )
    : []
  contacts =
    loaded.length > 0
      ? loaded
      : [{ label: "", dialCode: DEFAULT_DIAL_CODE, number: "" }]
  document
    .querySelectorAll(".lang-btn")
    .forEach((b) =>
      b.classList.toggle(
        "active",
        b.getAttribute("onclick") === `setLang('${currentLang}')`,
      ),
    )
  setLang(currentLang)
  if (outdated) showVersionWarning()
}

function saveToStorage() {
  try {
    ;["binnenvaart_noodkaart", "binnenvaart_noodkaart_v1"].forEach((k) =>
      localStorage.removeItem(k),
    )
    localStorage.setItem(STORAGE_KEY, JSON.stringify(getFormData()))
  } catch (e) {}
}

function loadFromStorage() {
  try {
    const raw =
      localStorage.getItem(STORAGE_KEY) ||
      localStorage.getItem("binnenvaart_noodkaart") ||
      localStorage.getItem("binnenvaart_noodkaart_v1")
    if (raw) {
      applyFormData(JSON.parse(raw))
      return true
    }
  } catch (e) {}
  return false
}

function exportJSON() {
  const data = getFormData()
  const name = data.name || "emergency-card"
  const today = new Date().toISOString().slice(0, 10)
  const blob = new Blob([JSON.stringify(data, null, 2)], {
    type: "application/json",
  })
  const a = document.createElement("a")
  a.href = URL.createObjectURL(blob)
  a.download = `MareSafe v2.0 - ${name} - ${today}.json`
  a.click()
  URL.revokeObjectURL(a.href)
  document.getElementById("version-warning").style.display = "none"
}

function openEmailBackupModal() {
  document.getElementById("email-backup-modal").classList.add("open")
  document.getElementById("email-backup-input").focus()
  const st = document.getElementById("email-backup-status")
  st.style.display = "none"
  st.textContent = ""
  document.getElementById("email-backup-btn").disabled = false
  document.getElementById("email-backup-btn-label").textContent = T[currentLang].modal_save_btn
}

function closeEmailBackupModal() {
  document.getElementById("email-backup-modal").classList.remove("open")
}

async function submitEmailBackup() {
  const email  = document.getElementById("email-backup-input").value.trim()
  const status = document.getElementById("email-backup-status")
  const btn    = document.getElementById("email-backup-btn")
  const label  = document.getElementById("email-backup-btn-label")

  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    status.style.color = "#f1948a"
    status.textContent = "Please enter a valid email address."
    return
  }

  btn.disabled = true
  label.textContent = T[currentLang].modal_save_sending
  status.textContent = ""

  const formData = getFormData()

  try {
    const res = await fetch(EMAIL_BACKUP_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, formData }),
    })

    if (res.ok) {
      label.textContent = T[currentLang].modal_save_sent
      status.style.color = "#6fcf97"
      status.style.display = "block"
      status.textContent = T[currentLang].modal_save_success
      setTimeout(closeEmailBackupModal, 2500)
    } else {
      throw new Error()
    }
  } catch {
    label.textContent = T[currentLang].modal_save_btn
    btn.disabled = false
    status.style.color = "#f1948a"
    status.style.display = "block"
    status.textContent = T[currentLang].modal_save_error
  }
}

function openLoadModal() {
  document.getElementById("load-modal").classList.add("open")
}

function closeLoadModal() {
  document.getElementById("load-modal").classList.remove("open")
}

function importJSONFromModal(e) {
  const file = e.target.files[0]
  if (!file) return
  const reader = new FileReader()
  reader.onload = (ev) => {
    try {
      applyFormData(JSON.parse(ev.target.result))
      closeLoadModal()
    } catch {
      closeLoadModal()
      showBanner("load_invalid_title", "load_invalid_body")
    }
  }
  reader.readAsText(file)
  e.target.value = ""
}

function openClearModal() {
  document.getElementById("clear-modal").classList.add("open")
}

function closeClearModal() {
  document.getElementById("clear-modal").classList.remove("open")
}

function confirmClear() {
  closeClearModal()
  clearAll()
}

function clearAll() {
  ;[
    "f-name",
    "f-type",
    "f-eni",
    "f-length",
    "f-width",
    "f-draft",
    "f-airdraft",
    "f-alt-length",
    "f-alt-airdraft",
    "f-callsign",
    "f-atis",
    "f-mmsi",
    "f-insurer-name",
    "f-policy",
    "f-insurer-emergency-number",
    "f-insurer-office-number",
  ].forEach((id) => {
    document.getElementById(id).value = ""
  })
  document.getElementById("f-insurer-emergency-code").value = DEFAULT_DIAL_CODE
  document.getElementById("f-insurer-office-code").value = DEFAULT_DIAL_CODE
  contacts = [{ label: "", dialCode: DEFAULT_DIAL_CODE, number: "" }]
  setLang(currentLang)
}

function importJSON(e) {
  const file = e.target.files[0]
  if (!file) return
  const reader = new FileReader()
  reader.onload = (ev) => {
    try {
      applyFormData(JSON.parse(ev.target.result))
    } catch (err) {
      alert("Invalid file — could not load data.")
    }
  }
  reader.readAsText(file)
  e.target.value = ""
}

// ══ PREVIEW SCALE ═══════════════════════════════════════════════════
const CARD_W = 794
const CARD_H = 1123
const CARD_MARGIN = 32

function updatePreviewScale() {
  const wrap = document.getElementById("a4-wrap")
  const card = document.getElementById("emergency-card")
  const available = document.documentElement.clientWidth

  if (available >= CARD_W + CARD_MARGIN) {
    wrap.classList.remove("scaled")
    card.style.transform = ""
    card.style.transformOrigin = ""
    wrap.style.display = ""
    wrap.style.width = ""
    wrap.style.height = ""
    wrap.style.overflow = ""
    wrap.style.margin = ""
    wrap.style.padding = ""
  } else {
    const scale = (available - CARD_MARGIN) / CARD_W
    const scaledW = Math.round(CARD_W * scale)
    const scaledH = Math.round(CARD_H * scale)
    wrap.classList.add("scaled")
    card.style.transform = `scale(${scale})`
    card.style.transformOrigin = "top left"
    wrap.style.display = "block"
    wrap.style.width = `${scaledW}px`
    wrap.style.height = `${scaledH + 32}px`
    wrap.style.overflow = "hidden"
    wrap.style.margin = "0 auto"
    wrap.style.padding = "0"
  }
}

window.addEventListener("resize", updatePreviewScale)

// ══ RENDER MODE (Browserless PDF generation) ════════════════════════
function initRenderMode() {
  if (!window.__RENDER_MODE__ || !window.__CARD_DATA__) return false

  applyFormData(window.__CARD_DATA__)

  Array.from(document.body.children).forEach((el) => {
    if (el.id !== "a4-wrap") el.remove()
  })

  document.body.style.cssText = "margin:0;padding:0;background:white;"

  const wrap = document.getElementById("a4-wrap")
  if (wrap) wrap.style.cssText = "display:block;margin:0;padding:0;box-shadow:none;border:none;background:white;"

  const card = document.getElementById("emergency-card")
  if (card) card.style.cssText = "width:794px;height:1123px;box-shadow:none;border:none;"

  const ready = document.createElement("div")
  ready.id = "render-ready"
  ready.style.display = "none"
  document.body.appendChild(ready)
  return true
}

// ══ DOWNLOAD / PAYMENT ══════════════════════════════════════════════
let _validCode = null

function getSelectedLanguages() {
  return [...document.querySelectorAll(".lang-check:checked")].map((el) => el.value)
}

document.addEventListener("click", (e) => {
  if (!document.getElementById("lang-dropdown").contains(e.target))
    document.getElementById("lang-menu").style.display = "none"
})

function toggleLangMenu(e) {
  e.stopPropagation()
  const menu = document.getElementById("lang-menu")
  menu.style.display = menu.style.display === "none" ? "block" : "none"
}

function onLangChange() {
  const langs = getSelectedLanguages()
  document.getElementById("lang-trigger-label").textContent =
    langs.length ? langs.map((l) => l.toUpperCase()).join(", ") : "—"
  localStorage.setItem("maresafe_langs", JSON.stringify(langs))
  updateDownloadLabel()
}

function updateDownloadLabel() {
  const langs = getSelectedLanguages()
  const count = langs.length
  const hasFreeCode = _validCode !== null
  const showBuyBtn = !hasFreeCode

  document.getElementById("stripe-buy-wrap").style.display = showBuyBtn ? "flex" : "none"
  document.getElementById("download-wrap").style.display = showBuyBtn ? "none" : "flex"

  if (showBuyBtn) {
    document.getElementById("btn-buy").disabled = count === 0
  } else {
    document.getElementById("btn-download").disabled = count === 0
    document.getElementById("btn-download-label").textContent = count === 0
      ? T[currentLang].btn_download_pdf_zero
      : `${count} PDF${count > 1 ? "'s" : ""} — ${T[currentLang].label_free}`
  }
}

function handleBuyClick() {
  window.location.href = STRIPE_PAYMENT_LINK
}

async function checkCode() {
  const code = document.getElementById("bypass-code-input").value.trim()
  const feedback = document.getElementById("code-feedback")
  _validCode = null
  updateDownloadLabel()
  if (!code) { feedback.textContent = ""; return }

  feedback.style.color = "var(--mid)"
  feedback.textContent = "…"
  try {
    const res = await fetch(CHECK_CODE_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ code }),
    })
    const data = await res.json()
    if (data.valid) {
      _validCode = code
      const usesText =
        data.uses === "unlimited"
          ? T[currentLang].code_uses_unlimited
          : T[currentLang].code_uses_remaining.replace("{n}", data.uses)
      feedback.style.color = "var(--green)"
      feedback.textContent = "✓ " + usesText
    } else {
      feedback.style.color = "var(--red)"
      feedback.textContent = T[currentLang].code_invalid
    }
  } catch {
    feedback.textContent = ""
  }
  updateDownloadLabel()
}

function handleDownloadClick() {
  const langs = getSelectedLanguages()
  if (!langs.length) { alert(T[currentLang].pdf_no_lang); return }
  requestPDF({ type: "code", code: _validCode }, langs)
}

async function handlePaymentReturn(sessionId) {
  const langs = JSON.parse(localStorage.getItem("maresafe_langs") || '["nl","en"]')
  await requestPDF({ type: "stripe", session: sessionId }, langs)
  localStorage.removeItem("maresafe_langs")
  window.history.replaceState({}, "", window.location.pathname)
}

async function requestPDF(authPayload, languages) {
  const btn    = document.getElementById("btn-download")
  const status = document.getElementById("pdf-status")
  btn.disabled = true
  status.style.color = "var(--mid)"
  status.textContent = T[currentLang].pdf_loading

  const formData = JSON.parse(localStorage.getItem(STORAGE_KEY) || "{}")

  let response
  try {
    response = await fetch(PDF_WORKER_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...authPayload, formData, languages, area: "netherlands" }),
    })
  } catch {
    status.style.color = "var(--red)"
    status.textContent = T[currentLang].pdf_error
    btn.disabled = false
    return
  }

  if (!response.ok) {
    const msgs = { 402: "pdf_error_402", 403: "pdf_error_403", 503: "pdf_error_503" }
    status.style.color = "var(--red)"
    status.textContent = T[currentLang][msgs[response.status] || "pdf_error"]
    btn.disabled = false
    return
  }

  const blob = await response.blob()
  const url  = URL.createObjectURL(blob)
  const a    = document.createElement("a")
  const name = formData.name || "card"
  a.href     = url
  a.download = `MareSafe - ${name} - Netherlands.zip`
  a.click()
  URL.revokeObjectURL(url)

  status.style.color = "var(--green)"
  status.textContent = T[currentLang].pdf_success
  btn.disabled = false
}

// ══ INFO MODAL ══════════════════════════════════════════════════════
function openInfoModal() {
  document.getElementById("info-modal").classList.add("open")
  localStorage.setItem("maritieme_seen_info", "1")
}
function closeInfoModal() {
  document.getElementById("info-modal").classList.remove("open")
  localStorage.setItem("maritieme_seen_info", "1")
}
document.addEventListener("keydown", (e) => {
  if (e.key === "Escape") closeInfoModal()
})

// ── TOOLTIP ───────────────────────────────────────────────────────
const tipPopup = document.getElementById("tip-popup")
let activeTipBtn = null

function showTip(btn) {
  const text = btn.getAttribute("data-tip")
  if (!text) return
  tipPopup.textContent = text
  tipPopup.classList.remove("above", "below")
  tipPopup.style.visibility = "hidden"
  tipPopup.style.display = "block"

  const r = btn.getBoundingClientRect()
  const vw = document.documentElement.clientWidth
  const vh = document.documentElement.clientHeight
  const pw = tipPopup.offsetWidth
  const ph = tipPopup.offsetHeight
  const GAP = 8
  const MARGIN = 10

  // horizontal: centre on button, clamp to viewport
  let left = r.left + r.width / 2 - pw / 2
  left = Math.max(MARGIN, Math.min(left, vw - pw - MARGIN))

  // arrow: points at button centre, clamped inside popup
  const arrowX = Math.max(12, Math.min(r.left + r.width / 2 - left, pw - 12))

  // vertical: prefer above, fall back to below
  const above = r.top - GAP >= ph + GAP
  const top = above ? r.top - ph - GAP : r.bottom + GAP

  tipPopup.style.left = left + "px"
  tipPopup.style.top = top + "px"
  tipPopup.style.setProperty("--arrow-x", arrowX + "px")
  tipPopup.classList.add(above ? "above" : "below")
  tipPopup.style.visibility = ""

  if (activeTipBtn) activeTipBtn.classList.remove("open")
  activeTipBtn = btn
  btn.classList.add("open")
}

function hideTip() {
  tipPopup.classList.remove("visible", "above", "below")
  tipPopup.style.display = "none"
  if (activeTipBtn) {
    activeTipBtn.classList.remove("open")
    activeTipBtn = null
  }
}

document.addEventListener("click", (e) => {
  const btn = e.target.closest(".tip-btn")
  if (btn) {
    btn === activeTipBtn ? hideTip() : showTip(btn)
  } else {
    hideTip()
  }
})
document.addEventListener("scroll", hideTip, true)
window.addEventListener("resize", hideTip)

// ══ LOAD DROP ZONE ══════════════════════════════════════════════════
;(function () {
  const zone = document.getElementById("load-drop-zone")
  if (!zone) return
  zone.addEventListener("dragover", (e) => {
    e.preventDefault()
    zone.style.borderColor = "#5a8ac0"
    zone.style.background = "rgba(90,138,192,0.08)"
  })
  zone.addEventListener("dragleave", () => {
    zone.style.borderColor = "#3a5a8a"
    zone.style.background = ""
  })
  zone.addEventListener("drop", (e) => {
    e.preventDefault()
    zone.style.borderColor = "#3a5a8a"
    zone.style.background = ""
    const file = e.dataTransfer.files[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = (ev) => {
      try {
        applyFormData(JSON.parse(ev.target.result))
        closeLoadModal()
      } catch {
        closeLoadModal()
        showBanner("load_invalid_title", "load_invalid_body")
      }
    }
    reader.readAsText(file)
  })
})()

// ══ INIT ════════════════════════════════════════════════════════════
document.getElementById("site-version").textContent = "2.0"


buildProtocols()
buildSignals()

if (!initRenderMode()) {
  if (!loadFromStorage()) setLang("nl")
  updatePreviewScale()
  updateDownloadLabel()

  const sessionId = new URLSearchParams(window.location.search).get("session")
  if (sessionId) setTimeout(() => handlePaymentReturn(sessionId), 100)

  if (!localStorage.getItem("maritieme_seen_info")) {
    setTimeout(openInfoModal, 400)
  }
}
