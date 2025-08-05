class RGBBasedInteractiveMap {
    constructor() {
        this.canvas = document.getElementById('mapCanvas');
        this.overlayCanvas = document.getElementById('overlayCanvas');
        this.ctx = this.canvas.getContext('2d');
        this.overlayCtx = this.overlayCanvas.getContext('2d');
        this.loadingIndicator = document.getElementById('loadingIndicator');
        
        this.mapImage = null;
        this.imageData = null;
        this.selectedRegions = new Set();
        this.hoveredRegion = null;
        
        // RGB-based region data
        this.regionData = new Map(); // RGB key -> region info
        this.rgbToRegionMap = new Map(); // "r,g,b" -> region object
        
        // Performance optimizations
        this.regionPixelCache = new Map(); // Cache pixel coordinates for each region
        this.performanceMetrics = {
            lookupCount: 0,
            totalLookupTime: 0
        };
        
        // Enhanced visual feedback colors
        this.selectionColor = 'rgba(52, 152, 219, 0.6)'; // Enhanced blue overlay
        this.hoverColor = 'rgba(231, 76, 60, 0.5)'; // Enhanced red overlay
        this.borderColor = 'rgba(44, 62, 80, 0.8)'; // Dark border for selected regions
        
        this.init();
    }
    
    async init() {
        try {
            this.showLoading('Loading region data...');
            await this.loadRegionData();
            
            this.showLoading('Loading geographical map...');
            await this.createColorCodedMap();
            
            this.showLoading('Building RGB lookup cache...');
            this.buildRGBLookupCache();
            
            this.hideLoading();
            this.setupEventListeners();
            this.updateUI();
            
            console.log(`RGB-based map initialized with ${this.regionData.size} regions`);
            this.showPerformanceInfo();
        } catch (error) {
            console.error('Error initializing map:', error);
            this.showError('Failed to load map: ' + error.message);
        }
    }
    
    async loadRegionData() {
        try {
            const response = await fetch('descr_regions.txt');
            if (!response.ok) {
                throw new Error('Failed to load region data file');
            }
            
            const text = await response.text();
            this.parseRegionData(text);
            
            if (this.regionData.size === 0) {
                throw new Error('No region data found');
            }
            
            console.log(`Loaded ${this.regionData.size} regions from descr_regions.txt`);
        } catch (error) {
            console.error('Error loading region data:', error);
            throw error;
        }
    }
    
    parseRegionData(text) {
        const lines = text.split('\n');
        let currentRegion = null;
        let lineIndex = 0;
        
        for (let line of lines) {
            lineIndex++;
            const originalLine = line;
            line = line.trim();
            
            // Skip empty lines and comments
            if (!line || line.startsWith(';')) {
                continue;
            }
            
            // Check if line is indented (starts with tab or spaces)
            if (originalLine.startsWith('\t') || originalLine.startsWith('    ')) {
                if (!currentRegion) {
                    console.warn(`Indented line found without region context at line ${lineIndex}: ${line}`);
                    continue;
                }
                
                // Check if this line contains RGB values (3 numbers)
                const rgbMatch = line.match(/^(\d+)\s+(\d+)\s+(\d+)$/);
                if (rgbMatch) {
                    const r = parseInt(rgbMatch[1]);
                    const g = parseInt(rgbMatch[2]);
                    const b = parseInt(rgbMatch[3]);
                    
                    currentRegion.rgb = { r, g, b };
                    
                    // Store in our maps
                    const rgbKey = `${r},${g},${b}`;
                    this.regionData.set(rgbKey, currentRegion);
                    this.rgbToRegionMap.set(rgbKey, currentRegion);
                    
                    console.log(`Added region: ${currentRegion.name} with RGB(${r},${g},${b})`);
                    currentRegion = null; // Region complete
                } else {
                    // Add other properties to current region
                    if (!currentRegion.settlement) {
                        currentRegion.settlement = line;
                    } else if (!currentRegion.faction) {
                        currentRegion.faction = line;
                    } else if (!currentRegion.culture) {
                        currentRegion.culture = line;
                    }
                }
            } else {
                // This is a region name (top-level)
                currentRegion = {
                    name: line,
                    settlement: '',
                    faction: '',
                    culture: '',
                    rgb: null
                };
                console.log(`Starting new region: ${line}`);
            }
        }
        
        console.log(`Parsed ${this.regionData.size} complete regions`);
    }
    
    async createColorCodedMap() {
        // Load the actual geographical map image
        return new Promise((resolve, reject) => {
            this.mapImage = new Image();
            this.mapImage.onload = () => {
                const width = this.mapImage.width;
                const height = this.mapImage.height;
                
                // Ensure proper canvas sizing to match image dimensions exactly
                this.canvas.width = width;
                this.canvas.height = height;
                this.overlayCanvas.width = width;
                this.overlayCanvas.height = height;
                
                // Set CSS dimensions to maintain aspect ratio and responsive design
                const maxWidth = Math.min(1200, window.innerWidth - 400); // Leave space for sidebar
                const aspectRatio = height / width;
                const cssWidth = Math.min(maxWidth, width);
                const cssHeight = cssWidth * aspectRatio;
                
                this.canvas.style.width = `${cssWidth}px`;
                this.canvas.style.height = `${cssHeight}px`;
                this.overlayCanvas.style.width = `${cssWidth}px`;
                this.overlayCanvas.style.height = `${cssHeight}px`;
                
                // Draw the geographical map image
                this.ctx.drawImage(this.mapImage, 0, 0);
                
                // Get image data for pixel analysis
                this.imageData = this.ctx.getImageData(0, 0, width, height);
                
                console.log(`Geographical map loaded successfully (${width}x${height})`);
                console.log(`Canvas sized for responsive display (${cssWidth}x${cssHeight})`);
                resolve();
            };
            this.mapImage.onerror = () => {
                console.error('Failed to load map image');
                reject(new Error('Failed to load map image'));
            };
            this.mapImage.src = 'roman_empire_map.png';
        });
    }
    
    buildRGBLookupCache() {
        // Build pixel coordinate cache for better overlay performance
        this.showLoading('Building pixel cache for smooth interactions...');
        const data = this.imageData.data;
        
        // Cache pixel coordinates for each region for faster overlay rendering
        for (let i = 0; i < data.length; i += 4) {
            const r = data[i];
            const g = data[i + 1];
            const b = data[i + 2];
            const rgbKey = `${r},${g},${b}`;
            
            if (this.rgbToRegionMap.has(rgbKey)) {
                if (!this.regionPixelCache.has(rgbKey)) {
                    this.regionPixelCache.set(rgbKey, []);
                }
                const pixelIndex = i / 4;
                const x = pixelIndex % this.canvas.width;
                const y = Math.floor(pixelIndex / this.canvas.width);
                this.regionPixelCache.get(rgbKey).push({ x, y });
            }
        }
        
        console.log(`RGB lookup cache built with ${this.rgbToRegionMap.size} regions`);
        console.log(`Pixel cache built for ${this.regionPixelCache.size} regions with optimized rendering`);
    }
    
    setupEventListeners() {
        this.canvas.addEventListener('click', (e) => this.handleClick(e));
        this.canvas.addEventListener('mousemove', (e) => this.handleMouseMove(e));
        this.canvas.addEventListener('mouseleave', () => this.handleMouseLeave());
        
        const clearButton = document.getElementById('clearAll');
        clearButton.addEventListener('click', () => this.clearAllSelections());
        
        // Add window resize listener for responsive canvas
        window.addEventListener('resize', () => this.handleResize());
        
        // Update clear button state
        this.updateClearButtonState();
    }
    
    handleResize() {
        if (!this.mapImage) return;
        
        // Maintain aspect ratio and responsive design on resize
        const maxWidth = Math.min(1200, window.innerWidth - 400);
        const aspectRatio = this.mapImage.height / this.mapImage.width;
        const cssWidth = Math.min(maxWidth, this.mapImage.width);
        const cssHeight = cssWidth * aspectRatio;
        
        this.canvas.style.width = `${cssWidth}px`;
        this.canvas.style.height = `${cssHeight}px`;
        this.overlayCanvas.style.width = `${cssWidth}px`;
        this.overlayCanvas.style.height = `${cssHeight}px`;
    }
    
    getMousePos(e) {
        const rect = this.canvas.getBoundingClientRect();
        const scaleX = this.canvas.width / rect.width;
        const scaleY = this.canvas.height / rect.height;
        
        // Ensure pixel-perfect coordinate mapping
        const x = Math.floor((e.clientX - rect.left) * scaleX);
        const y = Math.floor((e.clientY - rect.top) * scaleY);
        
        // Clamp coordinates to canvas bounds for safety
        return {
            x: Math.max(0, Math.min(x, this.canvas.width - 1)),
            y: Math.max(0, Math.min(y, this.canvas.height - 1))
        };
    }
    
    handleClick(e) {
        const pos = this.getMousePos(e);
        const region = this.detectRegionByRGB(pos.x, pos.y);
        
        if (region) {
            const rgbKey = `${region.rgb.r},${region.rgb.g},${region.rgb.b}`;
            
            if (this.selectedRegions.has(rgbKey)) {
                this.selectedRegions.delete(rgbKey);
            } else {
                this.selectedRegions.add(rgbKey);
            }
            
            this.updateOverlay();
            this.updateUI();
            this.updateClearButtonState();
        }
    }
    
    handleMouseMove(e) {
        const pos = this.getMousePos(e);
        const region = this.detectRegionByRGB(pos.x, pos.y);
        
        const newHoveredRegion = region ? `${region.rgb.r},${region.rgb.g},${region.rgb.b}` : null;
        
        if (newHoveredRegion !== this.hoveredRegion) {
            this.hoveredRegion = newHoveredRegion;
            this.updateOverlay();
            this.updateRegionInfo(region);
        }
    }
    
    handleMouseLeave() {
        this.hoveredRegion = null;
        this.updateOverlay();
        this.updateRegionInfo(null);
    }
    
    detectRegionByRGB(x, y) {
        // Performance measurement
        const startTime = performance.now();
        
        // Check if coordinates are within canvas bounds
        if (x < 0 || y < 0 || x >= this.canvas.width || y >= this.canvas.height) {
            return null;
        }
        
        // Get pixel RGB values
        const pixelData = this.getPixelData(x, y);
        const rgbKey = `${pixelData.r},${pixelData.g},${pixelData.b}`;
        
        // O(1) lookup in hash map
        const region = this.rgbToRegionMap.get(rgbKey);
        
        // Update performance metrics
        this.performanceMetrics.lookupCount++;
        this.performanceMetrics.totalLookupTime += performance.now() - startTime;
        
        return region || null;
    }
    
    getPixelData(x, y) {
        const index = (y * this.canvas.width + x) * 4;
        return {
            r: this.imageData.data[index],
            g: this.imageData.data[index + 1],
            b: this.imageData.data[index + 2],
            a: this.imageData.data[index + 3]
        };
    }
    
    updateOverlay() {
        // Clear overlay
        this.overlayCtx.clearRect(0, 0, this.overlayCanvas.width, this.overlayCanvas.height);
        
        // Draw selected regions
        this.selectedRegions.forEach(rgbKey => {
            this.drawRegionOverlay(rgbKey, this.selectionColor);
        });
        
        // Draw hovered region
        if (this.hoveredRegion && !this.selectedRegions.has(this.hoveredRegion)) {
            this.drawRegionOverlay(this.hoveredRegion, this.hoverColor);
        }
    }
    
    drawRegionOverlay(rgbKey, color) {
        const region = this.rgbToRegionMap.get(rgbKey);
        if (!region || !region.rgb) return;
        
        // Use cached pixel coordinates for much better performance
        const pixelCoords = this.regionPixelCache.get(rgbKey);
        if (!pixelCoords || pixelCoords.length === 0) return;
        
        this.overlayCtx.fillStyle = color;
        
        // Draw all pixels for the region
        for (const coord of pixelCoords) {
            this.overlayCtx.fillRect(coord.x, coord.y, 1, 1);
        }
        
        // Add simple border effect for selected regions (simplified for performance)
        if (this.selectedRegions.has(rgbKey)) {
            this.overlayCtx.strokeStyle = this.borderColor;
            this.overlayCtx.lineWidth = 1;
            
            // Draw a simple outline by checking edge pixels more efficiently
            this.overlayCtx.fillStyle = this.borderColor;
            for (const coord of pixelCoords) {
                const { x, y } = coord;
                
                // Simple edge detection - check if any immediate neighbor is not part of region
                const hasExternalNeighbor = [
                    { x: x - 1, y },
                    { x: x + 1, y },
                    { x, y: y - 1 },
                    { x, y: y + 1 }
                ].some(neighbor => {
                    if (neighbor.x < 0 || neighbor.x >= this.canvas.width || 
                        neighbor.y < 0 || neighbor.y >= this.canvas.height) {
                        return true; // Edge of canvas
                    }
                    
                    const pixelData = this.getPixelData(neighbor.x, neighbor.y);
                    const neighborRgbKey = `${pixelData.r},${pixelData.g},${pixelData.b}`;
                    return neighborRgbKey !== rgbKey;
                });
                
                if (hasExternalNeighbor) {
                    this.overlayCtx.fillRect(x, y, 1, 1);
                }
            }
        }
    }
    
    updateUI() {
        const selectedCount = this.selectedRegions.size;
        document.getElementById('selectedCount').textContent = selectedCount;
        
        const selectedRegionsDiv = document.getElementById('selectedRegions');
        if (selectedCount === 0) {
            selectedRegionsDiv.textContent = 'No regions selected';
        } else {
            selectedRegionsDiv.innerHTML = Array.from(this.selectedRegions)
                .map(rgbKey => {
                    const region = this.rgbToRegionMap.get(rgbKey);
                    return `
                        <div class="region-item">
                            <div class="region-item-content">
                                <div class="region-name">${region.name}</div>
                                <div class="region-meta">
                                    ${region.settlement} • ${region.culture} • RGB(${region.rgb.r},${region.rgb.g},${region.rgb.b})
                                </div>
                            </div>
                            <button class="remove-btn" onclick="map.removeRegion('${rgbKey}')">×</button>
                        </div>
                    `;
                }).join('');
        }
    }
    
    updateRegionInfo(region) {
        const currentRegionDiv = document.getElementById('currentRegion');
        if (region) {
            const isSelected = this.selectedRegions.has(`${region.rgb.r},${region.rgb.g},${region.rgb.b}`);
            currentRegionDiv.innerHTML = `
                <div class="region-details">
                    <div class="region-name">${region.name}</div>
                    <div class="settlement">Settlement: ${region.settlement || 'Unknown'}</div>
                    <div class="culture">Culture: ${region.culture || 'Unknown'}</div>
                    <div class="faction">Faction: ${region.faction || 'Unknown'}</div>
                    <div class="rgb-values">RGB: (${region.rgb.r}, ${region.rgb.g}, ${region.rgb.b})</div>
                </div>
                <p style="margin-top: 10px; font-style: italic; color: #7f8c8d;">
                    Click to ${isSelected ? 'deselect' : 'select'} this region
                </p>
            `;
        } else {
            currentRegionDiv.innerHTML = 'Hover over a region to see details';
        }
    }
    
    updateClearButtonState() {
        const clearButton = document.getElementById('clearAll');
        clearButton.disabled = this.selectedRegions.size === 0;
    }
    
    removeRegion(rgbKey) {
        this.selectedRegions.delete(rgbKey);
        this.updateOverlay();
        this.updateUI();
        this.updateClearButtonState();
    }
    
    clearAllSelections() {
        this.selectedRegions.clear();
        this.updateOverlay();
        this.updateUI();
        this.updateClearButtonState();
    }
    
    showLoading(message) {
        this.loadingIndicator.textContent = message;
        this.loadingIndicator.style.display = 'flex';
    }
    
    hideLoading() {
        this.loadingIndicator.style.display = 'none';
    }
    
    showError(message) {
        this.hideLoading();
        const mapContainer = document.querySelector('.map-container');
        mapContainer.innerHTML = `<div class="error">${message}</div>`;
    }
    
    showPerformanceInfo() {
        console.log('RGB-based region detection performance:');
        console.log(`- Total regions: ${this.regionData.size}`);
        console.log(`- Lookup operations: ${this.performanceMetrics.lookupCount}`);
        console.log(`- Average lookup time: ${(this.performanceMetrics.totalLookupTime / Math.max(this.performanceMetrics.lookupCount, 1)).toFixed(4)}ms`);
        console.log('- Algorithm complexity: O(1) per lookup (vs O(n) flood-fill)');
    }
}

// Initialize the map when the page loads
let map;
document.addEventListener('DOMContentLoaded', () => {
    map = new RGBBasedInteractiveMap();
});