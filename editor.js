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

canvas.onclick = function(event) {
    let pos = View.canvasToTile(event.offsetX, event.offsetY)
    if (GameState.fastTraveling && !View.clickIsDrag) {
        GameState.endFastTravel(pos.x, pos.y)
        event.preventDefault();
        View.draw()
    }
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
            break;
        case "r":
            GameState.resetIsland();
            break;
        case "t":
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
    GameState.loadFrom(originalLevelSave);
    Editor.addControls();
    View.draw();

    $("body")[0].addEventListener('copy', saveToClipboardData);
    $("body")[0].addEventListener('paste', loadFromClipboardData);
    $("body")[0].addEventListener('keydown', processInput);
}