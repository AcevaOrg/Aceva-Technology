import { CATEGORIES } from "@/lib/documents/categories";
import type { DocumentCategory } from "@/lib/documents/types";

/**
 * Temporary overrides of a category spec, for protecting generic mechanisms that no shipped category
 * exercises any more. The ID card category was the only one that required a photo and the only boolean
 * that defaulted to true; both mechanisms are still live code (the publish gate, the editor, the attention
 * list and the validator all read the spec at call time), so the tests flip them here rather than lose
 * their coverage.
 *
 * Every function returns its own undo. Call it in `finally` or `afterEach`: the specs are module-level
 * singletons shared by every test in the file.
 */

/** Switches "a photo is required to publish" on for one category. */
export function requirePhoto(category: DocumentCategory): () => void {
  const spec = CATEGORIES[category];
  const previous = spec.photoRequired;
  spec.photoRequired = true;
  return () => {
    spec.photoRequired = previous;
  };
}

/** Changes the initial value of one boolean field of a category. */
export function setBooleanDefault(category: DocumentCategory, fieldKey: string, value: boolean): () => void {
  const field = CATEGORIES[category].fields.find((candidate) => candidate.key === fieldKey);
  if (!field || field.type !== "boolean") throw new Error(`fixture: ${category} has no boolean field ${fieldKey}`);
  const previous = field.defaultValue;
  field.defaultValue = value;
  return () => {
    field.defaultValue = previous;
  };
}
