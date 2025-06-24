<template>
  <div class="dice-container">
    <canvas ref="canvas"/>

    <button @click="throwDice">Würfeln</button>
  </div>
</template>

<script setup>
import {ref, onMounted} from 'vue';
import * as THREE from 'three';
import * as CANNON from 'cannon-es';

const canvas = ref(null);

let scene, camera, renderer, world;
const diceMeshes = [];
const diceBodies = [];

const numDice = 5;
const fieldRadius = 2.5;

function createDiceMaterial() {
  const materials = [];
  const size = 512;
  const radius = 40;

  const positions = {
    center: [size / 2, size / 2],
    topLeft: [size / 4, size / 4],
    topRight: [3 * size / 4, size / 4],
    middleLeft: [size / 4, size / 2],
    middleRight: [3 * size / 4, size / 2],
    bottomLeft: [size / 4, 3 * size / 4],
    bottomRight: [3 * size / 4, 3 * size / 4],
  };

  const dotsMap = [
    [positions.center, positions.topLeft, positions.topRight, positions.bottomLeft, positions.bottomRight], // 3
    [positions.topLeft, positions.bottomRight, positions.topRight, positions.bottomLeft], // 4
    [positions.center], // 1
    [positions.topLeft, positions.topRight, positions.middleLeft, positions.middleRight, positions.bottomLeft, positions.bottomRight], // 6
    [positions.topLeft, positions.bottomRight], // 2
    [positions.center, positions.topLeft, positions.topRight, positions.bottomLeft, positions.bottomRight], // 5
  ];

  for (let i = 0; i < 6; i++) {
    const canvas = document.createElement('canvas');
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext('2d');

    ctx.fillStyle = 'white';
    ctx.fillRect(0, 0, size, size);

    ctx.fillStyle = 'black';
    const dots = dotsMap[i];
    dots.forEach(([x, y]) => {
      ctx.beginPath();
      ctx.arc(x, y, radius, 0, 2 * Math.PI);
      ctx.fill();
    });

    const texture = new THREE.CanvasTexture(canvas);
    texture.minFilter = THREE.LinearFilter;
    texture.magFilter = THREE.LinearFilter;

    materials.push(new THREE.MeshStandardMaterial({map: texture}));
  }

  return materials;
}

function init() {
  scene = new THREE.Scene();
  camera = new THREE.PerspectiveCamera(75, 1, 0.1, 1000);
  renderer = new THREE.WebGLRenderer({canvas: canvas.value, antialias: true, alpha: true});
  renderer.setSize(500, 500);

  world = new CANNON.World({gravity: new CANNON.Vec3(0, -9.82, 0)});

  //set light
  const light = new THREE.DirectionalLight(0xffffff, 1);
  light.position.set(5, 10, 5).normalize();
  scene.add(light);

  const ambientLight = new THREE.AmbientLight(0xffffff, 0.5);
  scene.add(ambientLight);

  // Materialien für Physik
  const groundMaterial = new CANNON.Material('groundMaterial');
  const diceMaterial = new CANNON.Material('diceMaterial');

  //set ground
  const ground = new CANNON.Body({
    type: CANNON.Body.STATIC,
    shape: new CANNON.Plane(),
    material: groundMaterial,
  });

  ground.quaternion.setFromEuler(-Math.PI / 2, 0, 0);
  world.addBody(ground);

  // const groundDiceContactMaterial = new CANNON.ContactMaterial(
  //     groundMaterial,
  //     diceMaterial,
  //     {
  //       friction: 0.3,
  //       restitution: 0.6,
  //     }
  // );
  // world.addContactMaterial(groundDiceContactMaterial);

  // create dice
  const diceMaterials = createDiceMaterial();

  for (let i = 0; i < numDice; i++) {
    const geometry = new THREE.BoxGeometry(0.6, 0.6, 0.6);
    const mesh = new THREE.Mesh(geometry, diceMaterials);
    scene.add(mesh);
    diceMeshes.push(mesh);

    const body = new CANNON.Body({
      mass: 1,
      shape: new CANNON.Box(new CANNON.Vec3(0.3, 0.3, 0.3)),
      position: new CANNON.Vec3(Math.random() * 1.5 - 0.75, 0.3, Math.random() * 1.5 - 0.75),
      quaternion: new CANNON.Quaternion(),
      material: diceMaterial,
      linearDamping: 0.01,
      angularDamping: 0.01,
    });

    world.addBody(body);
    diceBodies.push(body);
  }

  //add walls
  addWall(0, 1, -fieldRadius, 0, 0, 0);
  addWall(0, 1, fieldRadius, 0, Math.PI, 0);
  addWall(-fieldRadius, 1, 0, 0, Math.PI / 2, 0);
  addWall(fieldRadius, 1, 0, 0, -Math.PI / 2, 0);

  addVisualWall(0, 1, -fieldRadius, 0);
  addVisualWall(0, 1, fieldRadius, Math.PI);
  addVisualWall(-fieldRadius, 1, 0, Math.PI / 2);
  addVisualWall(fieldRadius, 1, 0, -Math.PI / 2);

  //set camera
  camera.position.set(0, 5, 3);
  camera.lookAt(0, 0, 0);

  animate();
}

function addWall(x, y, z, rotX, rotY, rotZ) {
  const wall = new CANNON.Body({
    type: CANNON.Body.STATIC,
    shape: new CANNON.Plane()
  });

  wall.position.set(x, y, z);
  wall.quaternion.setFromEuler(rotX, rotY, rotZ);

  world.addBody(wall);
}

function addVisualWall(x, y, z, rotY) {
  const wallLength = fieldRadius * 2;
  const wallHeight = 1;
  const wallThickness = 0.1;

  const geometry = new THREE.BoxGeometry(wallLength, wallHeight, wallThickness);
  const material = new THREE.MeshStandardMaterial({color: 0x654321});
  const mesh = new THREE.Mesh(geometry, material);

  mesh.position.set(x, y, z);
  mesh.rotation.y = rotY;

  scene.add(mesh);
}

function throwDice() {
  for (let i = 0; i < numDice; i++) {
    const body = diceBodies[i];

    const startX = (i - (numDice - 1) / 2) * 0.6;
    const startY = 0.5;
    const startZ = fieldRadius - 0.5;

    body.position.set(startX, startY, startZ);

    const velocityY = 5;
    const velocityZ = -7;
    const velocityX = 0;

    body.velocity.set(velocityX, velocityY, velocityZ);

    body.angularVelocity.set(
        5 + Math.random() * 5,
        5 + Math.random() * 5,
        5 + Math.random() * 5
    );
  }
}

function animate() {
  requestAnimationFrame(animate);
  world.step(1 / 60);

  for (let i = 0; i < numDice; i++) {
    diceMeshes[i].position.copy(diceBodies[i].position);
    diceMeshes[i].quaternion.copy(diceBodies[i].quaternion);
  }

  renderer.render(scene, camera);
}

onMounted(() => {
  init();
});

</script>

<style scoped>
canvas {
  display: block;
  background: #1b5e1b;
}

button {
  margin-top: 25px;
  padding: 5px 10px;
  font-size: 16px;
  cursor: pointer;
}
</style>
