<template>
  <div class="dice-container">
    <canvas ref="canvas"/>

    <button @click="throwDice">Würfeln</button>

    <div v-if="diceResults.length > 0" class="results">
      <p>Gewürfelte Werte: {{ diceResults.join(', ') }}</p>
      <p class="total">Gesamt: {{ totalResult }}</p>
    </div>
  </div>
</template>

<script setup>
import {ref, onMounted} from 'vue';
import * as THREE from 'three';
import * as CANNON from 'cannon-es';

import {useSound} from '@vueuse/sound'
import diceSfx from 'public/sounds/dice_rolling.mp3'

const {play} = useSound(diceSfx)

const canvas = ref(null); // Reference to the HTML canvas element
const diceResults = ref([]); // Reactive array to store individual dice results
const totalResult = ref(0); // Reactive variable to store the total sum of dice

let scene, camera, renderer, world; // Three.js and Cannon.js core objects
const diceMeshes = []; // Array to hold Three.js meshes (visual dice)
const diceBodies = []; // Array to hold Cannon.js bodies (physics dice)

const numDice = 5; // Number of dice to simulate
const fieldRadius = 2.5; // Radius of the square playing field - DECREASED AGAIN
let rolling = false; // Flag to track if dice are currently rolling and settling

/**
 * Creates an array of MeshStandardMaterial, one for each face of a die (1-6).
 * Each material has a CanvasTexture with the appropriate number of dots.
 * @returns {Array<THREE.MeshStandardMaterial>} An array of materials for the dice faces.
 */
function createDiceMaterial() {
  const materials = [];
  const size = 512; // Canvas resolution for the dot textures
  const radius = 40; // Radius of each dot on the die face

  // Pre-calculated pixel positions for dots on the canvas
  const positions = {
    center: [size / 2, size / 2],
    topLeft: [size / 4, size / 4],
    topRight: [3 * size / 4, size / 4],
    middleLeft: [size / 4, size / 2],
    middleRight: [3 * size / 4, size / 2],
    bottomLeft: [size / 4, 3 * size / 4],
    bottomRight: [3 * size / 4, 3 * size / 4],
  };

  // Maps the index of the materials array (which corresponds to a specific face of
  // THREE.BoxGeometry: +X, -X, +Y, -Y, +Z, -Z) to the dot pattern for the
  // correct die face number.
  // The order is:
  // 0: +X (Right) -> Should show Face 3
  // 1: -X (Left)  -> Should show Face 4
  // 2: +Y (Top)   -> Should show Face 1
  // 3: -Y (Bottom)-> Should show Face 6
  // 4: +Z (Front) -> Should show Face 2
  // 5: -Z (Back)  -> Should show Face 5
  const dotsMap = [
    // Face 3 (+X)
    [positions.topLeft, positions.center, positions.bottomRight],
    // Face 4 (-X)
    [positions.topLeft, positions.topRight, positions.bottomLeft, positions.bottomRight],
    // Face 1 (+Y)
    [positions.center],
    // Face 6 (-Y)
    [positions.topLeft, positions.topRight, positions.middleLeft, positions.middleRight, positions.bottomLeft, positions.bottomRight],
    // Face 2 (+Z)
    [positions.topLeft, positions.bottomRight],
    // Face 5 (-Z)
    [positions.topLeft, positions.topRight, positions.center, positions.bottomLeft, positions.bottomRight],
  ];

  // Generate a canvas texture for each of the six faces
  for (let i = 0; i < 6; i++) {
    const canvas = document.createElement('canvas');
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext('2d');

    // Fill the background of the face with white
    ctx.fillStyle = 'white';
    ctx.fillRect(0, 0, size, size);

    // Draw black dots according to the current face's pattern
    ctx.fillStyle = 'black';
    const dots = dotsMap[i];
    dots.forEach(([x, y]) => {
      ctx.beginPath();
      ctx.arc(x, y, radius, 0, 2 * Math.PI);
      ctx.fill();
    });

    // Create a Three.js texture from the canvas and set filtering
    const texture = new THREE.CanvasTexture(canvas);
    texture.minFilter = THREE.LinearFilter;
    texture.magFilter = THREE.LinearFilter;

    // Create and store the material for this face
    materials.push(new THREE.MeshStandardMaterial({map: texture}));
  }

  return materials;
}

/**
 * Initializes the Three.js scene, camera, renderer, and Cannon.js world.
 * Sets up lighting, ground, walls, and the dice.
 */
