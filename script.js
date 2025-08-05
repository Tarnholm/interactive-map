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
        this.performanceMetrics = {
            lookupCount: 0,
            totalLookupTime: 0
        };
        
        // Colors for visual feedback
        this.selectionColor = 'rgba(52, 152, 219, 0.5)'; // Blue overlay
        this.hoverColor = 'rgba(231, 76, 60, 0.4)'; // Red overlay
        
        this.init();
    }
    
    async init() {
        try {
            this.showLoading('Loading region data...');
            await this.loadRegionData();
            
            this.showLoading('Generating color-coded map...');
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
        // Create a color-coded map where each region has its unique RGB color
        const width = 1000;
        const height = 700;
        
        this.canvas.width = width;
        this.canvas.height = height;
        this.overlayCanvas.width = width;
        this.overlayCanvas.height = height;
        
        // Fill background with water color
        this.ctx.fillStyle = '#4A90E2'; // Water blue
        this.ctx.fillRect(0, 0, width, height);
        
        // Draw regions with their specific RGB colors
        this.drawColorCodedRegions(width, height);
        
        // Get image data for pixel analysis
        this.imageData = this.ctx.getImageData(0, 0, width, height);
        
        console.log('Color-coded map created successfully');
    }
    
    drawColorCodedRegions(width, height) {
        const regions = Array.from(this.regionData.values());
        const cols = Math.ceil(Math.sqrt(regions.length));
        const regionWidth = Math.floor((width - 100) / cols);
        const regionHeight = Math.floor((height - 100) / Math.ceil(regions.length / cols));
        
        let x = 50;
        let y = 50;
        let col = 0;
        
        regions.forEach(region => {
            if (region.rgb) {
                // Draw region with its exact RGB color
                this.ctx.fillStyle = `rgb(${region.rgb.r}, ${region.rgb.g}, ${region.rgb.b})`;
                this.ctx.fillRect(x, y, regionWidth - 5, regionHeight - 5);
                
                // Draw a border for visual separation
                this.ctx.strokeStyle = '#333';
                this.ctx.lineWidth = 1;
                this.ctx.strokeRect(x, y, regionWidth - 5, regionHeight - 5);
                
                // Add region name text (if space allows)
                if (regionWidth > 80 && regionHeight > 30) {
                    this.ctx.fillStyle = '#000';
                    this.ctx.font = '12px Arial';
                    this.ctx.textAlign = 'center';
                    this.ctx.fillText(
                        region.name.length > 10 ? region.name.substring(0, 10) + '...' : region.name,
                        x + regionWidth / 2 - 2.5,
                        y + regionHeight / 2
                    );
                }
                
                // Move to next position
                col++;
                if (col >= cols) {
                    col = 0;
                    x = 50;
                    y += regionHeight;
                } else {
                    x += regionWidth;
                }
            }
        });
    }
    
    buildRGBLookupCache() {
        // The cache is already built during parsing, but we can optimize it here
        console.log(`RGB lookup cache built with ${this.rgbToRegionMap.size} entries`);
    }
    
    setupEventListeners() {
        this.canvas.addEventListener('click', (e) => this.handleClick(e));
        this.canvas.addEventListener('mousemove', (e) => this.handleMouseMove(e));
        this.canvas.addEventListener('mouseleave', () => this.handleMouseLeave());
        
        const clearButton = document.getElementById('clearAll');
        clearButton.addEventListener('click', () => this.clearAllSelections());
        
        // Update clear button state
        this.updateClearButtonState();
    }
    
    getMousePos(e) {
        const rect = this.canvas.getBoundingClientRect();
        const scaleX = this.canvas.width / rect.width;
        const scaleY = this.canvas.height / rect.height;
        
        return {
            x: Math.floor((e.clientX - rect.left) * scaleX),
            y: Math.floor((e.clientY - rect.top) * scaleY)
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
        
        this.overlayCtx.fillStyle = color;
        
        // Scan through all pixels to find matching RGB values
        // This is more efficient than flood-fill for our use case
        const imageData = this.imageData;
        const data = imageData.data;
        
        for (let i = 0; i < data.length; i += 4) {
            const r = data[i];
            const g = data[i + 1];
            const b = data[i + 2];
            
            if (r === region.rgb.r && g === region.rgb.g && b === region.rgb.b) {
                const pixelIndex = i / 4;
                const x = pixelIndex % this.canvas.width;
                const y = Math.floor(pixelIndex / this.canvas.width);
                
                this.overlayCtx.fillRect(x, y, 1, 1);
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