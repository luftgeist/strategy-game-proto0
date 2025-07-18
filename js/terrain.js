import { drawImg, loadImg } from './utils.js';
import config from './config.js'

const tiles = {
    oasis: {img: loadImg('t/oasis.png'), h: 0.2},
    steppe: {img: loadImg('t/steppe.png'), h: 0.3},
    sand: {img: loadImg('t/sand8.png'), h: 0.8},
    yellowsand: {img: loadImg('t/sand7.png'), h: 0.7},
    lightsand: {img: loadImg('t/sand6.png'), h: 0.9},
    rock: {img: loadImg('t/sandstone.png'), h: 1},
};

export function getTerrainTile(height, alpha, flags, waterLevel, x, y) {
    if (height-waterLevel < tiles.oasis.h) {
        return tiles.oasis.img;
    } else if (height-waterLevel < tiles.steppe.h) {
        return tiles.steppe.img;
    } else if (height < tiles.sand.h) {
        return tiles.sand.img;
    } else if (height < tiles.lightsand.h) {
        return tiles.lightsand.img;
    } else if (height < tiles.rock.h) {
        return tiles.rock.img;
    } else {
        return tiles.rock.img;
    }
}

const reso = 6;

const treeImgs = [];
for (let i = 0; i < 7; i++){
    treeImgs.push(loadImg(`o/tree_${i}_c.png`))
}

const wildlifeImgs = [];
for (let i = 0; i < 3; i++){
    wildlifeImgs.push(loadImg(`o/wildlife${i}_c.png`))
}

class SeededRandom {
    constructor(seed) {
        // Convert seed to a 32-bit unsigned integer
        this.seed = seed >>> 0;
    }
    
    // Generate next random float between 0 and 1
    next() {
        // Mulberry32 algorithm
        let t = this.seed += 0x6D2B79F5;
        t = Math.imul(t ^ t >>> 15, t | 1);
        t ^= t + Math.imul(t ^ t >>> 7, t | 61);
        
        // Convert to float between 0 and 1
        return ((t ^ t >>> 14) >>> 0) / 4294967296;
    }
    
    // Reset the generator to initial seed state
    reset(newSeed = null) {
        this.seed = (newSeed !== null ? newSeed : this.originalSeed) >>> 0;
    }
    
    // Store original seed for reset functionality
    setSeed(seed) {
        this.originalSeed = seed >>> 0;
        this.seed = this.originalSeed;
    }
}

const random = new SeededRandom(config.mapSeed);

// cache colors 
const colors = {
    water: {r: 0, g: 0, b: 255},
    oasis: {r: 48, g: 183, b: 0},
    steppe: {r: 157, g: 185, b: 29},
    lightsteppe: {r: 175, g: 194, b: 86},
    grassysand: {r: 200, g: 200, b: 100},
    goldensand: {r: 230, g: 204, b: 143},
    lightsand: {r: 230, g: 213, b: 172},
    mediumsand: {r: 212, g: 195, b: 152}, 
    darksand: {r: 200, g: 178, b: 140}, 
    rockysand: {r: 160, g: 152, b: 128},
    rock: {r: 128, g: 128, b: 128},
    copper: {r: 185, g: 122, b: 49},
    coal: {r: 22, g: 20, b: 18},
    ironore: {r: 83, g: 10, b: 10},
    sulphur: {r: 193, g: 196, b: 36},
}


function smoothstep(t) {
    return t * t * (3 - 2 * t);
}

function lerp(a, b, t) {
    return a + (b - a) * t;
}

export function generateSmoothTerrain(mapWidth, mapHeight) {
    const terrain = [];
    // Initialize the terrain array with the correct dimensions
    for (let y = 0; y < mapHeight; y++) {
        terrain[y] = new Array(mapWidth).fill(0);
    }
    
    // Use a period value that is relative to the map size
    // Period determines the distance between control points
    const period = Math.min(180, Math.floor(Math.min(mapWidth, mapHeight) / 8));
    
    // Calculate how many control points we need
    const controlPointsX = Math.ceil(mapWidth / period) + 1;
    const controlPointsY = Math.ceil(mapHeight / period) + 1;
    
    // Create a 2D grid to store our control points
    const controlPoints = [];
    for (let y = 0; y < controlPointsY; y++) {
        controlPoints[y] = [];
        for (let x = 0; x < controlPointsX; x++) {
            // Generate random height values only at control points
            controlPoints[y][x] = random.next();
        }
    }
    
    // Interpolate between control points to create the full terrain
    for (let y = 0; y < mapHeight; y++) {
        for (let x = 0; x < mapWidth; x++) {
            // Find the nearest control point grid cell
            const x0 = Math.floor(x / period);
            const x1 = Math.min(x0 + 1, controlPointsX - 1);
            const y0 = Math.floor(y / period);
            const y1 = Math.min(y0 + 1, controlPointsY - 1);
            
            // Calculate how far we are between control points (0 to 1)
            const sx = smoothstep((x - x0 * period) / period);
            const sy = smoothstep((y - y0 * period) / period);
            
            // Get the height values at the four surrounding control points
            const v00 = controlPoints[y0][x0];
            const v10 = controlPoints[y0][x1];
            const v01 = controlPoints[y1][x0];
            const v11 = controlPoints[y1][x1];
            
            // Bilinear interpolation with smoothstep
            const top = lerp(v00, v10, sx);
            const bottom = lerp(v01, v11, sx);
            const height = lerp(top, bottom, sy);
            const data1 = Math.floor(10*random.next())+10;
            const data2 = Math.floor(1000000*random.next());

            const h = Math.trunc(height*100)/100;
            
            // Store the interpolated height in the terrain array
            terrain[y][x] = [h, data1, data2] ;
        }
    }
    
    return terrain;
}

