# Sushi Koya: website

Omakase · 163 West 71st Street, New York · Reserve: https://resy.com/cities/ny/sushi-koya

A complete, dependency-free site: an animated front end plus a small Node.js backend.

## Run it

```bash
npm start            # → http://localhost:3000
```

Requires Node 18+. There's nothing to install.

## What's inside

```
server.js                Node server: static files + JSON API + /reserve redirect
public/
  index.html             The site
  css/style.css          All styles & animations
  js/main.js             Opening animation, scroll effects, rendering, forms
  data/site.json         ← ALL restaurant content: prices, menu, hours, FAQ, reviews, gallery
  images/                ← drop the restaurant's photos here (see images/README.md)
  img/                   Ink illustrations (shown until photos are added) + favicon
  404.html
data/                    Created at runtime: inquiries.json, subscribers.json
```

## Editing content

Everything the restaurant would change (prices, course lists, fish, hours, FAQ,
reviews, gallery) lives in **`public/data/site.json`**. Edit it and refresh.

## API

| Method | Path                    | Purpose |
|--------|-------------------------|---------|
| GET    | `/api/site`             | Site content (site.json) |
| GET    | `/api/status`           | Open/closed now, in New York time |
| POST   | `/api/inquiry`          | Private dining / buyout / gift / press inquiries (validated, rate-limited, honeypot) |
| POST   | `/api/newsletter`       | Mailing-list sign-up (de-duplicated) |
| GET    | `/api/admin/inquiries`  | List inquiries: `Authorization: Bearer $ADMIN_TOKEN` |
| GET    | `/api/admin/subscribers`| List subscribers: same auth |
| GET    | `/reserve`              | 302 redirect to Resy (handy for QR codes / Instagram bio) |

```bash
ADMIN_TOKEN=choose-a-long-secret PORT=3000 npm start
curl -H "Authorization: Bearer choose-a-long-secret" http://localhost:3000/api/admin/inquiries
```

Submissions are stored as JSON files in `data/`. On hosts with ephemeral disks
(Render free tier, Heroku), attach a persistent disk or swap `appendStore()` in
`server.js` for a database or email service.

## Deploying

Any Node host works (Render, Railway, Fly.io, a VPS): start command `npm start`.
The `public/` folder also works on its own as a static site (Netlify, Vercel,
GitHub Pages). Everything renders from `data/site.json`; only the two forms need
the server.

## GitHub Pages

The site is served from the `gh-pages` branch, which holds the contents of `public/`.
To publish changes:

```bash
git fetch origin gh-pages
git push origin "$(git commit-tree main:public -p origin/gh-pages -m 'Publish site')":refs/heads/gh-pages
```

This adds a new commit on top of the live branch (no force-push), so anything
changed directly on GitHub is kept in history. Keep `public/CNAME`: it holds the
custom domain (sushikoyanyc.com).

On static hosting there's no `/api`, so the private-dining and newsletter forms
post to `formEndpoint` in `public/data/site.json` (e.g. a free Formspree form:
`https://formspree.io/f/xxxxxxx`). Until that's set, the form asks guests to call.
