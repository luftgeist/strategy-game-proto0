// Game class for handling game logic and state
import { Graph, Edge } from './graph.js';
import { drawTerrain, drawMapObjects, initTerrain } from './terrain.js';
import { 
    createBuildingVertex, drawBuildings, 
    findVertexAtPosition, findEdgeAtPosition, handleBuildingPlacement, 
    handlePathPlacement
} from './buildings.js';
import { payTax,  updateResourceMenu } from './resources.js';
import { 
    updateBuildingSelector, showSelectionMenu, showEdgeSelectionMenu, hideSelectionMenu, 
    updateModeIndicator, createSaveLoadUI, createBuildingMenuCategories, addSoundToAllButtons,
    setMessage, registerSpeedChangeButton,
} from './ui.js';
import { drawPeople, findPersonAtPosition } from './person.js';
import { AudioManager } from './audio-manager.js';

// Visibility API helper
function getVisibilityAPI() {
    let hidden, visibilityChange;
    if (typeof document.hidden !== "undefined") {
        hidden = "hidden";
        visibilityChange = "visibilitychange";
    } else if (typeof document.msHidden !== "undefined") {
        hidden = "msHidden";
        visibilityChange = "msvisibilitychange";
    } else if (typeof document.webkitHidden !== "undefined") {
        hidden = "webkitHidden";
        visibilityChange = "webkitvisibilitychange";
    }
    return { hidden, visibilityChange };
}

export class Game {
    constructor(config) {
        this.config = config;
        
        // Game state
        this.state = {
            buildingGraph: new Graph([], []), // Graph to store building vertices

            viewportX: 0,         // Current viewport position X
            viewportY: 0,         // Current viewport position Y
            zoom: config.initialZoom,  // Current zoom level
            isDragging: false,    // Is the user currently dragging?
            lastMouseX: 0,        // Last mouse X position during drag
            lastMouseY: 0,        // Last mouse Y position during drag
            previewMouseX: 0,     // Last mouse X position for road preview
            previewMouseY: 0,     // Last mouse Y position for road preview
            selectedVertex: null, // Currently selected vertex
            selectedEdge: null,   // Currently selected edge
            selectedPerson: null, // Currently selected person
            mode: 'selection',    // Current mode: 'selection' or 'building'
            roadStartVertex: null, // Starting vertex for road building
            currentBuildingType: 'house',  
            currentBuildingCategory: null, // Current selected category (null if in main menu)
            
            speed: 1,
            animationFrame: null, // Animation frame ID
            lastFrameTime: 0,     // Last frame timestamp
            terrainNeedsRedraw: true, // Flag for terrain redraw

            terrain: null,        // Will store the scaled terrain heightmap data
            terrain_bitmap: null,
            waterLevel: 0,
            map_trees: [],
            map_wildlife: [],
            people: new Map(),           // Array of Person objects

            audio: new AudioManager(), // handles Audio

            townsquare: null,
            storehouse: null,      // Direct reference to the storehouse vertex
            palace: null, 

            game_env: {
                events: {}, // boolean list of story related events, could also include researched perks
                taxrate: { bread: 1 }, // current list of taxes to pay
                taxmins: 10, // the minutes between tax payments
                power: 100, // the amount of influence you have 
                needs: {
                    ration: 0.5 // controls hunger level, when people eat something
                },
            }, // stores most game specific progress data
        };
        
        // Animation and timing controls
        this.maxDeltaTime = 100; // Cap deltaTime to 100ms max to prevent huge jumps
        this.isPaused = false;   // Track if the game is paused due to tab being hidden
        
        // Get the canvas elements and their contexts
        this.terrainCanvas = document.getElementById('terrain-canvas');
        this.buildingCanvas = document.getElementById('building-canvas');
        this.terrainCtx = this.terrainCanvas.getContext('2d');
        this.buildingCtx = this.buildingCanvas.getContext('2d');
        
        // Set canvas sizes
        this.terrainCanvas.width = config.viewportWidth;
        this.terrainCanvas.height = config.viewportHeight;
        this.buildingCanvas.width = config.viewportWidth;
        this.buildingCanvas.height = config.viewportHeight;
        
        this.buildingSelector = document.getElementById('building-selector');
        
        // Bind methods to this context
        this.handleMouseDown = this.handleMouseDown.bind(this);
        this.handleMouseMove = this.handleMouseMove.bind(this);
        this.handleMouseUp = this.handleMouseUp.bind(this);
        this.handleWheel = this.handleWheel.bind(this);
        this.handleClick = this.handleClick.bind(this);
        this.handleRightClick = this.handleRightClick.bind(this);
        this.handleVisibilityChange = this.handleVisibilityChange.bind(this);
        this.redraw = this.redraw.bind(this);
        this.clampViewport = this.clampViewport.bind(this);
        this.init = this.init.bind(this);
        this.animationLoop = this.animationLoop.bind(this);
        this.switchToSelectionMode = this.switchToSelectionMode.bind(this);
        this.handleGraphChange = this.handleGraphChange.bind(this);
        this.handleVertexRemoval = this.handleVertexRemoval.bind(this);
        this.switchToBuildingCategory = this.switchToBuildingCategory.bind(this);
        this.canBuildUniqueBuilding = this.canBuildUniqueBuilding.bind(this);
        
        // Make the instance globally accessible (for callbacks)
        window.gameInstance = this;
    }

