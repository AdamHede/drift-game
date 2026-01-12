// DRIFT - Time-Dilation Arena Shooter
// Core mechanic: Mouse movement speed controls time flow

class Game {
    constructor() {
        this.scene = null;
        this.camera = null;
        this.renderer = null;
        this.clock = new THREE.Clock();

        // Time dilation
        this.timeScale = 1.0;
        this.targetTimeScale = 1.0;
        this.mouseVelocity = 0;
        this.lastMouseX = 0;
        this.lastMouseY = 0;
        this.mouseHistory = [];

        // Player state
        this.player = {
            position: new THREE.Vector3(0, 1.6, 0),
            velocity: new THREE.Vector3(),
            rotation: new THREE.Euler(0, 0, 0, 'YXZ'),
            health: 100,
            maxHealth: 100,
            canDash: true,
            dashCooldown: 0,
            dashCooldownMax: 2,
            isDashing: false,
            dashVelocity: new THREE.Vector3(),
            // Weapon stats (modified by upgrades)
            damage: 25,
            fireRate: 0.15,
            bulletCount: 1,
            bulletSpread: 0,
            piercing: false,
            seekerRounds: false,
            minTimeScale: 0.1,
            scoreMultiplier: 1,
            pickupRange: 1.5,
            timeShield: false,
            timeShieldActive: false
        };

        // Game state
        this.isRunning = false;
        this.isPaused = false;
        this.score = 0;
        this.kills = 0;
        this.wave = 1;
        this.enemies = [];
        this.bullets = [];
        this.enemyBullets = [];
        this.particles = [];
        this.pickups = [];
        this.sniperBeams = [];
        this.sniperTelegraphs = [];

        // Input state
        this.keys = {};
        this.mouseDown = false;
        this.shootCooldown = 0;

        // Arena
        this.arenaSize = 40;

        // Effects
        this.screenShake = 0;

        // Upgrades system
        this.availableUpgrades = this.initUpgrades();
        this.acquiredUpgrades = [];
        this.isSelectingUpgrade = false;

        // Cached geometries and materials for performance
        this.cachedGeometries = {};
        this.cachedMaterials = {};

        this.init();
    }

    // Get or create cached geometry
    getGeometry(key, createFn) {
        if (!this.cachedGeometries[key]) {
            this.cachedGeometries[key] = createFn();
        }
        return this.cachedGeometries[key];
    }

    // Get or create cached material
    getMaterial(key, createFn) {
        if (!this.cachedMaterials[key]) {
            this.cachedMaterials[key] = createFn();
        }
        return this.cachedMaterials[key];
    }

    initUpgrades() {
        return [
            {
                id: 'shotgun',
                name: 'Shotgun Blast',
                description: '7 pellets per shot, wider spread',
                category: 'weapon',
                apply: (player) => {
                    player.bulletCount = 7;
                    player.bulletSpread = 0.15;
                    player.fireRate = 0.4;
                }
            },
            {
                id: 'piercing',
                name: 'Piercing Rounds',
                description: 'Bullets pass through enemies',
                category: 'weapon',
                apply: (player) => { player.piercing = true; }
            },
            {
                id: 'seeker',
                name: 'Seeker Rounds',
                description: 'Bullets home toward enemies',
                category: 'weapon',
                apply: (player) => { player.seekerRounds = true; }
            },
            {
                id: 'rapidfire',
                name: 'Rapid Fire',
                description: '2x fire rate, 0.7x damage',
                category: 'weapon',
                apply: (player) => {
                    player.fireRate *= 0.5;
                    player.damage *= 0.7;
                }
            },
            {
                id: 'heavycaliber',
                name: 'Heavy Caliber',
                description: '1.5x damage, slower fire rate',
                category: 'weapon',
                apply: (player) => {
                    player.damage *= 1.5;
                    player.fireRate *= 1.4;
                }
            },
            {
                id: 'bullettime',
                name: 'Bullet Time+',
                description: 'Time slows even more (5% min)',
                category: 'defensive',
                apply: (player) => { player.minTimeScale = 0.05; }
            },
            {
                id: 'quickdash',
                name: 'Quick Dash',
                description: 'Dash cooldown reduced to 1.2s',
                category: 'defensive',
                apply: (player) => { player.dashCooldownMax = 1.2; }
            },
            {
                id: 'shield',
                name: 'Shield Boost',
                description: '+50 max HP, heal to full',
                category: 'defensive',
                apply: (player) => {
                    player.maxHealth += 50;
                    player.health = player.maxHealth;
                }
            },
            {
                id: 'timeshield',
                name: 'Time Shield',
                description: 'Brief invulnerability entering slow-mo',
                category: 'defensive',
                apply: (player) => { player.timeShield = true; }
            },
            {
                id: 'magnet',
                name: 'Pickup Magnet',
                description: 'Collect pickups from further away',
                category: 'utility',
                apply: (player) => { player.pickupRange = 4; }
            },
            {
                id: 'scoremult',
                name: 'Score Multiplier',
                description: '1.5x points',
                category: 'utility',
                apply: (player) => { player.scoreMultiplier *= 1.5; }
            }
        ];
    }

    init() {
        // Scene setup
        this.scene = new THREE.Scene();
        this.scene.fog = new THREE.FogExp2(0x000011, 0.015);

        // Camera - wider FOV for better awareness
        this.camera = new THREE.PerspectiveCamera(95, window.innerWidth / window.innerHeight, 0.1, 1000);
        this.camera.position.copy(this.player.position);

        // Renderer
        this.renderer = new THREE.WebGLRenderer({ antialias: true });
        this.renderer.setSize(window.innerWidth, window.innerHeight);
        this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
        this.renderer.shadowMap.enabled = true;
        this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
        document.getElementById('game-container').insertBefore(
            this.renderer.domElement,
            document.getElementById('ui')
        );

        // Lighting
        this.setupLighting();

        // Arena
        this.createArena();

        // Event listeners
        this.setupEventListeners();

        // Start screen
        document.getElementById('start-btn').addEventListener('click', () => this.startGame());
        document.getElementById('restart-btn').addEventListener('click', () => this.restartGame());

        // Initial render
        this.renderer.render(this.scene, this.camera);
    }

