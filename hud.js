// ── hud.js ────────────────────────────────────────────────────────────────────

// HUD mode joueur humain
function drawHud() {
    noStroke();
    fill(255, 255, 255, 215);
    textSize(16);
    textAlign(LEFT, TOP);
    text(`Score : ${score}`, 12, 12);
    fill(170, 215, 255, 170);
    textSize(12);
    text(`Vitesse : ${speed.toFixed(1)}`, 12, 34);
    if (score < 210) {
        let a = score < 150 ? 220 : map(score, 150, 210, 220, 0);
        fill(255, 255, 170, a);
        textAlign(CENTER, BOTTOM);
        textSize(13);
        text('[ ESPACE ] ou [ CLIC MAINTENU ] pour voler', W / 2, H - 12);
    }
    textAlign(LEFT, BASELINE);
}

// HUD mode entraînement
function drawTrainHud(evo) {
    const alive = evo.aliveCount;
    const total = evo.agents.length;
    noStroke();
    fill(0, 0, 0, 110);
    rect(0, 0, 220, 82, 0, 0, 8, 0);
    fill(255, 255, 255, 220);
    textSize(13);
    textAlign(LEFT, TOP);
    text(`Génération : ${evo.generation}`, 10, 8);
    text(`Vivants    : ${alive} / ${total}`, 10, 26);
    text(`Score      : ${score}`, 10, 44);
    fill(255, 200, 80);
    text(`Meilleur F : ${Math.floor(evo.bestFitness)}`, 10, 62);
    // Barre de progression condition d'arrêt
    const pct = evo.stopRatio(uiConfig);
    fill(40, 40, 60, 180);
    rect(0, H - 18, W, 18);
    fill(80, 200, 120, 200);
    rect(0, H - 18, W * pct, 18);
    fill(255);
    textAlign(CENTER, BOTTOM);
    textSize(11);
    text(`Condition d'arrêt : ${Math.round(pct * 100)}% / 60%  |  seuil fitness : ${uiConfig.stopThreshold}`, W / 2, H - 2);
    textAlign(LEFT, BASELINE);
}

// HUD mode compétition
function drawCompeteHud() {
    const sorted = competeAgents.slice().sort((a, b) => b.fitness - a.fitness);
    const panW = 165, lineH = 20;
    const panH = 16 + sorted.length * lineH;
    fill(0, 0, 0, 130);
    noStroke();
    rect(W - panW - 8, 8, panW, panH, 6);
    textSize(11);
    for (let i = 0; i < sorted.length; i++) {
        const a = sorted[i];
        const col = a.color || [200, 200, 200];
        fill(...col, a.alive ? 255 : 110);
        textAlign(LEFT, TOP);
        text(`${a.alive ? '▶' : '■'} #${i + 1}  F:${Math.floor(a.fitness)}`, W - panW - 2, 14 + i * lineH);
    }
    textAlign(LEFT, BASELINE);
}

function drawGameOver() {
    background(10, 8, 26);
    textAlign(CENTER, CENTER);
    fill(255, 55, 55);
    textSize(54);
    text('GAME OVER', W / 2, H / 2 - 30);
    fill(255, 210, 75);
    textSize(24);
    text(`Score : ${score}`, W / 2, H / 2 + 24);
    fill(170, 195, 255, 200);
    textSize(14);
    text('[ R ] ou clic pour rejouer', W / 2, H / 2 + 72);
    textAlign(LEFT, BASELINE);
}

function drawCompeteOver() {
    background(10, 8, 26);
    textAlign(CENTER, CENTER);
    const sorted = competeAgents.slice().sort((a, b) => b.fitness - a.fitness);
    fill(255, 210, 75);
    textSize(30);
    text('FIN DE COMPÉTITION', W / 2, H / 2 - 70);
    textSize(14);
    for (let i = 0; i < sorted.length; i++) {
        const col = sorted[i].color || [200, 200, 200];
        fill(...col);
        text(`#${i + 1}  Fitness : ${Math.floor(sorted[i].fitness)}`, W / 2, H / 2 - 28 + i * 26);
    }
    fill(170, 195, 255, 180);
    textSize(13);
    text('[ R ] ou clic pour rejouer', W / 2, H - 30);
    textAlign(LEFT, BASELINE);
}


function drawGameOver() {
    background(10, 8, 26);

    textAlign(CENTER, CENTER);

    fill(255, 55, 55);
    textSize(54);
    text('GAME OVER', W / 2, H / 2 - 30);

    fill(255, 210, 75);
    textSize(24);
    text(`Score : ${score}`, W / 2, H / 2 + 24);

    fill(170, 195, 255, 200);
    textSize(14);
    text('[ R ] ou clic pour rejouer', W / 2, H / 2 + 72);

    textAlign(LEFT, BASELINE);
}
