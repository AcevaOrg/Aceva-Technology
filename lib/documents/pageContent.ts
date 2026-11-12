import {
  PDFArray,
  PDFDict,
  PDFName,
  PDFNumber,
  PDFRawStream,
  PDFStream,
  decodePDFRawStream,
  type PDFPage,
} from "pdf-lib";

/**
 * Where a PDF page has something on it: text, lines, filled shapes, pictures and form fields. The stamp uses it to
 * stay clear of all of it.
 *
 * This reads the page's own drawing instructions (its content stream), not a picture of the page. It follows the
 * graphics state the way a viewer does (positions, scaling, nested forms) and records a bounding box for each thing
 * drawn. Two honest limits:
 *
 * - Text is boxed by an estimate (every letter counted as 0.6 em wide), generous on purpose: a box that is a little
 *   too large costs a few points of clear space, one that is too small would let the stamp touch a word.
 * - It cannot see inside a picture. A page that is only a picture (a scan, an exported image) is reported `blind`,
 *   and so is one it could not read; the caller must then not trust the page to have free space.
 */

export interface Rect {
  x0: number;
  y0: number;
  x1: number;
  y1: number;
}

export interface PageContent {
  /** What the page shows, in the page's own coordinates (before any /Rotate). Backgrounds and frames are not here as areas. */
  boxes: Rect[];
  /** The page could not be read well enough to promise it has free space. */
  blind: boolean;
}

type Matrix = [number, number, number, number, number, number];
const IDENTITY: Matrix = [1, 0, 0, 1, 0, 0];

/** m, then n. */
function mul(m: Matrix, n: Matrix): Matrix {
  return [
    m[0] * n[0] + m[1] * n[2],
    m[0] * n[1] + m[1] * n[3],
    m[2] * n[0] + m[3] * n[2],
    m[2] * n[1] + m[3] * n[3],
    m[4] * n[0] + m[5] * n[2] + n[4],
    m[4] * n[1] + m[5] * n[3] + n[5],
  ];
}

function apply(m: Matrix, x: number, y: number): [number, number] {
  return [m[0] * x + m[2] * y + m[4], m[1] * x + m[3] * y + m[5]];
}

function boundsOf(points: ReadonlyArray<readonly [number, number]>): Rect {
  let x0 = Infinity;
  let y0 = Infinity;
  let x1 = -Infinity;
  let y1 = -Infinity;
  for (const [x, y] of points) {
    if (x < x0) x0 = x;
    if (x > x1) x1 = x;
    if (y < y0) y0 = y;
    if (y > y1) y1 = y;
  }
  return { x0, y0, x1, y1 };
}

/* ------------------------------------------------------------------ *
 * Reading a content stream                                             *
 * ------------------------------------------------------------------ */

type Operand = number | boolean | string | null | StringOperand | Operand[];
interface StringOperand {
  /** Bytes in the string. */
  length: number;
}
type Token = { kind: "value"; value: Operand } | { kind: "op"; name: string } | { kind: "close-array" } | { kind: "close-dict" } | null;

const isSpace = (code: number) => code === 32 || code === 10 || code === 13 || code === 9 || code === 12 || code === 0;
const DELIMITERS = new Set(["(", ")", "<", ">", "[", "]", "{", "}", "/", "%"]);
const NUMBER = /^[+-]?(?:\d+\.?\d*|\.\d+)$/;

class Lexer {
  position = 0;
  constructor(readonly text: string) {}

  private skipBlank(): void {
    const { text } = this;
    while (this.position < text.length) {
      const code = text.charCodeAt(this.position);
      if (isSpace(code)) this.position += 1;
      else if (code === 37) {
        // % comment, to the end of the line
        while (this.position < text.length && text[this.position] !== "\n" && text[this.position] !== "\r") this.position += 1;
      } else break;
    }
  }

