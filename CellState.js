class Log {
    constructor(cell) {
        this.axis = 0; // upright
        this.isRaft = 0; // other possible values: 1 or -1 for different axes
        this.sibling = null;
        this.cell = cell;
        this.origin = cell;
    }
    moveTo(dir) {
        this.cell.removeLog(this)
        this.cell = this.cell.nextCell(dir);
        this.cell.addLog(this);
    }
    settle() {
        // check if I need to combine with other logs
        let log = this.getLogBelow()
            // can only combine with lying logs that are not rafts
        if (!log || log.isRaft || !log.axis) return;
        // same orientation or one is in water
        if (this.axis == log.axis || log.getElevation() < 0) {
            log.makeRaftWith(this)
        }
    }
    getTopElevation() {
        return this.getElevation() + this.height();
    }
    getElevation() {
        // special case for standing double log
        if (this.sibling && this.axis == 0) return 1; // must be on stump
        let logs = this.sibling ? [this, this.sibling] : [this];
        let elevs = logs.map(log => {
            let below = log.getLogBelow();
            return below ? below.getElevation() + below.height() : log.cell.baseElevation();
        })
        return Math.max(...elevs);
    }
    height() {
        // special case for standing double log
        if (this.sibling && this.axis == 0) return 8;
        if (this.isRaft) { return 2 };
        return this.axis ? 2 : 4; // standing logs are 4 stumps high.
    }
    getLogBelow() {
        let i = this.cell.logs.indexOf(this)
        return i ? this.cell.logs[i - 1] : null;
    }
    draw() {
        let tile;
        if (!this.sibling && !this.isRaft) {
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
        } else if (this.isRaft && !this.sibling) {
            tile = (this.isRaft == HORIZONTAL ? TILESET.RAFT_HORIZONTAL : TILESET.RAFT_VERTICAL);
        } else if (this.sibling) {
            if (!this.axis) {
                // still standing on its stump
                if (this.cell.logs.indexOf(this) != 0) {
                    return; //bottom one takes care of this
                } else {
                    tile = TILESET.LOG2_STANDING;
                }
            } else if (this.axis == HORIZONTAL) {
                tile = this.cell.x < this.sibling.cell.x ? TILESET.LOG2_HORIZONTAL_LEFT : TILESET.LOG2_HORIZONTAL_RIGHT;
            } else {
                // this.axis == VERTICAL
                tile = this.cell.y < this.sibling.cell.y ? TILESET.LOG2_VERTICAL_TOP : TILESET.LOG2_VERTICAL_BOTTOM;
            }
        }
        View.drawProp(this.cell.x, this.cell.y - this.getElevation() * STUMP_VISUAL_HEIGHT, tile)
    }
    makeRaftWith(log) {
        console.assert(!this.isRaft && !log.isRaft, "Cannot make raft out of rafts.");
        console.assert(this.axis && log.axis, "Cannot make raft with upright log.");
        log.cell.removeLog(log)
        this.isRaft = this.axis; // important for resets
        this.axis = 0; // otherwise directionless
        this.origin2 = log.origin;
    }
    isCanonicalSibling() {
        if (!this.sibling) return false;
        // am I lexicographically larger?
        if (this.cell.y != this.sibling.cell.y) { return this.cell.y > this.sibling.cell.y }
        if (this.cell.x != this.sibling.cell.x) { return this.cell.x > this.sibling.cell.x }
        return this.cell.logs.indexOf(this) < this.cell.logs.indexOf(this.sibling);
    }
    toSave() {
        let save = {}
        save.x = this.cell.x
        save.y = this.cell.y
        let z = this.cell.logs.indexOf(this)
        if (z) save.z = z; // no need if no stack
        save.ox = this.origin.x
        save.oy = this.origin.y
        if (this.isRaft) {
            save.isRaft = this.isRaft;
            save.ox2 = this.origin2.x;
            save.oy2 = this.origin2.y;
        }
        save.axis = this.axis
        if (this.isCanonicalSibling()) {
            let s = this.sibling;
            save.sx = s.cell.x;
            save.sy = s.cell.y;
            save.sz = s.cell.logs.indexOf(s);
        }

        return save
    }
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
    if (save.isRaft) {
        log.isRaft = save.isRaft;
        log.origin2 = this.cells[save.oy2][save.ox2]
        log.origin2.chopped = true;
    }
    if (save.sx != null) {
        // has sibling, which is already loaded
        let sibling = this.cells[save.sy][save.sx].logs[save.sz]
        console.assert(sibling, "Sibling of a double-log segment could not be located.")
        log.sibling = sibling;
        sibling.sibling = log;
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
    floats() {
        return this.logs.length && this.logs[0].isRaft;
    }
    baseElevation() {
        switch (this.terrain) {
            case 'P':
            case 'S':
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
    getElevation() {
        let tl = this.topLog();
        return tl ? tl.getElevation() + tl.height() : this.baseElevation();
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