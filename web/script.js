document.addEventListener('DOMContentLoaded', () => {

    const GITHUB_USER = 'gisjesusmaria';
    const GITHUB_REPO = 'GeoReel';
    const GITHUB_BASE_URL = `https://raw.githack.com/${GITHUB_USER}/${GITHUB_REPO}/main/`;

    const MAP_DIR = 'map/';
    const IMG_DIR = 'img/';
    const STYLE_DIR = 'map/estilos/';
    const INITIAL_VIEW = [-30.98493, -64.09759];
    const INITIAL_ZOOM = 14;
    const MAX_LAYERS = 5;

    let selectedLayers = [];
    const availableLayers = [
        { name: 'Ejido_Municipal', label: 'Ejido Municipal' },
        { name: 'Cordon_Cuneta', label: 'Cordon Cuneta' },
        { name: 'Gestion_de_Calles', label: 'Gestion de Calles' },
        { name: 'Gestion_de_Calles_Sentidos', label: 'Gestion de Calles Sentidos' },
        { name: 'Lineas_de_Ribera', label: 'Lineas de Ribera' },
        { name: 'Recorrido_Bus_Urbano', label: 'Recorrido Bus Urbano' },
        { name: 'Paradas_de_Colectivos', label: 'Paradas de Colectivos' },
        { name: 'Reductores_de_Velocidad', label: 'Reductores de Velocidad' },
        { name: 'Reserva_Agua_Mansa', label: 'Reserva Agua Mansa' },
        { name: 'Reserva_Parque_del_Oeste', label: 'Reserva Parque del Oeste' }
    ];

    const carouselContainer = document.getElementById('carousel-container');
    const generateMapBtn = document.getElementById('generate-map-btn');
    const selectionScreen = document.getElementById('selection-screen');
    const mapContainer = document.getElementById('map-container');
    const selectedCount = document.getElementById('selected-count');
    const prevBtn = document.getElementById('prev-btn');
    const nextBtn = document.getElementById('next-btn');
    const backBtn = document.getElementById('back-to-selection-btn');
    const loader = document.getElementById('loader');
    
    // --- Lógica de la Interfaz de Usuario (sin cambios) ---
    function renderCarousel() {
        carouselContainer.innerHTML = '';
        availableLayers.forEach(layer => {
            const item = document.createElement('div');
            item.className = 'carousel-item';
            item.innerHTML = `<h3>${layer.label}</h3><img src="https://${GITHUB_USER}.github.io/${GITHUB_REPO}/${IMG_DIR}${layer.name}.jpg" alt="Imagen de ${layer.label}">`;
            item.dataset.layerName = layer.name;
            if (selectedLayers.some(sl => sl.name === layer.name)) item.classList.add('selected');
            item.addEventListener('click', () => {
                const isSelected = item.classList.contains('selected');
                if (isSelected) {
                    item.classList.remove('selected');
                    selectedLayers = selectedLayers.filter(l => l.name !== layer.name);
                } else if (selectedLayers.length < MAX_LAYERS) {
                    item.classList.add('selected');
                    selectedLayers.push(layer);
                } else {
                    alert(`Puedes seleccionar un máximo de ${MAX_LAYERS} capas.`);
                }
                updateUI();
            });
            carouselContainer.appendChild(item);
        });
        updateUI();
    }
    function updateUI() {
        selectedCount.textContent = selectedLayers.length;
        generateMapBtn.disabled = selectedLayers.length === 0;
    }
    prevBtn.addEventListener('click', () => carouselContainer.scrollBy({ left: -310, behavior: 'smooth' }));
    nextBtn.addEventListener('click', () => carouselContainer.scrollBy({ left: 310, behavior: 'smooth' }));
    generateMapBtn.addEventListener('click', () => {
        selectionScreen.style.display = 'none';
        mapContainer.style.display = 'block';
        loader.style.display = 'block';
        setTimeout(initMap, 100);
    });
    backBtn.addEventListener('click', () => {
        if (map) { map.remove(); map = null; }
        mapContainer.style.display = 'none';
        selectionScreen.style.display = 'flex';
    });

    // --- Lógica del Mapa ---
    let map;
    let baseMaps = {};
    let overlayMaps = {};
    let layerControl;
    const defaultStyle = { color: '#ff7800', weight: 3, opacity: 0.8, fillColor: '#ff7800', fillOpacity: 0.3 };

    function createLegendHtml(style) {
        if (!style) return '';
        let styles = `background-color: ${style.fillColor || 'transparent'};`;
        let cssClass = 'legend-icon';
        if (style.radius) {
            cssClass += ' legend-icon-point';
            styles += ` border: 1px solid ${style.color || '#000'};`;
        } else if (!style.fillColor && style.color) {
            cssClass += ' legend-icon-line';
            styles = `background-color: ${style.color};`;
        } else {
            styles += ` border: 1px solid ${style.color || '#000'};`;
        }
        return `<span class="${cssClass}" style="${styles}"></span>`;
    }

    function initMap() {
        if (map) map.remove();
        map = L.map('map').setView(INITIAL_VIEW, INITIAL_ZOOM);
        overlayMaps = {};

        const osm = L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 20, attribution: '&copy; OpenStreetMap' });
        const googleSat = L.tileLayer('http://{s}.google.com/vt/lyrs=s&x={x}&y={y}&z={z}',{ maxZoom: 20, subdomains:['mt0','mt1','mt2','mt3'] });
        osm.addTo(map);
        baseMaps = { "OpenStreetMap": osm, "Google Satellite": googleSat };
        
        const layerPromises = selectedLayers.map(layer => {
            const geojsonUrl = `${GITHUB_BASE_URL}${MAP_DIR}${layer.name}.geojson`;
            const styleUrl = `${GITHUB_BASE_URL}${STYLE_DIR}${layer.name}.json`;

            return Promise.all([
                fetch(geojsonUrl).then(res => res.ok ? res.json() : Promise.reject(`Error en GeoJSON: ${res.statusText}`)),
                fetch(styleUrl).then(res => res.ok ? res.json() : null)
            ])
            .then(([geojsonData, styleData]) => {
                if (!geojsonData || !geojsonData.features) return;

                let geojsonOptions = { onEachFeature: (feature, layer) => { /* ... popup ... */ } };
                let legendKey = layer.label;

                // Definimos el contenido del popup aquí para usarlo en geojsonOptions
                geojsonOptions.onEachFeature = function(feature, layerInstance) {
                    let popupContent = `<h4>${feature.properties.nombre || 'Detalles'}</h4><table>`;
                    for (let prop in feature.properties) {
                        popupContent += `<tr><td style="padding-right:10px;"><strong>${prop}:</strong></td><td>${feature.properties[prop]}</td></tr>`;
                    }
                    popupContent += "</table>";
                    layerInstance.bindPopup(popupContent);
                };

                if (styleData && styleData.type === 'categorized') {
                    geojsonOptions.style = function(feature) {
                        const attr = feature.properties[styleData.attribute];
                        const category = styleData.categories.find(c => c.value == attr); // Usamos == para comparar número y texto
                        return category ? category.style : styleData.default;
                    };

                    // --- NUEVA LÓGICA PARA LEYENDA CATEGORIZADA ---
                    let legendHtml = `<strong>${layer.label}</strong>`;
                    styleData.categories.forEach(cat => {
                        legendHtml += `<div class="legend-category-label">${createLegendHtml(cat.style)} ${cat.value || 'Otros'}</div>`;
                    });
                    legendKey = legendHtml;

                } else {
                    const style = styleData ? styleData.style : defaultStyle;
                    geojsonOptions.style = style;
                    if (style.radius !== undefined) {
                        geojsonOptions.pointToLayer = (feature, latlng) => L.circleMarker(latlng, style);
                    }
                    legendKey = createLegendHtml(style) + ' ' + layer.label;
                }
                
                const geojsonLayer = L.geoJSON(geojsonData, geojsonOptions);
                overlayMaps[legendKey] = geojsonLayer;
            })
            .catch(error => console.error(`Error al cargar la capa "${layer.label}":`, error));
        });

        Promise.allSettled(layerPromises).then(() => {
            Object.values(overlayMaps).forEach(l => l.addTo(map));
            updateLayerControl();
            loader.style.display = 'none';
            const allLayersGroup = new L.featureGroup(Object.values(overlayMaps));
            if (Object.keys(allLayersGroup._layers).length > 0) {
                map.fitBounds(allLayersGroup.getBounds().pad(0.1));
            }
        });
    }

    function updateLayerControl() {
        // if (layerControl) {
        //     map.removeControl(layerControl);
        // }
        // // --- NUEVO: Añadimos las opciones de posición y para que no se cierre ---
        // layerControl = L.control.layers(baseMaps, overlayMaps, {
        //     position: 'bottomleft',
        //     collapsed: false 
        // }).addTo(map);
        
        if (layerControl) {
            map.removeControl(layerControl);
        }
        // Dejamos que Leaflet use sus valores por defecto (arriba a la derecha y contraído)
        layerControl = L.control.layers(baseMaps, overlayMaps).addTo(map);        
    }
    
    renderCarousel();
});