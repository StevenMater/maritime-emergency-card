// ══ CONFIG ══════════════════════════════════════════════════════════
const WORKER_BASE         = "https://maresafe-worker.maresafe.workers.dev"
const PDF_WORKER_URL      = `${WORKER_BASE}/generate-pdf`
const CHECK_CODE_URL      = `${WORKER_BASE}/check-code`

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
  const d = _validCode !== null ? getFormData() : DEMO_DATA
  const name      = d.name
  const type      = d.type
  const eni       = d.eni
  const length    = d.length
  const width     = d.width
  const draft     = d.draft
  const airdraft  = d.airDraft
  const altLength = d.altLength
  const altAirdraft = d.altAirDraft
  const callsign  = d.callSign
  const atis      = d.atis
  const mmsi      = d.mmsi
  const insName   = d.insurerName
  const policy    = d.policyNumber
  const insEmergCode = d.insurerEmergencyDialCode
  const insEmergNum  = d.insurerEmergencyNumber
  const insOffCode   = d.insurerOfficeDialCode
  const insOffNum    = d.insurerOfficeNumber
  const previewContacts = d.contacts

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
    const c = previewContacts[i]
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

  document.getElementById("btn-download").disabled = _validCode === null
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
    document.getElementById("f-name").value || null,
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
    lang: d.lang || "en",
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

  card.style.zoom = ""
  card.style.width = ""

  const cs = getComputedStyle(wrap)
  const padH = parseFloat(cs.paddingLeft) + parseFloat(cs.paddingRight)
  const availW = wrap.offsetWidth - padH
  const portrait = window.innerHeight > window.innerWidth
  const scale = Math.min(
    availW >= CARD_W ? 1 : availW / CARD_W,
    (window.innerHeight * (portrait ? 0.5 : 0.8)) / CARD_H
  )

  if (scale < 1) {
    card.style.width = CARD_W + "px"
    card.style.zoom = scale
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

// ══ DEMO PREVIEW DATA ═══════════════════════════════════════════════
const DEMO_DATA = {
  name: "Boaty McBoatface",
  type: "Motor Cruiser",
  eni: "02331847",
  length: "12.4",
  width: "3.8",
  draft: "1.1",
  airDraft: "4.2",
  altLength: "10.9",
  altAirDraft: "3.1",
  callSign: "PBMB1",
  atis: "123456789",
  mmsi: "244123456",
  insurerName: "Blue Ocean Marine Insurance",
  policyNumber: "BOI-2024-774821",
  insurerEmergencyDialCode: "+31",
  insurerEmergencyNumber: "0800123456",
  insurerOfficeDialCode: "+31",
  insurerOfficeNumber: "0102345678",
  contacts: [
    { label: "Alex Martin",  dialCode: "+31", number: "0612345678" },
    { label: "Sam Rivera",   dialCode: "+31", number: "0687654321" },
    { label: "Jordan Lee",   dialCode: "+31", number: "0104567890" },
    { label: "Chris Morgan", dialCode: "+44", number: "07911123456" },
  ],
}

// ══ DOWNLOAD / PAYMENT ══════════════════════════════════════════════
let _validCode = null
let _uses = null

function getSelectedLanguages() {
  return _ls["dl-lang-select"]?.selected || []
}

document.addEventListener("click", (e) => {
  Object.keys(_ls).forEach((id) => {
    const wrap = document.getElementById(id)
    if (wrap && wrap.contains(e.target)) return
    const dp = document.getElementById(`${id}-dp`)
    if (dp) dp.style.display = "none"
  })
})
window.addEventListener("scroll", lsCloseAll, true)
window.addEventListener("resize", lsCloseAll)

function onLangChange() {
  localStorage.setItem("maresafe_langs", JSON.stringify(getSelectedLanguages()))
}


function clearCodeInput() {
  const inp = document.getElementById("bypass-code-input")
  inp.value = ""
  _validCode = null
  document.getElementById("code-feedback").textContent = ""
  lsSetDisabled("dl-lang-select", true)
  update()
  inp.focus()
}

async function checkCode() {
  const code = document.getElementById("bypass-code-input").value.trim()
  const feedback = document.getElementById("code-feedback")
  _validCode = null
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
      _uses = data.tokens
      lsSetDisabled("dl-lang-select", false)
      lsSetMax("dl-lang-select", data.tokens)
      update()
      const usesText =
        data.tokens === "unlimited"
          ? T[currentLang].code_uses_unlimited
          : T[currentLang].code_uses_remaining.replace("{n}", data.tokens)
      feedback.style.color = "var(--green)"
      feedback.textContent = "✓ " + usesText
    } else {
      feedback.style.color = "var(--red)"
      feedback.textContent = T[currentLang].code_invalid
    }
  } catch {
    feedback.textContent = ""
  }
}