    // Handle page visibility changes
    handleVisibilityChange() {
        const { hidden } = getVisibilityAPI();
        this.isPaused = document[hidden];
        
        if (!this.isPaused) {
            // Reset the last frame time when returning to the tab
            this.state.lastFrameTime = performance.now();
        }
    }
    
    async init() {
        // Generate the terrain
        const {terrain, terrainBitmap, map_wildlife, map_trees } = await initTerrain(this.state, this.config);

        this.state.terrain = terrain;
        this.state.terrain_bitmap = terrainBitmap;
        this.state.map_trees = map_trees;
        this.state.map_wildlife = map_wildlife;

        // Add event listeners
        this.buildingCanvas.addEventListener('mousedown', this.handleMouseDown);
        this.buildingCanvas.addEventListener('mousemove', this.handleMouseMove);
        this.buildingCanvas.addEventListener('mouseup', this.handleMouseUp);
        this.buildingCanvas.addEventListener('mouseleave', this.handleMouseUp);
        this.buildingCanvas.addEventListener('wheel', this.handleWheel);
        this.buildingCanvas.addEventListener('contextmenu', this.handleRightClick);
        
        // Add visibility change handler
        const { visibilityChange } = getVisibilityAPI();
        if (visibilityChange) {
            document.addEventListener(visibilityChange, this.handleVisibilityChange, false);
        }
        
        // Add event listener for buildingGraph changes
        //this.state.buildingGraph.addEventListener('graph-update', this.handleGraphChange);
        this.state.buildingGraph.addEventListener('graph-add-vertex', this.handleGraphChange);
        this.state.buildingGraph.addEventListener('graph-rem-vertex', this.handleGraphChange);
        this.state.buildingGraph.addEventListener('graph-rem-edge', this.handleGraphChange);

        addSoundToAllButtons(this.state);
        registerSpeedChangeButton(this.state, this.config);

        let hasInteracted = false;
        const audioloaded = this.state.audio.init0();

        document.addEventListener('click', (async function initAudio() {
            if (!hasInteracted) {
                this.state.audio.audioContext.resume();
                hasInteracted = true;
                document.removeEventListener('click', initAudio);
                await audioloaded;
                this.state.audio.playOnChannel('background_ambiance', 'desert_ambiance', { volume: 1.5});
                //this.state.audio.playOnChannel('background_music', 'music', {volume: 0.15});
                await this.state.audio.init1();
            }
        }).bind(this));

        const map_center = {
            x: this.state.terrain[0].length/2, 
            y: this.state.terrain.length/2,
        };

        this.state.townsquare = await createBuildingVertex(
            'townsquare',
            map_center.x,
            map_center.y,
            this.config.buildingTypes
        );

        this.state.storehouse = await createBuildingVertex(
            'storehouse',
            map_center.x + 80,
            map_center.y - 80,
            this.config.buildingTypes
        );

        this.state.palace = await createBuildingVertex(
            'palace',
            map_center.x - 150,
            map_center.y - 150,
            this.config.buildingTypes
        )


        this.state.buildingGraph.addVertex(this.state.townsquare);
        this.state.buildingGraph.addVertex(this.state.storehouse);
        this.state.buildingGraph.addVertex(this.state.palace);

        this.state.buildingGraph.addEdge(new Edge(this.state.palace, this.state.townsquare, 'road', 0, null));
        this.state.buildingGraph.addEdge(new Edge(this.state.storehouse, this.state.townsquare, 'road', 0, null));

        
        // Start animation loop
        this.state.lastFrameTime = performance.now();
        this.animationLoop(this.state.lastFrameTime);

        this.centerViewport(this.state.palace);

        // Create building menu categories
        this.switchToBuildingCategory();
        
        // Initialize UI
        updateBuildingSelector();
        //createSaveLoadUI();
    }
    
