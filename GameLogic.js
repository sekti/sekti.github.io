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

// nudging means: moving together with the log for one field.
GameState.tryNudge = function(cell, dir) {
    // monster stands in cell
    let logCell = cell.nextCell(dir)
    let log = logCell.topLog()
        // can only nudge rafts and aligned logs
    if (!log) return false;
    if (log.axis != dir.axis && !log.isRaft) {
        return false;
    }

    function confirmNudge() {
        log.moveTo(dir);
        if (log.sibling) log.sibling.moveTo(dir);
        if (!log.sibling && !log.isRaft) {
            log.axis = 0; // standing now
        }
        if (log.getElevation() == -2 && !log.isRaft) {
            log.axis = dir.axis; //... when in the water, retains its directionality
        }
        log.settle() // done moving, might combine
        GameState.playerCell = logCell
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
    let maxElev = logElev;
    if (!log.isRaft && !log.sibling) maxElev += 1; // those can be lifted

    // there might be some log in the way, might may be bumped out
    let targetCell = logCell.nextCell(dir);
    if (log.sibling) {
        if (targetCell.topLog() != log.sibling) {
            // something else is lying on the log I want to nudge
            return false;
        }
        // what needs to be empty is the cell beyond
        targetCell = targetCell.nextCell(dir);
    }
    let targetLog = targetCell.topLog();
    let targetElev = targetCell.getElevation();
    if (targetLog) {
        if (maxElev < targetLog.getElevation()) {
            // too high, cannot lift
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
    //           [cell]→[nextCell]
    // [Monster]→[log ]→[nextLog ]
    let logs = log.sibling ? [log, log.sibling] : [log];
    let logElev = log.getElevation();
    let cells = logs.map(l => l.cell);
    let nextCells = cells.map(c => c.nextCell(dir));
    let nextElev = Math.max(...nextCells.map(c => c.getElevation()));
    let bumpable = function(l) {
        if (!l) return false;
        if (l.isRaft || l.axis == dir.axis) return false;
        // standing logs or logs lying in parallel
        return true;
    }
    let nextHardElev = Math.max(...nextCells.map(c => {
        return bumpable(c.topLog()) ? c.topLog().getElevation() : c.getElevation();
    }))

    if (logElev < 0) {
        // logs in the water do not roll
        return false;
    }

    if (nextHardElev > logElev) {
        // hard obstacle in the way
        return false;
    }
    let confirmRoll = function(goOn) {
        logs.forEach(l => l.moveTo(dir))
        if (goOn) {
            GameState.rollLog(logs[0], dir); // continue
        } else {
            log.settle();
        }
    }
    let nextBumpableLogs = nextCells.map(c => c.topLog()).filter(l => l && bumpable(l));
    if (!nextBumpableLogs.length) {
        // no log to bump found → keep rolling rolling rolling
        confirmRoll(true);
        return true;
    }

    if (nextElev > logElev) {
        // bumpable obstacle in the way, bump all I can reach
        nextBumpableLogs.filter(l => l.getTopElevation() > logElev).forEach(l => GameState.bumpLog(l, dir));
        return false;
    }
    // there are bumpable obstacles *below*, bump the highest
    nextBumpableLogs.filter(l => l.getTopElevation() == nextElev).forEach(l => GameState.bumpLog(l, dir));
    // roll into the field, but stop there
    confirmRoll(false);
}

GameState.bumpLog = function(log, dir) {
    let elev = log.getElevation();
    let nextCell = log.cell.nextCell(dir);
    let nextElev = nextCell.getElevation();
    if (elev < 0) return false; // cannot bump in water
    if (log.isRaft) {
        // cannot bump the raft itself (because it is on land or unreachable)
        return false;
    }
    // only the player can push rafts, so I removed this:
    /* else if (this.tryFloat(log.cell, dir)) {
        return true; 
    } */
    else if (log.axis == dir.axis) {
        // cannot be bumped (can only be nudged)
        // unless it can roll off an orthogonal log
        if (log.sibling) return false;
        let support = log.getLogBelow();
        if (support && support.axis == -dir.axis) {
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
        if (log.sibling) {
            // chopping 2-trees is complicated
            if (nextCell.getElevation() > 2) {
                let nextLog = nextCell.topLog();
                nextLog && this.bumpLog(nextLog, dir)
                if (nextCell.getElevation() > 2) {
                    //still an obstacle? → can't chop
                    return false;
                }
            }
            let farCell = nextCell.nextCell(dir)
            let farLog = farCell.topLog()
            farLog && this.bumpLog(farLog, dir); // whatever is in there, it gets bumped.
            log.axis = log.sibling.axis = dir.axis;
            log.moveTo(dir);
            if (farCell.getElevation() <= 2) {
                // far Cell empty enough, can move in there
                log.sibling.moveTo(dir)
                log.sibling.moveTo(dir)
            }
            return true;
        }
        // may bump it upwards by 1 stump
        if (nextElev <= elev + 1) {
            log.axis = dir.axis;
            log.moveTo(dir);
            let below = log.getLogBelow(log);
            TMPLOG(below)
                // can roll over log below of the right axis if not in water and the cell beyond is free
            if (below && below.getElevation() >= 0 && below.axis == -dir.axis && log.cell.nextCell(dir).getElevation() < log.getElevation()) {
                log.moveTo(dir);
                log.axis = 0;
            }
            log.settle();
            return true;
        }
        let nextLog = nextCell.topLog()
        if (nextLog && nextLog.getElevation() < log.getTopElevation()) {
            // I might be able to bump this away
            if (this.bumpLog(nextLog, dir)) {
                this.bumpLog(log, dir); // try again
            }
        }
    } else /* log.axis == -dir.axis */ {
        return GameState.rollLog(log, dir);
    }
    return false;
}
GameState.tryPush = function(cell, dir) {
    log = cell.topLog()
    if (!log) return false;
    return this.bumpLog(log, dir)
}
GameState.tryChop = function(cell, dir) {
    if (cell.terrain == "1" && !cell.chopped) {
        cell.chopped = true;
        cell.addLog(new Log(cell))
        return true;
    }
    if (cell.terrain == "2" && !cell.chopped) {
        cell.chopped = true;
        let l1 = new Log(cell);
        l2 = new Log(cell);
        l1.sibling = l2;
        l2.sibling = l1;
        cell.addLog(l1);
        cell.addLog(l2);
        return true;
    }
    return false;
}
GameState.pushRaft = function(raft, dir, playerOnRaft) {
    let Raft = raft.getRaftComplex();
    // the raft complex moves until terrain or a foreign log is at or above the field a raft log moves in
    function canMove() {
        return Raft.every(raftLog => {
            let nextCell = raftLog.cell.nextCell(dir);
            let h = raftLog.getElevation();
            return nextCell.baseElevation() <= h && // terrain
                nextCell.logs.every(log =>
                    Raft.indexOf(log) >= 0 || log.getTopElevation() <= h //non-raft obstacle
                )
        })
    }
    if (!canMove()) { return false; }
    do {
        Raft.forEach(log => log.moveTo(dir));
        if (playerOnRaft) this.playerCell = this.playerCell.nextCell(dir);
    } while (canMove());

    Raft.forEach(log => GameState.bumpLog(log, dir)); // keep rolling, slide off or something.
    return true;
}
GameState.tryPushFloat = function(cell, dir) {
    // player in cell, pushes in direction dir.
    let nextCell = cell.nextCell(dir);
    if (cell.getElevation() >= nextCell.getElevation()) {
        return false; // monster cannot push something beneath him
    }

    let playerRaft = cell.topLog() ? cell.topLog().getRaft() : null;
    let otherRaft = nextCell.topLog() ? nextCell.topLog().getRaft() : null;
    if (playerRaft == otherRaft) {
        // cannot push a raft from the raft. (or both rafts are null)
        return false;
    }
    // one raft or two different rafts are involved.
    let res = false;
    if (playerRaft) res |= !!this.pushRaft(playerRaft, reverse(dir), true);
    if (otherRaft) {
        res |= !!this.pushRaft(otherRaft, dir, false);
    } else if (res) {
        // no other raft, but I rated away, and pushed something:
        this.tryPush(nextCell, dir);
    }
    return res;
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
            cell.logs[0].moveTo(dir)
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
    } else if (this.tryPushFloat(cell1, dir)) {

    }
    /* } cell2.getElevation() > cell1.getElevation() && this.tryFloat(cell1, reverse(dir))) {
        // can still push stuff on land, but cannot nudge or chop
        this.tryPush(cell2, dir);
    }*/
    else if (this.tryPush(cell2, dir)) {

    } else if (this.tryNudge(cell1, dir)) {

    } else if (this.tryChop(cell2, dir)) {
        this.tryPush(cell2, dir);
    }
    this.focusPlayer()
}