// Get terrain color based on height
export function getTerrainColor(height, alpha, flags, waterLevel, x, y) {
    if (height-waterLevel < 0.1) {
        return colors.oasis;
    } else if (height-waterLevel < 0.2) {
        return colors.steppe;
    } else if (height-waterLevel < 0.23) {
        return colors.lightsteppe;
    } else if (height-waterLevel < 0.25) {
        return colors.grassysand;
    } else if (height < 0.3) {
        return colors.goldensand;
    } else if (height < 0.92) {
        return colors.lightsand;
    } else if (height < 0.935) {
        return colors.mediumsand;
    } else if (height < 0.94) {
        return colors.darksand;
    } else if (height < 0.955) {
        return colors.rockysand;
    } else if (flags < 11) {
        return colors.coal;
    } else {
        return colors.rock;
    }
}

// Get terrain type at a specific position
export function getTerrainTypeAtPosition(terrain, x, y, mapWidth, mapHeight, waterLevel = 0) {
    // Ensure coordinates are within map bounds
    if (x < 0 || x >= mapWidth || y < 0 || y >= mapHeight) {
        return null;
    }
    // Get the height value at the position
    let [height, alpha ]= terrain[Math.floor(y)][Math.floor(x)];

    // Determine terrain type based on height
    if (height-waterLevel < 0.2) {
        return 'oasis'; 
    } else if (height < 0.3) {
        return 'sand'; 
    } else if (height < 0.85) {
        return 'sand'; 
    } else {
        return 'rock'; 
    }
}


export function scaleTerrain(terrain, scaleFactor = 2){
    const new_terrain = [];
    const new_width = terrain[0].length * scaleFactor;
    const new_height = terrain.length * scaleFactor;

    let counter = 0;
    const maxCounter = scaleFactor*scaleFactor;

    for (let y = 0; y < new_height; y++) {
        // Initialize the terrain array with the correct dimensions
        new_terrain[y] = new Array(new_width).fill(0);
        for (let x = 0; x < new_width; x++) {
            // Find the corresponding source pixel
            const sourceX = Math.floor(x / scaleFactor);
            const sourceY = Math.floor(y / scaleFactor);

            if (counter >= maxCounter){
                counter = 0;
            }
            
            
            const [height, data1, data2] = terrain[sourceY][sourceX];

            const alpha = Math.floor(255*random.next());
            
            new_terrain[y][x] = [height, alpha, data1, data2, counter];

            if (x % scaleFactor === 0 && terrain[sourceY][sourceX-1]){
                const [_h] = terrain[sourceY][sourceX-1]
                new_terrain[y][x] = [(_h+height)/2, alpha, data1, data2, counter]
            }
            if (x % scaleFactor === scaleFactor-1 && terrain[sourceY][sourceX+1]){
                const [_h] = terrain[sourceY][sourceX+1]
                new_terrain[y][x] = [(_h+height)/2, alpha, data1, data2, counter]
            }
            if (y % scaleFactor === 0 && terrain[sourceY-1]){
                const [_h] = terrain[sourceY-1][sourceX]
                new_terrain[y][x] = [(_h+height)/2, alpha, data1, data2, counter]
            }
            if (y % scaleFactor === scaleFactor-1 && terrain[sourceY+1]){
                const [_h] = terrain[sourceY+1][sourceX]
                new_terrain[y][x] = [(_h+height)/2, alpha, data1, data2, counter]
            }
            counter++;
        }
    }
    
    return new_terrain;
}

