// Person class and related functions
import { Distance, SpatialLabeledVertex } from './graph.js';
import { findFastestPath, findClosestByTime } from './pathfinding.js';
import config from './config.js';
import { drawImg, loadImg, shuffle } from './utils.js';
import { storehouseDeposit, storehouseHasCapacity, storehouseWithdraw, canStorehouseProvide } from './resources.js';

export const MALE_NAMES = [
    "Muhammad",
    "Ahmed",
    "Omar",
    "Ali",
    "Yusuf",
    "Hassan",
    "Khalid",
    "Ibrahim",
    "Zaid",
    "Hamid",
];
export const FEMALE_NAMES = [
    "Fatima",
    "Layla",
    "Amira",
    "Zara",
    "Noor",
    "Rania",
    "Leila",
    "Aisha",
    "Samira",
    "Dalia"
];

const img_male = loadImg('p/people_male_young.png')


export class Person extends SpatialLabeledVertex {
    constructor(spawnvertex, id = null, name, actiontext = "homeless", gender = null) {

        id = id ? id : '' + Math.floor(Math.random() * 100000000000000);

        super({id, x: spawnvertex.x, y: spawnvertex.y, type: 'person', vlabels: ['people'], elabels: ['rels']})

        this.data.gender = gender || (this.id % 2 === 0) ? 'f' : 'm';
        const rand = Math.floor(Math.random()*10);
        this.data.name = name ||  (this.data.gender === 'f') ? FEMALE_NAMES[rand] : MALE_NAMES[rand];
        this.data.walking = 0;
        
        this.data.home = null; 
        this.data.workplace = null;  

        this.data.currentPath = [spawnvertex];
        this.data.oldPath = [];

        this.data.timer = 3000;
        
        this.data.baseSpeed = 0.05 + Math.random()*0.05;
        this.data.onRoad = false;

        this.data.actiontext = actiontext;

        this.data.inventory = {};

        this.data.tasks = [];

        this.data.const = {
            body: 0.5,
            sec: 0.5,
        }

        this.data.needs = {
            nourishment: 0.7,
            clothes: 0.8,
            rested: 0.9,
            social: 0.6,
            sex: 0.5
        }
    }

    async update(deltatime, resources){
        if (this.data.currentPath.length === 1){
            this.data.timer -= deltatime;
            let newTarget = null;
            if (this.data.timer <= 0){
                this.data.timer = 3000;
                const buildingType = gameInstance.config.buildingTypes[this.data.currentPath[0].type];
                try {
                    newTarget = await buildingType.work(deltatime, this, this.data.currentPath[0]);//
                } catch (e) {
                    console.error('error while working: ',e);
                    newTarget = this.data.home || gameInstance.state.storehouse;
                }
                newTarget = this.checkNeeds(newTarget);
            }
            if (newTarget){
                this.getNewPath(newTarget);
                this.data.oldPath.push(this.data.currentPath[0].id);
                if (this.data.oldPath.length > 5){
                    this.data.oldPath.shift();
                }
            }
        } else {
            const reachedTarget = this.moveTowardsTarget(deltatime);
            this.checkOnRoad();
            if (reachedTarget){
                if (this.data.currentPath.length >= 2){
                    this.data.currentPath.shift(); 
                }
            }
        }
    }

    checkOnRoad(){
        const vertex1 = this.data.currentPath[0];
        const vertex2 = this.data.currentPath[1];

        this.data.onRoad = false;
            
        for (const edge of vertex1.e.buildings) {
            if (edge.type === 'road' && 
                ((edge.v0 === vertex1 && edge.v1 === vertex2) || 
                    (edge.v0 === vertex2 && edge.v1 === vertex1))) {
                this.data.onRoad = true;
                return;
            }
        }
        
        return false;
    }

    getNewPath(newTarget, origin = null){
        if (this.data.currentPath.length !== 1) throw new Error('Debug: currentPath not length 1');
        const orig = origin || this.data.currentPath[this.data.currentPath.length-1];
        const newpath = null;//gameInstance.state.pathdb.check(this.id, origin, newTarget)
        if (newpath) {
            this.data.currentPath = newpath;
            return;
        } else {
            const { path } = findFastestPath(orig, newTarget, ['buildings'], 'buildings');
            this.data.currentPath = path;
        }

    }

