export class SpatialIndex {
    constructor(cellSize, bondThreshold = 4) {
        this.index = {};
        this.revIndex = {};
        this.cellSize = cellSize;
        this.bondThreshold = bondThreshold;
    }
    
    forEach(x, y, r, callback) {
        const cellX = Math.floor(x / this.cellSize);
        const cellY = Math.floor(y / this.cellSize);
        const n = Math.floor(r / this.cellSize);
        
        // Only use circular bounds checking for large radii
        const useCircularBounds = n >= this.bondThreshold;
        const radiusSquared = useCircularBounds ? r * r : 0;
        const bufferSquared = useCircularBounds ? (this.cellSize * 0.7) ** 2 : 0;
        
        for (let i = -n; i <= n; i++) {
            for (let j = -n; j <= n; j++) {
                const cx = cellX + i;
                const cy = cellY + j;
                
                if (useCircularBounds) {
                    const cellCenterX = cx * this.cellSize + this.cellSize / 2;
                    const cellCenterY = cy * this.cellSize + this.cellSize / 2;
                    const distanceSquared = (cellCenterX - x) ** 2 + (cellCenterY - y) ** 2;
                    
                    if (distanceSquared > radiusSquared + bufferSquared) {
                        continue;
                    }
                }
                
                const cellKey = cx + ',' + cy;
                if (this.index[cellKey]) {
                    for (let k of this.index[cellKey]) {
                        if(callback(k, x, y, r)) return true;
                    }
                }
            }
        }
    }
    
    get(x, y, r) {
        const results = [];
        this.forEach(x, y, r, (id) => results.push(id));
        return results;
    }
    
    set(x, y, id) {
        const cellX = Math.floor(x / this.cellSize);
        const cellY = Math.floor(y / this.cellSize);
        const cellKey = cellX + ',' + cellY;
        
        if (this.revIndex[id] && this.revIndex[id] !== cellKey) {
            const oldCellKey = this.revIndex[id];
            if (this.index[oldCellKey]) {
                const index = this.index[oldCellKey].findIndex(item => item === id);
                if (index !== -1) {
                    this.index[oldCellKey].splice(index, 1);
                    if (this.index[oldCellKey].length === 0) {
                        delete this.index[oldCellKey];
                    }
                }
            }
            delete this.revIndex[id];
        }
        
        this.revIndex[id] = cellKey;
        if (!this.index[cellKey]) {
            this.index[cellKey] = [id];
        } else {
            if (!this.index[cellKey].includes(id)) {
                this.index[cellKey].push(id);
            }
        }
    }
    
    remove(id) {
        if (this.revIndex[id]) {
            const cellKey = this.revIndex[id];
            if (this.index[cellKey]) {
                const index = this.index[cellKey].findIndex(item => item === id);
                if (index !== -1) {
                    this.index[cellKey].splice(index, 1);
                    if (this.index[cellKey].length === 0) {
                        delete this.index[cellKey];
                    }
                }
            }
            delete this.revIndex[id];
        }
    }
}