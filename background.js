// ── background.js ─────────────────────────────────────────────────────────────

function initBg() {
    for (let i = 0; i < 90; i++)
        bgStars.push({ x: random(W), y: random(GROUND - 10), r: random(1, 2.5) });
    for (let i = 0; i < 14; i++)
        bgBuilds.push({ x: i * (W / 14) + random(10), h: random(50, 140), w: random(45, 85) });
}

function respawnBuilding(b) {
    b.x = W + random(20);
    b.h = random(50, 140);
    b.w = random(45, 85);
}

function updateBg() {
    for (let s of bgStars) s.x = (s.x - 0.4 + W) % W;
    for (let b of bgBuilds) { b.x -= 1.4; if (b.x + b.w < -10) respawnBuilding(b); }
}

function drawBg() {
    background(18, 15, 38);

    // Étoiles
    noStroke();
    for (let s of bgStars) {
        fill(255, 255, 255, 160 + sin(frameCount * 0.05 + s.x) * 60);
        ellipse(s.x, s.y, s.r * 2);
    }

    // Lune
    fill(240, 235, 200, 200);
    ellipse(W - 80, 50, 44, 44);
    fill(18, 15, 38, 180);
    ellipse(W - 70, 46, 38, 38);

    // Bâtiments lointains
    for (let b of bgBuilds) {
        fill(38, 34, 70);
        noStroke();
        rect(b.x, GROUND - b.h, b.w, b.h);
        // Fenêtres
        fill(65, 60, 110);
        for (let wy = GROUND - b.h + 10; wy < GROUND - 8; wy += 18)
            for (let wx = b.x + 7; wx < b.x + b.w - 7; wx += 15)
                rect(wx, wy, 7, 9, 1);
    }
}
