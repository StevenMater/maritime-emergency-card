      // ══ CONTACTS ════════════════════════════════════════════════════════
      const MAX_EXTRA = 5
      const CREW_ROWS = 7
      let fixedCrew = [
        { role: "skipper", name: "", phone: "" },
        { role: "mate", name: "", phone: "" },
      ]
      let extraCrew = []

      function iStyle() {
        return "font-family:var(--font-mono);padding:6px 8px;border:1.5px solid var(--input-bdr);border-radius:4px;outline:none"
      }
      function sStyle(dis) {
        const arrow = dis
          ? `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='10' height='6'%3E%3Cpath d='M0 0l5 6 5-6z' fill='%23aaaaaa'/%3E%3C/svg%3E")`
          : `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='10' height='6'%3E%3Cpath d='M0 0l5 6 5-6z' fill='%23444444'/%3E%3C/svg%3E")`
        return `font-family:var(--font-mono);padding:6px 16px 6px 8px;border:1.5px solid var(--input-bdr);border-radius:4px;background-color:${dis ? "var(--ui-border)" : "var(--input-bg)"};background-image:${arrow};background-repeat:no-repeat;background-position:right 8px center;-webkit-appearance:none;appearance:none;color:${dis ? "var(--mid)" : "var(--dark)"};outline:none`
      }

      function extraRoleKeys() {
        return ["passenger", "child", "pet"]
      }
      function roleLabel(key) {
        return T[currentLang][`role_${key}`] || key
      }
      function fixedRoleLabel(i) {
        return i === 0 ? roleLabel("skipper") : roleLabel("mate")
      }

      function renderContactEditor() {
        const el = document.getElementById("contact-rows")
        el.innerHTML = ""
        fixedCrew.forEach((c, i) => {
          const row = document.createElement("div")
          row.className = "contact-row"
          row.innerHTML = `
      <select class="crew-sel" disabled style="${sStyle(true)}"><option>${fixedRoleLabel(i)}</option></select>
      <input class="crew-inp" value="${c.name}" maxlength="25" placeholder="${T[currentLang].crew_name_placeholder}" oninput="fixedCrew[${i}].name=this.value;update()" style="${iStyle()}">
      <input class="crew-inp" value="${c.phone}" maxlength="17" placeholder="${T[currentLang].contact_placeholder}" oninput="fixedCrew[${i}].phone=this.value;update()" style="${iStyle()};max-width:170px">
      <button class="del-btn" onclick="clearFixed(${i})">×</button>`
          el.appendChild(row)
        })
        extraCrew.forEach((c, i) => {
          const row = document.createElement("div")
          row.className = "contact-row"
          row.innerHTML = `
      <select class="crew-sel" onchange="extraCrew[${i}].role=this.value;update()" style="${sStyle(false)}">
        ${extraRoleKeys()
          .map(
            (k) =>
              `<option value="${k}"${c.role === k ? " selected" : ""}>${roleLabel(k)}</option>`,
          )
          .join("")}
      </select>
      <input class="crew-inp" value="${c.name}" maxlength="25" placeholder="${T[currentLang].crew_name_placeholder}" oninput="extraCrew[${i}].name=this.value;update()" style="${iStyle()}">
      <input class="crew-inp" value="${c.phone}" maxlength="17" placeholder="${T[currentLang].contact_placeholder}" oninput="extraCrew[${i}].phone=this.value;update()" style="${iStyle()};max-width:170px">
      <button class="del-btn" onclick="removeExtra(${i})">×</button>`
          el.appendChild(row)
        })
        const addBtn = document.querySelector(".add-btn")
        addBtn.style.display = extraCrew.length >= MAX_EXTRA ? "none" : ""
        addBtn.textContent = T[currentLang].btn_add_crew
      }

      function clearFixed(i) {
        fixedCrew[i].name = ""
        fixedCrew[i].phone = ""
        renderContactEditor()
        update()
      }
      function addContact() {
        if (extraCrew.length >= MAX_EXTRA) return
        extraCrew.push({ role: "passenger", name: "", phone: "" })
        renderContactEditor()
        update()
      }
      function removeExtra(i) {
        extraCrew.splice(i, 1)
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
          div.className = `gelu-row ${rowI % 2 === 0 ? "alt" : "wht"}`
          const pat = document.createElement("div")
          pat.className = "gelu-pat"
          SIGNAL_PATTERNS[i].forEach((p) => {
            const el = document.createElement("span")
            el.className = p === "L" ? "g-L" : p === "S" ? "g-S" : "g-XS"
            pat.appendChild(el)
          })
          const d = document.createElement("span")
          d.className = "gelu-desc"
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
        if (d.length === 9)
          return `${d.slice(0, 3)} ${d.slice(3, 6)} ${d.slice(6)}`
        if (d.length === 10)
          return `${d.slice(0, 4)} ${d.slice(4, 7)} ${d.slice(7)}`
        return v || "—"
      }
      // Dutch 2-digit NDCs (area codes without leading 0, 7-digit subscriber)
      const NL_2DIGIT_NDC = new Set([
        10, 13, 15, 20, 23, 24, 26, 30, 33, 35, 36, 38, 40, 43, 45, 46, 50, 53,
        55, 58, 70, 71, 72, 73, 74, 75, 76, 77, 78, 79,
      ])
      function formatPhone(v) {
        if (!v) return "—"
        const s = v.trim()
        if (s.startsWith("+")) return s // already international
        const d = s.replace(/\D/g, "")
        if (!d) return s
        if (d.length !== 10 || !d.startsWith("0")) return s // unexpected format, return as-is
        // Mobile: 06-XXXXXXXX → +31 6 XX XX XX XX
        if (d.startsWith("06"))
          return `+31 6 ${d.slice(2, 4)} ${d.slice(4, 6)} ${d.slice(6, 8)} ${d.slice(8)}`
        // Special (0800, 0900, etc.): keep as national
        if (/^0[89]0/.test(d)) return s
        // National (085, 088, etc.): +31 XX XXX XXXX
        if (/^0(8[4-9])/.test(d)) {
          const ndc = d.slice(1, 3),
            sub = d.slice(3)
          return `+31 ${ndc} ${sub.slice(0, 3)} ${sub.slice(3)}`
        }
        // Geographic: detect area code length via NDC lookup
        const nsn = d.slice(1) // 9 digits without leading 0
        const ndc2 = parseInt(nsn.slice(0, 2), 10)
        if (NL_2DIGIT_NDC.has(ndc2)) {
          // 2-digit area code, 7-digit subscriber: +31 XX XXX XX XX
          const sub = nsn.slice(2)
          return `+31 ${nsn.slice(0, 2)} ${sub.slice(0, 3)} ${sub.slice(3, 5)} ${sub.slice(5)}`
        }
        // 3-digit area code, 6-digit subscriber: +31 XXX XX XX XX
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
        const callsign = document.getElementById("f-callsign").value
        const atis = document.getElementById("f-atis").value
        const mmsi = document.getElementById("f-mmsi").value
        const insName = document.getElementById("f-insurer-name").value
        const policy = document.getElementById("f-policy").value
        const insEmerg = document.getElementById("f-insurer-emergency").value
        const insOff = document.getElementById("f-insurer-office").value

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
        document.getElementById("r-callsign").textContent = dash(callsign)
        document.getElementById("r-atis").textContent = formatATIS(atis)
        document.getElementById("r-mmsi").textContent = formatMMSI(mmsi)

        // Crew — always CREW_ROWS rows
        const tbl = document.getElementById("r-crew")
        while (tbl.rows.length > 1) tbl.deleteRow(1)
        const allCrew = [
          ...fixedCrew.map((c, i) => ({
            ...c,
            displayRole: fixedRoleLabel(i),
          })),
          ...extraCrew.map((c) => ({ ...c, displayRole: roleLabel(c.role) })),
        ]
        for (let i = 0; i < CREW_ROWS; i++) {
          const tr = tbl.insertRow()
          tr.style.background = i % 2 === 0 ? "var(--alt)" : "white"
          if (i < allCrew.length) {
            const c = allCrew[i]
            tr.innerHTML = `<td class="c30">${c.displayRole}</td><td class="c40" style="font-weight:700">${c.name || "—"}</td><td class="c30 right">${formatPhone(c.phone)}</td>`
          } else {
            tr.innerHTML = `<td class="c30" style="color:var(--lgray)">—</td><td class="c40" style="color:var(--lgray)">—</td><td class="c30 right" style="color:var(--lgray)">—</td>`
          }
        }

        // Insurer
        document.getElementById("r-insurer-name").textContent = dash(insName)
        document.getElementById("r-policy").textContent = dash(policy)
        document.getElementById("r-insurer-emergency").textContent =
          formatPhone(insEmerg)
        document.getElementById("r-insurer-office").textContent =
          formatPhone(insOff)
        document.getElementById("r-insurer-badge1").textContent = insName || "—"
        document.getElementById("r-insurer-badge2").textContent = insName || "—"

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
        ].forEach(
          (id) => (document.getElementById(id).textContent = dash(name)),
        )
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
          ...fixedCrew.map((c) => c.name + c.phone),
          ...extraCrew.map((c) => c.name),
        ].some((v) => v && v.trim() !== "")
        const saveBtn = document.getElementById("btn-save")
        saveBtn.disabled = !hasData
        saveBtn.style.opacity = hasData ? "1" : "0.4"
        saveBtn.style.cursor = hasData ? "pointer" : "not-allowed"
        const now = new Date()
        const date = now.toLocaleDateString(
          currentLang === "nl" ? "nl-NL" : currentLang,
          { day: "numeric", month: "long", year: "numeric" },
        )
        document.getElementById("card-footer").textContent =
          t.footer_text.replace("{date}", date)
        const dateISO = now.toISOString().slice(0, 10)
        document.title = [
          "Maritieme Noodkaart",
          name || null,
          dateISO,
          currentLang.toUpperCase(),
        ]
          .filter(Boolean)
          .join(" - ")

        saveToStorage()
      }

      // ══ STORAGE ═══════════════════════════════════════════════════════════
      const CURRENT_VERSION = 6
      const STORAGE_KEY = "maritieme_noodkaart"

      function getFormData() {
        return {
          version: CURRENT_VERSION,
          lang: currentLang,
          name: document.getElementById("f-name").value,
          type: document.getElementById("f-type").value,
          eni: document.getElementById("f-eni").value,
          length: document.getElementById("f-length").value,
          width: document.getElementById("f-width").value,
          draft: document.getElementById("f-draft").value,
          airDraft: document.getElementById("f-airdraft").value,
          callSign: document.getElementById("f-callsign").value,
          atis: document.getElementById("f-atis").value,
          mmsi: document.getElementById("f-mmsi").value,
          insurerName: document.getElementById("f-insurer-name").value,
          policyNumber: document.getElementById("f-policy").value,
          insurerEmergencyPhone: document.getElementById("f-insurer-emergency")
            .value,
          insurerOfficePhone: document.getElementById("f-insurer-office").value,
          fixedCrew,
          extraCrew,
        }
      }

      function migrateData(d) {
        const version = d.version || 1
        if (version >= CURRENT_VERSION) return { data: d, outdated: false }

        // v1/v2 used Dutch field names and fixedCrew as 'fixed', extraCrew as 'extras'
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
          insurerEmergencyPhone: d.insurerEmergencyPhone || d.verzNood || "",
          insurerOfficePhone: d.insurerOfficePhone || d.verzKantoor || "",
          fixedCrew: (d.fixedCrew || d.fixed || []).map((c) => ({
            role:
              c.role ||
              (c.rol === "Schipper"
                ? "skipper"
                : c.rol === "Maat"
                  ? "mate"
                  : "skipper"),
            name: c.name || c.naam || "",
            phone: c.phone || c.tel || "",
          })),
          extraCrew: (d.extraCrew || d.extras || []).map((c) => ({
            role: c.role || "passenger",
            name: c.name || c.naam || "",
            phone: c.phone || c.tel || "",
          })),
        }
        return { data: m, outdated: true }
      }

      function showVersionWarning() {
        const t = T[currentLang]
        const el = document.getElementById("version-warning")
        document.getElementById("vw-title").textContent = t.vw_title
        document.getElementById("vw-body").textContent = t.vw_body
        el.style.display = "flex"
      }

      function applyFormData(d) {
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
        s("f-callsign", data.callSign)
        s("f-atis", data.atis)
        s("f-mmsi", data.mmsi)
        s("f-insurer-name", data.insurerName)
        s("f-policy", data.policyNumber)
        s("f-insurer-emergency", data.insurerEmergencyPhone)
        s("f-insurer-office", data.insurerOfficePhone)
        if (Array.isArray(data.fixedCrew)) fixedCrew = data.fixedCrew
        if (Array.isArray(data.extraCrew)) extraCrew = data.extraCrew
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
        a.download = `Maritieme Noodkaart v${CURRENT_VERSION} - ${name} - ${today}.json`
        a.click()
        URL.revokeObjectURL(a.href)
        document.getElementById("version-warning").style.display = "none"
      }

      function clearAll() {
        if (!confirm(T[currentLang].clear_confirm)) return
        ;[
          "f-name",
          "f-type",
          "f-eni",
          "f-length",
          "f-width",
          "f-draft",
          "f-airdraft",
          "f-callsign",
          "f-atis",
          "f-mmsi",
          "f-insurer-name",
          "f-policy",
          "f-insurer-emergency",
          "f-insurer-office",
        ].forEach((id) => {
          document.getElementById(id).value = ""
        })
        fixedCrew = [
          { role: "skipper", name: "", phone: "" },
          { role: "mate", name: "", phone: "" },
        ]
        extraCrew = []
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

      const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent)
      window.addEventListener("beforeprint", () => {
        if (isIOS) document.body.classList.add("printing-ios")
      })
      window.addEventListener("afterprint", () => {
        document.body.classList.remove("printing-ios")
        updatePreviewScale()
      })

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

      // ══ INIT ════════════════════════════════════════════════════════════
      document.getElementById("site-version").textContent = CURRENT_VERSION
      buildProtocols()
      buildSignals()
      if (!loadFromStorage()) setLang("nl")
      updatePreviewScale()
      if (!localStorage.getItem("maritieme_seen_info")) {
        setTimeout(openInfoModal, 400)
      }
