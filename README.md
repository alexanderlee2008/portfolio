# LeePod: Alexander Lee's portfolio

A personal portfolio that works like a retro MP3 player. The whole page is the player's screen: a menu on the left, a live preview on the right, and a transport bar that plays real audio.

Live site: https://alexanderlee.vercel.app

## How it is built

- **One file.** `index.html` holds the HTML, CSS and JavaScript. No framework, no build step.
- **One data object.** All content (bio, projects, awards, skills, playlist, links) sits in `DATA` at the top of the script. Editing content never touches the logic.
- **Audio.** A single `<audio>` element, an equalizer driven by a Web Audio `AnalyserNode`, and lock-screen and media-key controls through the Media Session API.
- **Navigation.** A stack of menus, like the original iPod. Every screen has its own address (`#projects/kincard-dementia-care-app`), so links can point at a project and the browser's Back button works.
- **Layouts.** Split screen on wide windows, one column on phones, and a plain view (`#plain`) for quick reading.
- **Backend.** `api/counts.js` is a Vercel serverless function that counts visits, project views and song plays in an Upstash Redis store, with an origin check and a per-visitor rate limit.

## Files

```
index.html                  the site
api/counts.js               counter API (Vercel function)
fonts/vt323.woff2           pixel font (VT323, SIL Open Font License)
music/                      playlist tracks
media/                      project screenshots and the share image
Alexander_Lee_Resume.pdf    resume download
```

## Editing content

Open `index.html` and edit `DATA`:

- **Projects:** add an object to `DATA.projects`. `link` and `repo` add buttons; `media` adds screenshots or clips.
- **Songs:** put MP3s in `music/` and list them in `DATA.playlist`.
- **Looking-for line:** `DATA.about.seeking` (set to `""` to hide).
- **Counter:** `DATA.api` points at the deployed API. Set it to `""` to turn counting and the Charts page off.

## Running locally

```
python3 -m http.server 8000
```

Then open http://localhost:8000. Opening the file directly also works, but the equalizer only reacts to real audio over http.

## Deploying

The repo is connected to Vercel. Every push to `main` redeploys the site and the API. The API needs an Upstash Redis store connected to the Vercel project (Storage tab), which supplies `KV_REST_API_URL` and `KV_REST_API_TOKEN`.
