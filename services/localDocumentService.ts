import { DocumentAnalysisResult, ExtractedData } from "../types";
import * as pdfjsLib from 'pdfjs-dist';

// Use a more robust worker loading pattern for cross-browser compatibility (Chrome, Firefox, Safari)
// This ensures the worker is bundled and loaded correctly via Vite
if (typeof window !== 'undefined' && 'Worker' in window) {
    pdfjsLib.GlobalWorkerOptions.workerSrc = new URL(
        'pdfjs-dist/build/pdf.worker.min.mjs',
        import.meta.url
    ).toString();
}

/**
 * Text item with layout info
 */
interface TextItem {
    str: string;
    x: number;
    y: number;
}

/**
 * Extract text from a uploaded PDF file, preserving line structure.
 */
export const extractTextFromPDF = async (file: File): Promise<string> => {
    try {
        const arrayBuffer = await file.arrayBuffer();
        // Load PDF
        const loadingTask = pdfjsLib.getDocument({ data: arrayBuffer });
        const pdf = await loadingTask.promise;
        console.log(`PDF Loaded: ${pdf.numPages} pages.`);

        let fullText = '';

        for (let i = 1; i <= pdf.numPages; i++) {
            const page = await pdf.getPage(i);
            const textContent = await page.getTextContent();

            // Map and Filter items
            const items: TextItem[] = [];
            for (const item of textContent.items as any[]) {
                // Some items might be empty or whitespace
                if (!item.str || !item.str.trim()) continue;

                // Fallback for transform: use 0,0 if missing (shouldn't happen on standard text)
                const tx = item.transform ? item.transform[4] : 0;
                const ty = item.transform ? item.transform[5] : 0;

                items.push({
                    str: item.str,
                    x: tx,
                    y: ty
                });
            }

            // Sort by Y (Top to Bottom), then X (Left to Right)
            // PDF coordinates: Y typically starts from bottom-left (0,0) going UP. 
            // So higher Y is higher on page. We want format Text Top->Bottom.
            // So we sort DESCENDING by Y.
            items.sort((a, b) => {
                const yDiff = b.y - a.y;
                if (Math.abs(yDiff) < 8) { // Tolerance for same line
                    return a.x - b.x;
                }
                return yDiff;
            });

            // Reconstruct visually
            let currentY = items[0]?.y || 0;
            let lineText = '';

            for (const item of items) {
                // If Y difference is significant, it's a new line
                if (Math.abs(item.y - currentY) > 8) {
                    fullText += lineText.trim() + '\n';
                    lineText = '';
                    currentY = item.y;
                }
                lineText += item.str + ' ';
            }
            fullText += lineText.trim() + '\n';
        }

        console.log("Extraction Complete. Length:", fullText.length);
        return fullText;

    } catch (e: any) {
        console.error("PDF Extraction Failed:", e);
        throw new Error(`Falha na leitura do PDF: ${e.message}`);
    }
};

interface ParsedAppointment {
    patientName: string;
    time: string;
    contact: string;
    status: string;
    doctor?: string;
    date?: string;
    procedure?: string;
    insurance?: string;
    isFreeSlot?: boolean;
}

/**
 * Parses using the specific User column order:
 * "HORÁRIO | DESCRIÇÃO (PACIENTE) | EVENTO | CONVÊNIO | CONTATO | STATUS"
 */