  read(): Token {
    this.skipBlank();
    const { text } = this;
    if (this.position >= text.length) return null;
    const char = text[this.position];

    if (char === "/") {
      this.position += 1;
      const start = this.position;
      while (this.position < text.length && !isSpace(text.charCodeAt(this.position)) && !DELIMITERS.has(text[this.position])) this.position += 1;
      return { kind: "value", value: `/${text.slice(start, this.position)}` };
    }
    if (char === "(") return { kind: "value", value: this.literalString() };
    if (char === "<") {
      if (text[this.position + 1] === "<") {
        this.position += 2;
        for (let guard = 0; guard < 100_000; guard += 1) {
          const inner = this.read();
          if (inner === null || inner.kind === "close-dict") break;
        }
        return { kind: "value", value: null };
      }
      const end = text.indexOf(">", this.position);
      const body = text.slice(this.position + 1, end === -1 ? text.length : end).replace(/\s+/g, "");
      this.position = end === -1 ? text.length : end + 1;
      return { kind: "value", value: { length: Math.ceil(body.length / 2) } };
    }
    if (char === ">") {
      this.position += text[this.position + 1] === ">" ? 2 : 1;
      return { kind: "close-dict" };
    }
    if (char === "[") {
      this.position += 1;
      const items: Operand[] = [];
      for (let guard = 0; guard < 1_000_000; guard += 1) {
        const inner = this.read();
        if (inner === null || inner.kind === "close-array") break;
        if (inner.kind === "value") items.push(inner.value);
      }
      return { kind: "value", value: items };
    }
    if (char === "]") {
      this.position += 1;
      return { kind: "close-array" };
    }
    if (char === ")" || char === "{" || char === "}") {
      this.position += 1;
      return this.read();
    }

    const start = this.position;
    while (this.position < text.length && !isSpace(text.charCodeAt(this.position)) && !DELIMITERS.has(text[this.position])) this.position += 1;
    const word = text.slice(start, this.position);
    if (NUMBER.test(word)) return { kind: "value", value: Number(word) };
    if (word === "true") return { kind: "value", value: true };
    if (word === "false") return { kind: "value", value: false };
    if (word === "null") return { kind: "value", value: null };
    return { kind: "op", name: word };
  }

  /** A (string): its length in bytes, with escapes counted as the one byte they stand for. */
  private literalString(): StringOperand {
    const { text } = this;
    let depth = 0;
    let length = 0;
    while (this.position < text.length) {
      const char = text[this.position];
      this.position += 1;
      if (char === "\\") {
        const next = text[this.position];
        if (next !== undefined && next >= "0" && next <= "7") {
          let digits = 1;
          this.position += 1;
          while (digits < 3 && text[this.position] >= "0" && text[this.position] <= "7") {
            this.position += 1;
            digits += 1;
          }
          length += 1;
        } else if (next === "\r") {
          this.position += text[this.position + 1] === "\n" ? 2 : 1;
        } else if (next === "\n") {
          this.position += 1;
        } else {
          this.position += 1;
          length += 1;
        }
      } else if (char === "(") {
        depth += 1;
        length += 1;
      } else if (char === ")") {
        if (depth === 0) break;
        depth -= 1;
        length += 1;
      } else {
        length += 1;
      }
    }
    return { length };
  }
}

const isString = (value: Operand | undefined): value is StringOperand => typeof value === "object" && value !== null && !Array.isArray(value) && "length" in value;

/* ------------------------------------------------------------------ *
 * The interpreter                                                      *
 * ------------------------------------------------------------------ */

/** Drawing operations read per file. A certificate has a few hundred; a map or a drawing can have millions. */
export const MAX_OPERATORS = 300_000;
const MAX_FORM_DEPTH = 4;
/** One letter's width, as a share of the font size. Generous: wider than most letters, so a text box is never short. */
const GLYPH_WIDTH = 0.6;
const ASCENT = 0.95;
const DESCENT = 0.28;
/** A filled shape at least this share of the page is the page's background, not something to avoid. */
const BACKGROUND_SHARE = 0.85;
/** A stroked outline at least this share of the page is a frame: only its lines count, not what it encloses. */
const FRAME_SHARE = 0.35;

interface Subpath {
  points: Array<[number, number]>;
  closed: boolean;
  rect: boolean;
}

interface GraphicsState {
  ctm: Matrix;
  lineWidth: number;
  fontSize: number;
  wide: boolean;
  charSpacing: number;
  horizontalScale: number;
  leading: number;
  rise: number;
}

class Analyzer {
  readonly boxes: Rect[] = [];
  blind = false;
  /** A picture was drawn (of any size). With nothing else on the page, the page is only a picture. */
  sawImage = false;
  /** How many drawing operations were read, so the caller can share one allowance across all the pages of a file. */
  operatorsRead = 0;
  private textBoxes = 0;
  private vectorBoxes = 0;

  constructor(
    private readonly pageArea: number,
    /** Operations this page may use, so one huge file cannot make a request run on and on. */
    private readonly budget: number,
  ) {}

