import type { Norm } from "@norms/core";

export interface FocusGroup {
  focus: string;
  norms: Norm[];
}

export function groupNorms(norms: Norm[], filter = ""): FocusGroup[] {
  const query = filter.trim().toLowerCase();
  const visible = query
    ? norms.filter((norm) => [
      norm.id,
      norm.source,
      norm.body,
      ...norm.appliesTo,
      ...norm.conflictsWith,
    ].some((value) => value.toLowerCase().includes(query)))
    : norms;
  const groups = new Map<string, Norm[]>();
  for (const norm of visible) {
    const focus = norm.id.split(".")[0];
    groups.set(focus, [...(groups.get(focus) ?? []), norm]);
  }
  return [...groups.entries()]
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([focus, group]) => ({ focus, norms: group.sort((left, right) => left.id.localeCompare(right.id)) }));
}

export function repositoryAccessibility(label: string, description: string): string {
  return `${label}, ${description}`;
}

export function focusAccessibility(focus: string, count: number): string {
  return `${focus}, ${count} norms`;
}

export function normAccessibility(norm: Norm, imported: boolean): string {
  return `${norm.id}, source ${norm.source}${imported ? ", read-only" : ""}`;
}
