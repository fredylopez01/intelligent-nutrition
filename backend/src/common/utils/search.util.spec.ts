import { describe, expect, it } from "@jest/globals";
import { normalizeSearchTerm } from "./search.util.js";

describe("search utils", () => {
  it("removes diacritics so an unaccented term matches an accented one", () => {
    expect(normalizeSearchTerm("proteína")).toBe("proteina");
    expect(normalizeSearchTerm("Colágeno")).toBe("colageno");
    expect(normalizeSearchTerm("Añil")).toBe("anil");
  });

  it("lowercases and trims the term", () => {
    expect(normalizeSearchTerm("  PROTEINA  ")).toBe("proteina");
    expect(normalizeSearchTerm("Whey")).toBe("whey");
  });

  it("keeps digits and symbols untouched", () => {
    expect(normalizeSearchTerm("PROT-001 2 lb")).toBe("prot-001 2 lb");
  });
});
