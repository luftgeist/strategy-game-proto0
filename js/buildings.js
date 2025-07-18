// Building-related functions and utilities
import { SpatialLabeledVertex, LabeledEdge, handleVertexOnPathPlacement, findVertexAtPosition } from './graph.js';
import { canStorehouseProvide, storehouseWithdraw, updateResourceMenu } from './resources.js';
import { getTerrainTypeAtPosition } from './terrain.js';
import { setMessage, showSelectionMenu, updateBuildingSelector } from './ui.js';

const style = getComputedStyle(document.documentElement);
const selection_color = style.getPropertyValue('--selection-color') || 'white';

// Create a building vertex at the specified map position
export async function createBuildingVertex(type, x, y, buildingTypes) {
    const buildingType = buildingTypes[type];
    
    await buildingType.img.loaded;
    // Create data object with base properties
    const size = buildingType.size ? buildingType.size : 1;
    const width = buildingType.img.naturalWidth*0.1*size;
    const height = buildingType.img.naturalHeight*0.1*size;
    const data = {
        width,
        height,
        buildingType: type // Store the type for backward compatibility
    };
    
    // If the building type has data template, clone it
    if (buildingType.data) {
        Object.entries(buildingType.data).forEach(([key, value]) => {
            // Deep clone objects, copy primitives
            data[key] = typeof value === 'object' && value !== null 
                ? JSON.parse(JSON.stringify(value)) 
                : value;
        });
    }
    
    let vertex = new SpatialLabeledVertex({
        x, // Center the building at the click point
        y,
        type, // Use the type directly instead of converting name
        data,
        vlabels: ['buildings',],
        elabels: ['buildings'],
    });

    if (vertex.data.buildstate !== 0) {
        vertex.data.buildingprogress = 0;
    }

    if (buildingType.init){
        buildingType.init(vertex)
    }

    return vertex;
}

