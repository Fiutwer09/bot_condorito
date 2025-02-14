require('dotenv').config();
const express = require('express');
const bodyParser = require('body-parser');
const { API_KEY_GEMINI, GENERATION_CONFIG, getChatbotContext } = require('./config');
const { GoogleGenerativeAI } = require("@google/generative-ai");
const cors = require('cors');

const genAI = new GoogleGenerativeAI(API_KEY_GEMINI);
const model = genAI.getGenerativeModel({ model: "gemini-pro" });

const app = express();
app.use(bodyParser.json());
app.use(cors());

const port = 30011;

let CONTEXT_MESSAGES = []; // Asegúrate de que sea un array

// Cargar el contexto desde los PDFs antes de iniciar el chatbot
(async () => {
    try {
        const context = await getChatbotContext(); // Obtener el contexto
        console.log("📌 Contexto cargado:", context); // Verificar qué se está cargando

        // Verificar que CONTEXT_MESSAGES sea un array
        if (Array.isArray(context)) {
            CONTEXT_MESSAGES = context;
        } else if (typeof context === 'string') {
            CONTEXT_MESSAGES = context.split('. '); // Dividir el string en partes
        } else {
            throw new Error("El contexto no es un array ni un string.");
        }

        console.log("📌 Contexto del chatbot cargado correctamente:", CONTEXT_MESSAGES);
    } catch (error) {
        console.error("❌ Error al cargar el contexto:", error);
    }
})();

// Expresiones regulares para detectar saludos y preguntas sobre su identidad
const SALUDOS_REGEX = /^(hola|buenos días|buenas tardes|buenas noches|qué tal|hey|hi|hello)/i;
const IDENTIDAD_REGEX = /(cómo te llamas|quién eres|cuál es tu nombre|cómo te dicen|cómo te puedo llamar)/i;

app.post('/chat', async (req, res) => {
    try {
        let history = req.body.history || [];
        let question = req.body.question;

        if (!question) {
            return res.status(400).json({ error: "La pregunta es obligatoria." });
        }

        if (history.length === 0) {
            history.push({ role: "user", parts: CONTEXT_MESSAGES.join(" ") });
        }

        history.push({ role: "user", parts: question });

        // Buscar en el contexto antes de enviar al modelo
        const contextResponse = CONTEXT_MESSAGES.find(message => 
            message.toLowerCase().includes(question.toLowerCase())
        );

        if (contextResponse) {
            history.push({ role: "model", parts: contextResponse });
            return res.status(200).json({ history: history });
        }

        // Lógica de IA
        const chat = model.startChat({
            history: history,
            generationConfig: GENERATION_CONFIG
        });

        const sendQuestion = await chat.sendMessage(question);
        const response = await sendQuestion.response;
        const text = response.text();

        if (!text || text.includes("no hay información")) {
            const fallbackResponse = "Lo siento, no tengo información sobre eso. ¿Puedo ayudarte con otra cosa?";
            history.push({ role: "model", parts: fallbackResponse });
        } else {
            history.push({ role: "model", parts: text });
        }

        return res.status(200).json({ history: history });
    } catch (error) {
        console.error("❌ Error en el chatbot:", error);
        return res.status(500).json({ error: "Error interno del servidor." });
    }
});

app.listen(port, () => {
    console.log(`🚀 Servidor ejecutándose en http://localhost:${port}`);
});
