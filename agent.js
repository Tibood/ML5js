// ── agent.js — Agent IA ───────────────────────────────────────────────────────
//
// Un agent possède un cerveau (NeuralNetwork) et un état physique identique
// à celui du joueur humain. Il observe le monde via 2 à 8 capteurs et décide
// à chaque frame d'activer ou non le jetpack.
//
// ── Capteurs (inputs du réseau, dans l'ordre) ─────────────────────────────────
//
//  #  Description                         Plage
//  0  Y joueur normalisé                  [0, 1]   (0 = plafond, 1 = sol)
//  1  Vitesse verticale normalisée        [-1, 1]
//  2  Distance au prochain obstacle       [0, 1]   (normalisée / W)
//  3  Type de l'obstacle 1               0=mur, 1=trou
//  4  Y du haut du passage (mur) / 0     [0, 1]
//  5  Y du bas  du passage (mur) / 1     [0, 1]
//  6  Distance au 2e obstacle            [0, 1]
//  7  Vitesse courante normalisée        [0, 1]
//
// ── Fonction de fitness ───────────────────────────────────────────────────────
//
//  fitness = frames_survécues + obstacles_franchis × 150
//
//  Les obstacles franchis récompensent la progression active ; les frames
//  survécues valorisent la longévité. Ce mélange évite que l'agent reste
//  immobile pour survivre longtemps.

class Agent {
    constructor(brain, color) {
        this.brain = brain;
        this.color = color || null;   // [r,g,b] pour mode compétition
        this.alive = true;
        this.fitness = 0;
        this.bonusPassed = 0;               // obstacles franchis
        this.lastThrust = false;
        // État physique (même structure que le joueur humain)
        this.p = { x: 130, y: GROUND - 50, w: 28, h: 44, vy: 0, tick: 0 };
        // Suivi interne des obstacles passés
        this._lastPassedX = -Infinity;
    }

    // ── Capteurs ─────────────────────────────────────────────────────────────

    getSensors(inputCount) {
        const p = this.p;

        // Obstacles devant l'agent, triés par x croissant
        const ahead = obstacles
            .filter(o => o.x + o.w > p.x)
            .sort((a, b) => a.x - b.x);

        // Déduplique les paires de murs (même x) pour obtenir des "groupes"
        function nextGroup(skip) {
            const seen = new Set();
            let cnt = 0;
            for (const o of ahead) {
                const key = Math.round(o.x / 10);
                if (seen.has(key)) continue;
                seen.add(key);
                if (cnt++ < skip) continue;
                // Retourne tous les obstacles du groupe
                return ahead.filter(a => Math.abs(a.x - o.x) < 10);
            }
            return null;
        }

        function groupInfo(group) {
            if (!group || group.length === 0) {
                return { dist: 1, type: 0, topY: 0.5, botY: 1 };
            }
            const ref = group[0];
            const dist = Math.max(0, ref.x - (p.x + p.w)) / W;

            if (ref.type === 'hole') {
                // Trou : le passage "sûr" est tout l'espace aérien
                return { dist, type: 1, topY: 0, botY: 1 };
            }
            // Mur : calculer le centre du passage
            const topWall = group.find(a => a.y <= 1) || null;
            const botWall = group.find(a => a.y > 1) || null;
            const gapTop = topWall ? (topWall.y + topWall.h) / GROUND : 0;
            const gapBot = botWall ? botWall.y / GROUND : 1;
            return { dist, type: 0, topY: gapTop, botY: gapBot };
        }

        const g1 = groupInfo(nextGroup(0));
        const g2 = groupInfo(nextGroup(1));

        const all = [
            p.y / GROUND,                                           // 0
            Math.max(-1, Math.min(1, p.vy / 10)),                   // 1
            Math.min(1, g1.dist),                                   // 2
            g1.type,                                                // 3
            g1.topY,                                                // 4
            g1.botY,                                                // 5
            Math.min(1, g2.dist),                                   // 6
            Math.max(0, Math.min(1, (speed - 4) / 4)),              // 7
        ];

        return all.slice(0, inputCount);
    }

    // ── Mise à jour (physique + décision IA) ─────────────────────────────────

    update(inputCount) {
        if (!this.alive) return;
        const output = this.brain.predict(this.getSensors(inputCount));
        this.applyOutput(output[0]);
        this.tick();
    }

    // Applique la sortie réseau (valeur brute 0-1) à la physique
    applyOutput(rawOutput) {
        this.lastThrust = rawOutput > 0.5;
    }

    // Avance la physique + fitness d'un frame (appelé après applyOutput)
    tick() {
        if (!this.alive) return;
        const thrust = this.lastThrust;
        const p = this.p;
        if (thrust) p.vy = Math.max(p.vy - THRUST, MAX_VY);
        p.vy += GRAVITY;
        p.y += p.vy;
        p.tick++;

        // Bonus pour les obstacles franchis (comptés une seule fois)
        for (const o of obstacles) {
            const passedEdge = o.x + o.w;
            if (passedEdge < p.x && passedEdge > this._lastPassedX) {
                this._lastPassedX = passedEdge;
                // Un trou = 1 bonus, un mur bas (seule moitié de la paire) = 0.5
                if (o.type === 'hole') this.bonusPassed += 1;
                else if (o.y > 0) this.bonusPassed += 0.5;
            }
        }

        // Au-dessus d'un trou ?
        const overHole = obstacles.some(
            o => o.type === 'hole' &&
                p.x + p.w - 6 > o.x &&
                p.x + 6 < o.x + o.w
        );

        if (!overHole && p.y + p.h >= GROUND) {
            p.y = GROUND - p.h;
            p.vy = 0;
        }

        // Conditions de mort
        if (p.y + p.h > H + 20 || p.y < -30) { this._die(); return; }
        for (const o of obstacles) {
            if (o.type === 'wall' && hitWall(p, o)) { this._die(); return; }
        }

        // fitness = frames + bonus obstacles
        this.fitness = score + Math.floor(this.bonusPassed) * 150;
    }

    _die() {
        this.alive = false;
        this.fitness = score + Math.floor(this.bonusPassed) * 150;
    }

    // ── Dessin ────────────────────────────────────────────────────────────────

    draw(isBest) {
        if (!this.alive) return;
        const p = this.p;
        if (this.color) {
            // Mode compétition : couleur assignée, contour plein
            push();
            stroke(...this.color);
            strokeWeight(2);
            noFill();
            rect(p.x, p.y, p.w, p.h, 4);
            // Jetpack
            if (this.lastThrust) {
                fill(...this.color, 180);
                noStroke();
                ellipse(p.x - 6, p.y + p.h * 0.6, 10, 14 + Math.sin(p.tick * 0.3) * 4);
            }
            pop();
        } else if (isBest) {
            // Meilleur agent de la génération : rendu complet + contour lumineux
            drawPlayer(this.lastThrust, p);
            push();
            noFill();
            stroke(...(this.color || [255, 255, 80]), 230);
            strokeWeight(2.5);
            rect(p.x - 3, p.y - 3, p.w + 6, p.h + 6, 7);
            pop();
        } else {
            // Agent normal : silhouette colorée visible
            const col = this.color || [80, 140, 255];
            push();
            fill(...col, 90);
            stroke(...col, 170);
            strokeWeight(1);
            rect(p.x, p.y, p.w, p.h, 3);
            // Mini jetpack coloré
            if (this.lastThrust) {
                fill(...col, 160);
                noStroke();
                ellipse(p.x - 6, p.y + p.h * 0.6, 8, 12 + Math.sin(p.tick * 0.3) * 3);
            }
            pop();
        }
    }
}