// Draw all building vertices and edges based on current viewport
export function drawBuildings(drawBottom = false, time) {

    const buildingCtx = gameInstance.buildingCtx;
    const graph = gameInstance.state.graph;
    const viewportX = gameInstance.state.viewportX;
    const viewportY = gameInstance.state.viewportY;
    const zoom = gameInstance.state.zoom;
    const config = gameInstance.config;
    const selectedVertex = gameInstance.state.selectedVertex;
    const selectedEdge = gameInstance.state.selectedEdge;
    
    // Calculate the visible area
    const startX = viewportX;
    const startY = viewportY;
    const endX = startX + config.viewportWidth / zoom;
    const endY = startY + config.viewportHeight / zoom;
    
    // First draw all edges (including roads)
    for (let eid of graph.E['buildings']) {
        let edge = graph.edges[eid];
        const buildingType = config.buildingTypes[edge.type];
        if (buildingType.drawBottom !== drawBottom) {
            continue;
        }
        // Get the vertices connected by edge
        const v0 = edge.v0;
        const v1 = edge.v1;
        const v0Data = v0.data;
        const v1Data = v1.data;
        
        // Calculate center points of buildings for edge connections
        const v0CenterX = v0.x;
        const v0CenterY = v0.y;
        const v1CenterX = v1.x;
        const v1CenterY = v1.y;
        
        // Calculate screen coordinates
        const screenV0X = (v0CenterX - startX) * zoom;
        const screenV0Y = (v0CenterY - startY) * zoom;
        const screenV1X = (v1CenterX - startX) * zoom;
        const screenV1Y = (v1CenterY - startY) * zoom;
        //JUMPSECTION
        if (buildingType && buildingType.renderEdge) {
            buildingType.renderEdge(
                buildingCtx,
                screenV0X,
                screenV0Y,
                screenV1X,
                screenV1Y,
                zoom,
                edge,
                time,
            );
        }
        
        // Highlight selected edge if any
        if (selectedEdge === edge) {
            buildingCtx.strokeStyle = selection_color;
            buildingCtx.lineWidth = 2 * zoom;
            buildingCtx.beginPath();
            buildingCtx.moveTo(screenV0X, screenV0Y);
            buildingCtx.lineTo(screenV1X, screenV1Y);
            buildingCtx.stroke();
        } 
    };
    
    // Then draw all vertices (buildings)
    for (let vid of graph.V.buildings) {
        let vertex = graph.vertices[vid];
        const buildingType = config.buildingTypes[vertex.type];
        if (!!buildingType.drawBottom !== drawBottom) {
            continue;
        }
        const x = vertex.x;
        const y = vertex.y;
        const data = vertex.data;
        const width = data.width;
        const height = data.height;
        const padded_startX = startX - gameInstance.config.renderEdge * zoom;
        const padded_startY = startY - gameInstance.config.renderEdge * zoom;
        const padded_endX = endX + gameInstance.config.renderEdge * zoom;
        const padded_endY = endY + gameInstance.config.renderEdge * zoom;
        if (
            x + width > padded_startX &&
            x < padded_endX &&
            y + height > padded_startY &&
            y < padded_endY
        ) {
            // Calculate position in viewport
            const viewX = (x - startX) * zoom;
            const viewY = (y - startY) * zoom;
            const scaledWidth = width * zoom;
            const scaledHeight = height * zoom;
            
            // Highlight selected vertex if any
            if (selectedVertex === vertex) {
                buildingCtx.save();
                buildingCtx.translate(viewX, viewY);
                buildingCtx.beginPath();
                buildingCtx.strokeStyle = selection_color;
                buildingCtx.lineWidth = 4;
                buildingCtx.roundRect(-scaledWidth/2, -scaledHeight/2, scaledWidth, scaledHeight, 5);
                buildingCtx.stroke();
                buildingCtx.restore();

                /*buildingCtx.save();
                buildingCtx.translate(viewX, viewY);           // Move to center
                buildingCtx.beginPath();
                buildingCtx.strokeStyle = selection_color;
                buildingCtx.lineWidth = 4;

                
                const halfWidth = scaledWidth / 2 / 0.577;
                const halfHeight = scaledHeight / 2;

                buildingCtx.moveTo(0, halfHeight);
                buildingCtx.lineTo(halfWidth, 0); 
                buildingCtx.lineTo(0, -halfHeight);   
                buildingCtx.lineTo(-halfWidth, 0);  
                buildingCtx.closePath();

                buildingCtx.stroke();
                buildingCtx.restore();*/
            }

            buildingType.render(buildingCtx, viewX, viewY, scaledWidth, scaledHeight, zoom, vertex, buildingType.img);
        }
    };
}

// Check if placement conditions for building mode are met
export function canPlaceBuilding(buildingTypeKey, x, y, buildingTypes, graph, terrain, mapWidth, mapHeight, map_trees, waterLevel = 0) {
    const buildingType = buildingTypes[buildingTypeKey];
    
    if (buildingType.name === 'road') {
        return true;
    }

    const size = buildingType.size || 1;
    const width = buildingType.img.naturalWidth*0.1*size;
    const height = buildingType.img.naturalHeight*0.1*size;

    for( let tree of map_trees){
        if (x-width/2 < tree.x && tree.x < x + width/2 && y-height/2 < tree.y && tree.y < y + height/2){
            if (tree.h > 0) {
                setMessage("There seems to be at least one tree in the way")
                return false;
            } else {
                tree.h = -1;
                return true;
            }
        }
    }

    if (buildingType.buildingMode === 'path') {
        return true;
    }

    if (buildingType.buildingMode === 'free') {
        return true;
    }
    
    if (buildingType.buildingMode === 'onterrain') {
        const edgePoints =[]
        edgePoints.push(getTerrainTypeAtPosition(terrain, x-width/2, y, mapWidth, mapHeight, waterLevel));
        edgePoints.push(getTerrainTypeAtPosition(terrain, x+width/2, y, mapWidth, mapHeight, waterLevel));
        edgePoints.push(getTerrainTypeAtPosition(terrain, x, y+height/2, mapWidth, mapHeight, waterLevel));
        edgePoints.push(getTerrainTypeAtPosition(terrain, x, y+height/2, mapWidth, mapHeight, waterLevel));
        for (let point of edgePoints){
            if (point !== buildingType.terrainType) {
                setMessage(`Building can only be placed on ${buildingType.terrainType} terrain, not on ${point}.`);
                return false;
            }
        }
    } else if (buildingType.buildingMode === 'onsometerrain') {
        const terrainType = getTerrainTypeAtPosition(terrain, x, y, mapWidth, mapHeight, waterLevel);
        if (terrainType !== buildingType.terrainType) {
            setMessage(`Building can only be placed on ${buildingType.terrainType} terrain, not on ${terrainType}.`);
            return false;
        }
    } else if (buildingType.buildingMode === 'near') {
        const nearbyBuildingFound = findVertexAtPosition('buildings', x, y, buildingType.epsilon);
        
        if (!nearbyBuildingFound) {
            setMessage(`Building must be placed within ${buildingType.epsilon} units of a ${buildingType.nearType}.`);
            return false;
        }
    }
    
    return true;
}

