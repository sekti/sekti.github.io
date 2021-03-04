GameState.canMove = function(cell, dir) {
    let targetCell = cell.nextCell(dir);
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
        // nudging means: moving together with the log for one field.
    if (!log || log.axis != dir.axis) {
        return false;
    }
    let targetCell = logCell.nextCell(dir);

    function confirmNudge() {
        log.moveTo(dir);
        log.axis = 0; // standing now
        if (log.getElevation() == -2 && !log.isRaft) {
            log.axis = dir.axis; //... unless in the water
        }
        log.settle() // done moving, might combine
    }

    // I cannot nudge if I cannot move out of my cell
    if (cell.topLog() && cell.topLog().axis == -dir.axis) {
        return false;
    }
    // I cannot nudge if I cannot move into the next cell
    let baseLog = log.getLogBelow();
    if (baseLog && baseLog.axis == -dir.axis) {
        return false;
    }

    // how high can I lift my log?
    let logElev = log.getElevation();
    let maxElev = logElev + (log.isRaft ? 0 : 1);

    // there might be some log in the way, might may be bumped out
    let targetLog = targetCell.topLog();
    let targetElev = targetCell.getElevation();
    if (targetLog) {
        // too high, cannot lift
        if (maxElev < targetLog.getElevation) {
            return false;
        }
        // I will bump into it
        GameState.bumpLog(targetLog, dir);
        // that log has moved out now, update
        targetLog = null;
        targetElev = targetCell.getElevation();
    }
    // this happens on land or raft
    if (targetElev <= maxElev) {
        // the top of the other log is high enough to lift my log on top
        confirmNudge()
        return true;
    }
    return false;
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
            return true;
        }
        return false
    }
    let nextLogElev = nextLog.getElevation()
    if (nextLogElev > logElev) {
        // cannot bump log above me
        return false
    }
    // log is at same level or below
    if (nextLog.axis == -log.axis) {
        // can roll on this log if below
        if (logElev >= targetElev) {
            confirmRoll();
            return true;
        }
        return false
    } else if (nextLog.axis == log.axis) {
        if (nextLogElev >= logElev - 1) {
            // I hit that log from the side
            GameState.bumpLog(nextLog, dir)
            return false;
        } else {
            // I fall on top of that log. Try to push off.
            if (this.bumpLog(nextLog, dir)) {
                return true; // I can now move into that spot
            } else {
                // I fall on top of it and make a raft
                nextLog.makeRaftWith(log);
                return true;
            }
        }
    } else if (nextLog.axis == 0) {
        // rolls over when higher
        if (logElev >= targetElev) {
            confirmRoll();
            return true;
        } else {
            // bumps otherwise
            GameState.bumpLog(nextLog, dir)
            return false;
        }
    }
}
GameState.bumpLog = function(log, dir) {
    let elev = log.getElevation();
    let nextCell = log.cell.nextCell(dir);
    let nextElev = nextCell.getElevation();
    if (elev < 0) return false; // cannot bump in water
    if (log.isRaft) {
        // cannot bump the raft itself (because it is on land or unreachable)
        return false;
    } else if (this.tryFloat(log.cell, dir)) {
        return true;
    } else if (log.axis == dir.axis) {
        // cannot be bumped (can only be nudged)
        let support = log.getLogBelow();
        if (support && support.axis == -dir.axis) {
            // unless it can roll of an orthogonal log
            if (nextElev < elev) {
                // and if its going down
                log.moveTo(dir);
                log.axis = 0
                log.settle();
                return true;
            }
        }
        return false;
    } else if (log.axis == 0) {
        // may bump it upwards by 1 stump
        if (nextElev <= elev + 1) {
            log.axis = dir.axis;
            log.moveTo(dir);
            this.bumpLog(log, dir); // might roll over something, so try bumping again
            log.settle();
            return true;
        }
    } else /* log.axis == -dir.axis */ {
        GameState.rollLog(log, dir);
    }
    return false;
}
GameState.tryPush = function(cell, dir) {
    log = cell.topLog()
    let nextCell = cell.nextCell(dir)
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
GameState.tryFloat = function(cell, dir) {
    if (!cell.floats()) {
        return false;
    }
    let nextCell = cell.nextCell(dir)
    if (nextCell.getElevation() >= 0) {
        return false; // no space
    }
    // moves the complete content of the cell into the next cell
    do {
        console.assert(nextCell.logs.length == 0);
        while (cell.logs.length) {
            cell.topLog().moveTo(dir)
        }
        if (this.playerCell == cell) {
            this.playerCell = nextCell;
        }
        cell = nextCell;
        nextCell = cell.nextCell(dir);
    } while (nextCell && nextCell.getElevation() < 0);

    if (cell != this.playerCell) {
        // keep rolling, slide off, whatever.
        this.bumpLog(cell.topLog(), dir)
    }
    return true;
}

GameState.focusPlayer = function() {
    let island = this.getIsland(this.playerCell);
    let isGood = View.tileVisible(this.playerCell.x, this.playerCell.y, 1.5);
    if (island && (!this.onIsland || !isGood)) {
        View.showIsland(island);
    } else if (!isGood) {
        View.cx = this.playerCell.x;
        View.cy = this.playerCell.y;
    }
    this.onIsland = island != null;
}

GameState.input = function(dir) {
    if (this.fastTraveling) {
        console.log("Refusing input while fast-traveling.")
        return;
    }
    this.snapshot() // for undo. Todo: only if stuff happened
    console.log("Going " + dir.name);
    this.lastDir = dir; // direction monster is facing
    let cell1 = this.playerCell
    let cell2 = cell1.nextCell(dir);
    if (this.canMove(cell1, dir)) {
        this.playerCell = this.playerCell.nextCell(dir)
    } else if (cell2.terrain == 'P' && cell1.getElevation() < cell2.baseElevation()) {
        GameState.startFastTravel()
    } else if (cell2.getElevation() > cell1.getElevation() && this.tryFloat(cell1, reverse(dir))) {
        // can still push stuff on land, but cannot nudge or chop
        this.tryPush(cell2, dir);
    } else if (this.tryPush(cell2, dir)) {

    } else if (this.tryNudge(cell1, dir)) {

    } else if (this.tryChop(cell2, dir)) {
        this.tryPush(cell2, dir);
    }
    this.focusPlayer()
}