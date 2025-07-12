import { Edge, Vertex } from "./graph.js";

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

export function edgeIntersectsExisting(graph, v0, v1, excludeEdge = null) {
    const x1 = v0.x;
    const y1 = v0.y;
    const x2 = v1.x;
    const y2 = v1.y;

    for (const edge of graph.edges) {
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

export function findNear(x, y, epsilon, type, vertices) {
    if (type) { vertices = Array.from(vertices).filter((v)=>v.type === type)}
    for (const vertex of vertices) {
        const distance = Math.hypot(vertex.x - x, vertex.y - y);
        if (distance < epsilon) {
            return vertex
        }
    }
    return null;
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

export function findNearestEdge(graph, x, y, type, epsilon) {
    let nearestDist = Infinity;
    let nearestPoint = null;
    let angle = 0;
    let nearestEdge = null;

    for (const edge of graph.edges) {
        if (edge.type === type) {
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

export function handleVertexNearVertexPlacement(graph, vertex, otherType, epsilon = 30){
    const {x, y } = vertex;
    const vst = findNear(x,y, epsilon, otherType)
    if (!vst) { 
        console.log(`You can only build this on ${otherType}`)
        return null; 
    }
    const newVertex = vertex;
    graph.addVertex(newVertex);
    return newVertex;
}

export function handleVertexNextPathPlacement(graph, vertex, pathType, epsilon = 50) {
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
}

export function handleVertexOnPathPlacement(graph, vertex, pathType, epsilon) {
    const {x, y } = vertex;
    const segment = findNearestEdge(graph, x, y, pathType, epsilon);
    
    if (segment) {
        const { point, angle, edge: originalEdge } = segment;
        const newVertex = vertex;
        newVertex.x = point.x;
        newVertex.y = point.y;
        newVertex.rotation = angle;
        
        if (!edgeIntersectsExisting(originalEdge.v0, newVertex, originalEdge) &&
            !edgeIntersectsExisting(newVertex, originalEdge.v1, originalEdge)) {
            
            graph.addVertex(newVertex);
            graph.removeEdge(originalEdge);
            const a = new Edge(originalEdge.v0, newVertex, pathType, angle);
            a.data = { ...originalEdge.data };
            const b = new Edge(newVertex, originalEdge.v1, pathType, angle);
            b.data = { ...originalEdge.data}
            graph.addEdge(a);
            graph.addEdge(b);
            return newVertex;
        }
    }
    return null;
}



export function handlePathPlacement(x, y, type, nearVertex) {
    if (nearVertex) {
        if (this.selected && this.selected !== nearVertex) {
            const dx = nearVertex.x - this.selected.x;
            const dy = nearVertex.y - this.selected.y;
            const angle = Math.atan2(dy, dx);
            
            if (this.addEdge(this.selected, nearVertex, type, angle)) {
                this.selected = nearVertex;
                return nearVertex;
            }
        } else {
            this.selected = nearVertex;
            return nearVertex;
        }
    } else {
        if (this.selected) {
            let newVertex = this.handleVertexOnPathPlacement(new Vertex(x,y, type), type);
            if (!newVertex) {
                newVertex = new Vertex(x, y, type);
                this.world.graph.addVertex(newVertex);
            }        
            const dx = x - this.selected.x;
            const dy = y - this.selected.y;
            const angle = Math.atan2(dy, dx);
            
            if (this.addEdge(this.selected, newVertex, type, angle)) {
                this.selected = newVertex;
            } else {
                this.world.graph.removeVertex(newVertex);
            }
            return newVertex;
        } else {
            let newVertex = this.handleVertexOnPathPlacement(new Vertex(x,y, type), type);
            if (!newVertex) {
                newVertex = new Vertex(x, y, type); 
                this.world.graph.addVertex(newVertex);
            }
            this.selected = newVertex;
            return newVertex;
        }
    }
}

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