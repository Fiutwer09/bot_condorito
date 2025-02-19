require('dotenv').config();

const API_KEY_GEMINI = process.env.API_KEY_GEMINI;

const GENERATION_CONFIG = {
    temperature: 0.8,
    topP: 0.8,
    topK: 40,
    maxOutputTokens: 2048
};

// Mejorar las categorías para buscar más información
const CATEGORIES = {
    RUTAS: ['ruta', 'sendero', 'camino', 'recorrido', 'trayecto', 'caminata', 'cabalgata', 'tour'],
    EMPRESA: ['explococora', 'empresa', 'servicio', 'quienes', 'equipo', 'historia', 'valle', 'cocora'],
    ACTIVIDADES: ['actividad', 'cabalgata', 'caminata', 'tour', 'visita', 'fotografía', 'avistamiento'],
    PRECIOS: ['precio', 'costo', 'valor', 'tarifa', 'pago', 'descuento', 'promoción'],
    HORARIOS: ['horario', 'hora', 'tiempo', 'duración', 'cuando', 'días', 'abierto'],
    SEGURIDAD: ['seguridad', 'seguro', 'protección', 'cuidado', 'riesgo', 'emergencia'],
    ACCESIBILIDAD: ['accesible', 'discapacidad', 'movilidad', 'silla', 'adulto mayor', 'niños'],
    SERVICIOS: ['guía', 'equipo', 'alquiler', 'transporte', 'comida', 'restaurante', 'mascota']
};

const findInJsonContext = (question) => {
    try {
        const jsonData = require('./qa_data.json');
        const normalizedQuestion = question.toLowerCase()
            .normalize("NFD")
            .replace(/[\u0300-\u036f]/g, "")
            .trim();

        // Mejorar la detección de categorías relevantes
        const relevantCategories = Object.entries(CATEGORIES).filter(([_, keywords]) =>
            keywords.some(keyword => normalizedQuestion.includes(keyword))
        ).map(([category]) => category);

        let contextInfo = {
            directMatches: [],
            relatedInfo: {
                rutas: [],
                empresa: [],
                actividades: [],
                precios: [],
                horarios: [],
                seguridad: [],
                accesibilidad: [],
                servicios: []
            }
        };

        // Buscar en preguntas frecuentes
        jsonData.faq_explococora.preguntas_frecuentes.forEach(faq => {
            const preguntas = Array.isArray(faq.pregunta) ? faq.pregunta : [faq.pregunta];
            const respuesta = typeof faq.respuesta === 'object' ? faq.respuesta.texto : faq.respuesta;
            const respuestaLower = respuesta.toLowerCase();

            // Buscar coincidencias por palabras clave
            Object.entries(CATEGORIES).forEach(([category, keywords]) => {
                if (keywords.some(k => respuestaLower.includes(k))) {
                    contextInfo.relatedInfo[category.toLowerCase()].push({ 
                        pregunta: preguntas[0], 
                        respuesta,
                        relevancia: keywords.filter(k => respuestaLower.includes(k)).length
                    });
                }
            });

            // Buscar coincidencias directas con la pregunta
            const allQuestions = [...preguntas, ...(faq.variaciones_pregunta || [])];
            if (allQuestions.some(q => 
                normalizedQuestion.includes(q.toLowerCase()) || 
                q.toLowerCase().includes(normalizedQuestion)
            )) {
                contextInfo.directMatches.push({ pregunta: preguntas[0], respuesta });
            }
        });

        // Buscar en metadata
        jsonData.faq_explococora.metadata.preguntas.forEach(meta => {
            const preguntas = Array.isArray(meta.pregunta) ? meta.pregunta : [meta.pregunta];
            const respuesta = meta.respuesta;
            const respuestaLower = respuesta.toLowerCase();

            // Clasificar metadata por categorías
            Object.entries(CATEGORIES).forEach(([category, keywords]) => {
                if (keywords.some(k => respuestaLower.includes(k))) {
                    contextInfo.relatedInfo[category.toLowerCase()].push({ 
                        pregunta: preguntas[0], 
                        respuesta,
                        relevancia: keywords.filter(k => respuestaLower.includes(k)).length
                    });
                }
            });

            // Buscar coincidencias directas
            if (preguntas.some(q => 
                normalizedQuestion.includes(q.toLowerCase()) || 
                q.toLowerCase().includes(normalizedQuestion)
            )) {
                contextInfo.directMatches.push({ pregunta: preguntas[0], respuesta });
            }
        });

        // Ordenar resultados por relevancia
        Object.keys(contextInfo.relatedInfo).forEach(category => {
            contextInfo.relatedInfo[category].sort((a, b) => (b.relevancia || 0) - (a.relevancia || 0));
        });

        return {
            hasMatches: contextInfo.directMatches.length > 0,
            relevantCategories,
            contextInfo
        };
    } catch (error) {
        console.error("Error buscando en JSON:", error);
        return {
            hasMatches: false,
            relevantCategories: [],
            contextInfo: { directMatches: [], relatedInfo: {} }
        };
    }
};

module.exports = {
    API_KEY_GEMINI,
    GENERATION_CONFIG,
    findInJsonContext
};