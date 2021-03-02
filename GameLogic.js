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