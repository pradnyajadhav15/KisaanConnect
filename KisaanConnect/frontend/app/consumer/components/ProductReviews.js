'use client';
import { useState, useEffect } from 'react';
import { getCropReviews, canReview, submitReview } from '../../../lib/reviewsApi';

const Star = ({ filled, onClick, size }) => (
  <span
    onClick={onClick}
    style={{
      cursor: onClick ? 'pointer' : 'default',
      color: filled ? '#E8A33D' : '#ddd',
      fontSize: size || 20,
    }}
  >
    {'\u2605'}
  </span>
);

const StarRow = ({ rating, onSelect, size }) => (
  <span>
    {[1, 2, 3, 4, 5].map((n) => (
      <Star key={n} filled={n <= rating} onClick={onSelect ? () => onSelect(n) : undefined} size={size} />
    ))}
  </span>
);

export default function ProductReviews({ cropId }) {
  const [data, setData] = useState(null);
  const [eligibility, setEligibility] = useState(null);
  const [myRating, setMyRating] = useState(0);
  const [myComment, setMyComment] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

  const load = () => {
    setLoading(true);
    Promise.all([getCropReviews(cropId), canReview(cropId).catch(() => null)])
      .then(([reviewData, eligData]) => {
        setData(reviewData);
        setEligibility(eligData);
      })
      .catch(() => setError('Could not load reviews.'))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cropId]);

  const handleSubmit = async () => {
    if (myRating === 0) return setError('Please select a star rating.');
    setSubmitting(true);
    setError('');
    try {
      await submitReview(cropId, myRating, myComment);
      setMyRating(0);
      setMyComment('');
      load();
    } catch (err) {
      setError(err.message || 'Could not submit review.');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) return <p style={{ padding: '16px 0', color: '#666' }}>Loading reviews...</p>;
  if (!data) return null;

  return (
    <div style={{ marginTop: 32, paddingTop: 24, borderTop: '1px solid #eee' }}>
      <h3 style={{ marginBottom: 8, fontSize: 18 }}>Reviews</h3>

      {data.review_count > 0 ? (
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 20 }}>
          <StarRow rating={Math.round(data.average_rating)} size={18} />
          <span style={{ fontWeight: 600 }}>{data.average_rating}</span>
          <span style={{ color: '#666', fontSize: 13 }}>
            ({data.review_count} review{data.review_count !== 1 ? 's' : ''})
          </span>
        </div>
      ) : (
        <p style={{ color: '#666', fontSize: 14, marginBottom: 20 }}>No reviews yet.</p>
      )}

      {eligibility && eligibility.can_review && (
        <div style={{ background: '#EEF2E7', borderRadius: 8, padding: 16, marginBottom: 20 }}>
          <p style={{ fontSize: 14, fontWeight: 500, marginBottom: 8 }}>Leave a review</p>
          <StarRow rating={myRating} onSelect={setMyRating} size={26} />
          <textarea
            value={myComment}
            onChange={(e) => setMyComment(e.target.value)}
            placeholder="Share your experience (optional)"
            rows={3}
            style={{ width: '100%', marginTop: 10, padding: 8, borderRadius: 6, border: '1px solid #ccc', fontSize: 14 }}
          />
          {error && <p style={{ color: '#c1622d', fontSize: 13, marginTop: 6 }}>{error}</p>}
          <button
            onClick={handleSubmit}
            disabled={submitting}
            style={{
              marginTop: 10, background: '#2e7d32', color: '#fff', border: 'none',
              padding: '8px 20px', borderRadius: 6, cursor: 'pointer', fontSize: 14,
              opacity: submitting ? 0.6 : 1,
            }}
          >
            {submitting ? 'Submitting...' : 'Submit Review'}
          </button>
        </div>
      )}

      {eligibility && eligibility.already_reviewed && (
        <p style={{ fontSize: 13, color: '#2e7d32', marginBottom: 16 }}>You&apos;ve already reviewed this product.</p>
      )}

      {data.reviews.map((r) => (
        <div key={r.id} style={{ borderBottom: '1px solid #f0f0f0', padding: '12px 0' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
            <StarRow rating={r.rating} size={14} />
            <span style={{ fontSize: 13, fontWeight: 500 }}>{r.consumer_name}</span>
          </div>
          {r.comment && <p style={{ fontSize: 14, color: '#444', margin: 0 }}>{r.comment}</p>}
        </div>
      ))}
    </div>
  );
}