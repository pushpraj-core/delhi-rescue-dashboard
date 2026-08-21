import React from 'react';
import { useNavigate } from 'react-router-dom';
import './Landing.css';

export const Landing: React.FC = () => {
  const navigate = useNavigate();

  return (
    <div className="landing-page">
      <nav>
        <div className="wrap">
          <div className="logo"><span className="dot"></span>Raksha</div>
          <div className="nav-links">
            <a href="#how">How it works</a>
            <a href="#privacy">Privacy</a>
            <a href="#authorities">For authorities</a>
            <a href="#impact">Impact</a>
          </div>
          <div className="nav-cta" style={{ alignItems: 'center' }}>
            <button onClick={() => navigate('/track')} className="btn btn-ghost-dark">Track Report</button>
            <button onClick={() => navigate('/authority')} className="btn btn-ghost-dark">Authority Login</button>
            <button onClick={() => navigate('/report')} className="btn btn-primary">Report Now</button>
            <img src="https://upload.wikimedia.org/wikipedia/commons/5/55/Emblem_of_India.svg" alt="Emblem of India" style={{ height: '36px', marginLeft: '12px' }} />
          </div>
        </div>
      </nav>

      <section className="hero">
        <div className="wrap" style={{ display: 'block', maxWidth: '800px', margin: '0 auto', textAlign: 'center' }}>
          <div>
            <div className="eyebrow" style={{ justifyContent: 'center' }}>PWA · Edge AI · JJ Act, 2015 Compliant</div>
            <h1 style={{ textAlign: 'center' }}>See a child in need?<br/>Report in seconds — <em>without the photo ever leaving your hands.</em></h1>
            <p className="lede" style={{ textAlign: 'center', margin: '0 auto' }}>No app to download. The moment you capture an image, an on-device model finds and blurs the face before anything is saved or sent. Only the report reaches a District Child Protection Unit.</p>
            <div className="hero-ctas" style={{ justifyContent: 'center' }}>
              <button onClick={() => navigate('/report')} className="btn btn-primary">Report Now →</button>
              <a href="#how" className="btn btn-ghost-dark">See how it works</a>
            </div>
            <div className="hero-note" style={{ textAlign: 'center' }}>Works in your browser · Nothing saved to your camera roll · 30-second flow</div>
          </div>
        </div>
      </section>

      <section className="problem">
        <div className="wrap">
          <div className="section-head">
            <div className="eyebrow" style={{ color: 'var(--teal)' }}>The problem</div>
            <h2>Reporting fails long before rescue can begin.</h2>
            <p>Two frictions stop bystanders from acting: the demand to install an app, and the fear of what happens to a child's photo afterward. Raksha removes both.</p>
          </div>
          <div className="stat-grid">
            <div className="stat-card">
              <div className="stat-num">10M+</div>
              <div className="stat-label">Children estimated to be in child labour or on the streets across India.</div>
              <div className="stat-source">Illustrative figure — cite Census / NCPCR data</div>
            </div>
            <div className="stat-card">
              <div className="stat-num">73%</div>
              <div className="stat-label">Of bystanders who notice a child in distress never report it, citing "too much hassle."</div>
              <div className="stat-source">Illustrative figure — replace with field research</div>
            </div>
            <div className="stat-card">
              <div className="stat-num">0</div>
              <div className="stat-label">Photos stored on a reporter's device, at any point in the flow.</div>
              <div className="stat-source">By design</div>
            </div>
          </div>
        </div>
      </section>

      <section className="ledger" id="how">
        <div className="wrap">
          <div className="section-head">
            <div className="eyebrow">How it works</div>
            <h2>Every report is a logged, auditable event.</h2>
            <p>Four steps, each timestamped and recorded in the chain-of-custody log — from the moment a citizen opens the browser to the moment a unit is dispatched.</p>
          </div>
          <div className="log-strip">
            <div className="log-row">
              <div className="log-time">STEP · 01 CAPTURE</div>
              <div className="log-title">Spot & capture</div>
              <div className="log-desc">Open Raksha in any mobile browser and photograph the situation. No install, no account required to begin.</div>
            </div>
            <div className="log-row">
              <div className="log-time">STEP · 02 BLUR</div>
              <div className="log-title">On-device AI blur</div>
              <div className="log-desc">A lightweight TensorFlow.js model detects faces and applies a heavy blur locally. The original frame is purged from memory before it can be saved.</div>
            </div>
            <div className="log-row">
              <div className="log-time">STEP · 03 TRANSMIT</div>
              <div className="log-title">Encrypted, geo-tagged report</div>
              <div className="log-desc">The blurred image, location, and context tags are encrypted and sent to the backend — never stored in plaintext, never linked to the reporter's identity.</div>
            </div>
            <div className="log-row">
              <div className="log-time">STEP · 04 DISPATCH</div>
              <div className="log-title">Authority review & rescue</div>
              <div className="log-desc">A District Child Protection Unit reviews the case on a secure dashboard and dispatches a response team, all within the bounds of the JJ Act, 2015.</div>
            </div>
          </div>
        </div>
      </section>

      <section className="privacy" id="privacy">
        <div className="wrap">
          <div className="privacy-grid">
            <div className="seal">
              <div className="seal-inner">
                <div className="mono-tag">CHAIN OF CUSTODY</div>
                <h3>Legally sound,<br/>by construction</h3>
                <p>Every action logged. Every viewer verified.</p>
              </div>
            </div>
            <div>
              <div className="eyebrow" style={{ color: 'var(--teal)', marginBottom: '20px' }}>Privacy & compliance</div>
              <h2 style={{ fontSize: '30px', marginBottom: '24px' }}>Built for the JJ Act, 2015 — not bolted onto it.</h2>
              <div className="privacy-list">
                <div className="privacy-item">
                  <div className="mark">01</div>
                  <div><h4>Zero photos on your device</h4><p>The original frame never touches your camera roll or local storage — only the blurred, encrypted payload leaves the browser.</p></div>
                </div>
                <div className="privacy-item">
                  <div className="mark">02</div>
                  <div><h4>Key-based access for officers only</h4><p>Reports are decrypted with public/private key pairs held by verified District Child Protection Unit officers — no one else can open a case file.</p></div>
                </div>
                <div className="privacy-item">
                  <div className="mark">03</div>
                  <div><h4>Immutable audit log</h4><p>Every view, dispatch, and status change is written to a tamper-evident log, preserving a legally admissible record of the rescue process.</p></div>
                </div>
                <div className="privacy-item">
                  <div className="mark">04</div>
                  <div><h4>Role-based access control</h4><p>Field officers, unit heads, and administrators each see only what their role in the JJ Act, 2015 framework requires.</p></div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="dashboard" id="authorities">
        <div className="wrap">
          <div className="section-head">
            <div className="eyebrow">For authorities</div>
            <h2>One dashboard, from first report to rescue.</h2>
            <p>Built for District Child Protection Units to triage, deduplicate, and dispatch — without leaving the browser.</p>
          </div>
          <div className="dash-grid">
            <div>
              <div className="mock" style={{ marginBottom: '16px' }}>
                <div className="mock-header"><span>HOTSPOT MAP · DECK.GL</span><div className="mock-dots"><i></i><i></i><i></i></div></div>
                <div className="map-mock"></div>
              </div>
              <div className="mock">
                <div className="mock-header"><span>DISPATCH BOARD</span><div className="mock-dots"><i></i><i></i><i></i></div></div>
                <div className="kanban">
                  <div className="kanban-col"><span>New</span>
                    <div className="kanban-card">Case #A231 · Junction Rd</div>
                    <div className="kanban-card">Case #A233 · Bus Stand</div>
                  </div>
                  <div className="kanban-col"><span>In progress</span>
                    <div className="kanban-card">Case #A228 · Market St</div>
                  </div>
                  <div className="kanban-col"><span>Resolved</span>
                    <div className="kanban-card">Case #A219 · Sector 4</div>
                  </div>
                </div>
              </div>
            </div>
            <div className="dash-features">
              <div className="dash-feature">
                <h4>Role-based access control</h4>
                <p>Field officers, unit heads, and administrators operate within permissions scoped to their role.</p>
              </div>
              <div className="dash-feature">
                <h4>Automatic deduplication</h4>
                <p>Reports filed within a 50-metre radius are merged automatically, so one incident isn't dispatched twice.</p>
              </div>
              <div className="dash-feature">
                <h4>Real-time hotspot mapping</h4>
                <p>Deck.gl visualises report density across a district, helping units plan proactive patrols.</p>
              </div>
              <div className="dash-feature">
                <h4>Drag-and-drop dispatch</h4>
                <p>Move a case from "New" to "In progress" to "Resolved" — every transition is written to the audit log.</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="impact" id="impact">
        <div className="wrap">
          <div className="impact-row">
            <div className="impact-stat"><div className="num">1,204</div><div className="label">REPORTS FILED</div></div>
            <div className="impact-stat"><div className="num">318</div><div className="label">CHILDREN REACHED</div></div>
            <div className="impact-stat"><div className="num">11 MIN</div><div className="label">AVG. RESPONSE TIME</div></div>
            <div className="impact-stat"><div className="num">14</div><div className="label">DISTRICT UNITS ONBOARDED</div></div>
          </div>
          <div className="sample-tag">* Sample data shown for illustration — figures will reflect live deployments once onboarded.</div>
        </div>
      </section>

      <section className="final-cta">
        <div className="wrap">
          <h2>No download. No compromise.<br/>Just report.</h2>
          <p>If you see a child in distress, you can act right now — from the browser you already have open.</p>
          <div className="hero-ctas">
            <button onClick={() => navigate('/report')} className="btn btn-primary">Report Now →</button>
            <button onClick={() => navigate('/track')} className="btn btn-ghost">Track Report</button>
            <button onClick={() => navigate('/authority')} className="btn btn-ghost">Authority Login</button>
          </div>
        </div>
      </section>

      <footer>
        <div className="wrap">
          <div className="footer-grid">
            <div>
              <div className="foot-logo">Raksha</div>
              <p className="foot-desc">A privacy-first reporting platform for children in distress, built to comply with the Juvenile Justice (Care and Protection of Children) Act, 2015.</p>
              <div className="emergency"><b>In immediate danger?</b> Contact Childline at 1098 or the police at 100 before filing a report.</div>
            </div>
            <div>
              <h5>Platform</h5>
              <a href="#how">How it works</a>
              <a href="#privacy">Privacy & compliance</a>
              <a href="#authorities">For authorities</a>
            </div>
            <div>
              <h5>Legal</h5>
              <a href="#">JJ Act, 2015 compliance</a>
              <a href="#">Data policy</a>
              <a href="#">Terms of use</a>
            </div>
            <div>
              <h5>Onboard your unit</h5>
              <a href="#">For NGOs</a>
              <a href="#">For District Child Protection Units</a>
              <a href="#">Contact the team</a>
            </div>
          </div>
          <div className="bottom-bar">
            <span>© 2026 Raksha. Built for public service.</span>
            <span>Reports are encrypted end-to-end and never sold or shared.</span>
          </div>
        </div>
      </footer>
    </div>
  );
};
