const canvas = $("canvas")[0];
const ctx = canvas.getContext('2d');
ctx.canvas.width = canvas.offsetWidth;
ctx.canvas.height = canvas.offsetHeight;
const TILE_SIZE = 256;
const pxPerTileMAX = TILE_SIZE;
const pxPerTileMIN = 10;
const pxPerTileFACTOR = 1.2;

TMPLOG = console.log //easier to find with search and replace

class Tile {
    constructor(textureID, tileWidth, tileIndex) {
        this.image = $("#" + textureID)[0];
        this.sx = tileWidth * tileIndex;
        this.sy = 0;
        this.sWidth = tileWidth;
        this.sHeight = this.image.height;
    }
}
TILESET = {
    GRASS: new Tile("background-tiles", 128, 0),
    GRASS2: new Tile("background-tiles", 128, 1),
    WATER: new Tile("background-tiles", 128, 2),
    TREE: new Tile("props", 256, 0),
    TALLTREE: new Tile("props", 256, 1),
    POSTBOX: new Tile("props", 256, 2),
    STUMP: new Tile("props", 256, 3),
    ROCK: new Tile("props", 256, 4),
    BOULDER: new Tile("props", 256, 5),
    SNOWMAN: new Tile("props", 256, 6),
    LOG_STANDING: new Tile("props", 256, 7),
    LOG_HORIZONTAL: new Tile("props", 256, 8),
    LOG_VERTICAL: new Tile("props", 256, 9),
    LOG2_HORIZONTAL: new Tile("props", 256, 10),
    LOG2_VERTICAL: new Tile("props", 256, 11),
    MONSTER_RIGHT: new Tile("props", 256, 12),
    MONSTER_LEFT: new Tile("props", 256, 13),
    MONSTER_DOWN: new Tile("props", 256, 14),
    MONSTER_UP: new Tile("props", 256, 15),
    START: new Tile("props", 256, 16),
    RESETPOS: new Tile("props", 256, 17),
}

View = {
    // position that the camera is looking at;
    // if integer, then the center of the tile cx/cy.
    cx: 0,
    cy: 0,
    pxPerTile: 75,
    clickIsDrag: false,
    dragging: false,
    lastDragX: -1,
    lastDragY: -1,
    showGrid: false,
};
View.xToCanvasX = function(x) {
    return canvas.width / 2 + (x - this.cx) * this.pxPerTile;
}
View.yToCanvasY = function(y) {
    return canvas.height / 2 + (y - this.cy) * this.pxPerTile;
}
View.tileToCanvas = function(x, y) {
    return {
        xmin: this.xToCanvasX(x - 0.5),
        ymin: this.yToCanvasY(y - 0.5),
        width: this.pxPerTile,
        height: this.pxPerTile
    };
}
View.canvasToTile = function(px, py) {
    let ret = {
        x: Math.round((px - canvas.width / 2) / this.pxPerTile + this.cx),
        y: Math.round((py - canvas.height / 2) / this.pxPerTile + this.cy),
    }
    if (ret.x < 0 || ret.x >= GameState.dimX || ret.y < 0 || ret.y >= GameState.dimY) {
        return null;
    }
    return ret;
}
View.getVisibleTiles = function() {
    const verticalTileOverhang = 2;
    const horizontalTileOverhang = 0.5;
    let dx = canvas.width / 2 / this.pxPerTile;
    let dy = canvas.height / 2 / this.pxPerTile;
    return {
        xmin: Math.max(0, Math.ceil(this.cx - dx - 0.5 - horizontalTileOverhang)),
        xmax: Math.min(GameState.dimX - 1, Math.floor(this.cx + dx + 0.5 + horizontalTileOverhang)),
        ymin: Math.max(0, Math.ceil(this.cy - dy - 0.5)),
        ymax: Math.min(GameState.dimY - 1, Math.floor(this.cy + dy + 0.5 + verticalTileOverhang)),
    }
}

View.showIsland = function(island) {
    console.assert(island && island.size, "Trying to center view on invalid island.")
        // island is array of cells
    let maxX = -1;
    let maxY = -1;
    let minX = GameState.dimX;
    let minY = GameState.dimY;
    island.forEach(cell => {
        maxX = Math.max(maxX, cell.x);
        minX = Math.min(minX, cell.x);
        maxY = Math.max(maxY, cell.y);
        minY = Math.min(minY, cell.y);
    })
    const RADIUS_SHOWN = 3; // must be at least one
    maxX += RADIUS_SHOWN;
    minX -= RADIUS_SHOWN;
    maxY += RADIUS_SHOWN;
    minY -= RADIUS_SHOWN;

    this.cx = (minX + maxX) / 2;
    this.cy = (minY + maxY) / 2;
    this.pxPerTile = Math.min(canvas.width / (maxX - minX), canvas.height / (maxY - minY));
    this.pxPerTile = Math.max(pxPerTileMIN, Math.min(pxPerTileMAX, this.pxPerTile));
}

View.startDrag = function(x, y) {
    this.dragging = true;
    this.lastDragX = x;
    this.lastDragY = y;
}
View.doDrag = function(x, y) {
    if (!this.dragging) return;
    let dx = x - this.lastDragX;
    let dy = y - this.lastDragY;
    this.cx -= dx / this.pxPerTile;
    this.cy -= dy / this.pxPerTile;
    this.lastDragX = x;
    this.lastDragY = y;
    this.draw();
}
View.stopDrag = function() {
    this.dragging = false;
}
View.drawTexture = function(tile, x, y, dimx, dimy) {
    // tile object, upper left corner, logical dimensions of the tile
    let px = this.xToCanvasX(x);
    let py = this.yToCanvasY(y);
    let pdimx = dimx * this.pxPerTile;
    let pdimy = dimy * this.pxPerTile;
    ctx.drawImage(tile.image, tile.sx, tile.sy, tile.sWidth, tile.sHeight, px, py, pdimx, pdimy);
}
View.drawTile = function(x, y, tile) {
    this.drawTexture(tile, x - 0.5, y - 0.5, 1, 1);
}
View.drawProp = function(x, y, tile) {
    View.drawTexture(tile, x - 1, y - 2.5, 2, 3);
}

View.drawGrid = function() {
    let box = this.getVisibleTiles();
    ctx.strokeStyle = "#cccccc";
    ctx.lineWidth = 3 * this.pxPerTile / 75;
    let XMIN = Math.max(this.xToCanvasX(box.xmin - 0.5), 0);
    let XMAX = Math.min(this.xToCanvasX(box.xmax + 0.5), canvas.width);
    let YMIN = Math.max(this.yToCanvasY(box.ymin - 0.5), 0);
    let YMAX = Math.min(this.yToCanvasY(box.ymax + 0.5), canvas.height);
    for (x = box.xmin; x <= box.xmax + 1; ++x) {
        ctx.beginPath();
        ctx.moveTo(this.xToCanvasX(x - 0.5), YMIN);
        ctx.lineTo(this.xToCanvasX(x - 0.5), YMAX);
        ctx.stroke();
    }
    for (y = box.ymin; y <= box.ymax + 1; ++y) {
        ctx.beginPath();
        ctx.moveTo(XMIN, this.yToCanvasY(y - 0.5));
        ctx.lineTo(XMAX, this.yToCanvasY(y - 0.5));
        ctx.stroke();
    }
}

View.drawTileBackground = function(x, y) {
    // default background is grass. This covers trees, post-boxes, rocks, snowmen
    let tile = ((y + x) % 2) ? TILESET.GRASS : TILESET.GRASS2;
    let char = GameState.getTerrain(x, y)
    if (char == ' ') tile = TILESET.WATER;
    if (char == 'B' || char == 'R') {
        let numWater = DIRS.map(dir => [x + dir.dx, y + dir.dy]).filter(pair =>
            GameState.getTerrain(pair[0], pair[1]) == ' ').length;
        if (numWater >= 3) tile = TILESET.WATER
    }
    this.drawTile(x, y, tile)
}

View.drawStaticProps = function(x, y) {
    function placeTile(tile) {
        View.drawProp(x, y, tile);
    }
    let char = GameState.getTerrain(x, y)
    if (char == '1') {
        placeTile(TILESET.STUMP);
    } else if (char == '2') {
        placeTile(TILESET.STUMP);
    } else if (char == 'P') {
        placeTile(TILESET.POSTBOX);
    } else if (char == 'B') {
        placeTile(TILESET.BOULDER);
    } else if (char == 'R') {
        placeTile(TILESET.ROCK);
    } else if (char == 'M') {
        placeTile(TILESET.START);
    }
}

