const normalEnemies = ["Goblin", "Orc", "Bandit", "Assassin", "Skeleton", "Wolf"];
const bossEnemies = ["Goblin Lord", "Orc Chieftain", "Skelly Wellington", "Fenrir"];

const state = {
    selectedClass: "Warrior",
    player: null,
    enemy: null,
    wave: 1,
    maxWaves: 6,
    potions: 1,
    defending: false,
    gameOver: false
};

const elements = {
    setupScreen: document.querySelector("#setupScreen"),
    gameScreen: document.querySelector("#gameScreen"),
    resultScreen: document.querySelector("#resultScreen"),
    heroName: document.querySelector("#heroName"),
    waveNumber: document.querySelector("#waveNumber"),
    playerClass: document.querySelector("#playerClass"),
    playerName: document.querySelector("#playerName"),
    playerHpText: document.querySelector("#playerHpText"),
    playerHpBar: document.querySelector("#playerHpBar"),
    playerStats: document.querySelector("#playerStats"),
    enemyType: document.querySelector("#enemyType"),
    enemyName: document.querySelector("#enemyName"),
    enemyHpText: document.querySelector("#enemyHpText"),
    enemyHpBar: document.querySelector("#enemyHpBar"),
    enemyStats: document.querySelector("#enemyStats"),
    inventoryList: document.querySelector("#inventoryList"),
    log: document.querySelector("#log"),
    attackButton: document.querySelector("#attackButton"),
    specialButton: document.querySelector("#specialButton"),
    defendButton: document.querySelector("#defendButton"),
    potionButton: document.querySelector("#potionButton"),
    startButton: document.querySelector("#startButton"),
    restartButton: document.querySelector("#restartButton"),
    resultEyebrow: document.querySelector("#resultEyebrow"),
    resultTitle: document.querySelector("#resultTitle"),
    resultCopy: document.querySelector("#resultCopy")
};

function rand(min, max) {
    return Math.floor(Math.random() * (max - min + 1)) + min;
}

function chance(value) {
    return Math.random() < value;
}

function clamp(value, min, max) {
    return Math.max(min, Math.min(max, value));
}

function createPlayer(name, heroClass) {
    const base = heroClass === "Mage"
        ? {
            className: "Mage",
            maxHp: 150,
            hp: 150,
            attack: 28,
            defense: 10,
            block: 0.2,
            dodge: 0.2,
            special: "Arcane Pierce",
            cooldownMax: 1
        }
        : {
            className: "Warrior",
            maxHp: 170,
            hp: 170,
            attack: 25,
            defense: 12,
            block: 0.33,
            dodge: 0.1,
            special: "Power Slash",
            cooldownMax: 2
        };

    return {
        ...base,
        name,
        cooldown: 0,
        inventory: [
            { name: "Sword", type: "Weapon", power: 4 },
            { name: "Mystic Dagger", type: "Weapon", power: 3 }
        ]
    };
}

function weaponPower() {
    return state.player.inventory
        .filter(item => item.type === "Weapon")
        .reduce((sum, item) => sum + item.power, 0);
}

function createEnemy(wave, finalBoss = false) {
    if (finalBoss) {
        return {
            name: "Dragon King",
            type: "Final Boss",
            maxHp: 220,
            hp: 220,
            attack: 25,
            defense: 15,
            block: 0.16,
            dodge: 0.04,
            special: "Dragon Blast",
            specialChance: 0.22,
            specialMultiplier: 2
        };
    }

    const miniBoss = wave % 5 === 0;
    const hpMin = miniBoss ? 150 : 24 + wave * 6;
    const hpMax = miniBoss ? 176 : 54 + wave * 8;
    const atkMin = miniBoss ? 12 : 6 + wave;
    const atkMax = miniBoss ? 16 : 10 + wave * 2;
    const defMin = miniBoss ? 9 : Math.floor(wave / 2);
    const defMax = miniBoss ? 12 : 5 + Math.floor(wave / 2);

    return {
        name: miniBoss ? bossEnemies[rand(0, bossEnemies.length - 1)] : normalEnemies[rand(0, normalEnemies.length - 1)],
        type: miniBoss ? "Elite Enemy" : "Dungeon Enemy",
        maxHp: rand(hpMin, hpMax),
        hp: 0,
        attack: rand(atkMin, atkMax),
        defense: rand(defMin, defMax),
        block: miniBoss ? 0.15 : 0.1,
        dodge: 0.05,
        special: miniBoss ? "Domineering Blow" : "Enraged Strike",
        specialChance: miniBoss ? 0.2 : 0.16,
        specialMultiplier: miniBoss ? 2 : 1.65
    };
}

