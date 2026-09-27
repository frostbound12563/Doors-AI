import * as THREE from "https://cdn.jsdelivr.net/npm/three@0.160.1/build/three.module.js";

const $ = id => document.getElementById(id);
const game = $("game"), overlay = $("overlay"), hud = $("hud");
const seedInput = $("seed"), title = $("title"), description = $("description");
const stats = $("stats"), message = $("message"), prompt = $("prompt");
const danger = $("danger"), volume = $("volume"), quality = $("quality");

seedInput.value = localStorage.getItem("threshold-seed") || "NIGHT-17";

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x09070b);
scene.fog = new THREE.Fog(0x09070b, 17, 43);

const camera = new THREE.PerspectiveCamera(74, innerWidth / innerHeight, .07, 75);
const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(innerWidth, innerHeight);
renderer.setPixelRatio(Math.min(devicePixelRatio, 1.5));
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.outputColorSpace = THREE.SRGBColorSpace;
game.appendChild(renderer.domElement);

scene.add(new THREE.AmbientLight(0x82718a, .55));
const mats = {
  wall: new THREE.MeshStandardMaterial({ color: 0x514047, roughness: 1 }),
  trim: new THREE.MeshStandardMaterial({ color: 0x291d23, roughness: .8 }),
  floor: new THREE.MeshStandardMaterial({ color: 0x382c30, roughness: .95 }),
  carpet: new THREE.MeshStandardMaterial({ color: 0x69343c, roughness: 1 }),
  ceiling: new THREE.MeshStandardMaterial({ color: 0x69585a, roughness: 1 }),
  wood: new THREE.MeshStandardMaterial({ color: 0x684232, roughness: .85 }),
  darkWood: new THREE.MeshStandardMaterial({ color: 0x38251f, roughness: .9 }),
  gold: new THREE.MeshStandardMaterial({ color: 0xe5b846, metalness: .75, roughness: .25 }),
  key: new THREE.MeshStandardMaterial({ color: 0xf2d890, metalness: .65, roughness: .3 }),
  black: new THREE.MeshStandardMaterial({ color: 0x101015, roughness: 1 }),
  eye: new THREE.MeshBasicMaterial({ color: 0xffd1b6 }),
  rush: new THREE.MeshBasicMaterial({ color: 0x181726 }),
  ambush: new THREE.MeshBasicMaterial({ color: 0x5de5b1 })
};
const box = new THREE.BoxGeometry(1, 1, 1);
const sphere = new THREE.SphereGeometry(1, 16, 12);
const coinGeo = new THREE.CylinderGeometry(.19, .19, .055, 12);

function block(parent, mat, x, y, z, w, h, d) {
  const m = new THREE.Mesh(box, mat);
  m.position.set(x, y, z);
  m.scale.set(w, h, d);
  m.castShadow = true;
  m.receiveShadow = true;
  parent.add(m);
  return m;
}
function text(parent, value, x, y, z, size = 72) {
  const canvas = document.createElement("canvas");
  canvas.width = 256; canvas.height = 128;
  const ctx = canvas.getContext("2d");
  ctx.fillStyle = "#ead7a5"; ctx.font = `bold ${size}px Georgia`;
  ctx.textAlign = "center"; ctx.textBaseline = "middle";
  ctx.fillText(String(value), 128, 64);
  const texture = new THREE.CanvasTexture(canvas);
  const mesh = new THREE.Mesh(
    new THREE.PlaneGeometry(1.25, .63),
    new THREE.MeshBasicMaterial({ map: texture, transparent: true, side: THREE.DoubleSide })
  );
  mesh.position.set(x, y, z);
  parent.add(mesh);
}
function hash(str) {
  let h = 2166136261;
  for (const c of str) h = Math.imul(h ^ c.charCodeAt(0), 16777619);
  return h >>> 0;
}
function rngFor(n) {
  let state = hash(run.seed + ":" + n) || 1;
  return () => {
    state ^= state << 13; state ^= state >>> 17; state ^= state << 5;
    return (state >>> 0) / 4294967296;
  };
}
function tone(frequency, duration = .17, type = "sine", gain = .14) {
  if (!run?.started || Number(volume.value) === 0) return;
  try {
    audio ||= new AudioContext();
    if (audio.state === "suspended") audio.resume();
    const osc = audio.createOscillator(), amp = audio.createGain();
    osc.type = type; osc.frequency.setValueAtTime(frequency, audio.currentTime);
    osc.frequency.exponentialRampToValueAtTime(Math.max(35, frequency * .55), audio.currentTime + duration);
    amp.gain.setValueAtTime(gain * Number(volume.value) / 100, audio.currentTime);
    amp.gain.exponentialRampToValueAtTime(.001, audio.currentTime + duration);
    osc.connect(amp).connect(audio.destination);
    osc.start(); osc.stop(audio.currentTime + duration);
  } catch {}
}
let audio, run, rooms = new Map(), keys = Object.create(null);
let yaw = 0, pitch = 0, last = performance.now(), noticeUntil = 0;