    moveTowardsTarget(deltaTime){
        // Calculate distance to target
        const target = this.data.currentPath[1];

        const distanceToTarget = Distance(
            this.x, this.y, 
            target.x, target.y);
        
        // If we're very close to target, just snap to it
        if (distanceToTarget <= 1) {
            this.x = target.x;
            this.y = target.y;
            return true;
        }
        
        // Calculate movement direction (unit vector)
        const directionX = (target.x - this.x) / distanceToTarget;
        const directionY = (target.y - this.y) / distanceToTarget;
        
        // Cap deltaTime to prevent huge jumps
        const cappedDeltaTime = Math.min(deltaTime, 500);

        // Calculate move speed with capped deltaTime
        let moveSpeed = this.data.baseSpeed * (cappedDeltaTime / 16.67);  // 16.67ms is approx one frame at 60fps
        
        // Double speed if on a road
        if (this.data.onRoad) {
            moveSpeed *= 2;
        }
        
        // Calculate movement distance for this frame
        const moveDistance = moveSpeed;
        
        // Check if we would overshoot the target
        if (moveDistance >= distanceToTarget) {
            // Just snap to the target
            this.x = target.x;
            this.y = target.y;
            return true;
        }

        // Regular movement
        this.x += directionX * moveDistance;
        this.y += directionY * moveDistance;
        this.data.walking += 0.25 * gameInstance.state.speed;
        return false;
        
    }

    findJob(){
        const openJobs = [];
        for (let vid of gameInstance.state.graph.V.buildings){
            const vertex = gameInstance.state.graph.vertices[vid];
            if (vertex.data.maxWorkers && 
            (vertex.data.workers.length < vertex.data.maxWorkers) && 
            vertex.data.active){
                openJobs.push(vertex);
            }
        }
        const candidates = findClosestByTime(this.data.home, openJobs, ['buildings'], 'buildings');
        if (candidates.length > 0){
            this.assignToWork(candidates[0].building);
            return candidates[0].building;
        }
        return null;
    }

    findHome(){
        const openHouses = []
        for (let vid of gameInstance.state.graph.V.buildings){
            const vertex = gameInstance.state.graph.vertices[vid]
            if (vertex.data.maxResidents && 
            (vertex.data.residents.length < vertex.data.maxResidents)){
                openHouses.push(vertex)
            }
        }
        const candidates = findClosestByTime(gameInstance.state.storehouse, openHouses, ['buildings'], 'buildings');
        console.log(candidates)
        if (candidates.length > 0){
            this.assignToHome(candidates[0].building);
            return candidates[0].building;
        }
        return null;
    }

    // gets executed once before leaving to new target
    checkNeeds(newTarget){
        if (!this.data.home){
            this.data.actiontext = 'searching home';
            this.findHome();
            return newTarget;
        }
        if (this.data.home && !this.data.workplace){
            this.data.actiontext = 'searching job';
            this.findJob();
            return newTarget;
        }
        if (this.data.home && this.isAt(this.data.home)){
            const foodthreshold = gameInstance.state.game_env.needs.ration || gameInstance.config.NEEDS.PECKISH;
            if (this.data.needs.nourishment < foodthreshold){
                const FOODS = shuffle(gameInstance.config.FOODS)
                for(let food of FOODS){
                    if (canStorehouseProvide({[food]: 1})){
                        storehouseWithdraw({[food]: 1})
                        this.data.home.data.residents.forEach((rid)=>{
                            const resisdent = gameInstance.state.graph.vertices[rid];
                            resisdent.data.needs.nourishment += gameInstance.config.NEEDS.NOURISHMENT
                        })
                        break;
                    }
                }
                
            }
            if (this.data.needs.clothes < gameInstance.config.NEEDS.WORN){
                if (canStorehouseProvide({clothes: 1})){
                    storehouseWithdraw({clothes: 1})
                    this.data.home.residents.forEach((r)=>{
                        const resisdent = gameInstance.state.vertices[r];
                        resisdent.data.needs.clothes += gameInstance.config.NEEDS.NEW_CLOTHES;
                    })
                }
            }
        } else if (this.data.workplace && this.isAt(this.data.workplace)){
            this.data.needs.nourishment -= gameInstance.config.NEEDS.APPETITE;
            this.data.needs.clothes -= gameInstance.config.NEEDS.WEAR_OUT;
        } else {
            // if somewhere else than home or work
        }
        return newTarget;
    }

    isAt(vertex, eps = 5){
        const distance = Distance(this.x, this.y, vertex.x, vertex.y);
        return distance < eps; // 5 units radius
    }

    assignTo(feature, vertex, key) {
        // Remove from previous workplace if any
        if (this.data[feature]) {
            const index = this.data[feature].data[key].findIndex((p)=>p.id === this.id);
            this.data[feature].data[key].splice(index, 1);
        }
        
        // Assign to new workplace
        this.data[feature] = vertex;
        this.data[feature].data[key] = (this.data[feature].data[key] || [])
        this.data[feature].data[key].push(this.id);
    }
    
