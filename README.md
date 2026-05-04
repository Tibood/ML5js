# Jetpack Runner — IA Neuro-évolutive

Jeu de runner infini style **Jetpack Joyride** avec un système d'IA entraînable
par **algorithme génétique** (neuro-évolution). Développé avec **p5.js 1.11.2**
et un réseau de neurones piloté par **ML5.js v1** (TensorFlow.js sous-jacent).

---

## Hébergement

Hébergé sur un VPS OVH personnel avec Dockploy pour le déploiement.

Lien : [ml5js.lavoitureouge.fr](https://ml5js.lavoiturerouge.fr/)

Vidéo YouTube : soon

## Démarrage rapide

```bash
python3 -m http.server 3333
# Puis ouvrez http://localhost:3333
```

---

## Structure des fichiers

```
├── index.html      # Layout deux colonnes (jeu + panneau de contrôle)
├── style.css       # Styles
├── nn.js           # Réseau de neurones feedforward (sigmoid / ReLU)
├── agent.js        # Agent IA (physique + 8 capteurs + fitness)
├── evolution.js    # Algorithme génétique (sélection, croisement, mutation)
├── ui.js           # Bindings UI + sauvegarde des cerveaux (localStorage)
├── sketch.js       # Orchestrateur p5.js (modes titre / play / train / demo / compete)
├── player.js       # Joueur humain (physique + particules + dessin)
├── obstacle.js     # Spawn / déplacement / collision des obstacles
├── hud.js          # Overlays HUD (humain, entraînement, compétition)
├── background.js   # Décor (étoiles, bâtiments parallaxe)
└── Dockerfile      # Serveur nginx statique
```

---

## Modes de jeu

### 🕹️ Jouer
Vous contrôlez le personnage manuellement.

| Touche | Action |
|--------|--------|
| `ESPACE` (maintenu) | Activer le jetpack |
| Clic souris (maintenu) | Activer le jetpack |
| `R` ou clic | Rejouer après game over |
| `P` | Basculer en mode Jouer |
| `T` | Basculer en mode Entraîner |
| `D` | Basculer en mode Démo |

---

### 🧬 Entraîner
Lance une population d'agents IA qui apprennent à jouer par évolution.

**Paramètres configurables dans le panneau :**

| Paramètre | Description | Plage |
|-----------|-------------|-------|
| Population | Nombre d'agents par génération | 10 – 200 |
| Entrées capteurs | Nombre d'inputs du réseau (2 à 8) | 2 – 8 |
| Neurones couche cachée | Largeur du réseau | 4 – 32 |
| Taux de mutation | % de poids modifiés à chaque génération | 1 – 50 % |
| Condition d'arrêt | Seuil de fitness pour stopper automatiquement | 500 – 15 000 |

**Workflow recommandé :**
1. Régler la population (50 est un bon départ)
2. Cliquer **▶ Lancer**
3. Observer les statistiques : Vivants, Fitness actuelle, Meilleur global
4. La barre verte en bas du canvas montre la progression vers la condition d'arrêt (seuil : 60 % des agents ≥ fitness cible)
5. Quand l'entraînement est satisfaisant, cliquer **💾 Sauvegarder le meilleur**
6. Cliquer **↺ Reset** pour relancer avec de nouveaux paramètres

**Lecture des couleurs :**
- Chaque agent a une couleur unique (arc-en-ciel par angle d'or)
- Le **meilleur agent vivant** s'affiche en personnage complet avec un contour lumineux
- Les autres sont des silhouettes colorées semi-transparentes

---

### 👁️ Démo
Observe **un seul cerveau** jouer en boucle.

**Sources possibles du cerveau :**
- Le meilleur issu de l'entraînement en cours.
- Un cerveau chargé depuis la liste des sauvegardes (cliquer **▶** à côté d'un cerveau)

Le HUD affiche le score et la vitesse en temps réel. Quand l'agent meurt, l'écran
game over s'affiche (clic ou `R` pour rejouer avec le même cerveau).

---

### 🏆 Compétition
Fait s'affronter **plusieurs cerveaux sauvegardés simultanément** sur les mêmes obstacles.

**Workflow :**
1. Entraîner et sauvegarder au moins 2 cerveaux (idéalement avec des configs différentes)
2. Cocher (☑) les cerveaux à faire concourir dans la liste
3. Cliquer **Compétition**
4. Un classement en temps réel s'affiche en haut à droite (▶ = vivant, ■ = mort)
5. À la fin, un écran de résultats classe les cerveaux par fitness

---

## Fonction de fitness

```
fitness = frames_franchies + obstacles_franchis × 150
```

- Les **obstacles franchis** récompensent la progression active
- Les **frames franchies** valorisent la longévité
- Ce mélange évite qu'un agent reste immobile pour survivre longtemps

---

## Architecture du réseau de neurones

```
[inputCount]  →  [hiddenSize] × 1 couche  →  [1 sortie]
```

> Le réseau est créé via `ml5.neuralNetwork()` (task: regression, noTraining: true),
> qui génère le modèle TF.js synchroniquement. La manipulation des poids
> (mutation, croisement) s'appuie sur les méthodes néuro-évolutives natives de ML5 :
> `nn.mutate()` et `nn.neuralNetwork.crossover()` (via l'instance TF.js interne).
> Activation cachée : **relu**. Sortie : **sigmoid**.

| # | Capteur | Plage |
|---|---------|-------|
| 0 | Y joueur normalisé | [0, 1] |
| 1 | Vitesse verticale normalisée | [-1, 1] |
| 2 | Distance au prochain obstacle | [0, 1] |
| 3 | Type obstacle 1 (0=mur, 1=trou) | {0, 1} |
| 4 | Y haut du passage | [0, 1] |
| 5 | Y bas du passage | [0, 1] |
| 6 | Distance au 2e obstacle | [0, 1] |
| 7 | Vitesse courante normalisée | [0, 1] |

La **sortie** (valeur > 0.5 = activer le jetpack) est calculée à chaque frame.

---

## Algorithme génétique

| Étape | Détail |
|-------|--------|
| Sélection | Élitisme 10 % + tournoi (k=3) |
| Reproduction | 75 % croisement uniforme / 25 % clonage |
| Mutation | Gaussienne sur les poids (σ = 0.3) |
| Arrêt | 60 % des agents ≥ `stopThreshold` |

---

## Librairies utilisées

| Librairie | Version | Rôle |
|-----------|---------|------|
| [p5.js](https://p5js.org/) | 1.11.2 (CDN) | Canvas, boucle de jeu, dessin |
| [ml5.js](https://ml5js.org/) | 1.x (CDN) | Réseau de neurones (TF.js sous-jacent) |
