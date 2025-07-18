import { SpatialIndex } from "./spatial.js";

export class SpatialLabeledGraph extends EventTarget {
    constructor(
        { vertices = {}, edges = {}, vertex_labels = {}, edge_labels = {} }, 
        { cellSize } = {}
    ){
        super();
        this.cellSize = cellSize;
        this.vertices = vertices;
        this.edges = edges;
        this.V = vertex_labels;
        this.E = edge_labels;
    }

    getVertex(id){
        return this.vertices[id];
    }
    getEdge(id){
        return this.edges[id];
    }

    // no redundancy check as labels are only added initially;
    addVertex(vertex, labels = []){
        if (this.vertices[vertex.id]) return false;

        this.vertices[vertex.id] = vertex;
        vertex._graph = this;

        labels = labels.length ? labels : vertex.labels;
        vertex.labels = labels;
        if (labels){
            for (let label of labels){
                if (label.startsWith('sp_')){
                    if (!this.V[label]){
                        this.V[label] = new SpatialIndex(this.cellSize);
                    }
                    this.V[label].set(vertex.x, vertex.y, vertex.id);
                } else if (label.startsWith('yY_')){
                    if (!this.V[label]){
                        this.V[label] = []
                    }
                    this.V[label].push(vertex.id)
                    this.V[label] = this.V[label].sort((v0, v1) => (this.vertices[v0].y - this.vertices[v1].y));
                } else {
                    if (!this.V[label]){
                        this.V[label] = []
                    }
                    this.V[label].push(vertex.id)
                }
            }
        }

        this.dispatchEvent(new CustomEvent('graph-add-vertex', { detail: vertex }));
        this.dispatchEvent(new CustomEvent('graph-add', { detail: vertex }));
        this.dispatchEvent(new CustomEvent('graph-update', { detail: vertex }));

        return true;
    }

    addEdge(edge, label = ''){
        if (this.edges[edge.id]) return false;

        this.edges[edge.id] = edge;
        edge._graph = this;

        label = label || edge.label;
        edge.label = label;

        if (!this.E[label]) this.E[label] = [];
        this.E[label].push(edge.id);

        if (!edge.v0.e[label]) edge.v0.e[label] = [];
        edge.v0.e[label].push(edge.id);

        if (!edge.v1.e[label]) edge.v1.e[label] = [];
        edge.v1.e[label].push(edge.id);

        this.dispatchEvent(new CustomEvent('graph-add-edge', { detail: edge }));
        this.dispatchEvent(new CustomEvent('graph-add', { detail: edge }));
        this.dispatchEvent(new CustomEvent('graph-update', { detail: edge }));

        return true;
    }

    removeEdge(id){
        const edge = this.edges[id];
        if (!edge) return false;

        const label = edge.label;
        if (edge.v0){
            const i0 = edge.v0.e[label].findIndex(i=>i===id);
            if (i0 !== -1) edge.v0.e[label].splice(i0,1);
        }
        if (edge.v1){
            const i1 = edge.v1.e[label].findIndex(i=>i===id);
            if (i1 !== -1) edge.v1.e[label].splice(i1,1);
        }

        const i2 = this.E[label].findIndex(i=>i===id);
        if (i2 !== -1) this.E[label].splice(i2,1);

        delete this.edges[id];
        edge._graph = null;

        this.dispatchEvent(new CustomEvent('graph-rem-edge', { detail: edge }));
        this.dispatchEvent(new CustomEvent('graph-rem', { detail: edge }));
        this.dispatchEvent(new CustomEvent('graph-update', { detail: edge }));

        return true;
    }

    removeVertex(id){
        const vertex = this.vertices[id];
        if (!vertex) return false;

        for (let elabel of Object.keys(vertex.e)){
            for (let eid of vertex.e[elabel]){
                this.removeEdge(eid);             
            }
        };
        for (let vlabel of vertex.labels){
            if (vlabel.startsWith('sp_')){
                this.V[vlabel].remove(vertex.id);
            } else {
                let i = this.V[vlabel].findIndex(k=>vertex.id===k);
                if (i !== -1) this.V[vlabel].splice(i,1);
            }
        }
        delete this.vertices[vertex.id];

        this.dispatchEvent(new CustomEvent('graph-rem-vertex', { detail: vertex }));
        this.dispatchEvent(new CustomEvent('graph-rem', { detail: vertex }));
        this.dispatchEvent(new CustomEvent('graph-update', { detail: vertex }));

        vertex._graph = null;

        return true;
    }

