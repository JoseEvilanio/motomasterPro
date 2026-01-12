
import { GoogleGenAI } from "@google/genai";

/**
 * Interface para classificação NCM usando Gemini
 */

export const classifyNCMWithAI = async (productName: string) => {
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  try {
    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: `Identifique o código NCM (8 dígitos) e o CEST para o seguinte produto de oficina de motos: "${productName}". 
      Retorne APENAS um JSON plano com as chaves "ncm" e "description".`,
      config: { responseMimeType: "application/json" }
    });
    // Uso correto da propriedade .text conforme as diretrizes
    return JSON.parse(response.text || '{}');
  } catch (error) {
    console.error("AI NCM Error:", error);
    return null;
  }
};

export const issueFiscalNote = async (data: any, type: 'NFE' | 'NFCE') => {
  console.log(`Iniciando emissão de ${type} via API de Mensageria Fiscal...`, data);
  
  // Simulação de delay de rede com SEFAZ
  await new Promise(resolve => setTimeout(resolve, 2500));
  
  const success = Math.random() > 0.05; // 95% de chance de sucesso na simulação
  
  if (success) {
    return {
      status: 'AUTHORIZED',
      danfeUrl: 'https://www.nfe.fazenda.gov.br/portal/consulta/danfe',
      protocol: '135240001234567',
      message: 'Nota autorizada com sucesso pelo SEFAZ'
    };
  } else {
    throw new Error('Rejeição SEFAZ: Falha na assinatura ou dados do contribuinte inválidos.');
  }
};