export const parseAgendaText = (text: string): ParsedAppointment[] => {
    const lines = text.split('\n');
    let appointments: ParsedAppointment[] = [];

    // Global Metadata
    let globalDoctor = '';
    let globalDate = '';

    // Patterns
    // Range Pattern: Forces presence of a dash (hyphen or en-dash)
    const timePattern = /(\d{2}:\d{2})\s*[-–]\s*(\d{2}:\d{2})?/;
    // Single Pattern: Starts with time, capturing it.
    const singleTimePattern = /^(\d{2}:\d{2})/;

    // Date/Phone
    const datePattern = /(\d{2}\/\d{2}\/\d{4})/;
    const phonePattern = /(?:\(?\d{2}\)?\s?)?(?:9?\d{4}[-\.\s]?\d{4})/;

    // Keywords Lists
    // Removed 'LIVRE' so we can track free slots
    const badLines = ['BLOQUEIO', 'Agenda do Dia', 'Relatório', 'Página', 'Impresso em', 'Emissão', 'Total', 'Qtde'];

    // Status
    const statusKeywords = ['Confirmado', 'Realizado', 'Falta', 'Agendado', 'Desistencia', 'Cancelado', 'Atendido', 'Em Atendimento'];

    // Junk Terms
    const junkTerms = [
        'Unimed', 'Particular', 'Cassi', 'Iamspe', 'Bradesco', 'Sulamerica', 'Allianz', 'Porto Seguro',
        'Amil', 'Mediservice', 'Fusex', 'Apas', 'Cabesp', 'Geap', 'Saude Caixa', 'Postal Saude',
        'Intercambio', 'Intercâmbio', 'Bauru', 'Cooperado', 'Beneficiario', 'Dependente', 'Titular',
        'Consulta', 'Retorno', 'Exame', 'Procedimento', 'Cirurgia', 'Avaliação', 'Ecografia', 'Bioimpedancia', 'Teste Cutaneo', 'Imunoterapia', 'Pequena Cirurgia'
    ];

    const insuranceKeywords = [
        'Unimed', 'Particular', 'Cassi', 'Iamspe', 'Bradesco', 'Sulamerica', 'Allianz', 'Porto Seguro',
        'Amil', 'Mediservice', 'Fusex', 'Apas', 'Cabesp', 'Geap', 'Saude Caixa', 'Postal Saude'
    ];

    const eventKeywords = [
        'Consulta', 'Retorno de Consulta', 'Retorno', 'Exame', 'Procedimento', 'Cirurgia', 'Avaliação',
        'Ecografia', 'Bioimpedancia', 'Teste Cutaneo', 'Imunoterapia', 'Pequena Cirurgia'
    ];
    eventKeywords.sort((a, b) => b.length - a.length);
    insuranceKeywords.sort((a, b) => b.length - a.length);

    // Helper to strip keywords
    const stripKeywords = (input: string, list: string[]): { cleaned: string, found: string[] } => {
        let cleaned = input;
        const found: string[] = [];
        for (const kw of list) {
            const regex = new RegExp(kw, 'gi');
            if (cleaned.match(regex)) {
                found.push(kw);
                cleaned = cleaned.replace(regex, '');
            }
        }
        return { cleaned, found };
    };

    // Header Scan
    for (const line of lines.slice(0, 15)) {
        if (!globalDate) {
            const d = line.match(datePattern);
            if (d) globalDate = d[1];
        }
        if (!globalDoctor) {
            // Match Name, allowing for underscores
            const dr = line.match(/(Dr\.|Dra\.|Medico|Prestador)[:\s]+([A-Za-z\s\._]+)/i);
            if (dr) {
                // Replace underscores with spaces and trim
                globalDoctor = dr[2].replace(/_/g, ' ').trim();
            }
        }
    }

    for (let i = 0; i < lines.length; i++) {
        let line = lines[i];

        // Clean invisible chars
        line = line.replace(/[\u0000-\u001F\u007F-\u009F]/g, " ").trim();
        if (!line) continue;

        // --- CORE STRATEGY ---
        // New Appointment = Matches "Start - End" or "Start -" pattern
        // Continuation    = No match OR Matches only "Start" (no dash)

        const rangeMatch = line.match(timePattern);
        const singleMatch = line.match(singleTimePattern);

        // If it looks like a range (13:00 - 13:15) OR (13:00 - ) -> It's a New Appointment
        const isNewAppointment = !!rangeMatch;

        if (!isNewAppointment) {
            // It is a continuation line or junk
            // Check major junk
            if (badLines.some(bl => line.toUpperCase().includes(bl.toUpperCase()))) continue;

            if (appointments.length > 0) {
                const prev = appointments[appointments.length - 1];

                let contentLine = line;

                // SPECIAL HANDLER: Line starts with a Single Time (no dash) like "16:40 RIBEIRO"
                // This is the "End Time" line acting as a wrapper.
                // We MUST strip the time.
                if (singleMatch) {
                    contentLine = contentLine.replace(singleMatch[0], '').trim();
                }

                // Clean Junk
                const cleanLineUpper = contentLine.trim().toUpperCase();
                const isJunk = junkTerms.some(term => cleanLineUpper.includes(term.toUpperCase()));

                if (!isJunk && contentLine.length > 1) {
                    let continuation = contentLine;

                    // Remove Phones
                    const foundPhones = continuation.match(new RegExp(phonePattern, 'g'));
                    if (foundPhones) foundPhones.forEach(p => continuation = continuation.replace(p, ''));

                    // Remove Status
                    const resStatus = stripKeywords(continuation, statusKeywords);
                    continuation = resStatus.cleaned;

                    // Cleanup
                    continuation = continuation
                        .replace(/[-–]/g, '')
                        .replace(/\s+/g, ' ')
                        .replace(/\d+/g, '')
                        .replace(/\sPP$/, '').replace(/^PP\s/, '')
                        .trim();

                    if (continuation.length > 1 && !continuation.match(/^[0-9\W]+$/)) {
                        prev.patientName = `${prev.patientName} ${continuation}`.trim();
                    }
                }
            }
            continue;
        }

        // --- NEW APPOINTMENT PROCESSING ---
        // We know it matched timePattern, so rangeMatch is valid.
        const startTime = rangeMatch[1];
        // optional group 2 is end time

        if (badLines.some(bl => line.toUpperCase().includes(bl.toUpperCase()))) continue;

        let remaining = line.replace(rangeMatch[0], '').trim();
        remaining = remaining.replace(/^[-–]\s*/, ''); // Extra cleanup of dash

        // Extract Status
        let status = 'Agendado';
        const resStatus = stripKeywords(remaining, statusKeywords);
        remaining = resStatus.cleaned;
        if (resStatus.found.length > 0) status = resStatus.found[0];
        status = status.charAt(0).toUpperCase() + status.slice(1).toLowerCase();

        // Extract Contact
        const foundPhones = remaining.match(new RegExp(phonePattern, 'g'));
        let contact = '';
        if (foundPhones) {
            contact = foundPhones.map(p => p.trim()).join(' / ');
            foundPhones.forEach(p => remaining = remaining.replace(p, ''));
        }

        // Extract Metadata
        const resJunk = stripKeywords(remaining, junkTerms);
        remaining = resJunk.cleaned;
        let insurance = resJunk.found.find(k => insuranceKeywords.includes(k)) || '';
        let event = resJunk.found.find(k => eventKeywords.includes(k)) || '';

        // Name
        let name = remaining
            .replace(/[-–]/g, '')
            .replace(/\s+/g, ' ')
            .replace(/\d+/g, '')
            .trim();

        name = name.replace(/^[^a-zA-Z]+/, '').replace(/[^a-zA-Z]+$/, '');
        name = name.replace(/\sPP$/, '').replace(/^PP\s/, '');

        if (name.length < 3 && !name.toUpperCase().includes('LIVRE')) continue;

        appointments.push({
            patientName: name,
            time: startTime,
            contact: contact,
            status: status,
            doctor: globalDoctor,
            date: globalDate,
            procedure: event,
            insurance: insurance
        });
    }

    // FINAL PASS: Filter out "Fake" appointments that might have slipped through
    // e.g. if a line was read as an appointment but the name is just "Intercambio" or empty
    appointments = appointments.filter(appt => {
        const n = appt.patientName.toUpperCase();
        // Check if the name is just a single junk term or too short
        const isJunkName = junkTerms.some(t => n === t.toUpperCase());
        // Allow shorter names if it is explicitly "LIVRE"
        if (n.includes('LIVRE')) return true;
        return !isJunkName && n.length > 2;
    }).map(appt => {
        // User Request: Use only the FIRST name (e.g. "ISABELA ROMEIRO CINTRA" -> "ISABELA")
        // UNLESS it is "HORÁRIO LIVRE"
        const nUpper = appt.patientName.toUpperCase();
        if (nUpper.includes('LIVRE')) {
            appt.patientName = "HORÁRIO LIVRE";
            appt.isFreeSlot = true;
            return appt;
        }

        const parts = appt.patientName.trim().split(/\s+/);
        if (parts.length > 0) {
            appt.patientName = parts[0];
        }
        return appt;
    });

    return appointments;
};

