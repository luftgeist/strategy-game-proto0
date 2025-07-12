import { Person } from "./person.js";
import { createRoadPattern } from "./pattern.js";
import { storehouseHasCapacity, canStorehouseProvide, storehouseDeposit, storehouseWithdraw } from "./resources.js";
import { setMessage } from "./ui.js";
import { loadImg, drawImg } from "./utils.js";
// Game configuration settings
const roadPattern = createRoadPattern(document.querySelector('#building-canvas'), 'black');

const palaceImg = loadImg('palace0_3_.png');
const houseImg = loadImg('house1_1.png');
const farmImg = loadImg('house1_1.png');
const storehouseImg = loadImg('storehouse0_1.png');
const forestryImg = loadImg('house0_2.png');
const buildsite1Img = loadImg('buildsite1.png');


const config = {
    mapSeed: 1234589,
    mapWidth: Math.floor(window.innerWidth * 2),       // Total map width
    mapHeight: Math.floor(window.innerHeight * 2),      // Total map height
    terrain_compression: 8, // must be 2, 4, 8, 16, the bigger the mapsize the bigger the value
    viewportWidth: Math.floor(window.innerWidth * 1),   // Visible viewport width (80% of window)
    viewportHeight: Math.floor(window.innerHeight * 1), // Visible viewport height (80% of window)
    initialZoom: 1.0,     // Initial zoom level
    minZoom: 0.5,         // Minimum zoom level
    maxZoom: 4.0,         // Maximum zoom level
    zoomStep: 0.1,        // How much to zoom in/out per step
    resourceUpdateInterval: 2000, // Resource production update interval in ms

    NEEDS: {
        APPETITE: 0.2,      // Rate at which hunger increases
        NUTRITION: 0.5,     // How much hunger is reduced by eating
        PECKISH: 0.5,       // Threshold at which people are shown to feel hungry
        HUNGER: 0.2,        // Threshold at which people start protesting

        WEAR_OUT: 0.1,      // Rate at which clothes decrease
        NEW_CLOTHES: 0.5, 
        WORN: 0.5,          // Threshhold at which people seek new clothes
        RUGGS: 0.2,         // Threshold at which people start protesting
    },

    FOODS: ['bread', 'cheese', 'sausage'],

    buildingMenuCategories: [
        { id: 'housing', icon: 'people' },
        { id: 'goods', icon: 'clay'},
        { id: 'production', icon: 'beer' },
        { id: 'infrastructure', icon: 'stone' },
        { id: 'special', icon: 'people' }
    ],
    buildingTypes: {
        house: { 
            name: 'house', 
            img: houseImg,
            size: 1,
            res: { wood: 2, bread: 1 }, 
            buildingMode: 'free',
            maxWorkers: 0, 
            tag: 'housing',
            data: {
                residents: [],
                maxResidests: 2,
                buildstate: -1,
            },
            init(vertex){
                const person = new Person(gameInstance.state.storehouse);
                person.assignToHome(vertex);
                gameInstance.state.people.set(person.id,person);
            },
            onselect: function(vertex, selectionMenu, content) {
                content.innerHTML = `
                    <div>House</div>
                    <div>Residents: ${vertex.data.residents.length}</div>
                    <button id="delete-building">Demolish Building</button>
                `;

                document.getElementById('delete-building').addEventListener('click', () => {
                    if (vertex.data.residents.length > 0) {
                        for (let resident of vertex.data.residents){
                            for (let peop of window.gameInstance.state.people){
                                if (resident === peop.id && peop.home && peop.home.id === vertex.id){
                                    peop.looseHome();
                                }
                            }
                        }
                    }
                    storehouseDeposit(this.res);
                    window.gameInstance.state.buildingGraph.removeVertex(vertex);
                    window.gameInstance.hideSelectionMenu();
                    window.gameInstance.redraw();
                });
            },
            work: function(deltaTime, person) {
                const here = person.currentPath[0];
                if (checkBuilding(here)){
                    return null;
                }
                person.actiontext = 'sleeping';
                console.log('sleeping now')
                let newTarget = null;
                if (person.workplace) {
                    person.actiontext = 'going to work'
                    newTarget = person.workplace;
                }
                return newTarget;
            },
            render: function(ctx, x, y, width, height, zoom, vertex, img) {
                if (vertex.data.buildstate < 0) {
                    const progress = vertex.data.buildingprogress/100;
                    if (progress < 0.5){
                        drawImg(ctx, x, y, buildsite1Img, width*1.5, height*1.5, 0, 0, progress*2)
                    } else {
                        drawImg(ctx, x, y, buildsite1Img, width*1.5, height*1.5, 0, 0, 1)
                        drawImg(ctx, x, y, img, width, height, 0, 0, progress*2-1)
                    }
                } else {
                    drawImg(ctx, x, y, img, width, height)
                }
            }
        },
        forestry: { 
            name: 'forestry', 
            img: forestryImg,
            size: 0.8,
            res: { wood: 2 },
            buildingMode: 'free',
            tag: 'goods',
            data: {
                active: true,
                workers: [],
                treeradius: 50,
                maxWorkers: 1,
                maxradius: 150,
                currenttree: null,
                buildstate: -1,
            },
            onselect: function(vertex, selectionMenu, content) {
                content.innerHTML = `
                    <div>${this.name}</div>
                    <div>Active: ${vertex.data.active ? 'Yes' : 'No'}</div>
                    <div>Workers: ${vertex.data.workers.length}/${vertex.data.maxWorkers}</div>
                    <div>Tree Radius: ${vertex.data.treeradius}</div>
                    <div>Max Radius: ${vertex.data.maxradius}</div>
                    <button id="toggle-active">Toggle Active</button>
                    <button id="increase-radius">Increase Tree Radius</button>
                    <button id="decrease-radius">Decrease Tree Radius</button>
                    <button id="delete-building">Demolish Building</button>
                `;
                document.getElementById('toggle-active').addEventListener('click', () => {
                    vertex.data.active = !vertex.data.active;
                    this.onselect(vertex, selectionMenu, content); // Refresh display
                    window.gameInstance.redraw();
                });

                document.getElementById('increase-radius').addEventListener('click', () => {
                    vertex.data.treeradius+= 10;
                    if (vertex.data.treeradius > vertex.data.maxradius) vertex.data.treeradius = vertex.data.maxradius;
                    this.onselect(vertex, selectionMenu, content); // Refresh display
                    window.gameInstance.redraw();
                });

                document.getElementById('decrease-radius').addEventListener('click', () => {
                    vertex.data.treeradius-= 10;
                    if (vertex.data.treeradius < 10) vertex.data.treeradius = 10;
                    this.onselect(vertex, selectionMenu, content); // Refresh display
                    window.gameInstance.redraw();
                });

                document.getElementById('delete-building').addEventListener('click', () => {
                    window.gameInstance.state.buildingGraph.removeVertex(vertex);
                    storehouseDeposit(this.res);
                    window.gameInstance.hideSelectionMenu();
                    window.gameInstance.redraw();
                });
            },
            work: function(deltaTime, person) {
                const here = person.currentPath[0];
                if (checkBuilding(here)){
                    return null;
                }
                const workplace = person.workplace;
                if (!workplace.data.active) {
                    person.actiontext = 'returning home'
                    return person.home;
                }
                let i = 0;
                if (!workplace.data.currenttree){
                    for (i = 0; i < gameInstance.state.map_trees.length; i++){
                        const tree = gameInstance.state.map_trees[i];
                        if (
                            Math.hypot(tree.x - workplace.x - workplace.data.width/2, tree.y - workplace.y -workplace.data.height/2) < workplace.data.treeradius
                            && tree.h === 3
                        ) {
                            workplace.data.currenttree = tree; break;
                        }
                    }
                }
                if (!workplace.data.currenttree){
                    setMessage("A forestry is without a forest");
                    person.actiontext = 'returning home';
                    return person.home;
                } else if (storehouseHasCapacity({wood: 3})){
                    workplace.data.currenttree.h-=1;
                    if (workplace.data.currenttree.h < 1){
                        workplace.data.currenttree = null;
                    }
                    person.inventory['wood'] = 3;
                    person.actiontext = 'bring wood to storehouse';
                    return gameInstance.state.storehouse;
                } else {
                    setMessage("the storehouse is full!", 'red')
                    person.actiontext = 'waiting';
                }
            },
            render: function(ctx, x, y, width, height, zoom, vertex, img) {
                if (gameInstance.state.selectedVertex && gameInstance.state.selectedVertex.id === vertex.id){
                    ctx.beginPath()
                    ctx.setLineDash([10,10])
                    ctx.strokeStyle = 'green';
                    ctx.arc(x, y, vertex.data.treeradius*zoom, 0, 2*Math.PI)
                    ctx.stroke();
                    ctx.setLineDash([])
                    ctx.beginPath()
                }
                if (vertex.data.buildstate < 0) {
                    const progress = vertex.data.buildingprogress/100;
                    if (progress < 0.5){
                        drawImg(ctx, x, y, buildsite1Img, width*1.5, height*1.5, 0, 0, progress*2)
                    } else {
                        drawImg(ctx, x, y, buildsite1Img, width*1.5, height*1.5, 0, 0, 1)
                        drawImg(ctx, x, y, img, width, height, 0, 0, progress*2-1)
                    }
                } else {
                    drawImg(ctx, x, y, img, width, height)
                }
            }
        },
        wheatfarm: { 
            name: 'wheatfarm', 
            img: farmImg,
            drawBottom: true,
            size: 1.5,
            res: { wood: 2 },
            buildingMode: 'onterrain', //'onterrain'
            terrainType: 'oasis', //terrainType: 'sand', 'oasis',  'rock'
            // event: "some-event-like-research-needed-to-build-this"
            tag: 'goods',
            data: {
                buildstate: 0,
                active: true,
                workers: [],
                maxWorkers: 2,
                production: [
                    {water: 1},
                    {grains: 3}
                ]
            },
            onselect: function(vertex, selectionMenu, content) {
                content.innerHTML = `
                    <div>${this.name}</div>
                    <div>Active: ${vertex.data.active ? 'Yes' : 'No'}</div>
                    <div>Workers: ${vertex.data.workers.length}/${vertex.data.maxWorkers}</div>
                    <button id="toggle-active">Toggle Active</button>
                    <button id="delete-building">Demolish Building</button>
                `;
                document.getElementById('toggle-active').addEventListener('click', () => {
                    vertex.data.active = !vertex.data.active;
                    this.onselect(vertex, selectionMenu, content); // Refresh display
                    window.gameInstance.redraw();
                });
                
                document.getElementById('delete-building').addEventListener('click', () => {
                    window.gameInstance.state.buildingGraph.removeVertex(vertex);
                    storehouseDeposit(this.res);
                    window.gameInstance.hideSelectionMenu();
                    window.gameInstance.redraw();
                });
            },
            render: function(ctx, x, y, width, height, zoom, vertex, img) {
                
                if (vertex.data.buildstate > 0) {
                    const progress = vertex.data.buildingprogress/100;
                    if (progress < 0.5){
                        drawImg(ctx, x, y, img, width, height, 0, 0, progress*2)
                    } else {
                        drawImg(ctx, x, y, img, width, height, 0, 0, progress*2-1)
                    }
                } else {
                    drawImg(ctx, x, y, img, width, height)
                }
            }
        },
        road: {
            name: 'road',
            width: 0,  // Roads don't have physical dimensions
            height: 0,
            drawBottom: true,
            img: {naturalHeight: 10*10, naturalWidth: 10*10}, // fake Image for selection range, apply 10 to compensate build in scale down
            res: { stone: 1 }, // Cost for vertex and edge per length
            buildingMode: 'path', // Special mode for edge-based building
            data: {}, 
            color: 'rgba(63, 34, 11, 0.20)',
            lineWidth: 4, // Width of the road line
            tag: 'infrastructure',
            onselect: function(edge, selectionMenu) {
                const content = selectionMenu.querySelector('#selection-content');
                
                // Calculate road length 
                const v0CenterX = edge.v0.x + edge.v0.data.width / 2;
                const v0CenterY = edge.v0.y + edge.v0.data.height / 2;
                const v1CenterX = edge.v1.x + edge.v1.data.width / 2;
                const v1CenterY = edge.v1.y + edge.v1.data.height / 2;
                
                const length = Math.sqrt(
                    Math.pow(v1CenterX - v0CenterX, 2) + 
                    Math.pow(v1CenterY - v0CenterY, 2)
                );
                
                content.innerHTML = `
                    <div>Road</div>
                    <div>Length: ${Math.round(length)} units</div>
                    <div>Connects:</div>
                    <div> - ${edge.v0.type.charAt(0).toUpperCase() + edge.v0.type.slice(1)} ${edge.v0.id}</div>
                    <div> - ${edge.v1.type.charAt(0).toUpperCase() + edge.v1.type.slice(1)} ${edge.v1.id}</div>
                    <button id="delete-road">Delete Road</button>
                `;
                
                // Add event listeners for buttons
                document.getElementById('delete-road').addEventListener('click', () => {
                    window.gameInstance.state.buildingGraph.removeEdge(edge);
                    window.gameInstance.hideSelectionMenu();
                    window.gameInstance.redraw();
                });
            },
            // Road-specific render function for edges
            renderEdge: function(ctx, v0x, v0y, v1x, v1y, zoom, edge) {
                const dx = v0x - v1x;
                const dy = v0y - v1y;
                const angle = Math.atan2(dy, dx);
                const length = Math.sqrt(dx * dx + dy * dy);

                ctx.save()

                ctx.fillStyle = roadPattern;
                ctx.translate(v1x, v1y);
                ctx.rotate(angle);
                ctx.fillRect(0, -this.lineWidth/2*zoom, length, this.lineWidth*zoom);

                ctx.restore();
            },
            render: function(ctx, x, y, width, height, zoom, vertex, img){
                ctx.beginPath();
                ctx.fillStyle = this.color;
                ctx.arc(x+width/2, y+height/2, this.lineWidth/2, 0, 2 * Math.PI);
                ctx.fill();
                ctx.beginPath();
            },
            // Calculate cost based on distance
            calculateCost: function(v0, v1) {
                // Calculate road length 
                const v0CenterX = v0.x + v0.data.width / 2;
                const v0CenterY = v0.y + v0.data.height / 2;
                const v1CenterX = v1.x + v1.data.width / 2;
                const v1CenterY = v1.y + v1.data.height / 2;
                
                const length = Math.sqrt(
                    Math.pow(v1CenterX - v0CenterX, 2) + 
                    Math.pow(v1CenterY - v0CenterY, 2)
                );

                const cost = {};
                Object.entries(this.res).forEach(([res, value])=>{
                    cost[res] = Math.ceil(value * 0.05 * length);
                })
                
                console.log(cost)
                return cost;
            }
        },
        storehouse: {
            name: 'storehouse',
            img: storehouseImg,
            size: 3,
            res: {}, // Free to build
            buildingMode: 'free',
            maxWorkers: 0, // Storehouses don't have workers
            tag: 'special',
            unique: true, // Only one can be built in the game
            data: {
                storage: {
                    water: 50,
                    wood: 50,
                    stone: 20,
                    iron: 0,
                    grains: 0,
                    flour: 0,
                    milk: 0,
                    wool: 0, 
                    meat: 0,
                    cheese: 0,
                    bread: 20,
                    beer: 0,
                    clothes: 0,
                    tools: 0,
                    weapons: 0,
                },
                capacity: 250,
                totalItems: 0,
                lastChanges: {}
            },
            init(vertex){
                vertex.data.totalItems = Object.values(vertex.data.storage).reduce((acc,c)=>acc+c,0);
            },
            onselect: function(vertex, selectionMenu,content) {    
                content.innerHTML = `
                    <div>Storehouse</div>
                    <div>Total Items: ${vertex.data.totalItems}</div>
                    <div>Storage Capacity: ${vertex.data.capacity}</div>
                `;
            },
            work: function(deltaTime, person) {
                let newTarget = null;
                if (person.home){
                    person.actiontext = 'returning home';
                    storehouseDeposit(person.inventory)
                    newTarget = person.home;
                }
                return newTarget;
            },
            render: function(ctx, x, y, width, height, zoom, vertex, img) {
                drawImg(ctx, x, y, img, width, height)
            }
        },
        palace: {
            name: 'palace',
            img: palaceImg,
            size: 4,
            res: {}, // Free to build
            buildingMode: 'free',
            maxWorkers: 0, // Palace don't have workers
            tag: 'special',
            unique: true, // Only one can be built in the game
            data: {},
            onselect: function(vertex, selectionMenu,content) {
                content.innerHTML = `
                    <div>Palace</div>
                    Your home
                `; 
            },
            work: function(deltaTime, person) {
                const newTarget = null;
                return newTarget;
            },
            render: function(ctx, x, y, width, height, zoom, vertex, img) {
                drawImg(ctx, x, y, img, width, height)
            }
        }
    },
};

function checkBuilding(here){
    if (here.data.buildstate >= 0) return false;
    person.actiontext = 'building';
    if (!here.data.buildingprogress) {
        const s = gameInstance.state.audio.createSpatialSource(
            'building', 
            here.x, here.y, 
            {sourceId: `building_${here.id}`, loop: true}
        );
        let handler = window.setInterval(()=>{
            if (here.data.buildingprogress >= 100){
                window.clearInterval(handler);
                gameInstance.state.audio.stopSpatialSource(`building_${here.id}`);
                here.data.buildstate = 0;
                console.log('building finished')
            } else {
                here.data.buildingprogress++;
            }
        }, 100);
    } 
    return true;
}

export default config;