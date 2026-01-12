# DRIFT - Time-Dilation Arena Shooter

A 3D bullet-hell arena shooter where **your mouse movement speed controls time itself**.

Move slowly for Matrix-style bullet-time. Move fast for real-time chaos. Choreograph your survival through waves of increasingly dangerous enemies.

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

- **Move slowly** - Time slows to a crawl (5-10% speed), giving you bullet-time to weave through projectiles
- **Move fast** - Time flows normally, bringing real-time chaos

This creates a unique rhythm where you deliberately slow down to read bullet patterns, then speed up to advance.

## Enemy Types

| Enemy | Color | Attack Pattern |
|-------|-------|----------------|
| **Basic** | Orange | 3-bullet spread fan, occasional gentle homing |
| **Fast** | Yellow | 5-shot burst, final bullet has delayed homing |
| **Heavy** | Purple | 6-bullet ring + aggressive homing missile (can be shot down!) |
| **Sniper** | Cyan | Telegraph laser → instant lightning bolt beam |

## Bullet Types

- **Standard** - Straight trajectory with light trail
- **Gentle Homing** - Soft curve toward player
- **Aggressive Homing** - Strong tracking, shoot it down for bonus points
- **Delayed Homing** - Travels straight, then suddenly snaps to track you (particle burst warning)

## Upgrades

After each wave, choose from 3 random upgrades:

**Weapons**: Shotgun Blast, Piercing Rounds, Seeker Rounds, Rapid Fire, Heavy Caliber

**Defensive**: Bullet Time+, Quick Dash, Shield Boost, Time Shield

**Utility**: Pickup Magnet, Score Multiplier

## Tech Stack

- Three.js r128 for 3D rendering
- Vanilla JavaScript
- No build step required
