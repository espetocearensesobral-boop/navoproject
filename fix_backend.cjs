const fs = require('fs');
const path = require('path');

const filePath = path.join('backend', 'routers', 'relationship.router.ts');
let content = fs.readFileSync(filePath, 'utf8');

if (!content.includes('GoogleGenAI')) {
  content = `import { GoogleGenAI } from '@google/genai';\nimport { sendWhatsAppMessage } from '../whatsapp.js';\n` + content;
}

const routes = `
relationshipRouter.post('/follow-up/generate', async (req, res) => {
  try {
    const { name, daysSinceLastVisit, appointmentCount, loyaltyTier } = req.body;
    const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
    const prompt = \`
Você é um assistente de marketing para uma barbearia/salão (Navo). 
Escreva uma mensagem curta (máximo 3 frases) e amigável para enviar pelo WhatsApp para um cliente que não vem há um tempo.
Nome do cliente: \${name.split(' ')[0]}
Dias desde a última visita: \${daysSinceLastVisit}
Total de visitas anteriores: \${appointmentCount}
Nível de fidelidade: \${loyaltyTier}

Não use saudações formais demais. Seja convidativo, ofereça para agendar um horário. 
Não invente promoções a menos que seja um cliente inativo há mais de 90 dias (você pode sugerir que temos um horário especial). 
Traga a mensagem pronta para enviar, sem aspas e sem placeholders. Use emojis adequados.
\`;
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: prompt,
    });
    const message = response.text || 'Olá! Sentimos sua falta. Que tal agendar um horário com a gente?';
    res.json({ message });
  } catch (error) {
    handleError(res, error, req.path);
  }
});

relationshipRouter.post('/follow-up/send', async (req, res) => {
  try {
    const { clientId, phone, message } = req.body;
    if (!phone || !message) return res.status(400).json({ error: 'Telefone e mensagem são obrigatórios.' });
    
    // Save locally to simulate bot conversation creation if we had a local DB table for messages.
    // We just rely on sendWhatsAppMessage which uses Evolution or Meta.
    const sent = await sendWhatsAppMessage(phone, message);
    if (!sent) {
      return res.status(500).json({ error: 'Nenhum provedor de WhatsApp (Evolution/Meta) está configurado ou ativo para enviar esta mensagem.' });
    }
    res.json({ success: true });
  } catch (error) {
    handleError(res, error, req.path);
  }
});
`;

content = content + routes;
fs.writeFileSync(filePath, content);
console.log('Fixed backend');