    // Handle changes to the building graph (new roads or buildings)
    handleGraphChange(e) {
        // If a vertex is added, check if it's a storehouse
        if (e.type === 'graph-add-vertex') {
            const vertex = e.detail;
        }
        
        // If an edge or vertex is removed, recalculate paths
        if (e.type === 'graph-rem-edge' || e.type === 'graph-rem-vertex') {
            // Get all affected people
            if (e.type === 'graph-rem-vertex') {
                // If a building is removed, handle people living or working there
                const removedVertex = e.detail;
                if (removedVertex) {
                    this.handleVertexRemoval(removedVertex);
                }
            }
            
            // For any kind of graph change, recalculate all paths
        }
    }
    
    // Handle the removal of a vertex (building)
    handleVertexRemoval(vertex) {
        // Check if any people are associated with this vertex
        
        this.state.people.forEach((person)=>{
            
            // If this was the person's home, mark their home as null
            if (person.home === vertex) {
                console.warn(`Person's home was removed: ${person.id}`);
                person.looseHome();
            }
            
            // If this was the person's workplace, make them quit the job
            if (person.workplace === vertex) {
                console.warn(`Person's workplace was removed: ${person.id}`);
                person.looseWork();
            }
            
            // If vertex was in their path, reset path
        })
        
        // Update UI after people changes
        updateResourceMenu();
        
        // If selected person was removed, clear selection
        if (this.state.selectedPerson && !this.state.people.get(this.state.selectedPerson.id)) {
            this.state.selectedPerson = null;
            hideSelectionMenu();
        }
        
    }
    