    toJSON() {
        return {
            cellSize: this.cellSize,
            vertices: Object.values(this.vertices).map(v => ({
                id: v.id, x: v.x, y: v.y, vlabels: v.labels, 
                type: v.type, data: v.data //elabels?
            })),
            edges: Object.values(this.edges).map(e => ({
                id: e.id, _v0: e._v0, _v1: e._v1, label: e.label,
                type: e.type, data: e.data
            }))
        };
    }

    static fromJSON(json) {
        const graph = new SpatialLabeledGraph({}, { cellSize: json.cellSize });
        
        for (let vData of json.vertices) {
            const vertex = new SpatialLabeledVertex(vData);
            graph.addVertex(vertex);
        }
        
        for (let eData of json.edges) {
            const edge = new LabeledEdge(eData);
            graph.addEdge(edge);
        }
        
        return graph;
    }
}

export class SpatialLabeledVertex {
    constructor({x, y, id = null, type, data = {}, vlabels = [], elabels = []}){
        this.id = id ? id : ''+Math.floor(Math.random()*100000000000000);
        this.x = x;
        this.y = y;
        this.e = {
            // rels: [id, id, id, id]
            // builds: [id, id,]
        };
        for (let elabel of elabels){
            this.e[elabel] = [];
        }
        this.labels = vlabels;
        this._graph = null;
        this.type = type;
        this.data = data;
    }
}

export class LabeledEdge {
    constructor({id = null, _v0, _v1, type, data = {}, label = ''}){
        this.id = id ? id: ''+Math.floor(Math.random()*100000000000000);
        this._v0 = _v0;
        this._v1 = _v1;
        this._graph = null;
        this.label = label;
        this.type = type;
        this.data = data;
    }

    get v0(){
        return this._graph.vertices[this._v0];
    }

    get v1(){
        return this._graph.vertices[this._v1];
    }   

    length(){
        return distance(this.v0, this.v1);
    }

    directionVector() {
        return normalize(subtract(this.v0, this.v1));
    }

    containsVertex(vertex) {
        return this.v0.id === vertex.id || this.v1.id === vertex.id;
    }

    getOtherVertex(vertex) {
        return this.v0.id === vertex.id ? this.v1 : this.v0;
    }
}

export function distance(p1, p2) {
    return Math.hypot(p1.x - p2.x, p1.y - p2.y);
}

export function Distance(x1, y1, x2, y2){
    return Math.hypot(x1-x2, y1-y2);
}

export function average(p1, p2) {
    return {x: (p1.x + p2.x) / 2, y: (p1.y + p2.y) / 2};
}

export function dot(p1, p2) {
    return p1.x * p2.x + p1.y * p2.y;
}

export function add(p1, p2) {
    return {x: p1.x + p2.x, y: p1.y + p2.y};
}

export function subtract(p1, p2) {
    return {x: p1.x - p2.x, y: p1.y - p2.y};
}

export function scale(p, scaler) {
    return {x: p.x * scaler, y: p.y * scaler};
}

export function normalize(p) {
    return scale(p, 1 / magnitude(p));
}

export function magnitude(p) {
    return Math.hypot(p.x, p.y);
}

export function translate(loc, angle, offset) {
    return {
        x: loc.x + Math.cos(angle) * offset,
        y: loc.y + Math.sin(angle) * offset,
    };
}

export function angle(p) {
    return Math.atan2(p.y, p.x);
}

