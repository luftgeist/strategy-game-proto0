// Person class and related functions
import { calculateDistance } from './buildings.js';
import config from './config.js';
import { findFastestPath, findClosestAmong } from './pathfinding.js';
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


export class Person {
    constructor(spawnvertex, id = null, name, actiontext = "homeless", gender = null) {
        this.id = id ? id : '' + Math.floor(Math.random() * 100000000000000);
        this.gender = gender || (this.id % 2 === 0) ? 'f' : 'm';
        const rand = Math.floor(Math.random()*10);
        this.name = name ||  (gender === 'f') ? FEMALE_NAMES[rand] : MALE_NAMES[rand];
        this.walking = 0;
        
        this.home = null; 
        this.workplace = null;  

        this.currentPath = [spawnvertex];
        this.oldPath = [];

        this.x = spawnvertex.x
        this.y = spawnvertex.y

        this.timer = 3000;
        
        this.baseSpeed = 0.05 + Math.random()*0.05;
        this.onRoad = false;

        this.actiontext = actiontext;

        this.inventory = {};

        this.skills = {};

        this.tasks = [];

        this.const = {
            body: 0.5,
            sec: 0.5,
        }

        this.relsTo = {};
        
        // cache
        this.relsFrom = {};

        this.needs = {
            nourishment: 0.7,
            clothes: 0.8,
            rested: 0.9,
            social: 0.6,
            sex: 0.5
        }
        window.person = this;
    }

    async update(deltatime, resources){
        if (this.currentPath.length === 1){
            this.timer -= deltatime;
            let newTarget = null;
            if (this.timer <= 0){
                this.timer = 3000;
                const buildingType = gameInstance.config.buildingTypes[this.currentPath[0].type];
                try {
                    newTarget = await buildingType.work(deltatime, this, this.currentPath[0]);
                } catch (e) {
                    console.error('error while working: ',e);
                    newTarget = this.home || gameInstance.state.storehouse;
                }
                newTarget = this.checkNeeds(newTarget);
            }
            if (newTarget){
                this.getNewPath(newTarget);
                this.oldPath.push(this.currentPath[0].id);
                if (this.oldPath.length > 5){
                    this.oldPath.shift();
                }
            }
        } else {
            const reachedTarget = this.moveTowardsTarget(deltatime);
            this.checkOnRoad();
            if (reachedTarget){
                if (this.currentPath.length >= 2){
                    this.currentPath.shift(); 
                }
            }
        }
    }

    checkOnRoad(){
        const vertex1 = this.currentPath[0];
        const vertex2 = this.currentPath[1];

        this.onRoad = false;
            
        for (const edge of vertex1.edges) {
            if (edge.type === 'road' && 
                ((edge.v0 === vertex1 && edge.v1 === vertex2) || 
                    (edge.v0 === vertex2 && edge.v1 === vertex1))) {
                this.onRoad = true;
                return;
            }
        }
        
        return false;
    }

    getNewPath(newTarget, origin = null){
        if (this.currentPath.length !== 1) throw new Error('Debug: currentPath not length 1');
        const orig = origin || this.currentPath[this.currentPath.length-1];
        const newpath = null;//gameInstance.state.pathdb.check(this.id, origin, newTarget)
        if (newpath) {
            this.currentPath = newpath;
            return;
        } else {
            const { path } = findFastestPath(orig, newTarget, gameInstance.state.buildingGraph);
            this.currentPath = path;
        }

    }