export const generateLocalMessage = (
    data: ParsedAppointment,
    type: 'reschedule' | 'confirmation' | 'procedure_confirmation',
    prepText: string,
    signatureName: string,
    selectedFloor: string
): string => {
    // Basic formatting
    const formattedDoctor = data.doctor && !data.doctor.match(/^(Dr|Dra)/i)
        ? `Dr(a). ${data.doctor}`
        : (data.doctor || "Dr(a). [Nome]");

    const dateObj = data.date || "[Data]";

    // Preparation Block
    const prepBlock = prepText ? `\n📝 *Preparo Necessário:*\n${prepText}\n` : '';

    if (type === 'reschedule') {
        return `Olá, ${data.patientName}, este contato refere-se à sua consulta no Centro de Diagnóstico Unimed (CDU), ${selectedFloor}. Tentamos o contato telefônico, mas não conseguimos falar com você.

Devido a um imprevisto na agenda do médico, sua consulta com o(a) ${formattedDoctor} precisou ser remarcada.

✅ Novo Agendamento: 
📅 Data: ${dateObj} 
⏰ Hora: ${data.time}
${prepBlock}
⚠️ Importante: Apresentar Documento com foto e Carteirinha da Unimed.

❌ Caso não seja possível a nova data agendada, por favor, entre em contato através da Central de Agendamento: 

📞 Telefone: (14) 3235-3350 
📱 WhatsApp: (14) 99648-4958

Pedimos desculpas pelo transtorno e agradecemos a compreensão.

Atenciosamente, 
${signatureName}`;
    }

    // Confirmation or Procedure Confirmation
    return `Olá, ${data.patientName}, este contato refere-se à sua consulta no Centro de Diagnóstico Unimed (CDU), ${selectedFloor}.

🩺 ${formattedDoctor}
📅 Data: ${dateObj}
⏰ Hora: ${data.time}
${prepBlock}
⚠️ Importante: Apresentar Documento com foto e Carteirinha da Unimed.

Em caso de dúvidas ou necessidade de reagendar, entre em contato através da Central de Agendamento: (14) 3235-3350 ou WhatsApp (14) 99648-4958.

Podemos confirmar?

Atenciosamente,
${signatureName}`;
};