    setupLighting() {
        const ambient = new THREE.AmbientLight(0x111122, 0.5);
        this.scene.add(ambient);

        const dirLight = new THREE.DirectionalLight(0xffffff, 0.8);
        dirLight.position.set(10, 20, 10);
        dirLight.castShadow = true;
        dirLight.shadow.mapSize.width = 2048;
        dirLight.shadow.mapSize.height = 2048;
        dirLight.shadow.camera.near = 0.5;
        dirLight.shadow.camera.far = 50;
        dirLight.shadow.camera.left = -30;
        dirLight.shadow.camera.right = 30;
        dirLight.shadow.camera.top = 30;
        dirLight.shadow.camera.bottom = -30;
        this.scene.add(dirLight);

        const colors = [0x00ffff, 0xff00ff, 0x0044ff, 0xff0044];
        const positions = [[-15, 5, -15], [15, 5, -15], [-15, 5, 15], [15, 5, 15]];

        positions.forEach((pos, i) => {
            const light = new THREE.PointLight(colors[i], 0.5, 30);
            light.position.set(...pos);
            this.scene.add(light);
        });
    }

    createArena() {
        const size = this.arenaSize;

        const floorGeometry = new THREE.PlaneGeometry(size * 2, size * 2, 40, 40);
        const floorMaterial = new THREE.MeshStandardMaterial({
            color: 0x111122,
            roughness: 0.8,
            metalness: 0.2,
        });
        const floor = new THREE.Mesh(floorGeometry, floorMaterial);
        floor.rotation.x = -Math.PI / 2;
        floor.receiveShadow = true;
        this.scene.add(floor);

        const gridHelper = new THREE.GridHelper(size * 2, 40, 0x00ffff, 0x001133);
        gridHelper.position.y = 0.01;
        this.scene.add(gridHelper);

        const wallMaterial = new THREE.MeshBasicMaterial({
            color: 0x00ffff,
            transparent: true,
            opacity: 0.1,
            side: THREE.DoubleSide
        });

        const wallHeight = 10;
        const wallPositions = [
            { pos: [0, wallHeight/2, -size], rot: [0, 0, 0] },
            { pos: [0, wallHeight/2, size], rot: [0, 0, 0] },
            { pos: [-size, wallHeight/2, 0], rot: [0, Math.PI/2, 0] },
            { pos: [size, wallHeight/2, 0], rot: [0, Math.PI/2, 0] }
        ];

        wallPositions.forEach(wall => {
            const geometry = new THREE.PlaneGeometry(size * 2, wallHeight);
            const mesh = new THREE.Mesh(geometry, wallMaterial);
            mesh.position.set(...wall.pos);
            mesh.rotation.set(...wall.rot);
            this.scene.add(mesh);

            const edgeGeometry = new THREE.BufferGeometry();
            const halfSize = size;
            const points = [
                new THREE.Vector3(-halfSize, -wallHeight/2, 0),
                new THREE.Vector3(-halfSize, wallHeight/2, 0),
                new THREE.Vector3(halfSize, wallHeight/2, 0),
                new THREE.Vector3(halfSize, -wallHeight/2, 0),
                new THREE.Vector3(-halfSize, -wallHeight/2, 0)
            ];
            edgeGeometry.setFromPoints(points);
            const edgeMaterial = new THREE.LineBasicMaterial({ color: 0x00ffff, transparent: true, opacity: 0.5 });
            const edge = new THREE.Line(edgeGeometry, edgeMaterial);
            edge.position.set(...wall.pos);
            edge.rotation.set(...wall.rot);
            this.scene.add(edge);
        });

        const pillarGeometry = new THREE.CylinderGeometry(0.5, 0.5, wallHeight, 8);
        const pillarMaterial = new THREE.MeshStandardMaterial({
            color: 0x00ffff,
            emissive: 0x004444,
            metalness: 0.8,
            roughness: 0.2
        });

        [[-size, -size], [-size, size], [size, -size], [size, size]].forEach(([x, z]) => {
            const pillar = new THREE.Mesh(pillarGeometry, pillarMaterial);
            pillar.position.set(x, wallHeight/2, z);
            pillar.castShadow = true;
            this.scene.add(pillar);
        });

        this.createObstacles();
    }

    createObstacles() {
        const obstaclePositions = [
            { pos: [10, 1.5, 10], size: [3, 3, 3] },
            { pos: [-10, 1.5, 10], size: [3, 3, 3] },
            { pos: [10, 1.5, -10], size: [3, 3, 3] },
            { pos: [-10, 1.5, -10], size: [3, 3, 3] },
            { pos: [0, 1, 15], size: [6, 2, 2] },
            { pos: [0, 1, -15], size: [6, 2, 2] },
            { pos: [15, 1, 0], size: [2, 2, 6] },
            { pos: [-15, 1, 0], size: [2, 2, 6] },
            { pos: [20, 0.75, 20], size: [2, 1.5, 2] },
            { pos: [-20, 0.75, 20], size: [2, 1.5, 2] },
            { pos: [20, 0.75, -20], size: [2, 1.5, 2] },
            { pos: [-20, 0.75, -20], size: [2, 1.5, 2] },
        ];

        const obstacleMaterial = new THREE.MeshStandardMaterial({
            color: 0x222233,
            roughness: 0.7,
            metalness: 0.3
        });

        obstaclePositions.forEach(obs => {
            const geometry = new THREE.BoxGeometry(...obs.size);
            const mesh = new THREE.Mesh(geometry, obstacleMaterial);
            mesh.position.set(...obs.pos);
            mesh.castShadow = true;
            mesh.receiveShadow = true;
            mesh.userData.isObstacle = true;
            this.scene.add(mesh);
        });
    }

    setupEventListeners() {
        document.addEventListener('mousemove', (e) => {
            if (!this.isRunning || this.isPaused || this.isSelectingUpgrade) return;

            const dx = e.movementX || 0;
            const dy = e.movementY || 0;
            const velocity = Math.sqrt(dx * dx + dy * dy);

            this.mouseHistory.push({ velocity, time: Date.now() });
            const cutoff = Date.now() - 100;
            this.mouseHistory = this.mouseHistory.filter(h => h.time > cutoff);

            const avgVelocity = this.mouseHistory.reduce((sum, h) => sum + h.velocity, 0) / this.mouseHistory.length;
            this.mouseVelocity = avgVelocity;

            const sensitivity = 0.002;
            this.player.rotation.y -= dx * sensitivity;
            this.player.rotation.x -= dy * sensitivity;
            this.player.rotation.x = Math.max(-Math.PI / 2, Math.min(Math.PI / 2, this.player.rotation.x));
        });

        document.addEventListener('mousedown', (e) => {
            if (e.button === 0) this.mouseDown = true;
        });
        document.addEventListener('mouseup', (e) => {
            if (e.button === 0) this.mouseDown = false;
        });

        document.addEventListener('keydown', (e) => {
            this.keys[e.code] = true;
            if (e.code === 'Space' && this.isRunning && !this.isSelectingUpgrade) {
                e.preventDefault();
                this.tryDash();
            }
        });
        document.addEventListener('keyup', (e) => {
            this.keys[e.code] = false;
        });

        document.addEventListener('click', () => {
            if (this.isRunning && !document.pointerLockElement && !this.isSelectingUpgrade) {
                this.renderer.domElement.requestPointerLock();
            }
        });

        window.addEventListener('resize', () => {
            this.camera.aspect = window.innerWidth / window.innerHeight;
            this.camera.updateProjectionMatrix();
            this.renderer.setSize(window.innerWidth, window.innerHeight);
        });
    }

