# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

DRIFT is a browser-based 3D bullet-hell arena shooter built with Three.js. The core mechanic is **time dilation controlled by mouse movement speed** - slow mouse movement slows game time (bullet-time), fast movement returns to real-time.

## Running the Game

```bash
npx serve .
```

Open http://localhost:3000 in browser. Requires pointer lock for mouse capture.

## Architecture

**Single-file game engine** (`game.js`) with a main `Game` class containing:

### Core Systems

- **Time Dilation**: `timeScale` (0.05-1.0) calculated from `mouseVelocity`. Player moves at real `dt`, enemies/bullets use `gameDt = dt * timeScale`.

- **Entity Arrays**: `enemies[]`, `bullets[]`, `enemyBullets[]`, `particles[]`, `pickups[]`, `sniperBeams[]`

- **Wave System**: Enemy count = `3 + wave * 2`. Enemy types unlock at waves 2 (fast), 3 (heavy), 5 (sniper).

### Bullet System

Each bullet has:
- `mesh` - THREE.js sphere
- `trail` - Line geometry updated via `updateBulletTrail()`
- `velocity` - Direction and speed
- `bulletType` - 'standard', 'gentle_homing', 'aggressive_homing', 'delayed_homing', 'seeker'
- Homing properties: `homingStrength`, `homingDelay`, `homingActivated`, `canBeShot`

**Bullet Types**:
- Standard: Straight trajectory
- Gentle homing (Basic 20%): 10% turn rate, soft tracking
- Aggressive homing (Heavy): 40% turn rate, can be shot down by player
- Delayed homing (Fast): Travels straight 0.8s, then activates with particle burst
- Seeker (Player upgrade): Player bullets home to enemies

### Enemy Attack Patterns

| Enemy | Pattern | Method |
|-------|---------|--------|
| Basic | 3-bullet spread fan | `shootSpread()` |
| Fast | 5-shot burst, last is delayed homing | `shootBurst()` |
| Heavy | 6-bullet ring + aggressive homing | `shootRing()` |
| Sniper | Telegraph laser → instant hitscan | `startSniperTelegraph()` → `fireSniperBeam()` |

### Upgrade System

`initUpgrades()` returns array of upgrade objects with:
- `id`, `name`, `description`, `category`
- `apply(player)` - Mutates player stats

Shown between waves via `showUpgradeSelection()`. Player stats modified include:
- `damage`, `fireRate`, `bulletCount`, `bulletSpread`
- `piercing`, `seekerRounds`, `minTimeScale`
- `dashCooldownMax`, `pickupRange`, `timeShield`

## Key Implementation Details

- Three.js r128 via CDN, no build step
- FOV: 95 degrees for wider peripheral awareness
- All bullets have light trails (Line geometry with position history)
- Sniper telegraph: Red laser line that tracks player, flickers, fires after 0.5s
- Time Shield upgrade: 200ms invulnerability when entering slow-mo

## Adding Features

**New bullet type**: Add case in `createBullet()` to set homing properties, add visual handling in `updateBullets()`.

**New enemy pattern**: Add config in `spawnEnemy()`, create `shootX()` method, add case in `enemyShoot()`.

**New upgrade**: Add to array in `initUpgrades()` with `apply()` function that modifies `player` object.