const ENTITIES = {
  Rush: {
    floors: ["Hotel"], trigger: "seeded eligible door after room 3",
    warning: "flickering lamps, subtitle, low tone",
    ai: "one fast pass along the corridor",
    sight: "detects exposed player near its passing position",
    avoidance: "enter a wardrobe before the pass",
    damage: 100, despawn: "after passing the occupied room",
    special: "does not start without a generated closet"
  },
  Ambush: {
    floors: ["Hotel"], trigger: "rare seeded eligible door after room 5",
    warning: "green flicker, subtitle, rising tone",
    ai: "three alternating corridor passes with pauses",
    sight: "detects exposed player near each pass",
    avoidance: "time exits and re-entry between passes",
    damage: 100, despawn: "after the third pass",
    special: "Hide still limits continuous wardrobe use"
  },
  Hide: {
    floors: ["Hotel"], trigger: "remaining hidden too long",
    warning: "red vignette and GET OUT subtitle",
    ai: "wardrobe timer", sight: "not applicable",
    avoidance: "leave and re-enter when safe",
    damage: 40, despawn: "after ejection",
    special: "temporarily blocks re-entry"
  },
  Screech: {
    floors: ["Hotel"], trigger: "seeded dark-room encounter",
    warning: "psst subtitle and sound",
    ai: "hovers near the camera until looked at or its timer ends",
    sight: "actual camera-forward dot product",
    avoidance: "look directly at it or hide",
    damage: 40, despawn: "on look, hiding, or attack",
    special: "never starts while Rush or Ambush is active"
  }
};
window.thresholdEntityRegistry = ENTITIES;