export function genMapObjects(baseTerrain, waterLevel, scaleFactor){
    const map_trees = [];
    const map_wildlife = [];
    for (let y = 0; y < baseTerrain.length; y++){
        for (let x = 0; x < baseTerrain[0].length; x++){
            const [height, data1, data2] = baseTerrain[y][x];

            if (height-waterLevel < 0.2 && data2 % 8 === 0 ) {
                const Y = y*scaleFactor+Math.floor(random.next()*scaleFactor);
                const X = x*scaleFactor+Math.floor(random.next()*scaleFactor);
                const m = Math.floor(random.next()*6);

                map_trees.push({x: X,y: Y,h: 3, m, type: 'tree' })
            } else if (height > 0.4 && height < 0.85 && data2 % 10000 === 1){
                let Y = y*scaleFactor+Math.floor(random.next()*scaleFactor*10);
                let X = x*scaleFactor+Math.floor(random.next()*scaleFactor*10);
                map_trees.push({x: X,y: Y,h: 3, m: 6, type: 'tree' })
                
                X+=Math.floor((random.next()-0.5)*scaleFactor*100)
                Y+=Math.floor((random.next()-0.5)*scaleFactor*100)
                map_wildlife.push({x: X, y: Y, m: Math.floor(random.next()*3), type: 'deer'})
                X+=Math.floor((random.next()-0.5)*scaleFactor*10)
                Y+=Math.floor((random.next()-0.5)*scaleFactor*10)
                map_wildlife.push({x: X, y: Y, m: Math.floor(random.next()*3), type: 'deer'})
                X+=Math.floor((random.next()-0.5)*scaleFactor*10)
                Y+=Math.floor((random.next()-0.5)*scaleFactor*10)
                map_wildlife.push({x: X, y: Y, m: Math.floor(random.next()*3), type: 'deer'})
            }
        }
    }

    map_wildlife.sort((a,b)=>a.y-b.y);
    map_trees.sort((a,b)=>a.y-b.y);

    return {map_trees, map_wildlife };
}

export async function initTerrain(state, config){
    // generating giant terrain will take a lot of time, so we generate initial terrain and scale it
    const base_terrain = generateSmoothTerrain(
        Math.ceil(config.mapWidth/config.terrain_scaling), 
        Math.ceil(config.mapHeight/config.terrain_scaling)
    );
    const terrain = scaleTerrain(base_terrain, config.terrain_scaling);

    const { map_trees, map_wildlife } = genMapObjects(base_terrain, state.waterLevel, config.terrain_scaling);
    
    for (let asset of Object.values(tiles)){
        await asset.img.loaded;
    }

    const terrainCanvas = createTileCanvas(config, base_terrain, terrain, state.waterLevel);
    //const terrainCanvas = createTerrainCanvas(config, terrain, state.waterLevel);
    const terrainBitmap = await createTerrainBitmap(terrainCanvas);

    return {map_trees, map_wildlife, terrain, terrainBitmap }
}

function createTileCanvas(config, base_terrain, terrain, waterLevel){
    console.log('create Tile Canvas')
    // Create off-screen canvas for the entire map
    const terrainCanvas = document.createElement('canvas');
    terrainCanvas.width = config.mapWidth*reso;
    terrainCanvas.height = config.mapHeight*reso;
    const ctx = terrainCanvas.getContext('2d');
    const ratio = tiles.sand.img.naturalWidth/config.terrain_scaling;
    const granularity = 1;
    const cube_width = config.terrain_scaling*granularity*reso;
    const cube_height = tiles.sand.img.naturalHeight/ratio*granularity*reso;
    const amplitude = 50;
    // Render the entire terrain
    const hg = granularity/2;
    for (let y = 0; y < base_terrain.length; y+=hg) {
        for (let x = 0; x < base_terrain[0].length; x+=granularity) {
            const [height, alpha, flags1, flags2] = base_terrain[Math.floor(y)][Math.floor(x)];
            const cube = getTerrainTile(height, alpha, flags1, waterLevel);
            const X = Math.floor(x*config.terrain_scaling*reso);
            const Y = Math.floor(y*config.terrain_scaling*reso);
            drawImg(ctx, X, Y, cube, cube_width, cube_height, 0, height*reso*amplitude)
            ctx.restore()
        }
        for (let x = hg; x < base_terrain[0].length; x+=granularity) {
            const [height, alpha, flags1, flags2] = base_terrain[Math.floor(y)][Math.floor(x)];
            const cube = getTerrainTile(height, alpha, flags1, waterLevel);
            const X = Math.floor(x*config.terrain_scaling*reso);
            const Y = Math.floor(y*config.terrain_scaling*reso+config.terrain_scaling*reso*0.25*granularity);
            drawImg(ctx, X, Y, cube, cube_width, cube_height, 0, height*reso*amplitude)
            ctx.restore()
        }
    }
    /*for (let y = 0; y < terrain.length; y++) {
        for (let x = 0; x < terrain[0].length; x++) {
            const [height, alpha, flags1, flags2] = terrain[y][x];
            const color = getTerrainColor(height, alpha, flags1, waterLevel);
            const X = (x*reso);
            const Y = (y*reso);
            ctx.save();
            ctx.beginPath();
            ctx.fillStyle = 'rgba('+color.r+','+color.g+','+color.b+','+alpha*0.5+')';
            ctx.fillRect(X,Y,reso, reso)
            ctx.restore();
        }
    }*/
    
    return terrainCanvas;
}



