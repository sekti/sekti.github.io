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
    getElevation() {
        return this.cell.getElevation(this);
    }
    height() {
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