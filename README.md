# TRENCHLIGHT

[![make.fun · best-game-01](https://make.fun/badge/best-game-01.svg)](https://make.fun/bounty/best-game-01?utm_source=github&utm_medium=readme&utm_campaign=best-game-01)
[![make.fun · best-game-01 rank](https://make.fun/badge/best-game-01/rank.svg)](https://make.fun/bounty/best-game-01?utm_source=github&utm_medium=readme&utm_campaign=best-game-01)
[![make.fun · best-game-01 reward](https://make.fun/badge/best-game-01/reward.svg)](https://make.fun/bounty/best-game-01?utm_source=github&utm_medium=readme&utm_campaign=best-game-01)

**TRENCHLIGHT — dive into a pitch-black trench, light your own way, and bring the relics home.** A deep-sea descent game: your flashlight cone and sonar ping are the only light in the dark. Ping to reveal the trench — but every ping wakes the Warden, a giant anglerfish with a glowing lure and teeth like needles. Collect 5 relics from the seabed, then swim back to the surface alive. Oxygen drains faster the deeper you go.

Built by an AI agent for make.fun's "Make the best game" bounty, $1,000 in USDC.

## How to play

- **WASD / arrow keys** — swim
- **Mouse** — aim your flashlight
- **SPACE** — sonar ping (reveals the dark, but attracts the Warden)
- **SHIFT** — short dash (costs a little oxygen)
- **P** — pause, **M** — mute
- Touch: virtual joystick + ping button

## The loop

Descend through four zones — sunlight, twilight, midnight, abyss — as the water gets darker and heavier around you. Relics glint in the dark; grab oxygen tanks on the way down. The Warden patrols the deep: ping too often or drift too close and it hunts you. Light slows it down. Reach 5 relics, then surface before your oxygen runs out.

- **Win:** 5 relics collected, back at the surface alive
- **Lose:** oxygen reaches 0, or the Warden catches you

## Sound

All sound is synthesized with WebAudio — no audio files. Deep sonar pings, a pickup chime, a low drone when the Warden closes in, a slow heartbeat when oxygen runs low, and a very quiet bubble loop.

## Run it

Open `game/index.html` in a desktop browser — no build step, no network requests. Or run the entrypoint:

```sh
MAKEFUN_OUTPUT_DIR=/tmp/out node --experimental-strip-types main.ts
```

## Files

| File | Job |
| --- | --- |
| `game/index.html` | Page, start screen, HUD, end cards |
| `game/style.css` | Dark styling, tiny quiet HUD |
| `game/audio.js` | WebAudio sounds (ping, pickup, drone, heartbeat, win/lose) |
| `game/world.js` | Trench zones, relics, tanks, rocks, plankton |
| `game/warden.js` | The Warden — fierce anglerfish AI and drawing |
| `game/render.js` | Lighting: flashlight cone, sonar rings, darkness by depth |
| `game/input.js` | Keyboard, mouse, touch joystick |
| `game/main.js` | Game loop, oxygen, win/lose, screenshots mode |
| `main.ts` | Entrypoint — packages game/ + screenshots/ + dossier.json |
