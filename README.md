# Vardhman Constructions — Website

Modern, classy, SEO-optimized static website for Vardhman Constructions, Bhopal.

## Stack
Plain HTML/CSS/JS — no build step. Hostable on Netlify, Vercel, GitHub Pages, or any static host.

## Structure
```
/                              Root
  index.html                   Home
  about.html                   About / Story / Timeline
  projects.html                Projects index (filterable)
  services.html                What we build
  contact.html                 Contact form + map
  blog.html                    Insights / SEO articles
  sitemap.xml                  SEO sitemap
  robots.txt                   Crawler directives
  /projects/                   13 project detail pages
    vardhman-fairmont.html
    vardhman-celestia.html
    vardhman-medical-plaza.html
    vardhman-city.html
    vardhman-green-valley.html
    vardhman-green-park.html
    vardhman-green-city.html
    vardhman-green-enclave.html
    vardhman-city-plaza.html
    vardhman-mall.html
    shikhar-meridian.html
    pulkit-apartments.html
    radha-vallabh-complex.html
  /assets/
    /css/styles.css            Global design system
    /js/main.js                Nav, scroll reveal, stat counter, filters, contact form
    /images/                   All project & hero imagery
```

## Design Language
- **Palette:** Ivory white, pure white, champagne gold (`#C9A961`), deep gold (`#A8842F`), charcoal text
- **Typography:** Cormorant Garamond (serif headings) + Inter (sans body)
- **Motion:** Subtle fade-in on scroll, hero zoom, animated stat counters

## SEO Features
- Per-page tuned `<title>`, `<meta description>`, `<meta keywords>` targeting Bhopal real estate keywords
- JSON-LD structured data: `RealEstateAgent`, `Residence`, `ContactPage`, `AboutPage`, `ItemList`
- OpenGraph + Twitter card tags
- Canonical URLs
- `sitemap.xml` + `robots.txt`
- Semantic HTML5, descriptive alt text, lazy-loaded images
- Internal linking between project pages and from sitewide navigation

## Primary SEO Keywords
- best builders in Bhopal
- luxury apartments / villas in Bhopal
- 2 BHK / 3 BHK / 4 BHK flats in Bhopal
- real estate developers Bhopal
- Vardhman Constructions
- specific project names (Fairmont, Celestia, City, Green Valley, etc.)

## Local Preview
Just open `index.html` in a browser, or run any static server:
```bash
npx serve .
# or
python -m http.server 8000
```

## Deployment
- **Netlify / Vercel:** drag-and-drop the folder, or connect a git repo. Done.
- **GitHub Pages:** push to a repo, enable Pages from main branch.
- Update `https://www.vardhmanconstructions.com` in canonical/OG tags if hosted elsewhere.

## Contact Form
Currently uses `mailto:` to `vardhmanbhopal130@gmail.com`. To switch to a real backend:
- Drop in a form service (Formspree, Netlify Forms, Web3Forms) by changing the form `action` attribute, or
- POST to your own endpoint inside `assets/js/main.js`

## To Customize
- **Replace images:** drop new images into `/assets/images/` keeping filenames, or update `src` paths
- **Update content:** edit text directly in HTML files
- **Add a project:** copy any file in `/projects/`, update content, then add it to `projects.html`, `sitemap.xml`, and the footer link blocks

## Credits
Content drawn from vardhmanconstructions.com. Design inspired by hababy.co.in — white & gold luxury aesthetic.