View.draw = function() {
    // in case of resize
    ctx.canvas.width = canvas.offsetWidth;
    ctx.canvas.height = canvas.offsetHeight;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.rect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = "#888888";
    ctx.fill();
    let box = this.getVisibleTiles();
    for (let y = box.ymin; y <= box.ymax; ++y) {
        for (let x = box.xmin; x <= box.xmax; ++x) {
            this.drawTileBackground(x, y);
        }
    }
    for (let y = box.ymin; y <= box.ymax; ++y) {
        for (let x = box.xmin; x <= box.xmax; ++x) {
            this.drawStaticProps(x, y);
            GameState.drawDynamicProps(x, y);
        }
    }
    if (this.showGrid) {
        this.drawGrid();
    }
}

View.zoom = function(dir) {
    if (dir) {
        this.pxPerTile *= pxPerTileFACTOR;
    } else {
        this.pxPerTile /= pxPerTileFACTOR;
    }
    this.pxPerTile = Math.max(pxPerTileMIN, Math.min(pxPerTileMAX, View.pxPerTile));
    this.draw();
}

TERRAIN_CHARS = {
    water: ' ',
    grass: '·',
    tree: '1',
    talltree: '2',
    rock: 'R',
    boulder: 'B',
    postbox: 'P',
    secret: 'S',
    start: 'M',
}

Editor = {
    selectedTool: null
}
Editor.placeTile = function(x, y, tileType) {
    if (tileType == 'M') {
        /* pseudo tile, handled by game state */
        this.placeTile(x, y, '·'); // make grass
        GameState.setStartPos(x, y);
    } else {
        GameState.setTerrain(x, y, tileType)
    }
}
Editor.selectTool = function(terrain) {
    $("#editor-buttons input").removeClass("selected");
    if (Editor.selectedTool != TERRAIN_CHARS[terrain]) {
        $("#button-" + terrain).addClass("selected");
        Editor.selectedTool = TERRAIN_CHARS[terrain];
    } else {
        // deselect instead (prevents accidental drawing)
        Editor.selectedTool = null;
    }

}
Editor.addControls = function() {
    /* menuButtons = $("#menu-buttons");
    button = $("<input/>").appendTo(menuButtons).attr("type", "button").attr("id", "button-save");
    button.on("click", saveToClipboard)
    button = $("<input/>").appendTo(menuButtons).attr("type", "button").attr("id", "button-load");
    button.on("click", loadFromClipboard)*/

    let editorButtons = $("#editor-buttons");
    for (let terrain in TERRAIN_CHARS) {
        let pngName = "./img/button-" + terrain + ".png"
        let button = $("<input/>").appendTo(editorButtons).attr("type", "button").addClass("terrain").attr("id", "button-" + terrain)
            .css("background-image", "url(" + pngName + ")");
        button.on("click", event => {
            Editor.selectTool(terrain);
        });
    }
    $("#canvas").on("click", event => {
        pos = View.canvasToTile(event.offsetX, event.offsetY);
        if (pos != null && !View.clickIsDrag && this.selectedTool) {
            Editor.placeTile(pos.x, pos.y, this.selectedTool);
            View.draw();
        }
    });
}

const HORIZONTAL = -1;
const VERTICAL = 1;
const LEFT = { dx: -1, dy: 0, axis: HORIZONTAL, name: "left" }
const RIGHT = { dx: 1, dy: 0, axis: HORIZONTAL, name: "right" }
const UP = { dx: 0, dy: -1, axis: VERTICAL, name: "up" }
const DOWN = { dx: 0, dy: 1, axis: VERTICAL, name: "down" }
const DIRS = [LEFT, RIGHT, UP, DOWN]

