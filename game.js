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
            isDashing: false,
            dashVelocity: new THREE.Vector3()
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

        // Input state
        this.keys = {};
        this.mouseDown = false;
        this.shootCooldown = 0;

        // Arena
        this.arenaSize = 40;

        // Effects
        this.screenShake = 0;

        this.init();
    }

    init() {
        // Scene setup
        this.scene = new THREE.Scene();
        this.scene.fog = new THREE.FogExp2(0x000011, 0.02);

        // Camera
        this.camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
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
        // Ambient light
        const ambient = new THREE.AmbientLight(0x111122, 0.5);
        this.scene.add(ambient);

        // Main directional light
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

        // Colored point lights for atmosphere
        const colors = [0x00ffff, 0xff00ff, 0x0044ff, 0xff0044];
        const positions = [
            [-15, 5, -15], [15, 5, -15], [-15, 5, 15], [15, 5, 15]
        ];

        positions.forEach((pos, i) => {
            const light = new THREE.PointLight(colors[i], 0.5, 30);
            light.position.set(...pos);
            this.scene.add(light);
        });
    }

    createArena() {
        const size = this.arenaSize;

        // Floor with grid
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

        // Grid lines
        const gridHelper = new THREE.GridHelper(size * 2, 40, 0x00ffff, 0x001133);
        gridHelper.position.y = 0.01;
        this.scene.add(gridHelper);

        // Arena walls (transparent barriers with glow)
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

            // Edge lines
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

        // Corner pillars
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

        // Obstacles/cover
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
        // Mouse movement
        document.addEventListener('mousemove', (e) => {
            if (!this.isRunning || this.isPaused) return;

            // Track mouse velocity for time dilation
            const dx = e.movementX || 0;
            const dy = e.movementY || 0;
            const velocity = Math.sqrt(dx * dx + dy * dy);

            this.mouseHistory.push({ velocity, time: Date.now() });
            // Keep only last 100ms of history
            const cutoff = Date.now() - 100;
            this.mouseHistory = this.mouseHistory.filter(h => h.time > cutoff);

            // Calculate average velocity
            const avgVelocity = this.mouseHistory.reduce((sum, h) => sum + h.velocity, 0) / this.mouseHistory.length;
            this.mouseVelocity = avgVelocity;

            // Update player rotation (camera look)
            const sensitivity = 0.002;
            this.player.rotation.y -= dx * sensitivity;
            this.player.rotation.x -= dy * sensitivity;
            this.player.rotation.x = Math.max(-Math.PI / 2, Math.min(Math.PI / 2, this.player.rotation.x));
        });

        // Mouse buttons
        document.addEventListener('mousedown', (e) => {
            if (e.button === 0) this.mouseDown = true;
        });
        document.addEventListener('mouseup', (e) => {
            if (e.button === 0) this.mouseDown = false;
        });

        // Keyboard
        document.addEventListener('keydown', (e) => {
            this.keys[e.code] = true;
            if (e.code === 'Space' && this.isRunning) {
                e.preventDefault();
                this.tryDash();
            }
        });
        document.addEventListener('keyup', (e) => {
            this.keys[e.code] = false;
        });

        // Pointer lock
        document.addEventListener('click', () => {
            if (this.isRunning && !document.pointerLockElement) {
                this.renderer.domElement.requestPointerLock();
            }
        });

        // Window resize
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
        this.player.health = this.player.maxHealth;
        this.player.canDash = true;
        this.player.dashCooldown = 0;

        // Reset game state
        this.score = 0;
        this.kills = 0;
        this.wave = 1;
        this.timeScale = 1;
        this.targetTimeScale = 1;

        // Clear entities
        this.enemies.forEach(e => this.scene.remove(e.mesh));
        this.bullets.forEach(b => this.scene.remove(b.mesh));
        this.enemyBullets.forEach(b => this.scene.remove(b.mesh));
        this.particles.forEach(p => this.scene.remove(p.mesh));
        this.pickups.forEach(p => this.scene.remove(p.mesh));

        this.enemies = [];
        this.bullets = [];
        this.enemyBullets = [];
        this.particles = [];
        this.pickups = [];

        // Update UI
        this.updateUI();
        document.getElementById('game-over').style.display = 'none';
        document.getElementById('health-bar').style.width = '100%';

        // Start
        this.isRunning = true;
        this.renderer.domElement.requestPointerLock();
        this.spawnWave();
    }

    tryDash() {
        if (!this.player.canDash) return;

        // Get movement direction or forward if stationary
        const dir = new THREE.Vector3();
        if (this.keys['KeyW']) dir.z -= 1;
        if (this.keys['KeyS']) dir.z += 1;
        if (this.keys['KeyA']) dir.x -= 1;
        if (this.keys['KeyD']) dir.x += 1;

        if (dir.length() === 0) {
            dir.z = -1; // Dash forward if no movement keys
        }
        dir.normalize();

        // Apply rotation
        dir.applyAxisAngle(new THREE.Vector3(0, 1, 0), this.player.rotation.y);

        this.player.isDashing = true;
        this.player.dashVelocity.copy(dir).multiplyScalar(50);
        this.player.canDash = false;
        this.player.dashCooldown = 2; // seconds

        // Dash effect
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

        // Show wave indicator
        const indicator = document.getElementById('wave-indicator');
        indicator.textContent = `Wave ${this.wave}`;
        indicator.style.opacity = '1';
        setTimeout(() => indicator.style.opacity = '0', 2000);

        for (let i = 0; i < enemyCount; i++) {
            setTimeout(() => this.spawnEnemy(), i * 500);
        }
    }

    spawnEnemy() {
        const size = this.arenaSize - 5;

        // Spawn at arena edges, away from player
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

        // Enemy types based on wave
        const types = ['basic'];
        if (this.wave >= 2) types.push('fast');
        if (this.wave >= 3) types.push('heavy');
        if (this.wave >= 5) types.push('sniper');

        const type = types[Math.floor(Math.random() * types.length)];

        const enemyConfig = {
            basic: { health: 30, speed: 5, color: 0xff0044, size: 0.8, shootRate: 1.5, bulletSpeed: 15 },
            fast: { health: 20, speed: 10, color: 0xff8800, size: 0.6, shootRate: 2, bulletSpeed: 20 },
            heavy: { health: 80, speed: 3, color: 0x8800ff, size: 1.2, shootRate: 0.8, bulletSpeed: 12 },
            sniper: { health: 25, speed: 2, color: 0x00ff88, size: 0.7, shootRate: 0.5, bulletSpeed: 40 }
        };

        const config = enemyConfig[type];

        // Enemy mesh
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
            shootTimer: Math.random() * config.shootRate,
            velocity: new THREE.Vector3()
        };

        this.enemies.push(enemy);

        // Spawn effect
        this.createSpawnEffect(mesh.position);
    }

    createSpawnEffect(position) {
        for (let i = 0; i < 20; i++) {
            const angle = (i / 20) * Math.PI * 2;
            const vel = new THREE.Vector3(
                Math.cos(angle) * 5,
                2 + Math.random() * 3,
                Math.sin(angle) * 5
            );
            this.createParticle(position.clone(), vel, 0xff0044, 0.5);
        }
    }

    createParticle(position, velocity, color, life) {
        const geometry = new THREE.SphereGeometry(0.1);
        const material = new THREE.MeshBasicMaterial({
            color,
            transparent: true,
            opacity: 1
        });
        const mesh = new THREE.Mesh(geometry, material);
        mesh.position.copy(position);
        this.scene.add(mesh);

        this.particles.push({
            mesh,
            velocity,
            life,
            maxLife: life
        });
    }

    shoot() {
        if (this.shootCooldown > 0) return;

        const direction = new THREE.Vector3(0, 0, -1);
        direction.applyEuler(this.player.rotation);

        const startPos = this.player.position.clone();
        startPos.add(direction.clone().multiplyScalar(0.5));

        // Bullet mesh
        const geometry = new THREE.SphereGeometry(0.15);
        const material = new THREE.MeshBasicMaterial({
            color: 0x00ffff,
            transparent: true,
            opacity: 0.9
        });
        const mesh = new THREE.Mesh(geometry, material);
        mesh.position.copy(startPos);
        this.scene.add(mesh);

        // Bullet trail light
        const light = new THREE.PointLight(0x00ffff, 0.5, 5);
        mesh.add(light);

        this.bullets.push({
            mesh,
            velocity: direction.multiplyScalar(60),
            life: 3
        });

        this.shootCooldown = 0.15;

        // Muzzle flash
        this.createParticle(
            startPos,
            new THREE.Vector3((Math.random() - 0.5) * 5, (Math.random() - 0.5) * 5, (Math.random() - 0.5) * 5),
            0x00ffff,
            0.1
        );

        // Screen shake
        this.screenShake = 0.05;
    }

    enemyShoot(enemy) {
        const direction = new THREE.Vector3();
        direction.subVectors(this.player.position, enemy.mesh.position).normalize();

        // Add some inaccuracy
        direction.x += (Math.random() - 0.5) * 0.1;
        direction.y += (Math.random() - 0.5) * 0.1;
        direction.z += (Math.random() - 0.5) * 0.1;
        direction.normalize();

        const geometry = new THREE.SphereGeometry(0.2);
        const material = new THREE.MeshBasicMaterial({
            color: 0xff0044,
            transparent: true,
            opacity: 0.9
        });
        const mesh = new THREE.Mesh(geometry, material);
        mesh.position.copy(enemy.mesh.position);
        this.scene.add(mesh);

        this.enemyBullets.push({
            mesh,
            velocity: direction.multiplyScalar(enemy.bulletSpeed),
            life: 5
        });
    }

    updateTimeDilation(dt) {
        // Calculate target time scale based on mouse velocity
        // Low velocity = slow time, high velocity = normal time
        const minVelocity = 2;
        const maxVelocity = 30;

        let t = (this.mouseVelocity - minVelocity) / (maxVelocity - minVelocity);
        t = Math.max(0, Math.min(1, t));

        // Easing for smoother feel
        t = t * t; // Quadratic ease

        this.targetTimeScale = 0.1 + t * 0.9; // Range: 0.1 to 1.0

        // Smooth interpolation
        this.timeScale += (this.targetTimeScale - this.timeScale) * Math.min(1, dt * 10);

        // Update UI
        document.getElementById('time-bar').style.width = `${this.timeScale * 100}%`;

        // Visual effects
        const vignette = document.getElementById('vignette');
        if (this.timeScale < 0.5) {
            vignette.classList.add('time-slow');
            // Cyan tint when slow
            const intensity = (0.5 - this.timeScale) / 0.4;
            vignette.style.boxShadow = `inset 0 0 ${100 + intensity * 100}px rgba(0, 255, 255, ${intensity * 0.3})`;
        } else {
            vignette.classList.remove('time-slow');
            vignette.style.boxShadow = 'none';
        }

        // Update crosshair based on time scale
        const crosshair = document.getElementById('crosshair');
        const scale = 1 + (1 - this.timeScale) * 0.5;
        crosshair.style.transform = `translate(-50%, -50%) scale(${scale})`;
        crosshair.style.borderColor = this.timeScale < 0.5
            ? `rgba(0, 255, 255, ${0.8 + (0.5 - this.timeScale) * 0.4})`
            : 'rgba(0, 255, 255, 0.8)';
    }

    updatePlayer(dt, gameDt) {
        // Movement
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

        // Dash override
        if (this.player.isDashing) {
            this.player.velocity.copy(this.player.dashVelocity);
        }

        // Apply velocity (player moves at real time, not dilated)
        const newPos = this.player.position.clone();
        newPos.x += this.player.velocity.x * dt;
        newPos.z += this.player.velocity.z * dt;

        // Arena bounds
        const bound = this.arenaSize - 1;
        newPos.x = Math.max(-bound, Math.min(bound, newPos.x));
        newPos.z = Math.max(-bound, Math.min(bound, newPos.z));

        this.player.position.copy(newPos);

        // Dash cooldown
        if (!this.player.canDash) {
            this.player.dashCooldown -= dt;
            if (this.player.dashCooldown <= 0) {
                this.player.canDash = true;
            }
        }

        // Shooting
        if (this.mouseDown) {
            this.shoot();
        }
        this.shootCooldown -= dt;

        // Update camera
        this.camera.position.copy(this.player.position);
        this.camera.rotation.copy(this.player.rotation);

        // Screen shake
        if (this.screenShake > 0) {
            this.camera.position.x += (Math.random() - 0.5) * this.screenShake;
            this.camera.position.y += (Math.random() - 0.5) * this.screenShake;
            this.screenShake *= 0.9;
        }
    }

    updateEnemies(gameDt) {
        this.enemies.forEach(enemy => {
            // AI: Move towards player with some randomness
            const toPlayer = new THREE.Vector3();
            toPlayer.subVectors(this.player.position, enemy.mesh.position);
            const distance = toPlayer.length();
            toPlayer.normalize();

            // Add wandering behavior
            const wander = new THREE.Vector3(
                Math.sin(Date.now() * 0.001 + enemy.mesh.id) * 0.3,
                0,
                Math.cos(Date.now() * 0.001 + enemy.mesh.id) * 0.3
            );

            let targetDir;
            if (enemy.type === 'sniper' && distance < 20) {
                // Snipers try to keep distance
                targetDir = toPlayer.clone().multiplyScalar(-1).add(wander);
            } else if (distance > 5) {
                targetDir = toPlayer.add(wander);
            } else {
                // Strafe when close
                targetDir = new THREE.Vector3(-toPlayer.z, 0, toPlayer.x).add(wander);
            }
            targetDir.normalize();

            // Update velocity
            enemy.velocity.lerp(targetDir.multiplyScalar(enemy.speed), gameDt * 3);

            // Apply movement
            enemy.mesh.position.x += enemy.velocity.x * gameDt;
            enemy.mesh.position.z += enemy.velocity.z * gameDt;

            // Arena bounds
            const bound = this.arenaSize - 2;
            enemy.mesh.position.x = Math.max(-bound, Math.min(bound, enemy.mesh.position.x));
            enemy.mesh.position.z = Math.max(-bound, Math.min(bound, enemy.mesh.position.z));

            // Rotate to face player
            enemy.mesh.lookAt(this.player.position);
            enemy.mesh.rotation.x += Math.sin(Date.now() * 0.005) * 0.1;
            enemy.mesh.rotation.z += Math.cos(Date.now() * 0.005) * 0.1;

            // Shooting
            enemy.shootTimer -= gameDt;
            if (enemy.shootTimer <= 0 && distance < 35) {
                this.enemyShoot(enemy);
                enemy.shootTimer = enemy.shootRate + Math.random() * 0.5;
            }
        });
    }

    updateBullets(gameDt) {
        // Player bullets
        for (let i = this.bullets.length - 1; i >= 0; i--) {
            const bullet = this.bullets[i];
            bullet.mesh.position.add(bullet.velocity.clone().multiplyScalar(gameDt));
            bullet.life -= gameDt;

            // Check enemy collisions
            let hit = false;
            for (let j = this.enemies.length - 1; j >= 0; j--) {
                const enemy = this.enemies[j];
                if (bullet.mesh.position.distanceTo(enemy.mesh.position) < 1.2) {
                    enemy.health -= 25;

                    // Hit effect
                    for (let k = 0; k < 5; k++) {
                        this.createParticle(
                            bullet.mesh.position.clone(),
                            new THREE.Vector3(
                                (Math.random() - 0.5) * 10,
                                Math.random() * 5,
                                (Math.random() - 0.5) * 10
                            ),
                            enemy.mesh.material.color.getHex(),
                            0.3
                        );
                    }

                    if (enemy.health <= 0) {
                        this.destroyEnemy(enemy, j);
                    }

                    hit = true;
                    break;
                }
            }

            if (hit || bullet.life <= 0 || Math.abs(bullet.mesh.position.x) > this.arenaSize ||
                Math.abs(bullet.mesh.position.z) > this.arenaSize) {
                this.scene.remove(bullet.mesh);
                this.bullets.splice(i, 1);
            }
        }

        // Enemy bullets (affected by time dilation)
        for (let i = this.enemyBullets.length - 1; i >= 0; i--) {
            const bullet = this.enemyBullets[i];
            bullet.mesh.position.add(bullet.velocity.clone().multiplyScalar(gameDt));
            bullet.life -= gameDt;

            // Check player collision
            if (bullet.mesh.position.distanceTo(this.player.position) < 0.8) {
                this.playerHit(10);
                this.scene.remove(bullet.mesh);
                this.enemyBullets.splice(i, 1);
                continue;
            }

            if (bullet.life <= 0 || Math.abs(bullet.mesh.position.x) > this.arenaSize ||
                Math.abs(bullet.mesh.position.z) > this.arenaSize) {
                this.scene.remove(bullet.mesh);
                this.enemyBullets.splice(i, 1);
            }
        }
    }

    destroyEnemy(enemy, index) {
        // Death explosion
        for (let i = 0; i < 30; i++) {
            this.createParticle(
                enemy.mesh.position.clone(),
                new THREE.Vector3(
                    (Math.random() - 0.5) * 15,
                    Math.random() * 10,
                    (Math.random() - 0.5) * 15
                ),
                enemy.mesh.material.color.getHex(),
                0.5 + Math.random() * 0.5
            );
        }

        // Score based on enemy type
        const scores = { basic: 100, fast: 150, heavy: 250, sniper: 200 };
        this.score += scores[enemy.type] || 100;
        this.kills++;

        // Chance to spawn health pickup
        if (Math.random() < 0.2) {
            this.spawnPickup(enemy.mesh.position.clone());
        }

        this.scene.remove(enemy.mesh);
        this.enemies.splice(index, 1);

        this.screenShake = 0.1;
        this.updateUI();

        // Check for wave completion
        if (this.enemies.length === 0) {
            this.wave++;
            this.score += this.wave * 500; // Wave completion bonus
            this.updateUI();
            setTimeout(() => this.spawnWave(), 2000);
        }
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

            // Float animation
            pickup.mesh.position.y = 1 + Math.sin(Date.now() * 0.003) * 0.2;
            pickup.mesh.rotation.y += gameDt * 2;

            pickup.life -= gameDt;

            // Check player collision
            if (pickup.mesh.position.distanceTo(this.player.position) < 1.5) {
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

            // Apply velocity and gravity
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
        this.player.health -= damage;
        this.screenShake = 0.15;

        // Red flash
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
        document.getElementById('score').textContent = this.score.toLocaleString();
        document.getElementById('wave').textContent = this.wave;
        document.getElementById('kills').textContent = this.kills;
    }

    gameOver() {
        this.isRunning = false;
        document.exitPointerLock();
        document.getElementById('game-over').style.display = 'flex';
        document.getElementById('final-score').textContent = `Final Score: ${this.score.toLocaleString()}`;
    }

    gameLoop() {
        if (!this.isRunning) return;

        requestAnimationFrame(() => this.gameLoop());

        const dt = Math.min(this.clock.getDelta(), 0.1); // Real delta time

        // Update time dilation based on mouse movement
        this.updateTimeDilation(dt);

        // Game delta time (affected by time dilation)
        const gameDt = dt * this.timeScale;

        // Update game systems
        this.updatePlayer(dt, gameDt); // Player moves at real time
        this.updateEnemies(gameDt);    // Enemies affected by time dilation
        this.updateBullets(gameDt);    // Bullets affected by time dilation
        this.updatePickups(gameDt);
        this.updateParticles(gameDt);

        // Render
        this.renderer.render(this.scene, this.camera);
    }
}

// Initialize game when page loads
window.addEventListener('DOMContentLoaded', () => {
    window.game = new Game();
});