function handleDownloadClick() {
  const langs = getSelectedLanguages()
  if (!langs.length) { alert(T[currentLang].pdf_no_lang); return }
  requestPDF(langs)
}

async function requestPDF(languages) {
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
      body: JSON.stringify({ code: _validCode, formData, languages, area: "netherlands", lang: currentLang }),
    })
  } catch {
    status.style.color = "var(--red)"
    status.textContent = T[currentLang].pdf_error
    btn.disabled = false
    return
  }

  if (!response.ok) {
    const msgs = { 403: "pdf_error_403", 503: "pdf_error_503" }
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

  if (_uses !== "unlimited") {
    _uses = Math.max(0, _uses - languages.length)
    const feedback = document.getElementById("code-feedback")
    if (_uses <= 0) {
      _validCode = null
      lsSetDisabled("dl-lang-select", true)
      btn.disabled = true
      feedback.style.color = "var(--mid)"
      feedback.textContent = T[currentLang].code_uses_depleted
    } else {
      lsSetMax("dl-lang-select", _uses)
      btn.disabled = false
      feedback.style.color = "var(--green)"
      feedback.textContent = "✓ " + T[currentLang].code_uses_remaining.replace("{n}", _uses)
    }
  } else {
    btn.disabled = false
  }
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

// ══ LANG SELECT COMPONENT ═══════════════════════════════════════════

const LS_LANGS = [
  { code: "en", flag: "🇬🇧", name: "English" },
  { code: "nl", flag: "🇳🇱", name: "Nederlands" },
  { code: "fr", flag: "🇫🇷", name: "Français" },
  { code: "de", flag: "🇩🇪", name: "Deutsch" },
]

const _ls = {}

function lsInit(id, mode, initialSelected, onChange) {
  _ls[id] = { mode, selected: [...initialSelected], query: "", onChange, disabled: false, max: undefined }
  lsRender(id)
}

function lsRender(id) {
  const wrap = document.getElementById(id)
  if (!wrap) return
  const state = _ls[id]
  const chevron = `<svg class="ls-chevron" xmlns="http://www.w3.org/2000/svg" width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="6 9 12 15 18 9"/></svg>`
  wrap.innerHTML = `
    <button class="ls-trigger" type="button" onclick="lsToggle('${id}',event)"${state.disabled ? " disabled" : ""}>
      <span id="${id}-flags" class="ls-flags">${lsFlagsHTML(state)}</span>
      ${chevron}
    </button>
    <div class="ls-dropdown" id="${id}-dp" style="display:none">
      <input class="ls-search" type="text" placeholder="" oninput="lsFilter('${id}',this.value)" onkeydown="lsKeyDown('${id}',event)" autocomplete="off" />
      <div class="ls-options" id="${id}-opts">${lsOptionsHTML(id)}</div>
    </div>`
}

function lsFlagsHTML(state) {
  const { mode, selected } = state
  if (mode === "single") {
    const l = LS_LANGS.find((l) => l.code === selected[0])
    return l ? `<span class="ls-flag">${l.flag}</span><span class="ls-label">${l.name}</span>` : ""
  }
  const vis = selected.slice(0, 3)
  const extra = selected.length > 3 ? `<span class="ls-extra">+${selected.length - 3}</span>` : ""
  return vis.map((c) => {
    const l = LS_LANGS.find((l) => l.code === c)
    return l ? `<span class="ls-flag">${l.flag}</span>` : ""
  }).join("") + extra
}

const _lsCheck = `<svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>`

function lsOptionsHTML(id) {
  const state = _ls[id]
  const q = state.query.toLowerCase()
  return LS_LANGS
    .filter((l) => !q || l.name.toLowerCase().includes(q) || l.code.includes(q))
    .map((l) => {
      const sel = state.selected.includes(l.code)
      return `<div class="ls-option${sel ? " ls-sel" : ""}" onclick="lsSelect('${id}','${l.code}',event)">
        <span class="ls-opt-flag">${l.flag}</span>
        <span class="ls-opt-name">${l.name}</span>
        ${sel ? _lsCheck : ""}
      </div>`
    }).join("")
}

function lsPositionDropdown(id) {
  const trigger = document.querySelector(`#${id} .ls-trigger`)
  const dp = document.getElementById(`${id}-dp`)
  if (!trigger || !dp) return
  const rect = trigger.getBoundingClientRect()
  const dpMinW = 165
  const dpMinH = dp.offsetHeight || 200
  const margin = 8
  const spaceBelow = window.innerHeight - rect.bottom - margin
  const spaceAbove = rect.top - margin
  if (spaceBelow >= dpMinH || spaceBelow >= spaceAbove) {
    dp.style.top = `${rect.bottom + 4}px`
    dp.style.bottom = "auto"
  } else {
    dp.style.bottom = `${window.innerHeight - rect.top + 4}px`
    dp.style.top = "auto"
  }
  if (rect.left + dpMinW <= window.innerWidth - margin) {
    dp.style.left = `${rect.left}px`
    dp.style.right = "auto"
  } else {
    dp.style.right = `${window.innerWidth - rect.right}px`
    dp.style.left = "auto"
  }
}

function lsCloseAll() {
  Object.keys(_ls).forEach((k) => {
    const d = document.getElementById(`${k}-dp`)
    if (d) d.style.display = "none"
  })
}

function lsToggle(id, e) {
  e.stopPropagation()
  if (_ls[id]?.disabled) return
  const dp = document.getElementById(`${id}-dp`)
  const open = dp.style.display !== "none"
  lsCloseAll()
  if (!open) {
    dp.style.display = "block"
    lsPositionDropdown(id)
    _ls[id].query = ""
    _ls[id]._cursor = -1
    document.getElementById(`${id}-opts`).innerHTML = lsOptionsHTML(id)
    const inp = dp.querySelector(".ls-search")
    if (inp) { inp.value = ""; inp.focus() }
  }
}

function lsFilter(id, value) {
  _ls[id].query = value
  _ls[id]._cursor = -1
  document.getElementById(`${id}-opts`).innerHTML = lsOptionsHTML(id)
}

function lsKeyDown(id, e) {
  const dp = document.getElementById(`${id}-dp`)
  if (dp.style.display === "none") return

  if (e.key === "Escape") {
    dp.style.display = "none"
    document.querySelector(`#${id} .ls-trigger`).focus()
    return
  }

  const opts = [...dp.querySelectorAll(".ls-option")]
  if (!opts.length) return
  const state = _ls[id]

  if (e.key === "ArrowDown") {
    e.preventDefault()
    state._cursor = state._cursor === undefined || state._cursor < 0
      ? 0
      : Math.min(state._cursor + 1, opts.length - 1)
    opts.forEach((el, i) => el.classList.toggle("ls-cursor", i === state._cursor))
    opts[state._cursor].scrollIntoView({ block: "nearest" })
  } else if (e.key === "ArrowUp") {
    e.preventDefault()
    if (!state._cursor || state._cursor <= 0) {
      state._cursor = -1
      opts.forEach((el) => el.classList.remove("ls-cursor"))
    } else {
      state._cursor--
      opts.forEach((el, i) => el.classList.toggle("ls-cursor", i === state._cursor))
      opts[state._cursor].scrollIntoView({ block: "nearest" })
    }
  } else if (e.key === "Enter") {
    e.preventDefault()
    if (state._cursor >= 0 && opts[state._cursor]) {
      opts[state._cursor].click()
    }
  }
}

function lsSelect(id, code, e) {
  const state = _ls[id]
  state._cursor = -1
  if (state.mode === "single") {
    state.selected = [code]
    document.getElementById(`${id}-dp`).style.display = "none"
  } else {
    if (e) e.stopPropagation()
    const idx = state.selected.indexOf(code)
    if (idx === -1) {
      if (state.max !== undefined && state.max !== "unlimited" && state.selected.length >= state.max) return
      state.selected.push(code)
    } else if (state.selected.length > 1) {
      state.selected.splice(idx, 1)
    }
    document.getElementById(`${id}-opts`).innerHTML = lsOptionsHTML(id)
  }
  document.getElementById(`${id}-flags`).innerHTML = lsFlagsHTML(state)
  state.onChange(state.selected)
}

function lsSetMax(id, n) {
  const state = _ls[id]
  if (!state) return
  state.max = n
  if (n !== undefined && n !== "unlimited" && state.selected.length > n) {
    state.selected = state.selected.slice(0, n)
    const fl = document.getElementById(`${id}-flags`)
    if (fl) fl.innerHTML = lsFlagsHTML(state)
  }
}

function lsSetDisabled(id, bool) {
  const state = _ls[id]
  if (!state) return
  state.disabled = bool
  const trigger = document.querySelector(`#${id} .ls-trigger`)
  if (trigger) trigger.disabled = bool
}

function lsUpdateUi(langCode) {
  ;["ui-lang-select", "ui-lang-select-modal"].forEach((id) => {
    const state = _ls[id]
    if (!state) return
    state.selected = [langCode]
    const fl = document.getElementById(`${id}-flags`)
    if (fl) fl.innerHTML = lsFlagsHTML(state)
    const opts = document.getElementById(`${id}-opts`)
    if (opts) opts.innerHTML = lsOptionsHTML(id)
  })
}

function onUiLangSelect(langCode) {
  setLang(langCode)
  const dl = _ls["dl-lang-select"]
  if (!dl) return
  dl.selected = langCode === "en" ? ["en"] : [langCode, "en"]
  const fl = document.getElementById("dl-lang-select-flags")
  if (fl) fl.innerHTML = lsFlagsHTML(dl)
  const opts = document.getElementById("dl-lang-select-opts")
  if (opts) opts.innerHTML = lsOptionsHTML("dl-lang-select")
  localStorage.setItem("maresafe_langs", JSON.stringify(dl.selected))
}

// ══ INIT ════════════════════════════════════════════════════════════
document.getElementById("site-version").textContent = "2.0"


buildProtocols()
buildSignals()

if (!initRenderMode()) {
  const _savedLangs = (() => {
    try { return JSON.parse(localStorage.getItem("maresafe_langs") || "null") || ["nl", "en"] }
    catch { return ["nl", "en"] }
  })()
  lsInit("dl-lang-select", "multi", _savedLangs, () => onLangChange())
  lsSetDisabled("dl-lang-select", true)
  lsInit("ui-lang-select", "single", ["en"], (sel) => onUiLangSelect(sel[0]))
  lsInit("ui-lang-select-modal", "single", ["en"], (sel) => onUiLangSelect(sel[0]))

  if (!loadFromStorage()) setLang("en")
  updatePreviewScale()

  if (new URLSearchParams(window.location.search).get("payment") === "success") {
    history.replaceState({}, "", window.location.pathname)
    document.getElementById("payment-success-banner").style.display = "flex"
  }

  if (!localStorage.getItem("maritieme_seen_info")) {
    setTimeout(openInfoModal, 400)
  }
}
