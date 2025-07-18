import { distance, Distance } from "./graph.js";

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