    // Animation loop for people movement - UPDATED WITH TIME CAPPING
    animationLoop(timestamp) {
        // Calculate time since last frame with capping for background tabs
        let deltaTime = timestamp - this.state.lastFrameTime;
        this.state.lastFrameTime = timestamp;
        
        // If tab was hidden or deltaTime is too large, cap it
        if (this.isPaused || deltaTime > this.maxDeltaTime) {
            deltaTime = this.maxDeltaTime;
            this.isPaused = false;
        }
        
        if ((timestamp % (this.state.game_env.taxmins * 60 * 1000)) < (16 / this.state.speed)) {
            payTax();
        }
        
        // Check if viewport changed
        let viewportChanged = false;
        
        
        // Update all people
        this.state.peopleNeedRedraw = false;
        this.state.buildingsNeedRedraw = true;
        this.state.people.forEach((person)=>{
            try {
                const oldX = person.x;
                const oldY = person.y;
                const oldState = person.state;
                const oldRoad = person.onRoad;
                
                person.update(deltaTime*this.state.speed, this.state.storehouse);
                
                // Ensure person's position stays within map bounds
                person.x = Math.max(0, Math.min(person.x, this.config.mapWidth));
                person.y = Math.max(0, Math.min(person.y, this.config.mapHeight));
                
                if (person.x !== oldX || person.y !== oldY || person.state !== oldState || person.onRoad !== oldRoad) {
                    this.state.peopleNeedRedraw = true;
                }
            } catch (error) {
                console.error("Error updating person:", error, person);
                this.state.peopleNeedRedraw = true;
            }
        });
        
        // Update resource display frequently to ensure real-time feedback
        if (timestamp % 500 < 16) {
            updateResourceMenu();
        }
        
        // Redraw if needed
        if (viewportChanged) {
            this.state.terrainNeedsRedraw = true;
        } if (this.state.peopleNeedRedraw || this.state.buildingsNeedRedraw || this.state.terrainNeedsRedraw){
            this.redraw(timestamp);
        }
        // Continue animation loop
        this.state.animationFrame = requestAnimationFrame(this.animationLoop);
    }
    
    // Update all visuals
    redraw(time) {
        // Only redraw terrain if viewport changed
        if (this.state.terrainNeedsRedraw) {
            drawTerrain();
            this.state.terrainNeedsRedraw = false;
        }
        
        // Clear buildings canvas
        this.buildingCtx.clearRect(0, 0, this.config.viewportWidth, this.config.viewportHeight);
        
        // Draw buildings
        drawBuildings(true, time);
        
        // Draw people on the same canvas, after buildings
        drawPeople();

        drawBuildings(false,time);

        drawMapObjects(time)
        
        // If in road building mode and have a starting vertex, draw a preview line
        if (
            this.state.mode === 'building' && 
            this.config.buildingTypes[this.state.currentBuildingType].buildingMode === 'path' && 
            this.state.roadStartVertex
        ) {
            
            // Get the mouse position
            const mouseX = this.state.previewMouseX;
            const mouseY = this.state.previewMouseY;    
            
            // Draw preview line
            this.buildingCtx.strokeStyle = 'rgba(85, 85, 85, 0.6)';  // Semi-transparent gray
            this.buildingCtx.lineWidth = 4 * this.state.zoom;
            this.buildingCtx.beginPath();
            this.buildingCtx.moveTo(
                (this.state.roadStartVertex.x - this.state.viewportX) * this.state.zoom,
                (this.state.roadStartVertex.y - this.state.viewportY) * this.state.zoom
            );
            this.buildingCtx.lineTo(
                mouseX, 
                mouseY
            );
            this.buildingCtx.stroke();
        }
        
        // Update UI information
        updateModeIndicator(this.state.roadStartVertex ? "Select end building for road" : "");
    }
    
    
    // Check if a unique building can be built
    canBuildUniqueBuilding(typeKey) {
        const buildingType = this.config.buildingTypes[typeKey];
        
        // If the building isn't unique, it can always be built
        if (!buildingType.unique) {
            return true;
        }
        
        // Check if a building of the same type already exists
        const exists = Array.from(this.state.buildingGraph.vertices.values()).some(
            vertex => vertex.type === typeKey
        );
        
        return !exists;
    }
    
    // Ensure the viewport stays within bounds
    clampViewport() {
        this.state.viewportX = Math.max(0, Math.min(this.state.viewportX, this.config.mapWidth - this.config.viewportWidth / this.state.zoom));
        this.state.viewportY = Math.max(0, Math.min(this.state.viewportY, this.config.mapHeight - this.config.viewportHeight / this.state.zoom));
    }
    
    // Event Handlers
    
    // Handle mouse down event
    handleMouseDown(e) {
        // Only process left mouse button
        if (e.button === 0) {
            this.state.isDragging = true;
            this.state.lastMouseX = e.clientX;
            this.state.lastMouseY = e.clientY;
        }
    }
    
