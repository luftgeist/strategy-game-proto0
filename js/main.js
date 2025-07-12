// Main entry point for the game
import { Game } from './game.js';
import config from './config.js';
import { loadGame, saveGame } from './saving.js';

// Initialize the game when the DOM is fully loaded
document.addEventListener('DOMContentLoaded', () => {
    // Update viewport size based on window
    config.viewportWidth = window.innerWidth * 1;
    config.viewportHeight = window.innerHeight * 1;
    
    // Create and initialize the game
    const game = new Game(config);
    game.init();
    
    // Handle window resize events
    window.addEventListener('resize', () => {
        // Update viewport size
        config.viewportWidth = window.innerWidth * 1;
        config.viewportHeight = window.innerHeight * 1;
        
        // Update canvas sizes
        game.terrainCanvas.width = config.viewportWidth;
        game.terrainCanvas.height = config.viewportHeight;
        game.buildingCanvas.width = config.viewportWidth;
        game.buildingCanvas.height = config.viewportHeight;
        
        // Redraw everything
        game.redraw();
    });
});

window.hideTown = function(value){
    window.gameInstance.state.audio.mute();
}

window.revealTown = function(value){
    window.gameInstance.state.audio.unmute();
}

// Add this to both parent and iframe
window.addEventListener('message', (event) => {
    // Always validate the origin
    const validOrigin = 'http://localhost:3000'
    if (event.origin !== validOrigin) return;
    
    const { type, data } = event.data;
    
    if (type === 'callMethod' && typeof window[data.methodName] === 'function') {
      window[data.methodName](data.params);
    } else if (type === 'updateStatus') {
      // Handle status update
      console.log('Status update:', data);
    } else {
      console.log("message perceived, but don't know what to do");
      console.table(event.data);
    }
});

export function callOutside(methodName, params = null){
    window.parent.postMessage({
            type: 'callMethod',
            data: {
                methodName,
                params,
            }
    }, '*')
}

window.setTax = function(goods){
    gameInstance.state.game_env.taxrate = goods;
}

window.setGameEvent = function(event, value){
    gameInstance.state.game_env.events[event] = value;
}

window.saveGame = function(){
    saveGame()
}

window.loadGame = function(){
    loadGame()
}