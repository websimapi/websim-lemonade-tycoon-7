import { ReplayService } from './replay.js';
import { AudioManager } from './audio.js';
import { elements, showScreen, hideScreen, setupScreenTransitions } from './ui.js';
import { initializeInventory, addNewClothingItem } from './inventory.js';
import { initializeEditor, applyPreset, dragHandlers } from './character-editor.js';
import { generateCharacter } from './character-generator.js';
import { generateAsset } from './asset-generator.js';
import { PresetManager } from './presets.js';

document.addEventListener('DOMContentLoaded', () => {
    // Instantiate services
    const replayService = new ReplayService();
    const audioManager = new AudioManager();
    const presetManager = new PresetManager(elements, applyPreset);
    
    // Setup UI
    setupScreenTransitions();
    initializeInventory(elements);
    initializeEditor(elements);
    
    // Start ambient sounds on first user interaction
    const startAudio = () => {
        audioManager.playAmbientSound('ambient_birds.mp3');
        audioManager.playAmbientSound('ambient_wind.mp3');
        document.body.removeEventListener('click', startAudio);
        document.body.removeEventListener('touchstart', startAudio);
    };

    document.body.addEventListener('click', startAudio);
    document.body.addEventListener('touchstart', startAudio);

    elements.presetsBtn.addEventListener('click', () => {
        presetManager.renderGalleries();
    });

    // --- Asset Generator Logic ---
    elements.openGeneratorBtn.addEventListener('click', () => {
        showScreen(elements.assetGeneratorModal);
    });

    elements.closeGeneratorBtn.addEventListener('click', () => {
        hideScreen(elements.assetGeneratorModal);
    });

    elements.generateAssetBtn.addEventListener('click', async () => {
        const type = elements.itemTypeSelect.value;
        const prompt = elements.itemPromptInput.value.trim();

        if (!prompt) {
            alert('Please enter a description for the item.');
            return;
        }

        showScreen(elements.generatorLoadingOverlay);
        try {
            const imageUrl = await generateAsset(prompt, type);
            addNewClothingItem({ url: imageUrl, prompt, type }, dragHandlers);
            hideScreen(elements.assetGeneratorModal);
            elements.itemPromptInput.value = ''; // Clear input
        } catch (error) {
            console.error('Error generating asset:', error);
            alert('Sorry, there was an error creating your item. Please try again.');
        } finally {
            hideScreen(elements.generatorLoadingOverlay);
        }
    });

    elements.startGameBtn.addEventListener('click', async () => {
        console.log("Generating character...");
        showScreen(elements.loadingOverlay);
        hideScreen(elements.characterCreationScreen);

        try {
            const imageUrl = await generateCharacter(elements.dollImage, elements.dollContainer);
            elements.generatedCharacterImage.src = imageUrl;
            showScreen(elements.generationResultScreen);
        } catch (error) {
            console.error('Error generating character:', error);
            alert('Sorry, there was an error generating your character. Please try again.');
            showScreen(elements.characterCreationScreen); // Go back to editor on error
        } finally {
            hideScreen(elements.loadingOverlay);
        }
    });

    elements.confirmCharacterBtn.addEventListener('click', () => {
        console.log("Starting a new game with generated character...");
        const gender = elements.dollImage.src.includes('female') ? 'female' : 'male';
        const wornItems = Array.from(elements.dollContainer.querySelectorAll('.worn-item'));

        const presetData = {
            id: `preset_${Date.now()}`,
            name: `Character ${new Date().toLocaleTimeString()}`,
            gender: gender,
            items: wornItems.map(item => ({
                src: item.src,
                itemType: item.dataset.itemType,
                alt: item.alt,
                style: {
                    left: item.style.left,
                    top: item.style.top,
                    width: item.style.width,
                    height: item.style.height,
                }
            })),
            previewImageUrl: elements.generatedCharacterImage.src,
            isPublic: false,
        };

        presetManager.savePresetLocally(presetData);

        replayService.recordEvent('new_game_started', {
            character: {
                gender,
                items: wornItems.map(item => item.alt),
                generatedImage: elements.generatedCharacterImage.src
            },
            timestamp: Date.now()
        });
        
        showScreen(elements.mainContainer);
        hideScreen(elements.generationResultScreen);
        alert("Game started! (Check console for details)");
    });

    elements.continueGameBtn.addEventListener('click', () => {
        console.log("Continuing game...");
        replayService.recordEvent('game_continued', { timestamp: Date.now() });
        console.log('Current Replay Data:', replayService.getReplayData());
    });

    replayService.recordEvent('main_menu_loaded', { resolution: `${window.innerWidth}x${window.innerHeight}` });
});