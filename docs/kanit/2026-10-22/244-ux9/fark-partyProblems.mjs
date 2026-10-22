// Fark testi: eski (2308258) ve yeni tax-id.mjs partyProblems aynı girdilerde aynı çıktıyı verir mi (bütün birleşimler).
const [, , oldPath, newPath] = process.argv;
const oldM = await import(oldPath); const newM = await import(newPath);
const vals = { name: ["", "Ad"], taxNo: ["", "1234567890", "1111111111", "10000000146", "11111111111", "12345", "9876543210"], partyKind: ["", "company", "person"], city: ["", "Ankara"], taxOffice: ["", "Çankaya"], address: ["", "Cd. 1"], mersisNo: ["", "12", "0123456789012345"] };
const keys = Object.keys(vals); let n = 0, diff = 0;
const rec = (i, party) => {
  if (i === keys.length) {
    for (const profile of ["KAGIT", "EARSIV", "EFATURA"]) for (const role of ["buyer", "seller"]) for (const payable of [0, 30000, 30000.01, 50000]) {
      n++; const a = JSON.stringify(oldM.partyProblems(party, { profile, role, payable })); const b = JSON.stringify(newM.partyProblems(party, { profile, role, payable }));
      if (a !== b) { diff++; if (diff < 5) console.log("FARK", JSON.stringify(party), profile, role, payable, a, b); }
    }
    return;
  }
  for (const v of vals[keys[i]]) rec(i + 1, { ...party, [keys[i]]: v });
};
rec(0, {});
console.log(`birleşim ${n}, fark ${diff}`); process.exitCode = diff ? 1 : 0;