    // Handle mouse move event
    handleMouseMove(e) {
        // Get the mouse position relative to the canvas for preview
        const rect = this.buildingCanvas.getBoundingClientRect();
        const canvasX = e.clientX - rect.left;
        const canvasY = e.clientY - rect.top;
        
        // Store the canvas-relative coordinates for road preview
        this.state.previewMouseX = canvasX;
        this.state.previewMouseY = canvasY;
        
        // Redraw if in road building mode to update preview line
        if (this.state.mode === 'building' && 
            this.config.buildingTypes[this.state.currentBuildingType].buildingMode === 'path' && 
            this.state.roadStartVertex) {
            this.redraw();
        }
        
        if (this.state.isDragging) {
            // Calculate how much the mouse has moved since last position
            // (using absolute coordinates for consistent dragging)
            const deltaX = e.clientX - this.state.lastMouseX;
            const deltaY = e.clientY - this.state.lastMouseY;
            
            // Update the last mouse position for dragging
            this.state.lastMouseX = e.clientX;
            this.state.lastMouseY = e.clientY;
            
            // Move the viewport in the opposite direction of the drag
            this.state.viewportX -= deltaX / this.state.zoom;
            this.state.viewportY -= deltaY / this.state.zoom;
            
            // Ensure the viewport stays within bounds
            this.clampViewport();

            this.setAudioCenter();
            
            // Trigger redraw
            this.state.terrainNeedsRedraw = true;
            this.redraw();
        }
    }

    centerViewport(vertex){
        // Calculate the center of the current viewport
        this.state.viewportX = vertex.x - (this.config.viewportWidth / this.state.zoom / 2);
        this.state.viewportY = vertex.y - (this.config.viewportHeight / this.state.zoom / 2);

        //(this.state.roadStartVertex.x - this.state.viewportX) * this.state.zoom,

        // Convert to map coordinates
        //const mapX = this.state.viewportX + centerX / this.state.zoom;
        //const mapY = this.state.viewportY + centerY / this.state.zoom;

        this.clampViewport();
        this.state.terrainNeedsRedraw = true;
        this.redraw();
    }
    
    // Handle mouse up event
    handleMouseUp(e) {
        // Only process left mouse button
        if (e.button === 0) {
            // If it was just a short click, place a building or select something
            const wasShortClick = this.state.isDragging && 
                Math.abs(e.clientX - this.state.lastMouseX) < 5 && 
                Math.abs(e.clientY - this.state.lastMouseY) < 5;
                    
            this.state.isDragging = false;
            
            if (wasShortClick) {
                this.handleClick(e);
            }
        }
    }
    
    // Handle right click to cancel building mode
    handleRightClick(e) {
        e.preventDefault(); // Prevent context menu
        
        // If in building mode, switch back to selection mode
        if (this.state.mode === 'building') {
            this.switchToSelectionMode();
        }
        
        return false;
    }
    
