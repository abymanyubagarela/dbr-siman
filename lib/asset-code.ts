/** Keep register codes as text so leading zeroes are never lost. */
export function normalizeAssetRegister(value: string): string {
  let code = value.trim().replace(/[\u200B-\u200D\uFEFF]/g, "");
  try {
    const url = new URL(code);
    if (url.protocol === "https:" || url.protocol === "http:") {
      const parameter = url.searchParams.get("kode_register");
      const segment = decodeURIComponent(url.pathname.split("/").filter(Boolean).pop() ?? "");
      if (parameter) code = parameter.trim();
      else if (/^[a-f\d]{32}$/i.test(segment) || /^[a-f\d]{8}(?:-[a-f\d]{4}){3}-[a-f\d]{12}$/i.test(segment)) code = segment;
    }
  } catch { /* A plain register code is not a URL. */ }
  // Some labels include the item name, register, brand, item code and NUP.
  // Only extract a register when the payload identifies exactly one code.
  const registers = [...code.matchAll(/(?:^|[^a-z\d])([a-f\d]{32}|[a-f\d]{8}(?:-[a-f\d]{4}){3}-[a-f\d]{12})(?=$|[^a-z\d])/gi)]
    .map((match) => match[1].replace(/-/g, "").toUpperCase());
  const unique = [...new Set(registers)];
  if (unique.length === 1) return unique[0];
  const compact = code.replace(/\s/g, "");
  if (/^[a-f\d]{32}$/i.test(compact) || /^[a-f\d]{8}(?:-[a-f\d]{4}){3}-[a-f\d]{12}$/i.test(compact)) {
    return compact.replace(/-/g, "").toUpperCase();
  }
  return code;
}
