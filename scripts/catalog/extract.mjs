import ts from 'typescript';

const identifier = /^[a-z0-9][a-z0-9_-]*$/;
const label = id => id.split(/[-_]/).map(word => word[0].toUpperCase() + word.slice(1)).join(' ');
const ordered = values => [...new Set(values)].sort();
const wrap = (providerId, providerVersion, entries) => ({ schemaVersion: 1, providerId, providerVersion, entries: entries.sort((a, b) => a.id < b.id ? -1 : a.id > b.id ? 1 : 0) });

function assertIdentifier(id) {
  if (typeof id !== 'string' || !identifier.test(id)) throw new Error(`Invalid folder identifier: ${String(id)}`);
}
function requireAsset(assets, name) {
  if (!assets.has(name)) throw new Error(`Missing paired folder asset: ${name}`);
}

/** Interpret only literal data from the pinned TypeScript source; never import/eval upstream code. */
function literal(node) {
  if (ts.isStringLiteral(node)) return node.text;
  if (node.kind === ts.SyntaxKind.TrueKeyword) return true;
  if (node.kind === ts.SyntaxKind.FalseKeyword) return false;
  if (ts.isArrayLiteralExpression(node)) return node.elements.map(literal);
  if (ts.isObjectLiteralExpression(node)) {
    const result = Object.create(null);
    for (const property of node.properties) {
      if (!ts.isPropertyAssignment(property) || !(ts.isIdentifier(property.name) || ts.isStringLiteral(property.name))) throw new Error('Unsupported static source property');
      const key = property.name.text;
      if (Object.hasOwn(result, key)) throw new Error('Duplicate static source property');
      result[key] = literal(property.initializer);
    }
    return result;
  }
  if (ts.isPropertyAccessExpression(node) && ts.isIdentifier(node.expression) && node.expression.text === 'FileFormat' && node.name.text === 'svg') return 'svg';
  throw new Error('Unsupported static source expression');
}

export function buildVscodeIconsCatalog(source, assetFiles) {
  const file = ts.createSourceFile('supportedFolders.ts', source, ts.ScriptTarget.Latest, true);
  if (file.parseDiagnostics.length) throw new Error('Invalid static source syntax');
  const declarations = file.statements.filter(ts.isVariableStatement).flatMap(statement => [...statement.declarationList.declarations]);
  const declaration = declarations.find(item => ts.isIdentifier(item.name) && item.name.text === 'extensions');
  if (!declaration?.initializer) throw new Error('Missing static folder collection');
  const data = literal(declaration.initializer);
  if (!Array.isArray(data.supported)) throw new Error('Missing supported folder descriptors');
  const assets = new Set(assetFiles);
  const ids = new Set();
  const entries = data.supported.map(item => {
    assertIdentifier(item.icon);
    if (ids.has(item.icon)) throw new Error(`Duplicate folder identifier: ${item.icon}`);
    ids.add(item.icon);
    if (item.format !== 'svg' || !Array.isArray(item.extensions) || item.extensions.some(value => typeof value !== 'string')
      || (item.light !== undefined && typeof item.light !== 'boolean')) throw new Error('Unsupported native folder descriptor');
    for (const suffix of ['', '_opened']) requireAsset(assets, `folder_type_${item.icon}${suffix}.svg`);
    if (item.light) for (const suffix of ['', '_opened']) requireAsset(assets, `folder_type_light_${item.icon}${suffix}.svg`);
    return { id: item.icon, label: label(item.icon), keywords: ordered(item.extensions.map(value => value.toLowerCase())), native: { icon: item.icon, format: 'svg', light: item.light === true } };
  });
  return wrap('vscode-icons', '13.0.0', entries);
}

export function buildMaterialCatalog(manifests, assetFiles) {
  const assets = new Set(assetFiles);
  const entries = new Map();
  for (const manifest of manifests) {
    for (const [name, definition] of Object.entries(manifest.folderNames ?? {})) {
      if (typeof definition !== 'string' || !definition.startsWith('folder-') || definition === 'folder-root') continue;
      const id = definition.slice('folder-'.length);
      assertIdentifier(id);
      const expanded = `${definition}-open`;
      if (manifest.folderNamesExpanded?.[name] !== expanded) throw new Error(`Invalid expanded folder pair: ${name}`);
      if (manifest.iconDefinitions?.[definition]?.iconPath === `./../icons/${definition}.clone.svg`
        && manifest.iconDefinitions?.[expanded]?.iconPath === `./../icons/${expanded}.clone.svg`) continue;
      // Manifest-generated definition paths must correspond to the exact bundled asset pair.
      for (const key of [definition, expanded]) {
        const expected = `./../icons/${key}.svg`;
        if (manifest.iconDefinitions?.[key]?.iconPath !== expected) throw new Error(`Invalid paired asset definition: ${key}`);
        requireAsset(assets, `${key}.svg`);
      }
      const entry = entries.get(id) ?? { id, label: label(id), keywords: [], native: { icon: id } };
      entry.keywords.push(name.toLowerCase());
      entries.set(id, entry);
    }
  }
  return wrap('material', '5.39.0', [...entries.values()].map(entry => ({ ...entry, keywords: ordered(entry.keywords) })));
}
