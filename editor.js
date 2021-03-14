TERRAIN_CHARS = {
    pan: null,
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
TERRAIN_TOOLTIPS = {
    pan: "[pan]",
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
    selectedTool: null,
    toolsVisible: false,
    dialogOpen: false,
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
    $("#terrain-buttons input").removeClass("selected");
    if (Editor.selectedTool != TERRAIN_CHARS[terrain] && terrain) {
        $("#button-" + terrain).addClass("selected");
        Editor.selectedTool = TERRAIN_CHARS[terrain];
    } else {
        // deselect instead (prevents accidental drawing)
        $("#button-pan").addClass("selected");
        Editor.selectedTool = null;
    }
}

Editor.useTool = function(px, py) {
    if (this.selectedTool) {
        pos = View.canvasToTile(px, py);
        if (pos != null) {
            Editor.placeTile(pos.x, pos.y, Editor.selectedTool);
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
    for (let terrain in TERRAIN_CHARS) {
        makeButton(terrain, event => {
            Editor.selectTool(terrain);
        }, TERRAIN_TOOLTIPS[terrain]).appendTo(editorButtons)
    }
    Editor.selectTool(null);
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
    TMPLOG(dx, dy, onLeft, onTop);
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
    if ((event.buttons & 4) || Editor.selectedTool == null) {
        View.startDrag(event.clientX, event.clientY);
    }
    if (event.buttons & 1) {
        Editor.useTool(event.offsetX, event.offsetY);
    }
}

canvas.onmouseup = function(event) {
    event.preventDefault();
    View.stopDrag();
}

canvas.onmousemove = function(event) {
    event.preventDefault();
    View.doDrag(event.clientX, event.clientY);
    if (event.buttons & 1) {
        Editor.useTool(event.offsetX, event.offsetY);
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
    GameState.loadFrom(originalLevelSave);
    View.draw();

    $("body")[0].addEventListener('copy', saveToClipboardData);
    $("body")[0].addEventListener('paste', loadFromClipboardData);
    $("body")[0].addEventListener('keydown', processInput);
}