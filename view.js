const canvas = $("canvas")[0];
const ctx = canvas.getContext('2d');

function updateCanvas() {
    ctx.canvas.width = canvas.clientWidth;
    ctx.canvas.height = canvas.clientHeight;
}

const TILE_SIZE = 256;
const pxPerTileMAX = TILE_SIZE;
const pxPerTileMIN = 10;
const pxPerTileFACTOR = 1.2;

const STUMP_VISUAL_HEIGHT = 0.1;

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
    LOG2_STANDING: new Tile("props", 256, 10),
    LOG2_HORIZONTAL_LEFT: new Tile("props", 256, 11),
    LOG2_HORIZONTAL_RIGHT: new Tile("props", 256, 12),
    LOG2_VERTICAL_BOTTOM: new Tile("props", 256, 13),
    LOG2_VERTICAL_TOP: new Tile("props", 256, 14),
    MONSTER_RIGHT: new Tile("props", 256, 15),
    MONSTER_LEFT: new Tile("props", 256, 16),
    MONSTER_DOWN: new Tile("props", 256, 17),
    MONSTER_UP: new Tile("props", 256, 18),
    START: new Tile("props", 256, 19),
    RESETPOS: new Tile("props", 256, 20),
    RAFT_VERTICAL: new Tile("props", 256, 21),
    RAFT_HORIZONTAL: new Tile("props", 256, 22),
    RAFT2_HORIZONTAL_RIGHT: new Tile("props", 256, 23),
    RAFT2_HORIZONTAL_LEFT: new Tile("props", 256, 24),
    RAFT2_VERTICAL_BOTTOM: new Tile("props", 256, 25),
    RAFT2_VERTICAL_TOP: new Tile("props", 256, 26),
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
View.tileVisible = function(x, y, tilesTolerance = 0) {
    const TOLERANCE = this.pxPerTile * tilesTolerance;
    let canvasX = this.xToCanvasX(x);
    let canvasY = this.yToCanvasY(y);
    return canvasX > TOLERANCE && canvasX < canvas.width - TOLERANCE &&
        canvasY > TOLERANCE && canvasY < canvas.height - TOLERANCE;
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

View.drawStaticProps = function(x, y) {
    function placeTile(tile) {
        View.drawProp(x, y, tile);
    }
    let char = GameState.getTerrain(x, y)
    switch (char) {
        case '1':
        case '2':
            placeTile(TILESET.STUMP);
            break;
        case 'P':
            placeTile(TILESET.POSTBOX);
            break;
        case 'B':
            placeTile(TILESET.BOULDER);
            break;
        case 'b':
            placeTile(TILESET.ROCK);
            break;
        case 'M':
            placeTile(TILESET.START);
            break;
        case 'R':
            placeTile(TILESET.RESETPOS);
            break;
        case 'S':
            placeTile(TILESET.SNOWMAN);
            break;
        case ' ':
        case '·':
            break;
        default:
            console.assert(false, "Invalid Terrain: ", char)
    }
}

View.draw = function() {
    // in case of resize
    updateCanvas();
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.rect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = "#888888";
    ctx.fill();
    let box = this.getVisibleTiles();
    for (let y = box.ymin; y <= box.ymax; ++y) {
        for (let x = box.xmin; x <= box.xmax; ++x) {
            if (GameState.isWater(x, y)) {
                this.drawTile(x, y, TILESET.WATER);
            }
        }
    }
    for (let y = box.ymin; y <= box.ymax; ++y) {
        for (let x = box.xmin; x <= box.xmax; ++x) {
            if (!GameState.isWater(x, y)) {
                this.drawTile(x, y, ((y + x) % 2) ? TILESET.GRASS : TILESET.GRASS2);
            }
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