// ── player.js ─────────────────────────────────────────────────────────────────

/** Gère les particules du jetpack. Appelé par updatePlayer (humain) et agent.draw (IA). */
function manageParticles(thrust, px, py, ph) {
    if (thrust) {
        particles.push({
            x: px, y: py + ph * 0.55,
            vx: -random(1.5, 3.5), vy: random(-1, 1),
            life: 255, r: random(6, 13),
        });
    }
    particles = particles.filter(pt => pt.life > 0);
    for (let pt of particles) { pt.x += pt.vx; pt.y += pt.vy; pt.life -= 20; pt.r -= 0.5; }
}

function updatePlayer(thrust) {
    if (thrust) player.vy = max(player.vy - THRUST, MAX_VY);
    player.vy += GRAVITY;
    player.y  += player.vy;
    player.tick++;

    manageParticles(thrust, player.x, player.y, player.h);

    let overHole = obstacles.some(
        o => o.type === 'hole' &&
            player.x + player.w - 6 > o.x &&
            player.x + 6 < o.x + o.w
    );
    if (!overHole && player.y + player.h >= GROUND) {
        player.y  = GROUND - player.h;
        player.vy = 0;
    }
    if (player.y + player.h > H + 20 || player.y < -30) state = 'over';
}

/**
 * Dessine le personnage.
 * @param {boolean} thrusting - jetpack actif ?
 * @param {object}  [p]       - objet joueur (défaut : global `player`)
 */
function drawPlayer(thrusting, p) {
    p = (p !== undefined) ? p : player;
    let cx = p.x + p.w / 2;
    let cy = p.y + p.h / 2;
    let t  = p.tick;

    push();
    translate(cx, cy);

    // Réservoir jetpack
    fill(60, 60, 185);
    noStroke();
    rect(-p.w / 2 - 9, -9, 12, 22, 4);

    // Flamme jetpack
    if (thrusting) {
        let fl = 8 + sin(t * 1.2) * 4;
        fill(255, 160, 0, 210);
        ellipse(-p.w / 2 - 8, 10, 10, fl);
        fill(255, 240, 80, 160);
        ellipse(-p.w / 2 - 8, 12, 6, fl * 0.6);
    }

    // Corps
    fill(45, 155, 65);
    rect(-p.w / 2, -p.h / 2, p.w, p.h, 6);

    // Tête
    fill(250, 195, 145);
    ellipse(p.w / 2 - 10, -p.h / 2 - 9, 24, 22);

    // Visière casque
    fill(75, 155, 255, 210);
    arc(p.w / 2 - 8, -p.h / 2 - 9, 18, 18, PI, TWO_PI);
    fill(40, 100, 200, 100);
    arc(p.w / 2 - 8, -p.h / 2 - 9, 18, 18, PI, PI + HALF_PI);

    // Jambes
    fill(35, 85, 175);
    let leg = thrusting ? 0 : sin(t * 0.22) * 7;
    rect(-p.w / 2 + 2, p.h / 2 - 4, 10, 13 + leg, 2);
    rect(p.w / 2 - 12, p.h / 2 - 4, 10, 13 - leg, 2);

    pop();
}

function drawParticle(pt) {
    noStroke();
    fill(255, 130 + random(-15, 15), 0, pt.life);
    ellipse(pt.x, pt.y, max(0, pt.r));
}
