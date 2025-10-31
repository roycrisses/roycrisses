Repo: Portfolio-Website-Template — quick AI contributor guide

This is a static, single-page portfolio template (HTML/CSS/JS). The goal of AI edits is to be minimally invasive,
preserve third-party assets, and keep the site's responsive layout intact.

Big picture
- Single entry: `index.html` — all visible content lives here (hero, about, resume, projects, contact).
- Assets:
  - styles: `css/` (built CSS) and `scss/` (source SASS). Prefer editing `scss/` and compiling to `css/` when making broader style changes.
  - scripts: `js/` (site scripts). `js/main.js` contains page behavior; other libraries live in `lib/`.
  - images: `images/` (used by `index.html` via relative paths like `images/bg_1.jpg`).

Key patterns and conventions
- Preserve vendor code: do not modify files under `lib/`, `css/*bootstrap*`, or `fonts/` unless upgrading a library.
- Visual entry points use FTCO classes (e.g. `.ftco-animate`, `.block-20`, `.skill-mf`). `.ftco-animate` is used for reveal-on-scroll.
- Progress bars use `<div class="progress-bar" aria-valuenow="NN">` and inline `style="width: NN%;"`. JS enhancements should read `aria-valuenow` or `data-` attributes.
- Project cards use `a.block-20` with `style="background-image: url('images/proj_x.jpg')"` and `zoom-effect` for hover.
- Hero and large sections use inline `style="background-image: url(...)"` — keep image references relative to `images/`.
- Small, self-contained scripts may be appended before `</body>`; the site already loads jQuery and other libs first.

Dev / run workflows (no build system present)
- Quick local preview (PowerShell):
  python -m http.server 8000 --directory "d:\z\Portfolio-Website-Template"
  Start-Process "http://localhost:8000"
- Optional SASS workflow (if you edit `scss/`): install Dart Sass and run from project root:
  sass --watch scss:css
  (This produces CSS files in `css/` that `index.html` consumes.)

Editing guidance for AI agents
- Prefer edits to `scss/` or `css/style.css` for styling; add small animation CSS inline in `index.html` only if scoped and minimal.
- Add JS only when necessary and keep it vanilla or use existing jQuery patterns — the page loads jQuery; avoid adding new large dependencies.
- When changing images, place files in `images/` and reference them by their existing filenames. If replacing an image, preserve the same name to avoid updating multiple references.
- Keep the Colorlib footer/license note intact (it is required by the template license).

Concrete examples
- Add a project card (follow existing structure):
  <div class="col-md-4 d-flex ftco-animate">
    <div class="blog-entry justify-content-end">
      <a href="https://example.com" class="block-20 zoom-effect" style="background-image: url('images/proj_new.jpg');"></a>
      <div class="text mt-3 float-right d-block"> ... </div>
    </div>
  </div>

- Animate progress bars (JS reads aria-valuenow):
  const target = pb.getAttribute('aria-valuenow'); pb.style.width = target + '%';

What NOT to change
- Do not remove or rewrite the top-level `index.html` structure unless migrating to a new template.
- Avoid editing vendor JS/CSS in `lib/` and `css/bootstrap/`; instead override with new CSS rules.

If you need more context
- Inspect `index.html` for concrete examples of patterns mentioned above (`.ftco-animate`, `.block-20`, `progress-bar`, inline background images).
- If editing SASS, check `scss/style.scss` and `scss/bootstrap/` partials to follow existing variable names and mixins.

If anything here is unclear or you want additional rules (naming, linting, or commit message format), tell me and I'll iterate.
