require('dotenv').config();
const express = require('express');
const bodyParser = require('body-parser');
const { GENERATION_CONFIG, findInJsonContext } = require('./config');
const { GoogleGenerativeAI } = require("@google/generative-ai");
const cors = require('cors');

const app = express();
app.use(bodyParser.json());
app.use(cors());

const API_KEY_GEMINI = process.env.API_KEY_GEMINI;
const genAI = new GoogleGenerativeAI(API_KEY_GEMINI);
const model = genAI.getGenerativeModel({ model: "gemini-pro" });

// Información base de rutas
const RUTAS_BASE = `
- Ruta Corta (2-3 horas): Perfecta para principiantes, recorre el corazón del valle y las palmas de cera.
- Ruta Mirador (3-4 horas): Incluye ascenso al mirador para vistas panorámicas del valle.
- Ruta Completa (5-6 horas): Recorrido completo con visita a cascadas y zonas de avistamiento.
- Ruta Cabalgata (2-4 horas): Exploración a caballo por senderos tradicionales.
- Ruta Fotográfica (3-4 horas): Diseñada para capturar los mejores momentos y paisajes.
`;

const MENSAJE_INICIAL_CONDORITO = `¡Hola! 👋 Soy Condorito, tu asistente virtual de ExploCocora. 
Estoy aquí para ayudarte a planificar tu aventura en el Valle de Cocora. 🌳

Puedo ayudarte con:
- Información sobre nuestras rutas y senderos 🥾
- Detalles de precios y servicios 💰
- Recomendaciones personalizadas 🎯
- Consejos de seguridad y preparación 🔒

¿En qué puedo ayudarte hoy? 😊`;

// Detectar saludos
const isSaludo = (text) => {
    const saludos = ['hola', 'buenos días', 'buenas tardes', 'buenas noches', 'como estas', 'que tal', 'saludos'];
    return saludos.some(saludo => text.toLowerCase().includes(saludo));
};

// Agregar detección de preguntas generales
const isGeneralQuestion = (text) => {
    const questionLower = text.toLowerCase();
    return !questionLower.includes('explococora') && 
           !questionLower.includes('valle') && 
           !questionLower.includes('cocora') &&
           !questionLower.includes('ruta') &&
           !questionLower.includes('precio');
};

// Agregar función de reintento
const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));

const sendMessageWithRetry = async (chat, prompt, maxRetries = 3, initialDelay = 1000) => {
    for (let i = 0; i < maxRetries; i++) {
        try {
            const result = await chat.sendMessage(prompt);
            return result.response.text();
        } catch (error) {
            if (error.message.includes('429') || error.message.includes('quota')) {
                console.log(`Intento ${i + 1} fallido, esperando antes de reintentar...`);
                await delay(initialDelay * Math.pow(2, i)); // Espera exponencial
                continue;
            }
            throw error; // Si no es error de cuota, lanzar el error
        }
    }
    throw new Error('Se excedió el número máximo de intentos');
};

// Mejorar la detección de contexto
const getContextType = (text) => {
    const questionLower = text.toLowerCase();
    
    // Verificar si es sobre ExploCocora primero
    if (questionLower.includes('explococora') || 
        questionLower.includes('valle') || 
        questionLower.includes('cocora') ||
        questionLower.includes('ruta') ||
        questionLower.includes('precio') ||
        questionLower.includes('cabalgata') ||
        questionLower.includes('caminata')) {
        return 'explococora';
    }
    
    // Verificar si es saludo
    if (isSaludo(questionLower)) {
        return 'saludo';
    }
    
    // Si no es ninguno de los anteriores, es pregunta general
    return 'general';
};