function finishEnemy(enemy) {
    enemy.hp = enemy.maxHp;
    return enemy;
}

function effectiveDamage(target, rawDamage) {
    if (chance(target.dodge)) {
        return { amount: 0, dodged: true, blocked: false };
    }

    const base = Math.max(1, rawDamage);
    const afterDefense = Math.max(Math.ceil(base * 0.05), base - target.defense);
    const blocked = chance(target.block);
    const amount = blocked ? Math.max(1, Math.round(afterDefense * 0.35)) : afterDefense;
    target.hp = clamp(target.hp - amount, 0, target.maxHp);
    return { amount, dodged: false, blocked };
}

function playerAttack(useSpecial = false) {
    if (state.gameOver) return;

    let raw = state.player.attack + weaponPower();
    let label = "attacks";

    if (useSpecial) {
        if (state.player.cooldown > 0) {
            addLog(`${state.player.special} is still cooling down.`, "warning");
            return;
        }
        raw = state.player.className === "Mage"
            ? Math.round((state.player.attack + state.enemy.defense * 0.5) * 1.5)
            : state.player.attack * 2;
        label = `uses ${state.player.special}`;
        state.player.cooldown = state.player.cooldownMax;
    }

    const critical = chance(0.2);
    if (critical) raw = Math.round(raw * 1.5);

    const result = effectiveDamage(state.enemy, raw);
    if (result.dodged) {
        addLog(`${state.enemy.name} dodged your attack.`, "warning");
    } else {
        addLog(`${state.player.name} ${label} for ${result.amount} damage${critical ? " (critical)" : ""}${result.blocked ? " after a block" : ""}.`, "success");
    }

    if (state.enemy.hp <= 0) {
        winWave();
        return;
    }

    enemyTurn();
    tickCooldown();
    render();
}

function enemyTurn() {
    let raw = state.enemy.attack;
    let label = "strikes back";

    if (chance(state.enemy.specialChance)) {
        raw = Math.round(raw * state.enemy.specialMultiplier);
        label = `uses ${state.enemy.special}`;
    }

    if (state.defending) {
        raw = Math.round(raw * 0.45);
        state.defending = false;
    }

    const result = effectiveDamage(state.player, raw);
    if (result.dodged) {
        addLog(`${state.player.name} dodged ${state.enemy.name}'s attack.`, "success");
    } else {
        addLog(`${state.enemy.name} ${label} for ${result.amount} damage${result.blocked ? ", but you block some of it" : ""}.`, "danger");
    }

    if (state.player.hp <= 0) {
        endRun(false);
    }
}

function defend() {
    if (state.gameOver) return;
    state.defending = true;
    addLog(`${state.player.name} braces for impact. Incoming damage is reduced this turn.`, "warning");
    enemyTurn();
    tickCooldown();
    render();
}

function usePotion() {
    if (state.gameOver || state.potions <= 0) return;
    const heal = rand(45, 70);
    const before = state.player.hp;
    state.player.hp = clamp(state.player.hp + heal, 0, state.player.maxHp);
    state.potions -= 1;
    addLog(`You drink a potion and recover ${state.player.hp - before} HP.`, "success");
    enemyTurn();
    tickCooldown();
    render();
}

function tickCooldown() {
    if (state.player.cooldown > 0) {
        state.player.cooldown -= 1;
    }
}

function winWave() {
    addLog(`${state.enemy.name} is defeated.`, "success");

    if (state.enemy.type === "Final Boss") {
        endRun(true);
        return;
    }

    runEvent();
    state.wave += 1;

    if (state.wave > state.maxWaves) {
        addLog("The boss room opens. The Dragon King appears.", "danger");
        state.enemy = createEnemy(state.wave, true);
    } else {
        state.enemy = finishEnemy(createEnemy(state.wave));
        addLog(`Wave ${state.wave} begins. A ${state.enemy.name} blocks your path.`, "warning");
    }

    render();
}

function runEvent() {
    const roll = rand(1, 100);
    if (roll <= 22) {
        const heal = rand(30, 55);
        state.player.hp = clamp(state.player.hp + heal, 0, state.player.maxHp);
        addLog(`You find a small potion and recover ${heal} HP.`, "success");
    } else if (roll <= 42) {
        const loot = chance(0.5)
            ? { name: "Magic Bow", type: "Weapon", power: 5 }
            : { name: "Mystic Ring", type: "Charm", power: 0 };
        state.player.inventory.push(loot);
        addLog(`Treasure found: ${loot.name}.`, "success");
    } else if (roll <= 58) {
        const damage = rand(6, 12);
        state.player.hp = clamp(state.player.hp - damage, 0, state.player.maxHp);
        addLog(`A trap snaps shut. You take ${damage} damage.`, "danger");
    } else if (roll <= 70) {
        state.potions += 1;
        addLog("You found a health potion for later.", "success");
    } else {
        addLog("The corridor is quiet. Too quiet.", "warning");
    }
}

