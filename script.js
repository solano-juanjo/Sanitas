// JavaScript para el escáner de códigos de barras
document.addEventListener('DOMContentLoaded', function () {
    const startButton = document.getElementById('start-button');
    const stopButton = document.getElementById('stop-button');
    const resultDiv = document.getElementById('result');
    const historyList = document.getElementById('history-list');
    const statusDiv = document.getElementById('status');
    
    let scannerIsRunning = false;
    let scanHistory = [];
    
    // Verificar soporte de navegador para acceso a la cámara
    function checkBrowserSupport() {
        // Comprobar si el navegador soporta getUserMedia
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
    function startScanner() {
        // Verificar compatibilidad primero
        if (!checkBrowserSupport()) {
            statusDiv.textContent = "Error: Tu navegador no soporta acceso a la cámara";
            return;
        }
        
        // Configurar polyfill para navegadores antiguos
        setupUserMediaPolyfill();
        
        statusDiv.textContent = "Solicitando acceso a la cámara...";
        
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
                    debug: {
                        showCanvas: true,
                        showPatches: true,
                        showFoundPatches: true,
                        showSkeleton: true,
                        showLabels: true,
                        showPatchLabels: true,
                        showRemainingPatchLabels: true,
                        boxFromPatches: {
                            showTransformed: true,
                            showTransformedBox: true,
                            showBB: true
                        }
                    }
                },
            }, function (err) {
                if (err) {
                    console.error("Error de inicialización de Quagga:", err);
                    statusDiv.textContent = `Error al iniciar la cámara: ${err}`;
                    return;
                }
                
                statusDiv.textContent = "Cámara activada. Apunta al código de barras.";
                scannerIsRunning = true;
                Quagga.start();
                
                // Actualizar botones
                startButton.disabled = true;
                stopButton.disabled = false;
            });
            
            // Procesar cuando se detecta un código de barras
            Quagga.onDetected(function (result) {
                if (result && result.codeResult && result.codeResult.code) {
                    const code = result.codeResult.code;
                    resultDiv.textContent = `Código: ${code}`;
                    
                    // Agregar al historial
                    const now = new Date();
                    const timestamp = now.toLocaleTimeString();
                    scanHistory.unshift({
                        code: code,
                        time: timestamp
                    });
                    
                    // Actualizar lista de historial
                    updateHistoryList();
                    
                    // Reproducir sonido de éxito (beep)
                    try {
                        playBeep();
                    } catch (e) {
                        console.log("No se pudo reproducir el sonido:", e);
                    }
                }
            });
            
            // Manejar errores durante el proceso
            Quagga.onProcessed(function(result) {
                // Aquí se podría agregar lógica para mejorar la experiencia de usuario
            });
        } catch (error) {
            console.error("Error general al iniciar el escáner:", error);
            statusDiv.textContent = `Error: ${error.message || "No se pudo iniciar el escáner"}`;
        }
    }
    
    // Función para detener el escáner
    function stopScanner() {
        if (scannerIsRunning) {
            try {
                Quagga.stop();
                scannerIsRunning = false;
                statusDiv.textContent = "Escáner detenido";
                
                // Actualizar botones
                startButton.disabled = false;
                stopButton.disabled = true;
            } catch (error) {
                console.error("Error al detener el escáner:", error);
            }
        }
    }
    
    // Función para actualizar la lista de historial
    function updateHistoryList() {
        // Limpiar lista actual
        historyList.innerHTML = '';
        
        // Si no hay elementos, mostrar mensaje
        if (scanHistory.length === 0) {
            historyList.innerHTML = '<div class="history-item">Aún no hay códigos escaneados</div>';
            return;
        }
        
        // Agregar cada elemento del historial
        scanHistory.forEach(function(item) {
            const historyItem = document.createElement('div');
            historyItem.className = 'history-item';
            historyItem.textContent = `${item.time}: ${item.code}`;
            historyList.appendChild(historyItem);
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
    
    // Event listeners para los botones
    startButton.addEventListener('click', startScanner);
    stopButton.addEventListener('click', stopScanner);
    
    // Detectar cuando la página se cierra o se cambia para detener el escáner
    window.addEventListener('beforeunload', stopScanner);
    document.addEventListener('visibilitychange', function() {
        if (document.hidden && scannerIsRunning) {
            stopScanner();
        }
    });
});
