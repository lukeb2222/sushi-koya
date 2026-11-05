# Sushi Koya photos

Drop the restaurant's photos in this folder using these exact file names.
The site picks each one up automatically. Until a photo is present, a gold ink
illustration is shown in its place, so the site always looks finished.

| File            | Where it appears                          | Best shape            |
|-----------------|-------------------------------------------|-----------------------|
| hero.jpg        | Full-screen opening hero                  | Landscape, 2400px wide, moody/dark |
| story.jpg       | "The Counter" section, large frame        | Portrait 4:5          |
| counter.jpg     | "The Counter" section, small inset frame  | Portrait 4:5          |
| chef.jpg        | Final "Take a seat" banner background     | Landscape             |
| gallery-1.jpg … gallery-8.jpg | Gallery grid + lightbox     | Mixed (tall/wide set in site.json) |

Want more or fewer gallery photos? Edit the `gallery` list in
`public/data/site.json`. Each entry has `src`, `alt`, `caption` and `size`
(`"tall"`, `"wide"` or `""`). Any file name / format (.jpg, .webp, .png) works.

Tip: export at ~2000px on the long edge, 75–80% JPEG quality (or WebP) to keep the page fast.
