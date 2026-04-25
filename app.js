/**
 * ============================================
 * SPEED READER - APLICACIÓN DE LECTURA RÁPIDA
 * ============================================
 * 
 * Esta aplicación permite leer texto palabra por palabra
 * con la técnica de focalización en una letra específica.
 * 
 * Características:
 * - Visualización de una palabra a la vez
 * - Resaltado de letra específica en rojo (posición estática)
 * - Control de velocidad (100-1000 WPM)
 * - Pausa inteligente después de puntos
 * - Carga de archivos PDF
 */

// ============================================
// CONFIGURACIÓN DE PDF.JS
// ============================================
pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';

// ============================================
// CLASE PRINCIPAL SPEEDREADER
// ============================================
class SpeedReader {
    constructor() {
        // Estado de la aplicación
        this.words = [];
        this.currentIndex = 0;
        this.isPlaying = false;
        this.isPaused = false;
        this.timerId = null;
        
        // Configuración por defecto
        this.wpm = 250;
        this.pauseAfterPeriod = true;
        this.pauseDuration = 0.3;
        
        // Inicializar
        this.initDOMReferences();
        this.initEventListeners();
        this.loadSettings();
    }

    // ============================================
    // INICIALIZACIÓN DE REFERENCIAS DOM
    // ============================================
    initDOMReferences() {
        this.wordContainer = document.getElementById('wordContainer');
        this.wordDisplay = document.getElementById('wordDisplay');
        this.progressBar = document.getElementById('progressBar');
        this.wordCount = document.getElementById('wordCount');
        this.currentPosition = document.getElementById('currentPosition');
        this.timeRemaining = document.getElementById('timeRemaining');
        this.wpmDisplay = document.getElementById('wpmDisplay');
        this.speedSlider = document.getElementById('speedSlider');
        this.startBtn = document.getElementById('startBtn');
        this.pauseBtn = document.getElementById('pauseBtn');
        this.stopBtn = document.getElementById('stopBtn');
        this.pauseAfterPeriodCheckbox = document.getElementById('pauseAfterPeriod');
        this.pauseDurationInput = document.getElementById('pauseDuration');
        this.textInput = document.getElementById('textInput');
        this.pdfInput = document.getElementById('pdfInput');
        this.fileName = document.getElementById('fileName');
    }

    // ============================================
    // INICIALIZACIÓN DE EVENT LISTENERS
    // ============================================
    initEventListeners() {
        this.speedSlider.addEventListener('input', () => {
            this.wpm = parseInt(this.speedSlider.value);
            this.wpmDisplay.textContent = `${this.wpm} WPM`;
            this.updateTimeRemaining();
            this.saveSettings();
        });
	// Configuración de pausa inteligente
        this.pauseAfterPeriodCheckbox.addEventListener('change', () => {
            this.pauseAfterPeriod = this.pauseAfterPeriodCheckbox.checked;
            this.saveSettings();
        });

        this.pauseDurationInput.addEventListener('change', () => {
            this.pauseDuration = parseFloat(this.pauseDurationInput.value);
            this.saveSettings();
        });
	// Controles de reproducción
        this.startBtn.addEventListener('click', () => this.start());
        this.pauseBtn.addEventListener('click', () => this.togglePause());
        this.stopBtn.addEventListener('click', () => this.stop());
        
	// Entrada de texto
	this.textInput.addEventListener('input', () => this.processText());
      
	// Carga de PDF
        this.pdfInput.addEventListener('change', (e) => this.handlePDFUpload(e));
    }

    // ============================================
    // PROCESAMIENTO DE TEXTO
    // ============================================
    processText() {
        const text = this.textInput.value.trim();
        
        if (text) {
            this.words = text.split(/\s+/).filter(word => word.length > 0);
            this.currentIndex = 0;
            this.wordCount.textContent = `Palabras: ${this.words.length}`;
            this.updateCurrentPosition();
            this.updateTimeRemaining();
            this.displayWord(this.words[0]);
        } else {
            this.words = [];
            this.wordContainer.innerHTML = '<span class="word-placeholder">Pega texto o carga un PDF para comenzar</span>';
            this.wordCount.textContent = 'Palabras: 0';
            this.currentPosition.textContent = 'Posición: 0 / 0';
            this.timeRemaining.textContent = 'Tiempo restante: 0:00';
        }
        
        this.updateProgressBar();
    }