// Find a vertex (building) at the given map position
export function findVertexAtPosition(vertex_label, mapX, mapY, radius = 10, type = null) {
    for (const vid of gameInstance.state.graph.V[vertex_label]) {
        let vertex = gameInstance.state.graph.vertices[vid];

        if (type && vertex.type !== type)  continue;

        const x = vertex.x;
        const y = vertex.y;

        if (vertex.data.width && vertex.data.height){
            const width = vertex.data.width;
            const height = vertex.data.height;
            
            if (
                mapX >= x-width/2 && 
                mapX <= x + width/2 && 
                mapY >= y-height/2 && 
                mapY <= y + height/2
            ) {
                return vertex;
            }
        } else {
            const distance = Distance(mapX, mapY, vertex.x, vertex.y);
            if (distance <= radius) {
                return vertex;
            }
        }

        /*
        graph.V.sp_buildings.forEach(x,y, (vertex)=>{
                    const distance = Distance(x, y, vertex.x, vertex.y);
                        
                    if (distance <= buildingType.epsilon) {
                        nearbyBuildingFound = true;
                        return true;
                    }
                    return false;
                })
        */
        
    }
    return null;
}


// Find an edge (road) at the given map position
export function findEdgeAtPosition(mapX, mapY, elabel, type = null, epsilon = 10) {
    // Define the hit detection threshold (how close the cursor needs to be to the road)
    const hitThreshold = epsilon / gameInstance.state.zoom; // Adjust based on zoom level
    for (const eid of gameInstance.state.graph.E[elabel]) {
        const edge = gameInstance.state.graph.edges[eid];
        if (!type || edge.type === type) {
            // Calculate center points of the connected buildings
            const v0 = edge.v0;
            const v1 = edge.v1;
            
            // Calculate distance from point to line segment (the road)
            // Formula: d = |CrossProduct(AB, AP)| / |AB|
            const ax = v0.x; 
            const ay = v0.y;
            const bx = v1.x;
            const by = v1.y;
            
            // Calculate length of line AB
            const abLength = Math.sqrt((bx - ax) * (bx - ax) + (by - ay) * (by - ay));
            
            // Calculate cross product of AB and AP
            const crossProduct = Math.abs((bx - ax) * (mapY - ay) - (by - ay) * (mapX - ax));
            
            // Calculate distance from point to line
            const distance = crossProduct / abLength;
            
            // Check if the point is close enough to the line
            if (distance <= hitThreshold) {
                // Make sure the point is actually near the line segment, not the extended line
                // Project the point onto the line
                const t = ((mapX - ax) * (bx - ax) + (mapY - ay) * (by - ay)) / (abLength * abLength);
                
                // Check if the projection is on the line segment
                if (t >= 0 && t <= 1) {
                    return edge;
                }
            }
        }
    }
    
    return null;
}


export function lineSegmentsIntersect(x1, y1, x2, y2, x3, y3, x4, y4) {
    const denom = ((x4 - x3) * (y1 - y2)) - ((x1 - x2) * (y4 - y3));
    const denomA = ((y3 - y4) * (x1 - x3)) + ((x4 - x3) * (y1 - y3));
    const denomB = ((y1 - y2) * (x1 - x3)) + ((x2 - x1) * (y1 - y3));

    if (denom === 0) {
        return false;
    }

    const ua = denomA / denom;
    const ub = denomB / denom;

    return (ua >= 0 && ua <= 1) && (ub >= 0 && ub <= 1);
}

export function edgeIntersectsExisting(elabel, v0, v1, excludeEdge = null) {
    const x1 = v0.x;
    const y1 = v0.y;
    const x2 = v1.x;
    const y2 = v1.y;

    for (const eid of gameInstance.state.graph.E[elabel]) {
        const edge = gameInstance.state.graph.edges[eid]
        if (excludeEdge && edge === excludeEdge) continue;
        
        if (edge.containsVertex(v0) || edge.containsVertex(v1)) continue;

        const x3 = edge.v0.x;
        const y3 = edge.v0.y;
        const x4 = edge.v1.x;
        const y4 = edge.v1.y;

        if (lineSegmentsIntersect(x1, y1, x2, y2, x3, y3, x4, y4)) {
            return true;
        }
    }
    return false;
}


