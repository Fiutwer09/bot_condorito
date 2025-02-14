const fs = require('fs');
const path = require('path');
const pdfParse = require('pdf-parse');

const API_KEY_GEMINI = process.env.API_KEY_GEMINI;

const GENERATION_CONFIG = {
    stopSequences: ["red"],
    maxOutputTokens: 1000,
    temperature: 0.9,
    topP: 0.1,
    topK: 16,
};

// Ruta de la carpeta con los PDFs
const PDF_FOLDER = "C:\\Users\\jhoja\\Desktop\\condorito bien definido\\chat\\pdfs";

// Función para extraer texto de un PDF
async function extractTextFromPDF(pdfPath) {
    try {
        const dataBuffer = fs.readFileSync(pdfPath);
        const data = await pdfParse(dataBuffer);
        return data.text;
    } catch (error) {
        console.error(`❌ Error al leer ${pdfPath}:`, error);
        return "";
    }
}

// Función para leer todos los PDFs de la carpeta
async function loadDocuments() {
    try {
        const files = fs.readdirSync(PDF_FOLDER).filter(file => file.endsWith('.pdf'));
        let allText = [];

        for (const file of files) {
            const pdfPath = path.join(PDF_FOLDER, file);
            console.log(`📖 Procesando: ${file}`);
            const text = await extractTextFromPDF(pdfPath);
            allText.push(text);
        }

        return allText.join("\n\n").split("\n\n").map(chunk => chunk.trim()).filter(text => text.length > 0);
    } catch (error) {
        console.error("❌ Error al cargar documentos:", error);
        return [];
    }
}

// Cargar documentos al iniciar el servidor
let DOCUMENTS = [];

(async () => {
    DOCUMENTS = await loadDocuments();
    console.log("✅ PDFs cargados correctamente");
})();

// Definir el contexto inicial con la información de ExploCocora
async function getChatbotContext() {
    const contextInfo = DOCUMENTS.length > 0 ? DOCUMENTS.join("\n\n") : "No hay documentos cargados.";
    return `Eres Condorito, el asistente virtual de ExploCocora, una empresa de turismo en el Valle del Cocora, Colombia. Responde solo con información sobre ExploCocora. Datos adicionales:\n${contextInfo}`;
}

module.exports = { API_KEY_GEMINI, GENERATION_CONFIG, getChatbotContext };