  get hasMarks(): boolean {
    return this.textBoxes + this.vectorBoxes > 0;
  }

  private push(box: Rect, kind: "text" | "vector"): void {
    if (![box.x0, box.y0, box.x1, box.y1].every(Number.isFinite)) return;
    this.boxes.push(box);
    if (kind === "text") this.textBoxes += 1;
    else this.vectorBoxes += 1;
  }

  run(text: string, resources: PDFDict | undefined, matrix: Matrix, depth: number): void {
    const lexer = new Lexer(text);
    let state: GraphicsState = { ctm: matrix, lineWidth: 1, fontSize: 0, wide: false, charSpacing: 0, horizontalScale: 100, leading: 0, rise: 0 };
    const saved: GraphicsState[] = [];
    let tm: Matrix = IDENTITY;
    let tlm: Matrix = IDENTITY;
    let subpaths: Subpath[] = [];
    let current: Subpath | null = null;
    const stack: Operand[] = [];

    const num = (index: number): number => (typeof stack[index] === "number" ? (stack[index] as number) : 0);
    const startSubpath = (x: number, y: number): void => {
      current = { points: [apply(state.ctm, x, y)], closed: false, rect: false };
      subpaths.push(current);
    };
    const extend = (...coordinates: number[]): void => {
      if (current === null) startSubpath(coordinates[0], coordinates[1]);
      const path = current as Subpath | null;
      if (path === null) return;
      for (let i = 0; i < coordinates.length; i += 2) path.points.push(apply(state.ctm, coordinates[i], coordinates[i + 1]));
    };
    const scale = (): number => Math.sqrt(Math.abs(state.ctm[0] * state.ctm[3] - state.ctm[1] * state.ctm[2])) || 1;

    const paint = (fill: boolean, stroke: boolean): void => {
      const half = stroke ? (state.lineWidth * scale()) / 2 : 0;
      for (const subpath of subpaths) {
        if (subpath.points.length === 0) continue;
        const bounds = boundsOf(subpath.points);
        const area = (bounds.x1 - bounds.x0) * (bounds.y1 - bounds.y0);
        if (fill && !stroke && area >= BACKGROUND_SHARE * this.pageArea) continue;
        if (stroke && area >= FRAME_SHARE * this.pageArea && (subpath.closed || subpath.rect)) {
          // A frame: its four lines are something to avoid; the empty page inside it is not.
          const t = Math.max(half * 2, 1) + 2;
          const { x0, y0, x1, y1 } = bounds;
          this.push({ x0: x0 - t, y0: y0 - t, x1: x1 + t, y1: y0 + t }, "vector");
          this.push({ x0: x0 - t, y0: y1 - t, x1: x1 + t, y1: y1 + t }, "vector");
          this.push({ x0: x0 - t, y0: y0 - t, x1: x0 + t, y1: y1 + t }, "vector");
          this.push({ x0: x1 - t, y0: y0 - t, x1: x1 + t, y1: y1 + t }, "vector");
          continue;
        }
        this.push({ x0: bounds.x0 - half, y0: bounds.y0 - half, x1: bounds.x1 + half, y1: bounds.y1 + half }, "vector");
      }
    };

    const showText = (items: Operand[]): void => {
      const fontSize = state.fontSize;
      if (!(fontSize > 0)) return;
      const factor = (state.horizontalScale || 100) / 100;
      let advance = 0;
      let min = 0;
      for (const item of items) {
        if (typeof item === "number") {
          advance -= (item / 1000) * fontSize * factor;
          if (advance < min) min = advance;
        } else if (isString(item)) {
          const glyphs = state.wide ? Math.ceil(item.length / 2) : item.length;
          advance += glyphs * (GLYPH_WIDTH * fontSize + state.charSpacing) * factor;
        }
      }
      if (advance > min) {
        const toUser = mul(tm, state.ctm);
        const corners: Array<[number, number]> = [
          apply(toUser, min, state.rise - DESCENT * fontSize),
          apply(toUser, advance, state.rise - DESCENT * fontSize),
          apply(toUser, min, state.rise + ASCENT * fontSize),
          apply(toUser, advance, state.rise + ASCENT * fontSize),
        ];
        this.push(boundsOf(corners), "text");
      }
      tm = mul([1, 0, 0, 1, advance, 0], tm);
    };

    const nextLine = (): void => {
      tlm = mul([1, 0, 0, 1, 0, -state.leading], tlm);
      tm = tlm;
    };

    const lookupFont = (name: string): { wide: boolean } => {
      try {
        const fonts = resources?.lookupMaybe(PDFName.of("Font"), PDFDict);
        const font = fonts?.lookupMaybe(PDFName.of(name.slice(1)), PDFDict);
        return { wide: String(font?.get(PDFName.of("Subtype"))) === "/Type0" };
      } catch {
        return { wide: false };
      }
    };

    const drawXObject = (name: string): void => {
      let object: unknown;
      try {
        object = resources?.lookupMaybe(PDFName.of("XObject"), PDFDict)?.lookup(PDFName.of(name.slice(1)));
      } catch {
        return;
      }
      if (!(object instanceof PDFStream)) return;
      const subtype = String(object.dict.get(PDFName.of("Subtype")));
      if (subtype === "/Image") {
        this.image(state.ctm);
        return;
      }
      if (subtype === "/Form" && depth < MAX_FORM_DEPTH) {
        const matrixEntry = object.dict.lookupMaybe(PDFName.of("Matrix"), PDFArray);
        const formMatrix = matrixEntry && matrixEntry.size() === 6 ? (Array.from({ length: 6 }, (_, i) => matrixEntry.lookup(i, PDFNumber).asNumber()) as Matrix) : IDENTITY;
        const formResources = object.dict.lookupMaybe(PDFName.of("Resources"), PDFDict) ?? resources;
        this.run(this.decode(object), formResources, mul(formMatrix, state.ctm), depth + 1);
      }
    };

    for (;;) {
      if (this.blind) return;
      const token = lexer.read();
      if (token === null) break;
      if (token.kind === "value") {
        stack.push(token.value);
        if (stack.length > 64) stack.shift();
        continue;
      }
      if (token.kind !== "op") continue;
      this.operatorsRead += 1;
      if (this.operatorsRead > this.budget) {
        this.blind = true;
        return;
      }

      switch (token.name) {
        case "q":
          saved.push({ ...state });
          break;
        case "Q":
          if (saved.length > 0) state = saved.pop() as GraphicsState;
          break;
        case "cm":
          state = { ...state, ctm: mul([num(0), num(1), num(2), num(3), num(4), num(5)], state.ctm) };
          break;
        case "w":
          state = { ...state, lineWidth: num(0) };
          break;

        case "m":
          startSubpath(num(0), num(1));
          break;
        case "l":
          extend(num(0), num(1));
          break;
        case "c":
          extend(num(0), num(1), num(2), num(3), num(4), num(5));
          break;
        case "v":
        case "y":
          extend(num(0), num(1), num(2), num(3));
          break;
        case "re": {
          const [x, y, w, h] = [num(0), num(1), num(2), num(3)];
          current = { points: [apply(state.ctm, x, y), apply(state.ctm, x + w, y), apply(state.ctm, x + w, y + h), apply(state.ctm, x, y + h)], closed: true, rect: true };
          subpaths.push(current);
          break;
        }
        case "h":
          if (current !== null) (current as Subpath).closed = true;
          break;
        case "S":
        case "s":
          paint(false, true);
          subpaths = [];
          current = null;
          break;
        case "f":
        case "F":
        case "f*":
          paint(true, false);
          subpaths = [];
          current = null;
          break;
        case "B":
        case "B*":
        case "b":
        case "b*":
          paint(true, true);
          subpaths = [];
          current = null;
          break;
        case "n":
          subpaths = [];
          current = null;
          break;

        case "BT":
          tm = IDENTITY;
          tlm = IDENTITY;
          break;
        case "Tf": {
          const name = typeof stack[0] === "string" ? stack[0] : "";
          state = { ...state, fontSize: num(1), wide: lookupFont(name).wide };
          break;
        }
        case "Tc":
          state = { ...state, charSpacing: num(0) };
          break;
        case "Tz":
          state = { ...state, horizontalScale: num(0) || 100 };
          break;
        case "TL":
          state = { ...state, leading: num(0) };
          break;
        case "Ts":
          state = { ...state, rise: num(0) };
          break;
        case "Td":
          tlm = mul([1, 0, 0, 1, num(0), num(1)], tlm);
          tm = tlm;
          break;
        case "TD":
          state = { ...state, leading: -num(1) };
          tlm = mul([1, 0, 0, 1, num(0), num(1)], tlm);
          tm = tlm;
          break;
        case "Tm":
          tlm = [num(0), num(1), num(2), num(3), num(4), num(5)];
          tm = tlm;
          break;
        case "T*":
          nextLine();
          break;
        case "Tj":
          showText([stack[0]]);
          break;
        case "TJ":
          showText(Array.isArray(stack[0]) ? stack[0] : []);
          break;
        case "'":
          nextLine();
          showText([stack[0]]);
          break;
        case '"':
          state = { ...state, charSpacing: num(1) };
          nextLine();
          showText([stack[2]]);
          break;

        case "Do":
          drawXObject(typeof stack[0] === "string" ? stack[0] : "");
          break;
        case "BI": {
          // An inline picture: its data runs from "ID" to "EI" and is not content-stream syntax, so skip it unread.
          const idAt = lexer.text.indexOf("ID", lexer.position);
          if (idAt === -1) {
            this.blind = true;
            return;
          }
          const end = /\sEI(?=\s|$)/.exec(lexer.text.slice(idAt + 3));
          lexer.position = end ? idAt + 3 + end.index + end[0].length : lexer.text.length;
          this.image(state.ctm);
          break;
        }
        default:
          break;
      }
      stack.length = 0;
    }
  }

