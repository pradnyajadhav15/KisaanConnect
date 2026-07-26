'use client';
import { useState, useRef } from 'react';
import { bulkUploadCrops } from '../../../lib/farmerApi';

const TEMPLATE_CSV = `name,quantity,unit,price_per_unit,description,location,available,image_url
Tomato,100,kg,25,Fresh red tomatoes,Solapur,true,
Onion,150,kg,32,,Solapur,true,
`;

export default function BulkCropUpload({ onComplete }) {
  const [file, setFile] = useState(null);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState('');
  const fileInputRef = useRef(null);

  const downloadTemplate = () => {
    const blob = new Blob([TEMPLATE_CSV], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'kisaanconnect-crop-template.csv';
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleFileChange = (e) => {
    setFile(e.target.files[0] || null);
    setResult(null);
    setError('');
  };

  const handleUpload = async () => {
    if (!file) return;
    setLoading(true);
    setError('');
    setResult(null);
    try {
      const data = await bulkUploadCrops(file);
      setResult(data);
      if (data.succeeded_count > 0 && onComplete) onComplete();
    } catch (err) {
      setError(err.message || 'Upload failed. Please check your file and try again.');
    } finally {
      setLoading(false);
    }
  };

  const reset = () => {
    setFile(null);
    setResult(null);
    setError('');
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  return (
    <div style={{ border: '1px solid #e0e0e0', borderRadius: 8, padding: 20, marginBottom: 24 }}>
      <h3 style={{ marginBottom: 8, fontSize: 18 }}>Bulk upload crops via CSV</h3>
      <p style={{ fontSize: 13, color: '#666', marginBottom: 16 }}>
        Add multiple crops at once instead of one by one. Download the template, fill it in, and upload.
      </p>

      <button
        onClick={downloadTemplate}
        style={{
          padding: '8px 16px', background: '#fff', border: '1px solid #2e7d32',
          color: '#2e7d32', borderRadius: 6, cursor: 'pointer', fontSize: 14, marginBottom: 16,
        }}
      >
        Download CSV template
      </button>

      <div style={{ display: 'flex', gap: 10, alignItems: 'center', marginBottom: 12 }}>
        <input
          ref={fileInputRef}
          type="file"
          accept=".csv"
          onChange={handleFileChange}
          style={{ fontSize: 13 }}
        />
        <button
          onClick={handleUpload}
          disabled={!file || loading}
          style={{
            padding: '8px 20px', background: '#2e7d32', color: '#fff', border: 'none',
            borderRadius: 6, cursor: 'pointer', fontSize: 14, opacity: (!file || loading) ? 0.6 : 1,
          }}
        >
          {loading ? 'Uploading…' : 'Upload'}
        </button>
        {(file || result) && (
          <button
            onClick={reset}
            style={{ padding: '8px 16px', background: 'transparent', border: '1px solid #ccc', borderRadius: 6, cursor: 'pointer', fontSize: 13 }}
          >
            Clear
          </button>
        )}
      </div>

      {error && (
        <p style={{ color: '#c1622d', fontSize: 13, marginBottom: 12 }}>{error}</p>
      )}

      {result && (
        <div style={{ marginTop: 12 }}>
          <div style={{ display: 'flex', gap: 20, marginBottom: 12 }}>
            <span style={{ fontSize: 14 }}>
              Total rows: <strong>{result.total_rows}</strong>
            </span>
            <span style={{ fontSize: 14, color: '#2e7d32' }}>
              Succeeded: <strong>{result.succeeded_count}</strong>
            </span>
            {result.failed_count > 0 && (
              <span style={{ fontSize: 14, color: '#c1622d' }}>
                Failed: <strong>{result.failed_count}</strong>
              </span>
            )}
          </div>

          {result.failed_count > 0 && (
            <div style={{ maxHeight: 200, overflowY: 'auto', border: '1px solid #eee', borderRadius: 6 }}>
              <table style={{ width: '100%', fontSize: 13, borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ background: '#faf6ed', textAlign: 'left' }}>
                    <th style={{ padding: '6px 10px' }}>Row</th>
                    <th style={{ padding: '6px 10px' }}>Name</th>
                    <th style={{ padding: '6px 10px' }}>Error</th>
                  </tr>
                </thead>
                <tbody>
                  {result.failed.map((f) => (
                    <tr key={f.row} style={{ borderTop: '1px solid #eee' }}>
                      <td style={{ padding: '6px 10px' }}>{f.row}</td>
                      <td style={{ padding: '6px 10px' }}>{f.name || '—'}</td>
                      <td style={{ padding: '6px 10px', color: '#c1622d' }}>{f.error}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  );
}