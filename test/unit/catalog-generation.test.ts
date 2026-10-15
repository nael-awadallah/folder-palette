import { describe, expect, it } from 'vitest';
import { buildMaterialCatalog, buildVscodeIconsCatalog } from '../../scripts/catalog/extract.mjs';

const source = `import { FileFormat } from '../models';
export const extensions = { default: { root_folder: { icon: 'root_folder' } }, supported: [
  { icon: 'src', extensions: ['source', 'src'], format: FileFormat.svg, light: true },
  { icon: 'api', extensions: ['apis'], format: FileFormat.svg }
] };`;
const assets = ['folder_type_src.svg', 'folder_type_src_opened.svg', 'folder_type_light_src.svg', 'folder_type_light_src_opened.svg', 'folder_type_api.svg', 'folder_type_api_opened.svg'];

describe('vscode-icons catalog extraction', () => {
  it('extracts only native supported folder descriptors with paired assets and light metadata', () => {
    expect(buildVscodeIconsCatalog(source, assets)).toEqual({
      schemaVersion: 1, providerId: 'vscode-icons', providerVersion: '13.0.0', entries: [
        { id: 'api', label: 'Api', keywords: ['apis'], native: { icon: 'api', format: 'svg', light: false } },
        { id: 'src', label: 'Src', keywords: ['source', 'src'], native: { icon: 'src', format: 'svg', light: true } },
      ],
    });
  });

  it('rejects missing closed/open or light assets instead of presenting broken choices', () => {
    expect(() => buildVscodeIconsCatalog(source, assets.filter(file => file !== 'folder_type_src_opened.svg'))).toThrow(/asset/i);
    expect(() => buildVscodeIconsCatalog(source, assets.filter(file => file !== 'folder_type_light_src.svg'))).toThrow(/asset/i);
  });

  it('never executes expressions in an upstream source file', () => {
    expect(() => buildVscodeIconsCatalog(`export const extensions = { supported: [{icon: runCode(), extensions: [], format: FileFormat.svg}] };`, assets)).toThrow(/static|expression/i);
  });

  it('rejects ambiguous IDs and descriptors that cannot produce a safe native choice', () => {
    const duplicate = `export const extensions = {supported:[{icon:'src',extensions:[],format:FileFormat.svg},{icon:'src',extensions:[],format:FileFormat.svg}]};`;
    expect(() => buildVscodeIconsCatalog(duplicate, assets)).toThrow(/duplicate/i);
    expect(() => buildVscodeIconsCatalog(source.replace("icon: 'src'", "icon: '../src'"), assets)).toThrow(/identifier/i);
  });
});

describe('Material catalog extraction', () => {
  const manifest = {
    folderNames: { src: 'folder-src', source: 'folder-src', ignored: 'file-src' },
    folderNamesExpanded: { src: 'folder-src-open', source: 'folder-src-open' },
    rootFolderNames: { root: 'folder-root' },
    iconDefinitions: {
      'folder-src': { iconPath: './../icons/folder-src.svg' },
      'folder-src-open': { iconPath: './../icons/folder-src-open.svg' },
      'folder-root': { iconPath: './../icons/folder-root.svg' },
      'file-src': { iconPath: './../icons/src.svg' },
    },
  };

  it('uses actual folder associations, strips only the manifest prefix, and excludes file/default definitions', () => {
    expect(buildMaterialCatalog([manifest], ['folder-src.svg', 'folder-src-open.svg'])).toEqual({
      schemaVersion: 1, providerId: 'material', providerVersion: '5.39.0', entries: [
        { id: 'src', label: 'Src', keywords: ['source', 'src'], native: { icon: 'src' } },
      ],
    });
  });

  it('deduplicates across packs deterministically without depending on object insertion order', () => {
    const reversed = { ...manifest, folderNames: { source: 'folder-src', src: 'folder-src' } };
    expect(buildMaterialCatalog([manifest, reversed], ['folder-src.svg', 'folder-src-open.svg']))
      .toEqual(buildMaterialCatalog([reversed, manifest], ['folder-src-open.svg', 'folder-src.svg']));
  });

  it('rejects missing or incorrect expanded definitions and missing assets', () => {
    expect(() => buildMaterialCatalog([manifest], ['folder-src.svg'])).toThrow(/asset/i);
    expect(() => buildMaterialCatalog([{ ...manifest, folderNamesExpanded: { src: 'wrong' } }], ['folder-src.svg', 'folder-src-open.svg'])).toThrow(/expanded|pair/i);
  });

  it('excludes built-in clone definitions instead of guessing their association validity', () => {
    const clone = {
      folderNames: { workflows: 'folder-workflows' }, folderNamesExpanded: { workflows: 'folder-workflows-open' },
      iconDefinitions: { 'folder-workflows': { iconPath: './../icons/folder-workflows.clone.svg' }, 'folder-workflows-open': { iconPath: './../icons/folder-workflows-open.clone.svg' } },
    };
    expect(buildMaterialCatalog([clone], [])).toMatchObject({ entries: [] });
  });
});
