const HORIZONTAL = -1;
const VERTICAL = 1;
let LEFT = { dx: -1, dy: 0, axis: HORIZONTAL, name: "left" }
let RIGHT = { dx: 1, dy: 0, axis: HORIZONTAL, name: "right" }
let UP = { dx: 0, dy: -1, axis: VERTICAL, name: "up" }
let DOWN = { dx: 0, dy: 1, axis: VERTICAL, name: "down" }
const DIRS = [LEFT, RIGHT, UP, DOWN]

function reverse(dir) { return DIRS[DIRS.indexOf(dir) ^ 1] }

GameState = {
    dimX: null,
    dimY: null,
    playerCell: null,
    startCell: null,
    lastDir: null,
    cells: null,
    onIsland: false, // for camera cnetering
    undoStack: [],
}

GameState.setStartPos = function(x, y) {
    this.startCell = this.cells[y][x]
    if (this.playerCell == null) {
        this.playerCell = this.startCell
    }
}
GameState.drawDynamicProps = function(x, y) {
    cell = this.cells[y][x];
    if (cell.terrain == "1" && !cell.chopped) {
        View.drawProp(x, y, TILESET.TREE);
    }
    if (cell.terrain == "2" && !cell.chopped) {
        View.drawProp(x, y, TILESET.TALLTREE);
    }
    if (cell == this.startCell) {
        View.drawProp(x, y, TILESET.START);
    }
    cell.logs.forEach(log => {
        log.draw();
    });
    if (cell == this.playerCell && !this.fastTraveling) {
        let tile = TILESET.MONSTER_RIGHT;
        switch (this.lastDir) {
            case LEFT:
                tile = TILESET.MONSTER_LEFT;
                break;
            case RIGHT:
                tile = TILESET.MONSTER_RIGHT;
                break;
            case UP:
                tile = TILESET.MONSTER_UP;
                break;
            case DOWN:
                tile = TILESET.MONSTER_DOWN;
                break;
        }
        View.drawProp(x, y - cell.getElevation() * STUMP_VISUAL_HEIGHT, tile);
    }
}

GameState.getIsland = function(root) {
    // flood fill
    let unvisited = [root]
    let island = new Set()
    while (unvisited.length) {
        let cell = unvisited.pop()
        if (!cell || island.has(cell)) continue;
        if (cell.terrain == ' ' || cell.terrain == 'B') continue; // not island
        island.add(cell);
        DIRS.forEach(dir => unvisited.push(cell.nextCell(dir)));
    }
    return island.size ? island : null;
}

GameState.setTerrain = function(x, y, char) {
    let cell = this.cells[y][x]
    if (char == 'R') {
        /* reset position, only one can exist per island */
        this.setTerrain(x, y, '·'); // make grass
        let island = this.getIsland(cell);
        for (let cell2 of island) {
            if (cell2.terrain == 'R') {
                this.setTerrain(cell2.x, cell2.y, '·')
            }
        }
    }
    // todo: clear tile
    if (cell.chopped) {
        this.recallLog(cell)
        this.undoStack = [] // bad things could happen
    }
    cell.terrain = char
}
GameState.getTerrain = function(x, y) {
    if (x >= 0 && y >= 0 && y < GameState.dimY && x < GameState.dimX) {
        return this.cells[y][x].terrain;
    }
    return null
}
GameState.resetAll = function() {
    this.playerCell = this.startCell;
}

GameState.recallLog = function(origin) {
    for (cellRow of this.cells) {
        for (cell of cellRow) {
            for (log of cell.logs) {
                if (log.isRaft && log.origin2 == origin) {
                    log.isRaft = false;
                    log.origin2 = undefined;
                }
                if (log.isRaft && log.origin == origin) {
                    log.isRaft = false;
                    log.origin = log.origin2;
                    log.origin2 = undefined;
                }
                if (log.origin == origin) {
                    cell.removeLog(log)
                }
            }

        }
    }
    origin.chopped = false;
}
const FAST_TRAVEL = 1;
const CHEAT_TRAVEL = 2;
GameState.startFastTravel = function(cheat) {
    GameState.fastTraveling = cheat ? CHEAT_TRAVEL : FAST_TRAVEL;
    GameState.onIsland = false;
}
GameState.endFastTravel = function(x, y) {
    let cell = this.cells[y] ? this.cells[y][x] : undefined;
    if (cell) {
        if (this.fastTraveling == FAST_TRAVEL && cell.terrain != 'P') {
            console.log("Cannot fast-travel to cell of type ", cell.terrain)
            return;
        }
        this.snapshot() // for undo
        this.playerCell = this.fastTraveling == CHEAT_TRAVEL ? cell : cell.nextCell(RIGHT);
        this.fastTraveling = false;
    }
}
GameState.resetIsland = function() {
    let island = this.getIsland(this.playerCell)
    if (!island) {
        console.log("Refusing reset because player is not on an island.")
        return;
    }
    let resetCell = null
    for (cell of island) {
        if (cell.terrain == 'R') {
            resetCell = cell
        }
    }
    if (resetCell) {
        this.playerCell = resetCell
    } else if (this.playerCell.terrain == '1' || this.playerCell.terrain == '2') {
        console.log("Refusing reset because no reset pos found and player is on stump.")
        return
    }
    console.log("Resetting Island.")
    this.snapshot(); // for undo
    for (cell of island) {
        if ((cell.terrain == '1' || cell.terrain == '2') && cell.chopped) {
            this.recallLog(cell)
        }
    }
}

