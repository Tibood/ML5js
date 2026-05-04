// ── ui.js — Panneau de contrôle HTML ─────────────────────────────────────────
//
// Gère la liaison entre les éléments HTML du panneau latéral et la logique
// du jeu (sketch.js). Toute modification de slider/select met à jour
// l'objet global `uiConfig` immédiatement.

// ── Config partagée (lue par sketch, evolution, agent) ───────────────────────

const uiConfig = {
    popSize: 50,
    inputCount: 6,
    hiddenSize: 8,
    mutationRate: 10,    // en %
    stopThreshold: 2000,  // fitness minimale pour la condition d'arrêt
};

// Cerveaux sélectionnés pour la compétition
let competeBrainKeys = [];

// ── Descriptions des modes ────────────────────────────────────────────────────

const MODE_DESCRIPTIONS = {
    title: '',
    play: '🕹️ Vous contrôlez le personnage. Maintenez Espace ou clic pour activer le jetpack.',
    train: '🧬 Une population d\'agents IA apprend à jouer par évolution génétique. Configurez les paramètres puis cliquez ▶ Lancer.',
    demo: '👁️ Un cerveau sauvegardé joue en boucle. Chargez-en un via ▶ dans la liste des cerveaux.',
    compete: '🏆 Plusieurs cerveaux s\'affrontent simultanément sur les mêmes obstacles. Cochez les cerveaux à faire concourir.',
};

function _setModeDesc(m) {
    const el = document.getElementById('mode-desc');
    if (el) el.textContent = MODE_DESCRIPTIONS[m] || '';
}

// ── Initialisation ────────────────────────────────────────────────────────────

function initUI() {
    // Sliders
    _bindSlider('sl-pop', 'val-pop', v => { uiConfig.popSize = +v; });
    _bindSlider('sl-inputs', 'val-inputs', v => { uiConfig.inputCount = +v; });
    _bindSlider('sl-neurons', 'val-neurons', v => { uiConfig.hiddenSize = +v; });
    _bindSlider('sl-mutation', 'val-mutation', v => { uiConfig.mutationRate = +v; }, '%');
    _bindSlider('sl-stop', 'val-stop', v => { uiConfig.stopThreshold = +v; });

    // Boutons de mode
    document.getElementById('btn-play').addEventListener('click', () => { setMode('play'); _setModeDesc('play'); _refreshPanelVisibility(); });
    document.getElementById('btn-train').addEventListener('click', () => { setMode('train'); _setModeDesc('train'); _refreshPanelVisibility(); });
    document.getElementById('btn-demo').addEventListener('click', () => { setMode('demo'); _setModeDesc('demo'); _refreshPanelVisibility(); });
    document.getElementById('btn-compete').addEventListener('click', () => {
        if (!competeBrainKeys.length) {
            alert('Cochez au moins un cerveau sauvegardé dans la liste pour lancer une compétition.');
            return;
        }
        setMode('compete');
        _setModeDesc('compete');
        _refreshPanelVisibility();
    });

    // Boutons d'entraînement
    document.getElementById('btn-start-train').addEventListener('click', startTraining);
    document.getElementById('btn-reset-train').addEventListener('click', resetTraining);

    // Sauvegarde
    document.getElementById('btn-save-brain').addEventListener('click', saveBestBrain);

    renderBrainsList();
    _refreshPanelVisibility(); // applique les règles dès le chargement
}

function _bindSlider(sliderId, labelId, callback, suffix = '') {
    const slider = document.getElementById(sliderId);
    const label = document.getElementById(labelId);
    if (!slider || !label) return;
    slider.addEventListener('input', () => {
        label.textContent = slider.value + suffix;
        callback(slider.value);
    });
}

// ── Mise à jour des statistiques ──────────────────────────────────────────────

function updateStats() {
    // Mode buttons highlight
    ['play', 'train', 'demo', 'compete'].forEach(m => {
        const btn = document.getElementById('btn-' + m);
        if (btn) btn.classList.toggle('active', mode === m);
    });

    // Visibilité contextuelle des sections
    _refreshPanelVisibility();

    if (!evolution) return;

    _setText('stat-gen', evolution.generation);
    _setText('stat-alive', evolution.aliveCount + ' / ' + (evolution.agents.length || 0));
    _setText('stat-best', Math.floor(evolution.bestFitness));
    _setText('stat-avg', Math.floor(evolution.avgFitness));
    _setText('stat-cur-best', Math.floor(evolution.currentBestFitness));

    const pct = Math.round(evolution.stopRatio(uiConfig) * 100);
    _setText('stat-stop-pct', pct + '%');
}

function _setText(id, val) {
    const el = document.getElementById(id);
    if (el) el.textContent = val;
}

function _refreshPanelVisibility() {
    const sections = document.querySelectorAll('#control-panel .panel-section');
    // sections[0]=Mode, [1]=Config réseau, [2]=Stats, [3]=Cerveaux, [4]=Fitness
    if (sections[1]) sections[1].style.display = (mode === 'train') ? '' : 'none';
    if (sections[2]) sections[2].style.display = (mode === 'play' || mode === 'title') ? 'none' : '';
    if (sections[3]) sections[3].style.display = (mode === 'play' || mode === 'title') ? 'none' : '';
    if (sections[4]) sections[4].style.display = (mode === 'play' || mode === 'title') ? 'none' : '';
    // Bouton sauvegarder : uniquement en mode train
    const btnSave = document.getElementById('btn-save-brain');
    if (btnSave) btnSave.style.display = (mode === 'train') ? '' : 'none';
    _updateActionBtns();
}

