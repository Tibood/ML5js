// ── nn.js — Réseau de neurones via ML5.js v1 (neuralNetwork) ─────────────────
//
// API publique : predict(), copy(), mutate(), crossover(), serialize(), deserialize()
//
// Le réseau est créé via ml5.neuralNetwork() avec l'option noTraining:true,
// ce qui déclenche une initialisation synchrone du modèle TF.js sous-jacent.
// Les opérations génétiques (mutation, croisement) s'appuient sur les méthodes
// natives ml5 : nn.mutate() et nn.crossover().
// Le modèle TF.js est accessible via _ml5nn.neuralNetwork.model pour
// l'inférence rapide (predictFast) et la (dé)sérialisation des poids.
//
// Architecture : [inputs → dense(relu, hiddenUnits) → dense(sigmoid, 1 sortie)]
// Nota : tf.ready() doit être attendu AVANT de créer le premier NeuralNetwork.

class NeuralNetwork {
    /**
     * @param {number[]} topology  - [inputs, hiddenSize, 1]
     * @param {string}   activation - conservé pour sérialisation
     */
    constructor(topology, activation = 'sigmoid') {
        this.topology = topology.slice();
        this.activation = activation;
        const inputSize = topology[0];
        const hiddenSize = topology.length > 2 ? topology[1] : 8;

        // Création via ML5.js : noTraining:true = initialisation synchrone
        // En ML5 v1.3.1, createLayersNoTraining() doit être appelé explicitement
        this._ml5nn = ml5.neuralNetwork({
            inputs: inputSize,
            outputs: 1,
            task: 'regression',
            hiddenUnits: hiddenSize,
            noTraining: true,
        });
        this._ml5nn.createLayersNoTraining(); // construit le modèle TF.js synchroniquement

        // Modèle TF.js sous-jacent (couches déjà construites par ML5)
        this._model = this._ml5nn.neuralNetwork.model;
        this._syncCache(); // cache JS des poids pour le forward-pass rapide
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

    // ── Mutation gaussienne via ml5.mutate() ──────────────────────────────────

    mutate(rate = 0.1, magnitude = 0.3) {
        // Délègue à ML5 qui applique la fonction de mutation sur chaque poids
        this._ml5nn.mutate(rate, v => {
            const noise = (Math.random() + Math.random() + Math.random() - 1.5) * magnitude;
            return Math.max(-6, Math.min(6, v + noise));
        });
        this._syncCache(); // rafraîchit le cache JS après mutation
        return this;
    }

    // ── Croisement uniforme via ml5.neuralNetwork.crossover() ─────────────────

    crossover(other) {
        const child = this.copy(); // copie fidèle de this (notre copy(), pas celle de ML5)
        // Applique le croisement uniforme 50/50 via la méthode interne ML5
        child._ml5nn.neuralNetwork.crossover(other._ml5nn.neuralNetwork);
        child._syncCache(); // rafraîchit le cache JS après croisement
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