export const processDocumentLocally = async (
    file: File,
    type: 'reschedule' | 'confirmation' | 'daily_summary' | 'procedure_confirmation',
    prepText: string = '',
    userName: string = 'Atendimento Unimed',
    selectedFloor: string = '9º Andar ( OFTALMOLOGIA )'
): Promise<DocumentAnalysisResult | DocumentAnalysisResult[]> => {

    const text = await extractTextFromPDF(file);
    console.log("Raw Extracted Text Sample:", text.substring(0, 500));
    const allAppointments = parseAgendaText(text);
    console.log("Parsed Appointments (Total):", allAppointments.length);

    // Filter Free Slots vs Valid Appointments
    const freeSlots = allAppointments.filter(a => a.isFreeSlot);
    const validAppointments = allAppointments.filter(a => !a.isFreeSlot);

    console.log(`Valid: ${validAppointments.length}, Free: ${freeSlots.length}`);

    // DAILY SUMMARY LOGIC (Aggregated)
    if (type === 'daily_summary') {
        const total = validAppointments.length;
        const confirmed = validAppointments.filter(a => a.status.toLowerCase().includes('confirmado')).length;
        // Count anything not confirmed as pending for now, or simplify
        const pending = total - confirmed;

        const firstTime = validAppointments[0]?.time || "00:00";
        const lastTime = validAppointments[validAppointments.length - 1]?.time || "00:00";
        const doctor = validAppointments[0]?.doctor || "[Médico]";
        const date = validAppointments[0]?.date || "[Data]";

        const fmt = (n: number) => n < 10 ? `0${n}` : `${n}`;

        // Free Slots Formatting
        let freeSlotsText = 'Nenhum horário livre identificado.';
        if (freeSlots.length > 0) {
            freeSlotsText = freeSlots.map(s => s.time).join('\n');
        }

        const message = `Olá DR. "${doctor}" tudo bem!

Segue o resumo da sua agenda do dia ${date} até o momento:

📅 Período de atendimento: ${firstTime} às ${lastTime}
👥 Total de pacientes agendados: ${fmt(total)}

📌 Status dos agendamentos:

${fmt(confirmed)} - atendimentos confirmados
${fmt(pending)} - atendimento agendado (pendente de confirmação)

🕒 Horários livres: ${fmt(freeSlots.length)}
${freeSlotsText}

Qualquer dúvida, estamos à disposição.

Obrigado,
${userName}`;

        return {
            extractedData: {
                patientName: "Resumo Diário",
                doctorName: doctor,
                date: date,
                time: `${firstTime} - ${lastTime}`,
                contact: "",
                procedure: ""
            },
            generatedMessage: message
        };
    }

    // NORMAL LIST LOGIC - Only return VALID appointments (exclude 'Livre')
    const results: DocumentAnalysisResult[] = validAppointments.map(appt => ({
        extractedData: {
            patientName: appt.patientName,
            doctorName: appt.doctor || "",
            date: appt.date || "",
            time: appt.time,
            contact: appt.contact,
            procedure: appt.procedure || ""
        },
        generatedMessage: generateLocalMessage(appt, type as any, prepText, userName, selectedFloor)
    }));

    return results;
};
