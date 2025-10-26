async function getCompositeImageAsDataURL(dollImage, dollContainer) {
    const canvas = document.createElement('canvas');
    // The container's bounding rect is the correct reference for clothing positions
    const containerRect = dollContainer.getBoundingClientRect(); 
    const dollNaturalWidth = dollImage.naturalWidth || dollImage.offsetWidth;
    const dollNaturalHeight = dollImage.naturalHeight || dollImage.offsetHeight;

    canvas.width = dollNaturalWidth;
    canvas.height = dollNaturalHeight;
    const ctx = canvas.getContext('2d');
    
    ctx.drawImage(dollImage, 0, 0, dollNaturalWidth, dollNaturalHeight);
    
    const wornItemWrappers = Array.from(dollContainer.querySelectorAll('.worn-item-wrapper'));
    for (const wrapper of wornItemWrappers) {
        const item = wrapper.querySelector('.worn-item');
        if (!item) continue;
        
        // Calculate position and scale relative to the container, not the image
        const itemScaleX = wrapper.offsetWidth / containerRect.width;
        const itemScaleY = wrapper.offsetHeight / containerRect.height;
        const targetX = (parseFloat(wrapper.style.left) / containerRect.width) * dollNaturalWidth;
        const targetY = (parseFloat(wrapper.style.top) / containerRect.height) * dollNaturalHeight;
        const targetWidth = itemScaleX * dollNaturalWidth;
        const targetHeight = itemScaleY * dollNaturalHeight;

        ctx.drawImage(item, targetX, targetY, targetWidth, targetHeight);
    }
    
    return canvas.toDataURL('image/png');
}

// Helper to find the closest color name from a list of basic colors
function getColorName(r, g, b) {
    const colors = {
        "red": [255, 0, 0], "green": [0, 128, 0], "blue": [0, 0, 255],
        "yellow": [255, 255, 0], "orange": [255, 165, 0], "purple": [128, 0, 128],
        "pink": [255, 192, 203], "brown": [165, 42, 42], "black": [0, 0, 0],
        "white": [255, 255, 255], "gray": [128, 128, 128], "cyan": [0, 255, 255],
        "magenta": [255, 0, 255], "lime": [0, 255, 0], "maroon": [128, 0, 0],
        "navy": [0, 0, 128], "olive": [128, 128, 0], "teal": [0, 128, 128],
        "silver": [192, 192, 192], "gold": [255, 215, 0], "beige": [245, 245, 220],
        "khaki": [240, 230, 140]
    };

    let closestColor = null;
    let minDistance = Infinity;

    for (const colorName in colors) {
        const colorValue = colors[colorName];
        const distance = Math.sqrt(
            Math.pow(r - colorValue[0], 2) +
            Math.pow(g - colorValue[1], 2) +
            Math.pow(b - colorValue[2], 2)
        );
        if (distance < minDistance) {
            minDistance = distance;
            closestColor = colorName;
        }
    }
    return closestColor;
}


async function getDominantColor(imgElement) {
    return new Promise((resolve) => {
        const img = new Image();
        img.crossOrigin = "Anonymous";
        img.src = imgElement.src;

        img.onload = () => {
            const canvas = document.createElement('canvas');
            const ctx = canvas.getContext('2d', { willReadFrequently: true });
            const scale = Math.min(1, 50 / img.naturalWidth); // Downscale for performance
            canvas.width = img.naturalWidth * scale;
            canvas.height = img.naturalHeight * scale;
            ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

            let imageData;
            try {
                imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
            } catch (e) {
                console.error("Could not get image data for color analysis on:", img.src, e);
                resolve(null); // Fallback to no color
                return;
            }
            
            const data = imageData.data;
            const colorCounts = {};
            let maxCount = 0;
            let dominantColor = [0, 0, 0];

            for (let i = 0; i < data.length; i += 4) {
                const a = data[i+3];
                // Skip transparent or very faint pixels
                if (a < 128) continue;
                
                const r = data[i];
                const g = data[i+1];
                const b = data[i+2];

                // Skip pure white/black, often used for outlines
                if ((r > 250 && g > 250 && b > 250) || (r < 5 && g < 5 && b < 5)) continue;
                
                // Quantize colors to group similar shades
                const r_q = Math.round(r / 32) * 32;
                const g_q = Math.round(g / 32) * 32;
                const b_q = Math.round(b / 32) * 32;

                const colorKey = `${r_q},${g_q},${b_q}`;
                colorCounts[colorKey] = (colorCounts[colorKey] || 0) + 1;

                if (colorCounts[colorKey] > maxCount) {
                    maxCount = colorCounts[colorKey];
                    dominantColor = [r_q, g_q, b_q];
                }
            }

            if (maxCount === 0) {
                 resolve(null); // No dominant color found
                 return;
            }

            const colorName = getColorName(...dominantColor);
            resolve(colorName);
        };

        img.onerror = (err) => {
            console.error("Error loading image for color analysis:", img.src, err);
            resolve(null); // Fallback
        };
    });
}


async function buildPrompt(dollImage, dollContainer) {
    const gender = dollImage.src.includes('female') ? 'female' : 'male';
    const wornItems = Array.from(dollContainer.querySelectorAll('.worn-item'));
    const clothingDescriptions = {};
    
    // Asynchronously get the dominant color for each item
    const colorPromises = wornItems.map(item => getDominantColor(item));
    const colors = await Promise.all(colorPromises);

    wornItems.forEach((item, index) => {
        if (item.dataset.itemType) {
            const colorName = colors[index];
            const colorDesc = colorName ? `a ${colorName} ` : '';
            clothingDescriptions[item.dataset.itemType] = `${colorDesc}${item.alt}`;
        }
    });

    const categories = ['hair', 'hat', 'shirt', 'pants', 'shoes'];
    const clothingList = categories.map(category => {
        const categoryName = category.charAt(0).toUpperCase() + category.slice(1);
        if (clothingDescriptions[category]) {
            return `${categoryName}: ${clothingDescriptions[category]}`;
        }
        
        switch (category) {
            case 'shirt':
                return `${categoryName}: a plain, form-fitting t-shirt the same color as their skin`;
            case 'pants':
                return `${categoryName}: plain shorts the same color as their skin`;
            case 'hair':
                return `${categoryName}: bald`;
            case 'shoes':
                return `${categoryName}: barefoot`;
            default:
                return `${categoryName}: none`;
        }
    }).join('. ');
    
    return `Generate a full-body character portrait based on the provided paper doll image. The character is a ${gender}. The final image should be in a friendly, cartoon art style suitable for a game. Keep the character in a similar T-pose. Character details: ${clothingList}.`;
}

export async function generateCharacter(dollImage, dollContainer) {
    const imageDataUrl = await getCompositeImageAsDataURL(dollImage, dollContainer);
    const promptText = await buildPrompt(dollImage, dollContainer);
    
    console.log("Generated prompt:", promptText);

    const result = await websim.imageGen({
        prompt: promptText,
        image_inputs: [{ url: imageDataUrl }],
        aspect_ratio: "2:3",
    });
    
    return result.url;
}