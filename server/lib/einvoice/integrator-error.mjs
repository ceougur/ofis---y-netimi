// Entegratör hatası: kullanıcıya gösterilecek Türkçe ileti + makine kodu + entegratörün kendi hata kodu/metni (detail).
export class IntegratorError extends Error {
  constructor(message, { code = "integrator-error", detail = "", status = 502, integratorCode = "" } = {}) {
    super(message);
    this.code = code;
    this.detail = detail;
    this.status = status;
    this.integratorCode = integratorCode;
  }
}
