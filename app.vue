<template>
  <div class="dice-container">
    <canvas ref="canvas"/>

    <button @click="throwDice" :disabled="rolling">Würfeln</button>

    <div v-if="diceResults.length > 0 && !rolling" class="results">
      <p>Gewürfelte Werte: {{ diceResults.join(', ') }}</p>
      <p class="total">Gesamt: {{ totalResult }}</p>
    </div>
    <div v-else-if="rolling" class="rolling-status">
      <p>Würfel rollen...</p>
    </div>
  </div>
</template>

<script setup>
import {ref, onMounted, onBeforeUnmount} from 'vue';
import * as THREE from 'three';
import {io} from 'socket.io-client';
import {useSound} from '@vueuse/sound';
import diceSfx from '/sounds/dice_rolling.mp3'; // Correct path for public assets

// --- Reactive State ---
const canvas = ref(null); // Reference to the HTML canvas element
const diceResults = ref([]); // Reactive array to store individual dice results
const totalResult = ref(0); // Reactive variable to store the total sum of dice
const rolling = ref(false); // Flag to track if dice are currently rolling and settling

// --- Sound Effect ---
const {play} = useSound(diceSfx);

// --- Three.js Variables ---
let scene, camera, renderer;
const diceMeshes = []; // Array to hold Three.js meshes (visual dice)

// --- Socket.IO Client ---
// Adjust this URL if your backend is not on localhost:3000
const socket = io("/lobby", {
  path: "/api/socket.io",
});

// --- Constants (should match backend for visual consistency) ---
const numDice = 5;
const fieldRadius = 2.5; // Radius of the square playing field
const diceSize = 0.5;

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
 * Initializes the Three.js scene, camera, renderer, and visual elements.
 * No Cannon.js physics here as it's handled by the backend.
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
  renderer.setPixelRatio(window.devicePixelRatio); // For better quality on high-res screens

  // Handle window resize (optional, but good practice)
  window.addEventListener('resize', onWindowResize);

  // --- Lighting ---
  const light = new THREE.DirectionalLight(0xffffff, 1);
  light.position.set(5, 10, 5).normalize(); // Light from top-right-front
  scene.add(light);

  const ambientLight = new THREE.AmbientLight(0xffffff, 0.5); // Soft ambient light
  scene.add(ambientLight);

  // --- Create Dice (Visual Only) ---
  const diceMaterials = createDiceMaterial(); // Get the pre-generated face materials

  for (let i = 0; i < numDice; i++) {
    // Create Three.js mesh for visual representation
    const geometry = new THREE.BoxGeometry(diceSize, diceSize, diceSize); // Size of the die
    const mesh = new THREE.Mesh(geometry, diceMaterials);
    // Set initial position - these will be updated by server data
    mesh.position.set(
        (i - (numDice - 1) / 2) * diceSize * 1.5,
        diceSize / 2,
        fieldRadius - diceSize * 1.5
    );
    scene.add(mesh);
    diceMeshes.push(mesh);
  }

  // --- Add Visual Walls (to match backend's physics boundaries) ---
  addVisualWall(0, 0.5, -fieldRadius, 0); // Back visual wall
  addVisualWall(0, 0.5, fieldRadius, Math.PI); // Front visual wall
  addVisualWall(-fieldRadius, 0.5, 0, Math.PI / 2); // Left visual wall
  addVisualWall(fieldRadius, 0.5, 0, -Math.PI / 2); // Right visual wall

  animate(); // Start the rendering loop
}

/**
 * Handles window resizing to keep the renderer and camera aspect ratio correct.
 */
function onWindowResize() {
  if (canvas.value) {
    const width = canvas.value.clientWidth;
    const height = canvas.value.clientHeight;
    renderer.setSize(width, height);
    camera.aspect = width / height;
    camera.updateProjectionMatrix();
  }
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
 * Initiates the dice throw by emitting a socket event to the backend.
 */
function throwDice() {
  if (rolling.value) return; // Prevent multiple throws while already rolling

  rolling.value = true; // Indicate that dice are rolling
  diceResults.value = []; // Clear previous results display
  totalResult.value = 0; // Reset total sum display

  // Only emit the event to the server; the server handles the physics.
  console.log("throing front")
  socket.emit('throwDice');
}

/**
 * The main animation loop. Only renders the scene based on received data.
 * No physics simulation or settling checks here.
 */
function animate() {
  requestAnimationFrame(animate); // Request the next frame for continuous animation
  renderer.render(scene, camera); // Render the current state of the scene
}

// --- Lifecycle Hooks and Socket.IO Event Handlers ---
onMounted(() => {
  init();

  socket.on('connect', () => {
    console.log('Connected to server via Socket.IO');
  });

  socket.on('disconnect', () => {
    console.log('Disconnected from server');
  });

  // Listener for dice state updates from the server
  socket.on('diceStateUpdate', (diceStates) => {
    // Synchronize the positions and rotations of Three.js meshes
    diceStates.forEach((state, index) => {
      if (diceMeshes[index]) {
        diceMeshes[index].position.set(state.position.x, state.position.y, state.position.z);
        // Important: use THREE.Quaternion for the mesh
        diceMeshes[index].quaternion.set(state.quaternion.x, state.quaternion.y, state.quaternion.z, state.quaternion.w);
      }
    });
  });

  // Listener for final dice results from the server
  socket.on('diceResult', (results) => {
    console.log('Received final results:', results);
    diceResults.value = results.individual; // Update array of individual results
    totalResult.value = results.total; // Update total sum
    rolling.value = false; // Dice have settled

    // Play sound effect when results are received (i.e., dice have settled)
    play();
  });
});

onBeforeUnmount(() => {
  socket.disconnect(); // Clean up socket connection
  window.removeEventListener('resize', onWindowResize); // Remove resize listener
  // Dispose Three.js objects to prevent memory leaks if necessary for more complex scenes
  if (renderer) renderer.dispose();
  // No need to dispose scene/camera for this simple setup as they are implicitly cleaned up
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
  font-family: sans-serif;
  color: #333;
}

canvas {
  border: 2px solid #555;
  border-radius: 8px;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.2);
  width: 500px; /* Fixed width */
  height: 500px; /* Fixed height */
  margin-bottom: 20px;
}

button {
  padding: 12px 25px;
  font-size: 1.2em;
  background-color: #4CAF50;
  color: white;
  border: none;
  border-radius: 5px;
  cursor: pointer;
  transition: background-color 0.3s ease, transform 0.1s ease;
}

button:hover:not(:disabled) {
  background-color: #45a049;
  transform: translateY(-2px);
}

button:active:not(:disabled) {
  background-color: #3e8e41;
  transform: translateY(0);
}

button:disabled {
  background-color: #cccccc;
  cursor: not-allowed;
}

.results {
  margin-top: 20px;
  padding: 15px 30px;
  background-color: #e0e0e0;
  border-radius: 8px;
  text-align: center;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
}

.results p {
  margin: 5px 0;
  font-size: 1.1em;
}

.results .total {
  font-weight: bold;
  font-size: 1.3em;
  color: #007bff;
}

.rolling-status {
  margin-top: 20px;
  font-size: 1.1em;
  color: #666;
}
</style>