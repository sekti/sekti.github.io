const HORIZONTAL = -1;
const VERTICAL = 1;
let LEFT = { dx: -1, dy: 0, axis: HORIZONTAL, name: "left" }
let RIGHT = { dx: 1, dy: 0, axis: HORIZONTAL, name: "right" }
let UP = { dx: 0, dy: -1, axis: VERTICAL, name: "up" }
let DOWN = { dx: 0, dy: 1, axis: VERTICAL, name: "down" }
const DIRS = [LEFT, RIGHT, UP, DOWN]

function reverse(dir) { return DIRS[DIRS.indexOf(dir) ^ 1] }

function dirFromDxDy(dx, dy) {
    if (dx) return dx > 0 ? RIGHT : LEFT;
    else return dy > 0 ? DOWN : UP;
}

GameState = {
    dimX: null,
    dimY: null,
    title: "[untitled]",
    author: "[author unknown]",
    finished: false, //hides editor tools when loading
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

GameState.getIsland = function(root, rocksAreSeparators = false) {
    // flood fill
    let unvisited = [root]
    let island = new Set()
    while (unvisited.length) {
        let cell = unvisited.pop()
        if (!cell || island.has(cell)) continue;
        if (cell.terrain == ' ' || cell.terrain == 'B' || cell.terrain == 'b' && rocksAreSeparators) continue; // not island
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
        let island = this.getIsland(cell, true);
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
    if (cell.isFriend) {
        cell.isFriend = false;
    }
    cell.terrain = char
}
GameState.getTerrain = function(x, y) {
    if (x >= 0 && y >= 0 && y < GameState.dimY && x < GameState.dimX) {
        return this.cells[y][x].terrain;
    }
    return null
}
GameState.setTitleAuthorFinished = function(title, author, finished) {
    // adjust display in the top right
    this.title = title;
    this.author = author;
    this.finished = finished;
    $("#title")[0].textContent = this.title;
    $("#author")[0].textContent = "by " + this.author;
}
GameState.resetAll = function() {
    this.playerCell = this.startCell;
    this.lastDir = null;
    this.onIsland = false;
    for (cellRow of this.cells) {
        for (cell of cellRow) {
            cell.logs = []
            cell.chopped = false;
            cell.isFriend = false;
        }
    }
    this.focusPlayer()
    View.draw();
}

GameState.clearCell = function(cell) {
    while (cell.logs.length) {
        let log = cell.logs[0]
        this.recallLog(log.origin)
    }
}
GameState.recallLog = function(origin) {
    for (cellRow of this.cells) {
        for (cell of cellRow) {
            for (log of cell.logs) {
                if (log.isRaft && log.origin2 == origin) {
                    log.axis = log.isRaft;
                    log.isRaft = false;
                    log.origin2 = undefined;
                }
                if (log.isRaft && log.origin == origin) {
                    log.axis = log.isRaft;
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
    /* recall the logs that are still lying in that cell
     * the original game only removes them, but this means
     * there can be chopped trees that do not have their logs anywhere
     * in the world. My savegame format currently assumes this does not occur
     * so I simply reset logs on stumps that are resetting as well. */
    this.clearCell(origin)
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
    let resetCell

    function searchResets() {
        resetCell = null;
        let resetPositionCount = 0;
        for (cell of island) {
            if (cell.terrain == 'R') {
                resetCell = cell
                resetPositionCount++;
            }
        }
        return resetPositionCount
    }
    if (searchResets() > 1) {
        island = this.getIsland(this.playerCell, true);
        searchResets();
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
    saveGame.title = this.title;
    saveGame.author = this.author;
    saveGame.finished = this.finished;
    if (this.startCell) {
        saveGame.startX = this.startCell.x;
        saveGame.startY = this.startCell.y;
    }
    saveGame.map = [...Array(this.dimY).keys()].map(y => [...Array(this.dimX).keys()].map(x => this.cells[y][x].terrain).join(''))

}
GameState.saveDynamicStateTo = function(saveGame) {
    // dynamic part of the saves
    let logs = []
    let friends = []
    for (let y = 0; y < this.dimY; ++y) {
        for (let x = 0; x < this.dimX; ++x) {
            let cell = this.cells[y][x];
            cell.saveLogsTo(logs)
            if (cell.isFriend) {
                friends.push([cell.x, cell.y]);
            }
        }
    }
    if (logs.length) {
        saveGame.logs = logs
    }
    if (friends.length) {
        saveGame.friends = friends
    }
    if (this.playerCell != this.startCell) {
        saveGame.x = this.playerCell.x;
        saveGame.y = this.playerCell.y;
        if (this.lastDir != null) {
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
    this.setTitleAuthorFinished(saveGame.title, saveGame.author, !!saveGame.finished);
    if (Editor.toolsVisible == this.finished) {
        Editor.toggleeditor();
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
            cell.isFriend = false; // deviates from the game, it does not clear this when undoing
        }
    }
    if (saveGame.logs) {
        for (log of saveGame.logs) {
            this.readlogFromSave(log);
        }
    }
    if (saveGame.friends) {
        for (friendPos of saveGame.friends) {
            this.cells[friendPos[1]][friendPos[0]].isFriend = true;
        }
    }
    if (this.playerCell) {
        this.focusPlayer()
        if (saveGame.dir != null) {
            this.lastDir = DIRS[saveGame.dir]
        }
    } else {
        let focusCell = this.startCell || this.cells[Math.floor((this.dimY - 1) / 2)][Math.floor((this.dimX - 1) / 2)]
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
    View.draw()
}

GameState.addSpace = function(dx, dy, onLeft, onTop) {
    function clean(x, y) {
        let cell = GameState.cells[y][x];
        if (cell.chopped) {
            // recall logs that come from here
            this.recallLog(cell);
        }
        // and put back logs that happen to be here.
        GameState.clearCell(cell);
    }
    // reset all trees in deleted regions
    dx = Math.max(dx, -this.dimX + 1); // must keep at least one cell
    dy = Math.max(dy, -this.dimY + 1);
    if (dx < 0) {
        let from = onLeft ? 0 : this.dimX + dx;
        let to = onLeft ? -dx : this.dimX;
        for (let y = 0; y < this.dimY; ++y) {
            for (let x = from; x < to; ++x) {
                clean(x, y);
            }
        }
    }
    if (dy < 0) {
        let from = onTop ? 0 : this.dimY + dy;
        let to = onTop ? -dy : this.dimY;
        for (let y = from; y < to; ++y) {
            for (let x = 0; x < this.dimX; ++x) {
                clean(x, y);
                TMPLOG("clean", x, y)
            }
        }
    }
    // create new ocean
    let playerOK = false
    let startOK = false
    let newDimX = this.dimX + dx;
    let newDimY = this.dimY + dy;
    let newCells = [...Array(newDimY).keys()].map(y => [...Array(newDimX).keys()].map(x => new CellState(x, y, ' ')));
    let shiftX = onLeft ? dx : 0;
    let shiftY = onTop ? dy : 0;
    for (let y = Math.max(0, -shiftY); y < Math.min(this.dimY, newDimY - shiftY); ++y) {
        for (let x = Math.max(0, -shiftX); x < Math.min(this.dimX, newDimX - shiftX); ++x) {
            let cell = this.cells[y][x];
            cell.x += shiftX;
            cell.y += shiftY;
            newCells[y + shiftY][x + shiftX] = cell;
            if (cell == this.playerCell) { playerOK = true; }
            if (cell == this.startCell) { startOK = true; }
        }
    }
    this.cells = newCells;
    this.dimX = this.dimX + dx;
    this.dimY = this.dimY + dy;
    if (!startOK) { this.startCell = null; }
    if (!playerOK) { this.playerCell = this.startCell; }
    undoStack = []
    View.draw();
    TMPLOG("done")
}

GameState.isWater = function(x, y) {
    let char = GameState.getTerrain(x, y)
    if (char == ' ') return true;
    if (char == 'B' || char == 'b') {
        let numWater = DIRS.map(dir => [x + dir.dx, y + dir.dy]).filter(pair =>
            GameState.getTerrain(pair[0], pair[1]) == ' ').length;
        if (numWater >= 3) return true;
    }
    // default background is grass. This covers trees, post-boxes, rocks, snowmen
    return false;
}

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
        // make it look pretty in monospace
    let string = JSON.stringify(saveGame).replace(/"map":\[/, '"map":[\n').replace(/"\,/g, '",\n').replace(/"\]/, '"]\n')
    event.clipboardData.setData('text/plain', string)
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
}