  /** A picture occupies the unit square under the current transform, unless it is the page's background. */
  private image(ctm: Matrix): void {
    this.sawImage = true;
    const box = boundsOf([apply(ctm, 0, 0), apply(ctm, 1, 0), apply(ctm, 0, 1), apply(ctm, 1, 1)]);
    const area = (box.x1 - box.x0) * (box.y1 - box.y0);
    if (area >= BACKGROUND_SHARE * this.pageArea) return;
    this.push(box, "vector");
  }

  decode(stream: PDFStream): string {
    const bytes = stream instanceof PDFRawStream ? decodePDFRawStream(stream).decode() : stream.getContents();
    return Buffer.from(bytes).toString("latin1");
  }
}

/** All the content streams of a page, joined (a page may split its drawing across several). */
function pageText(analyzer: Analyzer, page: PDFPage): string {
  const contents = page.node.Contents();
  const streams: PDFStream[] = [];
  if (contents instanceof PDFStream) streams.push(contents);
  else if (contents instanceof PDFArray) {
    for (let i = 0; i < contents.size(); i += 1) {
      const entry = contents.lookup(i);
      if (entry instanceof PDFStream) streams.push(entry);
    }
  }
  return streams.map((stream) => analyzer.decode(stream)).join("\n");
}

/** Form fields and other annotations are drawn by the viewer, not in the content stream; their rectangles count. */
function annotationBoxes(page: PDFPage): Rect[] {
  const boxes: Rect[] = [];
  const annots = page.node.Annots();
  if (!annots) return boxes;
  for (let i = 0; i < annots.size(); i += 1) {
    const annot = annots.lookupMaybe(i, PDFDict);
    if (!annot) continue;
    const subtype = String(annot.get(PDFName.of("Subtype")));
    if (subtype === "/Link" || subtype === "/Popup") continue;
    const rect = annot.lookupMaybe(PDFName.of("Rect"), PDFArray);
    if (!rect || rect.size() !== 4) continue;
    const [a, b, c, d] = Array.from({ length: 4 }, (_, k) => rect.lookup(k, PDFNumber).asNumber());
    boxes.push({ x0: Math.min(a, c), y0: Math.min(b, d), x1: Math.max(a, c), y1: Math.max(b, d) });
  }
  return boxes;
}

/**
 * What is on this page. `budget` is how many drawing operations may still be read across the whole file; a page
 * that would exceed it is reported blind rather than read halfway.
 */
export function analysePage(page: PDFPage, budget = MAX_OPERATORS): PageContent & { operatorsUsed: number } {
  const crop = page.getCropBox();
  const analyzer = new Analyzer(Math.max(1, crop.width * crop.height), budget);
  try {
    const resources = page.node.Resources();
    analyzer.run(pageText(analyzer, page), resources, IDENTITY, 0);
    for (const box of annotationBoxes(page)) analyzer.boxes.push(box);
  } catch {
    analyzer.blind = true;
  }
  // A page with a picture and no text or drawing is only a picture: nothing can be promised about its free space.
  if (analyzer.sawImage && !analyzer.hasMarks) analyzer.blind = true;
  return { boxes: analyzer.boxes, blind: analyzer.blind, operatorsUsed: Math.min(budget, analyzer.operatorsRead) };
}
