import { Octokit } from '@octokit/rest';
import { FavoriteList, FavoriteListsFile } from '../types';

// ─── Configuration ───

const OWNER = 'cristibp';
const REPO = 'favorites';
const FILE_PATH = 'lists.json';
const BRANCH = 'main';

const octokit = new Octokit({
  auth: process.env.GITHUB_FAVORITES_TOKEN,
});

// ─── In-memory cache ───

interface CacheEntry {
  data: FavoriteListsFile;
  sha: string;
  fetchedAt: number;
}

let cache: CacheEntry | null = null;
const CACHE_TTL_MS = 60_000; // 60 seconds

// ─── Helpers ───

function isCacheValid(): boolean {
  return cache !== null && Date.now() - cache.fetchedAt < CACHE_TTL_MS;
}

function invalidateCache(): void {
  cache = null;
}

function generateListId(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .substring(0, 48) + '-' + Date.now().toString(36);
}

// ─── Core: Read from GitHub ───

async function readListsFile(): Promise<{ data: FavoriteListsFile; sha: string }> {
  if (isCacheValid()) {
    return { data: cache!.data, sha: cache!.sha };
  }

  try {
    const response = await octokit.repos.getContent({
      owner: OWNER,
      repo: REPO,
      path: FILE_PATH,
      ref: BRANCH,
    });

    const file = response.data as { content: string; sha: string; encoding: string };
    const content = Buffer.from(file.content, 'base64').toString('utf-8');
    const data = JSON.parse(content) as FavoriteListsFile;

    cache = { data, sha: file.sha, fetchedAt: Date.now() };
    return { data, sha: file.sha };
  } catch (err: any) {
    if (err.status === 404) {
      // File doesn't exist yet — return empty structure
      const empty: FavoriteListsFile = {
        version: 1,
        defaultListId: '',
        lists: [],
      };
      return { data: empty, sha: '' };
    }
    throw err;
  }
}

// ─── Core: Write to GitHub ───

async function writeListsFile(
  data: FavoriteListsFile,
  currentSha: string,
  commitMessage: string
): Promise<string> {
  const content = Buffer.from(JSON.stringify(data, null, 2) + '\n').toString('base64');

  const params: any = {
    owner: OWNER,
    repo: REPO,
    path: FILE_PATH,
    message: commitMessage,
    content,
    branch: BRANCH,
  };

  // Only include sha if updating an existing file (not creating)
  if (currentSha) {
    params.sha = currentSha;
  }

  try {
    const response = await octokit.repos.createOrUpdateFileContents(params);
    const newSha = (response.data.content as any)?.sha || '';

    // Update cache
    cache = { data, sha: newSha, fetchedAt: Date.now() };

    return newSha;
  } catch (err: any) {
    // On 409 Conflict, retry once with fresh sha
    if (err.status === 409) {
      console.warn('[GitHubFavorites] 409 Conflict — retrying with fresh sha...');
      invalidateCache();
      const fresh = await readListsFile();
      params.sha = fresh.sha;
      const retryResponse = await octokit.repos.createOrUpdateFileContents(params);
      const retrySha = (retryResponse.data.content as any)?.sha || '';
      cache = { data, sha: retrySha, fetchedAt: Date.now() };
      return retrySha;
    }
    throw err;
  }
}

// ─── Public API ───

/**
 * Returns all favorite lists.
 */
export async function getAllLists(): Promise<FavoriteListsFile> {
  const { data } = await readListsFile();
  return data;
}

/**
 * Returns a single list by its ID.
 */
export async function getListById(listId: string): Promise<FavoriteList | null> {
  const { data } = await readListsFile();
  return data.lists.find((l) => l.id === listId) || null;
}

/**
 * Creates a new favorite list.
 */
