export class SeededRandom {
    constructor(seed) {
        // Convert seed to a 32-bit unsigned integer
        this.seed = seed >>> 0;
    }
    
    // Generate next random float between 0 and 1
    next() {
        // Mulberry32 algorithm
        let t = this.seed += 0x6D2B79F5;
        t = Math.imul(t ^ t >>> 15, t | 1);
        t ^= t + Math.imul(t ^ t >>> 7, t | 61);
        
        // Convert to float between 0 and 1
        return ((t ^ t >>> 14) >>> 0) / 4294967296;
    }
    
    // Reset the generator to initial seed state
    reset(newSeed = null) {
        this.seed = (newSeed !== null ? newSeed : this.originalSeed) >>> 0;
    }
    
    // Store original seed for reset functionality
    setSeed(seed) {
        this.originalSeed = seed >>> 0;
        this.seed = this.originalSeed;
    }
}