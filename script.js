// JavaScript para la aplicación de escáner multifunción
document.addEventListener('DOMContentLoaded', function () {
    // --------- VARIABLES Y ELEMENTOS DOM ---------
    // Elementos para las pestañas
    const barcodeTab = document.getElementById('barcode-tab');
    const bleTab = document.getElementById('ble-tab');
    const barcodeSection = document.getElementById('barcode-section');
    const bleSection = document.getElementById('ble-section');
    
    // Elementos para el escáner de códigos de barras
    const startBarcodeButton = document.getElementById('start-barcode-button');
    const stopBarcodeButton = document.getElementById('stop-barcode-button');
    const barcodeResultDiv = document.getElementById('barcode-result');
    const barcodeHistoryList = document.getElementById('barcode-history');
    const barcodeStatusDiv = document.getElementById('barcode-status');
    
    // Elementos para BLE
    const startBleButton = document.getElementById('start-ble-button');
    const stopBleButton = document.getElementById('stop-ble-button');
    const bleResultDiv = document.getElementById('ble-result');
    const bleDevicesList = document.getElementById('ble-devices-list');
    const bleStatusDiv = document.getElementById('ble-status');
    
    // Variables de estado
    let scannerIsRunning = false;
    let bleIsScanning = false;
    let scanHistory = [];
    let bleDevices = new Map(); // Para almacenar dispositivos BLE encontrados
    
    // --------- NAVEGACIÓN DE PESTAÑAS ---------
    barcodeTab.addEventListener('click', function() {
        showTab('barcode');
    });
    
    bleTab.addEventListener('click', function() {
        showTab('ble');
    });
    
    function showTab(tabName) {
        // Desactivar todas las pestañas y secciones
        barcodeTab.classList.remove('active');
        bleTab.classList.remove('active');
        barcodeSection.classList.remove('active');
        bleSection.classList.remove('active');
        
        // Activar la pestaña y sección seleccionada
        if (tabName === 'barcode') {
            barcodeTab.classList.add('active');
            barcodeSection.classList.add('active');
        } else if (tabName === 'ble') {
            bleTab.classList.add('active');
            bleSection.classList.add('active');
        }
    }
    
    // --------- CÓDIGO DE BARRAS ---------
    // Verificar soporte de navegador para acceso a la cámara
    function checkCameraSupport() {
        if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
            return true;
        } else if (navigator.getUserMedia || navigator.webkitGetUserMedia || 
                   navigator.mozGetUserMedia || navigator.msGetUserMedia) {
            return true;
        }
        return false;
    }
    
    // Polyfill para navegadores antiguos
    function setupUserMediaPolyfill() {
        navigator.getUserMedia = navigator.getUserMedia ||
                                navigator.webkitGetUserMedia ||
                                navigator.mozGetUserMedia ||
                                navigator.msGetUserMedia;
        
        if (!navigator.mediaDevices) {
            navigator.mediaDevices = {};
        }
        
        if (!navigator.mediaDevices.getUserMedia) {
            navigator.mediaDevices.getUserMedia = function(constraints) {
                var getUserMedia = navigator.getUserMedia;
                
                if (!getUserMedia) {
                    return Promise.reject(new Error('getUserMedia no está implementado en este navegador'));
                }
                
                return new Promise(function(resolve, reject) {
                    getUserMedia.call(navigator, constraints, resolve, reject);
                });
            };
        }
    }
    
    // Función para iniciar el escáner
    function startBarcodeScanner() {
        // Verificar compatibilidad primero
        if (!checkCameraSupport()) {
            barcodeStatusDiv.textContent = "Error: Tu navegador no soporta acceso a la cámara";
            return;
        }
        
        // Configurar polyfill para navegadores antiguos
        setupUserMediaPolyfill();
        
        barcodeStatusDiv.textContent = "Solicitando acceso a la cámara...";
        
        // Solicitar permisos de la cámara explícitamente primero
        navigator.mediaDevices.getUserMedia({ video: { facingMode: "environment" } })
            .then(function(stream) {
                // Liberar el stream inmediatamente, Quagga lo solicitará de nuevo
                const tracks = stream.getTracks();
                tracks.forEach(track => track.stop());
                
                // Ahora que tenemos los permisos, iniciar Quagga
                startQuagga();
            })
            .catch(function(err) {
                console.error("Error al solicitar permisos de cámara:", err);
                barcodeStatusDiv.textContent = `Error de permisos: ${err.message || "No se pudo acceder a la cámara"}`;
            });
    }
    
    // Función para iniciar Quagga después de obtener permisos
    function startQuagga() {
        try {
            Quagga.init({
                inputStream: {
                    name: "Live",
                    type: "LiveStream",
                    target: document.querySelector('#scanner-container'),
                    constraints: {
                        width: { min: 640 },
                        height: { min: 480 },
                        aspectRatio: { min: 1, max: 2 },
                        facingMode: "environment" // Usar cámara trasera
                    },
                },
                locator: {
                    patchSize: "medium",
                    halfSample: true
                },
                numOfWorkers: 2,
                frequency: 10,
                decoder: {
                    readers: [
                        "code_128_reader",
                        "ean_reader",
                        "ean_8_reader",
                        "code_39_reader",
                        "code_39_vin_reader",
                        "codabar_reader",
                        "upc_reader",
                        "upc_e_reader",
                        "i2of5_reader"
                    ],
                },
            }, function (err) {
                if (err) {
                    console.error("Error de inicialización de Quagga:", err);
                    barcodeStatusDiv.textContent = `Error al iniciar la cámara: ${err}`;
                    return;
                }
                
                barcodeStatusDiv.textContent = "Cámara activada. Apunta al código de barras.";
                scannerIsRunning = true;
                Quagga.start();
                
                // Actualizar botones
                startBarcodeButton.disabled = true;
                stopBarcodeButton.disabled = false;
            });
            
            // Procesar cuando se detecta un código de barras
            Quagga.onDetected(function (result) {
                if (result && result.codeResult && result.codeResult.code) {
                    const code = result.codeResult.code;
                    barcodeResultDiv.textContent = `Código: ${code}`;
                    
                    // Agregar al historial
                    const now = new Date();
                    const timestamp = now.toLocaleTimeString();
                    scanHistory.unshift({
                        code: code,
                        time: timestamp
                    });
                    
                    // Actualizar lista de historial
                    updateBarcodeHistoryList();
                    
                    // Reproducir sonido de éxito (beep)
                    try {
                        playBeep();
                    } catch (e) {
                        console.log("No se pudo reproducir el sonido:", e);
                    }
                }
            });
            
        } catch (error) {
            console.error("Error general al iniciar el escáner:", error);
            barcodeStatusDiv.textContent = `Error: ${error.message || "No se pudo iniciar el escáner"}`;
        }
    }
    
    // Función para detener el escáner
    function stopBarcodeScanner() {
        if (scannerIsRunning) {
            try {
                Quagga.stop();
                scannerIsRunning = false;
                barcodeStatusDiv.textContent = "Escáner detenido";
                
                // Actualizar botones
                startBarcodeButton.disabled = false;
                stopBarcodeButton.disabled = true;
            } catch (error) {
                console.error("Error al detener el escáner:", error);
            }
        }
    }
    
    // Función para actualizar la lista de historial de códigos
    function updateBarcodeHistoryList() {
        // Limpiar lista actual
        barcodeHistoryList.innerHTML = '';
        
        // Si no hay elementos, mostrar mensaje
        if (scanHistory.length === 0) {
            barcodeHistoryList.innerHTML = '<div class="history-item">Aún no hay códigos escaneados</div>';
            return;
        }
        
        // Agregar cada elemento del historial
        scanHistory.forEach(function(item) {
            const historyItem = document.createElement('div');
            historyItem.className = 'history-item';
            historyItem.textContent = `${item.time}: ${item.code}`;
            barcodeHistoryList.appendChild(historyItem);
        });
    }
    
    // Función para reproducir beep
    function playBeep() {
        try {
            const audioContext = new (window.AudioContext || window.webkitAudioContext)();
            const oscillator = audioContext.createOscillator();
            const gainNode = audioContext.createGain();
            
            oscillator.type = 'sine';
            oscillator.frequency.value = 800;
            gainNode.gain.value = 0.5;
            
            oscillator.connect(gainNode);
            gainNode.connect(audioContext.destination);
            
            oscillator.start(audioContext.currentTime);
            oscillator.stop(audioContext.currentTime + 0.15);
        } catch (e) {
            console.log("Error al reproducir sonido:", e);
        }
    }
    
    // --------- BLUETOOTH LOW ENERGY (BLE) ---------
    // Verificar soporte de BLE
    function checkBleSupport() {
        return 'bluetooth' in navigator;
    }
    
    // Función para iniciar la búsqueda de dispositivos BLE
    function startBleScan() {
        if (!checkBleSupport()) {
            bleStatusDiv.textContent = "Error: Tu navegador no soporta Bluetooth Low Energy";
            return;
        }
        
        bleStatusDiv.textContent = "Solicitando permisos de Bluetooth...";
        bleResultDiv.textContent = "Buscando dispositivos BLE cercanos...";
        
        // Limpiar dispositivos anteriores
        bleDevices.clear();
        updateBleDevicesList();
        
        try {
            navigator.bluetooth.requestDevice({
                // Aceptar todos los dispositivos disponibles
                acceptAllDevices: true,
                optionalServices: [] // Sin servicios específicos
            })
            .then(device => {
                bleIsScanning = false;
                bleStatusDiv.textContent = "Dispositivo seleccionado";
                // Guardar el dispositivo seleccionado
                const deviceInfo = {
                    id: device.id || 'Desconocido',
                    name: device.name || 'Dispositivo sin nombre',
                    connected: device.gatt.connected
                };
                
                bleDevices.set(device.id, deviceInfo);
                updateBleDevicesList();
                
                // Actualizar botones
                startBleButton.disabled = false;
                stopBleButton.disabled = true;
            })
            .catch(error => {
                console.error('Error al buscar dispositivos BLE:', error);
                bleStatusDiv.textContent = `Error: ${error.message || "No se pudo iniciar la búsqueda de dispositivos Bluetooth"}`;
                bleIsScanning = false;
                
                // Actualizar botones
                startBleButton.disabled = false;
                stopBleButton.disabled = true;
            });
            
            bleIsScanning = true;
            // Actualizar botones
            startBleButton.disabled = true;
            stopBleButton.disabled = false;
            
        } catch (error) {
            console.error("Error general con Bluetooth:", error);
            bleStatusDiv.textContent = `Error: ${error.message || "No se pudo iniciar Bluetooth"}`;
        }
    }
    
    // Función para detener la búsqueda de dispositivos BLE
    function stopBleScan() {
        if (bleIsScanning) {
            bleIsScanning = false;
            bleStatusDiv.textContent = "Búsqueda de dispositivos detenida";
            
            // Actualizar botones
            startBleButton.disabled = false;
            stopBleButton.disabled = true;
        }
    }
    
    // Función para actualizar la lista de dispositivos BLE
    function updateBleDevicesList() {
        const deviceListContainer = document.querySelector('#ble-devices-list .device-list-container');
        
        // Limpiar lista actual
        deviceListContainer.innerHTML = '';
        
        // Si no hay dispositivos, mostrar mensaje
        if (bleDevices.size === 0) {
            deviceListContainer.innerHTML = '<div class="device-item">No se han encontrado dispositivos</div>';
            return;
        }
        
        // Agregar cada dispositivo a la lista
        bleDevices.forEach(function(device) {
            const deviceItem = document.createElement('div');
            deviceItem.className = 'device-item';
            
            const deviceName = document.createElement('div');
            deviceName.className = 'device-name';
            deviceName.textContent = device.name;
            
            const deviceId = document.createElement('div');
            deviceId.className = 'device-id';
            deviceId.textContent = `ID: ${device.id}`;
            
            const deviceStatus = document.createElement('div');
            deviceStatus.className = 'device-status';
            deviceStatus.textContent = device.connected ? 'Conectado' : 'Desconectado';
            
            deviceItem.appendChild(deviceName);
            deviceItem.appendChild(deviceId);
            deviceItem.appendChild(deviceStatus);
            
            deviceListContainer.appendChild(deviceItem);
        });
    }
    
    // --------- EVENT LISTENERS ---------
    // Event listeners para los botones de código de barras
    startBarcodeButton.addEventListener('click', startBarcodeScanner);
    stopBarcodeButton.addEventListener('click', stopBarcodeScanner);
    
    // Event listeners para los botones BLE
    startBleButton.addEventListener('click', startBleScan);
    stopBleButton.addEventListener('click', stopBleScan);
    
    // Detectar cuando la página se cierra o se cambia para detener los procesos
    window.addEventListener('beforeunload', function() {
        stopBarcodeScanner();
        stopBleScan();
    });
    
    document.addEventListener('visibilitychange', function() {
        if (document.hidden) {
            if (scannerIsRunning) stopBarcodeScanner();
            if (bleIsScanning) stopBleScan();
        }
    });
    
    // Inicializar las vistas
    updateBarcodeHistoryList();
    updateBleDevicesList();
});
