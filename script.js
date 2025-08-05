class InteractiveMap {
    constructor() {
        this.canvas = document.getElementById('mapCanvas');
        this.overlayCanvas = document.getElementById('overlayCanvas');
        this.ctx = this.canvas.getContext('2d');
        this.overlayCtx = this.overlayCanvas.getContext('2d');
        
        this.mapImage = null;
        this.imageData = null;
        this.selectedRegions = new Set();
        this.regionMap = new Map(); // Will store region ID for each pixel
        this.regionCounter = 0;
        this.hoveredRegion = null;
        
        // Colors for visual feedback
        this.selectionColor = 'rgba(52, 152, 219, 0.4)'; // Blue overlay
        this.hoverColor = 'rgba(231, 76, 60, 0.3)'; // Red overlay
        
        this.init();
    }
    
    async init() {
        try {
            // For now, create a sample map. In production, this would load the actual regional map
            await this.createSampleMap();
            this.setupEventListeners();
            this.updateUI();
        } catch (error) {
            console.error('Error initializing map:', error);
            this.showError('Failed to load map');
        }
    }
    
    async createSampleMap() {
        // Create a sample map with regions separated by black borders
        // In production, this would load the actual detailed regional map image
        const width = 800;
        const height = 600;
        
        this.canvas.width = width;
        this.canvas.height = height;
        this.overlayCanvas.width = width;
        this.overlayCanvas.height = height;
        
        // Create a sample regional map with different colored regions and black borders
        this.ctx.fillStyle = '#87CEEB'; // Light blue for water/background
        this.ctx.fillRect(0, 0, width, height);
        
        // Draw sample regions with black borders
        this.drawSampleRegions();
        
        // Get image data for pixel analysis
        this.imageData = this.ctx.getImageData(0, 0, width, height);
    }
    
    drawSampleRegions() {
        const regions = [
            {x: 50, y: 50, width: 120, height: 80, color: '#FFB6C1'},
            {x: 200, y: 50, width: 100, height: 100, color: '#98FB98'},
            {x: 350, y: 50, width: 90, height: 120, color: '#DDA0DD'},
            {x: 50, y: 160, width: 150, height: 100, color: '#F0E68C'},
            {x: 230, y: 180, width: 110, height: 90, color: '#FFA07A'},
            {x: 370, y: 200, width: 100, height: 80, color: '#20B2AA'},
            {x: 100, y: 300, width: 130, height: 90, color: '#FFE4B5'},
            {x: 260, y: 320, width: 100, height: 100, color: '#D3D3D3'},
            {x: 400, y: 350, width: 120, height: 80, color: '#F5DEB3'},
            {x: 550, y: 100, width: 150, height: 200, color: '#FFEFD5'},
            {x: 500, y: 350, width: 200, height: 150, color: '#E0FFFF'}
        ];
        
        regions.forEach(region => {
            // Fill region with color
            this.ctx.fillStyle = region.color;
            this.ctx.fillRect(region.x, region.y, region.width, region.height);
            
            // Draw black border
            this.ctx.strokeStyle = '#000000';
            this.ctx.lineWidth = 2;
            this.ctx.strokeRect(region.x, region.y, region.width, region.height);
        });
        
        // Add some irregular shaped regions for complexity
        this.drawIrregularRegions();
    }
    
    drawIrregularRegions() {
        // Draw some irregular shaped regions to test complex boundary detection
        this.ctx.fillStyle = '#FF6347';
        this.ctx.beginPath();
        this.ctx.moveTo(600, 50);
        this.ctx.lineTo(750, 100);
        this.ctx.lineTo(720, 200);
        this.ctx.lineTo(650, 180);
        this.ctx.closePath();
        this.ctx.fill();
        this.ctx.stroke();
        
        this.ctx.fillStyle = '#40E0D0';
        this.ctx.beginPath();
        this.ctx.moveTo(50, 450);
        this.ctx.lineTo(200, 430);
        this.ctx.lineTo(180, 550);
        this.ctx.lineTo(80, 580);
        this.ctx.closePath();
        this.ctx.fill();
        this.ctx.stroke();
    }
    
    setupEventListeners() {
        this.canvas.addEventListener('click', (e) => this.handleClick(e));
        this.canvas.addEventListener('mousemove', (e) => this.handleMouseMove(e));
        this.canvas.addEventListener('mouseleave', () => this.handleMouseLeave());
        
        document.getElementById('clearAll').addEventListener('click', () => this.clearAllSelections());
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
        const regionId = this.detectRegion(pos.x, pos.y);
        
        if (regionId !== null) {
            if (this.selectedRegions.has(regionId)) {
                this.selectedRegions.delete(regionId);
            } else {
                this.selectedRegions.add(regionId);
            }
            this.updateOverlay();
            this.updateUI();
        }
    }
    
    handleMouseMove(e) {
        const pos = this.getMousePos(e);
        const regionId = this.detectRegion(pos.x, pos.y);
        
        if (regionId !== this.hoveredRegion) {
            this.hoveredRegion = regionId;
            this.updateOverlay();
            this.updateRegionInfo(regionId);
        }
    }
    
    handleMouseLeave() {
        this.hoveredRegion = null;
        this.updateOverlay();
        this.updateRegionInfo(null);
    }
    
    detectRegion(x, y) {
        // Check if coordinates are within canvas bounds
        if (x < 0 || y < 0 || x >= this.canvas.width || y >= this.canvas.height) {
            return null;
        }
        
        // Check if this pixel has already been mapped to a region
        const pixelKey = `${x},${y}`;
        if (this.regionMap.has(pixelKey)) {
            return this.regionMap.get(pixelKey);
        }
        
        // Check if clicking on a black border or water
        const pixelData = this.getPixelData(x, y);
        if (this.isBlackBorder(pixelData) || this.isWater(pixelData)) {
            return null;
        }
        
        // Use flood fill to detect the region bounded by black borders
        const regionPixels = this.floodFillRegion(x, y);
        
        if (regionPixels.length === 0) {
            return null;
        }
        
        // Assign a new region ID
        const regionId = ++this.regionCounter;
        
        // Map all pixels in this region to the region ID
        regionPixels.forEach(pixel => {
            this.regionMap.set(`${pixel.x},${pixel.y}`, regionId);
        });
        
        return regionId;
    }
    
    floodFillRegion(startX, startY) {
        const visited = new Set();
        const regionPixels = [];
        const stack = [{x: startX, y: startY}];
        const startColor = this.getPixelData(startX, startY);
        
        while (stack.length > 0) {
            const {x, y} = stack.pop();
            const key = `${x},${y}`;
            
            if (visited.has(key)) continue;
            
            // Check bounds
            if (x < 0 || y < 0 || x >= this.canvas.width || y >= this.canvas.height) {
                continue;
            }
            
            const pixelData = this.getPixelData(x, y);
            
            // Stop at black borders or if color is too different
            if (this.isBlackBorder(pixelData) || !this.isSimilarColor(startColor, pixelData)) {
                continue;
            }
            
            visited.add(key);
            regionPixels.push({x, y});
            
            // Add neighboring pixels to stack
            stack.push(
                {x: x + 1, y: y},
                {x: x - 1, y: y},
                {x: x, y: y + 1},
                {x: x, y: y - 1}
            );
        }
        
        return regionPixels;
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
    
    isBlackBorder(pixelData) {
        // Consider a pixel as black border if it's very dark
        const threshold = 50;
        return pixelData.r < threshold && pixelData.g < threshold && pixelData.b < threshold;
    }
    
    isWater(pixelData) {
        // Detect water areas (blue regions) - make them non-selectable
        // Check for light blue water background (RGB around 135, 206, 235)
        const isLightBlueWater = pixelData.r >= 120 && pixelData.r <= 150 && 
                                pixelData.g >= 190 && pixelData.g <= 220 && 
                                pixelData.b >= 220 && pixelData.b <= 255;
        
        // Also check for general blue dominance
        const isBlueWater = pixelData.b > pixelData.r + 30 && pixelData.b > pixelData.g + 10;
        
        return isLightBlueWater || isBlueWater;
    }
    
    isSimilarColor(color1, color2) {
        // Check if two colors are similar enough to be considered the same region
        const threshold = 30;
        return Math.abs(color1.r - color2.r) < threshold &&
               Math.abs(color1.g - color2.g) < threshold &&
               Math.abs(color1.b - color2.b) < threshold;
    }
    
    updateOverlay() {
        // Clear overlay
        this.overlayCtx.clearRect(0, 0, this.overlayCanvas.width, this.overlayCanvas.height);
        
        // Draw selected regions
        this.selectedRegions.forEach(regionId => {
            this.drawRegionOverlay(regionId, this.selectionColor);
        });
        
        // Draw hovered region
        if (this.hoveredRegion && !this.selectedRegions.has(this.hoveredRegion)) {
            this.drawRegionOverlay(this.hoveredRegion, this.hoverColor);
        }
    }
    
    drawRegionOverlay(regionId, color) {
        this.overlayCtx.fillStyle = color;
        
        // Find all pixels belonging to this region and draw them
        for (let [pixelKey, id] of this.regionMap) {
            if (id === regionId) {
                const [x, y] = pixelKey.split(',').map(Number);
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
                .map(regionId => `
                    <div class="region-item">
                        <span>Region ${regionId}</span>
                        <button class="remove-btn" onclick="map.removeRegion(${regionId})">×</button>
                    </div>
                `).join('');
        }
    }
    
    updateRegionInfo(regionId) {
        const currentRegionDiv = document.getElementById('currentRegion');
        if (regionId) {
            currentRegionDiv.innerHTML = `
                <strong>Region ${regionId}</strong><br>
                Click to ${this.selectedRegions.has(regionId) ? 'deselect' : 'select'} this region
            `;
        } else {
            currentRegionDiv.textContent = 'Click on a region to see details';
        }
    }
    
    removeRegion(regionId) {
        this.selectedRegions.delete(regionId);
        this.updateOverlay();
        this.updateUI();
    }
    
    clearAllSelections() {
        this.selectedRegions.clear();
        this.updateOverlay();
        this.updateUI();
    }
    
    showError(message) {
        const mapContainer = document.querySelector('.map-container');
        mapContainer.innerHTML = `<div class="loading">${message}</div>`;
    }
}

// Initialize the map when the page loads
let map;
document.addEventListener('DOMContentLoaded', () => {
    map = new InteractiveMap();
});