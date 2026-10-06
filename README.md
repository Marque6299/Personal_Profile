# John Mark Molina — Portfolio

A six-page personal portfolio built with plain HTML, CSS and JavaScript. There is no build step, no framework and no package to install.

| Page | File | Purpose |
| --- | --- | --- |
| Home | `index.html` | Who I am, what I work on, selected work |
| About | `about.html` | Background and how I work |
| Experience | `experience.html` | Roles at WNS and the MIS Digital Transformation Initiative |
| Projects | `projects.html` | Three projects, including a working spreadsheet demo |
| Skills | `skills.html` | Core tools and skills by area |
| Contact | `contact.html` | Email, phone, résumé download |

## Publish on GitHub Pages

1. Create an empty repository on GitHub. Name it `<your-username>.github.io` to get the short address `https://<your-username>.github.io/`, or use any other name (for example `portfolio`) to get `https://<your-username>.github.io/portfolio/`.
2. Unzip this folder, open a terminal inside it and run:

   ```bash
   git init -b main
   git add .
   git commit -m "Add portfolio site"
   git remote add origin https://github.com/<your-username>/<repo-name>.git
   git push -u origin main
   ```

3. On GitHub, open **Settings → Pages**. Under **Build and deployment**, choose **Deploy from a branch**, select **main** and **/ (root)**, then save.
4. Wait a minute or two. The site address appears at the top of the Pages settings.

All links are relative, so the site works the same at the root address or under a repository sub-path. The empty `.nojekyll` file tells GitHub Pages to serve the files as they are.

To preview locally, run `python3 -m http.server 8000` in this folder and open `http://localhost:8000`.

## Folder layout

```
index.html, about.html, experience.html, projects.html, skills.html, contact.html
assets/
  css/styles.css        All styling. Design tokens are at the top of the file.
  js/site.js            Theme toggle, mobile menu, copy-email button
  js/excel-demo.js      The spreadsheet demo on the Projects page
  img/                  Portrait (two sizes), favicon, touch icon, social card
  docs/                 Résumé PDF used by the download links
design-notes/           Design decisions and quality-check notes (safe to delete)
```

## Editing

- **Text:** edit the HTML files directly.
- **Header and footer:** these are repeated in every page. If you change the navigation or footer, make the same change in all six files.
- **Colors and fonts:** change the tokens in the first two sections of `assets/css/styles.css`. Tier 1 holds raw values, tier 2 gives them meaning and has a light and a dark value for each. Components use the tier 2 tokens, so one edit re-themes the whole site.
- **Résumé:** replace `assets/docs/John_Mark_Molina_Resume.pdf` with a new file of the same name.
- **Contact details:** the email and phone number appear in `contact.html`, in the footer and in the `mailto:` links of every page. Search for `jm.me6299` and `994 272` to find them all. They are public once the site is live, so remove any you don't want shown.
- **Link previews:** social sites need an absolute image address. Once you know your site address, add this to the `<head>` of `index.html`, replacing the address:

  ```html
  <meta property="og:image" content="https://<your-username>.github.io/<repo-name>/assets/img/og-card.jpg">
  ```

## Notes on the spreadsheet demo

- It runs entirely in the visitor's browser. Files are never uploaded.
- `.csv` files are parsed by the site's own code and work offline.
- `.xlsx` and `.xls` files are parsed with [SheetJS](https://sheetjs.com) 0.18.5, loaded from cdnjs only when one of those files is chosen. If that script can't load, the demo says so and suggests a `.csv` file.
- The sample data is fictional.

## External resources

The only third-party requests are Google Fonts (Bricolage Grotesque and Figtree, with system-font fallbacks, so the site is readable if they fail) and the SheetJS script above.

## Accessibility and compatibility

- Light and dark themes follow the visitor's system setting, with a manual toggle that is remembered.
- The site works without JavaScript. The menu stays open, the theme follows the system, and only the demo needs scripting.
- Keyboard users get a skip link, visible focus rings and an Escape key to close the mobile menu.
- Animation is switched off for visitors who ask their system to reduce motion.
