// server/socket.ts (or server/lobbyEvents.ts)

import { Socket, Namespace } from "socket.io";
import CANNON from "cannon-es";

// --- GLOBAL PHYSICS STATE ---
// These variables are declared outside the handleLobbyEvents function.
// This ensures they are initialized once when the server starts
// and persist across all client connections, forming a single source of truth.
let world: CANNON.World;
const diceBodies: CANNON.Body[] = [];
const numDice = 5;
const fieldRadius = 2.5; // Matches frontend
const diceSize = 0.5;    // Matches frontend
const diceHalfExtents = diceSize / 2;

let serverRolling = false; // Flag to indicate if dice are currently rolling on the server
let lastTime = Date.now(); // Used to calculate dt for consistent physics steps
let animationIntervalId: NodeJS.Timeout | null = null; // Stores the setInterval ID for the physics loop

// --- PHYSICS MATERIALS (GLOBAL) ---
const groundMaterial = new CANNON.Material('groundMaterial');
const diceMaterial = new CANNON.Material('diceMaterial');
const wallMaterial = new CANNON.Material('wallMaterial');

// --- UTILITY FUNCTIONS (GLOBAL) ---

/**
 * Adds an invisible static physics wall to the Cannon.js world.
 * @param x X position of the wall.
 * @param y Y position of the wall.
 * @param z Z position of the wall.
 * @param rotX X rotation (Euler angle) of the wall.
 * @param rotY Y rotation (Euler angle) of the wall.
 * @param rotZ Z rotation (Euler angle) of the wall.
 * @param material The Cannon.js material for the wall.
 */
function addWall(x: number, y: number, z: number, rotX: number, rotY: number, rotZ: number, material: CANNON.Material) {
    const wall = new CANNON.Body({
        type: CANNON.Body.STATIC, // Wall is fixed in space
        shape: new CANNON.Plane(), // Flat plane shape
        material: material
    });
    wall.position.set(x, y, z);
    wall.quaternion.setFromEuler(rotX, rotY, rotZ); // Orient the plane
    world.addBody(wall);
}

/**
 * Determines the face value of a die given its Cannon.js body's orientation.
 * It finds which local face vector is pointing most directly upwards in world space.
 * @param body The Cannon.js body of the die.
 * @returns The face value (1-6) of the die.
 */
function determineDiceValue(body: CANNON.Body): number {
    const upVector = new CANNON.Vec3(0, 1, 0); // World's "up" direction (positive Y-axis)
    let axis = new CANNON.Vec3(); // Temporary vector to store transformed local axis
    let maxDot = -Infinity; // Tracks the maximum dot product found so far
    let value = 0; // The determined face value

    // Defines the local direction vector for each face and its corresponding value.
    // The vectors point outwards from the center of the die.
    const faceVectors = [
        { dir: new CANNON.Vec3(0, 1, 0), val: 1 }, // Local +Y axis corresponds to face 1
        { dir: new CANNON.Vec3(0, -1, 0), val: 6 }, // Local -Y axis corresponds to face 6
        { dir: new CANNON.Vec3(1, 0, 0), val: 3 }, // Local +X axis corresponds to face 3
        { dir: new CANNON.Vec3(-1, 0, 0), val: 4 }, // Local -X axis corresponds to face 4
        { dir: new CANNON.Vec3(0, 0, 1), val: 2 }, // Local +Z axis corresponds to face 2
        { dir: new CANNON.Vec3(0, 0, -1), val: 5 }, // Local -Z axis corresponds to face 5
    ];

    // Iterate through each possible face direction
    for (let i = 0; i < faceVectors.length; i++) {
        const { dir, val } = faceVectors[i];
        // Transform the local face direction vector into world coordinates
        body.quaternion.vmult(dir, axis);
        // Calculate the dot product between the transformed face vector and the world's up vector.
        const dot = axis.dot(upVector);

        if (dot > maxDot) {
            maxDot = dot;
            value = val;
        }
    }
    return value;
}