    moveTowardsTarget(deltaTime){
        // Calculate distance to target
        const target = this.currentPath[1];

        const distanceToTarget = calculateDistance(
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
        let moveSpeed = this.baseSpeed * (cappedDeltaTime / 16.67);  // 16.67ms is approx one frame at 60fps
        
        // Double speed if on a road
        if (this.onRoad) {
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
        this.walking += 0.25 * gameInstance.state.speed;
        return false;
        
    }

    findJob(){
        const openjobs = Array.from(gameInstance.state.buildingGraph.vertices.values())
        .filter((vertex)=>(
            vertex.data.maxWorkers && 
            (vertex.data.workers.length < vertex.data.maxWorkers) && 
            vertex.data.active
        ));
        const candidates = findClosestAmong(gameInstance.state.buildingGraph, this.home, openjobs);
        if (candidates.length > 0){
            this.assignToWork(candidates[0].building);
            return candidates[0].building;
        }
        return null;
    }

    findHome(){
        const openHouses = Array.from(gameInstance.state.buildingGraph.vertices.values())
        .filter((vertex)=>(
            vertex.data.maxResidents && 
            (vertex.data.residents.length < vertex.data.maxResidents)
        ));
        const candidates = findClosestAmong(gameInstance.state.buildingGraph, gameInstance.state.storehouse, openHouses);
        if (candidates.length > 0){
            this.assignToHome(candidates[0].building);
            return candidates[0].building;
        }
        return null;
    }

    // gets executed once before leaving to new target
    checkNeeds(newTarget){
        if (!this.home){
            this.actiontext = 'searching home';
            this.findHome();
            return newTarget;
        }
        if (this.home && !this.workplace){
            this.actiontext = 'searching job';
            this.findJob();
            return newTarget;
        }
        if (this.home && this.isAt(this.home)){
            const foodthreshold = gameInstance.state.game_env.needs.ration || gameInstance.config.NEEDS.PECKISH;
            if (this.needs.nourishment < foodthreshold){
                const FOODS = shuffle(gameInstance.config.FOODS)
                for(let food of FOODS){
                    if (canStorehouseProvide({[food]: 1})){
                        storehouseWithdraw({[food]: 1})
                        this.home.data.residents.forEach((r)=>{
                            const resisdent = gameInstance.state.people.get(r);
                            resisdent.needs.nourishment += gameInstance.config.NEEDS.NOURISHMENT
                        })
                        break;
                    }
                }
                
            }
            if (this.needs.clothes < gameInstance.config.NEEDS.WORN){
                if (canStorehouseProvide({clothes: 1})){
                    storehouseWithdraw({clothes: 1})
                    this.home.residents.forEach((r)=>{
                        const resisdent = gameInstance.state.people.get(r);
                        resisdent.needs.clothes += gameInstance.config.NEEDS.NEW_CLOTHES;
                    })
                }
            }
        } else if (this.workplace && this.isAt(this.workplace)){
            this.needs.nourishment -= gameInstance.config.NEEDS.APPETITE;
            this.needs.clothes -= gameInstance.config.NEEDS.WEAR_OUT;
        } else {
            // if somewhere else than home or work
        }
        return newTarget;
    }

    isAt(vertex, eps = 5){
        const distance = calculateDistance(this.x, this.y, vertex.x, vertex.y);
        return distance < eps; // 5 units radius
    }

    assignTo(feature, vertex, key) {
        // Remove from previous workplace if any
        if (this[feature]) {
            const index = this[feature].data[key].findIndex((p)=>p.id === this.id);
            this[feature].data[key].splice(index, 1);
        }
        
        // Assign to new workplace
        this[feature] = vertex;
        this[feature].data[key] = (this[feature].data[key] || [])
        this[feature].data[key].push(this.id);
    }
    
    loose(feature, key) {
        if (this[feature]) {
            const index = this[feature].data[key].findIndex((p)=>p.id === this.id);
            this[feature].data[key].splice(index, 1);
            this[feature] = null;
        }
    }

    looseWork(){
        this.loose('workplace', 'workers')
        this.currentPath = this.getNewPath(this.home || gameInstance.state.storehouse)
    }

    assignToWork(workplace){
        this.assignTo("workplace", workplace, "workers");
    }

    assignToHome(home){
        this.assignTo("home", home, "residents");
    }

    looseHome(){
        this.loose('home', 'residents');
        this.currentPath = this.getNewPath(gameInstance.state.storehouse)
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
            <div>${this.name}</div>
            <button id="home-button">Home</button>
            <button id="workplace-button">Workplace: ${this.workplace ? this.workplace.type.charAt(0).toUpperCase() + this.workplace.type.slice(1) : 'Unemployed'}</button>
            <div>Action: ${this.actiontext}</div>
            ${this.workplace ? `<button id="quit-job">Quit Job</button>` : ''}
            <div style="margin-top: 5px; margin-bottom: 8px;">
                ${this.calcNeedBar("nourishment",this.needs.nourishment, ["Well Fed", "Peckish", "Hungry"], [config.NEEDS.PECKISH, config.NEEDS.HUNGER])}
                ${this.calcNeedBar("clothing",this.needs.clothes, ["Well dressed", "could use new clothes", "wearing ruggs"], [config.NEEDS.WORN_CLOTHES, config.NEEDS.WEARING_RUGGS])}
            </div>
        `;
        
        // Add event listeners for the buttons
        if (this.workplace) {
            document.getElementById('quit-job').addEventListener('click', () => {
                this.quitJob();
                this.onSelect(selectionMenu, content); // Refresh display
            });
        }
        if (this.home){
            const bt = document.querySelector('#home-button');
            bt.addEventListener('click', ()=>{
                window.gameInstance.selectBuilding(this.home, true);
            })
        }

        setTimeout(()=>{
            if (gameInstance.state.selectedPerson && gameInstance.state.selectedPerson.id === this.id) { 
                this.onSelect(selectionMenu, content) 
            } 
        }, 2000) // Refresh Display
    }
    
    toJSON() {
        return {
            id: this.id,
            name: this.name,
            homeId: this.home ? this.home.id : null,
            workplaceId: this.workplace ? this.workplace.id : null,
            currentPath: this.currentPath.map((v)=>v.id),
            oldPath: this.oldPath,
            timer: this.timer,
            needs: this.needs,
            inventory: this.inventory,
        };
    }
    
    static fromJSON(json, buildingGraph, vertexArray = Array.from(buildingGraph.vertices.values())) {
        // Find the home and workplace buildings
        const home = vertexArray.find(v => v.id === json.homeId);
        const workplace = json.workplaceId ? vertexArray.find(v => v.id === json.workplaceId) : null;
        const currentPath = json.currentPath.map(p=>vertexArray.find((v)=>v.id === p.id));
        
        const person = new Person(home, json.id, json.name);
        person.stateTimer = json.stateTimer;
        person.currentPath = currentPath;
        person.oldPath = json.oldPath;
        person.needs = json.needs;
        person.inventory = json.inventory || {};
        person.workplace = workplace;
        
        return person;
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
    gameInstance.state.people.forEach((person) => {
        // Calculate screen position
        const screenX = (person.x - viewportX) * zoom;
        const screenY = (person.y - viewportY) * zoom;
        
        // Only draw if on screen
        if (screenX >= -10 && screenX <= ctx.canvas.width + 10 &&
            screenY >= -10 && screenY <= ctx.canvas.height + 10) {
            
            const width = img_male.naturalWidth*zoom*gameInstance.config.people_size;
            const height = img_male.naturalHeight*zoom*gameInstance.config.people_size;

            const jump = Math.sin(person.walking) * 1;
            
            drawImg(ctx, screenX, screenY, img_male, width , height , 0, 0+jump, 1,)
        }
    });
}

// Find a person at the given position
export function findPersonAtPosition(people, mapX, mapY) {
    // Check a small radius around the click
    const clickRadius = 10;
    
    for (const person of people.values()) {
        const distance = calculateDistance(mapX, mapY, person.x, person.y);
        if (distance <= clickRadius) {
            return person;
        }
    }
    
    return null;
}
