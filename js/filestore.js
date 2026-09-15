const FILE_PREFIX = 'mtvriede_file_';

function saveFile(id, base64) {
  const key = FILE_PREFIX + id;
  try {
    localStorage.setItem(key, base64);
    return true;
  } catch (e) {
    alert('Speicher voll! Die Datei konnte nicht gespeichert werden. Lösche nicht benötigte Dokumente, um Platz zu schaffen.');
    return false;
  }
}

function loadFile(id) {
  return localStorage.getItem(FILE_PREFIX + id) || null;
}

function deleteFile(id) {
  localStorage.removeItem(FILE_PREFIX + id);
}

function fileId() {
  return 'f_' + Date.now() + '_' + Math.random().toString(36).substring(2, 8);
}

function openPdfBase64(base64) {
  const byteChars = atob(base64);
  const bytes = new Uint8Array(byteChars.length);
  for (let i = 0; i < byteChars.length; i++) bytes[i] = byteChars.charCodeAt(i);
  const blob = new Blob([bytes], { type: 'application/pdf' });
  window.open(URL.createObjectURL(blob), '_blank');
}