function addLog(message, type = "") {
    const entry = document.createElement("div");
    entry.className = `log-entry ${type}`;
    entry.textContent = message;
    elements.log.prepend(entry);
}

function render() {
    const player = state.player;
    const enemy = state.enemy;
    const playerPct = player ? (player.hp / player.maxHp) * 100 : 100;
    const enemyPct = enemy ? (enemy.hp / enemy.maxHp) * 100 : 100;

    elements.waveNumber.textContent = enemy?.type === "Final Boss" ? "Boss" : state.wave;
    elements.playerClass.textContent = player.className;
    elements.playerName.textContent = player.name;
    elements.playerHpText.textContent = `${player.hp} / ${player.maxHp}`;
    elements.playerHpBar.style.width = `${playerPct}%`;
    elements.playerStats.innerHTML = `
        <span>Attack ${player.attack}</span>
        <span>Defense ${player.defense}</span>
        <span>Block ${Math.round(player.block * 100)}%</span>
        <span>Dodge ${Math.round(player.dodge * 100)}%</span>
    `;

    elements.enemyType.textContent = enemy.type;
    elements.enemyName.textContent = enemy.name;
    elements.enemyHpText.textContent = `${enemy.hp} / ${enemy.maxHp}`;
    elements.enemyHpBar.style.width = `${enemyPct}%`;
    elements.enemyStats.innerHTML = `
        <span>Attack ${enemy.attack}</span>
        <span>Defense ${enemy.defense}</span>
        <span>Block ${Math.round(enemy.block * 100)}%</span>
        <span>Dodge ${Math.round(enemy.dodge * 100)}%</span>
    `;

    elements.inventoryList.innerHTML = [
        ...player.inventory.map(item => `
            <div class="inventory-item">
                <strong>${item.name}</strong>
                <small>${item.type}${item.power ? ` +${item.power}` : ""}</small>
            </div>
        `),
        `<div class="inventory-item"><strong>Health Potion</strong><small>x${state.potions}</small></div>`
    ].join("");

    elements.specialButton.textContent = player.cooldown > 0
        ? `${player.special} (${player.cooldown})`
        : player.special;
    elements.specialButton.disabled = player.cooldown > 0;
    elements.potionButton.disabled = state.potions <= 0;
}

function startGame() {
    const name = elements.heroName.value.trim() || "Hero";
    state.player = createPlayer(name, state.selectedClass);
    state.enemy = finishEnemy(createEnemy(1));
    state.wave = 1;
    state.potions = 1;
    state.defending = false;
    state.gameOver = false;
    elements.log.innerHTML = "";
    elements.setupScreen.classList.add("hidden");
    elements.resultScreen.classList.add("hidden");
    elements.gameScreen.classList.remove("hidden");
    addLog(`Welcome, ${state.player.name}. Wave 1 begins with a ${state.enemy.name}.`, "warning");
    render();
}

function endRun(victory) {
    state.gameOver = true;
    elements.gameScreen.classList.add("hidden");
    elements.resultScreen.classList.remove("hidden");
    elements.resultEyebrow.textContent = victory ? "Dungeon Cleared" : "Run Failed";
    elements.resultTitle.textContent = victory ? "You defeated the Dragon King" : "The dungeon wins this time";
    elements.resultCopy.textContent = victory
        ? `${state.player.name} survives the dungeon and leaves with legendary loot.`
        : `${state.player.name} fell on wave ${state.wave}. Try a different class or save your potions.`;
}

document.querySelectorAll(".class-card").forEach(button => {
    button.addEventListener("click", () => {
        document.querySelectorAll(".class-card").forEach(card => card.classList.remove("selected"));
        button.classList.add("selected");
        state.selectedClass = button.dataset.class;
    });
});

elements.startButton.addEventListener("click", startGame);
elements.restartButton.addEventListener("click", () => {
    elements.resultScreen.classList.add("hidden");
    elements.setupScreen.classList.remove("hidden");
});
elements.attackButton.addEventListener("click", () => playerAttack(false));
elements.specialButton.addEventListener("click", () => playerAttack(true));
elements.defendButton.addEventListener("click", defend);
elements.potionButton.addEventListener("click", usePotion);