function say(s, seconds = 3) {
  message.textContent = s;
  noticeUntil = performance.now() + seconds * 1000;
}
function currentRoom() {
  return Math.max(0, Math.floor((camera.position.z + 10) / 20));
}
function dark(i) { return rooms.get(i)?.dark; }
function roomIndexAt(z) { return Math.max(0, Math.floor((z + 10) / 20)); }
function updateStats() {
  stats.innerHTML = `Door ${Math.max(0, currentRoom())} · Health ${run.health}/100<br>` +
    `Gold ${run.gold} · Keys ${run.keys} · Seed ${run.seed.replaceAll("<", "&lt;")}`;
}
function makeRoom(i) {
  if (rooms.has(i)) return rooms.get(i);
  const rand = rngFor(i), group = new THREE.Group(), z = i * 20;
  const type = ["hall", "lounge", "study", "gallery"][Math.floor(rand() * 4)];
  const isDark = i > 1 && rand() < .22;
  const locked = i > 2 && rand() < .23;
  const room = { i, z, group, type, dark: isDark, locked, open: false,
    objects: [], lamp: null, lightBase: isDark ? .065 : 1.25 };
  scene.add(group); rooms.set(i, room);

  block(group, mats.floor, 0, -.18, z, 10, .35, 20);
  block(group, mats.carpet, 0, .015, z, 3.3, .025, 18);
  block(group, mats.ceiling, 0, 4.45, z, 10, .35, 20);
  for (const side of [-1, 1]) {
    block(group, mats.wall, side * 5, 2.15, z, .32, 4.35, 20);
    block(group, mats.trim, side * 4.79, .48, z, .09, .3, 20);
  }
  for (const edge of [-1, 1]) {
    if (i === 0 && edge === -1) {
      block(group, mats.wall, 0, 2.15, z - 10, 10, 4.35, .3);
    } else {
      block(group, mats.wall, -3.05, 2.15, z + edge * 10, 3.9, 4.35, .3);
      block(group, mats.wall, 3.05, 2.15, z + edge * 10, 3.9, 4.35, .3);
      block(group, mats.wall, 0, 3.6, z + edge * 10, 2.2, 1.45, .3);
    }
  }

  const lamp = new THREE.PointLight(isDark ? 0x695d7c : 0xffd59b, room.lightBase, 13);
  lamp.position.set(0, 3.9, z);
  lamp.castShadow = quality.value === "high" && i % 2 === 0;
  lamp.shadow.mapSize.set(256, 256);
  group.add(lamp); room.lamp = lamp;
  block(group, mats.gold, 0, 4.19, z, 1.1, .08, .9);

  // Two reachable wardrobes per room; the middle of the hall remains clear.
  for (const [side, offset] of [[-1, -4], [1, 3.8]]) {
    const x = side * 4.14, cz = z + offset;
    block(group, mats.darkWood, x, 1.45, cz, 1.45, 2.9, 1.4);
    block(group, mats.wood, x - side * .5, 1.4, cz, .12, 2.5, 1.24);
    block(group, mats.gold, x - side * .6, 1.4, cz + .37, .055, .1, .055);
    room.objects.push({ kind: "closet", x: x - side * .85, z: cz, room: i });
  }

  if (type === "lounge" || type === "study") {
    for (const side of [-1, 1]) {
      const x = side * 3.25, cz = z + (type === "study" ? -1 : 1);
      block(group, mats.wood, x, .82, cz, 1.55, .18, 1.1);
      for (const dx of [-.58, .58])
        block(group, mats.darkWood, x + dx, .39, cz, .13, .75, .13);
      room.objects.push({ kind: "drawer", x: x - side * .35, z: cz,
        room: i, searched: false, value: rand() < .6 ? 5 : 10 });
    }
  }
  if (type === "gallery") {
    for (const side of [-1, 1]) {
      const art = block(group, mats.darkWood, side * 4.78, 2.3, z + 1,
        .11, 1.35, 1.5);
      art.material = new THREE.MeshStandardMaterial({
        color: rand() < .5 ? 0x86614c : 0x576675
      });
    }
  }

  // Gold and keys have deterministic positions and cannot block the corridor.
  if (i > 0 && rand() < .78) {
    const value = rand() < .65 ? 5 : 10;
    addPickup(room, "coin", (rand() < .5 ? -1 : 1) * 2.2,
      z + (rand() * 10 - 5), value);
  }
  if (locked) addPickup(room, "key", -2.05, z + 5.1, 1);

  const dz = z + 9.84;
  const door = block(group, mats.wood, 0, 1.45, dz, 2.12, 2.9, .16);
  block(door, mats.gold, .79, -.08, -.6, .09, .11, .09);
  text(group, String(i + 1).padStart(3, "0"), 0, 3.45, dz - .05, 75);
  room.door = door;
  room.objects.push({ kind: "door", x: 0, z: dz - .85, room: i });

  return room;
}
function addPickup(room, kind, x, z, value) {
  const mesh = new THREE.Mesh(kind === "coin" ? coinGeo : box,
    kind === "coin" ? mats.gold : mats.key);
  mesh.scale.set(kind === "coin" ? 1 : .3, kind === "coin" ? 1 : .1,
    kind === "coin" ? 1 : .1);
  mesh.rotation.z = kind === "coin" ? Math.PI / 2 : 0;
  mesh.position.set(x, .48, z);
  mesh.castShadow = true;
  room.group.add(mesh);
  room.objects.push({ kind, x, z, value, mesh, room: room.i });
}
function visibleObject() {
  if (run.hidden) return { kind: "exit" };
  const p = camera.position, forward = new THREE.Vector3();
  camera.getWorldDirection(forward);
  let best = null, bestDistance = 2.6;
  for (const idx of [currentRoom() - 1, currentRoom(), currentRoom() + 1]) {
    const room = rooms.get(idx);
    if (!room) continue;
    for (const o of room.objects) {
      if (o.taken || o.searched || (o.kind === "door" && room.open)) continue;
      const v = new THREE.Vector3(o.x - p.x, 0, o.z - p.z);
      const dist = v.length();
      if (dist < bestDistance && (dist < .95 ||
          forward.x * v.x / Math.max(.01, dist) +
          forward.z * v.z / Math.max(.01, dist) > .36)) {
        best = o; bestDistance = dist;
      }
    }
  }
  return best;
}
function interact() {
  if (!run?.started || run.paused || run.dead) return;
  if (run.hidden) {
    run.hidden = null; run.hideTime = 0;
    say("You leave the wardrobe.", 1.2); tone(180);
    return;
  }
  const o = visibleObject();
  if (!o) return;
  const room = rooms.get(o.room);
  if (o.kind === "closet") {
    if (run.hideBlock > 0) { say("Something stops you from hiding."); return; }
    run.hidden = o; run.hideTime = 0;
    run.preHide.set(camera.position.x, camera.position.y, camera.position.z);
    camera.position.set(o.x + (o.x < 0 ? .23 : -.23), 1.62, o.z);
    say("Inside wardrobe · E to leave", 2);
    tone(120, .25);
    if (run.screech) clearScreech("It slips away.");
  } else if (o.kind === "door") {
    if (room.locked) {
      if (!run.keys) { say("Locked. Find the key in this room."); tone(80); return; }
      run.keys--; room.locked = false;
    }
    room.open = true;
    room.door.visible = false;
    makeRoom(o.room + 1);
    tone(310, .28, "triangle");
    say(`Door ${String(o.room + 1).padStart(3, "0")} opens.`, 1.5);
    scheduleEncounter(o.room + 1);
  } else if (o.kind === "drawer") {
    o.searched = true; run.gold += o.value;
    say(`Drawer: +${o.value} gold`); tone(600);
  } else if (o.kind === "coin" || o.kind === "key") {
    o.taken = true; room.group.remove(o.mesh);
    if (o.kind === "coin") { run.gold += o.value; say(`+${o.value} gold`, 1.4); }
    else { run.keys++; say("Found a door key.", 1.6); }
    tone(o.kind === "coin" ? 790 : 530);
  }
  updateStats();
}
function scheduleEncounter(i) {
  if (i < 4 || run.threat || run.screech) return;
  const r = rngFor(10000 + i)();
  const type = i >= 6 && r < .12 ? "Ambush" : r < .43 ? "Rush" : null;
  if (!type || i - run.lastThreat < 2) return;
  run.lastThreat = i;
  run.threat = {
    type, room: i, warning: 3.8, elapsed: 0,
    passes: type === "Ambush" ? 3 : 1, completed: 0, phase: "warning"
  };
  say(type === "Ambush"
    ? "GREEN FLICKER — something may return. Find a wardrobe!"
    : "THE LIGHTS FLICKER — find a wardrobe!", 3.8);
  tone(type === "Ambush" ? 340 : 95, .75, "sawtooth", .2);
}
function clearScreech(msg) {
  if (!run.screech) return;
  scene.remove(run.screech.mesh);
  run.screech = null;
  if (msg) say(msg, 1.4);
}
function spawnScreech() {
  if (run.screech || run.threat || run.hidden || !dark(currentRoom())) return;
  const dir = new THREE.Vector3();
  camera.getWorldDirection(dir);
  const angle = rngFor(40000 + currentRoom())() < .5 ? -.72 : .72;
  const offset = dir.clone().setY(0).normalize()
    .applyAxisAngle(new THREE.Vector3(0, 1, 0), angle).multiplyScalar(2.25);
  const mesh = new THREE.Group();
  const head = new THREE.Mesh(new THREE.SphereGeometry(.28, 12, 10), mats.black);
  mesh.add(head);
  for (const x of [-.11, .11]) {
    const eye = new THREE.Mesh(new THREE.SphereGeometry(.035, 8, 6), mats.eye);
    eye.position.set(x, .045, -.255); mesh.add(eye);
  }
  mesh.position.copy(camera.position).add(offset);
  mesh.position.y = 1.75;
  // Eyes face approximately toward the player.
  mesh.lookAt(camera.position);
  scene.add(mesh);
  run.screech = { mesh, time: 4.1 };
  say("Psst! Look for it!", 2.4);
  tone(950, .3, "triangle", .24);
}
function hurt(amount, reason) {
  run.health = Math.max(0, run.health - amount);
  updateStats();
  tone(65, .6, "sawtooth", .32);
  say(reason, 3);
  if (run.health === 0) {
    run.dead = true; run.paused = true;
    document.exitPointerLock?.();
    title.textContent = "Run ended";
    description.textContent = `${reason} You reached Door ${currentRoom()} with ${run.gold} gold. Seed: ${run.seed}`;
    $("start").classList.add("hidden");
    $("resume").classList.add("hidden");
    $("restart").classList.remove("hidden");
    overlay.classList.remove("hidden");
  }
}
function start() {
  for (const room of rooms.values()) scene.remove(room.group);
  if (run?.threatMesh) scene.remove(run.threatMesh);
  if (run?.screech) scene.remove(run.screech.mesh);
  rooms = new Map();
  const seed = seedInput.value.trim() || "NIGHT-17";
  localStorage.setItem("threshold-seed", seed);
  run = {
    started: true, paused: false, dead: false, seed,
    health: 100, gold: 0, keys: 0, hidden: null, hideTime: 0,
    hideBlock: 0, preHide: new THREE.Vector3(),
    threat: null, threatMesh: null, screech: null,
    lastThreat: -10, screechChecked: new Set()
  };
  yaw = 0; pitch = 0;
  camera.position.set(0, 1.65, -6);
  camera.rotation.order = "YXZ";
  camera.rotation.set(0, 0, 0);
  makeRoom(0);
  overlay.classList.add("hidden"); hud.classList.remove("hidden");
  updateStats();
  say("Open Door 001. Search the rooms and listen for warnings.", 5);
  renderer.domElement.requestPointerLock?.();
}
function pause() {
  if (!run?.started || run.dead) return;
  run.paused = true;
  title.textContent = "Paused";
  description.textContent = `Seed ${run.seed} · Door ${currentRoom()} · ${run.gold} gold`;
  $("start").classList.add("hidden");
  $("restart").classList.remove("hidden");
  $("resume").classList.remove("hidden");
  overlay.classList.remove("hidden");
}
function resume() {
  if (!run || run.dead) return;
  run.paused = false;
  overlay.classList.add("hidden");
  renderer.domElement.requestPointerLock?.();
}
$("start").onclick = start;
$("restart").onclick = start;
$("resume").onclick = resume;
$("volume").oninput = () => $("volumeValue").textContent = `${volume.value}%`;
$("quality").onchange = () => {
  renderer.shadowMap.enabled = quality.value === "high";
  renderer.setPixelRatio(Math.min(devicePixelRatio, quality.value === "high" ? 1.5 : 1));
  for (const room of rooms.values())
    room.lamp.castShadow = quality.value === "high" && room.i % 2 === 0;
};
renderer.domElement.onclick = () => {
  if (run?.started && !run.paused && !run.dead && document.pointerLockElement !== renderer.domElement)
    renderer.domElement.requestPointerLock?.();
};
document.addEventListener("pointerlockchange", () => {
  if (run?.started && !run.paused && !run.dead &&
      document.pointerLockElement !== renderer.domElement) pause();
});
document.addEventListener("mousemove", e => {
  if (document.pointerLockElement !== renderer.domElement || run?.paused) return;
  yaw -= e.movementX * .0022;
  pitch = THREE.MathUtils.clamp(pitch - e.movementY * .0022, -1.35, 1.35);
});
document.addEventListener("keydown", e => {
  if (["KeyW","KeyA","KeyS","KeyD","KeyE","KeyC","ShiftLeft",
       "ArrowLeft","ArrowRight","ArrowUp","ArrowDown","Space"].includes(e.code))
    e.preventDefault();
  keys[e.code] = true;
  if (e.code === "KeyE" && !e.repeat) interact();
  if (e.code === "Escape" && run?.started && !run.paused) pause();
});
document.addEventListener("keyup", e => { keys[e.code] = false; });
window.addEventListener("blur", () => { if (run?.started && !run.paused) pause(); });

