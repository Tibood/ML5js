// ── sketch.js — Orchestrateur principal ─────────────────────────────────────
//
// Modes de jeu :
//   'title'   – écran titre
//   'play'    – joueur humain
//   'train'   – entraînement neuro-évolutif (population d'agents)
//   'demo'    – observation du meilleur cerveau
//   'compete' – compétition entre cerveaux sauvegardés

// ── Constantes physiques ──────────────────────────────────────────────────────
const W = 800;
const H = 400;
const GROUND = 330;
const GRAVITY = 0.52;
const THRUST = 0.75;
const MAX_VY = -9;

// ── État partagé du jeu ───────────────────────────────────────────────────────
let player, obstacles, particles;
let score, speed, spawnCD, state;
let bgStars = [], bgBuilds = [];
let canvasFocused = false;

// ── Modes & objets IA ────────────────────────────────────────────────────────
let mode = 'title';
let evolution = null;
let trainingActive = false;
let demoBrain = null;
let demoAgent = null;
let competeAgents = [];

// ─ Lifecycle p5 ───────────────────────────────────────────────────────────────

function setup() {
    const cnv = createCanvas(W, H);
    cnv.parent('canvas-container');
    // Rendre le canvas focusable et gérer le focus
    const el = cnv.elt;
    el.setAttribute('tabindex', '0');
    el.style.outline = 'none';
    el.addEventListener('mousedown', () => { el.focus(); canvasFocused = true; });
    el.addEventListener('focus', () => { canvasFocused = true; });
    el.addEventListener('blur', () => { canvasFocused = false; });
    textFont('monospace');
    initBg();
    initUI();
    setMode('title');
}

function draw() {
    switch (mode) {
        case 'title': drawTitle(); break;
        case 'play': drawPlayFrame(); break;
        case 'train': drawTrainFrame(); break;
        case 'demo': drawDemoFrame(); break;
        case 'compete': drawCompeteFrame(); break;
    }
    if (frameCount % 8 === 0) updateStats();
}

// ─ Changement de mode ─────────────────────────────────────────────────────────

function setMode(m) {
    mode = m;
    if (m === 'play') {
        resetHumanGame();
    } else if (m === 'demo') {
        _resetShared();
        const brain = demoBrain || (evolution && evolution.bestBrain) || null;
        demoAgent = brain ? new Agent(brain.copy()) : null;
    } else if (m === 'compete') {
        _startCompete();
    }
    updateStats();
}

// ─ Frames ─────────────────────────────────────────────────────────────────────

function drawTitle() {
    updateBg();
    drawBg();
    fill(255, 255, 255, 230);
    textAlign(CENTER, CENTER);
    textSize(44);
    text('JETPACK RUNNER', W / 2, H / 2 - 70);
    fill(170, 215, 255);
    textSize(17);
    text('IA Neuro-évolutive', W / 2, H / 2 - 25);
    textAlign(LEFT, BASELINE);
}

function drawPlayFrame() {
    if (state === 'over') { drawGameOver(); return; }
    const thrust = canvasFocused && (keyIsDown(32) || mouseIsPressed);
    updateBg();
    updatePlayer(thrust);
    if (state === 'over') return;
    updateObstacles(true);
    if (state === 'over') return;
    score++;
    speed = 4 + score * 0.0022;
    drawBg();
    for (const o of obstacles) drawObstacle(o);
    drawGround();
    for (const pt of particles) drawParticle(pt);
    drawPlayer(thrust);
    drawHud();
}

function drawTrainFrame() {
    if (!trainingActive || !evolution || !evolution.agents.length) {
        updateBg();
        drawBg();
        fill(200, 200, 200, 130);
        textAlign(CENTER, CENTER);
        textSize(16);
        text('Configurez le réseau et cliquez ▶ Lancer', W / 2, H / 2);
        textAlign(LEFT, BASELINE);
        return;
    }

    const anyAlive = evolution.agents.some(a => a.alive);
    if (!anyAlive) {
        if (evolution.shouldStop(uiConfig)) {
            trainingActive = false;
            demoBrain = evolution.bestBrain ? evolution.bestBrain.copy() : null;
            saveBestBrain(true); // sauvegarde automatique
        }
        evolution.nextGeneration(uiConfig);
        _resetShared();
        return;
    }

    updateBg();
    tickObstacles();
    score++;
    speed = 4 + score * 0.0022;

    // ── Inférence rapide JS pour tous les agents (zéro tensor, zéro dataSync) ─
    for (const a of evolution.agents) {
        if (!a.alive) continue;
        const sensors = a.getSensors(uiConfig.inputCount);
        a.applyOutput(a.brain.predictFast(sensors));
    }

    let bestAgent = null, bestFit = -1;
    for (const a of evolution.agents) {
        if (!a.alive) continue;
        a.tick();
        if (a.fitness > bestFit) { bestFit = a.fitness; bestAgent = a; }
    }

    drawBg();
    for (const o of obstacles) drawObstacle(o);
    drawGround();
    for (const a of evolution.agents) a.draw(a === bestAgent);
    drawTrainHud(evolution);
}

