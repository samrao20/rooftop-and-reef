# Rooftop & Reef

A tiny pixel hangout for two friends, a beach in Townsville and a rooftop in Mumbai, so each can drop in on the other's life when they have a minute.

Each of us runs a personal quest-and-habit system (the "Command Center"). Each one can produce a small, **allow-listed** card about its owner: rank, stats, shadows, this week's gate, a short "working on" note and a help board. This site reads both cards and draws the plaza where our two characters stand.

> Status: just started. Nothing here is published to the web yet. The repo is private on purpose until we have both read exactly what our cards say.

## How it works
1. Each person's Command Center has a **Share** page that previews the exact card and saves it to a file, `card.json`. Nothing is sent anywhere by that page.
2. We each copy our own card into `cards/<name>.json` in this repo and push it. Each person only ever touches their own file.
3. The site (plain HTML and JavaScript, no build step) reads the cards in `cards/` and draws the plaza. Replies, scores and co-op progress are all derived from the two cards, so there is no server, no database and no logins.

## Privacy rules (these matter more than the graphics)
- A card can only contain what the Command Center's allow-list builds: rank, level, XP, stat numbers, shadow names and tiers, gate counts, weekly quest counts, and two short files the owner writes by hand (`Working on` and `Asks`).
- No money, health, people, logs, quest text, job names, locations more precise than a city, or contact details. Ever.
- Public GitHub Pages means anyone with the link can read the cards. So: first names only, an obscure repo name, `noindex`, and nothing in a card we would not say out loud on a bus.
- Every publish starts with reading the preview. Nobody publishes someone else's card.

## Layout
```
index.html          the plaza (coming next)
cards/              one card per person (cards/examples/ holds fake demo cards)
docs/card-schema.md what a card contains
IDEAS.md            quirky ideas we might build
```

## Running it locally (once the plaza exists)
```bash
python3 -m http.server 8080
# then open http://localhost:8080
```

## Publishing (later, deliberately)
Settings → Pages → deploy from `main`. Pages on a private repo needs a paid GitHub plan; on a free plan the repo has to be public first. We decide that together, after reading the previews.
