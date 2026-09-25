/**
 * Robust Cross-Browser CSV Downloader Utility
 * Supports Chrome, Edge, Firefox, Safari (macOS & iOS), Android, and iframe environments
 */
export function triggerCsvDownload(filename, csvContent) {
  if (!csvContent) {
    console.warn('Cannot download empty CSV content');
    return false;
  }

  // Ensure UTF-8 BOM is present for Excel compatibility
  const contentWithBom = csvContent.startsWith('\uFEFF') ? csvContent : '\uFEFF' + csvContent;

  try {
    const blob = new Blob([contentWithBom], { type: 'text/csv;charset=utf-8;' });

    // 1. IE / Legacy Edge
    if (typeof window !== 'undefined' && window.navigator && typeof window.navigator.msSaveOrOpenBlob === 'function') {
      window.navigator.msSaveOrOpenBlob(blob, filename);
      return true;
    }

    // 2. Standard Blob Object URL method with dispatchEvent
    if (typeof window !== 'undefined' && window.URL && typeof window.URL.createObjectURL === 'function') {
      const blobUrl = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = blobUrl;
      link.setAttribute('download', filename);
      link.style.display = 'none';

      document.body.appendChild(link);
      
      // Dispatch click event
      try {
        link.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true, view: window }));
      } catch {
        link.click();
      }

      // Cleanup after delay
      setTimeout(() => {
        try {
          if (document.body.contains(link)) {
            document.body.removeChild(link);
          }
          window.URL.revokeObjectURL(blobUrl);
        } catch {}
      }, 7000);

      return true;
    }

    // 3. Fallback via data URI
    const encodedUri = 'data:text/csv;charset=utf-8,' + encodeURIComponent(contentWithBom);
    const link = document.createElement('a');
    link.href = encodedUri;
    link.setAttribute('download', filename);
    link.style.display = 'none';
    document.body.appendChild(link);
    link.click();
    setTimeout(() => {
      if (document.body.contains(link)) {
        document.body.removeChild(link);
      }
    }, 5000);
    return true;

  } catch (err) {
    console.error('Blob export failed, trying data URI fallback:', err);
    try {
      const encodedUri = 'data:text/csv;charset=utf-8,' + encodeURIComponent(contentWithBom);
      const link = document.createElement('a');
      link.href = encodedUri;
      link.setAttribute('download', filename);
      link.style.display = 'none';
      document.body.appendChild(link);
      link.click();
      setTimeout(() => {
        if (document.body.contains(link)) {
          document.body.removeChild(link);
        }
      }, 5000);
      return true;
    } catch (fallbackErr) {
      console.error('All CSV export methods failed:', fallbackErr);
      alert('Unable to download CSV file. Please check browser download permissions.');
      return false;
    }
  }
}
