(() => {
  // React tarafından yönetilen DOM düğümlerine müdahale etmiyoruz.
  // İstatistik kartları ve üst profil CSS ile gizlenir; böylece React yeniden
  // çizim yaptığında insertBefore/removeChild çakışması oluşmaz.
})();
