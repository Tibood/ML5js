// ── nn.js — Réseau de neurones via TF.js (bundlé dans ML5.js v1) ─────────────
//
// API publique : predict(), copy(), mutate(), crossover(), serialize(), deserialize()
//
// TF.js est exposé via window.tf = ml5.tf (défini dans index.html).
// On utilise tf.sequential() directement, sans passer par ml5.neuralNetwork(),
// afin d'éviter les problèmes d'initialisation asynchrone de ML5.
//
// Architecture : [inputs → dense(relu) → dense(sigmoid, 1 sortie)]
// Nota : tf.ready() doit être attendu AVANT de créer le premier NeuralNetwork.

class NeuralNetwork {
    /**
     * @param {number[]} topology  - [inputs, hiddenSize, 1]
     * @param {string}   activation - conservé pour sérialisation (relu/sigmoid implicites)
     */
    constructor(topology, activation = 'sigmoid') {
        this.topology = topology.slice();
        this.activation = activation;
        this._model = this._buildModel();
        this._syncCache(); // cache JS des poids pour le forward-pass rapide
    }

    _buildModel() {
        const inputSize = this.topology[0];
        const hiddenSize = this.topology.length > 2 ? this.topology[1] : 8;

        const model = tf.sequential();
        model.add(tf.layers.dense({
            units: hiddenSize,
            inputShape: [inputSize],
            activation: 'relu',
            kernelInitializer: 'glorotUniform',
            biasInitializer: 'zeros',
        }));
        model.add(tf.layers.dense({
            units: 1,
            activation: 'sigmoid',
            kernelInitializer: 'glorotUniform',
            biasInitializer: 'zeros',
        }));
        return model;
    }

    // ── Inférence synchrone ───────────────────────────────────────────────────

    predict(inputs) {
        return tf.tidy(() => {
            const t = tf.tensor2d([inputs]);
            return Array.from(this._model.predict(t).dataSync());
        });
    }

    // ── Poids ─────────────────────────────────────────────────────────────────

    _weightsToArrays() {
        return this._model.getWeights().map(w => ({
            shape: w.shape,
            data: Array.from(w.dataSync()),
        }));
    }

    _setWeightsFromArrays(arr) {
        const tensors = arr.map(({ shape, data }) => tf.tensor(data, shape));
        this._model.setWeights(tensors);
        tensors.forEach(t => t.dispose());
        this._syncCache();
    }

    // ── Cache JS des poids pour inférence sans TF.js ──────────────────────────
    // Structure : [W1 (in×hid), b1 (hid), W2 (hid×1), b2 (1)]

    _syncCache() {
        const w = this._model.getWeights();
        this._W1 = Array.from(w[0].dataSync()); // [inputSize × hiddenSize]
        this._b1 = Array.from(w[1].dataSync()); // [hiddenSize]
        this._W2 = Array.from(w[2].dataSync()); // [hiddenSize × 1]
        this._b2 = Array.from(w[3].dataSync()); // [1]
    }

    // ── Inférence rapide 100% JS (aucun tensor, aucun dataSync) ───────────────
    // À utiliser dans la boucle d'entraînement à la place de predict().

    predictFast(inputs) {
        const hid = this._b1.length;
        const hidden = new Float32Array(hid);
        for (let j = 0; j < hid; j++) {
            let s = this._b1[j];
            for (let i = 0; i < inputs.length; i++) s += inputs[i] * this._W1[i * hid + j];
            hidden[j] = s > 0 ? s : 0; // relu
        }
        let out = this._b2[0];
        for (let j = 0; j < hid; j++) out += hidden[j] * this._W2[j];
        return 1 / (1 + Math.exp(-out)); // sigmoid
    }

    // ── Copie exacte ─────────────────────────────────────────────────────────

    copy() {
        const nn = new NeuralNetwork(this.topology, this.activation);
        nn._setWeightsFromArrays(this._weightsToArrays());
        return nn;
    }

    // ── Mutation gaussienne sur place ─────────────────────────────────────────

    mutate(rate = 0.1, magnitude = 0.3) {
        const arr = this._weightsToArrays();
        const mutated = arr.map(({ shape, data }) => ({
            shape,
            data: data.map(v => {
                if (Math.random() < rate) {
                    const noise = (Math.random() + Math.random() + Math.random() - 1.5) * magnitude;
                    return Math.max(-6, Math.min(6, v + noise));
                }
                return v;
            }),
        }));
        this._setWeightsFromArrays(mutated);
        return this;
    }

    // ── Croisement uniforme ───────────────────────────────────────────────────

    crossover(other) {
        const child = new NeuralNetwork(this.topology, this.activation);
        const wA = this._weightsToArrays();
        const wB = other._weightsToArrays();
        const wC = wA.map(({ shape, data }, i) => ({
            shape,
            data: data.map((v, j) => Math.random() < 0.5 ? v : wB[i].data[j]),
        }));
        child._setWeightsFromArrays(wC);
        return child;
    }

    // ── Sérialisation ─────────────────────────────────────────────────────────

    serialize() {
        return JSON.stringify({
            topology: this.topology,
            activation: this.activation,
            weights: this._weightsToArrays(),
        });
    }

    static deserialize(data) {
        const d = typeof data === 'string' ? JSON.parse(data) : data;
        const nn = new NeuralNetwork(d.topology, d.activation);
        if (d.weights && d.weights[0] && !d.weights[0].shape) {
            // Ancien format vanilla JS (matrices 2D) — ignoré, poids aléatoires
            console.warn('Cerveau ancien format ignoré, poids réinitialisés.');
        } else if (d.weights) {
            nn._setWeightsFromArrays(d.weights);
        }
        return nn;
    }
}
