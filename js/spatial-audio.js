// js/spatial-audio.js
// Spatial Audio / 3D Audio Manager
// Provides immersive 3D audio experience using Web Audio API PannerNode

import { spatialAudioSettings } from './storage.js';

class SpatialAudioManager {
    constructor() {
        this.audioContext = null;
        this.pannerNode = null;
        this.listenerNode = null;
        this.isEnabled = false;
        this.isInitialized = false;

        // Spatial audio position (x, y, z)
        this.position = { x: 0, y: 0, z: 0 };
        this.orientation = { x: 0, y: 0, z: -1 };

        // Preset positions for immersive experience
        this.presets = {
            center: { x: 0, y: 0, z: 0, name: 'Center' },
            left: { x: -3, y: 0, z: 0, name: 'Left' },
            right: { x: 3, y: 0, z: 0, name: 'Right' },
            front: { x: 0, y: 0, z: -3, name: 'Front' },
            back: { x: 0, y: 0, z: 3, name: 'Back' },
            above: { x: 0, y: 3, z: 0, name: 'Above' },
            below: { x: 0, y: -3, z: 0, name: 'Below' },
            surround: { x: 0, y: 0, z: 0, name: 'Surround', animated: true },
            concert: { x: 0, y: -2, z: -5, name: 'Concert Hall' },
            intimate: { x: 0, y: 0, z: -1, name: 'Intimate' },
        };

        // Animation state for dynamic spatial effects
        this.animationId = null;
        this.animationStartTime = null;

        // Room size and reverb settings
        this.roomSize = spatialAudioSettings.getRoomSize();
        this.reverbEnabled = spatialAudioSettings.getReverbEnabled();

        // Load saved settings
        this._loadSettings();
    }

    /**
     * Initialize spatial audio with audio context
     */
    init(audioContext) {
        if (this.isInitialized) return;
        if (!audioContext) return;

        try {
            this.audioContext = audioContext;

            // Create panner node for 3D audio positioning
            this.pannerNode = this.audioContext.createPanner();

            // Configure panner for optimal 3D audio
            this.pannerNode.panningModel = 'HRTF'; // Head-related transfer function for realistic 3D
            this.pannerNode.distanceModel = 'inverse'; // Natural distance attenuation
            this.pannerNode.refDistance = 1;
            this.pannerNode.maxDistance = 10000;
            this.pannerNode.rolloffFactor = 1;
            this.pannerNode.coneInnerAngle = 360;
            this.pannerNode.coneOuterAngle = 360;
            this.pannerNode.coneOuterGain = 0;

            // Set initial position
            this._updatePannerPosition();

            // Get listener (represents user's position in 3D space)
            this.listenerNode = this.audioContext.listener;
            if (this.listenerNode) {
                // Position listener at origin
                if (this.listenerNode.positionX) {
                    // Modern API
                    this.listenerNode.positionX.value = 0;
                    this.listenerNode.positionY.value = 0;
                    this.listenerNode.positionZ.value = 0;
                    this.listenerNode.forwardX.value = 0;
                    this.listenerNode.forwardY.value = 0;
                    this.listenerNode.forwardZ.value = -1;
                    this.listenerNode.upX.value = 0;
                    this.listenerNode.upY.value = 1;
                    this.listenerNode.upZ.value = 0;
                } else {
                    // Legacy API
                    this.listenerNode.setPosition(0, 0, 0);
                    this.listenerNode.setOrientation(0, 0, -1, 0, 1, 0);
                }
            }

            this.isInitialized = true;
            console.log('[SpatialAudio] Initialized successfully');
        } catch (e) {
            console.warn('[SpatialAudio] Initialization failed:', e);
        }
    }

    /**
     * Get the panner node for audio graph connection
     */
    getPannerNode() {
        return this.pannerNode;
    }

    /**
     * Check if spatial audio is ready
     */
    isReady() {
        return this.isInitialized && this.pannerNode !== null;
    }

    /**
     * Enable/disable spatial audio
     */
    toggle(enabled) {
        this.isEnabled = enabled;
        spatialAudioSettings.setEnabled(enabled);

        if (!enabled && this.animationId) {
            this.stopAnimation();
        }

        return this.isEnabled;
    }

