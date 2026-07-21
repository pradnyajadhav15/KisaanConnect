'use client';
import { useState, useCallback, useEffect, useRef } from 'react';
import './CropHealthAnalysis.css';

const MAX_SIZE = 5 * 1024 * 1024;
const API_BASE = process.env.NEXT_PUBLIC_API_URL
  ? process.env.NEXT_PUBLIC_API_URL + '/ai'
  : 'http://localhost:8000/ai';

const PROBLEM_ICONS = { disease: 'DISEASE', pest: 'PEST', nutrient: 'NUTRIENT', water: 'WATER' };

const getToken = () => {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem('auth_token');
};

const parseGeminiResponse = (text) => {
  const lower = text.toLowerCase();
  const isHealthy = lower.includes('healthy') && !lower.includes('unhealthy');

  const cropMatch = text.match(/crop(?:\s+type)?[:\s]+([A-Za-z]+)/i);
  const cropType = cropMatch ? cropMatch[1] : 'Crop';

  if (isHealthy) return { status: 'healthy', cropType };

  const problems = [];
  const sections = text.split(/\n{2,}|\*\*[^*]+\*\*/);
  sections.forEach((section) => {
    const s = section.toLowerCase();
    if (s.includes('fungal') || s.includes('disease')) {
      problems.push({ type: 'disease', name: 'Disease Detected',
        description: section.trim(), solution: 'Consult a local agricultural expert for treatment.' });
    } else if (s.includes('pest') || s.includes('insect')) {
      problems.push({ type: 'pest', name: 'Pest Infestation',
        description: section.trim(), solution: 'Apply appropriate pesticide or neem oil.' });
    } else if (s.includes('nutrient') || s.includes('deficiency')) {
      problems.push({ type: 'nutrient', name: 'Nutrient Deficiency',
        description: section.trim(), solution: 'Conduct soil test and apply appropriate fertilizer.' });
    } else if (s.includes('water') || s.includes('wilt')) {
      problems.push({ type: 'water', name: 'Water Stress',
        description: section.trim(), solution: 'Adjust irrigation schedule accordingly.' });
    }
  });

  return {
    status: 'unhealthy',
    cropType,
    problems: problems.length > 0 ? problems : [{
      type: 'disease', name: 'Issue Detected',
      description: text.slice(0, 300),
      solution: 'Please consult a local agricultural expert.'
    }]
  };
};

