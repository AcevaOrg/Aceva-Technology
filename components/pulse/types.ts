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

/** The turn a Retry button would re-send. Null once it succeeds. */
export interface PulseRetryTarget {
  text: string;
  inferred?: Partial<PulseContextData>;
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
  /** True between the first token and the done frame. */
  streaming?: boolean;
  /** Set when the last turn failed, so the UI can offer Retry. */
  retry?: PulseRetryTarget | null;
  /**
   * `messages.length` as each recorded answer's turn began, one entry per
   * entry in `answers`. Undo rewinds to the last of these, so it removes
   * exactly the turn that was recorded and nothing else.
   */
  answerMarks?: number[];
  /** Where the in-flight turn began. Promoted to `answerMarks` if it counts. */
  turnStart?: number;
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
  | { type: "PULSE_STREAM_START" }
  | { type: "PULSE_STREAM_DELTA"; text: string }
  | { type: "PULSE_STREAM_END"; text?: string }
  | { type: "SET_RETRY"; retry: PulseRetryTarget | null }
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