function _updateActionBtns() {
    // Bouton Compétition : désactivé si aucun cerveau coché
    const btnCompete = document.getElementById('btn-compete');
    if (btnCompete) {
        const hasSelection = competeBrainKeys.length > 0;
        btnCompete.disabled = !hasSelection;
        btnCompete.title = hasSelection ? '' : 'Cochez au moins un cerveau dans la liste';
        btnCompete.style.opacity = hasSelection ? '' : '0.4';
        btnCompete.style.cursor = hasSelection ? '' : 'not-allowed';
    }

    // Bouton Démo : désactivé si aucun cerveau disponible
    const btnDemo = document.getElementById('btn-demo');
    if (btnDemo) {
        const hasBrain = (evolution && evolution.bestBrain) ||
            Object.keys(localStorage).some(k => k.startsWith('brain_'));
        btnDemo.disabled = !hasBrain;
        btnDemo.title = hasBrain ? '' : 'Entraînez d\'abord ou sauvegardez un cerveau';
        btnDemo.style.opacity = hasBrain ? '' : '0.4';
        btnDemo.style.cursor = hasBrain ? '' : 'not-allowed';
    }
}

// ── Sauvegarde / chargement de cerveaux (localStorage) ───────────────────────

function saveBestBrain() {
    if (!evolution || !evolution.bestBrain) {
        alert('Aucun cerveau entraîné disponible. Lancez d\'abord l\'entraînement.');
        return;
    }
    const name = `G${evolution.generation} | F${Math.floor(evolution.bestFitness)} | Inputs:${uiConfig.inputCount}`;
    const key = 'brain_' + Date.now();
    const entry = {
        name,
        fitness: Math.floor(evolution.bestFitness),
        generation: evolution.generation,
        inputCount: uiConfig.inputCount,
        brain: JSON.parse(evolution.bestBrain.serialize()),
    };
    localStorage.setItem(key, JSON.stringify(entry));
    renderBrainsList();
}

function renderBrainsList() {
    const list = document.getElementById('brains-list');
    if (!list) return;
    list.innerHTML = '';

    const keys = Object.keys(localStorage)
        .filter(k => k.startsWith('brain_'))
        .sort((a, b) => b.localeCompare(a)); // plus récent en premier

    if (!keys.length) {
        list.innerHTML = '<p style="font-size:0.75rem;color:#888;margin-top:4px">Aucun cerveau sauvegardé.</p>';
        _updateActionBtns();
        return;
    }

    keys.forEach((key, idx) => {
        const data = JSON.parse(localStorage.getItem(key));

        const item = document.createElement('div');
        item.className = 'brain-item';

        // Couleur de compétition assignée à l'index
        const col = COMPETE_COLORS[idx % COMPETE_COLORS.length];
        const dot = document.createElement('span');
        dot.className = 'brain-dot';
        dot.style.background = `rgb(${col[0]},${col[1]},${col[2]})`;

        const label = document.createElement('span');
        label.className = 'brain-label';
        label.title = data.name;
        label.textContent = data.name;

        const btnDemo = document.createElement('button');
        btnDemo.textContent = '▶';
        btnDemo.title = 'Démo';
        btnDemo.addEventListener('click', () => loadBrainForDemo(key));

        const chk = document.createElement('input');
        chk.type = 'checkbox';
        chk.title = 'Ajouter à la compétition';
        chk.checked = competeBrainKeys.includes(key);
        chk.addEventListener('change', () => {
            if (chk.checked) {
                if (!competeBrainKeys.includes(key)) competeBrainKeys.push(key);
            } else {
                competeBrainKeys = competeBrainKeys.filter(k => k !== key);
            }
            _updateActionBtns();
        });

        const btnDel = document.createElement('button');
        btnDel.textContent = '✕';
        btnDel.title = 'Supprimer';
        btnDel.style.background = '#6b2020';
        btnDel.addEventListener('click', () => {
            localStorage.removeItem(key);
            competeBrainKeys = competeBrainKeys.filter(k => k !== key);
            renderBrainsList();
        });

        item.appendChild(dot);
        item.appendChild(label);
        item.appendChild(chk);
        item.appendChild(btnDemo);
        item.appendChild(btnDel);
        list.appendChild(item);
    });
    _updateActionBtns();
}

function loadBrainForDemo(key) {
    const data = JSON.parse(localStorage.getItem(key));
    // Met à jour inputCount selon le cerveau chargé
    uiConfig.inputCount = data.inputCount || 6;
    const slider = document.getElementById('sl-inputs');
    if (slider) {
        slider.value = uiConfig.inputCount;
        document.getElementById('val-inputs').textContent = uiConfig.inputCount;
    }
    window.demoBrain = NeuralNetwork.deserialize(data.brain);
    setMode('demo');
}
