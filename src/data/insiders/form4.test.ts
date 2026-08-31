import { test } from "node:test";
import assert from "node:assert/strict";
import { parseForm4Text } from "./form4Parser.js";

// Trimmed but structurally real: traced from a live SEC EDGAR Form 4
// filing (3D SYSTEMS CORP / Jeffrey Graves, accession
// 0001628280-26-058429) fetched during this card's development.
const REAL_SHAPED_SALE_FILING = `
<SEC-DOCUMENT>
<DOCUMENT>
<TYPE>4
<XML>
<?xml version="1.0"?>
<ownershipDocument>
    <periodOfReport>2026-08-20</periodOfReport>
    <issuer>
        <issuerCik>0000910638</issuerCik>
        <issuerName>3D SYSTEMS CORP</issuerName>
        <issuerTradingSymbol>DDD</issuerTradingSymbol>
    </issuer>
    <reportingOwner>
        <reportingOwnerId>
            <rptOwnerCik>0001251036</rptOwnerCik>
            <rptOwnerName>GRAVES JEFFREY A</rptOwnerName>
        </reportingOwnerId>
    </reportingOwner>
    <nonDerivativeTable>
        <nonDerivativeTransaction>
            <securityTitle>
                <value>Common Stock</value>
            </securityTitle>
            <transactionCoding>
                <transactionFormType>4</transactionFormType>
                <transactionCode>S</transactionCode>
            </transactionCoding>
            <transactionAmounts>
                <transactionShares>
                    <value>115500</value>
                </transactionShares>
                <transactionPricePerShare>
                    <value>3.26</value>
                </transactionPricePerShare>
            </transactionAmounts>
        </nonDerivativeTransaction>
    </nonDerivativeTable>
    <derivativeTable></derivativeTable>
</ownershipDocument>
</XML>
</DOCUMENT>
</SEC-DOCUMENT>
`;

test("parseForm4Text: parses a real-shaped single-owner sale filing", () => {
  const result = parseForm4Text(REAL_SHAPED_SALE_FILING, "edgar/data/910638/x.txt", "DDD", "910638", "2026-08-21", "2026-08-24T00:00:00Z");
  assert.ok(result !== null);
  assert.equal(result!.periodOfReport, "2026-08-20");
  assert.equal(result!.reportingOwners.length, 1);
  assert.equal(result!.reportingOwners[0].cik, "1251036"); // leading zeros stripped
  assert.equal(result!.reportingOwners[0].name, "GRAVES JEFFREY A");
  assert.equal(result!.transactions.length, 1);
  assert.equal(result!.transactions[0].transactionCode, "S");
  assert.equal(result!.transactions[0].shares, 115500);
  assert.equal(result!.transactions[0].pricePerShare, 3.26);
});

test("parseForm4Text: parses a multi-owner, multi-transaction purchase filing", () => {
  const xml = `
<XML>
<ownershipDocument>
    <periodOfReport>2026-08-15</periodOfReport>
    <reportingOwner>
        <reportingOwnerId><rptOwnerCik>0000001111</rptOwnerCik><rptOwnerName>SMITH JANE</rptOwnerName></reportingOwnerId>
    </reportingOwner>
    <reportingOwner>
        <reportingOwnerId><rptOwnerCik>0000002222</rptOwnerCik><rptOwnerName>SMITH JANE TRUST</rptOwnerName></reportingOwnerId>
    </reportingOwner>
    <nonDerivativeTable>
        <nonDerivativeTransaction>
            <transactionCoding><transactionCode>P</transactionCode></transactionCoding>
            <transactionAmounts>
                <transactionShares><value>1000</value></transactionShares>
                <transactionPricePerShare><value>12.5</value></transactionPricePerShare>
            </transactionAmounts>
        </nonDerivativeTransaction>
        <nonDerivativeTransaction>
            <transactionCoding><transactionCode>A</transactionCode></transactionCoding>
            <transactionAmounts>
                <transactionShares><value>500</value></transactionShares>
            </transactionAmounts>
        </nonDerivativeTransaction>
    </nonDerivativeTable>
</ownershipDocument>
</XML>`;
  const result = parseForm4Text(xml, "edgar/data/9999/y.txt", "TEST", "9999", "2026-08-16", "2026-08-24T00:00:00Z");
  assert.equal(result!.reportingOwners.length, 2);
  assert.equal(result!.transactions.length, 2);
  const purchase = result!.transactions.find((t) => t.transactionCode === "P")!;
  assert.equal(purchase.shares, 1000);
  assert.equal(purchase.pricePerShare, 12.5);
  const grant = result!.transactions.find((t) => t.transactionCode === "A")!;
  assert.equal(grant.pricePerShare, null); // no price on this synthetic grant, must not be fabricated
});