export function findPointOnLine(x1, y1, x2, y2, px, py) {
    const dx = x2 - x1;
    const dy = y2 - y1;
    const length2 = dx * dx + dy * dy;
    
    if (length2 === 0) return null;

    const t = Math.max(0, Math.min(1, ((px - x1) * dx + (py - y1) * dy) / length2));
    
    const x = x1 + t * dx;
    const y = y1 + t * dy;
    
    return { x, y };
}

export function findNearestEdge(x, y, label, type = null, epsilon = 10) {
    let nearestDist = Infinity;
    let nearestPoint = null;
    let angle = 0;
    let nearestEdge = null;

    for (const eid of gameInstance.state.graph.E[label]) {
        const edge = gameInstance.state.graph.edges[eid];
        if (!type || edge.type === type) {
            const point = findPointOnLine(
                edge.v0.x, edge.v0.y,
                edge.v1.x, edge.v1.y,
                x, y
            );
            
            if (point) {
                const dist = Math.hypot(point.x - x, point.y - y);
                if (dist < nearestDist && dist < epsilon ) {
                    nearestDist = dist;
                    nearestPoint = point;
                    nearestEdge = edge;

                    const dx = edge.v1.x - edge.v0.x;
                    const dy = edge.v1.y - edge.v0.y;
                    angle = Math.atan2(dy, dx);
                }
            }
        }
    }

    return nearestPoint ? { point: nearestPoint, angle, edge: nearestEdge } : null;
}

/*export function handleVertexNearVertexPlacement(label, vertex, otherType, epsilon = 30){
    const {x, y } = vertex;
    const vst = findVertexAtPosition(label, x, y, epsilon, otherType);
    if (!vst) { 
        setMessage(`You can only build this on ${otherType}`)
        return null; 
    }
    const newVertex = vertex;
    graph.addVertex(newVertex, [label]);
    return newVertex;
}*/

/*export function handleVertexNextEdgePlacement(vertex, pathType, epsilon = 50) {
    const {x, y } = vertex;
    const segment = findNearestEdge(x, y, pathType, epsilon);
    let newVertex = null;
    if (segment){
        const { point, angle, edge: originalEdge } = segment;
        const pathVertex = new Vertex(point.x, point.y, pathType);
        newVertex = vertex;
        if (!edgeIntersectsExisting(originalEdge.v0, pathVertex, originalEdge) &&
            !edgeIntersectsExisting(pathVertex, originalEdge.v1, originalEdge)) {
            
            graph.addVertex(pathVertex);
            newVertex.rotation = angle+(Math.PI/2);
            graph.addVertex(newVertex);
            graph.removeEdge(originalEdge);
            graph.addEdge(originalEdge.v0, pathVertex, pathType, angle);
            graph.addEdge(pathVertex, originalEdge.v1, pathType, angle);
            graph.addEdge(pathVertex, newVertex, pathType, angle);
        }
    }
    this.selected = null;
    return newVertex;
}*/

export function handleVertexOnPathPlacement(elabel, vertex, pathType, epsilon) {
    const {x, y } = vertex;
    const segment = findNearestEdge(x, y, elabel, pathType, epsilon);
    
    if (segment) {
        const { point, angle, edge: originalEdge } = segment;
        const newVertex = vertex;
        newVertex.x = point.x;
        newVertex.y = point.y;
        
        if (!edgeIntersectsExisting(elabel, originalEdge.v0, newVertex, originalEdge) &&
            !edgeIntersectsExisting(elabel, newVertex, originalEdge.v1, originalEdge)) {
            
            gameInstance.state.graph.addVertex(newVertex);
            gameInstance.state.graph.removeEdge(originalEdge);
            const a = new LabeledEdge({_v0: originalEdge.v0.id, _v1: newVertex.id, type: pathType, label: originalEdge.label});
            a.data = { ...originalEdge.data };
            const b = new LabeledEdge({_v0: newVertex.id, _v1: originalEdge.v1.id, type: pathType, label: originalEdge.label});
            b.data = { ...originalEdge.data}
            gameInstance.state.graph.addEdge(a);
            gameInstance.state.graph.addEdge(b);
            return newVertex;
        }
    }
    return null;
}