    /**
     * Check if spatial audio is active
     */
    isActive() {
        return this.isInitialized && this.isEnabled;
    }

    /**
     * Set position manually (x, y, z coordinates)
     */
    setPosition(x, y, z) {
        this.position = { x, y, z };
        spatialAudioSettings.setPosition(this.position);
        this._updatePannerPosition();
    }

    /**
     * Update panner node position
     */
    _updatePannerPosition() {
        if (!this.pannerNode) return;

        const { x, y, z } = this.position;

        try {
            if (this.pannerNode.positionX) {
                // Modern API with AudioParam
                this.pannerNode.positionX.setValueAtTime(x, this.audioContext.currentTime);
                this.pannerNode.positionY.setValueAtTime(y, this.audioContext.currentTime);
                this.pannerNode.positionZ.setValueAtTime(z, this.audioContext.currentTime);
            } else {
                // Legacy API
                this.pannerNode.setPosition(x, y, z);
            }
        } catch (e) {
            console.warn('[SpatialAudio] Failed to update position:', e);
        }
    }

    /**
     * Apply a preset position
     */
    applyPreset(presetKey) {
        const preset = this.presets[presetKey];
        if (!preset) return false;

        spatialAudioSettings.setPreset(presetKey);

        // Stop any ongoing animation
        this.stopAnimation();

        if (preset.animated) {
            // Start animation for dynamic presets
            this.startAnimation(presetKey);
        } else {
            // Set static position
            this.setPosition(preset.x, preset.y, preset.z);
        }

        return true;
    }

    /**
     * Start spatial audio animation
     */
    startAnimation(type = 'surround') {
        this.stopAnimation(); // Stop any existing animation

        this.animationStartTime = Date.now();

        const animate = () => {
            if (!this.isEnabled) {
                this.stopAnimation();
                return;
            }

            const elapsed = (Date.now() - this.animationStartTime) / 1000; // seconds

            if (type === 'surround') {
                // Circular motion around the listener
                const radius = 3;
                const speed = 0.5; // rotations per second
                const angle = elapsed * speed * 2 * Math.PI;

                const x = Math.cos(angle) * radius;
                const z = Math.sin(angle) * radius;

                this.position = { x, y: 0, z };
                this._updatePannerPosition();
            }

            this.animationId = requestAnimationFrame(animate);
        };

        this.animationId = requestAnimationFrame(animate);
    }

    /**
     * Stop spatial audio animation
     */
    stopAnimation() {
        if (this.animationId) {
            cancelAnimationFrame(this.animationId);
            this.animationId = null;
            this.animationStartTime = null;
        }
    }

    /**
     * Set room size for spatial effect
     */
    setRoomSize(size) {
        this.roomSize = Math.max(0, Math.min(100, size));
        spatialAudioSettings.setRoomSize(this.roomSize);

        if (this.pannerNode) {
            // Adjust distance model based on room size
            const scale = this.roomSize / 50; // Normalize to 0-2
            this.pannerNode.maxDistance = 1000 + (this.roomSize * 100);
            this.pannerNode.refDistance = 1 * scale;
        }
    }

    /**
     * Get current room size
     */
    getRoomSize() {
        return this.roomSize;
    }

    /**
     * Get current position
     */
    getPosition() {
        return { ...this.position };
    }

    /**
     * Get available presets
     */
    getPresets() {
        return { ...this.presets };
    }

    /**
     * Load settings from storage
     */
    _loadSettings() {
        this.isEnabled = spatialAudioSettings.isEnabled();
        this.position = spatialAudioSettings.getPosition();
        this.roomSize = spatialAudioSettings.getRoomSize();
        this.reverbEnabled = spatialAudioSettings.getReverbEnabled();
    }

    /**
     * Reset to default position
     */
    reset() {
        this.stopAnimation();
        this.setPosition(0, 0, 0);
        spatialAudioSettings.setPreset('center');
    }
}

// Export singleton instance
export const spatialAudioManager = new SpatialAudioManager();
