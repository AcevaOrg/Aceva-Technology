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
import { getRecommendedModules } from "./modules";

export async function downloadPulseBlueprintDocx(state: PulseState, pulseId: string) {
  const dateStr = new Date().toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });

  const leadName = state.lead?.name || "Not specified";
  const leadContact = state.lead?.contact || "Not specified";
  const leadMethod = state.lead?.method || "Email";

  const intent = state.context.intent || "Custom Solution";
  const industry = state.context.industry || "General Business";
  const timeline = state.context.timeline || state.answers[4] || state.answers[3] || "Not specified";
  const scale = state.context.scale || "Not specified";
  const goals = state.context.goals?.join(", ") || "None specified";
  const friction = state.context.friction?.join(", ") || "None specified";

  const modules = getRecommendedModules(state.context.industry, state.context);

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
                    children: [new Paragraph({ children: [new TextRun({ text: "Primary Goals:", bold: true })] })],
                  }),
                  new TableCell({
                    width: { size: 70, type: WidthType.PERCENTAGE },
                    children: [new Paragraph({ text: goals })],
                  }),
                ],
              }),
              new TableRow({
                children: [
                  new TableCell({
                    width: { size: 30, type: WidthType.PERCENTAGE },
                    children: [new Paragraph({ children: [new TextRun({ text: "Friction Points:", bold: true })] })],
                  }),
                  new TableCell({
                    width: { size: 70, type: WidthType.PERCENTAGE },
                    children: [new Paragraph({ text: friction })],
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

          // Section 4: Discovery Q&A History
          new Paragraph({
            children: [
              new TextRun({ text: "4. DISCOVERY Q&A HISTORY", bold: true, size: 24, color: "0F172A" }),
            ],
            spacing: { before: 240, after: 120 },
          }),

          ...(state.answers.length > 0
            ? state.answers.map(
                (ans, i) =>
                  new Paragraph({
                    children: [
                      new TextRun({ text: `Q${i + 1}: `, bold: true, color: "475569" }),
                      new TextRun({ text: `"${ans}"` }),
                    ],
                    spacing: { after: 100 },
                  })
              )
            : [new Paragraph({ text: "No custom Q&A recorded." })]),

          new Paragraph({ text: "", spacing: { after: 400 } }),

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