//WARN!!!
/*
export function handlePathPlacement(x, y, type, nearVertex) {
    if (nearVertex) {
        if (gameInstance.state.selected && gameInstance.state.selected !== nearVertex) {
            const dx = nearVertex.x - gameInstance.state.selected.x;
            const dy = nearVertex.y - gameInstance.state.selected.y;
            const angle = Math.atan2(dy, dx);
            
            if (gameInstance.state.graph.addEdge(gameInstance.state.selected, nearVertex, type, angle)) {
                gameInstance.state.selected = nearVertex;
                return nearVertex;
            }
        } else {
            gameInstance.state.selected = nearVertex;
            return nearVertex;
        }
    } else {
        if (gameInstance.state.selected) {
            let newVertex = handleVertexOnPathPlacement(new SpatialLabeledVertex({x,y, type}), type);
            if (!newVertex) {
                newVertex = new SpatialLabeledVertex({x, y, type});
                gameInstance.state.graph.addVertex(newVertex);
            }        
            const dx = x - gameInstance.state.selected.x;
            const dy = y - gameInstance.state.selected.y;
            const angle = Math.atan2(dy, dx);
            
            if (gameinstance.state.graph.addEdge(gameInstance.state.selected, newVertex, type, angle)) {
                gameInstance.state.selected = newVertex;
            } else {
                gameInstance.state.graph.removeVertex(newVertex.id);
            }
            return newVertex;
        } else {
            let newVertex = handleVertexOnPathPlacement(new SpatialLabeledVertex({x,y, type}), type);
            if (!newVertex) {
                newVertex = new SpatialLabeledVertex({x, y, type}); 
                gameInstance.stategraph.addVertex(newVertex);
            }
            gameInstance.state.selected = newVertex;
            return newVertex;
        }
    }
}*/

export function drawPath(vertex1, vertex2, type = 'road') {
    const width = type === 'road' ? this.ROAD_WIDTH : this.WALL_WIDTH
    const color = type === 'road' ? `rgba(139, 115, 85, 0.9)` : this.WALL_COLOR;
    const pattern = type === 'road' ? this.roadPattern : this.wallPattern;
    this.ctx.save();
    
    this.ctx.translate(this.transform.translateX, this.transform.translateY);
    this.ctx.rotate(this.transform.rotation);
    this.ctx.scale(this.transform.scale, this.transform.scale);

    const dx = vertex1.x - vertex2.x;
    const dy = vertex1.y - vertex2.y;
    const angle = Math.atan2(dy, dx);
    const length = Math.sqrt(dx * dx + dy * dy);

    this.ctx.translate(vertex2.x, vertex2.y);
    this.ctx.rotate(angle);

    this.ctx.beginPath();
    this.ctx.rect(0, -width/2 , length, width );
    this.ctx.fillStyle = pattern;
    this.ctx.fill();

    if(type === 'wall'){
        this.ctx.beginPath();
        this.ctx.moveTo(0, -width/2);
        this.ctx.lineTo(length, -width/2);
        this.ctx.lineWidth = 8;
        this.ctx.strokeStyle = color;
        this.ctx.setLineDash([10,10])
        this.ctx.stroke()
        this.ctx.moveTo(0, width/2);
        this.ctx.lineTo(length, width/2);
        this.ctx.setLineDash([]);
        this.ctx.lineWidth = 2;
        this.ctx.stroke();
    }

    this.ctx.restore();
}