GameState.saveMapTo = function(saveGame) {
    // static part of the save
    saveGame.dimX = this.dimX;
    saveGame.dimY = this.dimY;
    saveGame.startX = this.startCell.x;
    saveGame.startY = this.startCell.y;
    saveGame.map = [...Array(this.dimY).keys()].map(y => [...Array(this.dimX).keys()].map(x => this.cells[y][x].terrain).join(''))

}
GameState.saveDynamicStateTo = function(saveGame) {
    // dynamic part of the saves
    let logs = []
    for (let y = 0; y < this.dimY; ++y) {
        for (let x = 0; x < this.dimX; ++x) {
            this.cells[y][x].saveLogsTo(logs)
        }
    }
    if (logs.length) {
        saveGame.logs = logs
    }
    if (this.playerCell != this.startCell) {
        saveGame.x = this.playerCell.x;
        saveGame.y = this.playerCell.y;
        if (this.lastDir) {
            saveGame.dir = DIRS.indexOf(this.lastDir);
        }
    }
}
GameState.saveTo = function(saveGame) {
    this.saveMapTo(saveGame)
    this.saveDynamicStateTo(saveGame)
    console.log(saveGame)
}
GameState.loadMapFrom = function(saveGame) {
    this.dimX = saveGame.dimX;
    this.dimY = saveGame.dimY;
    this.cells = [...Array(this.dimY).keys()].map(y => [...Array(this.dimX).keys()].map(x => new CellState(x, y, saveGame.map[y][x])));

    if (saveGame.startX && saveGame.startY) {
        this.startCell = this.cells[saveGame.startY][saveGame.startX]
    } else {
        this.startCell = null
    }
}
GameState.loadDynamicStateFrom = function(saveGame) {
    if (saveGame.x && saveGame.y) {
        this.playerCell = this.cells[saveGame.y][saveGame.x]
    } else {
        this.playerCell = this.startCell
    }
    // clear dynamic state first
    for (let y = 0; y < this.dimY; ++y) {
        for (let x = 0; x < this.dimX; ++x) {
            let cell = this.cells[y][x]
            cell.logs = []
            cell.chopped = false
        }
    }
    if (saveGame.logs) {
        for (log of saveGame.logs) {
            this.readlogFromSave(log);
        }
    }
    if (this.playerCell) {
        this.focusPlayer()
        if (saveGame.dir) {
            this.lastDir = DIRS[saveGame.dir]
        }
    } else {
        let focusCell = this.startCell || this.cells[(this.dimY - 1) / 2][(this.dimX - 1) / 2]
        let island = GameState.getIsland(focusCell)
        if (island) {
            View.showIsland(island)
        } else {
            View.cx = focusCell.x
            View.cy = focusCell.y
        }
    }
}
GameState.loadFrom = function(saveGame) {
    if (saveGame.map) {
        // undo states do not have this
        this.loadMapFrom(saveGame)
    }
    this.loadDynamicStateFrom(saveGame)
}

GameState.isWater = function(x, y) {
        let char = GameState.getTerrain(x, y)
        if (char == ' ') return true;
        if (char == 'B' || char == 'b') {
            let numWater = DIRS.map(dir => [x + dir.dx, y + dir.dy]).filter(pair =>
                GameState.getTerrain(pair[0], pair[1]) == ' ').length;
            if (numWater >= 3) return true;
        }
        return false;
    }
    // default background is grass. This covers trees, post-boxes, rocks, snowmen
GameState.snapshot = function() {
    let snapshot = {}
    this.saveDynamicStateTo(snapshot);
    this.undoStack.push(snapshot)
}
GameState.undo = function() {
    if (!this.undoStack.length) {
        console.log("Undo stack is empty.")
        return
    }
    let snapshot = this.undoStack.pop()
    this.loadDynamicStateFrom(snapshot)
    View.draw()
}

function saveToClipboardData(event) {
    let saveGame = {}
    GameState.saveTo(saveGame)
    event.clipboardData.setData('text/plain', JSON.stringify(saveGame))
    event.preventDefault();
    console.log("Saved Map and GameState to Clipboard.")
}

function loadFromClipboardData(event) {
    console.log("Trying to Load Savegame from clipboard...")
    let text = (event.clipboardData || window.clipboardData).getData('text');
    loadFromText(text);
}

function loadFromText(text) {
    try {
        saveGame = JSON.parse(text)
        console.log("SUCCESS!")
    } catch (error) {
        console.log("... but this is not valid JSON:\n", text)
        return
    }
    GameState.loadFrom(saveGame)
    View.draw()
}