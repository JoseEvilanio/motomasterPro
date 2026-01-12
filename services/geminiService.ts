import { GoogleGenAI } from "@google/genai";
import { getLanguage } from "../translations.ts";

const API_KEY = import.meta.env.VITE_GEMINI_API_KEY || process.env.VITE_GEMINI_API_KEY || "";

export const getAIAssistance = async (issue: string, bikeModel: string) => {
  if (!API_KEY) {
    console.error("Missing Gemini API Key");
    return "Configuração de IA incompleta (Chave ausente).";
  }

  const ai = new GoogleGenAI({ apiKey: API_KEY });
  const lang = getLanguage();
  const langName = lang === 'pt' ? 'Portuguese (Brazil)' : 'English';

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-1.5-flash', // Usando modelo flash estável
      contents: `Você é um mestre mecânico de motocicletas de alta performance. 
      Analise o seguinte problema: "${issue}" na moto "${bikeModel}". 
      
      Forneça:
      1. Diagnóstico provável (causa raiz).
      2. Peças que devem ser inspecionadas ou substituídas.
      3. Nível de urgência (Baixo, Médio, Alto).
      
      Responda SEMPRE em ${langName} usando formatação MARKDOWN com títulos, negritos e listas. Seja direto e técnico.`,
      config: {
        temperature: 0.4,
        topP: 0.8,
      },
    });

    return response.text;
  } catch (error) {
    console.error("AI Assistance Error:", error);
    return lang === 'pt'
      ? "Erro ao conectar com o motor de IA. Verifique sua conexão ou tente novamente mais tarde."
      : "Error connecting to the AI engine. Please check your connection or try again later.";
  }
};

export const generateFinancialReport = async (stats: any, transactions: any[]) => {
  if (!API_KEY) return null;

  const ai = new GoogleGenAI({ apiKey: API_KEY });
  const lang = getLanguage();
  const langName = lang === 'pt' ? 'Portuguese (Brazil)' : 'English';

  const prompt = `Aja como um CFO especializado em oficinas de motocicletas. 
  Analise os seguintes dados financeiros e gere um relatório executivo:
  
  Estatísticas Atuais:
  - Receita Total: ${stats.revenue}
  - Custos Operacionais: ${stats.costs}
  - Lucro Líquido: ${stats.profit}
  
  Transações Recentes:
  ${transactions.map(tx => `- ${tx.label}: ${tx.amount} (${tx.category})`).join('\n')}
  
  O relatório deve conter:
  1. Resumo da Saúde Financeira.
  2. Principais Fontes de Receita vs Gastos.
  3. Sugestão estratégica para aumentar a margem de lucro.
  
  Responda em ${langName} com formatação MARKDOWN profissional.`;

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-1.5-flash',
      contents: prompt,
      config: {
        temperature: 0.7,
      },
    });
    return response.text;
  } catch (error) {
    console.error("Financial Report Error:", error);
    return null;
  }
};
