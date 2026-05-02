# MareSafe — Project Rules

## Translations

Every user-facing string in this app must be translated into all four languages: **nl, en, fr, de**.

This includes:
- All UI labels, buttons, placeholders, tooltips
- All modal titles, body text, status messages, error messages
- All dynamic strings set via JS (use `T[currentLang].key` — never hardcode English)

**Exceptions** (do not translate):
- Card content that is inherently language-neutral (e.g., VHF channel numbers, protocol signal descriptions that are internationally standardised)
- The `MareSafe` brand name

**Pattern**: Static text → `data-i18n="key"` on the element (setLang applies innerHTML). Dynamic text → `T[currentLang].key` in JS. New keys go into all four language objects in `translations.js`.

---

## Modal styling

When a modal body and its header share the same background colour (`var(--navy)`), omit the top padding on the body (`padding: 0 24px 24px` instead of `padding: 24px`).

---

## Commits

Never commit unless the user explicitly says so. When asked, use the `/commit` skill — it groups changes into logical, individually-revertable commits using conventional commit format. Never push.

---

## Icons

Use inline Lucide SVGs (24×24 viewBox, `stroke="currentColor"`) — no emoji, no CDN. Size to context (14px for buttons, 32px for decorative).
