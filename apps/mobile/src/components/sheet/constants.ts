// Harmonized horizontal padding for the content of every native form sheet (currency, filter,
// auth-method). One source of truth so the title, list rows, and footer all share a single left edge.
// Wider than the old 16/20 px each sheet used ad hoc, for a more generous, consistent inset.
export const SHEET_PADDING_X = 28;

// Gap between the pinned sheet header and the start of its content. For a scrolling sheet this is the
// list's internal top padding (so the first row clears the header but still scrolls up under it),
// applied by SheetScrollView; non-scroll sheets apply it to their content container directly.
export const SHEET_CONTENT_TOP = 8;

// How far a selectable row's padding (and thus its selected-state background) bleeds back out past
// SHEET_PADDING_X. A row's label always sits at SHEET_PADDING_X (aligned with the sheet title), while
// the highlighted background of an active row overflows toward the sheet edges by this amount. The row
// achieves both with a negative horizontal margin plus a matching inner padding. See SheetSelectableRow.
export const SHEET_ROW_INSET = 18;