function init() {
  // --- Three.js Setup ---
  scene = new THREE.Scene();
  scene.background = new THREE.Color(0x228B22); // Green table background

  camera = new THREE.PerspectiveCamera(75, 1, 0.1, 1000);
  camera.position.set(0, 5, 3); // Position camera above the field
  camera.lookAt(0, 0, 0); // Point camera towards the center of the field

  renderer = new THREE.WebGLRenderer({canvas: canvas.value, antialias: true});
  renderer.setSize(500, 500); // Fixed size for the display canvas

  // --- Lighting ---
  const light = new THREE.DirectionalLight(0xffffff, 1);
  light.position.set(5, 10, 5).normalize(); // Light from top-right-front
  scene.add(light);

  const ambientLight = new THREE.AmbientLight(0xffffff, 0.5); // Soft ambient light
  scene.add(ambientLight);

  // --- Cannon.js Physics World Setup ---
  world = new CANNON.World({gravity: new CANNON.Vec3(0, -9.82, 0)}); // Standard gravity

  // Define physics materials for ground, dice, and walls
  const groundMaterial = new CANNON.Material('groundMaterial');
  const diceMaterial = new CANNON.Material('diceMaterial');
  const wallMaterial = new CANNON.Material('wallMaterial'); // New wall material

  // Define how ground and dice interact (friction, bounciness)
  const groundDiceContactMaterial = new CANNON.ContactMaterial(
      groundMaterial,
      diceMaterial,
      {
        friction: 0.5, // Amount of friction when dice slide on ground
        restitution: 0.7, // Bounciness of dice when hitting ground
        contactEquationRelaxation: 3,
        frictionEquationRelaxation: 5,
      }
  );
  world.addContactMaterial(groundDiceContactMaterial);

  // Define how dice and walls interact (higher restitution for less sticking)
  const diceWallContactMaterial = new CANNON.ContactMaterial(
      diceMaterial,
      wallMaterial,
      {
        friction: 0.1, // Less friction to prevent sticking
        restitution: 0.9, // Higher bounciness for more dynamic rebounds
        contactEquationRelaxation: 3,
        frictionEquationRelaxation: 5,
      }
  );
  world.addContactMaterial(diceWallContactMaterial);

  // Create the physics ground plane
  const groundBody = new CANNON.Body({
    type: CANNON.Body.STATIC, // Static means it doesn't move due to physics
    shape: new CANNON.Plane(), // Infinite flat plane
    material: groundMaterial,
  });
  groundBody.quaternion.setFromEuler(-Math.PI / 2, 0, 0); // Rotate to be horizontal (facing up)
  world.addBody(groundBody);

  // --- Create Dice (Visual and Physics) ---
  const diceMaterials = createDiceMaterial(); // Get the pre-generated face materials
  const diceSize = 0.5; // Dice size
  const diceHalfExtents = diceSize / 2;

  for (let i = 0; i < numDice; i++) {
    // Create Three.js mesh for visual representation
    const geometry = new THREE.BoxGeometry(diceSize, diceSize, diceSize); // Size of the die
    const mesh = new THREE.Mesh(geometry, diceMaterials);
    scene.add(mesh);
    diceMeshes.push(mesh);

    // Create Cannon.js body for physics simulation
    const body = new CANNON.Body({
      mass: 1, // Mass of the die (arbitrary, affects inertia)
      shape: new CANNON.Box(new CANNON.Vec3(diceHalfExtents, diceHalfExtents, diceHalfExtents)), // Half-extents of the box for physics
      // Initial position modified to place dice on the ground directly
      position: new CANNON.Vec3(
          (i - (numDice - 1) / 2) * diceSize * 1.5, // Spread horizontally
          diceHalfExtents, // Just above the ground
          fieldRadius - diceSize * 1.5 // Closer to one end of the field
      ),
      quaternion: new CANNON.Quaternion(), // Initial orientation
      material: diceMaterial,
      linearDamping: 0.05, // Reduces linear velocity over time (helps dice settle)
      angularDamping: 0.05, // Reduces angular velocity over time (helps dice stop spinning)
    });
    world.addBody(body);
    diceBodies.push(body);
  }

  // --- Add Walls (Invisible Physics Walls and Visible Meshes) ---
  // These walls define the boundaries of the dice rolling area
  addWall(0, 1, -fieldRadius, 0, 0, 0, wallMaterial); // Back physics wall
  addVisualWall(0, 0.5, -fieldRadius, 0); // Back visual wall

  addWall(0, 1, fieldRadius, 0, Math.PI, 0, wallMaterial); // Front physics wall
  addVisualWall(0, 0.5, fieldRadius, Math.PI); // Front visual wall

  addWall(-fieldRadius, 1, 0, 0, Math.PI / 2, 0, wallMaterial); // Left physics wall
  addVisualWall(-fieldRadius, 0.5, 0, Math.PI / 2); // Left visual wall

  addWall(fieldRadius, 1, 0, 0, -Math.PI / 2, 0, wallMaterial); // Right physics wall
  addVisualWall(fieldRadius, 0.5, 0, -Math.PI / 2); // Right visual wall

  animate(); // Start the animation/physics loop
}

