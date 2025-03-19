import * as THREE from 'three';
import { PointerLockControls } from 'three/addons/controls/PointerLockControls.js';
import { SimplexNoise } from 'three/addons/math/SimplexNoise.js';
// Main game class
class LowPolyGame {
  constructor() {
    // Add at the start of constructor
    console.log('Initializing game...');
    
    // Scene setup
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x87CEEB); // Sky blue
    
    // Camera setup
    this.camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
    this.camera.position.set(0, 2, 10); // Position camera back to see the scene
    
    // Renderer setup
    this.renderer = new THREE.WebGLRenderer({ antialias: true });
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.renderer.shadowMap.enabled = true;
    document.body.appendChild(this.renderer.domElement);
    
    // First person controls
    this.controls = new PointerLockControls(this.camera, document.body);
    
    // Initialize properties
    this.gameStarted = false;
      // Initialize touch controls object
  this.touchControls = {
    joystickSize: 150,
    maxJoystickDistance: 75,
    moveTouch: null,
    lookTouch: null,
    moveOrigin: new THREE.Vector2(0, 0),
    lookOrigin: new THREE.Vector2(0, 0),
    moveDelta: new THREE.Vector2(0, 0),
    lookDelta: new THREE.Vector2(0, 0)
  };

    // Prevent default touch behaviors
    document.addEventListener('touchstart', (e) => e.preventDefault(), { passive: false });
    document.addEventListener('touchmove', (e) => e.preventDefault(), { passive: false });
    document.addEventListener('touchend', (e) => e.preventDefault(), { passive: false });
    
    // Add meta viewport tag
    if (!document.querySelector('meta[name="viewport"]')) {
        const viewport = document.createElement('meta');
        viewport.name = 'viewport';
        viewport.content = 'width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no';
        document.head.appendChild(viewport);
    }

    // Create the start button
    this.createStartButton();
    
    // Flag to track if game has started
    this.gameStarted = false;
    
    // Define NPC types BEFORE creating NPCs
    this.npcTypes = {
        civilian: {
            color: 0x2244ff,  // Blue clothing
            speed: 2,
            panicSpeed: 8,
            size: 1
        },
        runner: {
            color: 0x22ff22,  // Green clothing
            speed: 4,
            panicSpeed: 12,
            size: 0.8
        },
        giant: {
            color: 0xff2222,  // Red clothing
            speed: 1.5,
            panicSpeed: 6,
            size: 1.5
        },
        ninja: {
            color: 0x111111,  // Black clothing
            speed: 5,
            panicSpeed: 15,
            size: 0.7
        },
        golden: {
            color: 0xFFD700,  // Gold clothing
            speed: 3,
            panicSpeed: 10,
            size: 1.2
        }
    };
    
    // Add hands AFTER camera and controls setup but BEFORE world creation
    this.setupHands();
    
    // Add camera to scene (needed for hands to be visible)
    this.scene.add(this.camera);
    
    // Lighting
    this.setupLighting();
    
    // Create the world
    this.createTerrain();
    this.addEnvironmentObjects();
    
    // Player physics
    this.velocity = new THREE.Vector3();
    this.direction = new THREE.Vector3();
    this.playerOnGround = false;
    
    // Movement controls
    this.moveForward = false;
    this.moveBackward = false;
    this.moveLeft = false;
    this.moveRight = false;
    this.canJump = true;
    
    // Add jump-related properties
    this.isJumping = false;
    this.jumpVelocity = 0;
    this.jumpHeight = 5;
    this.gravity = 30; // Increased gravity
    
    // NPC management
    this.npcs = [];
    this.addNPCs(10); // Add 10 NPCs
    
    // Gun management
    this.guns = [];
    this.equippedGun = null;
    this.hasGun = false;
    
    // Add guns after world creation
    this.addGuns(5); // Add 5 guns to the world
    
    // Shooting properties
    this.shootRange = 20; // Maximum shooting distance
    this.shootCooldown = false;
    
    // Enhanced shooting effects
    this.muzzleFlashes = [];
    this.createMuzzleFlashPool(3);
    this.shootingLight = this.createShootingLight();
    this.bulletTrails = [];
    this.createBulletTrailPool(5);
    
    // Setup event listeners
    this.setupEventListeners();
    
    // Start game loop
    this.clock = new THREE.Clock();
    
    // Start rendering immediately (don't wait for controls lock)
    this.animate();
    
    // Add at the end of constructor
    console.log('Game initialized');
    console.log('Scene children count:', this.scene.children.length);
    console.log('Camera position:', this.camera.position);

