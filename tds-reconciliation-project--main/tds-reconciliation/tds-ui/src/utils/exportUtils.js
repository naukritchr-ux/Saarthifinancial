/**
 * Robust Cross-Browser CSV Downloader Utility
 * Supports Chrome, Edge, Firefox, Safari (macOS & iOS), Android, and iframe environments
 */
export function triggerCsvDownload(filename, csvContent) {
  if (!csvContent) {
    console.error('Cannot download empty CSV content');
    return false;
  }

  // Ensure UTF-8 BOM is present for Excel compatibility
  const contentWithBom = csvContent.startsWith('\uFEFF') ? csvContent : '\uFEFF' + csvContent;

  try {
    const blob = new Blob([contentWithBom], { type: 'text/csv;charset=utf-8;' });

    // 1. IE / Edge legacy support
    if (window.navigator && typeof window.navigator.msSaveOrOpenBlob === 'function') {
      window.navigator.msSaveOrOpenBlob(blob, filename);
      return true;
    }

    // 2. Standard Blob Object URL method
    if (window.URL && typeof window.URL.createObjectURL === 'function') {
      const blobUrl = window.URL.createObjectURL(blob);
      const tempLink = document.createElement('a');
      tempLink.style.position = 'fixed';
      tempLink.style.left = '-9999px';
      tempLink.style.top = '-9999px';
      tempLink.style.opacity = '0';
      tempLink.href = blobUrl;
      tempLink.setAttribute('download', filename);
      
      // Target _self prevents opening blank popups
      tempLink.target = '_self';

      document.body.appendChild(tempLink);
      
      // Simulate click
      tempLink.click();

      // Delay cleanup by 10 seconds to ensure the browser stream has finished
      setTimeout(() => {
        try {
          if (document.body.contains(tempLink)) {
            document.body.removeChild(tempLink);
          }
          window.URL.revokeObjectURL(blobUrl);
        } catch (cleanupErr) {
          console.warn('Export cleanup notice:', cleanupErr);
        }
      }, 10000);

      return true;
    }

    // 3. Fallback via data URI
    const encodedUri = 'data:text/csv;charset=utf-8,' + encodeURIComponent(contentWithBom);
    const fallbackLink = document.createElement('a');
    fallbackLink.style.position = 'fixed';
    fallbackLink.style.left = '-9999px';
    fallbackLink.href = encodedUri;
    fallbackLink.setAttribute('download', filename);
    document.body.appendChild(fallbackLink);
    fallbackLink.click();
    setTimeout(() => {
      if (document.body.contains(fallbackLink)) {
        document.body.removeChild(fallbackLink);
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