/**
 * Adds an invisible static physics wall to the Cannon.js world.
 * @param {number} x X position of the wall.
 * @param {number} y Y position of the wall.
 * @param {number} z Z position of the wall.
 * @param {number} rotX X rotation (Euler angle) of the wall.
 * @param {number} rotY Y rotation (Euler angle) of the wall.
 * @param {number} rotZ Z rotation (Euler angle) of the wall.
 * @param {CANNON.Material} material The Cannon.js material for the wall.
 */
function addWall(x, y, z, rotX, rotY, rotZ, material) {
  const wall = new CANNON.Body({
    type: CANNON.Body.STATIC, // Wall is fixed in space
    shape: new CANNON.Plane(), // Flat plane shape
    material: material // Assign the new wall material
  });

  wall.position.set(x, y, z);
  wall.quaternion.setFromEuler(rotX, rotY, rotZ); // Orient the plane

  world.addBody(wall);
}

/**
 * Adds a visible wall mesh to the Three.js scene.
 * @param {number} x X position of the visual wall.
 * @param {number} y Y position of the visual wall.
 * @param {number} z Z position of the visual wall.
 * @param {number} rotY Y rotation (Euler angle) of the visual wall.
 */
function addVisualWall(x, y, z, rotY) {
  const wallLength = fieldRadius * 2; // Length of the wall
  const wallHeight = 1; // Height of the wall
  const wallThickness = 0.1; // Thickness of the wall

  const geometry = new THREE.BoxGeometry(wallLength, wallHeight, wallThickness);
  const material = new THREE.MeshStandardMaterial({color: 0x654321}); // Brown color
  const mesh = new THREE.Mesh(geometry, material);

  mesh.position.set(x, y, z);
  mesh.rotation.y = rotY; // Rotate to align with the physics walls

  scene.add(mesh);
}

/**
 * Determines the face value of a die given its Cannon.js body's orientation.
 * It finds which local face vector is pointing most directly upwards in world space.
 * @param {CANNON.Body} body The Cannon.js body of the die.
 * @returns {number} The face value (1-6) of the die.
 */
function determineDiceValue(body) {
  const upVector = new CANNON.Vec3(0, 1, 0); // World's "up" direction (positive Y-axis)
  let axis = new CANNON.Vec3(); // Temporary vector to store transformed local axis
  let maxDot = -Infinity; // Tracks the maximum dot product found so far
  let value = 0; // The determined face value

  // Defines the local direction vector for each face and its corresponding value.
  // The vectors point outwards from the center of the die.
  const faceVectors = [
    {dir: new CANNON.Vec3(0, 1, 0), val: 1}, // Local +Y axis corresponds to face 1
    {dir: new CANNON.Vec3(0, -1, 0), val: 6}, // Local -Y axis corresponds to face 6
    {dir: new CANNON.Vec3(1, 0, 0), val: 3}, // Local +X axis corresponds to face 3
    {dir: new CANNON.Vec3(-1, 0, 0), val: 4}, // Local -X axis corresponds to face 4
    {dir: new CANNON.Vec3(0, 0, 1), val: 2}, // Local +Z axis corresponds to face 2
    {dir: new CANNON.Vec3(0, 0, -1), val: 5}, // Local -Z axis corresponds to face 5
  ];

  // Iterate through each possible face direction
  for (let i = 0; i < faceVectors.length; i++) {
    const {dir, val} = faceVectors[i];
    // Transform the local face direction vector into world coordinates
    body.quaternion.vmult(dir, axis);
    // Calculate the dot product between the transformed face vector and the world's up vector.
    // A higher dot product means closer alignment to "up".
    const dot = axis.dot(upVector);

    // If this face is more aligned with "up" than any previous face,
    // update maxDot and store this face's value.
    if (dot > maxDot) {
      maxDot = dot;
      value = val;
    }
  }
  return value; // Return the value of the face pointing upwards
}

/**
 * Calculates the final dice results and updates the reactive variables for display.
 */
function calculateAndDisplayResults() {
  const results = [];
  let total = 0;
  for (let i = 0; i < numDice; i++) {
    const value = determineDiceValue(diceBodies[i]);
    results.push(value);
    total += value;
  }
  results.sort((a, b) => a - b); // Sort the results in ascending order
  diceResults.value = results; // Update array of individual results
  totalResult.value = total; // Update total sum
}

