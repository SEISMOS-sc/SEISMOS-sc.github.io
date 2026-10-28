# SEISMOS project page

Project website for **SEISMOS: A Statistical Signal Detection Framework for Semantic Chunking** (NeurIPS 2026).

Static site, no build step. Publish it by pushing this folder to `SEISMOS-sc/SEISMOS-sc.github.io`
(GitHub Pages serves `index.html` from the default branch automatically).

```
index.html                 the page
static/css/style.css       styles (colour + type tokens at the top)
static/js/detector.js      the Laplacian detector (Algorithm 2) + synthetic signal for the demo
static/js/main.js          hero trace, playground, figure zoom, tabs, BibTeX copy
static/images/             figures from the paper
```

## Things to fill in

- **Paper / arXiv buttons** – in `index.html`, search for `btn soon`. Replace each
  `<span class="btn soon" ...> ... </span>` with `<a class="btn" href="URL"> ... </a>` and delete the `<small>soon</small>`.
- **BibTeX** – update the `@inproceedings` entry (pages, URL) once the proceedings are out.

## Preview locally

```
python3 -m http.server 8000
# open http://localhost:8000
```

Fonts (IBM Plex Sans/Mono, Source Serif 4) load from Google Fonts and equations from MathJax 3 on jsDelivr.
