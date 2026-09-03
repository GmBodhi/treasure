import { createElement, Fragment } from 'react';

/**
 * Manifest content is server-authored, but it still becomes live DOM, so
 * `primitives` overlays only accept known A-Frame tags and plain attribute
 * names — never event handlers or arbitrary markup.
 *
 * Rendering through React rather than innerHTML means the escaping problem
 * disappears: attribute values are set with setAttribute, so a quote in a
 * manifest string can never break out into markup.
 */
const ALLOWED_PRIMITIVES = new Set([
  'a-box', 'a-sphere', 'a-cylinder', 'a-cone', 'a-plane', 'a-circle',
  'a-ring', 'a-torus', 'a-torus-knot', 'a-octahedron', 'a-tetrahedron',
  'a-text', 'a-entity', 'a-light',
]);
const ATTR_NAME = /^[a-z][a-z0-9-]*$/;

function renderNode(node, key) {
  const tag = String(node?.tag ?? '').toLowerCase();
  if (!ALLOWED_PRIMITIVES.has(tag)) {
    console.warn(`overlay: primitive "${node?.tag}" is not on the allow list — skipped`);
    return null;
  }

  const props = { key };
  for (const [rawName, value] of Object.entries(node.attrs ?? {})) {
    // A-Frame spells every attribute with hyphens (`radius-inner`), but the
    // underscored form is an easy slip when authoring and would otherwise be
    // dropped in silence — leaving a primitive rendered at its default size
    // with nothing in the console to explain why.
    const name = rawName.replace(/_/g, '-');
    if (!ATTR_NAME.test(name) || name.startsWith('on')) continue;
    // A-Frame parses every component value from its string form.
    props[name] = String(value);
  }

  const children = (node.children ?? []).map((child, i) => renderNode(child, i));
  return createElement(tag, props, children.length ? children : undefined);
}

export default function Primitives({ overlay }) {
  // `nodes` is a list of siblings; `tree` is a single root. Both are natural
  // ways to author an overlay, and supporting each costs one line.
  const roots = overlay.nodes ?? (overlay.tree ? [overlay.tree] : []);
  return <Fragment>{roots.map((node, i) => renderNode(node, i))}</Fragment>;
}