    // ============================================
    // REGLAS PARA DETERMINAR LA LETRA A RESALTAR
    // ============================================
    /**
     * Determina el índice de la letra a resaltar según las reglas:
     * - 1 letra: resaltar esa única letra (índice 0)
     * - 2 letras: resaltar la segunda letra (índice 1)
     * - 3-8 letras: resaltar la tercera letra (índice 2)
     * - Más de 8 letras: resaltar la cuarta letra (índice 3)
     * 
     * @param {number} length - Longitud de la palabra
     * @returns {number} - Índice de la letra a resaltar
     */
    getHighlightIndex(length) {
        if (length === 1) {
            return 0;  // Única letra
        } else if (length === 2) {
            return 1;  // Segunda letra
        } else if (length >= 3 && length <= 8) {
            return 2;  // Tercera letra
        } else {
            return 3;  // Cuarta letra (más de 8 letras)
        }
    }

    // ============================================
    // VISUALIZACIÓN DE PALABRAS
    // ============================================
    /**
     * Muestra una palabra con la letra resaltada en rojo.
     * 
     * REGLA IMPORTANTE: La letra resaltada en rojo permanece SIEMPRE
     * en la MISMA POSICIÓN FIJA en el centro de la pantalla.
     * Las demás letras se "desplazan" alrededor de ella.
     * 
     * @param {string} word - La palabra a mostrar
     */
    displayWord(word) {
        if (!word) {
            this.wordContainer.innerHTML = '<span class="word-placeholder">Fin del texto</span>';
            return;
        }

        const length = word.length;
        const highlightIndex = this.getHighlightIndex(length);
        
        // Obtener las partes de la palabra
        const beforeHighlight = word.substring(0, highlightIndex);
        const highlightLetter = word.charAt(highlightIndex);
        const afterHighlight = word.substring(highlightIndex + 1);
        
        // Estructura HTML para posición fija de la letra roja
        // La letra roja se posiciona absolutamente en el centro
        // Las partes izquierda y derecha se ajustan alrededor
        this.wordContainer.innerHTML = 
            `<span class="word-part-left">${this.escapeHTML(beforeHighlight)}</span>` +
            `<span class="highlight-letter">${this.escapeHTML(highlightLetter)}</span>` +
            `<span class="word-part-right">${this.escapeHTML(afterHighlight)}</span>`;
    }

