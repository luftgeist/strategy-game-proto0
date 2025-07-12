import { updateResourceMenu } from "./resources.js"; 
import { scaleTerrain } from "./terrain.js";
import { hideSelectionMenu } from "./ui.js";

export function saveGame() {
    // Cancel animation frame to avoid issues during save
    if (gameInstance.state.animationFrame) {
        cancelAnimationFrame(gameInstance.state.animationFrame);
    }
    
    const gameState = {
        viewportX: gameInstance.state.viewportX,
        viewportY: gameInstance.state.viewportY,
        zoom: gameInstance.state.zoom,
        buildingGraph: gameInstance.state.buildingGraph.toJSON(),

        // Currently exceeds storage quota

        base_terrain: gameInstance.state.base_terrain,
        terrain_compression: gameInstance.state.terrain_compression,
        map_trees: gameInstance.state.map_trees,

        game_env: gameInstance.state.game_env,

        people: gameInstance.state.people.map(person => {
            try {
                const json = person.toJSON();
                // Also save current path information
                json.hasPath = person.currentPath && person.currentPath.length > 0;
                if (json.hasPath) {
                    json.pathIds = person.currentPath.map(vertex => vertex.id);
                    json.pathIndex = person.currentPathIndex;
                }
                return json;
            } catch (error) {
                console.error("Error saving person:", error);
                return null;
            }
        }).filter(p => p !== null) // Filter out any null entries
    };
    
    localStorage.setItem('mapBuildingGame', JSON.stringify(gameState));
    console.log("Game saved.");
    
    // Restart animation loop
    gameInstance.state.lastFrameTime = performance.now();
    gameInstance.animationLoop(gameInstance.state.lastFrameTime);
}

export function loadGame() {
    // Cancel animation frame to avoid issues during load
    if (gameInstance.state.animationFrame) {
        cancelAnimationFrame(gameInstance.state.animationFrame);
    }
    
    const savedState = localStorage.getItem('mapBuildingGame');
    if (savedState) {
        try {
            const gameState = JSON.parse(savedState);
            
            // Restore viewport and zoom
            gameInstance.state.viewportX = gameState.viewportX;
            gameInstance.state.viewportY = gameState.viewportY;
            gameInstance.state.zoom = gameState.zoom;
            
            // Restore building graph
            if (gameState.buildingGraph) {
                const { graph } = Graph.fromJSON(gameState.buildingGraph);
                gameInstance.state.buildingGraph = graph;
                
                // Add event listener for graph changes
                //gameInstance.state.buildingGraph.addEventListener('graph-update', gameInstance.handleGraphChange);
                gameInstance.state.buildingGraph.addEventListener('graph-add-vertex', gameInstance.handleGraphChange);
                gameInstance.state.buildingGraph.addEventListener('graph-rem-vertex', gameInstance.handleGraphChange);
                gameInstance.state.buildingGraph.addEventListener('graph-rem-edge', gameInstance.handleGraphChange);
                
                // Find and set the storehouse reference
                gameInstance.state.storehouse = Array.from(gameInstance.state.buildingGraph.vertices.values()).find(v => 
                    v.type === 'storehouse'
                );

                gameInstance.state.palace = Array.from(gameInstance.state.buildingGraph.vertices.values()).find(v => 
                    v.type === 'palace'
                );
            }

            gameInstance.state.terrain_compression = gameState.terrain_compression;
            gameInstance.state.base_terrain = gameState.base_terrain;
            gameInstance.state.terrain = scaleTerrain(gameInstance.state.base_terrain, gameInstance.state.terrain_compression);
            
            gameInstance.state.map_trees = gameState.map_trees;

            gameInstance.state.game_env = gameState.game_env;
            
            // Restore people
            gameInstance.state.people = [];
            if (gameState.people && Array.isArray(gameState.people)) {
                gameState.people.forEach(personData => {
                    try {
                        const person = Person.fromJSON(personData, gameInstance.state.buildingGraph);
                        if (person) {
                            gameInstance.state.people.push(person);
                        }
                    } catch (error) {
                        console.error("Error loading person:", error);
                    }
                });
                
                // Restore people's paths if they had any
                gameInstance.state.people.forEach(person => {
                    try {
                        const personData = gameState.people.find(p => p.id === person.id);
                        if (personData && personData.hasPath && Array.isArray(personData.pathIds)) {
                            // Reconstruct path from saved vertex IDs
                            person.currentPath = personData.pathIds.map(id => 
                                Array.from(gameInstance.state.buildingGraph.vertices.values()).find(v => v.id === id)
                            ).filter(v => v !== undefined); // Filter out any vertices that no longer exist
                            person.currentPathIndex = personData.pathIndex;
                            
                            // Set the next target
                            if (person.currentPath.length > 0) {
                                person.setNextTarget();
                            }
                        }
                    } catch (error) {
                        console.error("Error restoring person path:", error);
                        person.currentPath = [];
                        person.currentPathIndex = 0;
                    }
                });
            }
            
            // Clear selections
            gameInstance.state.selectedVertex = null;
            gameInstance.state.selectedEdge = null;
            gameInstance.state.selectedPerson = null;
            gameInstance.state.currentBuildingCategory = null;
            hideSelectionMenu();
            
            // Update UI
            updateResourceMenu();
            
            // Recreate building menu
            gameInstance.switchToBuildingCategory();
            
            // Trigger redraw
            gameInstance.state.terrainNeedsRedraw = true;
            gameInstance.redraw();
            
            console.log("Game loaded.");
        } catch (e) {
            console.error("Error loading game:", e);
        }
    } else {
        console.log("No saved game found.");
    }
    
    // Restart animation loop
    gameInstance.state.lastFrameTime = performance.now();
    gameInstance.animationLoop(gameInstance.state.lastFrameTime);
}