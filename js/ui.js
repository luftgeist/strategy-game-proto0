// UI-related functions
import { saveGame, loadGame } from "./saving.js";
import { canStorehouseProvide, updateResourceMenu } from "./resources.js";

export function setMessage(text, color = 'black', timer = 2000){
    const elem = document.querySelector('#message-menu');
    elem.style.color = color;
    elem.textContent = text;
    elem.classList.remove('hidden');
    window.setTimeout(()=>{
        elem.classList.add('hidden')
        delete elem.style.color;
    }, timer)
}

// Create building menu categories
export function createBuildingMenuCategories(buildingSelector, config, switchCategoryCallback) {
    // Clear existing contents
    while (buildingSelector.firstChild) {
        buildingSelector.removeChild(buildingSelector.firstChild);
    }
    
    // Add categories header
    const header = document.createElement('div');
    header.textContent = 'Building Categories:';
    header.classList.add('category-header');
    buildingSelector.appendChild(header);
    
    // Add category buttons
    config.buildingMenuCategories.forEach(category => {
        const button = document.createElement('button');
        button.innerHTML = `<img class="resource-icon clicky" src="/assets/i/icons/${category.icon}.png"></img>`
        button.classList.add('category-button');
        button.addEventListener('click', () => {
            switchCategoryCallback(category);
        });
        buildingSelector.appendChild(button);
    });
}

// Update building selector UI and handle mode changes
export function updateBuildingSelector() {
    const state = gameInstance.state;
    const config = gameInstance.config; 
    const canBuildUniqueBuilding = gameInstance.canBuildUniqueBuilding;

    const modeIndicator = document.getElementById('mode-indicator');
    const buildingSelector = document.getElementById('building-selector');
    
    const buttons = buildingSelector.querySelectorAll('button:not(.back-button)');
    
    // Update mode indicator
    let modeText = state.mode === 'selection' ? 'Selection Mode' : 'Building Mode';
    
    // If in building mode with road and a start vertex selected
    if (state.mode === 'building' && 
        config.buildingTypes[state.currentBuildingType].buildingMode === 'path' &&
        state.roadStartVertex) {
        modeText = 'Path Building - Select End';
    } else if (state.mode === 'building' && 
               config.buildingTypes[state.currentBuildingType].buildingMode === 'path') {
        modeText = 'Path Building - Select Start';
    }
    
    modeIndicator.textContent = modeText;
    modeIndicator.className = state.mode === 'selection' ? 'mode-selection' : 'mode-building';
    
    buttons.forEach((button) => {
        // Get the building type key from the button text (lowercase)
        const buildingName = button.textContent.toLowerCase();
        
        // Use direct property access on the buildingTypes object
        if (state.mode === 'building' && buildingName === state.currentBuildingType) {
            button.classList.add('selected');
        } else {
            button.classList.remove('selected');
        }
        
        const buildingType = config.buildingTypes[buildingName];
        if (!buildingType) return; // Skip if building type not found
        
        // Special handling for road building
        if (buildingType.buildingMode === 'path') {
            // Road building doesn't have a fixed cost, so we don't disable it
            button.disabled = false;
        } else {
            // Check if the building is unique and already exists
            if (buildingType.unique && !canBuildUniqueBuilding(buildingName)) {
                button.disabled = true;
            } 
            // Check if resources are insufficient
            else if (!canStorehouseProvide(config.buildingTypes[state.currentBuildingType].res)) {
                button.disabled = true;
            } else {
                button.disabled = false;
            }
        }
    });
    
    // Update resource menu to show building costs
    updateResourceMenu();
}

// Show the selection menu for a vertex
export function showSelectionMenu(vertex, buildingTypes) {
    const selectionMenu = document.getElementById('selection-menu');
    selectionMenu.style.display = 'block';
    
    // Get the building type using vertex.type directly
    const buildingType = buildingTypes[vertex.type];
    const content = selectionMenu.querySelector('#selection-content');
    buildingType.onselect(vertex, selectionMenu, content);
}

// Show the selection menu for an edge (road)
export function showEdgeSelectionMenu(edge, roadBuildingType) {
    const selectionMenu = document.getElementById('selection-menu');
    const content = selectionMenu.querySelector('#selection-content');
    selectionMenu.style.display = 'block';
    
    // Call the road's onselect method
    roadBuildingType.onselect(edge, selectionMenu, content);
}

// Show the selection menu for a person
export function showPersonSelectionMenu(person) {
    const selectionMenu = document.getElementById('selection-menu');
    const content = selectionMenu.querySelector('#selection-content');
    selectionMenu.style.display = 'block';
    person.onSelect(selectionMenu, content);
}

// Hide the selection menu
export function hideSelectionMenu() {
    const selectionMenu = document.getElementById('selection-menu');
    selectionMenu.style.display = 'none';
    return null; // Return null to unset selectedVertex
}

// Update the UI information
export function updateModeIndicator(customModeText = '') {
    const modeIndicator = document.getElementById('mode-indicator');
    if (customModeText) {
        modeIndicator.textContent = customModeText;
    }
}

// Create a feedback message for invalid placements
export function createFeedbackMessage(x, y, message) {
    const feedbackElement = document.createElement('div');
    feedbackElement.style.position = 'absolute';
    feedbackElement.style.top = `${y}px`;
    feedbackElement.style.left = `${x}px`;
    feedbackElement.style.padding = '5px';
    feedbackElement.style.backgroundColor = 'rgba(255, 0, 0, 0.7)';
    feedbackElement.style.color = 'white';
    feedbackElement.style.borderRadius = '3px';
    feedbackElement.style.zIndex = '10';
    feedbackElement.style.pointerEvents = 'none';
    feedbackElement.textContent = message;
    
    document.getElementById('game-container').appendChild(feedbackElement);
    
    // Remove after 2 seconds
    setTimeout(() => {
        feedbackElement.remove();
    }, 2000);
}

// Add UI buttons for save/load
export function createSaveLoadUI() {
    const saveButton = document.createElement('button');
    saveButton.textContent = 'Save Game';
    saveButton.addEventListener('click', saveGame);
    
    const loadButton = document.createElement('button');
    loadButton.textContent = 'Load Game';
    loadButton.addEventListener('click', loadGame);
    
    // Add a divider
    const divider = document.createElement('div');
    divider.style.height = '1px';
    divider.style.backgroundColor = '#555';
    divider.style.margin = '10px 0';
    
    // Add to UI container
    const uiContainer = document.getElementById('ui-container');
    uiContainer.appendChild(divider);
    uiContainer.appendChild(saveButton);
    uiContainer.appendChild(loadButton);
}

export function addSoundToAllButtons(state) {
    // Use event capturing (third parameter set to true)
    document.addEventListener('mousedown', function(event) {
        // Check if a button was clicked
        if (event.target.tagName === 'BUTTON' || event.target.classList.contains('clicky')){
            const r = Math.random();
            if (r <= 0.3) {state.audio.playOneShot('button0', {volume: 0.5}) }
            else if (r <= 0.6) {state.audio.playOneShot('button1', {volume: 0.5})}
            else {state.audio.playOneShot('button2', {volume: 0.5})}
        }
    }, true); // true = use capturing phase
}