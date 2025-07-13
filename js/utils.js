export function loadImg(src){
    const img = new Image(); img.src = `/assets/i/${src}`;

    img.loaded = new Promise((resolve, reject) => {
        img.onload = () => resolve(img);
        img.onerror = (e) => reject(new Error(`Failed to load image: ${img.src}`));
    });
    
    return img;
}

export function imgPath(src){
    return `/assets/i/${src}`;
}

export function drawImg(ctx, x, y, img, width, height, offsetX = 0, offsetY = 0, progress = 1, angle = 0) {
    if (progress <= 0) return; // Nothing to draw

    // Save the current context state
    ctx.save();
    
    // Always apply rotation around center
    const centerX = x + offsetX;
    const centerY = y + offsetY;
    ctx.translate(centerX, centerY);
    ctx.rotate(angle);

    if (progress === 1) {
        // Draw full image centered at origin (after rotation)
        ctx.drawImage(img, -width/2, -height/2, width, height);
        ctx.restore();
        return { x, y, width, height };
    }

    // Calculate the visible height based on progress
    const visibleHeight = height * progress;
    
    // Create a clipping region (in rotated coordinate space)
    ctx.beginPath();
    ctx.rect(
        -width/2,
        -height/2 + (height - visibleHeight), // Start from bottom
        width,
        visibleHeight
    );
    ctx.clip();
    
    // Draw the image at its original position and size (in rotated coordinate space)
    ctx.drawImage(
        img, 
        -width/2, 
        -height/2, 
        width, 
        height
    );
    
    // Restore the context state
    ctx.restore();

    return { x, y, width, height };
}

export function shuffle(array) {
    for (let i = array.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [array[i], array[j]] = [array[j], array[i]];
    }
    return array;
}