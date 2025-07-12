// Graph data structure with vertices and edges

export class Graph extends EventTarget {
    constructor(vertices, edges){
        super();
        this.vertices = new Map(vertices.map((v)=>([v.id, v])));
        this.edges = new Map(edges.map((e)=>([e.id, e])));
    }
    
    addVertex(vertex){
        this.vertices.set(vertex.id, vertex);
        this.vertices = new Map(Array.from(this.vertices.values()).sort((v0, v1)=>(v0.y-v1.y)).map((v=>([v.id,v]))));
        this.dispatchEvent(new CustomEvent('graph-add-vertex', {detail: vertex}));
        this.dispatchEvent(new CustomEvent('graph-add', {detail: vertex}));
        this.dispatchEvent(new CustomEvent('graph-update', {detail: vertex}));
    }
    
    removeVertex(vertex){
        vertex.edges.forEach((e)=>{
            e.v0.edges.delete(e.id);
            e.v1.edges.delete(e.id);
        });
        this.vertices.delete(vertex.id);
        this.dispatchEvent(new CustomEvent('graph-rem-vertex', {detail: vertex}));
        this.dispatchEvent(new CustomEvent('graph-rem', { detail: vertex }));
        this.dispatchEvent(new Event('graph-update', {detail: vertex}));
    }
    
    addEdge(edge){
        this.edges.set(edge.id, edge);
        edge.v0.edges.set(edge.id, edge);
        edge.v1.edges.set(edge.id, edge);
        this.dispatchEvent(new CustomEvent('graph-add-edge', {detail: edge}));
        this.dispatchEvent(new CustomEvent('graph-add', {detail: edge}));
        this.dispatchEvent(new CustomEvent('graph-update', {detail: edge}));
    }
    
    removeEdge(edge){
        this.edges.delete(edge.id);
        this.dispatchEvent(new CustomEvent('graph-rem-edge', {detail: edge}));
        this.dispatchEvent(new CustomEvent('graph-rem', {detail: edge}));
        this.dispatchEvent(new CustomEvent('graph-update', {detail: edge}));
    }
    
    clear(){
        this.vertices.clear();
        this.edges.clear();
        this.dispatchEvent(new CustomEvent('graph-rem-vertex'));
        this.dispatchEvent(new CustomEvent('graph-rem-edge'));
        this.dispatchEvent(new CustomEvent('graph-rem'));
        this.dispatchEvent(new CustomEvent('graph-update'));
    }

    toJSON(){
        const vertices = Array.from(this.vertices.values()).map((v)=>v.toJSON());
        const edges = Array.from(this.edges.values()).map((v)=>v.toJSON());
        return {vertices, edges};
    }

    static fromJSON(JSON){
        const vertdb = {};
        const vertices = [];
        const edges = [];
        JSON.vertices.forEach((v,i)=>{
            vertdb[v.id]=i;
            vertices.push(new Vertex(v.x,v.y,v.type,v.data,v.id,[], v.rotation));
        });
        JSON.edges.forEach((ed)=>{
            const v0 = vertices[vertdb[ed.v0]];
            const v1 = vertices[vertdb[ed.v1]];
            let e = new Edge(v0,v1,ed.type,ed.angle,ed.id);
            v0.edges.set(e.id, e);
            v1.edges.set(e.id, e);
            edges.push(e);
        });
        return { graph: new Graph(vertices, edges), vertdb, vertices, edges};
    }
}

export class Edge {
    constructor(v0, v1, type = 'road', angle = 0, id) {
        this.id = id ? id: ''+Math.floor(Math.random()*100000000000000);
        this.v0 = v0;
        this.v1 = v1;
        this.type = type;
        this.angle = angle;
    }

    equals(other) {
        return (
            (this.v0 === other.v0 && this.v1 === other.v1 ||
             this.v0 === other.v1 && this.v1 === other.v0) &&
            this.type === other.type
        );
    }

    containsVertex(vertex) {
        return this.v0 === vertex || this.v1 === vertex;
    }

    getOtherVertex(vertex) {
        return this.v0 === vertex ? this.v1 : this.v0;
    }

    toJSON(){
        const JSON = Object.assign({}, this);
        JSON.v0 = JSON.v0.id;
        JSON.v1 = JSON.v1.id;
        return JSON;
    }
}

export class Vertex {
    constructor(x, y, type = 'road', data = {}, id = null, edges = [], rotation = 0) {
        this.id = id ? id : ''+Math.floor(Math.random()*100000000000000);
        this.x = x;
        this.y = y;
        this.type = type;
        this.edges = new Map(edges.map(e=>([e.id, e])));
        this.data = data;
        this.rotation = rotation;
    }

    toJSON() {
        const JSON = Object.assign({},this);
        delete JSON.data.worker;
        delete JSON.edges;
        return JSON;
    }

    equal(vertex){
        if(!vertex) return false;
        return (this.x === vertex.x && this.y === vertex.y && this.type === vertex.type);
    }
}
