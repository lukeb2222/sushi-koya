# Sushi Koya photos

The current photos are Creative Commons (CC BY 2.0) photos of omakase-style sushi
from Flickr, found through Google's Open Images dataset. They show the style of
the meal, not Sushi Koya's own dishes or room. Credits are listed in
`public/data/site.json` → `photoCredits` and shown in the site footer
("Photo credits"). CC BY requires keeping those credits while the photos are used.

## Replacing with the restaurant's own photos (recommended)

Overwrite these files with the same names. The site picks them up automatically:

| File            | Where it appears                          | Best shape            |
|-----------------|-------------------------------------------|-----------------------|
| hero.jpg        | Full-screen opening hero                  | Landscape, 2400px wide, moody/dark |
| story.jpg       | "The Counter" section, large frame        | Portrait 4:5          |
| counter.jpg     | "The Counter" section, small inset frame  | Portrait 4:5          |
| chef.jpg        | Final "Take a seat" banner background     | Landscape             |
| gallery-1.jpg … gallery-12.jpg | Gallery grid + lightbox    | Mixed (tall/wide set in site.json) |

Once every photo is your own, delete `photoCredits` from `site.json` and the
credits section in the footer hides itself.