async function createTerrainBitmap(terrainCanvas) {
    // Convert to ImageBitmap for better performance
    const bitmap = await createImageBitmap(terrainCanvas);
    
    // Clean up the canvas since we have the bitmap
    terrainCanvas.width = 0;
    terrainCanvas.height = 0;
    
    return bitmap;
}

// Then in your draw function:
export function drawTerrain() {
    const config = gameInstance.config;
    gameInstance.terrainCanvas.width = config.viewportWidth;
    gameInstance.terrainCanvas.height = config.viewportHeight;
    const terrainCtx = gameInstance.terrainCtx;
    const viewportX = gameInstance.state.viewportX;
    const viewportY = gameInstance.state.viewportY;
    const zoom = gameInstance.state.zoom;
    
    terrainCtx.clearRect(0, 0, config.viewportWidth, config.viewportHeight);
    
    terrainCtx.drawImage(
        gameInstance.state.terrain_bitmap,   
        viewportX*reso,                           
        viewportY*reso,                           
        config.viewportWidth / zoom * reso,           
        config.viewportHeight / zoom * reso,        
        0,
        0,                
        config.viewportWidth,            
        config.viewportHeight
    );
}

export function drawMapObjects(){
    const ctx = gameInstance.buildingCtx;
    const map_trees = gameInstance.state.map_trees;
    const map_wildlife = gameInstance.state.map_wildlife;
    const viewportX = gameInstance.state.viewportX;
    const viewportY = gameInstance.state.viewportY;
    const zoom = gameInstance.state.zoom;
    const config = gameInstance.config;
    const RENDER_EDGE = 50;
    // Calculate the visible area
    const treeImg = treeImgs[0];
    const deerImg = wildlifeImgs[0];
    const startX = viewportX;
    const startY = viewportY;
    const endX = startX + config.viewportWidth / zoom;
    const endY = startY + config.viewportHeight / zoom;
    const tree_baseWidth = treeImg.naturalWidth * 0.2 * zoom;
    const tree_baseHeight = treeImg.naturalHeight * 0.2 * zoom;
    const deer_baseWidth = deerImg.naturalWidth * 0.5 * zoom;
    const deer_baseHeight = deerImg.naturalHeight * 0.5 * zoom;
    const padded_startX = startX - gameInstance.config.renderEdge * zoom;
    const padded_startY = startY - gameInstance.config.renderEdge * zoom;
    const padded_endX = endX + gameInstance.config.renderEdge * zoom;
    const padded_endY = endY + gameInstance.config.renderEdge * zoom;
    for(let tree of map_trees){
        const x = tree.x;
        const y = tree.y;
        if (
            x > padded_startX &&
            x < padded_endX &&
            y > padded_startY &&
            y < padded_endY
        ) {
            // Calculate position in viewport
            const viewX = (x - startX) * zoom;
            const viewY = (y - startY) * zoom;
            let length = 1;
            let r = 0;
            if (tree.h === 2){
                r = 90;
            } else if (tree.h === 1){
                r = 90;
                length = 0.4
            } else if (tree.h === 0){
                length = 0.2
            }  else if (tree.h === -1){
                continue;
            }
            ctx.save();
            ctx.translate(viewX, viewY)
            ctx.rotate(Math.PI/180*r)
            ctx.translate(-viewX, -viewY)
            drawImg(ctx, viewX, viewY, treeImgs[tree.m], tree_baseWidth, tree_baseHeight, 0, -tree_baseHeight*0.3, length);
            ctx.restore()
        }
    }
    for (let w of map_wildlife){
        if (
            w.x > padded_startX &&
            w.x < padded_endX &&
            w.y > padded_startY &&
            w.y < padded_endY
        ) {
            const viewX = (w.x - startX) * zoom;
            const viewY = (w.y - startY) * zoom;
            drawImg(ctx, viewX, viewY, wildlifeImgs[w.m], deer_baseWidth*0.8, deer_baseHeight*0.8, -deer_baseWidth*0.6, -deer_baseHeight*0.6, 1);
        }
        
    }
}