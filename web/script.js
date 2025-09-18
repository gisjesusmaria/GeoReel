document.addEventListener('DOMContentLoaded', () => {

    const GITHUB_USER = 'gisjesusmaria';
    const GITHUB_REPO = 'GeoReel';
    // Usamos githack.com para obtener los encabezados CORS correctos
    const GITHUB_BASE_URL = `https://raw.githack.com/${GITHUB_USER}/${GITHUB_REPO}/main/`;

    const MAP_DIR = 'map/';
    const IMG_DIR = 'img/';
    const STYLE_DIR = 'map/estilos/'; // Directorio para los archivos de estilo
    const INITIAL_VIEW = [-30.98493, -64.09759];
    const INITIAL_ZOOM = 14;
    const MAX_LAYERS = 5;

    let selectedLayers = [];
    const availableLayers = [
        { name: 'Ejido_Municipal', label: 'Ejido Municipal' },
        { name: 'Cordon_Cuneta', label: 'Cordon Cuneta' },
        { name: 'Gestion_de_Calles', label: 'Gestion de Calles' },
        // { name: 'Gestion_de_Calles_Sentidos', label: 'Gestion de Calles Sentidos' },
        { name: 'Lineas_de_Ribera', label: 'Lineas de Ribera' },
        { name: 'Recorrido_Bus_Urbano', label: 'Recorrido Bus Urbano' },
        { name: 'Paradas_de_Colectivos', label: 'Paradas de Colectivos' },
        { name: 'Reductores_de_Velocidad', label: 'Reductores de Velocidad' },
        { name: 'Reserva_Agua_Mansa', label: 'Reserva Agua Mansa' },
        { name: 'Reserva_Parque_del_Oeste', label: 'Reserva Parque del Oeste' }
    ];

    // --- Elementos del DOM ---
    const carouselContainer = document.getElementById('carousel-container');
    const generateMapBtn = document.getElementById('generate-map-btn');
    const selectionScreen = document.getElementById('selection-screen');
    const mapContainer = document.getElementById('map-container');
    const selectedCount = document.getElementById('selected-count');
    const prevBtn = document.getElementById('prev-btn');
    const nextBtn = document.getElementById('next-btn');
    const backBtn = document.getElementById('back-to-selection-btn');
    const loader = document.getElementById('loader');
    
    // --- Lógica de la Interfaz de Usuario ---

    function renderCarousel() {
        carouselContainer.innerHTML = '';
        availableLayers.forEach(layer => {
            const item = document.createElement('div');
            item.className = 'carousel-item';
            item.innerHTML = `
                <h3>${layer.label}</h3>
                <img src="https://gisjesusmaria.github.io/GeoReel/${IMG_DIR}${layer.name}.jpg" alt="Imagen de ${layer.label}">
            `;
            item.dataset.layerName = layer.name;

            // Mantener la selección visual al renderizar
            if (selectedLayers.some(sl => sl.name === layer.name)) {
                item.classList.add('selected');
            }

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
    
    // Navegación del carrusel
    prevBtn.addEventListener('click', () => {
        carouselContainer.scrollBy({ left: -310, behavior: 'smooth' });
    });
    nextBtn.addEventListener('click', () => {
        carouselContainer.scrollBy({ left: 310, behavior: 'smooth' });
    });
    
    // Botón para generar el mapa
    generateMapBtn.addEventListener('click', () => {
        selectionScreen.style.display = 'none';
        mapContainer.style.display = 'block';
        loader.style.display = 'block';
        // El timeout permite que el DOM se actualice antes de que el mapa empiece a cargar
        setTimeout(initMap, 100); 
    });

    // Botón para volver a la selección
    backBtn.addEventListener('click', () => {
        if (map) {
            map.remove();
            map = null;
        }
        mapContainer.style.display = 'none';
        selectionScreen.style.display = 'flex';
    });


    // --- Lógica del Mapa ---
    let map;
    let baseMaps = {};
    let overlayMaps = {};
    let layerControl;
    
    // Estilo por defecto si el archivo JSON de estilo no se encuentra o falla
    const defaultStyle = {
        color: '#ff7800',
        weight: 3,
        opacity: 0.8,
        fillColor: '#ff7800',
        fillOpacity: 0.3
    };

    // function initMap() {
    //     if (map) map.remove();
    //     map = L.map('map').setView(INITIAL_VIEW, INITIAL_ZOOM);
    //     overlayMaps = {}; // Limpiar capas anteriores

    //     const osm = L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 20, attribution: '&copy; OpenStreetMap' });
    //     const googleSat = L.tileLayer('http://{s}.google.com/vt/lyrs=s&x={x}&y={y}&z={z}',{ maxZoom: 20, subdomains:['mt0','mt1','mt2','mt3'] });
        
    //     osm.addTo(map);
    //     baseMaps = { "OpenStreetMap": osm, "Google Satellite": googleSat };
        
    //     const layerPromises = selectedLayers.map(layer => {
    //         const geojsonUrl = `${GITHUB_BASE_URL}${MAP_DIR}${layer.name}.geojson`;
    //         const styleUrl = `${GITHUB_BASE_URL}${STYLE_DIR}${layer.name}.json`;

    //         return Promise.all([
    //             fetch(geojsonUrl).then(res => res.ok ? res.json() : Promise.reject(`Error en GeoJSON: ${res.statusText}`)),
    //             fetch(styleUrl).then(res => res.ok ? res.json() : null) // No rechazar si el estilo falla, usar default
    //         ])
    //         .then(([geojsonData, styleData]) => {
    //             if (!geojsonData || !geojsonData.features) {
    //                 console.warn(`GeoJSON para "${layer.label}" está vacío o es inválido.`);
    //                 return;
    //             }

    //             const layerStyle = styleData ? styleData.style : defaultStyle;

    //             const geojsonLayer = L.geoJSON(geojsonData, {
    //                 style: layerStyle,
    //                 onEachFeature: function(feature, layer) {
    //                     let popupContent = `<h4>${feature.properties.nombre || 'Detalles'}</h4><table>`;
    //                     for (let prop in feature.properties) {
    //                         popupContent += `<tr><td style="padding-right:10px;"><strong>${prop}:</strong></td><td>${feature.properties[prop]}</td></tr>`;
    //                     }
    //                     popupContent += "</table>";
    //                     layer.bindPopup(popupContent);
    //                 }
    //             });
    //             overlayMaps[layer.label] = geojsonLayer;
    //         })
    //         .catch(error => console.error(`Error al cargar la capa "${layer.label}":`, error));
    //     });

    //     // Cuando todas las capas se hayan procesado (con éxito o no)
    //     Promise.allSettled(layerPromises).then(() => {
    //         Object.values(overlayMaps).forEach(l => l.addTo(map));
    //         updateLayerControl();
    //         loader.style.display = 'none'; // Ocultar el loader
    //         console.log("Mapa generado con las capas cargadas.");
    //     });
    // }

    //-------------------------------------------------------------------------------------------------

    // function initMap() {
    //     if (map) map.remove();
    //     map = L.map('map').setView(INITIAL_VIEW, INITIAL_ZOOM);
    //     overlayMaps = {}; // Limpiar capas anteriores

    //     const osm = L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 20, attribution: '&copy; OpenStreetMap' });
    //     const googleSat = L.tileLayer('http://{s}.google.com/vt/lyrs=s&x={x}&y={y}&z={z}',{ maxZoom: 20, subdomains:['mt0','mt1','mt2','mt3'] });
        
    //     osm.addTo(map);
    //     baseMaps = { "OpenStreetMap": osm, "Google Satellite": googleSat };
        
    //     const layerPromises = selectedLayers.map(layer => {
    //         const geojsonUrl = `${GITHUB_BASE_URL}${MAP_DIR}${layer.name}.geojson`;
    //         const styleUrl = `${GITHUB_BASE_URL}${STYLE_DIR}${layer.name}.json`;

    //         return Promise.all([
    //             fetch(geojsonUrl).then(res => res.ok ? res.json() : Promise.reject(`Error en GeoJSON: ${res.statusText}`)),
    //             fetch(styleUrl).then(res => res.ok ? res.json() : null) // No rechazar si el estilo falla
    //         ])
    //         .then(([geojsonData, styleData]) => {
    //             if (!geojsonData || !geojsonData.features) {
    //                 console.warn(`GeoJSON para "${layer.label}" está vacío o es inválido.`);
    //                 return;
    //             }

    //             // --- INICIO DE LA LÓGICA ACTUALIZADA ---
                
    //             let layerStyleOptions = {};

    //             if (styleData && styleData.type === 'categorized') {
    //                 // Si es un estilo categorizado, el "style" será una función
    //                 layerStyleOptions.style = function(feature) {
    //                     const attributeValue = feature.properties[styleData.attribute];
    //                     const category = styleData.categories.find(c => c.value === attributeValue);
    //                     return category ? category.style : styleData.default;
    //                 };
    //             } else {
    //                 // Si es un estilo simple o no se encontró el JSON, usamos la lógica anterior
    //                 layerStyleOptions.style = styleData ? styleData.style : defaultStyle;
    //             }

    //             // --- FIN DE LA LÓGICA ACTUALIZADA ---

    //             const geojsonLayer = L.geoJSON(geojsonData, {
    //                 ...layerStyleOptions, // Aplicamos las opciones de estilo (sea función u objeto)
    //                 onEachFeature: function(feature, layer) {
    //                     let popupContent = `<h4>${feature.properties.nombre || 'Detalles'}</h4><table>`;
    //                     for (let prop in feature.properties) {
    //                         popupContent += `<tr><td style="padding-right:10px;"><strong>${prop}:</strong></td><td>${feature.properties[prop]}</td></tr>`;
    //                     }
    //                     popupContent += "</table>";
    //                     layer.bindPopup(popupContent);
    //                 }
    //             });
    //             overlayMaps[layer.label] = geojsonLayer;
    //         })
    //         .catch(error => console.error(`Error al cargar la capa "${layer.label}":`, error));
    //     });

    //     // Cuando todas las capas se hayan procesado (con éxito o no)
    //     Promise.allSettled(layerPromises).then(() => {
    //         Object.values(overlayMaps).forEach(l => l.addTo(map));
    //         updateLayerControl();
    //         loader.style.display = 'none'; // Ocultar el loader
    //         console.log("Mapa generado con las capas cargadas.");

    //         // Ajustar el zoom para que se vean todas las capas
    //         const allLayersGroup = new L.featureGroup(Object.values(overlayMaps));
    //         if (Object.keys(allLayersGroup._layers).length > 0) {
    //             map.fitBounds(allLayersGroup.getBounds().pad(0.1));
    //         }
    //     });
    // }


    //-------------------------------------------------------------------------------------------------

    // function initMap() {
    //     if (map) map.remove();
    //     map = L.map('map').setView(INITIAL_VIEW, INITIAL_ZOOM);
    //     overlayMaps = {}; // Limpiar capas anteriores

    //     const osm = L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 20, attribution: '&copy; OpenStreetMap' });
    //     const googleSat = L.tileLayer('http://{s}.google.com/vt/lyrs=s&x={x}&y={y}&z={z}',{ maxZoom: 20, subdomains:['mt0','mt1','mt2','mt3'] });
        
    //     osm.addTo(map);
    //     baseMaps = { "OpenStreetMap": osm, "Google Satellite": googleSat };
        
    //     const layerPromises = selectedLayers.map(layer => {
    //         const geojsonUrl = `${GITHUB_BASE_URL}${MAP_DIR}${layer.name}.geojson`;
    //         const styleUrl = `${GITHUB_BASE_URL}${STYLE_DIR}${layer.name}.json`;

    //         return Promise.all([
    //             fetch(geojsonUrl).then(res => res.ok ? res.json() : Promise.reject(`Error en GeoJSON: ${res.statusText}`)),
    //             fetch(styleUrl).then(res => res.ok ? res.json() : null) // No rechazar si el estilo falla
    //         ])
    //         .then(([geojsonData, styleData]) => {
    //             if (!geojsonData || !geojsonData.features) {
    //                 console.warn(`GeoJSON para "${layer.label}" está vacío o es inválido.`);
    //                 return;
    //             }

    //             // Objeto para construir las opciones de la capa GeoJSON
    //             let geojsonOptions = {
    //                 onEachFeature: function(feature, layer) {
    //                     let popupContent = `<h4>${feature.properties.nombre || 'Detalles'}</h4><table>`;
    //                     for (let prop in feature.properties) {
    //                         popupContent += `<tr><td style="padding-right:10px;"><strong>${prop}:</strong></td><td>${feature.properties[prop]}</td></tr>`;
    //                     }
    //                     popupContent += "</table>";
    //                     layer.bindPopup(popupContent);
    //                 }
    //             };

    //             // --- LÓGICA MEJORADA PARA ESTILOS ---

    //             if (styleData && styleData.type === 'categorized') {
    //                 // 1. Maneja estilos categorizados (para líneas o polígonos)
    //                 geojsonOptions.style = function(feature) {
    //                     const attributeValue = feature.properties[styleData.attribute];
    //                     const category = styleData.categories.find(c => c.value === attributeValue);
    //                     return category ? category.style : styleData.default;
    //                 };
    //             } else if (styleData && styleData.style) {
    //                 // 2. Maneja estilos simples
    //                 geojsonOptions.style = styleData.style;
                    
    //                 // 3. ¡NUEVO! Si el estilo tiene un radio, es una capa de puntos.
    //                 //    Le decimos a Leaflet que dibuje Círculos en lugar de Pines.
    //                 if (styleData.style.radius !== undefined) {
    //                     geojsonOptions.pointToLayer = function (feature, latlng) {
    //                         return L.circleMarker(latlng, styleData.style);
    //                     };
    //                 }
    //             } else {
    //                 // Estilo por defecto si no hay JSON
    //                 geojsonOptions.style = defaultStyle;
    //             }

    //             const geojsonLayer = L.geoJSON(geojsonData, geojsonOptions);
    //             overlayMaps[layer.label] = geojsonLayer;
    //         })
    //         .catch(error => console.error(`Error al cargar la capa "${layer.label}":`, error));
    //     });

    //     // (El resto de la función no cambia)
    //     Promise.allSettled(layerPromises).then(() => {
    //         Object.values(overlayMaps).forEach(l => l.addTo(map));
    //         updateLayerControl();
    //         loader.style.display = 'none';
    //         console.log("Mapa generado con las capas cargadas.");

    //         const allLayersGroup = new L.featureGroup(Object.values(overlayMaps));
    //         if (Object.keys(allLayersGroup._layers).length > 0) {
    //             map.fitBounds(allLayersGroup.getBounds().pad(0.1));
    //         }
    //     });
    // }


    // --- NUEVA FUNCIÓN AUXILIAR ---
// Esta función toma un objeto de estilo y crea un pequeño HTML para la leyenda.
function createLegendHtml(style) {
    if (!style) return '';

    let styles = `background-color: ${style.fillColor || 'transparent'};`;
    let cssClass = 'legend-icon';

    if (style.radius) { // Es un punto (circleMarker)
        cssClass += ' legend-icon-point';
        styles += ` border: 1px solid ${style.color || '#000'};`;
    } else if (!style.fillColor && style.color) { // Es una línea
        cssClass += ' legend-icon-line';
        styles = `background-color: ${style.color};`;
    } else { // Es un polígono
        styles += ` border: 1px solid ${style.color || '#000'};`;
    }
    
    return `<span class="${cssClass}" style="${styles}"></span>`;
}


function initMap() {
    if (map) map.remove();
    map = L.map('map').setView(INITIAL_VIEW, INITIAL_ZOOM);
    overlayMaps = {}; // Limpiar capas anteriores

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
            if (!geojsonData || !geojsonData.features) {
                console.warn(`GeoJSON para "${layer.label}" está vacío o es inválido.`);
                return;
            }

            let geojsonOptions = {
                onEachFeature: function(feature, layer) {
                    let popupContent = `<h4>${feature.properties.nombre || 'Detalles'}</h4><table>`;
                    for (let prop in feature.properties) {
                        popupContent += `<tr><td style="padding-right:10px;"><strong>${prop}:</strong></td><td>${feature.properties[prop]}</td></tr>`;
                    }
                    popupContent += "</table>";
                    layer.bindPopup(popupContent);
                }
            };
            
            // --- LÓGICA DE ESTILOS Y LEYENDA MODIFICADA ---
            let legendKey = layer.label; // Por defecto, el nombre de la capa es la clave

            if (styleData && styleData.type === 'categorized') {
                geojsonOptions.style = function(feature) {
                    const attributeValue = feature.properties[styleData.attribute];
                    const category = styleData.categories.find(c => c.value === attributeValue);
                    return category ? category.style : styleData.default;
                };
                // Para capas categorizadas, no generamos un ícono simple en la leyenda por ahora.
                legendKey = `<span class="legend-icon" style="background-color:#ccc;"></span> ${layer.label}`;

            } else if (styleData && styleData.style) {
                geojsonOptions.style = styleData.style;
                if (styleData.style.radius !== undefined) {
                    geojsonOptions.pointToLayer = function (feature, latlng) {
                        return L.circleMarker(latlng, styleData.style);
                    };
                }
                // ¡NUEVO! Creamos la clave para la leyenda con el ícono y el nombre.
                legendKey = createLegendHtml(styleData.style) + ' ' + layer.label;

            } else {
                geojsonOptions.style = defaultStyle;
            }

            const geojsonLayer = L.geoJSON(geojsonData, geojsonOptions);
            // Usamos la nueva clave (con HTML) para el panel de control
            overlayMaps[legendKey] = geojsonLayer;
        })
        .catch(error => console.error(`Error al cargar la capa "${layer.label}":`, error));
    });

    Promise.allSettled(layerPromises).then(() => {
        Object.values(overlayMaps).forEach(l => l.addTo(map));
        updateLayerControl();
        loader.style.display = 'none';
        console.log("Mapa generado con las capas cargadas.");

        const allLayersGroup = new L.featureGroup(Object.values(overlayMaps));
        if (Object.keys(allLayersGroup._layers).length > 0) {
            map.fitBounds(allLayersGroup.getBounds().pad(0.1));
        }
    });
}

    function updateLayerControl() {
        if (layerControl) {
            map.removeControl(layerControl);
        }
        layerControl = L.control.layers(baseMaps, overlayMaps).addTo(map);
    }
    
    // Iniciar la aplicación
    renderCarousel();
});