function drawDemoFrame() {
    if (!demoAgent) {
        background(18, 15, 38);
        fill(200);
        textAlign(CENTER, CENTER);
        textSize(15);
        text('Aucun cerveau disponible.', W / 2, H / 2 - 16);
        text('Entraînez d\'abord ou chargez un cerveau sauvegardé.', W / 2, H / 2 + 16);
        textAlign(LEFT, BASELINE);
        return;
    }
    if (!demoAgent.alive) { drawGameOver(); return; }

    updateBg();
    tickObstacles();
    score++;
    speed = 4 + score * 0.0022;
    demoAgent.update(uiConfig.inputCount);
    manageParticles(demoAgent.lastThrust, demoAgent.p.x, demoAgent.p.y, demoAgent.p.h);

    drawBg();
    for (const o of obstacles) drawObstacle(o);
    drawGround();
    for (const pt of particles) drawParticle(pt);
    drawPlayer(demoAgent.lastThrust, demoAgent.p);
    drawHud();
}

function drawCompeteFrame() {
    if (!competeAgents.length) {
        background(18, 15, 38);
        fill(200);
        textAlign(CENTER, CENTER);
        textSize(15);
        text('Sélectionnez des cerveaux (☑) dans la liste', W / 2, H / 2 - 16);
        text('puis activez le mode Compétition.', W / 2, H / 2 + 16);
        textAlign(LEFT, BASELINE);
        return;
    }
    const anyAlive = competeAgents.some(a => a.alive);
    if (!anyAlive) { drawCompeteOver(); return; }

    updateBg();
    tickObstacles();
    score++;
    speed = 4 + score * 0.0022;
    for (const a of competeAgents) a.update(a._inputCount || uiConfig.inputCount);

    drawBg();
    for (const o of obstacles) drawObstacle(o);
    drawGround();
    for (const a of competeAgents) a.draw(false);
    drawCompeteHud();
}

// ─ Reset helpers ──────────────────────────────────────────────────────────────

function resetHumanGame() {
    player = { x: 130, y: GROUND - 50, w: 28, h: 44, vy: 0, tick: 0 };
    obstacles = [];
    particles = [];
    score = 0;
    speed = 4;
    spawnCD = 80;
    state = 'play';
}

function _resetShared() {
    obstacles = [];
    particles = [];
    score = 0;
    speed = 4;
    spawnCD = 80;
}

// ─ Appelées par ui.js ─────────────────────────────────────────────────────────

async function startTraining() {
    // S'assurer que TF.js est prêt (WebGL de préférence, fallback CPU)
    await tf.setBackend('webgl').catch(() => tf.setBackend('cpu'));
    await tf.ready();
    // Warmup : force la compilation des shaders WebGL avant le 1er frame
    const _warmupNN = new NeuralNetwork(buildTopology(uiConfig));
    tf.tidy(() => _warmupNN._model.predict(tf.zeros([1, uiConfig.inputCount])));
    _warmupNN._model.dispose();
    if (!evolution) evolution = new Evolution();
    evolution.init(uiConfig);
    trainingActive = true;
    _resetShared();
    mode = 'train';
    updateStats();
}

function resetTraining() {
    trainingActive = false;
    evolution = new Evolution();
    _resetShared();
    updateStats();
}

function stopTraining() {
    trainingActive = false;
    updateStats();
}

function _startCompete() {
    if (!competeBrainKeys || !competeBrainKeys.length) { competeAgents = []; return; }
    _resetShared();
    competeAgents = competeBrainKeys.map((key, idx) => {
        const data = JSON.parse(localStorage.getItem(key));
        if (!data) return null;
        const brain = NeuralNetwork.deserialize(data.brain);
        const color = COMPETE_COLORS[idx % COMPETE_COLORS.length];
        const a = new Agent(brain, color);
        a._inputCount = data.inputCount || 6;
        return a;
    }).filter(Boolean);
}

// ─ Contrôles ──────────────────────────────────────────────────────────────────

function keyPressed() {
    // Empêcher le scroll de la page sur espace/flèches
    if ([' ', 'ArrowUp', 'ArrowDown'].includes(key)) return false;
    if (key === 'r' || key === 'R') {
        if (mode === 'play' && state === 'over') resetHumanGame();
        else if (mode === 'demo' && demoAgent && !demoAgent.alive) {
            _resetShared();
            const b = demoBrain || (evolution && evolution.bestBrain);
            demoAgent = b ? new Agent(b.copy()) : null;
        } else if (mode === 'compete') {
            _startCompete();
        }
    }
}

function mousePressed() {
    if (mode === 'play' && state === 'over') resetHumanGame();
    if (mode === 'demo' && demoAgent && !demoAgent.alive) {
        _resetShared();
        const b = demoBrain || (evolution && evolution.bestBrain);
        demoAgent = b ? new Agent(b.copy()) : null;
    }
    if (mode === 'compete' && !competeAgents.some(a => a.alive)) _startCompete();
}
