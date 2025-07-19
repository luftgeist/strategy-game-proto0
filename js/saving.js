import { updateResourceMenu } from "./resources.js"; 
import { hideSelectionMenu, setMessage } from "./ui.js";
import { initTerrain } from "./terrain.js";
import { SpatialLabeledGraph, SpatialLabeledVertex, LabeledEdge } from "./graph.js";
import { Person } from "./person.js";

export function saveGame(path = "mapBuildingGame") {
    // Cancel animation frame to avoid issues during save
    if (gameInstance.state.animationFrame) {
        cancelAnimationFrame(gameInstance.state.animationFrame);
    }
    
    const gameState = {
        viewportX: gameInstance.state.viewportX,
        viewportY: gameInstance.state.viewportY,
        zoom: gameInstance.state.zoom,
        mapSeed: gameInstance.config.mapSeed,
        terrain_scaling: gameInstance.config.terrain_scaling,
        game_env: gameInstance.state.game_env,
        storehouse: gameInstance.state.storehouse,
        townsquare: gameInstance.state.townsquare,
        palace: gameInstance.state.palace,
    };
    gameState.graph = {
        cellSize: gameInstance.state.graph.cellSize,
        vertices: Object.values(gameInstance.state.graph.vertices).map(v => {
            let vData = {
                id: v.id, x: v.x, y: v.y, vlabels: v.labels, 
                type: v.type, data: {}, elabels: Object.keys(v.e)
            }
            for (let k of Object.keys(v.data)){
                vData.data[k] = v.data[k]
            }
            if (v instanceof Person){
                vData = Person.toJSON(vData);
            }
            return vData;
        }),
        edges: Object.values(gameInstance.state.graph.edges).map(e => {
            const eData = {
                id: e.id, _v0: e._v0, _v1: e._v1, label: e.label,
                type: e.type, data: e.data
            }
            return eData;
        })
    };
    console.log(gameState);
    
    localStorage.setItem(path, JSON.stringify(gameState));
    setMessage("Game saved.");
    
    // Restart animation loop
    gameInstance.state.lastFrameTime = performance.now();
    gameInstance.animationLoop(gameInstance.state.lastFrameTime);
}

export async function loadGame(path="mapBuildingGame") {
    // Cancel animation frame to avoid issues during load
    if (gameInstance.state.animationFrame) {
        cancelAnimationFrame(gameInstance.state.animationFrame);
    }
    
    const savedState = localStorage.getItem(path);
    if (savedState) {
        try {
            const gameState = JSON.parse(savedState);
            
            gameInstance.state.viewportX = gameState.viewportX;
            gameInstance.state.viewportY = gameState.viewportY;
            gameInstance.state.zoom = gameState.zoom;
            gameInstance.state.game_env = gameState.game_env;

            gameInstance.state.graph.removeEventListener('graph-add-vertex', gameInstance.handleGraphChange);
            gameInstance.state.graph.removeEventListener('graph-rem-vertex', gameInstance.handleGraphChange);
            gameInstance.state.graph.removeEventListener('graph-rem-edge', gameInstance.handleGraphChange);

            gameInstance.state.graph = new SpatialLabeledGraph(
                {vertex_labels: {people: [], buildings: []}, edge_labels: {rels: [], buildings: []}}, { cellSize: gameState.graph.cellSize }
            );
                    
            for (let vData of gameState.graph.vertices) {
                let vertex; 
                if (vData.type === "person"){
                    vertex = new Person(vData);
                } else {
                    vertex = new SpatialLabeledVertex(vData);
                }
                gameInstance.state.graph.addVertex(vertex);
            }
            
            for (let eData of gameState.graph.edges) {
                const edge = new LabeledEdge(eData);
                gameInstance.state.graph.addEdge(edge);
            }

            for (let pid of gameInstance.state.graph.V.people){
                Person.fromJSON(gameInstance.state.graph.vertices[pid])
            }

            gameInstance.state.graph.addEventListener('graph-add-vertex', gameInstance.handleGraphChange);
            gameInstance.state.graph.addEventListener('graph-rem-vertex', gameInstance.handleGraphChange);
            gameInstance.state.graph.addEventListener('graph-rem-edge', gameInstance.handleGraphChange);

            gameInstance.state.storehouse = gameState.storehouse;
            gameInstance.state.townsquare = gameState.townsquare;
            gameInstance.state.palace = gameState.palace;

            gameInstance.state.selectedVertex = null;
            gameInstance.state.selectedEdge = null;
            gameInstance.state.selectedPerson = null;
            gameInstance.state.currentBuildingCategory = null;

            if (gameState.mapSeed !== gameInstance.config.mapSeed || gameState.terrain_scaling !== gameInstance.config.terrain_scaling){
                gameInstance.config.mapSeed = gameState.mapSeed;
                gameInstance.config.terrain_scaling = gameState.terrain_scaling;

                gameInstance.state.random.reset(gameInstance.config.mapSeed);
                const {terrain, terrainBitmap, map_wildlife, map_trees } = await initTerrain(gameInstance.state, gameInstance.config);
                
                gameInstance.state.terrain = terrain;
                gameInstance.state.terrain_bitmap = terrainBitmap;
                gameInstance.state.map_trees = map_trees;
                gameInstance.state.map_wildlife = map_wildlife;
            }

            hideSelectionMenu();
            
            // Update UI
            updateResourceMenu();
            
            // Recreate building menu
            gameInstance.switchToBuildingCategory();
            
            // Trigger redraw
            gameInstance.state.terrainNeedsRedraw = true;
            gameInstance.redraw();
            
            setMessage("Game loaded.");
        } catch (e) {
            setMessage('Unable to load Game');
            console.error("Error loading game:", e);
        }
    } else {
        setMessage("No Save game");
        console.log("No saved game found.");
    }
    
    // Restart animation loop
    gameInstance.state.lastFrameTime = performance.now();
    gameInstance.animationLoop(gameInstance.state.lastFrameTime);
}

