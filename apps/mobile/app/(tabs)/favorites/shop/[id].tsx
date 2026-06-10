// Same shared shop detail screen as the Home stack, mounted here so opening a shop from a record in
// Favorites pushes ON TOP of the favorites stack (and keeps the Favorites tab active) instead of
// jumping to Home. The shared screen reaches this via relative navigation (`../shop/[id]`), which
// resolves to this route when the record was opened in Favorites. See src/screens/shop-detail.tsx.
export { default } from '../../../../src/screens/shop-detail';