    startGame() {
        document.getElementById('start-screen').style.display = 'none';
        this.isRunning = true;
        this.renderer.domElement.requestPointerLock();
        this.spawnWave();
        this.gameLoop();
    }

    restartGame() {
        // Reset player
        this.player.position.set(0, 1.6, 0);
        this.player.velocity.set(0, 0, 0);
        this.player.rotation.set(0, 0, 0);
        this.player.health = 100;
        this.player.maxHealth = 100;
        this.player.canDash = true;
        this.player.dashCooldown = 0;
        this.player.dashCooldownMax = 2;
        this.player.damage = 25;
        this.player.fireRate = 0.15;
        this.player.bulletCount = 1;
        this.player.bulletSpread = 0;
        this.player.piercing = false;
        this.player.seekerRounds = false;
        this.player.minTimeScale = 0.1;
        this.player.scoreMultiplier = 1;
        this.player.pickupRange = 1.5;
        this.player.timeShield = false;

        // Reset game state
        this.score = 0;
        this.kills = 0;
        this.wave = 1;
        this.timeScale = 1;
        this.targetTimeScale = 1;
        this.acquiredUpgrades = [];
        this.isSelectingUpgrade = false;

        // Clear entities
        this.enemies.forEach(e => {
            this.scene.remove(e.mesh);
            if (e.telegraphLine) this.scene.remove(e.telegraphLine);
        });
        this.bullets.forEach(b => {
            this.scene.remove(b.mesh);
            if (b.trail) this.scene.remove(b.trail);
        });
        this.enemyBullets.forEach(b => {
            this.scene.remove(b.mesh);
            if (b.trail) this.scene.remove(b.trail);
        });
        this.particles.forEach(p => this.scene.remove(p.mesh));
        this.pickups.forEach(p => this.scene.remove(p.mesh));
        this.sniperBeams.forEach(b => this.scene.remove(b.mesh));
        this.sniperTelegraphs.forEach(t => this.scene.remove(t.line));

        this.enemies = [];
        this.bullets = [];
        this.enemyBullets = [];
        this.particles = [];
        this.pickups = [];
        this.sniperBeams = [];
        this.sniperTelegraphs = [];

        // Update UI
        this.updateUI();
        document.getElementById('game-over').style.display = 'none';
        document.getElementById('health-bar').style.width = '100%';
        document.getElementById('upgrade-screen').style.display = 'none';

        // Start
        this.isRunning = true;
        this.renderer.domElement.requestPointerLock();
        this.spawnWave();
    }

    tryDash() {
        if (!this.player.canDash) return;

        const dir = new THREE.Vector3();
        if (this.keys['KeyW']) dir.z -= 1;
        if (this.keys['KeyS']) dir.z += 1;
        if (this.keys['KeyA']) dir.x -= 1;
        if (this.keys['KeyD']) dir.x += 1;

        if (dir.length() === 0) {
            dir.z = -1;
        }
        dir.normalize();
        dir.applyAxisAngle(new THREE.Vector3(0, 1, 0), this.player.rotation.y);

        this.player.isDashing = true;
        this.player.dashVelocity.copy(dir).multiplyScalar(50);
        this.player.canDash = false;
        this.player.dashCooldown = this.player.dashCooldownMax;

        this.createDashTrail();

        setTimeout(() => {
            this.player.isDashing = false;
        }, 150);
    }

    createDashTrail() {
        for (let i = 0; i < 10; i++) {
            setTimeout(() => {
                this.createParticle(
                    this.player.position.clone(),
                    new THREE.Vector3((Math.random() - 0.5) * 2, Math.random() * 2, (Math.random() - 0.5) * 2),
                    0x00ffff,
                    0.3
                );
            }, i * 15);
        }
    }

    spawnWave() {
        const enemyCount = 3 + this.wave * 2;

        const indicator = document.getElementById('wave-indicator');
        indicator.textContent = `Wave ${this.wave}`;
        indicator.style.opacity = '1';
        setTimeout(() => indicator.style.opacity = '0', 2000);

        for (let i = 0; i < enemyCount; i++) {
            setTimeout(() => this.spawnEnemy(), i * 400);
        }
    }

    spawnEnemy() {
        const size = this.arenaSize - 5;

        let x, z;
        do {
            const edge = Math.floor(Math.random() * 4);
            switch (edge) {
                case 0: x = -size + Math.random() * size * 2; z = -size; break;
                case 1: x = -size + Math.random() * size * 2; z = size; break;
                case 2: x = -size; z = -size + Math.random() * size * 2; break;
                case 3: x = size; z = -size + Math.random() * size * 2; break;
            }
        } while (Math.sqrt(
            Math.pow(x - this.player.position.x, 2) +
            Math.pow(z - this.player.position.z, 2)
        ) < 15);

        const types = ['basic'];
        if (this.wave >= 2) types.push('fast');
        if (this.wave >= 3) types.push('heavy');
        if (this.wave >= 5) types.push('sniper');

        const type = types[Math.floor(Math.random() * types.length)];

        // Updated enemy configs with bullet hell patterns
        const enemyConfig = {
            basic: { health: 30, speed: 5, color: 0xff4400, size: 0.8, shootRate: 0.9, bulletSpeed: 18, pattern: 'spread' },
            fast: { health: 20, speed: 12, color: 0xffff00, size: 0.6, shootRate: 0.6, bulletSpeed: 22, pattern: 'burst' },
            heavy: { health: 100, speed: 3, color: 0x8800ff, size: 1.2, shootRate: 2.0, bulletSpeed: 14, pattern: 'ring' },
            sniper: { health: 25, speed: 2, color: 0x00ffff, size: 0.7, shootRate: 2.5, bulletSpeed: 0, pattern: 'lightning' }
        };

        const config = enemyConfig[type];

        const geometry = new THREE.OctahedronGeometry(config.size);
        const material = new THREE.MeshStandardMaterial({
            color: config.color,
            emissive: config.color,
            emissiveIntensity: 0.3,
            metalness: 0.8,
            roughness: 0.2
        });
        const mesh = new THREE.Mesh(geometry, material);
        mesh.position.set(x, 1.5, z);
        mesh.castShadow = true;
        this.scene.add(mesh);

        const enemy = {
            mesh,
            type,
            health: config.health,
            maxHealth: config.health,
            speed: config.speed,
            shootRate: config.shootRate,
            bulletSpeed: config.bulletSpeed,
            pattern: config.pattern,
            shootTimer: Math.random() * config.shootRate,
            velocity: new THREE.Vector3(),
            telegraphLine: null,
            telegraphTime: 0,
            isTelegraphing: false
        };

        this.enemies.push(enemy);
        this.createSpawnEffect(mesh.position);
    }

