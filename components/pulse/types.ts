export type PulseStage = "entry" | "intent" | "discovery" | "direction" | "contact" | "confirmation";

export interface PulseContextData {
  intent?: string;
  industry?: string;
  business?: string;
  current?: string;
  scale?: string;
  market?: string;
  friction?: string[];
  goals?: string[];
  timeline?: string;
  budget?: string;
}

export interface PulseLead {
  name: string;
  contact: string;
  method: "Email" | "Phone" | "Text";
}

export interface PulseMessage {
  id: string;
  sender: "user" | "pulse";
  text: string;
  timestamp: string;
}

export interface PulseState {
  open: boolean;
  stage: PulseStage;
  step: number;
  answers: string[];
  context: PulseContextData;
  messages: PulseMessage[];
  lead?: PulseLead;
  id?: string;
  loading?: boolean;
}

export type PulseAction =
  | { type: "OPEN" }
  | { type: "CLOSE" }
  | { type: "INTENT"; value: string }
  | { type: "ANSWER"; value: string; inferred?: Partial<PulseContextData> }
  | { type: "RECORD_VALID_ANSWER"; value: string; inferred?: Partial<PulseContextData> }
  | { type: "SEND_MESSAGE"; text: string }
  | { type: "SET_LOADING"; loading: boolean }
  | { type: "ADD_PULSE_RESPONSE"; text: string }
  | { type: "COMPLETE" }
  | { type: "CONTACT" }
  | { type: "CONFIRM"; lead: PulseLead; id: string }
  | { type: "RESTORE"; session: Partial<PulseState> }
  | { type: "RESTART" }
  | { type: "UNDO_LAST_ANSWER" };

export interface WizardStepSpec {
  label: string;
  title: string;
  helper: string;
  placeholder: string;
}

export interface DocumentChunkMetadata {
  source: string;
  title: string;
  category: string;
  url: string;
  company?: string;
  heading?: string;
}

export interface VectorDocumentChunk {
  id: string;
  hash: string;
  content: string;
  metadata: DocumentChunkMetadata;
  embedding: number[];
}

export interface VectorDatabaseIndex {
  version: string;
  embeddingModel: string;
  dimension: number;
  updatedAt: string;
  chunks: VectorDocumentChunk[];
}
