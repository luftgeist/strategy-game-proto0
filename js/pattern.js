function addNoise(color, amount) {
    const rgb = parseInt(color.slice(1), 16);
    const r = (rgb >> 16) & 255;
    const g = (rgb >> 8) & 255;
    const b = rgb & 255;
    
    const variation = (Math.random() - 0.5) * amount;
    return `rgb(${
        Math.min(255, Math.max(0, r + variation))},${
        Math.min(255, Math.max(0, g + variation))},${
        Math.min(255, Math.max(0, b + variation))})`;
}

function drawStone(patternCtx, x, y, width, height, baseColor = '#e6d5ac') {
    // Sandstone base color
    
    // Add slight random offset to position and size
    const offsetX = (Math.random() - 0.5) * 4;
    const offsetY = (Math.random() - 0.5) * 4;
    const sizeVariationW = (Math.random() - 0.5) * (width * 0.2);
    const sizeVariationH = (Math.random() - 0.5) * (height * 0.2);
    
    // Draw main stone shape with variations
    patternCtx.beginPath();
    patternCtx.moveTo(x + offsetX, y + offsetY);
    patternCtx.lineTo(x + width + sizeVariationW + offsetX, y + offsetY);
    patternCtx.lineTo(x + width + sizeVariationW + offsetX, y + height + sizeVariationH + offsetY);
    patternCtx.lineTo(x + offsetX, y + height + sizeVariationH + offsetY);
    patternCtx.closePath();
    
    // Fill with base color
    patternCtx.fillStyle = addNoise(baseColor, 30);
    patternCtx.fill();
    
    // Add texture
    for (let i = 0; i < 30; i++) {
        patternCtx.fillStyle = addNoise(baseColor, 50);
        const dotX = x + offsetX + Math.random() * (width + sizeVariationW);
        const dotY = y + offsetY + Math.random() * (height + sizeVariationH);
        patternCtx.fillRect(dotX, dotY, 2, 2);
    }
    
    // Add highlights and shadows
    const gradient = patternCtx.createLinearGradient(
        x + offsetX, 
        y + offsetY,
        x + offsetX,
        y + height + sizeVariationH + offsetY
    );
    gradient.addColorStop(0, 'rgba(255,255,255,0.1)');
    gradient.addColorStop(1, 'rgba(0,0,0,0.1)');
    patternCtx.fillStyle = gradient;
    patternCtx.fill();
}

export function createWallPattern(canvas, rotation, { brickColor = '#e6d5ac', mortarColor = '#c65d38', brickHeight = 12, brickWidth = 16 } = {}) {
    const ctx = canvas.getContext("2d");
    const patternCanvas = document.createElement('canvas');
    const patternCtx = patternCanvas.getContext('2d');

    // Set pattern size
    patternCanvas.width = 200;  // Larger pattern for more variation
    patternCanvas.height = 200;
    // Clear pattern canvas
    patternCtx.fillStyle = mortarColor; // Clay-colored mortar
    patternCtx.fillRect(0, 0, patternCanvas.width, patternCanvas.height);

    // Create a grid of stones with variations
    const baseWidth = brickWidth;
    const baseHeight = brickHeight;
    
    for (let y = 0; y < patternCanvas.height; y += baseHeight) {
        const rowOffset = (y / baseHeight) % 2 ? baseWidth / 2 : 0;
        for (let x = -baseWidth; x < patternCanvas.width + baseWidth; x += baseWidth) {
            drawStone(patternCtx, x + rowOffset, y, baseWidth, baseHeight, brickColor);
        }
    }

    // Create rotated pattern
    ctx.save();
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    
    // Create pattern and rotate it
    const pattern = ctx.createPattern(patternCanvas, 'repeat');
    const radians = (rotation * Math.PI) / 180;
    
    // Transform pattern
    const transform = new DOMMatrix();
    transform.rotateSelf(rotation);
    pattern.setTransform(transform);
    
    return pattern;
}

function drawSandTexture(patternCanvas,patternCtx, color) {
    for (let i = 0; i < 1000; i++) {
        const x = Math.random() * patternCanvas.width;
        const y = Math.random() * patternCanvas.height;
        patternCtx.fillStyle = addNoise(color, 50);
        patternCtx.fillRect(x, y, 1, 1);
    }
}

export function createRoadPattern(canvas, color, rotation = 0, scale = 30) {
    const ctx = canvas.getContext("2d");
    const patternCanvas = document.createElement('canvas');
    const patternCtx = patternCanvas.getContext('2d');
    const basePatternSize = 300;
    // Scale the pattern canvas based on scale parameter
    const scaledSize = Math.floor(basePatternSize * (scale / 100));
    patternCanvas.width = scaledSize;
    patternCanvas.height = scaledSize;

    // Clear and fill with base sand color
    patternCtx.fillStyle = 'rgba(0,0,0,0)'; //'#e6c388';
    patternCtx.fillRect(0, 0, patternCanvas.width, patternCanvas.height);

    // Add sand texture
    drawSandTexture(patternCanvas, patternCtx, color);

    // Apply pattern to main canvas
    ctx.save();
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    
    const pattern = ctx.createPattern(patternCanvas, 'repeat');
    const transform = new DOMMatrix();
    transform.rotateSelf(rotation);
    pattern.setTransform(transform);
    
    return pattern;
}

export function createWoodPattern(canvas, baseColor = 'rgb(139, 89, 39)', lightness = 0.3) {
    const ctx = canvas.getContext("2d");
    const pattern = ctx.createPattern((() => {
        const textureCanvas = document.createElement('canvas');
        textureCanvas.width = 100;
        textureCanvas.height = 100;
        const textureCtx = textureCanvas.getContext('2d');
        
        // Base wood color
        textureCtx.fillStyle = baseColor;
        textureCtx.fillRect(0, 0, 100, 100);
        
        // More pronounced wood grain lines
        textureCtx.strokeStyle = 'rgba(0,0,0,0.1)';
        for (let i = 0; i < 100; i += 5) {
            textureCtx.beginPath();
            textureCtx.moveTo(0, i);
            textureCtx.quadraticCurveTo(50, i + Math.random() * 10 - 5, 100, i);
            textureCtx.stroke();
        }
        
        return textureCanvas;
    })(), 'repeat');
    
    return pattern;
}