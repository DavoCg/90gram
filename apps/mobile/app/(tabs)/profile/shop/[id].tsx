// Same shared shop detail screen as the other tabs, mounted here so opening a shop from a record in
// the Profile stack pushes ON TOP of it (and keeps the Profile tab active). The shared vinyl detail
// reaches this via relative navigation (`../shop/[id]`). See src/screens/shop-detail.tsx.
export { default } from '../../../../src/screens/shop-detail';