    // Set initial camera rotation
    this.camera.rotation.order = 'YXZ'; // Important for proper rotation order
  }
  
  setupLighting() {
    // Ambient light
    const ambientLight = new THREE.AmbientLight(0x404040, 1);
    this.scene.add(ambientLight);
    
    // Directional light (sun)
    const directionalLight = new THREE.DirectionalLight(0xffffff, 0.8);
    directionalLight.position.set(100, 100, 50);
    directionalLight.castShadow = true;
    
    // Configure shadow properties
    directionalLight.shadow.mapSize.width = 2048;
    directionalLight.shadow.mapSize.height = 2048;
    directionalLight.shadow.camera.near = 0.5;
    directionalLight.shadow.camera.far = 500;
    
    this.scene.add(directionalLight);
  }
  
  createTerrain() {
    // Generate terrain using SimplexNoise for heightmap
    const noise = new SimplexNoise();
    const size = 200;
    const resolution = 1;
    
    // Create terrain geometry
    const geometry = new THREE.PlaneGeometry(size, size, size * resolution, size * resolution);
    geometry.rotateX(-Math.PI / 2); // Rotate to be horizontal
    
    // Apply noise to vertices to create hills
    const vertices = geometry.attributes.position.array;
    for (let i = 0; i < vertices.length; i += 3) {
      const x = vertices[i];
      const z = vertices[i + 2];
      
      // Generate height with multiple octaves of noise for natural-looking terrain
      let height = 0;
      height += 5 * noise.noise(x * 0.01, z * 0.01);
      height += 2 * noise.noise(x * 0.03, z * 0.03);
      height += 0.5 * noise.noise(x * 0.09, z * 0.09);
      
      // Set the y-coordinate (height)
      vertices[i + 1] = height;
    }
    
    // Update normals for proper lighting
    geometry.computeVertexNormals();
    
    // Create material with low-poly aesthetic
    const material = new THREE.MeshStandardMaterial({
      color: 0x3cb043, // Green for grass
      flatShading: true, // Important for low-poly look
      metalness: 0,
      roughness: 0.8,
    });
    
    // Create terrain mesh
    this.terrain = new THREE.Mesh(geometry, material);
    this.terrain.receiveShadow = true;
    this.terrain.castShadow = true;
    this.scene.add(this.terrain);
    
    // Store terrain data for collision detection
    this.terrainVertices = vertices;
  }
  
  addEnvironmentObjects() {
    // Add water
    this.addWater();
    
    // Add trees
    this.addTrees();
    
    // Add rocks
    this.addRocks();
  }
  
  addWater() {
    // Simple water as a flat blue surface
    const waterGeometry = new THREE.PlaneGeometry(400, 400);
    const waterMaterial = new THREE.MeshStandardMaterial({
      color: 0x0077be,
      transparent: true,
      opacity: 0.8,
      flatShading: true,
    });
    
    const water = new THREE.Mesh(waterGeometry, waterMaterial);
    water.rotation.x = -Math.PI / 2;
    water.position.y = -2; // Place water below main terrain
    this.scene.add(water);
  }
  
  addTrees() {
    // Tree type definitions
    const treeTypes = [
      {
        // Tall pine tree
        trunk: {
          geometry: new THREE.CylinderGeometry(0.2, 0.3, 3, 5, 1),
          color: 0x8B4513,
        },
        foliage: {
          geometry: new THREE.ConeGeometry(1, 4, 6),
          color: 0x1b4d2e,
        },
        foliageOffset: 3.5,
        trunkOffset: 1.5
      },
      {
        // Wide oak tree
        trunk: {
          geometry: new THREE.CylinderGeometry(0.4, 0.5, 2, 6, 1),
          color: 0x6e4c1e,
        },
        foliage: {
          geometry: new THREE.SphereGeometry(1.5, 6, 5),
          color: 0x2d7a32,
        },
        foliageOffset: 2.5,
        trunkOffset: 1
      },
      {
        // Small bush-like tree
        trunk: {
          geometry: new THREE.CylinderGeometry(0.15, 0.2, 1, 5, 1),
          color: 0x8B4513,
        },
        foliage: {
          geometry: new THREE.DodecahedronGeometry(1, 0),
          color: 0x3d8b40,
        },
        foliageOffset: 1.5,
        trunkOffset: 0.5
      },
      {
        // Tall thin tree
        trunk: {
          geometry: new THREE.CylinderGeometry(0.15, 0.2, 4, 5, 1),
          color: 0x9e6b4a,
        },
        foliage: {
          geometry: new THREE.ConeGeometry(0.8, 3, 5),
          color: 0x2d5a27,
        },
        foliageOffset: 4,
        trunkOffset: 2
      }
    ];

    // Create a tree of specific type
    const createTree = (x, z, baseHeight, treeType) => {
      // Tree trunk
      const trunkMaterial = new THREE.MeshStandardMaterial({
        color: treeType.trunk.color,
        flatShading: true,
      });
      const trunk = new THREE.Mesh(treeType.trunk.geometry, trunkMaterial);
      trunk.position.set(x, baseHeight + treeType.trunkOffset, z);
      trunk.castShadow = true;
      this.scene.add(trunk);
      
      // Tree foliage
      const foliageMaterial = new THREE.MeshStandardMaterial({
        color: treeType.foliage.color,
        flatShading: true,
      });
      const foliage = new THREE.Mesh(treeType.foliage.geometry, foliageMaterial);
      foliage.position.set(x, baseHeight + treeType.foliageOffset, z);
      foliage.castShadow = true;
      
      // Add random rotation for variety
      foliage.rotation.y = Math.random() * Math.PI * 2;
      trunk.rotation.y = Math.random() * Math.PI * 2;
      
      this.scene.add(foliage);
      return { trunk, foliage };
    };
    
    // Place trees randomly
    for (let i = 0; i < 50; i++) { // Increased number of trees
      const x = (Math.random() - 0.5) * 180;
      const z = (Math.random() - 0.5) * 180;
      
      // Get actual height at this position
      const groundHeight = this.getHeightAt(x, z);
      
      // Randomly select tree type
      const treeType = treeTypes[Math.floor(Math.random() * treeTypes.length)];
      
      // Create tree at the correct height
      createTree(x, z, groundHeight, treeType);
    }
    
    // Create small clusters of similar trees
    const createCluster = (centerX, centerZ, treeType, count) => {
      for (let i = 0; i < count; i++) {
        const angle = Math.random() * Math.PI * 2;
        const distance = 5 + Math.random() * 3; // Random distance 1-4 units from center
        const x = centerX + Math.cos(angle) * distance;
        const z = centerZ + Math.sin(angle) * distance;
        const groundHeight = this.getHeightAt(x, z);
        createTree(x, z, groundHeight, treeType);
      }
    };
    
    // Create several clusters
    for (let i = 0; i < 10; i++) {
      const x = (Math.random() - 0.5) * 160; // Slightly smaller range for clusters
      const z = (Math.random() - 0.5) * 160;
      const treeType = treeTypes[Math.floor(Math.random() * treeTypes.length)];
      createCluster(x, z, treeType, 3 + Math.floor(Math.random() * 4)); // 3-6 trees per cluster
    }
  }
  
  addRocks() {
    // Create a low-poly rock
    const createRock = (x, y, z, scale) => {
      const rockGeometry = new THREE.DodecahedronGeometry(1, 0);
      const rockMaterial = new THREE.MeshStandardMaterial({
        color: 0x888888,
        flatShading: true,
      });
      
      const rock = new THREE.Mesh(rockGeometry, rockMaterial);
      rock.position.set(x, y, z);
      rock.scale.set(scale, scale * 0.8, scale);
      rock.rotation.set(Math.random(), Math.random(), Math.random());
      rock.castShadow = true;
      this.scene.add(rock);
      
      return rock;
    };
    
    // Place rocks randomly
    for (let i = 0; i < 30; i++) {
      const x = (Math.random() - 0.5) * 180;
      const z = (Math.random() - 0.5) * 180;
      const scale = 0.5 + Math.random() * 1.5;
      
      // Get height at this position (simplified)
      const y = 0.5 * scale; // Simplified - place rock slightly above ground
      
      createRock(x, y, z, scale);
    }
  }
  
  // Helper method to get terrain height at a position (this is simplified)
  getHeightAt(x, z) {
    const size = 200;
    const resolution = 1;
    const segments = size * resolution;
    const halfSize = size / 2;

    // Convert world coordinates to grid coordinates
    const gx = ((x + halfSize) / size) * segments;
    const gz = ((z + halfSize) / size) * segments;

    // Get the four surrounding vertices
    const x1 = Math.floor(gx);
    const x2 = Math.ceil(gx);
    const z1 = Math.floor(gz);
    const z2 = Math.ceil(gz);

    // Get the heights at the four corners
    const getVertex = (x, z) => {
      const index = (z * (segments + 1) + x) * 3 + 1;
      return this.terrainVertices[index] || 0;
    };

    const h11 = getVertex(x1, z1);
    const h21 = getVertex(x2, z1);
    const h12 = getVertex(x1, z2);
    const h22 = getVertex(x2, z2);

    // Calculate fractional position
    const fx = gx - x1;
    const fz = gz - z1;

    // Bilinear interpolation
    const h1 = h11 * (1 - fx) + h21 * fx;
    const h2 = h12 * (1 - fx) + h22 * fx;
    const height = h1 * (1 - fz) + h2 * fz;

    return height;
  }
  
  setupEventListeners() {
    // Lock pointer when clicking on screen
    document.addEventListener('click', () => {
      this.controls.lock();
    });
    
    // Movement controls - change to use input flags instead of directly setting direction
    document.addEventListener('keydown', (event) => {
      switch (event.code) {
        case 'ArrowUp':
        case 'KeyW':
          this.moveForward = true;
          break;
        case 'ArrowLeft':
        case 'KeyA':
          this.moveLeft = true;
          break;
        case 'ArrowDown':
        case 'KeyS':
          this.moveBackward = true;
          break;
        case 'ArrowRight':
        case 'KeyD':
          this.moveRight = true;
          break;
        case 'Space':
          if (!this.isJumping && this.canJump) {
            this.isJumping = true;
            this.jumpVelocity = 10;
            this.canJump = false;
            console.log('Jump initiated!');
          }
          break;
      }
    });
    
    document.addEventListener('keyup', (event) => {
      switch (event.code) {
        case 'ArrowUp':
        case 'KeyW':
          this.moveForward = false;
          break;
        case 'ArrowLeft':
        case 'KeyA':
          this.moveLeft = false;
          break;
        case 'ArrowDown':
        case 'KeyS':
          this.moveBackward = false;
          break;
        case 'ArrowRight':
        case 'KeyD':
          this.moveRight = false;
          break;
      }
    });
    
    // Handle window resize
    window.addEventListener('resize', () => {
      this.camera.aspect = window.innerWidth / window.innerHeight;
      this.camera.updateProjectionMatrix();
      this.renderer.setSize(window.innerWidth, window.innerHeight);
    });
    
    // Add gun dropping with 'G' key
    document.addEventListener('keydown', (event) => {
      if (event.code === 'KeyG' && this.hasGun) {
        this.dropGun();
      }
    });
    
    // Add mouse click for shooting
    document.addEventListener('mousedown', (event) => {
      if (event.button === 0) { // Left click
        this.shoot();
      }
    });
  }

  animate() {
    requestAnimationFrame(this.animate.bind(this));
    
    const delta = this.clock.getDelta();
    
    // Update NPCs
    this.updateNPCs(delta);
    
    if (this.controls.isLocked || this.gameStarted) {
      // Calculate movement speed
      const moveSpeed = 10.0 * delta;
  
      // Reset movement deltas
      let moveForwardDelta = 0;
      let moveRightDelta = 0;
  
      // Apply movement based on input flags
      if (this.moveForward) moveForwardDelta += moveSpeed;
      if (this.moveBackward) moveForwardDelta -= moveSpeed;
      if (this.moveRight) moveRightDelta += moveSpeed;
      if (this.moveLeft) moveRightDelta -= moveSpeed;
  
      // Execute movement using PointerLockControls' built-in methods
      this.controls.moveForward(moveForwardDelta);
      this.controls.moveRight(moveRightDelta);
  
      // Handle terrain following and jumping
      const currentPos = this.camera.position;
      const terrainHeight = this.getHeightAt(currentPos.x, currentPos.z);
      const playerHeight = 2;
      const targetY = terrainHeight + playerHeight;
      
      // Jumping physics
      if (this.isJumping) {
        this.jumpVelocity -= this.gravity * delta;
        this.camera.position.y += this.jumpVelocity * delta;
        
        if (this.camera.position.y <= targetY) {
          this.isJumping = false;
          this.jumpVelocity = 0;
          this.camera.position.y = targetY;
          this.canJump = true;
        }
      } else {
        const smoothFactor = 0.1;
        this.camera.position.y += (targetY - this.camera.position.y) * smoothFactor;
        this.canJump = true;
      }
  
      // Hand animations
      const isMoving = this.moveForward || this.moveBackward || this.moveLeft || this.moveRight;
      if (isMoving && this.rightHand && this.leftHand) {
        const walkingSpeed = 15;
        const time = performance.now() * 0.001;
        this.rightHand.position.y = -0.3 + Math.sin(time * walkingSpeed) * 0.1;
        this.leftHand.position.y = -0.3 + Math.sin(time * walkingSpeed + Math.PI) * 0.1;
      } else if (this.rightHand && this.leftHand) {
        this.rightHand.position.y = -0.3;
        this.leftHand.position.y = -0.3;
      }
    }
  
    // Rest of the animation code remains the same
    this.renderer.render(this.scene, this.camera);
  
    if (this.controls.isLocked || this.gameStarted) {
      // Update floating guns
      const time = performance.now() * 0.001;
      this.guns.forEach((gun, index) => {
        if (gun.visible) {
          const userData = gun.userData;
          gun.rotation.y = time * userData.rotationSpeed;
          gun.position.y = userData.baseHeight + Math.sin(time * userData.floatSpeed + userData.timeOffset) * 0.1;
        }
      });
  
      // Check for gun pickup
      if (this.controls.isLocked) {
        const playerPos = this.camera.position;
        this.guns.forEach((gun, index) => {
          if (gun.visible) {
            const distance = playerPos.distanceTo(gun.position);
            if (distance < 2) {
              this.pickupGun(index);
            }
          }
        });
      }
  
      // Update visual effects (muzzle flashes, etc.)
      this.muzzleFlashes.forEach(flash => {
        if (flash.active) {
          flash.lifetime -= delta;
          if (flash.lifetime <= 0) {
            flash.active = false;
            flash.mesh.visible = false;
          } else {
            flash.mesh.material.opacity = flash.lifetime / 0.08;
            flash.mesh.scale.multiplyScalar(1.1);
          }
        }
      });
  
      if (this.shootingLight.visible) {
        this.shootingLight.intensity *= 0.8;
        if (this.shootingLight.intensity < 0.1) {
          this.shootingLight.visible = false;
        }
      }
  
      this.bulletTrails.forEach(trail => {
        if (trail.active) {
          trail.lifetime -= delta;
          if (trail.lifetime <= 0) {
            trail.active = false;
            trail.line.visible = false;
          } else {
            trail.line.material.opacity = trail.lifetime / 0.1;
          }
        }
      });
  
      if (this.touchControls.lookTouch !== null) {
        this.controls.getObject().rotation.copy(this.camera.rotation);
      }
    }
  }

  // Modify setupHands method to adjust hand positions
  setupHands() {
    const createHand = (isRight) => {
      const handGroup = new THREE.Group();
      
      // Create arm geometry (simplified rectangular prism)
      const armGeometry = new THREE.BoxGeometry(0.2, 0.6, 0.2);
      const armMaterial = new THREE.MeshStandardMaterial({
        color: 0xffdbac, // Skin color
        flatShading: true
      });
      const arm = new THREE.Mesh(armGeometry, armMaterial);
      
      // Adjust position values
      const xOffset = isRight ? 0.4 : -0.4;
      handGroup.position.set(xOffset, -0.5, -0.3); // Moved closer to body
      arm.position.set(0, -0.2, 0);
      
      // Rotate the arms to point forward
      handGroup.rotation.x = Math.PI * 0.45; // ~80 degrees
      handGroup.rotation.z = isRight ? -0.2 : 0.2;
      handGroup.rotation.y = isRight ? 0.2 : -0.2; // Slight inward rotation
      
      handGroup.add(arm);
      
      // Add simple low-poly hand
      const handGeometry = new THREE.BoxGeometry(0.25, 0.25, 0.25);
      const hand = new THREE.Mesh(handGeometry, armMaterial);
      hand.position.set(0, -0.4, 0);
      handGroup.add(hand);
      
      return handGroup;
    };
    
    // Create both hands
    this.rightHand = createHand(true);
    this.leftHand = createHand(false);
    
    // Add hands to the camera
    this.camera.add(this.rightHand);
    this.camera.add(this.leftHand);
  }

  createNPC(x, z, type = 'civilian') {
    const npcType = this.npcTypes[type];
    const npcGroup = new THREE.Group();
    const scale = npcType.size;
    
    // Body (simple capsule-like shape)
    const bodyGeometry = new THREE.CylinderGeometry(0.3 * scale, 0.3 * scale, 0.8 * scale, 8);
    const bodyMaterial = new THREE.MeshStandardMaterial({
        color: npcType.color,
        flatShading: true
    });
    const body = new THREE.Mesh(bodyGeometry, bodyMaterial);
    body.position.y = 1.2 * scale;
    npcGroup.add(body);
    
    // Head (low-poly sphere)
    const headGeometry = new THREE.DodecahedronGeometry(0.25 * scale, 0);
    const headMaterial = new THREE.MeshStandardMaterial({
        color: 0xffdbac, // Skin color remains the same
        flatShading: true
    });
    const head = new THREE.Mesh(headGeometry, headMaterial);
    head.position.y = 1.8 * scale;
    npcGroup.add(head);
    
    // Arms
    const armGeometry = new THREE.BoxGeometry(0.2 * scale, 0.6 * scale, 0.2 * scale);
    const armMaterial = new THREE.MeshStandardMaterial({
        color: npcType.color,
        flatShading: true
    });
    
    // Left arm
    const leftArm = new THREE.Mesh(armGeometry, armMaterial);
    leftArm.position.set(-0.4 * scale, 1.2 * scale, 0);
    npcGroup.add(leftArm);
    
    // Right arm
    const rightArm = new THREE.Mesh(armGeometry, armMaterial);
    rightArm.position.set(0.4 * scale, 1.2 * scale, 0);
    npcGroup.add(rightArm);
    
    // Legs
    const createLeg = (isRight) => {
        const legGroup = new THREE.Group();
        
        // Upper leg
        const upperLegGeometry = new THREE.BoxGeometry(0.2 * scale, 0.4 * scale, 0.2 * scale);
        const upperLeg = new THREE.Mesh(upperLegGeometry, armMaterial);
        upperLeg.position.y = -0.2 * scale;
        legGroup.add(upperLeg);
        
        // Lower leg
        const lowerLegGeometry = new THREE.BoxGeometry(0.18 * scale, 0.4 * scale, 0.18 * scale);
        const lowerLeg = new THREE.Mesh(lowerLegGeometry, armMaterial);
        lowerLeg.position.y = -0.6 * scale;
        legGroup.add(lowerLeg);
        
        // Position the leg group
        const xOffset = isRight ? 0.2 : -0.2;
        legGroup.position.set(xOffset * scale, 0.8 * scale, 0);
        
        return {
            group: legGroup,
            upper: upperLeg,
            lower: lowerLeg
        };
    };
    
    const rightLeg = createLeg(true);
    const leftLeg = createLeg(false);
    
    npcGroup.add(rightLeg.group);
    npcGroup.add(leftLeg.group);
    
    // Position NPC in world
    const groundHeight = this.getHeightAt(x, z);
    npcGroup.position.set(x, groundHeight, z);
    
    // Add movement properties with type-specific speed
    npcGroup.userData = {
        velocity: new THREE.Vector3(),
        direction: new THREE.Vector3(Math.random() - 0.5, 0, Math.random() - 0.5).normalize(),
        speed: npcType.speed,
        panicSpeed: npcType.panicSpeed,
        timeOffset: Math.random() * Math.PI * 2,
        leftArm: leftArm,
        rightArm: rightArm,
        leftLeg: leftLeg,
        rightLeg: rightLeg,
        type: type,
        originalColor: npcType.color
    };
    
    this.scene.add(npcGroup);
    return npcGroup;
  }

  addNPCs(count) {
    const types = Object.keys(this.npcTypes);
    for (let i = 0; i < count; i++) {
        const x = (Math.random() - 0.5) * 180;
        const z = (Math.random() - 0.5) * 180;
        const type = types[Math.floor(Math.random() * types.length)];
        const npc = this.createNPC(x, z, type);
        this.npcs.push(npc);
    }
  }

  updateNPCs(delta) {
    for (const npc of this.npcs) {
      if (npc.userData.isDead) {
        // Handle fall animation if it's still in progress
        const fallAnim = npc.userData.fallAnimation;
        if (fallAnim && fallAnim.progress < 1) {
          // Update animation progress
          fallAnim.progress = Math.min(fallAnim.progress + (delta / fallAnim.duration), 1);
          
          // Use easeOutQuad for smooth deceleration
          const easeOut = 1 - Math.pow(1 - fallAnim.progress, 2);
          
          // Interpolate rotation
          npc.rotation.z = fallAnim.startRotation + 
            (fallAnim.targetRotation - fallAnim.startRotation) * easeOut;
          
          // Interpolate height with a slight bounce effect
          const heightProgress = Math.min(fallAnim.progress * 1.2, 1); // Slightly faster for bounce
          let currentHeight = fallAnim.startHeight;
          
          if (heightProgress < 0.8) {
            // Initial fall
            currentHeight = fallAnim.startHeight + 
              (fallAnim.groundHeight - fallAnim.startHeight) * (heightProgress / 0.8);
          } else {
            // Bounce effect near the end
            const bounceProgress = (heightProgress - 0.8) / 0.2;
            const bounceHeight = 0.2; // Maximum bounce height
            currentHeight = fallAnim.groundHeight + 
              Math.sin(bounceProgress * Math.PI) * bounceHeight;
          }
          
          npc.position.y = currentHeight;
        } else {
          // Keep dead NPCs on ground level after animation
          npc.position.y = this.getHeightAt(npc.position.x, npc.position.z) + 0.4;
        }
        continue;
      }
      
      const userData = npc.userData;
      
      // Update panic state
      if (userData.isPanicking) {
        userData.panicTime -= delta;
        
        if (userData.panicTime <= 0) {
          // Panic over, return to normal
          userData.isPanicking = false;
          userData.speed = userData.originalSpeed;
          
          // Reset color
          npc.children.forEach(part => {
            if (part.material && part.material.color) {
              part.material = part.material.clone();
              part.material.color.setHex(userData.originalColor);
            }
          });
        } else {
          // Check if it's time to change direction
          const now = performance.now();
          if (now - userData.lastDirectionChange > userData.directionChangeInterval) {
            userData.panicDirection += (Math.random() - 0.5) * Math.PI; // Change direction by up to ±90 degrees
            userData.lastDirectionChange = now;
            userData.directionChangeInterval = 500 + Math.random() * 1000; // Randomize next interval
          }
          
          // Update direction based on panic
          userData.direction.x = Math.cos(userData.panicDirection);
          userData.direction.z = Math.sin(userData.panicDirection);
          userData.direction.normalize();
          
          // Exaggerated animation
          const panicWalkCycle = now * 0.015;
          const exaggeratedSwing = Math.sin(panicWalkCycle) * 1.2; // Even more exaggerated swing
          
          // Arm flailing
          userData.leftArm.rotation.x = exaggeratedSwing;
          userData.rightArm.rotation.x = -exaggeratedSwing;
          userData.leftArm.rotation.z = Math.sin(panicWalkCycle * 0.7) * 0.8;
          userData.rightArm.rotation.z = -Math.sin(panicWalkCycle * 0.7) * 0.8;
          
          // Leg flailing
          userData.leftLeg.group.rotation.x = exaggeratedSwing;
          userData.rightLeg.group.rotation.x = -exaggeratedSwing;
          userData.leftLeg.lower.rotation.x = Math.abs(Math.sin(panicWalkCycle)) * 0.8;
          userData.rightLeg.lower.rotation.x = Math.abs(Math.sin(panicWalkCycle)) * 0.8;
          
          // Frantic head movement
          npc.children[1].rotation.y = Math.sin(panicWalkCycle * 1.2) * 0.8;
          npc.children[1].rotation.x = Math.sin(panicWalkCycle * 0.9) * 0.3;
          
          // Occasional jumping
          if (Math.random() < 0.02) { // 2% chance per frame to jump
            npc.position.y += 0.5;
          }
        }
      }
      
      // Update position
      const moveX = userData.direction.x * userData.speed * delta;
      const moveZ = userData.direction.z * userData.speed * delta;
      
      // Get new position
      const newX = npc.position.x + moveX;
      const newZ = npc.position.z + moveZ;
      
      // Check if within bounds
      if (Math.abs(newX) > 90 || Math.abs(newZ) > 90) {
        // Change direction if hitting bounds
        userData.direction.x *= -1;
        userData.direction.z *= -1;
      } else {
        // Move NPC
        npc.position.x = newX;
        npc.position.z = newZ;
      }
      
      // Update height based on terrain
      const groundHeight = this.getHeightAt(npc.position.x, npc.position.z);
      npc.position.y = groundHeight;
      
      // Face movement direction
      npc.rotation.y = Math.atan2(userData.direction.x, userData.direction.z);
      
      // Animate arms and legs while walking
      const time = performance.now() * 0.001;
      const walkCycle = time * 5 + userData.timeOffset;
      
      // Arm swing
      const armSwing = Math.sin(walkCycle) * 0.4;
      userData.leftArm.rotation.x = armSwing;
      userData.rightArm.rotation.x = -armSwing;
      
      // Leg animations
      const legSwing = Math.sin(walkCycle) * 0.4;
      const kneesBend = Math.abs(Math.sin(walkCycle)) * 0.3;
      
      // Left leg
      userData.leftLeg.group.rotation.x = legSwing;
      userData.leftLeg.lower.rotation.x = kneesBend;
      
      // Right leg
      userData.rightLeg.group.rotation.x = -legSwing;
      userData.rightLeg.lower.rotation.x = kneesBend;
      
      // Randomly change direction occasionally
      if (Math.random() < 0.005) {
        userData.direction.set(Math.random() - 0.5, 0, Math.random() - 0.5).normalize();
      }
    }
  }

  createGun(x, z) {
    const gunGroup = new THREE.Group();
    
    // Barrel
    const barrelGeometry = new THREE.BoxGeometry(0.1, 0.1, 0.8);
    const barrelMaterial = new THREE.MeshStandardMaterial({
      color: 0x444444,
      flatShading: true,
      metalness: 0.8
    });
    const barrel = new THREE.Mesh(barrelGeometry, barrelMaterial);
    barrel.position.z = 0.2;
    gunGroup.add(barrel);
    
    // Stock
    const stockGeometry = new THREE.BoxGeometry(0.08, 0.15, 0.4);
    const stockMaterial = new THREE.MeshStandardMaterial({
      color: 0x8B4513,
      flatShading: true
    });
    const stock = new THREE.Mesh(stockGeometry, stockMaterial);
    stock.position.z = -0.2;
    stock.position.y = -0.1;
    gunGroup.add(stock);
    
    // Position gun in world
    const groundHeight = this.getHeightAt(x, z);
    gunGroup.position.set(x, groundHeight + 1.5, z); // Float 1.5 units above ground
    
    // Add floating animation properties
    gunGroup.userData = {
      baseHeight: groundHeight + 1.5,
      rotationSpeed: 1,
      floatSpeed: 2,
      timeOffset: Math.random() * Math.PI * 2
    };
    
    this.scene.add(gunGroup);
    return gunGroup;
  }

  addGuns(count) {
    for (let i = 0; i < count; i++) {
      const x = (Math.random() - 0.5) * 180;
      const z = (Math.random() - 0.5) * 180;
      const gun = this.createGun(x, z);
      this.guns.push(gun);
    }
  }

  createViewModelGun() {
    const gunGroup = new THREE.Group();
    
    // Barrel
    const barrelGeometry = new THREE.BoxGeometry(0.1, 0.1, 0.8);
    const barrelMaterial = new THREE.MeshStandardMaterial({
      color: 0x444444,
      flatShading: true,
      metalness: 0.8
    });
    const barrel = new THREE.Mesh(barrelGeometry, barrelMaterial);
    barrel.position.z = 0.2;
    gunGroup.add(barrel);
    
    // Stock
    const stockGeometry = new THREE.BoxGeometry(0.08, 0.15, 0.4);
    const stockMaterial = new THREE.MeshStandardMaterial({
      color: 0x8B4513,
      flatShading: true
    });
    const stock = new THREE.Mesh(stockGeometry, stockMaterial);
    stock.position.z = -0.2;
    stock.position.y = -0.1;
    gunGroup.add(stock);
    
    // Position for first-person view
    gunGroup.position.set(0.3, -0.3, -0.5);
    gunGroup.rotation.y = Math.PI / 12; // Slight angle
    
    return gunGroup;
  }

  pickupGun(gunIndex) {
    // Hide the floating gun
    this.guns[gunIndex].visible = false;
    
    // Remove hands if they exist
    if (this.rightHand) this.camera.remove(this.rightHand);
    if (this.leftHand) this.camera.remove(this.leftHand);
    
    // Create and add view model gun if we don't have one
    if (!this.hasGun) {
      this.equippedGun = this.createViewModelGun();
      this.camera.add(this.equippedGun);
      this.hasGun = true;
    }
  }

  dropGun() {
    if (!this.hasGun) return;
    
    // Remove view model gun
    this.camera.remove(this.equippedGun);
    this.hasGun = false;
    
    // Find a hidden gun to show
    const hiddenGun = this.guns.find(gun => !gun.visible);
    if (hiddenGun) {
      // Position slightly in front of player
      const direction = new THREE.Vector3();
      this.camera.getWorldDirection(direction);
      const dropDistance = 2;
      hiddenGun.position.copy(this.camera.position)
        .add(direction.multiplyScalar(dropDistance));
      hiddenGun.position.y = this.getHeightAt(hiddenGun.position.x, hiddenGun.position.z) + 1.5;
      hiddenGun.visible = true;
    }
    
    // Restore hands
    this.setupHands();
  }

  // Replace createMuzzleFlashPool with enhanced version
  createMuzzleFlashPool(count) {
    // Create star-shaped flash geometry
    const flashGeometry = new THREE.BufferGeometry();
    const vertices = [];
    const innerRadius = 0.1;
    const outerRadius = 0.4;
    const points = 8;
    
    for (let i = 0; i < points * 2; i++) {
      const angle = (i * Math.PI) / points;
      const radius = i % 2 === 0 ? outerRadius : innerRadius;
      vertices.push(
        Math.cos(angle) * radius,
        Math.sin(angle) * radius,
        0
      );
    }
    
    flashGeometry.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3));
    flashGeometry.setIndex([...Array(points * 2 - 2)].map((_, i) => [0, i + 1, i + 2]).flat());
    
    const flashMaterial = new THREE.MeshBasicMaterial({
      color: 0xffaa33,
      transparent: true,
      opacity: 0.9,
      side: THREE.DoubleSide,
      depthWrite: false
    });

    for (let i = 0; i < count; i++) {
      const flash = new THREE.Mesh(flashGeometry, flashMaterial.clone());
      flash.visible = false;
      this.scene.add(flash);
      this.muzzleFlashes.push({
        mesh: flash,
        active: false,
        lifetime: 0
      });
    }
  }

  // Add method to create shooting light
  createShootingLight() {
    const light = new THREE.PointLight(0xff8844, 0, 3);
    light.visible = false;
    this.scene.add(light);
    return light;
  }

  // Add method to create bullet trail pool
  createBulletTrailPool(count) {
    for (let i = 0; i < count; i++) {
      const trailGeometry = new THREE.BufferGeometry();
      const trailMaterial = new THREE.LineBasicMaterial({
        color: 0xff8833,
        transparent: true,
        opacity: 0.8,
        linewidth: 1
      });
      
      const line = new THREE.Line(trailGeometry, trailMaterial);
      line.visible = false;
      this.scene.add(line);
      
      this.bulletTrails.push({
        line: line,
        active: false,
        lifetime: 0
      });
    }
  }

  // Replace createShootingEffect with enhanced version
  createShootingEffect() {
    // Get gun position and direction
    const gunDirection = new THREE.Vector3();
    this.camera.getWorldDirection(gunDirection);
    const gunPosition = new THREE.Vector3();
    this.equippedGun.getWorldPosition(gunPosition);
    
    // Activate muzzle flash
    const flash = this.muzzleFlashes.find(f => !f.active);
    if (flash) {
      flash.mesh.position.copy(gunPosition).add(gunDirection.clone().multiplyScalar(0.6));
      flash.mesh.lookAt(this.camera.position);
      flash.mesh.rotateZ(Math.random() * Math.PI * 2);
      flash.mesh.visible = true;
      flash.active = true;
      flash.lifetime = 0.08;
      flash.mesh.material.opacity = 1;
      
      // Random scale for variety
      const scale = 0.6 + Math.random() * 0.2;
      flash.mesh.scale.set(scale, scale, scale);
    }
    
    // Activate shooting light
    this.shootingLight.position.copy(gunPosition);
    this.shootingLight.visible = true;
    this.shootingLight.intensity = 3;
    
    // Create bullet trail
    const trail = this.bulletTrails.find(t => !t.active);
    if (trail) {
      const endPoint = gunPosition.clone().add(gunDirection.multiplyScalar(50));
      const points = [
        gunPosition.clone(),
        endPoint
      ];
      trail.line.geometry.setFromPoints(points);
      trail.line.visible = true;
      trail.active = true;
      trail.lifetime = 0.1;
      trail.line.material.opacity = 1;
    }
    
    // Add gun recoil
    if (this.equippedGun) {
      this.equippedGun.position.z += 0.1;
      this.equippedGun.rotation.x += 0.1;
      setTimeout(() => {
        this.equippedGun.position.z -= 0.1;
        this.equippedGun.rotation.x -= 0.1;
      }, 50);
    }
  }

  // Modify shoot method
  shoot() {
    if (this.shootCooldown || !this.hasGun) return;
    
    // Create shooting effect
    this.createShootingEffect();
    
    // Create temporary ray for shooting
    const raycaster = new THREE.Raycaster();
    const direction = new THREE.Vector3();
    this.camera.getWorldDirection(direction);
    raycaster.set(this.camera.position, direction);
    
    // Check for NPC hits
    this.npcs.forEach(npc => {
      if (!npc.userData.isDead) { // Only check living NPCs
        const npcPos = npc.position;
        const distance = this.camera.position.distanceTo(npcPos);
        
        if (distance <= this.shootRange) {
          // Calculate if NPC is in front of player
          const toNPC = npcPos.clone().sub(this.camera.position).normalize();
          const dot = direction.dot(toNPC);
          
          if (dot > 0.95) { // Within roughly 18 degrees cone
            this.killNPC(npc);
          }
        }
      }
    });
    
    // Add cooldown
    this.shootCooldown = true;
    setTimeout(() => {
      this.shootCooldown = false;
    }, 500); // 500ms cooldown between shots
  }

  // Modify killNPC method to trigger global panic
  killNPC(npc) {
    // Mark NPC as dead
    npc.userData.isDead = true;
    
    // Stop movement
    npc.userData.speed = 0;
    
    // Set up fall animation properties
    const fallDirection = Math.random() > 0.5 ? 1 : -1;
    npc.userData.fallAnimation = {
      startRotation: npc.rotation.z,
      targetRotation: fallDirection * Math.PI / 2,
      progress: 0,
      duration: 1.0,
      startHeight: npc.position.y,
      groundHeight: this.getHeightAt(npc.position.x, npc.position.z) + 0.4
    };
    
    // Change color to indicate death
    npc.children.forEach(part => {
      if (part.material) {
        part.material = part.material.clone();
        part.material.color.setHex(0x666666);
      }
    });

    // Get player's direction
    const playerDirection = new THREE.Vector3();
    this.camera.getWorldDirection(playerDirection);
    
    // Get perpendicular vector to player's direction (for spawning NPCs to the sides)
    const perpDirection = new THREE.Vector3(-playerDirection.z, 0, playerDirection.x);
    
    // Spawn two new NPCs
    for (let i = 0; i < 2; i++) {
      // Calculate spawn position
      const spawnDistance = 30 + Math.random() * 20; // 30-50 units away
      const sideOffset = (Math.random() - 0.5) * 40; // Random offset to either side
      
      // Calculate spawn position based on player's view direction
      const spawnPos = new THREE.Vector3();
      spawnPos.copy(this.camera.position)
        .add(playerDirection.clone().multiplyScalar(spawnDistance)) // Forward distance
        .add(perpDirection.clone().multiplyScalar(sideOffset)); // Side offset
      
      // Keep spawn position within map bounds
      const boundedX = Math.max(-90, Math.min(90, spawnPos.x));
      const boundedZ = Math.max(-90, Math.min(90, spawnPos.z));
      
      // Create and add new NPC
      const newNPC = this.createNPC(boundedX, boundedZ);
      
      // Make NPCs face the player initially
      const toPlayer = new THREE.Vector3()
        .subVectors(this.camera.position, newNPC.position)
        .normalize();
      newNPC.rotation.y = Math.atan2(toPlayer.x, toPlayer.z);
      
      // Add a spawn effect
      this.createNPCSpawnEffect(newNPC.position);
      
      this.npcs.push(newNPC);
    }

    // Trigger global panic for all living NPCs
    this.npcs.forEach(otherNPC => {
        if (!otherNPC.userData.isDead && otherNPC !== npc) {
            this.startPanic(otherNPC);
        }
    });
  }

  // Add new method for spawn effect
  createNPCSpawnEffect(position) {
    // Create a ring of light that expands and fades
    const geometry = new THREE.RingGeometry(0, 0.5, 16);
    const material = new THREE.MeshBasicMaterial({
      color: 0x00ff00,
      transparent: true,
      opacity: 1,
      side: THREE.DoubleSide
    });
    
    const ring = new THREE.Mesh(geometry, material);
    ring.position.copy(position);
    ring.position.y += 0.1; // Slightly above ground
    ring.rotation.x = -Math.PI / 2; // Lay flat
    
    this.scene.add(ring);
    
    // Animate the spawn effect
    const startTime = performance.now();
    const duration = 1000; // 1 second
    
    const animateSpawn = () => {
      const elapsed = performance.now() - startTime;
      const progress = elapsed / duration;
      
      if (progress < 1) {
        // Scale up the ring
        const scale = 1 + progress * 3;
        ring.scale.set(scale, scale, scale);
        
        // Fade out
        ring.material.opacity = 1 - progress;
        
        requestAnimationFrame(animateSpawn);
      } else {
        this.scene.remove(ring);
        ring.material.dispose();
        ring.geometry.dispose();
      }
    };
    
    animateSpawn();
  }

  // Modify startPanic method for longer duration and more chaotic behavior
  startPanic(npc) {
    if (npc.userData.isPanicking) return;
    
    const npcType = this.npcTypes[npc.userData.type];
    
    npc.userData.isPanicking = true;
    npc.userData.panicTime = 60;
    npc.userData.originalSpeed = npc.userData.speed;
    npc.userData.speed = npcType.panicSpeed + Math.random() * 4;
    npc.userData.panicDirection = Math.random() * Math.PI * 2;
    npc.userData.lastDirectionChange = performance.now();
    npc.userData.directionChangeInterval = 500 + Math.random() * 1000;
    
    // Change color to panic version of their original color
    npc.children.forEach(part => {
        if (part.material && part.material.color) {
            part.material = part.material.clone();
            if (part.material.color.getHex() !== 0xffdbac) { // Don't change skin color
                const color = new THREE.Color(npc.userData.originalColor);
                color.offsetHSL(0, 0.2, 0.2); // Brighter, more saturated version
                part.material.color = color;
            }
        }
    });
  }

  // Add this new method to create touch controls
  createTouchControls() {
    // Create container for touch controls
    const touchUI = document.createElement('div');
    touchUI.id = 'touchControls';
    touchUI.style.position = 'fixed';
    touchUI.style.left = '0';
    touchUI.style.right = '0';
    touchUI.style.bottom = '0';
    touchUI.style.top = '0';
    touchUI.style.zIndex = '1000';
    touchUI.style.pointerEvents = 'none';
    document.body.appendChild(touchUI);

    // Create joystick base
    const leftJoystick = document.createElement('div');
    leftJoystick.className = 'joystick';
    leftJoystick.style.position = 'absolute';
    leftJoystick.style.left = '15%';
    leftJoystick.style.bottom = '20%';
    leftJoystick.style.transform = 'translate(-50%, 50%)';
    leftJoystick.style.width = this.touchControls.joystickSize + 'px';
    leftJoystick.style.height = this.touchControls.joystickSize + 'px';
    leftJoystick.style.borderRadius = '50%';
    leftJoystick.style.border = '2px solid white';
    leftJoystick.style.opacity = '0.5';
    leftJoystick.style.pointerEvents = 'auto';
    
    // Create joystick thumb/knob
    const joystickThumb = document.createElement('div');
    joystickThumb.className = 'joystick-thumb';
    joystickThumb.style.position = 'absolute';
    joystickThumb.style.width = '40px';
    joystickThumb.style.height = '40px';
    joystickThumb.style.borderRadius = '50%';
    joystickThumb.style.backgroundColor = 'white';
    joystickThumb.style.opacity = '0.8';
    joystickThumb.style.left = '50%';
    joystickThumb.style.top = '50%';
    joystickThumb.style.transform = 'translate(-50%, -50%)';
    joystickThumb.style.pointerEvents = 'none';
    leftJoystick.appendChild(joystickThumb);

    touchUI.appendChild(leftJoystick);

    // Store references
    this.joystickBase = leftJoystick;
    this.joystickThumb = joystickThumb;
    
    // Create shoot button
    const shootButton = document.createElement('div');
    shootButton.className = 'shoot-button';
    shootButton.style.position = 'absolute';
    shootButton.style.right = '15%';
    shootButton.style.bottom = '20%';
    shootButton.style.width = '100px';
    shootButton.style.height = '100px';
    shootButton.style.borderRadius = '50%';
    shootButton.style.backgroundColor = 'rgba(255, 0, 0, 0.5)';
    shootButton.style.border = '2px solid white';
    shootButton.style.pointerEvents = 'auto';
    touchUI.appendChild(shootButton);

    // Add shoot button listener
    shootButton.addEventListener('touchstart', (e) => {
        e.preventDefault();
        if (this.hasGun) {
            this.shoot();
        }
    }, { passive: false });
  }

  // Add these new methods to handle touch events
  handleTouchStart(event) {
    event.preventDefault();
    
    Array.from(event.touches).forEach(touch => {
        const x = touch.clientX;
        const y = touch.clientY;
        
        if (x < window.innerWidth / 2) {
            this.touchControls.moveTouch = touch.identifier;
            const joystickRect = this.joystickBase.getBoundingClientRect();
            this.touchControls.moveOrigin.set(
                joystickRect.left + joystickRect.width / 2,
                joystickRect.top + joystickRect.height / 2
            );
            this.touchControls.moveDelta.set(0, 0);
            
            // Reset thumb position
            this.updateJoystickThumb(0, 0);
        }
        // Right side of screen is for looking around
        else {
            this.touchControls.lookTouch = touch.identifier;
            this.touchControls.lookOrigin.set(x, y);
            
            // Lock controls when starting to look around
            if (!this.controls.isLocked) {
                this.controls.lock();
            }
        }
    });
  }

  handleTouchMove(event) {
    event.preventDefault();
    
    Array.from(event.touches).forEach(touch => {
      if (touch.identifier === this.touchControls.moveTouch) {
        // Calculate delta from joystick center
        const dx = touch.clientX - this.touchControls.moveOrigin.x;
        const dy = touch.clientY - this.touchControls.moveOrigin.y;
        
        // Calculate distance from center
        const distance = Math.sqrt(dx * dx + dy * dy);
        
        // Calculate normalized direction
        let ndx = dx / distance;
        let ndy = dy / distance;
        
        // Apply deadzone
        const deadzone = 5;
        if (distance < deadzone) {
          ndx = 0;
          ndy = 0;
        }
        
        // Clamp to max distance
        const actualDistance = Math.min(distance, this.touchControls.maxJoystickDistance);
        
        // Update thumb position
        this.updateJoystickThumb(
          ndx * actualDistance,
          ndy * actualDistance
        );
        
        // Update movement flags based on joystick angle
        if (distance > deadzone) {
          // Convert joystick inputs to movement flags
          this.moveForward = ndy < -0.3;
          this.moveBackward = ndy > 0.3;
          this.moveLeft = ndx < -0.3;
          this.moveRight = ndx > 0.3;
        } else {
          // Reset all movement when in deadzone
          this.moveForward = false;
          this.moveBackward = false;
          this.moveLeft = false;
          this.moveRight = false;
        }
      }
      else if (touch.identifier === this.touchControls.lookTouch) {
        // Calculate delta from last position
        const dx = touch.clientX - this.touchControls.lookOrigin.x;
        const dy = touch.clientY - this.touchControls.lookOrigin.y;
        
        // Adjust sensitivity
        const sensitivity = 0.005;
        
        // Update camera rotation
        this.camera.rotation.y -= dx * sensitivity;
        
        // Limit vertical rotation (-89° to 89°)
        const newRotationX = this.camera.rotation.x - (dy * sensitivity);
        this.camera.rotation.x = THREE.MathUtils.clamp(
          newRotationX,
          -Math.PI/2,
          Math.PI/2
        );
        
        // Update look origin
        this.touchControls.lookOrigin.set(touch.clientX, touch.clientY);
      }
    });
  }
  
  handleTouchEnd(event) {
    Array.from(event.changedTouches).forEach(touch => {
        if (touch.identifier === this.touchControls.moveTouch) {
            this.touchControls.moveTouch = null;
            this.touchControls.moveDelta.set(0, 0);
            
            // Reset all movement flags
            this.moveForward = false;
            this.moveBackward = false;
            this.moveLeft = false;
            this.moveRight = false;
            
            // Reset thumb position
            this.updateJoystickThumb(0, 0);
        }
        else if (touch.identifier === this.touchControls.lookTouch) {
            this.touchControls.lookTouch = null;
            this.touchControls.lookDelta.set(0, 0);
        }
    });
  }

  // Add new method to update thumb position
  updateJoystickThumb(dx, dy) {
    if (this.joystickThumb) {
        this.joystickThumb.style.transform = `translate(calc(-50% + ${dx}px), calc(-50% + ${dy}px))`;
    }
  }

  // Add this new method to handle mobile setup
  setupMobile() {
    // Prevent default touch behaviors
    document.addEventListener('touchstart', (e) => e.preventDefault(), { passive: false });
    document.addEventListener('touchmove', (e) => e.preventDefault(), { passive: false });
    document.addEventListener('touchend', (e) => e.preventDefault(), { passive: false });
    
    // Add meta tags for mobile (add this to your HTML as well)
    const viewport = document.createElement('meta');
    viewport.name = 'viewport';
    viewport.content = 'width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no';
    document.head.appendChild(viewport);
    
    // Add touch event listeners
    document.addEventListener('touchstart', (e) => this.handleTouchStart(e), { passive: false });
    document.addEventListener('touchmove', (e) => this.handleTouchMove(e), { passive: false });
    document.addEventListener('touchend', (e) => this.handleTouchEnd(e), { passive: false });

    // Add shoot button listener
    const shootButton = document.querySelector('.shoot-button');
    shootButton.addEventListener('touchstart', (e) => {
        e.preventDefault();
        if (this.hasGun) {
            this.shoot();
        }
    }, { passive: false });

    // Request fullscreen on first touch
    document.addEventListener('touchstart', () => {
        if (document.documentElement.requestFullscreen) {
            document.documentElement.requestFullscreen();
        }
    }, { once: true });
  }

  createStartButton() {
    const startButton = document.createElement('div');
    startButton.style.position = 'fixed';
    startButton.style.top = '50%';
    startButton.style.left = '50%';
    startButton.style.transform = 'translate(-50%, -50%)';
    startButton.style.padding = '20px 40px';
    startButton.style.backgroundColor = 'rgba(255, 255, 255, 0.8)';
    startButton.style.border = 'none';
    startButton.style.borderRadius = '10px';
    startButton.style.color = '#000';
    startButton.style.fontSize = '24px';
    startButton.style.cursor = 'pointer';
    startButton.style.zIndex = '1001';
    startButton.textContent = 'Tap to Start';
    
    startButton.addEventListener('touchstart', (e) => {
        e.preventDefault();
        this.startGame();
    }, { passive: false });
    
    document.body.appendChild(startButton);
  }

  startGame() {
    // Remove start button
    const startButton = document.querySelector('div');
    if (startButton) startButton.remove();
    
    // Request fullscreen
    if (document.documentElement.requestFullscreen) {
        document.documentElement.requestFullscreen();
    }
    
    // Lock orientation
    if (screen.orientation && screen.orientation.lock) {
        screen.orientation.lock('landscape').catch(() => {
            console.log('Orientation lock not supported');
        });
    }
    
    // Create touch controls
    this.createTouchControls();
    
    // Setup touch event listeners
    document.addEventListener('touchstart', (e) => this.handleTouchStart(e), { passive: false });
    document.addEventListener('touchmove', (e) => this.handleTouchMove(e), { passive: false });
    document.addEventListener('touchend', (e) => this.handleTouchEnd(e), { passive: false });
    
    // Start the game
    this.gameStarted = true;
    this.controls.lock();
  }
}

// Initialize game
const game = new LowPolyGame(); 