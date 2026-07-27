'use client';
import { useState, useEffect } from 'react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from 'recharts';
import { getSalesSummary } from '../../../lib/farmerApi';

const formatWeekLabel = (isoDate) => {
  const d = new Date(isoDate);
  return d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
};

export default function SalesDashboard() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    getSalesSummary()
      .then((res) => setData(res))
      .catch(() => setError('Could not load sales data. Please try again.'))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <p style={{ padding: 20 }}>Loading sales data…</p>;
  if (error) return <p style={{ padding: 20, color: '#c1622d' }}>{error}</p>;
  if (!data) return null;

  const chartData = data.weekly_revenue.map((w) => ({
    week: formatWeekLabel(w.week_start),
    revenue: w.revenue,
  }));

  return (
    <div style={{ padding: '0 4px' }}>
      <div style={{ display: 'flex', gap: 20, marginBottom: 24, flexWrap: 'wrap' }}>
        <div style={{ background: '#EEF2E7', borderRadius: 8, padding: '16px 24px', minWidth: 160 }}>
          <div style={{ fontSize: 12, color: '#666' }}>Total Revenue</div>
          <div style={{ fontSize: 24, fontWeight: 700, color: '#2e7d32' }}>
            {'Rs. ' + data.total_revenue.toLocaleString('en-IN')}
          </div>
        </div>
        <div style={{ background: '#EEF2E7', borderRadius: 8, padding: '16px 24px', minWidth: 160 }}>
          <div style={{ fontSize: 12, color: '#666' }}>Total Orders</div>
          <div style={{ fontSize: 24, fontWeight: 700, color: '#2e7d32' }}>
            {data.total_orders}
          </div>
        </div>
      </div>

      <h3 style={{ marginBottom: 12, fontSize: 16 }}>Revenue — last 8 weeks</h3>
      {chartData.length === 0 ? (
        <p style={{ color: '#666', fontSize: 14 }}>No orders yet in the last 8 weeks.</p>
      ) : (
        <div style={{ width: '100%', height: 260, marginBottom: 32 }}>
          <ResponsiveContainer>
            <BarChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e0e0e0" />
              <XAxis dataKey="week" tick={{ fontSize: 12 }} />
              <YAxis tick={{ fontSize: 12 }} />
              <Tooltip formatter={(value) => ['Rs. ' + value, 'Revenue']} />
              <Bar dataKey="revenue" fill="#2e7d32" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}

      <h3 style={{ marginBottom: 12, fontSize: 16 }}>Top-selling crops</h3>
      {data.top_crops.length === 0 ? (
        <p style={{ color: '#666', fontSize: 14 }}>No sales data yet.</p>
      ) : (
        <div style={{ border: '1px solid #eee', borderRadius: 8, overflow: 'hidden' }}>
          <table style={{ width: '100%', fontSize: 14, borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ background: '#faf6ed', textAlign: 'left' }}>
                <th style={{ padding: '10px 16px' }}>Crop</th>
                <th style={{ padding: '10px 16px' }}>Quantity Sold</th>
                <th style={{ padding: '10px 16px' }}>Revenue</th>
              </tr>
            </thead>
            <tbody>
              {data.top_crops.map((c) => (
                <tr key={c.crop_name} style={{ borderTop: '1px solid #eee' }}>
                  <td style={{ padding: '10px 16px' }}>{c.crop_name}</td>
                  <td style={{ padding: '10px 16px' }}>{c.total_quantity}</td>
                  <td style={{ padding: '10px 16px', color: '#2e7d32', fontWeight: 600 }}>
                    {'Rs. ' + c.revenue.toLocaleString('en-IN')}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}