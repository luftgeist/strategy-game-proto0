export function loadImg(src){
    const img = new Image(); img.src = `/assets/i/${src}`;

    img.loaded = new Promise((resolve, reject) => {
        img.onload = () => resolve(img);
        img.onerror = (e) => reject(new Error(`Failed to load image: ${path}`));
    });
    
    return img;
}

export function imgPath(src){
    return `/assets/i/${src}`;
}

export function drawImg(ctx, x, y, img, width, height, offsetX = 0, offsetY = 0, progress = 1) {
    if (progress <= 0) return; // Nothing to draw

    if (progress === 1) {
        ctx.drawImage(img, x + offsetX-width/2, y + offsetY-height/2, width, height);
        return { x, y, width, height };
    }

    // Save the current context state
    ctx.save();
    
    // Calculate the visible height based on progress
    const visibleHeight = height * progress;
    
    // Create a clipping region
    ctx.beginPath();
    ctx.rect(
        x + offsetX-width/2,
        y + offsetY-height/2 + (height - visibleHeight), // Start from bottom
        width,
        visibleHeight
    );
    ctx.clip();
    
    // Draw the image at its original position and size
    
    ctx.drawImage(
        img, 
        x + offsetX-width/2, 
        y + offsetY-height/2, 
        width, 
        height
    );
    
    // Restore the context state
    ctx.restore();

    return { x, y, width, height}
}

export function shuffle(array) {
    for (let i = array.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [array[i], array[j]] = [array[j], array[i]];
    }
    return array;
}