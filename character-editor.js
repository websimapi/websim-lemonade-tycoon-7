function makeInteractive(element, dollContainer) {
    let activeTouches = new Map();
    let initialDist = 1;
    let initialWidth = element.offsetWidth;

    const pointerDown = (e) => {
        element.setPointerCapture(e.pointerId);
        activeTouches.set(e.pointerId, { x: e.clientX, y: e.clientY });

        if (activeTouches.size === 2) {
            const touches = Array.from(activeTouches.values());
            initialDist = Math.hypot(touches[0].x - touches[1].x, touches[0].y - touches[1].y);
            initialWidth = element.offsetWidth;
        }
    };

    const pointerMove = (e) => {
        if (!activeTouches.has(e.pointerId)) return;

        activeTouches.set(e.pointerId, { x: e.clientX, y: e.clientY });
        const touches = Array.from(activeTouches.values());
        const dollRect = dollContainer.getBoundingClientRect();

        if (touches.length === 1) { // Move
            element.style.left = `${e.clientX - dollRect.left - element.offsetWidth / 2}px`;
            element.style.top = `${e.clientY - dollRect.top - element.offsetHeight / 2}px`;
        } else if (touches.length === 2) { // Scale
            const currentDist = Math.hypot(touches[0].x - touches[1].x, touches[0].y - touches[1].y);
            const scale = currentDist / initialDist;
            const newWidth = initialWidth * scale;
            element.style.width = `${newWidth}px`;
            element.style.height = 'auto'; // Maintain aspect ratio
        }
    };

    const pointerUp = (e) => {
        activeTouches.delete(e.pointerId);
        if (activeTouches.size < 2) {
            initialDist = 1; // Reset for next interaction
        }
    };

    element.addEventListener('pointerdown', pointerDown);
    element.addEventListener('pointermove', pointerMove);
    element.addEventListener('pointerup', pointerUp);
    element.addEventListener('pointercancel', pointerUp);
    element.addEventListener('pointerleave', pointerUp);
}


function createWornItem(src, itemType, alt, x, y, dollContainer, style = {}) {
    const existingItem = dollContainer.querySelector(`.worn-item[data-item-type="${itemType}"]`);
    if (existingItem) {
        existingItem.remove();
    }

    const wornItem = document.createElement('img');
    wornItem.src = src;
    wornItem.alt = alt;
    wornItem.classList.add('worn-item');
    wornItem.dataset.itemType = itemType;

    wornItem.onload = () => {
        dollContainer.appendChild(wornItem);

        if (style.left && style.top) {
            wornItem.style.left = style.left;
            wornItem.style.top = style.top;
            wornItem.style.width = style.width;
            wornItem.style.height = style.height;
        } else {
            const itemWidth = wornItem.offsetWidth;
            const itemHeight = wornItem.offsetHeight;

            wornItem.style.left = `${x - itemWidth / 2}px`;
            wornItem.style.top = `${y - itemHeight / 2}px`;
        }

        makeInteractive(wornItem, dollContainer);
    };
}

// Drag and drop handler functions to be exported
export const dragHandlers = {
    dragStart: null,
    touchStart: null,
};

export function initializeEditor(elements) {
    const { dollContainer, clothingItems, genderBtns, dollImage } = elements;

    // Gender Selection
    genderBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            genderBtns.forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            const gender = btn.dataset.gender;
            dollImage.src = `${gender}_doll.png`;
            dollContainer.querySelectorAll('.worn-item').forEach(item => item.remove());
        });
    });

    // --- Desktop Drag and Drop ---
    dragHandlers.dragStart = (e) => {
        e.dataTransfer.setData('text/plain', e.target.src);
        e.dataTransfer.setData('text/item-type', e.target.dataset.itemType);
        e.dataTransfer.setData('text/alt', e.target.alt);
    };

    clothingItems.forEach(item => {
        item.addEventListener('dragstart', dragHandlers.dragStart);
    });

    dollContainer.addEventListener('dragover', (e) => e.preventDefault());

    dollContainer.addEventListener('drop', (e) => {
        e.preventDefault();
        const src = e.dataTransfer.getData('text/plain');
        const itemType = e.dataTransfer.getData('text/item-type');
        const alt = e.dataTransfer.getData('text/alt');

        const dollRect = dollContainer.getBoundingClientRect();
        const x = e.clientX - dollRect.left;
        const y = e.clientY - dollRect.top;

        createWornItem(src, itemType, alt, x, y, dollContainer);
    });

    // --- Mobile Drag and Drop ---
    let draggedItem = null;
    let draggedItemClone = null;

    dragHandlers.touchStart = (e) => {
        e.preventDefault();
        draggedItem = e.target;
        draggedItemClone = draggedItem.cloneNode(true);
        draggedItemClone.classList.add('dragging-clone');
        document.body.appendChild(draggedItemClone);
        moveClone(e.touches[0].clientX, e.touches[0].clientY);
    };

    clothingItems.forEach(item => {
        item.addEventListener('touchstart', dragHandlers.touchStart, { passive: false });
    });

    document.addEventListener('touchmove', (e) => {
        if (!draggedItemClone) return;
        e.preventDefault();
        moveClone(e.touches[0].clientX, e.touches[0].clientY);
    }, { passive: false });

    document.addEventListener('touchend', (e) => {
        if (!draggedItem || !draggedItemClone) {
            if (draggedItemClone) draggedItemClone.remove();
            draggedItem = null;
            draggedItemClone = null;
            return;
        }

        const touch = e.changedTouches[0];
        draggedItemClone.style.display = 'none';
        const dropTarget = document.elementFromPoint(touch.clientX, touch.clientY);
        draggedItemClone.style.display = '';

        if (dollContainer.contains(dropTarget)) {
            const { src, dataset: { itemType }, alt } = draggedItem;
            const dollRect = dollContainer.getBoundingClientRect();
            const x = touch.clientX - dollRect.left;
            const y = touch.clientY - dollRect.top;
            createWornItem(src, itemType, alt, x, y, dollContainer);
        }

        draggedItemClone.remove();
        draggedItem = null;
        draggedItemClone = null;
    });

    function moveClone(x, y) {
        if (draggedItemClone) {
            draggedItemClone.style.left = `${x - draggedItemClone.width / 2}px`;
            draggedItemClone.style.top = `${y - draggedItemClone.height / 2}px`;
        }
    }
}


export function applyPreset(preset, elements) {
    const { dollImage, dollContainer, genderBtns } = elements;

    // Set gender
    genderBtns.forEach(btn => {
        btn.classList.toggle('active', btn.dataset.gender === preset.gender);
    });
    dollImage.src = `${preset.gender}_doll.png`;

    // Clear existing items
    dollContainer.querySelectorAll('.worn-item').forEach(item => item.remove());

    // Add items from preset
    preset.items.forEach(item => {
        createWornItem(item.src, item.itemType, item.alt, 0, 0, dollContainer, item.style);
    });
}