// --- INITIALIZE PHYSICS WORLD (RUNS ONLY ONCE WHEN THE NODE.JS PROCESS STARTS) ---
function initPhysics() {
    world = new CANNON.World({ gravity: new CANNON.Vec3(0, -9.82, 0) }); // Standard gravity

    // Define how ground and dice interact (friction, bounciness)
    const groundDiceContactMaterial = new CANNON.ContactMaterial(
        groundMaterial,
        diceMaterial,
        {
            friction: 0.5,
            restitution: 0.7,
            contactEquationRelaxation: 3,
            frictionEquationRelaxation: 5,
        }
    );
    world.addContactMaterial(groundDiceContactMaterial);

    // Define how dice and walls interact
    const diceWallContactMaterial = new CANNON.ContactMaterial(
        diceMaterial,
        wallMaterial,
        {
            friction: 0.1,
            restitution: 0.9,
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

    // Create Dice (Physics Bodies Only)
    for (let i = 0; i < numDice; i++) {
        const body = new CANNON.Body({
            mass: 1, // Mass of the die
            shape: new CANNON.Box(new CANNON.Vec3(diceHalfExtents, diceHalfExtents, diceHalfExtents)),
            // Initial position - these will be reset on throw, so arbitrary here
            position: new CANNON.Vec3(0, diceHalfExtents, 0),
            quaternion: new CANNON.Quaternion(), // Initial orientation
            material: diceMaterial,
            linearDamping: 0.05, // Reduces linear velocity over time
            angularDamping: 0.05, // Reduces angular velocity over time
        });
        world.addBody(body);
        diceBodies.push(body);
    }

    // Add Walls (Invisible Physics Walls)
    addWall(0, 1, -fieldRadius, 0, 0, 0, wallMaterial); // Back physics wall
    addWall(0, 1, fieldRadius, 0, Math.PI, 0, wallMaterial); // Front physics wall
    addWall(-fieldRadius, 1, 0, 0, Math.PI / 2, 0, wallMaterial); // Left physics wall
    addWall(fieldRadius, 1, 0, 0, -Math.PI / 2, 0, wallMaterial); // Right physics wall

    console.log('Cannon.js physics world initialized on server.');
}

// Call initPhysics when this module is loaded (i.e., when the Nitro server starts)
initPhysics();

// --- SERVER ANIMATION LOOP (GLOBAL) ---
/**
 * The main server-side physics and state update loop.
 * It advances the physics, collects dice states, and broadcasts them to clients.
 * @param ioInstance The Socket.IO Namespace instance to emit updates to.
 */
function serverAnimate(ioInstance: Namespace) {
    const currentTime = Date.now();
    const dt = (currentTime - lastTime) / 1000; // Time in seconds since last step
    lastTime = currentTime;

    world.step(1 / 60, dt, 3); // Advance the physics simulation

    // Collect current state of dice to send to clients
    const diceStates = diceBodies.map(body => ({
        position: { x: body.position.x, y: body.position.y, z: body.position.z },
        quaternion: { x: body.quaternion.x, y: body.quaternion.y, z: body.quaternion.z, w: body.quaternion.w }
    }));

    // Emit state to all connected clients in this namespace
    ioInstance.emit('diceStateUpdate', diceStates);

    // Check if dice have settled on the server
    if (serverRolling) {
        let allStopped = true;
        for (let i = 0; i < numDice; i++) {
            const body = diceBodies[i];
            // Check if both linear and angular velocities are below a small threshold.
            if (body.velocity.length() > 0.05 || body.angularVelocity.length() > 0.05) {
                allStopped = false;
                break;
            }
        }

        if (allStopped) {
            serverRolling = false;
            // Stop the animation loop as dice have settled
            if (animationIntervalId) {
                clearInterval(animationIntervalId);
                animationIntervalId = null;
                console.log('Server animation loop stopped.');
            }

            // Calculate final results
            const results: number[] = [];
            let total = 0;
            for (let i = 0; i < numDice; i++) {
                const value = determineDiceValue(diceBodies[i]);
                results.push(value);
                total += value;
            }
            results.sort((a, b) => a - b); // Sort results for consistent display

            // Emit final results to all clients
            ioInstance.emit('diceResult', { individual: results, total: total });
            console.log('Dice settled, results:', results, 'Total:', total);
        }
    }
}

// --- SOCKET.IO EVENT HANDLER (CALLED PER CLIENT CONNECTION) ---
/**
 * Handles Socket.IO events for a connected client within a specific namespace.
 * This function is meant to be called by your main Socket.IO server setup in Nitro.
 * @param socket The specific Socket.IO client socket.
 * @param io The Socket.IO Namespace instance for broadcasting.
 */
export function handleLobbyEvents(socket: Socket, io: Namespace) {
    console.log(`User connected to lobby: ${socket.id}`);

    // Event listener for a client requesting to throw dice
    socket.on('throwDice', () => {
        if (serverRolling) {
            console.log('Dice already rolling, ignoring new throw request from', socket.id);
            return; // Prevent new throw if dice are already in motion
        }
        serverRolling = true;
        console.log('Throwing dice requested by', socket.id);

        // Apply initial forces to each die in the shared physics world
        for (let i = 0; i < numDice; i++) {
            const body = diceBodies[i];

            // Calculate initial position within the field, slightly above ground
            const startX = (i - (numDice - 1) / 2) * diceSize * 1.5;
            const startY = diceHalfExtents + 0.5 + Math.random(); // Start a bit higher off the ground for better drop
            const startZ = (Math.random() - 0.5) * fieldRadius * 0.5; // Random position around center depth

            body.position.set(startX, startY, startZ);
            // Give each die a random initial orientation
            body.quaternion.set(
                Math.random() - 0.5, Math.random() - 0.5, Math.random() - 0.5, Math.random() - 0.5
            ).normalize();

            // Reset velocities before applying new ones to ensure consistent throws
            body.velocity.set(0, 0, 0);
            body.angularVelocity.set(0, 0, 0);

            // Apply initial linear velocities (forward, upward, slight side motion)
            const velocityY = 4 + Math.random() * 3;
            const velocityZ = -9 - Math.random() * 4; // Throw towards the "back" of the field
            const velocityX = (Math.random() - 0.5) * 3;
            body.velocity.set(velocityX, velocityY, velocityZ);

            // Apply random angular velocities for spinning effect
            body.angularVelocity.set(
                15 + Math.random() * 10,
                15 + Math.random() * 10,
                15 + Math.random() * 10
            );
        }

        // Start the server's animation loop if it's not already running.
        // The loop will continuously update physics and broadcast states.
        // We pass the `io` (Namespace) instance to `serverAnimate` so it can broadcast.
        if (!animationIntervalId) {
            animationIntervalId = setInterval(() => serverAnimate(io), 1000 / 60); // Run at 60 FPS
            console.log('Server animation loop started by throw request from', socket.id);
        }
    });

    // Handle client disconnection
    socket.on('disconnect', () => {
        console.log(`User disconnected from lobby: ${socket.id}`);
        // No explicit action needed here to stop the physics loop,
        // as it will stop automatically when the dice settle.
    });
}