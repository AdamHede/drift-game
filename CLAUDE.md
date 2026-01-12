# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

DRIFT is a browser-based 3D arena shooter built with Three.js. The core mechanic is **time dilation controlled by mouse movement speed** - slow mouse movement slows game time (bullet-time), fast movement returns to real-time.

## Running the Game

```bash
npx serve .
```

Open http://localhost:3000 in browser. Requires pointer lock for mouse capture.

## Architecture

**Single-file game engine** (`game.js`) with a main `Game` class containing:

- **Time System**: `timeScale` (0.1-1.0) calculated from `mouseVelocity` using rolling 100ms history. Player movement uses real `dt`, enemies/bullets use dilated `gameDt = dt * timeScale`.

- **Entity Arrays**: `enemies[]`, `bullets[]`, `enemyBullets[]`, `particles[]`, `pickups[]` - each with mesh and game state. Entities removed via splice after `scene.remove()`.

- **Wave System**: Enemy count = `3 + wave * 2`. Enemy types unlock at specific waves. Wave advances when `enemies.length === 0`.

- **Collision**: Distance-based checks in `updateBullets()`. Player radius ~0.8, enemies ~1.2.

## Key Implementation Details

- Three.js loaded via CDN (r128), no build step
- Uses `Euler` with 'YXZ' order for FPS-style camera rotation
- Arena bounded by `arenaSize` (40 units), enforced on player and enemies
- Enemy AI: basic pursuit with distance-based behavior changes (snipers retreat, others strafe when close)
- Particle system handles hit effects, death explosions, dash trails

## Adding Features

**New enemy type**: Add config to `enemyConfig` object in `spawnEnemy()`, add type to `types` array at appropriate wave threshold.

**New weapon**: Modify `shoot()` for projectile behavior, adjust `shootCooldown` for fire rate.

**New pickup**: Add type handling in `updatePickups()` collision check, spawn in `destroyEnemy()`.
