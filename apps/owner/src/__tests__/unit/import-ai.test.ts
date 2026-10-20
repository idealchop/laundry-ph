import { describe, expect, it } from "vitest";
import { strToU8, zipSync } from "fflate";
import { cleanCustomer, cleanWalkIn, normPhone } from "@/lib/import/types";
import { matchService } from "@/lib/server/import-save";
import { toParts, xlsxToCsv } from "@/lib/server/import-ai";

describe("AI import cleaning", () => {
  it("normalises PH mobiles", () => {
    expect(normPhone("+63 917 123 4567")).toBe("09171234567");
    expect(normPhone("917-123-4567")).toBe("09171234567");
    expect(normPhone("n/a")).toBe("");
  });
  it("drops nameless customers and keeps known unsure fields", () => {
    expect(cleanCustomer({ name: " " }, "c0")).toBeNull();
    expect(cleanCustomer({ name: "Aling Nena", phone: "09171234567", unsure: ["phone", "bogus"] }, "c1")).toMatchObject({ name: "Aling Nena", unsure: ["phone"] });
  });
  it("flags a bad date and parses peso amounts", () => {
    const w = cleanWalkIn({ date: "10/05", customer: "Ben", service: "WDF", quantity: "6.5", unit: "kg", amount: "₱195", paid: false, unsure: [] }, "w0")!;
    expect(w).toMatchObject({ date: "", quantity: 6.5, amount: 195, paid: false, unit: "kg" });
    expect(w.unsure).toContain("date");
  });
});

describe("service matching", () => {
  const services = [{ id: "wdf", name: "Wash-Dry-Fold", unit: "kg" }, { id: "comforter", name: "Comforter", unit: "pc" }];
  it("matches by words, falls back to import", () => {
    expect(matchService(services, "wash dry fold", "kg").id).toBe("wdf");
    expect(matchService(services, "Comforter king", "pc").id).toBe("comforter");
    expect(matchService(services, "Shoe cleaning", "pc")).toEqual({ id: "import", name: "Shoe cleaning" });
  });
});

describe("file parts", () => {
  it("reads xlsx shared strings into CSV", () => {
    const zip = zipSync({
      "xl/sharedStrings.xml": strToU8('<sst><si><t>Name</t></si><si><t>Maria, S.</t></si></sst>'),
      "xl/worksheets/sheet1.xml": strToU8('<worksheet><sheetData><row r="1"><c r="A1" t="s"><v>0</v></c><c r="B1"><v>12</v></c></row><row r="2"><c r="A2" t="s"><v>1</v></c><c r="B2"><v>350</v></c></row></sheetData></worksheet>'),
    });
    expect(xlsxToCsv(zip)).toContain('"Maria, S.",350');
  });
  it("sends images inline and rejects unknown types", () => {
    expect(toParts([{ name: "a.jpg", type: "image/jpeg", bytes: new Uint8Array([1, 2]) }])[0]).toHaveProperty("inlineData.mimeType", "image/jpeg");
    expect(() => toParts([{ name: "a.exe", type: "application/x-msdownload", bytes: new Uint8Array([1]) }])).toThrow();
  });
});