    // Handle click event for building placement and selection
    async handleClick(e) {
        // Get the click position relative to the canvas
        const rect = this.buildingCanvas.getBoundingClientRect();
        const canvasX = e.clientX - rect.left;
        const canvasY = e.clientY - rect.top;
        
        // Convert to map coordinates
        const mapX = this.state.viewportX + canvasX / this.state.zoom;
        const mapY = this.state.viewportY + canvasY / this.state.zoom;
        if (this.state.mode === 'building') {
            const buildingType = this.config.buildingTypes[this.state.currentBuildingType];
            
            // Check if this is a unique building that already exists
            if (buildingType.unique && !this.canBuildUniqueBuilding(this.state.currentBuildingType)) {
                setMessage("Only one " + buildingType.name + " allowed!");
                return;
            }
            
            // Handle road building (edge mode)
            if (buildingType.buildingMode === 'path') {
                // Find if we clicked on a building
                handlePathPlacement(this.state, mapX, mapY, this.config, buildingType);
            }
            // Handle regular building placement
            else {
                handleBuildingPlacement(mapX, mapY)
            }
        } else { // Selection mode
            // First check if we clicked on a person
            const clickedPerson = findPersonAtPosition(
                this.state.people,
                mapX,
                mapY
            );
            
            if (clickedPerson) {
                // Select the clicked person
                this.selectPerson(clickedPerson)
                return;
            }
            
            // Then check if we clicked on a road (edge)
            const clickedEdge = findEdgeAtPosition(
                this.state.buildingGraph,
                mapX,
                mapY,
                this.state.zoom
            );
            
            if (clickedEdge) {
                this.selectEdge(clickedEdge)
                return;
            }
            
            // If not a person or a road, check for building
            const clickedVertex = findVertexAtPosition(
                this.state.buildingGraph, 
                mapX, 
                mapY
            );
            
            if (clickedVertex) {
                // Select the clicked building
                if (this.state.selectedVertex !== clickedVertex) {
                    this.selectBuilding(clickedVertex);
                }
            } else {
                // Clicked on empty space, deselect any selected building, edge, or person
                this.state.selectedVertex = hideSelectionMenu();
                this.state.selectedEdge = null;
                this.state.selectedPerson = null;
            }
        }
        
        // Redraw the map
        this.redraw();
    }

    selectPerson(clickedPerson, follow = false){
        this.state.selectedPerson = clickedPerson;
        this.state.selectedVertex = null;
        this.state.selectedEdge = null;
        
        // Show selection menu
        const selectionMenu = document.getElementById('selection-menu');
        selectionMenu.style.display = 'block';
        const content = selectionMenu.querySelector('#selection-content');
        clickedPerson.onSelect(selectionMenu, content);
        
        // Redraw to highlight selected person
        this.redraw();
    }

    selectBuilding(clickedVertex, center = false){
        this.state.selectedVertex = clickedVertex;
        this.state.selectedEdge = null;
        this.state.selectedPerson = null;
        if (center){
            this.centerViewport(clickedVertex)
        }
        showSelectionMenu(clickedVertex, this.config.buildingTypes);
    }

    selectEdge(clickedEdge, center = false){
        // Select the clicked edge
        this.state.selectedEdge = clickedEdge;
        this.state.selectedVertex = null;
        this.state.selectedPerson = null;

        if (center){
            const x = clickedEdge.v0.x + (clickedEdge.v1.x-clickedEdge.v0.x)*0.5;
            const y = clickedEdge.v0.y + (clickedEdge.v1.y-clickedEdge.v0.y)*0.5
            this.centerViewport({x,y})
        }
        
        // Show edge selection menu
        const roadBuildingType = this.config.buildingTypes.road;
        if (roadBuildingType) {
            showEdgeSelectionMenu(clickedEdge, roadBuildingType);
        } else {
            // Fallback if road building type not found
            hideSelectionMenu();
        }
        
        // Redraw to highlight selected edge
        this.redraw();
    }
    
    handleWheel(e) {
        e.preventDefault();
        
        // Determine zoom direction
        const zoomDirection = e.deltaY < 0 ? 1 : -1;
        
        // Get mouse position relative to canvas
        const rect = this.buildingCanvas.getBoundingClientRect();
        const mouseX = e.clientX - rect.left;
        const mouseY = e.clientY - rect.top;
        
        // Get the map coordinates under the mouse before zooming
        const mapX = this.state.viewportX + mouseX / this.state.zoom;
        const mapY = this.state.viewportY + mouseY / this.state.zoom;
        
        // Adjust zoom level
        const oldZoom = this.state.zoom;
        this.state.zoom += zoomDirection * this.config.zoomStep;
        this.state.zoom = Math.max(this.config.minZoom, Math.min(this.state.zoom, this.config.maxZoom));
        
        // If the zoom didn't change, do nothing
        if (oldZoom === this.state.zoom) return;
        
        // Adjust the viewport to keep the mouse position pointing at the same map coordinates
        this.state.viewportX = mapX - mouseX / this.state.zoom;
        this.state.viewportY = mapY - mouseY / this.state.zoom;
        
        // Ensure the viewport stays within bounds
        this.clampViewport();

        this.setAudioCenter();
        
        // Trigger redraw
        this.state.terrainNeedsRedraw = true;
        this.redraw();
    }