export default function CropHealthAnalysis() {
  const [selectedFile, setSelectedFile] = useState(null);
  const [previewUrl, setPreviewUrl] = useState('');
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analysisResult, setAnalysisResult] = useState(null);
  const [error, setError] = useState('');
  const objectUrlRef = useRef(null);

  useEffect(() => () => {
    if (objectUrlRef.current) URL.revokeObjectURL(objectUrlRef.current);
  }, []);

  const handleFileChange = useCallback((e) => {
    const file = e.target.files[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      setError('Please upload an image file (JPEG, PNG, etc.)');
      return;
    }
    if (file.size > MAX_SIZE) {
      setError('Image must be smaller than 5MB');
      return;
    }

    if (objectUrlRef.current) URL.revokeObjectURL(objectUrlRef.current);
    const url = URL.createObjectURL(file);
    objectUrlRef.current = url;

    setSelectedFile(file);
    setPreviewUrl(url);
    setAnalysisResult(null);
    setError('');
  }, []);

  const handleAnalyze = useCallback(async () => {
    if (!selectedFile) return setError('Please select an image to analyze');

    setIsAnalyzing(true);
    setError('');

    try {
      const form = new FormData();
      form.append('file', selectedFile);

      const token = getToken();
      const response = await fetch(API_BASE + '/crop-health', {
        method: 'POST',
        headers: token ? { Authorization: 'Bearer ' + token } : {},
        body: form,
      });

      if (!response.ok) {
        const msg = await response.text();
        throw new Error(msg || ('Analysis failed (' + response.status + ')'));
      }

      const data = await response.json();
      const text = (data && data.text) || '';
      if (!text) throw new Error('No response from AI');

      setAnalysisResult(parseGeminiResponse(text));
    } catch (err) {
      setError((err && err.message) || 'Analysis failed. Please try again.');
    } finally {
      setIsAnalyzing(false);
    }
  }, [selectedFile]);

  const handleReset = useCallback(() => {
    if (objectUrlRef.current) {
      URL.revokeObjectURL(objectUrlRef.current);
      objectUrlRef.current = null;
    }
    setSelectedFile(null);
    setPreviewUrl('');
    setAnalysisResult(null);
    setError('');
  }, []);

  return (
    <div className="crop-health-analysis">
      <h2>AI Crop Health Analysis</h2>

      <div className="analysis-container">
        <div className="upload-section">
          <div className="file-input-container">
            <input type="file" id="crop-image" accept="image/*"
              onChange={handleFileChange} className="file-input" />
            <label htmlFor="crop-image" className="file-input-label">
              {selectedFile ? 'Change Image' : 'Upload Crop Image'}
            </label>
            {!selectedFile && (
              <p className="upload-instruction">Upload a clear image of your crop for AI analysis</p>
            )}
            {error && <p className="error-message" role="alert">{error}</p>}
          </div>

          {previewUrl && (
            <div className="image-preview">
              <img src={previewUrl} alt="Crop Preview" />
              <div className="preview-actions">
                <button className="analyze-button" onClick={handleAnalyze} disabled={isAnalyzing}>
                  {isAnalyzing ? 'Analyzing...' : 'Analyze Crop Health'}
                </button>
                <button className="reset-button" onClick={handleReset}>Reset</button>
              </div>
            </div>
          )}
        </div>

        {isAnalyzing && (
          <div className="loading-container" role="status">
            <div className="loading-spinner" />
            <p>Analyzing your crop image with AI...</p>
          </div>
        )}

        {analysisResult && (
          <div className={'analysis-result ' + analysisResult.status}>
            <h3>{'Analysis Results for ' + analysisResult.cropType}</h3>

            {analysisResult.status === 'healthy' ? (
              <div className="healthy-result">
                <div className="result-header">
                  <span className="status-icon">OK</span>
                  <h4>Your crop is healthy!</h4>
                </div>
                <p>{'Our AI analysis indicates your ' + analysisResult.cropType + ' crop is in good health.'}</p>
                <div className="healthy-characteristics">
                  <h5>Healthy Characteristics Detected:</h5>
                  <ul>
                    <li>Proper leaf color and development</li>
                    <li>No signs of disease or pest damage</li>
                    <li>Good growth pattern and structure</li>
                    <li>Appropriate stem thickness and strength</li>
                    <li>Normal fruit/flower development (if applicable)</li>
                  </ul>
                </div>
                <p className="recommendation">Continue your current farming practices to maintain crop health.</p>
              </div>
            ) : (
              <div className="unhealthy-result">
                <div className="result-header">
                  <span className="status-icon">!</span>
                  <h4>Issues detected in your crop</h4>
                </div>
                <p>{'AI detected the following problems with your ' + analysisResult.cropType + ' crop:'}</p>
                <div className="problems-list">
                  {analysisResult.problems.map((problem, i) => (
                    <div key={i} className="problem-item">
                      <div className="problem-header">
                        <span className="problem-icon">{PROBLEM_ICONS[problem.type] || 'ISSUE'}</span>
                        <h5>{problem.name}</h5>
                      </div>
                      <p className="problem-description">{problem.description}</p>
                      <div className="solution">
                        <h6>Recommended Solution</h6>
                        <p>{problem.solution}</p>
                      </div>
                    </div>
                  ))}
                </div>
                <p className="seek-advice">
                  For serious issues, please consult a local agricultural expert or extension officer.
                </p>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
