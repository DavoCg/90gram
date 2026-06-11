// Same shared shop detail screen as the Home and Favorites stacks, mounted here so opening a shop
// from a record in Search pushes ON TOP of the search stack (and keeps the Search tab active). The
// shared screen reaches this via relative navigation (`../shop/[id]`). See src/screens/shop-detail.tsx.
export { default } from '../../../../src/screens/shop-detail';