    createSpawnEffect(position) {
        for (let i = 0; i < 8; i++) { // Reduced from 20 to 8
            const angle = (i / 8) * Math.PI * 2;
            const vel = new THREE.Vector3(
                Math.cos(angle) * 5,
                2 + Math.random() * 3,
                Math.sin(angle) * 5
            );
            this.createParticle(position.clone(), vel, 0xff0044, 0.4);
        }
    }

    createParticle(position, velocity, color, life) {
        // Limit max particles for performance
        if (this.particles.length > 150) return;

        // Use cached geometry
        const geometry = this.getGeometry('particle', () =>
            new THREE.SphereGeometry(0.1, 4, 3) // Low-poly particle
        );

        // Cache materials by color
        const matKey = `particle_${color.toString(16)}`;
        const material = this.getMaterial(matKey, () =>
            new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 1 })
        );

        const mesh = new THREE.Mesh(geometry, material.clone()); // Clone for opacity animation
        mesh.position.copy(position);
        this.scene.add(mesh);

        this.particles.push({
            mesh,
            velocity,
            life,
            maxLife: life
        });
    }

    // Create bullet with trail (optimized)
    createBullet(position, velocity, color, isEnemy = false, bulletType = 'standard') {
        // Use cached geometry
        const geoKey = isEnemy ? 'bulletEnemy' : 'bulletPlayer';
        const geometry = this.getGeometry(geoKey, () =>
            new THREE.SphereGeometry(isEnemy ? 0.2 : 0.15, 6, 4) // Reduced segments
        );

        // Create material (can't fully cache due to different colors, but reuse where possible)
        const matKey = `bullet_${color.toString(16)}`;
        const material = this.getMaterial(matKey, () =>
            new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.9 })
        );

        const mesh = new THREE.Mesh(geometry, material);
        mesh.position.copy(position);
        this.scene.add(mesh);

        // Simplified trail (fewer points, no per-bullet geometry allocation)
        const trailMatKey = `trail_${color.toString(16)}`;
        const trailMaterial = this.getMaterial(trailMatKey, () =>
            new THREE.LineBasicMaterial({ color, transparent: true, opacity: 0.5 })
        );

        const trailGeometry = new THREE.BufferGeometry();
        const trailPositions = new Float32Array(6 * 3); // Reduced from 30 to 6 points
        for (let i = 0; i < 6; i++) {
            trailPositions[i * 3] = position.x;
            trailPositions[i * 3 + 1] = position.y;
            trailPositions[i * 3 + 2] = position.z;
        }
        trailGeometry.setAttribute('position', new THREE.BufferAttribute(trailPositions, 3));
        const trail = new THREE.Line(trailGeometry, trailMaterial);
        this.scene.add(trail);

        const bullet = {
            mesh,
            trail,
            trailPositions: [],
            velocity: velocity.clone(),
            life: 5,
            isEnemy,
            bulletType,
            color,
            // Homing properties
            homingStrength: 0,
            homingDelay: 0,
            homingActivated: false,
            canBeShot: false,
            damage: isEnemy ? 10 : this.player.damage
        };

        // Set homing properties based on bullet type
        if (bulletType === 'gentle_homing') {
            bullet.homingStrength = 0.1;
            bullet.homingActivated = true;
        } else if (bulletType === 'aggressive_homing') {
            bullet.homingStrength = 0.4;
            bullet.homingActivated = true;
            bullet.canBeShot = true;
            bullet.health = 1;
        } else if (bulletType === 'delayed_homing') {
            bullet.homingStrength = 0.5;
            bullet.homingDelay = 0.8;
            bullet.homingActivated = false;
        } else if (bulletType === 'seeker') {
            bullet.homingStrength = 0.15;
            bullet.homingActivated = true;
        }

        return bullet;
    }

    shoot() {
        if (this.shootCooldown > 0) return;

        const direction = new THREE.Vector3(0, 0, -1);
        direction.applyEuler(this.player.rotation);

        const startPos = this.player.position.clone();
        startPos.add(direction.clone().multiplyScalar(0.5));

        // Fire multiple bullets if shotgun upgrade
        for (let i = 0; i < this.player.bulletCount; i++) {
            const bulletDir = direction.clone();

            // Add spread
            if (this.player.bulletSpread > 0) {
                const spreadAngle = (i - (this.player.bulletCount - 1) / 2) * this.player.bulletSpread;
                bulletDir.applyAxisAngle(new THREE.Vector3(0, 1, 0), spreadAngle);
            }

            const bulletType = this.player.seekerRounds ? 'seeker' : 'standard';
            const bullet = this.createBullet(
                startPos.clone(),
                bulletDir.multiplyScalar(60),
                0x00ffff,
                false,
                bulletType
            );
            bullet.piercing = this.player.piercing;
            this.bullets.push(bullet);
        }

        this.shootCooldown = this.player.fireRate;

        // Muzzle flash
        this.createParticle(
            startPos,
            new THREE.Vector3((Math.random() - 0.5) * 5, (Math.random() - 0.5) * 5, (Math.random() - 0.5) * 5),
            0x00ffff,
            0.1
        );

        this.screenShake = 0.05;
    }

    enemyShoot(enemy) {
        const toPlayer = new THREE.Vector3();
        toPlayer.subVectors(this.player.position, enemy.mesh.position).normalize();

        switch (enemy.pattern) {
            case 'spread':
                this.shootSpread(enemy, toPlayer);
                break;
            case 'burst':
                this.shootBurst(enemy, toPlayer);
                break;
            case 'ring':
                this.shootRing(enemy);
                break;
            case 'lightning':
                this.startSniperTelegraph(enemy);
                break;
        }
    }

    shootSpread(enemy, direction) {
        // 3-bullet spread fan
        const spreadAngle = 0.2;
        for (let i = -1; i <= 1; i++) {
            const dir = direction.clone();
            dir.applyAxisAngle(new THREE.Vector3(0, 1, 0), i * spreadAngle);
            dir.x += (Math.random() - 0.5) * 0.05;
            dir.z += (Math.random() - 0.5) * 0.05;
            dir.normalize();

            // Occasionally fire gentle homing bullet (20% chance on center bullet)
            const bulletType = (i === 0 && Math.random() < 0.2) ? 'gentle_homing' : 'standard';
            const color = bulletType === 'gentle_homing' ? 0xff8844 : 0xff4400;

            const bullet = this.createBullet(
                enemy.mesh.position.clone(),
                dir.multiplyScalar(enemy.bulletSpeed),
                color,
                true,
                bulletType
            );
            this.enemyBullets.push(bullet);
        }
    }

    shootBurst(enemy, direction) {
        // Rapid 5-shot burst with slight spread - fires over time
        for (let i = 0; i < 5; i++) {
            setTimeout(() => {
                if (!this.enemies.includes(enemy)) return; // Enemy died

                const dir = direction.clone();
                dir.x += (Math.random() - 0.5) * 0.1;
                dir.z += (Math.random() - 0.5) * 0.1;
                dir.normalize();

                // Last bullet of burst is delayed homing
                const bulletType = (i === 4) ? 'delayed_homing' : 'standard';
                const color = bulletType === 'delayed_homing' ? 0xffff00 : 0xff4400;

                const bullet = this.createBullet(
                    enemy.mesh.position.clone(),
                    dir.multiplyScalar(enemy.bulletSpeed),
                    color,
                    true,
                    bulletType
                );
                this.enemyBullets.push(bullet);
            }, i * 80 * this.timeScale);
        }
    }

    shootRing(enemy) {
        // 6-bullet ring
        for (let i = 0; i < 6; i++) {
            const angle = (i / 6) * Math.PI * 2;
            const dir = new THREE.Vector3(Math.cos(angle), 0, Math.sin(angle));

            const bullet = this.createBullet(
                enemy.mesh.position.clone(),
                dir.multiplyScalar(enemy.bulletSpeed),
                0x8800ff,
                true,
                'standard'
            );
            this.enemyBullets.push(bullet);
        }

        // Plus one aggressive homing bullet toward player
        const toPlayer = new THREE.Vector3();
        toPlayer.subVectors(this.player.position, enemy.mesh.position).normalize();

        const homingBullet = this.createBullet(
            enemy.mesh.position.clone(),
            toPlayer.multiplyScalar(enemy.bulletSpeed * 0.8),
            0xff00ff,
            true,
            'aggressive_homing'
        );
        this.enemyBullets.push(homingBullet);

        // Particle burst for dramatic effect (reduced)
        for (let i = 0; i < 5; i++) {
            this.createParticle(
                enemy.mesh.position.clone(),
                new THREE.Vector3(
                    (Math.random() - 0.5) * 8,
                    Math.random() * 4,
                    (Math.random() - 0.5) * 8
                ),
                0x8800ff,
                0.3
            );
        }
    }

    startSniperTelegraph(enemy) {
        // Create telegraph line
        const direction = new THREE.Vector3();
        direction.subVectors(this.player.position, enemy.mesh.position).normalize();

        const lineGeometry = new THREE.BufferGeometry();
        const start = enemy.mesh.position.clone();
        const end = start.clone().add(direction.multiplyScalar(100));
        lineGeometry.setFromPoints([start, end]);

        const lineMaterial = new THREE.LineBasicMaterial({
            color: 0xff0000,
            transparent: true,
            opacity: 0.8
        });
        const line = new THREE.Line(lineGeometry, lineMaterial);
        this.scene.add(line);

        enemy.telegraphLine = line;
        enemy.telegraphTime = 0.5;
        enemy.isTelegraphing = true;
        enemy.telegraphDirection = direction.clone();
    }

    fireSniperBeam(enemy) {
        const start = enemy.mesh.position.clone();
        const direction = enemy.telegraphDirection;
        const end = start.clone().add(direction.multiplyScalar(100));

        // Check if beam hits player
        const toPlayer = new THREE.Vector3();
        toPlayer.subVectors(this.player.position, start);
        const projection = toPlayer.dot(direction);
        const closestPoint = start.clone().add(direction.clone().multiplyScalar(projection));
        const distance = closestPoint.distanceTo(this.player.position);

        if (distance < 1.5 && projection > 0) {
            this.playerHit(25);
        }

        // Visual beam effect
        const beamGeometry = new THREE.BufferGeometry();
        beamGeometry.setFromPoints([start, end]);
        const beamMaterial = new THREE.LineBasicMaterial({
            color: 0x00ffff,
            transparent: true,
            opacity: 1,
            linewidth: 3
        });
        const beam = new THREE.Line(beamGeometry, beamMaterial);
        this.scene.add(beam);

        this.sniperBeams.push({
            mesh: beam,
            life: 0.2
        });

        // Crackling particles along beam (reduced)
        for (let i = 0; i < 8; i++) {
            const t = Math.random();
            const pos = start.clone().lerp(end, t * 0.5); // Only near start
            pos.x += (Math.random() - 0.5) * 0.5;
            pos.y += (Math.random() - 0.5) * 0.5;
            pos.z += (Math.random() - 0.5) * 0.5;

            this.createParticle(
                pos,
                new THREE.Vector3(
                    (Math.random() - 0.5) * 5,
                    (Math.random() - 0.5) * 5,
                    (Math.random() - 0.5) * 5
                ),
                0x00ffff,
                0.25
            );
        }

        this.screenShake = 0.2;

        // Clean up telegraph
        if (enemy.telegraphLine) {
            this.scene.remove(enemy.telegraphLine);
            enemy.telegraphLine = null;
        }
        enemy.isTelegraphing = false;
    }

    updateTimeDilation(dt) {
        const minVelocity = 2;
        const maxVelocity = 30;

        let t = (this.mouseVelocity - minVelocity) / (maxVelocity - minVelocity);
        t = Math.max(0, Math.min(1, t));
        t = t * t;

        this.targetTimeScale = this.player.minTimeScale + t * (1 - this.player.minTimeScale);

        // Check for time shield activation
        const wasAboveThreshold = this.timeScale > 0.3;
        this.timeScale += (this.targetTimeScale - this.timeScale) * Math.min(1, dt * 10);
        const isNowBelowThreshold = this.timeScale <= 0.3;

        if (this.player.timeShield && wasAboveThreshold && isNowBelowThreshold) {
            this.player.timeShieldActive = true;
            setTimeout(() => {
                this.player.timeShieldActive = false;
            }, 200);
        }

        document.getElementById('time-bar').style.width = `${this.timeScale * 100}%`;

        const vignette = document.getElementById('vignette');
        if (this.timeScale < 0.5) {
            vignette.classList.add('time-slow');
            const intensity = (0.5 - this.timeScale) / 0.4;
            const shieldGlow = this.player.timeShieldActive ? ', inset 0 0 50px rgba(255, 255, 0, 0.5)' : '';
            vignette.style.boxShadow = `inset 0 0 ${100 + intensity * 100}px rgba(0, 255, 255, ${intensity * 0.3})${shieldGlow}`;
        } else {
            vignette.classList.remove('time-slow');
            vignette.style.boxShadow = 'none';
        }

        const crosshair = document.getElementById('crosshair');
        const scale = 1 + (1 - this.timeScale) * 0.5;
        crosshair.style.transform = `translate(-50%, -50%) scale(${scale})`;
        crosshair.style.borderColor = this.timeScale < 0.5
            ? `rgba(0, 255, 255, ${0.8 + (0.5 - this.timeScale) * 0.4})`
            : 'rgba(0, 255, 255, 0.8)';
    }

    updatePlayer(dt, gameDt) {
        const moveSpeed = 12;
        const direction = new THREE.Vector3();

        if (this.keys['KeyW']) direction.z -= 1;
        if (this.keys['KeyS']) direction.z += 1;
        if (this.keys['KeyA']) direction.x -= 1;
        if (this.keys['KeyD']) direction.x += 1;

        if (direction.length() > 0) {
            direction.normalize();
            direction.applyAxisAngle(new THREE.Vector3(0, 1, 0), this.player.rotation.y);
            this.player.velocity.x = direction.x * moveSpeed;
            this.player.velocity.z = direction.z * moveSpeed;
        } else {
            this.player.velocity.x *= 0.9;
            this.player.velocity.z *= 0.9;
        }

        if (this.player.isDashing) {
            this.player.velocity.copy(this.player.dashVelocity);
        }

        const newPos = this.player.position.clone();
        newPos.x += this.player.velocity.x * dt;
        newPos.z += this.player.velocity.z * dt;

        const bound = this.arenaSize - 1;
        newPos.x = Math.max(-bound, Math.min(bound, newPos.x));
        newPos.z = Math.max(-bound, Math.min(bound, newPos.z));

        this.player.position.copy(newPos);

        if (!this.player.canDash) {
            this.player.dashCooldown -= dt;
            if (this.player.dashCooldown <= 0) {
                this.player.canDash = true;
            }
        }

        if (this.mouseDown) {
            this.shoot();
        }
        this.shootCooldown -= dt;

        this.camera.position.copy(this.player.position);
        this.camera.rotation.copy(this.player.rotation);

        if (this.screenShake > 0) {
            this.camera.position.x += (Math.random() - 0.5) * this.screenShake;
            this.camera.position.y += (Math.random() - 0.5) * this.screenShake;
            this.screenShake *= 0.9;
        }
    }

    updateEnemies(gameDt) {
        this.enemies.forEach(enemy => {
            // Handle sniper telegraph
            if (enemy.isTelegraphing) {
                enemy.telegraphTime -= gameDt;

                // Update telegraph line position
                if (enemy.telegraphLine) {
                    const direction = new THREE.Vector3();
                    direction.subVectors(this.player.position, enemy.mesh.position).normalize();
                    enemy.telegraphDirection = direction.clone();

                    const start = enemy.mesh.position.clone();
                    const end = start.clone().add(direction.multiplyScalar(100));
                    enemy.telegraphLine.geometry.setFromPoints([start, end]);

                    // Flicker effect
                    enemy.telegraphLine.material.opacity = 0.5 + Math.sin(Date.now() * 0.05) * 0.3;
                }

                if (enemy.telegraphTime <= 0) {
                    this.fireSniperBeam(enemy);
                }
                return; // Don't do other AI while telegraphing
            }

            const toPlayer = new THREE.Vector3();
            toPlayer.subVectors(this.player.position, enemy.mesh.position);
            const distance = toPlayer.length();
            toPlayer.normalize();

            const wander = new THREE.Vector3(
                Math.sin(Date.now() * 0.001 + enemy.mesh.id) * 0.3,
                0,
                Math.cos(Date.now() * 0.001 + enemy.mesh.id) * 0.3
            );

            let targetDir;
            if (enemy.type === 'sniper' && distance < 25) {
                targetDir = toPlayer.clone().multiplyScalar(-1).add(wander);
            } else if (distance > 5) {
                targetDir = toPlayer.add(wander);
            } else {
                targetDir = new THREE.Vector3(-toPlayer.z, 0, toPlayer.x).add(wander);
            }
            targetDir.normalize();

            enemy.velocity.lerp(targetDir.multiplyScalar(enemy.speed), gameDt * 3);

            enemy.mesh.position.x += enemy.velocity.x * gameDt;
            enemy.mesh.position.z += enemy.velocity.z * gameDt;

            const bound = this.arenaSize - 2;
            enemy.mesh.position.x = Math.max(-bound, Math.min(bound, enemy.mesh.position.x));
            enemy.mesh.position.z = Math.max(-bound, Math.min(bound, enemy.mesh.position.z));

            enemy.mesh.lookAt(this.player.position);
            enemy.mesh.rotation.x += Math.sin(Date.now() * 0.005) * 0.1;
            enemy.mesh.rotation.z += Math.cos(Date.now() * 0.005) * 0.1;

            enemy.shootTimer -= gameDt;
            if (enemy.shootTimer <= 0 && distance < 40) {
                this.enemyShoot(enemy);
                enemy.shootTimer = enemy.shootRate + Math.random() * 0.3;
            }
        });
    }

    updateBullets(gameDt) {
        // Player bullets
        for (let i = this.bullets.length - 1; i >= 0; i--) {
            const bullet = this.bullets[i];

            // Homing behavior for seeker rounds
            if (bullet.homingActivated && bullet.homingStrength > 0) {
                let closestEnemy = null;
                let closestDist = Infinity;

                this.enemies.forEach(enemy => {
                    const dist = bullet.mesh.position.distanceTo(enemy.mesh.position);
                    if (dist < closestDist && dist < 20) {
                        closestDist = dist;
                        closestEnemy = enemy;
                    }
                });

                if (closestEnemy) {
                    const toEnemy = new THREE.Vector3();
                    toEnemy.subVectors(closestEnemy.mesh.position, bullet.mesh.position).normalize();
                    bullet.velocity.lerp(toEnemy.multiplyScalar(bullet.velocity.length()), bullet.homingStrength * gameDt * 60);
                }
            }

            bullet.mesh.position.add(bullet.velocity.clone().multiplyScalar(gameDt));
            bullet.life -= gameDt;

            // Update trail
            this.updateBulletTrail(bullet);

            // Check enemy collisions
            let hit = false;
            for (let j = this.enemies.length - 1; j >= 0; j--) {
                const enemy = this.enemies[j];
                if (bullet.mesh.position.distanceTo(enemy.mesh.position) < 1.2) {
                    enemy.health -= bullet.damage;

                    for (let k = 0; k < 3; k++) { // Reduced hit particles
                        this.createParticle(
                            bullet.mesh.position.clone(),
                            new THREE.Vector3(
                                (Math.random() - 0.5) * 10,
                                Math.random() * 5,
                                (Math.random() - 0.5) * 10
                            ),
                            enemy.mesh.material.color.getHex(),
                            0.25
                        );
                    }

                    if (enemy.health <= 0) {
                        this.destroyEnemy(enemy, j);
                    }

                    if (!bullet.piercing) {
                        hit = true;
                        break;
                    }
                }
            }

            if (hit || bullet.life <= 0 || Math.abs(bullet.mesh.position.x) > this.arenaSize ||
                Math.abs(bullet.mesh.position.z) > this.arenaSize) {
                this.scene.remove(bullet.mesh);
                this.scene.remove(bullet.trail);
                this.bullets.splice(i, 1);
            }
        }

        // Enemy bullets
        for (let i = this.enemyBullets.length - 1; i >= 0; i--) {
            const bullet = this.enemyBullets[i];

            // Handle delayed homing activation
            if (!bullet.homingActivated && bullet.homingDelay > 0) {
                bullet.homingDelay -= gameDt;
                if (bullet.homingDelay <= 0) {
                    bullet.homingActivated = true;
                    // Visual burst when homing activates (reduced)
                    for (let k = 0; k < 4; k++) {
                        this.createParticle(
                            bullet.mesh.position.clone(),
                            new THREE.Vector3(
                                (Math.random() - 0.5) * 6,
                                (Math.random() - 0.5) * 6,
                                (Math.random() - 0.5) * 6
                            ),
                            0xff00ff,
                            0.2
                        );
                    }
                    // Change color to magenta
                    bullet.mesh.material.color.setHex(0xff00ff);
                    bullet.trail.material.color.setHex(0xff00ff);
                }
            }

            // Homing behavior
            if (bullet.homingActivated && bullet.homingStrength > 0) {
                const toPlayer = new THREE.Vector3();
                toPlayer.subVectors(this.player.position, bullet.mesh.position).normalize();
                bullet.velocity.lerp(toPlayer.multiplyScalar(bullet.velocity.length()), bullet.homingStrength * gameDt * 60);

                // Emit particles for homing bullets (reduced rate)
                if (Math.random() < 0.1) {
                    this.createParticle(
                        bullet.mesh.position.clone(),
                        new THREE.Vector3(
                            (Math.random() - 0.5) * 2,
                            (Math.random() - 0.5) * 2,
                            (Math.random() - 0.5) * 2
                        ),
                        bullet.color,
                        0.15
                    );
                }
            }

            bullet.mesh.position.add(bullet.velocity.clone().multiplyScalar(gameDt));
            bullet.life -= gameDt;

            // Update trail
            this.updateBulletTrail(bullet);

            // Check if player can shoot down aggressive homing bullets
            if (bullet.canBeShot) {
                for (let j = this.bullets.length - 1; j >= 0; j--) {
                    const playerBullet = this.bullets[j];
                    if (bullet.mesh.position.distanceTo(playerBullet.mesh.position) < 0.8) {
                        // Destroy both bullets
                        this.scene.remove(bullet.mesh);
                        this.scene.remove(bullet.trail);
                        this.enemyBullets.splice(i, 1);

                        this.scene.remove(playerBullet.mesh);
                        this.scene.remove(playerBullet.trail);
                        this.bullets.splice(j, 1);

                        // Explosion effect (reduced)
                        for (let k = 0; k < 6; k++) {
                            this.createParticle(
                                bullet.mesh.position.clone(),
                                new THREE.Vector3(
                                    (Math.random() - 0.5) * 10,
                                    (Math.random() - 0.5) * 10,
                                    (Math.random() - 0.5) * 10
                                ),
                                0xff00ff,
                                0.3
                            );
                        }

                        this.score += 50 * this.player.scoreMultiplier;
                        this.updateUI();
                        break;
                    }
                }
                if (!this.enemyBullets.includes(bullet)) continue;
            }

            // Check player collision
            if (bullet.mesh.position.distanceTo(this.player.position) < 0.8) {
                if (!this.player.timeShieldActive) {
                    this.playerHit(bullet.damage);
                }
                this.scene.remove(bullet.mesh);
                this.scene.remove(bullet.trail);
                this.enemyBullets.splice(i, 1);
                continue;
            }

            if (bullet.life <= 0 || Math.abs(bullet.mesh.position.x) > this.arenaSize ||
                Math.abs(bullet.mesh.position.z) > this.arenaSize) {
                this.scene.remove(bullet.mesh);
                this.scene.remove(bullet.trail);
                this.enemyBullets.splice(i, 1);
            }
        }
    }

    updateBulletTrail(bullet) {
        // Store position history (reduced from 10 to 5)
        bullet.trailPositions.unshift(bullet.mesh.position.clone());
        if (bullet.trailPositions.length > 5) {
            bullet.trailPositions.pop();
        }

        // Update trail geometry
        if (bullet.trailPositions.length >= 2) {
            const positions = bullet.trail.geometry.attributes.position.array;
            for (let i = 0; i < bullet.trailPositions.length && i < 6; i++) {
                positions[i * 3] = bullet.trailPositions[i].x;
                positions[i * 3 + 1] = bullet.trailPositions[i].y;
                positions[i * 3 + 2] = bullet.trailPositions[i].z;
            }
            bullet.trail.geometry.attributes.position.needsUpdate = true;
            bullet.trail.geometry.setDrawRange(0, bullet.trailPositions.length);
        }
    }

    updateSniperBeams(gameDt) {
        for (let i = this.sniperBeams.length - 1; i >= 0; i--) {
            const beam = this.sniperBeams[i];
            beam.life -= gameDt;
            beam.mesh.material.opacity = beam.life / 0.2;

            if (beam.life <= 0) {
                this.scene.remove(beam.mesh);
                this.sniperBeams.splice(i, 1);
            }
        }
    }

    destroyEnemy(enemy, index) {
        for (let i = 0; i < 12; i++) { // Reduced from 30 to 12
            this.createParticle(
                enemy.mesh.position.clone(),
                new THREE.Vector3(
                    (Math.random() - 0.5) * 15,
                    Math.random() * 10,
                    (Math.random() - 0.5) * 15
                ),
                enemy.mesh.material.color.getHex(),
                0.4 + Math.random() * 0.3
            );
        }

        const scores = { basic: 100, fast: 150, heavy: 250, sniper: 200 };
        this.score += (scores[enemy.type] || 100) * this.player.scoreMultiplier;
        this.kills++;

        if (Math.random() < 0.25) {
            this.spawnPickup(enemy.mesh.position.clone());
        }

        // Clean up telegraph if exists
        if (enemy.telegraphLine) {
            this.scene.remove(enemy.telegraphLine);
        }

        this.scene.remove(enemy.mesh);
        this.enemies.splice(index, 1);

        this.screenShake = 0.1;
        this.updateUI();

        // Check for wave completion
        if (this.enemies.length === 0) {
            this.wave++;
            this.score += this.wave * 500 * this.player.scoreMultiplier;
            this.updateUI();

            // Show upgrade selection
            this.showUpgradeSelection();
        }
    }

    showUpgradeSelection() {
        this.isSelectingUpgrade = true;
        document.exitPointerLock();

        // Get 3 random upgrades that haven't been acquired
        const available = this.availableUpgrades.filter(u => !this.acquiredUpgrades.includes(u.id));
        const selected = [];
        while (selected.length < 3 && available.length > 0) {
            const idx = Math.floor(Math.random() * available.length);
            selected.push(available.splice(idx, 1)[0]);
        }

        // If no upgrades left, just continue
        if (selected.length === 0) {
            this.isSelectingUpgrade = false;
            this.renderer.domElement.requestPointerLock();
            setTimeout(() => this.spawnWave(), 1000);
            return;
        }

        // Show upgrade UI
        const upgradeScreen = document.getElementById('upgrade-screen');
        const optionsContainer = document.getElementById('upgrade-options');
        optionsContainer.innerHTML = '';

        selected.forEach(upgrade => {
            const card = document.createElement('div');
            card.className = 'upgrade-card';
            card.innerHTML = `
                <h3>${upgrade.name}</h3>
                <p>${upgrade.description}</p>
            `;
            card.addEventListener('click', () => this.selectUpgrade(upgrade));
            optionsContainer.appendChild(card);
        });

        upgradeScreen.style.display = 'flex';
    }

    selectUpgrade(upgrade) {
        upgrade.apply(this.player);
        this.acquiredUpgrades.push(upgrade.id);

        document.getElementById('upgrade-screen').style.display = 'none';
        this.isSelectingUpgrade = false;

        this.updateHealthBar();
        this.renderer.domElement.requestPointerLock();

        setTimeout(() => this.spawnWave(), 1000);
    }

    spawnPickup(position) {
        const geometry = new THREE.OctahedronGeometry(0.4);
        const material = new THREE.MeshBasicMaterial({
            color: 0x00ff44,
            transparent: true,
            opacity: 0.8
        });
        const mesh = new THREE.Mesh(geometry, material);
        mesh.position.copy(position);
        mesh.position.y = 1;
        this.scene.add(mesh);

        this.pickups.push({
            mesh,
            type: 'health',
            life: 15
        });
    }

    updatePickups(gameDt) {
        for (let i = this.pickups.length - 1; i >= 0; i--) {
            const pickup = this.pickups[i];

            pickup.mesh.position.y = 1 + Math.sin(Date.now() * 0.003) * 0.2;
            pickup.mesh.rotation.y += gameDt * 2;

            pickup.life -= gameDt;

            if (pickup.mesh.position.distanceTo(this.player.position) < this.player.pickupRange) {
                if (pickup.type === 'health') {
                    this.player.health = Math.min(this.player.maxHealth, this.player.health + 25);
                    this.updateHealthBar();
                }
                this.scene.remove(pickup.mesh);
                this.pickups.splice(i, 1);
                continue;
            }

            if (pickup.life <= 0) {
                this.scene.remove(pickup.mesh);
                this.pickups.splice(i, 1);
            }
        }
    }

    updateParticles(gameDt) {
        for (let i = this.particles.length - 1; i >= 0; i--) {
            const particle = this.particles[i];

            particle.mesh.position.add(particle.velocity.clone().multiplyScalar(gameDt));
            particle.velocity.y -= 15 * gameDt;

            particle.life -= gameDt;
            particle.mesh.material.opacity = particle.life / particle.maxLife;

            if (particle.life <= 0) {
                this.scene.remove(particle.mesh);
                this.particles.splice(i, 1);
            }
        }
    }

    playerHit(damage) {
        if (this.player.timeShieldActive) return;

        this.player.health -= damage;
        this.screenShake = 0.15;

        const vignette = document.getElementById('vignette');
        vignette.style.boxShadow = 'inset 0 0 150px rgba(255, 0, 0, 0.5)';
        setTimeout(() => {
            vignette.style.boxShadow = this.timeScale < 0.5
                ? `inset 0 0 100px rgba(0, 255, 255, 0.3)`
                : 'none';
        }, 100);

        this.updateHealthBar();

        if (this.player.health <= 0) {
            this.gameOver();
        }
    }

    updateHealthBar() {
        const percent = (this.player.health / this.player.maxHealth) * 100;
        document.getElementById('health-bar').style.width = `${percent}%`;
    }

    updateUI() {
        document.getElementById('score').textContent = Math.floor(this.score).toLocaleString();
        document.getElementById('wave').textContent = this.wave;
        document.getElementById('kills').textContent = this.kills;
    }

    gameOver() {
        this.isRunning = false;
        document.exitPointerLock();
        document.getElementById('game-over').style.display = 'flex';
        document.getElementById('final-score').textContent = `Final Score: ${Math.floor(this.score).toLocaleString()}`;
    }

    gameLoop() {
        if (!this.isRunning) return;

        requestAnimationFrame(() => this.gameLoop());

        const dt = Math.min(this.clock.getDelta(), 0.1);

        if (!this.isSelectingUpgrade) {
            this.updateTimeDilation(dt);

            const gameDt = dt * this.timeScale;

            this.updatePlayer(dt, gameDt);
            this.updateEnemies(gameDt);
            this.updateBullets(gameDt);
            this.updateSniperBeams(gameDt);
            this.updatePickups(gameDt);
            this.updateParticles(gameDt);
        }

        this.renderer.render(this.scene, this.camera);
    }
}

// Initialize game when page loads
window.addEventListener('DOMContentLoaded', () => {
    window.game = new Game();
});
