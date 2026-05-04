// ── obstacle.js ───────────────────────────────────────────────────────────────

function spawnObstacle() {
    if (random() < 0.55) {
        // Piliers avec passage libre
        let gapH = random(105, 165);
        let gapY = random(20, GROUND - gapH - 15);
        if (gapY > 4)
            obstacles.push({ type: 'wall', x: W + 10, y: 0, w: 32, h: gapY });
        let bot = gapY + gapH;
        if (bot < GROUND - 4)
            obstacles.push({ type: 'wall', x: W + 10, y: bot, w: 32, h: GROUND - bot });
    } else {
        // Trou dans le sol
        obstacles.push({ type: 'hole', x: W + 10, y: GROUND, w: random(70, 130), h: H - GROUND });
    }
}

function hitWall(p, o) {
    const mg = 5;
    return p.x + p.w - mg > o.x &&
        p.x + mg < o.x + o.w &&
        p.y + p.h - mg > o.y &&
        p.y + mg < o.y + o.h;
}

function updateObstacles(checkCollision = false) {
    spawnCD--;
    if (spawnCD <= 0) {
        spawnObstacle();
        spawnCD = floor(max(38, random(55, 105) - score * 0.018));
    }

    for (let i = obstacles.length - 1; i >= 0; i--) {
        obstacles[i].x -= speed;
        if (obstacles[i].x + obstacles[i].w < -20) { obstacles.splice(i, 1); continue; }
        if (checkCollision && obstacles[i].type === 'wall' && hitWall(player, obstacles[i])) {
            state = 'over';
        }
    }
}

/** Alias sans vérification de collision (utilisé par les modes IA). */
function tickObstacles() {
    updateObstacles(false);
}

function drawObstacle(o) {
    if (o.type !== 'wall') return;
    fill(190, 50, 50);
    stroke(120, 20, 20);
    strokeWeight(2);
    rect(o.x, o.y, o.w, o.h, 0, 0, 5, 5);

    // Reflet
    noStroke();
    fill(255, 100, 100, 65);
    rect(o.x + 3, o.y + 3, 7, o.h - 6, 3);

    // Lignes de briques
    stroke(140, 25, 25, 120);
    strokeWeight(1);
    for (let by = o.y + 16; by < o.y + o.h; by += 16)
        line(o.x + 1, by, o.x + o.w - 1, by);
}

function drawGround() {
    let holes = obstacles.filter(o => o.type === 'hole');
    let segs = groundSegments(holes);

    // Sol (herbe)
    for (let s of segs) {
        fill(55, 130, 55);
        noStroke();
        rect(s.x, GROUND, s.w, H - GROUND);

        fill(80, 180, 75);
        rect(s.x, GROUND, s.w, 8);

        // Touffes d'herbe
        fill(110, 210, 95);
        for (let gx = s.x + (score % 28); gx < s.x + s.w; gx += 28)
            triangle(gx, GROUND, gx + 5, GROUND - 11, gx + 10, GROUND);
    }

    // Trous (obscurité + bords)
    for (let h of holes) {
        fill(5, 4, 14);
        noStroke();
        rect(h.x, GROUND, h.w, H - GROUND);

        fill(30, 90, 30);
        rect(h.x - 5, GROUND, 5, 9);
        rect(h.x + h.w, GROUND, 5, 9);
    }
}

function groundSegments(holes) {
    let segs = [];
    let sorted = holes.filter(h => h.x < W && h.x + h.w > 0)
        .sort((a, b) => a.x - b.x);
    let cur = 0;
    for (let h of sorted) {
        let hx = max(0, h.x);
        if (hx > cur) segs.push({ x: cur, w: hx - cur });
        cur = max(cur, h.x + h.w);
    }
    if (cur < W) segs.push({ x: cur, w: W - cur });
    return segs;
}