    /**
     * Escapa caracteres HTML para prevenir XSS
     * @param {string} text - Texto a escapar
     * @returns {string} - Texto escapado
     */
    escapeHTML(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    // ============================================
    // CONTROL DE REPRODUCCIÓN
    // ============================================
    start() {
        if (this.words.length === 0) {
            alert('Por favor, ingresa texto o carga un PDF antes de iniciar.');
            return;
        }

        this.isPlaying = true;
        this.isPaused = false;
        
        this.startBtn.disabled = true;
        this.pauseBtn.disabled = false;
        this.stopBtn.disabled = false;
        this.pauseBtn.textContent = '⏸️ Pausar';
        
        this.wordDisplay.classList.add('reading-active');
        this.showNextWord();
    }

    togglePause() {
        if (this.isPaused) {
            this.isPaused = false;
            this.pauseBtn.textContent = '⏸️ Pausar';
            this.showNextWord();
        } else {
            this.isPaused = true;
            this.pauseBtn.textContent = '▶️ Reanudar';
            if (this.timerId) {
                clearTimeout(this.timerId);
                this.timerId = null;
            }
        }
    }

    stop() {
        this.isPlaying = false;
        this.isPaused = false;
        
        if (this.timerId) {
            clearTimeout(this.timerId);
            this.timerId = null;
        }
        
        this.currentIndex = 0;
        
        this.startBtn.disabled = false;
        this.pauseBtn.disabled = true;
        this.stopBtn.disabled = true;
        this.pauseBtn.textContent = '⏸️ Pausar';
        
        this.wordDisplay.classList.remove('reading-active');
        
        if (this.words.length > 0) {
            this.displayWord(this.words[0]);
        }
        
        this.updateCurrentPosition();
        this.updateProgressBar();
    }

    // ============================================
    // LÓGICA DE MOSTRAR PALABRAS
    // ============================================
    showNextWord() {
        if (!this.isPlaying || this.isPaused) {
            return;
        }

        if (this.currentIndex >= this.words.length) {
            this.finishReading();
            return;
        }

        const currentWord = this.words[this.currentIndex];
        this.displayWord(currentWord);
        
        this.updateCurrentPosition();
        this.updateProgressBar();

        let delay = 60000 / this.wpm;

        if (this.pauseAfterPeriod && currentWord.endsWith('.')) {
            delay += this.pauseDuration * 1000;
        }

        this.currentIndex++;
        this.updateTimeRemaining();

        this.timerId = setTimeout(() => this.showNextWord(), delay);
    }

    finishReading() {
        this.isPlaying = false;
        this.isPaused = false;
        
        this.startBtn.disabled = false;
        this.pauseBtn.disabled = true;
        this.stopBtn.disabled = true;
        
        this.wordDisplay.classList.remove('reading-active');
        this.wordContainer.innerHTML = '<span class="word-placeholder">✅ ¡Lectura completada!</span>';
        
        this.currentIndex = 0;
    }

    // ============================================
    // ACTUALIZACIÓN DE INFORMACIÓN
    // ============================================
    updateCurrentPosition() {
        const displayIndex = Math.min(this.currentIndex + 1, this.words.length);
        this.currentPosition.textContent = `Posición: ${displayIndex} / ${this.words.length}`;
    }

    updateProgressBar() {
        const progress = this.words.length > 0 
            ? (this.currentIndex / this.words.length) * 100 
            : 0;
        this.progressBar.style.width = `${progress}%`;
    }

    updateTimeRemaining() {
        if (this.words.length === 0) {
            this.timeRemaining.textContent = 'Tiempo restante: 0:00';
            return;
        }

        const wordsRemaining = this.words.length - this.currentIndex;
        const minutesRemaining = wordsRemaining / this.wpm;
        
        const minutes = Math.floor(minutesRemaining);
        const seconds = Math.round((minutesRemaining - minutes) * 60);
        
        this.timeRemaining.textContent = `Tiempo restante: ${minutes}:${seconds.toString().padStart(2, '0')}`;
    }

    // ============================================
    // MANEJO DE PDFs
    // ============================================
    async handlePDFUpload(e) {
        const file = e.target.files[0];
        
        if (!file) {
            return;
        }

        if (file.type !== 'application/pdf') {
            alert('Por favor, selecciona un archivo PDF válido.');
            return;
        }

        this.fileName.textContent = file.name;

        try {
            const arrayBuffer = await file.arrayBuffer();
            const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
            
            let fullText = '';
            
            for (let i = 1; i <= pdf.numPages; i++) {
                const page = await pdf.getPage(i);
                const textContent = await page.getTextContent();
                
                const pageText = textContent.items
                    .map(item => item.str)
                    .join(' ');
                
                fullText += pageText + '\n';
            }
            
            this.textInput.value = fullText.trim();
            this.processText();
            
        } catch (error) {
            console.error('Error al procesar el PDF:', error);
            alert('Error al procesar el PDF. Asegúrate de que el archivo no esté corrupto.');
        }
    }

    // ============================================
    // GUARDADO Y CARGA DE CONFIGURACIÓN
    // ============================================
    saveSettings() {
        const settings = {
            wpm: this.wpm,
            pauseAfterPeriod: this.pauseAfterPeriod,
            pauseDuration: this.pauseDuration
        };
        localStorage.setItem('speedReaderSettings', JSON.stringify(settings));
    }

    loadSettings() {
        const savedSettings = localStorage.getItem('speedReaderSettings');
        
        if (savedSettings) {
            try {
                const settings = JSON.parse(savedSettings);
                
                this.wpm = settings.wpm || 250;
                this.pauseAfterPeriod = settings.pauseAfterPeriod !== undefined 
                    ? settings.pauseAfterPeriod 
                    : true;
                this.pauseDuration = settings.pauseDuration || 0.3;
                
                this.speedSlider.value = this.wpm;
                this.wpmDisplay.textContent = `${this.wpm} WPM`;
                this.pauseAfterPeriodCheckbox.checked = this.pauseAfterPeriod;
                this.pauseDurationInput.value = this.pauseDuration;
                
            } catch (error) {
                console.error('Error al cargar configuración:', error);
            }
        }
    }
}

// ============================================
// INICIALIZACIÓN DE LA APLICACIÓN
// ============================================
document.addEventListener('DOMContentLoaded', () => {
    window.speedReader = new SpeedReader();
    console.log('⚡ Speed Reader iniciado correctamente');
});