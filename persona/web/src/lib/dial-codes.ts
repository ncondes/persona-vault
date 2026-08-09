export interface DialOption {
  dial: string;
  // The flag to show, when exactly one country in the catalog uses this dial.
  // `+1` is Canada and the United States, and a phone item stores only the dial
  // — so there is nothing to choose between them, and no flag that is right.
  code: string | null;
}

// The catalog lists countries; this control picks a dial code. They are not the
// same list: two countries can share a dial, and offering both would mean two
// rows that look different and save identically. (It also handed Radix two
// items with the same value, which React reported as a duplicate key.)
//
// Order follows the catalog, and the first country to claim a dial keeps the
// position.
export function dialOptions(countries: Array<{ code: string; dial: string }>): DialOption[] {
  const owners = new Map<string, number>();
  for (const country of countries) {
    owners.set(country.dial, (owners.get(country.dial) ?? 0) + 1);
  }

  const seen = new Set<string>();
  const options: DialOption[] = [];
  for (const country of countries) {
    if (seen.has(country.dial)) continue;
    seen.add(country.dial);
    options.push({
      dial: country.dial,
      code: owners.get(country.dial) === 1 ? country.code : null,
    });
  }
  return options;
}