GameState = {
    dimX: null,
    dimY: null,
    playerCell: null,
    startCell: null,
    lastDir: null,
    cells: null,
    onIsland: false, // for camera cnetering
    lastGrassCell: null, // resetting to this cell
}
GameState.setStartPos = function(x, y) {
    this.startCell = this.cells[y][x]
    if (this.playerX == null) {
        this.playerX = x;
        this.playerY = y;
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
    if (cell == this.playerCell) {
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

const STUMP_VISUAL_HEIGHT = 0.2;
class Log {
    constructor(cell) {
        this.axis = 0; // upright
        this.isRaft = false;
        this.sibling = null;
        this.cell = cell;
        this.origin = cell;
    }
    moveTo(dir) {
        this.cell.removeLog(this)
        this.cell = this.cell.nextCell(dir);
        this.cell.addLog(this);
    }
    getElevation() {
        return this.cell.getElevation(this);
    }
    height() {
        return this.axis ? 2 : 4; // standing logs are 4 stumps high.
    }
    draw() {
        if (!this.sibling && !this.isRaft) {
            let tile;
            switch (this.axis) {
                case 0:
                    tile = TILESET.LOG_STANDING;
                    break;
                case HORIZONTAL:
                    tile = TILESET.LOG_HORIZONTAL;
                    break;
                case VERTICAL:
                    tile = TILESET.LOG_VERTICAL;
                    break;
            }
            View.drawProp(this.cell.x, this.cell.y - this.getElevation() * STUMP_VISUAL_HEIGHT, tile)
        }
    }
}

class CellState {
    constructor(x, y, terrain) {
        this.chopped = false;
        this.x = x;
        this.y = y;
        this.logs = []
        this.terrain = terrain;
    }
    isRaft() {
        return false;
    }
    baseElevation() {
        switch (this.terrain) {
            case 'P':
            case 'B':
                return 4;
            case 'R':
                return 2;
            case ' ':
                return -2;
            case '·':
                return 0;
            case '1':
                return this.chopped ? 1 : 5;
            case '2':
                return this.chopped ? 1 : 8;
            default:
                console.assert(false, "Invalid terrain.");
                return 0;
        }
    }
    addLog(log) {
        this.logs.push(log);
    }
    removeLog(log) {
        let i = this.logs.indexOf(log);
        console.assert(i >= 0, "Tried to remove non-existent log from cell.");
        this.logs.splice(i, 1);
    }
    topLog() {
        let length = this.logs.length;
        return length ? this.logs[length - 1] : null;
    }
    getElevation(queryLog) {
        // total elevation (for queryLog == null) or elevation of given log
        let elev = this.baseElevation();
        for (const log of this.logs) {
            if (log == queryLog) {
                return elev
            }
            elev += log.height();
        }
        console.assert(queryLog == null, "elevation of log requested that does not exist.");
        return elev;
    }
    nextCell(dir) {
        let y = this.y + dir.dy;
        let x = this.x + dir.dx;
        if (y >= 0 && x >= 0 && y < GameState.dimY && x < GameState.dimX) {
            return GameState.cells[y][x];
        }
        return null;
    }
}

GameState.setTerrain = function(x, y, char) {
    // todo: clear tile
    this.cells[y][x].terrain = char
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

GameState.canMove = function(cell, dir) {
    targetCell = cell.nextCell(dir);
    let targetLog = targetCell.topLog()
    if (targetLog && targetLog.axis && targetLog.axis != dir.axis) {
        // cannot jump on orthogonal log ever
        return false;
    }
    if (!targetLog && targetCell.terrain == ' ') {
        // cannot jump on water
        return false;
    }
    if (targetCell.getElevation() - 1 > cell.getElevation()) {
        // cannot jump more than one step up
        return false;
    }
    return true;
}
GameState.tryNudge = function(cell, dir) {
    return false;
}
GameState.tryPush = function(cell, dir) {
    log = cell.topLog()
    nextCell = cell.nextCell(dir)
    if (!log) return false;
    if (log.axis == 0) {
        if (nextCell.getElevation() <= log.getElevation()) {
            log.axis = dir.axis;
            log.moveTo(dir);
            return true;
        }
    }
    return false;
}
GameState.tryChop = function(cell, dir) {
    if (cell.terrain == "1" && !cell.chopped) {
        cell.chopped = true;
        cell.addLog(new Log(cell))
        return true;
    }
    return false;
}

GameState.playerCell = function() {
    this.cells[this.playerY][this.playerX]
}
GameState.input = function(dir) {
    console.log("Going " + dir.name);
    this.lastDir = dir; // direction monster is facing
    let cell1 = this.playerCell
    let cell2 = cell1.nextCell(dir);

    if (this.canMove(cell1, dir)) {
        this.playerCell = this.playerCell.nextCell(dir)
    } else if (cell1.isRaft()) {

    } else if (this.tryNudge(cell2, dir)) {

    } else if (this.tryPush(cell2, dir)) {

    } else if (this.tryChop(cell2, dir)) {
        this.tryPush(cell2, dir);
    }

    let island = this.getIsland(this.playerCell);
    if (island && !this.onIsland) {
        View.showIsland(island);
    }
    this.onIsland = island != null;
    if (this.playerCell.terrain == '·') {
        this.lastGrassCell = this.playerCell
    }
    View.draw();
}
GameState.recallLog = function(origin) {
    for (cellRow of this.cells) {
        for (cell of cellRow) {
            for (log of cell.logs) {
                if (log.origin == origin) {
                    cell.removeLog(log)
                }
            }

        }
    }
    origin.chopped = false;
}

GameState.resetIsland = function() {
    let island = this.getIsland(this.playerCell)
    if (!island) {
        console.log("Refusing reset because player is not on an island.")
        return;
    }
    if (this.playerCell.terrain != '·') {
        if (!this.lastGrassCell) {
            console.log("Refusing reset because I don't know where to move monster.")
            return;
        }
        this.playerCell = this.lastGrassCell
    }
    console.log("Resetting Island.")
    for (cell of island) {
        if (cell.terrain == '1' && cell.chopped) {
            this.recallLog(cell)
        }
    }
    View.draw()
}

GameState.saveTo = function(saveGame) {
    saveGame.dimX = this.dimX;
    saveGame.dimY = this.dimY;
    saveGame.map = [...Array(this.dimY).keys()].map(y => [...Array(this.dimX).keys()].map(x => this.cells[y][x].terrain).join(''))
    saveGame.startX = this.startCell.x;
    saveGame.startY = this.startCell.y;
    if (this.playerCell != this.startCell) {
        saveGame.x = this.playerX;
        saveGame.y = this.playerY;
    }
}
GameState.loadFrom = function(saveGame) {
    this.dimX = saveGame.dimX;
    this.dimY = saveGame.dimY;
    this.cells = [...Array(this.dimY).keys()].map(y => [...Array(this.dimX).keys()].map(x => new CellState(x, y, saveGame.map[y][x])));

    if (saveGame.startX && saveGame.startY) {
        this.startCell = this.cells[saveGame.startY][saveGame.startX]
    } else {
        this.startCell = null
    }
    if (saveGame.x && saveGame.y) {
        this.playerCell = this.cells[saveGame.y][saveGame.x]
    } else {
        this.playerCell = this.startCell
    }
    let focusCell = this.playerCell || this.startCell || this.cells[(this.dimY - 1) / 2][(this.dimX - 1) / 2]

    let island = GameState.getIsland(focusCell)
    if (island) {
        View.showIsland(island)
    } else {
        View.cx = this.playerCell.x || this.startCell.x || ((this.dimX - 1) / 2);
        View.cy = this.playerCell.y || this.startCell.y || ((this.dimY - 1) / 2);
    }
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

canvas.onwheel = function(event) {
    event.preventDefault();
    View.zoom(event.deltaY < 0);
};

canvas.onmousedown = function(event) {
    event.preventDefault();
    View.startDrag(event.clientX, event.clientY);
    View.clickIsDrag = false;
}

canvas.onmouseup = function(event) {
    event.preventDefault();
    View.stopDrag();
}

canvas.onmousemove = function(event) {
    event.preventDefault();
    View.doDrag(event.clientX, event.clientY);
    View.clickIsDrag = true;
}

function processInput(event) {
    if (event.ctrlKey || event.metaKey || event.altKey) {
        return
    }
    doneSomething = true;
    switch (event.key) {
        case "w":
        case "ArrowUp":
            GameState.input(UP);
            break;
        case "s":
        case "ArrowDown":
            GameState.input(DOWN);
            break;
        case "a":
        case "ArrowLeft":
            GameState.input(LEFT);
            break;
        case "d":
        case "ArrowRight":
            GameState.input(RIGHT);
            break;
        case "g":
            View.showGrid = !View.showGrid;
            View.draw();
            break;
        case "r":
            GameState.resetIsland();
            break;
        default:
            doneSomething = false;
    }
    if (doneSomething) {
        event.preventDefault();
    }
}

window.onload = function() {
    console.log("Loading default level...")
        //loadFromText(defaultLevelJSON) // '{"map":["          ","   · ···  ","     ·2·  ","   B  ··  ","   ··PR·  ","   ·1···  ","          "],"dimX":10,"dimY":7,"startX":6,"startY":3}'
    GameState.loadFrom(originalLevelSave);
    Editor.addControls();
    View.draw();

    $("body")[0].addEventListener('copy', saveToClipboardData);
    $("body")[0].addEventListener('paste', loadFromClipboardData);
    $("body")[0].addEventListener('keydown', processInput);
}


originalLevelSave = {
    dimX: 341,
    dimY: 257,
    startX: 165,
    startY: 80,
    map: [
        "                                                                                                                                                                                                                                                                                                                                                     ",
        "                                                                                                                                                                                                                                                                                                                                                     ",
        "                                                                                                                                                                                                                                                                                                                                                     ",
        "                                                                                                                                                                                                                                                                                                                                                     ",
        "                                                                                                                                                                                             ····                                                                                                                                                    ",
        "                                                                                                                                                                                             ·2···                                      ··                                                                                                           ",
        "                                                   ···                                                                                                                                        ·····                                   ··1··     ···                                                                                                  ",
        "                                                   ···                                                                                                                                         ····   ···                            ·R···R    ··P··  ·R·2                                                                                           ",
        "                                            ···     ·1··                                                                                                                                   ··  ·1··  ·····                           ····R     ····1 ·······                                                                                         ",
        "                                           ····2  ·1·RR··                                                                                                                             ··· ···· ··   ···BB··                          1BB    B·  ···· ·R·····                                                                                         ",
        "                                           ······R····R··                                                                                                                            ·1·····1·      ·······                           ···  ···1 ···  ··2···· ·B··                                                                                    ",
        "                                           ··S··RR··RRR··                                                                                                                            ·········       ·· ···                      ·2  ·1··  ··B·        ····  ··1·· B                                                                                 ",
        "                                           ····R·RRR·R····                                                                                                                   ····      ······           ·2                      ···· ···    ···   ··R         ·····                                                                                  ",
        "                                            ··RR···R···1··                                                                                                                  ····S·  ·1  ·1··                                   ·R··1             ·····       ·1····  ·R··                                                                            ",
        "                                             R······RRR··1·                                                                                                                 ·····1 ···    ··        ···                        ··1·  ·····       ·2···       ·· ··· ····2·                                                                           ",
        "                                             ··R2··RR·R···B                                                                                                                 ··  ·· ····      ···   ·B··  ····        ···       ···· ·B1··1       ····           R·  ·B····                                                                           ",
        "                                             ·····R····RR··                                                                                                                        ····     ·····  ···2  ·····   ··  ··1·       ··· ····B     B   ·R·                 ··                                                                             ",
        "                                             ····R···1···RR·                                                                                                                         ··     ·····   ··  ···P·2  ····1····            ·B···   ·····                    ·2·                                                                            ",
        "                                             ···RRRR··R·R····                                                              ·R··                                                ···  ··· ··    ·2·       ······  ·1··B····                    ····B·                    ··                                                                            ",
        "                                              R···R··1··R····                                                             ······                                               ·2·  ··  ····· R·  ··    ······   ··· ··        ··B··         ··1·1·   R                                                                                              ",
        "                                              R····RR····R··                                                              ······                                             ·R····     ·2··B    ···     ···                  ······           ···        ··· ···        ···                                                                         ",
        "                                              R·····R··· ·1                                                              ·1···B                                        ··   ·······      ····    R····                        ·····1·  ·R··              ···B··2··       ··S·                                                                        ",
        "                                              ·R··RR····                                                                 ····1·                                        ··2  ·1·· ·· 1··  ··1·    ·2···      ·2·                2·· ·· ····2·     1···    ··S·····R       ····                                                                        ",
        "                                              ··RR·····R···                                                              ·· ···                      ···               ····  ··     ···1 ··       ··1·     ······              ···    ······   ···1···  ·2·· B····        ··                                                                         ",
        "                                      ···········RR···R·····                                                                    ··                   ··1·               ··1         ··B·          ···      ··BBB··    B  B           ······R   ·B1···R  ····  ····                                                                                   ",
        "                                     B········B····R··RR2···                                                                  ····     ····         ·····                            ···                   ··BBB··                   ·1  R··    ·····    ·R   R··                                                                                    ",
        "                                      ·········1···RR·· ····                                                                 ·B·1·  ·······   ···  ····B                  ··         R·       R· ·1   ···  ······· B                     ··                                                                                                          ",
        "                                            R·····R··RR  ··                                                                  ····   ·1······ ····  ·1··B                 ····            ···  ·1···  ··R·   ·· ··                                 ··      ·R        B                                                                                ",
        "                                               RRRR··R                                                                       ·1··R  ···  2·· ···2  ···BS·                ··P··    ····   ···· ····   ···2·             B B              ··    ·1· ···   B···R      B     B ··                                                                        ",
        "                                        ·· ·R· ·······                                                                        ····   ··  ··  R··     R···                 ·····  ···1··   1·   ···2·  ······         B                ·1···   ·····2·    ····             ····                                                                       ",
        "                                       ····R ·········R·                                                                                      ··                    ····    ···  ·····R· ···B·   ···   ······      B                  ······  2······    R·S·     ··  B B R····                                                                      ",
        "                                       ·········R·····P·                                                                         ·R ·1·              ··1         ···B··1·   ···   ······ ···1·         ······    B    B                ·1 ··  ··BB·     ····     ···1      ····                                                                      ",
        "                            ··         ·R····R··R····1··                                                                   ·1·  R···B···            ·····        ···R····    ·2  ·2··R     ···           ··2·         B BB                     ···      ···      ····      B···                                ···R                                  ",
        "                           ··1·          RR····R·  ·B···                                                                  ····· ·1······      ··    ·····       ·B1·· ··         ··                       ··       B        B                                    ·BB··     ·1·                               ·······                                 ",
        "                           ·R··          ···R··R     ··                                                                ·  ··1·· ·B···B··     ····    ··    ···  ···                                                    ·R· B                    1·                ···B                                       ·······                                 ",
        "                            ··           ····                                                                        ·1·· ···    ·· ···      ··S·          ··B  ·1·B·1                                           B    ·1··                     ····               ···B    B                 B           ···  ··2··               ···                 ",
        "                           ····2·         ··                                                                        ·····                     ··   ····  ·11·B· ······                                             B   ··· B                   ··P·      ···       ·B                        B         ·2··  R·····    ····     ··2···               ",
        "                           ······                                                                                   ·B·1·     ··      ···          ··B·· ······  ·R·                                                B  ··                       ···      B···          B          B ··     B           ·····  ···P·   ·R····    ······               ",
        "                            ····                                                                                     ··     ··1···  ····1·         ·····    ···                                                 B          B                           ··1···   BBB   R             B··  ··              B··    ···  2··R··B· ·· ····R               ",
        "                                                                                                                            ······ ·R·····         ·····   ···     ···                                            B     B B  B                         ····R·  ·BBB·B                ··  B·   R·       1··B·         ··· ·2·· ···1·B·· B             ",
        "                                                                                                                       ···  ······ ···1··           ···    1··    ·1····                                      ··    B  B                               ··1··  2·BBB··                    ·1·B···       ··1·          ··· ··   ···· ··   B            ",
        "                                                                                                                     2····· ·R··1·  ·R·                           ···B1·  ···                                ··S·       ··· B                           R··   ·······      ·B        ··  ·······        ···           ··      ··RB   ···             ",
        "                                ·· ··                                                                                ·····B  ····                      B  ··    B B1·R·· 1····                       ··      ·····   B ····  B                ··              ········    ···     ·R···   ····                                       ·R···           ",
        "                               ··R··2·                                                                                ····                      B        ··R· B       ·  ······  ···                ··S·    ······     ·1···                ··1·               ··P····    R·   ·· ·····                                ··B           ·······         ",
        "                               ·······                                                                                                     B             ·1··    ···     ···P·· ·····               ····    ·P···       ····  B            ····                ·····1     ·2 ··2· 1··B                                2·· ··  ···  B  ······         ",
        "                               ······R                                                                                       2·               B          ·1·· B·1··R·     ····· 1····  ····          ···     ···    ·R   ··     B          ·1·1                            ·····   ···                                ··· ··· ····  ·1·B··2          ",
        "                                ····2·                                                                                       ··           B              ··  ········       ··  ·····  ······                    B ···R      B  B          ···BB                  ···      ·2··                                       ·2····· ····· ···· ··          ",
        "                                  ···                                                                                        1···                             ·B·1··  B           ··· ·····R·        ·· ··    B B ··1··   B ···             ····                  1·R·      ···                                   ··   ·B·1··  ···2  ···             ",
        "                                ·      B                                                                                ··  ···1·           B  ····   ····  B ···        B   1·       ·1·····       ···R··R       ·····    RR···                                 ···R·                                          ·····  ··R··   ····                  ",
        "                             ····                                                                                      ··1B·  ··              ·1···  ··BB···        B       ·····      ···R·        ·······      B··B··B   ····· B      ··    ···              ··R····                                       ·· ····2  ····     ··                   ",
        "                             ··R··  ····                                                                               ·B1··                  ···R·· 1·BB···                ··B·· ···    ··    ··2  ·1···2     B  ·R··      ··B·       ·1··  ··B···            ·1····                      ··           ·R  ·1· ····                                 ",
        "                            ·1···· ·····B·                                                                             ·····   1· BBB    ···  1····· ·······         B       ···  ·2···      B ···· ··B ··         ··R   B  1···       ···1  ····1·            ···B                       ···          ···· ···  ··   ··            ···              ",
        "                            ····R·   R····                                                                              ···    ···BBB·  ······  ···R  ·····  2·  ··                ····   1·   ···R             B      B B  ···  B     ·B·     ···              ··                        ···      ··  ·······R      ···2          R···              ",
        "                      R       ···     ···                                                                                      ·P·BBB·  ··B···  ···          ·······       B   ··  ···· ·····   ·· B             B ··           B     B B1                                                ·P···  ··2·   ···2·        R···          ·2P·              ",
        "                                  21·                                                                                          ·······  ······               ··S····         ···1·   2  ·R···     ··              ·R··       B      ··· ·· ···                                            ····· ······  ·R··         ···            ··               ",
        "                                 ··R·                    ··                                                                     ·····   1····                 ······         ·····      ···R·   ···2·          B ····R        B   ···1·    ·R· ···                                         ··2  ··B····                                              ",
        "                                ·1RR·                  ·····                                                                                        ···        ··2·          ··B         ···  ···1··R         B  R····   B  B    ······    ·····1·                                               ·· ···              ·RR·        ···      ··         ",
        "                          ··    ·····                  RR·S·                                              ···                     ···· ··           R···                      ··   ···        ··R····         B  ·2·     ··      ·····   B  ······                                                  ·2              ······   ·· ·2··     ····        ",
        "                         ·2··    ···                     ···                                            ··1··             ···    ·BR··R··          ···S·                          ··R··  ···    ···               ··   ···RR·    ···P·        ···                                                             ···   ·1····   ········    ····        ",
        "      ······        ··  ····R                                                                           ····             ·····   ····B·1B··        ·····        ····        ··R·  ·1···· 1····                 B       ······· B   ···                                                                       ·R···  ·· ·2·   ·1···R··     ···        ",
        "     ··1··R·      ··1·  ·R···                      ···            ···                                  ·····R·   B       ·····   ·1· ······        ···         ·······      ····R· ···R· ···1·                B        ··1··B·B                                                                     ··      ·······    ··     ··  ··  ··  2·  ··     ",
        "     ····2··     ·R···R ·· ·   ··  ··             ·P···      ·R ····1·                          ··    ·R·····2·           ··R·    B·   B1··                    ·······       1···· ·····  ····                          ······                                ··                                   ··R·     ····B··                  ····    ···R    ",
        "     ···R·B      ··2···       ··R····             ·····  ··· ·· ··R···       ··                ·BB·2  ··2   ···           ···          ···                     ·······       ··B·   ···                          ···      ···  B  B                          ····                                  ·2··     ··· ··               ··· ·R·R·   ·R··    ",
        "     ·R·····  ···  ··R· · ··· ·2···2·        B      2·   1···1  ·R····      ····               ·BB··   ··                                                      ·P····                      ··                   ···1 B                                       ····                                  ···· ··  ··2·                ···· ··R··    ····   ",
        "     ······· 1·P·  ··R  ···1·  ···R··             B     ····B··  ···2       ··S·               ·····         ··  ···                                           ·······   ···              ······                R···   ··                                    2·          B                           ·1·B·   ···                ···  ····   ····2·   ",
        "       ····  ····       ·····  ··R··                    ··1··B·              ···           ··    ··          ··2 ··R·                                           ·· ···  2·····            ···R···               ·········     B                                        B                              ···                        2·  ·1··2  ·1··     ",
        "             ····        ···    ···            B    ··    ·· ··  ··  ··              ··   ···12       ·2·   ·1BB···R·                                                   ··S···            ·· ··1·               ····BB···                                                                                                              ·R·    ··     ",
        "              ··                                   ·1B ··        ·1·R···   ····     ···2  ······      ····  ······2··                                                   ······                ··              B  ···BB··   B                                ··                                                ···                                    ",
        "                                                   ·····1··      ·····R·  ······    ····   ·1···     ···B·   ·R· ···   B              ···                               ·····R         ····R·                      ····                                    ··B·                                              ····                ··    ··            ",
        "                                                 B  ··1··R·      ···1··   ······   ····      ··      ·····               B            ·2··                               ····        ··R······                  B       B B                                ······   ···                                      ··S·               ···1  1··            ",
        "                                              B       ··1·        ··     ·B·····   ·····              ··       B                      R···                                     ···   ·········                     B  B                                     ·1···· ·R··                                       ··                ·2··  ·2·            ",
        "                     ···                                             ··  ····      ····R ···              ··     ····                R··S·                                    ·BB·· ··········                   B  B  B                                 ·· ····1· ···1··                                                       ····   ····          ",
        "                    ·1···                            B  ···         ···1 ···        ··   ·1···            2··    ··BB·                ··                                      ····· ··1··  ··                                                           ···   ··B   ·1···                                                        ··  ····1·          ",
        "            ···     ·RR1·                              ·····        ·RR·      ··      ·1···B1·  2·     ····2·   ···BB·                                        ··            ·B····  ·····                                                               2·R·          ··                                                              ·B··           ",
        "           ····B·    R···  ····                   B    ··1···      ·R····     ·1·     ·B·1···· ·····  ······R   ······                                   ··· ·S·            ······   ···                                                               ··1··                                                                       ··                ",
        "           ···1··    ···· ··R···    ··                ·1B···2      ·····2  ·· ···      ··B··   ·····  ·R·····    ···                                    ···R ···            ··1··                                                                      ···             ·· ··                                                      ····               ",
        "           ···1··        ·1R·1R··  2···               ···· ··      ·····  ·1B···                ···    ····                                             ··1· ··               ···                                                                      ····            R··1··                                     ···            ··S··               ",
        "            ·BB··        ········  ··B·                ··           ··    ·····1·                   ··                                            ···   ·1··                     ··                                                                     ··             ··R···       ··                           ···S·           ····                ",
        "            ····           ·· P··  ····                      ·· ··         ··R···            ···1 ·····                                   B      ·····R ··                      ·1··                                                                       ···    ··   ····2·       ···        ··   ··           ·R···            ··                 ",
        "                              ··    ··                       ···2·· ···                     ···R· ·····2                                         ·B····              ········  ·R·B·                                                                       ·1··  ····· ··R··       ··S·       ·1·· ···             ··                                ",
        "                                                             ··R···  R··   ···              ····  ······          ·····                          ····2·  ··         B········1 ····                                                                       ···1·  ···1·  ··         ···        ···· R···                                              ",
        "                                     ·1R ··                   ·· 1· ····  ··1B              ·P··   ·2··          ·······               BB     ··  ····  ···          ········   ··                                                                        ·R···  ····                        ····R ····   ···                                        ",
        "                               2··   ····R·                      ·· ··1·  ·······           ·····  ····         ·····R··  2··          BB   ··R·        ·2···                                                                                             ···     ·R·          ····          ·R·1·  2·   ·····                                       ",
        "                         RR    ····· ·1····                          ··    ·1····            ····               ·1·B···· ····· ··           ·2····      ··R··         B                                                                                                        ··2·           ···        ···S·                                       ",
        "                ···     RRRR    ·1R·  ···                                    ···              ··                 ·  2··· ····R 1···         ······       ···                                                                                              ··       R··        ····R·  ··     B            R···                                       ",
        "               ··S··   ·RRRR·· ·····                                                                                ···    ··· ·····    B·R  ··R·                                                                                                        ·····    ···2·       ·1···· ··B ·1 ···B    ··                                               ",
        "               ····R·  ·R·RR1· ·1R·                                                                                            ··2··  2·····  ··        ··                                                                                               ······2  ··2····  BB  ·R··· ·1··R· ·R···  ··1·                                              ",
        "                ·R··2  ······· ··                                                                                          ····  ··   ···P··           ·R···                                                                                              ······  ·R····B  BB   ···· ··1··· ···12  ···R                                              ",
        "                  ··    ·R·                                                                                               ·B···        ····            ····B·                                                                                             ······    ·····             ··R·   ·R·   ····                                              ",
        "                                                                                                                         ···B····                      ·B····                                                                                              ····      ···                           ·1·                                               ",
        "             ····      R1R    ····                                                                                       ···  2··        ···      ·R·  ···2··                                                                                                                 ··2               B   ··                                               ",
        "             ·R···   ··RR·  ··1··R··                                                                                     ·2·  ··        2····    ·····  ·R··                                                                                   B                       ···    ····· ···     ·R·2      B                                              ",
        "            ······  2R···   ·RRRR···                                                                                      ··            ··B··    ·2···                                                                                 ····                           ·····    ·1·· ·R··   ···R·     B                                               ",
        "            ·1R···  ·R·RR1· ···R····                                                                                                    ····      ··B·                                                                                ······   ·B·                    ··P···   1B··  ··1·  ·····                                                     ",
        "          ·· ··      ··R·R·  ·······                                                                                                     ··  ··    ··                                                                                 ···1··  2···  ····              ······  ···B· R···R·  ···                         ··· ··                       ",
        "       R· R·           1R      ····                                                                                                         ··2·                                                                                      ····RB  ···· ··R···              ·· ·2  ····  ·2····                             ··1······                     ",
        "       ······          ··                                                                                             ···                   ····  B1·                                                                                  B2·     B·  ···2···                          ······                      ··     ·····1···                     ",
        "       1·1R··                                                                                                        ··1···    ···         ·R··· ······    ····                                                                                    R······                           ···R                  B   ··1 ··  ·R·· B···                     ",
        "       ·····          ·1    ··   ·2 ···                                                             ····    ··       RB···B    R·B·        ··R·  ······  ·······                                                                                        2·                                                    ····  ·· ··B    1·   ··                ",
        "        R·          ··RR·  2··· R····B·   ··                                                   ··   ·····   ·1·       ··R·      ···         ···   ··2··  2······          ···                                                           ··           B ···                                                    ·1B····· ·R·   ··   ····               ",
        "             ··    ······  ···· ··R···· ··1·                                                  ·2··   ·R··· 1···                 R··                ··R   ·R·····  ·2·    ·BBB·                                                         ···R            ··                                                 B    ····1··  ·· B     B1···               ",
        "      ····  ····2  ·1RR··    ·· ·1R·P·· ······    B                             ···           ····· ····P· ····                ···                        ····    ····  ··BBB·                                                         ·P·· B                                                                  ···R··     B        ··                ",
        "    ·2RRB·  ·····   ····        ··· ··  ·1···2·                                ·····          ··B·· R· ···  1·         ···              B·                        2·P·  2·BBB·                                                          ···                                                                     ··                 R·                ",
        "    ·R··R1 ··BBB·          ·R    B         ·R··                                ·2···     ····  ··   ··R··             1·1·B           ······                      ···   ······                                                                                                                                ··         ··                          ",
        "    ··R··· ··BBB·         ····             ···                                   B··    ······       ···             B·····           ···B··   ···      ····             ···· ···                                                         ··   ··          ··                                  B             ···1·      ···  ·· B  ·1                ",
        "     ····· ······         ·S··                                                   ···   ··1·B···R BBB                 ······           ··1···  ·····    ·····         ··  ··· ·R····                                                      ···2 ·1·         ··S·                                B              ··P··      ·····B·  ·R···               ",
        "            ····          ···                                                  ·1···   ···B R··· BBB                  ·R··             1···· ···B··    ····B        2···     ····R·     ··                                               ·R·····          ····                                               ·····   B  ··1····  ·····               ",
        "                                                                               ···B·   ·2·  ··2· BBB                                   ·· ·· ··· ··    ·····        ··B·     R1R···    ·1·                                               ··2····          ··                                                  ··R     B ·······   ···                ",
        "                                                 ···                            ···          ··                                               ·1        ·2·          ···     ···R·    ····2·                                              ····                                                                           ·····                       ",
        "                                                 1··                                                         ···                                                     ··       ··   ·· 1R··R·                                                           ···                                                    ·1·     B                              ",
        "                                                 ···1·                            1·                        ·····                            ···         ·R               ·R·     ·B·R   ···                                                          R····                                                  ····  B                                 ",
        "                                                B ····                           ····                       ·····                  ·· ···    ·RR··     ··R·        ····   ·····   ····  R··     ···                                                   ····1 ····                                             ··R   ··                                ",
        "                                                  BB··                           ····                       ·P·     ··             ··R··1·   ·····    ···R··       ··RR·  ··1·R   ··2   ··     ··S·                                                    ··   ·P···  ···                                       ····RR··                                ",
        "                                        ···        ··                            ···  ···                   ··· 1· ····            ···B···   ·1···    ····1·      ·····R   ·RRR                R···                                                          ···· ··11B                                      ········                                ",
        "                                      ··R···                                         ·····   ···             ·· ····B··             ·1 ···    ···     ···1·       ·2····   ····      ····       ··                                                          1·RR  ·····                                      ···B··1·                                ",
        "                                     ·······                                     ··· ·1···  ·····               ··1··                  R·              ···         ···1··   ··      ····R·                                                                 ······  ···                                         ·····                                 ",
        "                             ·····   ·2····· ···     ···    ··                 ····· ·····  ·1·RR·               ···                                                ·· ··      ··   ·R·1··        ····                                                     ···1··                                                                                    ",
        "                            ·······   ··  1 ····2   2····  ·1·                 ···R    B··  ···R··                                                                          ·1··P·  ·R··1·  2··  ··1····                                                    ····                                                                                     ",
        "                            ·······         ···R· B ·R···· ·B··                ·BB···  ··     ·R1·                                   ···                              RR··  ·RR···  1··R·  ····R ·······                                                                                                                                             ",
        "                             ·· ·2  ··1· ·  R· ·1   2·R··R ····                ·BB··R           ·R                                 ·····   BBB                       ·R·1·· 1R···          ··B·· ·RR··1                                                                                                                                              ",
        "                                    ·R·····          ·· ·· ··R·       ····     ······ B                                            ·1··1  ·BBB·  ···    ···          ······  ·R1   ··      ····· ·R····                                                                                                                                              ",
        "                             ··     ··B··1·     ····       ·1·  2··  ······     ···R            ···                                ···B   BBBB· ·····  ··S··         ··B···  ···· ····     ·R··   ····                                                                                                    ··                                         ",
        "                           ·1···     ·· ··     ······       ··  ·R·· ···S··                   B ····                                ···  ·····1 ·B11·  2····          ····    ··· ··R1                                                                                                                   ··· ··                                      ",
        "                           ·····               ·1B1··           ···· ·· ··        ··            ··P·                                     ······   ···   ····                      B····   ····                                                                                                       R·  ····S·                                      ",
        "                           ···       ···       ·· ··       ··    ···             ···        ··   ···                                      ··1         B ··1                       ·····  2····   ··R2                                                                                                ·2·  ·····                                      ",
        "                            ··    ·· ·1·                  ···2                   ·····R    ·R··1 ··                                                                                 ··  ···R1  ·1··R·                                                                                                 ··  ··2·                                       ",
        "                            ·2·   ·1···R·                 ····   ··· ··          ····R·  ·····R·                                          ···  B  ····    ···                           ···R·· ·R·R··                                                                                              ·· ·R·      B    ····                             ",
        "                             ··   ···B1··                  ·R·  ·1···B··         ·R····  2···1··                    B                    ···B    BR·B·· ······                           R·RR· ·R· ··                                                                                             ·R··1··          ··R···                            ",
        "                                B    ···           ···          ·····1··          ····    ····               ·B      B                   ·1··1  ······· ······                             ··· ·R1                                                                                                ··1····  ···   ······1·                            ",
        "                         ··  ·1           B        ····   ····     ···B·                                   ·····                         R····  ·1· ·R· ··P···                                  ··                                                                                                 ····    ·R··  2··· 2··                            ",
        "                        ·······   2·                ··· 1·B····      ··                                    ·S···                          ·R·    ··      ···1                                                                                           ···                            ··                 ·2···   ··                                 ",
        "                        ·1···R  ·····   B      B   ···  ·2·····         ··                                 R····                                                                                                                                        ··1·                          ·P···            B ······                                      ",
        "                        ····1·· ·····                   ··· ·1· 1·   ·1····                                 R··                               B         ·· ···                                                                                         ·····                          ·····        ··    ·B·B1     ··                                ",
        "                        ·B· ··· ·····             ···       ··  ···  ······                                                                    B       R······                                                                                         ·1···                          ····        ·1···   ····    ····                               ",
        "                         ··      ···              ····          ···  ·····                                                                             ····RB   ··                                                                                     ···B                            ·2         ····2·        B ··B· ··                            ",
        "                                                   ·S·           ·· ·1··                                                                   ···         ·1B··1· R····                                                                          ····      ···                                        ·R···   ···     ·······                           ",
        "                        ··                         ··               ···                                                                   ·2···         ···R·· ····B                                                                         ······                                              B   ··   ··2·      ··1···                           ",
        "                       ·····          ·R·    ····                                                       ····                              R···B          ····  ·····                                                                         ·S· ·2     ·····                           ··               ·R····      ··2··                           ",
        "                       ·1··BP·       ···R·  ·····R              ·· ··                                 ·······                  B          ·····                 ···                                                                           ··       ·R··B·                    R···  ·····             ······      ···                             ",
        "                       ····1··       ···B· ··BB···              ·1·B··                               ···S····            ··B    B          ·B                                                                                        ··                ··2···                    ·1·R· 1····             R·· 2·              ··                      ",
        "                       ·B· ··         1·1· 1·BB···   ···        ·····2··                             ··········         ·BB··         ··                           ··                                                                ···          ··   ·· 1··                     ··R· ···1·             ··       ···      ·····                     ",
        "                        ··            ··   ····P··   ····         ····P·                             ····R ····         ·BB··        ·1··   ·2                    ····                       ··B·                                   ····    ···  ·1···    ··                   ·1·····   ··   B                  ····      ···S·                     ",
        "                       B                B  ······2  ·1···             ··                              ··    R··         ·····     ·· ····  ····  ··    ···        ····                       ····                                   ·2···  ···2  ··B·1··                       ······   B            R···        ····      ·····                     ",
        "                                            ·R ··   ···B               B                                    ··           ·R       ··1···   ·P·· ····· ···2         ··2                       1····                                   ···R  ····  ··R····                       ··B·     ··R·        R······      ····       R··                      ",
        "                                                    ·1···                                                                         ·······  ···· R···1 ·R····                               ·B·····                            ···   ··1     ··    ·····                    ··   ···   ··B1···       ···P···  ···  2·                                 ",
        "                                                      ···        B                                                                 ·RR···  ···   ···   ······                              ·B·····                           ·2···  ···                 ···              ·····        ·····R·       ······· ··R·      ···                            ",
        "                                                                                                                         ··           ·B    B            B2··   ··  ··                     ····1·                            ·····                     ·2···            ·R···2·  ···  ·······        ······ ···R·    ·····                           ",
        "                                                                                                     ··                  ·SR·       B     B·              ··    ··· ·R·     ···       ··    ····                             ···1·                     ·····            ··2· ·· 1·R·· R··R·           ·2··  2····· ······2                           ",
        "                                                                                                    ·2··                 ····        B   1··   B       B        ·2····2  ·· ··1·     ···             ···                      ···                  ···   ··              ··     ····· ·1··                    1··· ··B··R                            ",
        "                                                                                                  ······     ···          ··            ·1··    B    ·1         ··R··1·  ·2·····     ··2··         ·2····R                        ··              ··1·  ···                      1·R·                        ··1·  ····   ·R R···                    ",
        "                              ·······                                                             ·2··B     ···2·                       ·B·         ··1·          ····    ··B···     ····· ·· ··   ·······                      1·BBB             ···   ···           ···       ···R·  ····            ··    ···    ··   ·R····2··                   ",
        "                             ·BBBBB···                                                             ·R·      ······  ·· ··               ··· ···     ·B··                   ····       ···  ·····2  ·R ··2·                      ··BBB·            ·2···              ····   ·2  ·1··   ···1·      B   ··1·               ··1····R·                   ",
        "                             ·BBBBB····                                                                     ····B· ····1··                  ···B··1 ···    ··     ···                  ··  ··P···     ···               ···     ··BBB·            ·····              ···1· ····        ···1B          R···               ···· ···                    ",
        "                             ·BBBBB····                                                    ·B          ····  2·R·· ····1··             B     ···2··        ·2··  ··1·      ···             ······     ·R               ····      ····     ····     ···              ···B·· ····         ·R             1·                 ··· ··                     ",
        "                             ·BBBBB····                                                   ·B·1·       R·····  ···   ····                    ·2·····      ····R·· ···      ·····        ··   B····                      ··S··            ·1···2··                    ·2·· B ····             ···                                                      ",
        "                              BBBBB·B         B                                           ····R·      ···P··          B                    ·B·· ··       B·····R  ·B    ··R··2·      ··B·R  ····                        B···     ···    ·B······ ··1                 ···    ··             ·B11B                     ···          ···                ",
        "                               ······       B                                             ···1··       ·····                               ····           ····2· ·1···  ·······      S·R··            ···               ····   ·····2·  ·······B ····                                  ··· ····   ··            B   ···2·     ··  ····               ",
        "                                                                  ···                      ·····       2····                                ··            R· ··· ····2  ·1····       ···B·            ····               ··    ·······  ·R··  ·· ····          BBB               B    R···  ··    ···   ···         ·B···     ·····1 ·               ",
        "                                                                  ·2··                     ·R···         ·R    B                                                   ··    ·B           RB               ·R·                      2···P·            ··           BBB                     11      ·· B1·  ··1···       ·····      21···                 ",
        "                                                                   ···                       R·  ····R·       B                                        ·R··                                 ··     B   ···                      ···R·                          BBB                      ·· ··1···1 ··  ····RR·       ··R        ···                  ",
        "                                                                 ···B                           ·B··2···                                              ······              ···         ·B    ···      B1···                       ····                                                  ·R· 1···P··     ·B·1····                      ···             ",
        "                                                                 ·2···                          ···B····                                              1··B·2            ······        ···· ····      ····                                                   ····B                     ·1··  ·····      ··  ··1·       B             ·····            ",
        "                                                      P···       ·····                          ···  ···                                         ·· ··  ···             ·P·BB·        ·RR···1··       ··                                                  ········                     ··                  ···         B            ··P··            ",
        "                                                      ···1·       ·R··                          ·2·  ·R                                         ·1··R··     ··     ···· ···BB·        ·RR·····                                                            ····R···                 ···    ··   B         B                          ·····            ",
        "                                              B      ··R···            ···                       ··                                             ·······    ·R·    ···R·   ····         ·····                                                               ···  R· B               ·1··  ··R           R·        ····   ···          2·              ",
        "                                            B   B ·· ·· ··           ·2····               ··· B       R··   ·RR·                                ···1··     ··1··  ·B···· ·····                                                                              B       B              ·1··  ···R         1···      ····1   ····                         ",
        "                            ···                   ···                ····B·             ········   ·R·····  ····                            B      ···       ···  ·····1 ··1·                                                                            ···                        B··   1··      B ·1·B·      ·1··     R··· ··                     ",
        "                            ·1·          ··     ·2 ··                ·B····             ·1···2··   ····1·· B····                           B                ·····   ···                                                                                  ·R·    ··                     ··      ··    ·····  ·2  ···1  ·· ··1· R··   ··               ",
        "                           ·R··         ··1··   ····R                 ·2··              R······    ··B···· ··11·                                 B   ··R    ···2·         ··                                                                             ··1·  ····                 ·· 11··  ·····    ··· ····    ··  ··R···· ··2  ··B·              ",
        "                          ·····         1···· B  ····                  ··               R··  ··     ····    R··   B                                 ··2·     ···   ··    ··1· ··                                                                         ·······R··                 ·1···R·· 1·S··        ·P··         ·····   ··  ··1··             ",
        "                          ·1·B           B···   ···2·                                                                                   B      ··   ···           ····   ······2·                                                                         ·········                   ··B 1·  ···         ···    B  B   B   B       ····             ",
        "                          ···B            ··    ··R·                                             ··     ··2B·                         B     ····1·   ··           ··S·   ····B1··                                                                          ······                                          ··     B    B            ··2              ",
        "                           ··       B            1·                                     ··     ·2··   ·······                             ··RB····                ···     ··· ··                                                                                                          ··R                              B        1···             ",
        "                                     B                                                  ····· ·····   ·B··11·                             ·1······                                                                                                                                   ·2   ····                              B       ····             ",
        "                                                ···                                     ····1 ······R ··R···                              ·····P·  B                                                                                                                                ····  ·····                     ·    ··          ··              ",
        "                            B                   ·R··                                     ···  ·2·····   ···                            B   ·····   B                                                                                                                                ·P·R ······                     ·R··1··                          ",
        "                           B                      ··                                             ··R                                                 ··                                                                                                                             ···· ····1·                     ·······                          ",
        "                        ···        B··    ·· ··   R·                                                                                        ··    B ····                                                                                                                             ··· ·· ··                       ······                          ",
        "                       ··RB··     ···· 1·B·· ··R ···                                                                                        1·· R· ·2···                                                                                                                             ··                               ····                           ",
        "                       ·1····   ····2· ····1 ·······                                                                                       ······1 ···R·                                                                                                                                 ··                           ····                           ",
        "                       ····R·   ·2···   ···   ·····                                                                           ··           ··1···· R····                                                                                                                                ·1··                                                         ",
        "                        ·1···    ···                                                                                         ····            ···    ···                                                                                                                               ····B·                                                         ",
        "                          ··                                                                                         ··      ··BB                                                                                                                                                     ·2···                                                          ",
        "                                                                                                                    ····     ··BB·         ····RRR     ···                                                                                                                             ···                                                           ",
        "                                                                                                                    ··S·      ····        ····R·S·     ····                                                                                                                                                                                          ",
        "                                                                                                                      ··       2·         ····R···   B ····                                                                                                                                                                                          ",
        "                                                                                                                                          ·····  B      2·                                                                                                                                                                                           ",
        "                                                                                                                           B               ····   B                                                                                                                                                                                                  ",
        "                                                                                                                    ····      ··            ·2        B                                                                                                                                                                                              ",
        "                                                                                                                   ···1·· ··  2··   ···                ··                                   ·1  ··                                                                                                                                                   ",
        "                                                                                                                  ··B···· R·····1 ·1···         ···   ······                                ···B·1·                                                                                                                                                  ",
        "                                                                    ···                      ··                   ·1··R·  ·····B· ····1·     ·· ····  ··R··2                                ··2····                                                                                                                                                  ",
        "                                                             ·· R·  ·P··                    ··· ··                ·····    ···R·  ·R····     ······2  ·······                                ··RR··                                                                                                                                                  ",
        "                                                            ··· ··· 1···                    ··1····                ··      ··2··    R···     ·2··1     R·····                           ···   ···R·                                                                                                                                                  ",
        "                                                            ·····2·  ·R                       B··1·              ··         ···     ···       ····      ··2                            ····2  ·R·                                                                                                                                                    ",
        "                                                            ·1··B·            ··             ······             ·····                         ···        ··                            ·S···                                                                                                                                                         ",
        "                                                             ···        ·1   ····   1··      ··R··              ·····              ···               ···                               ····     ·· 1·                                                                                                                                                ",
        "                                                             ··R       ·1·B· ···· ···2·       ··                ····               ··R·     ··      ····                                ···     ···1··                                                                                                                                               ",
        "                                                                       ····· 1·   ·····                         ···  ···     ···  ·B····   ····     2····                                      ···R···                                                                                                                                               ",
        "                                                                        ·R··      ··B·        ···                ·2  ·····  2···· ····1·   ····      ····                                      ·2·····  2··                                                                                                                                          ",
        "                                                                        ···        ··   ···  ·1··                     ····  ····R ·1··      ·2  ····  ··                                        ·····   ····                                                   ···                                       ··B                                         ",
        "                                                                                       ··R·· 1····  ···              ··P··  ··R··   ··          ··1··                                                  ·····                                                  ····                                ··    ···1                                         ",
        "                                                                         ·1        ·1  ·1·B·  ·B·· ···R·             ·····    ··                ·B1·R    ···                                           ··BB·                                                  ·P· ··                             ·B···  ·1·· ··                                      ",
        "                                                                     ·······      ·R··· ···   ··B· ·1···             2···          B              ··    ·····                                    ·2     ···  ··                                           ··  2·R···  ····                       ·····  ··R·····                                     ",
        "                                                                    ·BBB····      ····· ··     ··   ····                      ···B  B                   ·R····                                  ·B··        ···                                         ·2··    R·1· 1·····               ·2  ·· 1··2    ····2··                                     ",
        "                                                    ··R  ··         ·BBB····      ··1··          ··  ··           B   R··    ··R··1                       R·S·                                  ····        2·1·                                   ···· ·····R   ··  ··BBB·              ····1··  1·      ··R··                                      ",
        "                                                   ·1·· ····        ·BBB···   ·R· ····         · 11·                 ··2··   R···1·                    B  R···                                  ···   ··   ·····                                   ···1·  2··R·      ··BBB·              ·B····   ··                                                 ",
        "                                                   ····B·1··         ····   ·····              R····  1·             ······  ··RR··                   B    ··                                         S··  ···R· ··                             ·· ·R···   ·B··       ·····               ·····            ··                                        ",
        "                                               ··1 ·B···R··                ·R·····             ····· ·····            1···R    ···                                           ··   ··R·         ···     ··   ··· R···                            ··1·R··     ·1          ··                 ···            ····                                       ",
        "                                              ····  ·····                  ··R··2·              ···  ···B·            ···R                                                  ···1 ··2···       ······   B         ·2·                             ····                                              ···    ····     ··                                ",
        "                                              R····                        ···1·                     ·1··                        ·B                                        ··P·· R·····       ······          ·1····                           ··         ·R ···  ·· ·2                    ·· ··  ····    2··     ····                               ",
        "                                                ·B·    1··                   ·B·           ···        ···               ···     ····                  ···B                 ····· ····2        ·R· 1·          ······                          ····   ···  2·R·1· ·R·R···                   ······ ··2·            ··1·                               ",
        "                         ··               ···  ····   ·····                              ····2·   2··                  ··1· ··  ·S··            ···   ·····                ·····   ··  ···     ·2              ·R··                           ·B·1 ·R·R· ····R·1 ··1·RR·                   ···1··  ··            B·1··                               ",
        "                        ·R·1·            ··R1  ··     ·····                         B    ······  ·····  ·R·            ·B···1·   ···           ·····   ··1·                 ··2       ·B·R·    ···   ··         ··                            ···  ····  ·1··R·  ·· ··R                     1···         ··      ···                                 ",
        "                        ······           ·····         ···                           BB   1····  ····· R····           ·······                 ··P··  ·1···                           ···BB     ··  2··1     B·                                    ··11    ·1·         R·                    ···     ·· ··1·                                         ",
        "                         ·B1··           ·1···R· ··                                ··   B   2··  2···· ···P·              B·                   ····2  ·····                           ·····         ·····1  ···                                     ···   B            ···                           ··1····  ·R ··                                  ",
        "                     ·2  ···              ······ ·2·   ·····                      ···  ··   ···   ··   ·R···                                     ··    ···                   ··       ·2··          ·2····  ····2                                           ···R·     R··S·                           ···B··  ····B·                                 ",
        "                    ····     ···R·         ····  ··R· ······                      ·2· ··1·  ··         ···1                                                              ··2 ·B·       ··   ···      ····   ··B··                                    ····  ·R·R·1·    ·····                     ··  ··  2·     1·····                                ",
        "                   ·····     R····  B             ··1 ·B·1·1·                     R···2···              ···                                                              ·2·····    ··    ······             ···                              ··    ··R·R· ·R·····      ··                      ·1··R··         ·B·1·                                ",
        "                   ·· R      ··1··      ···    ······ ·B·· ··                     ···R···                                                                                 ······   ····   ···1B·                                             ····  ·P··R·· ···1··                               ···1···   ···  ····                                  ",
        "                              21·     ·····    ····1·  ···                         ···                                                                             ·· ···   R··    ·····  2··1         ·2                   ···              R1··  ··R····  ···                     B              ··R  ·····1 ···                                   ",
        "                  ···  ··             ····      ····                                                                                                               ·1···R          ·····  ····        ····                 ·R·1··            ···B· 1··1·R·                                              ······                                       ",
        "                 ······2·   ··    ···  2·                 B                       R· ·                                                                             ····2·           ····   ···        ·P···                ··R·1··      ····  ····   ····                             B            ··   ···P··                                       ",
        "                 ·2······  2··   2··P·           ··                              ··· ··                                                                             ·R···            ·1               ·····                 ······  ·· ··R·1· ···                                   ··           ··R··    ····                                       ",
        "                 ·······   ··    1····          2····    ····  B                 ··  ··                                                                               ··                               ···                     B·  2·· ····R·        ···                           ··R          2·····   ·····                                       ",
        "                   ···     ·R··  ··1··          ······   ···S·            B      ······                                                                                              ···                                B          ··   ····        ··1···                         ·····       ······B   ····                                        ",
        "                            ···   ···           ··P···   ·····     B              ··S·                        ·····                                                 ··              ···2                                                ··R·        ·······                        ·S···       ···1···        ···                                    ",
        "                           ·S·                  ······    R··    B                 ··                        ···S···                                               ··· ···          ·····                                      ·2·                   ····2·                         ····       ·B···         2·····                                  ",
        "                           ···                   ····                                                        ·······                                               ····BB··          1···                                     ·····  ··      ·· ··   ·R····                          ·R         ···        B ··BBB·                                  ",
        "                                                                                                             ·· ····                                               ····BB··          ···                                ····  ··R·· ··1··   ·R··1·· ··· ··                                          R··       ·BBB·                                  ",
        "                                                   R·· ··                                                       ··2                                                 ·······                                            B····· ·R·   ····B· ···1B··· ·R·                                       ··    ·····2   ··BBB·                                  ",
        "                                                   ····1·      B                                                       ··                                             ···2      ·· ··                                  ·1·1·· 1··· ··RRR·· ·R····R                                          ····R   ··1····  ······                                  ",
        "                                               ··1 ·1·B··                                                             ····                                                      ·····                                  ······  ··· ··2···   ··R·                                            ·1···   ·······  ·· ··                                   ",
        "                                              ···· ···B··                                                         ··  2···                                                ····  2··B·                                   ····        ··                                                       ·····  R···1·                                           ",
        "                                              ·BB   ···    ···                                                    ·R·  ··    ···                                         ·····   ···            ···                                                                                             ···  ·R··                                            ",
        "                                              ·BB·        ······                                          ··· 1·  2··     ·······                                        ······                 ·1··                                                                                           ··2·                                                  ",
        "                                              ····        ··BB··                                          ··· ·R·····     2···BB·· ···                                   ·······           RRR   ··R·                                                                                          ···                                                   ",
        "                                            ·· ··    ·2·   ·BB··                                          ·R·  ·····2     ·1B·BB·· 1B·                                    ······        ·1····R  ····                                                                                                                                                ",
        "                                           ···      ·1·B   ····                                            ·2   ·1·       ······· R·····                                    ····        ···S··R  ·R··                                                                                                                                                ",
        "                                           ··       ····1··                                                     ··         ····   ···B··                                     2·         ·1···· ···R··                                                                                                                                                ",
        "                                           ·2···     ·R····                                                         ···            ··1··                                                  ···  ·R···                                                                                                                                                 ",
        "                                            ·····  ·· ····                                             ·· ·B·       B··2·          ····                                    ··  ··              ···                                                                                                                                                   ",
        "                                            ·1··· 1··                                                 ····2··  2··R ·····     2··                                          2B····                                                                                                                                                                    ",
        "                                             ···  ··2                                                 ·B··B1   ····  ··B·    ····· ··1                                    ····1·                                                                                                                                                                     ",
        "                                                  ····1··                                               ·····  ···· ·1··     ··S·· P····                                   ·· ··                                                                                                                                                                     ",
        "                                                   ···B··                                               B··     ··  ···       ···  ·····                                      B                                                                                                                                                                      ",
        "                                                   ····R·        R·                                    B                            ····                                     ····                                                                                                                                                                    ",
        "                                                    ····       ·····                                                                ···                                     ···B··                                                                                                                                                                   ",
        "                                                               ···B·                                                                                                        ·1····                                                                                                                                                                   ",
        "                                                                ···                                                                                                           ···                                                                                                                                                                    ",
        "                                                                                                                                                                                                                                                                                                                                                     ",
        "                                                                                                                                                                                                                                                                                                                                                     ",
        "                                                                                                                                                                                                                                                                                                                                                     ",
        "                                                                                                                                                                                                                                                                                                                                                     ",
        "                                                                                                                                                                                                                                                                                                                                                     ",
        "                                                                                                                                                                                                                                                                                                                                                     ",
        "                                                                                                                                                                                                                                                                                                                                                     ",
    ]
}