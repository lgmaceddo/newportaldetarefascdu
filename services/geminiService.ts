import { GoogleGenerativeAI, SchemaType } from "@google/generative-ai";
import { DocumentAnalysisResult } from "../types";

// Access API Key from environment
// We check multiple sources to be robust across different Vite configurations
const apiKey = (
  import.meta.env.VITE_GEMINI_API_KEY ||
  import.meta.env.GEMINI_API_KEY ||
  process.env.GEMINI_API_KEY ||
  process.env.API_KEY ||
  ''
).trim();

if (!apiKey) {
  console.error("Gemini API Key is missing. Check your .env file (VITE_GEMINI_API_KEY) or vite.config.ts");
} else {
  // Log masked key for debugging assurance
  console.log(`Gemini Service initialized with Key: ${apiKey.substring(0, 4)}...${apiKey.substring(apiKey.length - 4)}`);
}

const genAI = new GoogleGenerativeAI(apiKey);

/**
 * Parses a file (PDF or Image) to extract structured data and generate a message.
 * Supports 'individual', 'batch' or 'daily_summary' modes.
 * Supports 'reschedule', 'confirmation', or 'daily_summary' message templates.
 * Now accepts 'userName' to personalize signatures.
 */
export const processDocument = async (
  fileBase64: string,
  mimeType: string,
  additionalContext: string,
  mode: 'individual' | 'batch' = 'individual',
  type: 'reschedule' | 'confirmation' | 'daily_summary' = 'reschedule',
  preparationText?: string,
  userName?: string,
  selectedFloor: string = '9º Andar ( OFTALMOLOGIA )'
): Promise<DocumentAnalysisResult | DocumentAnalysisResult[]> => {
  try {
    if (!apiKey) {
      throw new Error("Chave de API do Gemini não encontrada. Verifique a configuração.");
    }

    const signatureName = userName || "Atendimento Unimed";

    // --- DAILY SUMMARY LOGIC (Specific branch) ---
    if (type === 'daily_summary') {
      const prompt = `
            Você é um assistente administrativo de uma clínica médica.
            Analise a imagem/PDF da agenda do dia.

            **Objetivo:** Gerar um resumo estatístico ("Espelho Diário") para o médico prestador.

            **Instruções de Extração e Contagem:**
            1. **Prestador:** Identifique o nome do médico.
            2. **Data:** Identifique a data da agenda.
            3. **Período:** Identifique o horário do PRIMEIRO e do ÚLTIMO atendimento.
            4. **Contagens:**
               - Total de pacientes.
               - Contar "Primeiras consultas".
               - Contar "Segundas consultas" (ou Consulta).
               - Contar "Retornos".
               - Contar outros (Intercâmbio, etc).
            5. **Status:** Confirmados vs Pendentes.

            **REGRAS DE FORMATAÇÃO RIGOROSA (OBRIGATÓRIO):**
            1. **Zeros à Esquerda:** Para QUALQUER número de contagem menor que 10, você DEVE adicionar um zero à esquerda.
               - Exemplo CORRETO: "01", "08", "09", "10".
            2. **Terminologia Exata:**
               - Para primeiras consultas: "- Primeira Consulta"
               - Para segundas consultas: "- Segunda Consulta"
               - Para retornos: "- Retorno"
            3. **Hífens de Padronização:**
               - Todos os itens de contagem (distribuição e status) DEVEM ter um hífen separando o número do texto. Ex: "05 - atendimentos confirmados".

            **Contexto Adicional:** "${additionalContext}"

            **MODELO DE RESPOSTA:**
            Preencha os colchetes com os dados extraídos, respeitando as regras acima.

            ---
            Olá DR. "*[Nome do Prestador]*" tudo bem!

            Segue o resumo da sua agenda do dia *[Data]* até o momento:

            📅 Período de atendimento: *[Horário Início] às [Horário Fim]*
            👥 Total de pacientes agendados: *[Total com zero à esquerda]*

            🧾 Distribuição dos atendimentos:

            *[Qtd] - Primeira Consulta*
            *[Qtd] - Segunda Consulta* (se houver)
            *[Qtd] - Retorno*
            *[Qtd] - atendimentos por intercâmbio/outros* (se houver)

            📌 Status dos agendamentos:

            *[Qtd] - atendimentos confirmados*
            *[Qtd] - atendimento agendado (pendente de confirmação)*

            🕒 Horário livre:

            *[Descrever horários livres ou "Sem horários livres identificados"]*

            Obrigado,
            ${signatureName}
            ---
        `;

      const model = genAI.getGenerativeModel({
        model: "gemini-1.5-flash",
        generationConfig: {
          responseMimeType: "application/json",
          responseSchema: {
            type: SchemaType.OBJECT,
            properties: {
              extractedData: {
                type: SchemaType.OBJECT,
                properties: {
                  patientName: { type: SchemaType.STRING, description: "Use 'Resumo Diário' aqui" },
                  doctorName: { type: SchemaType.STRING },
                  date: { type: SchemaType.STRING },
                  time: { type: SchemaType.STRING, description: "Use o período completo aqui" },
                  contact: { type: SchemaType.STRING, description: "Deixe vazio" },
                  procedure: { type: SchemaType.STRING, description: "Deixe vazio" },
                }
              },
              generatedMessage: { type: SchemaType.STRING, description: "O texto do resumo completo formatado." }
            },
            required: ["extractedData", "generatedMessage"]
          }
        }
      });

      const result = await model.generateContent([
        { inlineData: { mimeType: mimeType, data: fileBase64 } },
        { text: prompt }
      ]);

      const response = await result.response;
      const text = response.text();

      if (!text) throw new Error("No response generated.");

      const cleanText = text.replace(/^```json\s*/, '').replace(/^```\s*/, '').replace(/\s*```$/, '');
      return JSON.parse(cleanText);
    }

    // --- STANDARD LOGIC (Reschedule / Confirmation) ---

    // Format preparation block if exists
    const prepBlock = preparationText
      ? `\n📝 *Preparo Necessário:*\n${preparationText}\n`
      : '';

    const templates = {
      reschedule: `
          Olá, "nome do paciente", este contato refere-se à sua consulta no Centro de Diagnóstico Unimed (CDU), ${selectedFloor}. Tentamos o contato telefônico, mas não conseguimos falar com você.

          Devido a um imprevisto na agenda do médico, sua consulta com o(a) Dr(a). "Nome do Médico" precisou ser remarcada.

          ✅ Novo Agendamento: 
          📅 Data: "data extraída" 
          ⏰ Hora: "horário extraído"
          ${prepBlock}
          ⚠️ Importante: Apresentar Documento com foto e Carteirinha da Unimed.

          ❌ Caso não seja possível a nova data agendada, por favor, entre em contato através da Central de Agendamento: 

          📞 Telefone: (14) 3235-3350 
          📱 WhatsApp: (14) 99648-4958

          Pedimos desculpas pelo transtorno e agradecemos a compreensão.

          Atenciosamente, 
          ${signatureName}
        `,
      confirmation: `Olá, "nome do paciente", este contato refere-se à sua consulta no Centro de Diagnóstico Unimed (CDU), ${selectedFloor}.

🩺 Dr(a). "Nome do Médico"
📅 Data: "data extraída"
⏰ Hora: "horário extraído"
${prepBlock}
⚠️ Importante: Apresentar Documento com foto e Carteirinha da Unimed.

Em caso de dúvidas ou necessidade de reagendar, entre em contato através da Central de Agendamento: (14) 3235-3350 ou WhatsApp (14) 99648-4958.

Podemos confirmar?

Atenciosamente,
${signatureName}`
    };

    const selectedTemplate = templates[type as 'reschedule' | 'confirmation'];

    const mappingInstructions = `
      **Instruções de Mapeamento:**
      1. **Prestador**: Nome do médico (ex: ORLANDO_COSTA -> Dr(a). Orlando Costa).
      2. **Data**: Data da consulta (ex: 25/11/2025).
      3. **HORÁRIO**: Se intervalo (ex: "13:00 - 13:15"), pegue APENAS o INÍCIO (ex: 13:00).
      4. **DESCRIÇÃO**: Nome completo do paciente.
      5. **CONTATO**: Telefone/celular.
      6. **EVENTO/STATUS**: Ignore linhas com "HORÁRIO LIVRE". Apenas agendados/confirmados.
    `;

    let prompt = '';
    let responseSchema: any;

    const itemSchema = {
      type: SchemaType.OBJECT,
      properties: {
        extractedData: {
          type: SchemaType.OBJECT,
          properties: {
            patientName: { type: SchemaType.STRING, description: "Nome completo do paciente" },
            doctorName: { type: SchemaType.STRING, description: "Nome do médico" },
            date: { type: SchemaType.STRING, description: "Data do agendamento" },
            time: { type: SchemaType.STRING, description: "Horário de início" },
            procedure: { type: SchemaType.STRING, description: "Tipo do evento" },
            contact: { type: SchemaType.STRING, description: "Telefone de contato" },
          },
        },
        generatedMessage: {
          type: SchemaType.STRING,
          description: "A mensagem formatada exatamente conforme o modelo."
        },
      },
      required: ["extractedData", "generatedMessage"],
    };

    if (mode === 'batch') {
      prompt = `
            Você é um assistente administrativo. Analise o documento COMPLETO.
            Identifique TODOS os agendamentos válidos de pacientes diferentes na lista.
            
            ${mappingInstructions}
            
            Para CADA paciente encontrado, gere um objeto contendo os dados extraídos e a mensagem personalizada seguindo ESTRITAMENTE o modelo abaixo (respeitando rigorosamente as quebras de linha):
            ${selectedTemplate}

            Contexto: "${additionalContext}"
        `;

      responseSchema = {
        type: SchemaType.ARRAY,
        items: itemSchema
      };
    } else {
      prompt = `
            Você é um assistente administrativo. Analise o documento.
            
            ${mappingInstructions}
            
            Contexto: "${additionalContext}"
            *Se o usuário especificou um nome no contexto, busque esse paciente. Caso contrário, extraia o PRIMEIRO paciente válido encontrado.*

            Gere a mensagem seguindo ESTRITAMENTE o modelo (respeitando rigorosamente as quebras de linha):
            ${selectedTemplate}
        `;

      responseSchema = {
        type: SchemaType.OBJECT,
        properties: itemSchema.properties,
        required: itemSchema.required
      };
    }

    const model = genAI.getGenerativeModel({
      model: "gemini-1.5-flash",
      generationConfig: {
        responseMimeType: "application/json",
        responseSchema: responseSchema
      }
    });

    const result = await model.generateContent([
      { inlineData: { mimeType: mimeType, data: fileBase64 } },
      { text: prompt }
    ]);

    const response = await result.response;
    const text = response.text();

    if (!text) throw new Error("No response generated.");

    const cleanText = text.replace(/^```json\s*/, '').replace(/^```\s*/, '').replace(/\s*```$/, '');
    return JSON.parse(cleanText);

  } catch (error: any) {
    console.error("Error processing document:", error);
    // Explicitly throw the error message
    throw new Error(error.message || "Falha ao processar o documento.");
  }
};