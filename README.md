# SB Development Group — Website

A cinematic, vertically-integrated developer experience for **SB Development Group**
(SBD · 1 Oak Construction). Built as a fast, dependency-light static site with a
premium private-equity / luxury-real-estate aesthetic.

## What's inside

- **Preloader** with animated counter + panel-wipe reveal
- **Custom cursor** with magnetic buttons and contextual labels (desktop)
- **Smooth scrolling** (Lenis) synced with **GSAP ScrollTrigger**
- **Scroll-triggered reveals**, split-text headline animations, and animated stat counters
- **Parallax** hero and project imagery
- **Infinite marquees** (ticker + disciplines)
- Fully **responsive** with a fullscreen mobile menu
- **Progressive enhancement** — if the CDN libraries fail or the user prefers
  reduced motion, all content stays fully visible and usable

## Content

All copy reflects the existing **sbdg1oak.com** content: the firm's vertically
integrated model, founders Roni Benjamini and Joseph Stern, the New York / South
Florida portfolio (Vela, Cove Miami, Silver Star Building, LIC), and stats
(3M+ sq ft in development, two-dozen ground-up projects, $1B+ South Florida pipeline).

## Run it

It's a static site — just open `index.html`, or serve the folder:

```bash
python3 -m http.server 8000
# then visit http://localhost:8000
```

## Structure

```
index.html        # markup + section content
css/style.css     # design system, layout, animation states
js/main.js        # preloader, cursor, smooth scroll, reveals, counters, parallax
assets/           # (reserved for project photography)
```

## Replacing imagery

Project and leadership images currently use high-resolution placeholders.
Swap them by editing the `background-image` rules in `css/style.css`
(search for `data-img=`) — drop real photography into `assets/` and point to it.