export async function createList(params: {
  name: string;
  symbols?: string[];
  icon?: string;
  color?: string;
}): Promise<FavoriteList> {
  const { data, sha } = await readListsFile();
  const now = new Date().toISOString();

  const newList: FavoriteList = {
    id: generateListId(params.name),
    name: params.name,
    icon: params.icon,
    color: params.color,
    symbols: params.symbols || [],
    createdAt: now,
    updatedAt: now,
  };

  data.lists.push(newList);

  // If this is the first list, set it as default
  if (data.lists.length === 1) {
    data.defaultListId = newList.id;
  }

  await writeListsFile(data, sha, `Add list: ${params.name}`);
  return newList;
}

/**
 * Updates an existing list's metadata and/or symbols.
 */
export async function updateList(
  listId: string,
  patch: Partial<Pick<FavoriteList, 'name' | 'icon' | 'color' | 'symbols'>>
): Promise<FavoriteList> {
  const { data, sha } = await readListsFile();
  const index = data.lists.findIndex((l) => l.id === listId);

  if (index === -1) {
    throw new Error(`List "${listId}" not found.`);
  }

  const list = data.lists[index];
  if (patch.name !== undefined) list.name = patch.name;
  if (patch.icon !== undefined) list.icon = patch.icon;
  if (patch.color !== undefined) list.color = patch.color;
  if (patch.symbols !== undefined) list.symbols = patch.symbols;
  list.updatedAt = new Date().toISOString();

  data.lists[index] = list;
  await writeListsFile(data, sha, `Update list: ${list.name}`);
  return list;
}

/**
 * Deletes a list by ID. Refuses to delete the default list unless it's the only one.
 */
export async function deleteList(listId: string): Promise<void> {
  const { data, sha } = await readListsFile();
  const index = data.lists.findIndex((l) => l.id === listId);

  if (index === -1) {
    throw new Error(`List "${listId}" not found.`);
  }

  if (data.defaultListId === listId && data.lists.length > 1) {
    throw new Error('Cannot delete the default list. Set another list as default first.');
  }

  data.lists.splice(index, 1);

  // If we deleted the default and it was the last, clear default
  if (data.defaultListId === listId) {
    data.defaultListId = data.lists.length > 0 ? data.lists[0].id : '';
  }

  await writeListsFile(data, sha, `Delete list: ${listId}`);
}

/**
 * Adds symbols to an existing list (deduplicating).
 */
export async function addSymbolsToList(listId: string, symbols: string[]): Promise<FavoriteList> {
  const { data, sha } = await readListsFile();
  const index = data.lists.findIndex((l) => l.id === listId);

  if (index === -1) {
    throw new Error(`List "${listId}" not found.`);
  }

  const list = data.lists[index];
  const existing = new Set(list.symbols);
  for (const sym of symbols) {
    if (!existing.has(sym)) {
      list.symbols.push(sym);
      existing.add(sym);
    }
  }
  list.updatedAt = new Date().toISOString();

  data.lists[index] = list;
  await writeListsFile(data, sha, `Add symbols to ${list.name}: ${symbols.join(', ')}`);
  return list;
}

/**
 * Removes symbols from an existing list.
 */
export async function removeSymbolsFromList(listId: string, symbols: string[]): Promise<FavoriteList> {
  const { data, sha } = await readListsFile();
  const index = data.lists.findIndex((l) => l.id === listId);

  if (index === -1) {
    throw new Error(`List "${listId}" not found.`);
  }

  const list = data.lists[index];
  const toRemove = new Set(symbols);
  list.symbols = list.symbols.filter((s) => !toRemove.has(s));
  list.updatedAt = new Date().toISOString();

  data.lists[index] = list;
  await writeListsFile(data, sha, `Remove symbols from ${list.name}: ${symbols.join(', ')}`);
  return list;
}

/**
 * Sets the default list ID.
 */
export async function setDefaultList(listId: string): Promise<FavoriteListsFile> {
  const { data, sha } = await readListsFile();
  const exists = data.lists.some((l) => l.id === listId);

  if (!exists) {
    throw new Error(`List "${listId}" not found.`);
  }

  data.defaultListId = listId;
  await writeListsFile(data, sha, `Set default list: ${listId}`);
  return data;
}
