import {
  Document,
  Packer,
  Paragraph,
  TextRun,
  Table,
  TableRow,
  TableCell,
  WidthType,
  BorderStyle,
  HeadingLevel,
  AlignmentType,
} from "docx";
import { PulseState } from "@/components/pulse/types";
import { getRecommendedModules, formatEnrichedProjectContext } from "./modules";

export async function downloadPulseBlueprintDocx(state: PulseState, pulseId: string) {
  const dateStr = new Date().toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });

  const leadName = state.lead?.name || "Not specified";
  const leadContact = state.lead?.contact || "Not specified";
  const leadMethod = state.lead?.method || "Email";

  const enriched = formatEnrichedProjectContext(state.context, state.answers);
  const intent = enriched.primaryIntent;
  const industry = enriched.industryFocus;
  const timeline = enriched.targetTimeline;
  const budget = enriched.budgetAllocation;
  const scale = enriched.projectScale;
  const goals = enriched.primaryGoals;

  const modules = getRecommendedModules(state.context.industry, state.context, state.answers);

  // Extract paired Q&A history (Pulse question above user answer)
  const qaPairs: { question: string; answer: string }[] = [];
  let currentPulseQuestion = "";

  for (const msg of state.messages) {
    if (msg.sender === "pulse") {
      if (msg.id === "msg-welcome" || msg.text.includes("ACEVA's AI assistant")) continue;
      currentPulseQuestion = msg.text;
    } else if (msg.sender === "user") {
      const q = currentPulseQuestion || `Discovery Question ${qaPairs.length + 1}`;
      qaPairs.push({ question: q, answer: msg.text });
      currentPulseQuestion = "";
    }
  }

  // Fallback to state.answers if message array pairing was empty
  if (qaPairs.length === 0 && state.answers.length > 0) {
    const defaultQuestions = [
      "Tell us about the business and who you serve.",
      "Where does the current system break down or feel manual?",
      "What does the operation look like today (locations, team, scale)?",
      "What core features and outcomes should be different when this works?",
      "What is your target timeline and expected budget range?",
    ];
    state.answers.forEach((ans, i) => {
      qaPairs.push({
        question: defaultQuestions[i] || `Discovery Question ${i + 1}`,
        answer: ans,
      });
    });
  }

  const doc = new Document({
    sections: [
      {
        properties: {
          page: {
            margin: {
              top: 1440, // 1 inch
              bottom: 1440,
              left: 1440,
              right: 1440,
            },
          },
        },
        children: [
          // Header / Title Block
          new Paragraph({
            text: "ACEVA TECHNOLOGY",
            heading: HeadingLevel.HEADING_2,
            alignment: AlignmentType.LEFT,
            spacing: { after: 120 },
          }),

          new Paragraph({
            children: [
              new TextRun({
                text: "PROJECT DIRECTION BLUEPRINT",
                bold: true,
                size: 36, // 18pt
                color: "1E293B",
              }),
            ],
            spacing: { after: 240 },
          }),

          // Metadata Table
          new Table({
            width: { size: 100, type: WidthType.PERCENTAGE },
            rows: [
              new TableRow({
                children: [
                  new TableCell({
                    width: { size: 50, type: WidthType.PERCENTAGE },
                    borders: {
                      top: { style: BorderStyle.SINGLE, size: 4, color: "CBD5E1" },
                      bottom: { style: BorderStyle.SINGLE, size: 4, color: "CBD5E1" },
                      left: { style: BorderStyle.NONE, size: 0, color: "FFFFFF" },
                      right: { style: BorderStyle.NONE, size: 0, color: "FFFFFF" },
                    },
                    children: [
                      new Paragraph({
                        children: [
                          new TextRun({ text: "PULSE REFERENCE ID: ", bold: true, color: "3B82F6" }),
                          new TextRun({ text: pulseId, bold: true }),
                        ],
                      }),
                    ],
                  }),
                  new TableCell({
                    width: { size: 50, type: WidthType.PERCENTAGE },
                    borders: {
                      top: { style: BorderStyle.SINGLE, size: 4, color: "CBD5E1" },
                      bottom: { style: BorderStyle.SINGLE, size: 4, color: "CBD5E1" },
                      left: { style: BorderStyle.NONE, size: 0, color: "FFFFFF" },
                      right: { style: BorderStyle.NONE, size: 0, color: "FFFFFF" },
                    },
                    children: [
                      new Paragraph({
                        alignment: AlignmentType.RIGHT,
                        children: [
                          new TextRun({ text: "DATE: ", bold: true, color: "64748B" }),
                          new TextRun({ text: dateStr }),
                        ],
                      }),
                    ],
                  }),
                ],
              }),
            ],
          }),

          new Paragraph({ text: "", spacing: { after: 300 } }),

          // Section 1: Client & Contact Info
          new Paragraph({
            children: [
              new TextRun({ text: "1. CLIENT & CONTACT INFORMATION", bold: true, size: 24, color: "0F172A" }),
            ],
            spacing: { before: 240, after: 120 },
          }),

          new Table({
            width: { size: 100, type: WidthType.PERCENTAGE },
            rows: [
              new TableRow({
                children: [
                  new TableCell({
                    width: { size: 30, type: WidthType.PERCENTAGE },
                    children: [new Paragraph({ children: [new TextRun({ text: "Client Name:", bold: true })] })],
                  }),
                  new TableCell({
                    width: { size: 70, type: WidthType.PERCENTAGE },
                    children: [new Paragraph({ text: leadName })],
                  }),
                ],
              }),
              new TableRow({
                children: [
                  new TableCell({
                    width: { size: 30, type: WidthType.PERCENTAGE },
                    children: [new Paragraph({ children: [new TextRun({ text: "Contact Details:", bold: true })] })],
                  }),
                  new TableCell({
                    width: { size: 70, type: WidthType.PERCENTAGE },
                    children: [new Paragraph({ text: leadContact })],
                  }),
                ],
              }),
              new TableRow({
                children: [
                  new TableCell({
                    width: { size: 30, type: WidthType.PERCENTAGE },
                    children: [new Paragraph({ children: [new TextRun({ text: "Preferred Method:", bold: true })] })],
                  }),
                  new TableCell({
                    width: { size: 70, type: WidthType.PERCENTAGE },
                    children: [new Paragraph({ text: leadMethod })],
                  }),
                ],
              }),
            ],
          }),

          new Paragraph({ text: "", spacing: { after: 300 } }),

          // Section 2: Project Specifications & Scope
          new Paragraph({
            children: [
              new TextRun({ text: "2. PROJECT CONTEXT & SPECIFICATIONS", bold: true, size: 24, color: "0F172A" }),
            ],
            spacing: { before: 240, after: 120 },
          }),

          new Table({
            width: { size: 100, type: WidthType.PERCENTAGE },
            rows: [
              new TableRow({
                children: [
                  new TableCell({
                    width: { size: 30, type: WidthType.PERCENTAGE },
                    children: [new Paragraph({ children: [new TextRun({ text: "Primary Intent:", bold: true })] })],
                  }),
                  new TableCell({
                    width: { size: 70, type: WidthType.PERCENTAGE },
                    children: [new Paragraph({ text: intent })],
                  }),
                ],
              }),
              new TableRow({
                children: [
                  new TableCell({
                    width: { size: 30, type: WidthType.PERCENTAGE },
                    children: [new Paragraph({ children: [new TextRun({ text: "Industry Focus:", bold: true })] })],
                  }),
                  new TableCell({
                    width: { size: 70, type: WidthType.PERCENTAGE },
                    children: [new Paragraph({ text: industry })],
                  }),
                ],
              }),
              new TableRow({
                children: [
                  new TableCell({
                    width: { size: 30, type: WidthType.PERCENTAGE },
                    children: [new Paragraph({ children: [new TextRun({ text: "Project Scale:", bold: true })] })],
                  }),
                  new TableCell({
                    width: { size: 70, type: WidthType.PERCENTAGE },
                    children: [new Paragraph({ text: scale })],
                  }),
                ],
              }),
              new TableRow({
                children: [
                  new TableCell({
                    width: { size: 30, type: WidthType.PERCENTAGE },
                    children: [new Paragraph({ children: [new TextRun({ text: "Target Timeline:", bold: true })] })],
                  }),
                  new TableCell({
                    width: { size: 70, type: WidthType.PERCENTAGE },
                    children: [new Paragraph({ text: timeline })],
                  }),
                ],
              }),
              new TableRow({
                children: [
                  new TableCell({
                    width: { size: 30, type: WidthType.PERCENTAGE },
                    children: [new Paragraph({ children: [new TextRun({ text: "Budget Allocation:", bold: true })] })],
                  }),
                  new TableCell({
                    width: { size: 70, type: WidthType.PERCENTAGE },
                    children: [new Paragraph({ text: budget })],
                  }),
                ],
              }),
              new TableRow({
                children: [
                  new TableCell({
                    width: { size: 30, type: WidthType.PERCENTAGE },
                    children: [new Paragraph({ children: [new TextRun({ text: "Primary Goals (Features):", bold: true })] })],
                  }),
                  new TableCell({
                    width: { size: 70, type: WidthType.PERCENTAGE },
                    children: [new Paragraph({ text: goals })],
                  }),
                ],
              }),
            ],
          }),

          new Paragraph({ text: "", spacing: { after: 300 } }),

          // Section 3: Recommended Architecture Modules
          new Paragraph({
            children: [
              new TextRun({ text: "3. RECOMMENDED SYSTEM ARCHITECTURE MODULES", bold: true, size: 24, color: "0F172A" }),
            ],
            spacing: { before: 240, after: 120 },
          }),

          ...modules.map(
            (mod, idx) =>
              new Paragraph({
                children: [
                  new TextRun({ text: `• `, bold: true, color: "3B82F6" }),
                  new TextRun({ text: `Module 0${idx + 1}: `, bold: true }),
                  new TextRun({ text: mod }),
                ],
                spacing: { after: 80 },
              })
          ),

          new Paragraph({ text: "", spacing: { after: 300 } }),

          // Section 4: Discovery Q&A History (Pulse Question directly above User Response)
          new Paragraph({
            children: [
              new TextRun({ text: "4. DISCOVERY Q&A HISTORY", bold: true, size: 24, color: "0F172A" }),
            ],
            spacing: { before: 240, after: 120 },
          }),

          ...(qaPairs.length > 0
            ? qaPairs.flatMap((pair, idx) => [
                new Paragraph({
                  children: [
                    new TextRun({ text: `Question ${idx + 1}: `, bold: true, color: "1E4FD9" }),
                    new TextRun({ text: pair.question, bold: true, color: "0F172A" }),
                  ],
                  spacing: { before: 140, after: 40 },
                }),
                new Paragraph({
                  children: [
                    new TextRun({ text: `User Response: `, bold: true, color: "475569" }),
                    new TextRun({ text: `"${pair.answer}"`, italics: true, color: "334155" }),
                  ],
                  spacing: { after: 120 },
                }),
              ])
            : [new Paragraph({ text: "No custom Q&A recorded." })]),

          new Paragraph({ text: "", spacing: { after: 300 } }),

          // Section 5: Assumptions & Unknowns
          new Paragraph({
            text: "5. ASSUMPTIONS & UNKNOWNS",
            heading: HeadingLevel.HEADING_2,
            spacing: { before: 300, after: 120 },
          }),
          new Paragraph({
            children: [
              new TextRun({ text: "• Payment Provider: ", bold: true }),
              new TextRun({ text: "Not specified (to be selected during technical discovery review)" }),
            ],
            spacing: { after: 60 },
          }),
          new Paragraph({
            children: [
              new TextRun({ text: "• Hosting & Infrastructure: ", bold: true }),
              new TextRun({ text: "Not specified (to be assigned during deployment mapping)" }),
            ],
            spacing: { after: 60 },
          }),
          new Paragraph({
            children: [
              new TextRun({ text: "• Third-Party Integrations: ", bold: true }),
              new TextRun({ text: "Not specified (to be identified upon API contract audit)" }),
            ],
            spacing: { after: 300 },
          }),

          // Footer Notice
          new Paragraph({
            alignment: AlignmentType.CENTER,
            children: [
              new TextRun({
                text: "CONFIDENTIAL & PROPRIETARY — ACEVA TECHNOLOGY",
                size: 16,
                color: "94A3B8",
                italics: true,
              }),
            ],
          }),
        ],
      },
    ],
  });

  const blob = await Packer.toBlob(doc);
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `ACEVA_Blueprint_${pulseId}.docx`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
