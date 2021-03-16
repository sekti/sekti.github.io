TOOL_CHARS = {
    pan: null,
    dragdrop: null,
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
TOOL_TIPS = {
    pan: "[pan]",
    dragdrop: "select, drag and drop",
    water: 'water',
    grass: 'grass',
    tree: 'tree',
    talltree: 'tall tree',
    rock: 'small boulder',
    boulder: 'tall boulder',
    postbox: 'post box',
    secret: 'friend',
    reset: 'island\'s reset position',
    start: 'map\'s start position',
}
MENU_FUNCTIONS = {
    newmap: "create a new map of water tiles",
    changedimensions: "extend or shrink the map",
    resetall: "reset all islands and the player",
    editmeta: "edit map title and author",
}

Editor = {
    selectedTool: "pan",
    toolsVisible: false,
    dialogOpen: false,
    dragDropCells: [],
    dragDropRect: null,
    dragDropStart: null,
    dragDropEnd: null,
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
Editor.selectTool = function(tool) {
    if (this.dragDropCells.length) {
        this.dragDropCells = []
        View.draw();
    }
    $("#terrain-buttons input").removeClass("selected");
    if (this.selectedTool != tool) {
        $("#button-" + tool).addClass("selected");
        this.selectedTool = tool;
    } else {
        // deselect instead (prevents accidental drawing)
        $("#button-pan").addClass("selected");
        this.selectedTool = "pan";
    }
}

Editor.useTool = function(px, py) {
    // most tools paint terrain
    if (TOOL_CHARS[this.selectedTool]) {
        pos = View.canvasToTile(px, py);
        if (pos != null) {
            Editor.placeTile(pos.x, pos.y, TOOL_CHARS[this.selectedTool]);
            View.draw();
        }
    }
}

Editor.addControls = function() {
    function makeButton(name, fn, tooltip) {
        let pngName = "./img/button-" + name + ".png"
        let button = $("<input/>").attr("type", "button").attr("id", "button-" + name).attr("title", tooltip)
            .css("background-image", "url(" + pngName + ")");
        button.on("click", fn);
        return button;
    }

    // terrain buttons
    let editorButtons = $("#terrain-buttons");
    for (let terrain in TOOL_CHARS) {
        makeButton(terrain, event => {
            Editor.selectTool(terrain);
        }, TOOL_TIPS[terrain]).appendTo(editorButtons)
    }
    Editor.selectTool("pan");
    // menu bottons
    let menuButtons = $("#menu-buttons");
    for (let command in MENU_FUNCTIONS) {
        makeButton(command, event => {
            Editor[command]();
        }, MENU_FUNCTIONS[command]).appendTo(menuButtons)
    }
    // toggle-menu button
    makeButton("toggleeditor", event => {
        Editor.toggleeditor();
    }, "show/hide editor buttons").appendTo($("#important-buttons"))
    makeButton("about", event => {
        Editor.about();
    }, "help/about").appendTo($("#important-buttons"))

    this.toggleeditor();
}

/* Drag Drop functionality */
Editor.updateDragDropSet = function() {
    this.dragDropCells = []
    let r = this.dragDropRect;
    let canonical = { // logical rectangle
        x0: Math.min(r.x0, r.x1),
        y0: Math.min(r.y0, r.y1),
        x1: Math.max(r.x0, r.x1),
        y1: Math.max(r.y0, r.y1)
    }
    pos0 = View.canvasToTile(canonical.x0, canonical.y0);
    pos1 = View.canvasToTile(canonical.x1, canonical.y1);

    for (let x = pos0.x + 1; x < pos1.x; ++x) {
        for (let y = pos0.y + 1; y < pos1.y; ++y) {
            let terrain = GameState.getTerrain(x, y);
            if (terrain && terrain != ' ') {
                this.dragDropCells.push({ x: x, y: y });
            }
        }
    }
}
Editor.pickup = function(px, py) {
    // am I clicking on a selected tile?
    let pos = View.canvasToTile(px, py)
    if (this.dragDropCells && this.dragDropCells.some(p => p.x == pos.x && p.y == pos.y)) {
        // start drag drop
        this.dragDropStart = this.dragDropEnd = pos;
    } else {
        // remove selection
        this.dragDropCells = []
            // start selection
        this.dragDropRect = {
            x0: px,
            x1: px,
            y0: py,
            p1: py,
        }
    }

    View.draw();
}
Editor.drag = function(px, py) {
    if (this.dragDropRect) {
        this.dragDropRect.x1 = px;
        this.dragDropRect.y1 = py;
        this.updateDragDropSet()
        View.draw();
    } else if (this.dragDropStart) {
        this.dragDropEnd = View.canvasToTile(px, py)
        View.draw();
    }
}
Editor.drop = function(px, py) {
    if (this.dragDropRect) {
        this.dragDropRect = null;
        View.draw();
    } else if (this.dragDropStart) {
        let dx = this.dragDropEnd.x - this.dragDropStart.x
        let dy = this.dragDropEnd.y - this.dragDropStart.y
        GameState.moveCells(this.dragDropCells, dx, dy); //also moves the selection
        this.dragDropEnd = this.dragDropStart = null;
        // move selection accordingly
        this.dragDropCells = this.dragDropCells.filter(pos => GameState.getCell(pos.x, pos.y));
        View.draw();
    }
}
Editor.drawDragDropOverlay = function() {
    if (this.dragDropCells) {
        for (let pos of this.dragDropCells) {
            View.drawTile(pos.x, pos.y, TILESET.SELECTION);
        }
    }
    if (this.dragDropRect) {
        ctx.beginPath();
        let r = this.dragDropRect;
        ctx.rect(Math.min(r.x0, r.x1), Math.min(r.y0, r.y1), Math.abs(r.x0 - r.x1), Math.abs(r.y0 - r.y1));
        ctx.stroke();
    }
    if (this.dragDropStart && this.dragDropEnd) {
        console.assert(this.dragDropCells && this.dragDropEnd)
            // show phantom of where drag drop would place selected tiles
        let dx = this.dragDropEnd.x - this.dragDropStart.x
        let dy = this.dragDropEnd.y - this.dragDropStart.y
        for (let pos of this.dragDropCells) {
            View.drawTile(pos.x + dx, pos.y + dy, TILESET.DRAGGING);
        }
    }
}

Editor.openDialog = function(id) {
    $("#overlay-container").removeClass("hidden");
    $("#overlay-container > div").addClass("hidden");
    $("#" + id).removeClass("hidden");
    this.dialogOpen = true;
}
Editor.closeDialog = function() {
    $("#overlay-container").addClass("hidden");
    this.dialogOpen = false;
}

Editor.newmap = function() {
    this.openDialog("newmap")
}
Editor.confirmNewMap = function() {
    let saveGame = {}
    saveGame.title = "[untitled]"
    saveGame.author = "[unknown author]"
    saveGame.dimX = +$("#editdimx")[0].value
    saveGame.dimY = +$("#editdimy")[0].value
    saveGame.map = Array(saveGame.dimX).fill(' '.repeat(saveGame.dimY))
    GameState.loadFrom(saveGame)
    GameState.undoStack = []
    this.closeDialog();
}
Editor.changedimensions = function() {
    $("#editddimx")[0].value = 0;
    $("#editddimy")[0].value = 0;
    this.openDialog("changedimensions")
}
Editor.confirmChangeDimensions = function() {
    let dx = +$("#editddimx")[0].value;
    let dy = +$("#editddimy")[0].value;
    let onLeft = $("#ddimxleft")[0].checked;
    let onTop = $("#ddimytop")[0].checked;
    if (dx || dy) {
        GameState.addSpace(dx, dy, onLeft, onTop);
    }
    this.closeDialog();
}
Editor.resetall = function() {
    GameState.resetAll();
}
Editor.editmeta = function() {
    $("#edittitle")[0].value = GameState.title;
    $("#editauthor")[0].value = GameState.author;
    $("#finished")[0].checked = GameState.finished;
    this.openDialog("editmeta")
}
Editor.confirmEditMeta = function() {
    GameState.snapshot(true); // part of the static information
    GameState.setTitleAuthorFinished($("#edittitle")[0].value, $("#editauthor")[0].value, $("#finished")[0].checked);
    this.closeDialog();
}

Editor.about = function() {
    this.openDialog("about")
}

Editor.toggleeditor = function() {
    this.toolsVisible = !this.toolsVisible;
    if (!this.toolsVisible) {
        this.selectTool(null);
        $("#terrain-buttons").addClass("hidden")
        $("#menu-buttons").addClass("hidden")
        $("#button-toggleeditor").removeClass("selected")
    } else {
        $("#terrain-buttons").removeClass("hidden")
        $("#menu-buttons").removeClass("hidden")
        $("#button-toggleeditor").addClass("selected")
    }
}

canvas.onwheel = function(event) {
    event.preventDefault();
    View.zoom(event.deltaY < 0);
};

canvas.onmousedown = function(event) {
    if (event.buttons & 2) { return; } // right mouse button
    event.preventDefault();
    if ((event.buttons & 4) || Editor.selectedTool == "pan") {
        View.startPan(event.clientX, event.clientY);
    }
    if (event.buttons & 1) {
        Editor.useTool(event.offsetX, event.offsetY);
        if (Editor.selectedTool == "dragdrop") {
            Editor.pickup(event.offsetX, event.offsetY)
        }
    }
}

canvas.onmouseup = function(event) {
    event.preventDefault();
    View.stopPan();
    if (Editor.selectedTool == "dragdrop") {
        Editor.drop(event.offsetX, event.offsetY)
    }
}

canvas.onmousemove = function(event) {
    event.preventDefault();
    View.doPan(event.clientX, event.clientY);
    if (event.buttons & 1) {
        Editor.useTool(event.offsetX, event.offsetY);
        if (Editor.selectedTool == "dragdrop") {
            Editor.drag(event.offsetX, event.offsetY)
        }
    }
}

canvas.onclick = function(event) {
    let pos = View.canvasToTile(event.offsetX, event.offsetY)
    if (GameState.fastTraveling) {
        GameState.endFastTravel(pos.x, pos.y)
        event.preventDefault();
        View.draw()
    }
}

function postMessage(msg, isError = false) {
    let pane = $("#message-pane")
    pane.removeClass("posted")
    pane.text(msg);
    void pane[0].offsetWidth; // needed magic to restart the css animation
    pane.addClass("posted") // will fade
    isError ? pane.addClass("error") : pane.removeClass("error")
}

function processInput(event) {
    if (Editor.dialogOpen) return;
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
            break;
        case "r":
            GameState.resetIsland();
            break;
        case "T": // only capital T.
            GameState.startFastTravel(true);
            break;
        case "Z":
            GameState.undo(true);
            break;
        case "z":
            GameState.undo();
            break;
        default:
            doneSomething = false;
    }
    if (doneSomething) {
        event.preventDefault();
        View.draw();
    }
}

window.onload = function() {
    console.log("Loading default level...")
        //loadFromText(defaultLevelJSON) // '{"map":["          ","   · ···  ","     ·2·  ","   B  ··  ","   ··PR·  ","   ·1···  ","          "],"dimX":10,"dimY":7,"startX":6,"startY":3}'
    updateCanvas(); // loading a save will need to know the canvas size to focus
    Editor.addControls();
    View.makeTiles();
    GameState.loadFrom(originalLevelSave);

    $("body")[0].addEventListener('copy', saveToClipboardData);
    $("body")[0].addEventListener('paste', loadFromClipboardData);
    $("body")[0].addEventListener('keydown', processInput);
}