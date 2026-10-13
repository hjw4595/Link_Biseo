export interface ParsedBookmark {
  localId: string;
  sourceIndex: number;
  originalUrl: string;
  originalTitle: string;
  folderPath: string[];
  // Distinguishes separate DL nodes with identical path labels in one file.
  folderNodeId?: number;
  sourceDates: {
    addDate: string | null;
    lastModified: string | null;
    lastVisit: string | null;
  };
}

export type Eligibility =
  | 'ready'
  | 'invalid'
  | 'comparison_unverified'
  | 'duplicate_in_file'
  | 'duplicate_existing';

export interface ImportItem extends ParsedBookmark {
  comparisonKey: string | null;
  domain: string | null;
  hasHash: boolean;
  importTitle: string | null;
  titleWarning: boolean;
  eligibility: Eligibility;
  duplicateOfLocalId?: string;
  existingLinkId?: string;
}

export type ExistingScan =
  | { status: 'idle' | 'loading' }
  | { status: 'complete'; index: Map<string, string>; count: number }
  | { status: 'incomplete'; reason: string };

export const MAX_SELECTION = 50;
export const PREVIEW_PAGE_SIZE = 25;
