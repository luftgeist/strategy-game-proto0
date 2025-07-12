class AudioManager {
    constructor() {
        this.audioContext = new (window.AudioContext || window.webkitAudioContext)();
        this.buffers = new Map(); // Stores loaded audio buffers by buffer ID
        this.channels = new Map(); // Stores active channels
        this.spatialSources = new Map(); // Stores spatial sound sources by source ID
        this.positions = new Map(); // Stores positions of spatial sources by source ID
        this.listenerPosition = { x: 0, y: 0, zoomFactor: 1.0 };
        this.nextSpatialId = 1; // Counter for generating unique spatial source IDs
        
        // Default crossfade time in seconds
        this.defaultFadeTime = 2;
        
        // Spatial audio properties
        this.MAX_DISTANCE = 600;
        this.MIN_VOLUME = 0.001;
        this.MAX_VOLUME = 1;
        
        // Zoom factor limits
        this.MIN_ZOOM = 0.1;  // When zoomed way out
        this.MAX_ZOOM = 5.0;  // When zoomed way in

        this.previousVolume = 1.0;

        const originalDestination = this.audioContext.destination;
  
        // Create master gain node
        this.masterGainNode = this.audioContext.createGain();
        this.masterGainNode.gain.value = 1.0; // Initial volume at 100%
        
        // Connect master gain to the actual destination
        this.masterGainNode.connect(originalDestination);
        
        // Override the destination property
        Object.defineProperty(this.audioContext, 'destination', {
            get: () => this.masterGainNode,
            configurable: true
        });
    }

    // Load an audio file and store its buffer
    async loadSound(bufferId, filename) {
        try {
            const response = await fetch(`/assets/a/${filename}`);
            const arrayBuffer = await response.arrayBuffer();
            const audioBuffer = await this.audioContext.decodeAudioData(arrayBuffer);
            this.buffers.set(bufferId, {
                type: 'buffer',
                buffer: audioBuffer,
                duration: audioBuffer.duration
            });
            return audioBuffer;
        } catch (error) {
            console.error(`Error loading sound ${bufferId}:`, error);
            return null;
        }
    }

    // Initialize all audio files
    async init0() {
        await Promise.all([
            this.loadSound('button0', 's/clicky button 3.wav'),
            this.loadSound('button1', 's/clicky button 4.wav'),
            this.loadSound('button2', 's/clicky button 9.wav'),
            this.loadSound('desert_ambiance', 'desertambiance.opus'),
            this.loadSound('music', 'm/ripped_settlers_music.m4a'),
            //this.loadSound('music', 'm/Journey_Acient_Sands.mp3')
        ]);
    }

    async init1() {
        await Promise.all([
            this.loadSound('sawing', 's/sawing.opus'),
            this.loadSound('hammering', 's/hammer.opus')
        ]);
        this.createLayeredSound('building', ['sawing', 'hammering']);
    }


    // Set master volume (0-1)
    setMasterVolume(volume) {
        this.previousVolume = volume; // Save for unmute
        this.masterGainNode.gain.setValueAtTime(
            volume, 
            this.audioContext.currentTime
        );
    }
    
    // Mute all audio
    mute() {
        // Save current volume before muting
        this.previousVolume = this.masterGainNode.gain.value;
        this.masterGainNode.gain.setValueAtTime(0, this.audioContext.currentTime);
    }
    
    // Unmute and restore to previous volume
    unmute() {
        this.masterGainNode.gain.setValueAtTime(
        this.previousVolume, 
        this.audioContext.currentTime
        );
    }

    // Create a sound group with variations (for random or sequential playback)
    createSoundGroup(groupId, bufferIds, options = {}) {
        // Verify all bufferIds exist
        for (const id of bufferIds) {
            if (!this.buffers.has(id)) {
                console.error(`Cannot create group ${groupId}: Buffer ${id} not found`);
                return null;
            }
        }
        
        const playbackMode = options.playbackMode || 'random'; // 'random', 'sequence', 'shuffle'
        
        this.buffers.set(groupId, {
            type: 'group',
            variations: bufferIds,
            playbackMode: playbackMode,
            currentIndex: 0,
            volumes: options.volumes || bufferIds.map(() => 1.0),
            playbackRates: options.playbackRates || bufferIds.map(() => 1.0),
            offsets: options.offsets || bufferIds.map(() => 0) // Start offsets in seconds
        });
        return groupId;
    }
    
    // Create a sequence of sounds that play one after another
    createSoundSequence(sequenceId, bufferIds, options = {}) {
        // Verify all bufferIds exist
        for (const id of bufferIds) {
            if (!this.buffers.has(id)) {
                console.error(`Cannot create sequence ${sequenceId}: Buffer ${id} not found`);
                return null;
            }
        }
        
        this.buffers.set(sequenceId, {
            type: 'sequence',
            sounds: bufferIds,
            gaps: options.gaps || Array(bufferIds.length - 1).fill(0), // Gaps between sounds in ms
            volumes: options.volumes || bufferIds.map(() => 1.0),
            playbackRates: options.playbackRates || bufferIds.map(() => 1.0),
            offsets: options.offsets || bufferIds.map(() => 0), // Start offsets in seconds
            loop: options.loop !== undefined ? options.loop : true
        });
        
        
        return sequenceId;
    }
    
    // Create layered sounds that play simultaneously
    createLayeredSound(layerId, bufferIds, options = {}) {
        // Verify all bufferIds exist
        for (const id of bufferIds) {
            if (!this.buffers.has(id)) {
                console.error(`Cannot create layered sound ${layerId}: Buffer ${id} not found`);
                return null;
            }
        }
        
        this.buffers.set(layerId, {
            type: 'layered',
            sounds: bufferIds,
            volumes: options.volumes || bufferIds.map(() => 1.0),
            playbackRates: options.playbackRates || bufferIds.map(() => 1.0),
            offsets: options.offsets || bufferIds.map(() => 0) // Start offsets in seconds
        });
        
        
        return layerId;
    }

    // Generate a unique spatial source ID
    generateSpatialId(prefix = 'spatial') {
        return `${prefix}_${this.nextSpatialId++}`;
    }

    // Create a custom looping source with pause between iterations
    createLoopingSource(buffer, loopPauseMs = 0) {
        // If no pause requested, use the built-in looping
        if (loopPauseMs <= 0) {
            const source = this.audioContext.createBufferSource();
            source.buffer = buffer;
            source.loop = true;
            return source;
        }
        
        // For custom looping with pause, we need to manage it ourselves
        const source = this.audioContext.createBufferSource();
        source.buffer = buffer;
        source.loop = false; // We'll handle looping manually
        
        // Object to hold our custom looping state
        const loopState = {
            isActive: true,
            source: source,
            buffer: buffer,
            pauseMs: loopPauseMs,
            gainNode: null,
            timerId: null
        };
        
        // Function to schedule the next loop iteration
        const scheduleNextLoop = () => {
            if (!loopState.isActive) return;
            
            const pauseSec = loopState.pauseMs / 1000;
            const bufferDuration = buffer.duration;
            
            // Schedule the next iteration after the current one finishes plus the pause
            loopState.timerId = setTimeout(() => {
                if (!loopState.isActive) return;
                
                // Create a new source for the next iteration
                const nextSource = this.audioContext.createBufferSource();
                nextSource.buffer = loopState.buffer;
                nextSource.loop = false;
                
                // Connect it to the same gain node
                if (loopState.gainNode) {
                    nextSource.connect(loopState.gainNode);
                }
                
                // Setup the next iteration
                nextSource.onended = () => scheduleNextLoop();
                
                // Start the source
                nextSource.start(0);
                
                // Update the loop state with the new source
                loopState.source = nextSource;
            }, (bufferDuration + pauseSec) * 1000);
        };
        
        // Start the loop cycle when the first playback ends
        source.onended = () => scheduleNextLoop();
        
        // Add stop method to our custom looping source
        source.customStop = () => {
            loopState.isActive = false;
            if (loopState.timerId) {
                clearTimeout(loopState.timerId);
            }
            try {
                source.stop();
            } catch (e) {
                // Ignore if already stopped
            }
        };
        
        // Store the gain node reference for later connections
        source.setGainNode = (gainNode) => {
            loopState.gainNode = gainNode;
        };
        
        return source;
    }

    // Get buffer from complex sound types or regular buffer
    _getBuffer(soundId) {
        const bufferData = this.buffers.get(soundId);
        if (!bufferData) return null;
        
        if (bufferData.type === 'buffer') {
            return bufferData.buffer;
        }
        
        return null; // For complex types, we don't directly return a buffer
    }
    
    // Resolve which sound to play from a group
    _resolveGroupSound(groupData) {
        const { variations, playbackMode, volumes, playbackRates, offsets } = groupData;
        let index = 0;
        
        if (playbackMode === 'random') {
            index = Math.floor(Math.random() * variations.length);
        } else if (playbackMode === 'sequence') {
            index = groupData.currentIndex;
            groupData.currentIndex = (groupData.currentIndex + 1) % variations.length;
        } else if (playbackMode === 'shuffle') {
            // Fisher-Yates shuffle if we've gone through all sounds
            if (!groupData.shuffledIndices || groupData.currentShuffleIndex >= variations.length) {
                groupData.shuffledIndices = [...Array(variations.length).keys()];
                for (let i = groupData.shuffledIndices.length - 1; i > 0; i--) {
                    const j = Math.floor(Math.random() * (i + 1));
                    [groupData.shuffledIndices[i], groupData.shuffledIndices[j]] = 
                    [groupData.shuffledIndices[j], groupData.shuffledIndices[i]];
                }
                groupData.currentShuffleIndex = 0;
            }
            
            index = groupData.shuffledIndices[groupData.currentShuffleIndex];
            groupData.currentShuffleIndex++;
        }
        
        const bufferId = variations[index];
        const bufferData = this.buffers.get(bufferId);
        
        if (!bufferData) {
            console.error(`Failed to resolve group sound: Buffer ${bufferId} not found`);
            return null;
        }
        
        return {
            buffer: bufferData.type === 'buffer' ? bufferData.buffer : null,
            bufferId,
            volume: volumes[index] || 1.0,
            playbackRate: playbackRates[index] || 1.0,
            offset: offsets[index] || 0
        };
    }

    // Play a sound on a specific channel with crossfade
    playOnChannel(channelId, soundId, options = {}) {
        const bufferData = this.buffers.get(soundId);
        if (!bufferData) {
            console.error(`No buffer found for sound ${soundId}`);
            return null;
        }

        const volume = options.volume !== undefined ? options.volume : 0.5;
        const loop = options.loop !== undefined ? options.loop : true;
        const loopPauseMs = options.loopPauseMs !== undefined ? options.loopPauseMs : 0;
        const fadeTime = options.fadeTime !== undefined ? options.fadeTime : this.defaultFadeTime;
        const playbackRate = options.playbackRate !== undefined ? options.playbackRate : 1.0;
        const offset = options.offset !== undefined ? options.offset : 0;

        // Handle different sound types
        if (bufferData.type === 'group') {
            return this._playGroupOnChannel(channelId, soundId, bufferData, {
                ...options,
                baseVolume: volume,
                loop,
                loopPauseMs,
                fadeTime
            });
        } else if (bufferData.type === 'sequence') {
            return this._playSequenceOnChannel(channelId, soundId, bufferData, {
                ...options,
                baseVolume: volume,
                fadeTime
            });
        } else if (bufferData.type === 'layered') {
            return this._playLayeredOnChannel(channelId, soundId, bufferData, {
                ...options,
                baseVolume: volume,
                loop,
                loopPauseMs,
                fadeTime
            });
        }

        // Handle regular buffer
        const buffer = bufferData.buffer;
        
        // Create new source
        const source = this.createLoopingSource(buffer, loop ? loopPauseMs : 0);
        if (!loop) {
            source.loop = false;
        }
        
        // Set playback rate
        source.playbackRate.value = playbackRate;

        // Create gain node for volume control
        const gainNode = this.audioContext.createGain();
        
        // If we have a custom looping source, tell it about our gain node
        if (source.setGainNode) {
            source.setGainNode(gainNode);
        }
        
        // Start at zero volume and connect
        gainNode.gain.setValueAtTime(0, this.audioContext.currentTime);
        source.connect(gainNode);
        gainNode.connect(this.audioContext.destination);

        // Create new sound object for this channel
        const newSound = {
            id: soundId,
            source,
            gainNode,
            targetVolume: volume,
            loopPauseMs,
            type: 'buffer'
        };

        // If there's already a sound on this channel, fade it out
        if (this.channels.has(channelId)) {
            const currentSound = this.channels.get(channelId);
            
            // Fade out current sound
            currentSound.gainNode.gain.setValueAtTime(
                currentSound.gainNode.gain.value, 
                this.audioContext.currentTime
            );
            currentSound.gainNode.gain.linearRampToValueAtTime(
                0, 
                this.audioContext.currentTime + fadeTime
            );

            // Schedule the current sound to stop after fade out
            setTimeout(() => {
                try {
                    if (currentSound.source.customStop) {
                        currentSound.source.customStop();
                    } else {
                        currentSound.source.stop();
                    }
                    
                    // Also stop any sequence timers
                    if (currentSound.sequenceTimers) {
                        currentSound.sequenceTimers.forEach(timer => clearTimeout(timer));
                    }
                } catch (e) {
                    // Ignore errors if already stopped
                }
            }, fadeTime * 1000);

            
        } else {
            
        }

        // Fade in new sound
        gainNode.gain.linearRampToValueAtTime(
            volume, 
            this.audioContext.currentTime + fadeTime
        );

        // Start playback with optional offset
        source.start(0, offset);

        // Set as current sound on this channel
        this.channels.set(channelId, newSound);
        
        return newSound;
    }
    
    // Play a group sound on a channel
    _playGroupOnChannel(channelId, soundId, groupData, options) {
        const resolvedSound = this._resolveGroupSound(groupData);
        if (!resolvedSound || !resolvedSound.buffer) {
            return null;
        }
        
        // Play the resolved buffer with merged options
        return this.playOnChannel(channelId, resolvedSound.bufferId, {
            ...options,
            volume: resolvedSound.volume * options.baseVolume,
            playbackRate: resolvedSound.playbackRate * (options.playbackRate || 1.0),
            offset: resolvedSound.offset + (options.offset || 0)
        });
    }
    
    // Play a sequence of sounds on a channel
    _playSequenceOnChannel(channelId, sequenceId, sequenceData, options) {
        const { sounds, gaps, volumes, playbackRates, offsets, loop } = sequenceData;
        const baseVolume = options.baseVolume || 1.0;
        const fadeTime = options.fadeTime || this.defaultFadeTime;
        
        // Use the loop option from sequenceData unless overriden
        const shouldLoop = options.loop !== undefined ? options.loop : loop;
        
        // We need to create a tracking object for the sequence
        const sequenceState = {
            id: sequenceId,
            type: 'sequence',
            currentIndex: 0,
            sequenceTimers: [],
            targetVolume: baseVolume,
            gainNode: null
        };
        
        // Buffer for the first sound in the sequence
        const firstBufferId = sounds[0];
        const firstBufferData = this.buffers.get(firstBufferId);
        
        if (!firstBufferData || firstBufferData.type !== 'buffer') {
            console.error(`Invalid first sound in sequence ${sequenceId}`);
            return null;
        }
        
        // Create gain node for the entire sequence
        const masterGainNode = this.audioContext.createGain();
        masterGainNode.gain.setValueAtTime(0, this.audioContext.currentTime);
        masterGainNode.connect(this.audioContext.destination);
        
        // Store the gain node in the sequence state
        sequenceState.gainNode = masterGainNode;
        
        // If there's already a sound on this channel, fade it out
        if (this.channels.has(channelId)) {
            const currentSound = this.channels.get(channelId);
            
            // Fade out current sound
            currentSound.gainNode.gain.setValueAtTime(
                currentSound.gainNode.gain.value, 
                this.audioContext.currentTime
            );
            currentSound.gainNode.gain.linearRampToValueAtTime(
                0, 
                this.audioContext.currentTime + fadeTime
            );

            // Schedule the current sound to stop after fade out
            setTimeout(() => {
                try {
                    if (currentSound.source) {
                        if (currentSound.source.customStop) {
                            currentSound.source.customStop();
                        } else {
                            currentSound.source.stop();
                        }
                    }
                    
                    // Also stop any sequence timers
                    if (currentSound.sequenceTimers) {
                        currentSound.sequenceTimers.forEach(timer => clearTimeout(timer));
                    }
                } catch (e) {
                    // Ignore errors if already stopped
                }
            }, fadeTime * 1000);
        }
        
        // Fade in the master gain
        masterGainNode.gain.linearRampToValueAtTime(
            baseVolume, 
            this.audioContext.currentTime + fadeTime
        );
        
        // Function to play the next sound in the sequence
        const playNextInSequence = (index) => {
            if (index >= sounds.length) {
                if (shouldLoop) {
                    // Start over if looping
                    sequenceState.currentIndex = 0;
                    playNextInSequence(0);
                }
                return;
            }
            
            sequenceState.currentIndex = index;
            const bufferId = sounds[index];
            const bufferData = this.buffers.get(bufferId);
            
            if (!bufferData || bufferData.type !== 'buffer') {
                console.error(`Invalid sound at index ${index} in sequence ${sequenceId}`);
                return;
            }
            
            // Create source for this part of the sequence
            const source = this.audioContext.createBufferSource();
            source.buffer = bufferData.buffer;
            
            // Set playback rate
            source.playbackRate.value = playbackRates[index] || 1.0;
            
            // Create individual gain for this source in the sequence
            const sourceGain = this.audioContext.createGain();
            sourceGain.gain.value = volumes[index] || 1.0;
            
            // Connect to the master gain
            source.connect(sourceGain);
            sourceGain.connect(masterGainNode);
            
            // Play the sound with offset
            source.start(0, offsets[index] || 0);
            
            // Calculate when to schedule the next sound
            const currentDuration = bufferData.buffer.duration;
            const gap = gaps[index] || 0;
            const totalDuration = (currentDuration * 1000) + gap;
            
            // Schedule the next sound after this one finishes plus any gap
            if (index < sounds.length - 1 || shouldLoop) {
                const timer = setTimeout(() => {
                    playNextInSequence((index + 1) % sounds.length);
                }, totalDuration);
                
                sequenceState.sequenceTimers.push(timer);
            }
        };
        
        // Start playing the sequence
        playNextInSequence(0);
        
        // Store the sequence as the sound on this channel
        this.channels.set(channelId, sequenceState);
        
        return sequenceState;
    }
    
    // Play layered sounds on a channel
    _playLayeredOnChannel(channelId, layerId, layerData, options) {
        const { sounds, volumes, playbackRates, offsets } = layerData;
        const baseVolume = options.baseVolume || 1.0;
        const loop = options.loop !== undefined ? options.loop : true;
        const loopPauseMs = options.loopPauseMs || 0;
        const fadeTime = options.fadeTime || this.defaultFadeTime;
        
        // Create master gain node
        const masterGainNode = this.audioContext.createGain();
        masterGainNode.gain.setValueAtTime(0, this.audioContext.currentTime);
        masterGainNode.connect(this.audioContext.destination);
        
        // Create sources for each layer
        const sources = [];
        const sourceGains = [];
        
        for (let i = 0; i < sounds.length; i++) {
            const bufferId = sounds[i];
            const bufferData = this.buffers.get(bufferId);
            
            if (!bufferData || bufferData.type !== 'buffer') {
                console.error(`Invalid sound at index ${i} in layered sound ${layerId}`);
                continue;
            }
            
            const buffer = bufferData.buffer;
            
            // Create source for this layer
            const source = loop && loopPauseMs > 0 ? 
                this.createLoopingSource(buffer, loopPauseMs) : 
                this.audioContext.createBufferSource();
                
            source.buffer = buffer;
            source.loop = loop && loopPauseMs === 0; // Use built-in looping if no pause
            source.playbackRate.value = playbackRates[i] || 1.0;
            
            // Create gain for this layer
            const sourceGain = this.audioContext.createGain();
            sourceGain.gain.value = volumes[i] || 1.0;
            
            // Connect layer to master
            source.connect(sourceGain);
            sourceGain.connect(masterGainNode);
            
            // Start the source with offset
            source.start(0, offsets[i] || 0);
            
            // Store for later
            sources.push(source);
            sourceGains.push(sourceGain);
            
            // If we have a custom looping source, tell it about its gain node
            if (source.setGainNode) {
                source.setGainNode(sourceGain);
            }
        }
        
        // Create layered sound object
        const layeredSound = {
            id: layerId,
            type: 'layered',
            sources,
            sourceGains,
            gainNode: masterGainNode,
            targetVolume: baseVolume
        };
        
        // If there's already a sound on this channel, fade it out
        if (this.channels.has(channelId)) {
            const currentSound = this.channels.get(channelId);
            
            // Fade out current sound
            currentSound.gainNode.gain.setValueAtTime(
                currentSound.gainNode.gain.value, 
                this.audioContext.currentTime
            );
            currentSound.gainNode.gain.linearRampToValueAtTime(
                0, 
                this.audioContext.currentTime + fadeTime
            );

            // Schedule the current sound to stop after fade out
            setTimeout(() => {
                try {
                    if (currentSound.type === 'layered') {
                        // Stop all layer sources
                        currentSound.sources.forEach(source => {
                            if (source.customStop) {
                                source.customStop();
                            } else {
                                source.stop();
                            }
                        });
                    } else if (currentSound.source) {
                        if (currentSound.source.customStop) {
                            currentSound.source.customStop();
                        } else {
                            currentSound.source.stop();
                        }
                    }
                    
                    // Also stop any sequence timers
                    if (currentSound.sequenceTimers) {
                        currentSound.sequenceTimers.forEach(timer => clearTimeout(timer));
                    }
                } catch (e) {
                    // Ignore errors if already stopped
                }
            }, fadeTime * 1000);
        }
        
        // Fade in the layered sound
        masterGainNode.gain.linearRampToValueAtTime(
            baseVolume, 
            this.audioContext.currentTime + fadeTime
        );
        
        // Store on channel
        this.channels.set(channelId, layeredSound);
        
        return layeredSound;
    }

    // Stop a channel with fade out
    stopChannel(channelId, fadeTime = this.defaultFadeTime) {
        if (!this.channels.has(channelId)) return;

        const sound = this.channels.get(channelId);
        
        // Fade out
        sound.gainNode.gain.setValueAtTime(
            sound.gainNode.gain.value, 
            this.audioContext.currentTime
        );
        sound.gainNode.gain.linearRampToValueAtTime(
            0, 
            this.audioContext.currentTime + fadeTime
        );

        // Schedule stop
        setTimeout(() => {
            try {
                if (sound.type === 'layered') {
                    // Stop all layer sources
                    sound.sources.forEach(source => {
                        if (source.customStop) {
                            source.customStop();
                        } else {
                            source.stop();
                        }
                    });
                } else if (sound.source) {
                    if (sound.source.customStop) {
                        sound.source.customStop();
                    } else {
                        sound.source.stop();
                    }
                }
                
                // Also clear any sequence timers
                if (sound.sequenceTimers) {
                    sound.sequenceTimers.forEach(timer => clearTimeout(timer));
                }
            } catch (e) {
                // Ignore errors if already stopped
            }
        }, fadeTime * 1000);

        this.channels.delete(channelId);
        
    }

    // Set the volume of a channel (with optional fade)
    setChannelVolume(channelId, volume, fadeTime = 0) {
        if (!this.channels.has(channelId)) return;

        const sound = this.channels.get(channelId);
        sound.targetVolume = volume;
        
        if (fadeTime > 0) {
            sound.gainNode.gain.setValueAtTime(
                sound.gainNode.gain.value, 
                this.audioContext.currentTime
            );
            sound.gainNode.gain.linearRampToValueAtTime(
                volume, 
                this.audioContext.currentTime + fadeTime
            );
        } else {
            sound.gainNode.gain.setValueAtTime(volume, this.audioContext.currentTime);
        }
    }

    // Create a spatial audio source
    createSpatialSource(soundId, x, y, options = {}) {
        const bufferData = this.buffers.get(soundId);
        if (!bufferData) {
            console.error(`No buffer found for sound ${soundId}`);
            return null;
        }
        
        const sourceId = options.sourceId || this.generateSpatialId(`${soundId}`);
        const volume = options.volume !== undefined ? options.volume : 0.5;
        const loop = options.loop !== undefined ? options.loop : true;
        const loopPauseMs = options.loopPauseMs !== undefined ? options.loopPauseMs : 0;
        const playbackRate = options.playbackRate !== undefined ? options.playbackRate : 1.0;
        const offset = options.offset !== undefined ? options.offset : 0;

        // Handle different sound types
        if (bufferData.type === 'group') {
            return this._createSpatialGroupSource(soundId, bufferData, x, y, {
                ...options,
                sourceId,
                baseVolume: volume
            });
        } else if (bufferData.type === 'sequence') {
            return this._createSpatialSequenceSource(soundId, bufferData, x, y, {
                ...options,
                sourceId,
                baseVolume: volume
            });
        } else if (bufferData.type === 'layered') {
            return this._createSpatialLayeredSource(soundId, bufferData, x, y, {
                ...options,
                sourceId,
                baseVolume: volume
            });
        }

        // For regular buffer
        const buffer = bufferData.buffer;

        // Create source node with potential pause between loops
        const source = this.createLoopingSource(buffer, loop ? loopPauseMs : 0);
        if (!loop) {
            source.loop = false;
        }
        
        // Set playback rate
        source.playbackRate.value = playbackRate;

        // Create gain node for volume control
        const gainNode = this.audioContext.createGain();
        gainNode.gain.setValueAtTime(0, this.audioContext.currentTime);
        
        // If we have a custom looping source, tell it about our gain node
        if (source.setGainNode) {
            source.setGainNode(gainNode);
        }

        // Connect nodes
        source.connect(gainNode);
        gainNode.connect(this.audioContext.destination);

        // Store source data
        const sourceData = {
            id: sourceId,
            bufferId: soundId,
            source,
            gainNode,
            baseVolume: volume,
            loopPauseMs,
            type: 'buffer'
        };
        
        this.spatialSources.set(sourceId, sourceData);

        // Store position
        this.positions.set(sourceId, { x, y });

        // Start playback with optional offset
        source.start(0, offset);

        
        return sourceData;
    }
    
    // Create a spatial source from a group
    _createSpatialGroupSource(groupId, groupData, x, y, options) {
        const resolvedSound = this._resolveGroupSound(groupData);
        if (!resolvedSound || !resolvedSound.buffer) {
            return null;
        }
        
        // Create spatial source with the resolved sound
        return this.createSpatialSource(resolvedSound.bufferId, x, y, {
            ...options,
            volume: resolvedSound.volume * options.baseVolume,
            playbackRate: resolvedSound.playbackRate * (options.playbackRate || 1.0),
            offset: resolvedSound.offset + (options.offset || 0)
        });
    }
    
    // Create a spatial source from a sequence
    _createSpatialSequenceSource(sequenceId, sequenceData, x, y, options) {
        const { sounds, gaps, volumes, playbackRates, offsets, loop } = sequenceData;
        const sourceId = options.sourceId || this.generateSpatialId(`${sequenceId}`);
        const baseVolume = options.baseVolume || 1.0;
        
        // Use the loop option from sequenceData unless overriden
        const shouldLoop = options.loop !== undefined ? options.loop : loop;
        
        // We need to create a tracking object for the sequence
        const sequenceState = {
            id: sourceId,
            bufferId: sequenceId,
            type: 'sequence',
            currentIndex: 0,
            sequenceTimers: [],
            baseVolume: baseVolume,
            gainNode: null
        };
        
        // Create master gain node for the sequence
        const masterGainNode = this.audioContext.createGain();
        masterGainNode.gain.setValueAtTime(0, this.audioContext.currentTime);
        masterGainNode.connect(this.audioContext.destination);
        
        // Store the gain node in the sequence state
        sequenceState.gainNode = masterGainNode;
        
        // Function to play the next sound in the sequence
        const playNextInSequence = (index) => {
            if (index >= sounds.length) {
                if (shouldLoop) {
                    // Start over if looping
                    sequenceState.currentIndex = 0;
                    playNextInSequence(0);
                }
                return;
            }
            
            sequenceState.currentIndex = index;
            const bufferId = sounds[index];
            const bufferData = this.buffers.get(bufferId);
            
            if (!bufferData || bufferData.type !== 'buffer') {
                console.error(`Invalid sound at index ${index} in sequence ${sequenceId}`);
                return;
            }
            
            // Create source for this part of the sequence
            const source = this.audioContext.createBufferSource();
            source.buffer = bufferData.buffer;
            
            // Set playback rate
            source.playbackRate.value = playbackRates[index] || 1.0;
            
            // Create individual gain for this source in the sequence
            const sourceGain = this.audioContext.createGain();
            sourceGain.gain.value = volumes[index] || 1.0;
            
            // Connect to the master gain
            source.connect(sourceGain);
            sourceGain.connect(masterGainNode);
            
            // Play the sound with offset
            source.start(0, offsets[index] || 0);
            
            // Calculate when to schedule the next sound
            const currentDuration = bufferData.buffer.duration;
            const gap = gaps[index] || 0;
            const totalDuration = (currentDuration * 1000) + gap;
            
            // Schedule the next sound after this one finishes plus any gap
            if (index < sounds.length - 1 || shouldLoop) {
                const timer = setTimeout(() => {
                    playNextInSequence((index + 1) % sounds.length);
                }, totalDuration);
                
                sequenceState.sequenceTimers.push(timer);
            }
        };
        
        // Store position
        this.positions.set(sourceId, { x, y });
        
        // Store the sequence as a spatial source
        this.spatialSources.set(sourceId, sequenceState);
        
        // Start with zero volume, will be updated by spatial calculations
        masterGainNode.gain.setValueAtTime(0, this.audioContext.currentTime);
        
        // Start playing the sequence
        playNextInSequence(0);
        
        // Update volume based on position
        this.updateAllSpatialVolumes();
        
        
        return sequenceState;
    }
    
    // Create a spatial source from layered sounds
    _createSpatialLayeredSource(layerId, layerData, x, y, options) {
        const { sounds, volumes, playbackRates, offsets } = layerData;
        const sourceId = options.sourceId || this.generateSpatialId(`${layerId}`);
        const baseVolume = options.baseVolume || 1.0;
        const loop = options.loop !== undefined ? options.loop : true;
        const loopPauseMs = options.loopPauseMs || 0;
        
        // Create master gain node
        const masterGainNode = this.audioContext.createGain();
        masterGainNode.gain.setValueAtTime(0, this.audioContext.currentTime);
        masterGainNode.connect(this.audioContext.destination);
        
        // Create sources for each layer
        const sources = [];
        const sourceGains = [];
        
        for (let i = 0; i < sounds.length; i++) {
            const bufferId = sounds[i];
            const bufferData = this.buffers.get(bufferId);
            
            if (!bufferData || bufferData.type !== 'buffer') {
                console.error(`Invalid sound at index ${i} in layered sound ${layerId}`);
                continue;
            }
            
            const buffer = bufferData.buffer;
            
            // Create source for this layer
            const source = loop && loopPauseMs > 0 ? 
                this.createLoopingSource(buffer, loopPauseMs) : 
                this.audioContext.createBufferSource();
                
            source.buffer = buffer;
            source.loop = loop && loopPauseMs === 0; // Use built-in looping if no pause
            source.playbackRate.value = playbackRates[i] || 1.0;
            
            // Create gain for this layer
            const sourceGain = this.audioContext.createGain();
            sourceGain.gain.value = volumes[i] || 1.0;
            
            // Connect layer to master
            source.connect(sourceGain);
            sourceGain.connect(masterGainNode);
            
            // Start the source with offset
            source.start(0, offsets[i] || 0);
            
            // Store for later
            sources.push(source);
            sourceGains.push(sourceGain);
            
            // If we have a custom looping source, tell it about its gain node
            if (source.setGainNode) {
                source.setGainNode(sourceGain);
            }
        }
        
        // Create layered sound object
        const layeredSound = {
            id: sourceId,
            bufferId: layerId,
            type: 'layered',
            sources,
            sourceGains,
            gainNode: masterGainNode,
            baseVolume
        };
        
        // Store position
        this.positions.set(sourceId, { x, y });
        
        // Store as spatial source
        this.spatialSources.set(sourceId, layeredSound);
        
        // Update volume based on position
        this.updateAllSpatialVolumes();
        
        

        return layeredSound;
    }
    
    // Update position of a spatial audio source
    updateSourcePosition(sourceId, x, y) {
        if (!this.spatialSources.has(sourceId)) {
            console.error(`No spatial source found with ID ${sourceId}`);
            return false;
        }
        
        // Update the position
        this.positions.set(sourceId, { x, y });
        
        // Recalculate volume based on new position
        this.updateAllSpatialVolumes();
        
        
        return true;
    }
    
    // Get all spatial sources using a specific buffer ID
    getSpatialSourcesByBuffer(bufferId) {
        const sources = [];
        this.spatialSources.forEach((sourceData, sourceId) => {
            if (sourceData.bufferId === bufferId) {
                sources.push({
                    sourceId,
                    position: this.positions.get(sourceId),
                    ...sourceData
                });
            }
        });
        return sources;
    }

    // Update listener position with optional zoom factor
    updateListenerPosition(x, y, zoomFactor = null) {
        this.listenerPosition.x = x;
        this.listenerPosition.y = y;
        
        // Update zoom factor if provided
        if (zoomFactor !== null) {
            // Clamp zoom factor between min and max values
            this.listenerPosition.zoomFactor = Math.max(
                this.MIN_ZOOM, 
                Math.min(zoomFactor, this.MAX_ZOOM)
            );
        }
        
        this.updateAllSpatialVolumes();
    }
    
    // Set just the zoom factor
    setZoomFactor(zoomFactor) {
        this.listenerPosition.zoomFactor = Math.max(
            this.MIN_ZOOM, 
            Math.min(zoomFactor, this.MAX_ZOOM)
        );
        this.updateAllSpatialVolumes();
    }

    // Calculate volume based on distance and zoom factor
    calculateVolume(sourcePos) {
        const dx = sourcePos.x - this.listenerPosition.x;
        const dy = sourcePos.y - this.listenerPosition.y;
        const distance = Math.sqrt(dx * dx + dy * dy);
        
        // Adjust distance based on zoom factor - when zoomed in (high zoomFactor),
        // sounds seem closer (reduced effective distance)
        const adjustedDistance = distance / this.listenerPosition.zoomFactor;
        
        if (adjustedDistance >= this.MAX_DISTANCE) return this.MIN_VOLUME;
        if (adjustedDistance <= 0) return this.MAX_VOLUME;
        
        return this.MAX_VOLUME - (adjustedDistance / this.MAX_DISTANCE) * (this.MAX_VOLUME - this.MIN_VOLUME);
    }

    // Update volumes for all spatial sources
    updateAllSpatialVolumes() {
        this.spatialSources.forEach((sourceData, sourceId) => {
            const position = this.positions.get(sourceId);
            if (position) {
                const volume = this.calculateVolume(position) * sourceData.baseVolume;
                sourceData.gainNode.gain.setValueAtTime(volume, this.audioContext.currentTime);
            }
        });
    }

    // Stop a specific spatial source
    stopSpatialSource(sourceId) {
        const sourceData = this.spatialSources.get(sourceId);
        if (!sourceData) return false;

        try {
            if (sourceData.type === 'layered') {
                // Stop all layer sources
                sourceData.sources.forEach(source => {
                    if (source.customStop) {
                        source.customStop();
                    } else {
                        source.stop();
                    }
                });
            } else if (sourceData.type === 'sequence') {
                // Clear sequence timers
                if (sourceData.sequenceTimers) {
                    sourceData.sequenceTimers.forEach(timer => clearTimeout(timer));
                }
            } else if (sourceData.source) {
                if (sourceData.source.customStop) {
                    sourceData.source.customStop();
                } else {
                    sourceData.source.stop();
                }
            }
        } catch (error) {
            console.warn(`Error stopping spatial source ${sourceId}:`, error);
        }

        this.spatialSources.delete(sourceId);
        this.positions.delete(sourceId);
        
        
        return true;
    }

    // Stop all spatial sources
    stopAllSpatialSources() {
        this.spatialSources.forEach((sourceData, sourceId) => {
            try {
                if (sourceData.type === 'layered') {
                    // Stop all layer sources
                    sourceData.sources.forEach(source => {
                        if (source.customStop) {
                            source.customStop();
                        } else {
                            source.stop();
                        }
                    });
                } else if (sourceData.type === 'sequence') {
                    // Clear sequence timers
                    if (sourceData.sequenceTimers) {
                        sourceData.sequenceTimers.forEach(timer => clearTimeout(timer));
                    }
                } else if (sourceData.source) {
                    if (sourceData.source.customStop) {
                        sourceData.source.customStop();
                    } else {
                        sourceData.source.stop();
                    }
                }
            } catch (error) {
                console.warn(`Error stopping spatial source ${sourceId}:`, error);
            }
        });
        
        this.spatialSources.clear();
        this.positions.clear();
    }

    // Stop all channels
    stopAllChannels(fadeTime = 0.5) {
        for (const channelId of this.channels.keys()) {
            this.stopChannel(channelId, fadeTime);
        }
    }

    // Stop everything
    stopAll(fadeTime = 0.5) {
        this.stopAllChannels(fadeTime);
        this.stopAllSpatialSources();
    }
    
    // Play a one-shot sound (non-looping, non-spatial, no channel)
    playOneShot(soundId, options = {}) {
        const bufferData = this.buffers.get(soundId);
        if (!bufferData) {
            console.error(`No buffer found for sound ${soundId}`);
            return null;
        }

        const volume = options.volume !== undefined ? options.volume : 1.0;
        const playbackRate = options.playbackRate !== undefined ? options.playbackRate : 1.0;
        const offset = options.offset !== undefined ? options.offset : 0;
        
        // Always force one-shot to non-looping regardless of sound's default settings
        const oneshot_options = {...options, loop: false};
        
        // Handle different sound types
        if (bufferData.type === 'group') {
            return this._playGroupOneShot(soundId, bufferData, {
                ...oneshot_options,
                baseVolume: volume
            });
        } else if (bufferData.type === 'sequence') {
            return this._playSequenceOneShot(soundId, bufferData, {
                ...oneshot_options,
                baseVolume: volume
            });
        } else if (bufferData.type === 'layered') {
            return this._playLayeredOneShot(soundId, bufferData, {
                ...oneshot_options,
                baseVolume: volume
            });
        }

        // Handle regular buffer
        const buffer = bufferData.buffer;
        
        // Create source
        const source = this.audioContext.createBufferSource();
        source.buffer = buffer;
        source.loop = false; // Force non-looping for one-shot
        source.playbackRate.value = playbackRate;
        
        // Create gain node
        const gainNode = this.audioContext.createGain();
        gainNode.gain.setValueAtTime(volume, this.audioContext.currentTime);
        
        // Connect nodes
        source.connect(gainNode);
        gainNode.connect(this.audioContext.destination);
        
        // Play immediately with optional offset
        source.start(0, offset);
        
        return { source, gainNode };
    }
    
    // Play a group sound as one-shot
    _playGroupOneShot(groupId, groupData, options) {
        const resolvedSound = this._resolveGroupSound(groupData);
        if (!resolvedSound || !resolvedSound.buffer) {
            return null;
        }
        
        // Play the resolved buffer as one-shot
        return this.playOneShot(resolvedSound.bufferId, {
            ...options,
            volume: resolvedSound.volume * options.baseVolume,
            playbackRate: resolvedSound.playbackRate * (options.playbackRate || 1.0),
            offset: resolvedSound.offset + (options.offset || 0)
        });
    }
    
    // Play a sequence as one-shot (no looping)
    _playSequenceOneShot(sequenceId, sequenceData, options) {
        const { sounds, gaps, volumes, playbackRates, offsets } = sequenceData;
        const baseVolume = options.baseVolume || 1.0;
        
        // Create master gain node
        const masterGainNode = this.audioContext.createGain();
        masterGainNode.gain.value = baseVolume;
        masterGainNode.connect(this.audioContext.destination);
        
        // Timers for sequence playback
        const sequenceTimers = [];
        
        // Function to play sounds in sequence
        const playNextInSequence = (index) => {
            if (index >= sounds.length) {
                return; // End of sequence
            }
            
            const bufferId = sounds[index];
            const bufferData = this.buffers.get(bufferId);
            
            if (!bufferData || bufferData.type !== 'buffer') {
                console.error(`Invalid sound at index ${index} in sequence ${sequenceId}`);
                return;
            }
            
            // Create source for this part of the sequence
            const source = this.audioContext.createBufferSource();
            source.buffer = bufferData.buffer;
            source.loop = false;
            source.playbackRate.value = playbackRates[index] || 1.0;
            
            // Create individual gain for this source in the sequence
            const sourceGain = this.audioContext.createGain();
            sourceGain.gain.value = volumes[index] || 1.0;
            
            // Connect to the master gain
            source.connect(sourceGain);
            sourceGain.connect(masterGainNode);
            
            // Play the sound with offset
            source.start(0, offsets[index] || 0);
            
            // Calculate when to schedule the next sound
            const currentDuration = bufferData.buffer.duration;
            const gap = gaps[index] || 0;
            const totalDuration = (currentDuration * 1000) + gap;
            
            // Schedule the next sound after this one finishes plus any gap
            if (index < sounds.length - 1) {
                const timer = setTimeout(() => {
                    playNextInSequence(index + 1);
                }, totalDuration);
                
                sequenceTimers.push(timer);
            }
        };
        
        // Start the sequence
        playNextInSequence(0);
        
        // Create a dummy source for consistency in return value
        const dummySource = this.audioContext.createBufferSource();
        dummySource.onended = () => {
            // Clean up any remaining timers
            sequenceTimers.forEach(timer => clearTimeout(timer));
        };
        
        return { 
            source: dummySource, 
            gainNode: masterGainNode,
            sequenceTimers,
            isSequence: true
        };
    }
    
    // Play layered sounds as one-shot
    _playLayeredOneShot(layerId, layerData, options) {
        const { sounds, volumes, playbackRates, offsets } = layerData;
        const baseVolume = options.baseVolume || 1.0;
        
        // Create master gain node
        const masterGainNode = this.audioContext.createGain();
        masterGainNode.gain.value = baseVolume;
        masterGainNode.connect(this.audioContext.destination);
        
        // Create sources for each layer
        const sources = [];
        
        for (let i = 0; i < sounds.length; i++) {
            const bufferId = sounds[i];
            const bufferData = this.buffers.get(bufferId);
            
            if (!bufferData || bufferData.type !== 'buffer') {
                console.error(`Invalid sound at index ${i} in layered sound ${layerId}`);
                continue;
            }
            
            const buffer = bufferData.buffer;
            
            // Create source for this layer
            const source = this.audioContext.createBufferSource();
            source.buffer = buffer;
            source.loop = false; // Force non-looping for one-shot
            source.playbackRate.value = playbackRates[i] || 1.0;
            
            // Create gain for this layer
            const sourceGain = this.audioContext.createGain();
            sourceGain.gain.value = volumes[i] || 1.0;
            
            // Connect layer to master
            source.connect(sourceGain);
            sourceGain.connect(masterGainNode);
            
            // Start the source with offset
            source.start(0, offsets[i] || 0);
            
            // Store for later
            sources.push(source);
        }
        
        // Create a dummy source for consistency in return value
        // This allows the caller to have a consistent interface
        const dummySource = this.audioContext.createBufferSource();
        
        return { 
            source: dummySource, 
            gainNode: masterGainNode,
            sources,
            isLayered: true
        };
    }

    // Clean up resources
    dispose() {
        this.stopAll(0);
        if (this.audioContext.state !== 'closed') {
            this.audioContext.close();
        }
    }
}

export { AudioManager }