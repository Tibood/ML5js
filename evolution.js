// ── evolution.js — Algorithme neuro-évolutif ──────────────────────────────────
//
// Implémente un algorithme génétique (GA) pour entraîner les agents :
//
//  1. INITIALISATION  – population de N cerveaux aléatoires
//  2. ÉVALUATION      – chaque agent joue jusqu'à sa mort, accumule un score
//  3. SÉLECTION       – élitisme + sélection par tournoi
//  4. REPRODUCTION    – croisement uniforme + mutation gaussienne
//  5. RETOUR en 2 jusqu'à la condition d'arrêt
//
// ── Condition d'arrêt ────────────────────────────────────────────────────────
//
//  L'entraînement s'arrête automatiquement quand 60 % des agents d'une
//  génération atteignent une fitness ≥ stopThreshold défini par l'utilisateur.
//
// ── Topologie du réseau ──────────────────────────────────────────────────────
//
//  [inputCount, hiddenSize × hiddenLayers, 1]
//
//  Exemple : inputCount=6, hiddenLayers=2, hiddenSize=8  → [6, 8, 8, 1]

class Evolution {
    constructor() {
        this.agents = [];
        this.generation = 0;
        this.bestBrain = null;
        this.bestFitness = 0;
        this.history = []; // [{gen, best, avg}] – courbe d'apprentissage
    }

    // ── Initialisation ────────────────────────────────────────────────────────

    init(config) {
        this.agents = [];
        const topo = buildTopology(config);
        for (let i = 0; i < config.popSize; i++) {
            const brain = new NeuralNetwork(topo, config.activation);
            // Couleur arc-en-ciel distribuée sur l'angle d'or pour diversité maximale
            const col = hueToRgb((i * 137.508) % 360);
            this.agents.push(new Agent(brain, col));
        }
    }

    // ── Accesseurs ────────────────────────────────────────────────────────────

    get aliveCount() {
        return this.agents.filter(a => a.alive).length;
    }

    get avgFitness() {
        if (!this.agents.length) return 0;
        return this.agents.reduce((s, a) => s + a.fitness, 0) / this.agents.length;
    }

    get currentBestFitness() {
        if (!this.agents.length) return 0;
        return Math.max(...this.agents.map(a => a.fitness));
    }

    /** Ratio d'agents ayant atteint le seuil d'arrêt (0–1) */
    stopRatio(config) {
        if (!this.agents.length) return 0;
        const n = this.agents.filter(a => a.fitness >= config.stopThreshold).length;
        return n / this.agents.length;
    }

    /** true si la condition d'arrêt est remplie (60 % ≥ seuil) */
    shouldStop(config) {
        return this.stopRatio(config) >= 0.6;
    }

    // ── Passage à la génération suivante ──────────────────────────────────────

    nextGeneration(config) {
        // Trier par fitness décroissante
        this.agents.sort((a, b) => b.fitness - a.fitness);

        // Mise à jour du meilleur cerveau global
        if (this.agents[0].fitness > this.bestFitness) {
            this.bestFitness = this.agents[0].fitness;
            this.bestBrain = this.agents[0].brain.copy();
        }

        // Historique
        this.history.push({
            gen: this.generation,
            best: this.agents[0].fitness,
            avg: this.avgFitness,
        });
        if (this.history.length > 200) this.history.shift(); // limiter la taille

        this.generation++;

        // ── Nouvelle population ──────────────────────────────────────────────
        const topo = buildTopology(config);
        const eliteN = Math.max(2, Math.floor(config.popSize * 0.1));
        const newAgents = [];

        // Élites : survivent inchangées
        for (let i = 0; i < eliteN; i++) {
            const col = hueToRgb((i * 137.508) % 360);
            newAgents.push(new Agent(this.agents[i].brain.copy(), col));
        }

        // Enfants par sélection tournoi + croisement + mutation
        while (newAgents.length < config.popSize) {
            const parentA = this._tournament(3);
            const parentB = this._tournament(3);
            let childBrain;

            if (Math.random() < 0.75) {
                childBrain = parentA.brain.crossover(parentB.brain);
            } else {
                // Clonage simple (mutation seulement)
                childBrain = parentA.brain.copy();
            }

            childBrain.mutate(config.mutationRate / 100, 0.3);
            const col = hueToRgb((newAgents.length * 137.508) % 360);
            newAgents.push(new Agent(childBrain, col));
        }

        this.agents = newAgents;
    }

    // Sélection par tournoi (k candidats, retourne le meilleur)
    _tournament(k = 3) {
        let best = null;
        for (let i = 0; i < k; i++) {
            const c = this.agents[Math.floor(Math.random() * this.agents.length)];
            if (!best || c.fitness > best.fitness) best = c;
        }
        return best;
    }
}

// ── Helpers ───────────────────────────────────────────────────────────────────

/**
 * Construit le tableau de topologie à partir de la config UI.
 * @param {object} config - { inputCount, hiddenLayers, hiddenSize }
 */
function buildTopology(config) {
    // ML5.js ne supporte qu'une couche cachée via hiddenUnits
    return [config.inputCount, config.hiddenSize, 1];
}

/**
 * Convertit une teinte HSV → RGB [0–255].
 * s et v sont dans [0, 1].
 */
function hueToRgb(h, s = 0.82, v = 1.0) {
    h = ((h % 360) + 360) % 360;
    const c = v * s;
    const x = c * (1 - Math.abs((h / 60) % 2 - 1));
    const m = v - c;
    let r, g, b;
    if (h < 60) { r = c; g = x; b = 0; }
    else if (h < 120) { r = x; g = c; b = 0; }
    else if (h < 180) { r = 0; g = c; b = x; }
    else if (h < 240) { r = 0; g = x; b = c; }
    else if (h < 300) { r = x; g = 0; b = c; }
    else { r = c; g = 0; b = x; }
    return [Math.round((r + m) * 255), Math.round((g + m) * 255), Math.round((b + m) * 255)];
}

// Palettes de couleurs pour le mode compétition
const COMPETE_COLORS = [
    [255, 80, 80],   // rouge
    [80, 210, 80],   // vert
    [80, 150, 255],   // bleu
    [255, 200, 60],   // jaune
    [255, 80, 220],   // rose
    [60, 230, 210],   // cyan
    [200, 80, 255],   // violet
    [255, 150, 60],   // orange
];
