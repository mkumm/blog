// Turns Obsidian-style callouts into styled blocks, so lab notes can be
// pasted in from Obsidian without rewriting them:
//
//   > [!warning] Optional title        ->  <div class="callout callout-warning">
//   > Body text
//
//   > [!success]- Solution             ->  <details class="callout callout-success">
//   > Body text                            (`-` starts collapsed, `+` starts open)
//
// Callouts can be nested. Styles live in src/layouts/LabPost.astro.

const MARKER = /^\[!(\w+)\]([+-]?)[ \t]*/;

function toCallout(node) {
  const first = node.children.find((child) => child.type === 'element');
  if (first?.tagName !== 'p') return;
  const lead = first.children[0];
  if (lead?.type !== 'text') return;
  const match = lead.value.match(MARKER);
  if (!match) return;

  const type = match[1].toLowerCase();
  const fold = match[2];
  lead.value = lead.value.slice(match[0].length);

  // Everything up to the first line break is the title; the rest of that
  // paragraph (if any) is the start of the body.
  const title = [];
  const rest = [];
  let pastTitle = false;
  for (const child of first.children) {
    if (pastTitle) {
      rest.push(child);
    } else if (child.type === 'text' && child.value.includes('\n')) {
      const at = child.value.indexOf('\n');
      const before = child.value.slice(0, at);
      const after = child.value.slice(at + 1);
      if (before) title.push({ type: 'text', value: before });
      if (after) rest.push({ type: 'text', value: after });
      pastTitle = true;
    } else if (child.type !== 'text' || child.value) {
      title.push(child);
    }
  }
  if (title.length === 0) {
    title.push({ type: 'text', value: type[0].toUpperCase() + type.slice(1) });
  }

  const body = node.children.filter((child) => child !== first);
  if (rest.length > 0) {
    body.unshift({ type: 'element', tagName: 'p', properties: {}, children: rest });
  }

  node.tagName = fold ? 'details' : 'div';
  node.properties = { className: ['callout', `callout-${type}`] };
  if (fold === '+') node.properties.open = true;
  node.children = [
    {
      type: 'element',
      tagName: fold ? 'summary' : 'p',
      properties: { className: ['callout-title'] },
      children: title,
    },
    { type: 'element', tagName: 'div', properties: { className: ['callout-body'] }, children: body },
  ];
}

/** @type {import('unified').Plugin} */
export default function rehypeCallouts() {
  return (tree) => {
    function visit(node) {
      if (node.type === 'element' && node.tagName === 'blockquote') toCallout(node);
      node.children?.forEach(visit);
    }
    visit(tree);
  };
}