export async function handlePathPlacement(mapX, mapY, buildingType ){
    const state = gameInstance.state;

    let clickedVertex = findVertexAtPosition(
        'buildings', 
        mapX, 
        mapY
    ); 
    let newVertex;
    if (!clickedVertex) {
        newVertex = await createBuildingVertex(buildingType.name, mapX, mapY, gameInstance.config.buildingTypes);
        clickedVertex = handleVertexOnPathPlacement('buildings', newVertex, buildingType.name ,15)
    }
    
    if (!clickedVertex){
        clickedVertex = newVertex;
        state.graph.addVertex(clickedVertex, ['buildings']);
    }    
    if (!state.roadStartVertex) {
        state.roadStartVertex = clickedVertex;
    } 
    // If we already have a start vertex, create the road
    else if (clickedVertex !== state.roadStartVertex) {
        
        const roadCost = buildingType.calculateCost(state.roadStartVertex, clickedVertex);
        
        if (canStorehouseProvide(roadCost)) {
            storehouseWithdraw(roadCost);
            
            const newEdge = new LabeledEdge({_v0: state.roadStartVertex.id, _v1: clickedVertex.id, type: buildingType.name});
            newEdge.data = { ...buildingType.data }
            
            state.graph.addEdge(newEdge, 'buildings');
            
            // Reset road building state
            state.roadStartVertex = clickedVertex;
            
            // Update resources UI
            updateResourceMenu();
            
            // debounced recalculation of paths for all people - they might have better routes now
            //window.clearTimeout(gameInstance.recalculateAllPathsTimer); 
            //window.setTimeout(()=>{gameInstance.recalculateAllPathsTimer = gameInstance.recalculateAllPaths()}, 100);
            
            // Switch back to selection mode after building
            //switchToSelectionMode();
            
        } else {
            // Visual feedback for affordability
            setMessage("Not enough materials!")
            // Reset road start
            state.roadStartVertex = null;
        }
    }
}

export async function handleBuildingPlacement(mapX, mapY){
    const buildingType = gameInstance.config.buildingTypes[gameInstance.state.currentBuildingType];

    const state = gameInstance.state;
    const config = gameInstance.config;

    if (canStorehouseProvide(buildingType.res)) {
        if (canPlaceBuilding(
            state.currentBuildingType, 
            mapX, 
            mapY, 
            config.buildingTypes, 
            state.graph, 
            state.terrain, 
            config.mapWidth, 
            config.mapHeight,
            state.map_trees,
            state.waterLevel,
        )) {
            const newVertex = await createBuildingVertex(
                state.currentBuildingType,
                mapX,
                mapY,
                config.buildingTypes
            );
            
            state.graph.addVertex(newVertex, ['buildings']);

            storehouseWithdraw(buildingType.res)
            
            // Switch back to selection mode
            state.mode = 'selection';
            state.selectedVertex = newVertex;
            state.selectedEdge = null;
            state.selectedPerson = null;
            showSelectionMenu(newVertex, config.buildingTypes);
            
            // Reset current building category to show main menu
            state.currentBuildingCategory = null;
            
            // Update building selector UI
            gameInstance.switchToBuildingCategory();
            
            updateBuildingSelector();
        } 
    } else {
        setMessage("Not enough resources!");
    }
}