/**
 * Initiates the dice throw by resetting positions and applying random velocities.
 */
function throwDice() {
  rolling = true; // Set the flag to indicate dice are now rolling

  diceResults.value = []; // Clear previous results display
  totalResult.value = 0; // Reset total sum display

  const diceSize = 0.5; // Dice size
  const diceHalfExtents = diceSize / 2;

  for (let i = 0; i < numDice; i++) {
    const body = diceBodies[i];

    // Calculate initial position to spread dice horizontally at the front of the field
    const startX = (i - (numDice - 1) / 2) * diceSize * 1.5;
    const startY = diceHalfExtents; // Dices start on the ground
    // Adjusted startZ to throw dice more towards the middle
    const startZ = (Math.random() - 0.5) * fieldRadius * 0.5; // Random position around center depth

    body.position.set(startX, startY, startZ);
    // Give each die a random initial orientation
    body.quaternion.set(
        Math.random() - 0.5, Math.random() - 0.5, Math.random() - 0.5, Math.random() - 0.5
    ).normalize(); // Normalize to ensure valid quaternion

    // Apply initial linear velocities (forward, upward, slight side motion)
    const velocityY = 4 + Math.random() * 3; // Adjusted for more height
    const velocityZ = -9 - Math.random() * 4; // Adjusted for more forward motion
    const velocityX = (Math.random() - 0.5) * 3; // Adjusted for slightly more side motion
    body.velocity.set(velocityX, velocityY, velocityZ);

    // Apply random angular velocities for spinning effect
    body.angularVelocity.set(
        15 + Math.random() * 10, // Increased angular velocity
        15 + Math.random() * 10, // Increased angular velocity
        15 + Math.random() * 10 // Increased angular velocity
    );
  }

  setTimeout(() => {
    play();
  }, 800)
}

/**
 * The main animation loop. Updates physics, synchronizes visual meshes,
 * and checks if dice have settled.
 */
function animate() {
  requestAnimationFrame(animate); // Request the next frame for continuous animation

  world.step(1 / 60); // Advance the physics simulation by a fixed time step (60 FPS)

  // Synchronize the positions and rotations of Three.js meshes with Cannon.js bodies
  for (let i = 0; i < numDice; i++) {
    diceMeshes[i].position.copy(diceBodies[i].position);
    diceMeshes[i].quaternion.copy(diceBodies[i].quaternion);
  }

  // Check if dice have settled when the rolling flag is true
  if (rolling) {
    let allStopped = true;
    for (let i = 0; i < numDice; i++) {
      const body = diceBodies[i];
      // Check if both linear and angular velocities are below a small threshold.
      // If any die is still moving significantly, set allStopped to false.
      if (body.velocity.length() > 0.05 || body.angularVelocity.length() > 0.05) {
        allStopped = false;
        break;
      }
    }

    if (allStopped) {
      rolling = false; // All dice have settled
      calculateAndDisplayResults(); // Calculate and display the final results
    }
  }

  renderer.render(scene, camera); // Render the current state of the scene
}

// Lifecycle hook: initialize the scene and physics when the component is mounted to the DOM
onMounted(() => {
  init();
});
</script>

<style scoped>
.dice-container {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  min-height: 100vh;
  background-color: #f0f0f0;
  font-family: 'Inter', sans-serif;
  padding: 20px;
  box-sizing: border-box;
}

canvas {
  border-radius: 10px;
  box-shadow: 0 4px 8px rgba(0, 0, 0, 0.2);
  margin-bottom: 20px;
  max-width: 100%;
  height: auto;
}

button {
  padding: 12px 25px;
  font-size: 18px;
  background-color: #4CAF50;
  color: white;
  border: none;
  border-radius: 8px;
  cursor: pointer;
  transition: background-color 0.3s ease, transform 0.1s ease;
  box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
  font-weight: 500;
}

button:hover {
  background-color: #45a049;
  transform: translateY(-2px);
}

button:active {
  background-color: #3e8e41;
  transform: translateY(0);
  box-shadow: 0 2px 3px rgba(0, 0, 0, 0.1);
}

.results {
  margin-top: 30px;
  padding: 20px;
  background-color: #fff;
  border-radius: 10px;
  box-shadow: 0 4px 8px rgba(0, 0, 0, 0.1);
  text-align: center;
  width: 80%;
  max-width: 400px;
  box-sizing: border-box;
}

.results p {
  margin: 8px 0;
  font-size: 20px;
  color: #333;
}

.results .total {
  font-size: 24px;
  font-weight: bold;
  color: #0056b3;
  margin-top: 15px;
  border-top: 1px solid #eee;
  padding-top: 10px;
}
</style>
