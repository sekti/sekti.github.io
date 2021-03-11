class Log {
    constructor(cell) {
        this.axis = 0; // upright
        this.isRaft = 0; // other possible values: 1 or -1 for different axes
        this.sibling = null;
        this.cell = cell;
        this.origin = cell;
    }
    moveTo(dir, moveSibling = true) {
        this.cell.removeLog(this)
        this.cell = this.cell.nextCell(dir);
        this.cell.addLog(this);
        if (this.sibling && moveSibling) {
            this.sibling.cell.removeLog(this.sibling)
            this.sibling.cell = this.sibling.cell.nextCell(dir);
            this.sibling.cell.addLog(this.sibling);
        }
    }
    settle(preferredAxis) { // dir is the direction a standing log assumes if it turns out its in water
        function supported(log) {
            return log.getLogBelow(true) || log.getElevation() == log.cell.baseElevation();
        }
        if (this.sibling) {
            // logs supported by the ground are fine
            if (this.hasGroundContact()) {
                return;
            }
            let support1 = this.getLogBelow(true)
            let support2 = this.sibling.getLogBelow(true)
            if (!support1) {
                // think about it from the other perspective
                this.sibling.settle();
                return;
            }
            // log is supported by support1, log.sibling might be supported
            console.assert(support1, "Unsupported double log?")
                // rafts count like the ground
            if (support1.isRaft || (support2 && support2.isRaft)) {
                return
            }

            // if the support is in the water, I might have to turn it.
            if (this.getElevation() == 0) {
                // if I can turn a single log in the water to allow raft making, I will
                if (!support2 && !support1.sibling && support1.axis != this.axis) {
                    support1.axis = this.axis;
                    this.settle() // try again
                    return;
                } else if (support2 && support1.axis != support2.axis) {
                    // one of them can be turned, don't care which.
                    support1.axis = support2.axis = this.axis;
                    this.settle();
                    return;
                }
            }
            // raft building on land or water, now requiring aligned logs
            if (support1.axis == this.axis && (!support2 || support2.axis == this.axis)) {
                // both aligned.
                // are they the same log?
                if (support1.sibling == support2) {
                    this.makeRaftWith(support1) //automatically merges the siblings
                    return;
                }
                // all merges are separate
                let divorcedSibling = this.sibling;
                this.divorce();
                support1.divorce();
                this.makeRaftWith(support1);
                if (support2) {
                    divorcedSibling.makeRaftWith(support2);
                }
                return;
            }

            // 2 logs don't like to be supported on only one side
            // if that is neither a raft nor terrain
            if (!support2) {
                // try to slide off in this direction
                let dx = this.sibling.cell.x - this.cell.x;
                let dy = this.sibling.cell.y - this.cell.y;
                let dir = dirFromDxDy(dx, dy);
                let nextCell = this.sibling.cell.nextCell(dir);
                if (nextCell.getElevation() < this.getElevation()) {
                    // slide over
                    this.moveTo(dir);
                    // might do something there
                    this.settle();
                    return;
                }
                // try to push out the supporting log, if that is in water and a 2 log
                if (support1.sibling && support1.getElevation() < 0) {
                    dx = support1.sibling.cell.x - support1.cell.x;
                    dy = support1.sibling.cell.y - support1.cell.y;
                    dir = dirFromDxDy(dx, dy);
                    nextCell = support1.sibling.cell.nextCell(dir);
                    if (nextCell.getElevation() < 0) {
                        support1.moveTo(dir);
                        return; // settled now (bottom log in water)
                    }
                }
            }
            return; // no further settling maneuvers known to me.
        }
        // if I am in water, I need to assume a direction
        if (this.axis == 0 && this.getElevation() == -2 && !this.isRaft) {
            this.axis = preferredAxis;
        }
        // check if I need to combine with other logs
        let log = this.getLogBelow()
            // can only combine with lying logs that are not rafts
        if (!log || log.isRaft || !log.axis || this.isRaft) return;
        // same orientation or one is in water
        if (this.axis == log.axis || log.getElevation() < 0) {
            log.makeRaftWith(this)
        }
    }
    getNextBelowElevation() {
        // elevation of whatever is below this log (usually equal to getElevation())
        let below = this.getLogBelow();
        return below ? below.getTopElevation() : this.cell.baseElevation();
    }
    getTopElevation() {
        return this.getElevation() + this.height();
    }
    getElevation() {
        // special case for standing double log
        if (this.sibling && !this.isRaft && this.axis == 0) return 1; // must be on stump
        let logs = this.sibling ? [this, this.sibling] : [this];
        let elevs = logs.map(log => {
            let below = log.getLogBelow();
            return below ? below.getElevation() + below.height() : log.cell.baseElevation();
        })
        return Math.max(...elevs);
    }
    height() {
        // special case for standing double log
        if (this.sibling && !this.isRaft && this.axis == 0) return 8;
        if (this.isRaft) { return 2 };
        return this.axis ? 2 : 4; // standing logs are 4 stumps high.
    }
    getLogBelow(strict = false) {
        let i = this.cell.logs.indexOf(this)
        let log = i ? this.cell.logs[i - 1] : null;
        return (log && strict && !this.liesOn(log)) ? null : log;
    }
    getLogAbove(strict = false) {
        let i = this.cell.logs.indexOf(this)
        let log = (i < this.cell.logs.length - 1) ? this.cell.logs[i + 1] : null;
        return (log && strict && !log.liesOn(this)) ? null : log;
    }
    liesOn(log) {
        // assumes they share a cell and there is no log in between.
        // however, a double log might not have actual contact.
        return log.getElevation() + log.height() == this.getElevation();
    }
    hasGroundContact() {
        return this.getElevation() == this.cell.baseElevation() ||
            (this.sibling && this.sibling.getElevation() == this.sibling.cell.baseElevation());
    }
    getRaft() {
        // am I lying on a (unique) raft?
        if (this.isRaft && this.getElevation() < 0) {
            if (this.sibling && !this.isCanonicalSibling()) {
                return this.sibling;
            }
            return this;
        }
        if (this.hasGroundContact()) return null;
        let logs = this.sibling ? [this, this.sibling] : [this];
        let rafts = logs.map(log => log.getLogBelow(true)).filter(_ => _).map(log => log.getRaft()).filter(_ => _);
        switch (rafts.length) {
            case 0:
                return null;
            case 1:
                return rafts[0];
            case 2:
                return rafts[0] == rafts[1] ? rafts[0] : null;
        }
    }
    draw() {
        let tile;
        if (this.sibling) {
            if (this.isRaft == HORIZONTAL) {
                tile = this.cell.x < this.sibling.cell.x ? TILESET.RAFT2_HORIZONTAL_LEFT : TILESET.RAFT2_HORIZONTAL_RIGHT
            } else if (this.isRaft == VERTICAL) {
                tile = this.cell.y < this.sibling.cell.y ? TILESET.RAFT2_VERTICAL_TOP : TILESET.RAFT2_VERTICAL_BOTTOM
            } else if (!this.axis) {
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
        } else if (this.isRaft) {
            tile = (this.isRaft == HORIZONTAL ? TILESET.RAFT_HORIZONTAL : TILESET.RAFT_VERTICAL);
        } else {
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
        }
        View.drawProp(this.cell.x, this.cell.y - this.getElevation() * STUMP_VISUAL_HEIGHT, tile)
    }
    divorce() {
        if (this.sibling) {
            this.sibling = this.sibling.sibling = null;
        }
    }
    makeRaftWith(log) {
        console.assert(!this.isRaft && !log.isRaft, "Cannot make raft out of rafts.");
        console.assert(this.axis, "Cannot make raft with upright log.");

        if (this.sibling && log.sibling && this.sibling.cell == log.sibling.cell) {
            // make double raft
            log.cell.removeLog(log)
            log.sibling.cell.removeLog(log.sibling)
            this.isRaft = this.axis;
            this.sibling.isRaft = this.axis;
            this.axis = this.sibling.axis = 0;
            this.origin2 = log.origin;
            this.sibling.origin2 = log.sibling.origin;
            return
        } else {
            this.divorce()
            log.divorce();
        }

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

// collection of logs, e.g. a raft and what is lying on top
class LogComplex {
    constructor(base) {
        console.assert(base);
        // find all logs lying (indirectly) on this raft, from bottom to top
        let logs = [base];
        if (base.sibling) logs.push(base.sibling);
        let i = 0; // next log to look at
        for (let i = 0; i < logs.length; ++i) {
            let log = logs[i];
            let above = log.getLogAbove(true);
            if (!above) continue;
            if (above.sibling) {
                let s = above.sibling;
                if (s.hasGroundContact()) continue;
                let supp = s.getLogBelow(true);
                if (supp && logs.indexOf(supp) == -1) continue;
            }
            logs.push(above);
            if (above.sibling) {
                logs.push(above.sibling);
            }
        }
        this.logs = logs;
    }
    hasTerrainObstacles(dir, bonusHeight = 0) {
        return this.logs.some(complexLog => {
            let nextCell = complexLog.cell.nextCell(dir);
            let h = complexLog.getElevation() + bonusHeight;
            return nextCell.baseElevation() > h;
        })
    }
    getLogObstacles(dir, bonusHeight = 0) {
        let obstacles = new Set()
        for (let complexLog of this.logs) {
            let nextCell = complexLog.cell.nextCell(dir);
            let h = complexLog.getElevation() + bonusHeight;
            for (log of nextCell.logs) {
                if (this.logs.indexOf(log) >= 0) continue;
                if (log.getTopElevation() > h) {
                    obstacles.add(log);
                }
            }
        }
        return [...obstacles]
    }
    canMove(dir) {
        return !this.hasTerrainObstacles(dir) && this.getLogObstacles(dir).length == 0;
    }

    move(dir) {
        this.logs.forEach(log => log.moveTo(dir, false));
    }

    grindsToHalt() {
        return this.logs.some(complexLog => {
            // stop if raft is lying on land
            if (complexLog.getElevation() >= 0 && complexLog.hasGroundContact()) return true;
            // stop if raft is lying on other log
            let below = complexLog.getLogBelow(true);
            if (below && this.logs.indexOf(below) == -1) return true;
            return false;
        })
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
            case 'R':
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
        } else {
            // returning a dummy cells reduces the number of problems
            // but might not solve all of them.
            return DUMMY;
        }
    }
    saveLogsTo(logs) {
        for (log of this.logs) {
            logs.push(log.toSave())
        }
    }
}

DUMMY = new CellState(-1, -1, 'B'); // large boulder