    loose(feature, key) {
        if (this.data[feature]) {
            const index = this.data[feature].data[key].findIndex((p)=>p.id === this.id);
            this.data[feature].data[key].splice(index, 1);
            this.data[feature] = null;
        }
    }

    looseWork(){
        this.loose('workplace', 'workers')
        this.data.currentPath = this.getNewPath(this.data.home || gameInstance.state.storehouse)
    }

    assignToWork(workplace){
        this.assignTo("workplace", workplace, "workers");
    }

    assignToHome(home){
        this.assignTo("home", home, "residents");
    }

    looseHome(){
        this.loose('home', 'residents');
        this.data.currentPath = this.getNewPath(gameInstance.state.storehouse)
    }

    calcNeedBar(needname, needvalue, statusTexts, needConfig){
        const [greenText, yellowText, redText] = statusTexts;
        const [yellowThreshold, redThreshold] = needConfig;

        let needStatus = greenText;
        let needBarColor = "#4CAF50"; // Green
        if (needvalue <= redThreshold) {
            needStatus = redText;
            needBarColor = "#FF0000"; // Red
        } else if (needvalue <= yellowThreshold) {
            needStatus = yellowText;
            needBarColor = "#FFC107"; // Yellow
        }
        const needPercentage = Math.max(0,Math.min(100, Math.round(needvalue*100)));
        return `
            <div>${needname}: ${needStatus}</div>
            <div style="width: 100%; height: 10px; background-color: #333; margin-top: 3px;">
                <div style="width: ${needPercentage}%; height: 100%; background-color: ${needBarColor};"></div>
            </div>`
    }

    onSelect(selectionMenu, content) {        
        content.innerHTML = `
            <div>${this.data.name}</div>
            <button id="home-button">Home</button>
            <button id="workplace-button">Workplace: ${this.data.workplace ? this.data.workplace.type.charAt(0).toUpperCase() + this.data.workplace.type.slice(1) : 'Unemployed'}</button>
            <div>Action: ${this.data.actiontext}</div>
            ${this.data.workplace ? `<button id="quit-job">Quit Job</button>` : ''}
            <div style="margin-top: 5px; margin-bottom: 8px;">
                ${this.calcNeedBar("nourishment",this.data.needs.nourishment, ["Well Fed", "Peckish", "Hungry"], [config.NEEDS.PECKISH, config.NEEDS.HUNGER])}
                ${this.calcNeedBar("clothing",this.data.needs.clothes, ["Well dressed", "could use new clothes", "wearing ruggs"], [config.NEEDS.WORN_CLOTHES, config.NEEDS.WEARING_RUGGS])}
            </div>
        `;
        
        // Add event listeners for the buttons
        if (this.data.workplace) {
            document.getElementById('quit-job').addEventListener('click', () => {
                this.quitJob();
                this.onSelect(selectionMenu, content); // Refresh display
            });
        }
        if (this.data.home){
            const bt = document.querySelector('#home-button');
            bt.addEventListener('click', ()=>{
                window.gameInstance.selectBuilding(this.data.home, true);
            })
        }

        setTimeout(()=>{
            if (gameInstance.state.selectedPerson && gameInstance.state.selectedPerson.id === this.id) { 
                this.onSelect(selectionMenu, content) 
            } 
        }, 2000) // Refresh Display
    }
    
    toJSON() {
        const vertex = super.toJSON();
        vertex.data.currentPath = vertex.data.currentPath.map((v)=>v.id);
        return vertex;
    }
    
    static fromJSON(){
        return true
    }
}

// Draw all people
export function drawPeople() {
    const ctx = gameInstance.buildingCtx;
    const viewportX = gameInstance.state.viewportX;
    const viewportY = gameInstance.state.viewportY;
    const zoom = gameInstance.state.zoom;
    //const selectedPerson = gameInstance.state.selectedPerson
    // Draw each person
    for (const pid of gameInstance.state.graph.V.people){
        const person = gameInstance.state.graph.vertices[pid];
        // Calculate screen position
        const screenX = (person.x - viewportX) * zoom;
        const screenY = (person.y - viewportY) * zoom;
        
        // Only draw if on screen
        if (screenX >= -10 && screenX <= ctx.canvas.width + 10 &&
            screenY >= -10 && screenY <= ctx.canvas.height + 10) {
            
            const width = img_male.naturalWidth*zoom*gameInstance.config.people_size;
            const height = img_male.naturalHeight*zoom*gameInstance.config.people_size;

            const jump = Math.sin(person.data.walking) * 1;
            
            const ts = gameInstance.config.terrain_scaling;
            const [h] = gameInstance.state.terrain[Math.floor(person.y/ts)][Math.floor(person.x/ts)];
            
            drawImg(ctx, screenX, screenY, img_male, width , height , 0, 0+jump-h, 1,)
        }
    };
}
