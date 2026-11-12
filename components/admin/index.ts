/**
 * Admin console UI kit ("The Slash" on the ink surface).
 *
 * Import components from "@/components/admin". Pages that need a layout or typography class import the
 * stylesheet through `adminStyles`:
 *
 *   import { adminStyles as ui } from "@/components/admin";
 *   <div className={ui.stats}>...</div>
 *
 * Everything is scoped under the admin root element that app/admin/layout.tsx renders, so none of it leaks
 * onto the marketing site. Mind these house rules (details at the top of admin.module.css):
 *   - Never write an inline `grid-template-columns`: globals.css forces it to one column at <=767px.
 *     Use the grid classes below, or set the `--cols` custom property on a `ledger` row instead.
 *   - Colour comes from the tokens in the stylesheet. Do not add hex values to pages. The light "paper"
 *     surface is for printed-document previews only (`<Panel tone="paper">`).
 *   - Interactive things are at least 44px tall; keep them that way.
 *
 * CLASS NAMES TO REUSE (adminStyles.<name>)
 *
 *   Layout        stack, stackLg      vertical rhythm (14px / fluid 24-40px gaps)
 *                 cluster             wrapping flex row with 12px gap, vertically centred
 *                 grid2, grid3        1 column on phones, 2 / 3 from 760px
 *                 stats               auto-fit grid for StatTile
 *                 split, splitAside   editor layout: main column + sticky side column from 1080px
 *                 stagger             put on a parent: its first ten children rise in sequence
 *   Type          eyebrow (+ slash)   mono-caps line: <p class=eyebrow><i class=slash/><b>Label</b></p>
 *                 mono, muted, num    mono face, muted colour, tabular numbers
 *                 link                text link that draws its underline on hover
 *                 srOnly              visually hidden, still announced
 *   Ledger        ledger              hairline-ruled list container (role="table" or a list)
 *                 ledgerHead          column captions; hidden under 900px
 *                 ledgerRow           a row; set style={{ "--cols": "minmax(0,2fr) 140px 120px auto" }} for columns
 *                 cell                one column; add data-label="Updated" to caption it on phones
 *                 cellMain, cellTitle, cellSub     the primary column: title + one quiet line
 *                 cellEnd             right-aligned actions (stay clickable above rowLink)
 *                 rowLink             on the title <Link>: stretches over the whole row
 *                 raise               lift any other control above rowLink
 *                 ledgerFoot          count / pagination line under a ledger
 *   Toolbar       toolbar, toolbarGrow          wrapping filter row; the grow item takes the free width
 *                 search, searchIcon            wrap a TextInput; the icon sits inside it
 *                 chips, chip, chipCount        filter chips (button or link); aria-pressed / aria-current="page" = active
 *   Forms         formSections        stack of FormSection fieldsets with hairline dividers
 *                 fieldGrid, span2    two-column field grid; span2 spans both
 *                 input, textarea, select         bare control styles, if a custom control is needed
 *   Misc          panel, panelPaper   use <Panel> instead of these directly
 *                 empty               use <EmptyState>
 *                 pageActions         right-aligned button row (PageHeader provides it)
 *
 * COMPONENTS
 *   Shell         AdminShell, AdminNav, SignOutButton
 *   Page          PageHeader, Panel, StatTile, CountUp, EmptyState, SlashStage, RisingWords
 *   Badges        Badge, StatusBadge, VisibilityBadge, VerificationBadge
 *   Actions       Button, ButtonLink, IconButton, CopyButton, ConfirmDialog, ToastProvider + useToast
 *   Loading       Spinner, AdminTableSkeleton, AdminStatSkeleton, AdminFormSkeleton
 *   Forms         FormField (+ useFieldContext), TextInput, TextArea, SelectInput, DateInput, Switch, TagInput,
 *                 SegmentedControl, FileDrop, FormSection, ActionBar
 *   Utilities     resizeImageFile, formatBytes, validateUpload, describeAccepted, cx, icons (./icons)
 */

export { default as adminStyles } from "./admin.module.css";

export { AdminShell } from "./AdminShell";
export { AdminNav } from "./AdminNav";
export { SignOutButton } from "./SignOutButton";

export { PageHeader } from "./PageHeader";
export { Panel } from "./Panel";
export { StatTile, type StatTone } from "./StatTile";
export { CountUp } from "./CountUp";
export { EmptyState } from "./EmptyState";
export { SlashStage } from "./SlashStage";
export { RisingWords } from "./RisingWords";

export { Badge, StatusBadge, VisibilityBadge, VerificationBadge, type BadgeTone } from "./Badge";

export { Button, ButtonLink, type ButtonProps, type ButtonLinkProps, type ButtonSize, type ButtonVariant } from "./Button";
export { IconButton, type IconButtonProps } from "./IconButton";
export { CopyButton } from "./CopyButton";
export { ConfirmDialog, type ConfirmDialogProps } from "./ConfirmDialog";
export { ToastProvider, useToast, type ToastApi, type ToastOptions } from "./Toast";

export { Spinner } from "./Spinner";
export { AdminTableSkeleton, AdminStatSkeleton, AdminFormSkeleton } from "./Skeletons";

export { FormField, useFieldContext, type FieldContextValue } from "./FormField";
export {
  TextInput,
  TextArea,
  SelectInput,
  DateInput,
  type TextInputProps,
  type TextAreaProps,
  type SelectInputProps,
  type DateInputProps,
} from "./inputs";
export { Switch } from "./Switch";
export { TagInput } from "./TagInput";
export { SegmentedControl, type SegmentedControlProps, type SegmentedOption } from "./SegmentedControl";
export { FileDrop, type ExistingFile, type FileDropProps } from "./FileDrop";
export { FormSection, ActionBar } from "./FormSection";

export { resizeImageFile, type ResizeOptions } from "./imageResize";
export { cx, describeAccepted, formatBytes, validateUpload } from "./utils";
export * from "./icons";
