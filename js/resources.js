// Resource management functions

import { callOutside } from "./main.js";

import { setMessage } from "./ui.js";

// Withdraw resources from storehouse
export function storehouseWithdraw(resources) {
    
    // Check if enough resources are available first
    if (!canStorehouseProvide(resources)) {
        return false;
    }
    
    // Withdraw resources
    for (const [resource, amount] of Object.entries(resources)) {
        gameInstance.state.storehouse.data.lastChanges[resource] = -amount;
        gameInstance.state.storehouse.data.storage[resource] -= amount;
        gameInstance.state.storehouse.data.totalItems -= amount;
    }
    
    return true;
}

// Deposit resources into storehouse (no capacity check, can overflow)
export function storehouseDeposit(resources) {
    
    // Deposit resources
    for (const [resource, amount] of Object.entries(resources)) {
        if (amount > 0) { // Only deposit positive amounts
            gameInstance.state.storehouse.data.lastChanges[resource] = amount;
            gameInstance.state.storehouse.data.storage[resource] = (gameInstance.state.storehouse.data.storage[resource] || 0) + amount;
            gameInstance.state.storehouse.data.totalItems += amount;
        }
    }
    
    return true;
}

// Check if the storehouse can provide the requested resources
export function canStorehouseProvide(resources) { 
    // Check each requested resource
    for (const [resource, amount] of Object.entries(resources)) {
        if ((gameInstance.state.storehouse.data.storage[resource] || 0) < amount) {
            return false; // Not enough of this resource
        }
    }
    
    return true;
}


// Check if there's enough capacity for produced resources
export function storehouseHasCapacity(resources) {
    const storehouse = gameInstance.state.storehouse;
    let sum = 0;
    for (const [resource, amount] of Object.entries(resources)) {
        sum += amount;
    }
    
    return storehouse.data.capacity >= storehouse.data.totalItems + sum;
}

export function payTax(){
    const storehouse = gameInstance.state.storehouse;
    const payedTaxes = {};
    for (const [resource, amount] of Object.entries(gameInstance.state.game_env.taxrate)) {
        const diff = storehouse.data.storage[resource] - amount;
        let payable = 0;
        if (diff < 0){
            payable = amount + diff;
        } else {
            payable = amount;
        }
        payedTaxes[resource] = payable;
        storehouse.data.totalItmes -= payable;
        storehouse.data.storage[resource] -= payable;
        storehouse.data.lastChanges[resource] = -payable;
    }
    setMessage('Tax is Payed')
    callOutside('receiveTax',payedTaxes);
}

// Update the resource menu with current resources
export function updateResourceMenu() {
    if (gameInstance.state.storehouse === null){
        return false;
    }
    
    const resources = gameInstance.state.storehouse.data.storage;
    const lastResourceChanges = gameInstance.state.storehouse.data.lastChanges;
    const people = Array.from(gameInstance.state.people.values());

    const resourceContent = document.getElementById('resource-content');
    
    //resourceMenu.style.display = 'block';
    let html = '';
    
    // Population stats
    const totalPeople = people.length;
    const employedPeople = people.filter(person => person.hasJob).length;
    const unemployedPeople = totalPeople - employedPeople;
    const protestingPeople = people.filter(person => person.state === 'protesting').length;
    
    html += `
        <div class="resource-item">
            <img class="resource-icon" src="/assets/i/icons/people.png">
            <span>${totalPeople}</span>
        </div>
        <div class="resource-item">
            <img class="resource-icon" src="/assets/i/icons/unemployed.png">
            <span>${unemployedPeople}</span>
        </div>
        ${protestingPeople > 0 ? `
        <div class="resource-item">
            <img class="resource-icon" src="/assets/i/icons/protesting.png">
            <span class="resource-negative">${protestingPeople}</span>
        </div>
        ` : ''}
        <!--<div class="resource-item">
            <img class="resource-icon" src="/assets/i/icons/soldier.png">
            <span>${0}</span>
        </div>-->
    `;
    // Show storage levels for each resource
    Object.keys(gameInstance.state.storehouse.data.storage).forEach((resource) => {
        const amount = resources[resource] || 0;
        const change = lastResourceChanges[resource] || 0;
        let changeClass = 'resource-neutral';
        let changeText = '';
        if (change > 0) {
            changeClass = 'resource-positive';
            changeText = ` (+${change})`;
        } else if (change < 0) {
            changeClass = 'resource-negative';
            changeText = ` (${change})`;
        }

        
        html += `
            <div class="resource-item">
                <img class="resource-icon" src="/assets/i/icons/${resource}.png">
                <span><span class="${changeClass}">${changeText}</span>${amount}</span>
            </div>
        `;
    });

    resourceContent.innerHTML = html;
}

export function calcPeopleStats(){
    // Population stats
    const totalPeople = people.length;
    const employedPeople = people.filter(person => person.hasJob).length;
    const unemployedPeople = totalPeople - employedPeople;
    const protestingPeople = people.filter(person => person.state === 'protesting').length;
    const avgNourishment = people.reduce((acc, person)=>person.nourishment+acc, 0) / people.length;
    const avgClothing = people.reduce((acc, person)=>person.clothing+acc, 0) / people.length;
    return { totalPeople, employedPeople, unemployedPeople, protestingPeople, avgClothing, avgHunger}
}

export function calcPopularity(){
    
}