test("parseForm4Text: returns null when there's no embedded XML document at all", () => {
  const result = parseForm4Text("not a real filing, no XML here", "edgar/data/1/z.txt", "X", "1", "2026-08-16", "now");
  assert.equal(result, null);
});

// TASK_CARD_09 Part A: reportingOwnerRelationship parsing, traced from real
// live SEC EDGAR filings fetched during this card's development (not from
// memory - see ai/decisions.md). Boolean sub-tags are inconsistently
// "1"/"0" (older filings) or "true"/"false" (current filings) across real
// filings; both must parse correctly.
test("parseForm4Text: reportingOwnerRelationship with true/false booleans and a free-text officerTitle (real AEIS filing shape)", () => {
  const xml = `
<XML><ownershipDocument>
    <reportingOwner>
        <reportingOwnerId><rptOwnerCik>0001923149</rptOwnerCik><rptOwnerName>Vonne Elizabeth Karpinski</rptOwnerName></reportingOwnerId>
        <reportingOwnerRelationship>
            <isDirector>false</isDirector>
            <isOfficer>true</isOfficer>
            <isTenPercentOwner>false</isTenPercentOwner>
            <isOther>false</isOther>
            <officerTitle>EVP, General Counsel</officerTitle>
        </reportingOwnerRelationship>
    </reportingOwner>
    <nonDerivativeTable></nonDerivativeTable>
</ownershipDocument></XML>`;
  const result = parseForm4Text(xml, "edgar/data/927003/x.txt", "AEIS", "927003", "2026-08-19", "now")!;
  const owner = result.reportingOwners[0];
  assert.equal(owner.isDirector, false);
  assert.equal(owner.isOfficer, true);
  assert.equal(owner.isTenPercentOwner, false);
  assert.equal(owner.officerTitle, "EVP, General Counsel");
});

test("parseForm4Text: reportingOwnerRelationship with legacy 1/0 booleans and an '&amp;'-containing title (real filing shape)", () => {
  const xml = `
<XML><ownershipDocument>
    <reportingOwner>
        <reportingOwnerId><rptOwnerCik>0002104052</rptOwnerCik><rptOwnerName>SOME CFO</rptOwnerName></reportingOwnerId>
        <reportingOwnerRelationship>
            <isDirector>0</isDirector>
            <isOfficer>1</isOfficer>
            <isTenPercentOwner>0</isTenPercentOwner>
            <officerTitle>Executive Vice President &amp; CFO</officerTitle>
        </reportingOwnerRelationship>
    </reportingOwner>
    <nonDerivativeTable></nonDerivativeTable>
</ownershipDocument></XML>`;
  const result = parseForm4Text(xml, "edgar/data/2104052/x.txt", "TEST", "2104052", "2026-08-19", "now")!;
  const owner = result.reportingOwners[0];
  assert.equal(owner.isOfficer, true);
  assert.equal(owner.isDirector, false);
  // Not entity-decoded - only ever substring-matched for weight tiering, where this is harmless.
  assert.equal(owner.officerTitle, "Executive Vice President &amp; CFO");
});

test("parseForm4Text: missing reportingOwnerRelationship block entirely -> all relationship fields default false/null, not a crash", () => {
  const xml = `
<XML><ownershipDocument>
    <reportingOwner>
        <reportingOwnerId><rptOwnerCik>0000001111</rptOwnerCik><rptOwnerName>NO RELATIONSHIP BLOCK</rptOwnerName></reportingOwnerId>
    </reportingOwner>
    <nonDerivativeTable></nonDerivativeTable>
</ownershipDocument></XML>`;
  const result = parseForm4Text(xml, "edgar/data/1111/x.txt", "TEST", "1111", "2026-08-19", "now")!;
  const owner = result.reportingOwners[0];
  assert.equal(owner.isDirector, false);
  assert.equal(owner.isOfficer, false);
  assert.equal(owner.isTenPercentOwner, false);
  assert.equal(owner.officerTitle, null);
});

test("parseForm4Text: empty nonDerivativeTable yields zero transactions, not an error", () => {
  const xml = `<XML><ownershipDocument><nonDerivativeTable></nonDerivativeTable></ownershipDocument></XML>`;
  const result = parseForm4Text(xml, "edgar/data/1/z.txt", "X", "1", "2026-08-16", "now");
  assert.equal(result!.transactions.length, 0);
});
