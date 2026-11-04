// feDropShadow as the primitives it stands for.

/** Replace every `<feDropShadow>` in filter markup with blur, offset, flood, composite and merge (its `in` honoured). */
export function expandDropShadows(markup: string): string;
