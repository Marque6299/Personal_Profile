# Design and QA notes

This file records why the site looks and behaves the way it does, and what was and wasn't checked. It isn't part of the site and can be deleted.

## 1. Framing

- **Who it's for:** hiring managers, recruiters and colleagues evaluating John Mark as a data analytics lead who also builds web tools.
- **What they need to decide:** whether he can take messy operational reporting and turn it into something automated and usable, and how to contact him.
- **Content rule:** every claim on the site comes from the résumé. Where the résumé was silent (for example, which skills belong to which project), the copy says "Related skills" instead of asserting a link.
- **Archetype:** content and marketing site. Short pages, one primary action per page, scannable lists in place of card grids.

## 2. Information architecture

Six pages, flat navigation, no nesting: Home, About, Experience, Projects, Skills, Contact. The résumé download is reachable from the home hero, the experience page, the contact page and the footer. A closing call to action (email) appears on Home, About, Projects and Skills; Experience ends with the résumé and project links, and Contact is the destination itself.

## 3. Visual direction

The palette comes from the supplied portrait: the cyan wall (sampled at roughly `#009cc8` to `#00aedb`) and the navy blazer (`#111f3c`). Cyan is used as a surface (the portrait panel, the logo mark, the closing call to action) because it fails contrast as small text on light backgrounds. Navy carries text and primary buttons. A teal (`#00647f`) carries links on light surfaces; a light cyan (`#5cd3f0`) carries them on dark.

Type is Bricolage Grotesque for headings and Figtree for body, on a 1.25 scale from a 17px base, with system-font fallbacks.

Layout favours open lists with hairline dividers over boxed cards, so the portrait is the one strong image on the page.

### Token tiers

1. **Primitives:** raw colours, type scale, spacing (4px base).
2. **Semantic:** `--color-bg`, `--color-text`, `--color-link`, `--color-action-bg` and so on, each with a light and a dark value through `light-dark()`, plus a light-only fallback for older browsers.
3. **Component:** button height, control height, radii, portrait gradient.

## 4. Measured results

Contrast was calculated with the skills' `contrast.py` for every token pair before use, then re-measured in the browser on rendered text.

| Check | Result |
| --- | --- |
| Rendered text contrast, all six pages, light and dark (demo results open) | All text meets WCAG 2.2 AA (4.5:1, or 3:1 for large text) |
| Token adoption (`inventory.py`) | 87% of colour and length values come from tokens. The remaining literals are print-only `#000` and `#fff` |
| Hard-coded colours outside tokens | 2, both in the print stylesheet |
| `!important` | 4, all inside the reduced-motion reset |
| Horizontal overflow, 320 / 390 / 768 / 1024 / 1440 px | None, including with the demo open and 14 very wide columns loaded |
| Touch targets on a 390px screen | Buttons, form controls and navigation links are at least 44px tall. Links inside running text are exempt |
| Keyboard | Skip link is the first tab stop and moves focus to main; all 20 tab stops on the home page show a 3px outline; Escape closes the mobile menu and returns focus to its button |
| Without JavaScript | Navigation stays open, theme follows the system, copy and demo controls are hidden, email link works |
| Reduced motion | Bar transition is effectively off |

### Automated suite

306 checks run in headless Chromium: document structure (language, one `h1`, heading order, landmarks, alt text, unique ids), every internal link, anchor and asset resolving, JavaScript errors, the theme toggle and its persistence, the mobile menu, the copy button, and the spreadsheet demo. The demo checks cover semicolon, comma and tab CSV, quoted fields, empty and header-only files, oversized files, unsupported types, spreadsheet cells containing HTML (rendered as text, not interpreted), drag and drop, and the failure message when the Excel reader can't load.

### Defects found and fixed during review

1. **Chart bars were invisible.** The fill element was an inline `span`, so its width and height were ignored. The first test only checked the style value; a test that measures the painted size now guards it.
2. **Page grew wider than a phone once demo results appeared.** Single-column grids sized themselves to the widest table. All grids now use `minmax(0, 1fr)`. A test confirmed it fails when the fix is removed.
3. **Mobile header wrapped onto two lines.** Brand size was reduced, and on screens 368px wide or narrower the decorative "JM" mark is hidden so the name and Menu button share one row. Measured at 320, 360, 390 and 414px.
4. **Email link on the contact page was 42px tall**, under the 44px target. Raised to 44px.
5. **Copy overstated the résumé.** Project descriptions and "how I work" lines were rewritten to stay within what the résumé says.

## 5. Known limits

These weren't verified, and you should check them once the site is live.

- **Fonts:** the build environment had no internet, so Google Fonts never loaded and every layout check used fallback fonts. The fallback is likely wider than Figtree, so real text should be slightly narrower, but headings in Bricolage Grotesque haven't been seen. Check the headline wrapping on the home page.
- **Real Excel files:** `.xlsx` handling was tested with a stand-in for SheetJS. The CSV path was tested with the real code. Drop a real workbook onto the live demo once.
- **Browsers:** tested in Chromium only. `light-dark()` needs Safari 17.5, Chrome 123 or Firefox 120; older browsers get the light theme through the fallback values.
- **Assistive technology:** the markup follows accessible patterns and passes the automated checks, but it hasn't been tried with a screen reader.
- **SheetJS integrity hash:** the script is loaded without a Subresource Integrity attribute because the hash couldn't be fetched offline. cdnjs publishes one for this version; adding it to the loader in `excel-demo.js` is a worthwhile hardening step.
- **Copy to confirm:** the closing call to action and the "Good reasons to write" list on Contact assume you're open to inquiries about reporting and automation work. Reword them if that isn't the case.
