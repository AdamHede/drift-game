# DRIFT - Time-Dilation Arena Shooter

A 3D arena shooter where **your mouse movement speed controls time itself**.

Move slowly for Matrix-style bullet-time. Move fast for real-time chaos. Choreograph your survival.

## Play

```bash
npx serve .
```

Then open http://localhost:3000 in your browser.

## Controls

- **WASD** - Move
- **Mouse** - Aim / Control time flow
- **Click** - Shoot
- **Space** - Dash

## The Core Mechanic

Your mouse/trackpad movement speed directly controls the flow of time:

- **Move slowly** - Time slows to a crawl (10% speed), giving you bullet-time to dodge and aim
- **Move fast** - Time flows normally, bringing real-time chaos

This creates a unique rhythm where you deliberately slow down to weave through bullets, then speed up to advance on enemies.

## Enemy Types

- **Basic (Red)** - Standard enemies, balanced speed and firepower
- **Fast (Orange)** - Quick and aggressive, spawns from wave 2
- **Heavy (Purple)** - Tanky with slow powerful shots, spawns from wave 3
- **Sniper (Green)** - Keeps distance, fast accurate shots, spawns from wave 5

## Tech Stack

- Three.js for 3D rendering
- Vanilla JavaScript
- No build step required
