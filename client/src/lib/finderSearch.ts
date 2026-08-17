export type FinderSearchScope = "current" | "downloads" | "pictures";

export function virtualPathParent(path: string) {
  const parts = path.split("/").filter(Boolean);
  parts.pop();
  return `/${parts.join("/")}` || "/";
}

export function virtualPathName(path: string) {
  return path.split("/").filter(Boolean).at(-1) ?? path;
}

export function searchVirtualFiles({
  files,
  home,
  currentPath,
  scope,
  query,
}: {
  files: string[];
  home: string;
  currentPath: string;
  scope: FinderSearchScope;
  query: string;
}) {
  const normalizedQuery = query.trim().toLocaleLowerCase();
  if (!normalizedQuery) return [];
  const scopePath = scope === "downloads" ? `${home}/Downloads` : scope === "pictures" ? `${home}/Pictures` : currentPath;
  return files.filter((path) => virtualPathParent(path) === scopePath && virtualPathName(path).toLocaleLowerCase().includes(normalizedQuery));
}
