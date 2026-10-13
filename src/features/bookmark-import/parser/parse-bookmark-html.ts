import type { ParsedBookmark } from '../types';

export const MAX_FILE_BYTES = 1024 * 1024;
export const MAX_BOOKMARKS = 500;
export const MAX_NODES = 20_000;
export const MAX_FOLDER_DEPTH = 32;

export class BookmarkFileError extends Error {
  constructor(
    public readonly kind:
      | 'empty_file'
      | 'read_error'
      | 'unsupported_file'
      | 'unsupported_encoding'
      | 'invalid_structure'
      | 'limit_exceeded',
  ) {
    super(kind);
  }
}

export function bookmarkFileMessage(error: unknown): string {
  if (!(error instanceof BookmarkFileError)) return '파일을 분석하지 못했어요.';
  return {
    empty_file: '빈 파일이에요. 브라우저에서 내보낸 HTML 파일을 선택하세요.',
    read_error: '파일을 읽지 못했어요. 파일을 다시 선택하세요.',
    unsupported_file: 'HTML(.html 또는 .htm) 파일만 지원해요.',
    unsupported_encoding: 'UTF-8 형식의 북마크 파일만 지원해요.',
    invalid_structure: 'Netscape 북마크 내보내기 형식을 확인할 수 없어요.',
    limit_exceeded:
      '분석 제한을 초과했어요. 파일 1 MiB, 북마크 500개, 노드 20,000개, 폴더 깊이 32까지 지원해요.',
  }[error.kind];
}

export async function readBookmarkFile(file: File): Promise<string> {
  if (!/\.html?$/i.test(file.name))
    throw new BookmarkFileError('unsupported_file');
  if (file.size > MAX_FILE_BYTES) throw new BookmarkFileError('limit_exceeded');
  if (!file.size) throw new BookmarkFileError('empty_file');
  let buffer: ArrayBuffer;
  try {
    buffer = await file.arrayBuffer();
  } catch {
    throw new BookmarkFileError('read_error');
  }
  try {
    return new TextDecoder('utf-8', { fatal: true }).decode(buffer);
  } catch {
    throw new BookmarkFileError('unsupported_encoding');
  }
}

interface Folder {
  id: number;
  element: Element;
  path: string[];
  pendingHeading: string | null;
}

// Browser-only, inert parsing. Never attach/clone parsed nodes into a live document.
// No DOMParser, resource URLs, Auth or API dependencies.
export function parseBookmarkHtml(
  html: string,
  generation: number,
): ParsedBookmark[] {
  if (!html.trim()) throw new BookmarkFileError('empty_file');
  const template = document.createElement('template');
  template.innerHTML = html;
  const marker = /<!doctype\s+netscape-bookmark-file-1\b/i.test(html);
  const items: ParsedBookmark[] = [];
  const folders: Folder[] = [];
  const stack: { node: Node; folder: Folder | null; ignored: boolean }[] = [];
  let count = 0;
  const push = (parent: Node, folder: Folder | null, ignored: boolean) => {
    for (let node = parent.lastChild; node; node = node.previousSibling) {
      if (++count > MAX_NODES) throw new BookmarkFileError('limit_exceeded');
      stack.push({ node, folder, ignored });
    }
  };
  push(template.content, null, false);
  let sawHeading = false;
  let root: Element | null = null;
  while (stack.length) {
    const entry = stack.pop();
    if (!entry) break;
    const { node, ignored } = entry;
    let { folder } = entry;
    if (node instanceof Element) {
      if (node instanceof HTMLTemplateElement) {
        // Nested template contents also count against the traversal limit.
        push(node.content, folder, true);
      }
      if (!ignored) {
        if (node.tagName === 'META') {
          const charset =
            node.getAttribute('charset') ??
            /charset\s*=\s*["']?([^\s;"']+)/i.exec(
              node.getAttribute('content') ?? '',
            )?.[1];
          if (charset && !/^utf-?8$/i.test(charset.trim()))
            throw new BookmarkFileError('unsupported_encoding');
        }
        if (node.tagName === 'H1' && !root) sawHeading = true;
        if (node.tagName === 'DT' && folder && folder.pendingHeading !== null)
          throw new BookmarkFileError('invalid_structure');
        if (node.tagName === 'H3' && folder) {
          if (!withinDt(node, folder.element))
            throw new BookmarkFileError('invalid_structure');
          folder.pendingHeading = node.textContent ?? '';
        }
        if (node.tagName === 'DL') {
          if (!folder) {
            if (root || (!marker && !sawHeading))
              throw new BookmarkFileError('invalid_structure');
            root = node;
            folder = {
              id: folders.length,
              element: node,
              path: [],
              pendingHeading: null,
            };
          } else {
            if (folder.pendingHeading === null)
              throw new BookmarkFileError('invalid_structure');
            const path = [...folder.path, folder.pendingHeading];
            folder.pendingHeading = null;
            if (path.length > MAX_FOLDER_DEPTH)
              throw new BookmarkFileError('limit_exceeded');
            folder = {
              id: folders.length,
              element: node,
              path,
              pendingHeading: null,
            };
          }
          folders.push(folder);
        }
        if (node.tagName === 'A') {
          if (
            !folder ||
            folder.pendingHeading !== null ||
            !withinDt(node, folder.element)
          )
            throw new BookmarkFileError('invalid_structure');
          if (items.length === MAX_BOOKMARKS)
            throw new BookmarkFileError('limit_exceeded');
          const sourceIndex = items.length;
          items.push({
            localId: `${generation}:${sourceIndex}`,
            sourceIndex,
            originalUrl: node.getAttribute('href') ?? '',
            originalTitle: node.textContent ?? '',
            folderPath: [...folder.path],
            folderNodeId: folder.id,
            sourceDates: {
              addDate: node.getAttribute('add_date'),
              lastModified: node.getAttribute('last_modified'),
              lastVisit: node.getAttribute('last_visit'),
            },
          });
          folder.pendingHeading = null;
        }
      }
    }
    push(node, folder, ignored);
  }
  if (!root || folders.some((folder) => folder.pendingHeading !== null))
    throw new BookmarkFileError('invalid_structure');
  return items;
}

function withinDt(node: Element, list: Element): boolean {
  for (
    let parent = node.parentElement;
    parent && parent !== list;
    parent = parent.parentElement
  ) {
    if (parent.tagName === 'DT') return true;
  }
  return false;
}