// Find the fastest path between two vertices, taking roads into account
export function findFastestPath(startVertex, endVertex, vlabels = [], elabel = '') {
    // Check if either vertex is null or undefined
    if (!startVertex || !endVertex) {
        throw new Error("Pathfinding error: null or undefined vertex provided");
    }
    
    // If start and end are the same, return empty path
    if (startVertex === endVertex) {
        return {
            path: [startVertex],
            totalTime: 0
        };
    }

    // Set of visited vertices
    const visited = new Set();
    
    // For each vertex, store the fastest time to reach it and the previous vertex in the path
    const times = new Map();
    const previous = new Map();
    
    // Priority queue of vertices to visit, ordered by time to reach
    const queue = [];
    
    // Initialize all vertices with infinite time WARN!!!
    for (const vlabel of vlabels){
        for (const vid of gameInstance.state.graph.V[vlabel]) {
            const vertex = gameInstance.state.graph.vertices[vid];
            if (vertex) { // Check for null vertices
                times.set(vertex, Infinity);
                previous.set(vertex, null);
            }
        }
    }
    
    // Start vertex has time 0
    times.set(startVertex, 0);
    queue.push(startVertex);
    
    // Dijkstra's algorithm
    while (queue.length > 0) {
        // Find vertex with smallest time
        queue.sort((a, b) => times.get(a) - times.get(b));
        const current = queue.shift();
        
        // If we've reached the end vertex, we're done
        if (current === endVertex) {
            break;
        }
        
        // Skip if already visited or null
        if (visited.has(current) || !current) {
            continue;
        }
        
        visited.add(current);
        
        // Check all neighbors of current vertex
        try {
            const neighbors = getNeighbors(current, elabel);
            for (const { neighbor, isRoad, distance } of neighbors) {
                // Skip if already visited or null
                if (visited.has(neighbor) || !neighbor) {
                    continue;
                }
                
                // Calculate time to reach this neighbor
                // Roads halve the effective distance (double the speed)
                const travelTime = isRoad ? distance / 2 : distance;
                const newTime = times.get(current) + travelTime;
                
                // If this path is faster, update the neighbor
                if (newTime < times.get(neighbor)) {
                    times.set(neighbor, newTime);
                    previous.set(neighbor, current);
                    queue.push(neighbor);
                }
            }
        } catch (error) {
            console.error("Error getting neighbors:", error);
        }
    }
    
    // Reconstruct the path
    const path = [];
    let current = endVertex;
    
    while (current !== null && current !== undefined) {
        path.unshift(current);
        current = previous.get(current);
    }
    
    path.unshift(startVertex);
    
    return {
        path: path,
        totalTime: times.get(endVertex) || Infinity
    };
}

// Get all neighboring vertices and their distances
function getNeighbors(vertex, elabel) {
    // Check if vertex is null or undefined
    if (!vertex) {
        console.warn("Null vertex in getNeighbors");
        return [];
    }
    
    const neighbors = [];
    
    // Check all edges from this vertex
    for (const eid of vertex.e[elabel]) {
        const edge = gameInstance.state.graph.edges[eid];
        if (!edge) continue; // Skip null edges
        
        const otherVertex = edge.getOtherVertex(vertex);
        if (!otherVertex) continue; // Skip if other vertex is null
        
        // Calculate distance between vertices (center to center)
        const v1CenterX = vertex.x + vertex.data.width / 2;
        const v1CenterY = vertex.y + vertex.data.height / 2;
        const v2CenterX = otherVertex.x + otherVertex.data.width / 2;
        const v2CenterY = otherVertex.y + otherVertex.data.height / 2;
        
        const distance = Distance(v1CenterX, v1CenterY, v2CenterX, v2CenterY);
        
        neighbors.push({
            neighbor: otherVertex,
            isRoad: edge.type === 'road',
            distance: distance
        });
    }
    
    return neighbors;
}



// Find all buildings of certain type and sort by effective travel time
export function findClosestByTime(startVertex, vertices, vlabels, elabel) {
    // Check if start vertex is null
    if (!startVertex) {
        console.warn("Null start vertex in findClosestByTime");
        return [];
    }
    
    const candidates = [];
    
    // Find all buildings of requested type with available worker slots
    for (const vertex of vertices) {
        if (vertex && vertex !== startVertex){
            // Calculate travel time for this building
            let travelTime;
            
            // Try finding a path with roads
            const { totalTime, path } = findFastestPath(startVertex, vertex, vlabels, elabel);
            
            // If no valid path was found, use direct distance
            if (totalTime === Infinity) {
                travelTime = distance(startVertex, vertex);
            } else {
                travelTime = totalTime;
            }
            candidates.push({
                building: vertex,
                travelTime: travelTime,
                path: path
            });
        }
    }
    
    // Sort by travel time (fastest first)
    candidates.sort((a, b) => a.travelTime - b.travelTime);
    
    return candidates;
}