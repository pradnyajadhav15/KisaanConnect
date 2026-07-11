import React, { useState, useEffect, useCallback } from 'react';
import '../../styles/ngo/NgoDashboard.css';

// --------------------------------------------------
// NGO DATA
// --------------------------------------------------
const NGO_CATEGORIES = [
  {
    region: 'NGOs in Maharashtra',
    ngos: [
      {
        id: 1,
        name: 'BAIF Development Research Foundation',
        mission: 'BAIF works towards sustainable livelihood for rural farmers through various agricultural interventions and technologies.',
        support: 'Technical support, training, and resources for improved farming practices and livestock development.',
        applyInstructions: 'Contact via email at info@baif.org.in or visit baif.org.in for more information.',
      },
      {
        id: 2,
        name: 'Dharamitra',
        mission: 'Promoting sustainable agriculture and natural resource management in Maharashtra.',
        support: 'Training on organic farming methods, soil conservation, and water management systems.',
        applyInstructions: 'Visit their center in Wardha, Maharashtra or email dharamitra.wardha@gmail.com.',
      },
      {
        id: 3,
        name: 'WOTR (Watershed Organisation Trust)',
        mission: 'Focusing on watershed development and climate change adaptation in drought-prone areas of Maharashtra.',
        support: 'Water conservation infrastructure, sustainable agriculture training, and climate-resilient farming practices.',
        applyInstructions: 'Apply through your local gram panchayat or contact info@wotr.org.',
      },
    ],
  },
  {
    region: 'NGOs working across India',
    ngos: [
      {
        id: 4,
        name: 'Digital Green',
        mission: 'Using technology to empower smallholder farmers across India with knowledge sharing and market access.',
        support: 'Video-based training on agricultural best practices, market linkages, and digital platforms.',
        applyInstructions: 'Join through partner organizations or contact info@digitalgreen.org.',
      },
      {
        id: 5,
        name: 'Action for Social Advancement (ASA)',
        mission: 'Working with tribal and rural communities across multiple states for sustainable livelihoods.',
        support: 'Farmer producer organizations, irrigation systems, and sustainable agriculture training.',
        applyInstructions: 'Contact via asa.org.in or visit a field office near you.',
      },
      {
        id: 6,
        name: 'PRADAN (Professional Assistance for Development Action)',
        mission: "Enabling poor rural families across India to live a life of dignity.",
        support: "Women's self-help groups, technical assistance for agriculture, and market linkages.",
        applyInstructions: 'Reach out to local PRADAN teams or email info@pradan.net.',
      },
    ],
  },
];

// ⚠️ REPLACE THIS with your OWN Google Form link.
// Create a free form at https://forms.google.com, click "Send" -> link icon,
// copy the URL, and paste it here. Until you do, Quick Apply has nowhere real to go.
const QUICK_APPLY_URL = 'https://docs.google.com/forms/d/e/1FAIpQLScKsIEh20QWV-di-sfTWEzCC6uHNVZdz8m3qzn4YCIW2JJywQ/viewform?usp=publish-editor';


// --------------------------------------------------
// COMPONENT
// --------------------------------------------------
const NgoDashboard = () => {
  const [selectedNgo, setSelectedNgo] = useState(null);

  // Close on Escape key
  useEffect(() => {
    if (!selectedNgo) return;
    const handleKey = (e) => { if (e.key === 'Escape') setSelectedNgo(null); };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [selectedNgo]);

  // Lock body scroll when modal open
  useEffect(() => {
    document.body.style.overflow = selectedNgo ? 'hidden' : '';
    return () => { document.body.style.overflow = ''; };
  }, [selectedNgo]);

  const openQuickApply = useCallback(() => {
    // Try to open in a new tab. If the browser blocks the popup
    // (returns null), fall back to navigating the current tab so the
    // button never appears to "do nothing".
    const win = window.open(QUICK_APPLY_URL, '_blank', 'noopener,noreferrer');
    if (!win) {
      window.location.href = QUICK_APPLY_URL;
    }
  }, []);

  const closeModal = useCallback(() => setSelectedNgo(null), []);

  return (
    <div className="ngo-dashboard">

      <div className="dashboard-header">
        <h1>NGO Support Dashboard</h1>
        <p>Connect with NGOs that support farmers and sustainable agriculture</p>
      </div>

      {/* Quick Apply */}
      <div className="quick-apply-section">
        <h2>Quick Apply</h2>
        <p>Apply to all participating NGOs with a single form</p>
        <button className="quick-apply-button" onClick={openQuickApply}>
          Quick Apply
        </button>
      </div>

      {/* Custom Apply */}
      <div className="custom-apply-section">
        <h2>Custom Apply</h2>
        <p>Choose specific NGOs to learn about and apply directly</p>

        <div className="ngo-categories">
          {NGO_CATEGORIES.map(({ region, ngos }) => (
            <div key={region} className="ngo-category">
              <h3>{region}</h3>
              <div className="ngo-list">
                {ngos.map(ngo => (
                  <button
                    key={ngo.id}
                    className="ngo-button"
                    onClick={() => setSelectedNgo(ngo)}
                  >
                    {ngo.name}
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Modal */}
      {selectedNgo && (
        <div
          className="ngo-modal-overlay"
          onClick={closeModal}
          role="dialog"
          aria-modal="true"
          aria-labelledby="ngo-modal-title"
        >
          <div className="ngo-modal" onClick={e => e.stopPropagation()}>
            <button
              className="close-modal"
              onClick={closeModal}
              aria-label="Close modal"
            >×</button>

            <h2 id="ngo-modal-title">{selectedNgo.name}</h2>

            <div className="ngo-modal-content">
              {[
                { title: 'Mission',          text: selectedNgo.mission },
                { title: 'Support Provided', text: selectedNgo.support },
                { title: 'How to Apply',     text: selectedNgo.applyInstructions },
              ].map(({ title, text }) => (
                <div key={title} className="ngo-details-section">
                  <h3>{title}</h3>
                  <p>{text}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

    </div>
  );
};

export default NgoDashboard;