    setAudioCenter(){
        // Calculate the center of the current viewport
        const centerX = this.state.viewportX + this.config.viewportWidth / this.state.zoom / 2;
        const centerY = this.state.viewportY + this.config.viewportHeight / this.state.zoom / 2;

        // Convert to map coordinates
        const mapX = this.state.viewportX + centerX / this.state.zoom;
        const mapY = this.state.viewportY + centerY / this.state.zoom;

        this.state.audio.updateListenerPosition(mapX, mapY, this.state.zoom)
    }
    
    // Switch to selection mode
    switchToSelectionMode() {
        this.state.mode = 'selection';
        this.state.roadStartVertex = null;
        hideSelectionMenu();
        
        // Reset current building category to show main menu
        this.state.currentBuildingCategory = null;
        
        // Update building selector UI
        this.switchToBuildingCategory();
        
        updateBuildingSelector();
        this.redraw();
    }
    
    // Modified switchToBuildingCategory to restrict initial options
    switchToBuildingCategory(category = {id: null}) {
        const categoryId = category.id
        // Clear existing buttons
        while (this.buildingSelector.firstChild) {
            this.buildingSelector.removeChild(this.buildingSelector.firstChild);
        }
        
        // Set current category
        this.state.currentBuildingCategory = categoryId;
        
        // Check if a storehouse exists
        const hasStorehouse = !!this.state.storehouse;
        
        if (categoryId === null) {
            // if special conditions, code can be inserted here to draw a differen initial builing menu
            
            // Show category buttons if returning to the main menu
            createBuildingMenuCategories(this.buildingSelector, this.config, this.switchToBuildingCategory);
        } else {
            // Add back button
            const backButton = document.createElement('button');
            backButton.classList.add('back-button');
            backButton.textContent = '← Back to Categories';
            backButton.addEventListener('click', () => {
                this.switchToBuildingCategory();
            });
            this.buildingSelector.appendChild(backButton);
            
            // Add category header
            const categoryHeader = document.createElement('div');
            categoryHeader.classList.add('category-header');
            categoryHeader.innerHTML = `<img class="resource-icon" src="/assets/i/icons/${category.icon}.png"></img>`;
            this.buildingSelector.appendChild(categoryHeader);
            
            // Filter and add building buttons for this category
            Object.entries(this.config.buildingTypes).forEach(([typeKey, buildingType]) => {
                if (buildingType.event && !this.state.game_env.events[buildingType.event]) { return }
                if (buildingType.tag === categoryId) {
                    // Skip storehouse if one already exists
                    if (typeKey === 'storehouse' && hasStorehouse) {
                        return;
                    }
                    
                    const button = document.createElement('button');
                    button.textContent = buildingType.name;
                    button.addEventListener('click', () => {
                        // Check if unique and already exists
                        if (buildingType.unique && !this.canBuildUniqueBuilding(typeKey)) {
                            setMessage("Only one " + buildingType.name + " allowed!")
                            return;
                        }
                        
                        // Set the building type and switch to building mode
                        this.state.currentBuildingType = typeKey;
                        this.state.mode = 'building';
                        this.state.selectedVertex = hideSelectionMenu();
                        this.state.selectedEdge = null;
                        this.state.selectedPerson = null;
                        
                        // Reset road building state
                        this.state.roadStartVertex = null;
                        
                        updateBuildingSelector();
                    });
                    this.buildingSelector.appendChild(button);
                }
            });
        }
    }
    
    hideSelectionMenu() {
        this.state.selectedVertex = hideSelectionMenu();
        this.state.selectedPerson = null;
        this.state.selectedEdge = null;
        return this.state.selectedVertex;
    }
}