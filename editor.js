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
    if (char == 'B' || char == 'b') {
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
    } else if (char == 'b') {
        placeTile(TILESET.ROCK);
    } else if (char == 'M') {
        placeTile(TILESET.START);
    } else if (char == 'R') {
        placeTile(TILESET.RESETPOS);
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
    rock: 'b',
    boulder: 'B',
    postbox: 'P',
    secret: 'S',
    reset: 'R',
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

const STUMP_VISUAL_HEIGHT = 0.1;
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
    toSave() {
        let save = {}
        save.x = this.cell.x
        save.y = this.cell.y
        let z = this.cell.logs.indexOf(this)
        if (z) save.z = z; // no need if no stack
        save.ox = this.origin.x
        save.oy = this.origin.y
        save.axis = this.axis
        return save
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
            case 'b':
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
    saveLogsTo(logs) {
        for (log of this.logs) {
            logs.push(log.toSave())
        }
    }
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
    let dh = targetCell.getElevation() - cell.getElevation();
    if (dh > 1) {
        // cannot jump more than one step up
        return false;
    }
    if (cell.topLog() && cell.topLog().axis == -dir.axis && dh >= -1) {
        // cannot jump off of orthogonal log, except when jumping down at least two steps
        return false;
    }
    return true;
}

GameState.tryNudge = function(cell, dir) {
    // monster stands in cell
    let logCell = cell.nextCell(dir)
    let log = logCell.topLog()
        // nudging means: trying to push a lying in parallel to my movement
    if (!log || log.axis != dir.axis) {
        return
    }
    let targetCell = logCell.nextCell(dir);

    function confirmNudge() {
        log.moveTo(dir);
        log.axis = 0; // standing now
        if (log.getElevation() == -2) {
            log.axis = dir.axis; //... unless in the water
        }
    }

    // I cannot nudge if I cannot move out of my cell
    if (cell.topLog() && cell.topLog().axis == -dir.axis) {
        return false;
    }
    let targetLog = targetCell.topLog();
    let targetElev = targetCell.getElevation();
    let logElev = log.getElevation();
    if (!targetLog) {
        // just nudge on top of an otherwise empty field
        if (targetElev <= logElev + 1) {
            confirmNudge()
        }
        return
    } else {
        TMPLOG("targetLogFound")
            // nudge onto a field containing another log
        let targetLogElev = targetLog.getElevation();
        if (targetLogElev >= 2 + logElev) {
            // the other log lies on higher level → nothing happens
            return;
        }
        // bump that log
        GameState.bumpLog(targetLog, dir);
        if (targetLog.cell != targetCell) {
            // it has moved out of the cell, I can move now.
            confirmNudge();
            return
        } else {
            // it is still there
            if (targetElev <= logElev + 1) {
                // the top of the other log is high enough to lift my log on top
                log.moveTo(dir);
                log.axis = 0;
            }
            return
        }
    }
}
GameState.rollLog = function(log, dir) {
    let cell = log.cell
    let nextCell = cell.nextCell(dir)
    let logElev = log.getElevation()
    let targetElev = nextCell.getElevation()
    let nextLog = nextCell.topLog();

    let confirmRoll = function() {
        log.moveTo(dir)
        GameState.rollLog(log, dir);
    }

    if (logElev < 0) {
        // logs in the water do not roll
        return
    }
    if (!nextLog) {
        if (logElev >= targetElev) {
            /* make the move and keep rolling*/
            confirmRoll();
        }
        return
    }
    let otherLogElev = nextLog.getElevation()
    if (otherLogElev > logElev) {
        // cannot bump log above me
        return
    }
    // log is at same level or below
    if (nextLog.axis == -log.axis) {
        // can roll on this log if below
        if (logElev >= targetElev) {
            confirmRoll();
        }
        return
    } else if (nextLog.axis == log.axis) {
        if (otherLogElev >= logElev - 1) {
            // I hit that log from the side
            GameState.bumpLog(nextLog, dir)
        } else {
            console.log("Unimplemented Interaction: Log Falling on parallel other log.")
        }
    } else if (nextLog.axis == 0) {
        // rolls over when higher
        if (logElev >= targetElev) {
            confirmRoll();
            return
        } else {
            // bumps otherwise
            GameState.bumpLog(nextLog, dir)
            return
        }
    }
}
GameState.bumpLog = function(log, dir) {
    if (log.axis == 0) {
        // may bump it upwards by 1 stump
        if (nextCell.getElevation() <= log.getElevation() + 1) {
            log.axis = dir.axis;
            log.moveTo(dir);
            return true;
        }
    } else if (log.axis == dir.axis) {
        // cannot be bumped (can only be nudged)
        return false;
    } else {
        GameState.rollLog(log, dir);
    }
    return false;
}
GameState.tryPush = function(cell, dir) {
    log = cell.topLog()
    nextCell = cell.nextCell(dir)
    if (!log) return false;
    this.bumpLog(log, dir)
}
GameState.tryChop = function(cell, dir) {
    if (cell.terrain == "1" && !cell.chopped) {
        cell.chopped = true;
        cell.addLog(new Log(cell))
        return true;
    }
    return false;
}

GameState.input = function(dir) {
    console.log("Going " + dir.name);
    this.lastDir = dir; // direction monster is facing
    let cell1 = this.playerCell
    let cell2 = cell1.nextCell(dir);

    if (this.canMove(cell1, dir)) {
        this.playerCell = this.playerCell.nextCell(dir)
    } else if (cell1.isRaft()) {

    } else if (this.tryNudge(cell1, dir)) {

    } else if (this.tryPush(cell2, dir)) {

    } else if (this.tryChop(cell2, dir)) {
        this.tryPush(cell2, dir);
    }

    let island = this.getIsland(this.playerCell);
    if (island && !this.onIsland) {
        View.showIsland(island);
    }
    this.onIsland = island != null;
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
    for (cell of island) {
        if (cell.terrain == '1' && cell.chopped) {
            this.recallLog(cell)
        }
    }
    View.draw()
}

GameState.readlogFromSave = function(save) {
    let cell = this.cells[save.y][save.x]
    let origin = this.cells[save.oy][save.ox]
    let z = save.z || 0;
    let log = new Log(cell)
    log.origin = origin
    log.axis = save.axis
    cell.logs.length = Math.max(cell.logs.length, z + 1)
    cell.logs[z] = log;
    origin.chopped = true;
}

GameState.saveTo = function(saveGame) {
    saveGame.dimX = this.dimX;
    saveGame.dimY = this.dimY;
    saveGame.startX = this.startCell.x;
    saveGame.startY = this.startCell.y;
    if (this.playerCell != this.startCell) {
        saveGame.x = this.playerCell.x;
        saveGame.y = this.playerCell.y;
    }
    let logs = []
    for (let y = 0; y < this.dimY; ++y) {
        for (let x = 0; x < this.dimX; ++x) {
            this.cells[y][x].saveLogsTo(logs)
        }
    }
    if (logs.length) {
        saveGame.logs = logs
    }
    saveGame.map = [...Array(this.dimY).keys()].map(y => [...Array(this.dimX).keys()].map(x => this.cells[y][x].terrain).join(''))
    console.log(saveGame)
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
    if (saveGame.logs) {
        for (log of saveGame.logs) {
            this.readlogFromSave(log);
        }
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
        "                                                   ···                                                                                                                                         ····   ···                            ·b···b    ··P··  ·b·2                                                                                           ",
        "                                            ···     ·1··                                                                                                                                   ··  ·1··  ·····                           ····b     ····1 ·······                                                                                         ",
        "                                           ····2  ·1·bb··                                                                                                                             ··· ···· ··   ···BB··                          1BB    B·  ···· ·b·····                                                                                         ",
        "                                           ······b····b··                                                                                                                            ·1·····1·      ·······                           ···  ···1 ···  ··2···· ·B··                                                                                    ",
        "                                           ··S··bb··bbb··                                                                                                                            ·········       ·· ···                      ·2  ·1··  ··B·        ····  ··1·· B                                                                                 ",
        "                                           ····b·bbb·b····                                                                                                                   ····      ······           ·2                      ···· ···    ···   ··b         ·····                                                                                  ",
        "                                            ··bb···b···1··                                                                                                                  ····S·  ·1  ·1··                                   ·b··1             ·····       ·1····  ·b··                                                                            ",
        "                                             b······bbb··1·                                                                                                                 ·····1 ···    ··        ···                        ··1·  ·····       ·2···       ·· ··· ····2·                                                                           ",
        "                                             ··b2··bb·b···B                                                                                                                 ··  ·· ····      ···   ·B··  ····        ···       ···· ·B1··1       ····           b·  ·B····                                                                           ",
        "                                             ·····b····bb··                                                                                                                        ····     ·····  ···2  ·····   ··  ··1·       ··· ····B     B   ·b·                 ··                                                                             ",
        "                                             ····b···1···bb·                                                                                                                         ··     ·····   ··  ···P·2  ····1····            ·B···   ·····                    ·2·                                                                            ",
        "                                             ···bbbb··b·b····                                                              ·b··                                                ···  ··· ··    ·2·       ······  ·1··B····                    ····B·                    ··                                                                            ",
        "                                              b···b··1··b····                                                             ······                                               ·2·  ··  ····· b·  ··    ······   ··· ··        ··B··         ··1·1·   b                                                                                              ",
        "                                              b····bb····b··                                                              ······                                             ·b····     ·2··B    ···     ···                  ······           ···        ··· ···        ···                                                                         ",
        "                                              b·····b··· ·1                                                              ·1···B                                        ··   ·······      ····    b····                        ·····1·  ·b··              ···B··2··       ··S·                                                                        ",
        "                                              ·b··bb····                                                                 ····1·                                        ··2  ·1·· ·· 1··  ··1·    ·2···      ·2·                2·· ·· ····2·     1···    ··S·····b       ····                                                                        ",
        "                                              ··bb·····b···                                                              ·· ···                      ···               ····  ··     ···1 ··       ··1·     ······              ···    ······   ···1···  ·2·· B····        ··                                                                         ",
        "                                      ···········bb···b·····                                                                    ··                   ··1·               ··1         ··B·          ···      ··BBB··    B  B           ······b   ·B1···b  ····  ····                                                                                   ",
        "                                     B········B····b··bb2···                                                                  ····     ····         ·····                            ···                   ··BBB··                   ·1  b··    ·····    ·b   b··                                                                                    ",
        "                                      ·········1···bb·· ····                                                                 ·B·1·  ·······   ···  ····B                  ··         b·       b· ·1   ···  ······· B                     ··                                                                                                          ",
        "                                            b·····b··bb  ··                                                                  ····   ·1······ ····  ·1··B                 ····            ···  ·1···  ··b·   ·· ··                                 ··      ·b        B                                                                                ",
        "                                               bbbb··b                                                                       ·1··b  ···  2·· ···2  ···BS·                ··P··    ····   ···· ····   ···2·             B B              ··    ·1· ···   B···b      B     B ··                                                                        ",
        "                                        ·· ·b· ·······                                                                        ····   ··  ··  b··     b···                 ·····  ···1··   1·   ···2·  ······         B                ·1···   ·····2·    ····             ····                                                                       ",
        "                                       ····b ·········b·                                                                                      ··                    ····    ···  ·····b· ···B·   ···   ······      B                  ······  2······    b·S·     ··  B B b····                                                                      ",
        "                                       ·········b·····P·                                                                         ·b ·1·              ··1         ···B··1·   ···   ······ ···1·         ······    B    B                ·1 ··  ··BB·     ····     ···1      ····                                                                      ",
        "                            ··         ·b····b··b····1··                                                                   ·1·  b···B···            ·····        ···b····    ·2  ·2··b     ···           ··2·         B BB                     ···      ···      ····      B···                                ···b                                  ",
        "                           ··1·          bb····b·  ·B···                                                                  ····· ·1······      ··    ·····       ·B1·· ··         ··                       ··       B        B                                    ·BB··     ·1·                               ·······                                 ",
        "                           ·b··          ···b··b     ··                                                                ·  ··1·· ·B···B··     ····    ··    ···  ···                                                    ·b· B                    1·                ···B                                       ·······                                 ",
        "                            ··           ····                                                                        ·1·· ···    ·· ···      ··S·          ··B  ·1·B·1                                           B    ·1··                     ····               ···B    B                 B           ···  ··2··               ···                 ",
        "                           ····2·         ··                                                                        ·····                     ··   ····  ·11·B· ······                                             B   ··· B                   ··P·      ···       ·B                        B         ·2··  b·····    ····     ··2···               ",
        "                           ······                                                                                   ·B·1·     ··      ···          ··B·· ······  ·b·                                                B  ··                       ···      B···          B          B ··     B           ·····  ···P·   ·b····    ······               ",
        "                            ····                                                                                     ··     ··1···  ····1·         ·····    ···                                                 B          B                           ··1···   BBB   b             B··  ··              B··    ···  2··b··B· ·· ····b               ",
        "                                                                                                                            ······ ·b·····         ·····   ···     ···                                            B     B B  B                         ····b·  ·BBB·B                ··  B·   b·       1··B·         ··· ·2·· ···1·B·· B             ",
        "                                                                                                                       ···  ······ ···1··           ···    1··    ·1····                                      ··    B  B                               ··1··  2·BBB··                    ·1·B···       ··1·          ··· ··   ···· ··   B            ",
        "                                                                                                                     2····· ·b··1·  ·b·                           ···B1·  ···                                ··S·       ··· B                           b··   ·······      ·B        ··  ·······        ···           ··      ··bB   ···             ",
        "                                ·· ··                                                                                ·····B  ····                      B  ··    B B1·b·· 1····                       ··      ·····   B ····  B                ··              ········    ···     ·b···   ····                                       ·b···           ",
        "                               ··b··2·                                                                                ····                      B        ··b· B       ·  ······  ···                ··S·    ······     ·1···                ··1·               ··P····    b·   ·· ·····                                ··B           ·······         ",
        "                               ·······                                                                                                     B             ·1··    ···     ···P·· ·····               ····    ·P···       ····  B            ····                ·····1     ·2 ··2· 1··B                                2·· ··  ···  B  ······         ",
        "                               ······b                                                                                       2·               B          ·1·· B·1··b·     ····· 1····  ····          ···     ···    ·b   ··     B          ·1·1                            ·····   ···                                ··· ··· ····  ·1·B··2          ",
        "                                ····2·                                                                                       ··           B              ··  ········       ··  ·····  ······                    B ···b      B  B          ···BB                  ···      ·2··                                       ·2····· ····· ···· ··          ",
        "                                  ···                                                                                        1···                             ·B·1··  B           ··· ·····b·        ·· ··    B B ··1··   B ···             ····                  1·b·      ···                                   ··   ·B·1··  ···2  ···             ",
        "                                ·      B                                                                                ··  ···1·           B  ····   ····  B ···        B   1·       ·1·····       ···b··b       ·····    bb···                                 ···b·                                          ·····  ··b··   ····                  ",
        "                             ····                                                                                      ··1B·  ··              ·1···  ··BB···        B       ·····      ···b·        ·······      B··B··B   ····· B      ··    ···              ··b····                                       ·· ····2  ····     ··                   ",
        "                             ··b··  ····                                                                               ·B1··                  ···b·· 1·BB···                ··B·· ···    ··    ··2  ·1···2     B  ·b··      ··B·       ·1··  ··B···            ·1····                      ··           ·b  ·1· ····                                 ",
        "                            ·1···· ·····B·                                                                             ·····   1· BBB    ···  1····· ·······         B       ···  ·2···      B ···· ··B ··         ··b   B  1···       ···1  ····1·            ···B                       ···          ···· ···  ··   ··            ···              ",
        "                            ····b·   b····                                                                              ···    ···BBB·  ······  ···b  ·····  2·  ··                ····   1·   ···b             B      B B  ···  B     ·B·     ···              ··                        ···      ··  ·······b      ···2          b···              ",
        "                      b       ···     ···                                                                                      ·P·BBB·  ··B···  ···          ·······       B   ··  ···· ·····   ·· B             B ··           B     B B1                                                ·P···  ··2·   ···2·        b···          ·2P·              ",
        "                                  21·                                                                                          ·······  ······               ··S····         ···1·   2  ·b···     ··              ·b··       B      ··· ·· ···                                            ····· ······  ·b··         ···            ··               ",
        "                                 ··b·                    ··                                                                     ·····   1····                 ······         ·····      ···b·   ···2·          B ····b        B   ···1·    ·b· ···                                         ··2  ··B····                                              ",
        "                                ·1bb·                  ·····                                                                                        ···        ··2·          ··B         ···  ···1··b         B  b····   B  B    ······    ·····1·                                               ·· ···              ·bb·        ···      ··         ",
        "                          ··    ·····                  bb·S·                                              ···                     ···· ··           b···                      ··   ···        ··b····         B  ·2·     ··      ·····   B  ······                                                  ·2              ······   ·· ·2··     ····        ",
        "                         ·2··    ···                     ···                                            ··1··             ···    ·Bb··b··          ···S·                          ··b··  ···    ···               ··   ···bb·    ···P·        ···                                                             ···   ·1····   ········    ····        ",
        "      ······        ··  ····b                                                                           ····             ·····   ····B·1B··        ·····        ····        ··b·  ·1···· 1····                 B       ······· B   ···                                                                       ·b···  ·· ·2·   ·1···b··     ···        ",
        "     ··1··b·      ··1·  ·b···                      ···            ···                                  ·····b·   B       ·····   ·1· ······        ···         ·······      ····b· ···b· ···1·                B        ··1··B·B                                                                     ··      ·······    ··     ··  ··  ··  2·  ··     ",
        "     ····2··     ·b···b ·· ·   ··  ··             ·P···      ·b ····1·                          ··    ·b·····2·           ··b·    B·   B1··                    ·······       1···· ·····  ····                          ······                                ··                                   ··b·     ····B··                  ····    ···b    ",
        "     ···b·B      ··2···       ··b····             ·····  ··· ·· ··b···       ··                ·BB·2  ··2   ···           ···          ···                     ·······       ··B·   ···                          ···      ···  B  B                          ····                                  ·2··     ··· ··               ··· ·b·b·   ·b··    ",
        "     ·b·····  ···  ··b· · ··· ·2···2·        B      2·   1···1  ·b····      ····               ·BB··   ··                                                      ·P····                      ··                   ···1 B                                       ····                                  ···· ··  ··2·                ···· ··b··    ····   ",
        "     ······· 1·P·  ··b  ···1·  ···b··             B     ····B··  ···2       ··S·               ·····         ··  ···                                           ·······   ···              ······                b···   ··                                    2·          B                           ·1·B·   ···                ···  ····   ····2·   ",
        "       ····  ····       ·····  ··b··                    ··1··B·              ···           ··    ··          ··2 ··b·                                           ·· ···  2·····            ···b···               ·········     B                                        B                              ···                        2·  ·1··2  ·1··     ",
        "             ····        ···    ···            B    ··    ·· ··  ··  ··              ··   ···12       ·2·   ·1BB···b·                                                   ··S···            ·· ··1·               ····BB···                                                                                                              ·b·    ··     ",
        "              ··                                   ·1B ··        ·1·b···   ····     ···2  ······      ····  ······2··                                                   ······                ··              B  ···BB··   B                                ··                                                ···                                    ",
        "                                                   ·····1··      ·····b·  ······    ····   ·1···     ···B·   ·b· ···   B              ···                               ·····b         ····b·                      ····                                    ··B·                                              ····                ··    ··            ",
        "                                                 B  ··1··b·      ···1··   ······   ····      ··      ·····               B            ·2··                               ····        ··b······                  B       B B                                ······   ···                                      ··S·               ···1  1··            ",
        "                                              B       ··1·        ··     ·B·····   ·····              ··       B                      b···                                     ···   ·········                     B  B                                     ·1···· ·b··                                       ··                ·2··  ·2·            ",
        "                     ···                                             ··  ····      ····b ···              ··     ····                b··S·                                    ·BB·· ··········                   B  B  B                                 ·· ····1· ···1··                                                       ····   ····          ",
        "                    ·1···                            B  ···         ···1 ···        ··   ·1···            2··    ··BB·                ··                                      ····· ··1··  ··                                                           ···   ··B   ·1···                                                        ··  ····1·          ",
        "            ···     ·bb1·                              ·····        ·bb·      ··      ·1···B1·  2·     ····2·   ···BB·                                        ··            ·B····  ·····                                                               2·b·          ··                                                              ·B··           ",
        "           ····B·    b···  ····                   B    ··1···      ·b····     ·1·     ·B·1···· ·····  ······b   ······                                   ··· ·S·            ······   ···                                                               ··1··                                                                       ··                ",
        "           ···1··    ···· ··b···    ··                ·1B···2      ·····2  ·· ···      ··B··   ·····  ·b·····    ···                                    ···b ···            ··1··                                                                      ···             ·· ··                                                      ····               ",
        "           ···1··        ·1b·1b··  2···               ···· ··      ·····  ·1B···                ···    ····                                             ··1· ··               ···                                                                      ····            b··1··                                     ···            ··S··               ",
        "            ·BB··        ········  ··B·                ··           ··    ·····1·                   ··                                            ···   ·1··                     ··                                                                     ··             ··b···       ··                           ···S·           ····                ",
        "            ····           ·· P··  ····                      ·· ··         ··b···            ···1 ·····                                   B      ·····b ··                      ·1··                                                                       ···    ··   ····2·       ···        ··   ··           ·b···            ··                 ",
        "                              ··    ··                       ···2·· ···                     ···b· ·····2                                         ·B····              ········  ·b·B·                                                                       ·1··  ····· ··b··       ··S·       ·1·· ···             ··                                ",
        "                                                             ··b···  b··   ···              ····  ······          ·····                          ····2·  ··         B········1 ····                                                                       ···1·  ···1·  ··         ···        ···· b···                                              ",
        "                                     ·1b ··                   ·· 1· ····  ··1B              ·P··   ·2··          ·······               BB     ··  ····  ···          ········   ··                                                                        ·b···  ····                        ····b ····   ···                                        ",
        "                               2··   ····b·                      ·· ··1·  ·······           ·····  ····         ·····b··  2··          BB   ··b·        ·2···                                                                                             ···     ·b·          ····          ·b·1·  2·   ·····                                       ",
        "                         bb    ····· ·1····                          ··    ·1····            ····               ·1·B···· ····· ··           ·2····      ··b··         B                                                                                                        ··2·           ···        ···S·                                       ",
        "                ···     bbbb    ·1b·  ···                                    ···              ··                 ·  2··· ····b 1···         ······       ···                                                                                              ··       b··        ····b·  ··     B            b···                                       ",
        "               ··S··   ·bbbb·· ·····                                                                                ···    ··· ·····    B·b  ··b·                                                                                                        ·····    ···2·       ·1···· ··B ·1 ···B    ··                                               ",
        "               ····b·  ·b·bb1· ·1b·                                                                                            ··2··  2·····  ··        ··                                                                                               ······2  ··2····  BB  ·b··· ·1··b· ·b···  ··1·                                              ",
        "                ·b··2  ······· ··                                                                                          ····  ··   ···P··           ·b···                                                                                              ······  ·b····B  BB   ···· ··1··· ···12  ···b                                              ",
        "                  ··    ·b·                                                                                               ·B···        ····            ····B·                                                                                             ······    ·····             ··b·   ·b·   ····                                              ",
        "                                                                                                                         ···B····                      ·B····                                                                                              ····      ···                           ·1·                                               ",
        "             ····      b1b    ····                                                                                       ···  2··        ···      ·b·  ···2··                                                                                                                 ··2               B   ··                                               ",
        "             ·b···   ··bb·  ··1··b··                                                                                     ·2·  ··        2····    ·····  ·b··                                                                                   B                       ···    ····· ···     ·b·2      B                                              ",
        "            ······  2b···   ·bbbb···                                                                                      ··            ··B··    ·2···                                                                                 ····                           ·····    ·1·· ·b··   ···b·     B                                               ",
        "            ·1b···  ·b·bb1· ···b····                                                                                                    ····      ··B·                                                                                ······   ·B·                    ··P···   1B··  ··1·  ·····                                                     ",
        "          ·· ··      ··b·b·  ·······                                                                                                     ··  ··    ··                                                                                 ···1··  2···  ····              ······  ···B· b···b·  ···                         ··· ··                       ",
        "       b· b·           1b      ····                                                                                                         ··2·                                                                                      ····bB  ···· ··b···              ·· ·2  ····  ·2····                             ··1······                     ",
        "       ······          ··                                                                                             ···                   ····  B1·                                                                                  B2·     B·  ···2···                          ······                      ··     ·····1···                     ",
        "       1·1b··                                                                                                        ··1···    ···         ·b··· ······    ····                                                                                    b······                           ···b                  B   ··1 ··  ·b·· B···                     ",
        "       ·····          ·1    ··   ·2 ···                                                             ····    ··       bB···B    b·B·        ··b·  ······  ·······                                                                                        2·                                                    ····  ·· ··B    1·   ··                ",
        "        b·          ··bb·  2··· b····B·   ··                                                   ··   ·····   ·1·       ··b·      ···         ···   ··2··  2······          ···                                                           ··           B ···                                                    ·1B····· ·b·   ··   ····               ",
        "             ··    ······  ···· ··b···· ··1·                                                  ·2··   ·b··· 1···                 b··                ··b   ·b·····  ·2·    ·BBB·                                                         ···b            ··                                                 B    ····1··  ·· B     B1···               ",
        "      ····  ····2  ·1bb··    ·· ·1b·P·· ······    B                             ···           ····· ····P· ····                ···                        ····    ····  ··BBB·                                                         ·P·· B                                                                  ···b··     B        ··                ",
        "    ·2bbB·  ·····   ····        ··· ··  ·1···2·                                ·····          ··B·· b· ···  1·         ···              B·                        2·P·  2·BBB·                                                          ···                                                                     ··                 b·                ",
        "    ·b··b1 ··BBB·          ·b    B         ·b··                                ·2···     ····  ··   ··b··             1·1·B           ······                      ···   ······                                                                                                                                ··         ··                          ",
        "    ··b··· ··BBB·         ····             ···                                   B··    ······       ···             B·····           ···B··   ···      ····             ···· ···                                                         ··   ··          ··                                  B             ···1·      ···  ·· B  ·1                ",
        "     ····· ······         ·S··                                                   ···   ··1·B···b BBB                 ······           ··1···  ·····    ·····         ··  ··· ·b····                                                      ···2 ·1·         ··S·                                B              ··P··      ·····B·  ·b···               ",
        "            ····          ···                                                  ·1···   ···B b··· BBB                  ·b··             1···· ···B··    ····B        2···     ····b·     ··                                               ·b·····          ····                                               ·····   B  ··1····  ·····               ",
        "                                                                               ···B·   ·2·  ··2· BBB                                   ·· ·· ··· ··    ·····        ··B·     b1b···    ·1·                                               ··2····          ··                                                  ··b     B ·······   ···                ",
        "                                                 ···                            ···          ··                                               ·1        ·2·          ···     ···b·    ····2·                                              ····                                                                           ·····                       ",
        "                                                 1··                                                         ···                                                     ··       ··   ·· 1b··b·                                                           ···                                                    ·1·     B                              ",
        "                                                 ···1·                            1·                        ·····                            ···         ·b               ·b·     ·B·b   ···                                                          b····                                                  ····  B                                 ",
        "                                                B ····                           ····                       ·····                  ·· ···    ·bb··     ··b·        ····   ·····   ····  b··     ···                                                   ····1 ····                                             ··b   ··                                ",
        "                                                  BB··                           ····                       ·P·     ··             ··b··1·   ·····    ···b··       ··bb·  ··1·b   ··2   ··     ··S·                                                    ··   ·P···  ···                                       ····bb··                                ",
        "                                        ···        ··                            ···  ···                   ··· 1· ····            ···B···   ·1···    ····1·      ·····b   ·bbb                b···                                                          ···· ··11B                                      ········                                ",
        "                                      ··b···                                         ·····   ···             ·· ····B··             ·1 ···    ···     ···1·       ·2····   ····      ····       ··                                                          1·bb  ·····                                      ···B··1·                                ",
        "                                     ·······                                     ··· ·1···  ·····               ··1··                  b·              ···         ···1··   ··      ····b·                                                                 ······  ···                                         ·····                                 ",
        "                             ·····   ·2····· ···     ···    ··                 ····· ·····  ·1·bb·               ···                                                ·· ··      ··   ·b·1··        ····                                                     ···1··                                                                                    ",
        "                            ·······   ··  1 ····2   2····  ·1·                 ···b    B··  ···b··                                                                          ·1··P·  ·b··1·  2··  ··1····                                                    ····                                                                                     ",
        "                            ·······         ···b· B ·b···· ·B··                ·BB···  ··     ·b1·                                   ···                              bb··  ·bb···  1··b·  ····b ·······                                                                                                                                             ",
        "                             ·· ·2  ··1· ·  b· ·1   2·b··b ····                ·BB··b           ·b                                 ·····   BBB                       ·b·1·· 1b···          ··B·· ·bb··1                                                                                                                                              ",
        "                                    ·b·····          ·· ·· ··b·       ····     ······ B                                            ·1··1  ·BBB·  ···    ···          ······  ·b1   ··      ····· ·b····                                                                                                                                              ",
        "                             ··     ··B··1·     ····       ·1·  2··  ······     ···b            ···                                ···B   BBBB· ·····  ··S··         ··B···  ···· ····     ·b··   ····                                                                                                    ··                                         ",
        "                           ·1···     ·· ··     ······       ··  ·b·· ···S··                   B ····                                ···  ·····1 ·B11·  2····          ····    ··· ··b1                                                                                                                   ··· ··                                      ",
        "                           ·····               ·1B1··           ···· ·· ··        ··            ··P·                                     ······   ···   ····                      B····   ····                                                                                                       b·  ····S·                                      ",
        "                           ···       ···       ·· ··       ··    ···             ···        ··   ···                                      ··1         B ··1                       ·····  2····   ··b2                                                                                                ·2·  ·····                                      ",
        "                            ··    ·· ·1·                  ···2                   ·····b    ·b··1 ··                                                                                 ··  ···b1  ·1··b·                                                                                                 ··  ··2·                                       ",
        "                            ·2·   ·1···b·                 ····   ··· ··          ····b·  ·····b·                                          ···  B  ····    ···                           ···b·· ·b·b··                                                                                              ·· ·b·      B    ····                             ",
        "                             ··   ···B1··                  ·b·  ·1···B··         ·b····  2···1··                    B                    ···B    Bb·B·· ······                           b·bb· ·b· ··                                                                                             ·b··1··          ··b···                            ",
        "                                B    ···           ···          ·····1··          ····    ····               ·B      B                   ·1··1  ······· ······                             ··· ·b1                                                                                                ··1····  ···   ······1·                            ",
        "                         ··  ·1           B        ····   ····     ···B·                                   ·····                         b····  ·1· ·b· ··P···                                  ··                                                                                                 ····    ·b··  2··· 2··                            ",
        "                        ·······   2·                ··· 1·B····      ··                                    ·S···                          ·b·    ··      ···1                                                                                           ···                            ··                 ·2···   ··                                 ",
        "                        ·1···b  ·····   B      B   ···  ·2·····         ··                                 b····                                                                                                                                        ··1·                          ·P···            B ······                                      ",
        "                        ····1·· ·····                   ··· ·1· 1·   ·1····                                 b··                               B         ·· ···                                                                                         ·····                          ·····        ··    ·B·B1     ··                                ",
        "                        ·B· ··· ·····             ···       ··  ···  ······                                                                    B       b······                                                                                         ·1···                          ····        ·1···   ····    ····                               ",
        "                         ··      ···              ····          ···  ·····                                                                             ····bB   ··                                                                                     ···B                            ·2         ····2·        B ··B· ··                            ",
        "                                                   ·S·           ·· ·1··                                                                   ···         ·1B··1· b····                                                                          ····      ···                                        ·b···   ···     ·······                           ",
        "                        ··                         ··               ···                                                                   ·2···         ···b·· ····B                                                                         ······                                              B   ··   ··2·      ··1···                           ",
        "                       ·····          ·b·    ····                                                       ····                              b···B          ····  ·····                                                                         ·S· ·2     ·····                           ··               ·b····      ··2··                           ",
        "                       ·1··BP·       ···b·  ·····b              ·· ··                                 ·······                  B          ·····                 ···                                                                           ··       ·b··B·                    b···  ·····             ······      ···                             ",
        "                       ····1··       ···B· ··BB···              ·1·B··                               ···S····            ··B    B          ·B                                                                                        ··                ··2···                    ·1·b· 1····             b·· 2·              ··                      ",
        "                       ·B· ··         1·1· 1·BB···   ···        ·····2··                             ··········         ·BB··         ··                           ··                                                                ···          ··   ·· 1··                     ··b· ···1·             ··       ···      ·····                     ",
        "                        ··            ··   ····P··   ····         ····P·                             ····b ····         ·BB··        ·1··   ·2                    ····                       ··B·                                   ····    ···  ·1···    ··                   ·1·····   ··   B                  ····      ···S·                     ",
        "                       B                B  ······2  ·1···             ··                              ··    b··         ·····     ·· ····  ····  ··    ···        ····                       ····                                   ·2···  ···2  ··B·1··                       ······   B            b···        ····      ·····                     ",
        "                                            ·b ··   ···B               B                                    ··           ·b       ··1···   ·P·· ····· ···2         ··2                       1····                                   ···b  ····  ··b····                       ··B·     ··b·        b······      ····       b··                      ",
        "                                                    ·1···                                                                         ·······  ···· b···1 ·b····                               ·B·····                            ···   ··1     ··    ·····                    ··   ···   ··B1···       ···P···  ···  2·                                 ",
        "                                                      ···        B                                                                 ·bb···  ···   ···   ······                              ·B·····                           ·2···  ···                 ···              ·····        ·····b·       ······· ··b·      ···                            ",
        "                                                                                                                         ··           ·B    B            B2··   ··  ··                     ····1·                            ·····                     ·2···            ·b···2·  ···  ·······        ······ ···b·    ·····                           ",
        "                                                                                                     ··                  ·Sb·       B     B·              ··    ··· ·b·     ···       ··    ····                             ···1·                     ·····            ··2· ·· 1·b·· b··b·           ·2··  2····· ······2                           ",
        "                                                                                                    ·2··                 ····        B   1··   B       B        ·2····2  ·· ··1·     ···             ···                      ···                  ···   ··              ··     ····· ·1··                    1··· ··B··b                            ",
        "                                                                                                  ······     ···          ··            ·1··    B    ·1         ··b··1·  ·2·····     ··2··         ·2····b                        ··              ··1·  ···                      1·b·                        ··1·  ····   ·b b···                    ",
        "                              ·······                                                             ·2··B     ···2·                       ·B·         ··1·          ····    ··B···     ····· ·· ··   ·······                      1·BBB             ···   ···           ···       ···b·  ····            ··    ···    ··   ·b····2··                   ",
        "                             ·BBBBB···                                                             ·b·      ······  ·· ··               ··· ···     ·B··                   ····       ···  ·····2  ·b ··2·                      ··BBB·            ·2···              ····   ·2  ·1··   ···1·      B   ··1·               ··1····b·                   ",
        "                             ·BBBBB····                                                                     ····B· ····1··                  ···B··1 ···    ··     ···                  ··  ··P···     ···               ···     ··BBB·            ·····              ···1· ····        ···1B          b···               ···· ···                    ",
        "                             ·BBBBB····                                                    ·B          ····  2·b·· ····1··             B     ···2··        ·2··  ··1·      ···             ······     ·b               ····      ····     ····     ···              ···B·· ····         ·b             1·                 ··· ··                     ",
        "                             ·BBBBB····                                                   ·B·1·       b·····  ···   ····                    ·2·····      ····b·· ···      ·····        ··   B····                      ··S··            ·1···2··                    ·2·· B ····             ···                                                      ",
        "                              BBBBB·B         B                                           ····b·      ···P··          B                    ·B·· ··       B·····b  ·B    ··b··2·      ··B·b  ····                        B···     ···    ·B······ ··1                 ···    ··             ·B11B                     ···          ···                ",
        "                               ······       B                                             ···1··       ·····                               ····           ····2· ·1···  ·······      S·b··            ···               ····   ·····2·  ·······B ····                                  ··· ····   ··            B   ···2·     ··  ····               ",
        "                                                                  ···                      ·····       2····                                ··            b· ··· ····2  ·1····       ···B·            ····               ··    ·······  ·b··  ·· ····          BBB               B    b···  ··    ···   ···         ·B···     ·····1 ·               ",
        "                                                                  ·2··                     ·b···         ·b    B                                                   ··    ·B           bB               ·b·                      2···P·            ··           BBB                     11      ·· B1·  ··1···       ·····      21···                 ",
        "                                                                   ···                       b·  ····b·       B                                        ·b··                                 ··     B   ···                      ···b·                          BBB                      ·· ··1···1 ··  ····bb·       ··b        ···                  ",
        "                                                                 ···B                           ·B··2···                                              ······              ···         ·B    ···      B1···                       ····                                                  ·b· 1···P··     ·B·1····                      ···             ",
        "                                                                 ·2···                          ···B····                                              1··B·2            ······        ···· ····      ····                                                   ····B                     ·1··  ·····      ··  ··1·       B             ·····            ",
        "                                                      P···       ·····                          ···  ···                                         ·· ··  ···             ·P·BB·        ·bb···1··       ··                                                  ········                     ··                  ···         B            ··P··            ",
        "                                                      ···1·       ·b··                          ·2·  ·b                                         ·1··b··     ··     ···· ···BB·        ·bb·····                                                            ····b···                 ···    ··   B         B                          ·····            ",
        "                                              B      ··b···            ···                       ··                                             ·······    ·b·    ···b·   ····         ·····                                                               ···  b· B               ·1··  ··b           b·        ····   ···          2·              ",
        "                                            B   B ·· ·· ··           ·2····               ··· B       b··   ·bb·                                ···1··     ··1··  ·B···· ·····                                                                              B       B              ·1··  ···b         1···      ····1   ····                         ",
        "                            ···                   ···                ····B·             ········   ·b·····  ····                            B      ···       ···  ·····1 ··1·                                                                            ···                        B··   1··      B ·1·B·      ·1··     b··· ··                     ",
        "                            ·1·          ··     ·2 ··                ·B····             ·1···2··   ····1·· B····                           B                ·····   ···                                                                                  ·b·    ··                     ··      ··    ·····  ·2  ···1  ·· ··1· b··   ··               ",
        "                           ·b··         ··1··   ····b                 ·2··              b······    ··B···· ··11·                                 B   ··b    ···2·         ··                                                                             ··1·  ····                 ·· 11··  ·····    ··· ····    ··  ··b···· ··2  ··B·              ",
        "                          ·····         1···· B  ····                  ··               b··  ··     ····    b··   B                                 ··2·     ···   ··    ··1· ··                                                                         ·······b··                 ·1···b·· 1·S··        ·P··         ·····   ··  ··1··             ",
        "                          ·1·B           B···   ···2·                                                                                   B      ··   ···           ····   ······2·                                                                         ·········                   ··B 1·  ···         ···    B  B   B   B       ····             ",
        "                          ···B            ··    ··b·                                             ··     ··2B·                         B     ····1·   ··           ··S·   ····B1··                                                                          ······                                          ··     B    B            ··2              ",
        "                           ··       B            1·                                     ··     ·2··   ·······                             ··bB····                ···     ··· ··                                                                                                          ··b                              B        1···             ",
        "                                     B                                                  ····· ·····   ·B··11·                             ·1······                                                                                                                                   ·2   ····                              B       ····             ",
        "                                                ···                                     ····1 ······b ··b···                              ·····P·  B                                                                                                                                ····  ·····                     ·    ··          ··              ",
        "                            B                   ·b··                                     ···  ·2·····   ···                            B   ·····   B                                                                                                                                ·P·b ······                     ·b··1··                          ",
        "                           B                      ··                                             ··b                                                 ··                                                                                                                             ···· ····1·                     ·······                          ",
        "                        ···        B··    ·· ··   b·                                                                                        ··    B ····                                                                                                                             ··· ·· ··                       ······                          ",
        "                       ··bB··     ···· 1·B·· ··b ···                                                                                        1·· b· ·2···                                                                                                                             ··                               ····                           ",
        "                       ·1····   ····2· ····1 ·······                                                                                       ······1 ···b·                                                                                                                                 ··                           ····                           ",
        "                       ····b·   ·2···   ···   ·····                                                                           ··           ··1···· b····                                                                                                                                ·1··                                                         ",
        "                        ·1···    ···                                                                                         ····            ···    ···                                                                                                                               ····B·                                                         ",
        "                          ··                                                                                         ··      ··BB                                                                                                                                                     ·2···                                                          ",
        "                                                                                                                    ····     ··BB·         ····bbb     ···                                                                                                                             ···                                                           ",
        "                                                                                                                    ··S·      ····        ····b·S·     ····                                                                                                                                                                                          ",
        "                                                                                                                      ··       2·         ····b···   B ····                                                                                                                                                                                          ",
        "                                                                                                                                          ·····  B      2·                                                                                                                                                                                           ",
        "                                                                                                                           B               ····   B                                                                                                                                                                                                  ",
        "                                                                                                                    ····      ··            ·2        B                                                                                                                                                                                              ",
        "                                                                                                                   ···1·· ··  2··   ···                ··                                   ·1  ··                                                                                                                                                   ",
        "                                                                                                                  ··B···· b·····1 ·1···         ···   ······                                ···B·1·                                                                                                                                                  ",
        "                                                                    ···                      ··                   ·1··b·  ·····B· ····1·     ·· ····  ··b··2                                ··2····                                                                                                                                                  ",
        "                                                             ·· b·  ·P··                    ··· ··                ·····    ···b·  ·b····     ······2  ·······                                ··bb··                                                                                                                                                  ",
        "                                                            ··· ··· 1···                    ··1····                ··      ··2··    b···     ·2··1     b·····                           ···   ···b·                                                                                                                                                  ",
        "                                                            ·····2·  ·b                       B··1·              ··         ···     ···       ····      ··2                            ····2  ·b·                                                                                                                                                    ",
        "                                                            ·1··B·            ··             ······             ·····                         ···        ··                            ·S···                                                                                                                                                         ",
        "                                                             ···        ·1   ····   1··      ··b··              ·····              ···               ···                               ····     ·· 1·                                                                                                                                                ",
        "                                                             ··b       ·1·B· ···· ···2·       ··                ····               ··b·     ··      ····                                ···     ···1··                                                                                                                                               ",
        "                                                                       ····· 1·   ·····                         ···  ···     ···  ·B····   ····     2····                                      ···b···                                                                                                                                               ",
        "                                                                        ·b··      ··B·        ···                ·2  ·····  2···· ····1·   ····      ····                                      ·2·····  2··                                                                                                                                          ",
        "                                                                        ···        ··   ···  ·1··                     ····  ····b ·1··      ·2  ····  ··                                        ·····   ····                                                   ···                                       ··B                                         ",
        "                                                                                       ··b·· 1····  ···              ··P··  ··b··   ··          ··1··                                                  ·····                                                  ····                                ··    ···1                                         ",
        "                                                                         ·1        ·1  ·1·B·  ·B·· ···b·             ·····    ··                ·B1·b    ···                                           ··BB·                                                  ·P· ··                             ·B···  ·1·· ··                                      ",
        "                                                                     ·······      ·b··· ···   ··B· ·1···             2···          B              ··    ·····                                    ·2     ···  ··                                           ··  2·b···  ····                       ·····  ··b·····                                     ",
        "                                                                    ·BBB····      ····· ··     ··   ····                      ···B  B                   ·b····                                  ·B··        ···                                         ·2··    b·1· 1·····               ·2  ·· 1··2    ····2··                                     ",
        "                                                    ··b  ··         ·BBB····      ··1··          ··  ··           B   b··    ··b··1                       b·S·                                  ····        2·1·                                   ···· ·····b   ··  ··BBB·              ····1··  1·      ··b··                                      ",
        "                                                   ·1·· ····        ·BBB···   ·b· ····         · 11·                 ··2··   b···1·                    B  b···                                  ···   ··   ·····                                   ···1·  2··b·      ··BBB·              ·B····   ··                                                 ",
        "                                                   ····B·1··         ····   ·····              b····  1·             ······  ··bb··                   B    ··                                         S··  ···b· ··                             ·· ·b···   ·B··       ·····               ·····            ··                                        ",
        "                                               ··1 ·B···b··                ·b·····             ····· ·····            1···b    ···                                           ··   ··b·         ···     ··   ··· b···                            ··1·b··     ·1          ··                 ···            ····                                       ",
        "                                              ····  ·····                  ··b··2·              ···  ···B·            ···b                                                  ···1 ··2···       ······   B         ·2·                             ····                                              ···    ····     ··                                ",
        "                                              b····                        ···1·                     ·1··                        ·B                                        ··P·· b·····       ······          ·1····                           ··         ·b ···  ·· ·2                    ·· ··  ····    2··     ····                               ",
        "                                                ·B·    1··                   ·B·           ···        ···               ···     ····                  ···B                 ····· ····2        ·b· 1·          ······                          ····   ···  2·b·1· ·b·b···                   ······ ··2·            ··1·                               ",
        "                         ··               ···  ····   ·····                              ····2·   2··                  ··1· ··  ·S··            ···   ·····                ·····   ··  ···     ·2              ·b··                           ·B·1 ·b·b· ····b·1 ··1·bb·                   ···1··  ··            B·1··                               ",
        "                        ·b·1·            ··b1  ··     ·····                         B    ······  ·····  ·b·            ·B···1·   ···           ·····   ··1·                 ··2       ·B·b·    ···   ··         ··                            ···  ····  ·1··b·  ·· ··b                     1···         ··      ···                                 ",
        "                        ······           ·····         ···                           BB   1····  ····· b····           ·······                 ··P··  ·1···                           ···BB     ··  2··1     B·                                    ··11    ·1·         b·                    ···     ·· ··1·                                         ",
        "                         ·B1··           ·1···b· ··                                ··   B   2··  2···· ···P·              B·                   ····2  ·····                           ·····         ·····1  ···                                     ···   B            ···                           ··1····  ·b ··                                  ",
        "                     ·2  ···              ······ ·2·   ·····                      ···  ··   ···   ··   ·b···                                     ··    ···                   ··       ·2··          ·2····  ····2                                           ···b·     b··S·                           ···B··  ····B·                                 ",
        "                    ····     ···b·         ····  ··b· ······                      ·2· ··1·  ··         ···1                                                              ··2 ·B·       ··   ···      ····   ··B··                                    ····  ·b·b·1·    ·····                     ··  ··  2·     1·····                                ",
        "                   ·····     b····  B             ··1 ·B·1·1·                     b···2···              ···                                                              ·2·····    ··    ······             ···                              ··    ··b·b· ·b·····      ··                      ·1··b··         ·B·1·                                ",
        "                   ·· b      ··1··      ···    ······ ·B·· ··                     ···b···                                                                                 ······   ····   ···1B·                                             ····  ·P··b·· ···1··                               ···1···   ···  ····                                  ",
        "                              21·     ·····    ····1·  ···                         ···                                                                             ·· ···   b··    ·····  2··1         ·2                   ···              b1··  ··b····  ···                     B              ··b  ·····1 ···                                   ",
        "                  ···  ··             ····      ····                                                                                                               ·1···b          ·····  ····        ····                 ·b·1··            ···B· 1··1·b·                                              ······                                       ",
        "                 ······2·   ··    ···  2·                 B                       b· ·                                                                             ····2·           ····   ···        ·P···                ··b·1··      ····  ····   ····                             B            ··   ···P··                                       ",
        "                 ·2······  2··   2··P·           ··                              ··· ··                                                                             ·b···            ·1               ·····                 ······  ·· ··b·1· ···                                   ··           ··b··    ····                                       ",
        "                 ·······   ··    1····          2····    ····  B                 ··  ··                                                                               ··                               ···                     B·  2·· ····b·        ···                           ··b          2·····   ·····                                       ",
        "                   ···     ·b··  ··1··          ······   ···S·            B      ······                                                                                              ···                                B          ··   ····        ··1···                         ·····       ······B   ····                                        ",
        "                            ···   ···           ··P···   ·····     B              ··S·                        ·····                                                 ··              ···2                                                ··b·        ·······                        ·S···       ···1···        ···                                    ",
        "                           ·S·                  ······    b··    B                 ··                        ···S···                                               ··· ···          ·····                                      ·2·                   ····2·                         ····       ·B···         2·····                                  ",
        "                           ···                   ····                                                        ·······                                               ····BB··          1···                                     ·····  ··      ·· ··   ·b····                          ·b         ···        B ··BBB·                                  ",
        "                                                                                                             ·· ····                                               ····BB··          ···                                ····  ··b·· ··1··   ·b··1·· ··· ··                                          b··       ·BBB·                                  ",
        "                                                   b·· ··                                                       ··2                                                 ·······                                            B····· ·b·   ····B· ···1B··· ·b·                                       ··    ·····2   ··BBB·                                  ",
        "                                                   ····1·      B                                                       ··                                             ···2      ·· ··                                  ·1·1·· 1··· ··bbb·· ·b····b                                          ····b   ··1····  ······                                  ",
        "                                               ··1 ·1·B··                                                             ····                                                      ·····                                  ······  ··· ··2···   ··b·                                            ·1···   ·······  ·· ··                                   ",
        "                                              ···· ···B··                                                         ··  2···                                                ····  2··B·                                   ····        ··                                                       ·····  b···1·                                           ",
        "                                              ·BB   ···    ···                                                    ·b·  ··    ···                                         ·····   ···            ···                                                                                             ···  ·b··                                            ",
        "                                              ·BB·        ······                                          ··· 1·  2··     ·······                                        ······                 ·1··                                                                                           ··2·                                                  ",
        "                                              ····        ··BB··                                          ··· ·b·····     2···BB·· ···                                   ·······           bbb   ··b·                                                                                          ···                                                   ",
        "                                            ·· ··    ·2·   ·BB··                                          ·b·  ·····2     ·1B·BB·· 1B·                                    ······        ·1····b  ····                                                                                                                                                ",
        "                                           ···      ·1·B   ····                                            ·2   ·1·       ······· b·····                                    ····        ···S··b  ·b··                                                                                                                                                ",
        "                                           ··       ····1··                                                     ··         ····   ···B··                                     2·         ·1···· ···b··                                                                                                                                                ",
        "                                           ·2···     ·b····                                                         ···            ··1··                                                  ···  ·b···                                                                                                                                                 ",
        "                                            ·····  ·· ····                                             ·· ·B·       B··2·          ····                                    ··  ··              ···                                                                                                                                                   ",
        "                                            ·1··· 1··                                                 ····2··  2··b ·····     2··                                          2B····                                                                                                                                                                    ",
        "                                             ···  ··2                                                 ·B··B1   ····  ··B·    ····· ··1                                    ····1·                                                                                                                                                                     ",
        "                                                  ····1··                                               ·····  ···· ·1··     ··S·· P····                                   ·· ··                                                                                                                                                                     ",
        "                                                   ···B··                                               B··     ··  ···       ···  ·····                                      B                                                                                                                                                                      ",
        "                                                   ····b·        b·                                    B                            ····                                     ····                                                                                                                                                                    ",
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