function advanceThreat(dt, now) {
  const t = run.threat;
  if (!t) return;
  const lamp = rooms.get(t.room)?.lamp;
  if (lamp) lamp.intensity = Math.sin(now * .035) > .1 ? .06 : 1.8;
  if (t.phase === "warning") {
    t.warning -= dt;
    if (t.warning > 0) return;
    t.phase = "moving"; t.elapsed = 0;
    const mesh = new THREE.Group();
    const body = new THREE.Mesh(sphere, t.type === "Ambush" ? mats.ambush : mats.rush);
    body.scale.set(.8, .85, .5); mesh.add(body);
    for (const x of [-.25, .25]) {
      const eye = new THREE.Mesh(sphere, mats.eye);
      eye.position.set(x, .16, -.43); eye.scale.set(.105, .13, .04); mesh.add(eye);
    }
    const glow = new THREE.PointLight(t.type === "Ambush" ? 0x39efad : 0x967ab1, 2.2, 9);
    mesh.add(glow);
    scene.add(mesh); run.threatMesh = mesh;
    tone(t.type === "Ambush" ? 240 : 115, 1, "sawtooth", .29);
  }
  if (t.phase === "moving") {
    t.elapsed += dt;
    const fraction = Math.min(1, t.elapsed / 2.65);
    const forward = t.completed % 2 === 0;
    const z = t.room * 20 + (forward ? -11 + 26 * fraction : 15 - 26 * fraction);
    run.threatMesh.position.set(0, 1.75, z);
    run.threatMesh.rotation.y = forward ? Math.PI : 0;
    // Corridor line-of-sight approximation: wardrobe is full cover;
    // substantial distance or a side alcove also avoids the passing hitbox.
    const exposed = !run.hidden && Math.abs(camera.position.x) < 2.75 &&
      Math.abs(camera.position.z - z) < 1.25 &&
      Math.abs(roomIndexAt(camera.position.z) - t.room) <= 1;
    if (exposed) { hurt(100, `${t.type} caught you in the corridor.`); }
    if (fraction >= 1) {
      t.completed++;
      if (t.completed >= t.passes) {
        scene.remove(run.threatMesh); run.threatMesh = null;
        run.threat = null;
        if (lamp) lamp.intensity = .24;
        if (!run.dead) say(`${t.type} has passed.`, 1.6);
      } else {
        t.phase = "pause"; t.elapsed = .95;
        say("It is coming back! Time your hiding.", 1.6);
      }
    }
  } else if (t.phase === "pause") {
    t.elapsed -= dt;
    if (t.elapsed <= 0) {
      t.phase = "moving"; t.elapsed = 0;
      tone(220, .55, "sawtooth", .23);
    }
  }
}
function tick(dt, now) {
  if (!run?.started || run.paused || run.dead) return;
  if (keys.ArrowLeft) yaw += dt * 1.9;
  if (keys.ArrowRight) yaw -= dt * 1.9;
  if (keys.ArrowUp) pitch = Math.min(1.35, pitch + dt * 1.4);
  if (keys.ArrowDown) pitch = Math.max(-1.35, pitch - dt * 1.4);
  camera.rotation.set(pitch, yaw, 0);
  run.hideBlock = Math.max(0, run.hideBlock - dt);

  if (!run.hidden) {
    const forward = (keys.KeyW ? 1 : 0) - (keys.KeyS ? 1 : 0);
    const strafe = (keys.KeyD ? 1 : 0) - (keys.KeyA ? 1 : 0);
    const length = Math.hypot(forward, strafe) || 1;
    const crouched = !!keys.KeyC;
    const speed = crouched ? 1.9 : keys.ShiftLeft ? 6 : 3.65;
    const nx = camera.position.x +
      ((-Math.sin(yaw) * forward + Math.cos(yaw) * strafe) / length) * dt * speed;
    const nz = camera.position.z +
      ((Math.cos(yaw) * forward + Math.sin(yaw) * strafe) / length) * dt * speed;
    const oldRoom = currentRoom();
    const boundary = oldRoom * 20 + 9.6;
    camera.position.x = THREE.MathUtils.clamp(nx, -4.46, 4.46);
    // The door gap admits only a centered player and only after opening.
    if (nz > boundary && (!rooms.get(oldRoom)?.open || Math.abs(camera.position.x) > .83))
      camera.position.z = boundary;
    else if (nz < oldRoom * 20 - 9.55 &&
      (oldRoom === 0 || Math.abs(camera.position.x) > .83))
      camera.position.z = oldRoom * 20 - 9.55;
    else camera.position.z = nz;
    camera.position.y += ((crouched ? 1.05 : 1.65) - camera.position.y) * Math.min(1, dt * 12);
  } else {
    run.hideTime += dt;
    if (run.hideTime > 9) {
      danger.style.opacity = String(Math.min(.7, (run.hideTime - 9) / 5));
      if (run.hideTime < 11.7) message.textContent = "GET OUT";
    }
    if (run.hideTime >= 12.5) {
      run.hidden = null; run.hideTime = 0; run.hideBlock = 7;
      camera.position.copy(run.preHide);
      hurt(40, "Hide forced you out. Wardrobes are briefly unavailable.");
    }
  }
  if (!run.hidden) danger.style.opacity = "0";

  const i = currentRoom();
  if (rooms.has(i) && rooms.get(i).dark && !run.screechChecked.has(i) &&
      !run.threat && i > 1) {
    run.screechChecked.add(i);
    if (rngFor(20000 + i)() < .75) spawnScreech();
  }
  if (run.screech) {
    const s = run.screech, dir = new THREE.Vector3(), target = new THREE.Vector3();
    camera.getWorldDirection(dir);
    target.subVectors(s.mesh.position, camera.position).normalize();
    s.mesh.lookAt(camera.position);
    if (run.hidden || dir.dot(target) > .965) {
      clearScreech("You stared it down.");
      tone(1200, .25, "triangle");
    } else {
      s.time -= dt;
      if (s.time <= 0) {
        clearScreech();
        hurt(40, "Screech bit you. Turn toward the 'psst' next time.");
      }
    }
  }
  advanceThreat(dt, now);
  for (const room of rooms.values())
    for (const o of room.objects)
      if (o.mesh && !o.taken) o.mesh.rotation.y += dt * .8;

  const o = visibleObject();
  prompt.textContent = run.hidden ? "E · Leave wardrobe" :
    o?.kind === "door" ? `E · ${rooms.get(o.room).locked ? "Unlock" : "Open"} Door ${String(o.room + 1).padStart(3, "0")}` :
    o?.kind === "closet" ? "E · Hide in wardrobe" :
    o?.kind === "drawer" ? "E · Search drawer" :
    o?.kind === "key" ? "E · Take key" :
    o?.kind === "coin" ? `E · Take ${o.value} gold` : "";
  if (performance.now() > noticeUntil && !run.hidden) message.textContent = "";
}
function frame(now) {
  const dt = Math.min(.05, (now - last) / 1000);
  last = now;
  tick(dt, now);
  renderer.render(scene, camera);
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);
window.addEventListener("resize", () => {
  camera.aspect = innerWidth / innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(innerWidth, innerHeight);
});
