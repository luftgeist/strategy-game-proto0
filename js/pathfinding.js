// Pathfinding utilities for the game
import { calculateDistance } from './buildings.js';

// Find the fastest path between two vertices, taking roads into account
export function findFastestPath(startVertex, endVertex, buildingGraph) {
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
    
    // Initialize all vertices with infinite time
    for (const vertex of buildingGraph.vertices.values()) {
        if (vertex) { // Check for null vertices
            times.set(vertex, Infinity);
            previous.set(vertex, null);
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
            const neighbors = getNeighbors(current, buildingGraph);
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
function getNeighbors(vertex, buildingGraph) {
    // Check if vertex is null or undefined
    if (!vertex) {
        console.warn("Null vertex in getNeighbors");
        return [];
    }
    
    const neighbors = [];
    
    // Check if vertex.edges exists and is iterable
    if (!vertex.edges || !vertex.edges.forEach) {
        console.warn("Vertex has no valid edges property:", vertex);
        return [];
    }
    
    // Check all edges from this vertex
    for (const edge of vertex.edges) {
        if (!edge || edge.type !== 'road') continue; // Skip null edges
        const isRoad = true;
        
        const otherVertex = edge.getOtherVertex(vertex);
        if (!otherVertex) continue; // Skip if other vertex is null
        
        // Calculate distance between vertices (center to center)
        const v1CenterX = vertex.x + vertex.data.width / 2;
        const v1CenterY = vertex.y + vertex.data.height / 2;
        const v2CenterX = otherVertex.x + otherVertex.data.width / 2;
        const v2CenterY = otherVertex.y + otherVertex.data.height / 2;
        
        const distance = calculateDistance(v1CenterX, v1CenterY, v2CenterX, v2CenterY);
        
        neighbors.push({
            neighbor: otherVertex,
            isRoad: isRoad,
            distance: distance
        });
    }
    
    return neighbors;
}

// Calculate the direct walking distance between two vertices (center to center)
export function calculateDirectDistance(vertex1, vertex2) {
    // Check if either vertex is null
    if (!vertex1 || !vertex2) {
        console.warn("Null vertex in calculateDirectDistance");
        return Infinity;
    }
    
    const v1CenterX = vertex1.x + vertex1.data.width / 2;
    const v1CenterY = vertex1.y + vertex1.data.height / 2;
    const v2CenterX = vertex2.x + vertex2.data.width / 2;
    const v2CenterY = vertex2.y + vertex2.data.height / 2;
    
    return calculateDistance(v1CenterX, v1CenterY, v2CenterX, v2CenterY);
}

// Find all buildings of certain type and sort by effective travel time
export function findClosestAmong(graph, startVertex, vertices) {
    // Check if start vertex is null
    if (!startVertex) {
        console.warn("Null start vertex in findClosestBuildingsByType");
        return [];
    }
    
    const candidates = [];
    
    // Find all buildings of requested type with available worker slots
    for (const vertex of vertices) {
        if (vertex && vertex !== startVertex){
            // Calculate travel time for this building
            let travelTime;
            
            // Try finding a path with roads
            const { totalTime, path } = findFastestPath(startVertex, vertex, graph);
            
            // If no valid path was found, use direct distance
            if (totalTime === Infinity) {
                travelTime = calculateDirectDistance(startVertex, vertex);
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