app.post('/chat', async (req, res) => {
    try {
        let { question, history = [] } = req.body;
        const contextType = getContextType(question);
        const { hasMatches, contextInfo } = findInJsonContext(question);

        let prompt = '';
        if (contextType === 'saludo') {
            // Buscar saludo en el JSON
            const saludoJSON = contextInfo.directMatches.find(m => m.pregunta.toLowerCase().includes('hola') || 
                                                                  m.pregunta.toLowerCase().includes('buenos'));
            prompt = `
            Eres Condorito, el asistente virtual experto de ExploCocora.

            SALUDO DEL JSON:
            ${saludoJSON ? saludoJSON.respuesta : ''}

            INSTRUCCIONES PARA SALUDO:
            1. USA el saludo del JSON si está disponible
            2. RESPONDE de manera amigable y entusiasta
            3. USA emojis apropiados
            4. MENCIONA que eres el asistente de ExploCocora
            5. PREGUNTA si puedes ayudar con información sobre rutas o servicios

            SALUDO RECIBIDO: "${question}"
            `;
        } else if (contextType === 'explococora') {
            prompt = `
            Eres Condorito, el asistente virtual experto de ExploCocora.

            CONTEXTO PRINCIPAL:
            ExploCocora es un aplicativo web para planificar experiencias turísticas sostenibles en el Valle de Cocora, 
            ofreciendo caminatas y cabalgatas por rutas ecológicas.

            INFORMACIÓN ESPECÍFICA DEL JSON:
            ${hasMatches ? contextInfo.directMatches.map(m => m.respuesta).join('\n') : ''}

            INFORMACIÓN DE METADATA:
            ${contextInfo.metadata && contextInfo.metadata.preguntas ? 
                contextInfo.metadata.preguntas
                .filter(p => p.pregunta.some(q => 
                    question.toLowerCase().includes(q.toLowerCase()) ||
                    q.toLowerCase().includes(question.toLowerCase())
                ))
                .map(p => p.respuesta)
                .join('\n') 
            : ''}

            INFORMACIÓN COMPLEMENTARIA:
            Rutas: ${contextInfo.relatedInfo.rutas.map(r => r.respuesta).join('\n')}
            Actividades: ${contextInfo.relatedInfo.actividades.map(a => a.respuesta).join('\n')}
            Precios: ${contextInfo.relatedInfo.precios.map(p => p.respuesta).join('\n')}
            Servicios: ${contextInfo.relatedInfo.servicios.map(s => s.respuesta).join('\n')}

            INSTRUCCIONES:
            1. USA la información exacta del JSON cuando esté disponible
            2. COMPLEMENTA con detalles relevantes usando tu conocimiento
            3. MANTÉN el tono amigable y profesional de Condorito
            4. USA emojis apropiados
            5. SI la información no está en el JSON, usa tu conocimiento pero mantén 
            coherencia
            6. INCLUYE detalles específicos sobre:
                - Rutas y actividades disponibles
                - Precios y servicios
                - Recomendaciones personalizadas
                - Información de seguridad
            7. USA la información de metadata para preguntas sobre el equipo y creadores
            8. USA la información exacta del JSON cuando esté disponible
            9. COMPLEMENTA con detalles relevantes usando tu conocimiento
            10. MANTÉN el tono amigable y profesional de Condorito
            11. USA emojis apropiados
            12. SI no encuentras información específica, usa tu conocimiento general
            PREGUNTA: "${question}"
            `;
        } else {
            prompt = `
            Eres Condorito, el asistente virtual de ExploCocora, experto en turismo y naturaleza.

            CONTEXTO:
            - Eres un asistente amigable que puede responder preguntas generales
            - Tu especialidad es el turismo, la naturaleza y el Valle del Cocora
            - Mantienes un tono conversacional y educativo
            - Cuando sea relevante, relacionas las respuestas con el turismo o la naturaleza

            INSTRUCCIONES:
            1. RESPONDE la pregunta usando tu conocimiento general
            2. MANTÉN un tono amigable y profesional
            3. USA ejemplos o comparaciones cuando sea útil
            4. SI es apropiado, RELACIONA la respuesta con el turismo o la naturaleza
            5. USA emojis ocasionalmente
            6. SI no sabes algo, sé honesto
            7. EVITA información sobre personas específicas o temas sensibles

            PREGUNTA: "${question}"
            `;
        }

        const chat = model.startChat({
            history: history.slice(-2).map(msg => ({
                role: msg.role === "model" ? "model" : "user",
                parts: [{ text: msg.parts }]
            })),
            generationConfig: {
                ...GENERATION_CONFIG,
                temperature: contextType === 'explococora' ? 0.7 : 0.9
            }
        });

        // Usar la nueva función de reintento
        const respuesta = await sendMessageWithRetry(chat, prompt);

        return res.status(200).json({
            answer: respuesta,
            history: [...history, { role: "model", parts: respuesta }],
            source: hasMatches ? 'json+ai' : 'ai'
        });

    } catch (error) {
        console.error("Error:", error);
        let errorMessage = "¡Disculpa! Hubo un error. ¿Podrías intentar de nuevo? 😊";
        
        if (error.message.includes('quota') || error.message.includes('429')) {
            errorMessage = "Lo siento, estamos experimentando mucho tráfico. Por favor, intenta de nuevo en unos momentos. 🙏";
        }

        return res.status(error.message.includes('429') ? 429 : 500).json({ 
            error: errorMessage,
            history: req.body.history || []
        });
    }
});

const port = process.env.PORT || 30011;
app.listen(port, () => {
    console.log(`🚀 Servidor corriendo en puerto ${port}`);
});
